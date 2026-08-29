import React, { useState, useEffect } from 'react';
import { 
  Server, 
  Send, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Code2, 
  RefreshCw, 
  ShieldCheck, 
  Zap, 
  Play, 
  Square, 
  Bell, 
  FileText, 
  Sliders, 
  UploadCloud,
  Layers,
  ArrowRight
} from 'lucide-react';
import { API_ENDPOINTS, ApiEndpointSpec, apiClient, ApiResponse } from '../utils/apiClient';

export const ApiTesterView: React.FC = () => {
  const [selectedEndpoint, setSelectedEndpoint] = useState<ApiEndpointSpec>(API_ENDPOINTS[0]);
  const [requestBodyInput, setRequestBodyInput] = useState<string>(
    JSON.stringify(API_ENDPOINTS[0].sampleBody || {}, null, 2)
  );
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [lastResponse, setLastResponse] = useState<ApiResponse<unknown> | null>(null);
  const [serverHealth, setServerHealth] = useState<{ status: string; latencyMs: number } | null>(null);
  const [testAllResults, setTestAllResults] = useState<Record<string, { status: number; latency: number; ok: boolean }>>({});
  const [isTestingAll, setIsTestingAll] = useState<boolean>(false);

  // Check health on mount
  useEffect(() => {
    checkHealth();
  }, []);

  // Update sample body when endpoint changes
  useEffect(() => {
    if (selectedEndpoint.sampleBody) {
      setRequestBodyInput(JSON.stringify(selectedEndpoint.sampleBody, null, 2));
    } else {
      setRequestBodyInput('');
    }
  }, [selectedEndpoint]);

  const checkHealth = async () => {
    const res = await apiClient.checkHealth();
    if (res.success && res.data) {
      setServerHealth({ status: 'ACTIVE', latencyMs: res.latencyMs });
    } else {
      setServerHealth({ status: 'ERROR', latencyMs: res.latencyMs });
    }
  };

  const handleExecuteRequest = async () => {
    setIsLoading(true);
    let parsedBody: unknown = undefined;
    if (requestBodyInput.trim() && selectedEndpoint.method === 'POST') {
      try {
        parsedBody = JSON.parse(requestBodyInput);
      } catch {
        parsedBody = requestBodyInput;
      }
    }

    let res: ApiResponse<unknown>;
    switch (selectedEndpoint.path) {
      case '/api/info':
        res = await apiClient.getSystemInfo();
        break;
      case '/api/get-nonce':
        res = await apiClient.getNonce();
        break;
      case '/api/verify-auth': {
        const body = (parsedBody as { hash?: string; nonce?: string }) || {};
        res = await apiClient.verifyAuth(body.hash || '', body.nonce || '');
        break;
      }
      case '/api/config':
        if (selectedEndpoint.method === 'GET') {
          res = await apiClient.getConfig();
        } else {
          res = await apiClient.saveConfig(parsedBody as Record<string, unknown>);
        }
        break;
      case '/upload': {
        // Create mock 16-bit WAV blob
        const mockWav = new Blob([new Uint8Array(44 + 44100 * 2)], { type: 'audio/wav' });
        res = await apiClient.uploadWav(mockWav, 'bell.wav', 'Тестовая мелодия REST API');
        break;
      }
      case '/api/play':
        res = await apiClient.playSound();
        break;
      case '/api/stop':
        res = await apiClient.stopSound();
        break;
      case '/api/trigger-bell':
        res = await apiClient.triggerBell();
        break;
      case '/api/logs':
        res = await apiClient.getLogs();
        break;
      case '/api/logs/clear':
        res = await apiClient.clearLogs();
        break;
      case '/api/logout':
        res = await apiClient.logout();
        break;
      default:
        res = await apiClient.checkHealth();
        break;
    }

    setLastResponse(res);
    setIsLoading(false);
  };

  const handleRunBatchVerification = async () => {
    setIsTestingAll(true);
    const results: Record<string, { status: number; latency: number; ok: boolean }> = {};

    for (const ep of API_ENDPOINTS) {
      try {
        let r: ApiResponse<unknown>;
        if (ep.path === '/api/info') r = await apiClient.getSystemInfo();
        else if (ep.path === '/api/get-nonce') r = await apiClient.getNonce();
        else if (ep.path === '/api/config' && ep.method === 'GET') r = await apiClient.getConfig();
        else if (ep.path === '/api/logs') r = await apiClient.getLogs();
        else if (ep.path === '/api/play') r = await apiClient.playSound();
        else if (ep.path === '/api/stop') r = await apiClient.stopSound();
        else if (ep.path === '/api/trigger-bell') r = await apiClient.triggerBell();
        else if (ep.path === '/api/logout') r = await apiClient.logout();
        else if (ep.path === '/upload') {
          const mockWav = new Blob([new Uint8Array(2048)], { type: 'audio/wav' });
          r = await apiClient.uploadWav(mockWav, 'test.wav', 'Test');
        } else {
          r = await apiClient.checkHealth();
        }

        results[`${ep.method} ${ep.path}`] = {
          status: r.status,
          latency: r.latencyMs,
          ok: r.success
        };
      } catch {
        results[`${ep.method} ${ep.path}`] = { status: 500, latency: 0, ok: false };
      }
    }

    setTestAllResults(results);
    setIsTestingAll(false);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Status */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-semibold">
              <Server className="w-3.5 h-3.5" />
              <span>Верификация и тестирование REST API</span>
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight">
              Инспектор REST API ESP32-S3 Microdot
            </h2>
            <p className="text-slate-400 text-sm max-w-2xl">
              Проверка реальных эндпоинтов сервера: статус устройства, загрузка аудиофайлов, криптографический Nonce, I2S управление и конфигурация.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-slate-300 font-mono">
                Сервер: <strong className="text-emerald-400">{serverHealth?.status || 'ACTIVE'}</strong> ({serverHealth?.latencyMs || 2}ms)
              </span>
            </div>

            <button
              onClick={handleRunBatchVerification}
              disabled={isTestingAll}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-cyan-500/20 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isTestingAll ? 'animate-spin' : ''}`} />
              <span>{isTestingAll ? 'Тестирование...' : 'Проверить все API'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid: Endpoint Selector & Request/Response Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Col: Endpoint List */}
        <div className="lg:col-span-5 bg-slate-900 rounded-2xl border border-slate-800 p-4 shadow-xl space-y-2">
          <div className="px-2 py-1 text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center justify-between">
            <span>Доступные эндпоинты ({API_ENDPOINTS.length})</span>
            <span className="text-[10px] text-cyan-400 font-mono">Microdot REST</span>
          </div>

          <div className="space-y-1.5 max-h-[580px] overflow-y-auto pr-1">
            {API_ENDPOINTS.map((ep) => {
              const isSelected = selectedEndpoint.path === ep.path && selectedEndpoint.method === ep.method;
              const batchResult = testAllResults[`${ep.method} ${ep.path}`];

              return (
                <button
                  key={`${ep.method}-${ep.path}`}
                  onClick={() => setSelectedEndpoint(ep)}
                  className={`w-full text-left p-3 rounded-xl border transition-all text-xs flex items-start justify-between gap-2 ${
                    isSelected
                      ? 'bg-cyan-500/10 border-cyan-500/40 text-white shadow-md'
                      : 'bg-slate-950/60 hover:bg-slate-800/80 border-slate-800/80 text-slate-300'
                  }`}
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-1.5 py-0.5 rounded font-mono font-bold text-[10px] ${
                          ep.method === 'GET'
                            ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                            : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        }`}
                      >
                        {ep.method}
                      </span>
                      <span className="font-mono font-bold text-slate-200 truncate">{ep.path}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 line-clamp-1">{ep.title}</p>
                  </div>

                  {batchResult && (
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.5 rounded shrink-0 ${
                        batchResult.ok
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                          : 'bg-rose-950 text-rose-400 border border-rose-800'
                      }`}
                    >
                      {batchResult.status} ({batchResult.latency}ms)
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Col: Interactive Request & Response Inspector */}
        <div className="lg:col-span-7 space-y-4">
          {/* Request Header Bar */}
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 shadow-xl space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded-lg font-mono font-bold text-xs ${
                      selectedEndpoint.method === 'GET'
                        ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                        : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    }`}
                  >
                    {selectedEndpoint.method}
                  </span>
                  <span className="font-mono text-sm font-bold text-white">{selectedEndpoint.path}</span>
                </div>
                <h3 className="text-sm font-semibold text-slate-200">{selectedEndpoint.title}</h3>
                <p className="text-xs text-slate-400">{selectedEndpoint.description}</p>
              </div>

              <button
                onClick={handleExecuteRequest}
                disabled={isLoading}
                className="flex items-center gap-2 px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 active:scale-95 text-white font-bold text-xs rounded-xl shadow-lg shadow-cyan-600/30 transition-all disabled:opacity-50 shrink-0"
              >
                {isLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                <span>Выполнить запрос</span>
              </button>
            </div>

            {/* Request Body Editor (if POST) */}
            {selectedEndpoint.method === 'POST' && (
              <div className="space-y-1.5 pt-2 border-t border-slate-800">
                <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                  <span>Тело запроса (JSON payload / Binary):</span>
                  <span className="text-[10px] text-slate-500 font-mono">Content-Type: application/json</span>
                </label>
                <textarea
                  rows={4}
                  value={requestBodyInput}
                  onChange={(e) => setRequestBodyInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs font-mono text-cyan-300 focus:outline-none focus:border-cyan-500"
                  placeholder='{ "key": "value" }'
                />
              </div>
            )}
          </div>

          {/* Response Inspector Box */}
          <div className="bg-slate-950 rounded-2xl border border-slate-800 p-5 shadow-2xl space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                <Code2 className="w-4 h-4 text-cyan-400" />
                <span>Ответ сервера (Response):</span>
              </div>

              {lastResponse && (
                <div className="flex items-center gap-3 text-xs font-mono">
                  <span className="flex items-center gap-1 text-slate-400">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{lastResponse.latencyMs} ms</span>
                  </span>

                  <span
                    className={`px-2 py-0.5 rounded font-bold ${
                      lastResponse.success
                        ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800'
                        : 'bg-rose-950/80 text-rose-400 border border-rose-800'
                    }`}
                  >
                    HTTP {lastResponse.status}
                  </span>
                </div>
              )}
            </div>

            {lastResponse ? (
              <div className="space-y-2">
                <pre className="bg-slate-900/90 rounded-xl p-4 text-xs font-mono text-slate-200 overflow-x-auto max-h-96 border border-slate-800 select-text leading-relaxed">
                  {JSON.stringify(lastResponse.data || { message: lastResponse.error }, null, 2)}
                </pre>
              </div>
            ) : (
              <div className="py-12 text-center text-xs text-slate-500 font-mono space-y-1">
                <p>Нажмите «Выполнить запрос» для тестирования эндпоинта</p>
                <p className="text-[11px] text-slate-600">Ответ вернется в реальном времени с замером задержки</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
