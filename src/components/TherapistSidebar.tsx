import React from 'react';
import { QueueBox, PatientItem, RanapQueueItem, AppNotification } from '../types';
import { 
  X,
  Sparkles,
  FileText,
  Timer,
  Activity,
  ShieldAlert,
  Calendar,
  Database,
  Menu,
  ChevronRight,
  Clock,
  CheckCircle2,
  Users,
  Layers,
  ArrowUpRight,
  Package,
  Boxes,
  BookOpen,
  BedDouble,
  Undo2,
  Monitor,
  History,
  Bell,
  QrCode,
  KeyRound,
  Lock,
  UserCheck
} from 'lucide-react';
import { getActiveOfficerName } from '../utils/appAuthService';

interface TherapistSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  boxes?: QueueBox[];
  patients?: PatientItem[];
  ranapQueue?: RanapQueueItem[];
  selectedBoxId?: string | null;
  onSelectBox?: (boxId: string | null) => void;
  onCallNextInBox?: (box: QueueBox) => void;
  onAddPatientToBox?: (boxId: string) => void;
  onScrollToBox?: (boxId: string) => void;
  onOpenDailyDatabase?: () => void;
  onOpenRestoreQueue?: () => void;
  onOpenReport?: () => void;
  onOpenMonthlyReport?: () => void;
  onOpenResponseTimeAnalytics?: () => void;
  onOpenIntelligence?: () => void;
  onOpenInventory?: () => void;
  onOpenLainLain?: (tab?: 'kas' | 'rotasi' | 'sabtu' | 'cuti') => void;
  onOpenSop?: () => void;
  onOpenRanapQueue?: () => void;
  avgWaitMinutes?: number;
  overloadCount?: number;
  onOpenTVDisplay?: () => void;
  onOpenGlobalHistory?: () => void;
  onOpenGeneralQR?: () => void;
  notifications?: AppNotification[];
  unreadNotificationsCount?: number;
  onResetNotifications?: () => void;
  onClearAllNotifications?: () => void;
  onOpenChangePassword?: () => void;
  onLockApp?: () => void;
}

