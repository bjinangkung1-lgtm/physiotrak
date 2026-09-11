import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Upload,
  Image as ImageIcon,
  Trash2,
  Plus,
  ArrowLeft,
  ArrowRight,
  Download,
  ExternalLink,
  CheckCircle2,
  Search,
  Database,
  SlidersHorizontal,
  RefreshCw,
  FolderOpen,
  Sparkles,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { QueueBox, PhotoRecord } from '../types';
import {
  getBoxImageUrls,
  uploadMultipleImagesToServer,
  getPhotosFromDatabase,
  deletePhotoFromDatabase,
  handleImageErrorWithCloudFallback,
} from '../utils/imageUtils';

interface BoxPhotoGalleryModalProps {
  isOpen: boolean;
  box: QueueBox;
  initialIndex?: number;
  initialTab?: 'viewer' | 'manage' | 'database';
  onClose: () => void;
  onUpdateImages: (boxId: string, imageUrls: string[]) => void;
}

export const BoxPhotoGalleryModal: React.FC<BoxPhotoGalleryModalProps> = React.memo(({
  isOpen,
  box,
  initialIndex = 0,
  initialTab = 'viewer',
  onClose,
  onUpdateImages,
}) => {
  const initialBoxImages = getBoxImageUrls(box);
  const [internalImages, setInternalImages] = useState<string[]>(initialBoxImages);
  const internalImagesRef = useRef<string[]>(initialBoxImages);

  const images = internalImages;

  const [activeTab, setActiveTab] = useState<'viewer' | 'manage' | 'database'>(
    initialBoxImages.length === 0 ? 'manage' : initialTab
  );
  const [currentIndex, setCurrentIndex] = useState(
    initialIndex >= 0 && initialIndex < initialBoxImages.length ? initialIndex : 0
  );
  const [isEnlarged, setIsEnlarged] = useState(false);

  // Upload States
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState('');

  // Database Photos State
  const [dbPhotos, setDbPhotos] = useState<PhotoRecord[]>([]);
  const [isLoadingDb, setIsLoadingDb] = useState(false);
  const [dbSearchQuery, setDbSearchQuery] = useState('');
  const [selectedDbUrls, setSelectedDbUrls] = useState<string[]>([]);

  // Drag & drop state
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Synchronize internal images when box changes externally (unless actively uploading)
  useEffect(() => {
    if (!isUploading) {
      const fresh = getBoxImageUrls(box);
      internalImagesRef.current = fresh;
      setInternalImages(fresh);
    }
  }, [box.instructionImageUrls, box.instructionImageUrl, isUploading]);

  // Sync index when box photos change without resetting user selection
  useEffect(() => {
    if (currentIndex >= images.length) {
      setCurrentIndex(Math.max(0, images.length - 1));
    }
  }, [images.length, currentIndex]);

  // Load database photos on demand
  useEffect(() => {
    if (isOpen && activeTab === 'database') {
      loadDbPhotos();
    }
  }, [isOpen, activeTab]);

  const loadDbPhotos = async () => {
    setIsLoadingDb(true);
    try {
      const records = await getPhotosFromDatabase();
      setDbPhotos(records);
    } finally {
      setIsLoadingDb(false);
    }
  };

  // Keyboard navigation for viewer
  useEffect(() => {
    if (!isOpen || activeTab !== 'viewer') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrev();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, activeTab, currentIndex, images.length]);

  if (!isOpen || typeof document === 'undefined') return null;

  // Handle Multi-file Upload (Supports consecutive uploads!)
  const handleUploadFiles = async (files: FileList | File[] | null) => {
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
          boxTitle: box.title,
        },
        (completed, total) => {
          setUploadProgress({ current: completed, total });
        }
      );

      if (newUrls.length > 0) {
        // Append new images cleanly to current list (prevents consecutive upload overwrites)
        const currentList = [...internalImagesRef.current];
        newUrls.forEach((url) => {
          if (url && !currentList.includes(url)) {
            currentList.push(url);
          }
        });
        internalImagesRef.current = currentList;
        setInternalImages(currentList);
        onUpdateImages(box.id, currentList);

        // Switch to viewer to see newly uploaded photo
        setCurrentIndex(currentList.length - 1);
        setActiveTab('viewer');
      }
    } catch (err: any) {
      setUploadError(err?.message || 'Gagal mengunggah foto');
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Handle Add Image URL
  const handleAddUrl = () => {
    if (!urlInput.trim()) return;
    const splitUrls = urlInput
      .split(/[\n,]+/)
      .map((u) => u.trim())
      .filter((u) => u.length > 0);

    if (splitUrls.length > 0) {
      const currentList = [...internalImagesRef.current];
      splitUrls.forEach((url) => {
        if (url && !currentList.includes(url)) {
          currentList.push(url);
        }
      });
      internalImagesRef.current = currentList;
      setInternalImages(currentList);
      onUpdateImages(box.id, currentList);
      setUrlInput('');
      setCurrentIndex(currentList.length - 1);
    }
  };

  // Reorder & Delete actions
  const handleDeletePhoto = (indexToDelete: number) => {
    const updated = internalImagesRef.current.filter((_, idx) => idx !== indexToDelete);
    internalImagesRef.current = updated;
    setInternalImages(updated);
    onUpdateImages(box.id, updated);
    if (currentIndex >= updated.length) {
      setCurrentIndex(Math.max(0, updated.length - 1));
    }
  };

  const handleMovePhoto = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= internalImagesRef.current.length) return;
    const updated = [...internalImagesRef.current];
    const item = updated.splice(fromIndex, 1)[0];
    updated.splice(toIndex, 0, item);
    internalImagesRef.current = updated;
    setInternalImages(updated);
    onUpdateImages(box.id, updated);
    setCurrentIndex(toIndex);
  };

  const handleSetCover = (index: number) => {
    handleMovePhoto(index, 0);
  };

  const handleClearAll = () => {
    if (window.confirm(`Hapus semua (${internalImagesRef.current.length}) foto dari kotak ${box.title}?`)) {
      internalImagesRef.current = [];
      setInternalImages([]);
      onUpdateImages(box.id, []);
      setActiveTab('manage');
    }
  };

  // Attach Selected Photos from Database
  const handleAttachDbPhotos = () => {
    if (selectedDbUrls.length === 0) return;
    const updated = [...internalImagesRef.current];
    for (const url of selectedDbUrls) {
      if (!updated.includes(url)) {
        updated.push(url);
      }
    }
    internalImagesRef.current = updated;
    setInternalImages(updated);
    onUpdateImages(box.id, updated);
    setSelectedDbUrls([]);
    setActiveTab('viewer');
    setCurrentIndex(updated.length - 1);
  };

  // Delete photo permanently from server database
  const handleDeleteFromDb = async (photo: PhotoRecord) => {
    if (window.confirm(`Hapus permanen foto "${photo.title || photo.filename}" dari Database Foto IRM?`)) {
      const ok = await deletePhotoFromDatabase(photo.id);
      if (ok) {
        setDbPhotos((prev) => prev.filter((p) => p.id !== photo.id));
        setSelectedDbUrls((prev) => prev.filter((u) => u !== photo.url));
      }
    }
  };

  const filteredDbPhotos = dbPhotos.filter((p) => {
    if (!dbSearchQuery.trim()) return true;
    const q = dbSearchQuery.toLowerCase();
    return (
      (p.originalName && p.originalName.toLowerCase().includes(q)) ||
      (p.title && p.title.toLowerCase().includes(q)) ||
      (p.boxTitle && p.boxTitle.toLowerCase().includes(q)) ||
      (p.filename && p.filename.toLowerCase().includes(q))
    );
  });

  const handlePrev = () => {
    if (images.length === 0) return;
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
  };

  const handleNext = () => {
    if (images.length === 0) return;
    setCurrentIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-slate-950/90 flex items-center justify-center p-2 sm:p-4 overflow-y-auto isolate"
      onClick={onClose}
    >
      <div
        className={`relative w-full bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col isolate ${
          isEnlarged ? 'max-w-6xl max-h-[96vh] h-[94vh]' : 'max-w-4xl max-h-[92vh]'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* MODAL HEADER */}
        <div className="bg-slate-950 border-b border-slate-800 px-4 py-3 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white shadow-md flex-shrink-0">
              <ImageIcon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-sm sm:text-base text-white tracking-tight truncate">
                  Galeri Foto Instruksi / SOP
                </h3>
                <span className="bg-slate-800 text-amber-300 text-[10px] font-black px-2 py-0.5 rounded-full border border-slate-700">
                  {images.length} Foto
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-semibold truncate">
                {box.title} {box.location ? `• ${box.location}` : ''}
              </p>
            </div>
          </div>

          {/* TAB BUTTONS */}
          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => setActiveTab('viewer')}
              disabled={images.length === 0}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'viewer'
                  ? 'bg-amber-500 text-slate-950 shadow-md font-extrabold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed'
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Lihat Foto</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('manage')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'manage'
                  ? 'bg-blue-600 text-white shadow-md font-extrabold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Kelola & Upload</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('database')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'database'
                  ? 'bg-teal-600 text-white shadow-md font-extrabold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Database className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Database Foto</span>
            </button>
          </div>

          {/* WINDOW ACTIONS: Maximize / Minimize & Close */}
          <div className="flex items-center gap-1 ml-1">
            <button
              type="button"
              onClick={() => setIsEnlarged(!isEnlarged)}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              title={isEnlarged ? "Kecilkan Tampilan" : "Perbesar Tampilan (Layar Lebar Komputer)"}
            >
              {isEnlarged ? <Minimize2 className="w-5 h-5 text-amber-400" /> : <Maximize2 className="w-5 h-5" />}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              title="Tutup Galeri"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* MODAL BODY */}
        <div className="flex-1 overflow-y-auto bg-slate-900 text-white">
          {/* ========================================================== */}
          {/* TAB 1: VIEWER & CAROUSEL */}
          {/* ========================================================== */}
          {activeTab === 'viewer' && images.length > 0 && (
            <div className="flex flex-col h-full min-h-[420px]">
              {/* Main Image Display Area */}
              <div 
                className={`relative flex-1 bg-slate-950 flex items-center justify-center p-4 select-none isolate [contain:paint_layout] ${
                  isEnlarged ? 'min-h-[500px]' : 'min-h-[340px]'
                }`}
                style={{ cursor: 'default' }}
              >
                <img
                  src={images[currentIndex]}
                  alt={`Foto ${currentIndex + 1} ${box.title}`}
                  decoding="async"
                  loading="eager"
                  draggable={false}
                  className={`object-contain rounded-lg shadow-2xl pointer-events-auto ${
                    isEnlarged ? 'max-h-[74vh] max-w-full' : 'max-h-[58vh] max-w-full'
                  }`}
                  onError={(e) => handleImageErrorWithCloudFallback(e)}
                />

                {/* Left/Right Navigation Arrows */}
                {images.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={handlePrev}
                      className="absolute left-3 top-1/2 -translate-y-1/2 bg-slate-900/90 hover:bg-slate-800 text-white p-2.5 rounded-full shadow-xl border border-slate-700/60 cursor-pointer transition-colors"
                      title="Foto Sebelumnya (Panah Kiri)"
                    >
                      <ChevronLeft className="w-6 h-6" />
                    </button>
                    <button
                      type="button"
                      onClick={handleNext}
                      className="absolute right-3 top-1/2 -translate-y-1/2 bg-slate-900/90 hover:bg-slate-800 text-white p-2.5 rounded-full shadow-xl border border-slate-700/60 cursor-pointer transition-colors"
                      title="Foto Selanjutnya (Panah Kanan)"
                    >
                      <ChevronRight className="w-6 h-6" />
                    </button>
                  </>
                )}

                {/* Top Badge: Photo Index */}
                <div className="absolute top-3 left-3 bg-slate-900/95 px-3 py-1 rounded-full text-xs font-black text-amber-300 border border-slate-700/80 shadow-md">
                  Foto {currentIndex + 1} dari {images.length} {currentIndex === 0 ? '• ⭐ Sampul Utama' : ''}
                </div>

                {/* Top Right Quick Actions */}
                <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-slate-900/95 p-1 rounded-xl border border-slate-700/80 shadow-md">
                  <button
                    type="button"
                    onClick={() => setIsEnlarged(!isEnlarged)}
                    className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                    title={isEnlarged ? "Kecilkan Tampilan" : "Perbesar Tampilan Gambar"}
                  >
                    {isEnlarged ? <Minimize2 className="w-4 h-4 text-amber-300" /> : <Maximize2 className="w-4 h-4" />}
                  </button>
                  <a
                    href={images[currentIndex]}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                    title="Buka Gambar Resolusi Penuh di Tab Baru"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                  <a
                    href={images[currentIndex]}
                    download={`foto_${box.id}_${currentIndex + 1}.jpg`}
                    className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                    title="Unduh Foto Ini"
                  >
                    <Download className="w-4 h-4" />
                  </a>
                  <button
                    type="button"
                    onClick={() => handleDeletePhoto(currentIndex)}
                    className="p-1.5 text-rose-400 hover:text-rose-200 hover:bg-rose-950/60 rounded-lg transition-colors cursor-pointer"
                    title="Hapus Foto Ini dari Kotak"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Bottom Filmstrip Thumbnails */}
              <div className="bg-slate-950/90 border-t border-slate-800/80 p-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 overflow-x-auto py-1 scrollbar-thin max-w-full">
                  {images.map((img, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setCurrentIndex(idx)}
                      className={`relative w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-all cursor-pointer group ${
                        currentIndex === idx
                          ? 'border-amber-400 ring-2 ring-amber-400/40 shadow-lg'
                          : 'border-slate-700 opacity-60 hover:opacity-100 hover:border-slate-500'
                      }`}
                    >
                      <img
                        src={img}
                        alt={`Thumb ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[8px] font-black text-center py-0.5">
                        #{idx + 1}
                      </div>
                    </button>
                  ))}

                  {/* Quick Add Button inside Filmstrip */}
                  <button
                    type="button"
                    onClick={() => setActiveTab('manage')}
                    className="w-14 h-14 rounded-lg border-2 border-dashed border-slate-700 hover:border-blue-400 bg-slate-900 hover:bg-blue-950/40 text-slate-400 hover:text-blue-300 flex flex-col items-center justify-center gap-0.5 flex-shrink-0 transition-all cursor-pointer"
                    title="Tambah Foto Baru Lagi"
                  >
                    <Plus className="w-4 h-4" />
                    <span className="text-[8px] font-bold">+ Foto</span>
                  </button>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => setActiveTab('manage')}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-md"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Upload Lagi</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================== */}
          {/* TAB 2: KELOLA & UPLOAD FOTO (Bisa pilih banyak & upload berulang kali) */}
          {/* ========================================================== */}
          {activeTab === 'manage' && (
            <div className="p-4 sm:p-6 space-y-6">
              {/* UPLOAD ZONE */}
              <div
                className={`relative border-2 border-dashed rounded-2xl p-6 text-center transition-all ${
                  isDragging
                    ? 'border-blue-400 bg-blue-950/40'
                    : 'border-slate-700 hover:border-slate-500 bg-slate-950/50'
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  handleUploadFiles(e.dataTransfer.files);
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  disabled={isUploading}
                  onChange={(e) => handleUploadFiles(e.target.files)}
                  className="hidden"
                  id="modal-multi-file-upload"
                />

                <div className="max-w-md mx-auto flex flex-col items-center gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-xl">
                    <Upload className="w-7 h-7" />
                  </div>

                  <div>
                    <h4 className="font-extrabold text-base text-white">
                      Upload Foto Baru (Bisa Lebih dari 1 Foto Sekaligus)
                    </h4>
                    <p className="text-xs text-slate-400 mt-1">
                      Pilih beberapa file foto SOP/instruksi dari HP atau Laptop. Sehabis upload, Anda dapat langsung upload lagi!
                    </p>
                  </div>

                  <label
                    htmlFor="modal-multi-file-upload"
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-blue-900/40 hover:shadow-blue-800/60 transition-all cursor-pointer active:scale-95"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Pilih Foto dari Perangkat (Bisa Banyak)</span>
                  </label>

                  {/* Progress Indicator */}
                  {isUploading && (
                    <div className="w-full bg-slate-900 p-3 rounded-xl border border-slate-700/80 space-y-2 mt-2">
                      <div className="flex items-center justify-between text-xs font-bold text-blue-300">
                        <span className="flex items-center gap-1.5">
                          <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-400" />
                          <span>Mengunggah foto...</span>
                        </span>
                        <span>
                          {uploadProgress ? `${uploadProgress.current} / ${uploadProgress.total}` : 'Memproses...'}
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 to-teal-400 transition-all duration-300"
                          style={{
                            width: uploadProgress
                              ? `${(uploadProgress.current / uploadProgress.total) * 100}%`
                              : '50%',
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {uploadError && (
                    <p className="text-xs font-bold text-rose-400 bg-rose-950/60 px-3 py-1.5 rounded-lg border border-rose-800">
                      {uploadError}
                    </p>
                  )}
                </div>
              </div>

              {/* INPUT VIA URL */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-2">
                <label className="block text-xs font-bold text-slate-300">
                  Atau Tambahkan melalui Link / URL Gambar (Bisa pisahkan dengan koma jika banyak)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="https://.../foto-sop-1.jpg, https://.../foto-sop-2.jpg"
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddUrl}
                    disabled={!urlInput.trim()}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambahkan URL</span>
                  </button>
                </div>
              </div>

              {/* LIST OF ATTACHED PHOTOS */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-extrabold text-sm text-white flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-amber-400" />
                    <span>Daftar Foto di Kotak Ini ({images.length})</span>
                  </h4>
                  {images.length > 0 && (
                    <button
                      type="button"
                      onClick={handleClearAll}
                      className="text-rose-400 hover:text-rose-300 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Hapus Semua Foto</span>
                    </button>
                  )}
                </div>

                {images.length === 0 ? (
                  <div className="bg-slate-950/40 rounded-xl border border-slate-800 p-8 text-center text-slate-500 text-xs">
                    Belum ada foto yang dilampirkan pada kotak ini. Silakan upload file atau pilih dari Database Foto.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {images.map((img, idx) => (
                      <div
                        key={idx}
                        className={`relative rounded-xl overflow-hidden border bg-slate-950 group/card transition-all ${
                          idx === 0
                            ? 'border-amber-500/80 ring-2 ring-amber-500/30'
                            : 'border-slate-800 hover:border-slate-600'
                        }`}
                      >
                        {/* Image Preview */}
                        <div
                          className="h-28 w-full overflow-hidden cursor-pointer bg-slate-900"
                          onClick={() => {
                            setCurrentIndex(idx);
                            setActiveTab('viewer');
                          }}
                        >
                          <img
                            src={img}
                            alt={`Foto ${idx + 1}`}
                            className="w-full h-full object-cover group-hover/card:scale-105 transition-transform duration-300"
                          />
                        </div>

                        {/* Top Badge */}
                        <div className="absolute top-1.5 left-1.5 bg-slate-950/90 text-[10px] font-black px-1.5 py-0.5 rounded text-white border border-slate-700/60 shadow-md">
                          #{idx + 1} {idx === 0 ? '⭐ Utama' : ''}
                        </div>

                        {/* Delete Button */}
                        <button
                          type="button"
                          onClick={() => handleDeletePhoto(idx)}
                          className="absolute top-1.5 right-1.5 p-1 bg-rose-950/90 hover:bg-rose-800 text-rose-200 rounded-lg text-xs border border-rose-700/80 transition-colors cursor-pointer shadow-md"
                          title="Hapus foto ini"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>

                        {/* Bottom Actions: Reorder & Set Cover */}
                        <div className="p-2 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-[11px]">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleMovePhoto(idx, idx - 1)}
                              disabled={idx === 0}
                              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 cursor-pointer"
                              title="Geser ke Kiri"
                            >
                              <ArrowLeft className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMovePhoto(idx, idx + 1)}
                              disabled={idx === images.length - 1}
                              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 cursor-pointer"
                              title="Geser ke Kanan"
                            >
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          </div>

                          {idx !== 0 && (
                            <button
                              type="button"
                              onClick={() => handleSetCover(idx)}
                              className="text-[10px] font-bold text-amber-400 hover:text-amber-300 bg-amber-950/50 px-2 py-0.5 rounded border border-amber-800/60 cursor-pointer"
                              title="Jadikan Foto Sampul Utama"
                            >
                              Jadikan Cover
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================== */}
          {/* TAB 3: DATABASE FOTO IRM (Galeri Semua Foto yang Tersimpan) */}
          {/* ========================================================== */}
          {activeTab === 'database' && (
            <div className="p-4 sm:p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                <div>
                  <h4 className="font-extrabold text-sm text-white flex items-center gap-2">
                    <Database className="w-4 h-4 text-teal-400" />
                    <span>Database Penyimpanan Foto IRM</span>
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Foto yang pernah diunggah otomatis tersimpan di server. Anda bisa memilih foto yang sudah ada tanpa harus upload ulang.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={dbSearchQuery}
                      onChange={(e) => setDbSearchQuery(e.target.value)}
                      placeholder="Cari foto..."
                      className="bg-slate-900 border border-slate-700 pl-8 pr-3 py-1.5 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 w-44"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={loadDbPhotos}
                    disabled={isLoadingDb}
                    className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors cursor-pointer"
                    title="Refresh Database Foto"
                  >
                    <RefreshCw className={`w-4 h-4 ${isLoadingDb ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Selection Summary Banner */}
              {selectedDbUrls.length > 0 && (
                <div className="bg-teal-950/80 border border-teal-700/80 p-3 rounded-xl flex items-center justify-between text-xs text-teal-200">
                  <span className="font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-teal-400" />
                    {selectedDbUrls.length} foto dipilih dari database
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedDbUrls([])}
                      className="px-2.5 py-1 text-slate-300 hover:text-white font-bold cursor-pointer"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      onClick={handleAttachDbPhotos}
                      className="px-3.5 py-1 bg-teal-500 hover:bg-teal-400 text-slate-950 font-black rounded-lg shadow-md cursor-pointer transition-colors"
                    >
                      + Lampirkan ke Kotak Ini
                    </button>
                  </div>
                </div>
              )}

              {/* Photos Grid from Database */}
              {isLoadingDb ? (
                <div className="py-16 text-center text-slate-400 flex flex-col items-center gap-2">
                  <RefreshCw className="w-6 h-6 animate-spin text-teal-400" />
                  <span className="text-xs font-bold">Memuat database foto...</span>
                </div>
              ) : filteredDbPhotos.length === 0 ? (
                <div className="bg-slate-950/40 rounded-xl border border-slate-800 p-12 text-center text-slate-400 space-y-2">
                  <FolderOpen className="w-8 h-8 mx-auto text-slate-600" />
                  <p className="text-xs font-bold">Belum ada foto yang tersimpan di Database Foto.</p>
                  <p className="text-[11px] text-slate-500">
                    Foto yang Anda upload melalui tab "Kelola & Upload" akan otomatis terdaftar di sini.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-[50vh] overflow-y-auto pr-1">
                  {filteredDbPhotos.map((photo) => {
                    const isSelected = selectedDbUrls.includes(photo.url);
                    const isAlreadyInBox = images.includes(photo.url);

                    return (
                      <div
                        key={photo.id}
                        onClick={() => {
                          if (isAlreadyInBox) return;
                          if (isSelected) {
                            setSelectedDbUrls((prev) => prev.filter((u) => u !== photo.url));
                          } else {
                            setSelectedDbUrls((prev) => [...prev, photo.url]);
                          }
                        }}
                        className={`relative rounded-xl overflow-hidden border bg-slate-950 transition-all cursor-pointer group/db ${
                          isSelected
                            ? 'border-teal-400 ring-2 ring-teal-400/40 shadow-lg'
                            : isAlreadyInBox
                            ? 'border-slate-800 opacity-60'
                            : 'border-slate-800 hover:border-teal-500/60'
                        }`}
                      >
                        <div className="h-28 w-full overflow-hidden bg-slate-900">
                          <img
                            src={photo.url}
                            alt={photo.title || photo.filename}
                            className="w-full h-full object-cover group-hover/db:scale-105 transition-transform duration-300"
                          />
                        </div>

                        {/* Top status indicator */}
                        <div className="absolute top-1.5 left-1.5 flex items-center gap-1">
                          {isAlreadyInBox ? (
                            <span className="bg-slate-900/90 text-amber-300 text-[9px] font-black px-1.5 py-0.5 rounded border border-slate-700">
                              Sudah Terpasang
                            </span>
                          ) : isSelected ? (
                            <span className="bg-teal-500 text-slate-950 text-[9px] font-black px-1.5 py-0.5 rounded flex items-center gap-0.5 shadow-md">
                              <CheckCircle2 className="w-3 h-3" /> Terpilih
                            </span>
                          ) : null}
                        </div>

                        {/* Delete from DB button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteFromDb(photo);
                          }}
                          className="absolute top-1.5 right-1.5 p-1 bg-slate-900/90 hover:bg-rose-900 text-slate-400 hover:text-white rounded-lg text-xs border border-slate-700/80 transition-colors shadow-md"
                          title="Hapus dari Database Foto"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>

                        {/* Details Footer */}
                        <div className="p-2 bg-slate-900/90 border-t border-slate-800 text-[10px]">
                          <p className="font-bold text-white truncate">
                            {photo.originalName || photo.title || photo.filename}
                          </p>
                          <p className="text-slate-400 text-[9px] truncate">
                            {photo.boxTitle ? `Kotak: ${photo.boxTitle}` : 'Foto SOP IRM'}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className="bg-slate-950 border-t border-slate-800 px-4 py-3 flex items-center justify-between">
          <div className="text-xs text-slate-400 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>SOP & Foto Instruksi terenkripsi & tersimpan permanen di server</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
});
