import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, Camera, Upload, Trash2, ZoomIn, ZoomOut, RotateCw, 
  ChevronLeft, ChevronRight, Download, Hospital, Image as ImageIcon,
  Maximize2, Minimize2, ExternalLink
} from 'lucide-react';
import { PatientItem, MasterPatient, PatientInstructionPhoto } from '../types';
import { getPatientImageUrls, uploadPatientInstructionPhotos, handleImageErrorWithCloudFallback } from '../utils/imageUtils';
import { databaseService } from '../utils/databaseService';

interface PatientPhotoModalProps {
  isOpen: boolean;
  onClose: () => void;
  patient: Partial<PatientItem | MasterPatient>;
  onUpdatePatientPhotos?: (updatedPhotos: PatientInstructionPhoto[], updatedUrls: string[]) => void;
  canUpload?: boolean;
}

export const PatientPhotoModal: React.FC<PatientPhotoModalProps> = ({
  isOpen,
  onClose,
  patient,
  onUpdatePatientPhotos,
  canUpload = true,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isEnlarged, setIsEnlarged] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen || !patient) return null;

  const imageUrls = getPatientImageUrls(patient);
  const patientName = patient.patientName || 'Pasien';
  const medicalRecordNo = patient.medicalRecordNo || '-';
  const isRanap = 'isRanap' in patient ? Boolean(patient.isRanap) : true;

  const activeUrl = imageUrls[currentIndex] || '';

  const handleNext = () => {
    if (imageUrls.length > 0) {
      setCurrentIndex((prev) => (prev + 1) % imageUrls.length);
      setZoomLevel(1);
      setRotation(0);
    }
  };

  const handlePrev = () => {
    if (imageUrls.length > 0) {
      setCurrentIndex((prev) => (prev - 1 + imageUrls.length) % imageUrls.length);
      setZoomLevel(1);
      setRotation(0);
    }
  };

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsUploading(true);

    try {
      const fileArray = Array.from(files);
      const res = await uploadPatientInstructionPhotos(fileArray, {
        medicalRecordNo: patient.medicalRecordNo || '',
        patientName: patient.patientName || '',
        patientId: patient.id,
        boxId: 'boxId' in patient ? patient.boxId : undefined,
      });

      const newUrls = Array.from(new Set([...imageUrls, ...res.urls]));
      const existingPhotos: PatientInstructionPhoto[] = Array.isArray(patient.instructionPhotos) ? patient.instructionPhotos : [];
      const mergedPhotos = [...existingPhotos, ...res.photos];

      // Update in MasterPatient database
      if (patient.medicalRecordNo) {
        databaseService.saveMasterPatient({
          ...patient,
          instructionImageUrl: newUrls[0] || undefined,
          instructionImageUrls: newUrls,
          instructionPhotos: mergedPhotos,
        }).catch(console.warn);
      }

      if (onUpdatePatientPhotos) {
        onUpdatePatientPhotos(mergedPhotos, newUrls);
      }

      setCurrentIndex(newUrls.length - 1);
    } catch (err) {
      console.error('Failed to upload patient instruction photo:', err);
      alert('Gagal mengunggah foto instruksi.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (cameraInputRef.current) cameraInputRef.current.value = '';
    }
  };

  const handleDeletePhoto = (urlToDelete: string) => {
    if (!confirm('Hapus foto instruksi ini?')) return;

    const remainingUrls = imageUrls.filter((u) => u !== urlToDelete);
    const existingPhotos: PatientInstructionPhoto[] = Array.isArray(patient.instructionPhotos) ? patient.instructionPhotos : [];
    const remainingPhotos = existingPhotos.filter((p) => p.url !== urlToDelete && p.dataUrl !== urlToDelete);

    if (patient.medicalRecordNo) {
      databaseService.saveMasterPatient({
        ...patient,
        instructionImageUrl: remainingUrls[0] || undefined,
        instructionImageUrls: remainingUrls.length > 0 ? remainingUrls : undefined,
        instructionPhotos: remainingPhotos.length > 0 ? remainingPhotos : undefined,
      }).catch(console.warn);
    }

    if (onUpdatePatientPhotos) {
      onUpdatePatientPhotos(remainingPhotos, remainingUrls);
    }

    if (currentIndex >= remainingUrls.length) {
      setCurrentIndex(Math.max(0, remainingUrls.length - 1));
    }
  };

  return createPortal(
    <div 
      className="fixed inset-0 z-50 bg-slate-950/90 flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-150 isolate"
      onClick={onClose}
    >
      <div 
        className={`bg-slate-900 border border-slate-700/80 rounded-2xl w-full flex flex-col shadow-2xl overflow-hidden text-white isolate transition-all duration-150 ${
          isEnlarged 
            ? 'max-w-[98vw] h-[96vh] max-h-[98vh]' 
            : 'max-w-6xl max-h-[94vh] h-[90vh]'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Header */}
        <div className="bg-slate-800/95 border-b border-slate-700/80 p-3 sm:p-4 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-teal-600/30 border border-teal-500/40 flex items-center justify-center shrink-0">
              <Camera className="w-5 h-5 text-teal-400" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-sm sm:text-base text-white truncate">
                  {patientName}
                </h3>
                {isRanap && (
                  <span className="px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-300 border border-blue-400/30 text-[10px] font-bold flex items-center gap-1">
                    <Hospital className="w-3 h-3" />
                    <span>RANAP</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                <span>No. RM: <strong className="text-slate-200 font-mono">{medicalRecordNo}</strong></span>
                <span>•</span>
                <span>Foto: <strong className="text-teal-300">{imageUrls.length > 0 ? currentIndex + 1 : 0} dari {imageUrls.length}</strong></span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick Camera & Upload Action Buttons */}
            {canUpload && (
              <div className="flex items-center gap-1.5">
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => handleFileUpload(e.target.files)}
                />
                <button
                  type="button"
                  disabled={isUploading}
                  onClick={() => cameraInputRef.current?.click()}
                  className="px-2.5 py-1.5 bg-teal-600 hover:bg-teal-500 active:bg-teal-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-colors shadow-xs flex items-center gap-1 cursor-pointer"
                  title="Ambil foto langsung dengan kamera eksternal/device"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Kamera</span>
                </button>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => handleFileUpload(e.target.files)}
                />
                <button
                  type="button"
                  disabled={isUploading}
                  onClick={() => fileInputRef.current?.click()}
                  className="px-2.5 py-1.5 bg-slate-700 hover:bg-slate-600 active:bg-slate-800 disabled:opacity-50 text-slate-100 rounded-lg text-xs font-bold transition-colors border border-slate-600 flex items-center gap-1 cursor-pointer"
                  title="Upload foto dari file galeri / folder"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Upload</span>
                </button>
              </div>
            )}

            {/* Toggle Fullscreen / Wide Mode */}
            <button
              type="button"
              onClick={() => setIsEnlarged(!isEnlarged)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors cursor-pointer"
              title={isEnlarged ? "Kecilkan Tampilan" : "Perlebar Layar Penuh"}
            >
              {isEnlarged ? <Minimize2 className="w-5 h-5 text-teal-300" /> : <Maximize2 className="w-5 h-5" />}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors cursor-pointer"
              title="Tutup Viewer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Viewer Viewport (Expansive Wide Canvas) */}
        <div 
          className={`flex-1 bg-slate-950 flex items-center justify-center relative overflow-hidden select-none isolate [contain:paint_layout] ${
            isEnlarged ? 'min-h-[500px]' : 'min-h-[400px]'
          }`}
          style={{ cursor: 'default' }}
        >
          {imageUrls.length > 0 && activeUrl ? (
            <div className="relative w-full h-full flex items-center justify-center p-3 sm:p-4 isolate">
              <img
                src={activeUrl}
                alt={`Instruksi ${patientName}`}
                decoding="async"
                loading="eager"
                draggable={false}
                onError={handleImageErrorWithCloudFallback}
                className={`object-contain rounded-lg shadow-2xl pointer-events-auto transition-all duration-150 ${
                  isEnlarged ? 'max-h-[80vh] max-w-full' : 'max-h-[70vh] max-w-full'
                }`}
                style={{
                  transform: `scale(${zoomLevel}) rotate(${rotation}deg)`,
                  willChange: zoomLevel !== 1 || rotation !== 0 ? 'transform' : 'auto',
                }}
              />

              {/* Navigation Arrows */}
              {imageUrls.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={handlePrev}
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-slate-900/90 hover:bg-teal-600 border border-slate-700 text-white flex items-center justify-center shadow-2xl transition-colors cursor-pointer"
                    title="Foto Sebelumnya"
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </button>
                  <button
                    type="button"
                    onClick={handleNext}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-slate-900/90 hover:bg-teal-600 border border-slate-700 text-white flex items-center justify-center shadow-2xl transition-colors cursor-pointer"
                    title="Foto Berikutnya"
                  >
                    <ChevronRight className="w-6 h-6" />
                  </button>
                </>
              )}

              {/* Floating Toolbar for Active Image (Zoom, Rotate, Delete, Download, Open Tab) */}
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-slate-900/95 border border-slate-700 rounded-xl px-3 py-1.5 flex items-center gap-2 shadow-2xl">
                <button
                  type="button"
                  onClick={() => setZoomLevel((z) => Math.min(z + 0.25, 3))}
                  className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                  title="Perbesar (Zoom In)"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setZoomLevel((z) => Math.max(z - 0.25, 0.5))}
                  className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                  title="Perkecil (Zoom Out)"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setRotation((r) => (r + 90) % 360)}
                  className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                  title="Putar 90° (Rotate)"
                >
                  <RotateCw className="w-4 h-4" />
                </button>

                <div className="w-[1px] h-4 bg-slate-700 my-auto" />

                <a
                  href={activeUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1.5 text-slate-300 hover:text-teal-300 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                  title="Buka Gambar Resolusi Penuh di Tab Baru"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>

                <a
                  href={activeUrl}
                  download={`instruksi_ranap_${medicalRecordNo}_${currentIndex + 1}.jpg`}
                  className="p-1.5 text-slate-300 hover:text-teal-300 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                  title="Unduh Gambar"
                >
                  <Download className="w-4 h-4" />
                </a>

                {canUpload && (
                  <button
                    type="button"
                    onClick={() => handleDeletePhoto(activeUrl)}
                    className="p-1.5 text-rose-400 hover:text-rose-200 hover:bg-rose-900/50 rounded-lg transition-colors cursor-pointer"
                    title="Hapus foto ini"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center p-8 max-w-sm">
              <div className="w-16 h-16 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-center mx-auto mb-3 shadow-inner">
                <ImageIcon className="w-8 h-8 text-slate-500" />
              </div>
              <h4 className="text-sm font-bold text-slate-300 mb-1">
                Belum Ada Foto Instruksi Ranap
              </h4>
              <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                Ambil foto lembar instruksi dokter/DPJP atau upload dari galeri untuk disimpan otomatis pada data pasien ini.
              </p>
              {canUpload && (
                <div className="flex items-center justify-center gap-2">
                  <button
                    type="button"
                    disabled={isUploading}
                    onClick={() => cameraInputRef.current?.click()}
                    className="px-3 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-bold transition-colors shadow-md flex items-center gap-1.5 cursor-pointer"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Buka Kamera</span>
                  </button>
                  <button
                    type="button"
                    disabled={isUploading}
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 rounded-xl text-xs font-bold transition-colors shadow-md flex items-center gap-1.5 cursor-pointer"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Pilih Berkas</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Thumbnail Carousel Bar */}
        {imageUrls.length > 1 && (
          <div className="bg-slate-900/95 border-t border-slate-800 p-2.5 flex items-center gap-2 overflow-x-auto shrink-0">
            {imageUrls.map((url, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setCurrentIndex(idx);
                  setZoomLevel(1);
                  setRotation(0);
                }}
                className={`relative w-16 h-16 rounded-lg overflow-hidden shrink-0 border-2 transition-colors cursor-pointer ${
                  idx === currentIndex
                    ? 'border-teal-400 ring-2 ring-teal-500/50'
                    : 'border-slate-700 opacity-60 hover:opacity-100 hover:border-slate-500'
                }`}
              >
                <img
                  src={url}
                  alt={`Thumb ${idx + 1}`}
                  onError={handleImageErrorWithCloudFallback}
                  className="w-full h-full object-cover"
                />
                <span className="absolute bottom-0 right-0 bg-slate-950/90 text-white text-[9px] font-mono px-1 rounded-tl">
                  {idx + 1}
                </span>
              </button>
            ))}
          </div>
        )}

      </div>
    </div>,
    document.body
  );
};

