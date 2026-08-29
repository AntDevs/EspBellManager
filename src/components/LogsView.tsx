import React, { useEffect, useRef } from 'react';
import { LogEntry, SystemStatus } from '../types';
import { loadHtmlTemplate, bindTemplate } from '../utils/templateBinder';

interface LogsViewProps {
  logs: LogEntry[];
  systemStatus: SystemStatus;
  onClearLogs: () => void;
  onRefreshLogs: () => void;
}

/**
 * LogsView Controller (Option 2: Pure HTML Template + Data Binding)
 * Zero JSX markup: The DOM structure is loaded dynamically from /public/templates/logs.html
 */
export const LogsView: React.FC<LogsViewProps> = ({
  logs,
  onClearLogs,
  onRefreshLogs,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const binderRef = useRef<{ update: (data: any) => void; destroy: () => void } | null>(null);

  const renderLogs = (logList: LogEntry[]) => {
    const logsBox = containerRef.current?.querySelector('#tpl-logs-container');
    if (!logsBox) return;

    if (logList.length === 0) {
      logsBox.innerHTML = '<div class="text-slate-500 text-center py-4">Логи пусты</div>';
      return;
    }

    logsBox.innerHTML = logList
      .map((entry) => {
        let badgeColor = 'text-cyan-400 bg-cyan-950/60 border-cyan-800';
        if (entry.level === 'HARDWARE') badgeColor = 'text-emerald-400 bg-emerald-950/60 border-emerald-800';
        if (entry.level === 'WARNING') badgeColor = 'text-amber-400 bg-amber-950/60 border-amber-800';
        if (entry.level === 'ERROR') badgeColor = 'text-rose-400 bg-rose-950/60 border-rose-800';

        return `
          <div class="flex items-start gap-2 py-0.5 hover:bg-slate-900/60 px-1 rounded transition-colors">
            <span class="text-slate-600 text-[11px] font-mono select-none">${entry.timestamp}</span>
            <span class="text-[10px] uppercase font-bold px-1.5 py-0.2 rounded border font-mono ${badgeColor}">${entry.level}</span>
            <span class="text-cyan-400/80 font-bold text-[11px]">[${entry.tag}]</span>
            <span class="text-slate-300 break-all leading-relaxed">${entry.message}</span>
          </div>
        `;
      })
      .join('');

    logsBox.scrollTop = logsBox.scrollHeight;
  };

  useEffect(() => {
    let isMounted = true;

    async function mount() {
      if (!containerRef.current) return;

      try {
        const html = await loadHtmlTemplate('logs');
        if (!isMounted || !containerRef.current) return;

        if (binderRef.current) {
          binderRef.current.destroy();
        }

        const binder = bindTemplate(containerRef.current, html, {
          data: {},
          actions: {
            refreshLogs: () => {
              onRefreshLogs();
            },
            clearLogs: () => {
              onClearLogs();
            },
          },
        });

        binderRef.current = binder;
        renderLogs(logs);
      } catch (err) {
        console.error('Failed to load /templates/logs.html:', err);
      }
    }

    mount();

    return () => {
      isMounted = false;
      if (binderRef.current) {
        binderRef.current.destroy();
      }
    };
  }, []);

  useEffect(() => {
    renderLogs(logs);
  }, [logs]);

  return <div ref={containerRef} id="logs-view-container" className="w-full" />;
};
