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
  targetSampleRate?: number; // 44100 or 22050
}

/**
 * Processes audio (crop, gain, fade-in/out, resample, mono-to-stereo) and encodes into standard 16-bit PCM WAV
 */
export async function processAndEncodeWav(
  sourceBuffer: AudioBuffer,
  options: AudioProcessOptions = {}
): Promise<{ blob: Blob; arrayBuffer: ArrayBuffer; duration: number; sampleRate: number; channels: number }> {
  const targetSampleRate = options.targetSampleRate || 44100;
  const startSec = Math.max(0, options.startTime || 0);
  const maxAvailableDuration = Math.max(0, sourceBuffer.duration - startSec);
  const durationSec = options.duration ? Math.min(options.duration, maxAvailableDuration) : maxAvailableDuration;
  
  if (durationSec <= 0.05) {
    throw new Error('Длительность фрагмента слишком мала (менее 0.05с)');
  }

  const numChannels = 2; // ESP32 I2S expects 16-bit stereo
  const totalFrames = Math.floor(durationSec * targetSampleRate);
  
  // Use OfflineAudioContext to render the trimmed, resampled and gain-adjusted audio
  const offlineCtx = new OfflineAudioContext(
    numChannels,
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
  const wavArrayBuffer = encodeAudioBufferToWav16Bit(renderedBuffer);
  const wavBlob = new Blob([wavArrayBuffer], { type: 'audio/wav' });

  return {
    blob: wavBlob,
    arrayBuffer: wavArrayBuffer,
    duration: durationSec,
    sampleRate: targetSampleRate,
    channels: numChannels,
  };
}

/**
 * Encodes an AudioBuffer into a binary PCM 16-bit stereo WAV with canonical 44-byte RIFF header
 */
export function encodeAudioBufferToWav16Bit(audioBuffer: AudioBuffer): ArrayBuffer {
  const numChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numChannels * bytesPerSample;
  
  const length = audioBuffer.length;
  const dataByteLength = length * blockAlign;
  const buffer = new ArrayBuffer(44 + dataByteLength);
  const view = new DataView(buffer);

  // RIFF identifier 'RIFF'
  writeString(view, 0, 'RIFF');
  // RIFF chunk length = file size - 8
  view.setUint32(4, 36 + dataByteLength, true);
  // RIFF type 'WAVE'
  writeString(view, 8, 'WAVE');
  
  // Format chunk identifier 'fmt '
  writeString(view, 12, 'fmt ');
  // Format chunk length = 16 for PCM
  view.setUint32(16, 16, true);
  // Audio format 1 = PCM (uncompressed)
  view.setUint16(20, 1, true);
  // Channels
  view.setUint16(22, numChannels, true);
  // Sample rate
  view.setUint32(24, sampleRate, true);
  // Byte rate = SampleRate * NumChannels * BitsPerSample/8
  view.setUint32(28, sampleRate * blockAlign, true);
  // Block align
  view.setUint16(32, blockAlign, true);
  // Bits per sample
  view.setUint16(34, bitsPerSample, true);
  
  // Data chunk identifier 'data'
  writeString(view, 36, 'data');
  // Data chunk length
  view.setUint32(40, dataByteLength, true);

  // Write interleaved PCM 16-bit samples
  const channelData: Float32Array[] = [];
  for (let i = 0; i < numChannels; i++) {
    channelData.push(audioBuffer.getChannelData(i));
  }

  let offset = 44;
  for (let i = 0; i < length; i++) {
    for (let channel = 0; channel < numChannels; channel++) {
      // Clamp between -1.0 and 1.0
      let sample = channelData[channel][i];
      if (sample > 1) sample = 1;
      if (sample < -1) sample = -1;
      
      // Convert Float32 (-1..1) to Int16 (-32768..32767)
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      view.setInt16(offset, intSample, true);
      offset += 2;
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
