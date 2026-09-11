import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { QueueBox, PatientItem } from '../types';
import { 
  RotateCcw, 
  ArrowLeftRight, 
  Users, 
  CheckCircle2, 
  AlertTriangle, 
  X, 
  Tag, 
  ArrowRight,
  ShieldAlert,
  Building2,
  Check,
  Sparkles
} from 'lucide-react';
import { ActionCodeCrossPicker } from './ActionCodeCrossPicker';
import { ActionCodeBadge } from './ActionCodeBadge';
import { 
  getActionTokensOrFallback, 
  getRemainingActionTokens, 
  formatRemainingCodes,
  formatCrossedCodes 
} from '../utils/actionCodeUtils';

interface PatientReturnState {
  isLepas: boolean;
  kurangTindakan: number;
  kurangTindakanKode?: string;
  crossedActionCodes: string[];
  targetBoxId: string;
}

interface AlihkanKembaliModalProps {
  isOpen: boolean;
  onClose: () => void;
  peralihanBox: QueueBox;
  patients: PatientItem[];
  allBoxes: QueueBox[];
  onConfirmReturn: (updatedPatients: PatientItem[]) => void;
}

export const AlihkanKembaliModal: React.FC<AlihkanKembaliModalProps> = ({
  isOpen,
  onClose,
  peralihanBox,
  patients,
  allBoxes,
  onConfirmReturn,
}) => {
  // Active (uncompleted) patients in Peralihan Siang
  const activePatients = useMemo(() => {
    return patients.filter(p => p.boxId === (peralihanBox ? peralihanBox.id : '') && !p.completed);
  }, [patients, peralihanBox?.id]);

  // Destination/origin boxes excluding current peralihan box (memoized to keep options stable)
  const candidateBoxes = useMemo(() => {
    return allBoxes.filter(b => b.id !== (peralihanBox ? peralihanBox.id : ''));
  }, [allBoxes, peralihanBox?.id]);

  // Local state for each patient's configuration
  const [patientStates, setPatientStates] = useState<Record<string, PatientReturnState>>({});

  useEffect(() => {
    if (isOpen) {
      const initial: Record<string, PatientReturnState> = {};
      activePatients.forEach(p => {
        // Find fallback origin box if originBoxId is not set or not in allBoxes
        const validOriginBox = allBoxes.find(b => b.id === p.originBoxId && b.id !== (peralihanBox ? peralihanBox.id : ''));
        const fallbackBox = validOriginBox || allBoxes.find(b => b.id !== (peralihanBox ? peralihanBox.id : '') && !b.id.includes('jemputan')) || allBoxes[0];
        const tokens = getActionTokensOrFallback(p.actionCode);
        const crossed = p.crossedActionCodes || [];
        const remaining = getRemainingActionTokens(tokens, crossed);
        const remCode = p.kurangTindakanKode || (remaining.length > 0 ? remaining.join('.') : undefined);

        initial[p.id] = {
          isLepas: p.isLepas ?? false,
          kurangTindakan: p.kurangTindakan ?? (remaining.length > 0 ? remaining.length : 2),
          kurangTindakanKode: remCode,
          crossedActionCodes: crossed,
          targetBoxId: p.originBoxId && allBoxes.some(b => b.id === p.originBoxId) ? p.originBoxId : (fallbackBox ? fallbackBox.id : '')
        };
      });
      setPatientStates(initial);
    }
  }, [isOpen, activePatients, allBoxes, peralihanBox?.id]);

  if (!isOpen || !peralihanBox) return null;

  const handleToggleLepas = (patientId: string, value: boolean) => {
    setPatientStates(prev => ({
      ...prev,
      [patientId]: {
        ...prev[patientId],
        isLepas: value
      }
    }));
  };

  const handleSetCrossedCodes = (patientId: string, newCrossed: string[], remSummary: string) => {
    setPatientStates(prev => ({
      ...prev,
      [patientId]: {
        ...prev[patientId],
        isLepas: false,
        crossedActionCodes: newCrossed,
        kurangTindakanKode: remSummary,
        kurangTindakan: remSummary ? remSummary.split('.').length : 0
      }
    }));
  };

  const handleSetTargetBox = (patientId: string, boxId: string) => {
    setPatientStates(prev => ({
      ...prev,
      [patientId]: {
        ...prev[patientId],
        targetBoxId: boxId
      }
    }));
  };

  const patientsReturning = activePatients.filter(p => !patientStates[p.id]?.isLepas);
  const patientsStaying = activePatients.filter(p => patientStates[p.id]?.isLepas);

  const handleExecute = () => {
    const updated = activePatients.map(p => {
      const state = patientStates[p.id];
      if (!state) return p;

      if (state.isLepas) {
        // Pasien Lepas: TETAP di kotak Peralihan Siang
        return {
          ...p,
          isLepas: true,
          kurangTindakan: undefined,
          kurangTindakanKode: undefined,
          peralihanStatus: 'lepas' as const
        };
      } else {
        // Pasien Kurang Tindakan: KEMBALI ke targetBoxId (kotak asal semula)
        const targetBox = allBoxes.find(b => b.id === state.targetBoxId);
        const targetTitle = targetBox ? targetBox.title.split('(')[0].trim() : 'Kotak Semula';
        const remLabel = state.kurangTindakanKode || `${state.kurangTindakan}`;
        
        return {
          ...p,
          boxId: state.targetBoxId || p.originBoxId || peralihanBox.id,
          isLepas: false,
          kurangTindakan: state.kurangTindakan,
          kurangTindakanKode: state.kurangTindakanKode,
          crossedActionCodes: state.crossedActionCodes,
          peralihanStatus: 'kurang' as const,
          note: p.note 
            ? `${p.note.replace(/\s*\(Kembali dari Peralihan.*?\)/g, '')} (Kembali dari Peralihan - Kurang ${remLabel})`
            : `Kembali dari Peralihan (Kurang ${remLabel})`
        };
      }
    });

    onConfirmReturn(updated);
    onClose();
  };

  const modalContent = (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in">
      <div 
        className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-teal-200 overflow-hidden flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-teal-600 via-teal-700 to-indigo-700 text-white flex items-start justify-between gap-3 shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-white shrink-0 shadow-inner border border-white/30">
              <RotateCcw className="w-6 h-6 text-teal-100" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-teal-900/50 text-teal-100 border border-teal-300/40 uppercase tracking-wider">
                  Pengalihan Balik
                </span>
                <span className="text-xs text-teal-100 font-bold">
                  {activePatients.length} Pasien di Peralihan Siang
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-black tracking-tight text-white mt-0.5">
                Alihkan Pasien Kembali ke Kotak Semula
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

        {/* Content */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 bg-amber-50/80 rounded-xl border border-amber-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center font-bold text-sm shadow-xs">
                  {patientsReturning.length}
                </div>
                <div>
                  <span className="text-xs font-bold text-amber-950 block">Kembali ke Kotak Semula</span>
                  <span className="text-[10px] text-amber-800">Pasien kurang tindakan (2/4/6 dst)</span>
                </div>
              </div>
              <span className="text-xs font-black text-amber-900 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-300">
                Dialihkan
              </span>
            </div>

            <div className="p-3 bg-emerald-50/80 rounded-xl border border-emerald-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
                  {patientsStaying.length}
                </div>
                <div>
                  <span className="text-xs font-bold text-emerald-950 block">Tetap di Peralihan Siang</span>
                  <span className="text-[10px] text-emerald-800">Pasien berstatus Lepas</span>
                </div>
              </div>
              <span className="text-xs font-black text-emerald-900 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300">
                Tetap
              </span>
            </div>
          </div>

          {/* Explanation Info */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
            <div className="text-[11px] leading-relaxed">
              Pilih status untuk setiap pasien: jika <strong>Lepas</strong>, pasien tetap di kotak Peralihan Siang. Jika <strong>Kurang Tindakan (2/4/6 dst)</strong>, pasien akan otomatis dikembalikan ke kotak asalnya.
            </div>
          </div>

          {/* Patient List */}
          <div className="space-y-2.5">
            <div className="font-bold text-xs text-slate-800 flex items-center justify-between">
              <span>Daftar Pasien di Kotak PERALIHAN SIANG ({activePatients.length})</span>
            </div>

            {activePatients.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                Tidak ada pasien aktif yang tersisa di Kotak Peralihan Siang.
              </div>
            ) : (
              <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                {activePatients.map((patient, idx) => {
                  const state = patientStates[patient.id] || { 
                    isLepas: false, 
                    kurangTindakan: 2, 
                    kurangTindakanKode: undefined,
                    crossedActionCodes: [], 
                    targetBoxId: '' 
                  };
                  const targetBox = allBoxes.find(b => b.id === state.targetBoxId);
                  const remLabel = state.kurangTindakanKode || `${state.kurangTindakan}`;

                  return (
                    <div
                      key={patient.id}
                      className={`p-3 rounded-xl border transition-all ${
                        state.isLepas
                          ? 'bg-emerald-50/50 border-emerald-300 shadow-2xs'
                          : 'bg-amber-50/50 border-amber-300 shadow-2xs'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                        {/* Patient Info */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] font-black bg-slate-900 text-white px-1.5 py-0.5 rounded font-mono">
                              #{idx + 1}
                            </span>
                            <span className="font-black text-xs text-slate-900">
                              {patient.patientName}
                            </span>
                            <span className="text-[11px] font-mono text-slate-600 bg-white/80 px-1 rounded border border-slate-200">
                              RM: {patient.medicalRecordNo}
                            </span>
                            {patient.isRanap && (
                              <span className="text-[9px] font-bold bg-blue-100 text-blue-800 px-1 rounded">
                                🛏️ Ranap
                              </span>
                            )}
                          </div>

                          <div 
                            className="mt-1 flex items-center gap-2 text-[11px] text-slate-600 flex-wrap"
                            onClick={e => e.stopPropagation()}
                          >
                            <span>Kotak Asal:</span>
                            <select
                              id={`select-target-box-${patient.id}`}
                              value={state.targetBoxId}
                              onChange={(e) => handleSetTargetBox(patient.id, e.target.value)}
                              disabled={state.isLepas}
                              className={`text-[11px] font-bold px-2 py-1 rounded-lg border outline-none transition-colors ${
                                state.isLepas 
                                  ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                                  : 'bg-white text-slate-800 border-slate-300 hover:border-teal-500 focus:border-teal-600 focus:ring-1 focus:ring-teal-500 shadow-2xs cursor-pointer'
                              }`}
                            >
                              {candidateBoxes.map(b => (
                                <option key={b.id} value={b.id}>
                                  {b.title} ({b.officerName})
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* Status Selection Buttons */}
                        <div className="flex items-center gap-2 flex-wrap shrink-0">
                          {/* Lepas Toggle */}
                          <button
                            type="button"
                            onClick={() => handleToggleLepas(patient.id, !state.isLepas)}
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 border ${
                              state.isLepas
                                ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                                : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300 hover:text-emerald-700'
                            }`}
                            title="Tandai pasien ini Lepas (Tetap di Peralihan Siang)"
                          >
                            <Check className={`w-3.5 h-3.5 ${state.isLepas ? 'text-white' : 'text-slate-400'}`} />
                            <span>Lepas (Tetap)</span>
                          </button>
                        </div>
                      </div>

                      {/* Action Code Crossing Picker if not Lepas */}
                      {!state.isLepas && (
                        <div className="mt-2.5">
                          <ActionCodeCrossPicker
                            actionCode={patient.actionCode}
                            crossedCodes={state.crossedActionCodes}
                            onChangeCrossed={(newCrossed, remSummary) =>
                              handleSetCrossedCodes(patient.id, newCrossed, remSummary)
                            }
                          />
                        </div>
                      )}

                      {/* Result Route Tag */}
                      <div className="mt-2 pt-1.5 border-t border-slate-200/60 flex items-center justify-between text-[10px]">
                        {state.isLepas ? (
                          <span className="text-emerald-800 font-bold flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Status: Lepas (Tetap tinggal di kotak Peralihan Siang)
                          </span>
                        ) : (
                          <div className="flex items-center gap-2 flex-wrap text-amber-900 font-bold">
                            <span className="flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                              Kurang Tindakan: <strong className="text-amber-950 font-mono underline">{remLabel}</strong>
                            </span>
                            <span>➔ Kembali ke: <strong className="text-slate-900">{targetBox ? targetBox.title : 'Kotak Semula'}</strong></span>
                            {state.crossedActionCodes.length > 0 && (
                              <span className="text-[9px] text-slate-500 bg-white/70 px-1 py-0.2 rounded border border-slate-200">
                                Sudah dicoret: {formatCrossedCodes(getActionTokensOrFallback(patient.actionCode), state.crossedActionCodes)}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
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
            disabled={activePatients.length === 0}
            onClick={handleExecute}
            className={`px-5 py-2.5 rounded-xl text-xs font-black shadow-md flex items-center gap-2 transition-all cursor-pointer ${
              activePatients.length === 0
                ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-teal-600 via-teal-700 to-indigo-700 hover:from-teal-700 hover:to-indigo-800 text-white shadow-teal-600/25 active:scale-95'
            }`}
          >
            <RotateCcw className="w-4 h-4 text-teal-200" />
            <span>Eksekusi ALIHKAN KEMBALI ({patientsReturning.length} Kembali, {patientsStaying.length} Tetap)</span>
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null;
};
