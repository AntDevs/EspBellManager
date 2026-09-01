/**
 * Client-side Web Audio decoder & 16-bit stereo PCM WAV encoder.
 * Matches EspBellAdmin architecture specifications (audio_utils.py / app.js)
 */

let globalAudioCtx: AudioContext | null = null;

export function getAudioContext(): AudioContext {
  if (!globalAudioCtx) {
    const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    globalAudioCtx = new AudioCtxClass();
  }
  if (globalAudioCtx.state === 'suspended') {
    globalAudioCtx.resume().catch(() => {});
  }
  return globalAudioCtx;
}

/**
 * Decodes any audio file (MP3, WAV, AAC, OGG, FLAC) into an AudioBuffer using the browser's Web Audio API
 */
export async function decodeAudioFile(blobOrFile: Blob | File): Promise<AudioBuffer> {
  const ctx = getAudioContext();
  const arrayBuffer = await blobOrFile.arrayBuffer();
  // Decode audio data (use copy in case arrayBuffer is detached)
  const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
  return audioBuffer;
}

export interface AudioProcessOptions {
  startTime?: number; // In seconds
  duration?: number; // In seconds (cut length)
  gain?: number; // Gain multiplier (0.1 - 3.0)
  fadeInMs?: number; // In milliseconds
  fadeOutMs?: number; // In milliseconds
  targetSampleRate?: number; // 32000 (default for ESP32)
  channels?: number; // 1 (mono default)
  maxSizeBytes?: number; // e.g. 4194304
}

/**
 * Processes audio (crop, gain, fade-in/out, resample to 32kHz mono) and encodes into standard 16-bit PCM WAV
 * Matches the exact audio.js pipeline from EspBellAdmin
 */
export async function processAndEncodeWav(
  sourceBuffer: AudioBuffer,
  options: AudioProcessOptions = {}
): Promise<{ blob: Blob; arrayBuffer: ArrayBuffer; duration: number; sampleRate: number; channels: number }> {
  const targetSampleRate = options.targetSampleRate || 32000;
  const targetChannels = options.channels !== undefined ? options.channels : 1; // 1 = Mono
  const startSec = Math.max(0, options.startTime || 0);
  const maxAvailableDuration = Math.max(0, sourceBuffer.duration - startSec);
  const durationSec = options.duration ? Math.min(options.duration, maxAvailableDuration) : maxAvailableDuration;
  
  if (durationSec <= 0.05) {
    throw new Error('Длительность фрагмента слишком мала (менее 0.05с)');
  }

  const totalFrames = Math.floor(durationSec * targetSampleRate);
  
  // Use OfflineAudioContext to render the trimmed, resampled and gain-adjusted audio
  const offlineCtx = new OfflineAudioContext(
    targetChannels,
    totalFrames,
    targetSampleRate
  );

  const sourceNode = offlineCtx.createBufferSource();
  sourceNode.buffer = sourceBuffer;

  const gainNode = offlineCtx.createGain();
  const baseGain = options.gain !== undefined ? options.gain : 1.0;
  
  const fadeInDuration = (options.fadeInMs || 0) / 1000;
  const fadeOutDuration = (options.fadeOutMs || 0) / 1000;

  if (fadeInDuration > 0) {
    gainNode.gain.setValueAtTime(0, 0);
    gainNode.gain.linearRampToValueAtTime(baseGain, Math.min(fadeInDuration, durationSec / 2));
  } else {
    gainNode.gain.setValueAtTime(baseGain, 0);
  }

  if (fadeOutDuration > 0 && durationSec > fadeOutDuration) {
    const fadeOutStart = durationSec - fadeOutDuration;
    gainNode.gain.setValueAtTime(baseGain, fadeOutStart);
    gainNode.gain.linearRampToValueAtTime(0.0001, durationSec);
  }

  sourceNode.connect(gainNode);
  gainNode.connect(offlineCtx.destination);

  sourceNode.start(0, startSec, durationSec);

  const renderedBuffer = await offlineCtx.startRendering();
  
  // Convert rendered AudioBuffer to 16-bit PCM WAV array buffer with max size truncation if needed
  const maxSizeBytes = options.maxSizeBytes || 4194304;
  const wavArrayBuffer = encodeAudioBufferToWav16Bit(renderedBuffer, maxSizeBytes);
  const wavBlob = new Blob([wavArrayBuffer], { type: 'audio/wav' });

  const finalDuration = (wavArrayBuffer.byteLength - 44) / (targetSampleRate * targetChannels * 2);

  return {
    blob: wavBlob,
    arrayBuffer: wavArrayBuffer,
    duration: Math.max(0.1, finalDuration),
    sampleRate: targetSampleRate,
    channels: targetChannels,
  };
}

/**
 * Encodes an AudioBuffer into a binary PCM 16-bit WAV with canonical 44-byte RIFF header
 * Supports 1 or 2 channels and optional max file size clamping (from audio.js)
 */
export function encodeAudioBufferToWav16Bit(audioBuffer: AudioBuffer, maxSizeBytes = 4194304): ArrayBuffer {
  const numOfChan = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const bytesPerFrame = numOfChan * 2; // 16-bit = 2 bytes per sample

  const maxDataBytes = Math.max(0, maxSizeBytes - 44);
  const maxFrames = Math.floor(maxDataBytes / bytesPerFrame);
  const framesToEncode = Math.min(audioBuffer.length, maxFrames);
  const dataChunkSize = framesToEncode * bytesPerFrame;
  const fileLength = dataChunkSize + 44;

  const buffer = new ArrayBuffer(fileLength);
  const view = new DataView(buffer);
  let pos = 0;

  function setUint16(data: number) { view.setUint16(pos, data, true); pos += 2; }
  function setUint32(data: number) { view.setUint32(pos, data, true); pos += 4; }

  setUint32(0x46464952); // "RIFF"
  setUint32(fileLength - 8);
  setUint32(0x45564157); // "WAVE"
  setUint32(0x20746d66); // "fmt "
  setUint32(16);
  setUint16(1);          // PCM
  setUint16(numOfChan);
  setUint32(sampleRate);
  setUint32(sampleRate * bytesPerFrame);
  setUint16(bytesPerFrame);
  setUint16(16);
  setUint32(0x61746164); // "data"
  setUint32(dataChunkSize);

  const channels: Float32Array[] = [];
  for (let i = 0; i < numOfChan; i++) {
    channels.push(audioBuffer.getChannelData(i));
  }

  for (let offset = 0; offset < framesToEncode; offset++) {
    for (let i = 0; i < numOfChan; i++) {
      let sample = Math.max(-1, Math.min(1, channels[i][offset]));
      sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
      view.setInt16(pos, sample, true);
      pos += 2;
    }
  }

  return buffer;
}

function writeString(view: DataView, offset: number, string: string): void {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

/**
 * Creates visual peaks for audio waveform rendering on canvas
 */
export function extractWaveformPeaks(audioBuffer: AudioBuffer, numPeaks = 200): number[] {
  const channelData = audioBuffer.getChannelData(0);
  const step = Math.floor(channelData.length / numPeaks);
  const peaks: number[] = [];

  for (let i = 0; i < numPeaks; i++) {
    const start = i * step;
    const end = Math.min(start + step, channelData.length);
    let max = 0;
    for (let j = start; j < end; j++) {
      const val = Math.abs(channelData[j]);
      if (val > max) max = val;
    }
    peaks.push(max);
  }

  return peaks;
}
