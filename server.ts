import express from "express";
import path from "path";
import crypto from "crypto";
import { createServer as createViteServer } from "vite";

const app = express();
const PORT = 3000;

// Body parsers
app.use(express.json({ limit: "15mb" }));
app.use(express.raw({ type: ["audio/*", "application/octet-stream"], limit: "15mb" }));

// In-Memory ESP32-S3 System State & Configuration
let activeConfig = {
  boot_mode: "music_first",
  smart_timeout_sec: 180,
  repeat_count: 1,
  gain_scale: 1.0,
  fade_ms: 100,
  duration_limit_sec: 15,
  resume_position_ms: 0,
  media_dir: "/media",
  target_filename: "bell.wav",
  
  // Hardware pins
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
  wifi_ssid: "Home_WiFi_2.4G",
  wifi_password: "ENC:1234567890abcdef",
  wifi_static_ip: false,
  wifi_ip: "192.168.1.145",
  wifi_gateway: "192.168.1.1",
  wifi_subnet: "255.255.255.0",
  wifi_dns: "192.168.1.1",
  
  // Wi-Fi AP fallback
  wifi_ap_ssid: "EspBell-Setup",
  wifi_ap_password: "admin_espbell",
  wifi_ap_ip: "192.168.4.1",
  wifi_ap_channel: 1,
  wifi_ap_max_clients: 4,
  dns_captive_portal: true,
  
  // Web Server & Security
  server_port: 443,
  https_enabled: true,
  admin_password: "admin",
  nonce_ttl_sec: 30,
  cert_path: "/resources/cert.crt",
  key_path: "/resources/cert.key"
};

let currentTrack = {
  filename: "bell.wav",
  title: "Вестминстерский перезвон",
  format: "PCM WAV (16-bit Stereo)",
  sizeBytes: 282284,
  durationSeconds: 3.2,
  sampleRate: 44100,
  channels: 2,
  bitDepth: 16,
  uploadedAt: new Date().toISOString()
};

let systemState = {
  deviceModel: "ESP32-S3-WROOM-1 (N16R8)",
  firmwareVersion: "EspBellAdmin v2.4.1-MicroPython",
  runtimeEnv: "ESP32-S3 Microdot HTTPS Server",
  uptimeSeconds: 1420,
  freeHeapBytes: 284560,
  totalHeapBytes: 393216,
  psramFreeBytes: 7421890,
  psramTotalBytes: 8388608,
  cpuFrequencyMhz: 240,
  coreTemperatureC: 41.2,
  relayState: true,
  neoPixelColor: "#10b981",
  neoPixelState: "idle",
  wifiMode: "STA",
  ipAddress: "192.168.1.145",
  rssi: -54,
  isPlaying: false,
  activePlaybackTrack: "bell.wav",
  playbackPositionSec: 0,
  smartTimeoutRemaining: 180
};

// Store active Nonces for challenge-response auth
const activeNonces = new Map<string, number>();

// System log entries (boot.log)
let systemLogs = [
  {
    id: "log-1",
    timestamp: "00:00:00.120",
    level: "INFO",
    tag: "BOOT",
    message: "ESP32-S3 EspBellAdmin v2.4.1 starting up (16MB Flash, 8MB Octal PSRAM)..."
  },
  {
    id: "log-2",
    timestamp: "00:00:00.145",
    level: "HARDWARE",
    tag: "POWER",
    message: "Power latch GPIO4 set to HIGH (Holding relay ON for playback session)"
  },
  {
    id: "log-3",
    timestamp: "00:00:00.180",
    level: "INFO",
    tag: "CONFIG",
    message: "Loaded /config.json successfully. Mode: music_first, Smart timeout: 180s"
  },
  {
    id: "log-4",
    timestamp: "00:00:00.220",
    level: "HARDWARE",
    tag: "I2S",
    message: "I2S0 initialized: BCK=GPIO15, WS=GPIO16, DIN=GPIO17, Rate=44100Hz, DMA=8x1024"
  },
  {
    id: "log-5",
    timestamp: "00:00:00.250",
    level: "INFO",
    tag: "AUDIO",
    message: "Boot playback mode: music_first. Verified /media/bell.wav (PCM 16-bit 44.1kHz)"
  },
  {
    id: "log-6",
    timestamp: "00:00:00.290",
    level: "HARDWARE",
    tag: "LED",
    message: "NeoPixel WS2812 on GPIO48 initialized (Color: #10b981 / Standby Green)"
  },
  {
    id: "log-7",
    timestamp: "00:00:00.410",
    level: "INFO",
    tag: "WIFI",
    message: "Station connected to Home_WiFi_2.4G (IP: 192.168.1.145, RSSI: -54 dBm)"
  },
  {
    id: "log-8",
    timestamp: "00:00:00.460",
    level: "INFO",
    tag: "HTTP",
    message: "Microdot HTTPS web server started on port 443 with TLS cert /resources/cert.crt"
  }
];

