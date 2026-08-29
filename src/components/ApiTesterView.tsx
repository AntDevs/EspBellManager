import React, { useEffect, useRef } from 'react';
import { API_ENDPOINTS, apiClient } from '../utils/apiClient';
import { loadHtmlTemplate, bindTemplate } from '../utils/templateBinder';

/**
 * ApiTesterView Controller (Option 2: Pure HTML Template + Data Binding)
 * Zero JSX markup: The DOM structure is loaded dynamically from /public/templates/api.html
 */
export const ApiTesterView: React.FC = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const binderRef = useRef<{ update: (data: any) => void; destroy: () => void } | null>(null);

  const testSingleEndpoint = async (path: string, method: string, statusEl: HTMLElement) => {
    statusEl.textContent = 'Тест...';
    statusEl.className = 'text-xs font-mono text-amber-400';

    try {
      let r;
      if (path === '/api/info') r = await apiClient.getSystemInfo();
      else if (path === '/api/get-nonce') r = await apiClient.getNonce();
      else if (path === '/api/config' && method === 'GET') r = await apiClient.getConfig();
      else if (path === '/api/logs') r = await apiClient.getLogs();
      else if (path === '/api/play') r = await apiClient.playSound();
      else if (path === '/api/stop') r = await apiClient.stopSound();
      else if (path === '/api/trigger-bell') r = await apiClient.triggerBell();
      else if (path === '/api/logout') r = await apiClient.logout();
      else r = await apiClient.checkHealth();

      statusEl.textContent = `HTTP ${r.status} (${r.latencyMs}ms)`;
      statusEl.className = r.success
        ? 'text-xs font-mono text-emerald-400 font-bold'
        : 'text-xs font-mono text-rose-400 font-bold';
    } catch {
      statusEl.textContent = 'ERR';
      statusEl.className = 'text-xs font-mono text-rose-400 font-bold';
    }
  };

  const renderEndpoints = () => {
    const listContainer = containerRef.current?.querySelector('#tpl-api-endpoints-container');
    if (!listContainer) return;

    const currentBase = apiClient.getBaseUrl();

    listContainer.innerHTML = API_ENDPOINTS.map((ep, idx) => {
      const isGet = ep.method === 'GET';
      const badgeClass = isGet
        ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
        : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';

      const fullUrl = `${currentBase}${ep.path}`;

      return `
        <div class="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div class="space-y-1">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${badgeClass}">${ep.method}</span>
              <span class="font-mono text-sm font-bold text-white">${ep.path}</span>
              <span class="text-[11px] font-mono text-cyan-400/80">(${fullUrl})</span>
            </div>
            <p class="text-xs text-slate-400">${ep.title} — ${ep.description}</p>
          </div>
          <div class="flex items-center gap-3 shrink-0">
            <span id="api-status-${idx}" class="text-xs font-mono text-slate-500">Готов к тесту</span>
            <button data-endpoint-idx="${idx}" class="btn-run-endpoint px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-cyan-600 text-slate-200 hover:text-white font-semibold text-xs transition-colors">
              Выполнить
            </button>
          </div>
        </div>
      `;
    }).join('');

    // Attach listeners
    listContainer.querySelectorAll('.btn-run-endpoint').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const idx = parseInt(target.getAttribute('data-endpoint-idx') || '0', 10);
        const ep = API_ENDPOINTS[idx];
        const statusEl = listContainer.querySelector(`#api-status-${idx}`) as HTMLElement;
        if (ep && statusEl) {
          testSingleEndpoint(ep.path, ep.method, statusEl);
        }
      });
    });
  };

  useEffect(() => {
    let isMounted = true;

    async function mount() {
      if (!containerRef.current) return;

      try {
        const html = await loadHtmlTemplate('api');
        if (!isMounted || !containerRef.current) return;

        if (binderRef.current) {
          binderRef.current.destroy();
        }

        const binder = bindTemplate(containerRef.current, html, {
          data: {},
          actions: {
            testAllEndpoints: async () => {
              const listContainer = containerRef.current?.querySelector('#tpl-api-endpoints-container');
              if (!listContainer) return;

              for (let i = 0; i < API_ENDPOINTS.length; i++) {
                const ep = API_ENDPOINTS[i];
                const statusEl = listContainer.querySelector(`#api-status-${i}`) as HTMLElement;
                if (ep && statusEl) {
                  await testSingleEndpoint(ep.path, ep.method, statusEl);
                }
              }
            },
          },
        });

        const baseLabel = containerRef.current.querySelector('#api-inspector-base-url');
        if (baseLabel) {
          baseLabel.textContent = apiClient.getBaseUrl();
        }

        binderRef.current = binder;
        renderEndpoints();
      } catch (err) {
        console.error('Failed to load /templates/api.html:', err);
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

  return <div ref={containerRef} id="api-tester-view-container" className="w-full" />;
};
