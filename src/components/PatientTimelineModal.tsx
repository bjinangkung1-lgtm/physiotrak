import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, Calendar, Clock, User, Stethoscope, ChevronRight, 
  History, Sparkles, AlertCircle, CheckCircle2, ArrowRight,
  Maximize2, Minimize2, Hospital, Activity, Filter, Layers
} from 'lucide-react';
import { MasterPatient, PatientItem, QueueBox, PatientVisitHistoryItem } from '../types';
import { 
  getPatientMultiDisciplineSummary, 
  getDisciplineBadgeInfo, 
  normalizeCategory 
} from '../utils/patientDisciplineUtils';
import { getTherapistCategory, TherapyCategory } from '../utils/savedOfficersService';

interface PatientTimelineModalProps {
  isOpen: boolean;
  onClose: () => void;
  patient: PatientItem | MasterPatient | null;
  boxes: QueueBox[];
  onSelectBoxForPatient?: (boxId: string) => void;
}

export const PatientTimelineModal: React.FC<PatientTimelineModalProps> = ({
  isOpen,
  onClose,
  patient,
  boxes,
  onSelectBoxForPatient,
}) => {
  const [isEnlarged, setIsEnlarged] = useState(false);
  const [selectedDisciplineFilter, setSelectedDisciplineFilter] = useState<'all' | TherapyCategory>('all');

  if (!isOpen || !patient) return null;

  const patientName = patient.patientName || 'Pasien';
  const medicalRecordNo = patient.medicalRecordNo || '-';
  
  // Extract data from MasterPatient or PatientItem
  const mp = patient as Partial<MasterPatient>;
  const pi = patient as Partial<PatientItem>;

  const totalVisits = mp.totalVisits || pi.visitCount || 1;
  const firstOfficer = mp.firstOfficerName || pi.firstOfficerName || mp.lastOfficerName || 'Belum Tercatat';
  const firstBoxTitle = mp.firstBoxId ? (boxes.find(b => b.id === mp.firstBoxId)?.title || mp.firstBoxId) : (pi.firstBoxTitle || 'Terapis Awal');
  const firstVisitDate = mp.firstVisitDate || pi.firstVisitDate || mp.registeredDate || (pi.createdAt ? pi.createdAt.split('T')[0] : 'Kunjungan Pertama');
  const lastOfficer = mp.lastOfficerName || 'Terapis';
  const lastVisitDate = mp.lastVisitDate || (pi.createdAt ? pi.createdAt.split('T')[0] : '-');

  // Multi-discipline summary
  const disciplineSummary = useMemo(() => {
    return getPatientMultiDisciplineSummary(patient);
  }, [patient]);

  // Visit history list if available
  const rawVisitHistory: PatientVisitHistoryItem[] = useMemo(() => {
    if (mp.visitHistory && mp.visitHistory.length > 0) {
      return mp.visitHistory;
    }
    return [
      {
        visitNo: 1,
        date: firstVisitDate,
        boxId: mp.firstBoxId || pi.boxId || 'box-1',
        boxTitle: firstBoxTitle,
        officerName: firstOfficer,
        actionCode: mp.defaultActionCode || pi.actionCode || 'Tindakan IRM',
        diagnosis: mp.defaultDiagnosis || pi.diagnosis || 'Rehabilitasi Medik',
        isRanap: pi.isRanap || false,
        notes: 'Kedatangan / Kunjungan Awal Terapi Pasien',
      }
    ];
  }, [mp.visitHistory, firstVisitDate, mp.firstBoxId, pi.boxId, firstBoxTitle, firstOfficer, mp.defaultActionCode, pi.actionCode, mp.defaultDiagnosis, pi.diagnosis, pi.isRanap]);

  // Filtered visit history
  const filteredVisits = useMemo(() => {
    if (selectedDisciplineFilter === 'all') return rawVisitHistory;
    return rawVisitHistory.filter(v => {
      const vCat = v.category || getTherapistCategory(v.officerName, v.boxTitle);
      return vCat === selectedDisciplineFilter;
    });
  }, [rawVisitHistory, selectedDisciplineFilter]);

  return createPortal(
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 overflow-y-auto animate-in fade-in duration-150 isolate"
      onClick={onClose}
    >
      <div 
        className={`bg-white rounded-2xl shadow-2xl w-full overflow-hidden border border-slate-200 flex flex-col transition-all duration-150 isolate ${
          isEnlarged 
            ? 'max-w-[96vw] h-[94vh] max-h-[96vh]' 
            : 'max-w-4xl max-h-[90vh] h-[85vh]'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3.5 bg-gradient-to-r from-teal-700 via-teal-800 to-slate-800 text-white flex items-center justify-between shadow-xs shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center border border-white/20 shadow-inner shrink-0">
              <History className="w-5 h-5 text-teal-200" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold tracking-tight text-white flex items-center gap-2">
                <span>Riwayat Terapi & Garis Waktu Kunjungan</span>
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-teal-500/30 text-teal-100 border border-teal-400/40">
                  Total {totalVisits}x Terapi
                </span>
              </h2>
              <p className="text-xs text-teal-100/90 font-medium">
                Tracking Multi-Disiplin 1st PJ (Fisio, Okupasi, Wicara) & Histori Tindakan Pasien
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setIsEnlarged(!isEnlarged)}
              className="p-2 text-white/80 hover:text-white hover:bg-white/15 rounded-lg transition-colors cursor-pointer"
              title={isEnlarged ? "Kecilkan Tampilan" : "Perlebar Layar Penuh"}
            >
              {isEnlarged ? <Minimize2 className="w-5 h-5 text-amber-300" /> : <Maximize2 className="w-5 h-5" />}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-white/80 hover:text-white hover:bg-white/15 rounded-lg transition-colors cursor-pointer"
              title="Tutup Modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Patient Hero Info Card */}
        <div className="p-4 sm:p-5 bg-gradient-to-b from-slate-50 to-white border-b border-slate-200 shrink-0">
          {/* Identity Header Row */}
          <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="font-black text-slate-900 text-base sm:text-lg tracking-tight">
                {patientName}
              </span>
              <span className="font-mono bg-slate-100 text-slate-800 font-extrabold px-2.5 py-0.5 rounded-lg text-xs border border-slate-300 shadow-2xs">
                No. RM: {medicalRecordNo}
              </span>
              {(pi.isRanap || mp.registeredDate) && (
                <span className="px-2 py-0.5 bg-blue-50 text-blue-700 font-bold rounded-md text-[11px] border border-blue-200">
                  {pi.isRanap ? '🏥 Rawat Inap' : 'Rawat Jalan'}
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 text-xs text-slate-600">
              <div className="flex items-center gap-1.5 font-medium">
                <Activity className="w-4 h-4 text-teal-600" />
                <span>Total Kunjungan: <strong className="text-teal-800 font-bold">{totalVisits}x</strong></span>
              </div>
              <div className="flex items-center gap-1.5 font-medium">
                <Calendar className="w-4 h-4 text-slate-400" />
                <span>Terakhir: <strong>{lastVisitDate}</strong> ({lastOfficer})</span>
              </div>
            </div>
          </div>

          {/* Multi-Discipline 1st PJ Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {/* Fisioterapi (FT) Card */}
            {(() => {
              const fisio = disciplineSummary.fisio;
              const hasFT = fisio.hasHistory || fisio.firstTherapist || fisio.visitCount > 0;
              return (
                <div className={`p-3 rounded-xl border transition-all ${
                  hasFT 
                    ? 'bg-gradient-to-br from-teal-50/80 via-white to-teal-50/30 border-teal-200/90 shadow-2xs' 
                    : 'bg-slate-50/50 border-slate-200 opacity-60'
                }`}>
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-teal-100 text-teal-900 border border-teal-300/80">
                      Fisioterapi (FT)
                    </span>
                    {hasFT && (
                      <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded bg-teal-200/80 text-teal-950">
                        {fisio.visitCount}x Kunjungan
                      </span>
                    )}
                  </div>
                  <div className="mt-2">
                    <div className="text-[10px] text-slate-500 font-bold">1st PJ (Terapis Awal):</div>
                    <div className="font-extrabold text-xs sm:text-sm text-slate-900 truncate">
                      {fisio.firstTherapist?.officerName || (hasFT ? firstOfficer : 'Belum Ada')}
                    </div>
                    {fisio.firstTherapist?.firstVisitDate && (
                      <div className="text-[10px] text-slate-500 mt-0.5 truncate">
                        Awal: {fisio.firstTherapist.firstVisitDate}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Okupasi Terapi (OT) Card */}
            {(() => {
              const okupasi = disciplineSummary.okupasi;
              const hasOT = okupasi.hasHistory || okupasi.firstTherapist || okupasi.visitCount > 0;
              return (
                <div className={`p-3 rounded-xl border transition-all ${
                  hasOT 
                    ? 'bg-gradient-to-br from-purple-50/80 via-white to-purple-50/30 border-purple-200/90 shadow-2xs' 
                    : 'bg-slate-50/50 border-slate-200 opacity-60'
                }`}>
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-purple-100 text-purple-900 border border-purple-300/80">
                      Okupasi Terapi (OT)
                    </span>
                    {hasOT && (
                      <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded bg-purple-200/80 text-purple-950">
                        {okupasi.visitCount}x Kunjungan
                      </span>
                    )}
                  </div>
                  <div className="mt-2">
                    <div className="text-[10px] text-slate-500 font-bold">1st PJ (Terapis Awal):</div>
                    <div className="font-extrabold text-xs sm:text-sm text-slate-900 truncate">
                      {okupasi.firstTherapist?.officerName || (hasOT ? 'Tercatat di Riwayat' : 'Belum Ada')}
                    </div>
                    {okupasi.firstTherapist?.firstVisitDate && (
                      <div className="text-[10px] text-slate-500 mt-0.5 truncate">
                        Awal: {okupasi.firstTherapist.firstVisitDate}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Terapi Wicara (TW) Card */}
            {(() => {
              const wicara = disciplineSummary.wicara;
              const hasTW = wicara.hasHistory || wicara.firstTherapist || wicara.visitCount > 0;
              return (
                <div className={`p-3 rounded-xl border transition-all ${
                  hasTW 
                    ? 'bg-gradient-to-br from-amber-50/80 via-white to-amber-50/30 border-amber-200/90 shadow-2xs' 
                    : 'bg-slate-50/50 border-slate-200 opacity-60'
                }`}>
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-100 text-amber-950 border border-amber-300/80">
                      Terapi Wicara (TW)
                    </span>
                    {hasTW && (
                      <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded bg-amber-200/80 text-amber-950">
                        {wicara.visitCount}x Kunjungan
                      </span>
                    )}
                  </div>
                  <div className="mt-2">
                    <div className="text-[10px] text-slate-500 font-bold">1st PJ (Terapis Awal):</div>
                    <div className="font-extrabold text-xs sm:text-sm text-slate-900 truncate">
                      {wicara.firstTherapist?.officerName || (hasTW ? 'Tercatat di Riwayat' : 'Belum Ada')}
                    </div>
                    {wicara.firstTherapist?.firstVisitDate && (
                      <div className="text-[10px] text-slate-500 mt-0.5 truncate">
                        Awal: {wicara.firstTherapist.firstVisitDate}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Filter Navigation Bar */}
        <div className="px-5 py-2.5 bg-slate-100/80 border-b border-slate-200 flex items-center justify-between gap-2 shrink-0 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-slate-600 flex items-center gap-1 mr-1">
              <Filter className="w-3.5 h-3.5 text-slate-500" />
              <span>Filter:</span>
            </span>

            <button
              type="button"
              onClick={() => setSelectedDisciplineFilter('all')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                selectedDisciplineFilter === 'all'
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-300'
              }`}
            >
              Semua ({rawVisitHistory.length})
            </button>

            <button
              type="button"
              onClick={() => setSelectedDisciplineFilter('fisio')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                selectedDisciplineFilter === 'fisio'
                  ? 'bg-teal-700 text-white shadow-xs'
                  : 'bg-white text-teal-800 hover:bg-teal-50 border border-teal-200'
              }`}
            >
              <span>Fisio (FT)</span>
              {disciplineSummary.fisio.visitCount > 0 && (
                <span className="text-[10px] bg-teal-100 text-teal-900 px-1.5 rounded-full">
                  {disciplineSummary.fisio.visitCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setSelectedDisciplineFilter('okupasi')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                selectedDisciplineFilter === 'okupasi'
                  ? 'bg-purple-700 text-white shadow-xs'
                  : 'bg-white text-purple-800 hover:bg-purple-50 border border-purple-200'
              }`}
            >
              <span>Okupasi (OT)</span>
              {disciplineSummary.okupasi.visitCount > 0 && (
                <span className="text-[10px] bg-purple-100 text-purple-900 px-1.5 rounded-full">
                  {disciplineSummary.okupasi.visitCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setSelectedDisciplineFilter('wicara')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                selectedDisciplineFilter === 'wicara'
                  ? 'bg-amber-700 text-white shadow-xs'
                  : 'bg-white text-amber-900 hover:bg-amber-50 border border-amber-200'
              }`}
            >
              <span>Wicara (TW)</span>
              {disciplineSummary.wicara.visitCount > 0 && (
                <span className="text-[10px] bg-amber-100 text-amber-950 px-1.5 rounded-full">
                  {disciplineSummary.wicara.visitCount}
                </span>
              )}
            </button>
          </div>

          <span className="text-xs text-slate-500 font-medium">
            Menampilkan {filteredVisits.length} kunjungan
          </span>
        </div>

        {/* Timeline Body (Scrollable, Wide Multi-Card View) */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1 bg-slate-50/50">
          <div className="relative pl-6 space-y-3.5 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
            {filteredVisits.map((v, idx) => {
              const vCategory = v.category || getTherapistCategory(v.officerName, v.boxTitle);
              const badgeInfo = getDisciplineBadgeInfo(vCategory);
              const isFirstInDiscipline = v.disciplineVisitNo === 1;
              const isGlobalFirst = idx === filteredVisits.length - 1 || v.visitNo === 1;
              const isLatest = idx === 0;

              return (
                <div key={idx} className="relative group">
                  {/* Timeline Dot Indicator */}
                  <div className={`absolute -left-6 top-3 w-5 h-5 rounded-full border-2 flex items-center justify-center text-[10px] font-bold ${
                    isFirstInDiscipline 
                      ? `${badgeInfo.badgeBg} ${badgeInfo.badgeBorder} ${badgeInfo.badgeText} shadow-xs ring-2 ring-amber-300/50` 
                      : isLatest
                        ? 'bg-teal-600 border-teal-200 text-white shadow-xs ring-2 ring-teal-300/50'
                        : 'bg-white border-slate-300 text-slate-700'
                  }`}>
                    {v.disciplineVisitNo || v.visitNo || (filteredVisits.length - idx)}
                  </div>

                  {/* Card Info - Wide & Structured */}
                  <div className={`p-4 rounded-xl border transition-all ${
                    isFirstInDiscipline
                      ? 'bg-amber-50/50 border-amber-200/90 shadow-2xs hover:border-amber-300'
                      : isLatest
                        ? 'bg-white border-teal-200 shadow-xs hover:border-teal-300'
                        : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
                  }`}>
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Discipline Tag */}
                          <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border ${badgeInfo.tagBg}`}>
                            {badgeInfo.fullTitle}
                          </span>

                          <span className="font-extrabold text-sm text-slate-900">
                            {v.officerName || 'Terapis'}
                          </span>
                          <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                            {v.boxTitle ? v.boxTitle.split('(')[0].trim() : 'Kotak Terapi'}
                          </span>
                          {isFirstInDiscipline && (
                            <span className="text-[10px] font-black text-amber-900 bg-amber-200/80 border border-amber-300 px-2 py-0.5 rounded-md flex items-center gap-1">
                              <Sparkles className="w-3 h-3 text-amber-700" />
                              <span>1st PJ {badgeInfo.shortName}</span>
                            </span>
                          )}
                          {isLatest && !isFirstInDiscipline && (
                            <span className="text-[10px] font-bold text-teal-800 bg-teal-100 border border-teal-300 px-2 py-0.5 rounded-md">
                              Terbaru
                            </span>
                          )}
                        </div>

                        <div className="text-xs text-slate-500 flex items-center gap-2 flex-wrap">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            <span className="font-medium text-slate-700">{v.date || '-'}</span>
                          </div>
                          {v.disciplineVisitNo && (
                            <span className="font-bold text-slate-700 bg-slate-100 px-1.5 py-0.2 rounded text-[11px]">
                              Kunjungan ke-{v.disciplineVisitNo} ({badgeInfo.shortName})
                            </span>
                          )}
                          {v.completedAt && (
                            <span>• Selesai {new Date(v.completedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB</span>
                          )}
                        </div>
                      </div>

                      {/* Action Code Tag */}
                      {v.actionCode && (
                        <span className="text-xs font-mono font-bold text-teal-900 bg-teal-50 border border-teal-200 px-2.5 py-1 rounded-lg shrink-0 shadow-2xs">
                          {v.actionCode}
                        </span>
                      )}
                    </div>

                    {/* Diagnosis / Notes Details */}
                    {(v.diagnosis || v.notes) && (
                      <div className="mt-3 text-xs text-slate-700 bg-slate-50/90 p-2.5 rounded-xl border border-slate-200/80 grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {v.diagnosis && (
                          <div>
                            <span className="text-[10px] uppercase font-bold text-slate-400 block">Diagnosa:</span>
                            <span className="font-semibold text-slate-800">{v.diagnosis}</span>
                          </div>
                        )}
                        {v.notes && (
                          <div>
                            <span className="text-[10px] uppercase font-bold text-slate-400 block">Catatan:</span>
                            <span className="text-slate-600 italic">{v.notes}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Quick redirect button if onSelectBoxForPatient provided */}
                    {onSelectBoxForPatient && v.boxId && (
                      <div className="mt-3 flex justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            onSelectBoxForPatient(v.boxId);
                            onClose();
                          }}
                          className="px-3 py-1 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <span>Arahkan Antrean ke {v.officerName || 'Terapis Ini'}</span>
                          <ArrowRight className="w-3.5 h-3.5 text-teal-600" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-500 font-medium">
            💡 Histori multi-disiplin memisahkan 1st PJ dan hitungan kunjungan Fisioterapi (FT), Okupasi (OT), dan Wicara (TW).
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer shadow-xs"
          >
            Tutup Riwayat
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
