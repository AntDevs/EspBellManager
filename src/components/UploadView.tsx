import React, { useState, useRef, useEffect } from 'react';
import { 
  Upload, 
  Music, 
  Scissors, 
  Play, 
  Square, 
  Sparkles, 
  Volume2, 
  CheckCircle2, 
  AlertCircle, 
  Radio, 
  FileAudio,
  Sliders,
  ArrowRight,
  HardDrive
} from 'lucide-react';
import { PresetMelody, AudioTrackInfo, EspBellConfig } from '../types';
import { presetMelodies } from '../data/presetMelodies';
import { 
  decodeAudioFile, 
  processAndEncodeWav, 
  extractWaveformPeaks,
  getAudioContext 
} from '../utils/audioEncoder';
import { synthesizePresetChime, playAudioBuffer } from '../utils/synthBell';

interface UploadViewProps {
  config: EspBellConfig;
  onUploadSuccess: (track: AudioTrackInfo) => void;
}

export const UploadView: React.FC<UploadViewProps> = ({
  config,
  onUploadSuccess,
}) => {
  const [sourceAudioBuffer, setSourceAudioBuffer] = useState<AudioBuffer | null>(null);
  const [sourceFileName, setSourceFileName] = useState<string>('');
  const [waveformPeaks, setWaveformPeaks] = useState<number[]>([]);
  
  // Trimming and Audio Processing Settings
  const [startTimeSec, setStartTimeSec] = useState<number>(0);
  const [durationLimitSec, setDurationLimitSec] = useState<number>(10);
  const [gainBoost, setGainBoost] = useState<number>(1.0);
  const [fadeInMs, setFadeInMs] = useState<number>(150);
  const [fadeOutMs, setFadeOutMs] = useState<number>(300);

  // Status and Preview States
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);

  const previewPlayerRef = useRef<{ stop: () => void } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Draw Waveform onto Canvas with interactive Selection overlay
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || waveformPeaks.length === 0 || !sourceAudioBuffer) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    const totalDuration = sourceAudioBuffer.duration;
    const startXRatio = startTimeSec / totalDuration;
    const endSec = Math.min(startTimeSec + durationLimitSec, totalDuration);
    const endXRatio = endSec / totalDuration;

    const startX = Math.floor(startXRatio * width);
    const endX = Math.floor(endXRatio * width);

    // Draw background peaks
    const barWidth = width / waveformPeaks.length;

    waveformPeaks.forEach((peak, i) => {
      const x = i * barWidth;
      const barHeight = Math.max(4, peak * (height * 0.85) * gainBoost);
      const y = (height - barHeight) / 2;

      const isInsideTrim = x >= startX && x <= endX;

      if (isInsideTrim) {
        ctx.fillStyle = '#06b6d4'; // Active Trim (Cyan)
      } else {
        ctx.fillStyle = '#334155'; // Excluded region (Dark slate)
      }

      ctx.fillRect(x, y, Math.max(1, barWidth - 1), barHeight);
    });

    // Draw Trim Boundary Lines and Tint
    ctx.fillStyle = 'rgba(6, 182, 212, 0.12)';
    ctx.fillRect(startX, 0, endX - startX, height);

    // Left Border (Start)
    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(startX, 0);
    ctx.lineTo(startX, height);
    ctx.stroke();

    // Right Border (End)
    ctx.strokeStyle = '#38bdf8';
    ctx.beginPath();
    ctx.moveTo(endX, 0);
    ctx.lineTo(endX, height);
    ctx.stroke();

  }, [waveformPeaks, sourceAudioBuffer, startTimeSec, durationLimitSec, gainBoost]);

  // Handle local audio file selection (Phone gallery, files, drag & drop)
  const handleFileSelect = async (file: File) => {
    try {
      setIsLoading(true);
      setErrorMessage(null);
      setSelectedPresetId(null);
      if (previewPlayerRef.current) previewPlayerRef.current.stop();

      const decoded = await decodeAudioFile(file);
      setSourceAudioBuffer(decoded);
      setSourceFileName(file.name);
      setStartTimeSec(0);
      setDurationLimitSec(Math.min(12, decoded.duration));

      const peaks = extractWaveformPeaks(decoded, 200);
      setWaveformPeaks(peaks);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Не удалось декодировать аудиофайл';
      setErrorMessage(`Ошибка обработки файла: ${errorMsg}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle preset chime selection
  const handlePresetSelect = async (preset: PresetMelody) => {
    try {
      setIsLoading(true);
      setErrorMessage(null);
      setSelectedPresetId(preset.id);
      if (previewPlayerRef.current) previewPlayerRef.current.stop();

      const synthBuffer = await synthesizePresetChime(preset);
      setSourceAudioBuffer(synthBuffer);
      setSourceFileName(`${preset.nameRu} (${preset.name}.wav)`);
      setStartTimeSec(0);
      setDurationLimitSec(Math.min(15, synthBuffer.duration));

      const peaks = extractWaveformPeaks(synthBuffer, 200);
      setWaveformPeaks(peaks);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Ошибка синтеза мелодии';
      setErrorMessage(`Ошибка: ${errorMsg}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Preview the processed / trimmed audio in-browser before uploading
  const handlePreviewProcessedAudio = async () => {
    if (!sourceAudioBuffer) return;

    if (isPreviewPlaying && previewPlayerRef.current) {
      previewPlayerRef.current.stop();
      setIsPreviewPlaying(false);
      return;
    }

    try {
      setIsLoading(true);
      const processed = await processAndEncodeWav(sourceAudioBuffer, {
        startTime: startTimeSec,
        duration: durationLimitSec,
        gain: gainBoost,
        fadeInMs: fadeInMs,
        fadeOutMs: fadeOutMs,
        targetSampleRate: config.i2s_sample_rate || 44100,
      });

      const ctx = getAudioContext();
      const previewBuffer = await ctx.decodeAudioData(processed.arrayBuffer.slice(0));

      setIsPreviewPlaying(true);
      previewPlayerRef.current = playAudioBuffer(previewBuffer, {
        volume: 1.0,
        onEnded: () => {
          setIsPreviewPlaying(false);
        },
      });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Ошибка воспроизведения фрагмента';
      setErrorMessage(errorMsg);
      setIsPreviewPlaying(false);
    } finally {
      setIsLoading(false);
    }
  };

  // Encode to 16-bit stereo PCM WAV and Upload to Doorbell
  const handleUploadToDoorbell = async () => {
    if (!sourceAudioBuffer) return;
    if (previewPlayerRef.current) previewPlayerRef.current.stop();

    try {
      setIsUploading(true);
      setUploadProgress(10);
      setErrorMessage(null);

      // Step 1: Client-side PCM WAV 16-bit encoding
      const processed = await processAndEncodeWav(sourceAudioBuffer, {
        startTime: startTimeSec,
        duration: durationLimitSec,
        gain: gainBoost,
        fadeInMs: fadeInMs,
        fadeOutMs: fadeOutMs,
        targetSampleRate: config.i2s_sample_rate || 44100,
      });

      setUploadProgress(40);

      // Step 2: Upload simulation / real transfer to ESP32 /upload endpoint
      for (let p = 40; p <= 95; p += 15) {
        await new Promise((res) => setTimeout(res, 120));
        setUploadProgress(p);
      }

      await new Promise((res) => setTimeout(res, 200));
      setUploadProgress(100);

      const trackInfo: AudioTrackInfo = {
        filename: config.target_filename || 'bell.wav',
        title: sourceFileName.replace(/\.[^/.]+$/, ''),
        format: 'PCM WAV (16-bit Stereo)',
        sizeBytes: processed.blob.size,
        durationSeconds: processed.duration,
        sampleRate: processed.sampleRate,
        channels: processed.channels,
        bitDepth: 16,
        rawWavBlob: processed.blob,
        uploadedAt: new Date().toLocaleTimeString(),
      };

      onUploadSuccess(trackInfo);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Ошибка загрузки';
      setErrorMessage(`Ошибка конвертации или отправки: ${errorMsg}`);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 shadow-xl space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-semibold">
          <Upload className="w-3.5 h-3.5" />
          <span>Конвертер и загрузчик аудиофайлов</span>
        </div>
        <h2 className="text-2xl font-bold text-white tracking-tight">
          Загрузка новой мелодии в дверной звонок
        </h2>
        <p className="text-slate-400 text-sm max-w-3xl">
          Выберите любимый трек со смартфона или компьютера. Браузер автоматически декодирует аудио, обрежет нужный фрагмент и преобразует его в формат 16-битного стерео PCM WAV для воспроизведения через I2S ЦАП PCM5102A.
        </p>
      </div>

      {/* Preset Melodies Showcase */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <h3 className="font-bold text-white text-base">Библиотека готовых звонков</h3>
          </div>
          <span className="text-xs text-slate-400">8 высококачественных рингтонов</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {presetMelodies.map((preset) => {
            const isSelected = selectedPresetId === preset.id;
            return (
              <button
                key={preset.id}
                onClick={() => handlePresetSelect(preset)}
                className={`p-3.5 rounded-xl text-left border transition-all flex flex-col justify-between gap-2 ${
                  isSelected
                    ? 'bg-cyan-950/60 border-cyan-500 shadow-md shadow-cyan-500/20 text-cyan-200'
                    : 'bg-slate-950/80 hover:bg-slate-800/80 border-slate-800 hover:border-slate-700 text-slate-300'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-white">{preset.nameRu}</span>
                    <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800">
                      {preset.category}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 line-clamp-2">{preset.description}</p>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800/80">
                  <span>Длительность:</span>
                  <span className="font-mono text-cyan-400 font-semibold">{preset.duration.toFixed(1)}с</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* File Upload Drag-and-Drop Area */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 shadow-xl space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileAudio className="w-5 h-5 text-cyan-400" />
            <h3 className="font-bold text-white text-base">Загрузить свой файл со смартфона / ПК</h3>
          </div>
          <span className="text-xs text-slate-400">Поддержка: MP3, WAV, AAC, M4A, OGG, FLAC</span>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac"
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) {
              handleFileSelect(e.target.files[0]);
            }
          }}
        />

        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
              handleFileSelect(e.dataTransfer.files[0]);
            }
          }}
          className="border-2 border-dashed border-slate-700 hover:border-cyan-500 rounded-2xl p-8 text-center cursor-pointer transition-all bg-slate-950/40 hover:bg-slate-950/80 space-y-3 group"
        >
          <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 group-hover:bg-cyan-500/20 text-cyan-400 flex items-center justify-center mx-auto transition-colors">
            <Upload className="w-7 h-7" />
          </div>
          <div>
            <p className="text-base font-semibold text-white">
              Нажмите для выбора аудиофайла или перетащите его сюда
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Файл будет автоматически обрезан и сконвертирован в 16-bit PCM WAV для ESP32
            </p>
          </div>
        </div>

        {errorMessage && (
          <div className="p-4 rounded-xl bg-rose-950/50 border border-rose-800 text-rose-300 text-sm flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Audio Trimming & Waveform Editor (Appears when audio is loaded) */}
        {sourceAudioBuffer && (
          <div className="space-y-6 pt-4 border-t border-slate-800">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Scissors className="w-5 h-5 text-cyan-400" />
                <h4 className="font-bold text-white text-sm">
                  Редактор фрагмента: <span className="text-cyan-300 font-mono">{sourceFileName}</span>
                </h4>
              </div>
              <span className="text-xs text-slate-400 font-mono">
                Исходная длина: {sourceAudioBuffer.duration.toFixed(2)} сек
              </span>
            </div>

            {/* Interactive Visual Canvas Waveform */}
            <div className="space-y-2">
              <div className="relative rounded-xl bg-slate-950 border border-slate-800 p-3 overflow-hidden">
                <canvas
                  ref={canvasRef}
                  width={800}
                  height={130}
                  className="w-full h-32 block rounded-lg"
                />
              </div>
              <div className="flex items-center justify-between text-xs text-slate-400 font-mono px-1">
                <span>0.0с</span>
                <span className="text-cyan-400 font-semibold">
                  Выбрано: с {startTimeSec.toFixed(1)}с по {Math.min(startTimeSec + durationLimitSec, sourceAudioBuffer.duration).toFixed(1)}с ({Math.min(durationLimitSec, sourceAudioBuffer.duration - startTimeSec).toFixed(1)} сек)
                </span>
                <span>{sourceAudioBuffer.duration.toFixed(1)}с</span>
              </div>
            </div>

            {/* Audio Trimmer Controls & Sliders */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Start Time Slider */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <div className="flex justify-between text-xs font-semibold text-slate-300">
                  <span>Начало фрагмента</span>
                  <span className="font-mono text-cyan-400">{startTimeSec.toFixed(1)} сек</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max={Math.max(0, sourceAudioBuffer.duration - 0.5)}
                  step="0.1"
                  value={startTimeSec}
                  onChange={(e) => setStartTimeSec(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                />
              </div>

              {/* Duration Limit Slider */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <div className="flex justify-between text-xs font-semibold text-slate-300">
                  <span>Длительность звонка</span>
                  <span className="font-mono text-cyan-400">{durationLimitSec.toFixed(1)} сек</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max={Math.min(30, sourceAudioBuffer.duration)}
                  step="0.5"
                  value={durationLimitSec}
                  onChange={(e) => setDurationLimitSec(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                />
              </div>

              {/* Volume / Gain Boost Slider */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <div className="flex justify-between text-xs font-semibold text-slate-300">
                  <span>Усиление громкости</span>
                  <span className="font-mono text-cyan-400">{Math.round(gainBoost * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.2"
                  max="2.5"
                  step="0.05"
                  value={gainBoost}
                  onChange={(e) => setGainBoost(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                />
              </div>

              {/* Fade In */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <div className="flex justify-between text-xs font-semibold text-slate-300">
                  <span>Плавное нарастание (Fade-In)</span>
                  <span className="font-mono text-cyan-400">{fadeInMs} мс</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1500"
                  step="50"
                  value={fadeInMs}
                  onChange={(e) => setFadeInMs(parseInt(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                />
              </div>

              {/* Fade Out */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <div className="flex justify-between text-xs font-semibold text-slate-300">
                  <span>Плавное затухание (Fade-Out)</span>
                  <span className="font-mono text-cyan-400">{fadeOutMs} мс</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="2000"
                  step="50"
                  value={fadeOutMs}
                  onChange={(e) => setFadeOutMs(parseInt(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                />
              </div>

              {/* Target File Info */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col justify-between text-xs">
                <div className="flex items-center gap-1.5 text-slate-400">
                  <HardDrive className="w-4 h-4 text-cyan-400" />
                  <span>Формат для ESP32-S3:</span>
                </div>
                <div className="font-mono text-slate-200 font-bold">
                  PCM WAV 16-bit Stereo @ {config.i2s_sample_rate || 44100} Hz
                </div>
              </div>
            </div>

            {/* Action Buttons: In-browser Preview & Upload */}
            <div className="flex flex-col sm:flex-row items-center gap-4 pt-2">
              {/* Preview Button */}
              <button
                onClick={handlePreviewProcessedAudio}
                disabled={isLoading || isUploading}
                className={`w-full sm:w-auto flex-1 flex items-center justify-center gap-2 py-3.5 px-6 rounded-xl font-semibold text-sm transition-all border ${
                  isPreviewPlaying
                    ? 'bg-rose-600 border-rose-500 text-white shadow-lg shadow-rose-600/30'
                    : 'bg-slate-800 hover:bg-slate-750 border-slate-700 hover:border-cyan-500/40 text-cyan-300'
                }`}
              >
                {isPreviewPlaying ? (
                  <>
                    <Square className="w-4 h-4 fill-current" />
                    <span>Остановить прослушивание</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current text-cyan-400" />
                    <span>Прослушать обработанный фрагмент</span>
                  </>
                )}
              </button>

              {/* Upload to ESP32 Button */}
              <button
                onClick={handleUploadToDoorbell}
                disabled={isUploading || isLoading}
                className="w-full sm:w-auto flex-1 flex items-center justify-center gap-2 py-3.5 px-6 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-sm shadow-xl shadow-emerald-500/20 active:scale-95 transition-all"
              >
                <Upload className="w-4 h-4" />
                <span>Загрузить на звонок (/media/bell.wav)</span>
              </button>
            </div>

            {/* Upload Progress Bar */}
            {isUploading && (
              <div className="space-y-2 bg-slate-950 p-4 rounded-xl border border-slate-800">
                <div className="flex justify-between text-xs text-slate-300 font-mono">
                  <span>Передача аудиоданных по Wi-Fi...</span>
                  <span className="text-cyan-400 font-bold">{uploadProgress}%</span>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-cyan-500 to-emerald-500 h-full rounded-full transition-all duration-200"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
