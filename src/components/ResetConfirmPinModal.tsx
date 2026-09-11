import React, { useState, useEffect, useRef } from 'react';
import { 
  Lock, 
  KeyRound, 
  Trash2, 
  AlertTriangle, 
  CheckCircle2, 
  Eye, 
  EyeOff, 
  History, 
  Settings2, 
  X, 
  ShieldAlert
} from 'lucide-react';
import { QueueBox, PatientItem } from '../types';

export const PIN_STORAGE_KEY = 'antrian_irm_security_pin_v1';
export const RESET_AUDIT_STORAGE_KEY = 'antrian_irm_reset_audit_trail_v1';
const DEFAULT_PIN = '1234';

export interface ResetAuditRecord {
  id: string;
  timestamp: string;
  activePatientsCount: number;
  completedPatientsCount: number;
  totalBoxesCount: number;
}

export const getSecurityPin = (): string => {
  try {
    return localStorage.getItem(PIN_STORAGE_KEY) || DEFAULT_PIN;
  } catch {
    return DEFAULT_PIN;
  }
};

export const setSecurityPin = (newPin: string): boolean => {
  try {
    localStorage.setItem(PIN_STORAGE_KEY, newPin);
    return true;
  } catch {
    return false;
  }
};

export const getLastResetAudit = (): ResetAuditRecord | null => {
  try {
    const raw = localStorage.getItem(RESET_AUDIT_STORAGE_KEY);
    if (!raw) return null;
    const list: ResetAuditRecord[] = JSON.parse(raw);
    return list && list.length > 0 ? list[0] : null;
  } catch {
    return null;
  }
};

export const saveResetAudit = (record: Omit<ResetAuditRecord, 'id' | 'timestamp'>): void => {
  try {
    const newRecord: ResetAuditRecord = {
      ...record,
      id: `audit-${Date.now()}`,
      timestamp: new Date().toISOString(),
    };
    const raw = localStorage.getItem(RESET_AUDIT_STORAGE_KEY);
    const list: ResetAuditRecord[] = raw ? JSON.parse(raw) : [];
    list.unshift(newRecord);
    // Keep last 30 logs
    localStorage.setItem(RESET_AUDIT_STORAGE_KEY, JSON.stringify(list.slice(0, 30)));
  } catch (err) {
    console.error('Failed to save reset audit', err);
  }
};

interface ResetConfirmPinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmReset: () => void;
  boxes: QueueBox[];
  patients: PatientItem[];
}

