import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, ArrowRightCircle, ArrowRightLeft, UserCheck, 
  Hospital, Tag, FileText, AlertOctagon, CheckCircle2, 
  Send, Copy, MoveRight, Sparkles, Maximize2, Minimize2 
} from 'lucide-react';
import { QueueBox, PatientItem } from '../types';
import { databaseService } from '../utils/databaseService';
import { IcfDiagnosisInput } from './IcfDiagnosisInput';
import { appendActionCode } from '../utils/actionCodeUtils';
import { getJemputanActionDurationMinutes } from '../utils/jemputanTimerService';

interface QueueToAnotherBoxModalProps {
  isOpen: boolean;
  onClose: () => void;
  patient: PatientItem | null;
  currentBox: QueueBox | null;
  boxes: QueueBox[];
  onAddPatient: (patientData: Omit<PatientItem, 'id' | 'createdAt' | 'calledCount' | 'completed'>) => void;
  onCompleteSourcePatient?: (patientId: string) => void;
  onDeleteSourcePatient?: (patientId: string) => void;
}

export const QueueToAnotherBoxModal: React.FC<QueueToAnotherBoxModalProps> = React.memo(({
  isOpen,
  onClose,
  patient,
  currentBox,
  boxes,
  onAddPatient,
  onCompleteSourcePatient,
  onDeleteSourcePatient,
}) => {
  if (!isOpen || !patient) return null;

  // Filter destination boxes (preferably other boxes, but allow any)
  const availableBoxes = boxes.filter(b => b.id !== currentBox?.id);
  const defaultTargetBox = availableBoxes[0] || boxes[0];

  const [selectedBoxId, setSelectedBoxId] = useState<string>(defaultTargetBox?.id || '');
  const [actionCode, setActionCode] = useState<string>(patient.actionCode || '');
  const [diagnosis, setDiagnosis] = useState<string>(patient.diagnosis || '');
  const [transferMode, setTransferMode] = useState<'direct-move' | 'move' | 'copy'>('direct-move');
  const [note, setNote] = useState<string>(patient.note || '');
  const [isWarning, setIsWarning] = useState<boolean>(patient.isWarning || false);
  const [isRanap, setIsRanap] = useState<boolean>(patient.isRanap || false);
  const [isEnlarged, setIsEnlarged] = useState<boolean>(false);

  const initialPatientIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (isOpen && patient && initialPatientIdRef.current !== patient.id) {
      initialPatientIdRef.current = patient.id;
      setActionCode(patient.actionCode || '');
      setDiagnosis(patient.diagnosis || '');
      setNote(patient.note || '');
      setIsWarning(patient.isWarning || false);
      setIsRanap(patient.isRanap || false);
      if (defaultTargetBox) {
        setSelectedBoxId(defaultTargetBox.id);
      }
    }
    if (!isOpen) {
      initialPatientIdRef.current = null;
    }
  }, [isOpen, patient?.id, defaultTargetBox?.id]);

  const targetBox = boxes.find(b => b.id === selectedBoxId) || defaultTargetBox;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!patient || !selectedBoxId) return;

    // Check if target is jemputan box
    const isTargetJemputan = 
      selectedBoxId === 'box-jemputan' || 
      selectedBoxId.toLowerCase().includes('jemputan') ||
      targetBox?.title?.toUpperCase().includes('JEMPUTAN');

    const durationMinutes = isTargetJemputan ? getJemputanActionDurationMinutes(actionCode) : undefined;

    // 1. Add patient to new target box
    onAddPatient({
      boxId: selectedBoxId,
      patientName: patient.patientName.trim().toUpperCase(),
      medicalRecordNo: patient.medicalRecordNo.trim(),
      queueNumber: '', // will be assigned or auto-incremented
      actionCode: actionCode.trim().toUpperCase(),
      diagnosis: diagnosis.trim(),
      phoneNumber: patient.phoneNumber || '',
      patientId: patient.patientId,
      isWarning,
      isRanap,
      note: note.trim(),
      crossedActionCodes: patient.crossedActionCodes,
      kurangTindakan: patient.kurangTindakan,
      kurangTindakanKode: patient.kurangTindakanKode,
      isLepas: patient.isLepas,
      peralihanStatus: patient.peralihanStatus,
      originBoxId: patient.originBoxId,
      originBoxTitle: patient.originBoxTitle,
      instructionImageUrl: patient.instructionImageUrl,
      instructionImageUrls: patient.instructionImageUrls,
      instructionPhotos: patient.instructionPhotos,
      enteredJemputanAt: isTargetJemputan ? new Date().toISOString() : undefined,
      jemputanDurationMinutes: durationMinutes,
    });

    // 2. Handle source patient based on selected transferMode
    if (transferMode === 'direct-move') {
      // Direct Move: Remove cleanly from source box without marking completed
      if (onDeleteSourcePatient) {
        onDeleteSourcePatient(patient.id);
      }
    } else if (transferMode === 'move') {
      // Move (Transfer & Selesaikan): Mark source patient as completed
      if (onCompleteSourcePatient && !patient.completed) {
        onCompleteSourcePatient(patient.id);
      }
    }
    // If 'copy', source patient stays as-is (active)

    // 3. Update master patient record
    databaseService.saveMasterPatient({
      id: patient.patientId,
      medicalRecordNo: patient.medicalRecordNo,
      patientName: patient.patientName,
      lastBoxId: selectedBoxId,
      lastOfficerName: targetBox?.officerName,
      phoneNumber: patient.phoneNumber,
      defaultDiagnosis: diagnosis.trim(),
      defaultActionCode: actionCode.trim().toUpperCase(),
      notes: note.trim(),
    });

    onClose();
  };

  const modalContent = (
    <div className="fixed inset-0 z-50 bg-slate-950/75 flex items-center justify-center p-3 md:p-4 overflow-y-auto">
      <div className={`bg-white rounded-2xl shadow-2xl border border-slate-200 w-full flex flex-col overflow-hidden transition-all duration-200 ${
        isEnlarged ? 'max-w-4xl max-h-[94vh] h-[90vh]' : 'max-w-lg max-h-[92vh]'
      }`}>
        {/* Header */}
        <div className="bg-gradient-to-r from-teal-700 via-teal-800 to-slate-900 text-white p-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-teal-600/80 flex items-center justify-center shadow-inner">
              <ArrowRightLeft className="w-5 h-5 text-teal-200" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base tracking-tight">Antrekan ke Kotak Lain</h3>
              <p className="text-[11px] text-teal-200 font-medium">
                Kirim pasien yang sama ke terapis / tindakan berikutnya
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setIsEnlarged(!isEnlarged)}
              className="text-white/80 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              title={isEnlarged ? "Kecilkan Tampilan" : "Perbesar Tampilan (Layar Lebar Komputer)"}
            >
              {isEnlarged ? <Minimize2 className="w-5 h-5 text-amber-300" /> : <Maximize2 className="w-5 h-5" />}
            </button>
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              title="Tutup"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Patient Identity Badge */}
        <div className="bg-teal-50/70 border-b border-teal-100 p-3.5 flex items-center justify-between gap-3 text-xs">
          <div>
            <span className="text-[10px] uppercase font-bold text-teal-700 tracking-wider block">
              Pasien yang Diantrekan:
            </span>
            <div className="font-black text-slate-900 text-sm flex items-center gap-1.5 mt-0.5">
              <span>{patient.patientName}</span>
              {patient.isRanap && (
                <span className="px-1.5 py-0.2 bg-blue-100 text-blue-900 text-[9px] font-black rounded-md border border-blue-200">
                  🛏️ RANAP
                </span>
              )}
            </div>
            <div className="text-[11px] text-slate-600 font-mono mt-0.5">
              No. RM: <strong className="text-teal-800">{patient.medicalRecordNo}</strong>
              {patient.phoneNumber ? ` • 📞 ${patient.phoneNumber}` : ''}
            </div>
          </div>

          {currentBox && (
            <div className="text-right shrink-0 bg-white px-2.5 py-1.5 rounded-xl border border-teal-200/80 shadow-2xs">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Asal Kotak</span>
              <span className="font-bold text-slate-800 text-[11px] block truncate max-w-[140px]">
                {currentBox.title.split('(')[0]}
              </span>
              <span className="text-[10px] text-teal-700 font-semibold block truncate max-w-[140px]">
                {currentBox.officerName}
              </span>
            </div>
          )}
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs text-slate-700 flex-1">
          {/* Destination Box Picker */}
          <div>
            <label className="block font-bold text-slate-900 mb-1.5 text-xs">
              Pilih Kotak Antrean / Petugas Tujuan *
            </label>
            <div className={`grid gap-1.5 overflow-y-auto pr-1 ${isEnlarged ? 'grid-cols-2 md:grid-cols-3 max-h-64' : 'grid-cols-1 max-h-48'}`}>
              {boxes.map((b) => {
                const isCurrent = b.id === currentBox?.id;
                const isSelected = b.id === selectedBoxId;
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setSelectedBoxId(b.id)}
                    className={`p-2.5 rounded-xl text-left border transition-all flex items-center justify-between gap-2 cursor-pointer ${
                      isSelected
                        ? 'bg-teal-50 border-teal-500 ring-2 ring-teal-500/20 shadow-xs'
                        : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                        <span className="truncate">{b.title}</span>
                        {isCurrent && (
                          <span className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-semibold">
                            (Asal)
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 font-medium truncate">
                        {b.location ? `📍 ${b.location}` : 'Kotak Antrian'}
                      </div>
                    </div>
                    {isSelected && (
                      <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Transfer Mode Selector (3 Distinct Options) */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <label className="block font-bold text-slate-900 text-xs">
                Pilih Metode Pemindahan Pasien:
              </label>
              <span className="text-[10px] text-slate-500 font-medium">
                Pilih salah satu sesuai kebutuhan
              </span>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {/* Opsi 1: Pindahkan Saja (Cut & Paste / Hapus dari Asal Tanpa Tandai Selesai) */}
              <button
                type="button"
                onClick={() => setTransferMode('direct-move')}
                className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all flex flex-col justify-between gap-1.5 ${
                  transferMode === 'direct-move'
                    ? 'bg-amber-50/80 border-amber-500 ring-2 ring-amber-500/20 shadow-xs text-amber-950'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1.5">
                    <ArrowRightLeft className={`w-4 h-4 shrink-0 ${transferMode === 'direct-move' ? 'text-amber-700' : 'text-slate-400'}`} />
                    <span className="font-bold text-xs">Pindahkan Saja</span>
                  </div>
                  {transferMode === 'direct-move' && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  )}
                </div>
                <span className="text-[10px] text-slate-500 leading-snug">
                  <strong className="text-amber-900">Pindah & hilang</strong> dari kotak asal (cocok untuk salah input / oper antrean murni).
                </span>
              </button>

              {/* Opsi 2: Selesaikan & Pindahkan (Transfer) */}
              <button
                type="button"
                onClick={() => setTransferMode('move')}
                className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all flex flex-col justify-between gap-1.5 ${
                  transferMode === 'move'
                    ? 'bg-blue-50/80 border-blue-500 ring-2 ring-blue-500/20 shadow-xs text-blue-950'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1.5">
                    <MoveRight className={`w-4 h-4 shrink-0 ${transferMode === 'move' ? 'text-blue-700' : 'text-slate-400'}`} />
                    <span className="font-bold text-xs">Selesai & Transfer</span>
                  </div>
                  {transferMode === 'move' && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  )}
                </div>
                <span className="text-[10px] text-slate-500 leading-snug">
                  <strong className="text-blue-900">Tandai selesai</strong> di kotak asal & antrekan baru ke kotak tujuan.
                </span>
              </button>

              {/* Opsi 3: Gandakan (Duplicate) */}
              <button
                type="button"
                onClick={() => setTransferMode('copy')}
                className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all flex flex-col justify-between gap-1.5 ${
                  transferMode === 'copy'
                    ? 'bg-teal-50/80 border-teal-500 ring-2 ring-teal-500/20 shadow-xs text-teal-950'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1.5">
                    <Copy className={`w-4 h-4 shrink-0 ${transferMode === 'copy' ? 'text-teal-700' : 'text-slate-400'}`} />
                    <span className="font-bold text-xs">Gandakan (Kopi)</span>
                  </div>
                  {transferMode === 'copy' && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                  )}
                </div>
                <span className="text-[10px] text-slate-500 leading-snug">
                  <strong className="text-teal-900">Tetap aktif</strong> di kotak asal & aktif juga di kotak tujuan (simultan).
                </span>
              </button>
            </div>
          </div>

          {/* Action Code for Target Box */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block font-bold text-slate-800">
                Kode Tindakan di Kotak Tujuan
              </label>
              <span className="text-[10px] text-teal-700 font-semibold">
                Opsional / Ubah jika tindakan berbeda
              </span>
            </div>
            <div className="relative">
              <input
                type="text"
                value={actionCode}
                onChange={(e) => setActionCode(e.target.value)}
                placeholder="Contoh: MWD + TENS atau TERAPI OKUPASI"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:ring-2 focus:ring-teal-500 uppercase"
              />
              <Tag className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5 pointer-events-none" />
            </div>

            {/* Quick equipment chips */}
            <div className="flex flex-wrap items-center gap-1 mt-1.5">
              {[
                { code: '2', label: '2 MWD' },
                { code: '6', label: '6 TENS' },
                { code: '4', label: '4 US' },
                { code: '1', label: '1 IRR' },
                { code: '9', label: '9 Manipulasi' },
                { code: '10', label: '10 Rehab' },
                { code: '14', label: '14 Paket Chest+Inhalasi' },
                { code: '15', label: '15 Parafin' },
                { code: '18', label: '18 Nebu' },
                { code: '47', label: '47 Cryo' },
                { code: '74', label: '74 Vaccum' },
                { code: '75', label: '75 Chest' },
                { code: 'Latihan', label: 'Latihan' },
                { code: 'Okupasi', label: 'Okupasi' },
                { code: 'Wicara', label: 'Wicara' },
              ].map((item) => (
                <button
                  key={item.code}
                  type="button"
                  onClick={() => {
                    setActionCode(prev => appendActionCode(prev, item.code));
                  }}
                  className="px-1.5 py-0.5 bg-slate-100 hover:bg-teal-100 hover:text-teal-900 active:bg-teal-200 border border-slate-200 hover:border-teal-300 rounded text-[10px] text-slate-700 cursor-pointer font-medium transition-colors"
                  title={`Tambahkan kode ${item.label} (bisa diklik berkali-kali)`}
                >
                  +{item.label}
                </button>
              ))}
              {actionCode && (
                <button
                  type="button"
                  onClick={() => setActionCode('')}
                  className="px-1.5 py-0.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded text-[10px] font-semibold transition-colors cursor-pointer"
                  title="Hapus Kode"
                >
                  Hapus
                </button>
              )}
            </div>
          </div>

          {/* Diagnosis */}
          <div>
            <label className="block font-bold text-slate-800 mb-1">
              Diagnosa / ICF WHO (Bila Perlu Penyesuaian)
            </label>
            <IcfDiagnosisInput
              value={diagnosis}
              onChange={setDiagnosis}
              placeholder="Diagnosa klinis pasien..."
            />
          </div>

          {/* Note / Catatan Tindakan */}
          <div>
            <label className="block font-bold text-slate-800 mb-1">
              Catatan untuk Petugas Tujuan
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Contoh: Pasien selesai MWD, lanjut terapi latihan"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-teal-500"
            />
          </div>

          {/* Checkbox Warning / Ranap */}
          <div className="flex items-center gap-4 pt-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isWarning}
                onChange={(e) => setIsWarning(e.target.checked)}
                className="w-4 h-4 text-rose-600 rounded border-slate-300 focus:ring-rose-500"
              />
              <span className="font-bold text-rose-700 flex items-center gap-1">
                <AlertOctagon className="w-3.5 h-3.5" /> Pasien Warning
              </span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isRanap}
                onChange={(e) => setIsRanap(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
              />
              <span className="font-bold text-blue-700 flex items-center gap-1">
                🛏️ Pasien Rawat Inap (Ranap)
              </span>
            </label>
          </div>

          {/* Submit Button */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-all cursor-pointer"
            >
              Batal
            </button>

            <button
              type="submit"
              className="px-5 py-2.5 bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 text-white rounded-xl font-bold shadow-md flex items-center gap-2 transition-all cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>
                Antrekan ke {targetBox ? targetBox.title.split('(')[0] : 'Kotak'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null;
});
