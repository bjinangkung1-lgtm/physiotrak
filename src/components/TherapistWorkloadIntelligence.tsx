import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Volume2, 
  VolumeX, 
  CheckCircle2, 
  Clock, 
  Activity, 
  ShieldAlert, 
  X, 
  Filter, 
  BarChart3,
  Flame,
  Zap
} from 'lucide-react';
import { QueueBox, PatientItem } from '../types';
import { playChimeSound } from '../utils/audio';
import { calculatePatientTimeMetrics, formatMinutes } from '../utils/responseTimeAnalytics';

export interface TherapistWorkloadStats {
  boxId: string;
  boxTitle: string;
  officerName: string;
  location: string;
  color: string;
  activePatients: PatientItem[];
  completedPatients: PatientItem[];
  totalPatients: PatientItem[];
  activeCount: number;
  completedCount: number;
  warningCount: number;
  ranapCount: number;
  isOverloaded: boolean; // activeCount > 5
  loadStatus: 'overload' | 'busy' | 'optimal' | 'available';
  loadPercentage: number;
  estimatedWaitMinutes: number;
  avgResponseMinutes: number;
  topProcedures: { code: string; count: number }[];
}

interface TherapistWorkloadIntelligenceProps {
  boxes: QueueBox[];
  patients: PatientItem[];
  onSelectBoxFilter?: (boxTitleOrId: string) => void;
  onCallNextInBox?: (box: QueueBox) => void;
  onOpenAddPatientToBox?: (boxId: string) => void;
}

