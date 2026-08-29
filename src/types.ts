export interface EspBellConfig {
  boot_mode: 'music_first' | 'network_first';
  smart_timeout_sec: number;
  repeat_count: number;
  gain_scale: number;
  fade_ms: number;
  duration_limit_sec: number;
  resume_position_ms: number;
  media_dir: string;
  target_filename: string;
  
  // Hardware pins
  i2s_id: number;
  i2s_bck_pin: number;
  i2s_ws_pin: number;
  i2s_sd_pin: number;
  i2s_sample_rate: number;
  i2s_bits_per_sample: number;
  power_relay_pin: number;
  indicator_led_pin: number;
  
  // Wi-Fi STA
  wifi_sta_enabled: boolean;
  wifi_ssid: string;
  wifi_password: string; // Encrypted or plain
  wifi_static_ip: boolean;
  wifi_ip: string;
  wifi_gateway: string;
  wifi_subnet: string;
  wifi_dns: string;
  
  // Wi-Fi AP fallback
  wifi_ap_ssid: string;
  wifi_ap_password: string;
  wifi_ap_ip: string;
  wifi_ap_channel: number;
  wifi_ap_max_clients: number;
  dns_captive_portal: boolean;
  
  // Web Server & Security
  server_port: number;
  https_enabled: boolean;
  admin_password: string;
  nonce_ttl_sec: number;
  cert_path: string;
  key_path: string;
}

export interface AudioTrackInfo {
  filename: string;
  title: string;
  format: string;
  sizeBytes: number;
  durationSeconds: number;
  sampleRate: number;
  channels: number;
  bitDepth: number;
  audioBuffer?: AudioBuffer | null;
  dataUrl?: string;
  rawWavBlob?: Blob | null;
  uploadedAt: string;
}

export interface PresetMelody {
  id: string;
  name: string;
  nameRu: string;
  category: 'classic' | 'modern' | 'nature' | 'festive' | 'retro';
  description: string;
  duration: number;
  notes: { freq: number; duration: number; delay: number; type?: OscillatorType; gain?: number }[];
}

export interface SystemStatus {
  deviceModel: string;
  firmwareVersion: string;
  runtimeEnv: string;
  uptimeSeconds: number;
  freeHeapBytes: number;
  totalHeapBytes: number;
  psramFreeBytes: number;
  psramTotalBytes: number;
  cpuFrequencyMhz: number;
  coreTemperatureC: number;
  relayState: boolean; // GPIO4 latch
  neoPixelColor: string; // Hex color
  neoPixelState: 'idle' | 'playing' | 'boot' | 'ap_mode' | 'error' | 'sleep';
  wifiMode: 'STA' | 'AP' | 'CONNECTING' | 'DISCONNECTED';
  ipAddress: string;
  rssi: number;
  isPlaying: boolean;
  activePlaybackTrack: string;
  playbackPositionSec: number;
  smartTimeoutRemaining: number;
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
