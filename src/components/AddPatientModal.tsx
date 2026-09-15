import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  X, UserPlus, AlertOctagon, Tag, FileText, Hospital, Search, 
  CheckCircle2, Phone, Calendar, User, MapPin, Database, Sparkles, ArrowRightLeft, Info,
  Camera, Upload, Image as ImageIcon, Trash2, ZoomIn, Loader2
} from 'lucide-react';
import { QueueBox, PatientItem, MasterPatient, PatientInstructionPhoto } from '../types';
import { databaseService } from '../utils/databaseService';
import { IcfDiagnosisInput } from './IcfDiagnosisInput';
import { appendActionCode } from '../utils/actionCodeUtils';
import { getPatientImageUrls, uploadPatientInstructionPhotos, processImageFile, handleImageErrorWithCloudFallback } from '../utils/imageUtils';
import { PatientPhotoModal } from './PatientPhotoModal';
import { getTherapistCategory } from '../utils/savedOfficersService';

interface AddPatientModalProps {
  isOpen: boolean;
  onClose: () => void;
  boxes: QueueBox[];
  defaultBoxId?: string;
  currentPatients?: PatientItem[];
  onAddPatient: (patientData: Omit<PatientItem, 'id' | 'createdAt' | 'calledCount' | 'completed'>) => void;
}

