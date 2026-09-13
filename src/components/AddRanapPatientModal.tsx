import React, { useState, useEffect } from 'react';
import { X, BedDouble, Plus, DoorOpen, FileText, User, Hash, Stethoscope } from 'lucide-react';
import { RanapCategory, RanapQueueItem } from '../types';
import { RANAP_CATEGORY_SHORT_LABELS } from '../utils/ranapQueueUtils';

interface AddRanapPatientModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultCategory?: RanapCategory;
  onAddPatient: (data: Omit<RanapQueueItem, 'id' | 'createdAt'>) => void;
}

export const AddRanapPatientModal: React.FC<AddRanapPatientModalProps> = ({
  isOpen,
  onClose,
  defaultCategory = 'fisio',
  onAddPatient,
}) => {
  const [category, setCategory] = useState<RanapCategory>(defaultCategory);
  const [patientName, setPatientName] = useState('');
  const [medicalRecordNo, setMedicalRecordNo] = useState('');
  const [roomNumber, setRoomNumber] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [note, setNote] = useState('');
  const [officerName, setOfficerName] = useState('');

  useEffect(() => {
    if (isOpen) {
      setCategory(defaultCategory);
      setPatientName('');
      setMedicalRecordNo('');
      setRoomNumber('');
      setDiagnosis('');
      setNote('');
      setOfficerName('');
    }
  }, [isOpen, defaultCategory]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientName.trim() || !medicalRecordNo.trim() || !roomNumber.trim()) return;

    onAddPatient({
      category,
      patientName: patientName.trim().toUpperCase(),
      medicalRecordNo: medicalRecordNo.trim(),
      roomNumber: roomNumber.trim(),
      diagnosis: diagnosis.trim() || undefined,
      note: note.trim() || undefined,
      officerName: officerName.trim() || undefined,
    });

    onClose();
  };

  return (
    // z-70: sengaja lebih tinggi dari RanapQueueModal (z-60) yang membukanya,
    // supaya popup ini SELALU tampil di depan tanpa bergantung urutan render
    // DOM (dua modal dengan z-index sama akan gampang salah susun kalau ada
    // yang mengubah urutan komponen di kemudian hari).
    <div
      id="modal-add-ranap-overlay"
      className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        id="modal-add-ranap-content"
        className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-700 px-6 py-4 flex items-center justify-between text-white shadow-md">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-white/20 rounded-xl backdrop-blur-xs">
              <BedDouble className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Tambah Pasien Ranap (Rawat Inap)</h2>
              <p className="text-xs text-teal-100 font-medium">Antrean terpisah untuk layanan rehabilitasi ruang rawat inap</p>
            </div>
          </div>
          <button
            id="btn-close-add-ranap"
            type="button"
            onClick={onClose}
            className="p-1.5 hover:bg-white/20 rounded-lg text-white/80 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Pilihan Divisi */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Divisi Layanan Ranap <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setCategory('fisio')}
                className={`py-2.5 px-3 rounded-xl border font-bold text-xs flex items-center justify-center transition-all ${
                  category === 'fisio'
                    ? 'bg-sky-600 text-white border-sky-600 shadow-md shadow-sky-600/20 ring-2 ring-sky-300'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-sky-50 hover:border-sky-300'
                }`}
              >
                Fisioterapi
              </button>
              <button
                type="button"
                onClick={() => setCategory('okupasi')}
                className={`py-2.5 px-3 rounded-xl border font-bold text-xs flex items-center justify-center transition-all ${
                  category === 'okupasi'
                    ? 'bg-amber-600 text-white border-amber-600 shadow-md shadow-amber-600/20 ring-2 ring-amber-300'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-amber-50 hover:border-amber-300'
                }`}
              >
                Okupasi Terapi
              </button>
              <button
                type="button"
                onClick={() => setCategory('wicara')}
                className={`py-2.5 px-3 rounded-xl border font-bold text-xs flex items-center justify-center transition-all ${
                  category === 'wicara'
                    ? 'bg-purple-600 text-white border-purple-600 shadow-md shadow-purple-600/20 ring-2 ring-purple-300'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-purple-50 hover:border-purple-300'
                }`}
              >
                Terapi Wicara
              </button>
            </div>
          </div>

          {/* Nama Pasien & No RM */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-slate-500" />
                Nama Pasien <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                autoFocus
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                placeholder="Contoh: NY. SITI AMINAH"
                className="w-full px-3.5 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm font-semibold uppercase text-slate-900 placeholder:text-slate-400 placeholder:normal-case"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5 text-slate-500" />
                No. Rekam Medis (RM) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={medicalRecordNo}
                onChange={(e) => setMedicalRecordNo(e.target.value)}
                placeholder="Contoh: 01-23-45"
                className="w-full px-3.5 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm font-medium text-slate-900 placeholder:text-slate-400"
              />
            </div>
          </div>

          {/* No. Ruangan & Petugas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <DoorOpen className="w-3.5 h-3.5 text-emerald-600" />
                No. Ruangan / Bed <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={roomNumber}
                onChange={(e) => setRoomNumber(e.target.value)}
                placeholder="Contoh: 3, 4A, Melati 5"
                className="w-full px-3.5 py-2 border border-emerald-300 bg-emerald-50/40 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm font-bold text-emerald-950 placeholder:text-slate-400"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                Urutan antrean otomatis disusun berdasarkan nomor ruangan.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-slate-500" />
                Terapis / Petugas (Opsional)
              </label>
              <input
                type="text"
                value={officerName}
                onChange={(e) => setOfficerName(e.target.value)}
                placeholder="Nama terapis penanggung jawab"
                className="w-full px-3.5 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm font-medium text-slate-900 placeholder:text-slate-400"
              />
            </div>
          </div>

          {/* Diagnosis */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
              <Stethoscope className="w-3.5 h-3.5 text-slate-500" />
              Diagnosis / Tindakan (Opsional)
            </label>
            <input
              type="text"
              value={diagnosis}
              onChange={(e) => setDiagnosis(e.target.value)}
              placeholder="Contoh: Post Stroke / Hemiparesis Dextra, Chest Therapy"
              className="w-full px-3.5 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm font-medium text-slate-900 placeholder:text-slate-400"
            />
          </div>

          {/* Catatan Tambahan */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-500" />
              Catatan / Instruksi Khusus (Opsional)
            </label>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Catatan tambahan (kondisi kesadaran, alat terpasang, dll)..."
              className="w-full px-3.5 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm text-slate-900 placeholder:text-slate-400 resize-none"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-2 flex items-center justify-end space-x-3 border-t border-slate-100">
            <button
              id="btn-cancel-add-ranap"
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Batal
            </button>
            <button
              id="btn-submit-add-ranap"
              type="submit"
              className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-bold text-sm rounded-xl shadow-md shadow-teal-700/20 flex items-center gap-1.5 transition-all"
            >
              <Plus className="w-4 h-4" />
              Simpan ke Antrean {RANAP_CATEGORY_SHORT_LABELS[category]}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
