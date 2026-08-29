import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Header } from './components/Header';
import { MainView } from './components/MainView';
import { UploadView } from './components/UploadView';
import { ConfigView } from './components/ConfigView';
import { LogsView } from './components/LogsView';
import { HardwareDiagram } from './components/HardwareDiagram';
import { ApiTesterView } from './components/ApiTesterView';
import { HtmlTemplatesView } from './components/HtmlTemplatesView';
import { DoorbellSimulatorModal } from './components/DoorbellSimulatorModal';
import { LoginModal } from './components/LoginModal';

import { 
  EspBellConfig, 
  AudioTrackInfo, 
  SystemStatus, 
  LogEntry, 
  AuthState, 
  PresetMelody 
} from './types';
import { initialConfig, initialSystemStatus } from './data/defaultConfig';
import { presetMelodies } from './data/presetMelodies';
import { synthesizePresetChime, playAudioBuffer } from './utils/synthBell';
import { processAndEncodeWav } from './utils/audioEncoder';
import { apiClient } from './utils/apiClient';

export default function App() {
  const [activeTab, setActiveTab] = useState<'main' | 'upload' | 'config' | 'logs' | 'hardware' | 'api' | 'templates'>('main');

  // Config State
  const [config, setConfig] = useState<EspBellConfig>(() => {
    try {
      const saved = localStorage.getItem('espbell_config');
      if (saved) return JSON.parse(saved);
    } catch {}
    return initialConfig;
  });

  // System Telemetry State
  const [systemStatus, setSystemStatus] = useState<SystemStatus>(initialSystemStatus);

  // Initial synchronization with REST API backend
  useEffect(() => {
    async function syncWithBackend() {
      const infoRes = await apiClient.getSystemInfo();
      if (infoRes.success && infoRes.data) {
        const d = infoRes.data;
        setSystemStatus((prev) => ({
          ...prev,
          deviceModel: d.device || prev.deviceModel,
          firmwareVersion: d.firmware || prev.firmwareVersion,
          uptimeSeconds: d.uptime_sec || prev.uptimeSeconds,
          freeHeapBytes: d.heap?.free_bytes || prev.freeHeapBytes,
          psramFreeBytes: d.psram?.free_bytes || prev.psramFreeBytes,
          coreTemperatureC: d.core_temp_c || prev.coreTemperatureC,
          relayState: d.power?.relay_latch_gpio4 ?? prev.relayState,
          neoPixelColor: d.led?.color || prev.neoPixelColor,
          neoPixelState: (d.led?.state as any) || prev.neoPixelState,
          ipAddress: d.wifi?.ip || prev.ipAddress,
          rssi: d.wifi?.rssi || prev.rssi,
        }));
      }

      const configRes = await apiClient.getConfig();
      if (configRes.success && configRes.data) {
        setConfig(configRes.data);
      }

      const logsRes = await apiClient.getLogs();
      if (logsRes.success && logsRes.data?.logs) {
        setLogs(logsRes.data.logs);
      }
    }

    syncWithBackend();
  }, []);

  // Active Audio Track
  const [currentTrack, setCurrentTrack] = useState<AudioTrackInfo>({
    filename: 'bell.wav',
    title: 'Вестминстерский перезвон',
    format: 'PCM WAV (16-bit Stereo)',
    sizeBytes: 282284,
    durationSeconds: 3.2,
    sampleRate: 44100,
    channels: 2,
    bitDepth: 16,
    uploadedAt: '2026-08-29 02:40',
  });

  // Logs state (Boot and runtime logs)
  const [logs, setLogs] = useState<LogEntry[]>([
    {
      id: '1',
      timestamp: '00:00:00.120',
      level: 'INFO',
      tag: 'BOOT',
      message: 'ESP32-S3 EspBellAdmin v2.4.1 starting up (16MB Flash, 8MB Octal PSRAM)...',
    },
    {
      id: '2',
      timestamp: '00:00:00.145',
      level: 'HARDWARE',
      tag: 'POWER',
      message: 'Power latch GPIO4 set to HIGH (Holding relay ON)',
    },
    {
      id: '3',
      timestamp: '00:00:00.180',
      level: 'INFO',
      tag: 'CONFIG',
      message: 'Loaded /config.json successfully. Mode: music_first, Smart timeout: 180s',
    },
    {
      id: '4',
      timestamp: '00:00:00.220',
      level: 'HARDWARE',
      tag: 'I2S',
      message: 'I2S0 initialized: BCK=GPIO15, WS=GPIO16, DIN=GPIO17, Rate=44100Hz, DMA=8x1024',
    },
    {
      id: '5',
      timestamp: '00:00:00.250',
      level: 'INFO',
      tag: 'AUDIO',
      message: 'Boot playback mode: music_first. Verified /media/bell.wav (PCM 16-bit 44.1kHz)',
    },
    {
      id: '6',
      timestamp: '00:00:00.290',
      level: 'HARDWARE',
      tag: 'LED',
      message: 'NeoPixel WS2812 on GPIO48 initialized (Color: #10b981 / Standby Green)',
    },
    {
      id: '7',
      timestamp: '00:00:00.410',
      level: 'INFO',
      tag: 'WIFI',
      message: 'Station connected to Home_WiFi_2.4G (IP: 192.168.1.145, RSSI: -54 dBm)',
    },
    {
      id: '8',
      timestamp: '00:00:00.460',
      level: 'INFO',
      tag: 'HTTP',
      message: 'Microdot HTTPS web server started on port 443 with TLS cert /resources/cert.crt',
    },
  ]);

  // Auth State
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: true, // Default to admin for convenience
    nonce: null,
    nonceGeneratedAt: null,
    adminUsername: 'admin',
    tokenTtlSeconds: 30,
  });

  // Modal Dialogs
  const [isDoorbellModalOpen, setIsDoorbellModalOpen] = useState<boolean>(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);

  // Audio Playback Player Reference
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const activeAudioPlayerRef = useRef<{ stop: () => void } | null>(null);

  // Add Log Helper
  const addLog = useCallback((level: LogEntry['level'], tag: string, message: string) => {
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}.${now.getMilliseconds().toString().padStart(3, '0')}`;
    setLogs((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).substring(2, 9),
        timestamp: timeStr,
        level,
        tag,
        message,
      },
    ]);
  }, []);

  // Play Active Doorbell Track (WebAudio Synthesizer / AudioBuffer + REST API)
  const playCurrentDoorbellSound = useCallback(async () => {
    if (activeAudioPlayerRef.current) {
      activeAudioPlayerRef.current.stop();
    }

    try {
      setIsPlaying(true);
      setSystemStatus((prev) => ({
        ...prev,
        isPlaying: true,
        neoPixelColor: '#06b6d4', // Cyan when playing
        neoPixelState: 'playing',
        relayState: true,
        smartTimeoutRemaining: config.smart_timeout_sec,
      }));

      // Fire REST API /api/play
      apiClient.playSound().catch((err) => console.error('REST API play error:', err));

      addLog('INFO', 'PLAYER', `Starting I2S audio playback: ${currentTrack.filename} (${currentTrack.title})`);
      addLog('HARDWARE', 'I2S_TX', `Streaming DMA chunks to PCM5102A DAC (Gain: ${config.gain_scale}x)...`);

      let audioBufferToPlay: AudioBuffer;

      if (currentTrack.audioBuffer) {
        audioBufferToPlay = currentTrack.audioBuffer;
      } else {
        // Find matching preset or generate Westminster
        const preset = presetMelodies.find((p) => p.nameRu === currentTrack.title || p.name === currentTrack.title) || presetMelodies[0];
        audioBufferToPlay = await synthesizePresetChime(preset);
      }

      activeAudioPlayerRef.current = playAudioBuffer(audioBufferToPlay, {
        volume: config.gain_scale,
        onEnded: () => {
          setIsPlaying(false);
          setSystemStatus((prev) => ({
            ...prev,
            isPlaying: false,
            neoPixelColor: '#10b981', // Back to Green
            neoPixelState: 'idle',
          }));
          apiClient.stopSound().catch(() => {});
          addLog('INFO', 'PLAYER', `Playback of ${currentTrack.filename} completed.`);
        },
      });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Неизвестная ошибка';
      setIsPlaying(false);
      addLog('ERROR', 'PLAYER', `Audio playback error: ${errorMsg}`);
    }
  }, [currentTrack, config.gain_scale, config.smart_timeout_sec, addLog]);

  // Stop Active Playback
  const stopCurrentDoorbellSound = useCallback(() => {
    if (activeAudioPlayerRef.current) {
      activeAudioPlayerRef.current.stop();
      activeAudioPlayerRef.current = null;
    }
    setIsPlaying(false);
    setSystemStatus((prev) => ({
      ...prev,
      isPlaying: false,
      neoPixelColor: '#10b981',
      neoPixelState: 'idle',
    }));
    apiClient.stopSound().catch(() => {});
    addLog('INFO', 'PLAYER', 'Audio playback halted by user/API.');
  }, [addLog]);

  // Physical Doorbell Ring Trigger
  const handleTriggerBellRing = useCallback(() => {
    apiClient.triggerBell().catch((err) => console.error('REST API trigger bell error:', err));
    addLog('HARDWARE', 'BUTTON', 'Physical doorbell button pressed (External Trigger on GPIO)');
    addLog('HARDWARE', 'POWER', 'GPIO4 Relay latch asserted HIGH (Power active)');
    playCurrentDoorbellSound();
  }, [addLog, playCurrentDoorbellSound]);

  // Smart Inactivity Countdown Timer
  useEffect(() => {
    const timer = setInterval(() => {
      setSystemStatus((prev) => {
        if (prev.smartTimeoutRemaining <= 0) {
          return prev;
        }
        const nextTime = prev.smartTimeoutRemaining - 1;
        if (nextTime === 0) {
          addLog('WARNING', 'POWER', 'Smart inactivity timeout reached. GPIO4 driven LOW -> Power latch released.');
        }
        return {
          ...prev,
          smartTimeoutRemaining: nextTime,
          uptimeSeconds: prev.uptimeSeconds + 1,
        };
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [addLog]);

  // Select Preset Melody
  const handleSelectPreset = async (preset: PresetMelody) => {
    try {
      const synthBuffer = await synthesizePresetChime(preset);
      const processed = await processAndEncodeWav(synthBuffer, {
        gain: config.gain_scale,
        fadeInMs: config.fade_ms,
        targetSampleRate: config.i2s_sample_rate,
      });

      const newTrack: AudioTrackInfo = {
        filename: config.target_filename || 'bell.wav',
        title: preset.nameRu,
        format: 'PCM WAV (16-bit Stereo)',
        sizeBytes: processed.blob.size,
        durationSeconds: preset.duration,
        sampleRate: config.i2s_sample_rate,
        channels: 2,
        bitDepth: 16,
        audioBuffer: synthBuffer,
        rawWavBlob: processed.blob,
        uploadedAt: new Date().toLocaleTimeString(),
      };

      setCurrentTrack(newTrack);
      addLog('INFO', 'CONFIG', `Active doorbell melody set to: ${preset.nameRu} (${preset.name})`);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Ошибка выбора пресета';
      addLog('ERROR', 'CONFIG', `Preset selection error: ${errorMsg}`);
    }
  };

  // Upload New Track Handler
  const handleUploadSuccess = async (track: AudioTrackInfo) => {
    setCurrentTrack(track);
    setActiveTab('main');
    addLog('INFO', 'UPLOAD', `New melody uploaded: ${track.title} (${(track.sizeBytes / 1024).toFixed(1)} KB) -> saved to /media/${config.target_filename}`);
    addLog('HARDWARE', 'FLASH', `Wrote ${track.sizeBytes} bytes to SPI Flash filesystem`);

    if (track.rawWavBlob) {
      try {
        const uploadRes = await apiClient.uploadWav(track.rawWavBlob, config.target_filename, track.title);
        if (uploadRes.success) {
          addLog('INFO', 'REST_API', `File transmitted to Microdot server /upload (Status 200, ${uploadRes.latencyMs}ms)`);
        }
      } catch (err) {
        console.error('REST API upload error:', err);
      }
    }
  };

  // Save Config Handler
  const handleSaveConfig = async (updated: EspBellConfig) => {
    setConfig(updated);
    try {
      localStorage.setItem('espbell_config', JSON.stringify(updated));
    } catch {}
    
    // Save to real REST API
    try {
      const saveRes = await apiClient.saveConfig(updated);
      if (saveRes.success) {
        addLog('INFO', 'REST_API', `Saved /config.json via POST /api/config (${saveRes.latencyMs}ms)`);
      }
    } catch (err) {
      console.error('REST API save config error:', err);
    }
    
    addLog('INFO', 'CONFIG', 'Updated /config.json in Flash memory. Parameters applied.');
  };

  // Reset Defaults Handler
  const handleResetDefaults = async () => {
    setConfig(initialConfig);
    try {
      localStorage.removeItem('espbell_config');
    } catch {}
    apiClient.saveConfig(initialConfig).catch(() => {});
    addLog('WARNING', 'CONFIG', 'Configuration reset to factory defaults.');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500/20 selection:text-cyan-300">
      {/* App Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        systemStatus={systemStatus}
        authState={authState}
        onOpenLogin={() => setIsLoginModalOpen(true)}
        onLogout={() => {
          apiClient.logout().catch(() => {});
          setAuthState((prev) => ({ ...prev, isAuthenticated: false }));
          addLog('INFO', 'AUTH', 'Admin session logged out.');
        }}
        onTriggerBellRing={handleTriggerBellRing}
        onOpenDoorbellModal={() => setIsDoorbellModalOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        {activeTab === 'main' && (
          <MainView
            currentTrack={currentTrack}
            config={config}
            systemStatus={systemStatus}
            isPlaying={isPlaying}
            onPlayTrack={playCurrentDoorbellSound}
            onStopTrack={stopCurrentDoorbellSound}
            onTriggerBellRing={handleTriggerBellRing}
            onSelectPreset={handleSelectPreset}
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
            onUploadSuccess={handleUploadSuccess}
          />
        )}

        {activeTab === 'config' && (
          <ConfigView
            config={config}
            onSaveConfig={handleSaveConfig}
            onResetDefaults={handleResetDefaults}
          />
        )}

        {activeTab === 'hardware' && (
          <HardwareDiagram config={config} />
        )}

        {activeTab === 'logs' && (
          <LogsView
            logs={logs}
            systemStatus={systemStatus}
            onClearLogs={async () => {
              setLogs([]);
              try {
                await apiClient.clearLogs();
              } catch {}
            }}
            onRefreshLogs={async () => {
              try {
                const logsRes = await apiClient.getLogs();
                if (logsRes.success && logsRes.data?.logs) {
                  setLogs(logsRes.data.logs);
                }
              } catch {}
              addLog('INFO', 'SYSTEM', 'Diagnostics snapshot refreshed.');
            }}
          />
        )}

        {activeTab === 'api' && (
          <ApiTesterView />
        )}

        {activeTab === 'templates' && (
          <HtmlTemplatesView
            config={config}
            systemStatus={systemStatus}
            currentTrack={currentTrack}
            onSaveConfig={handleSaveConfig}
            onTriggerBell={handleTriggerBellRing}
            onPlayCurrentSound={playCurrentDoorbellSound}
            onStopSound={stopCurrentDoorbellSound}
            logs={logs}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-4 text-center text-xs text-slate-500 font-mono">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>EspBellAdmin • ESP32-S3 MicroPython I2S Doorbell System</span>
          <span>PCM5102A DAC (GPIO15, 16, 17) • Relay Latch (GPIO4)</span>
        </div>
      </footer>

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
          setAuthState((prev) => ({ ...prev, isAuthenticated: true }));
          addLog('INFO', 'AUTH', 'Admin authenticated successfully via SHA-256 Nonce challenge.');
        }}
      />
    </div>
  );
}
