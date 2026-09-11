import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Monitor, 
  Sparkles, 
  Building2, 
  Maximize, 
  Minimize, 
  Copy, 
  Check, 
  Radio, 
  ExternalLink,
  Clock,
  User,
  MapPin,
  Stethoscope,
  Activity,
  CheckCircle2,
  Tv,
  Eye,
  EyeOff,
  Sliders,
  Expand
} from 'lucide-react';
import { PatientItem, QueueBox, CallHistoryRecord } from '../types';

interface QueueDisplayModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentCallingPatient: PatientItem | null;
  currentCallingBox: QueueBox | null;
  boxes: QueueBox[];
  patients: PatientItem[];
  callLogs?: CallHistoryRecord[];
}

interface DisplayCallItem {
  id: string;
  patientId: string;
  patientName: string;
  medicalRecordNo: string;
  queueNumber: string;
  boxId: string;
  boxTitle: string;
  location: string;
  officerName: string;
  actionCode?: string;
  diagnosis?: string;
  isWarning?: boolean;
  isRanap?: boolean;
  calledAt: string;
  timeFormatted: string;
  isLatest: boolean;
  slotIndex: number;
}

export const QueueDisplayModal: React.FC<QueueDisplayModalProps> = ({
  isOpen,
  onClose,
  currentCallingPatient,
  currentCallingBox,
  boxes,
  patients,
  callLogs = [],
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPureTvMode, setIsPureTvMode] = useState(false); // Mode TV Murni (kotak maksimal penuh layar)
  const [copiedLink, setCopiedLink] = useState(false);
  const [currentTime, setCurrentTime] = useState<string>('');
  const [currentDate, setCurrentDate] = useState<string>('');
  const [showNotificationToast, setShowNotificationToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setShowNotificationToast(true);
    setTimeout(() => setShowNotificationToast(false), 3500);
  };

  // Live digital clock updater
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }) + ' WIB'
      );
      setCurrentDate(
        now.toLocaleDateString('id-ID', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Listen for fullscreen change
  useEffect(() => {
    const handleFullscreenChange = () => {
      const fsActive = !!document.fullscreenElement;
      setIsFullscreen(fsActive);
      if (fsActive) {
        showToast('✓ Layar Penuh TV Aktif (Tekan F / Esc untuk keluar)');
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Keyboard shortcut listener ('F' or 'F11' for fullscreen, 'M' for pure TV mode)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        setIsPureTvMode(prev => !prev);
      } else if (e.key === 'Escape' && isFullscreen) {
        if (document.fullscreenElement && document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isFullscreen]);

  if (!isOpen) return null;

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      const elem = containerRef.current || document.documentElement;
      if (elem.requestFullscreen) {
        elem.requestFullscreen().catch((err) => {
          console.warn('Fullscreen request failed:', err);
          setIsFullscreen(true); // fallback
        });
      } else if ((elem as any).webkitRequestFullscreen) {
        (elem as any).webkitRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch((err) => console.warn(err));
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen();
      }
    }
  };

  const handleCopyTvLink = () => {
    const tvUrl = `${window.location.origin}${window.location.pathname}?mode=tv`;
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(tvUrl).then(() => {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 3000);
      }).catch(() => {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 3000);
      });
    } else {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 3000);
    }
  };

  const handleOpenTvNewTab = () => {
    const tvUrl = `${window.location.origin}${window.location.pathname}?mode=tv`;
    window.open(tvUrl, '_blank');
  };

  // Assemble the 6 most recent patient calls
  const getRecentSixCalls = (): DisplayCallItem[] => {
    const results: DisplayCallItem[] = [];
    const seenIds = new Set<string>();

    // 1. If there's an active caller right now, inject it first
    if (currentCallingPatient && currentCallingBox) {
      const callTime = currentCallingPatient.lastCalledAt || new Date().toISOString();
      const timeDate = new Date(callTime);
      const timeStr = !isNaN(timeDate.getTime())
        ? timeDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        : 'Baru Saja';

      results.push({
        id: `current_${currentCallingPatient.id}`,
        patientId: currentCallingPatient.id,
        patientName: currentCallingPatient.patientName,
        medicalRecordNo: currentCallingPatient.medicalRecordNo,
        queueNumber: currentCallingPatient.queueNumber || '1',
        boxId: currentCallingBox.id,
        boxTitle: currentCallingBox.title.split('(')[0].trim(),
        location: currentCallingBox.location || 'Poli Rehabilitasi Medis',
        officerName: currentCallingBox.officerName || 'Petugas IRM',
        actionCode: currentCallingPatient.actionCode,
        diagnosis: currentCallingPatient.diagnosis,
        isWarning: currentCallingPatient.isWarning,
        isRanap: currentCallingPatient.isRanap,
        calledAt: callTime,
        timeFormatted: timeStr,
        isLatest: true,
        slotIndex: 1,
      });
      seenIds.add(currentCallingPatient.id);
    }

    // 2. Scan call logs sorted newest first
    const sortedLogs = [...callLogs]
      .filter((log) => log.status === 'called' || log.status === 'recalled')
      .sort((a, b) => new Date(b.calledAt || 0).getTime() - new Date(a.calledAt || 0).getTime());

    for (const log of sortedLogs) {
      if (results.length >= 6) break;
      if (seenIds.has(log.patientId)) continue;

      const matchedBox = boxes.find((b) => b.id === log.boxId);
      const matchedPatient = patients.find((p) => p.id === log.patientId);

      const timeDate = new Date(log.calledAt);
      const timeStr = !isNaN(timeDate.getTime())
        ? timeDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        : '-';

      results.push({
        id: `log_${log.id}`,
        patientId: log.patientId,
        patientName: log.patientName,
        medicalRecordNo: log.medicalRecordNo,
        queueNumber: log.queueNumber || '1',
        boxId: log.boxId,
        boxTitle: (matchedBox?.title.split('(')[0] || log.boxTitle || 'Kotak Antrean').trim(),
        location: matchedBox?.location || 'Poli Rehabilitasi Medis',
        officerName: matchedBox?.officerName || log.officerName || 'Petugas IRM',
        actionCode: matchedPatient?.actionCode,
        diagnosis: matchedPatient?.diagnosis,
        isWarning: matchedPatient?.isWarning,
        isRanap: matchedPatient?.isRanap,
        calledAt: log.calledAt,
        timeFormatted: timeStr,
        isLatest: results.length === 0,
        slotIndex: results.length + 1,
      });
      seenIds.add(log.patientId);
    }

    // 3. If we still have fewer than 6, scan called patients directly
    if (results.length < 6) {
      const calledPatients = [...patients]
        .filter((p) => (p.calledCount > 0 || p.lastCalledAt) && !seenIds.has(p.id))
        .sort((a, b) => new Date(b.lastCalledAt || 0).getTime() - new Date(a.lastCalledAt || 0).getTime());

      for (const p of calledPatients) {
        if (results.length >= 6) break;

        const matchedBox = boxes.find((b) => b.id === p.boxId);
        const timeDate = p.lastCalledAt ? new Date(p.lastCalledAt) : null;
        const timeStr = timeDate && !isNaN(timeDate.getTime())
          ? timeDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
          : '-';

        results.push({
          id: `patient_${p.id}`,
          patientId: p.id,
          patientName: p.patientName,
          medicalRecordNo: p.medicalRecordNo,
          queueNumber: p.queueNumber || '1',
          boxId: p.boxId,
          boxTitle: (matchedBox?.title.split('(')[0] || 'Kotak Antrean').trim(),
          location: matchedBox?.location || 'Poli Rehabilitasi Medis',
          officerName: matchedBox?.officerName || 'Petugas IRM',
          actionCode: p.actionCode,
          diagnosis: p.diagnosis,
          isWarning: p.isWarning,
          isRanap: p.isRanap,
          calledAt: p.lastCalledAt || new Date().toISOString(),
          timeFormatted: timeStr,
          isLatest: results.length === 0,
          slotIndex: results.length + 1,
        });
        seenIds.add(p.id);
      }
    }

    return results;
  };

  const sixCalls = getRecentSixCalls();
  const latestCall = sixCalls[0] || null;

  // Prepare exactly 6 slots array (fill missing slots with null for standby cards)
  const displaySlots: (DisplayCallItem | null)[] = Array.from({ length: 6 }, (_, index) => {
    return sixCalls[index] || null;
  });

  return (
    <div 
      ref={containerRef}
      id="tv-display-monitor-container"
      onDoubleClick={toggleFullscreen}
      className={`fixed inset-0 z-50 bg-slate-950 text-white flex flex-col justify-between overflow-hidden select-none transition-all duration-300 ${
        isFullscreen ? 'p-0' : ''
      }`}
    >
      {/* Toast Notification Alert for TV mode */}
      {showNotificationToast && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 text-teal-200 border-2 border-teal-500/80 px-4 py-2 rounded-2xl shadow-2xl backdrop-blur-md text-xs sm:text-sm font-bold flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <Sparkles className="w-4 h-4 text-teal-400 animate-spin" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Floating Controls in Pure TV / Fullscreen Mode */}
      {isPureTvMode && (
        <div className="absolute top-3 right-3 z-50 flex items-center gap-2 bg-slate-900/80 hover:bg-slate-900 p-1.5 rounded-2xl border border-slate-700/80 shadow-2xl backdrop-blur-md transition-opacity opacity-40 hover:opacity-100">
          <button
            onClick={() => setIsPureTvMode(false)}
            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-teal-300 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
            title="Tampilkan Header & Bar TV"
          >
            <Eye className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Tampilkan Bar</span>
          </button>
          <button
            onClick={toggleFullscreen}
            className="p-1.5 bg-amber-500/20 hover:bg-amber-500/40 text-amber-300 rounded-xl text-xs font-bold cursor-pointer"
            title="Keluar Full Screen"
          >
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </button>
          <button
            onClick={onClose}
            className="p-1.5 bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 rounded-xl cursor-pointer"
            title="Tutup Display TV"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Header Bar */}
      {!isPureTvMode && (
        <header className="bg-slate-900 border-b border-slate-800 px-3 sm:px-4 md:px-6 py-2 md:py-2.5 flex flex-wrap items-center justify-between gap-2 md:gap-3 shrink-0 shadow-lg">
          {/* Left Branding & Live Clock */}
          <div className="flex items-center gap-2.5 md:gap-3.5">
            <div className="relative group shrink-0">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-teal-400 to-emerald-500 rounded-2xl blur-xs opacity-75 animate-pulse"></div>
              <div className="relative w-9 h-9 md:w-11 md:h-11 bg-slate-900 border border-teal-400/40 rounded-2xl flex items-center justify-center text-teal-300 shadow-md">
                <Activity className="w-5 h-5 md:w-6 md:h-6 text-teal-300" />
              </div>
            </div>

            <div>
              <div className="flex items-center gap-1.5 md:gap-2 flex-wrap">
                <h1 className="text-sm sm:text-base md:text-lg lg:text-xl font-black tracking-tight text-white flex items-center gap-1.5 sm:gap-2">
                  <span>Smart IRM RSPP</span>
                  <span className="text-[9px] sm:text-[10px] md:text-xs font-black bg-teal-950 text-teal-300 border border-teal-700/80 px-2 py-0.5 rounded-md uppercase tracking-wider">
                    DISPLAY MONITOR • 6 PANGGILAN
                  </span>
                </h1>
                <span className="hidden sm:inline-flex items-center gap-1.5 bg-emerald-950/90 text-emerald-300 border border-emerald-700 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase">
                  <Radio className="w-3 h-3 text-emerald-400 animate-ping" />
                  <span>Live Sync</span>
                </span>
              </div>
              <p className="text-[11px] md:text-xs text-teal-400 font-semibold flex items-center gap-1.5 mt-0.5">
                <Building2 className="w-3.5 h-3.5" />
                <span>Instalasi Rehabilitasi Medis & Terapi RSPP</span>
              </p>
            </div>
          </div>

          {/* Center Live Clock (Visible on md+) */}
          <div className="hidden lg:flex items-center gap-3 bg-slate-950/80 border border-slate-800 px-3.5 py-1.5 rounded-2xl shadow-inner">
            <Clock className="w-4 h-4 text-amber-400 animate-pulse" />
            <div className="text-right">
              <div className="text-[11px] font-bold text-slate-300 leading-tight">
                {currentDate}
              </div>
              <div className="text-xs md:text-sm font-black font-mono text-amber-300 tracking-wider">
                {currentTime}
              </div>
            </div>
          </div>

          {/* Right Action Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            {/* Dedicated Primary Fullscreen 6-Box TV Button */}
            <button
              onClick={toggleFullscreen}
              id="btn-fullscreen-6-boxes"
              className={`flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 font-black rounded-xl text-xs transition-all cursor-pointer shadow-md border ${
                isFullscreen
                  ? 'bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 border-amber-300 ring-2 ring-amber-300/60'
                  : 'bg-gradient-to-r from-amber-500 via-amber-400 to-orange-500 hover:from-amber-400 hover:to-orange-400 active:from-amber-600 active:to-orange-600 text-slate-950 border-amber-200 shadow-amber-950/50'
              }`}
              title={isFullscreen ? 'Keluar Layar Penuh (Esc / F)' : 'Full Screen 6 Kotak Optimal TV (F / F11)'}
            >
              <Tv className="w-4 h-4 shrink-0" />
              <span>{isFullscreen ? 'Keluar Full Screen' : 'Full Screen TV 6 Kotak'}</span>
            </button>

            {/* Pure TV Mode Toggle (Hide Header for 100% Box Scale) */}
            <button
              onClick={() => {
                setIsPureTvMode(prev => !prev);
                showToast(isPureTvMode ? 'Header ditampilkan' : 'Mode TV Murni: 6 Kotak Maksimal Layar');
              }}
              id="btn-toggle-pure-tv"
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                isPureTvMode
                  ? 'bg-teal-600 text-white border-teal-400'
                  : 'bg-slate-800 hover:bg-slate-700 text-teal-300 border-slate-700'
              }`}
              title="Sembunyikan/Tampilkan Header untuk ruang kotak panggilan maksimal (Tekan M)"
            >
              {isPureTvMode ? <Eye className="w-3.5 h-3.5" /> : <Expand className="w-3.5 h-3.5" />}
              <span className="hidden xl:inline">{isPureTvMode ? 'Header Aktif' : 'Fokus Layar'}</span>
            </button>

            <button
              onClick={handleCopyTvLink}
              id="btn-copy-tv-url"
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-teal-300 font-bold rounded-xl text-xs transition-all cursor-pointer border border-slate-700"
              title="Salin tautan mode TV untuk dibuka di browser Smart TV, Tablet, atau HP lain"
            >
              {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-teal-400" />}
              <span className="hidden md:inline">{copiedLink ? 'Tersalin!' : 'Salin Link TV'}</span>
            </button>

            <button
              onClick={handleOpenTvNewTab}
              id="btn-open-tv-tab"
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-all cursor-pointer hidden sm:flex items-center justify-center border border-slate-700"
              title="Buka Mode TV di Tab Baru"
            >
              <ExternalLink className="w-4 h-4" />
            </button>

            <button
              onClick={onClose}
              id="btn-close-tv-display"
              className="p-2 text-slate-400 hover:text-white bg-slate-800 rounded-xl hover:bg-slate-700 transition-all cursor-pointer border border-slate-700"
              title="Tutup Display TV (Kembali ke Dashboard)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>
      )}

      {/* Main 6 Equal-Sized Boxes Grid Container - Optimized to Fit TV Screen Height Exactly */}
      <main className={`flex-1 overflow-hidden flex flex-col min-h-0 ${
        isPureTvMode ? 'p-2 sm:p-3 md:p-4' : 'p-2.5 sm:p-3 md:p-4 lg:p-4.5'
      }`}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 grid-rows-6 sm:grid-rows-3 lg:grid-rows-2 gap-2 sm:gap-3 md:gap-3.5 lg:gap-4 flex-1 min-h-0 h-full">
          {displaySlots.map((item, index) => {
            const slotNumber = index + 1;
            const isFirst = index === 0;

            // Slot with Active Call Data
            if (item) {
              return (
                <div
                  key={item.id || `slot_${slotNumber}`}
                  id={`queue-display-box-${slotNumber}`}
                  className={`relative rounded-2xl md:rounded-3xl p-3 sm:p-3.5 md:p-4 lg:p-4.5 flex flex-col justify-between overflow-hidden transition-all duration-300 h-full min-h-0 ${
                    isFirst
                      ? 'bg-gradient-to-br from-slate-900 via-teal-950/70 to-slate-900 border-2 border-emerald-400 shadow-[0_0_30px_rgba(52,211,153,0.3)] ring-2 ring-emerald-400/40'
                      : 'bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 hover:border-slate-700 shadow-xl'
                  }`}
                >
                  {/* Subtle Background Accent for First Box */}
                  {isFirst && (
                    <div className="absolute -right-12 -top-12 w-44 h-44 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none animate-pulse" />
                  )}

                  {/* Top Bar inside Box: Status Badge + Call Order + Time */}
                  <div className="flex items-center justify-between gap-1.5 shrink-0 mb-1 sm:mb-1.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {isFirst ? (
                        <span className="px-2.5 py-0.5 sm:py-1 bg-emerald-500/25 text-emerald-300 border border-emerald-400/80 font-black text-[11px] sm:text-xs md:text-sm rounded-full flex items-center gap-1.5 animate-pulse shadow-sm">
                          <Sparkles className="w-3.5 h-3.5 text-emerald-300" />
                          <span>PANGGILAN #1 (TERBARU)</span>
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 bg-slate-800 text-slate-300 border border-slate-700 font-extrabold text-[10px] sm:text-[11px] md:text-xs rounded-full flex items-center gap-1">
                          <span>PANGGILAN #{slotNumber}</span>
                        </span>
                      )}

                      {item.isWarning && (
                        <span className="px-2 py-0.5 bg-rose-950/90 text-rose-300 border border-rose-700 text-[10px] font-black rounded-md flex items-center gap-1">
                          <span>🛑 WARNING</span>
                        </span>
                      )}
                      {item.isRanap && (
                        <span className="px-2 py-0.5 bg-blue-950/90 text-blue-300 border border-blue-700 text-[10px] font-black rounded-md flex items-center gap-1">
                          <span>🛏️ RANAP</span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[10px] sm:text-[11px] md:text-xs font-mono font-bold text-slate-400 bg-slate-950/60 px-2 py-0.5 rounded-lg border border-slate-800">
                        {item.timeFormatted}
                      </span>
                    </div>
                  </div>

                  {/* Middle Section: Patient Name + RM (Auto-Sized for TV screen) */}
                  <div className="my-auto py-1 space-y-1 sm:space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="px-2.5 py-0.5 rounded-lg font-mono font-bold text-xs sm:text-sm md:text-base text-amber-300 bg-amber-950/80 border border-amber-500/50 shadow-xs">
                        NO. RM: {item.medicalRecordNo}
                      </div>
                    </div>

                    {/* High-Contrast TV-Scale Patient Name */}
                    <div className={`font-black tracking-tight line-clamp-1 break-words ${
                      isFirst 
                        ? 'text-xl sm:text-2xl md:text-3xl lg:text-3xl xl:text-4xl text-emerald-50 drop-shadow-md' 
                        : 'text-lg sm:text-xl md:text-2xl lg:text-2xl xl:text-3xl text-slate-100'
                    }`}>
                      {item.patientName}
                    </div>
                  </div>

                  {/* Bottom Section: Destination Counter / Officer Box */}
                  <div className={`mt-1 sm:mt-1.5 rounded-xl p-2 sm:p-2.5 flex items-center justify-between gap-2 border ${
                    isFirst 
                      ? 'bg-slate-900/95 border-emerald-500/50 shadow-inner' 
                      : 'bg-slate-900/70 border-slate-800'
                  }`}>
                    <div className="min-w-0 flex-1">
                      <span className="text-[9px] sm:text-[10px] md:text-[11px] font-black text-teal-400 uppercase tracking-wider block leading-none">
                        MENUJU KE RUANG / TERAPIS:
                      </span>
                      <span className="text-xs sm:text-sm md:text-base lg:text-lg font-black text-white truncate block mt-0.5">
                        {item.boxTitle}
                      </span>
                      <div className="flex items-center gap-2 text-[10px] sm:text-[11px] md:text-xs text-slate-300 font-medium truncate mt-0.5">
                        <span className="truncate flex items-center gap-1 text-slate-300">
                          <User className="w-3 h-3 text-teal-400 shrink-0" />
                          <span className="truncate">{item.officerName}</span>
                        </span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-[10px] sm:text-[11px] md:text-xs font-bold text-amber-300 flex items-center gap-1 justify-end bg-amber-950/50 px-2 py-1 rounded-lg border border-amber-600/40">
                        <MapPin className="w-3 h-3 text-amber-400" />
                        <span className="truncate max-w-[130px] md:max-w-[160px]">{item.location}</span>
                      </span>
                    </div>
                  </div>
                </div>
              );
            }

            // Standby Empty Slot (Maintains 6 Equal-Sized Symmetry on TV)
            return (
              <div
                key={`empty_slot_${slotNumber}`}
                id={`queue-display-box-standby-${slotNumber}`}
                className="relative rounded-2xl md:rounded-3xl p-3 sm:p-3.5 md:p-4 lg:p-4.5 flex flex-col justify-between overflow-hidden bg-slate-900/40 border-2 border-dashed border-slate-800/80 text-slate-600 transition-all h-full min-h-0 select-none"
              >
                {/* Header Badge */}
                <div className="flex items-center justify-between gap-2 shrink-0">
                  <span className="px-2.5 py-0.5 bg-slate-800/60 text-slate-400 border border-slate-700/60 font-extrabold text-[10px] sm:text-[11px] rounded-full">
                    KOTAK PANGGILAN #{slotNumber}
                  </span>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    STANDBY
                  </span>
                </div>

                {/* Standby Content */}
                <div className="my-auto py-1 sm:py-2 text-center flex flex-col items-center justify-center">
                  <div className="w-9 h-9 sm:w-11 sm:h-11 md:w-12 md:h-12 rounded-2xl bg-slate-850 border border-slate-800 flex items-center justify-center text-slate-600 mb-1.5 sm:mb-2">
                    <Monitor className="w-5 h-5 md:w-6 md:h-6" />
                  </div>
                  <div className="text-xs sm:text-sm md:text-base font-bold text-slate-400">
                    Menunggu Panggilan Pasien
                  </div>
                  <div className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5">
                    Slot panggilan #{slotNumber} siap menampilkan pasien
                  </div>
                </div>

                {/* Bottom Standby Info */}
                <div className="bg-slate-950/40 rounded-xl p-1.5 sm:p-2 border border-slate-850 flex items-center justify-between text-[10px] sm:text-[11px] text-slate-500">
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-slate-600" />
                    <span>Layanan IRM Aktif</span>
                  </span>
                  <span className="font-mono text-[10px] text-slate-600">RSPP</span>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Bottom Running Text Marquee Banner */}
      {!isPureTvMode && (
        <footer className="bg-gradient-to-r from-teal-900 via-emerald-950 to-teal-900 border-t border-teal-800/80 py-1.5 sm:py-2 md:py-2.5 px-3 sm:px-4 overflow-hidden text-xs font-bold text-teal-100 flex items-center gap-3 shrink-0 shadow-lg">
          <span className="bg-amber-400 text-slate-950 px-2 sm:px-2.5 py-0.5 rounded-md text-[10px] sm:text-xs uppercase font-black shrink-0 tracking-wider shadow-sm">
            INFORMASI PASIEN
          </span>
          <div className="whitespace-nowrap animate-marquee flex items-center gap-10 text-[11px] md:text-xs text-teal-100 font-semibold tracking-wide">
            <span>• MOHON PERHATIKAN NAMA DAN NOMOR REKAM MEDIS PADA MONITOR KETIKA DIPANGGIL</span>
            <span>• SILAKAN LANGSUNG MENUJU KE RUANG / KOTAK TERAPIS YANG TERTERA</span>
            <span>• PASTIKAN KARTU IDENTITAS DAN BERKAS BPJS TELAH DISIAPKAN DENGAN LENGKAP</span>
            <span>• APABILA MEMBUTUHKAN BANTUAN SILAKAN MENGHUBUNGI PETUGAS DI LOKET UTAMA IRM</span>
            <span>• TERIMA KASIH ATAS KERJASAMA DAN KETERTIBAN BAPAK/IBU DI INSTALASI REHABILITASI MEDIS RSPP</span>
          </div>
        </footer>
      )}
    </div>
  );
};
