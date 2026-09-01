import React, { useEffect, useRef } from 'react';
import { AudioTrackInfo, EspBellConfig, SystemStatus, PresetMelody } from '../types';
import { presetMelodies } from '../data/presetMelodies';
import { loadHtmlTemplate, bindTemplate } from '../utils/templateBinder';

interface MainViewProps {
  currentTrack: AudioTrackInfo;
  config: EspBellConfig;
  systemStatus: SystemStatus;
  isPlaying: boolean;
  isAuthenticated: boolean;
  onPlayTrack: () => void;
  onStopTrack: () => void;
  onTriggerBellRing: () => void;
  onSelectPreset: (preset: PresetMelody) => void;
  onUpdateConfigGain: (newGain: number) => void;
  onNavigateToUpload: () => void;
  onNavigateToConfig: () => void;
}

/**
 * MainView Controller (Option 2: Pure HTML Template + Data Binding)
 * Notice: ZERO hardcoded HTML layout inside TypeScript. 
 * The entire DOM structure is loaded dynamically from /public/templates/main.html.
 */
export const MainView: React.FC<MainViewProps> = ({
  currentTrack,
  config,
  systemStatus,
  isPlaying,
  isAuthenticated,
  onPlayTrack,
  onStopTrack,
  onTriggerBellRing,
  onSelectPreset,
  onUpdateConfigGain,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const binderRef = useRef<{ update: (data: any) => void; destroy: () => void } | null>(null);

  // Initialize and mount pure HTML template
  useEffect(() => {
    let isMounted = true;

    async function mountTemplate() {
      if (!containerRef.current) return;

      try {
        const html = await loadHtmlTemplate('main');
        if (!isMounted || !containerRef.current) return;

        // Cleanup existing binder instance
        if (binderRef.current) {
          binderRef.current.destroy();
        }

        const dataModel = {
          track: {
            title: currentTrack.title,
            format: `${currentTrack.format} • ${currentTrack.sampleRate} Hz`,
            sizeStr: `${(currentTrack.sizeBytes / 1024).toFixed(1)} KB`,
            durationStr: `${currentTrack.durationSeconds.toFixed(1)} сек`,
          },
          power: {
            badge: systemStatus.relayState ? 'GPIO4 HIGH (Active)' : 'GPIO4 LOW (Standby)',
            timeoutRemaining: `${systemStatus.smartTimeoutRemaining} сек`,
          },
          system: {
            heapFree: `${(systemStatus.freeHeapBytes / 1024).toFixed(0)} KB Free`,
            temperature: `${systemStatus.coreTemperatureC.toFixed(1)} °C`,
            wifiIp: systemStatus.ipAddress,
            wifiSsid: 'Home_WiFi_2.4G',
            wifiRssi: `${systemStatus.rssi} dBm`,
            ledStyle: { backgroundColor: systemStatus.neoPixelColor },
          },
          config: {
            gainStr: `${Math.round(config.gain_scale * 100)}% (${config.gain_scale}x)`,
            gain_scale: config.gain_scale,
          },
        };

        const actions = {
          triggerRing: () => {
            onTriggerBellRing();
          },
          togglePlay: () => {
            if (isPlaying) {
              onStopTrack();
            } else {
              onPlayTrack();
            }
          },
          changeGain: (e: Event) => {
            const input = e.target as HTMLInputElement;
            const newGain = parseFloat(input.value);
            onUpdateConfigGain(newGain);
          },
          selectPreset: (e: Event, el: HTMLElement) => {
            const presetId = el.getAttribute('data-preset');
            const found = presetMelodies.find((p) => p.id === presetId);
            if (found) {
              onSelectPreset(found);
            }
          },
        };

        const binder = bindTemplate(containerRef.current, html, {
          data: dataModel,
          actions,
        });

        binderRef.current = binder;
      } catch (err) {
        console.error('Failed to mount /templates/main.html:', err);
      }
    }

    mountTemplate();

    return () => {
      isMounted = false;
      if (binderRef.current) {
        binderRef.current.destroy();
      }
    };
  }, []); // Mount template once

  // Reactive updates to the DOM via Data Binding engine (No HTML re-parsing)
  useEffect(() => {
    if (binderRef.current) {
      binderRef.current.update({
        track: {
          title: currentTrack.title || config.target_filename || 'bell.wav',
          format: `${currentTrack.format || 'WAV'} • ${currentTrack.sampleRate || 44100} Hz`,
          sizeStr: currentTrack.sizeBytes ? `${(currentTrack.sizeBytes / 1024).toFixed(1)} KB` : 'Н/Д',
          durationStr: currentTrack.durationSeconds ? `${currentTrack.durationSeconds.toFixed(1)} сек` : 'Н/Д',
        },
        power: {
          badge: isPlaying ? 'I2S Active (Playing)' : 'I2S Standby',
          timeoutRemaining: `${config.smart_timeout_sec} сек`,
        },
        system: {
          heapFree: `${(systemStatus.freeHeap / 1024).toFixed(0)} KB Free`,
          temperature: `Н/Д`,
          wifiIp: 'ESP32 IP / Host',
          wifiSsid: config.wifi_ssid || config.ap_ssid || 'Н/Д',
          wifiRssi: `Н/Д`,
          ledStyle: { backgroundColor: isPlaying ? '#06b6d4' : '#10b981' },
        },
        config: {
          gainStr: `Управление громкостью отключено`,
          gain_scale: 1,
        },
      });

      // Update play button label and state
      const playBtn = containerRef.current?.querySelector('#btn-play-pause') as HTMLButtonElement | null;
      const playLabel = containerRef.current?.querySelector('#tpl-play-label');
      if (playLabel) {
        playLabel.textContent = isPlaying ? '⏹ Остановить' : '▶ Тест звука';
      }
      if (playBtn) {
        if (!isAuthenticated) {
          playBtn.disabled = true;
          playBtn.title = 'Требуется авторизация';
          playBtn.classList.add('opacity-50', 'cursor-not-allowed');
        } else {
          playBtn.disabled = false;
          playBtn.title = '';
          playBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        }
      }

      // Update volume slider state
      const volSlider = containerRef.current?.querySelector('#vol-slider') as HTMLInputElement | null;
      if (volSlider) {
        if (!isAuthenticated) {
          volSlider.disabled = true;
          volSlider.title = 'Требуется авторизация';
          volSlider.classList.add('opacity-50', 'cursor-not-allowed');
        } else {
          volSlider.disabled = false;
          volSlider.title = '';
          volSlider.classList.remove('opacity-50', 'cursor-not-allowed');
        }
      }
    }
  }, [currentTrack, systemStatus, config, isPlaying, isAuthenticated]);

  // Pure container mount point
  return <div ref={containerRef} id="main-view-container" className="w-full" />;
};
