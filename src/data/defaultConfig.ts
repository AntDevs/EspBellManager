import { EspBellConfig, SystemStatus } from '../types';

export const initialConfig: EspBellConfig = {
  boot_mode: 'music_first',
  smart_timeout_sec: 180,
  auth_smart_timeout_sec: 600,
  repeat_count: 1,
  max_play_duration_sec: 0,
  fade_out_ms: 1000,
  resume_playback: true,
  last_play_pos_bytes: 0,
  last_play_pos_sec: 0,
  wifi_ssid: 'Home_WiFi_2.4G',
  wifi_password: '',
  upload_password: 'admin',
  ap_ssid: 'EspBell-Setup',
  ap_password: 'admin12345',
  target_esp_url: 'https://bell555.local',
};

export const initialSystemStatus: SystemStatus = {
  availableBytes: 1534000,
  maxFileBytes: 4194304,
  allowedExtensions: ['mp3', 'wav'],
  isPlaying: false,
  freeHeap: 284560,
  device: 'ESP32-S3',
};
