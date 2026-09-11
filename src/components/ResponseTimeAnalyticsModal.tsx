import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Clock,
  Timer,
  Activity,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Download,
  Users,
  Search,
  Filter,
  Volume2,
  TrendingUp,
  Award,
  Zap,
  Flame,
  ArrowUpDown,
  Calendar,
  RefreshCw,
  ShieldCheck,
  Check,
  Layers,
  Sparkles
} from 'lucide-react';
import { QueueBox, PatientItem, CallHistoryRecord, DailyPatientVisit, BoxColor } from '../types';
import {
  computeResponseTimeAnalytics,
  formatMinutes,
  calculatePatientTimeMetrics,
  PatientTimeMetrics
} from '../utils/responseTimeAnalytics';
import { getLocalDateStringWIB } from '../utils/dateHelper';
import { databaseService } from '../utils/databaseService';
import * as XLSX from 'xlsx';

interface ResponseTimeAnalyticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  boxes: QueueBox[];
  patients: PatientItem[];
  callLogs?: CallHistoryRecord[];
  onCallPatient?: (patient: PatientItem, box: QueueBox) => void;
  onSelectBoxFilter?: (boxTitleOrId: string) => void;
}

export const ResponseTimeAnalyticsModal: React.FC<ResponseTimeAnalyticsModalProps> = ({
  isOpen,
  onClose,
  boxes,
  patients: livePatients,
  callLogs = [],
  onCallPatient,
  onSelectBoxFilter,
}) => {
  const todayWIB = getLocalDateStringWIB();
  const [selectedDate, setSelectedDate] = useState<string>(todayWIB);
  const [availableDates, setAvailableDates] = useState<string[]>([todayWIB]);
  const [archivedVisits, setArchivedVisits] = useState<DailyPatientVisit[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const [now, setNow] = useState<number>(Date.now());
  const [searchQuery, setSearchQuery] = useState('');
  const [filterBoxId, setFilterBoxId] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'waiting' | 'delayed' | 'completed'>('all');
  const [activeTab, setActiveTab] = useState<'overview' | 'therapists' | 'patients'>('overview');

  // Auto tick every 15 seconds for live wait time updates if viewing today
  useEffect(() => {
    if (!isOpen || selectedDate !== todayWIB) return;
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 15000);
    return () => clearInterval(timer);
  }, [isOpen, selectedDate, todayWIB]);

  // Fetch persistent daily archive from Cloud Firestore & Server
  const fetchArchiveData = async (targetDate: string, isManualRefresh = false) => {
    if (isManualRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    try {
      const res = await databaseService.getDailyDatabase(targetDate);
      if (res && Array.isArray(res.visits)) {
        const visitMap = new Map<string, DailyPatientVisit>();
        res.visits.forEach((v) => {
          if (v) {
            const key = v.id || `${v.medicalRecordNo || 'norm'}-${v.registeredAt || Math.random()}`;
            visitMap.set(key, { ...v, id: key });
          }
        });
        setArchivedVisits(Array.from(visitMap.values()));
      } else {
        setArchivedVisits([]);
      }

      if (res && Array.isArray(res.allDates) && res.allDates.length > 0) {
        const uniqueDates = Array.from(new Set([todayWIB, ...res.allDates])).sort().reverse();
        setAvailableDates(uniqueDates);
      }
    } catch (err) {
      console.error('Failed to load daily archive for response time analytics:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  // Trigger data fetch when modal opens or selectedDate changes
  useEffect(() => {
    if (isOpen) {
      fetchArchiveData(selectedDate);
    }
  }, [isOpen, selectedDate]);

  // Multi-source resilient data merge:
  // - When selectedDate is TODAY: merge archived visits with livePatients.
  //   If "Bersihkan Antrean" was pressed, livePatients is empty, but archivedVisits
  //   keeps 100% of all visits, response times, and timestamps completely intact!
  // - When selectedDate is a PAST DATE: load directly from the persistent cloud archive.
  const unifiedPatients: PatientItem[] = useMemo(() => {
    const isToday = selectedDate === todayWIB;
    const patientMap = new Map<string, PatientItem>();

    // Step A: Load from persistent cloud archive
    archivedVisits.forEach((v) => {
      if (!v || !v.id) return;
      const unified: PatientItem = {
        id: v.id,
        patientId: v.patientId || v.id,
        medicalRecordNo: v.medicalRecordNo,
        patientName: v.patientName,
        queueNumber: v.queueNumber || '-',
        boxId: v.boxId,
        actionCode: v.actionCode || '',
        diagnosis: v.diagnosis || '',
        isWarning: !!v.isWarning,
        isRanap: !!v.isRanap,
        note: v.note || '',
        phoneNumber: v.phoneNumber || '',
        completed: !!v.completed,
        createdAt: v.registeredAt || new Date().toISOString(),
        lastCalledAt: v.calledAt || null,
        completedAt: v.completedAt || null,
        calledCount: v.calledCount || 0,
      };
      (unified as any).boxTitle = v.boxTitle;
      (unified as any).officerName = v.officerName;
      patientMap.set(v.id, unified);
    });

    // Step B: If viewing today, overlay active live queue patients
    if (isToday && livePatients.length > 0) {
      livePatients.forEach((p) => {
        if (!p || !p.id) return;
        const existing = patientMap.get(p.id);
        patientMap.set(p.id, {
          ...(existing || {}),
          ...p,
        });
      });
    }

    return Array.from(patientMap.values());
  }, [archivedVisits, livePatients, selectedDate, todayWIB]);

  // Ensure all referenced box IDs have an entry
  const effectiveBoxes: QueueBox[] = useMemo(() => {
    const boxMap = new Map<string, QueueBox>();
    boxes.forEach(b => boxMap.set(b.id, b));

    unifiedPatients.forEach(p => {
      if (p.boxId && !boxMap.has(p.boxId)) {
        boxMap.set(p.boxId, {
          id: p.boxId,
          title: (p as any).boxTitle || `Kotak ${p.boxId}`,
          officerName: (p as any).officerName || 'Terapis',
          location: 'RSPP IRM',
          color: 'green' as BoxColor,
          isPinned: false,
          createdAt: new Date().toISOString(),
        });
      }
    });

    return Array.from(boxMap.values());
  }, [boxes, unifiedPatients]);

  const analytics = useMemo(() => {
    return computeResponseTimeAnalytics(unifiedPatients, effectiveBoxes, now);
  }, [unifiedPatients, effectiveBoxes, now]);

  if (!isOpen) return null;

  // Filter patient metrics for detailed table
  const filteredPatients = analytics.patientMetrics.filter((p) => {
    if (filterBoxId !== 'all' && p.boxId !== filterBoxId) return false;
    if (filterStatus === 'waiting' && p.completed) return false;
    if (filterStatus === 'delayed' && p.waitMinutes <= 30) return false;
    if (filterStatus === 'completed' && !p.completed) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = p.patientName.toLowerCase().includes(q);
      const matchRM = p.medicalRecordNo.toLowerCase().includes(q);
      const matchQueue = p.queueNumber.toLowerCase().includes(q);
      const matchOfficer = p.officerName.toLowerCase().includes(q);
      const matchAction = p.actionCode ? p.actionCode.toLowerCase().includes(q) : false;
      return matchName || matchRM || matchQueue || matchOfficer || matchAction;
    }
    return true;
  });

  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();

    // 1. Ringkasan
    const summaryRows = [
      ['ANALISIS RESPON TIME PASIEN (WAKTU INPUT KE CEKLIS)'],
      ['Tanggal Laporan', selectedDate],
      ['Waktu Cetak', new Date().toLocaleString('id-ID')],
      ['Total Pasien Terdaftar', analytics.totalPatients],
      ['Pasien Aktif Berjalan', analytics.activePatientsCount],
      ['Pasien Selesai Diceklis', analytics.completedPatientsCount],
      [''],
      ['METRIK UTAMA RESPON TIME'],
      ['Rata-rata Respon Time (Input ke Ceklis)', `${analytics.avgResponseMinutes} Menit`],
      ['Tingkat Kepatuhan Standar SPM (<= 30 mnt)', `${analytics.spmComplianceRate}%`],
      [''],
      ['DISTRIBUSI WAKTU RESPON'],
      ['Sangat Cepat (<= 15 Menit)', `${analytics.distribution.fastCount} Pasien (${analytics.fastRate}%)`],
      ['Standar SPM (16 - 30 Menit)', `${analytics.distribution.normalCount} Pasien (${analytics.normalRate}%)`],
      ['Perhatian (31 - 60 Menit)', `${analytics.distribution.moderateCount} Pasien (${analytics.moderateRate}%)`],
      ['Keterlambatan (> 60 Menit)', `${analytics.distribution.delayedCount} Pasien (${analytics.delayedRate}%)`]
    ];

    const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Ringkasan Respon Time');

    // 2. Performa Per Terapis
    const therapistHeaders = [
      'Nama Terapis / Petugas',
      'Ruangan / Kotak',
      'Total Pasien',
      'Pasien Aktif',
      'Pasien Selesai',
      'Rata-rata Respon Time (Mnt)',
      'Kepatuhan Standar SPM (<= 30 mnt)',
      'Respon Time Terlama Saat Ini (Mnt)'
    ];

    const therapistRows = analytics.boxMetrics.map((b) => [
      b.officerName,
      b.boxTitle,
      b.totalPatients,
      b.activeCount,
      b.completedCount,
      b.avgResponseMinutes,
      `${b.complianceRate}%`,
      b.longestActiveWaitMinutes > 0 ? b.longestActiveWaitMinutes : '-'
    ]);

    const wsTherapists = XLSX.utils.aoa_to_sheet([therapistHeaders, ...therapistRows]);
    XLSX.utils.book_append_sheet(wb, wsTherapists, 'Performa Terapis');

    // 3. Log Rinci Pasien
    const patientHeaders = [
      'No. Antrean',
      'Nama Pasien',
      'No. RM',
      'Terapis',
      'Kotak Antrean',
      'Tindakan',
      'Status',
      'Jam Masuk Input',
      'Jam Selesai Diceklis',
      'Respon Time (Menit)',
      'Kategori Kecepatan',
      'Kepatuhan Standar SPM'
    ];

    const patientRows = analytics.patientMetrics.map((p) => [
      p.queueNumber,
      p.patientName,
      p.medicalRecordNo,
      p.officerName,
      p.boxTitle,
      p.actionCode || '-',
      p.completed ? 'Selesai' : 'Sedang Berjalan',
      p.registeredAt && !isNaN(p.registeredAt.getTime())
        ? p.registeredAt.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
        : '-',
      p.completedAt && !isNaN(p.completedAt.getTime())
        ? p.completedAt.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
        : '-',
      p.responseTimeMinutes,
      p.waitStatus === 'fast'
        ? 'Sangat Cepat (<=15m)'
        : p.waitStatus === 'normal'
        ? 'Standar (16-30m)'
        : p.waitStatus === 'moderate'
        ? 'Perhatian (31-60m)'
        : 'Terlambat (>60m)',
      p.isCompliant ? 'Sesuai SPM (<=30m)' : 'Melebihi SPM (>30m)'
    ]);

    const wsPatients = XLSX.utils.aoa_to_sheet([patientHeaders, ...patientRows]);
    XLSX.utils.book_append_sheet(wb, wsPatients, 'Detail Pasien Respon Time');

    XLSX.writeFile(wb, `Analisis_Respon_Time_${selectedDate}.xlsx`);
  };

  return (
    <div className="fixed inset-0 z-60 bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header Modal */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-3.5 sm:p-5 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
            <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg font-black shrink-0">
              <Timer className="w-5 h-5 sm:w-6 sm:h-6 animate-pulse" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base md:text-lg font-black tracking-tight leading-snug truncate">
                  Respon Time Pasien (Input &rarr; Ceklis)
                </h2>
                <span className="hidden sm:inline-block text-[10px] bg-emerald-400 text-slate-950 px-2 py-0.5 rounded-full font-black uppercase shrink-0">
                  {selectedDate === todayWIB ? 'Real-Time' : 'Arsip'}
                </span>
              </div>
              <p className="text-[10px] sm:text-xs text-indigo-200 font-medium leading-tight truncate mt-0.5">
                Dihitung dari saat pasien didaftarkan/ditulis hingga saat diceklis selesai &bull; Tersimpan Abadi
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportExcel}
              className="hidden sm:flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-emerald-950 bg-emerald-300 hover:bg-emerald-200 rounded-xl transition-all cursor-pointer shadow-xs"
              title="Unduh Rekap Respon Time ke Excel"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Ekspor Excel</span>
            </button>

            <button
              onClick={onClose}
              className="text-white/80 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-all cursor-pointer"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Date Selector & Archive Toolbar */}
        <div className="bg-slate-900 border-b border-slate-800 px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-2 bg-slate-800/90 text-white px-3 py-1.5 rounded-xl border border-slate-700 shadow-2xs">
              <Calendar className="w-4 h-4 text-indigo-400" />
              <span className="text-xs font-bold text-slate-300">Pilih Tanggal:</span>
              <input
                type="date"
                value={selectedDate}
                max={todayWIB}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-slate-950 text-white text-xs font-black px-2 py-1 rounded-lg border border-slate-600 focus:outline-hidden focus:border-indigo-400 cursor-pointer"
              />
              {selectedDate !== todayWIB && (
                <button
                  type="button"
                  onClick={() => setSelectedDate(todayWIB)}
                  className="px-2 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-black rounded-lg cursor-pointer transition-all shadow-xs"
                >
                  Hari Ini
                </button>
              )}
              <button
                type="button"
                onClick={() => fetchArchiveData(selectedDate, true)}
                disabled={isRefreshing}
                className="p-1 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-all cursor-pointer"
                title="Muat ulang dari Cloud Storage & Database"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-indigo-400' : ''}`} />
              </button>
            </div>

            {/* Quick date chips */}
            {availableDates.length > 1 && (
              <div className="hidden md:flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Riwayat:</span>
                {availableDates.slice(0, 5).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setSelectedDate(d)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      selectedDate === d
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700/80'
                    }`}
                  >
                    {d === todayWIB ? 'Hari Ini' : d}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 text-xs font-bold text-teal-300 bg-teal-950/60 border border-teal-500/40 px-3 py-1 rounded-xl">
              <ShieldCheck className="w-4 h-4 text-teal-400" />
              <span>Arsip Cloud Permanen: {analytics.totalPatients} Pasien</span>
            </span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-slate-100/90 border-b border-slate-200 px-4 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 text-xs font-bold shadow-2xs">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === 'overview'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              Ringkasan &amp; SPM
            </button>
            <button
              onClick={() => setActiveTab('therapists')}
              className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === 'therapists'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              Performa Terapis ({analytics.boxMetrics.length})
            </button>
            <button
              onClick={() => setActiveTab('patients')}
              className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === 'patients'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              Detail Pasien ({filteredPatients.length})
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span>Update otomatis setiap 15 detik</span>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1 bg-slate-50/50">
          {isLoading ? (
            <div className="p-16 text-center text-slate-500 flex flex-col items-center justify-center gap-3">
              <RefreshCw className="w-10 h-10 text-indigo-600 animate-spin" />
              <p className="font-bold text-sm text-slate-800">Memuat Arsip Respon Time dari Cloud Storage...</p>
              <p className="text-xs text-slate-500">Mengambil data kepatuhan SPM &amp; durasi input ke ceklis</p>
            </div>
          ) : (
            <>
              {/* Notice Banners */}
              {selectedDate !== todayWIB && (
                <div className="p-3.5 bg-indigo-50 border border-indigo-200 rounded-2xl flex items-center justify-between gap-3 text-xs text-indigo-950 shadow-2xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Calendar className="w-5 h-5 text-indigo-600 shrink-0" />
                    <span className="truncate font-medium">
                      Menampilkan rekap respon time permanen tanggal: <strong className="font-black underline">{selectedDate}</strong>. Data ini tersimpan abadi di Cloud dan dapat diakses kapan saja.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedDate(todayWIB)}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer shrink-0 shadow-2xs"
                  >
                    Kembali ke Hari Ini
                  </button>
                </div>
              )}

              {selectedDate === todayWIB && livePatients.length === 0 && analytics.totalPatients > 0 && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-2.5 text-xs text-emerald-950 shadow-2xs">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span className="font-medium">
                    Antrean aktif saat ini telah dibersihkan, namun seluruh rekaman respon time hari ini (<strong className="font-black">{analytics.totalPatients} pasien</strong>) <strong>tetap tersimpan aman secara permanen</strong> di Cloud Database.
                  </span>
                </div>
              )}
          {/* 4 PRIMARY METRIC CARDS */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider">Rata-rata Respon Time</span>
                <Clock className="w-4 h-4 text-blue-600" />
              </div>
              <p className="text-2xl sm:text-3xl font-black text-slate-900">
                {analytics.avgResponseMinutes} <span className="text-sm font-bold text-slate-500">Mnt</span>
              </p>
              <p className="text-[11px] text-slate-400 mt-1">Dihitung dari input &rarr; diceklis</p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider">Kepatuhan SPM (&le;30m)</span>
                <Award className="w-4 h-4 text-emerald-600" />
              </div>
              <p className={`text-2xl sm:text-3xl font-black ${
                analytics.spmComplianceRate >= 80 ? 'text-emerald-600' : 'text-amber-600'
              }`}>
                {analytics.spmComplianceRate}%
              </p>
              <p className="text-[11px] text-slate-400 mt-1">Standar Waktu Respon Nasional</p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider">Pasien Aktif Berjalan</span>
                <Users className="w-4 h-4 text-indigo-600" />
              </div>
              <p className="text-2xl sm:text-3xl font-black text-indigo-700">
                {analytics.activePatientsCount} <span className="text-sm font-bold text-slate-500">Pasien</span>
              </p>
              <p className="text-[11px] text-slate-400 mt-1">Sedang dalam proses antrean</p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider">Pasien Selesai Diceklis</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <p className="text-2xl sm:text-3xl font-black text-emerald-700">
                {analytics.completedPatientsCount} <span className="text-sm font-bold text-slate-500">Pasien</span>
              </p>
              <p className="text-[11px] text-slate-400 mt-1">Pelayanan tuntas terlaksana</p>
            </div>
          </div>

          {/* TAB 1: OVERVIEW & SPM */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Critical Alert: Pasien Menunggu Paling Lama Saat Ini */}
              {analytics.longestWaitingActive.length > 0 && (
                <div className="bg-white rounded-2xl border border-rose-200 shadow-xs overflow-hidden">
                  <div className="p-3.5 bg-gradient-to-r from-rose-50 to-amber-50 border-b border-rose-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-rose-600 text-white flex items-center justify-center font-black">
                        <Flame className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-xs font-black text-rose-950 uppercase tracking-tight">
                          Perhatian: Pasien Menunggu Paling Lama Saat Ini
                        </h3>
                        <p className="text-[11px] text-rose-800">
                          Harap prioritaskan pemanggilan untuk menjaga respon time dan kepuasan pasien.
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-extrabold text-rose-700 bg-rose-100 px-2.5 py-0.5 rounded-full">
                      {analytics.longestWaitingActive.length} Pasien
                    </span>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {analytics.longestWaitingActive.map((p, pIdx) => {
                      const parentBox = effectiveBoxes.find((b) => b.id === p.boxId);
                      const originalPatient = unifiedPatients.find((pat) => pat.id === p.patientId);

                      return (
                        <div key={`longest-wait-${p.patientId || p.queueNumber || pIdx}-${pIdx}`} className="p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3 hover:bg-slate-50">
                          <div className="flex items-center gap-3">
                            <span className="w-10 h-10 rounded-xl bg-slate-900 text-white font-mono font-black text-xs flex items-center justify-center shrink-0">
                              {p.queueNumber}
                            </span>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-extrabold text-slate-900 text-xs sm:text-sm">{p.patientName}</p>
                                <span className="text-[10px] font-mono text-slate-500">RM: {p.medicalRecordNo}</span>
                                {p.isWarning && (
                                  <span className="text-[10px] bg-rose-100 text-rose-800 px-1.5 py-0.2 rounded font-bold">
                                    🛑 Warning
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-500 mt-0.5">
                                Ruang: <strong>{p.boxTitle}</strong> ({p.officerName}) &bull; Tindakan: {p.actionCode || '-'}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-black font-mono ${
                                p.waitMinutes > 45 
                                  ? 'bg-rose-600 text-white animate-pulse' 
                                  : p.waitMinutes > 30 
                                  ? 'bg-amber-500 text-white' 
                                  : 'bg-blue-100 text-blue-900'
                              }`}>
                                ⏱️ {p.formattedWait}
                              </span>
                              <p className="text-[10px] text-slate-400 mt-0.5">
                                Masuk jam {p.registeredAt.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>

                            {onCallPatient && parentBox && originalPatient && (
                              <button
                                onClick={() => onCallPatient(originalPatient, parentBox)}
                                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                                title="Panggil pasien ini sekarang"
                              >
                                <Volume2 className="w-3.5 h-3.5" />
                                <span>Panggil</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Visual Distribution of Wait Times */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-extrabold text-sm text-slate-800 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-indigo-600" />
                      Distribusi Waktu Tunggu Pasien (Benchmark Standar SPM)
                    </h3>
                    <p className="text-xs text-slate-500">
                      Evaluasi sebaran durasi tunggu pasien terhadap target SPM Kemenkes (&le; 30 menit).
                    </p>
                  </div>
                </div>

                {/* Progress Distribution Bar */}
                <div className="w-full h-5 bg-slate-100 rounded-xl overflow-hidden flex shadow-inner">
                  <div
                    style={{ width: `${analytics.fastRate}%` }}
                    className="bg-emerald-500 transition-all duration-500 hover:opacity-90 relative group"
                    title={`Sangat Cepat (<=15 mnt): ${analytics.distribution.fastCount} pasien (${analytics.fastRate}%)`}
                  />
                  <div
                    style={{ width: `${analytics.normalRate}%` }}
                    className="bg-teal-500 transition-all duration-500 hover:opacity-90 relative group"
                    title={`Standar SPM (16-30 mnt): ${analytics.distribution.normalCount} pasien (${analytics.normalRate}%)`}
                  />
                  <div
                    style={{ width: `${analytics.moderateRate}%` }}
                    className="bg-amber-400 transition-all duration-500 hover:opacity-90 relative group"
                    title={`Perhatian (31-60 mnt): ${analytics.distribution.moderateCount} pasien (${analytics.moderateRate}%)`}
                  />
                  <div
                    style={{ width: `${analytics.delayedRate}%` }}
                    className="bg-rose-500 transition-all duration-500 hover:opacity-90 relative group"
                    title={`Terlambat (>60 mnt): ${analytics.distribution.delayedCount} pasien (${analytics.delayedRate}%)`}
                  />
                </div>

                {/* Distribution Legend Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                  <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl text-center">
                    <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 mb-1" />
                    <p className="text-[11px] font-bold text-emerald-900">Sangat Cepat (&le; 15m)</p>
                    <p className="text-lg font-black text-emerald-700 mt-0.5">
                      {analytics.distribution.fastCount} <span className="text-xs font-semibold">({analytics.fastRate}%)</span>
                    </p>
                  </div>

                  <div className="p-3 bg-teal-50/70 border border-teal-200 rounded-xl text-center">
                    <span className="inline-block w-2.5 h-2.5 rounded-full bg-teal-500 mb-1" />
                    <p className="text-[11px] font-bold text-teal-900">Standar SPM (16 - 30m)</p>
                    <p className="text-lg font-black text-teal-700 mt-0.5">
                      {analytics.distribution.normalCount} <span className="text-xs font-semibold">({analytics.normalRate}%)</span>
                    </p>
                  </div>

                  <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-center">
                    <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-400 mb-1" />
                    <p className="text-[11px] font-bold text-amber-900">Perhatian (31 - 60m)</p>
                    <p className="text-lg font-black text-amber-700 mt-0.5">
                      {analytics.distribution.moderateCount} <span className="text-xs font-semibold">({analytics.moderateRate}%)</span>
                    </p>
                  </div>

                  <div className="p-3 bg-rose-50/70 border border-rose-200 rounded-xl text-center">
                    <span className="inline-block w-2.5 h-2.5 rounded-full bg-rose-500 mb-1" />
                    <p className="text-[11px] font-bold text-rose-900">Keterlambatan (&gt; 60m)</p>
                    <p className="text-lg font-black text-rose-700 mt-0.5">
                      {analytics.distribution.delayedCount} <span className="text-xs font-semibold">({analytics.delayedRate}%)</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: THERAPISTS BREAKDOWN */}
          {activeTab === 'therapists' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <h3 className="font-extrabold text-sm text-slate-800 flex items-center gap-2">
                  <Users className="w-4 h-4 text-indigo-600" />
                  Rincian Respon Time &amp; Kecepatan Per Terapis / Ruangan
                </h3>
                <span className="text-xs text-slate-500 font-medium">
                  {analytics.boxMetrics.length} Terapis Aktif
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-3">Terapis / Ruangan</th>
                      <th className="p-3 text-center">Pasien Aktif</th>
                      <th className="p-3 text-center">Pasien Selesai</th>
                      <th className="p-3 text-center">Avg Respon Time</th>
                      <th className="p-3 text-center">Kepatuhan SPM (&le;30m)</th>
                      <th className="p-3 text-center">Respon Terlama</th>
                      <th className="p-3 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {analytics.boxMetrics.map((b) => (
                      <tr key={b.boxId} className="hover:bg-slate-50">
                        <td className="p-3">
                          <div>
                            <p className="font-bold text-slate-900">{b.officerName}</p>
                            <p className="text-[10px] text-slate-500">{b.location || b.boxTitle}</p>
                          </div>
                        </td>

                        <td className="p-3 text-center">
                          <span className="font-mono text-xs font-extrabold text-blue-700">
                            {b.activeCount}
                          </span>
                        </td>

                        <td className="p-3 text-center">
                          <span className="font-mono text-xs font-extrabold text-emerald-700">
                            {b.completedCount}
                          </span>
                        </td>

                        <td className="p-3 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded font-mono font-bold ${
                            b.avgResponseMinutes > 30 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-800'
                          }`}>
                            {b.avgResponseMinutes} mnt
                          </span>
                        </td>

                        <td className="p-3 text-center">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-black ${
                            b.complianceRate >= 80 
                              ? 'bg-emerald-100 text-emerald-800' 
                              : 'bg-amber-100 text-amber-800'
                          }`}>
                            {b.complianceRate}%
                          </span>
                        </td>

                        <td className="p-3 text-center font-mono text-slate-600">
                          {b.longestActiveWaitMinutes > 0 ? `${b.longestActiveWaitMinutes} mnt` : '-'}
                        </td>

                        <td className="p-3 text-right">
                          {onSelectBoxFilter && (
                            <button
                              onClick={() => {
                                onSelectBoxFilter(b.boxTitle);
                                onClose();
                              }}
                              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-bold transition-all cursor-pointer"
                            >
                              Fokuskan
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: DETAILED PATIENTS LOG */}
          {activeTab === 'patients' && (
            <div className="space-y-4">
              {/* Filter controls */}
              <div className="bg-white p-3.5 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
                <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[240px]">
                  <div className="relative flex-1 min-w-[160px]">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Cari pasien / RM / No. antrean..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:border-indigo-500"
                    />
                  </div>

                  <select
                    value={filterBoxId}
                    onChange={(e) => setFilterBoxId(e.target.value)}
                    className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700"
                  >
                    <option value="all">Semua Terapis</option>
                    {effectiveBoxes.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.officerName || b.title}
                      </option>
                    ))}
                  </select>

                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value as any)}
                    className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700"
                  >
                    <option value="all">Semua Status</option>
                    <option value="waiting">Sedang Menunggu</option>
                    <option value="delayed">Terlambat (&gt;30 mnt)</option>
                    <option value="completed">Sudah Selesai</option>
                  </select>
                </div>

                <span className="text-xs text-slate-500 font-bold">
                  {filteredPatients.length} Pasien Ditemukan
                </span>
              </div>

              {/* Patient Table */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="p-3">No. Antrean</th>
                        <th className="p-3">Nama Pasien / RM</th>
                        <th className="p-3">Terapis / Ruang</th>
                        <th className="p-3">Tindakan</th>
                        <th className="p-3 text-center">Waktu Input</th>
                        <th className="p-3 text-center">Waktu Ceklis Selesai</th>
                        <th className="p-3 text-center">Respon Time</th>
                        <th className="p-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredPatients.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="p-8 text-center text-slate-400 italic">
                            Tidak ada data pasien yang sesuai filter.
                          </td>
                        </tr>
                      ) : (
                        filteredPatients.map((p, pIdx) => (
                          <tr key={`resp-patient-${p.patientId || p.queueNumber || pIdx}-${pIdx}`} className="hover:bg-slate-50">
                            <td className="p-3 font-mono font-black text-slate-900">
                              {p.queueNumber}
                            </td>

                            <td className="p-3 font-semibold text-slate-900">
                              <p className="font-bold">{p.patientName}</p>
                              <p className="text-[10px] text-slate-400 font-mono">RM: {p.medicalRecordNo}</p>
                            </td>

                            <td className="p-3 text-slate-700">
                              <p className="font-bold">{p.officerName}</p>
                              <p className="text-[10px] text-slate-400">{p.boxTitle}</p>
                            </td>

                            <td className="p-3 text-slate-700">
                              {p.actionCode || '-'}
                            </td>

                            <td className="p-3 text-center font-mono text-slate-600">
                              {p.registeredAt && !isNaN(p.registeredAt.getTime())
                                ? p.registeredAt.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
                                : '-'}
                            </td>

                            <td className="p-3 text-center font-mono text-slate-600">
                              {p.completedAt && !isNaN(p.completedAt.getTime())
                                ? p.completedAt.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
                                : '-'}
                            </td>

                            <td className="p-3 text-center">
                              <span className={`inline-block px-2 py-0.5 rounded font-mono font-black text-xs ${
                                p.waitStatus === 'delayed'
                                  ? 'bg-rose-600 text-white animate-pulse'
                                  : p.waitStatus === 'moderate'
                                  ? 'bg-amber-100 text-amber-800'
                                  : p.waitStatus === 'normal'
                                  ? 'bg-teal-100 text-teal-800'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}>
                                {p.formattedResponseTime}
                              </span>
                            </td>

                            <td className="p-3 text-center">
                              {p.completed ? (
                                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold text-[10px]">
                                  Selesai
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded font-bold text-[10px]">
                                  Sedang Berjalan
                                </span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 font-medium">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Cepat (&le;15m)</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-teal-500" />
              <span>Standar (16-30m)</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <span>Perhatian (31-60m)</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              <span>Keterlambatan (&gt;60m)</span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportExcel}
              className="px-3.5 py-2 text-xs font-bold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Unduh Rekap Excel</span>
            </button>

            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
