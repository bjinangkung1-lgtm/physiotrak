import React from 'react';
import { 
  X, 
  FileText, 
  Users, 
  Timer, 
  Activity, 
  QrCode, 
  History, 
  Volume2, 
  FolderPlus, 
  Trash2, 
  Bell,
  Download,
  CheckCircle2,
  Sparkles,
  Smartphone,
  Tv,
  Package,
  Database,
  Lock,
  KeyRound,
  UserCheck,
  BookOpen
} from 'lucide-react';
import { getActiveOfficerName } from '../utils/appAuthService';

interface MobileMoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenDailyDatabase?: () => void;
  onOpenReport?: () => void;
  onOpenMonthlyReport?: () => void;
  onOpenResponseTimeAnalytics?: () => void;
  onOpenIntelligence?: () => void;
  onOpenGeneralQR?: () => void;
  onOpenGlobalHistory: () => void;
  onOpenAddBox: () => void;
  onOpenTVDisplay?: () => void;
  onOpenInventory?: () => void;
  onOpenLainLain?: (tab?: 'kas' | 'rotasi' | 'sabtu' | 'cuti') => void;
  onOpenSop?: () => void;
  onResetAllData?: () => void;
  onLockApp?: () => void;
  onOpenChangePassword?: () => void;
  avgWaitMinutes?: number;
  overloadCount?: number;
  totalActiveCount?: number;
  totalCompletedCount?: number;
  isRealtimeConnected?: boolean;
}

