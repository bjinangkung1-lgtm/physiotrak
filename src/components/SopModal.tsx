import React, { useState } from 'react';
import { 
  X, 
  FileText, 
  Download, 
  CheckCircle2, 
  ShieldCheck, 
  Printer, 
  ExternalLink,
  ChevronRight,
  BookOpen,
  Sparkles
} from 'lucide-react';
import { downloadSopAsWordDocument } from '../utils/wordExportService';

interface SopModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SopModal: React.FC<SopModalProps> = ({ isOpen, onClose }) => {
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  if (!isOpen) return null;

  const handleDownloadWord = () => {
    downloadSopAsWordDocument();
    setDownloadSuccess(true);
    setTimeout(() => {
      setDownloadSuccess(false);
    }, 4000);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-4xl max-h-[90vh] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
      >
        {/* Header Modal */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-teal-900 via-slate-900 to-teal-950 text-white flex items-center justify-between shrink-0 border-b border-teal-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/20 border border-teal-400/40 flex items-center justify-center text-teal-300 shadow-inner">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-white tracking-tight">
                  Standar Operasional Prosedur (SOP)
                </h2>
                <span className="text-[10px] font-extrabold px-2 py-0.5 bg-teal-500/30 text-teal-200 border border-teal-400/30 rounded-md uppercase">
                  Format Word
                </span>
              </div>
              <p className="text-xs text-teal-200/80 font-medium">
                Sistem Antrean &amp; Database Pasien Instalasi Rehabilitasi Medik (IRM)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadWord}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 text-white rounded-xl text-xs font-black shadow-md shadow-teal-950/40 transition-all cursor-pointer hover:scale-105 active:scale-95"
              title="Unduh Dokumen SOP Resmi dalam format Microsoft Word (.doc)"
            >
              <Download className="w-4 h-4" />
              <span>Unduh Word (.doc)</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              title="Tutup (ESC)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Download Success Banner */}
        {downloadSuccess && (
          <div className="p-3 bg-emerald-50 border-b border-emerald-200 text-emerald-800 flex items-center justify-between px-6 text-xs font-bold animate-in slide-in-from-top-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Dokumen SOP berhasil diunduh ke komputer Anda! Silakan buka file di Microsoft Word.</span>
            </div>
            <span className="text-[11px] text-emerald-600 font-semibold">Tersimpan di folder Downloads</span>
          </div>
        )}

        {/* Modal Body - SOP Document Viewer */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6 text-slate-800 bg-slate-50/50">
          {/* Document Header Card */}
          <div className="bg-white p-5 rounded-2xl border border-teal-100 shadow-xs space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs border border-teal-200 rounded-xl overflow-hidden divide-y sm:divide-y-0 sm:divide-x divide-teal-100">
              <div className="p-3 bg-teal-50/60 text-center flex flex-col justify-center items-center">
                <span className="font-black text-sm text-teal-900">RUMAH SAKIT PUSAT PERTAMINA</span>
                <span className="text-[11px] text-teal-700 font-bold">INSTALASI REHABILITASI MEDIK</span>
              </div>
              <div className="p-3 bg-white text-center flex flex-col justify-center items-center">
                <span className="font-extrabold text-slate-800">STANDAR OPERASIONAL PROSEDUR</span>
                <span className="text-[11px] text-slate-500 font-medium">Sistem Antrean &amp; Database Pasien</span>
              </div>
              <div className="p-3 bg-slate-50 text-slate-700 space-y-1 text-[11px]">
                <div className="flex justify-between"><strong>No. Dok:</strong> <span>SOP-IRM-IT-001</span></div>
                <div className="flex justify-between"><strong>Revisi:</strong> <span>02 (Master Cloud)</span></div>
                <div className="flex justify-between"><strong>Tanggal:</strong> <span>September 2026</span></div>
              </div>
            </div>

            {/* 1. Tujuan */}
            <div className="space-y-1.5 pt-2">
              <h3 className="text-sm font-black text-teal-900 flex items-center gap-1.5 border-b border-teal-100 pb-1">
                <span>1. TUJUAN</span>
              </h3>
              <ul className="text-xs text-slate-700 space-y-1 list-disc list-inside leading-relaxed pl-1">
                <li>Memberikan standarisasi operasional bagi Petugas Admisi dan Terapis dalam mengoperasikan sistem antrean digital.</li>
                <li>Menjamin alur pelayanan pasien dari pendaftaran hingga penyelesaian tindakan berjalan tertib, tepat waktu, dan bebas kesalahan alokasi box.</li>
                <li>Menjamin keutuhan, keamanan, dan ketersediaan data rekam kunjungan harian, laporan bulanan, dan database master pasien di Cloud Firestore.</li>
              </ul>
            </div>

            {/* 2. Ruang Lingkup */}
            <div className="space-y-1.5">
              <h3 className="text-sm font-black text-teal-900 flex items-center gap-1.5 border-b border-teal-100 pb-1">
                <span>2. RUANG LINGKUP</span>
              </h3>
              <p className="text-xs text-slate-700 leading-relaxed pl-1">
                Meliputi autentikasi login, pendaftaran pasien baru/lama, pemanggilan antrean ke layar TV Display, pengalihan antar-box, pencatatan kode tindakan/ICF, pergantian shift siang, hingga pembuatan laporan harian dan bulanan.
              </p>
            </div>

            {/* 3. Wewenang & Tanggung Jawab */}
            <div className="space-y-1.5">
              <h3 className="text-sm font-black text-teal-900 flex items-center gap-1.5 border-b border-teal-100 pb-1">
                <span>3. WEWENANG DAN TANGGUNG JAWAB</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-xs">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="font-bold text-slate-900 block mb-1">Petugas Admisi</span>
                  <p className="text-slate-600 text-[11px] leading-relaxed">
                    Registrasi pasien, pencarian master data, pembagian nomor antrean dan penentuan box awal.
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-teal-50/60 border border-teal-200">
                  <span className="font-bold text-teal-950 block mb-1">Terapis / Petugas Box</span>
                  <p className="text-teal-800 text-[11px] leading-relaxed">
                    Pemanggilan pasien ke antrean, pengisian kode tindakan/ICF, pengalihan box lanjutan, dan penyelesaian tindakan.
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-indigo-50/60 border border-indigo-200">
                  <span className="font-bold text-indigo-950 block mb-1">Kepala Unit / IT</span>
                  <p className="text-indigo-800 text-[11px] leading-relaxed">
                    Monitoring waktu respon (SPM), ekspor laporan bulanan, manajemen sandi, dan reset harian dengan PIN.
                  </p>
                </div>
              </div>
            </div>

            {/* 4. Alur Pelayanan Ringkas */}
            <div className="space-y-1.5">
              <h3 className="text-sm font-black text-teal-900 flex items-center gap-1.5 border-b border-teal-100 pb-1">
                <span>4. ALUR PROSEDUR OPERASIONAL</span>
              </h3>
              <div className="p-3.5 bg-slate-900 text-teal-200 rounded-xl font-mono text-[11px] leading-relaxed overflow-x-auto">
                <p>1. Buka Aplikasi ➔ Autentikasi Login (Status: ☁️ Cloud Live)</p>
                <p>2. Pendaftaran ➔ Klik &quot;+ Pasien&quot; ➔ Cari Pasien Lama / Input Pasien Baru ➔ Simpan Antrean</p>
                <p>3. Pemanggilan ➔ Terapis klik tombol &quot;Panggil&quot; (Display TV Monitor)</p>
                <p>4. Pelayanan ➔ Input Kode Tindakan &amp; Diagnosa ICF ➔ Alihkan jika perlu box lain</p>
                <p>5. Selesai Tindakan ➔ Klik centang hijau &quot;Selesai&quot; (Waktu SPM tercatat)</p>
                <p>6. Penutupan Shift ➔ Unduh Rekap Harian/Bulanan ➔ Bersihkan Antrean (Auto-Archive)</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-100 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <ShieldCheck className="w-4 h-4 text-teal-600" />
            <span>Dokumen SOP ini dapat langsung dibuka dan diedit di Microsoft Word (.doc/.docx)</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
            >
              <Printer className="w-4 h-4 text-slate-600" />
              <span>Cetak / PDF</span>
            </button>

            <button
              onClick={handleDownloadWord}
              className="px-4 py-2 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-md transition-all cursor-pointer hover:scale-105 active:scale-95"
            >
              <Download className="w-4 h-4" />
              <span>Unduh Dokumen Word</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
