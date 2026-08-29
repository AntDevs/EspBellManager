import { EspBellConfig, AudioTrackInfo, SystemStatus, LogEntry } from '../types';

export interface ApiResponse<T> {
  success: boolean;
  status: number;
  data?: T;
  error?: string;
  latencyMs: number;
  url: string;
  method: string;
}

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
  private baseUrl = '';

  private async request<T>(
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
    headers: Record<string, string> = {}
  ): Promise<ApiResponse<T>> {
    const startTime = performance.now();
    const url = `${this.baseUrl}${path}`;
    
    try {
      const fetchOptions: RequestInit = {
        method,
        headers: {
          ...headers
        }
      };

      if (body !== undefined) {
        if (body instanceof Blob || body instanceof ArrayBuffer) {
          fetchOptions.body = body;
          if (!headers['Content-Type']) {
            fetchOptions.headers = {
              ...fetchOptions.headers,
              'Content-Type': 'application/octet-stream'
            };
          }
        } else if (typeof body === 'object') {
          fetchOptions.body = JSON.stringify(body);
          fetchOptions.headers = {
            ...fetchOptions.headers,
            'Content-Type': 'application/json'
          };
        }
      }

      const res = await fetch(url, fetchOptions);
      const latencyMs = Math.round(performance.now() - startTime);

      let data: T | undefined = undefined;
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        data = await res.json();
      }

      if (!res.ok) {
        return {
          success: false,
          status: res.status,
          error: `HTTP ${res.status}: ${res.statusText}`,
          data,
          latencyMs,
          url,
          method
        };
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
      const errorMessage = err instanceof Error ? err.message : 'Сетевая ошибка';
      return {
        success: false,
        status: 0,
        error: errorMessage,
        latencyMs,
        url,
        method
      };
    }
  }

  // 1. Health check
  async checkHealth() {
    return this.request<{ status: string; server: string; timestamp: string }>('GET', '/api/health');
  }

  // 2. Info / Telemetry
  async getSystemInfo() {
    return this.request<{
      status: string;
      device: string;
      firmware: string;
      runtime: string;
      uptime_sec: number;
      heap: { free_bytes: number; total_bytes: number };
      psram: { free_bytes: number; total_bytes: number };
      cpu_freq_mhz: number;
      core_temp_c: number;
      power: { relay_latch_gpio4: boolean; smart_timeout_sec: number; remaining_sec: number };
      led: { gpio: number; state: string; color: string };
      wifi: { mode: string; ssid: string; ip: string; rssi: number };
      audio: { is_playing: boolean; active_file: string; track_title: string; sample_rate: number; gain: number; duration_sec: number };
    }>('GET', '/api/info');
  }

  // 3. Cryptographic Nonce
  async getNonce() {
    return this.request<{ nonce: string; ttl_sec: number }>('GET', '/api/get-nonce');
  }

  // 4. Verify Auth
  async verifyAuth(hash: string, nonce: string) {
    return this.request<{ status: string; token: string; role: string }>('POST', '/api/verify-auth', { hash, nonce });
  }

  // 5. Config read
  async getConfig() {
    return this.request<EspBellConfig>('GET', '/api/config');
  }

  // 6. Config save
  async saveConfig(config: Partial<EspBellConfig>) {
    return this.request<{ status: string; message: string; config: EspBellConfig }>('POST', '/api/config', config);
  }

  // 7. Upload WAV file
  async uploadWav(wavBlob: Blob, filename = 'bell.wav', title = 'Пользовательская мелодия') {
    const params = new URLSearchParams({ filename, title });
    return this.request<{ status: string; message: string; track: AudioTrackInfo }>(
      'POST',
      `/upload?${params.toString()}`,
      wavBlob,
      { 'Content-Type': 'audio/wav' }
    );
  }

  // 8. Play sound
  async playSound() {
    return this.request<{ status: string; track: string; gain: number }>('POST', '/api/play');
  }

  // 9. Stop sound
  async stopSound() {
    return this.request<{ status: string }>('POST', '/api/stop');
  }

  // 10. Physical Bell Trigger
  async triggerBell() {
    return this.request<{ status: string; relay: string; track: string; duration_sec: number }>('POST', '/api/trigger-bell');
  }

  // 11. Logs read
  async getLogs() {
    return this.request<{ status: string; count: number; logs: LogEntry[] }>('GET', '/api/logs');
  }

  // 12. Logs clear
  async clearLogs() {
    return this.request<{ status: string; message: string }>('POST', '/api/logs/clear');
  }

  // 13. Logout
  async logout() {
    return this.request<{ status: string; message: string }>('GET', '/api/logout');
  }
}

export const apiClient = new EspBellApiClient();
