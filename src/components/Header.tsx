import React from 'react';
import { 
  Bell, 
  Wifi, 
  ShieldCheck, 
  ShieldAlert, 
  Power, 
  Cpu, 
  Zap, 
  Sliders, 
  Upload, 
  Terminal, 
  Volume2, 
  Radio,
  Server,
  FileCode
} from 'lucide-react';
import { SystemStatus, AuthState } from '../types';

interface HeaderProps {
  activeTab: 'main' | 'upload' | 'config' | 'logs' | 'hardware' | 'api' | 'templates';
  setActiveTab: (tab: 'main' | 'upload' | 'config' | 'logs' | 'hardware' | 'api' | 'templates') => void;
  systemStatus: SystemStatus;
  authState: AuthState;
  onOpenLogin: () => void;
  onLogout: () => void;
  onTriggerBellRing: () => void;
  onOpenDoorbellModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  systemStatus,
  authState,
  onOpenLogin,
  onLogout,
  onTriggerBellRing,
  onOpenDoorbellModal,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800">
      {/* Top Telemetry Strip */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2 flex flex-wrap items-center justify-between text-xs text-slate-400 gap-2 border-b border-slate-800/60">
        <div className="flex items-center gap-4 flex-wrap">
          {/* Device Model */}
          <div className="flex items-center gap-1.5 font-mono text-slate-300">
            <Cpu className="w-3.5 h-3.5 text-cyan-400" />
            <span>ESP32-S3 (N16R8)</span>
          </div>

          {/* Wi-Fi Status */}
          <div className="flex items-center gap-1.5">
            <Wifi className={`w-3.5 h-3.5 ${systemStatus.wifiMode === 'STA' ? 'text-emerald-400' : 'text-amber-400'}`} />
            <span className="font-mono">
              {systemStatus.wifiMode === 'STA' ? `STA: ${systemStatus.ipAddress} (${systemStatus.rssi} dBm)` : 'AP: 192.168.4.1'}
            </span>
          </div>

          {/* NeoPixel LED Indicator */}
          <div className="flex items-center gap-1.5">
            <span 
              className="w-2.5 h-2.5 rounded-full animate-pulse" 
              style={{ backgroundColor: systemStatus.neoPixelColor, boxShadow: `0 0 8px ${systemStatus.neoPixelColor}` }}
            />
            <span>LED: GPIO48 ({systemStatus.neoPixelState})</span>
          </div>

          {/* Power Relay Latch */}
          <div className="flex items-center gap-1.5">
            <Zap className={`w-3.5 h-3.5 ${systemStatus.relayState ? 'text-emerald-400' : 'text-slate-500'}`} />
            <span className="font-mono">Реле (GPIO4): {systemStatus.relayState ? 'LATCH HIGH' : 'OFF'}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Smart Timeout Countdown */}
          {systemStatus.smartTimeoutRemaining > 0 && (
            <div className="flex items-center gap-1 text-amber-300/90 font-mono bg-amber-950/40 px-2 py-0.5 rounded border border-amber-800/40">
              <Power className="w-3 h-3 text-amber-400" />
              <span>Таймаут сна: {Math.floor(systemStatus.smartTimeoutRemaining / 60)}:{(systemStatus.smartTimeoutRemaining % 60).toString().padStart(2, '0')}</span>
            </div>
          )}

