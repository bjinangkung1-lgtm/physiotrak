import React, { useState } from 'react';
import { X, FolderPlus, Image as ImageIcon, Upload, Trash2, Plus, Loader2, Activity, Sparkles, MessageSquare } from 'lucide-react';
import { QueueBox, BoxColor } from '../types';
import { getTodayFormatted } from '../data/initialData';
import { uploadMultipleImagesToServer } from '../utils/imageUtils';

interface AddBoxModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddBox: (boxData: Omit<QueueBox, 'id' | 'createdAt'>) => void;
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

export const AddBoxModal: React.FC<AddBoxModalProps> = ({
  isOpen,
  onClose,
  onAddBox,
}) => {
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('Poliklinik / Ruang Terapi');
  const [category, setCategory] = useState<'fisio' | 'okupasi' | 'wicara'>('fisio');
  const [color, setColor] = useState<BoxColor>('blue');
  const [instructionText, setInstructionText] = useState('');
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [urlInput, setUrlInput] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const cleanTitle = title.trim().toUpperCase();
    const cleanLocation = location.trim();
    const cleanUrls = imageUrls.filter((u) => typeof u === 'string' && u.trim().length > 0);

    onAddBox({
      title: cleanTitle,
      officerName: cleanTitle,
      location: cleanLocation,
      category,
      color,
      isPinned: false,
      instructionText: instructionText.trim(),
      instructionImageUrl: cleanUrls[0] || undefined,
      instructionImageUrls: cleanUrls,
      autoCallNext: false,
    });

    setTitle('');
    setLocation('Poliklinik / Ruang Terapi');
    setCategory('fisio');
    setInstructionText('');
    setImageUrls([]);
    setUrlInput('');
    onClose();
  };

  const handleUploadFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const fileArray = Array.from(files);

    setIsUploading(true);
    setUploadError(null);
    setUploadProgress({ current: 0, total: fileArray.length });

    try {
      const newUrls = await uploadMultipleImagesToServer(
        fileArray,
        {
          boxTitle: title.trim() || 'Kotak Baru',
        },
        (current, total) => setUploadProgress({ current, total })
      );

      if (newUrls.length > 0) {
        setImageUrls((prev) => [...prev, ...newUrls]);
      }
    } catch (err: any) {
      setUploadError(err?.message || 'Gagal mengunggah foto');
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
    }
  };

  const handleAddUrl = () => {
    if (!urlInput.trim()) return;
    const splitUrls = urlInput
      .split(/[\n,]+/)
      .map((u) => u.trim())
      .filter((u) => u.length > 0);

    if (splitUrls.length > 0) {
      setImageUrls((prev) => [...prev, ...splitUrls]);
      setUrlInput('');
    }
  };

  const handleRemoveImage = (indexToRemove: number) => {
    setImageUrls((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="bg-slate-900 text-white p-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <FolderPlus className="w-5 h-5 text-teal-400" />
            <h3 className="font-extrabold text-base tracking-tight">Tambah Kotak Antrian Baru</h3>
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
              Kotak baru akan otomatis terhubung ke tombol filter dan pemanggilan cepat divisi yang dipilih.
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
              placeholder={`Contoh: PETUGAS RINA (${getTodayFormatted()}) atau POLI UMUM 01`}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:ring-2 focus:ring-slate-800"
            />
            <p className="text-[10px] text-slate-500 mt-1">
              Judul kotak langsung digunakan sebagai identitas antrian, laporan terapis, dan papan display.
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
              placeholder="Contoh: Lantai 2 - Ruang 3"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900"
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
                      ? 'ring-2 ring-slate-900 border-slate-900 shadow-xs'
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
              rows={2}
              value={instructionText}
              onChange={(e) => setInstructionText(e.target.value)}
              placeholder="Catatan SOP, penanganan khusus, atau pengingat terapis..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-800 mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4 text-amber-600" />
                <span>Foto Instruksi / SOP Terapi ({imageUrls.length} Foto)</span>
              </span>
              {imageUrls.length > 0 && (
                <button
                  type="button"
                  onClick={() => setImageUrls([])}
                  className="text-rose-600 hover:text-rose-800 text-[11px] font-bold flex items-center gap-0.5 cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" /> Hapus Semua
                </button>
              )}
            </label>

            <div className="space-y-2">
              {/* Upload Button */}
              <label
                className={`flex items-center justify-center gap-2 px-3 py-2.5 bg-slate-50 hover:bg-slate-100 border-2 border-dashed border-slate-300 hover:border-blue-400 rounded-xl cursor-pointer text-slate-700 font-bold transition-all text-xs ${
                  isUploading ? 'opacity-50 pointer-events-none' : ''
                }`}
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                    <span>
                      Mengunggah{' '}
                      {uploadProgress
                        ? `${uploadProgress.current}/${uploadProgress.total} foto...`
                        : 'foto...'}
                    </span>
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 text-blue-600" />
                    <span>Pilih Foto dari HP / Komputer (Bisa Banyak Sekaligus)</span>
                  </>
                )}
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  disabled={isUploading}
                  className="hidden"
                  onChange={(e) => handleUploadFiles(e.target.files)}
                />
              </label>

              {uploadError && (
                <p className="text-[11px] text-rose-600 font-bold bg-rose-50 p-2 rounded-lg border border-rose-200">
                  {uploadError}
                </p>
              )}

              {/* Paste URL */}
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddUrl();
                    }
                  }}
                  placeholder="Atau tempel Link Foto Web (https://...)"
                  className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg text-xs text-slate-900"
                />
                <button
                  type="button"
                  onClick={handleAddUrl}
                  disabled={!urlInput.trim()}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg border border-slate-300 text-xs disabled:opacity-40 cursor-pointer flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Tambah
                </button>
              </div>

              {/* Thumbnail Previews */}
              {imageUrls.length > 0 && (
                <div className="grid grid-cols-4 gap-2 pt-1">
                  {imageUrls.map((url, idx) => (
                    <div
                      key={idx}
                      className="relative group rounded-lg overflow-hidden border border-slate-200 bg-slate-100 aspect-video flex items-center justify-center shadow-2xs"
                    >
                      <img
                        src={url}
                        alt={`Preview ${idx + 1}`}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src =
                            'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=300&q=80';
                        }}
                      />
                      {idx === 0 && (
                        <span className="absolute top-1 left-1 bg-amber-500 text-slate-950 font-black text-[9px] px-1.5 py-0.5 rounded shadow-2xs">
                          Cover
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(idx)}
                        className="absolute top-1 right-1 bg-rose-600 hover:bg-rose-700 text-white p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer shadow-sm"
                        title="Hapus foto ini"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
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
              disabled={isUploading}
              className="px-5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-sm cursor-pointer disabled:opacity-50"
            >
              Buat Kotak Baru
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
