import React, { useState } from 'react';
import { 
  Radio, 
  Cpu, 
  Volume2, 
  Zap, 
  Sparkles, 
  HelpCircle, 
  CheckCircle2, 
  Layers,
  Info,
  ExternalLink
} from 'lucide-react';
import { EspBellConfig } from '../types';

interface HardwareDiagramProps {
  config: EspBellConfig;
}

export const HardwareDiagram: React.FC<HardwareDiagramProps> = ({ config }) => {
  const [selectedPin, setSelectedPin] = useState<string | null>(null);

  const pinMappings = [
    {
      espPin: `GPIO ${config.i2s_bck_pin}`,
      dacPin: 'BCK (Bit Clock)',
      color: '#f59e0b', // Amber
      signal: 'I2S Serial Bit Clock (BCLK)',
      description: 'Синхросигнал тактовой частоты битов. Определяет скорость передачи отдельных битов аудиоданных (44.1кГц × 32 = 1.411 МГц).',
      recommendation: 'Соедините напрямую коротким проводом (<10см) для минимизации джиттера.',
    },
    {
      espPin: `GPIO ${config.i2s_ws_pin}`,
      dacPin: 'LRCK / WS (Word Select)',
      color: '#3b82f6', // Blue
      signal: 'I2S Left / Right Channel Clock',
      description: 'Тактовый сигнал выбора канала (левый / правый канал 44.1 кГц). Сигнал LOW = левый канал, HIGH = правый канал.',
      recommendation: 'Прямое подключение к выводу LCK / LRCK модуля ЦАП.',
    },
    {
      espPin: `GPIO ${config.i2s_sd_pin}`,
      dacPin: 'DIN (Data Input)',
      color: '#10b981', // Emerald
      signal: 'I2S Serial Audio Data stream',
      description: 'Линия передачи последовательных цифровых отсчетов 16-битного звука в формате дополнения до двух.',
      recommendation: 'Подключите к DIN (Digital In) на плате PCM5102A.',
    },
    {
      espPin: '3.3V Power Out',
      dacPin: 'VCC / 3.3V',
      color: '#ef4444', // Red
      signal: 'Питание цифровой и аналоговой части ЦАП',
      description: 'Стабилизированное напряжение 3.3 Вольта. PCM5102A оснащен встроенным малошумящим LDO.',
      recommendation: 'Рекомендуется керамический конденсатор 0.1мкФ + электролит 10мкФ рядом с выводами ЦАП.',
    },
    {
      espPin: 'GND',
      dacPin: 'GND (Ground)',
      color: '#64748b', // Slate
      signal: 'Общий провод питания и сигнала',
      description: 'Земляная шина. Соединяет сигнальную землю ESP32 и аналоговую/цифровую землю ЦАП.',
      recommendation: 'Используйте общее сплошное заземление для предотвращения наводок и фона в динамике.',
    },
    {
      espPin: `GPIO ${config.power_relay_pin}`,
      dacPin: 'Relay Latch Driver',
      color: '#8b5cf6', // Purple
      signal: 'Управление ключом самоблокировки питания',
      description: 'Логический уровень HIGH удерживает питание системы включенным после кратковременного нажатия звонка.',
      recommendation: 'По завершении мелодии и истечении таймаута GPIO4 сбрасывается в LOW для полного обесточивания.',
    },
    {
      espPin: `GPIO ${config.indicator_led_pin}`,
      dacPin: 'WS2812 NeoPixel',
      color: '#06b6d4', // Cyan
      signal: 'Однопроводной протокол RGB LED',
      description: 'Цветовая индикация состояния: зеленый (готов), синий (проигрывание), желтый (AP режим), красный (ошибка).',
      recommendation: 'Встроенный светодиод на плате ESP32-S3 DevKit.',
    },
  ];

  const dacJumpers = [
    { pin: 'FLT', state: 'GND (LOW)', desc: 'Фильтр с нормальной задержкой (Normal Latency FIR)' },
    { pin: 'DMP', state: 'GND (LOW)', desc: 'Де-эмфазис выключен (De-emphasis Off)' },
    { pin: 'SCL', state: 'GND (LOW)', desc: 'Внутренний генератор тактовой частоты SCK от BCK PLL (System Clock)' },
    { pin: 'FMT', state: 'GND (LOW)', desc: 'Формат данных I2S (I2S Standard Protocol)' },
    { pin: 'XMT', state: '3.3V (HIGH)', desc: 'Разблокировка звукового выхода (Soft Unmute)' },
  ];

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 shadow-xl space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-semibold">
          <Radio className="w-3.5 h-3.5" />
          <span>Аппаратная архитектура и схема подключения</span>
        </div>
        <h2 className="text-2xl font-bold text-white tracking-tight">
          Подключение PCM5102A I2S ЦАП к ESP32-S3
        </h2>
        <p className="text-slate-400 text-sm max-w-3xl">
          Схема соединения микроконтроллера ESP32-S3 (N16R8) с высококачественным аудио-ЦАП PCM5102A (32-бит, 384 кГц, SNR 112 дБ), модулем реле энергосбережения и внешней акустической системой.
        </p>
      </div>

      {/* Visual Interactive Wiring Board */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 shadow-xl space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-cyan-400" />
            <h3 className="font-bold text-white text-base">Интерактивная карта выводов</h3>
          </div>
          <span className="text-xs text-slate-400">Нажмите на провод для просмотра назначения</span>
        </div>

        {/* Wiring Diagram Visualization Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Left Block: ESP32-S3 */}
          <div className="lg:col-span-4 bg-slate-950 rounded-2xl border-2 border-cyan-500/40 p-5 space-y-4 shadow-lg shadow-cyan-500/5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <Cpu className="w-5 h-5 text-cyan-400" />
                <span className="font-bold text-white text-sm">ESP32-S3-WROOM-1</span>
              </div>
              <span className="text-[10px] font-mono bg-cyan-950 text-cyan-400 px-2 py-0.5 rounded border border-cyan-800">
                N16R8
              </span>
            </div>

            <div className="space-y-2 font-mono text-xs">
              <div 
                onClick={() => setSelectedPin('GPIO15')}
                className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                  selectedPin === 'GPIO15' ? 'bg-amber-950/60 border-amber-400 text-amber-300' : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <span>GPIO {config.i2s_bck_pin}</span>
                <span className="font-bold text-amber-400">BCK (Bit Clock)</span>
              </div>

              <div 
                onClick={() => setSelectedPin('GPIO16')}
                className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                  selectedPin === 'GPIO16' ? 'bg-blue-950/60 border-blue-400 text-blue-300' : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <span>GPIO {config.i2s_ws_pin}</span>
                <span className="font-bold text-blue-400">WS / LRCK</span>
              </div>

              <div 
                onClick={() => setSelectedPin('GPIO17')}
                className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                  selectedPin === 'GPIO17' ? 'bg-emerald-950/60 border-emerald-400 text-emerald-300' : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <span>GPIO {config.i2s_sd_pin}</span>
                <span className="font-bold text-emerald-400">DIN (Data Out)</span>
              </div>

              <div 
                onClick={() => setSelectedPin('GPIO4')}
                className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                  selectedPin === 'GPIO4' ? 'bg-purple-950/60 border-purple-400 text-purple-300' : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <span>GPIO {config.power_relay_pin}</span>
                <span className="font-bold text-purple-400">Реле питания</span>
              </div>

              <div 
                onClick={() => setSelectedPin('GPIO48')}
                className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                  selectedPin === 'GPIO48' ? 'bg-cyan-950/60 border-cyan-400 text-cyan-300' : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <span>GPIO {config.indicator_led_pin}</span>
                <span className="font-bold text-cyan-400">NeoPixel RGB</span>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between text-slate-400">
                <span>3.3V & GND</span>
                <span className="text-red-400 font-bold">Питание VCC / GND</span>
              </div>
            </div>
          </div>

          {/* Center: Connectors Bus */}
          <div className="lg:col-span-4 flex flex-col items-center justify-center space-y-3 py-4">
            <div className="text-center space-y-1">
              <span className="text-xs font-mono uppercase tracking-widest text-cyan-400 font-bold">
                I2S Bus Цифровая шина
              </span>
              <div className="flex justify-center gap-1.5 py-2">
                <span className="w-3 h-3 rounded-full bg-amber-400 animate-pulse" title="BCK" />
                <span className="w-3 h-3 rounded-full bg-blue-400 animate-pulse" title="LRCK" />
                <span className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" title="DIN" />
              </div>
              <p className="text-[11px] text-slate-400">Прямой DMA-поток 16-бит стерео без участия процессора</p>
            </div>

            <div className="w-full bg-slate-950/80 p-3 rounded-xl border border-slate-800 text-[11px] text-slate-300 space-y-1">
              <div className="font-semibold text-white flex items-center gap-1">
                <Info className="w-3.5 h-3.5 text-cyan-400" />
                <span>Особенности PCM5102A:</span>
              </div>
              <ul className="list-disc list-inside space-y-0.5 text-slate-400">
                <li>Встроенный PLL (не требует отдельного MCLK)</li>
                <li>Аппаратный Charge Pump (нет разделительных конденсаторов)</li>
                <li>Динамический диапазон 112 дБ</li>
              </ul>
            </div>
          </div>

          {/* Right Block: PCM5102A DAC Module */}
          <div className="lg:col-span-4 bg-slate-950 rounded-2xl border-2 border-amber-500/40 p-5 space-y-4 shadow-lg shadow-amber-500/5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <Volume2 className="w-5 h-5 text-amber-400" />
                <span className="font-bold text-white text-sm">Модуль PCM5102A DAC</span>
              </div>
              <span className="text-[10px] font-mono bg-amber-950 text-amber-400 px-2 py-0.5 rounded border border-amber-800">
                32-Bit I2S
              </span>
            </div>

            <div className="space-y-2 font-mono text-xs">
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between text-slate-300">
                <span className="text-amber-400 font-bold">BCK</span>
                <span className="text-slate-400">Вход Bit Clock</span>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between text-slate-300">
                <span className="text-blue-400 font-bold">LCK (LRCK)</span>
                <span className="text-slate-400">Вход Word Select</span>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between text-slate-300">
                <span className="text-emerald-400 font-bold">DIN</span>
                <span className="text-slate-400">Вход Digital Audio</span>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between text-slate-300">
                <span className="text-purple-400 font-bold">Jack 3.5mm / Line Out</span>
                <span className="text-slate-400">К усилителю / динамику</span>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between text-slate-400">
                <span className="text-red-400 font-bold">VCC & GND</span>
                <span>3.3V (допустимо 5V)</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Solder Jumpers & Hardware Reference Table */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Hardware Jumpers on PCM5102A Board */}
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <h3 className="font-bold text-white text-base">Конфигурационные перемычки на плате ЦАП</h3>
          </div>

          <div className="space-y-2.5 text-xs">
            {dacJumpers.map((jumper) => (
              <div key={jumper.pin} className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between gap-3">
                <div>
                  <span className="font-bold font-mono text-cyan-300 text-sm">{jumper.pin}</span>
                  <p className="text-slate-400 text-[11px] mt-0.5">{jumper.desc}</p>
                </div>
                <span className="font-mono text-xs px-2.5 py-1 rounded bg-slate-900 text-emerald-400 font-bold border border-slate-800 shrink-0">
                  {jumper.state}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Pin Details & Connection Guide */}
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <Zap className="w-5 h-5 text-cyan-400" />
            <h3 className="font-bold text-white text-base">Спецификация сигналов и рекомендация</h3>
          </div>

          <div className="space-y-3">
            {pinMappings.slice(0, 4).map((pin) => (
              <div key={pin.dacPin} className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold font-mono text-white flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: pin.color }} />
                    {pin.espPin} ➔ {pin.dacPin}
                  </span>
                  <span className="text-[11px] text-slate-500 font-mono">{pin.signal}</span>
                </div>
                <p className="text-slate-400 text-[11px]">{pin.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