export const AddPatientModal: React.FC<AddPatientModalProps> = ({
  isOpen,
  onClose,
  boxes,
  defaultBoxId,
  currentPatients = [],
  onAddPatient,
}) => {
  const [selectedBoxId, setSelectedBoxId] = useState(defaultBoxId || boxes[0]?.id || 'box-1');
  const [patientName, setPatientName] = useState('');
  const [medicalRecordNo, setMedicalRecordNo] = useState('');
  const [queueNumber, setQueueNumber] = useState('');
  const [actionCode, setActionCode] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [identityNumber, setIdentityNumber] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [gender, setGender] = useState<'L' | 'P' | ''>('');
  const [address, setAddress] = useState('');
  const [isWarning, setIsWarning] = useState(false);
  const [isRanap, setIsRanap] = useState(false);
  const [note, setNote] = useState('');
  const [showExtraDetails, setShowExtraDetails] = useState(false);
  const [showDbBrowser, setShowDbBrowser] = useState(false);
  const [dbSearchQuery, setDbSearchQuery] = useState('');

  // Instruction Photos State
  const [attachedPhotos, setAttachedPhotos] = useState<PatientInstructionPhoto[]>([]);
  const [attachedUrls, setAttachedUrls] = useState<string[]>([]);
  const [pendingFiles, setPendingFiles] = useState<{ file: File; previewUrl: string }[]>([]);
  const [isUploadingPhotos, setIsUploadingPhotos] = useState(false);
  const [activePreviewPhotoModal, setActivePreviewPhotoModal] = useState(false);

  // Autocomplete state
  const [masterPatients, setMasterPatients] = useState<MasterPatient[]>([]);
  const [matchingPatients, setMatchingPatients] = useState<MasterPatient[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedMasterPatient, setSelectedMasterPatient] = useState<MasterPatient | null>(null);

  const searchContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      databaseService.getMasterPatients().then((data) => {
        setMasterPatients(data);
      });
    }
  }, [isOpen]);

  useEffect(() => {
    if (defaultBoxId) {
      setSelectedBoxId(defaultBoxId);
    } else if (boxes.length > 0) {
      setSelectedBoxId(boxes[0].id);
    }
  }, [defaultBoxId, boxes, isOpen]);

  // Autocomplete filter
  useEffect(() => {
    const term = (medicalRecordNo || patientName).toLowerCase().trim();
    if (term.length >= 2 && masterPatients.length > 0) {
      const matches = masterPatients.filter(
        (mp) =>
          mp.medicalRecordNo.toLowerCase().includes(term) ||
          mp.patientName.toLowerCase().includes(term) ||
          (mp.identityNumber && mp.identityNumber.toLowerCase().includes(term))
      );
      setMatchingPatients(matches.slice(0, 5));
      setShowSuggestions(matches.length > 0);
    } else {
      setMatchingPatients([]);
      setShowSuggestions(false);
    }
  }, [medicalRecordNo, patientName, masterPatients]);

  const handleSelectMasterPatient = (mp: MasterPatient) => {
    setSelectedMasterPatient(mp);
    setMedicalRecordNo(mp.medicalRecordNo);
    setPatientName(mp.patientName);
    if (mp.phoneNumber) setPhoneNumber(mp.phoneNumber);
    if (mp.identityNumber) setIdentityNumber(mp.identityNumber);
    if (mp.birthDate) setBirthDate(mp.birthDate);
    if (mp.gender) setGender(mp.gender);
    if (mp.address) setAddress(mp.address);
    if (mp.defaultDiagnosis && !diagnosis) setDiagnosis(mp.defaultDiagnosis);
    if (mp.defaultActionCode && !actionCode) setActionCode(mp.defaultActionCode);
    if (mp.notes && !note) setNote(mp.notes);

    // Smart Suggestion: Auto-suggest or pre-select therapist box based on 1st therapist / previous therapist
    const suggestedBoxId = mp.firstBoxId || mp.lastBoxId;
    if (suggestedBoxId && boxes.some((b) => b.id === suggestedBoxId)) {
      setSelectedBoxId(suggestedBoxId);
    }

    // Auto load previous instruction photos from Master Patient record
    const existingUrls = getPatientImageUrls(mp);
    setAttachedUrls(existingUrls);
    if (Array.isArray(mp.instructionPhotos)) {
      setAttachedPhotos(mp.instructionPhotos);
    }
    if (existingUrls.length > 0) {
      setIsRanap(true); // default to ranap if patient has instruction photos
    }

    setShowSuggestions(false);
    setShowDbBrowser(false);
  };

  const handlePhotoFilesSelected = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const newItems: { file: File; previewUrl: string }[] = [];

    for (const file of Array.from(files)) {
      const preview = URL.createObjectURL(file);
      newItems.push({ file, previewUrl: preview });
    }

    setPendingFiles((prev) => [...prev, ...newItems]);
    setIsRanap(true); // Automatically flag as Ranap when photo attached

    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  const handleRemoveExistingPhoto = (urlToRemove: string) => {
    setAttachedUrls((prev) => prev.filter((u) => u !== urlToRemove));
    setAttachedPhotos((prev) => prev.filter((p) => p.url !== urlToRemove && p.dataUrl !== urlToRemove));
  };

  const handleRemovePendingFile = (idx: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  // Calculate active patient counts per box
  const activeCountMap = useMemo(() => {
    const map: Record<string, number> = {};
    currentPatients.forEach((p) => {
      if (!p.completed) {
        map[p.boxId] = (map[p.boxId] || 0) + 1;
      }
    });
    return map;
  }, [currentPatients]);

  // Filter therapist boxes (excluding system boxes)
  const activeTherapistBoxes = useMemo(() => {
    return boxes.filter(
      (b) =>
        b.id !== 'box-peralihan-siang' &&
        b.id !== 'box-jemputan' &&
        !b.id.toLowerCase().includes('transport') &&
        !b.title.toLowerCase().includes('jemputan')
    );
  }, [boxes]);

  // Identify the bottom 4 therapists in the fisio list to exempt them from the least-patients algorithm
  const excludedBottom4FisioIds = useMemo(() => {
    const fisioBoxes = activeTherapistBoxes.filter(
      (b) => getTherapistCategory(b.officerName, b.location, b.category) === 'fisio'
    );
    if (fisioBoxes.length <= 4) return new Set<string>();
    const bottom4 = fisioBoxes.slice(fisioBoxes.length - 4);
    return new Set(bottom4.map((b) => b.id));
  }, [activeTherapistBoxes]);

  // Sort therapist boxes by lowest active queue count (exempting bottom 4 fisio therapists)
  const rankedActiveBoxes = useMemo(() => {
    const eligibleBoxes = activeTherapistBoxes.filter((b) => !excludedBottom4FisioIds.has(b.id));
    return [...eligibleBoxes].sort((a, b) => {
      const countA = activeCountMap[a.id] || 0;
      const countB = activeCountMap[b.id] || 0;
      return countA - countB;
    });
  }, [activeTherapistBoxes, excludedBottom4FisioIds, activeCountMap]);

  if (!isOpen) return null;

  const activeBox = boxes.find((b) => b.id === selectedBoxId) || boxes[0];
  const leastLoadedBox = rankedActiveBoxes[0] || null;

  // Check if this patient is currently active in any box
  const activeQueuesForPatient = currentPatients.filter(
    (p) =>
      !p.completed &&
      medicalRecordNo.trim() &&
      p.medicalRecordNo.toLowerCase().trim() === medicalRecordNo.toLowerCase().trim()
  );

  const filteredDbPatients = masterPatients.filter((mp) => {
    if (!dbSearchQuery) return true;
    const q = dbSearchQuery.toLowerCase().trim();
    return (
      mp.patientName.toLowerCase().includes(q) ||
      mp.medicalRecordNo.toLowerCase().includes(q) ||
      (mp.phoneNumber && mp.phoneNumber.includes(q)) ||
      (mp.identityNumber && mp.identityNumber.includes(q)) ||
      (mp.defaultDiagnosis && mp.defaultDiagnosis.toLowerCase().includes(q))
    );
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientName.trim() || !medicalRecordNo.trim()) return;

    const targetBoxId = selectedBoxId || activeBox?.id || 'box-1';
    const cleanQueue = queueNumber.trim();
    const cleanRM = medicalRecordNo.trim();
    const cleanName = patientName.trim().toUpperCase();

    setIsUploadingPhotos(true);
    let finalUrls = [...attachedUrls];
    let finalPhotos = [...attachedPhotos];

    if (pendingFiles.length > 0) {
      try {
        const uploadRes = await uploadPatientInstructionPhotos(
          pendingFiles.map((p) => p.file),
          {
            medicalRecordNo: cleanRM,
            patientName: cleanName,
            patientId: selectedMasterPatient?.id,
            boxId: targetBoxId,
          }
        );
        finalUrls = Array.from(new Set([...finalUrls, ...uploadRes.urls]));
        finalPhotos = [...finalPhotos, ...uploadRes.photos];
      } catch (err) {
        console.warn('Error uploading pending photos in modal:', err);
      }
    }

    // 1. Add to active queue
    onAddPatient({
      boxId: targetBoxId,
      patientName: cleanName,
      medicalRecordNo: cleanRM,
      queueNumber: cleanQueue,
      actionCode: actionCode.trim().toUpperCase(),
      diagnosis: diagnosis.trim(),
      isWarning,
      isRanap,
      isReady: true,
      note: note.trim(),
      phoneNumber: phoneNumber.trim(),
      patientId: selectedMasterPatient?.id,
      instructionImageUrl: finalUrls[0] || undefined,
      instructionImageUrls: finalUrls.length > 0 ? finalUrls : undefined,
      instructionPhotos: finalPhotos.length > 0 ? finalPhotos : undefined,
    });

    // 2. Persist / update Master Patient database
    databaseService.saveMasterPatient({
      id: selectedMasterPatient?.id,
      medicalRecordNo: cleanRM,
      patientName: cleanName,
      identityNumber: identityNumber.trim(),
      phoneNumber: phoneNumber.trim(),
      birthDate: birthDate,
      gender: gender,
      address: address.trim(),
      defaultDiagnosis: diagnosis.trim(),
      defaultActionCode: actionCode.trim().toUpperCase(),
      notes: note.trim(),
      instructionImageUrl: finalUrls[0] || undefined,
      instructionImageUrls: finalUrls.length > 0 ? finalUrls : undefined,
      instructionPhotos: finalPhotos.length > 0 ? finalPhotos : undefined,
      lastBoxId: targetBoxId,
      lastOfficerName: activeBox?.officerName,
    });

    // Reset form
    setPatientName('');
    setMedicalRecordNo('');
    setQueueNumber('');
    setActionCode('');
    setDiagnosis('');
    setPhoneNumber('');
    setIdentityNumber('');
    setBirthDate('');
    setGender('');
    setAddress('');
    setIsWarning(false);
    setIsRanap(false);
    setNote('');
    setAttachedPhotos([]);
    setAttachedUrls([]);
    setPendingFiles([]);
    setIsUploadingPhotos(false);
    setSelectedMasterPatient(null);
    setShowExtraDetails(false);
    setShowDbBrowser(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 md:p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-teal-700 via-teal-800 to-slate-900 text-white p-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-teal-600/80 flex items-center justify-center shadow-inner">
              <UserPlus className="w-5 h-5 text-teal-200" />
            </div>
            <div>
              <h3 className="font-extrabold text-base tracking-tight">Input & Antrekan Pasien</h3>
              {activeBox && (
                <span className="text-[11px] text-teal-100 font-medium">
                  Tujuan: <strong className="text-white underline">{activeBox.title}</strong> {activeBox.location ? `(${activeBox.location})` : ''}
                </span>
              )}
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Database Quick Picker Toolbar */}
        <div className="bg-slate-100/90 border-b border-slate-200 px-4 py-2 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-1.5 text-xs text-slate-700 font-semibold">
            <Database className="w-4 h-4 text-teal-700 shrink-0" />
            <span>Database Master Pasien: <strong className="text-slate-900 font-bold">{masterPatients.length}</strong> terdaftar</span>
          </div>
          <button
            type="button"
            onClick={() => setShowDbBrowser(!showDbBrowser)}
            className="px-2.5 py-1 bg-white hover:bg-teal-50 border border-slate-300 hover:border-teal-400 text-teal-800 rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer flex items-center gap-1.5"
          >
            <Search className="w-3.5 h-3.5 text-teal-600" />
            <span>{showDbBrowser ? 'Tutup Pencarian Database' : 'Cari & Ambil dari Database'}</span>
          </button>
        </div>

        {/* Database Browser Panel Drawer */}
        {showDbBrowser && (
          <div className="p-3 bg-teal-50/80 border-b border-teal-200 max-h-60 overflow-y-auto space-y-2 shrink-0 animate-in fade-in">
            <div className="relative">
              <input
                type="text"
                value={dbSearchQuery}
                onChange={(e) => setDbSearchQuery(e.target.value)}
                placeholder="Ketik Nama, No. RM, NIK, No. HP untuk mencari di database..."
                className="w-full pl-8 pr-3 py-1.5 bg-white border border-teal-300 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-teal-500 font-medium"
                autoFocus
              />
              <Search className="w-3.5 h-3.5 text-teal-600 absolute left-2.5 top-2.5 pointer-events-none" />
            </div>

            <div className="space-y-1 divide-y divide-teal-100 max-h-40 overflow-y-auto bg-white rounded-lg border border-teal-200 p-1">
              {filteredDbPatients.length === 0 ? (
                <div className="p-3 text-center text-xs text-slate-500">
                  Tidak ditemukan pasien dengan kata kunci "{dbSearchQuery}"
                </div>
              ) : (
                filteredDbPatients.slice(0, 10).map((mp) => (
                  <div
                    key={mp.id}
                    className="p-2 hover:bg-teal-50/90 rounded-md transition-colors flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0 flex-1 text-xs">
                      <div className="font-bold text-slate-900 flex items-center gap-1.5 flex-wrap">
                        <span>{mp.patientName}</span>
                        <span className="font-mono text-teal-800 bg-teal-100/70 px-1.5 py-0.2 rounded text-[11px]">
                          RM: {mp.medicalRecordNo}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 truncate mt-0.5">
                        {mp.defaultDiagnosis || 'Poli Fisioterapi IRM'} {mp.phoneNumber ? `• 📞 ${mp.phoneNumber}` : ''}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSelectMasterPatient(mp)}
                      className="px-2.5 py-1 bg-teal-700 hover:bg-teal-800 text-white rounded-md text-[11px] font-bold shrink-0 transition-all cursor-pointer shadow-2xs"
                    >
                      Pilih Pasien
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Form Body with scrolling */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs text-slate-700">
          {/* Target Box Selection */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label className="block font-bold text-slate-800">
                Pilih Kotak Antrian Tujuan *
              </label>
              {leastLoadedBox && (
                <button
                  type="button"
                  onClick={() => setSelectedBoxId(leastLoadedBox.id)}
                  className="text-[11px] font-bold text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-300 px-2 py-0.5 rounded-md transition-all flex items-center gap-1 shadow-2xs hover:scale-105 cursor-pointer"
                  title="Pilih otomatis terapis dengan beban antrean paling sedikit"
                >
                  <Sparkles className="w-3 h-3 text-teal-600" />
                  <span>Pilih Pasien Tersedikit ({leastLoadedBox.title.split('(')[0].trim()}: {activeCountMap[leastLoadedBox.id] || 0})</span>
                </button>
              )}
            </div>

            <select
              value={selectedBoxId}
              onChange={(e) => setSelectedBoxId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold bg-white focus:ring-2 focus:ring-teal-500 cursor-pointer shadow-2xs text-slate-900"
            >
              {boxes.map((b) => {
                const activeCount = activeCountMap[b.id] || 0;
                return (
                  <option key={b.id} value={b.id}>
                    {b.title} {b.location ? `— 📍 ${b.location}` : ''} ({activeCount} pasien aktif)
                  </option>
                );
              })}
            </select>
          </div>

          {/* Active Queue Status Warning / Notice (Same Patient in Other Boxes) */}
          {activeQueuesForPatient.length > 0 && (
            <div className="bg-amber-50 border border-amber-300 text-amber-900 p-3 rounded-xl flex items-start gap-2.5 shadow-2xs animate-in fade-in">
              <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs">
                <span className="font-bold block">
                  Pasien ini ({medicalRecordNo}) sedang aktif antre di {activeQueuesForPatient.length} kotak lain:
                </span>
                <ul className="list-disc list-inside text-[11px] text-amber-800 mt-1 space-y-0.5">
                  {activeQueuesForPatient.map((aq) => {
                    const bx = boxes.find((b) => b.id === aq.boxId);
                    return (
                      <li key={aq.id}>
                        <strong>{bx ? bx.title.split('(')[0] : aq.boxId}</strong> ({bx?.officerName || 'Terapis'})
                        {aq.actionCode ? ` — Tindakan: ${aq.actionCode}` : ''}
                      </li>
                    );
                  })}
                </ul>
                <span className="text-[10px] text-amber-700 mt-1 block font-medium">
                  ✓ Sistem mendukung pasien berada di beberapa kotak tindakan secara simultan atau berurutan.
                </span>
              </div>
            </div>
          )}

          {/* Autocomplete Notice with 1st Therapist & History Details */}
          {selectedMasterPatient && (
            <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-amber-50 border border-emerald-300/80 text-emerald-950 px-3.5 py-2.5 rounded-xl shadow-2xs space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-bold text-slate-900 text-xs">
                    Pasien Terdaftar: <strong>{selectedMasterPatient.patientName}</strong> ({selectedMasterPatient.medicalRecordNo})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedMasterPatient(null)}
                  className="text-slate-500 hover:text-rose-700 text-[11px] font-bold underline cursor-pointer"
                >
                  Reset
                </button>
              </div>

              <div className="flex items-center gap-2 flex-wrap text-[11px] text-slate-700">
                <span className="inline-flex items-center gap-1 bg-amber-100/90 text-amber-950 px-2 py-0.5 rounded-md font-bold border border-amber-300">
                  <User className="w-3 h-3 text-amber-700" />
                  <span>Terapis Pertama (1st PJ): <strong>{selectedMasterPatient.firstOfficerName || selectedMasterPatient.lastOfficerName || 'Belum tercatat'}</strong></span>
                </span>
                <span className="inline-flex items-center gap-1 bg-teal-100/90 text-teal-950 px-2 py-0.5 rounded-md font-bold border border-teal-300">
                  <span>Total Kunjungan: <strong>{selectedMasterPatient.visitCount || selectedMasterPatient.totalVisits || 1}x</strong></span>
                </span>
                {selectedMasterPatient.firstVisitDate && (
                  <span className="text-[10px] text-slate-500 font-mono">
                    Perdana: {selectedMasterPatient.firstVisitDate}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Patient Name & RM with Autocomplete Dropdown */}
          <div ref={searchContainerRef} className="relative">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  No. Rekam Medis (RM) *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={medicalRecordNo}
                    onChange={(e) => {
                      setMedicalRecordNo(e.target.value);
                      if (selectedMasterPatient && e.target.value !== selectedMasterPatient.medicalRecordNo) {
                        setSelectedMasterPatient(null);
                      }
                    }}
                    onFocus={() => {
                      if (matchingPatients.length > 0) setShowSuggestions(true);
                    }}
                    placeholder="Ketik No. RM (Cari/Baru)"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold font-mono text-slate-900 focus:ring-2 focus:ring-teal-500"
                  />
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Nama Pasien (Beserta Gelar/Sapaan) *
                </label>
                <input
                  type="text"
                  required
                  value={patientName}
                  onChange={(e) => {
                    setPatientName(e.target.value);
                    if (selectedMasterPatient && e.target.value !== selectedMasterPatient.patientName) {
                      setSelectedMasterPatient(null);
                    }
                  }}
                  onFocus={() => {
                    if (matchingPatients.length > 0) setShowSuggestions(true);
                  }}
                  placeholder="Contoh: MUFLIHATI, NY"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>

            {/* Suggestions dropdown */}
            {showSuggestions && matchingPatients.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-300 rounded-xl shadow-xl z-20 overflow-hidden divide-y divide-slate-100">
                <div className="px-3 py-1.5 bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                  <span>Ditemukan di Database Master Pasien:</span>
                  <span className="text-teal-700 font-semibold">Klik untuk auto-fill</span>
                </div>
                {matchingPatients.map((mp) => (
                  <button
                    key={mp.id}
                    type="button"
                    onClick={() => handleSelectMasterPatient(mp)}
                    className="w-full text-left px-3 py-2 hover:bg-teal-50 transition-colors flex items-center justify-between cursor-pointer"
                  >
                    <div>
                      <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                        <span>{mp.patientName}</span>
                        <span className="font-mono text-teal-700">({mp.medicalRecordNo})</span>
                        {mp.firstOfficerName && (
                          <span className="bg-amber-100 text-amber-900 border border-amber-300/80 px-1.5 py-0.2 rounded text-[9px] font-bold">
                            1st: {mp.firstOfficerName.split(',')[0].split(' ')[0]}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {mp.defaultDiagnosis || 'Poli Fisioterapi'} {mp.phoneNumber ? `• 📞 ${mp.phoneNumber}` : ''}
                      </div>
                    </div>
                    <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-semibold shrink-0">
                      {mp.visitCount || mp.totalVisits || 1}x Datang
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Action Code & Phone Number */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block font-bold text-slate-800">
                  C/J/P/PP Kode Tindakan *
                </label>
                <span className="text-[10px] text-teal-700 font-semibold">
                  Utilisasi Alat
                </span>
              </div>
              <div className="relative">
                <input
                  type="text"
                  value={actionCode}
                  onChange={(e) => setActionCode(e.target.value)}
                  placeholder="Contoh: 2, 6 atau C 2+4 atau MWD+TENS"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:ring-2 focus:ring-teal-500 uppercase"
                />
                <Tag className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5 pointer-events-none" />
              </div>
              {/* Quick Equipment Code Chips */}
              <div className="flex flex-wrap items-center gap-1 mt-1.5 pt-1">
                {[
                  { code: '2', label: '2 MWD (15m)' },
                  { code: '6', label: '6 TENS (15m)' },
                  { code: '4', label: '4 US (10m)' },
                  { code: '1', label: '1 IRR (15m)' },
                  { code: '1+10', label: '1+10 IR+Rehab (30m)' },
                  { code: '9', label: '9 Manipulasi (15m)' },
                  { code: '10', label: '10 Rehab (20m)' },
                  { code: '14', label: '14 Paket Chest (30m)' },
                  { code: '15', label: '15 Parafin (20m)' },
                  { code: '18', label: '18 Nebu (15m)' },
                  { code: '47', label: '47 Cryo (10m)' },
                  { code: '74', label: '74 Vaccum (20m)' },
                  { code: '75', label: '75 Chest (20m)' },
                  { code: 'OT', label: 'OT Okupasi (30m)' },
                  { code: 'TW', label: 'TW Wicara (30m)' },
                ].map((item) => (
                  <button
                    key={item.code}
                    type="button"
                    onClick={() => {
                      setActionCode(prev => appendActionCode(prev, item.code));
                    }}
                    className="px-1.5 py-0.5 bg-slate-100 hover:bg-teal-100 hover:text-teal-900 active:bg-teal-200 border border-slate-200 hover:border-teal-300 rounded text-[10px] font-mono text-slate-700 transition-colors cursor-pointer"
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
                    title="Hapus / Reset Kode Tindakan"
                  >
                    Hapus
                  </button>
                )}
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-800 mb-1">
                No. HP / WhatsApp Pasien (Opsional)
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="Contoh: 08123456789"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-teal-500"
                />
                <Phone className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Diagnosis */}
          <div>
            <label className="block font-bold text-slate-800 mb-1">
              Diagnosis (ICF WHO / Klinis)
            </label>
            <IcfDiagnosisInput
              value={diagnosis}
              onChange={setDiagnosis}
              placeholder="Pilih dari daftar ICF atau ketik diagnosa..."
              size="md"
            />
          </div>

          {/* Toggle Full Patient Identity Profile */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowExtraDetails(!showExtraDetails)}
              className="text-xs text-teal-700 font-bold hover:text-teal-900 flex items-center gap-1 cursor-pointer"
            >
              <span>{showExtraDetails ? '− Sembunyikan Data Profil Lengkap' : '+ Lengkapi Data Profil Pasien (NIK, Tgl Lahir, Alamat)'}</span>
            </button>

            {showExtraDetails && (
              <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">NIK / No. BPJS</label>
                    <input
                      type="text"
                      value={identityNumber}
                      onChange={(e) => setIdentityNumber(e.target.value)}
                      placeholder="16 Digit NIK/BPJS"
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Tgl Lahir</label>
                    <input
                      type="date"
                      value={birthDate}
                      onChange={(e) => setBirthDate(e.target.value)}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-xs"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Jenis Kelamin</label>
                    <select
                      value={gender}
                      onChange={(e) => setGender(e.target.value as any)}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-xs bg-white"
                    >
                      <option value="">Pilih</option>
                      <option value="L">Laki-laki (L)</option>
                      <option value="P">Perempuan (P)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Alamat Domisili</label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Nama jalan, kelurahan, kota"
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-xs"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Warning & Ranap Checkboxes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <label className="flex items-center gap-2 p-2.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={isWarning}
                onChange={(e) => setIsWarning(e.target.checked)}
                className="w-4 h-4 text-rose-600 rounded focus:ring-rose-500"
              />
              <div className="flex items-center gap-1.5 font-bold text-rose-700">
                <AlertOctagon className="w-4 h-4" />
                <span>Pasien Warning (🛑)</span>
              </div>
            </label>

            <label className="flex items-center gap-2 p-2.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={isRanap}
                onChange={(e) => setIsRanap(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
              />
              <div className="flex items-center gap-1.5 font-bold text-blue-700">
                <Hospital className="w-4 h-4" />
                <span>Pasien Rawat Inap (🛏️)</span>
              </div>
            </label>
          </div>

          {/* Lampiran Foto Instruksi Dokter / Ranap */}
          <div className="p-3 bg-gradient-to-br from-slate-50 to-teal-50/40 border border-teal-200/80 rounded-xl space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-teal-700" />
                <label className="font-bold text-slate-800 text-xs">
                  Foto Lembar Instruksi DPJP / Ranap
                </label>
                {(attachedUrls.length > 0 || pendingFiles.length > 0) && (
                  <span className="px-1.5 py-0.2 bg-teal-600 text-white rounded text-[10px] font-bold">
                    {attachedUrls.length + pendingFiles.length} foto
                  </span>
                )}
              </div>
              <span className="text-[10px] text-slate-500 font-medium">Tersimpan permanen di data pasien</span>
            </div>

            {/* Hidden Inputs for Camera and File Picker */}
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => handlePhotoFilesSelected(e.target.files)}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => handlePhotoFilesSelected(e.target.files)}
            />

            {/* Buttons for Camera / File Upload */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="flex-1 py-1.5 px-3 bg-teal-700 hover:bg-teal-800 active:bg-teal-900 text-white text-xs font-bold rounded-lg transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                title="Buka kamera eksternal / webcam / HP untuk mengambil foto instruksi"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Ambil Foto Kamera</span>
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 py-1.5 px-3 bg-white hover:bg-teal-50 active:bg-teal-100 text-teal-900 border border-teal-300 text-xs font-bold rounded-lg transition-all shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer"
                title="Pilih foto dari galeri berkas"
              >
                <Upload className="w-3.5 h-3.5 text-teal-700" />
                <span>Upload dari File</span>
              </button>
            </div>

            {/* Photo Preview Thumbnails */}
            {(attachedUrls.length > 0 || pendingFiles.length > 0) && (
              <div className="flex items-center gap-2 overflow-x-auto pt-1 pb-0.5">
                {/* Previously saved Master Patient photos */}
                {attachedUrls.map((url, idx) => (
                  <div key={`existing-${idx}`} className="relative group/thumb shrink-0">
                    <img
                      src={url}
                      alt={`Instruksi ${idx + 1}`}
                      onError={handleImageErrorWithCloudFallback}
                      onClick={() => setActivePreviewPhotoModal(true)}
                      className="w-14 h-14 object-cover rounded-lg border-2 border-teal-500 shadow-xs cursor-pointer hover:opacity-90"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveExistingPhoto(url)}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-rose-600 text-white rounded-full flex items-center justify-center shadow-xs cursor-pointer hover:bg-rose-700"
                      title="Hapus foto ini"
                    >
                      <X className="w-3 h-3" />
                    </button>
                    <span className="absolute bottom-0 left-0 right-0 bg-slate-900/80 text-white text-[8px] text-center font-mono rounded-b py-0.2">
                      Tersimpan
                    </span>
                  </div>
                ))}

                {/* Newly selected pending files */}
                {pendingFiles.map((item, idx) => (
                  <div key={`pending-${idx}`} className="relative group/thumb shrink-0">
                    <img
                      src={item.previewUrl}
                      alt={`Pending ${idx + 1}`}
                      className="w-14 h-14 object-cover rounded-lg border-2 border-amber-400 shadow-xs"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemovePendingFile(idx)}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-rose-600 text-white rounded-full flex items-center justify-center shadow-xs cursor-pointer hover:bg-rose-700"
                      title="Batalkan foto ini"
                    >
                      <X className="w-3 h-3" />
                    </button>
                    <span className="absolute bottom-0 left-0 right-0 bg-amber-600/90 text-white text-[8px] text-center font-bold rounded-b py-0.2">
                      Baru
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block font-bold text-slate-800 mb-1">
              Catatan Klinis / Kondisi Pasien <span className="font-normal text-slate-400">(opsional)</span>
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Nyeri leher kronis disertai vertigo posisional saat menoleh kiri, pasca kecelakaan motor 2 th lalu. Cek tensi sebelum terapi, pakai kursi roda."
              rows={3}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-teal-500 resize-none"
            />
          </div>

          {/* Buttons */}
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              disabled={isUploadingPhotos}
              onClick={onClose}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-bold transition-all cursor-pointer disabled:opacity-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isUploadingPhotos}
              className="px-5 py-2 bg-teal-700 hover:bg-teal-800 active:bg-teal-900 text-white rounded-lg font-bold shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isUploadingPhotos ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Mengunggah Foto...</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  <span>Simpan & Masukkan Antrean</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Patient Photo Preview Fullscreen Modal */}
      {activePreviewPhotoModal && (
        <PatientPhotoModal
          isOpen={activePreviewPhotoModal}
          onClose={() => setActivePreviewPhotoModal(false)}
          patient={{
            patientName: patientName || 'Preview Foto',
            medicalRecordNo: medicalRecordNo,
            instructionImageUrls: attachedUrls,
            instructionPhotos: attachedPhotos,
            isRanap: isRanap,
          }}
          canUpload={false}
        />
      )}
    </div>
  );
};

