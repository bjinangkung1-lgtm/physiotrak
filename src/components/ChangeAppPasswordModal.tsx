import React, { useState } from 'react';
import { KeyRound, Lock, Eye, EyeOff, X, AlertCircle, CheckCircle2, ShieldCheck, Loader2 } from 'lucide-react';
import { 
  verifyAppPasswordAsync, 
  setAppPasswordAsync, 
  getAppPassword, 
  DEFAULT_APP_PASSWORD 
} from '../utils/appAuthService';

interface ChangeAppPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccessToast?: (msg: string) => void;
}

export const ChangeAppPasswordModal: React.FC<ChangeAppPasswordModalProps> = ({
  isOpen,
  onClose,
  onSuccessToast,
}) => {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!oldPassword.trim()) {
      setErrorMessage('Silakan masukkan password lama!');
      return;
    }

    if (!newPassword || newPassword.trim().length < 3) {
      setErrorMessage('Password baru minimal 3 karakter!');
      return;
    }

    if (newPassword.trim() !== confirmPassword.trim()) {
      setErrorMessage('Konfirmasi password baru tidak cocok!');
      return;
    }

    setIsSubmitting(true);

    const isOldValid = await verifyAppPasswordAsync(oldPassword);
    if (!isOldValid) {
      setIsSubmitting(false);
      setErrorMessage('Password lama tidak sesuai!');
      return;
    }

    const success = await setAppPasswordAsync(newPassword.trim());
    setIsSubmitting(false);

    if (success) {
      setSuccessMessage('Password aplikasi berhasil diperbarui di seluruh perangkat!');
      if (onSuccessToast) onSuccessToast('Password aplikasi berhasil diperbarui di seluruh perangkat');
      setTimeout(() => {
        setOldPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setErrorMessage('');
        setSuccessMessage('');
        onClose();
      }, 1000);
    } else {
      setErrorMessage('Gagal menyimpan password baru.');
    }
  };

  return (
    <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-200">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">Ganti Password Aplikasi</h3>
              <p className="text-xs text-slate-500">Perbarui kunci akses masuk aplikasi IRM RSPP</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Password Lama Saat Ini:
            </label>
            <input
              type={showPasswords ? 'text' : 'password'}
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              placeholder="Masukkan password lama..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-teal-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Password Baru:
            </label>
            <input
              type={showPasswords ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Masukkan password baru (minimal 3 karakter)..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-teal-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Konfirmasi Password Baru:
            </label>
            <input
              type={showPasswords ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Ketik ulang password baru..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-teal-500"
              required
            />
          </div>

          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showPasswords}
                onChange={(e) => setShowPasswords(e.target.checked)}
                className="rounded text-teal-600 focus:ring-teal-500 cursor-pointer"
              />
              <span>Perlihatkan karakter password</span>
            </label>
          </div>

          {errorMessage && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-semibold flex items-center gap-1.5 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{successMessage}</span>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg cursor-pointer transition-all"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-lg shadow-sm cursor-pointer transition-all"
            >
              Simpan Password Baru
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
