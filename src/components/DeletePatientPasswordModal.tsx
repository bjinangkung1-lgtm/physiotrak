import React, { useState, useEffect, useRef } from 'react';
import {
  Lock,
  KeyRound,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Eye,
  EyeOff,
  Settings2,
  X,
} from 'lucide-react';

export const DELETE_PATIENT_PASSWORD_STORAGE_KEY = 'antrian_irm_delete_patient_password_v1';
// Password default dibuat acak & tidak ditampilkan di mana pun pada UI (beda dari PIN
// reset lama yang menampilkan "Default PIN: 1234" langsung di layar - itu membuat
// PIN-nya percuma karena siapa pun yang membuka layar konfirmasi bisa langsung membacanya).
const DEFAULT_DELETE_PASSWORD = 'RBaf8336tB';

export const getDeletePatientPassword = (): string => {
  try {
    return localStorage.getItem(DELETE_PATIENT_PASSWORD_STORAGE_KEY) || DEFAULT_DELETE_PASSWORD;
  } catch {
    return DEFAULT_DELETE_PASSWORD;
  }
};

export const setDeletePatientPassword = (newPassword: string): boolean => {
  try {
    localStorage.setItem(DELETE_PATIENT_PASSWORD_STORAGE_KEY, newPassword);
    return true;
  } catch {
    return false;
  }
};

interface DeletePatientPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmDelete: () => void;
  patientName?: string;
  title?: string;
  confirmLabel?: string;
  warningTitle?: string;
  warningBody?: string;
}

export const DeletePatientPasswordModal: React.FC<DeletePatientPasswordModalProps> = ({
  isOpen,
  onClose,
  onConfirmDelete,
  patientName,
  title = 'Otorisasi Hapus Pasien',
  confirmLabel = 'OK, Hapus Pasien',
  warningTitle = 'Konfirmasi Hapus Pasien',
  warningBody,
}) => {
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isShaking, setIsShaking] = useState(false);

  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [oldPasswordInput, setOldPasswordInput] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [confirmNewPasswordInput, setConfirmNewPasswordInput] = useState('');
  const [changePasswordMessage, setChangePasswordMessage] = useState<{ text: string; type: 'error' | 'success' } | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setPasswordInput('');
      setErrorMessage('');
      setIsChangingPassword(false);
      setOldPasswordInput('');
      setNewPasswordInput('');
      setConfirmNewPasswordInput('');
      setChangePasswordMessage(null);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    setErrorMessage('');
    const currentPassword = getDeletePatientPassword();

    if (!passwordInput.trim()) {
      setErrorMessage('Masukkan password terlebih dahulu');
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
      return;
    }

    if (passwordInput !== currentPassword) {
      setErrorMessage('Password salah! Silakan coba lagi.');
      setIsShaking(true);
      setPasswordInput('');
      setTimeout(() => setIsShaking(false), 500);
      return;
    }

    onConfirmDelete();
    onClose();
  };

  const handleChangePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setChangePasswordMessage(null);
    const currentPassword = getDeletePatientPassword();

    if (oldPasswordInput !== currentPassword) {
      setChangePasswordMessage({ text: 'Password lama tidak sesuai!', type: 'error' });
      return;
    }

    if (newPasswordInput.length < 6) {
      setChangePasswordMessage({ text: 'Password baru minimal 6 karakter!', type: 'error' });
      return;
    }

    if (newPasswordInput !== confirmNewPasswordInput) {
      setChangePasswordMessage({ text: 'Konfirmasi password baru tidak cocok!', type: 'error' });
      return;
    }

    setDeletePatientPassword(newPasswordInput);
    setChangePasswordMessage({ text: 'Password berhasil diubah!', type: 'success' });
    setTimeout(() => {
      setIsChangingPassword(false);
      setOldPasswordInput('');
      setNewPasswordInput('');
      setConfirmNewPasswordInput('');
      setChangePasswordMessage(null);
      setPasswordInput('');
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-70 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div
        className={`bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col transition-all ${
          isShaking ? 'animate-shake ring-2 ring-rose-500' : ''
        }`}
      >
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-between border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center shrink-0 shadow-xs">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black tracking-tight text-white">
                {title}
              </h2>
              <p className="text-[11px] text-slate-300 font-medium">
                Sistem Antrian & Rekam Medis IRM RSPP
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
            title="Tutup"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 sm:p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {isChangingPassword ? (
            <form onSubmit={handleChangePasswordSubmit} className="space-y-3.5">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2 text-slate-800 font-bold text-xs">
                  <KeyRound className="w-4 h-4 text-teal-600" />
                  <span>Ganti Password Hapus Pasien</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsChangingPassword(false)}
                  className="text-xs text-teal-700 hover:text-teal-900 font-bold cursor-pointer"
                >
                  Kembali
                </button>
              </div>

              {changePasswordMessage && (
                <div className={`p-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                  changePasswordMessage.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}>
                  {changePasswordMessage.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  )}
                  <span>{changePasswordMessage.text}</span>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Password Lama Saat Ini:
                </label>
                <input
                  type="password"
                  value={oldPasswordInput}
                  onChange={(e) => setOldPasswordInput(e.target.value)}
                  placeholder="Masukkan password lama"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Password Baru (Minimal 6 Karakter):
                </label>
                <input
                  type="password"
                  value={newPasswordInput}
                  onChange={(e) => setNewPasswordInput(e.target.value)}
                  placeholder="Masukkan password baru"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Konfirmasi Password Baru:
                </label>
                <input
                  type="password"
                  value={confirmNewPasswordInput}
                  onChange={(e) => setConfirmNewPasswordInput(e.target.value)}
                  placeholder="Ulangi password baru"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  required
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsChangingPassword(false)}
                  className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer"
                >
                  Simpan Password Baru
                </button>
              </div>
            </form>
          ) : (
            <>
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-900">
                  <p className="font-bold">{warningTitle}</p>
                  <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                    {warningBody || (
                      <>Pasien{patientName ? <> <strong>{patientName}</strong></> : ''} akan dihapus permanen dari antrean di seluruh perangkat. Masukkan password otorisasi untuk melanjutkan.</>
                    )}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-slate-500" />
                  <span>Masukkan Password:</span>
                </label>

                <div className="relative">
                  <input
                    ref={inputRef}
                    type={showPassword ? 'text' : 'password'}
                    value={passwordInput}
                    onChange={(e) => {
                      setPasswordInput(e.target.value);
                      setErrorMessage('');
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleConfirm();
                      }
                    }}
                    placeholder="Password"
                    className="w-full px-4 py-2.5 pr-10 text-sm font-mono font-bold bg-slate-50 border-2 border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-rose-500 focus:bg-white focus:outline-none transition-all placeholder:text-slate-300"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                    title={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {errorMessage && (
                  <p className="text-xs text-rose-600 font-bold flex items-center justify-center gap-1 animate-pulse">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>{errorMessage}</span>
                  </p>
                )}
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer transition-colors"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  className="flex-1 py-2.5 bg-gradient-to-r from-rose-600 to-red-700 hover:from-rose-700 hover:to-red-800 active:scale-98 text-white text-xs font-black rounded-xl shadow-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>{confirmLabel}</span>
                </button>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-end text-[11px] text-slate-500">
                <button
                  type="button"
                  onClick={() => setIsChangingPassword(true)}
                  className="flex items-center gap-1 text-slate-600 hover:text-slate-900 font-semibold cursor-pointer"
                >
                  <Settings2 className="w-3.5 h-3.5" />
                  <span>Ubah Password</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
