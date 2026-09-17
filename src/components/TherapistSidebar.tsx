import React from 'react';
import { QueueBox, PatientItem, RanapQueueItem } from '../types';
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
  Undo2
} from 'lucide-react';

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
}) => {
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
