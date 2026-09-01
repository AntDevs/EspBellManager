import React, { useEffect, useRef, useState, useCallback } from 'react';
import { initialConfig } from './data/defaultConfig';
import { presetMelodies } from './data/presetMelodies';
import { 
  EspBellConfig, 
  AudioTrackInfo, 
  SystemStatus, 
  LogEntry, 
  PresetMelody 
} from './types';
import { synthesizePresetChime, playAudioBuffer } from './utils/synthBell';
import { apiClient } from './utils/apiClient';
import { loadHtmlTemplate, bindTemplate } from './utils/templateBinder';
import { AlertCircle, CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

// Subcomponents (All 100% Zero-JSX, HTML template-backed controllers)
import { MainView } from './components/MainView';
import { UploadView } from './components/UploadView';
import { ConfigView } from './components/ConfigView';
import { HardwareDiagram } from './components/HardwareDiagram';
import { LogsView } from './components/LogsView';
import { ApiTesterView } from './components/ApiTesterView';
import { HtmlTemplatesView } from './components/HtmlTemplatesView';
import { DoorbellSimulatorModal } from './components/DoorbellSimulatorModal';
import { LoginModal } from './components/LoginModal';

export interface AppNotification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
}

const initialTrack: AudioTrackInfo = {
  filename: 'bell.wav',
  title: 'Westminster Quarters',
  format: 'PCM WAV (16-bit 44.1kHz Stereo)',
  sizeBytes: 282240,
  durationSeconds: 3.2,
  sampleRate: 44100,
  channels: 2,
  bitDepth: 16,
  uploadedAt: new Date().toLocaleTimeString(),
};

const initialSystemStatus: SystemStatus = {
  deviceModel: 'ESP32-S3-WROOM-1 (N16R8)',
  firmwareVersion: 'v1.2.4-mpy',
  runtimeEnv: 'MicroPython v1.23.0 on ESP32-S3',
  uptimeSeconds: 42,
  freeHeapBytes: 284000,
  totalHeapBytes: 520000,
  psramFreeBytes: 7800000,
  psramTotalBytes: 8388608,
  cpuFrequencyMhz: 240,
  coreTemperatureC: 41.5,
  relayState: true,
  neoPixelColor: '#10b981',
  neoPixelState: 'idle',
  wifiMode: 'STA',
  ipAddress: '192.168.1.145',
  rssi: -58,
  isPlaying: false,
  activePlaybackTrack: 'bell.wav',
  playbackPositionSec: 0,
  smartTimeoutRemaining: 180,
};

const initialLogs: LogEntry[] = [
  { id: '1', timestamp: '00:00:01', level: 'HARDWARE', tag: 'POWER', message: 'ESP32-S3 Boot: Power Latch GPIO4 set to HIGH' },
  { id: '2', timestamp: '00:00:02', level: 'INFO', tag: 'I2S_DAC', message: 'PCM5102A DMA Channel 0 configured (44100Hz 16-bit)' },
  { id: '3', timestamp: '00:00:03', level: 'INFO', tag: 'WIFI', message: 'Connected to STA "Home_WiFi_2.4G" (IP: 192.168.1.145)' },
  { id: '4', timestamp: '00:00:04', level: 'INFO', tag: 'SERVER', message: 'Microdot HTTP server listening on port 80' },
];

