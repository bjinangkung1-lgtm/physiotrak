import React, { useState, useMemo, useEffect } from 'react';
import { QueueBox, PatientItem } from '../types';
import { 
  Sun, 
  ArrowRight, 
  Users, 
  CheckCircle2, 
  AlertTriangle, 
  X, 
  Clock, 
  ShieldAlert,
  ArrowRightLeft
} from 'lucide-react';
import { ActionCodeCrossPicker } from './ActionCodeCrossPicker';
import { ActionCodeBadge } from './ActionCodeBadge';
import { getActionTokensOrFallback, getRemainingActionTokens, formatRemainingCodes } from '../utils/actionCodeUtils';

export interface PatientPeralihanConfig {
  isLepas: boolean;
  kurangTindakan?: number;
  kurangTindakanKode?: string;
  crossedActionCodes?: string[];
}

interface PeralihanSiangModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceBox: QueueBox;
  patients: PatientItem[];
  allBoxes: QueueBox[];
  onConfirmTransfer: (
    sourceBoxId: string, 
    selectedPatientIds: string[], 
    patientConfigs?: Record<string, PatientPeralihanConfig>
  ) => void;
}

export const PeralihanSiangModal: React.FC<PeralihanSiangModalProps> = ({
  isOpen,
  onClose,
  sourceBox,
  patients,
  allBoxes,
  onConfirmTransfer,
}) => {
  // Active (uncompleted) patients in this box
  const activePatients = useMemo(() => {
    return patients.filter(p => p.boxId === (sourceBox ? sourceBox.id : '') && !p.completed);
  }, [patients, sourceBox?.id]);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [patientConfigs, setPatientConfigs] = useState<Record<string, PatientPeralihanConfig>>({});

  useEffect(() => {
    if (isOpen) {
      setSelectedIds(activePatients.map(p => p.id));
      const initial: Record<string, PatientPeralihanConfig> = {};
      activePatients.forEach(p => {
        const tokens = getActionTokensOrFallback(p.actionCode);
        const crossed = p.crossedActionCodes || [];
        const remaining = getRemainingActionTokens(tokens, crossed);
        initial[p.id] = {
          isLepas: p.isLepas ?? false,
          kurangTindakan: p.kurangTindakan ?? (remaining.length > 0 ? remaining.length : 2),
          kurangTindakanKode: p.kurangTindakanKode || (remaining.length > 0 ? remaining.join('.') : undefined),
          crossedActionCodes: crossed
        };
      });
      setPatientConfigs(initial);
    }
  }, [isOpen, activePatients]);

  if (!isOpen || !sourceBox) return null;

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const setPatientStatusLepas = (id: string, isLepas: boolean) => {
    setPatientConfigs(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        isLepas
      }
    }));
  };

  const setPatientCrossedCodes = (id: string, crossed: string[], remSummary: string) => {
    setPatientConfigs(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        isLepas: false,
        crossedActionCodes: crossed,
        kurangTindakanKode: remSummary,
        kurangTindakan: remSummary ? remSummary.split('.').length : 0
      }
    }));
  };

  const selectAll = () => setSelectedIds(activePatients.map(p => p.id));
  const deselectAll = () => setSelectedIds([]);

  const handleExecute = () => {
    if (selectedIds.length === 0) return;
    onConfirmTransfer(sourceBox.id, selectedIds, patientConfigs);
    onClose();
  };

  // Find existing Peralihan Siang box or fallback description
  const existingPeralihanBox = allBoxes.find(
    b => b.id === 'box-peralihan-siang' || b.title.toUpperCase().includes('PERALIHAN SIANG')
  );

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in">
      <div 
        className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-amber-200 overflow-hidden flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header with Sun Theme */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white flex items-start justify-between gap-3 shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-white shrink-0 shadow-inner border border-white/30">
              <Sun className="w-6 h-6 text-amber-100 animate-spin-slow" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-900/40 text-amber-100 border border-amber-300/40 uppercase tracking-wider">
                  Shift Peralihan
                </span>
                <span className="text-xs text-amber-100 font-bold">
                  {activePatients.length} Pasien Mengantre
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-black tracking-tight text-white mt-0.5">
                Alihkan Pasien ke KOTAK PERALIHAN SIANG
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/20 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {/* Transfer Route Visualizer */}
          <div className="p-3 bg-gradient-to-r from-amber-50/80 via-orange-50/80 to-amber-50/80 rounded-xl border border-amber-200/90 flex items-center justify-between gap-2 text-xs">
            <div className="flex-1 min-w-0">
              <span className="text-[10px] font-bold uppercase text-slate-500 block">Kotak Asal</span>
              <div className="font-extrabold text-slate-900 truncate">
                {sourceBox.title}
              </div>
              <div className="text-[11px] text-slate-600 truncate">
                {sourceBox.officerName}
              </div>
            </div>

            <div className="flex flex-col items-center px-2 shrink-0">
              <div className="w-8 h-8 rounded-full bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-700 shadow-xs">
                <ArrowRight className="w-4 h-4" />
              </div>
              <span className="text-[9px] font-extrabold text-amber-800 uppercase mt-0.5">Pindah</span>
            </div>

            <div className="flex-1 min-w-0 text-right">
              <span className="text-[10px] font-bold uppercase text-amber-700 block">Kotak Tujuan</span>
              <div className="font-extrabold text-amber-950 truncate">
                {existingPeralihanBox ? existingPeralihanBox.title.split('(')[0].trim() : 'KOTAK PERALIHAN SIANG'}
              </div>
              <div className="text-[11px] text-amber-800 truncate">
                {existingPeralihanBox ? existingPeralihanBox.officerName : 'Petugas Shift Siang'}
              </div>
            </div>
          </div>

          {/* Explanation Alert */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700 space-y-1">
            <div className="flex items-center gap-1.5 font-extrabold text-slate-900">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Konfirmasi Pemindahan Antrean Shift Siang</span>
            </div>
            <p className="text-slate-600 leading-relaxed text-[11px]">
              Semua pasien yang dipilih di bawah ini yang masih mengantre di kotak <strong className="text-slate-900">{sourceBox.title}</strong> akan otomatis dipindahkan ke <strong className="text-amber-900">Kotak PERALIHAN SIANG</strong>. Data nomor RM, diagnosa, dan kode tindakan tetap terjaga utuh.
            </p>
          </div>

          {/* Patient Selection List */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 font-bold text-xs text-slate-800">
                <Users className="w-4 h-4 text-amber-600" />
                <span>Pilih Pasien yang Dialihkan ({selectedIds.length} dari {activePatients.length})</span>
              </div>
              <div className="flex items-center gap-2 text-[11px]">
                <button
                  type="button"
                  onClick={selectAll}
                  className="text-amber-700 hover:text-amber-900 font-bold cursor-pointer"
                >
                  Pilih Semua
                </button>
                <span className="text-slate-300">•</span>
                <button
                  type="button"
                  onClick={deselectAll}
                  className="text-slate-500 hover:text-slate-700 font-medium cursor-pointer"
                >
                  Batal Pilih
                </button>
              </div>
            </div>

            {activePatients.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                Tidak ada pasien aktif yang sedang mengantre di kotak ini.
              </div>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {activePatients.map((patient, idx) => {
                  const isChecked = selectedIds.includes(patient.id);
                  const cfg = patientConfigs[patient.id] || { isLepas: false, kurangTindakan: 2 };
                  return (
                    <div
                      key={`peralihan-${patient.id}-${idx}`}
                      onClick={() => toggleSelect(patient.id)}
                      className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2.5 ${
                        isChecked 
                          ? 'bg-amber-50/70 border-amber-300 shadow-xs' 
                          : 'bg-white border-slate-200 opacity-60 hover:opacity-100'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSelect(patient.id)}
                          onClick={e => e.stopPropagation()}
                          className="w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] font-black bg-slate-900 text-white px-1.5 py-0.5 rounded font-mono">
                              #{idx + 1}
                            </span>
                            <span className="font-extrabold text-xs text-slate-900 truncate">
                              {patient.patientName}
                            </span>
                            <span className="text-[11px] font-mono text-slate-600">
                              (RM: {patient.medicalRecordNo})
                            </span>
                            {patient.isWarning && (
                              <span className="text-[9px] font-bold bg-rose-100 text-rose-800 px-1.5 py-0.5 rounded border border-rose-200">
                                🛑 Warning
                              </span>
                            )}
                            {patient.isRanap && (
                              <span className="text-[9px] font-bold bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded border border-blue-200">
                                🛏️ Ranap
                              </span>
                            )}
                          </div>
                          {/* Action Code & Cross Picker */}
                          <div className="mt-1">
                            <ActionCodeBadge
                              actionCode={patient.actionCode}
                              crossedCodes={cfg.crossedActionCodes}
                              showSummary={true}
                              size="sm"
                            />
                          </div>

                          {/* Peralihan Status Pickers */}
                          {isChecked && (
                            <div 
                              className="mt-2 space-y-1.5" 
                              onClick={e => e.stopPropagation()}
                            >
                              <div className="flex items-center gap-2 flex-wrap">
                                <button
                                  type="button"
                                  onClick={() => setPatientStatusLepas(patient.id, !cfg.isLepas)}
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-all cursor-pointer ${
                                    cfg.isLepas
                                      ? 'bg-emerald-600 text-white border-emerald-700 shadow-2xs'
                                      : 'bg-white text-slate-600 border-slate-300 hover:border-emerald-400'
                                  }`}
                                >
                                  {cfg.isLepas ? '✓ Status Lepas (Tetap di Peralihan)' : 'Lepas'}
                                </button>
                              </div>

                              {!cfg.isLepas && (
                                <ActionCodeCrossPicker
                                  actionCode={patient.actionCode}
                                  crossedCodes={cfg.crossedActionCodes}
                                  onChangeCrossed={(newCrossed, remSummary) => 
                                    setPatientCrossedCodes(patient.id, newCrossed, remSummary)
                                  }
                                  compact={true}
                                />
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {patient.queueNumber && (
                        <div className="shrink-0 text-right">
                          <span className="text-xs font-black text-slate-700 bg-white px-2 py-1 rounded border border-slate-200 shadow-2xs font-mono">
                            {patient.queueNumber}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-slate-700 hover:bg-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            Batal
          </button>

          <button
            type="button"
            disabled={selectedIds.length === 0}
            onClick={handleExecute}
            className={`px-5 py-2.5 rounded-xl text-xs font-black shadow-md flex items-center gap-2 transition-all cursor-pointer ${
              selectedIds.length === 0
                ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-600 text-white shadow-amber-500/25 active:scale-95'
            }`}
          >
            <Sun className="w-4 h-4 text-amber-200" />
            <span>Eksekusi ALIHKAN SIANG ({selectedIds.length} Pasien)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