export const ResetConfirmPinModal: React.FC<ResetConfirmPinModalProps> = ({
  isOpen,
  onClose,
  onConfirmReset,
  boxes,
  patients,
}) => {
  const [pinInput, setPinInput] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isShaking, setIsShaking] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  
  // Change PIN mode
  const [isChangingPin, setIsChangingPin] = useState(false);
  const [oldPinInput, setOldPinInput] = useState('');
  const [newPinInput, setNewPinInput] = useState('');
  const [confirmNewPinInput, setConfirmNewPinInput] = useState('');
  const [changePinMessage, setChangePinMessage] = useState<{ text: string; type: 'error' | 'success' } | null>(null);

  // History / Audit log view
  const [showAuditHistory, setShowAuditHistory] = useState(false);
  const [auditList, setAuditList] = useState<ResetAuditRecord[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);

  const activeCount = patients.filter(p => !p.completed).length;
  const completedCount = patients.filter(p => p.completed).length;
  const lastAudit = getLastResetAudit();

  useEffect(() => {
    if (isOpen) {
      setPinInput('');
      setErrorMessage('');
      setIsChangingPin(false);
      setShowAuditHistory(false);
      setIsSuccess(false);
      setChangePinMessage(null);

      // Load audit logs
      try {
        const raw = localStorage.getItem(RESET_AUDIT_STORAGE_KEY);
        if (raw) {
          setAuditList(JSON.parse(raw));
        }
      } catch {
        setAuditList([]);
      }

      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleExecuteReset = () => {
    setErrorMessage('');
    const currentPin = getSecurityPin();

    if (!pinInput.trim()) {
      setErrorMessage('Masukkan 4 digit PIN keamanan');
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
      return;
    }

    if (pinInput.trim() !== currentPin) {
      setErrorMessage('PIN Salah! Silakan coba lagi.');
      setIsShaking(true);
      setPinInput('');
      setTimeout(() => setIsShaking(false), 500);
      return;
    }

    // Save audit record
    saveResetAudit({
      activePatientsCount: activeCount,
      completedPatientsCount: completedCount,
      totalBoxesCount: boxes.length,
    });

    setIsSuccess(true);
    // Execute reset immediately
    onConfirmReset();
    setTimeout(() => {
      onClose();
    }, 150);
  };

  const handleKeypadPress = (digit: string) => {
    if (pinInput.length < 8) {
      const next = pinInput + digit;
      setPinInput(next);
      setErrorMessage('');
    }
  };

  const handleKeypadBackspace = () => {
    setPinInput(prev => prev.slice(0, -1));
    setErrorMessage('');
  };

  const handleKeypadClear = () => {
    setPinInput('');
    setErrorMessage('');
  };

  const handleChangePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setChangePinMessage(null);
    const currentPin = getSecurityPin();

    if (oldPinInput.trim() !== currentPin) {
      setChangePinMessage({ text: 'PIN Lama tidak sesuai!', type: 'error' });
      return;
    }

    if (newPinInput.length < 4) {
      setChangePinMessage({ text: 'PIN Baru minimal 4 digit angka!', type: 'error' });
      return;
    }

    if (newPinInput !== confirmNewPinInput) {
      setChangePinMessage({ text: 'Konfirmasi PIN Baru tidak cocok!', type: 'error' });
      return;
    }

    setSecurityPin(newPinInput);
    setChangePinMessage({ text: 'PIN Keamanan berhasil diubah!', type: 'success' });
    setTimeout(() => {
      setIsChangingPin(false);
      setOldPinInput('');
      setNewPinInput('');
      setConfirmNewPinInput('');
      setChangePinMessage(null);
      setPinInput('');
    }, 1200);
  };

  const formatTimestamp = (iso: string) => {
    try {
      const date = new Date(iso);
      return date.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="fixed inset-0 z-70 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div 
        className={`bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col transition-all ${
          isShaking ? 'animate-shake ring-2 ring-rose-500' : ''
        }`}
      >
        {/* Header Bar */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-between border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center shrink-0 shadow-xs">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black tracking-tight text-white flex items-center gap-1.5">
                <span>Otorisasi PIN Pembersihan</span>
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

        {/* Content Body */}
        <div className="p-4 sm:p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* View: Change PIN Form */}
          {isChangingPin ? (
            <form onSubmit={handleChangePinSubmit} className="space-y-3.5">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2 text-slate-800 font-bold text-xs">
                  <KeyRound className="w-4 h-4 text-teal-600" />
                  <span>Pengaturan Ganti PIN Keamanan</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsChangingPin(false)}
                  className="text-xs text-teal-700 hover:text-teal-900 font-bold cursor-pointer"
                >
                  Kembali
                </button>
              </div>

              {changePinMessage && (
                <div className={`p-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                  changePinMessage.type === 'success' 
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}>
                  {changePinMessage.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  )}
                  <span>{changePinMessage.text}</span>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  PIN Lama Saat Ini:
                </label>
                <input
                  type="password"
                  value={oldPinInput}
                  onChange={(e) => setOldPinInput(e.target.value)}
                  placeholder="Masukkan PIN lama (default: 1234)"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  PIN Baru (Minimal 4 Angka):
                </label>
                <input
                  type="password"
                  value={newPinInput}
                  onChange={(e) => setNewPinInput(e.target.value)}
                  placeholder="Masukkan PIN baru"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Konfirmasi PIN Baru:
                </label>
                <input
                  type="password"
                  value={confirmNewPinInput}
                  onChange={(e) => setConfirmNewPinInput(e.target.value)}
                  placeholder="Ulangi PIN baru"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  required
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsChangingPin(false)}
                  className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer"
                >
                  Simpan PIN Baru
                </button>
              </div>
            </form>
          ) : showAuditHistory ? (
            /* View: Audit Log History */
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2 text-slate-800 font-bold text-xs">
                  <History className="w-4 h-4 text-indigo-600" />
                  <span>Riwayat Audit Eksekusi Pembersihan</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAuditHistory(false)}
                  className="text-xs text-indigo-700 hover:text-indigo-900 font-bold cursor-pointer"
                >
                  Kembali ke PIN
                </button>
              </div>

              {auditList.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400">
                  Belum ada catatan riwayat pembersihan antrean.
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {auditList.map((log) => (
                    <div key={log.id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs flex flex-col gap-1">
                      <div className="flex items-center justify-between font-bold text-slate-800">
                        <span className="flex items-center gap-1.5 text-slate-700">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          Pembersihan Berhasil
                        </span>
                        <span className="text-[10px] text-slate-400 font-normal">
                          {formatTimestamp(log.timestamp)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-slate-500">
                        <span>Data dibersihkan: {log.activePatientsCount} antre, {log.completedPatientsCount} selesai</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* View: Main PIN Verification Form */
            <>
              {/* Warning Context Banner */}
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-900">
                  <p className="font-bold">Konfirmasi Pembersihan Antrean Hari Ini</p>
                  <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                    Aksi ini akan mengosongkan <strong>{activeCount} pasien aktif</strong> dan <strong>{completedCount} pasien selesai</strong> di seluruh papan antrean & TV. Master Data Pasien tetap aman tersimpan.
                  </p>
                </div>
              </div>

              {/* PIN Input Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-slate-500" />
                    <span>Masukkan PIN Keamanan:</span>
                  </label>
                  <span className="text-[10px] text-slate-400 font-medium">
                    Default PIN: <strong className="text-slate-600 font-mono">1234</strong>
                  </span>
                </div>

                <div className="relative">
                  <input
                    ref={inputRef}
                    type={showPin ? 'text' : 'password'}
                    value={pinInput}
                    onChange={(e) => {
                      setPinInput(e.target.value);
                      setErrorMessage('');
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleExecuteReset();
                      }
                    }}
                    placeholder="••••"
                    maxLength={8}
                    className="w-full px-4 py-2.5 text-center text-lg font-mono font-black tracking-widest bg-slate-50 border-2 border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-rose-500 focus:bg-white focus:outline-none transition-all placeholder:text-slate-300"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPin(!showPin)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                    title={showPin ? 'Sembunyikan PIN' : 'Tampilkan PIN'}
                  >
                    {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {errorMessage && (
                  <p className="text-xs text-rose-600 font-bold flex items-center justify-center gap-1 animate-pulse">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>{errorMessage}</span>
                  </p>
                )}
              </div>

              {/* Quick On-Screen Numpad for Touchscreen / Fast Input */}
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                <div className="grid grid-cols-3 gap-1.5">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                    <button
                      key={digit}
                      type="button"
                      onClick={() => handleKeypadPress(digit)}
                      className="py-2 bg-white hover:bg-slate-100 active:bg-slate-200 border border-slate-200 rounded-lg text-sm font-black text-slate-800 shadow-2xs cursor-pointer transition-all active:scale-95"
                    >
                      {digit}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={handleKeypadClear}
                    className="py-2 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 cursor-pointer transition-all active:scale-95"
                    title="Clear"
                  >
                    C
                  </button>
                  <button
                    type="button"
                    onClick={() => handleKeypadPress('0')}
                    className="py-2 bg-white hover:bg-slate-100 active:bg-slate-200 border border-slate-200 rounded-lg text-sm font-black text-slate-800 shadow-2xs cursor-pointer transition-all active:scale-95"
                  >
                    0
                  </button>
                  <button
                    type="button"
                    onClick={handleKeypadBackspace}
                    className="py-2 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 cursor-pointer transition-all active:scale-95"
                    title="Backspace"
                  >
                    ⌫
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
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
                  onClick={handleExecuteReset}
                  disabled={isSuccess}
                  className={`flex-1 py-2.5 text-white text-xs font-black rounded-xl shadow-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    isSuccess 
                      ? 'bg-emerald-600' 
                      : 'bg-gradient-to-r from-rose-600 to-red-700 hover:from-rose-700 hover:to-red-800 active:scale-98'
                  }`}
                >
                  {isSuccess ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-white animate-bounce" />
                      <span>PIN Valid, Membersihkan...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      <span>Verifikasi & Bersihkan</span>
                    </>
                  )}
                </button>
              </div>

              {/* Footer Tools: Change PIN & Audit Log */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                <button
                  type="button"
                  onClick={() => setIsChangingPin(true)}
                  className="flex items-center gap-1 text-slate-600 hover:text-slate-900 font-semibold cursor-pointer"
                >
                  <Settings2 className="w-3.5 h-3.5" />
                  <span>Ubah PIN</span>
                </button>

                {lastAudit ? (
                  <button
                    type="button"
                    onClick={() => setShowAuditHistory(true)}
                    className="flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-bold cursor-pointer"
                    title="Lihat riwayat pembersihan sebelumnya"
                  >
                    <History className="w-3.5 h-3.5" />
                    <span>Riwayat Audit</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowAuditHistory(true)}
                    className="flex items-center gap-1 text-slate-400 hover:text-slate-600 font-medium cursor-pointer"
                  >
                    <History className="w-3.5 h-3.5" />
                    <span>Riwayat Audit</span>
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
