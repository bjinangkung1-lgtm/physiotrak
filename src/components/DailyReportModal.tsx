import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, FileText, Download, FileSpreadsheet, Calendar, CheckCircle2, 
  AlertOctagon, Users, Clock, Timer, Activity, User, Search, 
  RefreshCw, Layers, Table, Check, ChevronDown, ChevronUp, 
  ShieldCheck, BedDouble, Stethoscope, Sparkles, Filter,
  BarChart3, TrendingUp, Award, Zap, ChevronRight, UserCheck, ArrowUpRight,
  MessageSquare
} from 'lucide-react';
import { QueueBox, PatientItem, CallHistoryRecord, DailyPatientVisit } from '../types';
import { 
  exportToExcel, 
  exportToPDF, 
  exportTherapistDailyPDF, 
  exportTherapistDailyExcel, 
  DailyReportData, 
  TherapistDailyLogbookData 
} from '../utils/export';
import { calculatePatientTimeMetrics, computeResponseTimeAnalytics } from '../utils/responseTimeAnalytics';
import { getLocalDateStringWIB } from '../utils/dateHelper';
import { databaseService } from '../utils/databaseService';
import { ActionCodeBadge } from './ActionCodeBadge';
import { KNOWN_EQUIPMENT } from '../utils/equipmentAnalytics';
import { parseActionTokens } from '../utils/actionCodeUtils';
import { getTherapistCategory, getCanonicalTherapistKey, TherapyCategory } from '../utils/savedOfficersService';

interface DailyReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  boxes: QueueBox[];
  patients: PatientItem[];
  callLogs: CallHistoryRecord[];
}