export const TherapistWorkloadIntelligence: React.FC<TherapistWorkloadIntelligenceProps> = ({
  boxes,
  patients,
  onSelectBoxFilter,
  onCallNextInBox,
  onOpenAddPatientToBox,
}) => {
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isAlertDismissed, setIsAlertDismissed] = useState(false);
  const [audioAlertEnabled, setAudioAlertEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('antrian_overload_audio_alert');
    return saved !== null ? saved === 'true' : true;
  });

  // Therapist boxes only (excluding Tim Transport Ranap / Jemputan Ranap)
  const therapistBoxes = boxes.filter(
    (b) =>
      b.id !== 'box-jemputan' &&
      !b.id.toLowerCase().includes('jemputan') &&
      !b.id.toLowerCase().includes('transport') &&
      !b.title.toLowerCase().includes('jemputan') &&
      !b.title.toLowerCase().includes('transport') &&
      !b.officerName?.toLowerCase().includes('transport') &&
      !b.officerName?.toLowerCase().includes('jemputan')
  );

  // Calculate stats per therapist / box
  const therapistStats: TherapistWorkloadStats[] = therapistBoxes.map((box) => {
    const boxPatients = patients.filter((p) => p.boxId === box.id);
    const active = boxPatients.filter((p) => !p.completed);
    const completed = boxPatients.filter((p) => p.completed);
    const warnings = boxPatients.filter((p) => p.isWarning);
    const ranap = boxPatients.filter((p) => p.isRanap);

    // Procedure breakdown
    const procMap: Record<string, number> = {};
    boxPatients.forEach((p) => {
      if (p.actionCode && p.actionCode.trim()) {
        const code = p.actionCode.trim();
        procMap[code] = (procMap[code] || 0) + 1;
      }
    });
    const topProcedures = Object.entries(procMap)
      .map(([code, count]) => ({ code, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);

    const activeCount = active.length;
    const isOverloaded = activeCount > 5;
    let loadStatus: 'overload' | 'busy' | 'optimal' | 'available' = 'optimal';
    if (isOverloaded) loadStatus = 'overload';
    else if (activeCount >= 4) loadStatus = 'busy';
    else if (activeCount >= 1) loadStatus = 'optimal';
    else loadStatus = 'available';

    // Calculate actual response times (input to checkoff) for this box
    const boxMetrics = boxPatients.map((p) => calculatePatientTimeMetrics(p, [box]));
    const responseList = boxMetrics.map((m) => m.responseTimeMinutes);
    const avgResponseMinutes = responseList.length > 0 ? Math.round(responseList.reduce((a, b) => a + b, 0) / responseList.length) : 0;

    // Approx 15 min per patient
    const estimatedWaitMinutes = activeCount * 15;
    const loadPercentage = Math.min(100, Math.round((activeCount / 6) * 100));

    return {
      boxId: box.id,
      boxTitle: box.title,
      officerName: box.officerName || box.title,
      location: box.location,
      color: box.color,
      activePatients: active,
      completedPatients: completed,
      totalPatients: boxPatients,
      activeCount,
      completedCount: completed.length,
      warningCount: warnings.length,
      ranapCount: ranap.length,
      isOverloaded,
      loadStatus,
      loadPercentage,
      estimatedWaitMinutes,
      avgResponseMinutes,
      topProcedures,
    };
  });

  const overloadedTherapists = therapistStats.filter((t) => t.isOverloaded);
  const totalActive = patients.filter((p) => !p.completed).length;
  const totalCompleted = patients.filter((p) => p.completed).length;
  const totalTherapists = boxes.length;
  const avgPatientsPerTherapist = totalTherapists > 0 ? (totalActive / totalTherapists).toFixed(1) : '0';

  // Trigger audio alert when overload is first detected
  const prevOverloadCountRef = React.useRef(0);
  useEffect(() => {
    if (overloadedTherapists.length > prevOverloadCountRef.current && audioAlertEnabled) {
      playChimeSound('overload');
    }
    prevOverloadCountRef.current = overloadedTherapists.length;
  }, [overloadedTherapists.length, audioAlertEnabled]);

  const toggleAudioAlert = () => {
    const next = !audioAlertEnabled;
    setAudioAlertEnabled(next);
    localStorage.setItem('antrian_overload_audio_alert', String(next));
    if (next) {
      playChimeSound('warning');
    }
  };

  return (
    <div className="space-y-4">
      {/* 🔴 CRITICAL OVERLOAD ALERT BANNER (> 5 PASIEN) */}
      {overloadedTherapists.length > 0 && !isAlertDismissed && (
        <div className="relative overflow-hidden bg-gradient-to-r from-rose-700 via-rose-600 to-amber-600 text-white rounded-2xl shadow-xl border-2 border-rose-400 p-4 sm:p-5 animate-in slide-in-from-top-4 duration-300">
          <div className="absolute inset-0 bg-rose-500/20 animate-pulse pointer-events-none" />
          
          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-white shrink-0 shadow-md ring-4 ring-white/30 animate-bounce">
                <ShieldAlert className="w-7 h-7 text-white" />
              </div>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="bg-white text-rose-800 text-[11px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-xs">
                    ⚠️ Peringatan Penumpukan Antrean &gt; 5 Pasien
                  </span>
                  <span className="text-xs bg-black/20 text-white/90 px-2 py-0.5 rounded-md font-bold">
                    {overloadedTherapists.length} Terapis Mengalami Antrean Padat
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-black tracking-tight text-white drop-shadow-xs">
                  {overloadedTherapists.map((t) => `${t.officerName} (${t.activeCount} Pasien Menunggu)`).join(', ')}
                </h3>
                <p className="text-xs text-rose-100 font-medium max-w-2xl leading-relaxed">
                  Beban kerja terapis di atas telah melampaui batas optimal (5 pasien). Harap prioritaskan penanganan atau panggil pasien nomor urut berikutnya.
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-2 self-stretch md:self-auto justify-end">
              <button
                type="button"
                onClick={toggleAudioAlert}
                className={`p-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  audioAlertEnabled 
                    ? 'bg-amber-400 text-slate-950 hover:bg-amber-300 shadow-sm' 
                    : 'bg-white/20 text-white hover:bg-white/30'
                }`}
                title={audioAlertEnabled ? 'Alarm Audio Aktif (Klik untuk mute)' : 'Alarm Audio Nonaktif (Klik untuk aktifkan)'}
              >
                {audioAlertEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                <span className="hidden sm:inline">{audioAlertEnabled ? 'Alarm Aktif' : 'Mute'}</span>
              </button>

              <button
                type="button"
                onClick={() => setIsDetailModalOpen(true)}
                className="px-4 py-2.5 bg-white hover:bg-slate-100 text-rose-900 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-md hover:shadow-lg transition-all cursor-pointer"
              >
                <BarChart3 className="w-4 h-4 text-rose-700" />
                <span>Lihat Analisis Lengkap 📊</span>
              </button>

              <button
                type="button"
                onClick={() => setIsAlertDismissed(true)}
                className="p-2 rounded-xl text-white/80 hover:text-white hover:bg-black/20 transition-all cursor-pointer"
                title="Tutup banner peringatan sementara"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 📊 REAL-TIME THERAPIST WORKLOAD BAR (COMPACT INTELLIGENCE STRIP) */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-xs">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-extrabold text-slate-800 tracking-tight">
                  Analisis Beban Kerja Terapis &amp; Estimasi Ruangan
                </h3>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 border border-teal-200 uppercase">
                  Real-Time Monitor
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Pemantauan kapasitas antrean terapis: optimal (1-3), padat (4-5), dan penumpukan kritis (&gt;5 pasien).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsDetailModalOpen(true)}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-1.5 border border-slate-300 transition-all cursor-pointer"
            >
              <BarChart3 className="w-3.5 h-3.5 text-teal-600" />
              <span>Detail Analitik Lengkap</span>
            </button>
          </div>
        </div>

        {/* Therapist Workload Pills Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {therapistStats.map((t) => {
            const isOver = t.isOverloaded;
            const isBusy = t.loadStatus === 'busy';
            const isAvailable = t.loadStatus === 'available';

            return (
              <div
                key={t.boxId}
                className={`relative p-3.5 rounded-xl border transition-all shadow-2xs hover:shadow-sm ${
                  isOver 
                    ? 'bg-rose-50/80 border-rose-300 ring-2 ring-rose-500/40' 
                    : isBusy
                    ? 'bg-amber-50/70 border-amber-300'
                    : isAvailable
                    ? 'bg-sky-50/60 border-sky-200'
                    : 'bg-slate-50/80 border-slate-200'
                }`}
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-1">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-black truncate text-slate-800" title={t.officerName}>
                      {t.officerName}
                    </p>
                    <p className="text-[10px] text-slate-500 truncate" title={t.location}>
                      {t.location || t.boxTitle}
                    </p>
                  </div>
                  <span
                    className={`px-2 py-0.5 text-[10px] font-black rounded-md uppercase tracking-wider shrink-0 ${
                      isOver
                        ? 'bg-rose-600 text-white animate-pulse'
                        : isBusy
                        ? 'bg-amber-200 text-amber-900'
                        : isAvailable
                        ? 'bg-sky-200 text-sky-900'
                        : 'bg-emerald-200 text-emerald-900'
                    }`}
                  >
                    {isOver ? '⚠️ Overload (>5)' : isBusy ? 'Padat (4-5)' : isAvailable ? 'Luang (0)' : 'Lancar'}
                  </span>
                </div>

                {/* Patient Counter Bar */}
                <div className="mt-2.5 space-y-1">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-slate-600 text-[11px]">Antrean Aktif:</span>
                    <span className={`font-mono text-sm font-black ${isOver ? 'text-rose-700' : 'text-slate-800'}`}>
                      {t.activeCount} Pasien
                    </span>
                  </div>

                  {/* Visual Load Progress Bar */}
                  <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isOver
                          ? 'bg-rose-600'
                          : isBusy
                          ? 'bg-amber-500'
                          : isAvailable
                          ? 'bg-slate-300'
                          : 'bg-teal-500'
                      }`}
                      style={{ width: `${Math.max(8, t.loadPercentage)}%` }}
                    />
                  </div>
                </div>

                {/* Sub info */}
                <div className="mt-2 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[10px] text-slate-500">
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    <span>Selesai: <strong>{t.completedCount}</strong></span>
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span>Est: ~<strong>{t.estimatedWaitMinutes}m</strong></span>
                  </span>
                </div>

                {/* Action buttons on card */}
                {onSelectBoxFilter && (
                  <button
                    type="button"
                    onClick={() => onSelectBoxFilter(t.boxTitle)}
                    className="mt-2 w-full py-1 text-center text-[10px] font-bold text-slate-600 hover:text-teal-700 hover:bg-white rounded border border-slate-200 transition-all cursor-pointer flex items-center justify-center gap-1"
                  >
                    <Filter className="w-2.5 h-2.5" />
                    <span>Fokuskan Terapis Ini</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 📋 COMPREHENSIVE INTELLIGENCE MODAL */}
      {isDetailModalOpen && (
        <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-slate-900 via-teal-950 to-slate-900 text-white p-5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-teal-600 text-white flex items-center justify-center shadow-lg font-black">
                  <Activity className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-black tracking-tight flex items-center gap-2">
                    Pusat Analisis &amp; Intelijen Beban Kerja Terapis
                    <span className="text-[10px] bg-amber-400 text-slate-950 px-2 py-0.5 rounded-full font-black uppercase">
                      Statistik &amp; Antrean
                    </span>
                  </h2>
                  <p className="text-xs text-teal-200">
                    Sistem pemantauan produktivitas harian, waktu tunggu rata-rata, dan deteksi penumpukan pasien.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsDetailModalOpen(false)}
                className="text-white/80 hover:text-white p-1.5 rounded-xl hover:bg-white/10 transition-all cursor-pointer"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-slate-50/50">
              {/* Summary KPIs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Antrean Aktif Saat Ini</p>
                  <p className="text-2xl font-black text-blue-700 mt-1">{totalActive}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Pasien menunggu giliran</p>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Terapis Overload (&gt;5)</p>
                  <p className={`text-2xl font-black mt-1 ${overloadedTherapists.length > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {overloadedTherapists.length}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {overloadedTherapists.length > 0 ? 'Perlu percepatan pelayanan' : 'Semua terapis optimal'}
                  </p>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Pasien Selesai Hari Ini</p>
                  <p className="text-2xl font-black text-emerald-600 mt-1">{totalCompleted}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Total tindakan tuntas</p>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Rata-rata Beban</p>
                  <p className="text-2xl font-black text-slate-800 mt-1">{avgPatientsPerTherapist}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Pasien per terapis</p>
                </div>
              </div>

              {/* Detailed Breakdown Table */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <h3 className="font-extrabold text-sm text-slate-800 flex items-center gap-2">
                    <Users className="w-4 h-4 text-teal-600" />
                    Status Beban Kerja Lengkap Per Terapis
                  </h3>
                  <span className="text-xs text-slate-500 font-medium">
                    Total {therapistStats.length} Terapis / Ruangan
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                      <tr>
                        <th className="p-3">Terapis / Ruangan</th>
                        <th className="p-3 text-center">Status Beban</th>
                        <th className="p-3 text-center">Antrean Aktif</th>
                        <th className="p-3 text-center">Selesai</th>
                        <th className="p-3 text-center">Avg Respon Time</th>
                        <th className="p-3 text-center">Warning 🛑</th>
                        <th className="p-3">Tindakan Terbanyak</th>
                        <th className="p-3 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {therapistStats.map((t) => (
                        <tr key={t.boxId} className={t.isOverloaded ? 'bg-rose-50/60' : 'hover:bg-slate-50'}>
                          <td className="p-3 font-semibold text-slate-900">
                            <div>
                              <p className="font-bold text-slate-900">{t.officerName}</p>
                              <p className="text-[10px] text-slate-500">{t.location || t.boxTitle}</p>
                            </div>
                          </td>

                          <td className="p-3 text-center">
                            <span
                              className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                t.isOverloaded
                                  ? 'bg-rose-600 text-white animate-pulse'
                                  : t.loadStatus === 'busy'
                                  ? 'bg-amber-100 text-amber-800'
                                  : t.loadStatus === 'available'
                                  ? 'bg-sky-100 text-sky-800'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {t.isOverloaded ? '⚠️ Overload (>5)' : t.loadStatus === 'busy' ? 'Padat' : t.loadStatus === 'available' ? 'Luang' : 'Optimal'}
                            </span>
                          </td>

                          <td className="p-3 text-center">
                            <span className={`font-mono text-sm font-black ${t.isOverloaded ? 'text-rose-700' : 'text-slate-800'}`}>
                              {t.activeCount}
                            </span>
                          </td>

                          <td className="p-3 text-center font-semibold text-emerald-700">
                            {t.completedCount}
                          </td>

                          <td className="p-3 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded font-mono font-bold ${
                              t.avgResponseMinutes > 30 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-800'
                            }`}>
                              {t.avgResponseMinutes} mnt
                            </span>
                          </td>

                          <td className="p-3 text-center">
                            {t.warningCount > 0 ? (
                              <span className="px-2 py-0.5 bg-rose-100 text-rose-800 font-bold rounded-md text-[10px]">
                                {t.warningCount} Pasien
                              </span>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>

                          <td className="p-3">
                            <div className="flex flex-wrap gap-1">
                              {t.topProcedures.length > 0 ? (
                                t.topProcedures.map((proc) => (
                                  <span
                                    key={proc.code}
                                    className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-medium border border-slate-200"
                                  >
                                    {proc.code} ({proc.count})
                                  </span>
                                ))
                              ) : (
                                <span className="text-slate-400 text-[10px] italic">Belum ada</span>
                              )}
                            </div>
                          </td>

                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {onSelectBoxFilter && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    onSelectBoxFilter(t.boxTitle);
                                    setIsDetailModalOpen(false);
                                  }}
                                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-bold cursor-pointer transition-all"
                                >
                                  Fokus
                                </button>
                              )}
                              {onOpenAddPatientToBox && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    onOpenAddPatientToBox(t.boxId);
                                    setIsDetailModalOpen(false);
                                  }}
                                  className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-[11px] font-bold cursor-pointer transition-all"
                                >
                                  + Pasien
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
                <span>Overload: &gt; 5 Pasien</span>
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block ml-2" />
                <span>Padat: 4-5 Pasien</span>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block ml-2" />
                <span>Optimal: 1-3 Pasien</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsDetailModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Tutup Analisis
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
