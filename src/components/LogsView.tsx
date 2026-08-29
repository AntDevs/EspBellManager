import React, { useState, useEffect, useRef } from 'react';
import { 
  Terminal, 
  Trash2, 
  Download, 
  RefreshCw, 
  Search, 
  Filter, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Cpu,
  Layers,
  ArrowDown
} from 'lucide-react';
import { LogEntry, SystemStatus } from '../types';

interface LogsViewProps {
  logs: LogEntry[];
  systemStatus: SystemStatus;
  onClearLogs: () => void;
  onRefreshLogs: () => void;
}

export const LogsView: React.FC<LogsViewProps> = ({
  logs,
  systemStatus,
  onClearLogs,
  onRefreshLogs,
}) => {
  const [filterLevel, setFilterLevel] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const logContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const filteredLogs = logs.filter((log) => {
    if (filterLevel !== 'ALL' && log.level !== filterLevel) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        log.message.toLowerCase().includes(q) ||
        log.tag.toLowerCase().includes(q) ||
        log.timestamp.includes(q)
      );
    }
    return true;
  });

  const handleDownloadLog = () => {
    const textContent = logs
      .map((l) => `[${l.timestamp}] [${l.level}] [${l.tag}] ${l.message}`)
      .join('\n');
    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'boot.log';
    a.click();
    URL.revokeObjectURL(url);
  };

  const getLevelBadgeClass = (level: LogEntry['level']) => {
    switch (level) {
      case 'DEBUG':
        return 'text-slate-400 bg-slate-800/80 border-slate-700';
      case 'INFO':
        return 'text-cyan-400 bg-cyan-950/60 border-cyan-800';
      case 'WARNING':
        return 'text-amber-400 bg-amber-950/60 border-amber-800';
      case 'ERROR':
        return 'text-rose-400 bg-rose-950/60 border-rose-800';
      case 'HARDWARE':
        return 'text-emerald-400 bg-emerald-950/60 border-emerald-800';
      default:
        return 'text-slate-300 bg-slate-800 border-slate-700';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 shadow-xl space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-semibold">
          <Terminal className="w-3.5 h-3.5" />
          <span>Системный журнал MicroPython /boot.log</span>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight">
              Журнал событий и диагностика ESP32
            </h2>
            <p className="text-slate-400 text-sm max-w-2xl">
              Логирование процесса инициализации I2S DAC PCM5102A, сетевых подключений, работы реле энергосбережения и воспроизведения мелодий.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onRefreshLogs}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-750 text-slate-200 rounded-xl text-xs font-semibold border border-slate-700 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
              <span>Обновить</span>
            </button>

            <button
              onClick={handleDownloadLog}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-750 text-slate-200 rounded-xl text-xs font-semibold border border-slate-700 transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              <span>Скачать boot.log</span>
            </button>

            <button
              onClick={onClearLogs}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-rose-950/40 text-slate-400 hover:text-rose-300 rounded-xl text-xs font-semibold border border-slate-700 hover:border-rose-800 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Очистить</span>
            </button>
          </div>
        </div>
      </div>

      {/* Terminal Log Console */}
      <div className="bg-slate-950 rounded-2xl border border-slate-800 shadow-2xl overflow-hidden flex flex-col h-[520px]">
        {/* Terminal Top Filter Bar */}
        <div className="bg-slate-900 px-4 py-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
              {['ALL', 'INFO', 'HARDWARE', 'WARNING', 'ERROR'].map((lvl) => (
                <button
                  key={lvl}
                  onClick={() => setFilterLevel(lvl)}
                  className={`px-2.5 py-1 rounded-lg font-mono text-xs transition-colors ${
                    filterLevel === lvl
                      ? 'bg-cyan-600 text-white font-bold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>

            {/* Auto scroll toggle */}
            <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer ml-2">
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={(e) => setAutoScroll(e.target.checked)}
                className="w-3.5 h-3.5 rounded text-cyan-600"
              />
              <span>Автопрокрутка</span>
            </label>
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Поиск по логу..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono w-48 sm:w-64"
            />
          </div>
        </div>

        {/* Console Log Output Body */}
        <div
          ref={logContainerRef}
          className="flex-1 p-4 overflow-y-auto font-mono text-xs space-y-1.5 bg-slate-950 select-text"
        >
          {filteredLogs.length === 0 ? (
            <div className="text-slate-600 text-center py-12">Логи не найдены или очищены</div>
          ) : (
            filteredLogs.map((entry) => (
              <div
                key={entry.id}
                className="flex items-start gap-2.5 py-0.5 hover:bg-slate-900/60 px-2 rounded transition-colors group"
              >
                <span className="text-slate-600 text-[11px] shrink-0 font-mono select-none">
                  {entry.timestamp}
                </span>

                <span
                  className={`text-[10px] uppercase font-bold px-1.5 py-0.2 rounded border font-mono shrink-0 ${getLevelBadgeClass(
                    entry.level
                  )}`}
                >
                  {entry.level}
                </span>

                <span className="text-cyan-500/80 font-bold shrink-0 text-[11px]">
                  [{entry.tag}]
                </span>

                <span className="text-slate-300 break-all leading-relaxed">{entry.message}</span>
              </div>
            ))
          )}
        </div>

        {/* Terminal Bottom Status Bar */}
        <div className="bg-slate-900/90 px-4 py-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400 font-mono">
          <div>
            Показано записей: <span className="text-cyan-400 font-bold">{filteredLogs.length}</span> из {logs.length}
          </div>
          <div>ESP32-S3 Flash: /boot.log (Rotation: 128KB)</div>
        </div>
      </div>
    </div>
  );
};
