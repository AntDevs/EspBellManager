import React, { useState, useEffect } from 'react';
import { 
  X, 
  ShieldCheck, 
  KeyRound, 
  Lock, 
  RefreshCw, 
  AlertCircle, 
  Sparkles,
  CheckCircle2
} from 'lucide-react';
import { generateRandomNonce, authenticateWithPassword, computeSha256 } from '../utils/cryptoAuth';
import { apiClient } from '../utils/apiClient';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  adminPasswordConfig: string;
  onLoginSuccess: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  adminPasswordConfig,
  onLoginSuccess,
}) => {
  const [password, setPassword] = useState('');
  const [nonce, setNonce] = useState('');
  const [computedHash, setComputedHash] = useState('');
  const [timeLeft, setTimeLeft] = useState(30);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const fetchFreshNonce = async () => {
    try {
      const res = await apiClient.getNonce();
      if (res.success && res.data?.nonce) {
        setNonce(res.data.nonce);
        setTimeLeft(res.data.ttl_sec || 30);
        return;
      }
    } catch {}
    // Fallback client nonce if offline
    setNonce(generateRandomNonce());
    setTimeLeft(30);
  };

  // Generate new nonce on open
  useEffect(() => {
    if (isOpen) {
      fetchFreshNonce();
      setPassword('');
      setComputedHash('');
      setErrorMessage(null);
    }
  }, [isOpen]);

  // Nonce TTL countdown timer
  useEffect(() => {
    if (!isOpen) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          fetchFreshNonce();
          return 30;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen]);

  // Compute live SHA-256 preview as user types password
  useEffect(() => {
    if (password && nonce) {
      computeSha256(password + nonce).then((h) => setComputedHash(h));
    } else {
      setComputedHash('');
    }
  }, [password, nonce]);

  if (!isOpen) return null;

  const handleRefreshNonce = () => {
    fetchFreshNonce();
    setErrorMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsVerifying(true);
    setErrorMessage(null);

    try {
      const userHash = await authenticateWithPassword(password, nonce);
      
      // Call real REST API /api/verify-auth
      const authRes = await apiClient.verifyAuth(userHash, nonce);

      if (authRes.success) {
        onLoginSuccess();
        onClose();
      } else {
        // Fallback local check
        const expectedHash = await authenticateWithPassword(adminPasswordConfig, nonce);
        if (userHash === expectedHash) {
          onLoginSuccess();
          onClose();
        } else {
          setErrorMessage('Неверный пароль администратора. Попробуйте еще раз.');
          fetchFreshNonce();
        }
      }
    } catch {
      setErrorMessage('Ошибка проверки подлинности токена.');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl space-y-6 relative">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800 hover:bg-slate-700 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-semibold">
            <Lock className="w-3.5 h-3.5" />
            <span>Протокол Nonce + SHA-256</span>
          </div>
          <h3 className="text-xl font-bold text-white tracking-tight">
            Вход администратора EspBellAdmin
          </h3>
          <p className="text-slate-400 text-xs">
            Защита от перехвата: пароль никогда не передается в открытом виде.
          </p>
        </div>

        {/* Cryptographic Challenge Card */}
        <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2.5 text-xs font-mono">
          <div className="flex items-center justify-between text-slate-400">
            <span>Одноразовый Nonce (8 байт):</span>
            <button
              type="button"
              onClick={handleRefreshNonce}
              className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
              title="Обновить Nonce"
            >
              <RefreshCw className="w-3 h-3" />
              <span>{timeLeft}с</span>
            </button>
          </div>

          <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800/80 text-cyan-300 font-bold tracking-wider select-all">
            {nonce}
          </div>

          {computedHash && (
            <div className="space-y-1 pt-1">
              <span className="text-slate-500 text-[10px]">Вычисленный SHA-256 хэш:</span>
              <div className="text-[10px] text-emerald-400 break-all bg-slate-900/60 p-1.5 rounded border border-slate-800">
                {computedHash}
              </div>
            </div>
          )}
        </div>

        {errorMessage && (
          <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-300">
              Пароль администратора (по умолч.: <span className="text-cyan-400 font-mono">{adminPasswordConfig}</span>)
            </label>
            <input
              type="password"
              placeholder="Введите пароль..."
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500 font-mono"
              autoFocus
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
            >
              Отмена
            </button>

            <button
              type="submit"
              disabled={!password || isVerifying}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs shadow-lg shadow-cyan-500/25 active:scale-95 disabled:opacity-50 transition-all"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>{isVerifying ? 'Проверка...' : 'Войти в панель'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
