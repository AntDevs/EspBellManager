import { PresetMelody } from '../types';
import { getAudioContext } from './audioEncoder';

/**
 * Synthesizes a realistic audio buffer for a PresetMelody using additive bell synthesis
 */
export async function synthesizePresetChime(preset: PresetMelody): Promise<AudioBuffer> {
  const sampleRate = 44100;
  const duration = preset.duration + 1.0; // Add decay tail
  const offlineCtx = new OfflineAudioContext(2, Math.ceil(duration * sampleRate), sampleRate);

  // Master reverb / space simulator
  const masterGain = offlineCtx.createGain();
  masterGain.gain.setValueAtTime(0.85, 0);
  masterGain.connect(offlineCtx.destination);

  // Synthesize each note with physical bell resonance overtones
  preset.notes.forEach((note) => {
    const startTime = note.delay;
    const noteDuration = note.duration;
    const baseGain = note.gain || 0.8;

    // Harmonic bell partials: Fundamental (1.0), Hum (0.5), Tierce/Minor Third (1.2), Quint/Fifth (1.5), Nominal (2.0), Superquint (3.0)
    const partials = [
      { ratio: 1.0, amp: 1.0 * baseGain, decay: noteDuration * 1.2 },
      { ratio: 0.5, amp: 0.4 * baseGain, decay: noteDuration * 1.5 },
      { ratio: 1.19, amp: 0.3 * baseGain, decay: noteDuration * 0.9 },
      { ratio: 1.5, amp: 0.25 * baseGain, decay: noteDuration * 0.7 },
      { ratio: 2.0, amp: 0.2 * baseGain, decay: noteDuration * 0.6 },
      { ratio: 2.76, amp: 0.15 * baseGain, decay: noteDuration * 0.4 },
      { ratio: 4.07, amp: 0.08 * baseGain, decay: noteDuration * 0.3 },
    ];

    partials.forEach((partial) => {
      const osc = offlineCtx.createOscillator();
      const gain = offlineCtx.createGain();

      osc.type = (note.type as OscillatorType) || 'sine';
      osc.frequency.setValueAtTime(note.freq * partial.ratio, startTime);

      // Bell strike attack (sharp 2-5ms) + exponential ring-out decay
      const strikeTime = 0.005;
      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.exponentialRampToValueAtTime(partial.amp, startTime + strikeTime);
      gain.gain.exponentialRampToValueAtTime(0.00001, startTime + strikeTime + partial.decay);

      osc.connect(gain);
      gain.connect(masterGain);

      osc.start(startTime);
      osc.stop(startTime + strikeTime + partial.decay + 0.1);
    });
  });

  return await offlineCtx.startRendering();
}

/**
 * Plays an AudioBuffer directly to the user's speakers
 */
export function playAudioBuffer(
  audioBuffer: AudioBuffer,
  options?: {
    volume?: number;
    onEnded?: () => void;
  }
): { stop: () => void } {
  const ctx = getAudioContext();
  const source = ctx.createBufferSource();
  source.buffer = audioBuffer;

  const gainNode = ctx.createGain();
  gainNode.gain.setValueAtTime(options?.volume !== undefined ? options.volume : 1.0, ctx.currentTime);

  source.connect(gainNode);
  gainNode.connect(ctx.destination);

  let isStopped = false;

  source.onended = () => {
    if (!isStopped && options?.onEnded) {
      options.onEnded();
    }
  };

  source.start(0);

  return {
    stop: () => {
      if (!isStopped) {
        isStopped = true;
        try {
          // Quick 30ms fade to avoid speaker click
          gainNode.gain.setValueAtTime(gainNode.gain.value, ctx.currentTime);
          gainNode.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.03);
          setTimeout(() => {
            try {
              source.stop();
              source.disconnect();
            } catch {}
          }, 35);
        } catch {}
        if (options?.onEnded) options.onEnded();
      }
    },
  };
}