export const DailyReportModal: React.FC<DailyReportModalProps> = ({
  isOpen,
  onClose,
  boxes,
  patients: livePatients,
  callLogs,
}) => {
  const todayWIB = getLocalDateStringWIB();
  const [selectedDate, setSelectedDate] = useState<string>(todayWIB);
  const [availableDates, setAvailableDates] = useState<string[]>([todayWIB]);
  const [selectedTherapistBoxId, setSelectedTherapistBoxId] = useState<string>('all');
  const [shiftFilter, setShiftFilter] = useState<'all' | 'morning' | 'afternoon'>('all');
  const [viewMode, setViewMode] = useState<'grouped' | 'table'>('grouped');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'active' | 'warning' | 'ranap'>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'fisio' | 'okupasi' | 'wicara'>('all');
  const [showAnalyticsOverview, setShowAnalyticsOverview] = useState<boolean>(true);
  
  // Data fetching state
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [archivedVisits, setArchivedVisits] = useState<DailyPatientVisit[]>([]);
  const [collapsedTherapists, setCollapsedTherapists] = useState<Record<string, boolean>>({});

  // 1. Fetch persistent daily archive from Cloud Firestore & Server
  const fetchArchiveData = async (targetDate: string, isManualRefresh = false) => {
    if (isManualRefresh) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const res = await databaseService.getDailyDatabase(targetDate);
      if (res && Array.isArray(res.visits)) {
        setArchivedVisits(res.visits);
      } else {
        setArchivedVisits([]);
      }

      if (res && Array.isArray(res.allDates) && res.allDates.length > 0) {
        const uniqueDates = Array.from(new Set([todayWIB, ...res.allDates])).sort().reverse();
        setAvailableDates(uniqueDates);
      }
    } catch (err) {
      console.error('Failed to load daily archive for report:', err);
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

  // 2. Multi-source resilient data merge:
  // If selectedDate is TODAY, merge archived visits with currently active queue patients.
  // This guarantees:
  // - Before "Bersihkan Antrean": Realtime status of all active patients is reflected.
  // - After "Bersihkan Antrean": ALL patients remain 100% intact and visible from persistent cloud archives!
  // If selectedDate is a PAST DATE, load strictly from the persistent cloud archive.
  const unifiedPatients: PatientItem[] = useMemo(() => {
    const isToday = selectedDate === todayWIB;
    const patientMap = new Map<string, PatientItem>();

    // Step A: Load from persistent archive
    archivedVisits.forEach((v) => {
      if (!v || !v.id) return;
      const box = boxes.find(b => b.id === v.boxId);
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
      patientMap.set(v.id, unified);
    });

    // Step B: If viewing today, overlay active live patients (capturing real-time edits or additions)
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

    // Sort chronologically by registration time or queue number
    return Array.from(patientMap.values()).sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeA - timeB;
    });
  }, [archivedVisits, livePatients, selectedDate, todayWIB, boxes]);

  // Canonical deduplicated therapist boxes - 100% matched with Fisio, Okupasi, and Wicara boxes in the main view
  const canonicalTherapistBoxes = useMemo(() => {
    // 1. Get canonical boxes (ignoring legacy duplicate keys)
    const unique = boxes.filter((box, idx, arr) => {
      if (!box) return false;
      const key = getCanonicalTherapistKey(box.officerName, box.location, box.id);
      if (key === 'ft-tri' || key === 'ft-bustomi') return false;
      return arr.findIndex(b => getCanonicalTherapistKey(b.officerName, b.location, b.id) === key) === idx;
    });

    // 2. Also ensure any box referenced by unifiedPatients is included if it exists in boxes
    const seenIds = new Set(unique.map(b => b.id));
    unifiedPatients.forEach(p => {
      if (p.boxId && !seenIds.has(p.boxId)) {
        const found = boxes.find(b => b.id === p.boxId);
        if (found) {
          unique.push(found);
          seenIds.add(found.id);
        }
      }
    });

    return unique;
  }, [boxes, unifiedPatients]);

  // 3. Filter patients according to user search, therapist, shift, category, and status
  const filteredPatients = useMemo(() => {
    return unifiedPatients.filter((p) => {
      // Therapist / Box filter
      if (selectedTherapistBoxId !== 'all' && p.boxId !== selectedTherapistBoxId) {
        return false;
      }

      // Category filter (Fisio, Okupasi, Wicara)
      if (categoryFilter !== 'all') {
        const pBox = canonicalTherapistBoxes.find(b => b.id === p.boxId);
        const pCat = pBox ? getTherapistCategory(pBox.officerName, pBox.location, pBox.category) : 'fisio';
        if (pCat !== categoryFilter) {
          return false;
        }
      }

      // Shift filter (morning: < 14:00, afternoon: >= 14:00)
      if (shiftFilter !== 'all' && p.createdAt) {
        const timeObj = new Date(p.createdAt);
        if (!isNaN(timeObj.getTime())) {
          const hour = timeObj.getHours();
          if (shiftFilter === 'morning' && hour >= 14) return false;
          if (shiftFilter === 'afternoon' && hour < 14) return false;
        }
      }

      // Status filter
      if (statusFilter === 'completed' && !p.completed) return false;
      if (statusFilter === 'active' && p.completed) return false;
      if (statusFilter === 'warning' && !p.isWarning) return false;
      if (statusFilter === 'ranap' && !p.isRanap) return false;

      // Search Query filter (Name, RM, Queue Number, Diagnosis, Action Code)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = p.patientName.toLowerCase().includes(q);
        const matchRM = p.medicalRecordNo.toLowerCase().includes(q);
        const matchQueue = p.queueNumber.toLowerCase().includes(q);
        const matchDiag = (p.diagnosis || '').toLowerCase().includes(q);
        const matchAction = (p.actionCode || '').toLowerCase().includes(q);
        if (!matchName && !matchRM && !matchQueue && !matchDiag && !matchAction) {
          return false;
        }
      }

      return true;
    });
  }, [unifiedPatients, selectedTherapistBoxId, categoryFilter, shiftFilter, statusFilter, searchQuery, canonicalTherapistBoxes]);

  // 4. Group data per Therapist / Box
  interface TherapistGroup {
    boxId: string;
    officerName: string;
    boxTitle: string;
    location: string;
    category: TherapyCategory;
    color: string;
    totalPatients: number;
    completedCount: number;
    activeCount: number;
    ranapCount: number;
    warningCount: number;
    avgResponseMinutes: number;
    complianceRate: number;
    topActions: { code: string; count: number }[];
    patients: PatientItem[];
  }

  const therapistGroups: TherapistGroup[] = useMemo(() => {
    const groups: TherapistGroup[] = [];

    canonicalTherapistBoxes.forEach((box) => {
      const boxId = box.id;
      const therapistPatients = unifiedPatients.filter(p => p.boxId === boxId);
      const cat = getTherapistCategory(box.officerName, box.location, box.category);

      const total = therapistPatients.length;
      const completed = therapistPatients.filter(p => p.completed).length;
      const active = total - completed;
      const ranap = therapistPatients.filter(p => p.isRanap).length;
      const warning = therapistPatients.filter(p => p.isWarning).length;

      // Calculate time metrics
      let totalWait = 0;
      let compliantCount = 0;
      let countWithWait = 0;
      const actionCountMap: Record<string, number> = {};

      therapistPatients.forEach((p) => {
        // Respon time (input -> diceklis) hanya dihitung dari pasien yang
        // sudah selesai; pasien yang masih antre belum punya durasi respon
        // final, jadi tidak boleh ikut menggeser rata-rata/kepatuhan SPM.
        if (p.completed) {
          const metrics = calculatePatientTimeMetrics(p, boxes);
          totalWait += metrics.responseTimeMinutes;
          countWithWait++;
          if (metrics.isCompliant) compliantCount++;
        }

        // Action code distribution
        if (p.actionCode) {
          const codes = p.actionCode.split(/[\s+,/]+/).filter(c => c.length > 0);
          codes.forEach(c => {
            const clean = c.toUpperCase();
            actionCountMap[clean] = (actionCountMap[clean] || 0) + 1;
          });
        }
      });

      const avgWait = countWithWait > 0 ? Math.round(totalWait / countWithWait) : 0;
      const compliance = countWithWait > 0 ? Math.round((compliantCount / countWithWait) * 100) : 100;

      const topActions = Object.entries(actionCountMap)
        .map(([code, count]) => ({ code, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 4);

      // Filtered patient list for this group (matching current filters)
      const groupFilteredPatients = filteredPatients.filter(p => p.boxId === boxId);

      const resolvedOfficer = (box.officerName || box.title.split('(')[0].trim()).trim();

      groups.push({
        boxId,
        officerName: resolvedOfficer,
        boxTitle: box.title.split('(')[0].trim(),
        location: box.location || (cat === 'okupasi' ? 'Ruang Terapi Okupasi' : cat === 'wicara' ? 'Ruang Terapi Wicara' : 'Instalasi Rehabilitasi Medik'),
        category: cat,
        color: box.color || 'blue',
        totalPatients: total,
        completedCount: completed,
        activeCount: active,
        ranapCount: ranap,
        warningCount: warning,
        avgResponseMinutes: avgWait,
        complianceRate: compliance,
        topActions,
        patients: groupFilteredPatients,
      });
    });

    // Sort: groups with patients first (descending), then alphabetical by officer name
    return groups.sort((a, b) => {
      if (b.totalPatients !== a.totalPatients) {
        return b.totalPatients - a.totalPatients;
      }
      return a.officerName.localeCompare(b.officerName);
    });
  }, [canonicalTherapistBoxes, unifiedPatients, filteredPatients, boxes]);

  // Divisional breakdowns & counts (exact matching with Fisio, Okupasi, and Wicara boxes)
  const fisioGroups = useMemo(() => therapistGroups.filter(g => g.category === 'fisio'), [therapistGroups]);
  const okupasiGroups = useMemo(() => therapistGroups.filter(g => g.category === 'okupasi'), [therapistGroups]);
  const wicaraGroups = useMemo(() => therapistGroups.filter(g => g.category === 'wicara'), [therapistGroups]);
  const activeServingCount = useMemo(() => therapistGroups.filter(g => g.totalPatients > 0).length, [therapistGroups]);

  // Filtered therapist groups for display (based on categoryFilter and selectedTherapistBoxId)
  const displayedTherapistGroups = useMemo(() => {
    let list = therapistGroups;
    if (categoryFilter !== 'all') {
      list = list.filter(g => g.category === categoryFilter);
    }
    if (selectedTherapistBoxId !== 'all') {
      list = list.filter(g => g.boxId === selectedTherapistBoxId);
    }
    return list;
  }, [therapistGroups, categoryFilter, selectedTherapistBoxId]);

  // Overall Global Analytics
  const totalCount = filteredPatients.length;
  const completedCount = filteredPatients.filter(p => p.completed).length;
  const activeCount = totalCount - completedCount;
  const warningCount = filteredPatients.filter(p => p.isWarning).length;
  const ranapCount = filteredPatients.filter(p => p.isRanap).length;
  const rajalCount = totalCount - ranapCount;
  const overallAnalytics = useMemo(() => {
    return computeResponseTimeAnalytics(filteredPatients, boxes);
  }, [filteredPatients, boxes]);

  // Selected therapist group if a specific therapist is active
  const selectedTherapistGroup = useMemo(() => {
    if (selectedTherapistBoxId === 'all') return null;
    return therapistGroups.find(g => g.boxId === selectedTherapistBoxId) || null;
  }, [selectedTherapistBoxId, therapistGroups]);

  // AI Daily Executive Digest / Summary
  const executiveDigest = useMemo(() => {
    const total = filteredPatients.length;
    if (total === 0) {
      return {
        headline: `Belum ada data kunjungan pada ${selectedDate}${shiftFilter !== 'all' ? ` (Shift: ${shiftFilter === 'morning' ? 'Pagi' : 'Siang/Sore'})` : ''}.`,
        details: 'Silakan pilih tanggal atau sesuaikan filter untuk melihat catatan pelayanan.',
        peakHours: '-',
        topModality: '-',
        topDiagnosis: '-',
        spmNote: 'Normal',
        status: 'idle' as const
      };
    }

    // Peak hours calculation
    const hourHistogram: Record<number, number> = {};
    filteredPatients.forEach(p => {
      if (p.createdAt) {
        const d = new Date(p.createdAt);
        if (!isNaN(d.getTime())) {
          const h = d.getHours();
          hourHistogram[h] = (hourHistogram[h] || 0) + 1;
        }
      }
    });

    let peakHour = 9;
    let maxHourVolume = 0;
    Object.entries(hourHistogram).forEach(([hStr, vol]) => {
      if (vol > maxHourVolume) {
        maxHourVolume = vol;
        peakHour = parseInt(hStr, 10);
      }
    });
    const peakWindowStr = maxHourVolume > 0
      ? `${String(peakHour).padStart(2, '0')}.00 - ${String(peakHour + 1).padStart(2, '0')}.00 WIB (${maxHourVolume} pasien)`
      : 'Terdistribusi merata';

    // Top modalities
    const modCounts: Record<string, number> = {};
    filteredPatients.forEach(p => {
      const tokens = parseActionTokens(p.actionCode);
      tokens.forEach(t => {
        const num = parseInt(t, 10);
        const eq = KNOWN_EQUIPMENT[num];
        const name = eq ? eq.shortName : t;
        modCounts[name] = (modCounts[name] || 0) + 1;
      });
    });
    const topMods = Object.entries(modCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([m, c]) => `${m} (${c})`)
      .join(', ');

    // Top diagnoses
    const diagCounts: Record<string, number> = {};
    filteredPatients.forEach(p => {
      const d = (p.diagnosis || '').trim();
      if (d && d !== '-' && d.length > 2) {
        const cleanDiag = d.split('/')[0].split('-')[0].trim();
        diagCounts[cleanDiag] = (diagCounts[cleanDiag] || 0) + 1;
      }
    });
    const topDiags = Object.entries(diagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([diag, c]) => `${diag} (${c})`)
      .join(', ');

    const spmRate = overallAnalytics.spmComplianceRate;
    const isCompliant = spmRate >= 80;

    return {
      headline: `Hari ini tercatat ${total} tindakan dengan ${completedCount} pasien selesai (${total > 0 ? Math.round((completedCount / total) * 100) : 0}%) dan ${ranapCount} rawat inap. Rata-rata waktu tunggu ${overallAnalytics.avgResponseMinutes} menit (${isCompliant ? 'Sesuai SPM' : 'Perlu Atensi'}).`,
      details: `Puncak kedatangan: ${peakWindowStr}. Modalitas terapi dominan: ${topMods || 'Tindakan umum'}. Diagnosa terbanyak: ${topDiags || 'Pemeriksaan klinis rutin'}.`,
      peakHours: peakWindowStr,
      topModality: topMods || '-',
      topDiagnosis: topDiags || '-',
      spmNote: `${spmRate}% SPM`,
      status: isCompliant ? ('optimal' as const) : ('attention' as const)
    };
  }, [filteredPatients, selectedDate, shiftFilter, completedCount, ranapCount, overallAnalytics]);

  // Sebaran 8 Alat Terapi Hari Ini
  const eightEquipmentStats = useMemo(() => {
    const targetCodes = [2, 6, 4, 1, 15, 18, 47, 74];
    const counts: Record<number, number> = {};
    targetCodes.forEach(c => { counts[c] = 0; });

    filteredPatients.forEach(p => {
      const tokens = parseActionTokens(p.actionCode);
      tokens.forEach(t => {
        const codeNum = parseInt(t, 10);
        if (counts[codeNum] !== undefined) {
          counts[codeNum]++;
        }
      });
    });

    const totalModalityActions = Object.values(counts).reduce((a, b) => a + b, 0);

    return targetCodes.map(c => {
      const def = KNOWN_EQUIPMENT[c];
      const count = counts[c] || 0;
      const percentage = totalModalityActions > 0 ? Math.round((count / totalModalityActions) * 100) : 0;
      return {
        code: c,
        name: def?.shortName || `Alat ${c}`,
        fullName: def?.name || '',
        category: def?.category || '',
        theme: def?.theme,
        count,
        percentage
      };
    }).sort((a, b) => b.count - a.count);
  }, [filteredPatients]);

  // Top Diagnosa ICF List
  const topDiagnosesList = useMemo(() => {
    const diagCounts: Record<string, number> = {};
    filteredPatients.forEach(p => {
      const d = (p.diagnosis || '').trim();
      if (d && d !== '-' && d.length > 2) {
        const clean = d.split('/')[0].split('-')[0].trim();
        diagCounts[clean] = (diagCounts[clean] || 0) + 1;
      }
    });

    return Object.entries(diagCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [filteredPatients]);

  // Toggle Collapse Group
  const toggleCollapseTherapist = (boxId: string) => {
    setCollapsedTherapists(prev => ({
      ...prev,
      [boxId]: !prev[boxId]
    }));
  };

  // Export handlers for Collective Unit Report
  const handleExportExcel = () => {
    const reportData: DailyReportData = {
      date: selectedDate,
      generatedAt: new Date().toLocaleString('id-ID'),
      boxes,
      patients: filteredPatients,
      callLogs,
    };
    exportToExcel(reportData, `Laporan_Harian_IRM_${selectedDate}.xlsx`);
  };

  const handleExportPDF = () => {
    const reportData: DailyReportData = {
      date: selectedDate,
      generatedAt: new Date().toLocaleString('id-ID'),
      boxes,
      patients: filteredPatients,
      callLogs,
    };
    exportToPDF(reportData, `Laporan_Harian_IRM_${selectedDate}.pdf`);
  };

  // Individual Therapist Export Handlers
  const handleExportTherapistPDF = (group: TherapistGroup) => {
    const therapistPatients = group.patients.length > 0 ? group.patients : unifiedPatients.filter(p => p.boxId === group.boxId);
    const logbookData: TherapistDailyLogbookData = {
      date: selectedDate,
      therapistName: group.officerName,
      boxTitle: group.boxTitle,
      location: group.location,
      generatedAt: new Date().toLocaleString('id-ID'),
      patients: therapistPatients,
      boxes,
    };
    exportTherapistDailyPDF(logbookData);
  };

  const handleExportTherapistExcel = (group: TherapistGroup) => {
    const therapistPatients = group.patients.length > 0 ? group.patients : unifiedPatients.filter(p => p.boxId === group.boxId);
    const logbookData: TherapistDailyLogbookData = {
      date: selectedDate,
      therapistName: group.officerName,
      boxTitle: group.boxTitle,
      location: group.location,
      generatedAt: new Date().toLocaleString('id-ID'),
      patients: therapistPatients,
      boxes,
    };
    exportTherapistDailyExcel(logbookData);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-[96vw] xl:max-w-7xl 2xl:max-w-[1520px] max-h-[94vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
        
        {/* ================= HEADER ================= */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-4 sm:px-6 flex items-center justify-between shrink-0 border-b border-indigo-800/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/30 border border-indigo-400/30 flex items-center justify-center text-indigo-300 shadow-inner">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-base sm:text-lg tracking-tight text-white">
                  Laporan Harian Antrean & Kinerja IRM
                </h3>
                <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  <ShieldCheck className="w-3 h-3" />
                  Anti-Hilang (Cloud Sync)
                </span>
              </div>
              <p className="text-xs text-indigo-200/80 font-medium">
                Data tersimpan abadi di Cloud Firestore & Server • Tetap utuh kapan pun antrean dibersihkan
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchArchiveData(selectedDate, true)}
              disabled={isRefreshing || isLoading}
              className="p-2 rounded-xl text-indigo-200 hover:text-white hover:bg-white/10 transition-all cursor-pointer title-tooltip"
              title="Sinkron Ulang dari Cloud Database"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-sky-400' : ''}`} />
            </button>
            <button 
              onClick={onClose} 
              className="text-white/80 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ================= TOOLBAR & CONTROLS ================= */}
        <div className="bg-slate-50 border-b border-slate-200 p-3 sm:px-6 space-y-3 shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            
            {/* Left: Date, Shift, and Therapist Dropdown Controls */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Date Picker */}
              <div className="flex items-center gap-2 bg-white px-3 py-1.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 shadow-2xs">
                <Calendar className="w-4 h-4 text-indigo-600 shrink-0" />
                <span className="hidden sm:inline">Tanggal:</span>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => {
                    if (e.target.value) {
                      setSelectedDate(e.target.value);
                    }
                  }}
                  className="bg-transparent focus:outline-hidden text-slate-900 font-extrabold cursor-pointer"
                />
              </div>

              {/* Shift Filter Dropdown */}
              <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 shadow-2xs">
                <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span className="hidden md:inline text-slate-500 font-semibold">Shift:</span>
                <select
                  value={shiftFilter}
                  onChange={(e) => setShiftFilter(e.target.value as any)}
                  className="bg-transparent font-extrabold text-slate-800 focus:outline-hidden cursor-pointer"
                >
                  <option value="all">Semua Shift</option>
                  <option value="morning">Pagi (07.00 - 14.00)</option>
                  <option value="afternoon">Siang/Sore (&gt; 14.00)</option>
                </select>
              </div>

              {/* Therapist Dropdown Selector */}
              <div className="flex items-center gap-2 bg-white px-3 py-1.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 shadow-2xs">
                <User className="w-4 h-4 text-indigo-600 shrink-0" />
                <span className="text-slate-500 font-semibold hidden md:inline">Terapis:</span>
                <select
                  value={selectedTherapistBoxId}
                  onChange={(e) => setSelectedTherapistBoxId(e.target.value)}
                  className="bg-transparent font-extrabold text-slate-900 focus:outline-hidden cursor-pointer max-w-[210px] sm:max-w-[280px] truncate"
                >
                  <option value="all">🌐 Semua Terapis ({therapistGroups.length} Terapis • {unifiedPatients.length} Pasien)</option>
                  {fisioGroups.length > 0 && (
                    <optgroup label={`─── FISIOTERAPI (${fisioGroups.length} Terapis) ───`}>
                      {fisioGroups.map((g) => (
                        <option key={g.boxId} value={g.boxId}>
                          {g.officerName} ({g.totalPatients} Pasien)
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {okupasiGroups.length > 0 && (
                    <optgroup label={`─── TERAPI OKUPASI (${okupasiGroups.length} Terapis) ───`}>
                      {okupasiGroups.map((g) => (
                        <option key={g.boxId} value={g.boxId}>
                          {g.officerName} ({g.totalPatients} Pasien)
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {wicaraGroups.length > 0 && (
                    <optgroup label={`─── TERAPI WICARA (${wicaraGroups.length} Terapis) ───`}>
                      {wicaraGroups.map((g) => (
                        <option key={g.boxId} value={g.boxId}>
                          {g.officerName} ({g.totalPatients} Pasien)
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>

              {/* Quick Today Button */}
              {selectedDate !== todayWIB && (
                <button
                  onClick={() => setSelectedDate(todayWIB)}
                  className="px-2.5 py-1.5 bg-indigo-100 hover:bg-indigo-200 text-indigo-800 text-xs font-bold rounded-xl transition-all cursor-pointer"
                >
                  Hari Ini
                </button>
              )}
            </div>

            {/* Right: Dynamic Export Buttons (Adaptive for Collective or Therapist-Specific) */}
            <div className="flex items-center gap-2">
              {selectedTherapistGroup ? (
                <>
                  <button
                    onClick={() => setSelectedTherapistBoxId('all')}
                    className="px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
                    title="Kembali ke Laporan Kolektif Seluruh Unit"
                  >
                    Tampilkan Semua
                  </button>

                  <button
                    onClick={() => handleExportTherapistExcel(selectedTherapistGroup)}
                    id="btn-export-therapist-excel"
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-extrabold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 rounded-xl transition-all cursor-pointer shadow-2xs hover:shadow-xs active:scale-98"
                    title={`Unduh Logbook Excel Pasien ${selectedTherapistGroup.officerName}`}
                  >
                    <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
                    <span>Excel Logbook ({selectedTherapistGroup.officerName.split(' ')[0]})</span>
                  </button>

                  <button
                    onClick={() => handleExportTherapistPDF(selectedTherapistGroup)}
                    id="btn-export-therapist-pdf"
                    className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-extrabold text-white bg-indigo-700 hover:bg-indigo-800 rounded-xl transition-all cursor-pointer shadow-2xs hover:shadow-xs active:scale-98"
                    title={`Unduh / Cetak Logbook PDF Resmi ${selectedTherapistGroup.officerName}`}
                  >
                    <Download className="w-4 h-4" />
                    <span>PDF Logbook ({selectedTherapistGroup.officerName.split(' ')[0]})</span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={handleExportExcel}
                    id="btn-export-excel-daily"
                    className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-extrabold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 rounded-xl transition-all cursor-pointer shadow-2xs hover:shadow-xs active:scale-98"
                    title="Ekspor Laporan Harian Lengkap ke Excel (.xlsx)"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
                    <span>Unduh Excel Unit (.xlsx)</span>
                  </button>

                  <button
                    onClick={handleExportPDF}
                    id="btn-export-pdf-daily"
                    className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-extrabold text-white bg-indigo-700 hover:bg-indigo-800 rounded-xl transition-all cursor-pointer shadow-2xs hover:shadow-xs active:scale-98"
                    title="Cetak / Unduh Format PDF Resmi Seluruh Unit (.pdf)"
                  >
                    <Download className="w-4 h-4" />
                    <span>Cetak / PDF Unit</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Secondary Row: Category Tabs, Therapist Tabs & View Mode */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-slate-200/70">
            
            <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full text-xs no-scrollbar">
              {/* Category Filter Tabs: Semua, Fisio, Okupasi, Wicara */}
              <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-xl text-xs font-bold border border-slate-200 shrink-0 shadow-2xs">
                <button
                  type="button"
                  onClick={() => {
                    setCategoryFilter('all');
                    setSelectedTherapistBoxId('all');
                  }}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                    categoryFilter === 'all'
                      ? 'bg-indigo-600 text-white shadow-2xs font-black'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Tampilkan seluruh divisi terapis IRM"
                >
                  Semua ({therapistGroups.length})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCategoryFilter('fisio');
                    setSelectedTherapistBoxId('all');
                  }}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                    categoryFilter === 'fisio'
                      ? 'bg-teal-600 text-white shadow-2xs font-black'
                      : 'text-slate-600 hover:text-teal-700'
                  }`}
                  title="Filter divisi Fisioterapi"
                >
                  <Activity className="w-3 h-3 text-teal-400" />
                  <span>Fisio ({fisioGroups.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCategoryFilter('okupasi');
                    setSelectedTherapistBoxId('all');
                  }}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                    categoryFilter === 'okupasi'
                      ? 'bg-purple-600 text-white shadow-2xs font-black'
                      : 'text-slate-600 hover:text-purple-700'
                  }`}
                  title="Filter divisi Terapi Okupasi"
                >
                  <Sparkles className="w-3 h-3 text-purple-400" />
                  <span>Okupasi ({okupasiGroups.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCategoryFilter('wicara');
                    setSelectedTherapistBoxId('all');
                  }}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                    categoryFilter === 'wicara'
                      ? 'bg-amber-600 text-white shadow-2xs font-black'
                      : 'text-slate-600 hover:text-amber-700'
                  }`}
                  title="Filter divisi Terapi Wicara"
                >
                  <MessageSquare className="w-3 h-3 text-amber-400" />
                  <span>Wicara ({wicaraGroups.length})</span>
                </button>
              </div>

              {/* Therapist Tab Pills */}
              <div className="flex items-center gap-1 overflow-x-auto text-xs no-scrollbar shrink-0 pl-1 border-l border-slate-200">
                <button
                  onClick={() => setSelectedTherapistBoxId('all')}
                  className={`px-2.5 py-1 rounded-xl font-bold transition-all cursor-pointer shrink-0 ${
                    selectedTherapistBoxId === 'all'
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {categoryFilter === 'all' ? 'Semua Terapis' : `Semua ${categoryFilter.toUpperCase()}`} ({filteredPatients.length})
                </button>

                {displayedTherapistGroups.map((group) => {
                  const isSelected = selectedTherapistBoxId === group.boxId;
                  return (
                    <button
                      key={group.boxId}
                      onClick={() => setSelectedTherapistBoxId(group.boxId)}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-xl font-bold transition-all cursor-pointer shrink-0 ${
                        isSelected
                          ? 'bg-indigo-600 text-white shadow-2xs'
                          : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <User className={`w-3 h-3 ${isSelected ? 'text-white' : 'text-slate-400'}`} />
                      <span>{group.officerName}</span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                        isSelected
                          ? 'bg-white/20 text-white'
                          : group.totalPatients > 0
                          ? 'bg-indigo-100 text-indigo-700'
                          : 'bg-slate-100 text-slate-400'
                      }`}>
                        {group.totalPatients}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* View Mode Switcher & Search */}
            <div className="flex items-center gap-2 shrink-0">
              {/* Search Box */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Cari pasien / RM / tindakan..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-indigo-500 w-44 sm:w-56"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* View Mode Toggle */}
              <div className="flex items-center bg-slate-200/80 p-0.5 rounded-xl text-xs font-bold text-slate-600">
                <button
                  onClick={() => setViewMode('grouped')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                    viewMode === 'grouped' ? 'bg-white text-indigo-700 shadow-2xs' : 'hover:text-slate-900'
                  }`}
                  title="Tampilan Tertata Rapi Dikelompokkan per Terapis"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Per Terapis</span>
                </button>
                <button
                  onClick={() => setViewMode('table')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                    viewMode === 'table' ? 'bg-white text-indigo-700 shadow-2xs' : 'hover:text-slate-900'
                  }`}
                  title="Tampilan Tabel Berurutan Seluruh Pasien"
                >
                  <Table className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Tabel Lengkap</span>
                </button>
              </div>
            </div>

          </div>
        </div>

        {/* ================= CONTENT BODY ================= */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          
          {/* Loading Indicator Overlay */}
          {isLoading && (
            <div className="p-8 flex flex-col items-center justify-center gap-2 text-slate-500">
              <RefreshCw className="w-6 h-6 animate-spin text-indigo-600" />
              <p className="text-xs font-semibold">Mengambil data arsip laporan dari Cloud Firestore & Server...</p>
            </div>
          )}

          {!isLoading && (
            <>
              {/* EXECUTIVE AI DAILY DIGEST BANNER */}
              <div className="p-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl border border-indigo-500/20 text-white shadow-md relative overflow-hidden">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="space-y-1 max-w-2xl">
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-indigo-500/30 text-indigo-300 border border-indigo-400/30 text-[11px] font-black tracking-wide uppercase">
                        <Sparkles className="w-3 h-3 text-amber-300 animate-pulse" />
                        Ringkasan Eksekutif Harian
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        executiveDigest.status === 'optimal' 
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      }`}>
                        {executiveDigest.status === 'optimal' ? 'Pelayanan Prima & Terkendali' : 'Perlu Atensi Antrean'}
                      </span>
                    </div>
                    <h4 className="text-sm sm:text-base font-extrabold text-white leading-snug">
                      {executiveDigest.headline}
                    </h4>
                    <p className="text-xs text-indigo-200/80 leading-relaxed font-medium">
                      {executiveDigest.details}
                    </p>
                  </div>

                  {/* 4 Micro KPI Badges */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 gap-2 shrink-0">
                    <div className="p-2.5 bg-white/5 border border-white/10 rounded-xl">
                      <span className="text-[10px] text-indigo-300 font-bold block">Puncak Pelayanan</span>
                      <span className="text-xs font-black text-white">{executiveDigest.peakHours.split('(')[0]}</span>
                    </div>
                    <div className="p-2.5 bg-white/5 border border-white/10 rounded-xl">
                      <span className="text-[10px] text-indigo-300 font-bold block">Kepatuhan SPM</span>
                      <span className={`text-xs font-black ${overallAnalytics.spmComplianceRate >= 80 ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {overallAnalytics.spmComplianceRate}% (≤ 30m)
                      </span>
                    </div>
                    <div className="p-2.5 bg-white/5 border border-white/10 rounded-xl">
                      <span className="text-[10px] text-indigo-300 font-bold block">Modalitas Dominan</span>
                      <span className="text-xs font-black text-white truncate max-w-[130px] block" title={executiveDigest.topModality}>
                        {executiveDigest.topModality}
                      </span>
                    </div>
                    <div className="p-2.5 bg-white/5 border border-white/10 rounded-xl">
                      <span className="text-[10px] text-indigo-300 font-bold block">Komposisi Pasien</span>
                      <span className="text-xs font-black text-white">
                        {rajalCount} Rajal • {ranapCount} Ranap
                      </span>
                    </div>
                  </div>
                </div>

                {/* Toggle Button for Deep Analytics */}
                <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between">
                  <button
                    onClick={() => setShowAnalyticsOverview(!showAnalyticsOverview)}
                    className="flex items-center gap-1.5 text-xs font-bold text-indigo-300 hover:text-white transition-all cursor-pointer"
                  >
                    <BarChart3 className="w-3.5 h-3.5 text-indigo-400" />
                    <span>{showAnalyticsOverview ? 'Sembunyikan Analisis Modalitas & Diagnosa' : 'Buka Analisis 8 Modalitas & Top Diagnosa'}</span>
                    {showAnalyticsOverview ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>

                  <span className="text-[11px] text-indigo-300/70 hidden sm:inline">
                    Sinkronisasi data otomatis dengan standar IRM & SPM Rumah Sakit
                  </span>
                </div>
              </div>

              {/* ANALISIS 8 ALAT TERAPI & TOP DIAGNOSA (EXPANDABLE) */}
              {showAnalyticsOverview && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                  {/* Sebaran 8 Alat Terapi */}
                  <div className="lg:col-span-2 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4 text-amber-600" />
                        <h5 className="font-extrabold text-xs text-slate-900 uppercase tracking-wide">
                          Sebaran 8 Alat Terapi Utama Hari Ini
                        </h5>
                      </div>
                      <span className="text-[11px] text-slate-500 font-semibold">
                        Frekuensi & Persentase Penggunaan
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {eightEquipmentStats.map((item) => (
                        <div
                          key={item.code}
                          className="p-2.5 bg-white border border-slate-200 rounded-xl shadow-2xs space-y-1"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-black text-slate-800 font-mono">
                              {item.name}
                            </span>
                            <span className="text-xs font-black text-indigo-700">
                              {item.count} <span className="text-[10px] text-slate-400 font-normal">tindakan</span>
                            </span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-indigo-600 rounded-full transition-all"
                              style={{ width: `${Math.min(100, Math.max(item.percentage, item.count > 0 ? 8 : 0))}%` }}
                            />
                          </div>
                          <div className="flex justify-between text-[10px] text-slate-400">
                            <span className="truncate">{item.fullName.split(' ')[0]}</span>
                            <span className="font-semibold text-slate-600">{item.percentage}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Top Diagnosa ICF */}
                  <div className="space-y-2.5 bg-white p-3.5 border border-slate-200 rounded-xl shadow-2xs">
                    <div className="flex items-center gap-2">
                      <Award className="w-4 h-4 text-indigo-600" />
                      <h5 className="font-extrabold text-xs text-slate-900 uppercase tracking-wide">
                        Diagnosa Terbanyak Hari Ini
                      </h5>
                    </div>

                    {topDiagnosesList.length === 0 ? (
                      <p className="text-xs text-slate-400 italic py-2">Belum ada data diagnosa tercatat.</p>
                    ) : (
                      <div className="space-y-2">
                        {topDiagnosesList.map((diag, idx) => (
                          <div key={diag.name} className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2 truncate pr-2">
                              <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 font-bold text-[10px] flex items-center justify-center shrink-0">
                                {idx + 1}
                              </span>
                              <span className="font-bold text-slate-800 truncate" title={diag.name}>
                                {diag.name}
                              </span>
                            </div>
                            <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-800 font-extrabold text-[11px] shrink-0">
                              {diag.count} pasien
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 1. TOP METRICS SUMMARY CARDS */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="p-3 bg-white border border-slate-200 rounded-2xl shadow-2xs">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 font-bold mb-1">
                    <Users className="w-3.5 h-3.5 text-slate-700" />
                    <span>Total Pasien</span>
                  </div>
                  <p className="text-2xl font-black text-slate-900">{totalCount}</p>
                  <span className="text-[10px] text-slate-400 font-medium">Kunjungan tercatat</span>
                </div>

                <div className="p-3 bg-white border border-emerald-200 bg-emerald-50/20 rounded-2xl shadow-2xs">
                  <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-bold mb-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Selesai Tindakan</span>
                  </div>
                  <p className="text-2xl font-black text-emerald-900">{completedCount}</p>
                  <span className="text-[10px] text-emerald-600 font-medium">
                    {totalCount > 0 ? `${Math.round((completedCount / totalCount) * 100)}% selesai` : '0%'}
                  </span>
                </div>

                <div className="p-3 bg-white border border-sky-200 bg-sky-50/20 rounded-2xl shadow-2xs">
                  <div className="flex items-center gap-1.5 text-xs text-sky-700 font-bold mb-1">
                    <Clock className="w-3.5 h-3.5 text-sky-600" />
                    <span>Dalam Antrean</span>
                  </div>
                  <p className="text-2xl font-black text-sky-900">{activeCount}</p>
                  <span className="text-[10px] text-sky-600 font-medium">Sedang dilayani / antre</span>
                </div>

                <div className="p-3 bg-white border border-indigo-200 bg-indigo-50/20 rounded-2xl shadow-2xs">
                  <div className="flex items-center gap-1.5 text-xs text-indigo-700 font-bold mb-1">
                    <Timer className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Rata-rata Respon</span>
                  </div>
                  <p className="text-2xl font-black text-indigo-900">{overallAnalytics.avgResponseMinutes}m</p>
                  <span className="text-[10px] text-indigo-600 font-medium">Input hingga selesai</span>
                </div>

                <div className="p-3 bg-white border border-teal-200 bg-teal-50/20 rounded-2xl shadow-2xs">
                  <div className="flex items-center gap-1.5 text-xs text-teal-700 font-bold mb-1">
                    <Activity className="w-3.5 h-3.5 text-teal-600" />
                    <span>Kepatuhan SPM</span>
                  </div>
                  <p className="text-2xl font-black text-teal-900">{overallAnalytics.spmComplianceRate}%</p>
                  <span className="text-[10px] text-teal-600 font-medium">Standar ≤ 30 Menit</span>
                </div>

                <div className="p-3 bg-white border border-slate-200 rounded-2xl shadow-2xs">
                  <div className="flex items-center gap-1.5 text-xs text-amber-700 font-bold mb-1">
                    <BedDouble className="w-3.5 h-3.5 text-amber-600" />
                    <span>Rawat Inap (Ranap)</span>
                  </div>
                  <p className="text-2xl font-black text-amber-900">{ranapCount}</p>
                  <span className="text-[10px] text-amber-600 font-medium">
                    {warningCount > 0 ? `${warningCount} Pasien Warning 🛑` : 'Kondisi stabil'}
                  </span>
                </div>
              </div>

              {/* 2. REKAPITULASI KINERJA TIAP TERAPIS (CARDS GRID) */}
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <Stethoscope className="w-4 h-4 text-indigo-600" />
                    <div>
                      <h4 className="font-extrabold text-sm text-slate-900 tracking-tight">
                        Rekapitulasi Kinerja & Beban Pelayanan per Kotak Terapis
                      </h4>
                      <p className="text-[11px] text-slate-500 font-medium">
                        Total {therapistGroups.length} Kotak Terapis: {fisioGroups.length} Fisioterapi • {okupasiGroups.length} Terapi Okupasi • {wicaraGroups.length} Terapi Wicara ({activeServingCount} bertugas hari ini)
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-bold">
                    <span className="px-2.5 py-1 rounded-lg bg-teal-50 text-teal-800 border border-teal-200 text-[11px] flex items-center gap-1 font-extrabold">
                      <span className="w-1.5 h-1.5 rounded-full bg-teal-500"></span>
                      Fisio: {fisioGroups.length}
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-purple-50 text-purple-800 border border-purple-200 text-[11px] flex items-center gap-1 font-extrabold">
                      <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                      Okupasi: {okupasiGroups.length}
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 text-[11px] flex items-center gap-1 font-extrabold">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                      Wicara: {wicaraGroups.length}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {displayedTherapistGroups.map((group) => {
                    const isSelected = selectedTherapistBoxId === group.boxId;
                    return (
                      <div
                        key={group.boxId}
                        onClick={() => {
                          if (selectedTherapistBoxId === group.boxId) {
                            setSelectedTherapistBoxId('all');
                          } else {
                            setSelectedTherapistBoxId(group.boxId);
                          }
                        }}
                        className={`p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden ${
                          isSelected
                            ? 'bg-indigo-50/50 border-indigo-400 shadow-md ring-2 ring-indigo-500/20'
                            : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-2xs'
                        }`}
                      >
                        {/* Top Therapist Identity */}
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <div className="flex items-center gap-2.5">
                            <div className={`w-9 h-9 rounded-xl border flex items-center justify-center font-black text-xs shadow-2xs ${
                              group.category === 'okupasi'
                                ? 'bg-purple-50 border-purple-200 text-purple-700'
                                : group.category === 'wicara'
                                ? 'bg-amber-50 border-amber-200 text-amber-700'
                                : 'bg-teal-50 border-teal-200 text-teal-700'
                            }`}>
                              {group.officerName.split(' ').map(n => n[0]).slice(0, 2).join('')}
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <h5 className="font-bold text-xs sm:text-sm text-slate-900 leading-tight">
                                  {group.officerName}
                                </h5>
                                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-wider ${
                                  group.category === 'okupasi'
                                    ? 'bg-purple-100 text-purple-800 border border-purple-200'
                                    : group.category === 'wicara'
                                    ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                    : 'bg-teal-100 text-teal-800 border border-teal-200'
                                }`}>
                                  {group.category === 'okupasi' ? 'Okupasi' : group.category === 'wicara' ? 'Wicara' : 'Fisio'}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-500 font-medium">
                                {group.boxTitle} • {group.location}
                              </p>
                            </div>
                          </div>

                          <span className={`text-xs font-black px-2.5 py-1 rounded-xl ${
                            group.totalPatients > 0
                              ? 'bg-indigo-100 text-indigo-900'
                              : 'bg-slate-100 text-slate-400'
                          }`}>
                            {group.totalPatients} Pasien
                          </span>
                        </div>

                        {/* Progress Bar Selesai */}
                        <div className="space-y-1 mb-3">
                          <div className="flex justify-between text-[11px] font-semibold">
                            <span className="text-slate-500">Penyelesaian Tindakan</span>
                            <span className="font-bold text-slate-800">
                              {group.totalPatients > 0 ? (
                                `${group.completedCount} / ${group.totalPatients} (${Math.round((group.completedCount / group.totalPatients) * 100)}%)`
                              ) : (
                                <span className="text-slate-400 font-normal">Siaga • Belum ada antrean</span>
                              )}
                            </span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 rounded-full transition-all"
                              style={{
                                width: group.totalPatients > 0 ? `${(group.completedCount / group.totalPatients) * 100}%` : '0%'
                              }}
                            />
                          </div>
                        </div>

                        {/* Metric Highlights */}
                        <div className="grid grid-cols-2 gap-2 p-2 bg-slate-50 rounded-xl text-[11px] mb-2">
                          <div>
                            <span className="text-slate-400 block text-[10px]">Avg Respon Time</span>
                            <span className="font-extrabold text-slate-800 font-mono">
                              {group.totalPatients > 0 ? `${group.avgResponseMinutes} Menit` : '-'}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px]">Kepatuhan SPM</span>
                            <span className={`font-extrabold ${group.complianceRate >= 80 ? 'text-emerald-700' : 'text-amber-700'}`}>
                              {group.totalPatients > 0 ? `${group.complianceRate}% (≤ 30m)` : '100%'}
                            </span>
                          </div>
                        </div>

                        {/* Top Action Modalities Badges */}
                        {group.topActions.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1 pt-1 mb-2">
                            <span className="text-[10px] text-slate-400 font-medium mr-0.5">Tindakan:</span>
                            {group.topActions.map(act => (
                              <span
                                key={act.code}
                                className="px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-700 font-mono text-[10px] font-bold"
                              >
                                {act.code} ({act.count})
                              </span>
                            ))}
                          </div>
                        )}

                        {/* 1-Click Direct Download for this Specific Therapist */}
                        <div className="flex items-center justify-between gap-2 pt-2.5 mt-2 border-t border-slate-100">
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                            Unduh Logbook:
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleExportTherapistPDF(group);
                              }}
                              className="flex items-center gap-1 px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[11px] font-black rounded-lg transition-all cursor-pointer shadow-2xs hover:shadow-xs active:scale-95"
                              title={`Unduh Logbook PDF Resmi ${group.officerName}`}
                            >
                              <Download className="w-3 h-3 text-indigo-600" />
                              <span>PDF</span>
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleExportTherapistExcel(group);
                              }}
                              className="flex items-center gap-1 px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[11px] font-black rounded-lg transition-all cursor-pointer shadow-2xs hover:shadow-xs active:scale-95"
                              title={`Unduh Logbook Excel ${group.officerName}`}
                            >
                              <FileSpreadsheet className="w-3 h-3 text-emerald-700" />
                              <span>Excel</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 3. PATIENT DATA SECTION (GROUPED PER THERAPIST OR TABLE VIEW) */}
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="font-extrabold text-sm text-slate-900 tracking-tight">
                      Rincian Pasien & Kartu Tindakan
                    </h4>
                    <p className="text-xs text-slate-500">
                      Menampilkan {filteredPatients.length} pasien untuk tanggal <strong className="text-slate-800">{selectedDate}</strong>
                    </p>
                  </div>

                  {/* Filter Status Buttons */}
                  <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-xl text-xs font-bold text-slate-600">
                    <button
                      onClick={() => setStatusFilter('all')}
                      className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                        statusFilter === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'hover:text-slate-900'
                      }`}
                    >
                      Semua ({unifiedPatients.length})
                    </button>
                    <button
                      onClick={() => setStatusFilter('completed')}
                      className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                        statusFilter === 'completed' ? 'bg-white text-emerald-700 shadow-2xs' : 'hover:text-slate-900'
                      }`}
                    >
                      Selesai ({unifiedPatients.filter(p => p.completed).length})
                    </button>
                    <button
                      onClick={() => setStatusFilter('active')}
                      className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                        statusFilter === 'active' ? 'bg-white text-sky-700 shadow-2xs' : 'hover:text-slate-900'
                      }`}
                    >
                      Antre ({unifiedPatients.filter(p => !p.completed).length})
                    </button>
                    <button
                      onClick={() => setStatusFilter('ranap')}
                      className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                        statusFilter === 'ranap' ? 'bg-white text-amber-700 shadow-2xs' : 'hover:text-slate-900'
                      }`}
                    >
                      Ranap ({unifiedPatients.filter(p => p.isRanap).length})
                    </button>
                  </div>
                </div>

                {/* VIEW MODE A: GROUPED PER THERAPIST (DEFAULT & MOST ORGANIZED) */}
                {viewMode === 'grouped' && (
                  <div className="space-y-4">
                    {displayedTherapistGroups.filter(g => g.patients.length > 0).map((group) => {
                      const isCollapsed = collapsedTherapists[group.boxId];
                      return (
                        <div
                          key={group.boxId}
                          className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-2xs"
                        >
                          {/* Therapist Group Section Header */}
                          <div
                            onClick={() => toggleCollapseTherapist(group.boxId)}
                            className="bg-slate-50 hover:bg-slate-100/80 p-3.5 sm:px-5 flex items-center justify-between gap-3 border-b border-slate-200 cursor-pointer transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs shadow-2xs text-white ${
                                group.category === 'okupasi'
                                  ? 'bg-purple-600'
                                  : group.category === 'wicara'
                                  ? 'bg-amber-600'
                                  : 'bg-teal-600'
                              }`}>
                                <User className="w-4 h-4" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <h5 className="font-extrabold text-sm text-slate-900">
                                    {group.officerName}
                                  </h5>
                                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider ${
                                    group.category === 'okupasi'
                                      ? 'bg-purple-100 text-purple-800 border border-purple-200'
                                      : group.category === 'wicara'
                                      ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                      : 'bg-teal-100 text-teal-800 border border-teal-200'
                                  }`}>
                                    {group.category === 'okupasi' ? 'Okupasi' : group.category === 'wicara' ? 'Wicara' : 'Fisio'}
                                  </span>
                                  <span className="text-xs px-2 py-0.5 rounded-md bg-white border border-slate-200 font-semibold text-slate-600">
                                    {group.boxTitle}
                                  </span>
                                </div>
                                <span className="text-[11px] text-slate-500 font-medium">
                                  {group.location}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-3">
                              <div className="hidden sm:flex items-center gap-2 text-xs font-semibold">
                                <span className="px-2 py-0.5 rounded-md bg-slate-200/60 text-slate-700">
                                  {group.patients.length} Pasien
                                </span>
                                <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
                                  {group.patients.filter(p => p.completed).length} Selesai
                                </span>
                                <span className="px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 font-mono">
                                  Avg: {group.avgResponseMinutes}m
                                </span>
                              </div>
                              <button className="text-slate-400 p-1">
                                {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                              </button>
                            </div>
                          </div>

                          {/* Group Patients Table */}
                          {!isCollapsed && (
                            <div className="overflow-x-auto w-full">
                              <table className="w-full min-w-[1050px] text-xs text-left border-collapse">
                                <thead className="bg-slate-900 text-white font-bold sticky top-0 z-10">
                                  <tr>
                                    <th className="p-2.5 pl-4 w-12 text-center whitespace-nowrap">No</th>
                                    <th className="p-2.5 w-24 whitespace-nowrap">No. Antrean</th>
                                    <th className="p-2.5 min-w-[200px]">Nama Pasien & Rekam Medis</th>
                                    <th className="p-2.5 min-w-[160px]">Tindakan / Modalitas</th>
                                    <th className="p-2.5 min-w-[180px]">Diagnosa ICF / Catatan</th>
                                    <th className="p-2.5 text-center w-20 whitespace-nowrap">Status</th>
                                    <th className="p-2.5 text-center w-28 whitespace-nowrap">Jam Pelayanan</th>
                                    <th className="p-2.5 text-center w-24 whitespace-nowrap">Respon Time</th>
                                    <th className="p-2.5 text-center pr-4 w-28 whitespace-nowrap">Kepatuhan SPM</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {group.patients.map((p, idx) => {
                                    const metrics = calculatePatientTimeMetrics(p, boxes);
                                    return (
                                      <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                                        <td className="p-2.5 pl-4 text-center font-mono text-slate-400">
                                          {idx + 1}
                                        </td>
                                        <td className="p-2.5 font-mono font-black text-indigo-700">
                                          {p.queueNumber}
                                        </td>
                                        <td className="p-2.5">
                                          <div className="font-bold text-slate-900">
                                            {p.patientName}
                                            {p.isWarning && (
                                              <span className="ml-1.5 text-rose-600 font-extrabold text-[10px] bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200">
                                                🛑 WARNING
                                              </span>
                                            )}
                                            {p.isRanap && (
                                              <span className="ml-1 text-amber-700 font-extrabold text-[10px] bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                                                🛏️ RANAP
                                              </span>
                                            )}
                                          </div>
                                          <div className="font-mono text-slate-400 text-[11px]">
                                            RM: {p.medicalRecordNo}
                                          </div>
                                        </td>
                                        <td className="p-2.5">
                                          {p.actionCode ? (
                                            <div className="flex flex-wrap gap-1">
                                              <ActionCodeBadge actionCode={p.actionCode} />
                                            </div>
                                          ) : (
                                            <span className="text-slate-400 italic">-</span>
                                          )}
                                        </td>
                                        <td className="p-2.5 text-slate-600 max-w-xs truncate">
                                          {p.diagnosis || p.note || <span className="text-slate-400 italic">-</span>}
                                        </td>
                                        <td className="p-2.5 text-center">
                                          <span className={`px-2 py-0.5 text-[10px] font-extrabold rounded-full ${
                                            p.completed
                                              ? 'bg-emerald-100 text-emerald-800'
                                              : 'bg-sky-100 text-sky-800'
                                          }`}>
                                            {p.completed ? 'Selesai' : 'Antre'}
                                          </span>
                                        </td>
                                        <td className="p-2.5 text-center font-mono text-[11px] text-slate-600">
                                          <div>
                                            {p.createdAt ? new Date(p.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'}
                                            {p.completedAt && (
                                              <span className="text-emerald-700 ml-1">
                                                ➔ {new Date(p.completedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                                              </span>
                                            )}
                                          </div>
                                        </td>
                                        <td className="p-2.5 text-center font-mono font-bold">
                                          <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] ${
                                            metrics.waitStatus === 'fast'
                                              ? 'bg-emerald-100 text-emerald-800'
                                              : metrics.waitStatus === 'normal'
                                              ? 'bg-sky-100 text-sky-800'
                                              : metrics.waitStatus === 'moderate'
                                              ? 'bg-amber-100 text-amber-800'
                                              : 'bg-rose-100 text-rose-800'
                                          }`}>
                                            {metrics.responseTimeMinutes}m
                                          </span>
                                        </td>
                                        <td className="p-2.5 pr-4 text-center">
                                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                                            metrics.isCompliant
                                              ? 'bg-emerald-100 text-emerald-800'
                                              : 'bg-amber-100 text-amber-800'
                                          }`}>
                                            {metrics.isCompliant ? 'Sesuai SPM' : 'Melebihi'}
                                          </span>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {displayedTherapistGroups.every(g => g.patients.length === 0) && (
                      <div className="p-10 text-center bg-slate-50 border border-dashed border-slate-200 rounded-2xl text-slate-400">
                        <FileText className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                        <p className="font-bold text-sm text-slate-600">Tidak ada data pasien untuk tanggal {selectedDate}</p>
                        <p className="text-xs text-slate-400">Silakan pilih tanggal lain pada kalender di atas.</p>
                      </div>
                    )}
                  </div>
                )}

                {/* VIEW MODE B: FLAT TABLE VIEW */}
                {viewMode === 'table' && (
                  <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
                    <div className="overflow-x-auto w-full">
                      <table className="w-full min-w-[1150px] text-xs text-left border-collapse">
                        <thead className="bg-slate-900 text-white font-bold sticky top-0 z-10">
                          <tr>
                            <th className="p-2.5 pl-4 w-12 text-center whitespace-nowrap">No</th>
                            <th className="p-2.5 w-24 whitespace-nowrap">No. Antrean</th>
                            <th className="p-2.5 min-w-[180px]">Nama Pasien</th>
                            <th className="p-2.5 w-28 whitespace-nowrap">No. RM</th>
                            <th className="p-2.5 min-w-[160px]">Terapis & Ruangan</th>
                            <th className="p-2.5 min-w-[150px]">Tindakan</th>
                            <th className="p-2.5 min-w-[180px]">Diagnosa / Catatan</th>
                            <th className="p-2.5 text-center w-20 whitespace-nowrap">Status</th>
                            <th className="p-2.5 text-center w-28 whitespace-nowrap">Jam Masuk</th>
                            <th className="p-2.5 text-center w-24 whitespace-nowrap">Respon Time</th>
                            <th className="p-2.5 text-center pr-4 w-28 whitespace-nowrap">Kepatuhan SPM</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredPatients.length === 0 ? (
                            <tr>
                              <td colSpan={11} className="p-8 text-center text-slate-400 italic">
                                Tidak ada data pasien yang sesuai dengan filter.
                              </td>
                            </tr>
                          ) : (
                            filteredPatients.map((p, idx) => {
                              const box = boxes.find(b => b.id === p.boxId);
                              const metrics = calculatePatientTimeMetrics(p, boxes);
                              return (
                                <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                                  <td className="p-2.5 pl-4 text-center font-mono text-slate-400">
                                    {idx + 1}
                                  </td>
                                  <td className="p-2.5 font-mono font-black text-indigo-700">
                                    {p.queueNumber}
                                  </td>
                                  <td className="p-2.5 font-bold text-slate-900">
                                    {p.patientName}
                                    {p.isWarning && <span className="ml-1 text-rose-600">🛑</span>}
                                    {p.isRanap && <span className="ml-1 text-amber-600 font-normal text-[11px]">(Ranap)</span>}
                                  </td>
                                  <td className="p-2.5 font-mono text-slate-600">
                                    {p.medicalRecordNo}
                                  </td>
                                  <td className="p-2.5">
                                    <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                                      <span>
                                        {box?.officerName || p.officerName || (box ? box.title.split('(')[0].trim() : '-')}
                                      </span>
                                      {box && (
                                        <span className={`text-[9px] font-black px-1.5 py-0.2 rounded-md uppercase tracking-wider ${
                                          getTherapistCategory(box.officerName, box.location, box.category) === 'okupasi'
                                            ? 'bg-purple-100 text-purple-800'
                                            : getTherapistCategory(box.officerName, box.location, box.category) === 'wicara'
                                            ? 'bg-amber-100 text-amber-800'
                                            : 'bg-teal-100 text-teal-800'
                                        }`}>
                                          {getTherapistCategory(box.officerName, box.location, box.category) === 'okupasi' ? 'Okupasi' : getTherapistCategory(box.officerName, box.location, box.category) === 'wicara' ? 'Wicara' : 'Fisio'}
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-[10px] text-slate-500 font-medium">
                                      {box ? box.title.split('(')[0].trim() : '-'}
                                    </div>
                                  </td>
                                  <td className="p-2.5">
                                    {p.actionCode ? (
                                      <ActionCodeBadge actionCode={p.actionCode} />
                                    ) : (
                                      <span className="text-slate-400">-</span>
                                    )}
                                  </td>
                                  <td className="p-2.5 text-slate-600 max-w-xs truncate">
                                    {p.diagnosis || p.note || '-'}
                                  </td>
                                  <td className="p-2.5 text-center">
                                    <span className={`px-2 py-0.5 text-[10px] font-extrabold rounded-full ${
                                      p.completed ? 'bg-emerald-100 text-emerald-800' : 'bg-sky-100 text-sky-800'
                                    }`}>
                                      {p.completed ? 'Selesai' : 'Antre'}
                                    </span>
                                  </td>
                                  <td className="p-2.5 text-center font-mono text-slate-500">
                                    {p.createdAt ? new Date(p.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'}
                                  </td>
                                  <td className="p-2.5 text-center font-mono font-bold">
                                    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] ${
                                      metrics.waitStatus === 'fast'
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : metrics.waitStatus === 'normal'
                                        ? 'bg-sky-100 text-sky-800'
                                        : metrics.waitStatus === 'moderate'
                                        ? 'bg-amber-100 text-amber-800'
                                        : 'bg-rose-100 text-rose-800'
                                    }`}>
                                      {metrics.responseTimeMinutes}m
                                    </span>
                                  </td>
                                  <td className="p-2.5 pr-4 text-center">
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                      metrics.isCompliant ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                                    }`}>
                                      {metrics.isCompliant ? 'Sesuai SPM' : 'Melebihi'}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

        </div>

        {/* ================= FOOTER ================= */}
        <div className="p-3.5 sm:px-6 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              Pembersihan antrean harian tidak menghapus arsip laporan ini. Data dapat dibuka kembali kapan saja.
            </span>
          </div>

          <button
            onClick={onClose}
            className="px-6 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-xs transition-all cursor-pointer shadow-2xs hover:shadow-xs active:scale-98"
          >
            Tutup Laporan
          </button>
        </div>

      </div>
    </div>
  );
};
