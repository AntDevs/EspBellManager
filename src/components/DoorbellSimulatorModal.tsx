import React, { useEffect, useState } from 'react';
import { 
  X, 
  Bell, 
  Volume2, 
  Zap, 
  Cpu, 
  Power, 
  Sparkles, 
  Layers, 
  Radio,
  CheckCircle2
} from 'lucide-react';
import { AudioTrackInfo, EspBellConfig, SystemStatus } from '../types';

interface DoorbellSimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTrack: AudioTrackInfo;
  config: EspBellConfig;
  systemStatus: SystemStatus;
  isPlaying: boolean;
  onTriggerBellRing: () => void;
  onStopTrack: () => void;
}

export const DoorbellSimulatorModal: React.FC<DoorbellSimulatorModalProps> = ({
  isOpen,
  onClose,
  currentTrack,
  config,
  systemStatus,
  isPlaying,
  onTriggerBellRing,
  onStopTrack,
}) => {
  const [pulseCount, setPulseCount] = useState(0);

  useEffect(() => {
    if (isPlaying) {
      const interval = setInterval(() => {
        setPulseCount((p) => p + 1);
      }, 150);
      return () => clearInterval(interval);
    }
  }, [isPlaying]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl space-y-6 relative overflow-hidden">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800 hover:bg-slate-700 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Title */}
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Эмулятор физического звонка</span>
          </div>
          <h3 className="text-2xl font-bold text-white tracking-tight">
            Интерактивный уличный дверной звонок
          </h3>
          <p className="text-slate-400 text-xs sm:text-sm">
            Нажмите на кнопку дверного звонка, чтобы увидеть работу цепи самоблокировки питания (GPIO4), светодиода NeoPixel и звукового тракта PCM5102A I2S DAC.
          </p>
        </div>

        {/* Physical Bell Hardware Unit Simulation */}
        <div className="bg-gradient-to-b from-slate-950 to-slate-900 rounded-2xl border-2 border-slate-700/80 p-8 flex flex-col items-center justify-center space-y-6 shadow-inner relative">
          {/* Status LED on top of Bell */}
          <div className="flex items-center gap-2">
            <span
              className={`w-3.5 h-3.5 rounded-full transition-all duration-300 ${
                isPlaying ? 'scale-125 shadow-lg shadow-cyan-400' : ''
              }`}
              style={{
                backgroundColor: isPlaying ? '#06b6d4' : systemStatus.neoPixelColor,
                boxShadow: `0 0 12px ${isPlaying ? '#06b6d4' : systemStatus.neoPixelColor}`,
              }}
            />
            <span className="text-xs font-mono uppercase tracking-wider text-slate-400">
              {isPlaying ? 'NeoPixel: PLAYING' : 'NeoPixel: STANDBY'}
            </span>
          </div>

          {/* Realistic Round Illuminated Doorbell Button */}
          <div className="relative group">
            <button
              onClick={onTriggerBellRing}
              disabled={isPlaying}
              className={`w-36 h-36 rounded-full flex flex-col items-center justify-center gap-1 font-bold text-lg transition-all duration-200 border-4 ${
                isPlaying
                  ? 'bg-cyan-500 border-cyan-300 text-white shadow-2xl shadow-cyan-500/60 scale-95 ring-8 ring-cyan-500/20'
                  : 'bg-gradient-to-br from-slate-800 to-slate-900 hover:from-slate-750 hover:to-slate-850 border-slate-600 hover:border-cyan-400 text-slate-200 shadow-xl hover:shadow-cyan-500/20 active:scale-95'
              }`}
            >
              <Bell
                className={`w-10 h-10 ${
                  isPlaying ? 'animate-bounce text-white' : 'text-cyan-400 group-hover:scale-110 transition-transform'
                }`}
              />
              <span className="text-xs font-semibold tracking-wider uppercase">
                {isPlaying ? 'Звонит' : 'Нажать'}
              </span>
            </button>

            {/* Sound Wave Ripple Effect when ringing */}
            {isPlaying && (
              <div className="absolute inset-0 rounded-full border-4 border-cyan-400/40 animate-ping pointer-events-none" />
            )}
          </div>

          {/* Speaker Sound Grill Visualizer */}
          <div className="w-full max-w-xs space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
              <span className="flex items-center gap-1.5">
                <Volume2 className="w-4 h-4 text-cyan-400" />
                <span>Динамик (I2S ЦАП)</span>
              </span>
              <span className="text-cyan-400 font-bold">{Math.round(config.gain_scale * 100)}%</span>
            </div>

            {/* Speaker Grille Bars */}
            <div className="h-4 flex items-center justify-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
              {[...Array(24)].map((_, i) => (
                <span
                  key={i}
                  className={`w-1 rounded-full transition-all duration-150 ${
                    isPlaying
                      ? (i + pulseCount) % 3 === 0
                        ? 'h-3.5 bg-cyan-400'
                        : 'h-2 bg-blue-500'
                      : 'h-1 bg-slate-800'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Runtime Sequence Diagram */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
            <span className="text-slate-500 block font-mono">1. Кнопка звонка</span>
            <span className="font-semibold text-slate-200">Подача питания / Пробуждение</span>
          </div>

          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
            <span className="text-slate-500 block font-mono">2. Реле GPIO4</span>
            <span className={`font-semibold ${systemStatus.relayState ? 'text-emerald-400' : 'text-slate-400'}`}>
              {systemStatus.relayState ? 'LATCH ACTIVE' : 'OPEN'}
            </span>
          </div>

          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
            <span className="text-slate-500 block font-mono">3. I2S Поток</span>
            <span className="font-semibold text-cyan-400">
              {config.target_filename} (16-bit)
            </span>
          </div>
        </div>

        {/* Footer Action */}
        <div className="flex items-center justify-between pt-2">
          {isPlaying ? (
            <button
              onClick={onStopTrack}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition-colors shadow-lg shadow-rose-600/30"
            >
              Прервать звук
            </button>
          ) : (
            <span className="text-xs text-slate-500">
              Мелодия: <span className="text-slate-300 font-mono">{currentTrack.title || currentTrack.filename}</span>
            </span>
          )}

          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition-colors"
          >
            Закрыть окно
          </button>
        </div>
      </div>
    </div>
  );
};
