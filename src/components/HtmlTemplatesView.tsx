import React, { useState, useEffect, useRef } from 'react';
import { 
  FileCode, 
  Play, 
  Code2, 
  RefreshCw, 
  Copy, 
  Check, 
  Download, 
  Sparkles, 
  Layers, 
  Info,
  CheckCircle2,
  Terminal,
  Zap
} from 'lucide-react';
import { loadHtmlTemplate, bindTemplate } from '../utils/templateBinder';
import { EspBellConfig, SystemStatus, AudioTrackInfo } from '../types';

interface HtmlTemplatesViewProps {
  config: EspBellConfig;
  systemStatus: SystemStatus;
  currentTrack: AudioTrackInfo;
  onSaveConfig: (cfg: EspBellConfig) => void;
  onTriggerBell: () => void;
  onPlayCurrentSound: () => void;
  onStopSound: () => void;
  logs: Array<{ timestamp: string; level: string; tag: string; message: string }>;
}

export function HtmlTemplatesView({
  config,
  systemStatus,
  currentTrack,
  onSaveConfig,
  onTriggerBell,
  onPlayCurrentSound,
  onStopSound,
  logs,
}: HtmlTemplatesViewProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<string>('main');
  const [viewMode, setViewMode] = useState<'live' | 'split' | 'source'>('split');
  const [rawHtml, setRawHtml] = useState<string>('');
  const [editableHtml, setEditableHtml] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [bindingLog, setBindingLog] = useState<string[]>([]);

  const containerRef = useRef<HTMLDivElement>(null);
  const binderInstanceRef = useRef<{ update: (data: any) => void; destroy: () => void } | null>(null);

  // Template files list
  const templates = [
    { id: 'main', name: 'main.html', label: 'Главный экран звонка', path: '/templates/main.html', size: '4.8 KB' },
    { id: 'upload', name: 'upload.html', label: 'Загрузка и конвертер WAV', path: '/templates/upload.html', size: '3.9 KB' },
    { id: 'config', name: 'config.html', label: 'Редактор /config.json', path: '/templates/config.html', size: '4.1 KB' },
    { id: 'hardware', name: 'hardware.html', label: 'Схема I2S ЦАП PCM5102A', path: '/templates/hardware.html', size: '3.4 KB' },
    { id: 'logs', name: 'logs.html', label: 'Журнал boot.log', path: '/templates/logs.html', size: '2.2 KB' },
    { id: 'api', name: 'api.html', label: 'REST API Инспектор', path: '/templates/api.html', size: '2.5 KB' },
    { id: 'header', name: 'header.html', label: 'Шапка и навигация', path: '/templates/header.html', size: '2.1 KB' },
    { id: 'footer', name: 'footer.html', label: 'Футер приложения', path: '/templates/footer.html', size: '0.6 KB' },
    { id: 'doorbell-modal', name: 'doorbell-modal.html', label: 'Эмулятор физического звонка', path: '/templates/doorbell-modal.html', size: '2.9 KB' },
    { id: 'login-modal', name: 'login-modal.html', label: 'Авторизация Nonce+SHA256', path: '/templates/login-modal.html', size: '2.4 KB' },
  ];

  // Load selected HTML template
  useEffect(() => {
    let isMounted = true;
    async function load() {
      setIsLoading(true);
      try {
        const html = await loadHtmlTemplate(selectedTemplate, true);
        if (isMounted) {
          setRawHtml(html);
          setEditableHtml(html);
          addBindingEvent(`Успешно загружен чистый HTML-шаблон: /templates/${selectedTemplate}.html`);
        }
      } catch (err) {
        if (isMounted) {
          addBindingEvent(`Ошибка загрузки шаблона: ${err}`);
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    load();
    return () => {
      isMounted = false;
    };
  }, [selectedTemplate]);

  const addBindingEvent = (msg: string) => {
    const time = new Date().toLocaleTimeString();
    setBindingLog((prev) => [`[${time}] ${msg}`, ...prev.slice(0, 15)]);
  };

  // Compile and bind data to the DOM container
  useEffect(() => {
    if (!containerRef.current || !editableHtml) return;

    // Cleanup previous binder
    if (binderInstanceRef.current) {
      binderInstanceRef.current.destroy();
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
        smart_timeout_sec: config.smart_timeout_sec,
        target_filename: config.target_filename,
        gain_scale: config.gain_scale,
        sample_rate: config.i2s_sample_rate,
        wifi_ssid: config.wifi_ssid,
        wifi_password: config.wifi_password,
        admin_password: config.admin_password,
        hostname: `${config.wifi_ap_ssid}.local`,
      },
    };

    const actions = {
      triggerRing: () => {
        addBindingEvent('Действие: [data-action="triggerRing"] вызвано из HTML!');
        onTriggerBell();
      },
      togglePlay: () => {
        if (systemStatus.isPlaying) {
          addBindingEvent('Действие: [data-action="togglePlay"] -> stopSound()');
          onStopSound();
        } else {
          addBindingEvent('Действие: [data-action="togglePlay"] -> playSound()');
          onPlayCurrentSound();
        }
      },
      changeGain: (e: Event) => {
        const input = e.target as HTMLInputElement;
        const val = parseFloat(input.value);
        addBindingEvent(`Data Binding 2-Way: Изменение громкости Gain -> ${val}`);
        onSaveConfig({ ...config, gain_scale: val });
      },
      selectPreset: (e: Event, el: HTMLElement) => {
        const preset = el.getAttribute('data-preset');
        addBindingEvent(`Действие: Выбран встроенный пресет мелодии: ${preset}`);
        onPlayCurrentSound();
      },
      saveConfig: () => {
        addBindingEvent('Действие: [data-action="saveConfig"] -> Сохранение /config.json');
        onSaveConfig(config);
      },
      resetConfig: () => {
        addBindingEvent('Действие: [data-action="resetConfig"]');
      },
      refreshLogs: () => {
        addBindingEvent('Действие: [data-action="refreshLogs"]');
      },
      clearLogs: () => {
        addBindingEvent('Действие: [data-action="clearLogs"]');
      },
      testAllEndpoints: () => {
        addBindingEvent('Действие: [data-action="testAllEndpoints"]');
      },
    };

    try {
      const binder = bindTemplate(containerRef.current, editableHtml, {
        data: dataModel,
        actions,
        onDataChange: (path, val) => {
          addBindingEvent(`2-Way Binding: Поле "${path}" изменено на "${val}"`);
        },
      });

      binderInstanceRef.current = binder;
      addBindingEvent(`Связывание завершено. Элементов с data-bind привязано к DOM.`);
    } catch (err) {
      console.error('Data binding error:', err);
      addBindingEvent(`Ошибка привязки данных: ${err}`);
    }

    return () => {
      if (binderInstanceRef.current) {
        binderInstanceRef.current.destroy();
      }
    };
  }, [editableHtml, currentTrack, systemStatus, config]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(editableHtml);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadHtml = () => {
    const blob = new Blob([editableHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedTemplate}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/40 rounded-3xl border border-slate-800 p-6 sm:p-8 shadow-2xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Вариант 2: Изолированные HTML-шаблоны + Client-Side Data Binding</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Раздельная работа с HTML-файлами и TypeScript
            </h1>
            <p className="text-slate-400 text-sm leading-relaxed">
              Все страницы приложения хранятся как чистые, стандартные <code className="text-cyan-300 font-mono">.html</code> файлы в папке <code className="text-cyan-300 font-mono">/public/templates/</code>. TypeScript подгружает их асинхронно через <code className="text-cyan-300 font-mono">fetch()</code> и привязывает переменные и события через декларативные атрибуты <code className="text-cyan-300 font-mono">data-bind</code> и <code className="text-cyan-300 font-mono">data-action</code>.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleDownloadHtml}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors border border-slate-700"
            >
              <Download className="w-4 h-4 text-cyan-400" />
              <span>Скачать {selectedTemplate}.html</span>
            </button>

            <button
              onClick={handleCopyCode}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-all shadow-lg shadow-cyan-600/30"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Скопировано!' : 'Копировать HTML'}</span>
            </button>
          </div>
        </div>

        {/* Template Selector Tabs */}
        <div className="mt-6 pt-5 border-t border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-400 mr-2 flex items-center gap-1.5">
              <FileCode className="w-4 h-4 text-cyan-400" />
              <span>HTML файлы:</span>
            </span>
            {templates.map((tpl) => (
              <button
                key={tpl.id}
                onClick={() => setSelectedTemplate(tpl.id)}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
                  selectedTemplate === tpl.id
                    ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/20 font-bold'
                    : 'bg-slate-950 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800'
                }`}
              >
                <span>{tpl.name}</span>
                <span className="text-[10px] opacity-70">({tpl.size})</span>
              </button>
            ))}
          </div>

          {/* View Mode Switcher */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setViewMode('split')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                viewMode === 'split' ? 'bg-slate-800 text-cyan-400 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Split (HTML + Live)</span>
            </button>
            <button
              onClick={() => setViewMode('live')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                viewMode === 'live' ? 'bg-slate-800 text-cyan-400 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Play className="w-3.5 h-3.5" />
              <span>Только результат</span>
            </button>
            <button
              onClick={() => setViewMode('source')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                viewMode === 'source' ? 'bg-slate-800 text-cyan-400 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>Только HTML код</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Workspace Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Pure HTML Code Editor (if split or source mode) */}
        {(viewMode === 'split' || viewMode === 'source') && (
          <div className={`${viewMode === 'split' ? 'lg:col-span-6' : 'lg:col-span-12'} space-y-4`}>
            <div className="bg-slate-900 rounded-3xl border border-slate-800 p-5 shadow-2xl flex flex-col h-full">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-rose-500/80"></span>
                  <span className="w-3 h-3 rounded-full bg-amber-500/80"></span>
                  <span className="w-3 h-3 rounded-full bg-emerald-500/80"></span>
                  <span className="font-mono text-xs text-slate-300 ml-2 font-bold">
                    /public/templates/{selectedTemplate}.html
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-cyan-400 font-mono">Прямое редактирование HTML</span>
                  <button
                    onClick={() => setEditableHtml(rawHtml)}
                    className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-lg text-xs"
                    title="Сбросить изменения"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Textarea for live editing HTML */}
              <textarea
                value={editableHtml}
                onChange={(e) => setEditableHtml(e.target.value)}
                className="w-full h-[520px] bg-slate-950 text-cyan-300 font-mono text-xs p-4 rounded-2xl border border-slate-800/80 focus:border-cyan-500 focus:outline-none resize-none leading-relaxed selection:bg-cyan-900/50"
                spellCheck={false}
              />

              <div className="mt-3 text-[11px] text-slate-500 flex items-center justify-between font-mono">
                <span>Символов: {editableHtml.length}</span>
                <span>Data Binding: data-bind, data-action</span>
              </div>
            </div>
          </div>
        )}

        {/* Right: Live Rendered Output (if split or live mode) */}
        {(viewMode === 'split' || viewMode === 'live') && (
          <div className={`${viewMode === 'split' ? 'lg:col-span-6' : 'lg:col-span-12'} space-y-4`}>
            <div className="bg-slate-900 rounded-3xl border border-slate-800 p-5 shadow-2xl flex flex-col h-full">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
                <div className="flex items-center gap-2">
                  <span className="p-1 rounded-md bg-emerald-500/10 text-emerald-400">
                    <Zap className="w-4 h-4" />
                  </span>
                  <span className="font-bold text-sm text-white">
                    Живой рендеринг (DOM + TypeScript Data Binding)
                  </span>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-emerald-950 text-emerald-400 border border-emerald-800/60">
                  Data-bound Live
                </span>
              </div>

              {/* Dynamic Render Container where pure HTML is mounted */}
              <div 
                ref={containerRef}
                className="min-h-[520px] bg-slate-950/40 rounded-2xl border border-slate-800/50 p-2 overflow-y-auto"
              >
                {isLoading && (
                  <div className="flex items-center justify-center h-48 text-slate-500 font-mono text-xs">
                    Загрузка HTML шаблона...
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Interactive Data-Binding Event Log & Cheat Sheet */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Terminal Data Binding Event Monitor */}
        <div className="lg:col-span-6 bg-slate-900 rounded-3xl border border-slate-800 p-6 shadow-2xl space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Terminal className="w-4 h-4 text-cyan-400" />
              <span>Лог событий Data Binding Engine</span>
            </h3>
            <span className="text-[11px] font-mono text-slate-500">Реактивный мост</span>
          </div>

          <div className="bg-slate-950 rounded-2xl p-4 font-mono text-[11px] text-slate-300 space-y-1.5 h-44 overflow-y-auto border border-slate-800">
            {bindingLog.map((log, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-cyan-400 select-none">›</span>
                <span className="text-slate-300">{log}</span>
              </div>
            ))}
            {bindingLog.length === 0 && (
              <div className="text-slate-600">Нажмите элементы в живом шаблоне для проверки привязки событий...</div>
            )}
          </div>
        </div>

        {/* Cheat Sheet & Syntax Guide */}
        <div className="lg:col-span-6 bg-slate-900 rounded-3xl border border-slate-800 p-6 shadow-2xl space-y-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Info className="w-4 h-4 text-blue-400" />
            <span>Как устроен Data Binding в чистом HTML</span>
          </h3>

          <div className="space-y-2.5 text-xs text-slate-300 font-mono">
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-cyan-400 font-bold">data-bind="track.title"</span>
                <p className="text-[11px] text-slate-400 mt-0.5">Односторонняя подстановка текста или значения инпута</p>
              </div>
              <span className="text-[10px] bg-slate-800 px-2 py-1 rounded text-slate-300">1-Way / 2-Way</span>
            </div>

            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-amber-400 font-bold">data-action="triggerRing"</span>
                <p className="text-[11px] text-slate-400 mt-0.5">Привязка вызова функции клика/ввода к обработчику</p>
              </div>
              <span className="text-[10px] bg-slate-800 px-2 py-1 rounded text-slate-300">Event Bridge</span>
            </div>

            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-emerald-400 font-bold">data-bind-style="system.ledStyle"</span>
                <p className="text-[11px] text-slate-400 mt-0.5">Динамическое применение стилей (цвет, фон, размеры)</p>
              </div>
              <span className="text-[10px] bg-slate-800 px-2 py-1 rounded text-slate-300">Style Reactive</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