export const MobileMoreModal: React.FC<MobileMoreModalProps> = ({
  isOpen,
  onClose,
  onOpenDailyDatabase,
  onOpenReport,
  onOpenMonthlyReport,
  onOpenResponseTimeAnalytics,
  onOpenIntelligence,
  onOpenGeneralQR,
  onOpenGlobalHistory,
  onOpenAddBox,
  onOpenTVDisplay,
  onOpenInventory,
  onOpenLainLain,
  onOpenSop,
  onResetAllData,
  onLockApp,
  onOpenChangePassword,
  avgWaitMinutes = 0,
  overloadCount = 0,
  totalActiveCount = 0,
  totalCompletedCount = 0,
  isRealtimeConnected = false,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div 
        className="w-full max-w-lg bg-white rounded-t-3xl sm:rounded-2xl p-5 shadow-2xl border border-slate-200 max-h-[85vh] overflow-y-auto space-y-4 animate-in slide-in-from-bottom duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-xs">
              IRM
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900">Menu & Fitur Lengkap</h3>
              <p className="text-[11px] text-slate-500">Instalasi Rehabilitasi Medis RSPP</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Active Logged In Officer Badge */}
        <div className="p-2.5 bg-teal-50/80 rounded-xl border border-teal-200/80 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-teal-600 text-white flex items-center justify-center shadow-xs">
              <UserCheck className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] text-teal-700 font-bold uppercase tracking-wider block">Petugas Aktif</span>
              <span className="text-xs font-black text-slate-900">{getActiveOfficerName()}</span>
            </div>
          </div>
          {onLockApp && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onLockApp();
              }}
              className="px-2.5 py-1 bg-white hover:bg-amber-50 text-amber-900 border border-amber-300 rounded-lg text-[11px] font-bold shadow-2xs transition-all flex items-center gap-1 cursor-pointer"
            >
              <Lock className="w-3 h-3 text-amber-600" />
              <span>Logout</span>
            </button>
          )}
        </div>

        {/* Live Status Pill */}
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${isRealtimeConnected ? 'bg-emerald-500 animate-ping' : 'bg-amber-500'}`} />
            <span className="font-bold text-slate-800">
              {isRealtimeConnected ? '☁️ Cloud Firestore Terhubung' : 'Mode Lokal'}
            </span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-600 font-semibold">
            <span>Antri: <strong className="text-blue-600">{totalActiveCount}</strong></span>
            <span>•</span>
            <span>Selesai: <strong className="text-emerald-600">{totalCompletedCount}</strong></span>
          </div>
        </div>

        {/* Menu Grid */}
        <div className="grid grid-cols-2 gap-2.5">
          {/* Lain-Lain Hub Button */}
          {onOpenLainLain && (
            <button
              onClick={() => {
                onClose();
                onOpenLainLain('kas');
              }}
              className="col-span-2 p-3 bg-gradient-to-r from-teal-800 to-emerald-800 hover:from-teal-900 hover:to-emerald-900 text-white rounded-xl border border-teal-600 flex items-center justify-between transition-all cursor-pointer shadow-xs"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-teal-950/60 text-teal-300 flex items-center justify-center border border-teal-500/30">
                  <Sparkles className="w-4 h-4 text-teal-300" />
                </div>
                <div className="text-left">
                  <span className="text-xs font-bold block text-white">Menu Lain-Lain</span>
                  <span className="text-[10px] text-teal-200">1. Kas IRM • 2. Rotasi • 3. Sabtu • 4. Cuti</span>
                </div>
              </div>
              <span className="text-[10px] bg-teal-900 text-teal-200 font-bold px-2 py-0.5 rounded-full border border-teal-500/30">
                Buka
              </span>
            </button>
          )}

          {/* Inventaris & Stok IRM Button */}
          {onOpenInventory && (
            <button
              onClick={() => {
                onClose();
                onOpenInventory();
              }}
              className="col-span-2 p-3 bg-amber-50 hover:bg-amber-100/90 rounded-xl border border-amber-300 flex items-center justify-between transition-all cursor-pointer shadow-2xs"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-600 text-white flex items-center justify-center shadow-xs">
                  <Package className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <span className="text-xs font-black text-amber-950 block">Inventaris &amp; Stok IRM</span>
                  <span className="text-[10px] text-amber-800">Alat FT/OT/TW, BMHP &amp; Logistik ATK</span>
                </div>
              </div>
              <span className="text-[10px] bg-amber-200 text-amber-950 font-black px-2 py-0.5 rounded-full border border-amber-300">
                Buka
              </span>
            </button>
          )}

          {/* Database Pasien & Master RM */}
          {onOpenDailyDatabase && (
            <button
              onClick={() => {
                onClose();
                onOpenDailyDatabase();
              }}
              className="col-span-2 p-3 bg-teal-50/90 hover:bg-teal-100/90 rounded-xl border border-teal-300 flex items-center justify-between transition-all cursor-pointer shadow-2xs"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-teal-700 text-white flex items-center justify-center shadow-xs">
                  <Database className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-black text-teal-950 block">Database Pasien &amp; Master RM</span>
                    <span className="text-[9px] font-extrabold bg-teal-200 text-teal-900 px-1.5 py-0.2 rounded shrink-0">
                      🔒 Password
                    </span>
                  </div>
                  <span className="text-[10px] text-teal-800">Register harian, master pasien &amp; rekam terapi</span>
                </div>
              </div>
              <span className="text-[10px] bg-teal-200 text-teal-950 font-black px-2 py-0.5 rounded-full border border-teal-300">
                Buka
              </span>
            </button>
          )}

          {/* 2. Bulanan Terapis */}
          {onOpenMonthlyReport && (
            <button
              onClick={() => {
                onClose();
                onOpenMonthlyReport();
              }}
              className="p-3 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 flex flex-col items-start gap-1.5 text-left transition-all cursor-pointer"
            >
              <div className="w-7 h-7 rounded-lg bg-teal-100 text-teal-800 flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-900 block">Bulanan Terapis</span>
                <span className="text-[10px] text-slate-500">Rekap per petugas</span>
              </div>
            </button>
          )}

          {/* 3. Respon Time & SPM */}
          {onOpenResponseTimeAnalytics && (
            <button
              onClick={() => {
                onClose();
                onOpenResponseTimeAnalytics();
              }}
              className="p-3 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 flex flex-col items-start gap-1.5 text-left transition-all cursor-pointer"
            >
              <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-800 flex items-center justify-center">
                <Timer className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-900 block">Respon Time SPM</span>
                <span className="text-[10px] text-slate-500">Avg {avgWaitMinutes}m tunggu</span>
              </div>
            </button>
          )}

          {/* 4. Analitik Beban Kerja */}
          {onOpenIntelligence && (
            <button
              onClick={() => {
                onClose();
                onOpenIntelligence();
              }}
              className="p-3 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 flex flex-col items-start gap-1.5 text-left transition-all cursor-pointer"
            >
              <div className="w-7 h-7 rounded-lg bg-teal-100 text-teal-800 flex items-center justify-center">
                <Activity className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-900 block">Halaman Analitik</span>
                <span className="text-[10px] text-slate-500">
                  {overloadCount > 0 ? `⚠️ ${overloadCount} overload` : 'Beban kerja terapis'}
                </span>
              </div>
            </button>
          )}

          {/* TV Display Monitor 6 Kotak Fullscreen */}
          {onOpenTVDisplay && (
            <button
              onClick={() => {
                onClose();
                onOpenTVDisplay();
              }}
              className="p-3 bg-amber-50/80 hover:bg-amber-100/90 rounded-xl border border-amber-300 flex flex-col items-start gap-1.5 text-left transition-all cursor-pointer shadow-2xs"
            >
              <div className="w-7 h-7 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 flex items-center justify-center font-bold">
                <Tv className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-black text-amber-950 block">Display TV 6 Kotak</span>
                <span className="text-[10px] text-amber-800 font-medium">Layar Penuh Optimal</span>
              </div>
            </button>
          )}

          {/* 5. Link Aplikasi HP */}
          {onOpenGeneralQR && (
            <button
              onClick={() => {
                onClose();
                onOpenGeneralQR();
              }}
              className="p-3 bg-indigo-50/70 hover:bg-indigo-100 rounded-xl border border-indigo-200 flex flex-col items-start gap-1.5 text-left transition-all cursor-pointer"
            >
              <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center">
                <Smartphone className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-indigo-950 block">Link Aplikasi HP</span>
                <span className="text-[10px] font-mono text-indigo-700 font-bold">smart-irm.ai.studio</span>
              </div>
            </button>
          )}

          {/* 6. Riwayat Panggilan */}
          <button
            onClick={() => {
              onClose();
              onOpenGlobalHistory();
            }}
            className="p-3 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 flex flex-col items-start gap-1.5 text-left transition-all cursor-pointer"
          >
            <div className="w-7 h-7 rounded-lg bg-slate-200 text-slate-800 flex items-center justify-center">
              <History className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-900 block">Riwayat Panggilan</span>
              <span className="text-[10px] text-slate-500">Log antrean & waktu</span>
            </div>
          </button>

          {/* 7. Tambah Kotak Antrean */}
          <button
            onClick={() => {
              onClose();
              onOpenAddBox();
            }}
            className="p-3 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 flex flex-col items-start gap-1.5 text-left transition-all cursor-pointer"
          >
            <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
              <FolderPlus className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-900 block">+ Kotak Antrean</span>
              <span className="text-[10px] text-slate-500">Tambah terapis / bed baru</span>
            </div>
          </button>

          {/* 8. SOP Word Aplikasi */}
          {onOpenSop && (
            <button
              onClick={() => {
                onClose();
                onOpenSop();
              }}
              className="p-3 bg-sky-50/80 hover:bg-sky-100 rounded-xl border border-sky-300 flex flex-col items-start gap-1.5 text-left transition-all cursor-pointer shadow-2xs"
            >
              <div className="w-7 h-7 rounded-lg bg-sky-700 text-white flex items-center justify-center">
                <BookOpen className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-1">
                  <span className="text-xs font-black text-sky-950 block">SOP IRM (Word)</span>
                  <span className="text-[8px] font-black bg-sky-200 text-sky-900 px-1 py-0.2 rounded">.DOC</span>
                </div>
                <span className="text-[10px] text-sky-800">Unduh & panduan resmi</span>
              </div>
            </button>
          )}

          {/* 9. Ganti Password Aplikasi */}
          {onOpenChangePassword && (
            <button
              onClick={() => {
                onClose();
                onOpenChangePassword();
              }}
              className="p-3 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 flex flex-col items-start gap-1.5 text-left transition-all cursor-pointer"
            >
              <div className="w-7 h-7 rounded-lg bg-teal-100 text-teal-800 flex items-center justify-center">
                <KeyRound className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-900 block">Ganti Password</span>
                <span className="text-[10px] text-slate-500">Kunci akses aplikasi</span>
              </div>
            </button>
          )}

          {/* 9. Kunci Aplikasi / Logout */}
          {onLockApp && (
            <button
              onClick={() => {
                onClose();
                onLockApp();
              }}
              className="p-3 bg-amber-50/80 hover:bg-amber-100/90 rounded-xl border border-amber-300 flex flex-col items-start gap-1.5 text-left transition-all cursor-pointer"
            >
              <div className="w-7 h-7 rounded-lg bg-amber-200 text-amber-900 flex items-center justify-center">
                <Lock className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-amber-950 block">Kunci Aplikasi</span>
                <span className="text-[10px] text-amber-800">Keluar / Lock terminal</span>
              </div>
            </button>
          )}
        </div>

        {/* Danger Zone: Reset Data */}
        {onResetAllData && (
          <div className="pt-2 border-t border-slate-200">
            <button
              onClick={() => {
                onClose();
                onResetAllData();
              }}
              className="w-full py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-black flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-2xs"
            >
              <Trash2 className="w-4 h-4 text-rose-600" />
              <span>Bersihkan Antrean Hari Ini (Otorisasi PIN)</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
