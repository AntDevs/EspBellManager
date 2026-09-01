import { EspBellConfig, AudioTrackInfo, SystemStatus, LogEntry } from '../types';

export interface ApiResult<T = unknown> {
  success: boolean;
  status: number;
  data?: T;
  error?: string;
  latencyMs: number;
  url: string;
  method: string;
}

export type ApiResponse<T> = ApiResult<T>;

export interface ApiEndpointSpec {
  method: 'GET' | 'POST';
  path: string;
  title: string;
  description: string;
  authRequired: boolean;
  sampleBody?: Record<string, unknown>;
}

export const API_ENDPOINTS: ApiEndpointSpec[] = [
  {
    method: 'GET',
    path: '/api/info',
    title: 'Статус устройства и телеметрия',
    description: 'Возвращает текущие параметры ESP32, использование памяти Heap/PSRAM, Wi-Fi и статус I2S ЦАП',
    authRequired: false
  },
  {
    method: 'GET',
    path: '/api/get-nonce',
    title: 'Запрос одноразового токена (Nonce)',
    description: 'Генерирует случайный 8-байтный hex nonce со сроком жизни 30 секунд для безопасного входа',
    authRequired: false
  },
  {
    method: 'POST',
    path: '/api/verify-auth',
    title: 'Проверка подлинности SHA-256',
    description: 'Проверяет хэш SHA-256(password + nonce) без передачи пароля в открытом виде',
    authRequired: false,
    sampleBody: { nonce: 'a7b3c9f2104e8d6a', hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' }
  },
  {
    method: 'GET',
    path: '/api/config',
    title: 'Чтение конфигурации /config.json',
    description: 'Возвращает все сохраненные параметры: выводы I2S, Wi-Fi, таймаут самоблокировки и громкость',
    authRequired: true
  },
  {
    method: 'POST',
    path: '/api/config',
    title: 'Сохранение настроек в Flash',
    description: 'Записывает обновленные параметры конфигурации в Flash память ESP32-S3',
    authRequired: true,
    sampleBody: { gain_scale: 1.2, smart_timeout_sec: 180, boot_mode: 'music_first' }
  },
  {
    method: 'POST',
    path: '/upload',
    title: 'Загрузка WAV мелодии',
    description: 'Принимает бинарный 16-bit PCM WAV и сохраняет в Flash как /media/bell.wav',
    authRequired: true
  },
  {
    method: 'POST',
    path: '/api/play',
    title: 'Запуск I2S воспроизведения',
    description: 'Инициализирует передачу DMA буферов аудиопотока в ЦАП PCM5102A',
    authRequired: true
  },
  {
    method: 'POST',
    path: '/api/stop',
    title: 'Остановка воспроизведения',
    description: 'Прерывает трансляцию звука и освобождает шину I2S',
    authRequired: true
  },
  {
    method: 'POST',
    path: '/api/trigger-bell',
    title: 'Триггер кнопки дверного звонка',
    description: 'Имитирует нажатие физической кнопки, активирует реле питания GPIO4 и запускает звук',
    authRequired: false
  },
  {
    method: 'GET',
    path: '/api/logs',
    title: 'Чтение журнала /boot.log',
    description: 'Возвращает системные логи загрузки, сетевых соединений и аппаратных прерываний',
    authRequired: false
  },
  {
    method: 'POST',
    path: '/api/logs/clear',
    title: 'Очистка журнала логов',
    description: 'Сбрасывает буфер логов в оперативной памяти',
    authRequired: true
  },
  {
    method: 'GET',
    path: '/api/logout',
    title: 'Выход администратора',
    description: 'Аннулирует текущую сессию доступа',
    authRequired: false
  }
];

class EspBellApiClient {
  private baseUrl = 'https://bell555.local';
  private authToken: string | null = null;
  private onAuthChangeCallbacks: Array<(isAuthenticated: boolean) => void> = [];

  constructor() {
    try {
      const savedConfig = localStorage.getItem('espbell_config');
      if (savedConfig) {
        const parsed = JSON.parse(savedConfig);
        if (parsed.target_esp_url) {
          this.setBaseUrl(parsed.target_esp_url);
        }
      }
    } catch {}

    try {
      const savedToken = localStorage.getItem('espbell_auth_token');
      if (savedToken) {
        this.authToken = savedToken;
      }
    } catch {}
  }

  public setBaseUrl(url: string) {
    let cleanUrl = (url || '').trim();
    cleanUrl = cleanUrl.replace(/\/+$/, '');
    if (cleanUrl && !cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = `https://${cleanUrl}`;
    }
    this.baseUrl = cleanUrl;
  }

  public getBaseUrl(): string {
    return this.baseUrl || 'https://bell555.local';
  }

  public setAuthToken(token: string | null) {
    this.authToken = token;
    try {
      if (token) {
        localStorage.setItem('espbell_auth_token', token);
      } else {
        localStorage.removeItem('espbell_auth_token');
      }
    } catch {}
    this.notifyAuthChange();
  }

  public getAuthToken(): string | null {
    return this.authToken;
  }

  public isAuthenticated(): boolean {
    return !!this.authToken;
  }

  public onAuthChange(cb: (isAuthenticated: boolean) => void): () => void {
    this.onAuthChangeCallbacks.push(cb);
    return () => {
      this.onAuthChangeCallbacks = this.onAuthChangeCallbacks.filter((c) => c !== cb);
    };
  }

  private notifyAuthChange() {
    const authed = this.isAuthenticated();
    this.onAuthChangeCallbacks.forEach((cb) => {
      try {
        cb(authed);
      } catch (err) {
        console.error('Auth change callback error:', err);
      }
    });
  }

  public async request<T>(
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
    headers: Record<string, string> = {}
  ): Promise<ApiResult<T>> {
    const startTime = performance.now();
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    const targetBase = this.baseUrl || '';
    const url = `${targetBase}${cleanPath}`;
    
    try {
      const requestHeaders: Record<string, string> = {
        ...headers
      };

      // Automatically attach Auth token to ALL requests if available
      if (this.authToken && !requestHeaders['X-Auth-Token'] && !requestHeaders['Authorization']) {
        requestHeaders['X-Auth-Token'] = this.authToken;
        requestHeaders['Authorization'] = `Bearer ${this.authToken}`;
      }

      const fetchOptions: RequestInit = {
        method,
        headers: requestHeaders
      };

      if (body !== undefined) {
        if (body instanceof Blob || body instanceof ArrayBuffer) {
          fetchOptions.body = body;
          if (!requestHeaders['Content-Type']) {
            requestHeaders['Content-Type'] = 'application/octet-stream';
          }
        } else if (typeof body === 'object') {
          fetchOptions.body = JSON.stringify(body);
          if (!requestHeaders['Content-Type']) {
            requestHeaders['Content-Type'] = 'application/json';
          }
        }
      }

      const res = await fetch(url, fetchOptions);
      const latencyMs = Math.round(performance.now() - startTime);

      let data: T | undefined = undefined;
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        try {
          data = await res.json();
        } catch {}
      } else {
        try {
          const text = await res.text();
          data = text as unknown as T;
        } catch {}
      }

      if (!res.ok) {
        // If 401 Unauthorized, automatically clear stale token
        if (res.status === 401 && this.authToken) {
          console.warn('[EspBellApiClient] Server returned 401 Unauthorized. Clearing local token.');
          this.setAuthToken(null);
        }

        let errorText = `HTTP ${res.status}: ${res.statusText || 'Запрос отклонен контроллером (Unauthorized / Ошибка)'}`;
        if (data && typeof data === 'object' && 'error' in data) {
          errorText = `HTTP ${res.status}: ${(data as any).error}`;
        } else if (typeof data === 'string' && data.length > 0 && data.length < 200) {
          errorText = `HTTP ${res.status}: ${data}`;
        }

        const errResult = {
          success: false,
          status: res.status,
          error: errorText,
          data,
          latencyMs,
          url,
          method
        };
        console.error(`[EspBellApiClient] API Error [${method} ${url}]:`, errResult);
        return errResult;
      }

      return {
        success: true,
        status: res.status,
        data,
        latencyMs,
        url,
        method
      };
    } catch (err: unknown) {
      const latencyMs = Math.round(performance.now() - startTime);
      let errorMessage = err instanceof Error ? err.message : 'Сетевая ошибка';

      if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
        errorMessage += ' (Возможно, браузер блокирует самоподписанный HTTPS сертификат ESP32. Откройте адрес устройства в новой вкладке и разрешите небезопасное подключение, либо используйте HTTP вместо HTTPS).';
      }

      const errResult = {
        success: false,
        status: 0,
        error: `Ошибка сети при запросе к ${url}: ${errorMessage}`,
        latencyMs,
        url,
        method
      };
      console.error(`[EspBellApiClient] Network/Parse Error [${method} ${url}]:`, err, errResult);
      return errResult;
    }
  }

  // 1. Health check
  async checkHealth(): Promise<ApiResult<{ status: string; server: string; timestamp: string }>> {
    try {
      return await this.request<{ status: string; server: string; timestamp: string }>('GET', '/api/health');
    } catch (err: unknown) {
      return {
        success: false,
        status: 0,
        error: err instanceof Error ? err.message : 'Ошибка проверки работоспособности (Health check)',
        latencyMs: 0,
        url: `${this.baseUrl}/api/health`,
        method: 'GET'
      };
    }
  }

  // 2. Info / Telemetry
  async getSystemInfo(): Promise<ApiResult<SystemStatus>> {
    try {
      return await this.request<SystemStatus>('GET', '/api/info');
    } catch (err: unknown) {
      return {
        success: false,
        status: 0,
        error: err instanceof Error ? err.message : 'Не удалось получить системную телеметрию ESP32',
        latencyMs: 0,
        url: `${this.baseUrl}/api/info`,
        method: 'GET'
      };
    }
  }

  // Alias for getSystemInfo
  async getInfo(): Promise<ApiResult<SystemStatus>> {
    return this.getSystemInfo();
  }

  // 3. Cryptographic Nonce
  async getNonce(): Promise<ApiResult<{ nonce: string; ttl_sec: number }>> {
    try {
      return await this.request<{ nonce: string; ttl_sec: number }>('GET', '/api/get-nonce');
    } catch (err: unknown) {
      return {
        success: false,
        status: 0,
        error: err instanceof Error ? err.message : 'Не удалось запросить одноразовый Nonce от контроллера',
        latencyMs: 0,
        url: `${this.baseUrl}/api/get-nonce`,
        method: 'GET'
      };
    }
  }

  // 4. Verify Auth (SHA-256 Challenge Response Login)
  async verifyAuth(hash: string, nonce: string): Promise<ApiResult<{ status: string; token: string; role: string }>> {
    try {
      const res = await this.request<{ status: string; token: string; role: string }>('POST', '/api/verify-auth', { hash, nonce });
      if (res.success && res.data?.token) {
        // Automatically store the session token in apiClient
        this.setAuthToken(res.data.token);
      }
      return res;
    } catch (err: unknown) {
      return {
        success: false,
        status: 0,
        error: err instanceof Error ? err.message : 'Ошибка аутентификации администратора',
        latencyMs: 0,
        url: `${this.baseUrl}/api/verify-auth`,
        method: 'POST'
      };
    }
  }

  // 5. Config read
  async getConfig(): Promise<ApiResult<EspBellConfig>> {
    try {
      return await this.request<EspBellConfig>('GET', '/api/config');
    } catch (err: unknown) {
      return {
        success: false,
        status: 0,
        error: err instanceof Error ? err.message : 'Не удалось прочитать /config.json с ESP32',
        latencyMs: 0,
        url: `${this.baseUrl}/api/config`,
        method: 'GET'
      };
    }
  }

  // 6. Config save
  async saveConfig(config: Partial<EspBellConfig>): Promise<ApiResult<{ status: string; message: string; config: EspBellConfig }>> {
    try {
      return await this.request<{ status: string; message: string; config: EspBellConfig }>('POST', '/api/config', config);
    } catch (err: unknown) {
      return {
        success: false,
        status: 0,
        error: err instanceof Error ? err.message : 'Не удалось сохранить конфигурацию во Flash ESP32',
        latencyMs: 0,
        url: `${this.baseUrl}/api/config`,
        method: 'POST'
      };
    }
  }

  // 7. Upload WAV file to ESP32 /upload stream
  async uploadWav(
    wavBlob: Blob, 
    filename = 'bell.wav', 
    title = 'Пользовательская мелодия',
    authHeaders?: { token?: string; hash?: string; nonce?: string },
    onProgress?: (percent: number) => void
  ): Promise<ApiResult<{ status: string; bytes?: number; message?: string }>> {
    try {
      const startTime = performance.now();
      const targetUrl = `${this.baseUrl}/upload`;
      const token = this.authToken || authHeaders?.token || authHeaders?.hash;
      const hash = authHeaders?.hash || token;
      const nonce = authHeaders?.nonce;

      return await new Promise((resolve) => {
        try {
          const xhr = new XMLHttpRequest();
          xhr.open('POST', targetUrl, true);

          if (token) {
            xhr.setRequestHeader('X-Auth-Token', token);
            xhr.setRequestHeader('Authorization', `Bearer ${token}`);
          }
          if (nonce) {
            xhr.setRequestHeader('X-Auth-Nonce', nonce);
          }
          if (hash) {
            xhr.setRequestHeader('X-Auth-Hash', hash);
          }
          xhr.setRequestHeader('X-File-Name', filename);

          if (xhr.upload && onProgress) {
            xhr.upload.onprogress = (e) => {
              if (e.lengthComputable) {
                const percent = Math.round((e.loaded / e.total) * 100);
                onProgress(percent);
              }
            };
          }

          xhr.onload = () => {
            const latencyMs = Math.round(performance.now() - startTime);
            if (xhr.status >= 200 && xhr.status < 300) {
              let data = { status: 'saved', bytes: wavBlob.size, message: xhr.responseText };
              try {
                data = JSON.parse(xhr.responseText);
              } catch {}
              resolve({
                success: true,
                status: xhr.status,
                data,
                latencyMs,
                url: targetUrl,
                method: 'POST'
              });
            } else {
              if (xhr.status === 401) {
                this.setAuthToken(null);
              }
              const errResult = {
                success: false,
                status: xhr.status,
                error: xhr.responseText || `HTTP ${xhr.status} (ESP32 вернул ошибку: Unauthorized/Доступ запрещен)`,
                latencyMs,
                url: targetUrl,
                method: 'POST'
              };
              console.error(`[EspBellApiClient] Upload Error [POST ${targetUrl}]:`, errResult);
              resolve(errResult);
            }
          };

          xhr.onerror = () => {
            const latencyMs = Math.round(performance.now() - startTime);
            const errResult = {
              success: false,
              status: 0,
              error: `Сетевой сбой при передаче в ${targetUrl}: соединение сброшено или заблокировано CORS. (Возможно, не принят самоподписанный HTTPS сертификат. Перейдите по адресу устройства в новой вкладке и разрешите подключение, либо используйте HTTP).`,
              latencyMs,
              url: targetUrl,
              method: 'POST'
            };
            console.error(`[EspBellApiClient] Upload Network Error [POST ${targetUrl}]:`, errResult);
            resolve(errResult);
          };

          xhr.send(wavBlob);
        } catch (xhrErr: unknown) {
          const latencyMs = Math.round(performance.now() - startTime);
          const errResult = {
            success: false,
            status: 0,
            error: xhrErr instanceof Error ? xhrErr.message : 'Исключение при отправке XMLHttpRequest',
            latencyMs,
            url: targetUrl,
            method: 'POST'
          };
          console.error(`[EspBellApiClient] Upload Exception [POST ${targetUrl}]:`, xhrErr, errResult);
          resolve(errResult);
        }
      });
    } catch (err: unknown) {
      const errResult = {
        success: false,
        status: 0,
        error: err instanceof Error ? err.message : 'Сбой при подготовке загрузки файла на ESP32',
        latencyMs: 0,
        url: `${this.baseUrl}/upload`,
        method: 'POST'
      };
      console.error(`[EspBellApiClient] Upload Preparation Error [POST ${this.baseUrl}/upload]:`, err, errResult);
      return errResult;
    }
  }

  // 8. Play sound
  async playSound(): Promise<ApiResult<{ status: string; track: string; gain: number }>> {
    try {
      return await this.request<{ status: string; track: string; gain: number }>('POST', '/api/play');
    } catch (err: unknown) {
      return {
        success: false,
        status: 0,
        error: err instanceof Error ? err.message : 'Не удалось запустить воспроизведение на ESP32',
        latencyMs: 0,
        url: `${this.baseUrl}/api/play`,
        method: 'POST'
      };
    }
  }

  // 9. Stop sound
  async stopSound(): Promise<ApiResult<{ status: string }>> {
    try {
      return await this.request<{ status: string }>('POST', '/api/stop');
    } catch (err: unknown) {
      return {
        success: false,
        status: 0,
        error: err instanceof Error ? err.message : 'Не удалось остановить звук на ESP32',
        latencyMs: 0,
        url: `${this.baseUrl}/api/stop`,
        method: 'POST'
      };
    }
  }

  // 10. Physical Bell Trigger
  async triggerBell(): Promise<ApiResult<{ status: string; relay: string; track: string; duration_sec: number }>> {
    try {
      return await this.request<{ status: string; relay: string; track: string; duration_sec: number }>('POST', '/api/trigger-bell');
    } catch (err: unknown) {
      return {
        success: false,
        status: 0,
        error: err instanceof Error ? err.message : 'Не удалось активировать звонок (GPIO4 / I2S)',
        latencyMs: 0,
        url: `${this.baseUrl}/api/trigger-bell`,
        method: 'POST'
      };
    }
  }

  // 11. Logs read (Parses plain text to LogEntry array)
  async getLogs(): Promise<ApiResult<{ status: string; count: number; logs: LogEntry[] }>> {
    try {
      const res = await this.request<string>('GET', '/api/logs');
      if (!res.success) {
        return res as any; // pass through the error
      }
      
      const text = res.data || '';
      const lines = text.split('\n').filter(l => l.trim().length > 0);
      const parsedLogs: LogEntry[] = lines.map((line, idx) => {
        // Expected format: [TIMESTAMP] [LEVEL] [TAG] Message...
        const match = line.match(/^\[(.*?)\]\s+\[(.*?)\]\s+\[(.*?)\]\s+(.*)$/);
        if (match) {
          return {
            id: `log-${idx}`,
            timestamp: match[1],
            level: match[2] as any,
            tag: match[3],
            message: match[4]
          };
        }
        // Fallback for lines that don't match the format
        return {
          id: `log-${idx}`,
          timestamp: '',
          level: 'INFO',
          tag: 'SYS',
          message: line
        };
      });

      return {
        success: true,
        status: res.status,
        data: { status: 'ok', count: parsedLogs.length, logs: parsedLogs },
        latencyMs: res.latencyMs,
        url: res.url,
        method: res.method
      };
    } catch (err: unknown) {
      return {
        success: false,
        status: 0,
        error: err instanceof Error ? err.message : 'Не удалось получить журнал /boot.log с ESP32',
        latencyMs: 0,
        url: `${this.baseUrl}/api/logs`,
        method: 'GET'
      };
    }
  }

  // 13. Logout
  async logout(): Promise<ApiResult<{ status: string; message: string }>> {
    try {
      const res = await this.request<{ status: string; message: string }>('POST', '/api/logout');
      this.setAuthToken(null);
      return res;
    } catch (err: unknown) {
      this.setAuthToken(null);
      return {
        success: false,
        status: 0,
        error: err instanceof Error ? err.message : 'Ошибка при выполнении выхода',
        latencyMs: 0,
        url: `${this.baseUrl}/api/logout`,
        method: 'POST'
      };
    }
  }
}

export const apiClient = new EspBellApiClient();
