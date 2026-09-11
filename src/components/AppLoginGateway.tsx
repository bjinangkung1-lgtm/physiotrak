import React, { useState, useEffect } from 'react';
import { 
  Lock, 
  Unlock, 
  Eye, 
  EyeOff, 
  ShieldCheck, 
  Tv, 
  AlertCircle, 
  Hospital, 
  ArrowRight,
  Shield,
  Loader2
} from 'lucide-react';
import { 
  verifyAppPasswordAsync,
  syncAppPasswordFromCloud,
  fetchAppPasswordFromCloud,
  setAppAuthenticated, 
  DEFAULT_APP_PASSWORD,
  getAppPassword
} from '../utils/appAuthService';
import { cloudDatabaseService } from '../utils/cloudDatabaseService';

interface AppLoginGatewayProps {
  onLoginSuccess: (officerName: string) => void;
  onOpenTVDisplay: () => void;
}

export const AppLoginGateway: React.FC<AppLoginGatewayProps> = ({
  onLoginSuccess,
  onOpenTVDisplay,
}) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Early hydration: Fetch & subscribe to Cloud Firestore & Express API password immediately when login screen opens
  useEffect(() => {
    let isMounted = true;
    
    // Initial fetch from cloud and backend
    fetchAppPasswordFromCloud().catch(() => {});

    // Realtime snapshot listener from Cloud Firestore
    const unsubscribe = cloudDatabaseService.subscribeSecurityConfig(sec => {
      if (isMounted && sec?.appPassword) {
        syncAppPasswordFromCloud(sec.appPassword);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!password.trim()) {
      setErrorMessage('Silakan ketik password untuk membuka aplikasi');
      return;
    }

    setIsSubmitting(true);

    try {
      const isValid = await verifyAppPasswordAsync(password);
      if (isValid) {
        const unifiedAccountName = 'Petugas IRM RSPP';
        setAppAuthenticated(rememberMe, unifiedAccountName);
        onLoginSuccess(unifiedAccountName);
      } else {
        const currentLocal = getAppPassword();
        if (currentLocal === DEFAULT_APP_PASSWORD) {
          setErrorMessage(`Password salah. Gunakan password default "${DEFAULT_APP_PASSWORD}" atau hubungi admin.`);
        } else {
          setErrorMessage('Password salah. Silakan masukkan password master yang aktif di rumah sakit atau hubungi admin.');
        }
      }
    } catch (err) {
      setErrorMessage('Terjadi kesalahan verifikasi. Silakan coba lagi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-linear-to-br from-slate-900 via-slate-800 to-teal-950 flex flex-col justify-between p-4 sm:p-6 md:p-8 text-slate-100">
      {/* Top Brand Bar */}
      <header className="w-full max-w-5xl mx-auto flex items-center justify-between py-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-600/90 text-white flex items-center justify-center shadow-lg shadow-teal-500/20 border border-teal-400/30">
            <Hospital className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-black tracking-tight text-white uppercase">
                Instalasi Rehabilitasi Medis
              </h1>
              <span className="bg-teal-500/20 text-teal-300 text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-teal-500/40">
                RSPP
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">
              Sistem Antrean Terpadu &amp; Manajemen Pasien
            </p>
          </div>
        </div>

        {/* Direct TV Display Mode Link for Waiting Hall Monitors */}
        <button
          type="button"
          onClick={onOpenTVDisplay}
          className="px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-teal-300 hover:text-white border border-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
          title="Buka Mode Tampilan TV Monitor Ruang Tunggu"
        >
          <Tv className="w-3.5 h-3.5 text-teal-400" />
          <span className="hidden sm:inline">Mode Layar TV</span>
        </button>
      </header>

      {/* Main Center Login Card */}
      <main className="w-full max-w-md mx-auto my-auto py-6">
        <div className="bg-white text-slate-900 rounded-3xl shadow-2xl border border-slate-200/80 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          {/* Card Header Banner */}
          <div className="bg-linear-to-r from-teal-800 to-slate-900 p-6 text-white text-center relative">
            <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-xs border border-white/20 text-teal-300 flex items-center justify-center mx-auto mb-3 shadow-inner">
              <Lock className="w-7 h-7" />
            </div>
            <h2 className="text-lg sm:text-xl font-black tracking-tight text-white">
              Akses Masuk Petugas
            </h2>
            <p className="text-xs text-teal-100/80 mt-1 max-w-xs mx-auto leading-relaxed">
              Masukkan password master untuk membuka portal antrean &amp; rekam pelayanan IRM RSPP
            </p>
          </div>

          {/* Form Content */}
          <form onSubmit={handleSubmit} className="p-6 sm:p-7 space-y-4">
            {/* Unified Account Badge */}
            <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-teal-700 text-white flex items-center justify-center shrink-0 shadow-2xs">
                <Shield className="w-4 h-4" />
              </div>
              <div className="text-left">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Akun Layanan</span>
                <span className="text-xs font-black text-slate-900">Petugas IRM RSPP (Shared Access)</span>
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Password Aplikasi:
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errorMessage) setErrorMessage('');
                  }}
                  autoFocus
                  placeholder="Ketik password aplikasi..."
                  className={`w-full pl-3.5 pr-11 py-2.5 border rounded-xl text-sm font-semibold text-slate-900 focus:outline-hidden focus:ring-2 transition-all ${
                    errorMessage
                      ? 'border-rose-400 bg-rose-50/50 focus:ring-rose-400'
                      : 'border-slate-300 bg-white focus:ring-teal-500'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-all cursor-pointer"
                  title={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {errorMessage && (
                <div className="flex items-start gap-1.5 text-rose-600 text-xs font-semibold mt-2 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}
            </div>

            {/* Remember Me Option */}
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 border-slate-300 cursor-pointer"
                />
                <span>Ingat login di perangkat ini</span>
              </label>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 px-4 bg-teal-600 hover:bg-teal-700 active:scale-[0.99] text-white font-black text-sm rounded-xl shadow-lg shadow-teal-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-75"
              >
                {isSubmitting ? (
                  <>
                    <Unlock className="w-4 h-4 animate-spin" />
                    <span>Membuka Portal...</span>
                  </>
                ) : (
                  <>
                    <Unlock className="w-4 h-4" />
                    <span>Buka Portal Aplikasi</span>
                    <ArrowRight className="w-4 h-4 ml-0.5" />
                  </>
                )}
              </button>
            </div>

            {/* Default Password Info Box */}
            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-[11px] leading-relaxed">
                <span className="font-bold">Password Standar:</span> Gunakan password default{' '}
                <code className="px-1.5 py-0.5 bg-white rounded border border-amber-300 font-mono font-black text-amber-950">
                  {DEFAULT_APP_PASSWORD}
                </code>{' '}
                (jika belum pernah diubah). Anda dapat mengubah password ini kapan saja melalui menu pengaturan di header.
              </div>
            </div>
          </form>
        </div>
      </main>

      {/* Footer Info */}
      <footer className="w-full max-w-5xl mx-auto text-center py-2 text-xs text-slate-400">
        <p className="flex items-center justify-center gap-2 flex-wrap">
          <span>&copy; 2026 Instalasi Rehabilitasi Medis RS Pusat Pertamina</span>
          <span>&bull;</span>
          <span className="text-teal-400 font-semibold flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
            Cloud Database &amp; Real-time Sync Active
          </span>
        </p>
      </footer>
    </div>
  );
};
