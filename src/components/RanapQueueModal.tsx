import React, { useState } from 'react';
import { RanapCategory, RanapQueueItem } from '../types';
import { 
  X, 
  BedDouble, 
  History, 
  Plus, 
  Circle, 
  DoorOpen, 
  Stethoscope, 
  Trash2, 
  Check, 
  AlertCircle,
  Clock,
  Sparkles
} from 'lucide-react';
import { 
  groupRanapQueueByCategory, 
  RANAP_CATEGORY_ORDER, 
  RANAP_CATEGORY_LABELS, 
  RANAP_CATEGORY_SHORT_LABELS 
} from '../utils/ranapQueueUtils';

interface RanapQueueModalProps {
  isOpen: boolean;
  onClose: () => void;
  ranapQueue: RanapQueueItem[];
  onOpenAddPatient: (category: RanapCategory) => void;
  onCompletePatient: (id: string) => void;
  onDeletePatient: (id: string) => void;
  onOpenHistory: () => void;
}

export const RanapQueueModal: React.FC<RanapQueueModalProps> = ({
  isOpen,
  onClose,
  ranapQueue = [],
  onOpenAddPatient,
  onCompletePatient,
  onDeletePatient,
  onOpenHistory,
}) => {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  if (!isOpen) return null;

  const grouped = groupRanapQueueByCategory(ranapQueue);
  const totalActive = ranapQueue.length;

  const getCategoryTheme = (cat: RanapCategory) => {
    switch (cat) {
      case 'fisio':
        return {
          border: 'border-sky-500/30',
          bg: 'bg-sky-950/30',
          headerBg: 'bg-sky-900/40',
          badge: 'bg-sky-500/20 text-sky-300 border-sky-400/30',
          btnBg: 'bg-sky-500 hover:bg-sky-400 text-slate-950',
          accentText: 'text-sky-400',
        };
      case 'okupasi':
        return {
          border: 'border-amber-500/30',
          bg: 'bg-amber-950/30',
          headerBg: 'bg-amber-900/40',
          badge: 'bg-amber-500/20 text-amber-300 border-amber-400/30',
          btnBg: 'bg-amber-500 hover:bg-amber-400 text-slate-950',
          accentText: 'text-amber-400',
        };
      case 'wicara':
        return {
          border: 'border-purple-500/30',
          bg: 'bg-purple-950/30',
          headerBg: 'bg-purple-900/40',
          badge: 'bg-purple-500/20 text-purple-300 border-purple-400/30',
          btnBg: 'bg-purple-500 hover:bg-purple-400 text-slate-950',
          accentText: 'text-purple-400',
        };
    }
  };

  return (
    <div 
      className="fixed inset-0 z-60 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        id="ranap-queue-modal-container"
        className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl text-white overflow-hidden my-auto"
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-slate-700/80 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0 shadow-inner">
              <BedDouble className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-black text-white tracking-tight">
                  Antrean Ranap (Rawat Inap)
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-rose-500/20 border border-rose-400/40 text-rose-300 text-[11px] font-extrabold shrink-0">
                  {totalActive} Pasien Aktif
                </span>
              </div>
              <p className="text-xs text-slate-400 truncate mt-0.5">
                Terpisah dari Respon Time kotak antrean • Urutan otomatis per nomor ruangan
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              id="ranap-modal-btn-history"
              onClick={onOpenHistory}
              title="Buka Riwayat Tindakan Selesai Ranap"
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-teal-300 hover:text-teal-200 border border-teal-500/30 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs hover:border-teal-400/50"
            >
              <History className="w-4 h-4 text-teal-400" />
              <span className="hidden sm:inline">Riwayat</span>
            </button>
            <button
              type="button"
              id="ranap-modal-btn-close"
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer border border-slate-700"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body - Scrollable Category Cards */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {RANAP_CATEGORY_ORDER.map((cat) => {
            const list = grouped[cat] || [];
            const theme = getCategoryTheme(cat);

            return (
              <div
                key={cat}
                id={`ranap-category-card-${cat}`}
                className={`rounded-2xl border ${theme.border} ${theme.bg} overflow-hidden shadow-sm transition-all`}
              >
                {/* Category Header */}
                <div className={`p-3 sm:px-4 ${theme.headerBg} border-b ${theme.border} flex items-center justify-between gap-2`}>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-black text-white tracking-wide">
                      {RANAP_CATEGORY_LABELS[cat]}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full border text-[11px] font-mono font-extrabold ${theme.badge}`}>
                      {list.length}
                    </span>
                  </div>

                  <button
                    type="button"
                    id={`btn-add-ranap-${cat}`}
                    onClick={() => onOpenAddPatient(cat)}
                    className={`px-2.5 py-1.5 rounded-xl ${theme.btnBg} font-black text-xs flex items-center gap-1 shadow-xs transition-transform active:scale-95 cursor-pointer`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Tambah {RANAP_CATEGORY_SHORT_LABELS[cat]}</span>
                  </button>
                </div>

                {/* Patient List */}
                <div className="p-3 sm:p-3.5 space-y-2">
                  {list.length === 0 ? (
                    <div className="py-6 px-4 text-center rounded-xl bg-slate-900/40 border border-white/5 text-slate-400">
                      <BedDouble className="w-6 h-6 mx-auto mb-1.5 text-slate-600" />
                      <p className="text-xs font-semibold text-slate-400">
                        Tidak ada pasien antrean {RANAP_CATEGORY_SHORT_LABELS[cat]} saat ini
                      </p>
                      <button
                        type="button"
                        onClick={() => onOpenAddPatient(cat)}
                        className={`mt-2 text-xs font-bold ${theme.accentText} hover:underline cursor-pointer inline-flex items-center gap-1`}
                      >
                        <Plus className="w-3 h-3" />
                        Tambah Pasien Sekarang
                      </button>
                    </div>
                  ) : (
                    list.map((item) => {
                      const isConfirmingDelete = confirmDeleteId === item.id;

                      return (
                        <div
                          key={item.id}
                          id={`ranap-item-${item.id}`}
                          className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition-all flex items-start justify-between gap-3 shadow-xs group"
                        >
                          {/* Complete action circle button */}
                          <button
                            type="button"
                            title="Tandai Selesai (Arsipkan ke Riwayat Permanen)"
                            onClick={() => onCompletePatient(item.id)}
                            className="mt-0.5 w-6 h-6 rounded-full border-2 border-slate-500 hover:border-emerald-400 hover:bg-emerald-500/20 text-transparent hover:text-emerald-400 flex items-center justify-center transition-all cursor-pointer shrink-0 active:scale-90"
                          >
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </button>

                          {/* Patient details */}
                          <div className="flex-1 min-w-0 space-y-1">
                            {/* Room Badge and Officer */}
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-black">
                                <DoorOpen className="w-3.5 h-3.5 text-emerald-400" />
                                Ruang {item.roomNumber}
                              </span>
                              {item.officerName && (
                                <span className="text-xs text-slate-300 font-medium">
                                  Terapis: <span className="text-teal-300 font-bold">{item.officerName}</span>
                                </span>
                              )}
                              {item.createdAt && (
                                <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1 ml-auto">
                                  <Clock className="w-3 h-3" />
                                  {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              )}
                            </div>

                            {/* Patient Name and RM */}
                            <div className="flex items-baseline gap-2 flex-wrap">
                              <span className="text-sm font-black text-white tracking-wide">
                                {item.patientName}
                              </span>
                              <span className="text-xs text-slate-400 font-mono">
                                RM: <span className="text-slate-200 font-semibold">{item.medicalRecordNo}</span>
                              </span>
                            </div>

                            {/* Diagnosis */}
                            {item.diagnosis && (
                              <div className="text-xs text-teal-200/90 italic flex items-center gap-1.5 truncate">
                                <Stethoscope className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                                <span className="truncate">{item.diagnosis}</span>
                              </div>
                            )}

                            {/* Optional Note */}
                            {item.note && (
                              <div className="text-[11px] text-slate-400 italic bg-slate-950/40 px-2 py-1 rounded-lg border border-white/5">
                                Catatan: {item.note}
                              </div>
                            )}
                          </div>

                          {/* Delete Action with inline confirm */}
                          <div className="shrink-0 flex items-center gap-1">
                            {isConfirmingDelete ? (
                              <div className="flex items-center gap-1 bg-rose-950/80 border border-rose-600/60 rounded-xl p-1 animate-in fade-in">
                                <button
                                  type="button"
                                  onClick={() => {
                                    onDeletePatient(item.id);
                                    setConfirmDeleteId(null);
                                  }}
                                  className="px-2 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-[11px] cursor-pointer"
                                >
                                  Ya, Hapus
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(null)}
                                  className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-[11px] cursor-pointer"
                                >
                                  Batal
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                title="Hapus Pasien"
                                onClick={() => setConfirmDeleteId(item.id)}
                                className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Modal Footer */}
        <div className="p-3 sm:p-4 bg-slate-900 border-t border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <p className="text-xs text-slate-400">
            Daftar otomatis tersinkronisasi antar komputer &amp; tablet petugas.
          </p>
          <button
            type="button"
            id="ranap-modal-footer-close"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-colors cursor-pointer border border-slate-700"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
