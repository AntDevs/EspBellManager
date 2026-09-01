import React, { useEffect, useRef } from 'react';
import { EspBellConfig, AudioTrackInfo } from '../types';
import { loadHtmlTemplate, bindTemplate } from '../utils/templateBinder';
import { decodeAudioFile, processAndEncodeWav, getAudioContext } from '../utils/audioEncoder';
import { playAudioBuffer } from '../utils/synthBell';
import { apiClient } from '../utils/apiClient';
import { authenticateWithPassword } from '../utils/cryptoAuth';

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
          } catch (err: any) {
            console.error('Audio decode error:', err);
            const errorBox = containerRef.current?.querySelector('#tpl-upload-error-box');
            const errorMsg = containerRef.current?.querySelector('#tpl-upload-error-message');
            if (errorBox && errorMsg) {
              errorMsg.textContent = `Ошибка декодирования аудио: ${err?.message || 'Формат не поддерживается или файл поврежден'}. Попробуйте стандартный MP3 или WAV файл.`;
              errorBox.classList.remove('hidden');
            } else {
              alert(`Ошибка декодирования аудиофайла: ${err?.message || ''}`);
            }
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
                const errorBox = containerRef.current?.querySelector('#tpl-upload-error-box');
                const errorMsg = containerRef.current?.querySelector('#tpl-upload-error-message');
                if (errorBox && errorMsg) {
                  errorMsg.textContent = 'Сначала выберите или перетащите аудиофайл.';
                  errorBox.classList.remove('hidden');
                } else {
                  alert('Сначала выберите аудиофайл');
                }
                return;
              }

              const progressContainer = containerRef.current?.querySelector('#tpl-upload-progress-container') as HTMLElement | null;
              const statusLabel = containerRef.current?.querySelector('#tpl-upload-status-label') as HTMLElement | null;
              const percentLabel = containerRef.current?.querySelector('#tpl-upload-percent') as HTMLElement | null;
              const progressBar = containerRef.current?.querySelector('#tpl-upload-progress-bar') as HTMLElement | null;
              const uploadBtn = containerRef.current?.querySelector('#btn-encode-upload') as HTMLButtonElement | null;
              const errorBox = containerRef.current?.querySelector('#tpl-upload-error-box') as HTMLElement | null;
              const errorMsg = containerRef.current?.querySelector('#tpl-upload-error-message') as HTMLElement | null;
              const successBox = containerRef.current?.querySelector('#tpl-upload-success-box') as HTMLElement | null;
              const successMsg = containerRef.current?.querySelector('#tpl-upload-success-message') as HTMLElement | null;

              if (errorBox) errorBox.classList.add('hidden');
              if (successBox) successBox.classList.add('hidden');
              if (progressContainer) progressContainer.classList.remove('hidden');
              if (uploadBtn) uploadBtn.disabled = true;

              try {
                // Step 1: Client-side Re-encoding (MP3/AAC -> 16-bit PCM WAV)
                if (statusLabel) statusLabel.textContent = '1/3 Перекодирование в 16-bit PCM WAV (32 кГц, Моно)...';
                if (percentLabel) percentLabel.textContent = '35%';
                if (progressBar) {
                  progressBar.style.width = '35%';
                  progressBar.className = 'h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-300';
                }

                const dur = Math.max(0.5, trimEndRef.current - trimStartRef.current);
                const processed = await processAndEncodeWav(loadedAudioBufferRef.current, {
                  startTime: trimStartRef.current,
                  duration: dur,
                  gain: config.gain_scale,
                  targetSampleRate: config.i2s_sample_rate || 32000,
                  channels: 1, // 1 = Mono (target format for ESP32 I2S memory optimization)
                  maxSizeBytes: 4194304,
                });

                // Step 2: Obtain Nonce & Compute Auth Token
                if (statusLabel) statusLabel.textContent = '2/3 Получение Nonce и генерация SHA-256 хэша...';
                if (percentLabel) percentLabel.textContent = '50%';
                if (progressBar) progressBar.style.width = '50%';

                let authHeaders: { token?: string; hash?: string; nonce?: string } = {};
                try {
                  const nonceRes = await apiClient.getNonce();
                  if (nonceRes.success && nonceRes.data?.nonce) {
                    const hash = await authenticateWithPassword(config.admin_password, nonceRes.data.nonce);
                    authHeaders = {
                      hash,
                      token: hash,
                      nonce: nonceRes.data.nonce,
                    };
                  }
                } catch {
                  // Nonce query error handled gracefully
                }

                // Step 3: Stream WAV bytes to ESP32 /upload REST API
                if (statusLabel) statusLabel.textContent = `3/3 Отправка потока в ${apiClient.getBaseUrl()}/upload (${(processed.blob.size / 1024).toFixed(1)} KB)...`;

                const targetFilename = config.target_filename || 'bell.wav';
                const uploadRes = await apiClient.uploadWav(
                  processed.blob, 
                  targetFilename, 
                  loadedFileNameRef.current.replace(/\.[^/.]+$/, ''),
                  authHeaders,
                  (pct) => {
                    const mappedPct = Math.round(50 + (pct * 0.5));
                    if (percentLabel) percentLabel.textContent = `${mappedPct}%`;
                    if (progressBar) progressBar.style.width = `${mappedPct}%`;
                    if (statusLabel) statusLabel.textContent = `3/3 Отправка потока (${pct}%)...`;
                  }
                );

                if (uploadRes.success) {
                  if (percentLabel) percentLabel.textContent = '100%';
                  if (progressBar) progressBar.style.width = '100%';
                  if (statusLabel) statusLabel.textContent = '✅ Файл успешно сохранен во Flash-память ESP32!';

                  const track: AudioTrackInfo = {
                    filename: targetFilename,
                    title: loadedFileNameRef.current.replace(/\.[^/.]+$/, ''),
                    format: `PCM WAV (16-bit ${processed.channels === 1 ? 'Mono' : 'Stereo'})`,
                    sizeBytes: processed.blob.size,
                    durationSeconds: processed.duration,
                    sampleRate: processed.sampleRate,
                    channels: processed.channels,
                    bitDepth: 16,
                    rawWavBlob: processed.blob,
                    uploadedAt: new Date().toLocaleTimeString(),
                  };

                  if (successBox) {
                    successBox.classList.remove('hidden');
                    if (successMsg) {
                      successMsg.textContent = `Мелодия "${track.title}" (${(track.sizeBytes / 1024).toFixed(1)} КБ, ${track.durationSeconds.toFixed(1)} с, ${track.sampleRate} Гц) успешно записана на устройство.`;
                    }
                    const gotoBtn = successBox.querySelector('#btn-goto-main') as HTMLButtonElement | null;
                    if (gotoBtn) {
                      gotoBtn.onclick = () => onUploadSuccess(track);
                    }
                  }

                  if (uploadBtn) uploadBtn.disabled = false;
                } else {
                  // Upload failed: NEVER close or navigate away! Stay on the page and display full error details
                  if (uploadBtn) uploadBtn.disabled = false;
                  if (progressBar) {
                    progressBar.className = 'h-full bg-rose-500 transition-all duration-300';
                  }
                  if (statusLabel) {
                    statusLabel.textContent = `❌ Ошибка передачи на ESP32 (${uploadRes.error || `HTTP ${uploadRes.status}`})`;
                  }
                  if (errorBox) {
                    errorBox.classList.remove('hidden');
                    if (errorMsg) {
                      errorMsg.innerHTML = `
                        <div><strong>Статус:</strong> ${uploadRes.status ? `HTTP ${uploadRes.status}` : 'Сетевой сбой (Network Error)'}</div>
                        <div><strong>Причина:</strong> ${uploadRes.error || 'Устройство не отвечает или сбросило соединение'}</div>
                        <div class="mt-1 text-slate-300"><strong>Рекомендации:</strong>
                          <ul class="list-disc pl-5 mt-1 space-y-0.5 text-[11px]">
                            <li>Проверьте в разделе «Конфигурация» URL устройства (сейчас: <code>${apiClient.getBaseUrl()}</code>).</li>
                            <li>Убедитесь, что ESP32 включен и находится в одной Wi-Fi сети с вашим компьютером.</li>
                            <li>Если используется HTTPS с самоподписанным сертификатом, откройте <code>${apiClient.getBaseUrl()}/api/info</code> в отдельной вкладке и подтвердите исключение безопасности.</li>
                          </ul>
                        </div>
                      `;
                    }
                  }
                }
              } catch (err: any) {
                console.error('Encoding/Upload error:', err);
                if (uploadBtn) uploadBtn.disabled = false;
                if (progressBar) {
                  progressBar.className = 'h-full bg-rose-500 transition-all duration-300';
                }
                if (statusLabel) statusLabel.textContent = `❌ Ошибка: ${err.message || 'Сбой кодирования'}`;
                if (errorBox) {
                  errorBox.classList.remove('hidden');
                  if (errorMsg) {
                    errorMsg.textContent = `Исключение при обработке аудио: ${err.message || 'Неизвестная ошибка'}. Окно остается открытым для повторной попытки.`;
                  }
                }
              }
            },
          },
        });

        // Setup error dismiss button
        const dismissBtn = containerRef.current.querySelector('#btn-dismiss-upload-error');
        if (dismissBtn) {
          dismissBtn.addEventListener('click', () => {
            const errBox = containerRef.current?.querySelector('#tpl-upload-error-box');
            if (errBox) errBox.classList.add('hidden');
          });
        }

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

        // Display current target host in upload view
        const targetUrlEl = containerRef.current.querySelector('#tpl-upload-target-url');
        if (targetUrlEl) {
          targetUrlEl.textContent = `${apiClient.getBaseUrl()}/upload`;
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