function appendLog(level: string, tag: string, message: string) {
  const now = new Date();
  const timeStr = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}:${now.getSeconds().toString().padStart(2, "0")}.${now.getMilliseconds().toString().padStart(3, "0")}`;
  systemLogs.push({
    id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: timeStr,
    level,
    tag,
    message
  });
  if (systemLogs.length > 300) {
    systemLogs.shift();
  }
}

// -------------------------------------------------------------
// REST API ROUTES
// -------------------------------------------------------------

// 1. Health check & API catalog
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    server: "ESP32-S3 Microdot REST API Emulation",
    timestamp: new Date().toISOString(),
    endpoints: [
      { method: "GET", path: "/api/info", description: "Get ESP32 status & telemetry" },
      { method: "GET", path: "/api/get-nonce", description: "Request single-use 8-byte auth nonce" },
      { method: "POST", path: "/api/verify-auth", description: "SHA-256 challenge response login" },
      { method: "GET", path: "/api/config", description: "Read config.json from Flash" },
      { method: "POST", path: "/api/config", description: "Save config.json to Flash" },
      { method: "POST", path: "/upload", description: "Upload binary 16-bit PCM WAV melody" },
      { method: "POST", path: "/api/play", description: "Trigger I2S DMA audio playback" },
      { method: "POST", path: "/api/stop", description: "Halt I2S DMA playback" },
      { method: "POST", path: "/api/trigger-bell", description: "Simulate physical doorbell button" },
      { method: "GET", path: "/api/logs", description: "Read /boot.log terminal entries" },
      { method: "POST", path: "/api/logs/clear", description: "Clear log entries" },
      { method: "GET", path: "/api/logout", description: "Invalidate admin session" }
    ]
  });
});

// 2. System Status & Telemetry
app.get("/api/info", (req, res) => {
  systemState.uptimeSeconds += 2;
  systemState.coreTemperatureC = parseFloat((41.0 + Math.random() * 1.5).toFixed(1));
  systemState.freeHeapBytes = 280000 + Math.floor(Math.random() * 8000);
  
  res.json({
    status: "ok",
    device: systemState.deviceModel,
    firmware: systemState.firmwareVersion,
    runtime: systemState.runtimeEnv,
    uptime_sec: systemState.uptimeSeconds,
    heap: {
      free_bytes: systemState.freeHeapBytes,
      total_bytes: systemState.totalHeapBytes
    },
    psram: {
      free_bytes: systemState.psramFreeBytes,
      total_bytes: systemState.psramTotalBytes
    },
    cpu_freq_mhz: systemState.cpuFrequencyMhz,
    core_temp_c: systemState.coreTemperatureC,
    power: {
      relay_latch_gpio4: systemState.relayState,
      smart_timeout_sec: activeConfig.smart_timeout_sec,
      remaining_sec: systemState.smartTimeoutRemaining
    },
    led: {
      gpio: activeConfig.indicator_led_pin,
      state: systemState.neoPixelState,
      color: systemState.neoPixelColor
    },
    wifi: {
      mode: systemState.wifiMode,
      ssid: activeConfig.wifi_ssid,
      ip: systemState.ipAddress,
      rssi: systemState.rssi
    },
    audio: {
      is_playing: systemState.isPlaying,
      active_file: currentTrack.filename,
      track_title: currentTrack.title,
      sample_rate: currentTrack.sampleRate,
      gain: activeConfig.gain_scale,
      duration_sec: currentTrack.durationSeconds
    }
  });
});

// 3. Cryptographic Nonce Challenge
app.get("/api/get-nonce", (req, res) => {
  const nonce = crypto.randomBytes(8).toString("hex");
  activeNonces.set(nonce, Date.now());
  
  // Clean up nonces older than 60s
  const now = Date.now();
  for (const [n, ts] of activeNonces.entries()) {
    if (now - ts > 60000) activeNonces.delete(n);
  }
  
  appendLog("DEBUG", "AUTH", `Generated single-use auth nonce: ${nonce}`);
  res.json({ nonce, ttl_sec: activeConfig.nonce_ttl_sec || 30 });
});

// 4. Verify Auth (SHA-256 Challenge Response)
app.post("/api/verify-auth", (req, res) => {
  const { hash, nonce } = req.body || {};
  
  if (!nonce || !activeNonces.has(nonce)) {
    appendLog("WARNING", "AUTH", "Auth rejected: Nonce expired or invalid");
    return res.status(401).json({ status: "error", message: "Одноразовый токен (nonce) устарел или не найден." });
  }
  
  // Invalidate nonce after single use
  activeNonces.delete(nonce);
  
  // Calculate expected SHA-256 hash = sha256(admin_password + nonce)
  const expectedHash = crypto.createHash("sha256").update(activeConfig.admin_password + nonce).digest("hex");
  
  if (hash && hash.toLowerCase() === expectedHash.toLowerCase()) {
    const sessionToken = crypto.randomBytes(16).toString("hex");
    appendLog("INFO", "AUTH", "Admin authenticated successfully via SHA-256 challenge");
    return res.json({ status: "ok", token: sessionToken, role: "admin" });
  } else {
    appendLog("WARNING", "AUTH", "Auth rejected: Hash mismatch for admin password");
    return res.status(401).json({ status: "error", message: "Неверный пароль администратора." });
  }
});

// 5. Get Configuration
app.get("/api/config", (req, res) => {
  res.json(activeConfig);
});

// 6. Save Configuration
app.post("/api/config", (req, res) => {
  const newConfig = req.body;
  if (!newConfig || typeof newConfig !== "object") {
    return res.status(400).json({ status: "error", message: "Invalid configuration payload" });
  }
  
  activeConfig = { ...activeConfig, ...newConfig };
  appendLog("INFO", "CONFIG", "Updated /config.json in SPI Flash. Parameters reloaded.");
  res.json({ status: "ok", message: "Configuration saved to /config.json", config: activeConfig });
});

// 7. Binary Audio File Upload (POST /upload)
app.post("/upload", (req, res) => {
  let sizeBytes = 0;
  let fileBuffer: Buffer | null = null;
  let trackTitle = req.query.title ? String(req.query.title) : "Пользовательская мелодия";
  let filename = req.query.filename ? String(req.query.filename) : activeConfig.target_filename;
  
  if (Buffer.isBuffer(req.body)) {
    fileBuffer = req.body;
    sizeBytes = fileBuffer.length;
  } else if (req.body && req.body.audioBase64) {
    fileBuffer = Buffer.from(req.body.audioBase64, "base64");
    sizeBytes = fileBuffer.length;
    if (req.body.title) trackTitle = req.body.title;
    if (req.body.filename) filename = req.body.filename;
  }
  
  if (!fileBuffer || sizeBytes === 0) {
    // Fallback if empty request
    sizeBytes = 256000;
  }
  
  // Calculate approximate duration based on 44100Hz 16-bit stereo (176400 bytes/sec)
  const durationSec = parseFloat(Math.max(0.5, (sizeBytes - 44) / 176400).toFixed(1));
  
  currentTrack = {
    filename,
    title: trackTitle,
    format: "PCM WAV (16-bit Stereo)",
    sizeBytes,
    durationSeconds: durationSec,
    sampleRate: activeConfig.i2s_sample_rate || 44100,
    channels: 2,
    bitDepth: 16,
    uploadedAt: new Date().toLocaleTimeString()
  };
  
  appendLog("INFO", "UPLOAD", `Received WAV upload: ${filename} (${(sizeBytes / 1024).toFixed(1)} KB) -> Saved to /media/${filename}`);
  appendLog("HARDWARE", "FLASH", `Committed ${sizeBytes} bytes to SPI Flash filesystem at offset 0x310000`);
  
  res.json({
    status: "ok",
    message: "Audio uploaded successfully and written to /media/" + filename,
    track: currentTrack
  });
});

// 8. Start Playback (POST /api/play)
app.post("/api/play", (req, res) => {
  systemState.isPlaying = true;
  systemState.neoPixelState = "playing";
  systemState.neoPixelColor = "#06b6d4";
  systemState.relayState = true;
  systemState.smartTimeoutRemaining = activeConfig.smart_timeout_sec;
  
  appendLog("INFO", "PLAYER", `Starting I2S audio playback: ${currentTrack.filename} (${currentTrack.title})`);
  appendLog("HARDWARE", "I2S_TX", `Streaming DMA chunks to PCM5102A DAC (Rate: ${activeConfig.i2s_sample_rate}Hz, Gain: ${activeConfig.gain_scale}x)...`);
  
  res.json({ status: "playing", track: currentTrack.filename, gain: activeConfig.gain_scale });
});

// 9. Stop Playback (POST /api/stop)
app.post("/api/stop", (req, res) => {
  systemState.isPlaying = false;
  systemState.neoPixelState = "idle";
  systemState.neoPixelColor = "#10b981";
  
  appendLog("INFO", "PLAYER", "Audio playback halted by API command.");
  res.json({ status: "stopped" });
});

// 10. Physical Bell Trigger Simulation
app.post("/api/trigger-bell", (req, res) => {
  systemState.isPlaying = true;
  systemState.relayState = true;
  systemState.neoPixelState = "playing";
  systemState.neoPixelColor = "#06b6d4";
  systemState.smartTimeoutRemaining = activeConfig.smart_timeout_sec;
  
  appendLog("HARDWARE", "BUTTON", "Physical doorbell button pressed (External Trigger on GPIO)");
  appendLog("HARDWARE", "POWER", "GPIO4 Relay latch asserted HIGH (Power active)");
  appendLog("HARDWARE", "I2S_TX", `Streaming /media/${currentTrack.filename} to PCM5102A DAC...`);
  
  res.json({
    status: "triggered",
    relay: "LATCH_ACTIVE",
    track: currentTrack.filename,
    duration_sec: currentTrack.durationSeconds
  });
});

// 11. Read Logs (GET /api/logs)
app.get("/api/logs", (req, res) => {
  res.json({
    status: "ok",
    count: systemLogs.length,
    logs: systemLogs
  });
});

// 12. Clear Logs (POST /api/logs/clear)
app.post("/api/logs/clear", (req, res) => {
  systemLogs = [
    {
      id: `log-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString(),
      level: "INFO",
      tag: "SYSTEM",
      message: "System log buffer cleared by administrator."
    }
  ];
  res.json({ status: "ok", message: "Logs cleared" });
});

// 13. Logout (GET /api/logout)
app.get("/api/logout", (req, res) => {
  appendLog("INFO", "AUTH", "Admin session logged out via /api/logout");
  res.json({ status: "ok", message: "Logged out" });
});

// 14. Templates List (GET /api/templates)
app.get("/api/templates", (req, res) => {
  res.json({
    status: "ok",
    templates: [
      { id: "main", file: "main.html", title: "Главный экран звонка" },
      { id: "upload", file: "upload.html", title: "Загрузка и конвертер WAV" },
      { id: "config", file: "config.html", title: "Редактор /config.json" },
      { id: "logs", file: "logs.html", title: "Журнал boot.log" },
      { id: "api", file: "api.html", title: "REST API Инспектор" }
    ]
  });
});

// Serve /templates static files
app.use("/templates", express.static(path.join(process.cwd(), "public/templates")));

// -------------------------------------------------------------
// Vite middleware for development / Static files for production
// -------------------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true, host: "0.0.0.0", port: PORT },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[EspBellAdmin] Microdot REST API & UI Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
