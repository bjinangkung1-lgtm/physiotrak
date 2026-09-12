import React, { useState } from 'react';
import { X, BedDouble, Plus, History, Circle, Trash2, DoorOpen } from 'lucide-react';
import { RanapCategory, RanapQueueItem } from '../types';
import { RANAP_CATEGORY_ORDER, RANAP_CATEGORY_LABELS, groupRanapQueueByCategory } from '../utils/ranapQueueUtils';

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
  ranapQueue,
  onOpenAddPatient,
  onCompletePatient,
  onDeletePatient,
  onOpenHistory,
}) => {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  if (!isOpen) return null;

  const grouped = groupRanapQueueByCategory(ranapQueue);

  return (
    <div className="fixed inset-0 z-60 bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-rose-800 to-slate-900 text-white p-4 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-rose-600/40 border border-rose-400/40 flex items-center justify-center shrink-0">
              <BedDouble className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-black tracking-tight truncate">Antrean Ranap (Rawat Inap)</h2>
              <p className="text-[11px] text-rose-200/90 truncate">{ranapQueue.length} pasien aktif &bull; terpisah dari Respon Time kotak antrean</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={onOpenHistory}
              className="px-2.5 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-lg cursor-pointer flex items-center gap-1.5"
              title="Riwayat Antrean Ranap"
            >
              <History className="w-4 h-4" />
              <span className="hidden sm:inline">Riwayat</span>
            </button>
            <button onClick={onClose} className="text-white/80 hover:text-white p-1.5 rounded-lg hover:bg-white/10 cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body: 3 kategori */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
          {RANAP_CATEGORY_ORDER.map((category) => {
            const items = grouped[category];
            return (
              <div key={category} className="bg-white rounded-2xl border border-rose-100 shadow-xs overflow-hidden">
                <div className="flex items-center justify-between px-3.5 py-2.5 bg-rose-50/80 border-b border-rose-100">
                  <span className="text-xs font-black text-rose-900 uppercase tracking-wide">
                    {RANAP_CATEGORY_LABELS[category]} ({items.length})
                  </span>
                  <button
                    onClick={() => onOpenAddPatient(category)}
                    className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold cursor-pointer flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambah</span>
                  </button>
                </div>

                {items.length === 0 ? (
                  <p className="text-xs text-slate-400 italic text-center py-4">
                    Tidak ada pasien ranap
                  </p>
                ) : (
                  <div className="divide-y divide-rose-50">
                    {items.map((item) => (
                      <div key={item.id} className="p-3 flex items-start gap-3 group">
                        <button
                          onClick={() => onCompletePatient(item.id)}
                          className="mt-0.5 text-rose-300 hover:text-emerald-600 cursor-pointer shrink-0 transition-colors"
                          title="Tandai selesai dikerjakan"
                        >
                          <Circle className="w-5 h-5" />
                        </button>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-slate-900 truncate">{item.patientName}</p>
                          <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium flex-wrap mt-0.5">
                            <span className="font-mono">RM: {item.medicalRecordNo}</span>
                            <span className="inline-flex items-center gap-0.5 bg-rose-50 text-rose-800 px-1.5 py-0.2 rounded font-bold">
                              <DoorOpen className="w-3 h-3" /> {item.roomNumber}
                            </span>
                          </div>
                          {item.diagnosis && (
                            <p className="text-[11px] text-slate-500 truncate mt-1">{item.diagnosis}</p>
                          )}
                        </div>
                        {confirmDeleteId === item.id ? (
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              onClick={() => { onDeletePatient(item.id); setConfirmDeleteId(null); }}
                              className="text-[10px] font-black text-white bg-rose-600 hover:bg-rose-700 px-2 py-1 rounded cursor-pointer"
                            >
                              Hapus
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="text-[10px] font-bold text-slate-500 hover:text-slate-700 px-1.5 cursor-pointer"
                            >
                              Batal
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDeleteId(item.id)}
                            className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-600 cursor-pointer shrink-0 transition-all"
                            title="Hapus dari antrean"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-3.5 bg-white border-t border-slate-200 flex items-center justify-end shrink-0">
          <button onClick={onClose} className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold cursor-pointer">
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
