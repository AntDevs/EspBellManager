import React, { useEffect, useRef } from 'react';
import { EspBellConfig } from '../types';
import { loadHtmlTemplate, bindTemplate } from '../utils/templateBinder';
import { initialConfig } from '../data/defaultConfig';
import { apiClient } from '../utils/apiClient';

interface ConfigViewProps {
  config: EspBellConfig;
  onSaveConfig: (updated: EspBellConfig) => void;
  onResetDefaults: () => void;
}

/**
 * ConfigView Controller (Option 2: Pure HTML Template + Data Binding)
 * Zero JSX markup: The DOM structure is loaded dynamically from /public/templates/config.html
 */
export const ConfigView: React.FC<ConfigViewProps> = ({
  config,
  onSaveConfig,
  onResetDefaults,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const binderRef = useRef<{ update: (data: any) => void; destroy: () => void } | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function mount() {
      if (!containerRef.current) return;

      try {
        const html = await loadHtmlTemplate('config');
        if (!isMounted || !containerRef.current) return;

        if (binderRef.current) {
          binderRef.current.destroy();
        }

        const dataModel = {
          smart_timeout_sec: config.smart_timeout_sec,
          target_filename: config.target_filename,
          gain_scale: config.gain_scale,
          sample_rate: config.i2s_sample_rate,
          wifi_ssid: config.wifi_ssid,
          wifi_password: config.wifi_password,
          admin_password: config.admin_password,
          hostname: `${config.wifi_ap_ssid || 'bell555'}.local`,
          target_esp_url: config.target_esp_url || 'https://bell555.local',
        };

        const binder = bindTemplate(containerRef.current, html, {
          data: dataModel,
          actions: {
            testEspConnection: async () => {
              if (!containerRef.current) return;
              const espUrlInput = containerRef.current.querySelector('#cfg-esp-target-url') as HTMLInputElement | null;
              const statusEl = containerRef.current.querySelector('#conn-test-status') as HTMLElement | null;
              const infoLabel = containerRef.current.querySelector('#label-resolved-info-url') as HTMLElement | null;

              const urlToTest = (espUrlInput?.value || 'https://bell555.local').trim();
              apiClient.setBaseUrl(urlToTest);

              if (infoLabel) {
                infoLabel.textContent = `${apiClient.getBaseUrl()}/api/info`;
              }

              if (statusEl) {
                statusEl.classList.remove('hidden');
                statusEl.className = 'mt-2 text-xs font-mono text-cyan-400 animate-pulse';
                statusEl.textContent = `Запрос к ${apiClient.getBaseUrl()}/api/info...`;
              }

              try {
                const res = await apiClient.getSystemInfo();
                if (statusEl) {
                  if (res.success) {
                    statusEl.className = 'mt-2 text-xs font-mono text-emerald-400 font-bold bg-emerald-950/60 p-2.5 rounded-xl border border-emerald-800/80';
                    statusEl.textContent = `✅ Успешное подключение к ESP32 (${res.latencyMs}ms)! Устройство: ${res.data?.device || 'ESP32-S3'}`;
                  } else {
                    statusEl.className = 'mt-2 text-xs font-mono text-rose-400 font-bold bg-rose-950/60 p-2.5 rounded-xl border border-rose-800/80';
                    statusEl.textContent = `⚠️ Ответ от ${apiClient.getBaseUrl()}/api/info: ${res.error || `HTTP ${res.status}`}. Проверьте доступность устройства в локальной сети и сертификат.`;
                  }
                }
              } catch (err: any) {
                if (statusEl) {
                  statusEl.className = 'mt-2 text-xs font-mono text-rose-400 font-bold bg-rose-950/60 p-2.5 rounded-xl border border-rose-800/80';
                  statusEl.textContent = `❌ Ошибка подключения к ${apiClient.getBaseUrl()}: ${err.message || 'Сетевая ошибка'}`;
                }
              }
            },
            saveConfig: () => {
              if (!containerRef.current) return;
              const timeoutInput = containerRef.current.querySelector('#cfg-timeout') as HTMLInputElement | null;
              const fileInput = containerRef.current.querySelector('#cfg-filename') as HTMLInputElement | null;
              const gainInput = containerRef.current.querySelector('#cfg-gain') as HTMLInputElement | null;
              const rateInput = containerRef.current.querySelector('#cfg-samplerate') as HTMLSelectElement | null;
              const ssidInput = containerRef.current.querySelector('#cfg-wifi-ssid') as HTMLInputElement | null;
              const passInput = containerRef.current.querySelector('#cfg-wifi-pass') as HTMLInputElement | null;
              const adminPassInput = containerRef.current.querySelector('#cfg-admin-pass') as HTMLInputElement | null;
              const espUrlInput = containerRef.current.querySelector('#cfg-esp-target-url') as HTMLInputElement | null;

              const targetUrl = espUrlInput?.value?.trim() || 'https://bell555.local';
              apiClient.setBaseUrl(targetUrl);

              const updated: EspBellConfig = {
                ...config,
                smart_timeout_sec: timeoutInput ? parseInt(timeoutInput.value) || 180 : config.smart_timeout_sec,
                target_filename: fileInput ? fileInput.value : config.target_filename,
                gain_scale: gainInput ? parseFloat(gainInput.value) || 1.0 : config.gain_scale,
                i2s_sample_rate: rateInput ? parseInt(rateInput.value) || 44100 : config.i2s_sample_rate,
                wifi_ssid: ssidInput ? ssidInput.value : config.wifi_ssid,
                wifi_password: passInput ? passInput.value : config.wifi_password,
                admin_password: adminPassInput ? adminPassInput.value : config.admin_password,
                target_esp_url: targetUrl,
              };

              onSaveConfig(updated);
              alert(`Параметры и шлюз REST API (${targetUrl}) успешно сохранены!`);
            },
            resetConfig: () => {
              if (confirm('Сбросить все параметры к значениям по умолчанию?')) {
                onResetDefaults();
                apiClient.setBaseUrl(initialConfig.target_esp_url);
                if (binderRef.current) {
                  binderRef.current.update({
                    smart_timeout_sec: initialConfig.smart_timeout_sec,
                    target_filename: initialConfig.target_filename,
                    gain_scale: initialConfig.gain_scale,
                    sample_rate: initialConfig.i2s_sample_rate,
                    wifi_ssid: initialConfig.wifi_ssid,
                    wifi_password: initialConfig.wifi_password,
                    admin_password: initialConfig.admin_password,
                    hostname: `${initialConfig.wifi_ap_ssid || 'bell555'}.local`,
                    target_esp_url: initialConfig.target_esp_url,
                  });
                }
              }
            },
          },
        });

        // Dynamic update of label when typing
        const espUrlInput = containerRef.current.querySelector('#cfg-esp-target-url') as HTMLInputElement | null;
        const infoLabel = containerRef.current.querySelector('#label-resolved-info-url') as HTMLElement | null;
        if (espUrlInput && infoLabel) {
          espUrlInput.addEventListener('input', () => {
            const raw = espUrlInput.value.trim().replace(/\/+$/, '');
            const finalVal = raw.startsWith('http') ? raw : `https://${raw}`;
            infoLabel.textContent = `${finalVal}/api/info`;
          });
        }

        binderRef.current = binder;
      } catch (err) {
        console.error('Failed to load /templates/config.html:', err);
      }
    }

    mount();

    return () => {
      isMounted = false;
      if (binderRef.current) {
        binderRef.current.destroy();
      }
    };
  }, [config, onSaveConfig, onResetDefaults]);

  return <div ref={containerRef} id="config-view-container" className="w-full" />;
};
