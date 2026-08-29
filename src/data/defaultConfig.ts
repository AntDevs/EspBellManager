import { EspBellConfig } from '../types';

export const initialConfig: EspBellConfig = {
  boot_mode: 'music_first',
  smart_timeout_sec: 180,
  repeat_count: 1,
  gain_scale: 1.0,
  fade_ms: 250,
  duration_limit_sec: 15,
  resume_position_ms: 0,
  media_dir: '/media',
  target_filename: 'bell.wav',
  
  // Hardware pins (ESP32-S3 default mapping for PCM5102A & peripherals)
  i2s_id: 0,
  i2s_bck_pin: 15,
  i2s_ws_pin: 16,
  i2s_sd_pin: 17,
  i2s_sample_rate: 44100,
  i2s_bits_per_sample: 16,
  power_relay_pin: 4,
  indicator_led_pin: 48,
  
  // Wi-Fi STA
  wifi_sta_enabled: true,
  wifi_ssid: 'Home_WiFi_2.4G',
  wifi_password: 'ENC:7f8a9b2c3d4e5f60',
  wifi_static_ip: false,
  wifi_ip: '192.168.1.145',
  wifi_gateway: '192.168.1.1',
  wifi_subnet: '255.255.255.0',
  wifi_dns: '1.1.1.1',
  
  // Wi-Fi AP fallback
  wifi_ap_ssid: 'EspBell-Setup',
  wifi_ap_password: 'admin12345',
  wifi_ap_ip: '192.168.4.1',
  wifi_ap_channel: 6,
  wifi_ap_max_clients: 4,
  dns_captive_portal: true,
  
  // Web Server & Security
  server_port: 443,
  https_enabled: true,
  admin_password: 'admin',
  nonce_ttl_sec: 30,
  cert_path: '/resources/cert.crt',
  key_path: '/resources/cert.key',
  target_esp_url: 'https://bell555.local',
};

export const initialSystemStatus = {
  deviceModel: 'ESP32-S3-WROOM-1 (N16R8)',
  firmwareVersion: 'v2.4.1-mpy-1.22.0',
  runtimeEnv: 'MicroPython ESP32-S3 with I2S Audio',
  uptimeSeconds: 432,
  freeHeapBytes: 284560,
  totalHeapBytes: 524288,
  psramFreeBytes: 7854080,
  psramTotalBytes: 8388608,
  cpuFrequencyMhz: 240,
  coreTemperatureC: 41.2,
  relayState: true,
  neoPixelColor: '#10b981',
  neoPixelState: 'idle' as const,
  wifiMode: 'STA' as const,
  ipAddress: '192.168.1.145',
  rssi: -54,
  isPlaying: false,
  activePlaybackTrack: 'bell.wav',
  playbackPositionSec: 0,
  smartTimeoutRemaining: 180,
};
