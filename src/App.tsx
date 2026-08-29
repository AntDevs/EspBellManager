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
  const audioPlaybackRef = useRef<{ stop: () => void } | null>(null);

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

  // Stop active playback
  const stopCurrentDoorbellSound = useCallback(() => {
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
    apiClient.stopSound().catch(() => {});
  }, []);

  // Play sound
  const playCurrentDoorbellSound = useCallback(async () => {
    stopCurrentDoorbellSound();
    setIsPlaying(true);
    setSystemStatus((prev) => ({
      ...prev,
      isPlaying: true,
      relayState: true,
      smartTimeoutRemaining: config.smart_timeout_sec,
      neoPixelColor: '#06b6d4',
    }));

    addLog('HARDWARE', 'I2S_DAC', `Starting DMA stream: ${currentTrack.filename} (${currentTrack.sampleRate}Hz)`);
    apiClient.playSound().catch(() => {});

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
    } catch {
      setIsPlaying(false);
    }
  }, [config.gain_scale, config.smart_timeout_sec, currentTrack, stopCurrentDoorbellSound, addLog]);

  // Trigger doorbell ring
  const handleTriggerBellRing = useCallback(() => {
    addLog('HARDWARE', 'POWER_RELAY', 'Doorbell button triggered! Latching GPIO4 relay.');
    apiClient.triggerBell().catch(() => {});
    playCurrentDoorbellSound();
  }, [addLog, playCurrentDoorbellSound]);

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
  }, [activeTab, isPlaying]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500/20 selection:text-cyan-300">
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
            onUpdateConfigGain={(newGain) => {
              setConfig((prev) => ({ ...prev, gain_scale: newGain }));
            }}
            onNavigateToUpload={() => setActiveTab('upload')}
            onNavigateToConfig={() => setActiveTab('config')}
          />
        )}

        {activeTab === 'upload' && (
          <UploadView
            config={config}
            onUploadSuccess={(track) => {
              setCurrentTrack(track);
              addLog('INFO', 'FLASH', `Audio track "${track.filename}" saved to Flash SPIFFS.`);
              setActiveTab('main');
            }}
          />
        )}

        {activeTab === 'config' && (
          <ConfigView
            config={config}
            onSaveConfig={(updated) => {
              setConfig(updated);
              localStorage.setItem('espbell_config', JSON.stringify(updated));
              apiClient.saveConfig(updated).catch(() => {});
              addLog('INFO', 'CONFIG', 'Configuration saved to /config.json.');
            }}
            onResetDefaults={() => {
              setConfig(initialConfig);
              localStorage.removeItem('espbell_config');
              apiClient.saveConfig(initialConfig).catch(() => {});
              addLog('WARNING', 'CONFIG', 'Factory defaults restored.');
            }}
          />
        )}

        {activeTab === 'hardware' && <HardwareDiagram config={config} />}

        {activeTab === 'logs' && (
          <LogsView
            logs={logs}
            systemStatus={systemStatus}
            onClearLogs={() => {
              setLogs([]);
              apiClient.clearLogs().catch(() => {});
            }}
            onRefreshLogs={async () => {
              try {
                const res = await apiClient.getLogs();
                if (res.success && res.data?.logs) setLogs(res.data.logs);
              } catch {}
            }}
          />
        )}

        {activeTab === 'api' && <ApiTesterView />}

        {activeTab === 'templates' && (
          <HtmlTemplatesView
            config={config}
            systemStatus={systemStatus}
            currentTrack={currentTrack}
            onSaveConfig={(updated) => {
              setConfig(updated);
              apiClient.saveConfig(updated).catch(() => {});
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
        }}
      />
    </div>
  );
}
export { App };
