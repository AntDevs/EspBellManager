import React, { useEffect, useRef } from 'react';
import { 
  Play, 
  Square, 
  Volume2, 
  Bell, 
  Music, 
  Cpu, 
  Layers, 
  Sparkles, 
  Clock, 
  Sliders, 
  CheckCircle2, 
  RefreshCw,
  HardDrive
} from 'lucide-react';
import { AudioTrackInfo, EspBellConfig, SystemStatus, PresetMelody } from '../types';
import { presetMelodies } from '../data/presetMelodies';

interface MainViewProps {
  currentTrack: AudioTrackInfo;
  config: EspBellConfig;
  systemStatus: SystemStatus;
  isPlaying: boolean;
  onPlayTrack: () => void;
  onStopTrack: () => void;
  onTriggerBellRing: () => void;
  onSelectPreset: (preset: PresetMelody) => void;
  onUpdateConfigGain: (newGain: number) => void;
  onNavigateToUpload: () => void;
  onNavigateToConfig: () => void;
}

export const MainView: React.FC<MainViewProps> = ({
  currentTrack,
  config,
  systemStatus,
  isPlaying,
  onPlayTrack,
  onStopTrack,
  onTriggerBellRing,
  onSelectPreset,
  onUpdateConfigGain,
  onNavigateToUpload,
  onNavigateToConfig,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Live Canvas Waveform & Frequency animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let phase = 0;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      // Background subtle grid
      ctx.strokeStyle = 'rgba(30, 41, 59, 0.4)';
      ctx.lineWidth = 1;
      for (let x = 0; x < width; x += 30) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += 20) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Dynamic Audio spectrum bars
      const numBars = 48;
      const barWidth = (width - (numBars - 1) * 3) / numBars;

      for (let i = 0; i < numBars; i++) {
        let barHeight = 4;
        if (isPlaying) {
          // Dynamic wave formula when playing
          const sinVal1 = Math.sin(phase * 0.08 + i * 0.25);
          const sinVal2 = Math.cos(phase * 0.12 - i * 0.15);
          const noise = Math.abs(sinVal1 * sinVal2);
          barHeight = Math.max(8, noise * (height * 0.75) * config.gain_scale);
        } else {
          // Static soft baseline
          barHeight = Math.sin(i * 0.2) * 6 + 10;
        }

        const x = i * (barWidth + 3);
        const y = (height - barHeight) / 2;

        const gradient = ctx.createLinearGradient(0, y, 0, y + barHeight);
        if (isPlaying) {
          gradient.addColorStop(0, '#06b6d4'); // Cyan
          gradient.addColorStop(0.5, '#3b82f6'); // Blue
          gradient.addColorStop(1, '#10b981'); // Emerald
        } else {
          gradient.addColorStop(0, '#334155');
          gradient.addColorStop(1, '#1e293b');
        }

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, 3);
        ctx.fill();
      }

      if (isPlaying) {
        phase += 1;
      }
      animFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [isPlaying, config.gain_scale]);

  return (
    <div className="space-y-6">
      {/* Welcome Banner / Overview */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-cyan-950/40 rounded-2xl p-6 border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Микроконтроллер ESP32-S3 • I2S DAC PCM5102A</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Управление умным дверным звонком
            </h2>
            <p className="text-slate-400 text-sm max-w-2xl leading-relaxed">
              Текущая активная мелодия воспроизводится через высококачественный 32-битный I2S ЦАП PCM5102A при нажатии на физическую кнопку звонка. Вы можете загрузить любую музыку прямо со смартфона или ПК.
            </p>
          </div>

          {/* Big Interactive Ring Doorbell Button */}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <button
              onClick={onTriggerBellRing}
              disabled={isPlaying}
              className={`w-full sm:w-auto flex items-center justify-center gap-3 px-6 py-4 rounded-2xl font-bold text-base transition-all shadow-xl active:scale-95 ${
                isPlaying
                  ? 'bg-amber-600 text-white animate-pulse shadow-amber-600/30 ring-4 ring-amber-500/20'
                  : 'bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:via-blue-500 hover:to-indigo-500 text-white shadow-cyan-500/30 hover:shadow-cyan-500/40'
              }`}
            >
              <Bell className={`w-6 h-6 ${isPlaying ? 'animate-bounce' : ''}`} />
              <div className="text-left">
                <div className="text-xs uppercase tracking-wider opacity-80">Физический триггер</div>
                <div className="leading-tight">{isPlaying ? 'Звонок звучит...' : 'Позвонить в звонок'}</div>
              </div>
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Active Melody Player Card */}
        <div className="lg:col-span-2 space-y-6">
          {/* Active Audio Card */}
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 shadow-xl space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                  <Music className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-xs font-mono uppercase text-cyan-400 font-semibold tracking-wider">
                    Активная мелодия звонка
                  </span>
                  <h3 className="text-xl font-bold text-white tracking-tight">
                    {currentTrack.title || currentTrack.filename}
                  </h3>
                </div>
              </div>

              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Готов к звонку</span>
              </span>
            </div>

            {/* Audio Waveform Canvas */}
            <div className="relative rounded-xl bg-slate-950 border border-slate-800/80 p-3 overflow-hidden">
              <canvas
                ref={canvasRef}
                width={650}
                height={120}
                className="w-full h-28 block rounded-lg"
              />
              <div className="flex items-center justify-between text-xs text-slate-500 mt-2 px-1 font-mono">
                <span>00:00.0</span>
                <span>I2S Stereo 16-bit • {currentTrack.sampleRate} Hz</span>
                <span>{currentTrack.durationSeconds.toFixed(1)} сек</span>
              </div>
            </div>

            {/* Playback Controls & Specs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Playback Trigger Buttons */}
              <div className="flex items-center gap-3">
                {isPlaying ? (
                  <button
                    onClick={onStopTrack}
                    className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold shadow-lg shadow-rose-600/30 transition-all active:scale-95"
                  >
                    <Square className="w-4 h-4 fill-current" />
                    <span>Остановить воспроизведение</span>
                  </button>
                ) : (
                  <button
                    onClick={onPlayTrack}
                    className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold shadow-lg shadow-cyan-600/30 transition-all active:scale-95"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>Тестовое прослушивание</span>
                  </button>
                )}
              </div>

              {/* Volume / Gain Scaling Slider */}
              <div className="bg-slate-950/80 rounded-xl p-3 border border-slate-800 flex items-center gap-3">
                <Volume2 className="w-5 h-5 text-cyan-400 shrink-0" />
                <div className="flex-1 space-y-1">
                  <div className="flex justify-between text-xs font-medium text-slate-300">
                    <span>Усиление ЦАП (Gain)</span>
                    <span className="font-mono text-cyan-400">{Math.round(config.gain_scale * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="2.0"
                    step="0.05"
                    value={config.gain_scale}
                    onChange={(e) => onUpdateConfigGain(parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                  />
                </div>
              </div>
            </div>

            {/* Audio File Technical Specifications */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
              <div>
                <span className="text-slate-500 block">Файл на ESP32</span>
                <span className="font-mono text-slate-200 font-semibold">{config.media_dir}/{config.target_filename}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Размер файла</span>
                <span className="font-mono text-slate-200 font-semibold">{(currentTrack.sizeBytes / 1024).toFixed(1)} КБ</span>
              </div>
              <div>
                <span className="text-slate-500 block">Режим запуска</span>
                <span className="font-mono text-cyan-400 font-semibold uppercase">{config.boot_mode}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Затухание (Fade)</span>
                <span className="font-mono text-slate-200 font-semibold">{config.fade_ms} мс</span>
              </div>
            </div>

            {/* Quick Upload Navigation Banner */}
            <div className="flex items-center justify-between bg-slate-800/50 p-4 rounded-xl border border-slate-700/60">
              <div>
                <h4 className="text-sm font-semibold text-white">Хотите сменить звонок?</h4>
                <p className="text-xs text-slate-400">Загрузите свой MP3 файл или выберите готовый рингтон</p>
              </div>
              <button
                onClick={onNavigateToUpload}
                className="px-4 py-2 bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 rounded-lg text-xs font-semibold border border-cyan-500/30 transition-colors"
              >
                Открыть загрузчик
              </button>
            </div>
          </div>

          {/* Quick Preset Ringtones Gallery */}
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-400" />
                <h3 className="text-lg font-bold text-white">Быстрая смена мелодии звонка</h3>
              </div>
              <span className="text-xs text-slate-400">Встроенные классические и современные рингтоны</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {presetMelodies.slice(0, 4).map((preset) => (
                <div
                  key={preset.id}
                  onClick={() => onSelectPreset(preset)}
                  className="group p-3.5 bg-slate-950 hover:bg-slate-800/80 rounded-xl border border-slate-800 hover:border-cyan-500/40 cursor-pointer transition-all flex items-center justify-between"
                >
                  <div className="space-y-1">
                    <div className="font-semibold text-sm text-slate-200 group-hover:text-cyan-300 transition-colors">
                      {preset.nameRu}
                    </div>
                    <div className="text-xs text-slate-500 line-clamp-1">
                      {preset.description}
                    </div>
                  </div>
                  <span className="text-xs font-mono text-slate-400 bg-slate-900 px-2 py-1 rounded border border-slate-800">
                    {preset.duration.toFixed(1)}с
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right 1 Col: Hardware & System Telemetry Status */}
        <div className="space-y-6">
          {/* ESP32-S3 Hardware Health Monitor */}
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Cpu className="w-5 h-5 text-cyan-400" />
                <h3 className="font-bold text-white text-base">Статус контроллера</h3>
              </div>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            </div>

            <div className="space-y-3 text-xs">
              {/* CPU Frequency */}
              <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Процессор Xtensa LX7</span>
                <span className="font-mono font-semibold text-slate-200">{systemStatus.cpuFrequencyMhz} MHz (Dual-Core)</span>
              </div>

              {/* Core Temperature */}
              <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Температура чипа</span>
                <span className="font-mono font-semibold text-emerald-400">+{systemStatus.coreTemperatureC}°C</span>
              </div>

              {/* Free Heap */}
              <div className="space-y-1.5 py-1">
                <div className="flex justify-between text-slate-400">
                  <span>Оперативная память Heap</span>
                  <span className="font-mono text-slate-200">
                    {Math.round(systemStatus.freeHeapBytes / 1024)} KB / {Math.round(systemStatus.totalHeapBytes / 1024)} KB
                  </span>
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-cyan-500 h-full rounded-full transition-all"
                    style={{ width: `${(systemStatus.freeHeapBytes / systemStatus.totalHeapBytes) * 100}%` }}
                  />
                </div>
              </div>

              {/* PSRAM */}
              <div className="space-y-1.5 py-1">
                <div className="flex justify-between text-slate-400">
                  <span>Внешняя память Octal PSRAM</span>
                  <span className="font-mono text-slate-200">
                    {(systemStatus.psramFreeBytes / (1024 * 1024)).toFixed(1)} MB / {(systemStatus.psramTotalBytes / (1024 * 1024)).toFixed(0)} MB
                  </span>
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-indigo-500 h-full rounded-full transition-all"
                    style={{ width: `${(systemStatus.psramFreeBytes / systemStatus.psramTotalBytes) * 100}%` }}
                  />
                </div>
              </div>

              {/* Flash Storage */}
              <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                <span className="text-slate-400 flex items-center gap-1">
                  <HardDrive className="w-3.5 h-3.5 text-slate-500" />
                  <span>SPI Flash Память</span>
                </span>
                <span className="font-mono font-semibold text-slate-200">16 MB (N16)</span>
              </div>

              {/* Power Relay State */}
              <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Реле питания (GPIO4)</span>
                <span className={`font-mono font-bold ${systemStatus.relayState ? 'text-emerald-400' : 'text-slate-500'}`}>
                  {systemStatus.relayState ? 'ЗАМКНУТО (HIGH)' : 'РАЗОМКНУТО'}
                </span>
              </div>

              {/* NeoPixel RGB LED */}
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-400">LED индикатор (GPIO48)</span>
                <div className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full border border-white/20"
                    style={{ backgroundColor: systemStatus.neoPixelColor }}
                  />
                  <span className="font-mono text-slate-200">{systemStatus.neoPixelState}</span>
                </div>
              </div>
            </div>
          </div>

          {/* I2S PCM5102A Wiring Pin Map Preview */}
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-cyan-400" />
                <h3 className="font-bold text-white text-base">Подключение I2S ЦАП</h3>
              </div>
              <button
                onClick={onNavigateToConfig}
                className="text-xs text-cyan-400 hover:underline"
              >
                Изменить
              </button>
            </div>

            <div className="space-y-2 text-xs font-mono">
              <div className="flex items-center justify-between bg-slate-950 p-2 rounded-lg border border-slate-800">
                <span className="text-slate-400">I2S BCK (Bit Clock)</span>
                <span className="text-amber-400 font-bold">GPIO {config.i2s_bck_pin}</span>
              </div>
              <div className="flex items-center justify-between bg-slate-950 p-2 rounded-lg border border-slate-800">
                <span className="text-slate-400">I2S WS (LRCK / Word Select)</span>
                <span className="text-amber-400 font-bold">GPIO {config.i2s_ws_pin}</span>
              </div>
              <div className="flex items-center justify-between bg-slate-950 p-2 rounded-lg border border-slate-800">
                <span className="text-slate-400">I2S DATA (DIN / Serial)</span>
                <span className="text-amber-400 font-bold">GPIO {config.i2s_sd_pin}</span>
              </div>
              <div className="flex items-center justify-between bg-slate-950 p-2 rounded-lg border border-slate-800">
                <span className="text-slate-400">Питание ЦАП PCM5102A</span>
                <span className="text-emerald-400 font-bold">3.3V / GND</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
