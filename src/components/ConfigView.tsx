import React, { useState } from 'react';
import { 
  Sliders, 
  Wifi, 
  Cpu, 
  Volume2, 
  Shield, 
  Save, 
  Download, 
  Upload, 
  RotateCcw, 
  CheckCircle2, 
  Eye, 
  EyeOff, 
  Zap,
  Lock,
  Radio,
  Clock,
  Sparkles
} from 'lucide-react';
import { EspBellConfig } from '../types';
import { initialConfig } from '../data/defaultConfig';
import { formatEncryptedPassword, formatDecryptedPassword } from '../utils/cryptoAuth';

interface ConfigViewProps {
  config: EspBellConfig;
  onSaveConfig: (updated: EspBellConfig) => void;
  onResetDefaults: () => void;
}

export const ConfigView: React.FC<ConfigViewProps> = ({
  config,
  onSaveConfig,
  onResetDefaults,
}) => {
  const [formData, setFormData] = useState<EspBellConfig>({ ...config });
  const [activeSection, setActiveSection] = useState<'audio' | 'hardware' | 'wifi' | 'security'>('audio');
  const [showPasswords, setShowPasswords] = useState<boolean>(false);
  const [savedAlert, setSavedAlert] = useState<boolean>(false);

  const handleChange = <K extends keyof EspBellConfig>(key: K, value: EspBellConfig[K]) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveConfig(formData);
    setSavedAlert(true);
    setTimeout(() => setSavedAlert(false), 3000);
  };

  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(formData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', 'config.json');
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target?.result as string);
          setFormData((prev) => ({ ...prev, ...parsed }));
          setSavedAlert(true);
          setTimeout(() => setSavedAlert(false), 3000);
        } catch {
          alert('Ошибка чтения JSON конфигурации');
        }
      };
      reader.readAsText(e.target.files[0]);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 shadow-xl space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-semibold">
          <Sliders className="w-3.5 h-3.5" />
          <span>Системная конфигурация config.json</span>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight">
              Параметры и сетевые настройки
            </h2>
            <p className="text-slate-400 text-sm max-w-2xl">
              Настройка режимов загрузки, выводов GPIO I2S ЦАП PCM5102A, Wi-Fi подключения, реле энергосбережения и параметров безопасности.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportJson}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold border border-slate-700 transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              <span>Экспорт JSON</span>
            </button>

            <label className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold border border-slate-700 transition-colors cursor-pointer">
              <Upload className="w-3.5 h-3.5 text-cyan-400" />
              <span>Импорт</span>
              <input type="file" accept=".json" onChange={handleImportJson} className="hidden" />
            </label>
          </div>
        </div>
      </div>

      {savedAlert && (
        <div className="p-4 rounded-xl bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-sm flex items-center gap-3 animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>Конфигурация успешно сохранена в постоянную память ESP32 Flash (/config.json)</span>
        </div>
      )}

      {/* Section Switcher Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3 overflow-x-auto">
        <button
          onClick={() => setActiveSection('audio')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
            activeSection === 'audio'
              ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-600/30'
              : 'bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800'
          }`}
        >
          <Volume2 className="w-4 h-4" />
          <span>Аудио и Воспроизведение</span>
        </button>

        <button
          onClick={() => setActiveSection('hardware')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
            activeSection === 'hardware'
              ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-600/30'
              : 'bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800'
          }`}
        >
          <Cpu className="w-4 h-4" />
          <span>Аппаратные выводы (I2S, Реле, LED)</span>
        </button>

        <button
          onClick={() => setActiveSection('wifi')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
            activeSection === 'wifi'
              ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-600/30'
              : 'bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800'
          }`}
        >
          <Wifi className="w-4 h-4" />
          <span>Wi-Fi (STA и Точка доступа AP)</span>
        </button>

        <button
          onClick={() => setActiveSection('security')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
            activeSection === 'security'
              ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-600/30'
              : 'bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800'
          }`}
        >
          <Shield className="w-4 h-4" />
          <span>Безопасность & Сервер</span>
        </button>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* SECTION 1: Audio and Playback */}
        {activeSection === 'audio' && (
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 shadow-xl space-y-6">
            <h3 className="text-lg font-bold text-white border-b border-slate-800 pb-3 flex items-center gap-2">
              <Volume2 className="w-5 h-5 text-cyan-400" />
              <span>Параметры аудиопотока и режима запуска</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Boot Mode */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-300">
                  Режим запуска контроллера (boot_mode)
                </label>
                <select
                  value={formData.boot_mode}
                  onChange={(e) => handleChange('boot_mode', e.target.value as 'music_first' | 'network_first')}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:border-cyan-500 focus:outline-none"
                >
                  <option value="music_first">music_first (Звонок играет мгновенно до старта Wi-Fi сети)</option>
                  <option value="network_first">network_first (Сначала инициализация сети, затем воспроизведение)</option>
                </select>
                <p className="text-[11px] text-slate-500">
                  При значении "music_first" звонок звучит без задержки сразу после подачи питания.
                </p>
              </div>

              {/* Inactivity Smart Timeout */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-300">
                  Таймаут автоотключения питания (smart_timeout_sec)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min="0"
                    max="3600"
                    value={formData.smart_timeout_sec}
                    onChange={(e) => handleChange('smart_timeout_sec', parseInt(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:border-cyan-500 focus:outline-none font-mono"
                  />
                  <span className="text-xs text-slate-400 whitespace-nowrap">сек (0 = выкл)</span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Через указанное время после последнего запроса реле (GPIO4) отключит питание для экономии батареи.
                </p>
              </div>

              {/* Gain Scale */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-semibold text-slate-300">
                  <span>Коэффициент усиления (gain_scale)</span>
                  <span className="font-mono text-cyan-400">{formData.gain_scale.toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="2.0"
                  step="0.05"
                  value={formData.gain_scale}
                  onChange={(e) => handleChange('gain_scale', parseFloat(e.target.value))}
                  className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                />
              </div>

              {/* Repeat Count */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-300">
                  Количество повторов мелодии (repeat_count)
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={formData.repeat_count}
                  onChange={(e) => handleChange('repeat_count', parseInt(e.target.value) || 1)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:border-cyan-500 focus:outline-none font-mono"
                />
              </div>

              {/* Fade Out */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-300">
                  Длительность затухания (fade_ms)
                </label>
                <input
                  type="number"
                  min="0"
                  max="3000"
                  step="50"
                  value={formData.fade_ms}
                  onChange={(e) => handleChange('fade_ms', parseInt(e.target.value) || 0)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:border-cyan-500 focus:outline-none font-mono"
                />
              </div>

              {/* Duration Limit */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-300">
                  Максимальный лимит звучания (duration_limit_sec)
                </label>
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={formData.duration_limit_sec}
                  onChange={(e) => handleChange('duration_limit_sec', parseInt(e.target.value) || 15)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:border-cyan-500 focus:outline-none font-mono"
                />
              </div>

              {/* Target File */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-300">
                  Целевой файл звонка (target_filename)
                </label>
                <input
                  type="text"
                  value={formData.target_filename}
                  onChange={(e) => handleChange('target_filename', e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:border-cyan-500 focus:outline-none font-mono"
                />
              </div>

              {/* Media Dir */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-300">
                  Каталог мультимедиа (media_dir)
                </label>
                <input
                  type="text"
                  value={formData.media_dir}
                  onChange={(e) => handleChange('media_dir', e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:border-cyan-500 focus:outline-none font-mono"
                />
              </div>
            </div>
          </div>
        )}

        {/* SECTION 2: Hardware GPIO & I2S Pins */}
        {activeSection === 'hardware' && (
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 shadow-xl space-y-6">
            <h3 className="text-lg font-bold text-white border-b border-slate-800 pb-3 flex items-center gap-2">
              <Cpu className="w-5 h-5 text-cyan-400" />
              <span>Назначение выводов GPIO (ESP32-S3 и ЦАП PCM5102A)</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* I2S BCK Pin */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-300">
                  I2S BCK (Bit Clock Pin)
                </label>
                <input
                  type="number"
                  min="0"
                  max="48"
                  value={formData.i2s_bck_pin}
                  onChange={(e) => handleChange('i2s_bck_pin', parseInt(e.target.value) || 0)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-amber-400 font-bold focus:border-cyan-500 focus:outline-none font-mono"
                />
                <p className="text-[11px] text-slate-500">По умолчанию: GPIO 15 (BCK на плате ЦАП)</p>
              </div>

              {/* I2S WS Pin */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-300">
                  I2S WS / LRCK (Word Select Pin)
                </label>
                <input
                  type="number"
                  min="0"
                  max="48"
                  value={formData.i2s_ws_pin}
                  onChange={(e) => handleChange('i2s_ws_pin', parseInt(e.target.value) || 0)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-amber-400 font-bold focus:border-cyan-500 focus:outline-none font-mono"
                />
                <p className="text-[11px] text-slate-500">По умолчанию: GPIO 16 (LRCK на плате ЦАП)</p>
              </div>

              {/* I2S SD / DIN Pin */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-300">
                  I2S SD / DIN (Serial Data Pin)
                </label>
                <input
                  type="number"
                  min="0"
                  max="48"
                  value={formData.i2s_sd_pin}
                  onChange={(e) => handleChange('i2s_sd_pin', parseInt(e.target.value) || 0)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-amber-400 font-bold focus:border-cyan-500 focus:outline-none font-mono"
                />
                <p className="text-[11px] text-slate-500">По умолчанию: GPIO 17 (DIN на плате ЦАП)</p>
              </div>

              {/* Power Relay Pin */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-300">
                  Реле удержания питания (power_relay_pin)
                </label>
                <input
                  type="number"
                  min="0"
                  max="48"
                  value={formData.power_relay_pin}
                  onChange={(e) => handleChange('power_relay_pin', parseInt(e.target.value) || 0)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-emerald-400 font-bold focus:border-cyan-500 focus:outline-none font-mono"
                />
                <p className="text-[11px] text-slate-500">По умолчанию: GPIO 4 (управление транзисторным ключом/реле)</p>
              </div>

              {/* Indicator LED Pin */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-300">
                  Адресный светодиод NeoPixel (indicator_led_pin)
                </label>
                <input
                  type="number"
                  min="0"
                  max="48"
                  value={formData.indicator_led_pin}
                  onChange={(e) => handleChange('indicator_led_pin', parseInt(e.target.value) || 0)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-cyan-400 font-bold focus:border-cyan-500 focus:outline-none font-mono"
                />
                <p className="text-[11px] text-slate-500">По умолчанию: GPIO 48 (встроенный RGB WS2812 на ESP32-S3)</p>
              </div>

              {/* Sample Rate */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-300">
                  Частота дискретизации I2S (Sample Rate)
                </label>
                <select
                  value={formData.i2s_sample_rate}
                  onChange={(e) => handleChange('i2s_sample_rate', parseInt(e.target.value) || 44100)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:border-cyan-500 focus:outline-none font-mono"
                >
                  <option value="44100">44100 Hz (Студийное качество CD)</option>
                  <option value="22050">22050 Hz (Экономия флэш-памяти)</option>
                  <option value="48000">48000 Hz (Профессиональный звук)</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* SECTION 3: Wi-Fi STA & AP */}
        {activeSection === 'wifi' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Wi-Fi Station (Client) */}
            <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 shadow-xl space-y-6">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Wifi className="w-5 h-5 text-emerald-400" />
                  <span>Wi-Fi подключение (Режим STA)</span>
                </h3>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.wifi_sta_enabled}
                    onChange={(e) => handleChange('wifi_sta_enabled', e.target.checked)}
                    className="w-4 h-4 rounded text-cyan-600 focus:ring-cyan-500"
                  />
                  <span className="text-xs text-slate-300">Включено</span>
                </label>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-300">Имя сети (SSID роутера)</label>
                  <input
                    type="text"
                    value={formData.wifi_ssid}
                    onChange={(e) => handleChange('wifi_ssid', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-slate-200 focus:border-cyan-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="block text-xs font-semibold text-slate-300">Пароль Wi-Fi</label>
                    <button
                      type="button"
                      onClick={() => setShowPasswords(!showPasswords)}
                      className="text-xs text-cyan-400 flex items-center gap-1"
                    >
                      {showPasswords ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      <span>{showPasswords ? 'Скрыть' : 'Показать'}</span>
                    </button>
                  </div>
                  <input
                    type={showPasswords ? 'text' : 'password'}
                    value={showPasswords ? formatDecryptedPassword(formData.wifi_password) : formData.wifi_password}
                    onChange={(e) => handleChange('wifi_password', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-slate-200 focus:border-cyan-500 focus:outline-none font-mono"
                  />
                  <p className="text-[11px] text-slate-500">Шифруется в config.json с префиксом ENC:</p>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-300">Статический IP (или DHCP)</label>
                  <input
                    type="text"
                    value={formData.wifi_ip}
                    onChange={(e) => handleChange('wifi_ip', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-slate-200 focus:border-cyan-500 focus:outline-none font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Wi-Fi Access Point (Fallback AP) */}
            <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 shadow-xl space-y-6">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Radio className="w-5 h-5 text-amber-400" />
                  <span>Точка доступа для настройки (Режим AP)</span>
                </h3>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-300">SSID точки доступа</label>
                  <input
                    type="text"
                    value={formData.wifi_ap_ssid}
                    onChange={(e) => handleChange('wifi_ap_ssid', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-slate-200 focus:border-cyan-500 focus:outline-none"
                  />
                  <p className="text-[11px] text-slate-500">Активируется автоматически, если роутер недоступен</p>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-300">Пароль точки доступа</label>
                  <input
                    type={showPasswords ? 'text' : 'password'}
                    value={formData.wifi_ap_password}
                    onChange={(e) => handleChange('wifi_ap_password', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-slate-200 focus:border-cyan-500 focus:outline-none font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-300">IP адрес в режиме точки доступа</label>
                  <input
                    type="text"
                    value={formData.wifi_ap_ip}
                    onChange={(e) => handleChange('wifi_ap_ip', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-slate-200 focus:border-cyan-500 focus:outline-none font-mono"
                  />
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="captivePortal"
                    checked={formData.dns_captive_portal}
                    onChange={(e) => handleChange('dns_captive_portal', e.target.checked)}
                    className="w-4 h-4 rounded text-cyan-600 focus:ring-cyan-500"
                  />
                  <label htmlFor="captivePortal" className="text-xs text-slate-300 cursor-pointer">
                    Включить Captive Portal (автоматическое открытие страницы при подключении)
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SECTION 4: Security and Server */}
        {activeSection === 'security' && (
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 shadow-xl space-y-6">
            <h3 className="text-lg font-bold text-white border-b border-slate-800 pb-3 flex items-center gap-2">
              <Shield className="w-5 h-5 text-cyan-400" />
              <span>Аутентификация (SHA-256 + Nonce) и HTTPS веб-сервер</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Admin Password */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-300">
                  Пароль администратора (Admin Password)
                </label>
                <input
                  type="password"
                  value={formData.admin_password}
                  onChange={(e) => handleChange('admin_password', e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:border-cyan-500 focus:outline-none font-mono"
                />
                <p className="text-[11px] text-slate-500">
                  Используется для генерации одноразового токена SHA256(password + nonce)
                </p>
              </div>

              {/* Nonce TTL */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-300">
                  Время жизни одноразового Nonce (nonce_ttl_sec)
                </label>
                <input
                  type="number"
                  min="5"
                  max="300"
                  value={formData.nonce_ttl_sec}
                  onChange={(e) => handleChange('nonce_ttl_sec', parseInt(e.target.value) || 30)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:border-cyan-500 focus:outline-none font-mono"
                />
                <p className="text-[11px] text-slate-500">Защищает от replay-атак перехвата запросов</p>
              </div>

              {/* HTTPS Port */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-300">
                  Порт веб-сервера Microdot
                </label>
                <input
                  type="number"
                  value={formData.server_port}
                  onChange={(e) => handleChange('server_port', parseInt(e.target.value) || 443)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:border-cyan-500 focus:outline-none font-mono"
                />
                <p className="text-[11px] text-slate-500">443 для зашифрованного HTTPS или 80 для HTTP</p>
              </div>

              {/* TLS Certificates */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-300">
                  Путь к TLS сертификату (/resources/cert.crt)
                </label>
                <input
                  type="text"
                  value={formData.cert_path}
                  onChange={(e) => handleChange('cert_path', e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:border-cyan-500 focus:outline-none font-mono"
                />
              </div>
            </div>
          </div>
        )}

        {/* Footer Submit Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-800">
          <button
            type="button"
            onClick={() => {
              if (confirm('Сбросить все параметры к заводским значениям?')) {
                setFormData({ ...initialConfig });
                onResetDefaults();
              }
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-400 hover:text-slate-200 text-xs font-semibold transition-colors border border-slate-700"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Заводские настройки</span>
          </button>

          <button
            type="submit"
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-sm shadow-xl shadow-cyan-500/25 active:scale-95 transition-all"
          >
            <Save className="w-4 h-4" />
            <span>Сохранить параметры в ESP32 Flash</span>
          </button>
        </div>
      </form>
    </div>
  );
};
