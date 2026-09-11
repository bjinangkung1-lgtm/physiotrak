import React, { useEffect, useState, useRef } from 'react';
import { 
  X, 
  QrCode, 
  Printer, 
  Copy, 
  Check, 
  Share2, 
  ExternalLink, 
  Smartphone, 
  Info,
  Globe,
  Sparkles,
  Link as LinkIcon
} from 'lucide-react';
import { PatientItem, QueueBox } from '../types';
import { generateQRCodeDataUrl, getPatientTrackingUrl, getWhatsAppShareUrl, APP_MOBILE_DOMAIN, APP_MOBILE_URL } from '../utils/qrUtils';

interface PatientQRModalProps {
  isOpen: boolean;
  onClose: () => void;
  patient?: PatientItem | null;
  box?: QueueBox | null;
  allBoxes?: QueueBox[];
  onOpenMobileView?: (queueNumber?: string) => void;
}

export const PatientQRModal: React.FC<PatientQRModalProps> = ({
  isOpen,
  onClose,
  patient,
  box,
  allBoxes = [],
  onOpenMobileView,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [copiedDomain, setCopiedDomain] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const printSlipRef = useRef<HTMLDivElement>(null);

  const activeBox = box || (patient ? allBoxes.find(b => b.id === patient.boxId) : null);
  const trackingUrl = patient 
    ? getPatientTrackingUrl(patient.queueNumber, patient.id)
    : getPatientTrackingUrl();

  useEffect(() => {
    if (isOpen && trackingUrl) {
      generateQRCodeDataUrl(trackingUrl).then((url) => {
        setQrDataUrl(url);
      });
    }
  }, [isOpen, trackingUrl]);

  if (!isOpen) return null;

  const handleCopyLink = () => {
    if (!trackingUrl) return;
    navigator.clipboard.writeText(trackingUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const handleCopyDomain = () => {
    navigator.clipboard.writeText(APP_MOBILE_DOMAIN).then(() => {
      setCopiedDomain(true);
      setTimeout(() => setCopiedDomain(false), 2500);
    });
  };

  const handleOpenDirect = () => {
    window.open(trackingUrl || APP_MOBILE_URL, '_blank');
  };

  const handlePrintSlip = () => {
    setIsPrinting(true);
    setTimeout(() => {
      window.print();
      setIsPrinting(false);
    }, 200);
  };

  const handleWhatsAppShare = () => {
    if (!patient) return;
    const waUrl = getWhatsAppShareUrl(
      patient.patientName,
      patient.queueNumber,
      activeBox?.title || 'Instalasi Rehabilitasi Medis RSPP',
      trackingUrl
    );
    window.open(waUrl, '_blank');
  };

  const nowFormatted = new Date().toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 text-slate-800 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 bg-linear-to-r from-blue-700 via-indigo-700 to-teal-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/15 rounded-xl backdrop-blur-xs">
              <Smartphone className="w-5 h-5 text-teal-300" />
            </div>
            <div>
              <h2 className="text-base font-black tracking-tight flex items-center gap-2">
                <span>Link Aplikasi & QR Code HP</span>
                <span className="text-[10px] bg-teal-400/20 text-teal-200 px-2 py-0.5 rounded-full border border-teal-300/30">
                  Online
                </span>
              </h2>
              <p className="text-xs text-blue-100 font-medium">
                Akses langsung lewat browser HP tanpa instalasi tambahan
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {/* Main App Link Highlight Card */}
          <div className="bg-linear-to-br from-indigo-900 via-slate-900 to-teal-950 text-white p-4 rounded-2xl border border-indigo-700/50 shadow-md">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-1.5 text-indigo-200 text-[11px] font-bold">
                <Globe className="w-4 h-4 text-teal-400" />
                <span>Link Sementara Aplikasi HP:</span>
              </div>
              <span className="text-[10px] bg-teal-500/20 text-teal-300 px-2 py-0.5 rounded-md font-mono border border-teal-400/30">
                Akses Langsung
              </span>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 bg-black/30 p-2.5 rounded-xl border border-white/10">
              <div className="flex items-center gap-2 font-mono text-base font-black text-amber-300 tracking-wide select-all">
                <LinkIcon className="w-4 h-4 text-indigo-300 shrink-0" />
                <span>{APP_MOBILE_DOMAIN}</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={handleCopyDomain}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                    copiedDomain 
                      ? 'bg-emerald-500 text-white shadow-xs' 
                      : 'bg-white/15 hover:bg-white/25 text-white'
                  }`}
                  title="Salin Link Domain"
                >
                  {copiedDomain ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedDomain ? 'Tersalin' : 'Salin'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleOpenDirect}
                  className="px-3 py-1.5 bg-teal-500 hover:bg-teal-400 active:bg-teal-600 text-slate-950 rounded-lg text-xs font-black flex items-center gap-1 transition-all cursor-pointer shadow-xs"
                  title="Buka Aplikasi di Tab Baru"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Buka</span>
                </button>
              </div>
            </div>
            <p className="text-[11px] text-slate-300 mt-2 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-teal-400 shrink-0" />
              <span>Buka Google Chrome atau Safari di HP lalu ketik link di atas untuk membuka aplikasi secara instan.</span>
            </p>
          </div>

          {/* Patient summary badge if specific patient */}
          {patient ? (
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex items-center justify-between gap-3">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Pasien Khusus</span>
                <p className="text-sm font-black text-slate-900 leading-tight uppercase">{patient.patientName}</p>
                <div className="flex items-center gap-2 mt-0.5 text-slate-600 text-xs">
                  <span>RM: <strong>{patient.medicalRecordNo}</strong></span>
                  {patient.actionCode && (
                    <span className="px-1.5 py-0.2 bg-teal-100 text-teal-800 rounded font-bold text-[10px]">
                      {patient.actionCode}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right shrink-0">
                <span className="px-2.5 py-1 bg-teal-100 text-teal-900 font-bold rounded-lg text-xs block">
                  {activeBox?.title || 'Poli IRM'}
                </span>
                <span className="text-[10px] text-slate-500 font-semibold block mt-0.5">
                  {activeBox?.officerName || 'Petugas IRM'}
                </span>
              </div>
            </div>
          ) : (
            <div className="bg-blue-50/80 p-3 rounded-xl border border-blue-200 text-blue-900 text-xs flex items-start gap-2.5">
              <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Akses Penuh Antrian & Manajemen dari HP</p>
                <p className="text-[11px] text-blue-800 mt-0.5">
                  Scan QR Code di bawah dengan kamera smartphone atau buka langsung tautan <strong>{APP_MOBILE_DOMAIN}</strong> untuk memantau panggilan atau menginput antrian secara mobile.
                </p>
              </div>
            </div>
          )}

          {/* QR Code Container */}
          <div className="flex flex-col items-center justify-center p-5 bg-linear-to-b from-slate-50 to-white rounded-2xl border-2 border-dashed border-slate-300">
            {qrDataUrl ? (
              <div className="relative group p-2.5 bg-white rounded-xl shadow-md border border-slate-200">
                <img 
                  src={qrDataUrl} 
                  alt="QR Code Antrian Pasien" 
                  className="w-48 h-48 sm:w-56 sm:h-56 object-contain"
                />
                <div className="absolute inset-0 bg-blue-950/10 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center pointer-events-none">
                  <span className="bg-blue-900 text-white text-[10px] font-bold px-2 py-1 rounded-md shadow-xs flex items-center gap-1">
                    <QrCode className="w-3 h-3" /> Scan dengan Kamera HP
                  </span>
                </div>
              </div>
            ) : (
              <div className="w-48 h-48 flex items-center justify-center text-slate-400">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
              </div>
            )}

            <p className="mt-3 font-black text-slate-800 text-center text-xs">
              Arahkan Kamera HP ke QR Code di atas
            </p>
            <p className="text-[11px] text-slate-500 text-center max-w-xs mt-0.5">
              Halaman web terbuka langsung di HP tanpa perlu instalasi aplikasi dari Play Store / App Store.
            </p>
          </div>

          {/* Direct Link & Copy */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold text-slate-700">
              Tautan Lengkap Pemantau Antrean Live:
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={trackingUrl}
                className="flex-1 px-3 py-2 bg-slate-100 border border-slate-300 rounded-lg text-xs font-mono text-slate-700 select-all"
              />
              <button
                type="button"
                onClick={handleCopyLink}
                className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  copied 
                    ? 'bg-emerald-600 text-white shadow-xs' 
                    : 'bg-slate-200 hover:bg-slate-300 text-slate-800'
                }`}
                title="Salin Tautan Lengkap"
              >
                {copied ? <Check className="w-4 h-4 text-white" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'Tersalin!' : 'Salin'}</span>
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
            {patient && (
              <button
                type="button"
                onClick={handleWhatsAppShare}
                className="px-3 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
              >
                <Share2 className="w-4 h-4" />
                <span>Kirim via WhatsApp</span>
              </button>
            )}

            <button
              type="button"
              onClick={handlePrintSlip}
              className={`px-3 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer ${
                !patient ? 'sm:col-span-2' : ''
              }`}
            >
              <Printer className="w-4 h-4 text-teal-300" />
              <span>Cetak Struk Tiket</span>
            </button>
          </div>
        </div>
      </div>

      {/* Hidden Printable Thermal Slip Area */}
      <div className="hidden print:block print:fixed print:inset-0 print:bg-white print:p-4 text-black font-sans z-9999" ref={printSlipRef}>
        <div className="max-w-[300px] mx-auto text-center border-b border-dashed border-black pb-3 mb-3">
          <h2 className="text-sm font-black uppercase tracking-wider">RUMAH SAKIT PUSAT PERTAMINA</h2>
          <p className="text-[10px] font-bold">INSTALASI REHABILITASI MEDIS (IRM)</p>
          <p className="text-[9px] text-gray-700">Jl. Kyai Maja No.43, Kebayoran Baru, Jakarta Selatan</p>
        </div>

        <div className="max-w-[300px] mx-auto text-center space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-800">TIKET ANTRIAN PASIEN</p>
          
          <div className="py-2 my-1 border-y-2 border-black">
            <p className="text-3xl font-black tracking-tight">{patient?.queueNumber ? patient.queueNumber : (patient ? patient.patientName : 'ANTRIAN IRM')}</p>
          </div>

          {patient && (
            <div className="text-left text-[11px] space-y-1 py-1 border-b border-dashed border-black">
              <p><strong>Nama:</strong> {patient.patientName}</p>
              <p><strong>No. RM:</strong> {patient.medicalRecordNo}</p>
              {patient.queueNumber && <p><strong>No. Antrean:</strong> {patient.queueNumber}</p>}
              {patient.actionCode && <p><strong>Tindakan:</strong> {patient.actionCode}</p>}
              <p><strong>Tujuan:</strong> {activeBox?.title || 'Poli IRM'}</p>
              <p><strong>Petugas:</strong> {activeBox?.officerName || '-'}</p>
            </div>
          )}

          {qrDataUrl && (
            <div className="py-2 flex flex-col items-center">
              <img src={qrDataUrl} alt="QR Code" className="w-36 h-36 mx-auto" />
              <p className="text-[9px] font-bold mt-1">Scan QR Code di atas atau buka {APP_MOBILE_DOMAIN}</p>
              <p className="text-[8px] text-gray-700">Pantau antrean & dapatkan notifikasi panggilan di smartphone</p>
            </div>
          )}

          <div className="text-[9px] border-t border-dashed border-black pt-2 text-gray-800 space-y-0.5">
            <p>Waktu Cetak: {nowFormatted}</p>
            <p className="italic">Mohon simpan struk ini & perhatikan layar panggilan.</p>
            <p className="font-bold pt-1">Terima Kasih atas Kepercayaan Anda</p>
          </div>
        </div>
      </div>
    </div>
  );
};