          {/* Auth State Button */}
          {authState.isAuthenticated ? (
            <button
              onClick={onLogout}
              className="flex items-center gap-1.5 text-emerald-400 bg-emerald-950/40 hover:bg-emerald-900/50 px-2 py-0.5 rounded border border-emerald-800/50 transition-colors"
              title="Выйти из режима администратора"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span className="font-semibold">Админ (SHA-256)</span>
            </button>
          ) : (
            <button
              onClick={onOpenLogin}
              className="flex items-center gap-1.5 text-amber-400 bg-amber-950/40 hover:bg-amber-900/50 px-2 py-0.5 rounded border border-amber-800/50 transition-colors"
            >
              <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
              <span>Войти</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Navigation Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 text-white">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-white tracking-tight">EspBellAdmin</h1>
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800/60">
                PCM5102A I2S
              </span>
            </div>
            <p className="text-xs text-slate-400">Умный дверной звонок с беспроводной загрузкой аудио</p>
          </div>
        </div>

        {/* Tab Navigation */}
        <nav className="hidden md:flex items-center gap-1 bg-slate-950/80 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveTab('main')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'main'
                ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Volume2 className="w-4 h-4" />
            <span>Главная</span>
          </button>

          <button
            onClick={() => setActiveTab('upload')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'upload'
                ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>Загрузка мелодии</span>
          </button>

          <button
            onClick={() => setActiveTab('config')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'config'
                ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>Параметры & Сеть</span>
          </button>

          <button
            onClick={() => setActiveTab('hardware')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'hardware'
                ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Radio className="w-4 h-4" />
            <span>Схема I2S DAC</span>
          </button>

          <button
            onClick={() => setActiveTab('logs')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'logs'
                ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Terminal className="w-4 h-4" />
            <span>Журнал boot.log</span>
          </button>

          <button
            onClick={() => setActiveTab('api')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'api'
                ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Server className="w-4 h-4" />
            <span>REST API</span>
          </button>

          <button
            onClick={() => setActiveTab('templates')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'templates'
                ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <FileCode className="w-4 h-4" />
            <span>HTML Шаблоны</span>
          </button>
        </nav>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {/* Hardware Physical Simulator Modal Button */}
          <button
            onClick={onOpenDoorbellModal}
            className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded-xl text-xs sm:text-sm font-medium border border-slate-700 transition-all hover:border-cyan-500/50 shadow-sm"
            title="Интерактивная панель дверного звонка"
          >
            <Bell className="w-4 h-4 text-cyan-400" />
            <span className="hidden sm:inline">Эмулятор звонка</span>
          </button>

          {/* Quick Doorbell Ring Button */}
          <button
            onClick={onTriggerBellRing}
            disabled={systemStatus.isPlaying}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all shadow-lg ${
              systemStatus.isPlaying
                ? 'bg-amber-600 text-white animate-pulse'
                : 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white shadow-emerald-500/25 active:scale-95'
            }`}
          >
            <Bell className={`w-4 h-4 ${systemStatus.isPlaying ? 'animate-bounce' : ''}`} />
            <span>{systemStatus.isPlaying ? 'Звонит...' : 'Позвонить'}</span>
          </button>
        </div>
      </div>

      {/* Mobile Tab Navigation */}
      <div className="md:hidden flex items-center justify-around border-t border-slate-800/80 bg-slate-950/95 py-2 px-2">
        <button
          onClick={() => setActiveTab('main')}
          className={`flex flex-col items-center gap-1 py-1 px-2 rounded-lg text-[11px] ${
            activeTab === 'main' ? 'text-cyan-400 font-bold' : 'text-slate-400'
          }`}
        >
          <Volume2 className="w-4 h-4" />
          <span>Главная</span>
        </button>
        <button
          onClick={() => setActiveTab('upload')}
          className={`flex flex-col items-center gap-1 py-1 px-2 rounded-lg text-[11px] ${
            activeTab === 'upload' ? 'text-cyan-400 font-bold' : 'text-slate-400'
          }`}
        >
          <Upload className="w-4 h-4" />
          <span>Загрузка</span>
        </button>
        <button
          onClick={() => setActiveTab('config')}
          className={`flex flex-col items-center gap-1 py-1 px-2 rounded-lg text-[11px] ${
            activeTab === 'config' ? 'text-cyan-400 font-bold' : 'text-slate-400'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>Опции</span>
        </button>
        <button
          onClick={() => setActiveTab('hardware')}
          className={`flex flex-col items-center gap-1 py-1 px-2 rounded-lg text-[11px] ${
            activeTab === 'hardware' ? 'text-cyan-400 font-bold' : 'text-slate-400'
          }`}
        >
          <Radio className="w-4 h-4" />
          <span>Схема</span>
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`flex flex-col items-center gap-1 py-1 px-2 rounded-lg text-[11px] ${
            activeTab === 'logs' ? 'text-cyan-400 font-bold' : 'text-slate-400'
          }`}
        >
          <Terminal className="w-4 h-4" />
          <span>Лог</span>
        </button>
        <button
          onClick={() => setActiveTab('api')}
          className={`flex flex-col items-center gap-1 py-1 px-2 rounded-lg text-[11px] ${
            activeTab === 'api' ? 'text-cyan-400 font-bold' : 'text-slate-400'
          }`}
        >
          <Server className="w-4 h-4" />
          <span>API</span>
        </button>
        <button
          onClick={() => setActiveTab('templates')}
          className={`flex flex-col items-center gap-1 py-1 px-2 rounded-lg text-[11px] ${
            activeTab === 'templates' ? 'text-cyan-400 font-bold' : 'text-slate-400'
          }`}
        >
          <FileCode className="w-4 h-4" />
          <span>HTML</span>
        </button>
      </div>
    </header>
  );
};