export default function App() {
  const headerRef = useRef<HTMLDivElement | null>(null);
  const footerRef = useRef<HTMLDivElement | null>(null);
  const headerBinderRef = useRef<{ update: (data: any) => void; destroy: () => void } | null>(null);
  const footerBinderRef = useRef<{ update: (data: any) => void; destroy: () => void } | null>(null);

  // Application State
  const [activeTab, setActiveTab] = useState<'main' | 'upload' | 'config' | 'hardware' | 'logs' | 'api' | 'templates'>('main');
  const [config, setConfig] = useState<EspBellConfig>(() => {
    try {
      const saved = localStorage.getItem('espbell_config');
      return saved ? JSON.parse(saved) : initialConfig;
    } catch {
      return initialConfig;
    }
  });

  const [currentTrack, setCurrentTrack] = useState<AudioTrackInfo>(() => {
    try {
      const saved = localStorage.getItem('espbell_track');
      return saved ? JSON.parse(saved) : initialTrack;
    } catch {
      return initialTrack;
    }
  });

  const [systemStatus, setSystemStatus] = useState<SystemStatus>(initialSystemStatus);
  const [logs, setLogs] = useState<LogEntry[]>(initialLogs);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isDoorbellModalOpen, setIsDoorbellModalOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(apiClient.isAuthenticated());
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const audioPlaybackRef = useRef<{ stop: () => void } | null>(null);

  useEffect(() => {
    return apiClient.onAuthChange((authed) => {
      setIsAuthenticated(authed);
    });
  }, []);

  // Notification helper
  const showNotification = useCallback((type: 'success' | 'error' | 'warning' | 'info', title: string, message?: string) => {
    const id = `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    setNotifications((prev) => [...prev, { id, type, title, message }]);
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 6000);
  }, []);

  const dismissNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  // Log append helper
  const addLog = useCallback((level: 'INFO' | 'HARDWARE' | 'WARNING' | 'ERROR', tag: string, message: string) => {
    const newEntry: LogEntry = {
      id: `log-${Date.now()}-${Math.random()}`,
      timestamp: new Date().toLocaleTimeString(),
      level,
      tag,
      message,
    };
    setLogs((prev) => [...prev.slice(-99), newEntry]);
  }, []);

  // Stop active playback with strict result checking
  const stopCurrentDoorbellSound = useCallback(async () => {
    if (audioPlaybackRef.current) {
      audioPlaybackRef.current.stop();
      audioPlaybackRef.current = null;
    }
    setIsPlaying(false);
    setSystemStatus((prev) => ({
      ...prev,
      isPlaying: false,
      neoPixelColor: '#10b981',
    }));

    const res = await apiClient.stopSound();
    if (!res.success) {
      showNotification('warning', 'Внимание: ESP32 не ответил на команду /api/stop', res.error || `HTTP ${res.status}`);
      addLog('WARNING', 'I2S_DAC', `Failed to send stop command to ESP32: ${res.error || `HTTP ${res.status}`}`);
    } else {
      addLog('INFO', 'I2S_DAC', 'Playback stopped on ESP32.');
    }
  }, [addLog, showNotification]);

  // Play sound with strict result checking
  const playCurrentDoorbellSound = useCallback(async () => {
    if (audioPlaybackRef.current) {
      audioPlaybackRef.current.stop();
      audioPlaybackRef.current = null;
    }

    // Call REST API FIRST and check status
    const res = await apiClient.playSound();
    if (!res.success) {
      setIsPlaying(false);
      showNotification(
        'error', 
        'Ошибка воспроизведения на ESP32 (POST /api/play)', 
        res.error || `HTTP ${res.status}: Контроллер не отвечает по адресу ${apiClient.getBaseUrl()}`
      );
      addLog('ERROR', 'I2S_DAC', `Playback trigger failed: ${res.error || `HTTP ${res.status}`}`);
      return;
    }

    setIsPlaying(true);
    setSystemStatus((prev) => ({
      ...prev,
      isPlaying: true,
      relayState: true,
      smartTimeoutRemaining: config.smart_timeout_sec,
      neoPixelColor: '#06b6d4',
    }));

    addLog('HARDWARE', 'I2S_DAC', `Starting DMA stream: ${currentTrack.filename} (${currentTrack.sampleRate}Hz)`);

    try {
      if (currentTrack.rawWavBlob) {
        const arrayBuffer = await currentTrack.rawWavBlob.arrayBuffer();
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        audioPlaybackRef.current = playAudioBuffer(audioBuffer, {
          volume: config.gain_scale,
          onEnded: () => {
            setIsPlaying(false);
            setSystemStatus((prev) => ({
              ...prev,
              isPlaying: false,
              neoPixelColor: '#10b981',
            }));
            addLog('INFO', 'I2S_DAC', 'Audio playback completed.');
          },
        });
      } else {
        const defaultPreset = presetMelodies[0];
        const audioBuffer = await synthesizePresetChime(defaultPreset);
        audioPlaybackRef.current = playAudioBuffer(audioBuffer, {
          volume: config.gain_scale,
          onEnded: () => {
            setIsPlaying(false);
            setSystemStatus((prev) => ({
              ...prev,
              isPlaying: false,
              neoPixelColor: '#10b981',
            }));
            addLog('INFO', 'I2S_DAC', 'Synthesizer sequence finished.');
          },
        });
      }
    } catch (synthErr: any) {
      console.warn('Audio synthesis fallback error:', synthErr);
      setIsPlaying(false);
    }
  }, [config.gain_scale, config.smart_timeout_sec, currentTrack, addLog, showNotification]);

  // Trigger doorbell ring with strict result checking
  const handleTriggerBellRing = useCallback(async () => {
    const res = await apiClient.triggerBell();
    if (res.success) {
      addLog('HARDWARE', 'POWER_RELAY', 'Doorbell button triggered! Latching GPIO4 relay.');
      showNotification('success', '🔔 Дверной звонок активирован', 'Команда POST /api/trigger-bell успешно принята ESP32.');
      playCurrentDoorbellSound();
    } else {
      showNotification(
        'error', 
        'Ошибка срабатывания звонка (POST /api/trigger-bell)', 
        res.error || `HTTP ${res.status}: Проверьте сетевое подключение к ${apiClient.getBaseUrl()}`
      );
      addLog('ERROR', 'POWER_RELAY', `Failed to trigger bell: ${res.error || `HTTP ${res.status}`}`);
    }
  }, [addLog, playCurrentDoorbellSound, showNotification]);

  // Load Header & Footer pure HTML templates
  useEffect(() => {
    let isMounted = true;

    async function mountTemplates() {
      if (headerRef.current) {
        try {
          const html = await loadHtmlTemplate('header');
          if (!isMounted || !headerRef.current) return;

          if (headerBinderRef.current) {
            headerBinderRef.current.destroy();
          }

          const binder = bindTemplate(headerRef.current, html, {
            data: {},
            actions: {
              setTab: (e: Event, el: HTMLElement) => {
                const tab = el.getAttribute('data-tab') as any;
                if (tab) setActiveTab(tab);
              },
              triggerBell: () => {
                handleTriggerBellRing();
              },
              openDoorbellModal: () => {
                setIsDoorbellModalOpen(true);
              },
              openLoginModal: () => {
                setIsLoginModalOpen(true);
              },
              logout: async () => {
                const res = await apiClient.logout();
                if (res.success) {
                  showNotification('success', 'Выход выполнен', 'Сессия завершена.');
                } else {
                  showNotification('warning', 'Ошибка выхода', res.error);
                }
              },
            },
          });

          headerBinderRef.current = binder;
        } catch (err) {
          console.error('Failed to load /templates/header.html:', err);
        }
      }

      if (footerRef.current) {
        try {
          const html = await loadHtmlTemplate('footer');
          if (!isMounted || !footerRef.current) return;

          if (footerBinderRef.current) {
            footerBinderRef.current.destroy();
          }

          const binder = bindTemplate(footerRef.current, html, {
            data: {},
            actions: {},
          });

          footerBinderRef.current = binder;
        } catch (err) {
          console.error('Failed to load /templates/footer.html:', err);
        }
      }
    }

    mountTemplates();

    return () => {
      isMounted = false;
      if (headerBinderRef.current) {
        headerBinderRef.current.destroy();
      }
      if (footerBinderRef.current) {
        footerBinderRef.current.destroy();
      }
    };
  }, [handleTriggerBellRing]);

  // Update active tab styles & status text in header
  useEffect(() => {
    if (!headerRef.current) return;
    const tabButtons = headerRef.current.querySelectorAll('.nav-tab-btn');
    tabButtons.forEach((btn) => {
      const tabName = btn.getAttribute('data-tab');
      if (tabName === activeTab) {
        btn.className = 'nav-tab-btn flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all bg-cyan-600 text-white shadow-md shadow-cyan-600/30';
      } else {
        btn.className = 'nav-tab-btn flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all text-slate-400 hover:text-slate-200 hover:bg-slate-900';
      }
    });

    const ringLabel = headerRef.current.querySelector('#header-ring-label');
    if (ringLabel) {
      ringLabel.textContent = isPlaying ? 'Звонит...' : 'Позвонить';
    }

    const loginBtn = headerRef.current.querySelector('#header-btn-login');
    const logoutBtn = headerRef.current.querySelector('#header-btn-logout');
    const authStatusText = headerRef.current.querySelector('#header-auth-status-text');
    const authIndicator = loginBtn?.querySelector('span.w-2.h-2.rounded-full');

    if (isAuthenticated) {
      loginBtn?.classList.remove('bg-amber-500/10', 'hover:bg-amber-500/20', 'text-amber-300', 'border-amber-500/30');
      loginBtn?.classList.add('bg-emerald-500/10', 'hover:bg-emerald-500/20', 'text-emerald-300', 'border-emerald-500/30');
      
      if (authIndicator) {
        authIndicator.classList.remove('bg-amber-400');
        authIndicator.classList.add('bg-emerald-400');
      }
      
      if (authStatusText) authStatusText.textContent = 'Админ';
      logoutBtn?.classList.remove('hidden');
    } else {
      loginBtn?.classList.add('bg-amber-500/10', 'hover:bg-amber-500/20', 'text-amber-300', 'border-amber-500/30');
      loginBtn?.classList.remove('bg-emerald-500/10', 'hover:bg-emerald-500/20', 'text-emerald-300', 'border-emerald-500/30');
      
      if (authIndicator) {
        authIndicator.classList.add('bg-amber-400');
        authIndicator.classList.remove('bg-emerald-400');
      }
      
      if (authStatusText) authStatusText.textContent = 'Войти в систему';
      logoutBtn?.classList.add('hidden');
    }
  }, [activeTab, isPlaying, isAuthenticated]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500/20 selection:text-cyan-300 relative">
      {/* Toast Notification Container */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-md w-full pointer-events-none px-4 sm:px-0">
        {notifications.map((n) => (
          <div
            key={n.id}
            className={`pointer-events-auto p-4 rounded-2xl shadow-2xl border flex items-start justify-between gap-3 animate-fadeIn backdrop-blur-md transition-all ${
              n.type === 'error'
                ? 'bg-rose-950/95 border-rose-800 text-rose-100 shadow-rose-950/50'
                : n.type === 'success'
                ? 'bg-emerald-950/95 border-emerald-800 text-emerald-100 shadow-emerald-950/50'
                : n.type === 'warning'
                ? 'bg-amber-950/95 border-amber-800 text-amber-100 shadow-amber-950/50'
                : 'bg-slate-900/95 border-slate-700 text-slate-100 shadow-slate-950/50'
            }`}
          >
            <div className="flex items-start gap-3">
              <span className="mt-0.5 shrink-0">
                {n.type === 'error' && <AlertCircle className="w-5 h-5 text-rose-400" />}
                {n.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
                {n.type === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-400" />}
                {n.type === 'info' && <Info className="w-5 h-5 text-cyan-400" />}
              </span>
              <div className="space-y-0.5">
                <h4 className="text-xs font-bold font-mono">{n.title}</h4>
                {n.message && <p className="text-[11px] opacity-90 leading-relaxed font-sans">{n.message}</p>}
              </div>
            </div>
            <button
              onClick={() => dismissNotification(n.id)}
              className="p-1 hover:bg-white/10 rounded-lg shrink-0 transition-colors opacity-70 hover:opacity-100"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Pure HTML Header Template Container */}
      <div ref={headerRef} id="app-header-container" />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6" id="app-main-content">
        {activeTab === 'main' && (
          <MainView
            currentTrack={currentTrack}
            config={config}
            systemStatus={systemStatus}
            isPlaying={isPlaying}
            isAuthenticated={isAuthenticated}
            onPlayTrack={playCurrentDoorbellSound}
            onStopTrack={stopCurrentDoorbellSound}
            onTriggerBellRing={handleTriggerBellRing}
            onSelectPreset={async (p: PresetMelody) => {
              const audioBuffer = await synthesizePresetChime(p);
              setCurrentTrack({
                filename: `${p.id}.wav`,
                title: p.nameRu || p.name,
                format: 'PCM WAV (16-bit 44.1kHz)',
                sizeBytes: 282240,
                durationSeconds: p.duration,
                sampleRate: 44100,
                channels: 2,
                bitDepth: 16,
                audioBuffer,
                uploadedAt: new Date().toLocaleTimeString(),
              });
              addLog('INFO', 'PRESET', `Selected melody preset: "${p.nameRu || p.name}"`);
            }}
            onUpdateConfigGain={async (newGain) => {
              const updated = { ...config, gain_scale: newGain };
              setConfig(updated);
              localStorage.setItem('espbell_config', JSON.stringify(updated));
              const res = await apiClient.saveConfig(updated);
              if (res.success) {
                showNotification('success', 'Громкость сохранена', `Уровень усиления установлен на ${Math.round(newGain * 100)}%`);
              } else {
                showNotification('warning', 'Громкость сохранена только в браузере', res.error || `HTTP ${res.status}`);
              }
            }}
            onNavigateToUpload={() => setActiveTab('upload')}
            onNavigateToConfig={() => setActiveTab('config')}
          />
        )}

        {activeTab === 'upload' && (
          !isAuthenticated ? (
            <div className="flex flex-col items-center justify-center min-h-[50vh] bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center shadow-2xl animate-fadeIn">
              <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center mb-4 border border-amber-500/20 shadow-lg shadow-amber-500/10">
                <span className="text-3xl">🔒</span>
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Доступ ограничен</h2>
              <p className="text-slate-400 max-w-md mx-auto mb-6">
                Загрузка новых аудиофайлов в память устройства (Flash SPIFFS) требует прав администратора.
              </p>
              <button 
                onClick={() => setIsLoginModalOpen(true)}
                className="px-6 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl shadow-lg shadow-cyan-600/20 transition-all active:scale-95"
              >
                Войти в систему
              </button>
            </div>
          ) : (
            <UploadView
              config={config}
              onUploadSuccess={(track) => {
                setCurrentTrack(track);
                localStorage.setItem('espbell_track', JSON.stringify(track));
                addLog('INFO', 'FLASH', `Audio track "${track.filename}" saved to Flash SPIFFS.`);
                showNotification('success', '✅ Файл записан во Flash', `Мелодия "${track.title}" готова к воспроизведению.`);
                setActiveTab('main');
              }}
            />
          )
        )}

        {activeTab === 'config' && (
          !isAuthenticated ? (
            <div className="flex flex-col items-center justify-center min-h-[50vh] bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center shadow-2xl animate-fadeIn">
              <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center mb-4 border border-amber-500/20 shadow-lg shadow-amber-500/10">
                <span className="text-3xl">🔒</span>
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Настройки недоступны</h2>
              <p className="text-slate-400 max-w-md mx-auto mb-6">
                Редактирование конфигурации Wi-Fi, пинов I2S и режимов энергосбережения требует прав администратора.
              </p>
              <button 
                onClick={() => setIsLoginModalOpen(true)}
                className="px-6 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl shadow-lg shadow-cyan-600/20 transition-all active:scale-95"
              >
                Войти в систему
              </button>
            </div>
          ) : (
            <ConfigView
              config={config}
              onSaveConfig={async (updated) => {
                setConfig(updated);
                localStorage.setItem('espbell_config', JSON.stringify(updated));
                const res = await apiClient.saveConfig(updated);
                if (res.success) {
                  showNotification('success', '✅ Конфигурация сохранена', 'Настройки успешно записаны в Flash память ESP32 (/config.json).');
                  addLog('INFO', 'CONFIG', 'Configuration saved to /config.json.');
                } else {
                  showNotification('warning', '⚠️ Настройки сохранены только локально', res.error || `HTTP ${res.status}: ESP32 недоступен.`);
                  addLog('WARNING', 'CONFIG', `Config local fallback: ${res.error || `HTTP ${res.status}`}`);
                }
              }}
              onResetDefaults={async () => {
                setConfig(initialConfig);
                localStorage.removeItem('espbell_config');
                const res = await apiClient.saveConfig(initialConfig);
                if (res.success) {
                  showNotification('success', 'Заводские настройки применены', 'Параметры сброшены на ESP32.');
                  addLog('WARNING', 'CONFIG', 'Factory defaults restored on ESP32.');
                } else {
                  showNotification('warning', 'Заводские настройки восстановлены локально', res.error || `HTTP ${res.status}`);
                  addLog('WARNING', 'CONFIG', 'Factory defaults restored locally.');
                }
              }}
            />
          )
        )}

        {activeTab === 'hardware' && <HardwareDiagram config={config} />}

        {activeTab === 'logs' && (
          <LogsView
            logs={logs}
            systemStatus={systemStatus}
            isAuthenticated={isAuthenticated}
            onRefreshLogs={async () => {
              const res = await apiClient.getLogs();
              if (res.success && res.data?.logs) {
                setLogs(res.data.logs);
                showNotification('success', 'Логи обновлены', `Получено записей: ${res.data.logs.length}`);
              } else {
                showNotification('error', 'Не удалось загрузить логи с ESP32', res.error || `HTTP ${res.status}`);
              }
            }}
          />
        )}

        {activeTab === 'api' && <ApiTesterView />}

        {activeTab === 'templates' && (
          <HtmlTemplatesView
            config={config}
            systemStatus={systemStatus}
            currentTrack={currentTrack}
            onSaveConfig={async (updated) => {
              setConfig(updated);
              const res = await apiClient.saveConfig(updated);
              if (res.success) {
                showNotification('success', 'Конфигурация обновлена', 'Данные синхронизированы.');
              } else {
                showNotification('warning', 'Синхронизация не удалась', res.error || `HTTP ${res.status}`);
              }
            }}
            onTriggerBell={handleTriggerBellRing}
            onPlayCurrentSound={playCurrentDoorbellSound}
            onStopSound={stopCurrentDoorbellSound}
            logs={logs}
          />
        )}
      </main>

      {/* Pure HTML Footer Template Container */}
      <div ref={footerRef} id="app-footer-container" />

      {/* Doorbell Physical Simulator Modal */}
      <DoorbellSimulatorModal
        isOpen={isDoorbellModalOpen}
        onClose={() => setIsDoorbellModalOpen(false)}
        currentTrack={currentTrack}
        config={config}
        systemStatus={systemStatus}
        isPlaying={isPlaying}
        onTriggerBellRing={handleTriggerBellRing}
        onStopTrack={stopCurrentDoorbellSound}
      />

      {/* Login / Auth Modal */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        adminPasswordConfig={config.admin_password}
        onLoginSuccess={() => {
          addLog('INFO', 'AUTH', 'Admin authenticated via SHA-256 Nonce challenge.');
          showNotification('success', 'Авторизация успешна', 'Административный доступ подтвержден.');
        }}
      />
    </div>
  );
}
export { App };
