export interface EspBellConfig {
  boot_mode: string;
  smart_timeout_sec: number;
  auth_smart_timeout_sec: number;
  repeat_count: number;
  max_play_duration_sec: number;
  fade_out_ms: number;
  resume_playback: boolean;
  last_play_pos_bytes: number;
  last_play_pos_sec: number;
  wifi_ssid: string;
  wifi_password?: string; // write-only mostly
  upload_password?: string;
  ap_ssid: string;
  ap_password?: string;

  // Custom ESP32 Device URL / Host Link
  target_esp_url: string;
}

export interface SystemStatus {
  availableBytes: number;
  maxFileBytes: number;
  allowedExtensions: string[];
  isPlaying: boolean;
  freeHeap: number;
  device: string;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR' | 'HARDWARE';
  tag: string;
  message: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  nonce: string | null;
  nonceGeneratedAt: number | null;
  adminUsername: string;
  tokenTtlSeconds: number;
}
