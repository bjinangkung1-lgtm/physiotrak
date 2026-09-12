import React, { useEffect, useState } from 'react';
import { X, BedDouble, Activity, Sparkles, MessageSquare } from 'lucide-react';
import { RanapCategory, RanapQueueItem } from '../types';
import { RANAP_CATEGORY_LABELS } from '../utils/ranapQueueUtils';

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

  useEffect(() => {
    if (isOpen) {
      setCategory(defaultCategory);
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
    });

    setPatientName('');
    setMedicalRecordNo('');
    setRoomNumber('');
    setDiagnosis('');
    setNote('');
    onClose();
  };

  return (
    // z-70: sengaja lebih tinggi dari RanapQueueModal (z-60) yang membukanya,
    // supaya popup ini SELALU tampil di depan tanpa bergantung urutan render
    // DOM (dua modal dengan z-index sama akan gampang salah susun kalau ada
    // yang mengubah urutan komponen di kemudian hari).
    <div className="fixed inset-0 z-70 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="bg-rose-700 text-white p-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <BedDouble className="w-5 h-5" />
            <h3 className="font-extrabold text-base tracking-tight">Tambah Pasien Ranap</h3>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs text-slate-700 overflow-y-auto">
          <div>
            <label className="block font-bold text-slate-800 mb-1.5">Divisi Terapi *</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setCategory('fisio')}
                className={`py-2 px-2 rounded-xl border font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  category === 'fisio'
                    ? 'bg-teal-600 text-white border-teal-600 shadow-xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <Activity className="w-3.5 h-3.5 shrink-0" />
                <span>Fisio</span>
              </button>
              <button
                type="button"
                onClick={() => setCategory('okupasi')}
                className={`py-2 px-2 rounded-xl border font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  category === 'okupasi'
                    ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 shrink-0" />
                <span>Okupasi</span>
              </button>
              <button
                type="button"
                onClick={() => setCategory('wicara')}
                className={`py-2 px-2 rounded-xl border font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  category === 'wicara'
                    ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                <span>Wicara</span>
              </button>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              Akan masuk ke {RANAP_CATEGORY_LABELS[category]} di sidebar, diurutkan otomatis berdasarkan nomor ruangan.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block font-bold text-slate-800 mb-1">Nama Pasien *</label>
              <input
                type="text"
                required
                autoFocus
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                placeholder="Contoh: BUDI SANTOSO, TN"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-800 mb-1">No. Rekam Medis *</label>
              <input
                type="text"
                required
                value={medicalRecordNo}
                onChange={(e) => setMedicalRecordNo(e.target.value)}
                placeholder="Contoh: 273267"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-800 mb-1">No. Ruangan *</label>
              <input
                type="text"
                required
                value={roomNumber}
                onChange={(e) => setRoomNumber(e.target.value)}
                placeholder="Contoh: 3 atau 4A"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-rose-500"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-800 mb-1">Diagnosis</label>
            <input
              type="text"
              value={diagnosis}
              onChange={(e) => setDiagnosis(e.target.value)}
              placeholder="Contoh: Post Stroke Hemiparesis Sinistra"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-rose-500"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-800 mb-1">Catatan (opsional)</label>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Catatan tambahan..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-rose-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold text-white bg-rose-700 hover:bg-rose-800 rounded-lg shadow-sm cursor-pointer"
            >
              Tambah ke Antrean Ranap
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
