import React, { useState, useEffect } from 'react';
import { X, FileText, Download, FileSpreadsheet, Calendar, CheckCircle2, User, Users, Hospital, Tag, Search, Trophy, Loader2, Database, ArrowLeft, ChevronRight, ChevronDown } from 'lucide-react';
import { QueueBox, PatientItem, DailyPatientVisit } from '../types';
import { exportMonthlyTherapistPDF, exportMonthlyTherapistExcel, MonthlyReportData } from '../utils/export';
import { cloudDatabaseService } from '../utils/cloudDatabaseService';

interface MonthlyReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  boxes: QueueBox[];
  patients: PatientItem[];
}

export const MonthlyReportModal: React.FC<MonthlyReportModalProps> = ({
  isOpen,
  onClose,
  boxes,
  patients,
}) => {
  // Default to current year-month e.g., "2026-08"
  const now = new Date();
  const defaultYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  
  const [selectedYearMonth, setSelectedYearMonth] = useState(defaultYearMonth);
  const [selectedTherapist, setSelectedTherapist] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [monthlyVisits, setMonthlyVisits] = useState<DailyPatientVisit[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  // Drill-down: tabel harian untuk 1 terapis, dibuka dengan klik nama terapisnya
  const [drilldownTherapist, setDrilldownTherapist] = useState<string | null>(null);
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());

  const [yearStr, monthStr] = selectedYearMonth.split('-');
  const selectedYear = parseInt(yearStr, 10);
  const selectedMonth = parseInt(monthStr, 10); // 1-based

  // Fetch all persistent records for this month from Server and Cloud Firestore
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setIsLoading(true);

    const loadMonthData = async () => {
      let serverVisits: DailyPatientVisit[] = [];
      let serverOk = false;

      try {
        const res = await fetch(`/api/monthly-report?year=${selectedYear}&month=${selectedMonth}`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.visits)) {
            serverVisits = data.visits;
            serverOk = true;
          }
        }
      } catch (err) {
        console.warn('Failed to fetch from /api/monthly-report, fallback to Cloud Firestore:', err);
      }

      // Check Cloud Firestore to guarantee no dates were missed from container cold restarts
      try {
        const allArchives = await cloudDatabaseService.getAllDailyArchives();
        const monthPrefix = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
        const cloudList: DailyPatientVisit[] = [];

        Object.keys(allArchives).forEach(dKey => {
          if (dKey.startsWith(monthPrefix) && Array.isArray(allArchives[dKey])) {
            allArchives[dKey].forEach(v => {
              cloudList.push({ ...v, visitDate: dKey });
            });
          }
        });

        // Merge serverVisits and cloudList
        const visitsMap = new Map<string, DailyPatientVisit>();
        serverVisits.forEach(v => {
          const key = `${v.id}_${v.visitDate || ''}`;
          visitsMap.set(key, v);
        });
        cloudList.forEach(v => {
          const key = `${v.id}_${v.visitDate || ''}`;
          const existing = visitsMap.get(key);
          visitsMap.set(key, { ...existing, ...v });
        });

        const merged = Array.from(visitsMap.values());
        if (isMounted) {
          setMonthlyVisits(merged.length > 0 ? merged : serverVisits);
        }
      } catch (err) {
        console.error('Failed to load monthly data from cloud:', err);
        if (isMounted && serverOk) {
          setMonthlyVisits(serverVisits);
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadMonthData();

    return () => {
      isMounted = false;
    };
  }, [isOpen, selectedYear, selectedMonth]);

  if (!isOpen) return null;

  const monthNamesID = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  const selectedMonthName = `${monthNamesID[selectedMonth - 1] || ''} ${selectedYear}`;

  // Combine fetched persistent monthly visits with any active completed patients from state
  const combinedList: Array<PatientItem | DailyPatientVisit> = [...monthlyVisits];

  // Merge today's active completed patients if not already in monthlyVisits
  patients.forEach(p => {
    if (!p.completed) return;
    const dateObj = p.completedAt ? new Date(p.completedAt) : new Date(p.createdAt);
    const pYear = dateObj.getFullYear();
    const pMonth = dateObj.getMonth() + 1;
    if (pYear === selectedYear && pMonth === selectedMonth) {
      const exists = combinedList.some(item => item.id === p.id);
      if (!exists) {
        combinedList.push(p);
      }
    }
  });

  // Filter completed patients belonging to selected month and year
  const completedPatientsInMonth: PatientItem[] = combinedList
    .filter((p: any) => {
      if (!p.completed) return false;
      const rawDate = p.completedAt || p.createdAt || p.registeredAt;
      const dateObj = rawDate ? new Date(rawDate) : new Date();
      const pYear = dateObj.getFullYear();
      const pMonth = dateObj.getMonth() + 1;
      return pYear === selectedYear && pMonth === selectedMonth;
    })
    .map((p: any) => ({
      id: p.id,
      patientName: p.patientName,
      medicalRecordNo: p.medicalRecordNo,
      boxId: p.boxId || 'box-1',
      boxTitle: p.boxTitle || '',
      officerName: p.officerName || p.firstOfficerName || '',
      category: p.category || '',
      queueNumber: p.queueNumber || '',
      actionCode: p.actionCode || '',
      diagnosis: p.diagnosis || '',
      isWarning: !!p.isWarning,
      isRanap: !!p.isRanap,
      note: p.note || '',
      phoneNumber: p.phoneNumber || '',
      completed: true,
      createdAt: p.registeredAt || p.createdAt || new Date().toISOString(),
      lastCalledAt: p.calledAt || p.lastCalledAt || null,
      completedAt: p.completedAt || new Date().toISOString(),
      calledCount: p.calledCount || 1,
    }));

  // Group patients by Therapist / Officer Name (utilizing frozen officerName & boxTitle first)
  interface TherapistGroup {
    therapistName: string;
    boxId: string;
    boxTitle: string;
    location: string;
    patients: PatientItem[];
    actionCounts: { [code: string]: number };
    ranapCount: number;
    rajalCount: number;
  }

  const therapistMap = new Map<string, TherapistGroup>();

  // For the current active month, pre-initialize active boxes so therapists on duty show up even with 0 visits
  const isCurrentMonth = selectedYear === now.getFullYear() && selectedMonth === (now.getMonth() + 1);
  if (isCurrentMonth) {
    boxes.forEach(box => {
      const name = (box.officerName || box.title || '').trim();
      if (name && !therapistMap.has(name)) {
        therapistMap.set(name, {
          therapistName: box.officerName || box.title,
          boxId: box.id,
          boxTitle: box.title,
          location: box.location,
          patients: [],
          actionCounts: {},
          ranapCount: 0,
          rajalCount: 0
        });
      }
    });
  }

  // Populate patients into groups (prioritize frozen officerName & boxTitle to ensure historical archives remain immutable)
  completedPatientsInMonth.forEach(p => {
    const frozenOfficer = (p.officerName || '').trim();
    const frozenBoxTitle = (p.boxTitle || '').trim();
    const fallbackBox = boxes.find(b => b.id === p.boxId);

    // Primary attribution: frozen officerName -> active box officerName -> frozen boxTitle -> active box title -> 'Lainnya / Umum'
    const therapistName = frozenOfficer || (fallbackBox?.officerName ? fallbackBox.officerName.trim() : '') || frozenBoxTitle || (fallbackBox?.title ? fallbackBox.title.trim() : '') || 'Lainnya / Umum';
    const boxTitle = frozenBoxTitle || fallbackBox?.title || (frozenOfficer ? `Kotak ${frozenOfficer}` : 'Ruangan');
    const location = fallbackBox?.location || '-';

    const key = therapistName;

    if (!therapistMap.has(key)) {
      therapistMap.set(key, {
        therapistName,
        boxId: p.boxId || (fallbackBox ? fallbackBox.id : 'unknown'),
        boxTitle,
        location,
        patients: [],
        actionCounts: {},
        ranapCount: 0,
        rajalCount: 0
      });
    }

    const group = therapistMap.get(key)!;
    group.patients.push(p);

    if (p.isRanap) {
      group.ranapCount += 1;
    } else {
      group.rajalCount += 1;
    }

    const code = p.actionCode ? p.actionCode.toUpperCase() : 'TANPA KODE';
    group.actionCounts[code] = (group.actionCounts[code] || 0) + 1;
  });

  // Convert map to array
  let therapistGroups = Array.from(therapistMap.values());

  // Filter by selected therapist
  if (selectedTherapist !== 'all') {
    therapistGroups = therapistGroups.filter(g => g.therapistName === selectedTherapist || g.boxId === selectedTherapist);
  }

  // Filter inside patient lists if search query is active
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase().trim();
    therapistGroups = therapistGroups.map(g => {
      const filteredP = g.patients.filter(p =>
        p.patientName.toLowerCase().includes(q) ||
        p.medicalRecordNo.toLowerCase().includes(q) ||
        (p.actionCode && p.actionCode.toLowerCase().includes(q)) ||
        (p.diagnosis && p.diagnosis.toLowerCase().includes(q))
      );
      return { ...g, patients: filteredP };
    }).filter(g => g.patients.length > 0 || g.therapistName.toLowerCase().includes(q));
  }

  // Rincian harian untuk terapis yang sedang di-drill-down (klik nama terapis)
  interface DailyBreakdown {
    date: string;
    total: number;
    rajal: number;
    ranap: number;
    actionCounts: { [code: string]: number };
    patients: PatientItem[];
  }
  const drilldownGroup = drilldownTherapist ? therapistMap.get(drilldownTherapist) || null : null;
  const dailyBreakdown: DailyBreakdown[] = (() => {
    if (!drilldownGroup) return [];
    const map = new Map<string, DailyBreakdown>();
    drilldownGroup.patients.forEach((p: any) => {
      const raw = p.visitDate || p.completedAt || p.createdAt || p.registeredAt;
      const dateKey = raw ? String(raw).slice(0, 10) : 'Tidak Diketahui';
      if (!map.has(dateKey)) {
        map.set(dateKey, { date: dateKey, total: 0, rajal: 0, ranap: 0, actionCounts: {}, patients: [] });
      }
      const day = map.get(dateKey)!;
      day.total += 1;
      if (p.isRanap) day.ranap += 1; else day.rajal += 1;
      const code = p.actionCode ? p.actionCode.toUpperCase() : 'TANPA KODE';
      day.actionCounts[code] = (day.actionCounts[code] || 0) + 1;
      day.patients.push(p);
    });
    return Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date));
  })();
  const toggleDateExpand = (date: string) => {
    setExpandedDates(prev => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date); else next.add(date);
      return next;
    });
  };

  // Calculate totals
  const totalCompletedMonth = completedPatientsInMonth.length;
  const totalRanapMonth = completedPatientsInMonth.filter(p => p.isRanap).length;
  const totalRajalMonth = totalCompletedMonth - totalRanapMonth;

  // Find top performing therapist (exclude jemputan and peralihan)
  let topTherapist = '-';
  let topCount = 0;
  therapistMap.forEach(g => {
    const isJemputanOrPeralihan =
      g.boxId === 'box-jemputan' ||
      g.boxId === 'box-peralihan-siang' ||
      g.boxId.toLowerCase().includes('jemputan') ||
      g.boxId.toLowerCase().includes('peralihan') ||
      g.boxTitle.toLowerCase().includes('jemputan') ||
      g.boxTitle.toLowerCase().includes('peralihan') ||
      g.therapistName.toLowerCase().includes('jemputan') ||
      g.therapistName.toLowerCase().includes('peralihan') ||
      g.therapistName.toLowerCase().includes('transport') ||
      g.therapistName.toLowerCase().includes('shift siang');

    if (!isJemputanOrPeralihan && g.patients.length > topCount) {
      topCount = g.patients.length;
      topTherapist = g.therapistName;
    }
  });

  // Export PDF Handler
  const handleExportPDF = () => {
    const reportData: MonthlyReportData = {
      monthYearFormatted: selectedMonthName,
      year: selectedYear,
      month: selectedMonth,
      generatedAt: new Date().toLocaleString('id-ID'),
      therapistGroups: Array.from(therapistMap.values()),
      totalPatientsCount: totalCompletedMonth,
      totalRanapCount: totalRanapMonth,
      totalRajalCount: totalRajalMonth
    };
    exportMonthlyTherapistPDF(reportData, `Laporan_Bulanan_Terapis_${selectedYearMonth}.pdf`);
  };

  // Export Excel Handler
  const handleExportExcel = () => {
    const reportData: MonthlyReportData = {
      monthYearFormatted: selectedMonthName,
      year: selectedYear,
      month: selectedMonth,
      generatedAt: new Date().toLocaleString('id-ID'),
      therapistGroups: Array.from(therapistMap.values()),
      totalPatientsCount: totalCompletedMonth,
      totalRanapCount: totalRanapMonth,
      totalRajalCount: totalRajalMonth
    };
    exportMonthlyTherapistExcel(reportData, `Laporan_Bulanan_Terapis_${selectedYearMonth}.xlsx`);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
        
        {/* Header Bar */}
        <div className="bg-teal-900 text-white p-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-teal-800/80 rounded-xl border border-teal-700">
              <Users className="w-5 h-5 text-teal-300" />
            </div>
            <div>
              <h3 className="font-black text-base tracking-tight leading-tight">Laporan Bulanan Pasien Per Terapis</h3>
              <p className="text-xs text-teal-200 font-medium">Rekapitulasi Penanganan Pasien Selesai & Database Arsip Bulanan</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-all cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Controls Bar */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex flex-wrap items-center gap-3">
            {/* Month-Year Picker */}
            <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 shadow-2xs">
              <Calendar className="w-4 h-4 text-teal-600" />
              <label className="text-[11px] text-slate-500 mr-1 font-semibold">Pilih Bulan:</label>
              <input
                type="month"
                value={selectedYearMonth}
                onChange={(e) => setSelectedYearMonth(e.target.value)}
                className="bg-transparent focus:outline-hidden text-slate-900 font-extrabold cursor-pointer"
              />
            </div>

            {/* Filter Therapist Dropdown */}
            <div className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 shadow-2xs">
              <User className="w-4 h-4 text-slate-500" />
              <select
                value={selectedTherapist}
                onChange={(e) => setSelectedTherapist(e.target.value)}
                className="bg-transparent focus:outline-hidden text-slate-800 font-bold cursor-pointer max-w-[180px] truncate"
              >
                <option value="all">Semua Terapis / Petugas</option>
                {Array.from(therapistMap.values()).map((t) => (
                  <option key={t.therapistName} value={t.therapistName}>
                    {t.therapistName} ({t.patients.length} pasien)
                  </option>
                ))}
              </select>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari pasien / RM / kode..."
                className="pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-teal-500 text-slate-800 w-44 font-medium"
              />
            </div>

            {/* Loading Indicator */}
            {isLoading && (
              <div className="flex items-center gap-1.5 text-xs text-teal-700 font-bold bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-200">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Sinkronisasi Data...</span>
              </div>
            )}
          </div>

          {/* Export PDF & EXCEL Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 rounded-xl transition-all cursor-pointer shadow-2xs"
              title="Unduh Laporan Excel Bulanan Terapis"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
              <span className="hidden sm:inline">Excel</span>
            </button>

            <button
              onClick={handleExportPDF}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-extrabold text-white bg-teal-700 hover:bg-teal-800 rounded-xl transition-all cursor-pointer shadow-md"
              title="Unduh PDF Laporan Bulanan Per Terapis"
            >
              <Download className="w-4 h-4" />
              <span>Unduh PDF (.pdf)</span>
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {drilldownTherapist && drilldownGroup ? (
          <div className="space-y-4">
            <button
              onClick={() => setDrilldownTherapist(null)}
              className="flex items-center gap-1.5 text-xs font-bold text-teal-700 hover:text-teal-900 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Kembali ke Ringkasan Bulanan</span>
            </button>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-teal-600 text-white font-black flex items-center justify-center text-base shadow-xs shrink-0">
                {drilldownTherapist.charAt(0).toUpperCase()}
              </div>
              <div>
                <h4 className="font-black text-base text-slate-900">{drilldownTherapist}</h4>
                <p className="text-xs text-slate-500 font-semibold">Rincian Harian — {selectedMonthName} • {drilldownGroup.boxTitle}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-teal-50 border border-teal-200 rounded-xl">
                <p className="text-[11px] font-bold text-teal-800">Total Bulan Ini</p>
                <p className="text-xl font-black text-teal-950">{drilldownGroup.patients.length} Pasien</p>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <p className="text-[11px] font-bold text-slate-700">Rajal</p>
                <p className="text-xl font-black text-slate-900">{drilldownGroup.rajalCount} Pasien</p>
              </div>
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
                <p className="text-[11px] font-bold text-blue-800">Ranap</p>
                <p className="text-xl font-black text-blue-950">{drilldownGroup.ranapCount} Pasien</p>
              </div>
            </div>

            <div className="border border-slate-200 rounded-2xl overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-2.5 w-6"></th>
                    <th className="p-2.5">Tanggal</th>
                    <th className="p-2.5 text-center">Total Pasien</th>
                    <th className="p-2.5 text-center">Rajal</th>
                    <th className="p-2.5 text-center">Ranap</th>
                    <th className="p-2.5">Rincian Kode Tindakan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dailyBreakdown.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-4 text-center text-slate-400 italic">
                        Belum ada data harian untuk terapis ini di bulan {selectedMonthName}.
                      </td>
                    </tr>
                  ) : (
                    dailyBreakdown.map((day) => {
                      const isExpanded = expandedDates.has(day.date);
                      const dateLabel = day.date === 'Tidak Diketahui'
                        ? day.date
                        : new Date(day.date).toLocaleDateString('id-ID', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
                      return (
                        <React.Fragment key={day.date}>
                          <tr
                            className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                            onClick={() => toggleDateExpand(day.date)}
                          >
                            <td className="p-2.5 text-center text-slate-400">
                              {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                            </td>
                            <td className="p-2.5 font-bold text-slate-900">{dateLabel}</td>
                            <td className="p-2.5 text-center font-black text-teal-800">{day.total}</td>
                            <td className="p-2.5 text-center font-semibold text-slate-700">{day.rajal}</td>
                            <td className="p-2.5 text-center font-semibold text-blue-800">{day.ranap}</td>
                            <td className="p-2.5">
                              <div className="flex flex-wrap gap-1">
                                {Object.entries(day.actionCounts).map(([code, count]) => (
                                  <span key={code} className="px-1.5 py-0.5 bg-teal-50 border border-teal-200 text-teal-800 text-[10px] font-bold rounded">
                                    {code}: {count}
                                  </span>
                                ))}
                              </div>
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr>
                              <td colSpan={6} className="p-0 bg-slate-50/60">
                                <table className="w-full text-[11px] text-left">
                                  <thead className="text-slate-500 font-bold border-b border-slate-200">
                                    <tr>
                                      <th className="p-2 pl-8">Nama Pasien</th>
                                      <th className="p-2">No. RM</th>
                                      <th className="p-2">Kode Tindakan</th>
                                      <th className="p-2">Waktu</th>
                                      <th className="p-2 text-center">Tipe</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-200">
                                    {day.patients.map((p: any, idx: number) => (
                                      <tr key={`${day.date}-${p.id || idx}`}>
                                        <td className="p-2 pl-8 font-bold text-slate-800">
                                          {p.patientName}
                                          {p.isWarning && <span className="ml-1 text-rose-600">🛑</span>}
                                        </td>
                                        <td className="p-2 font-mono text-slate-600">{p.medicalRecordNo}</td>
                                        <td className="p-2 text-teal-800">{p.actionCode || '-'}</td>
                                        <td className="p-2 font-mono text-slate-500">
                                          {(p.completedAt || p.createdAt) ? new Date(p.completedAt || p.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'}
                                        </td>
                                        <td className="p-2 text-center">
                                          {p.isRanap ? (
                                            <span className="px-1.5 py-0.5 bg-blue-100 text-blue-900 font-black text-[9px] rounded">RANAP</span>
                                          ) : (
                                            <span className="px-1.5 py-0.5 bg-slate-100 text-slate-700 font-semibold text-[9px] rounded">RAJAL</span>
                                          )}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
          ) : (
          <>
          {/* Executive Metrics Overview */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 bg-teal-50 border border-teal-200 rounded-2xl">
              <div className="flex items-center gap-2 text-xs text-teal-800 font-bold mb-1">
                <CheckCircle2 className="w-4 h-4 text-teal-600" />
                <span>Total Selesai ({selectedMonthName})</span>
              </div>
              <p className="text-2xl font-black text-teal-950">{totalCompletedMonth} <span className="text-xs font-semibold text-teal-700">Pasien</span></p>
            </div>

            <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-2xl">
              <div className="flex items-center gap-2 text-xs text-blue-800 font-bold mb-1">
                <Hospital className="w-4 h-4 text-blue-600" />
                <span>Pasien Ranap (🛏️)</span>
              </div>
              <p className="text-2xl font-black text-blue-950">{totalRanapMonth} <span className="text-xs font-semibold text-blue-700">Pasien</span></p>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl">
              <div className="flex items-center gap-2 text-xs text-slate-700 font-bold mb-1">
                <User className="w-4 h-4 text-slate-600" />
                <span>Pasien Rajal / Outpatient</span>
              </div>
              <p className="text-2xl font-black text-slate-900">{totalRajalMonth} <span className="text-xs font-semibold text-slate-600">Pasien</span></p>
            </div>

            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl">
              <div className="flex items-center gap-2 text-xs text-amber-800 font-bold mb-1">
                <Trophy className="w-4 h-4 text-amber-600" />
                <span>Capaian Tertinggi</span>
              </div>
              <p className="text-sm font-black text-amber-950 truncate" title={topTherapist}>
                {topTherapist}
              </p>
              <span className="text-[11px] text-amber-800 font-extrabold">{topCount} pasien dikerjakan</span>
            </div>
          </div>

          {/* Grouped Lists per Therapist */}
          <div className="space-y-5">
            <h4 className="font-extrabold text-sm text-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-teal-700" />
                <span>Kelompok Data Pasien per Terapis / Petugas — Periode {selectedMonthName}</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold">
                <Database className="w-3.5 h-3.5 text-teal-600" />
                <span>Tersimpan di Cloud Database & Arsip Harian</span>
              </div>
            </h4>

            {therapistGroups.length === 0 ? (
              <div className="p-10 text-center bg-slate-50 border border-dashed border-slate-300 rounded-2xl">
                <FileText className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                <p className="text-sm font-bold text-slate-700">Belum ada pasien yang selesai dikerjakan di bulan {selectedMonthName}.</p>
                <p className="text-xs text-slate-500 mt-1">Setiap pasien yang diselesaikan pada antrian harian otomatis tersimpan ke arsip dan rekap bulanan.</p>
              </div>
            ) : (
              therapistGroups.map((group) => (
                <div key={group.therapistName} className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
                  {/* Therapist Group Header */}
                  <div className="bg-slate-900 text-white p-3.5 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-teal-600 text-white font-black flex items-center justify-center text-sm shadow-xs">
                        {group.therapistName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h5 className="font-black text-sm text-white flex items-center gap-2">
                          <button
                            onClick={() => { setDrilldownTherapist(group.therapistName); setExpandedDates(new Set()); }}
                            className="hover:underline decoration-2 underline-offset-2 cursor-pointer text-left"
                            title={`Lihat tabel harian ${group.therapistName}`}
                          >
                            {group.therapistName}
                          </button>
                          <span className="text-[11px] font-semibold text-slate-300 bg-slate-800 px-2 py-0.5 rounded-md">
                            {group.boxTitle} ({group.location})
                          </span>
                        </h5>
                        <div className="flex items-center gap-2 text-[11px] text-slate-300 font-medium">
                          <span>Total Dikerjakan: <strong className="text-teal-400 font-black">{group.patients.length} Pasien</strong></span>
                          <span>•</span>
                          <span>Ranap: <strong className="text-blue-300 font-bold">{group.ranapCount}</strong></span>
                          <span>•</span>
                          <span>Rajal: <strong className="text-emerald-300 font-bold">{group.rajalCount}</strong></span>
                        </div>
                      </div>
                    </div>

                    {/* Action Code Summary Badges */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      {Object.entries(group.actionCounts).map(([code, count]) => (
                        <span key={code} className="px-2 py-0.5 bg-teal-950 text-teal-300 border border-teal-800 text-[10px] font-extrabold rounded-md flex items-center gap-1">
                          <Tag className="w-2.5 h-2.5 text-teal-400" />
                          {code}: <span className="text-white">{count}</span>
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Patient List Table for this Therapist */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                        <tr>
                          <th className="p-2.5 w-12 text-center">No</th>
                          <th className="p-2.5">Waktu Selesai</th>
                          <th className="p-2.5">No. Antrean</th>
                          <th className="p-2.5">Nama Pasien</th>
                          <th className="p-2.5">No. RM</th>
                          <th className="p-2.5">Kode Tindakan</th>
                          <th className="p-2.5">Diagnosa / Catatan</th>
                          <th className="p-2.5 text-center">Tipe</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {group.patients.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="p-4 text-center text-slate-400 italic">
                              Tidak ada pasien untuk terapis ini di bulan {selectedMonthName}.
                            </td>
                          </tr>
                        ) : (
                          group.patients.map((p, idx) => {
                            const completedTime = p.completedAt
                              ? new Date(p.completedAt).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                              : new Date(p.createdAt).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

                            return (
                              <tr key={`monthly-p-${p.id || idx}-${idx}`} className="hover:bg-slate-50/80 transition-colors">
                                <td className="p-2.5 text-center font-bold text-slate-400">{idx + 1}</td>
                                <td className="p-2.5 text-slate-600 font-mono text-[11px]">{completedTime}</td>
                                <td className="p-2.5 font-black text-slate-900">{p.queueNumber}</td>
                                <td className="p-2.5 font-bold text-slate-900">
                                  {p.patientName}
                                  {p.isWarning && <span className="ml-1 text-rose-600 font-normal">🛑</span>}
                                </td>
                                <td className="p-2.5 font-mono text-slate-600">{p.medicalRecordNo}</td>
                                <td className="p-2.5 font-bold text-teal-800">
                                  {p.actionCode ? (
                                    <span className="px-2 py-0.5 bg-teal-50 border border-teal-200 rounded text-[11px]">
                                      {p.actionCode}
                                    </span>
                                  ) : (
                                    <span className="text-slate-400 font-normal italic">-</span>
                                  )}
                                </td>
                                <td className="p-2.5 text-slate-600 max-w-xs truncate">
                                  {p.diagnosis || p.note || '-'}
                                </td>
                                <td className="p-2.5 text-center">
                                  {p.isRanap ? (
                                    <span className="px-2 py-0.5 bg-blue-100 text-blue-900 border border-blue-300 font-black text-[10px] rounded-md inline-flex items-center gap-0.5">
                                      🛏️ RANAP
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 bg-slate-100 text-slate-700 font-semibold text-[10px] rounded-md">
                                      RAJAL
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))
            )}
          </div>
          </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-between items-center shrink-0">
          <p className="text-xs text-slate-500 font-medium hidden sm:block">
            * Data dikelompokkan secara otomatis berdasarkan terapis/petugas yang bertugas pada setiap kotak antrian.
          </p>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-xs cursor-pointer ml-auto"
          >
            Tutup
          </button>
        </div>

      </div>
    </div>
  );
};
