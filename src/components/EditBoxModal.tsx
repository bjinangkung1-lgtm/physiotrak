import React, { useState, useEffect } from 'react';
import { X, Edit3, Image as ImageIcon, Upload, Trash2, Plus, Loader2, Activity, Sparkles, MessageSquare } from 'lucide-react';
import { QueueBox, BoxColor } from '../types';
import { uploadMultipleImagesToServer, getBoxImageUrls } from '../utils/imageUtils';
import { getTherapistCategory } from '../utils/savedOfficersService';

interface EditBoxModalProps {
  isOpen: boolean;
  onClose: () => void;
  box: QueueBox | null;
  onUpdateBox: (updatedBox: QueueBox) => void;
  onDeleteBox?: (boxId: string) => void;
}

const COLOR_OPTIONS: { id: BoxColor; label: string; class: string }[] = [
  { id: 'metallic-dark', label: '★ Metalik Titanium', class: 'bg-slate-900 border-slate-700 text-white shadow-xs' },
  { id: 'metallic-bronze', label: '★ Metalik Bronze', class: 'bg-stone-900 border-amber-800 text-amber-200 shadow-xs' },
  { id: 'metallic-emerald', label: '★ Metalik Jade', class: 'bg-teal-950 border-emerald-800 text-emerald-200 shadow-xs' },
  { id: 'metallic-ocean', label: '★ Metalik Sapphire', class: 'bg-sky-950 border-sky-800 text-sky-200 shadow-xs' },
  { id: 'blue', label: 'Biru Soft', class: 'bg-sky-100 border-sky-300 text-sky-900' },
  { id: 'purple', label: 'Ungu Soft', class: 'bg-purple-100 border-purple-300 text-purple-900' },
  { id: 'orange', label: 'Oranye Soft', class: 'bg-amber-100 border-amber-300 text-amber-900' },
  { id: 'coral', label: 'Merah / Coral', class: 'bg-rose-100 border-rose-300 text-rose-900' },
  { id: 'green', label: 'Hijau Toska', class: 'bg-teal-100 border-teal-300 text-teal-900' },
  { id: 'sage', label: 'Sage Green', class: 'bg-emerald-100 border-emerald-300 text-emerald-900' },
  { id: 'yellow', label: 'Kuning Soft', class: 'bg-yellow-100 border-yellow-300 text-yellow-900' },
  { id: 'gray', label: 'Abu Neutral', class: 'bg-slate-100 border-slate-300 text-slate-900' },
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
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [urlInput, setUrlInput] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

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
      setImageUrls(getBoxImageUrls(box));
    }
  }, [box]);

  if (!isOpen || !box) return null;

  const isPeralihanBox = box.id === 'box-peralihan-siang' || (box.title || '').toUpperCase().includes('PERALIHAN');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const cleanTitle = title.trim();
    const cleanLocation = location.trim();
    const cleanUrls = imageUrls.filter((u) => typeof u === 'string' && u.trim().length > 0);

    onUpdateBox({
      ...box,
      title: cleanTitle,
      subtitle: '',
      officerName: cleanTitle,
      location: cleanLocation,
      category,
      color,
      instructionText: instructionText.trim(),
      instructionImageUrl: cleanUrls[0] || undefined,
      instructionImageUrls: cleanUrls,
      autoCallNext: false,
    });

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
          boxId: box.id,
          boxTitle: title.trim() || box.title,
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
              rows={2}
              value={instructionText}
              onChange={(e) => setInstructionText(e.target.value)}
              placeholder="Catatan SOP, penanganan khusus, atau pengingat terapis..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-blue-600"
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

            {/* Direct File Upload & URL input */}
            <div className="space-y-2">
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
                disabled={isUploading}
                className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm cursor-pointer disabled:opacity-50"
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
