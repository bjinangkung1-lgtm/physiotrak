import React, { useState, useEffect } from 'react';
import { X, Edit3, Trash2, Activity, Sparkles, MessageSquare } from 'lucide-react';
import { QueueBox, BoxColor } from '../types';
import { getTherapistCategory } from '../utils/savedOfficersService';

interface EditBoxModalProps {
  isOpen: boolean;
  onClose: () => void;
  box: QueueBox | null;
  onUpdateBox: (updatedBox: QueueBox) => void;
  onDeleteBox?: (boxId: string) => void;
}

const COLOR_OPTIONS: { id: BoxColor; label: string; class: string }[] = [
  // Warna Terang & Metalik Modern
  { id: 'metallic-blue', label: '⚡ Biru Metalik', class: 'bg-blue-700 border-blue-400 text-white font-bold' },
  { id: 'metallic-purple', label: '⚡ Ungu Metalik', class: 'bg-purple-700 border-purple-400 text-white font-bold' },
  { id: 'metallic-orange', label: '⚡ Oranye Metalik', class: 'bg-amber-600 border-amber-400 text-white font-bold' },
  { id: 'metallic-red', label: '⚡ Merah Metalik', class: 'bg-rose-700 border-rose-400 text-white font-bold' },
  { id: 'metallic-green', label: '⚡ Hijau Metalik', class: 'bg-emerald-700 border-emerald-400 text-white font-bold' },
  { id: 'metallic-sage', label: '⚡ Sage Metalik', class: 'bg-teal-700 border-teal-400 text-white font-bold' },
  { id: 'metallic-yellow', label: '⚡ Kuning Metalik', class: 'bg-yellow-400 border-yellow-500 text-slate-950 font-black' },
  { id: 'metallic-silver', label: '⚡ Abu Platinum', class: 'bg-slate-700 border-slate-400 text-white font-bold' },

  // Metalik Titanium & Klasik
  { id: 'metallic-dark', label: '★ Metalik Titanium', class: 'bg-slate-900 border-slate-600 text-white font-bold' },
  { id: 'metallic-bronze', label: '★ Metalik Bronze', class: 'bg-stone-900 border-amber-600 text-amber-200 font-bold' },
  { id: 'metallic-emerald', label: '★ Metalik Jade', class: 'bg-teal-950 border-emerald-600 text-emerald-200 font-bold' },
  { id: 'metallic-ocean', label: '★ Metalik Sapphire', class: 'bg-sky-950 border-sky-600 text-sky-200 font-bold' },

  // Warna Doff (Matte Pastel Lembut & Teks Sangat Jelas)
  { id: 'yellow', label: 'Kuning Doff', class: 'bg-[#fff9b0] border-[#f2dd6e] text-slate-900 font-bold' },
  { id: 'blue', label: 'Biru Doff', class: 'bg-[#d2f3fc] border-[#9ce3f5] text-slate-900 font-bold' },
  { id: 'purple', label: 'Ungu Doff', class: 'bg-[#ede4f8] border-[#d3bdf0] text-slate-900 font-bold' },
  { id: 'orange', label: 'Oranye Doff', class: 'bg-[#fee8d1] border-[#fbcda1] text-slate-900 font-bold' },
  { id: 'coral', label: 'Merah Doff', class: 'bg-[#fed9dd] border-[#fcaeb7] text-slate-900 font-bold' },
  { id: 'green', label: 'Hijau Doff', class: 'bg-[#e2f9d7] border-[#b8ed9f] text-slate-900 font-bold' },
  { id: 'sage', label: 'Sage Doff', class: 'bg-[#daf2ec] border-[#a8e3d6] text-slate-900 font-bold' },
  { id: 'pink', label: 'Pink Doff', class: 'bg-[#fde2ef] border-[#f9bfde] text-slate-900 font-bold' },
  { id: 'gray', label: 'Abu Doff', class: 'bg-[#edf0f2] border-[#cbd3d9] text-slate-900 font-bold' },
];

