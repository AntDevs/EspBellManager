import React, { useEffect, useRef } from 'react';
import { EspBellConfig, AudioTrackInfo } from '../types';
import { loadHtmlTemplate, bindTemplate } from '../utils/templateBinder';
import { decodeAudioFile, processAndEncodeWav, getAudioContext } from '../utils/audioEncoder';
import { playAudioBuffer } from '../utils/synthBell';

interface UploadViewProps {
  config: EspBellConfig;
  onUploadSuccess: (track: AudioTrackInfo) => void;
}

/**
 * UploadView Controller (Option 2: Pure HTML Template + Data Binding)
 * Zero JSX markup: The DOM structure is loaded dynamically from /public/templates/upload.html
 */
export const UploadView: React.FC<UploadViewProps> = ({ config, onUploadSuccess }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const binderRef = useRef<{ update: (data: any) => void; destroy: () => void } | null>(null);
  const loadedAudioBufferRef = useRef<AudioBuffer | null>(null);
  const loadedFileNameRef = useRef<string>('bell_audio.mp3');
  const trimStartRef = useRef<number>(0);
  const trimEndRef = useRef<number>(3.5);
  const previewPlayerRef = useRef<{ stop: () => void } | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function mount() {
      if (!containerRef.current) return;

      try {
        const html = await loadHtmlTemplate('upload');
        if (!isMounted || !containerRef.current) return;

        if (binderRef.current) {
          binderRef.current.destroy();
        }

        const handleFile = async (file: File) => {
          try {
            const decoded = await decodeAudioFile(file);
            loadedAudioBufferRef.current = decoded;
            loadedFileNameRef.current = file.name;
            trimStartRef.current = 0;
            trimEndRef.current = Math.min(10, decoded.duration);

            const filenameEl = containerRef.current?.querySelector('#tpl-loaded-filename');
            const metaEl = containerRef.current?.querySelector('#tpl-loaded-meta');
            const startValEl = containerRef.current?.querySelector('#tpl-start-time-val');
            const endValEl = containerRef.current?.querySelector('#tpl-end-time-val');
            const inputStart = containerRef.current?.querySelector('#input-trim-start') as HTMLInputElement | null;
            const inputEnd = containerRef.current?.querySelector('#input-trim-end') as HTMLInputElement | null;

            if (filenameEl) filenameEl.textContent = file.name;
            if (metaEl) metaEl.textContent = `Исходная длительность: ${decoded.duration.toFixed(1)} сек • ${decoded.sampleRate} Hz`;
            if (startValEl) startValEl.textContent = '0.0 с';
            if (endValEl) endValEl.textContent = `${trimEndRef.current.toFixed(1)} с`;
            if (inputStart) {
              inputStart.max = decoded.duration.toString();
              inputStart.value = '0';
            }
            if (inputEnd) {
              inputEnd.max = decoded.duration.toString();
              inputEnd.value = trimEndRef.current.toString();
            }
          } catch (err) {
            console.error('Audio decode error:', err);
            alert('Ошибка декодирования аудиофайла');
          }
        };

        const binder = bindTemplate(containerRef.current, html, {
          data: {},
          actions: {
            openFileDialog: () => {
              const fileInput = containerRef.current?.querySelector('#tpl-file-input') as HTMLInputElement | null;
              fileInput?.click();
            },
            changeTrimStart: (e: Event) => {
              const val = parseFloat((e.target as HTMLInputElement).value);
              trimStartRef.current = val;
              const el = containerRef.current?.querySelector('#tpl-start-time-val');
              if (el) el.textContent = `${val.toFixed(1)} с`;
            },
            changeTrimEnd: (e: Event) => {
              const val = parseFloat((e.target as HTMLInputElement).value);
              trimEndRef.current = val;
              const el = containerRef.current?.querySelector('#tpl-end-time-val');
              if (el) el.textContent = `${val.toFixed(1)} с`;
            },
            previewTrimmed: async () => {
              if (!loadedAudioBufferRef.current) return;
              if (previewPlayerRef.current) {
                previewPlayerRef.current.stop();
                previewPlayerRef.current = null;
                const btn = containerRef.current?.querySelector('#btn-preview-trim');
                if (btn) btn.textContent = '▶ Прослушать фрагмент';
                return;
              }

              try {
                const dur = Math.max(0.5, trimEndRef.current - trimStartRef.current);
                const processed = await processAndEncodeWav(loadedAudioBufferRef.current, {
                  startTime: trimStartRef.current,
                  duration: dur,
                  gain: config.gain_scale,
                  targetSampleRate: config.i2s_sample_rate,
                });

                const ctx = getAudioContext();
                const previewBuffer = await ctx.decodeAudioData(processed.arrayBuffer.slice(0));
                const btn = containerRef.current?.querySelector('#btn-preview-trim');
                if (btn) btn.textContent = '⏹ Остановить';

                previewPlayerRef.current = playAudioBuffer(previewBuffer, {
                  volume: 1.0,
                  onEnded: () => {
                    if (btn) btn.textContent = '▶ Прослушать фрагмент';
                    previewPlayerRef.current = null;
                  },
                });
              } catch (err) {
                console.error('Preview error:', err);
              }
            },
            encodeAndUpload: async () => {
              if (!loadedAudioBufferRef.current) {
                alert('Сначала выберите аудиофайл');
                return;
              }

              const dur = Math.max(0.5, trimEndRef.current - trimStartRef.current);
              const processed = await processAndEncodeWav(loadedAudioBufferRef.current, {
                startTime: trimStartRef.current,
                duration: dur,
                gain: config.gain_scale,
                targetSampleRate: config.i2s_sample_rate,
              });

              const track: AudioTrackInfo = {
                filename: config.target_filename || 'bell.wav',
                title: loadedFileNameRef.current.replace(/\.[^/.]+$/, ''),
                format: 'PCM WAV (16-bit Stereo)',
                sizeBytes: processed.blob.size,
                durationSeconds: processed.duration,
                sampleRate: processed.sampleRate,
                channels: processed.channels,
                bitDepth: 16,
                rawWavBlob: processed.blob,
                uploadedAt: new Date().toLocaleTimeString(),
              };

              onUploadSuccess(track);
            },
          },
        });

        // Setup dropzone & file input listener
        const fileInput = containerRef.current.querySelector('#tpl-file-input') as HTMLInputElement | null;
        if (fileInput) {
          fileInput.addEventListener('change', (e) => {
            const files = (e.target as HTMLInputElement).files;
            if (files && files[0]) {
              handleFile(files[0]);
            }
          });
        }

        const dropzone = containerRef.current.querySelector('#tpl-dropzone');
        if (dropzone) {
          dropzone.addEventListener('dragover', (e) => e.preventDefault());
          dropzone.addEventListener('drop', (e: any) => {
            e.preventDefault();
            if (e.dataTransfer?.files && e.dataTransfer.files[0]) {
              handleFile(e.dataTransfer.files[0]);
            }
          });
        }

        binderRef.current = binder;
      } catch (err) {
        console.error('Failed to load /templates/upload.html:', err);
      }
    }

    mount();

    return () => {
      isMounted = false;
      if (binderRef.current) {
        binderRef.current.destroy();
      }
      if (previewPlayerRef.current) {
        previewPlayerRef.current.stop();
      }
    };
  }, [config, onUploadSuccess]);

  return <div ref={containerRef} id="upload-view-container" className="w-full" />;
};