export const TherapistSidebar: React.FC<TherapistSidebarProps> = ({
  isOpen,
  onClose,
  boxes = [],
  patients = [],
  ranapQueue = [],
  onOpenDailyDatabase,
  onOpenRestoreQueue,
  onOpenReport,
  onOpenMonthlyReport,
  onOpenResponseTimeAnalytics,
  onOpenIntelligence,
  onOpenInventory,
  onOpenLainLain,
  onOpenSop,
  onOpenRanapQueue,
  avgWaitMinutes = 0,
  overloadCount = 0,
  onSelectBox,
  onScrollToBox,
  onOpenTVDisplay,
  onOpenGlobalHistory,
  onOpenGeneralQR,
  notifications = [],
  unreadNotificationsCount = 0,
  onResetNotifications,
  onClearAllNotifications,
  onOpenChangePassword,
  onLockApp,
}) => {
  const [isNotificationListOpen, setIsNotificationListOpen] = React.useState(false);

  // Sidebar selalu dibuka dengan daftar notifikasi terlipat. Tanpa ini daftar
  // tetap terbuka dari kunjungan sebelumnya, dan ketukan pada tile malah menutupnya.
  React.useEffect(() => {
    if (!isOpen) setIsNotificationListOpen(false);
  }, [isOpen]);

  // Aksi cepat selalu menutup menu, sebab semuanya membuka jendela sendiri.
  const runQuickAction = (action?: () => void) => {
    if (!action) return;
    onClose();
    action();
  };

  const quickActions = [
    { id: 'btn-open-tv', label: 'Display TV', icon: Monitor, onClick: onOpenTVDisplay, tile: 'bg-amber-50 border-amber-200 hover:bg-amber-100', chip: 'bg-amber-500' },
    { id: 'btn-global-history', label: 'Riwayat', icon: History, onClick: onOpenGlobalHistory, tile: 'bg-slate-50 border-slate-200 hover:bg-slate-100', chip: 'bg-slate-600' },
    { id: 'btn-general-qr', label: 'Link Aplikasi', icon: QrCode, onClick: onOpenGeneralQR, tile: 'bg-indigo-50 border-indigo-200 hover:bg-indigo-100', chip: 'bg-indigo-600' },
  ].filter(a => a.onClick);
  const handleActionClick = (action?: () => void) => {
    if (action) {
      action();
      if (window.innerWidth < 1024) {
        onClose();
      }
    }
  };

  const activePatientsCount = patients.filter(p => !p.completed).length;
  const completedPatientsCount = patients.filter(p => p.completed).length;

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-2xs z-40 transition-opacity"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Container */}
      <aside 
        id="menu-sidebar"
        className={`fixed top-0 bottom-0 left-0 z-50 w-full max-w-[340px] sm:max-w-[380px] bg-white border-r border-slate-200 shadow-2xl flex flex-col transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-slate-900 via-teal-950 to-slate-900 text-white flex items-center justify-between shrink-0 border-b border-slate-800 shadow-sm">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-teal-500/20 border border-teal-400/30 flex items-center justify-center text-teal-300 shadow-inner shrink-0">
              <Menu className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-black text-white tracking-tight flex items-center gap-1.5 truncate">
                <span>Menu Utama IRM</span>
              </h2>
              <p className="text-[11px] text-teal-200/80 font-medium truncate">
                Database, Laporan &amp; Administrasi
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
            title="Tutup Menu (ESC)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body Navigation Links */}
        <div className="flex-1 overflow-y-auto p-3.5 space-y-2.5">
          {/* Aksi cepat - dipindah dari header */}
          <div className="grid grid-cols-4 gap-2 pb-1">
            {quickActions.map(a => (
              <button
                key={a.id}
                id={a.id}
                type="button"
                onClick={() => runQuickAction(a.onClick)}
                className={`flex flex-col items-center gap-1.5 px-1 py-2.5 rounded-2xl border transition-all cursor-pointer active:scale-95 ${a.tile}`}
              >
                <span className={`w-9 h-9 rounded-xl text-white flex items-center justify-center shadow-xs ${a.chip}`}>
                  <a.icon className="w-4.5 h-4.5" />
                </span>
                <span className="text-[11px] font-bold text-slate-800 leading-tight text-center">{a.label}</span>
              </button>
            ))}
            <button
              id="btn-header-notifications"
              type="button"
              onClick={() => {
                setIsNotificationListOpen(prev => !prev);
                if (unreadNotificationsCount > 0 && onResetNotifications) onResetNotifications();
              }}
              className={`relative flex flex-col items-center gap-1.5 px-1 py-2.5 rounded-2xl border transition-all cursor-pointer active:scale-95 ${
                isNotificationListOpen ? 'bg-amber-100 border-amber-300 ring-2 ring-amber-300/50' : 'bg-amber-50 border-amber-200 hover:bg-amber-100'
              }`}
            >
              <span className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-xs">
                <Bell className="w-4.5 h-4.5" />
              </span>
              <span className="text-[11px] font-bold text-slate-800 leading-tight">Notifikasi</span>
              {unreadNotificationsCount > 0 && (
                <span className="absolute top-1.5 right-1.5 min-w-5 h-5 px-1 bg-rose-600 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white">
                  {unreadNotificationsCount}
                </span>
              )}
            </button>
          </div>

          {isNotificationListOpen && (
            <div className="rounded-2xl border border-amber-200 bg-white overflow-hidden shadow-2xs">
              <div className="px-3 py-2 bg-amber-50 border-b border-amber-200 flex items-center justify-between">
                <span className="text-xs font-black text-amber-900">Notifikasi Pasien Baru ({notifications.length})</span>
                {onClearAllNotifications && notifications.length > 0 && (
                  <button type="button" onClick={onClearAllNotifications} className="text-[10px] font-bold text-slate-500 hover:text-rose-600 cursor-pointer">
                    Hapus Semua
                  </button>
                )}
              </div>
              <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
                {notifications.length === 0 ? (
                  <p className="p-4 text-center text-[11px] text-slate-400 font-medium">Belum ada notifikasi baru</p>
                ) : (
                  notifications.slice(0, 20).map(n => (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => {
                        onSelectBox?.(n.boxId);
                        onScrollToBox?.(n.boxId);
                        onClose();
                      }}
                      className={`w-full p-2.5 text-left flex items-start gap-2 hover:bg-slate-50 cursor-pointer ${!n.isRead ? 'bg-amber-50/50' : ''}`}
                    >
                      <span className="w-7 h-7 rounded-lg bg-teal-100 text-teal-800 flex items-center justify-center shrink-0 font-black text-xs">
                        {n.queueNumber || '⚡'}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-1">
                          <span className="text-xs font-black text-slate-900 truncate">{n.patientName}</span>
                          <span className="text-[10px] text-slate-400 font-mono shrink-0">{n.timestamp}</span>
                        </span>
                        <span className="block text-[11px] text-slate-600 truncate">
                          Menuju: <strong className="text-slate-800">{n.officerName || n.boxTitle}</strong>
                        </span>
                        {(n.medicalRecordNo || n.actionCode || n.isRanap) && (
                          <span className="mt-1 flex flex-wrap items-center gap-1 text-[10px]">
                            {n.medicalRecordNo && (
                              <span className="font-mono bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded font-bold">
                                RM: {n.medicalRecordNo}
                              </span>
                            )}
                            {n.actionCode && (
                              <span className="bg-teal-50 text-teal-800 border border-teal-200/60 px-1.5 py-0.2 rounded font-bold">
                                {n.actionCode}
                              </span>
                            )}
                            {n.isRanap && (
                              <span className="bg-blue-100 text-blue-900 font-bold px-1.5 py-0.2 rounded">
                                🛏️ RANAP
                              </span>
                            )}
                          </span>
                        )}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          {onOpenRanapQueue && (
            <button
              onClick={() => handleActionClick(onOpenRanapQueue)}
              id="sidebar-menu-ranap-queue"
              className="w-full p-3 rounded-2xl bg-rose-50/70 hover:bg-rose-100/90 text-left transition-all border border-rose-200/90 flex items-center justify-between gap-3 group cursor-pointer shadow-2xs hover:shadow-sm"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center shadow-xs shrink-0 group-hover:scale-105 transition-transform">
                  <BedDouble className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-black text-slate-900 group-hover:text-rose-950 truncate">
                      Antrean Ranap
                    </span>
                    <span className="text-[9px] font-extrabold bg-rose-200 text-rose-950 px-1.5 py-0.2 rounded shrink-0">
                      {ranapQueue.length} Aktif
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 font-medium truncate mt-0.5">
                    Rawat inap: Fisio, Okupasi &amp; Wicara
                  </p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-rose-700 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all shrink-0" />
            </button>
          )}

          <p className="text-[11px] font-black text-slate-500 uppercase tracking-wider px-1 pt-1 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-600"></span>
            Menu &amp; Fitur Manajemen
          </p>

          {/* 1. Database Pasien */}
          {onOpenDailyDatabase && (
            <button
              onClick={() => handleActionClick(onOpenDailyDatabase)}
              id="sidebar-menu-daily-database"
              className="w-full p-3 rounded-2xl bg-teal-50/70 hover:bg-teal-100/90 text-left transition-all border border-teal-200/90 flex items-center justify-between gap-3 group cursor-pointer shadow-2xs hover:shadow-sm"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-xs shrink-0 group-hover:scale-105 transition-transform">
                  <Database className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-black text-slate-900 group-hover:text-teal-900 truncate">
                      Database Pasien
                    </span>
                    <span className="text-[9px] font-extrabold bg-teal-100 text-teal-900 px-1.5 py-0.2 rounded shrink-0 flex items-center gap-0.5">
                      🔒 Password
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 font-medium truncate mt-0.5">
                    Register harian &amp; Master Data Pasien IRM
                  </p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-teal-700 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all shrink-0" />
            </button>
          )}

          {/* 2. Restore Antrean - pulihkan pasien yang hilang tanpa sebab */}
          {onOpenRestoreQueue && (
            <button
              onClick={() => handleActionClick(onOpenRestoreQueue)}
              id="sidebar-menu-restore-queue"
              className="w-full p-3 rounded-2xl bg-amber-50/70 hover:bg-amber-100/90 text-left transition-all border border-amber-200/90 flex items-center justify-between gap-3 group cursor-pointer shadow-2xs hover:shadow-sm"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-amber-600 text-white flex items-center justify-center shadow-xs shrink-0 group-hover:scale-105 transition-transform">
                  <Undo2 className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <span className="text-xs font-black text-slate-900 group-hover:text-amber-900 truncate block">
                    Restore Antrean
                  </span>
                  <p className="text-[11px] text-slate-600 font-medium truncate mt-0.5">
                    Cek &amp; kembalikan pasien yang hilang tanpa sebab
                  </p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-amber-700 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all shrink-0" />
            </button>
          )}

          {/* 3. Bulanan Terapis */}
          {onOpenMonthlyReport && (
            <button
              onClick={() => handleActionClick(onOpenMonthlyReport)}
              id="sidebar-menu-monthly-report"
              className="w-full p-3 rounded-2xl bg-emerald-50/60 hover:bg-emerald-100/80 text-left transition-all border border-emerald-200/80 flex items-center justify-between gap-3 group cursor-pointer shadow-2xs hover:shadow-sm"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-emerald-700 text-white flex items-center justify-center shadow-xs shrink-0 group-hover:scale-105 transition-transform">
                  <Calendar className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-black text-slate-900 group-hover:text-emerald-950 truncate">
                      Bulanan Terapis
                    </span>
                    <span className="text-[9px] font-extrabold bg-emerald-200 text-emerald-900 px-1.5 py-0.2 rounded shrink-0">
                      Rekap
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 font-medium truncate mt-0.5">
                    Rekap kinerja bulanan per terapis &amp; PDF
                  </p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-emerald-700 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all shrink-0" />
            </button>
          )}

          {/* 4. Respon Time */}
          {onOpenResponseTimeAnalytics && (
            <button
              onClick={() => handleActionClick(onOpenResponseTimeAnalytics)}
              id="sidebar-menu-response-time"
              className="w-full p-3 rounded-2xl bg-indigo-50/60 hover:bg-indigo-100/80 text-left transition-all border border-indigo-200/80 flex items-center justify-between gap-3 group cursor-pointer shadow-2xs hover:shadow-sm"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-indigo-700 text-white flex items-center justify-center shadow-xs shrink-0 group-hover:scale-105 transition-transform">
                  <Timer className="w-5 h-5 animate-pulse" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-black text-slate-900 group-hover:text-indigo-950 truncate">
                      Respon Time
                    </span>
                    {avgWaitMinutes > 0 ? (
                      <span className="text-[9px] font-black bg-indigo-200 text-indigo-900 px-1.5 py-0.2 rounded font-mono shrink-0">
                        Avg {avgWaitMinutes}m
                      </span>
                    ) : (
                      <span className="text-[9px] font-bold bg-indigo-200 text-indigo-900 px-1.5 py-0.2 rounded shrink-0">
                        SPM
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-600 font-medium truncate mt-0.5">
                    Durasi input ke ceklis &amp; standar SPM
                  </p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-indigo-700 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all shrink-0" />
            </button>
          )}

          {/* 5. Analitik Terapis */}
          {onOpenIntelligence && (
            <button
              onClick={() => handleActionClick(onOpenIntelligence)}
              id="sidebar-menu-analytics"
              className={`w-full p-3 rounded-2xl text-left transition-all border flex items-center justify-between gap-3 group cursor-pointer shadow-2xs hover:shadow-sm ${
                overloadCount > 0
                  ? 'bg-rose-50 hover:bg-rose-100/90 border-rose-300'
                  : 'bg-cyan-50/60 hover:bg-cyan-100/80 border-cyan-200/80'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-xs shrink-0 group-hover:scale-105 transition-transform ${
                  overloadCount > 0 ? 'bg-rose-600 text-white animate-pulse' : 'bg-slate-900 text-cyan-300'
                }`}>
                  {overloadCount > 0 ? (
                    <ShieldAlert className="w-5 h-5" />
                  ) : (
                    <Activity className="w-5 h-5" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-black text-slate-900 group-hover:text-cyan-950 truncate">
                      Analitik Terapis
                    </span>
                    {overloadCount > 0 ? (
                      <span className="text-[9px] font-black bg-rose-200 text-rose-950 px-1.5 py-0.2 rounded shrink-0 animate-bounce">
                        ⚠️ {overloadCount} Overload
                      </span>
                    ) : (
                      <span className="text-[9px] font-extrabold bg-cyan-200 text-cyan-950 px-1.5 py-0.2 rounded shrink-0">
                        Cerdas
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-600 font-medium truncate mt-0.5">
                    Beban kerja, utilisasi &amp; distribusi pasien
                  </p>
                </div>
              </div>
              <ChevronRight className={`w-4 h-4 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all shrink-0 ${
                overloadCount > 0 ? 'text-rose-700' : 'text-cyan-700'
              }`} />
            </button>
          )}

          {/* 6. Inventaris & Stok IRM */}
          {onOpenInventory && (
            <button
              onClick={() => handleActionClick(onOpenInventory)}
              id="sidebar-menu-inventory-stock"
              className="w-full p-3 rounded-2xl bg-amber-50/60 hover:bg-amber-100/80 text-left transition-all border border-amber-200/80 flex items-center justify-between gap-3 group cursor-pointer shadow-2xs hover:shadow-sm"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-amber-600 text-white flex items-center justify-center shadow-xs shrink-0 group-hover:scale-105 transition-transform">
                  <Package className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-black text-slate-900 group-hover:text-amber-950 truncate">
                      Inventaris &amp; Stok
                    </span>
                    <span className="text-[9px] font-extrabold bg-amber-200 text-amber-950 px-1.5 py-0.2 rounded shrink-0">
                      Alat &amp; BHP
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 font-medium truncate mt-0.5">
                    Alat FT/OT/TW, BMHP &amp; Logistik ATK IRM
                  </p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-amber-700 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all shrink-0" />
            </button>
          )}

          {/* 7. Lain-Lain IRM */}
          {onOpenLainLain && (
            <button
              onClick={() => handleActionClick(() => onOpenLainLain('kas'))}
              id="sidebar-menu-lain-lain"
              className="w-full p-3 rounded-2xl bg-gradient-to-r from-teal-50 to-emerald-50 hover:from-teal-100 hover:to-emerald-100 text-left transition-all border border-teal-300/80 flex items-center justify-between gap-3 group cursor-pointer shadow-2xs hover:shadow-sm"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-700 to-emerald-800 text-white flex items-center justify-center shadow-xs shrink-0 group-hover:scale-105 transition-transform">
                  <Sparkles className="w-5 h-5 text-teal-200" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-black text-slate-900 group-hover:text-teal-950 truncate">
                      Lain-Lain IRM
                    </span>
                    <span className="text-[9px] font-extrabold bg-teal-200 text-teal-900 px-1.5 py-0.2 rounded shrink-0">
                      Multi-Fitur
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 font-medium truncate mt-0.5">
                    Kas Keuangan, Jadwal Rotasi, Sabtu &amp; Cuti
                  </p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-teal-700 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all shrink-0" />
            </button>
          )}

          {/* 8. SOP Word & Panduan Resmi */}
          {onOpenSop && (
            <button
              onClick={() => handleActionClick(onOpenSop)}
              id="sidebar-menu-sop-word"
              className="w-full p-3 rounded-2xl bg-sky-50/70 hover:bg-sky-100/90 text-left transition-all border border-sky-200/90 flex items-center justify-between gap-3 group cursor-pointer shadow-2xs hover:shadow-sm"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-sky-700 text-white flex items-center justify-center shadow-xs shrink-0 group-hover:scale-105 transition-transform">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-black text-slate-900 group-hover:text-sky-950 truncate">
                      SOP Aplikasi
                    </span>
                    <span className="text-[9px] font-extrabold bg-sky-200 text-sky-900 px-1.5 py-0.2 rounded shrink-0">
                      📄 Unduh Word
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 font-medium truncate mt-0.5">
                    Standar Operasional Prosedur format Word (.doc)
                  </p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-sky-700 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all shrink-0" />
            </button>
          )}
        </div>

        {/* Bottom Status Card */}
        <div className="p-3.5 bg-slate-50 border-t border-slate-200 shrink-0 space-y-2">
          <div className="bg-slate-900 p-2.5 rounded-xl flex items-center gap-2 text-white">
            <span className="relative w-8 h-8 rounded-lg bg-teal-500/20 border border-teal-400/40 flex items-center justify-center shrink-0">
              <UserCheck className="w-4 h-4 text-teal-300" />
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-slate-900" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Sedang login</p>
              <p className="text-xs font-black text-teal-100 truncate">{getActiveOfficerName()}</p>
            </div>
            {onOpenChangePassword && (
              <button
                type="button"
                id="btn-header-change-password"
                onClick={() => runQuickAction(onOpenChangePassword)}
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 flex items-center justify-center text-teal-300 cursor-pointer shrink-0"
                title="Ganti Password Aplikasi IRM"
              >
                <KeyRound className="w-4 h-4" />
              </button>
            )}
            {onLockApp && (
              <button
                type="button"
                id="btn-header-lock"
                onClick={() => runQuickAction(onLockApp)}
                className="h-8 px-2.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 flex items-center gap-1 text-amber-300 text-[11px] font-bold cursor-pointer shrink-0"
                title="Kunci Aplikasi / Logout"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Kunci</span>
              </button>
            )}
          </div>
          <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-slate-600 font-semibold text-[11px]">Pasien Hari Ini:</span>
            </div>
            <div className="flex items-center gap-2 text-[11px] font-bold">
              <span className="text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                {activePatientsCount} Aktif
              </span>
              <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                {completedPatientsCount} Selesai
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between text-[10px] text-slate-500 font-medium px-1">
            <span>Instalasi Rehabilitasi Medis RSPP</span>
            <span className="font-bold text-slate-700">Versi 2.5</span>
          </div>
        </div>
      </aside>
    </>
  );
};