export const EditBoxModal: React.FC<EditBoxModalProps> = ({
  isOpen,
  onClose,
  box,
  onUpdateBox,
  onDeleteBox,
}) => {
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [category, setCategory] = useState<'fisio' | 'okupasi' | 'wicara'>('fisio');
  const [color, setColor] = useState<BoxColor>('blue');
  const [instructionText, setInstructionText] = useState('');

  useEffect(() => {
    if (box) {
      setTitle(box.title);
      setLocation(box.location);
      setColor(box.color);
      const cat = box.category === 'okupasi' || box.category === 'wicara' || box.category === 'fisio'
        ? box.category
        : (getTherapistCategory(box.officerName, box.location) as any) || 'fisio';
      setCategory(cat);
      setInstructionText(box.instructionText || '');
    }
  }, [box]);

  if (!isOpen || !box) return null;

  const isPeralihanBox = box.id === 'box-peralihan-siang' || (box.title || '').toUpperCase().includes('PERALIHAN');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const cleanTitle = title.trim();
    const cleanLocation = location.trim();

    onUpdateBox({
      ...box,
      title: cleanTitle,
      subtitle: '',
      officerName: cleanTitle,
      location: cleanLocation,
      category,
      color,
      instructionText: instructionText.trim(),
      instructionImageUrl: box.instructionImageUrl,
      instructionImageUrls: box.instructionImageUrls,
      autoCallNext: false,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="bg-blue-600 text-white p-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Edit3 className="w-5 h-5 text-white" />
            <h3 className="font-extrabold text-base tracking-tight">Edit Kotak & SOP Terapi</h3>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs text-slate-700 overflow-y-auto">
          {/* Divisi Terapi Selector */}
          <div>
            <label className="block font-bold text-slate-800 mb-1.5">
              Divisi Terapi (Poli) *
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setCategory('fisio')}
                className={`py-2 px-2.5 rounded-xl border font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  category === 'fisio'
                    ? 'bg-teal-600 text-white border-teal-600 shadow-xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <Activity className="w-3.5 h-3.5 shrink-0" />
                <span>Fisio (FT)</span>
              </button>

              <button
                type="button"
                onClick={() => setCategory('okupasi')}
                className={`py-2 px-2.5 rounded-xl border font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  category === 'okupasi'
                    ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 shrink-0" />
                <span>Okupasi (OT)</span>
              </button>

              <button
                type="button"
                onClick={() => setCategory('wicara')}
                className={`py-2 px-2.5 rounded-xl border font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  category === 'wicara'
                    ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                <span>Wicara (TW)</span>
              </button>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              Mengubah divisi akan memindahkan kotak ini ke tombol pemanggilan cepat dan filter divisi terkait.
            </p>
          </div>

          <div>
            <label className="block font-bold text-slate-800 mb-1">
              Judul Kotak Antrian (Identitas Petugas / Poli) *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Contoh: POLI UMUM 01 / NAJJAH"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-600"
            />
            <p className="text-[10px] text-slate-500 mt-1">
              Judul kotak ini langsung menjadi acuan nama terapis/petugas pada laporan dan monitor.
            </p>
          </div>

          <div>
            <label className="block font-bold text-slate-800 mb-1">
              Lokasi Ruangan / Poliklinik *
            </label>
            <input
              type="text"
              required
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Contoh: Lantai 2 - Ruang Rehabilitasi Medis"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-800 mb-1">
              Pilihan Warna Kotak
            </label>
            <div className="grid grid-cols-4 gap-2">
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setColor(c.id)}
                  className={`px-2 py-1.5 rounded-lg border text-[11px] font-bold transition-all cursor-pointer text-center ${
                    color === c.id
                      ? 'ring-2 ring-blue-600 border-blue-600 shadow-xs'
                      : 'opacity-70 hover:opacity-100'
                  } ${c.class}`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-800 mb-1">
              Pesan / Instruksi Catatan Khusus
            </label>
            <textarea
              rows={3}
              value={instructionText}
              onChange={(e) => setInstructionText(e.target.value)}
              placeholder="Catatan SOP, penanganan khusus, atau pengingat terapis..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-200">
            {onDeleteBox && !isPeralihanBox ? (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onDeleteBox(box.id);
                }}
                className="px-3.5 py-2 text-xs font-bold text-rose-600 hover:text-white bg-rose-50 hover:bg-rose-600 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                title="Hapus kotak antrian ini"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Hapus Kotak Ini</span>
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm cursor-pointer"
              >
                Simpan Perubahan
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
