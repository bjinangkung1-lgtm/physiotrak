import React, { useState, useMemo } from 'react';
import { 
  Users, 
  Clock, 
  Activity, 
  ShieldAlert, 
  Filter, 
  BarChart3, 
  Flame, 
  CheckCircle2, 
  Bell, 
  UserPlus, 
  Search,
  Award,
  Trophy,
  Medal,
  Download,
  Printer,
  Sparkles,
  TrendingUp,
  Zap,
  ArrowRight,
  ChevronRight,
  ChevronDown,
  SlidersHorizontal,
  Info,
  Eye,
  X,
  Stethoscope,
  Building2,
  Calendar,
  AlertCircle,
  Layers,
  FileSpreadsheet,
  ArrowUpDown,
  Bookmark,
  Phone,
  AlertTriangle,
  FileText,
  Cpu,
  Boxes,
  PieChart
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { QueueBox, PatientItem } from '../types';
import { calculatePatientTimeMetrics, formatMinutes } from '../utils/responseTimeAnalytics';
import { getLocalDateStringWIB } from '../utils/dateHelper';
import { 
  computeDiagnosisAnalytics, 
  DiagnosisRatingItem, 
  DiagnosisCategorySummary 
} from '../utils/diagnosisAnalytics';
import {
  computeEquipmentAnalytics,
  EquipmentRatingItem,
  KNOWN_EQUIPMENT
} from '../utils/equipmentAnalytics';
import { VisitTrendCharts } from './VisitTrendCharts';

interface TherapistAnalyticsViewProps {
  boxes: QueueBox[];
  patients: PatientItem[];
  onSelectTherapistFocus: (boxId: string) => void;
  onCallNextInBox: (box: QueueBox) => void;
  onAddPatientToBox: (boxId: string) => void;
  onBackToQueue: () => void;
}

export const TherapistAnalyticsView: React.FC<TherapistAnalyticsViewProps> = ({
  boxes,
  patients,
  onSelectTherapistFocus,
  onCallNextInBox,
  onAddPatientToBox,
  onBackToQueue,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'diagnosis' | 'equipment' | 'cards' | 'table'>('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterLoad, setFilterLoad] = useState<'all' | 'overload' | 'busy' | 'optimal' | 'available'>('all');
  const [sortBy, setSortBy] = useState<'active' | 'completed' | 'speed' | 'name'>('active');
  const [selectedDetailBoxId, setSelectedDetailBoxId] = useState<string | null>(null);

  // State for Diagnosis Analytics
  const [diagSearch, setDiagSearch] = useState('');
  const [selectedDiagDiscipline, setSelectedDiagDiscipline] = useState<'all' | 'FT' | 'OT' | 'TW'>('all');
  const [selectedDiagCategory, setSelectedDiagCategory] = useState<string>('all');
  const [selectedDiagType, setSelectedDiagType] = useState<'all' | 'rajal' | 'ranap' | 'warning' | 'active'>('all');
  const [diagSortOrder, setDiagSortOrder] = useState<'count_desc' | 'count_asc' | 'name_asc' | 'active_desc'>('count_desc');
  const [expandedDiagRank, setExpandedDiagRank] = useState<number | null>(null);

  // State for Equipment Utilization Analytics
  const [equipSearch, setEquipSearch] = useState('');
  const [selectedEquipType, setSelectedEquipType] = useState<'all' | 'rajal' | 'ranap' | 'active' | 'completed'>('all');
  const [selectedEquipCode, setSelectedEquipCode] = useState<number | 'all'>('all');
  const [equipSortOrder, setEquipSortOrder] = useState<'sessions_desc' | 'sessions_asc' | 'active_desc' | 'name_asc'>('sessions_desc');
  const [expandedEquipCode, setExpandedEquipCode] = useState<number | null>(null);

  // Compute Diagnosis Analytics & Distribution Ranking (Terbanyak ke Tersedikit)
  const diagnosisAnalytics = useMemo(() => {
    return computeDiagnosisAnalytics(patients, boxes);
  }, [patients, boxes]);

  // Compute Equipment Utilization Analytics (12 Modalitas & Tindakan Terapi: 2=MWD, 6=TENS, 4=US, 1=IRR, 9=Manipulasi, 10=Rehab, 14=Paket Chest+Inhalasi, 15=Parafin, 18=Nebu, 47=Cryo, 74=Vaccum, 75=Chest)
  const equipmentAnalytics = useMemo(() => {
    return computeEquipmentAnalytics(patients, boxes);
  }, [patients, boxes]);

  // Filtered and Sorted Equipment Ratings
  const filteredEquipmentRatings = useMemo(() => {
    let list = [...equipmentAnalytics.equipmentRatings];

    // Filter by specific equipment code
    if (selectedEquipCode !== 'all') {
      list = list.filter(item => item.code === selectedEquipCode);
    }

    // Filter by patient care type
    if (selectedEquipType === 'rajal') {
      list = list.filter(item => item.rajalSessions > 0);
    } else if (selectedEquipType === 'ranap') {
      list = list.filter(item => item.ranapSessions > 0);
    } else if (selectedEquipType === 'active') {
      list = list.filter(item => item.activeSessions > 0);
    } else if (selectedEquipType === 'completed') {
      list = list.filter(item => item.completedSessions > 0);
    }

    // Search query
    if (equipSearch.trim()) {
      const q = equipSearch.toLowerCase().trim();
      list = list.filter(item => 
        item.name.toLowerCase().includes(q) ||
        item.shortName.toLowerCase().includes(q) ||
        item.codeStr.includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.patients.some(p => 
          p.patientName.toLowerCase().includes(q) ||
          p.medicalRecordNo.toLowerCase().includes(q)
        )
      );
    }

    // Sort order
    if (equipSortOrder === 'sessions_desc') {
      list.sort((a, b) => b.totalSessions - a.totalSessions || b.activeSessions - a.activeSessions);
    } else if (equipSortOrder === 'sessions_asc') {
      list.sort((a, b) => a.totalSessions - b.totalSessions || a.name.localeCompare(b.name));
    } else if (equipSortOrder === 'name_asc') {
      list.sort((a, b) => a.shortName.localeCompare(b.shortName));
    } else if (equipSortOrder === 'active_desc') {
      list.sort((a, b) => b.activeSessions - a.activeSessions || b.totalSessions - a.totalSessions);
    }

    return list;
  }, [equipmentAnalytics.equipmentRatings, selectedEquipCode, selectedEquipType, equipSearch, equipSortOrder]);

  // Filtered and Sorted Diagnosis Ratings
  const filteredDiagnosisRatings = useMemo(() => {
    let list = [...diagnosisAnalytics.ratings];

    // Filter by discipline (FT / OT / TW)
    if (selectedDiagDiscipline !== 'all') {
      list = list.filter(item => 
        item.discipline === selectedDiagDiscipline ||
        item.patients.some(p => p.therapyPlaces?.includes(selectedDiagDiscipline))
      );
    }

    // Filter by category
    if (selectedDiagCategory !== 'all') {
      list = list.filter(item => item.category === selectedDiagCategory);
    }

    // Filter by type
    if (selectedDiagType === 'rajal') {
      list = list.filter(item => item.rajalCases > 0);
    } else if (selectedDiagType === 'ranap') {
      list = list.filter(item => item.ranapCases > 0);
    } else if (selectedDiagType === 'warning') {
      list = list.filter(item => item.warningCases > 0);
    } else if (selectedDiagType === 'active') {
      list = list.filter(item => item.activeCases > 0);
    }

    // Search query
    if (diagSearch.trim()) {
      const q = diagSearch.toLowerCase().trim();
      list = list.filter(item => 
        item.cleanName.toLowerCase().includes(q) ||
        item.diagnosisName.toLowerCase().includes(q) ||
        (item.icfCode && item.icfCode.toLowerCase().includes(q)) ||
        item.category.toLowerCase().includes(q) ||
        item.disciplineName.toLowerCase().includes(q) ||
        item.patients.some(p => 
          p.patientName.toLowerCase().includes(q) ||
          p.medicalRecordNo.toLowerCase().includes(q)
        )
      );
    }

    // Sort order (default: count_desc = terbanyak s/d tersedikit)
    if (diagSortOrder === 'count_desc') {
      list.sort((a, b) => b.totalCases - a.totalCases || b.activeCases - a.activeCases);
    } else if (diagSortOrder === 'count_asc') {
      list.sort((a, b) => a.totalCases - b.totalCases || a.cleanName.localeCompare(b.cleanName));
    } else if (diagSortOrder === 'name_asc') {
      list.sort((a, b) => a.cleanName.localeCompare(b.cleanName));
    } else if (diagSortOrder === 'active_desc') {
      list.sort((a, b) => b.activeCases - a.activeCases || b.totalCases - a.totalCases);
    }

    return list;
  }, [diagnosisAnalytics.ratings, selectedDiagDiscipline, selectedDiagCategory, selectedDiagType, diagSearch, diagSortOrder]);

  // Filter out transport ranap and peralihan siang to focus strictly on clinical therapists
  const therapistBoxes = useMemo(() => {
    return boxes.filter((b) => {
      const id = (b.id || '').toLowerCase();
      const title = (b.title || '').toLowerCase();
      const officer = (b.officerName || '').toLowerCase();

      const isJemputan =
        id === 'box-jemputan' ||
        id.includes('jemputan') ||
        id.includes('transport') ||
        title.includes('jemputan') ||
        title.includes('transport') ||
        officer.includes('transport') ||
        officer.includes('jemputan');

      const isPeralihan =
        id === 'box-peralihan-siang' ||
        id.includes('peralihan') ||
        title.includes('peralihan') ||
        title.includes('shift siang') ||
        officer.includes('peralihan') ||
        officer.includes('shift siang');

      return !isJemputan && !isPeralihan;
    });
  }, [boxes]);

  // Compute detailed metrics for each therapist/box
  const stats = useMemo(() => {
    return therapistBoxes.map((box) => {
      const boxPatients = patients.filter((p) => p.boxId === box.id);
      const active = boxPatients.filter((p) => !p.completed);
      const completed = boxPatients.filter((p) => p.completed);
      const warnings = boxPatients.filter((p) => p.isWarning);
      const ranap = boxPatients.filter((p) => p.isRanap);

      let totalResponseMins = 0;
      let countedResponse = 0;
      let spmCompliantCount = 0;

      completed.forEach((p) => {
        const metrics = calculatePatientTimeMetrics(p, boxes);
        totalResponseMins += metrics.responseTimeMinutes;
        countedResponse++;
        if (metrics.isCompliant) {
          spmCompliantCount++;
        }
      });

      const avgResponseMinutes = countedResponse > 0 ? Math.round(totalResponseMins / countedResponse) : 0;
      const complianceRate = countedResponse > 0 ? Math.round((spmCompliantCount / countedResponse) * 100) : 100;
      const activeCount = active.length;
      const isOverloaded = activeCount > 5;
      const isBoxActive = box.isActive !== false;

      let loadStatus: 'overload' | 'busy' | 'optimal' | 'available' | 'off' = 'optimal';
      if (!isBoxActive) loadStatus = 'off';
      else if (activeCount > 5) loadStatus = 'overload';
      else if (activeCount >= 4) loadStatus = 'busy';
      else if (activeCount === 0) loadStatus = 'available';

      const loadPercentage = Math.min(100, Math.round((activeCount / 6) * 100));
      const estimatedWaitMinutes = activeCount * 15;

      // Procedure frequency
      const procedureMap: Record<string, number> = {};
      boxPatients.forEach((p) => {
        const code = p.actionCode?.trim() || 'UMUM';
        procedureMap[code] = (procedureMap[code] || 0) + 1;
      });
      const topProcedures = Object.entries(procedureMap)
        .map(([code, count]) => ({ code, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 4);

      // Efficiency score (weighted formula for leaderboards)
      const efficiencyScore = (completed.length * 10) + (activeCount * 2) - Math.min(30, avgResponseMinutes * 0.5);

      return {
        box,
        boxId: box.id,
        boxTitle: box.title,
        officerName: box.officerName || box.title,
        location: box.location,
        color: box.color,
        activePatients: active,
        completedPatients: completed,
        totalPatients: boxPatients,
        totalCount: boxPatients.length,
        activeCount,
        completedCount: completed.length,
        warningCount: warnings.length,
        ranapCount: ranap.length,
        isOverloaded,
        loadStatus,
        loadPercentage,
        estimatedWaitMinutes,
        avgResponseMinutes,
        complianceRate,
        efficiencyScore,
        topProcedures,
      };
    });
  }, [therapistBoxes, patients, boxes]);

  // Overall Global KPI Summary
  const globalMetrics = useMemo(() => {
    const totalActive = stats.reduce((acc, s) => acc + s.activeCount, 0);
    const totalCompleted = stats.reduce((acc, s) => acc + s.completedCount, 0);
    const totalRanap = stats.reduce((acc, s) => acc + s.ranapCount, 0);
    const totalWarnings = stats.reduce((acc, s) => acc + s.warningCount, 0);
    const overloadedList = stats.filter((s) => s.isOverloaded);
    const availableList = stats.filter((s) => (s.loadStatus === 'available' || s.activeCount <= 1) && s.box.isActive !== false);
    const avgLoadPerTherapist = stats.length > 0 ? (totalActive / stats.length).toFixed(1) : '0';
    
    // Global Average Response Time (Input ke Ceklis)
    const validResponseStats = stats.filter(s => s.avgResponseMinutes > 0);
    const globalAvgResponse = validResponseStats.length > 0 
      ? Math.round(validResponseStats.reduce((acc, s) => acc + s.avgResponseMinutes, 0) / validResponseStats.length)
      : 0;

    const totalTracked = stats.reduce((acc, s) => acc + s.completedCount, 0);
    const totalCompliant = stats.reduce((acc, s) => acc + Math.round((s.complianceRate / 100) * s.completedCount), 0);
    const globalSpmRate = totalTracked > 0 ? Math.round((totalCompliant / totalTracked) * 100) : 100;

    // Leaderboard rankings
    const sortedByProductivity = [...stats].sort((a, b) => b.completedCount - a.completedCount || a.avgResponseMinutes - b.avgResponseMinutes);
    const sortedBySpeed = [...stats].filter(s => s.completedCount > 0).sort((a, b) => a.avgResponseMinutes - b.avgResponseMinutes);
    const sortedByActiveQueue = [...stats].sort((a, b) => b.activeCount - a.activeCount);

    // Global Procedure breakdown
    const procMap: Record<string, number> = {};
    patients.forEach(p => {
      if (p.actionCode?.trim()) {
        const code = p.actionCode.trim();
        procMap[code] = (procMap[code] || 0) + 1;
      }
    });
    const globalTopProcedures = Object.entries(procMap)
      .map(([code, count]) => ({ code, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    return {
      totalActive,
      totalCompleted,
      totalRanap,
      totalWarnings,
      overloadedList,
      availableList,
      avgLoadPerTherapist,
      globalAvgResponse,
      globalSpmRate,
      topPerformers: sortedByProductivity.slice(0, 3),
      fastestTherapists: sortedBySpeed.slice(0, 3),
      highestActive: sortedByActiveQueue.slice(0, 3),
      globalTopProcedures
    };
  }, [stats, patients]);

  // Filtered & Sorted stats for display
  const displayStats = useMemo(() => {
    let list = stats.filter((s) => {
      const matchesSearch = 
        s.officerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.boxTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.topProcedures.some(p => p.code.toLowerCase().includes(searchTerm.toLowerCase()));

      if (!matchesSearch) return false;
      if (filterLoad === 'all') return true;
      return s.loadStatus === filterLoad;
    });

    list.sort((a, b) => {
      if (sortBy === 'active') return b.activeCount - a.activeCount;
      if (sortBy === 'completed') return b.completedCount - a.completedCount;
      if (sortBy === 'speed') return a.avgResponseMinutes - b.avgResponseMinutes;
      if (sortBy === 'name') return a.officerName.localeCompare(b.officerName);
      return 0;
    });

    return list;
  }, [stats, searchTerm, filterLoad, sortBy]);

  // Selected therapist for detail modal
  const selectedTherapistDetail = useMemo(() => {
    if (!selectedDetailBoxId) return null;
    return stats.find(s => s.boxId === selectedDetailBoxId) || null;
  }, [selectedDetailBoxId, stats]);

  // Export to Excel handler
  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();
    const dateStr = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

    // Sheet 1: Ringkasan Performa Terapis
    const summaryData = [
      ['LAPORAN ANALITIK & KINERJA TERAPIS INSTALASI REHABILITASI MEDIK'],
      [`Tanggal Ekspor: ${dateStr}`],
      [''],
      ['No', 'Nama Terapis', 'Ruangan / Poli', 'Lokasi', 'Antrean Aktif', 'Pasien Selesai', 'Total Dilayani', 'Pasien Ranap', 'Avg Respon Time (Mnt)', 'Kepatuhan SPM (<=30m)', 'Status Beban Kerja'],
      ...stats.map((s, idx) => [
        idx + 1,
        s.officerName,
        s.boxTitle,
        s.location,
        s.activeCount,
        s.completedCount,
        s.totalCount,
        s.ranapCount,
        s.avgResponseMinutes,
        `${s.complianceRate}%`,
        s.loadStatus.toUpperCase()
      ])
    ];
    const ws1 = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, ws1, 'Ringkasan Terapis');

    // Sheet 2: Daftar Pasien Aktif per Terapis
    const activePatientData = [
      ['DAFTAR PASIEN ANTREAN AKTIF PER TERAPIS'],
      [`Waktu: ${new Date().toLocaleTimeString('id-ID')}`],
      [''],
      ['No. Antrean', 'Nama Pasien', 'No. RM', 'Terapis', 'Ruangan', 'Tindakan', 'Kategori', 'Waktu Pendaftaran', 'Est. Menit Tunggu'],
      ...patients.filter(p => !p.completed).map(p => {
        const parentBox = boxes.find(b => b.id === p.boxId);
        return [
          p.queueNumber,
          p.patientName,
          p.medicalRecordNo,
          parentBox?.officerName || '-',
          parentBox?.title || '-',
          p.actionCode || '-',
          p.isRanap ? 'Rawat Inap' : 'Rawat Jalan',
          new Date(p.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
          Math.max(0, Math.round((Date.now() - new Date(p.createdAt).getTime()) / 60000))
        ];
      })
    ];
    const ws2 = XLSX.utils.aoa_to_sheet(activePatientData);
    XLSX.utils.book_append_sheet(wb, ws2, 'Antrean Aktif');

    XLSX.writeFile(wb, `Analitik_Terapis_IRM_${getLocalDateStringWIB()}.xlsx`);
  };

  // Export Diagnosis Distribution to Excel handler
  const handleExportDiagnosisExcel = () => {
    const wb = XLSX.utils.book_new();
    const dateStr = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

    // Sheet 1: Rating Sebaran Kasus Diagnosa
    const summaryData = [
      ['LAPORAN ANALITIK SEBARAN KASUS & RATING DIAGNOSA PASIEN IRM'],
      [`Tanggal Ekspor: ${dateStr}`],
      [`Total Pasien Unik: ${diagnosisAnalytics.totalPatients} Pasien | Total Sesi Terapi: ${diagnosisAnalytics.totalSessions} Sesi | Pasien Multi-Tempat (Fisio/OT/TW): ${diagnosisAnalytics.multiTherapyPatientsCount} Pasien | Variasi Diagnosa: ${diagnosisAnalytics.uniqueDiagnosesCount} Jenis`],
      ['Catatan: Pasien yang terapi di beberapa tempat (Fisio, OT, TW) pada hari yang sama dihitung 1 kasus pada rating diagnosa.'],
      [''],
      ['Rating #', 'Nama Diagnosis', 'Kode ICF (WHO)', 'Disiplin Pelayanan', 'Kategori Klinis', 'Total Kasus (Pasien Unik)', 'Persentase (%)', 'Rawat Jalan', 'Rawat Inap', 'Pasien Warning', 'Kasus Aktif (Antre)', 'Kasus Selesai', 'Terapis Penangan Utama', 'Tindakan Terkait'],
      ...diagnosisAnalytics.ratings.map((item) => [
        `Rank #${item.rank}`,
        item.cleanName,
        item.icfCode || '-',
        item.disciplineName,
        item.category,
        item.totalCases,
        `${item.percentage}%`,
        item.rajalCases,
        item.ranapCases,
        item.warningCases,
        item.activeCases,
        item.completedCases,
        item.topTherapists.map(t => `${t.officerName} (${t.count})`).join(', ') || '-',
        item.commonProcedures.map(p => `${p.code} (${p.count})`).join(', ') || '-'
      ])
    ];
    const ws1 = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, ws1, 'Rating Sebaran Diagnosa');

    // Sheet 2: Rekap Per Kategori ICF
    const categoryData = [
      ['REKAPITULASI SEBARAN PER KATEGORI KLINIS (ICF WHO)'],
      [`Waktu Ekspor: ${new Date().toLocaleTimeString('id-ID')}`],
      [''],
      ['No', 'Kategori Klinis', 'Total Kasus Pasien', 'Persentase Total (%)', 'Variasi Diagnosa Terdaftar'],
      ...diagnosisAnalytics.categorySummaries.map((cat, idx) => [
        idx + 1,
        cat.category,
        cat.totalCases,
        `${cat.percentage}%`,
        `${cat.uniqueDiagnosesCount} Jenis Diagnosa`
      ])
    ];
    const ws2 = XLSX.utils.aoa_to_sheet(categoryData);
    XLSX.utils.book_append_sheet(wb, ws2, 'Sebaran Kategori ICF');

    // Sheet 3: Detail Pasien per Diagnosa
    const patientDetails = [
      ['RINCIAN PASIEN BERDASARKAN DIAGNOSA (DEDUP MULTI-TEMPAT)'],
      ['Catatan: Pasien multi-tempat terapi (Fisio, OT, TW) dirangkum dalam 1 baris per diagnosa utama'],
      [''],
      ['Diagnosis', 'Kategori', 'No. Antrean', 'Nama Pasien', 'No. RM', 'Tempat Terapi (Multi-Tempat)', 'Terapis Penangan', 'Tindakan Terkait', 'Kategori Rawat', 'Status Pelayanan'],
      ...diagnosisAnalytics.ratings.flatMap(r => 
        r.patients.map(p => {
          const parentBox = boxes.find(b => b.id === p.boxId);
          const multiTempatLabel = p.sessionCount && p.sessionCount > 1 
            ? `${p.sessionCount} Tempat (${p.therapyPlaces?.map(tp => tp === 'FT' ? 'Fisio' : tp === 'OT' ? 'Okupasi' : tp === 'TW' ? 'Wicara' : tp).join(', ') || '-'})`
            : (p.therapyPlaces?.[0] ? (p.therapyPlaces[0] === 'FT' ? 'Fisio' : p.therapyPlaces[0] === 'OT' ? 'Okupasi' : p.therapyPlaces[0] === 'TW' ? 'Wicara' : p.therapyPlaces[0]) : parentBox?.title || '-');

          const therapistLabel = p.therapistNames && p.therapistNames.length > 1
            ? p.therapistNames.join(' • ')
            : (parentBox?.officerName || '-');

          const statusLabel = p.sessionCount && p.sessionCount > 1
            ? (p.completed ? `Selesai (${p.sessionCount}/${p.sessionCount} Sesi)` : `${p.completedSessions || 0}/${p.sessionCount} Sesi Selesai`)
            : (p.completed ? 'Selesai' : 'Sedang Antre');

          return [
            r.cleanName,
            r.category,
            p.queueNumber,
            p.patientName,
            p.medicalRecordNo,
            multiTempatLabel,
            therapistLabel,
            p.actionCode || '-',
            p.isRanap ? 'Rawat Inap' : 'Rawat Jalan',
            statusLabel
          ];
        })
      )
    ];
    const ws3 = XLSX.utils.aoa_to_sheet(patientDetails);
    XLSX.utils.book_append_sheet(wb, ws3, 'Daftar Pasien');

    XLSX.writeFile(wb, `Rating_Sebaran_Diagnosa_IRM_${getLocalDateStringWIB()}.xlsx`);
  };

  // Export Equipment Utilization Distribution to Excel handler
  const handleExportEquipmentExcel = () => {
    const wb = XLSX.utils.book_new();
    const dateStr = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

    // Sheet 1: Rating Sebaran Utilisasi Alat
    const summaryData = [
      ['LAPORAN ANALITIK SEBARAN UTILISASI ALAT & MODALITAS TERAPI IRM'],
      [`Tanggal Ekspor: ${dateStr}`],
      [`Total Sesi Alat: ${equipmentAnalytics.totalEquipmentSessions} | Pasien dgn Modalitas: ${equipmentAnalytics.totalPatientsWithEquipment} | Unit Aktif Berjalan: ${equipmentAnalytics.activeEquipmentInUse}`],
      [''],
      ['Rating #', 'Kode', 'Nama Modalitas / Alat', 'Kategori', 'Total Sesi', 'Persentase Utilisasi (%)', 'Cakupan Pasien (%)', 'Sedang Dipakai (Aktif)', 'Selesai Dilayani', 'Rawat Jalan', 'Rawat Inap', 'Terapis Pengguna Terbanyak', 'Kasus Diagnosa Terbanyak'],
      ...equipmentAnalytics.equipmentRatings.map((item) => [
        `Rank #${item.rank}`,
        item.code,
        item.name,
        item.category,
        item.totalSessions,
        `${item.percentageOfTotal}%`,
        `${item.patientCoveragePercentage}%`,
        item.activeSessions,
        item.completedSessions,
        item.rajalSessions,
        item.ranapSessions,
        item.topTherapists.map(t => `${t.officerName} (${t.count})`).join(', ') || '-',
        item.topDiagnoses.map(d => `${d.diagnosisName} (${d.count})`).join(', ') || '-'
      ])
    ];
    const ws1 = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, ws1, 'Rating Utilisasi Alat');

    // Sheet 2: Rekap Pasien Pengguna Alat
    const patientDetails = [
      ['RINCIAN PASIEN PENGGUNA ALAT & MODALITAS'],
      [''],
      ['Nama Alat', 'Kode', 'No. Antrean', 'Nama Pasien', 'No. RM', 'Diagnosa', 'Terapis', 'Ruangan', 'Tindakan Raw', 'Jenis Rawat', 'Status'],
      ...equipmentAnalytics.equipmentRatings.flatMap(eq => 
        eq.patients.map(p => {
          const parentBox = boxes.find(b => b.id === p.boxId);
          return [
            eq.name,
            eq.code,
            p.queueNumber,
            p.patientName,
            p.medicalRecordNo,
            p.diagnosis || '-',
            parentBox?.officerName || '-',
            parentBox?.title || '-',
            p.actionCode || '-',
            p.isRanap ? 'Rawat Inap' : 'Rawat Jalan',
            p.completed ? 'Selesai' : 'Sedang Antre'
          ];
        })
      )
    ];
    const ws2 = XLSX.utils.aoa_to_sheet(patientDetails);
    XLSX.utils.book_append_sheet(wb, ws2, 'Daftar Pasien Alat');

    // Sheet 3: Kombinasi Alat
    if (equipmentAnalytics.combinations.length > 0) {
      const comboData = [
        ['KOMBINASI MODALITAS TERAPI PALING SERING DIGUNAKAN'],
        [''],
        ['No', 'Kombinasi Modalitas', 'Total Pasien', 'Persentase (%)'],
        ...equipmentAnalytics.combinations.map((c, idx) => [
          idx + 1,
          c.label,
          c.count,
          `${c.percentage}%`
        ])
      ];
      const ws3 = XLSX.utils.aoa_to_sheet(comboData);
      XLSX.utils.book_append_sheet(wb, ws3, 'Kombinasi Modalitas');
    }

    XLSX.writeFile(wb, `Sebaran_Utilisasi_Alat_IRM_${getLocalDateStringWIB()}.xlsx`);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-12">
      {/* Top Banner & Executive Header */}
      <div className="bg-gradient-to-br from-slate-950 via-teal-950 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-teal-500/20 relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-1/4 -translate-y-1/4 w-96 h-96 bg-teal-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute left-1/3 bottom-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-2.5 max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-teal-600 to-emerald-500 text-white flex items-center justify-center shadow-lg font-black ring-2 ring-teal-400/30">
                <Activity className="w-5 h-5 animate-pulse" />
              </div>
              <span className="text-[11px] font-black uppercase tracking-widest bg-teal-500/20 text-teal-300 px-3.5 py-1 rounded-full border border-teal-500/30 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-teal-300" />
                Live Therapist Intelligence &amp; Workload Radar
              </span>
              <span className="text-[11px] font-bold bg-white/10 text-slate-300 px-3 py-1 rounded-full border border-white/10">
                {therapistBoxes.length} Terapis Aktif
              </span>
            </div>
            
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white leading-tight">
              Pusat Analitik &amp; Produktivitas Terapis IRM
            </h1>
            
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-medium">
              Monitor distribusi beban antrean, utilisasi 12 modalitas &amp; tindakan terapi (MWD, TENS, US, IRR, Manipulasi, Rehab, Paket Chest+Inhalasi, Parafin, Nebu, Cryo, Vaccum, Chest), rating diagnosa, dan kecepatan tindakan terapis.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              onClick={activeTab === 'diagnosis' ? handleExportDiagnosisExcel : activeTab === 'equipment' ? handleExportEquipmentExcel : handleExportExcel}
              className="px-4 py-2.5 bg-white/10 hover:bg-white/20 active:scale-95 text-white font-bold rounded-xl text-xs border border-white/20 shadow-md transition-all cursor-pointer flex items-center gap-2"
              title="Unduh data analitik format Excel"
            >
              <Download className="w-4 h-4 text-emerald-400" />
              <span>Export Excel</span>
            </button>

            <button
              onClick={handlePrint}
              className="px-4 py-2.5 bg-white/10 hover:bg-white/20 active:scale-95 text-white font-bold rounded-xl text-xs border border-white/20 shadow-md transition-all cursor-pointer flex items-center gap-2"
              title="Cetak Laporan"
            >
              <Printer className="w-4 h-4 text-sky-400" />
              <span>Cetak</span>
            </button>

            <button
              onClick={onBackToQueue}
              className="px-5 py-2.5 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 active:scale-95 text-slate-950 font-black rounded-xl text-xs sm:text-sm shadow-xl transition-all cursor-pointer flex items-center gap-2"
            >
              <span>← Kotak Antrean</span>
            </button>
          </div>
        </div>

        {/* Quick Tabs in Header */}
        <div className="relative z-10 flex items-center gap-2 mt-6 pt-5 border-t border-white/10 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
              activeTab === 'overview'
                ? 'bg-white text-slate-950 shadow-lg font-black'
                : 'text-slate-300 hover:bg-white/10 hover:text-white'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Ikhtisar &amp; Grafik Beban</span>
          </button>

          <button
            onClick={() => setActiveTab('equipment')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
              activeTab === 'equipment'
                ? 'bg-white text-slate-950 shadow-lg font-black'
                : 'text-slate-300 hover:bg-white/10 hover:text-white'
            }`}
          >
            <Cpu className="w-4 h-4 text-amber-400" />
            <span>Sebaran Utilisasi Alat</span>
            <span className="px-1.5 py-0.2 bg-amber-500/30 text-amber-200 rounded-full text-[10px] font-mono font-black">
              8 Modalitas
            </span>
          </button>

          <button
            onClick={() => setActiveTab('diagnosis')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
              activeTab === 'diagnosis'
                ? 'bg-white text-slate-950 shadow-lg font-black'
                : 'text-slate-300 hover:bg-white/10 hover:text-white'
            }`}
          >
            <Stethoscope className="w-4 h-4 text-emerald-400" />
            <span>Rating Sebaran Diagnosa</span>
            <span className="px-1.5 py-0.2 bg-teal-500/30 text-teal-200 rounded-full text-[10px] font-mono font-black">
              {diagnosisAnalytics.uniqueDiagnosesCount}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('cards')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
              activeTab === 'cards'
                ? 'bg-white text-slate-950 shadow-lg font-black'
                : 'text-slate-300 hover:bg-white/10 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Matriks Kartu Terapis ({stats.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('table')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
              activeTab === 'table'
                ? 'bg-white text-slate-950 shadow-lg font-black'
                : 'text-slate-300 hover:bg-white/10 hover:text-white'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>Tabel Rekapitulasi Lengkap</span>
          </button>
        </div>
      </div>

      {/* Smart Workload Recommendation & Overload Warning */}
      {globalMetrics.overloadedList.length > 0 && (
        <div className="bg-gradient-to-r from-rose-500/15 via-rose-500/10 to-amber-500/15 border-2 border-rose-400/80 p-5 rounded-3xl shadow-lg text-slate-900 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-in fade-in">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-md animate-bounce">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-black uppercase tracking-wider">
                  Deteksi Penumpukan Antrean
                </span>
                <h3 className="font-extrabold text-sm sm:text-base text-rose-950">
                  {globalMetrics.overloadedList.length} Terapis Membutuhkan Pemerataan Pasien (&gt;5 Pasien Aktif)
                </h3>
              </div>
              <p className="text-xs text-rose-900 mt-1 leading-relaxed">
                Terapis padat: <strong className="font-black text-rose-950">{globalMetrics.overloadedList.map((o) => o.officerName).join(', ')}</strong>.
                {globalMetrics.availableList.length > 0 && (
                  <span>
                    {' '}Rekomendasi alihkan pasien baru ke terapis yang sedang luang/optimal: <strong className="text-teal-900 font-black">{globalMetrics.availableList.slice(0, 3).map(a => a.officerName).join(', ')}</strong>.
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="shrink-0 flex items-center gap-2">
            <button
              onClick={() => {
                setActiveTab('cards');
                setFilterLoad('overload');
              }}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-bold rounded-xl text-xs shadow-md transition-all cursor-pointer"
            >
              Lihat Terapis Terkait
            </button>
          </div>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Active Waiting */}
        <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-xs hover:shadow-md transition-all relative overflow-hidden group">
          <div className="absolute right-0 top-0 w-24 h-24 bg-blue-500/5 rounded-bl-full group-hover:scale-110 transition-transform" />
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Sedang Antre Aktif</span>
            <span className="w-9 h-9 bg-blue-50 text-blue-700 rounded-2xl flex items-center justify-center font-bold shadow-2xs">
              <Users className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <p className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight font-mono">{globalMetrics.totalActive}</p>
            <span className="text-xs font-semibold text-slate-500">Pasien</span>
          </div>
          <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-medium">
            <span>Rata-rata per terapis</span>
            <strong className="text-blue-700 font-bold font-mono">{globalMetrics.avgLoadPerTherapist} pasien</strong>
          </div>
        </div>

        {/* Total Completed */}
        <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-xs hover:shadow-md transition-all relative overflow-hidden group">
          <div className="absolute right-0 top-0 w-24 h-24 bg-emerald-500/5 rounded-bl-full group-hover:scale-110 transition-transform" />
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Selesai Tindakan</span>
            <span className="w-9 h-9 bg-emerald-50 text-emerald-700 rounded-2xl flex items-center justify-center font-bold shadow-2xs">
              <CheckCircle2 className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <p className="text-3xl sm:text-4xl font-black text-emerald-600 tracking-tight font-mono">{globalMetrics.totalCompleted}</p>
            <span className="text-xs font-semibold text-emerald-700 font-bold">Tuntas</span>
          </div>
          <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-medium">
            <span>Rawat Inap Selesai</span>
            <strong className="text-emerald-700 font-bold font-mono">{globalMetrics.totalRanap} Pasien</strong>
          </div>
        </div>

        {/* Average Response Time (Input to Checkoff) */}
        <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-xs hover:shadow-md transition-all relative overflow-hidden group">
          <div className="absolute right-0 top-0 w-24 h-24 bg-teal-500/5 rounded-bl-full group-hover:scale-110 transition-transform" />
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Avg Respon Time</span>
            <span className="w-9 h-9 bg-teal-50 text-teal-700 rounded-2xl flex items-center justify-center font-bold shadow-2xs">
              <Clock className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <p className="text-3xl sm:text-4xl font-black text-teal-700 tracking-tight font-mono">{globalMetrics.globalAvgResponse}</p>
            <span className="text-xs font-semibold text-slate-500">Menit (Daftar &rarr; Ceklis)</span>
          </div>
          <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-medium">
            <span>Standar SPM</span>
            <strong className="text-teal-700 font-bold">&le; 30 Menit</strong>
          </div>
        </div>

        {/* SPM Compliance Rate */}
        <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-xs hover:shadow-md transition-all relative overflow-hidden group">
          <div className="absolute right-0 top-0 w-24 h-24 bg-purple-500/5 rounded-bl-full group-hover:scale-110 transition-transform" />
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Kepatuhan Standar SPM</span>
            <span className="w-9 h-9 bg-purple-50 text-purple-700 rounded-2xl flex items-center justify-center font-bold shadow-2xs">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <p className={`text-3xl sm:text-4xl font-black tracking-tight font-mono ${
              globalMetrics.globalSpmRate >= 80 ? 'text-emerald-600' : 'text-amber-600'
            }`}>
              {globalMetrics.globalSpmRate}%
            </p>
            <span className="text-xs font-semibold text-slate-500">Target &ge; 80%</span>
          </div>
          <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-medium">
            <span>Status Kepatuhan</span>
            <span className={`font-bold font-mono px-2 py-0.5 rounded-full text-[10px] ${
              globalMetrics.globalSpmRate >= 80 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
            }`}>
              {globalMetrics.globalSpmRate >= 80 ? 'Memenuhi Standar' : 'Perlu Evaluasi'}
            </span>
          </div>
        </div>
      </div>

      {/* VIEW TAB 1: OVERVIEW & VISUAL CHARTS */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Top Leaderboard Podium, Top Diagnoses, & Dominant Procedures */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Top Productivity Leaderboard Podium */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                      <Trophy className="w-5 h-5 text-amber-500" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-slate-900 text-base">
                        Leaderboard Terapis
                      </h3>
                      <p className="text-xs text-slate-500">
                        Produktivitas tertinggi hari ini
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-black uppercase px-2.5 py-0.5 bg-amber-100 text-amber-900 rounded-full">
                    Top 3
                  </span>
                </div>

                {/* Podium Cards Grid */}
                <div className="space-y-3 mt-4">
                  {globalMetrics.topPerformers.map((top, idx) => {
                    const medals = [
                      { icon: Trophy, label: 'Juara 1', bg: 'bg-amber-500 text-white', border: 'border-amber-300 ring-2 ring-amber-100', badgeBg: 'bg-amber-100 text-amber-900' },
                      { icon: Medal, label: 'Juara 2', bg: 'bg-slate-400 text-white', border: 'border-slate-300 ring-1 ring-slate-100', badgeBg: 'bg-slate-100 text-slate-800' },
                      { icon: Award, label: 'Juara 3', bg: 'bg-amber-700 text-white', border: 'border-amber-200', badgeBg: 'bg-amber-50 text-amber-900' }
                    ][idx] || { icon: Award, label: `Top ${idx + 1}`, bg: 'bg-teal-500 text-white', border: 'border-slate-200', badgeBg: 'bg-slate-100 text-slate-800' };

                    const IconComp = medals.icon;

                    return (
                      <div
                        key={top.boxId}
                        className={`rounded-2xl p-3 border transition-all hover:bg-slate-50 flex items-center justify-between gap-3 ${medals.border}`}
                      >
                        <div className="flex items-center gap-3">
                          <span className={`w-8 h-8 rounded-xl ${medals.bg} flex items-center justify-center font-black shadow-xs text-xs shrink-0`}>
                            <IconComp className="w-4 h-4" />
                          </span>
                          <div>
                            <h4 className="font-extrabold text-slate-900 text-xs sm:text-sm line-clamp-1">
                              {top.officerName}
                            </h4>
                            <p className="text-[10px] text-slate-500">
                              {top.boxTitle.split('(')[0]}
                            </p>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="font-mono font-black text-emerald-600 text-sm block">
                            {top.completedCount} <span className="text-[10px] font-normal text-slate-500">pasien</span>
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {top.avgResponseMinutes}m respon
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <button
                onClick={() => setActiveTab('cards')}
                className="mt-4 w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Lihat Semua Terapis ({stats.length})</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Top Diagnoses Rating Widget */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                      <Stethoscope className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-slate-900 text-base">
                        Rating Diagnosa Terbanyak
                      </h3>
                      <p className="text-xs text-slate-500">
                        Peringkat kasus teratas hari ini
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-black uppercase px-2.5 py-0.5 bg-emerald-100 text-emerald-900 rounded-full">
                    Top 5 Rating
                  </span>
                </div>

                <div className="space-y-3 mt-4">
                  {diagnosisAnalytics.ratings.slice(0, 5).length > 0 ? (
                    diagnosisAnalytics.ratings.slice(0, 5).map((diag, idx) => (
                      <div key={diag.cleanName} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-800 flex items-center gap-1.5 truncate max-w-[200px]" title={diag.cleanName}>
                            <span className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-black shrink-0 ${
                              idx === 0 ? 'bg-amber-400 text-amber-950' : idx === 1 ? 'bg-slate-300 text-slate-900' : idx === 2 ? 'bg-amber-700 text-white' : 'bg-slate-100 text-slate-700'
                            }`}>
                              {idx + 1}
                            </span>
                            <span className="truncate">{diag.cleanName}</span>
                          </span>
                          <span className="font-mono font-bold text-slate-700 shrink-0">
                            {diag.totalCases} kasus <span className="text-slate-400 text-[10px]">({diag.percentage}%)</span>
                          </span>
                        </div>
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${diag.categoryTheme.bar} rounded-full transition-all duration-500`}
                            style={{ width: `${diag.relativePercentage}%` }}
                          />
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-400 italic text-center py-6">
                      Belum ada data diagnosa pasien hari ini
                    </p>
                  )}
                </div>
              </div>

              <button
                onClick={() => setActiveTab('diagnosis')}
                className="mt-4 w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              >
                <span>Analitik Lengkap Diagnosa ({diagnosisAnalytics.uniqueDiagnosesCount})</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Top Equipment Utilization Widget in Overview */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
                      <Cpu className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-slate-900 text-base">
                        Utilisasi Alat &amp; Modalitas
                      </h3>
                      <p className="text-xs text-slate-500">
                        8 Modalitas Fisioterapi (Kode 2, 6, 4, 1, 15, 18, 47, 74)
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-black uppercase px-2.5 py-0.5 bg-amber-100 text-amber-900 rounded-full">
                    Top Modalitas
                  </span>
                </div>

                <div className="space-y-3 mt-4">
                  {equipmentAnalytics.equipmentRatings.slice(0, 5).map((eq, idx) => (
                    <div key={eq.code} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-800 flex items-center gap-1.5 truncate max-w-[200px]" title={eq.name}>
                          <span className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-black shrink-0 ${
                            idx === 0 ? 'bg-amber-400 text-amber-950' : idx === 1 ? 'bg-slate-300 text-slate-900' : idx === 2 ? 'bg-amber-700 text-white' : 'bg-slate-100 text-slate-700'
                          }`}>
                            {idx + 1}
                          </span>
                          <span className="truncate">{eq.shortName} <span className="font-mono text-slate-400 font-normal text-[10px]">({eq.code})</span></span>
                        </span>
                        <span className="font-mono font-bold text-slate-700 shrink-0">
                          {eq.totalSessions} sesi <span className="text-slate-400 text-[10px]">({eq.percentageOfTotal}%)</span>
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${eq.theme.bar} rounded-full transition-all duration-500`}
                          style={{ width: `${eq.relativePercentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Unit Aktif Berjalan:</span>
                  <strong className="font-mono font-bold text-amber-700">{equipmentAnalytics.activeEquipmentInUse} unit aktif</strong>
                </div>
                <button
                  onClick={() => setActiveTab('equipment')}
                  className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <span>Analitik Sebaran 8 Alat</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Interactive Workload Distribution Visual Bar Chart */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-extrabold text-slate-900 text-base sm:text-lg flex items-center gap-2">
                  <Activity className="w-5 h-5 text-teal-600" />
                  Grafik Komparasi Beban &amp; Kapasitas Pelayanan per Terapis
                </h3>
                <p className="text-xs text-slate-500">
                  Perbandingan visual antrean aktif, pasien selesai, durasi layanan, dan estimasi waktu tunggu
                </p>
              </div>

              <div className="flex items-center gap-3 text-xs font-bold text-slate-600">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-md bg-blue-600" /> Aktif
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-md bg-emerald-500" /> Selesai
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-md bg-purple-500" /> Ranap
                </span>
              </div>
            </div>

            {/* Horizontal Bar Chart for each therapist */}
            <div className="space-y-4 pt-2">
              {stats.map((s) => {
                const maxBar = Math.max(10, ...stats.map(x => x.totalCount || 0));
                const activePct = Math.round((s.activeCount / maxBar) * 100);
                const completedPct = Math.round((s.completedCount / maxBar) * 100);
                const isOver = s.loadStatus === 'overload';

                return (
                  <div key={s.boxId} className="p-3.5 rounded-2xl bg-slate-50 hover:bg-teal-50/40 border border-slate-200/80 transition-all">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-white border border-slate-200 text-slate-900 font-black text-xs flex items-center justify-center shadow-2xs">
                          {s.officerName.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-extrabold text-slate-900 text-xs sm:text-sm">
                            {s.officerName}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {s.boxTitle.split('(')[0]} • 📍 {s.location}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                          isOver ? 'bg-rose-100 text-rose-800 animate-pulse' : s.loadStatus === 'busy' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {isOver ? '⚠️ Overload' : s.loadStatus === 'busy' ? 'Padat' : s.loadStatus === 'available' ? 'Luang' : 'Optimal'}
                        </span>
                        <span className="font-mono text-slate-600 text-[11px] bg-white px-2 py-0.5 rounded-lg border border-slate-200">
                          Avg Respon: <strong>{s.avgResponseMinutes}m</strong>
                        </span>
                        <span className="font-mono text-slate-600 text-[11px] bg-white px-2 py-0.5 rounded-lg border border-slate-200">
                          Est. Selesai: <strong>~{s.estimatedWaitMinutes}m</strong>
                        </span>
                      </div>
                    </div>

                    {/* Stacked Progress Bar */}
                    <div className="w-full h-4 bg-white rounded-xl overflow-hidden border border-slate-200 flex shadow-inner">
                      <div
                        style={{ width: `${activePct}%` }}
                        className="bg-blue-600 transition-all duration-500 hover:opacity-90 relative"
                        title={`Aktif Menunggu: ${s.activeCount} pasien`}
                      />
                      <div
                        style={{ width: `${completedPct}%` }}
                        className="bg-emerald-500 transition-all duration-500 hover:opacity-90 relative"
                        title={`Selesai: ${s.completedCount} pasien`}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1.5 px-1 font-medium">
                      <span>Aktif: <strong className="text-blue-700 font-mono">{s.activeCount}</strong></span>
                      <span>Selesai: <strong className="text-emerald-700 font-mono">{s.completedCount}</strong></span>
                      <span>Rawat Inap: <strong className="text-purple-700 font-mono">{s.ranapCount}</strong></span>
                      <span>Total: <strong className="text-slate-900 font-mono">{s.totalCount}</strong></span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* VIEW TAB 2: DIAGNOSIS CASE DISTRIBUTION & RATING (TERBANYAK S/D TERSEDIKIT) */}
      {activeTab === 'diagnosis' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* Header Summary Cards for Diagnoses */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-xs relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 uppercase">Variasi Diagnosa</span>
                <span className="w-8 h-8 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center font-bold">
                  <Bookmark className="w-4 h-4" />
                </span>
              </div>
              <p className="text-2xl sm:text-3xl font-black text-slate-900 font-mono mt-2">
                {diagnosisAnalytics.uniqueDiagnosesCount} <span className="text-xs font-normal text-slate-500">Jenis</span>
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                Dari {diagnosisAnalytics.totalPatients} pasien unik ({diagnosisAnalytics.totalSessions} sesi antrean)
              </p>
            </div>

            <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-xs relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 uppercase">Kategori Dominan</span>
                <span className="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
                  <Layers className="w-4 h-4" />
                </span>
              </div>
              <p className="text-base sm:text-lg font-extrabold text-blue-900 truncate mt-2" title={diagnosisAnalytics.dominantCategory}>
                {diagnosisAnalytics.dominantCategory}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                {diagnosisAnalytics.categorySummaries[0]?.totalCases || 0} kasus ({diagnosisAnalytics.categorySummaries[0]?.percentage || 0}%)
              </p>
            </div>

            <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-xs relative overflow-hidden col-span-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-amber-400 text-amber-950 font-black text-xs flex items-center justify-center shadow-xs">
                    #1
                  </span>
                  <span className="text-[11px] font-bold text-slate-500 uppercase">Kasus Terbanyak (Rating Tertinggi)</span>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900">
                  {diagnosisAnalytics.dominantDiagnosis ? `${diagnosisAnalytics.dominantDiagnosis.totalCases} Pasien Unik` : '-'}
                </span>
              </div>
              <p className="text-base sm:text-xl font-black text-slate-900 truncate mt-2">
                {diagnosisAnalytics.dominantDiagnosis?.cleanName || 'Belum ada data'}
              </p>
              <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-1">
                <span>ICF: <strong>{diagnosisAnalytics.dominantDiagnosis?.icfCode || '-'}</strong></span>
                <span>•</span>
                <span>Porsi Total: <strong>{diagnosisAnalytics.dominantDiagnosis?.percentage || 0}%</strong></span>
                <span>•</span>
                <span>Sedang Antre: <strong className="text-blue-700">{diagnosisAnalytics.dominantDiagnosis?.activeCases || 0}</strong></span>
              </div>
            </div>
          </div>

          {/* Deduplication Multi-Therapy Banner */}
          <div className="bg-gradient-to-r from-teal-50 via-cyan-50 to-indigo-50 border border-teal-200/80 rounded-2xl p-3.5 px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-teal-950 shadow-2xs">
            <div className="flex items-start sm:items-center gap-2.5">
              <span className="p-1.5 bg-teal-600 text-white rounded-lg shrink-0 mt-0.5 sm:mt-0">
                <CheckCircle2 className="w-4 h-4" />
              </span>
              <div>
                <span className="font-bold text-teal-900">Aturan Rating Terintegrasi:</span>{' '}
                <span>
                  Bila satu hari pasien yang sama terapi di 3 tempat (<strong>Fisioterapi, Okupasi Terapi, dan Terapi Wicara</strong>), dihitung <strong>1 kasus saja</strong> pada rating diagnosa.
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
              <span className="px-2.5 py-1 bg-white/90 text-teal-900 border border-teal-200 rounded-xl font-mono text-[11px] font-bold shadow-2xs">
                {diagnosisAnalytics.totalPatients} Pasien Unik
              </span>
              <span className="px-2.5 py-1 bg-teal-600 text-white rounded-xl font-mono text-[11px] font-bold shadow-2xs">
                {diagnosisAnalytics.totalSessions} Total Sesi
              </span>
              {diagnosisAnalytics.multiTherapyPatientsCount > 0 && (
                <span className="px-2.5 py-1 bg-indigo-600 text-white rounded-xl font-mono text-[11px] font-bold shadow-2xs" title="Jumlah pasien yang terapi di lebih dari 1 ruangan / disiplin hari ini">
                  🌟 {diagnosisAnalytics.multiTherapyPatientsCount} Multi-Tempat
                </span>
              )}
            </div>
          </div>

          {/* Discipline Breakdown & WHO ICF Category Ribbons */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
              <div>
                <h3 className="font-extrabold text-slate-900 text-xs sm:text-sm flex items-center gap-2">
                  <Layers className="w-4 h-4 text-teal-600" />
                  Klasifikasi ICF &amp; Disiplin Terapi (FT / OT / TW)
                </h3>
                <p className="text-[11px] text-slate-500">
                  Filter berdasarkan pilar pelayanan Fisioterapi, Okupasi Terapi, atau Terapi Wicara
                </p>
              </div>

              {/* Discipline Switcher Tabs */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDiagDiscipline('all');
                    setSelectedDiagCategory('all');
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    selectedDiagDiscipline === 'all'
                      ? 'bg-white text-slate-950 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Semua ({diagnosisAnalytics.totalPatients})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDiagDiscipline('FT');
                    setSelectedDiagCategory('all');
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    selectedDiagDiscipline === 'FT'
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'text-blue-900 hover:bg-blue-100/50'
                  }`}
                >
                  <span>⚡ FT (Fisio)</span>
                  <span className="font-mono text-[10px] px-1 py-0.2 rounded-md bg-white/20">
                    {diagnosisAnalytics.disciplineBreakdown.ftCases}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDiagDiscipline('OT');
                    setSelectedDiagCategory('all');
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    selectedDiagDiscipline === 'OT'
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'text-emerald-900 hover:bg-emerald-100/50'
                  }`}
                >
                  <span>🧩 OT (Okupasi)</span>
                  <span className="font-mono text-[10px] px-1 py-0.2 rounded-md bg-white/20">
                    {diagnosisAnalytics.disciplineBreakdown.otCases}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDiagDiscipline('TW');
                    setSelectedDiagCategory('all');
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    selectedDiagDiscipline === 'TW'
                      ? 'bg-rose-600 text-white shadow-2xs'
                      : 'text-rose-900 hover:bg-rose-100/50'
                  }`}
                >
                  <span>🗣️ TW (Wicara)</span>
                  <span className="font-mono text-[10px] px-1 py-0.2 rounded-md bg-white/20">
                    {diagnosisAnalytics.disciplineBreakdown.twCases}
                  </span>
                </button>
              </div>
            </div>

            {/* Sub-category Ribbons */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setSelectedDiagCategory('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  selectedDiagCategory === 'all'
                    ? 'bg-slate-950 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                <span>Semua Kategori</span>
                <span className="font-mono text-[10px] bg-white/20 px-1.5 py-0.2 rounded-md">
                  {filteredDiagnosisRatings.length}
                </span>
              </button>

              {diagnosisAnalytics.categorySummaries
                .filter(cat => selectedDiagDiscipline === 'all' || cat.discipline === selectedDiagDiscipline || cat.discipline === 'ALL')
                .map((cat) => {
                  const isSelected = selectedDiagCategory === cat.category;
                  return (
                    <button
                      key={cat.category}
                      type="button"
                      onClick={() => setSelectedDiagCategory(isSelected ? 'all' : cat.category)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border flex items-center gap-1.5 ${
                        isSelected
                          ? `${cat.theme.iconBg} shadow-sm border-transparent`
                          : `${cat.theme.bg} ${cat.theme.text} ${cat.theme.border} hover:opacity-80`
                      }`}
                    >
                      <span>{cat.category}</span>
                      <span className="font-mono text-[10px] px-1.5 py-0.2 rounded-md bg-white/30">
                        {cat.totalCases} ({cat.percentage}%)
                      </span>
                    </button>
                  );
                })}
            </div>
          </div>

          {/* Top 3 Rating Podium Cards */}
          {diagnosisAnalytics.top3Podium.length > 0 && selectedDiagCategory === 'all' && !diagSearch.trim() && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {diagnosisAnalytics.top3Podium.map((item, idx) => {
                const podiums = [
                  {
                    rankLabel: 'Rating #1 - Kasus Terbanyak',
                    medalIcon: Trophy,
                    headerBg: 'bg-gradient-to-r from-amber-500 to-yellow-400 text-amber-950',
                    badge: 'bg-amber-100 text-amber-900 border-amber-300',
                    border: 'border-amber-300 ring-2 ring-amber-100 shadow-md',
                    rankNumBg: 'bg-amber-400 text-amber-950',
                  },
                  {
                    rankLabel: 'Rating #2 - Terbanyak Ke-2',
                    medalIcon: Medal,
                    headerBg: 'bg-gradient-to-r from-slate-300 to-slate-400 text-slate-900',
                    badge: 'bg-slate-100 text-slate-800 border-slate-300',
                    border: 'border-slate-300 shadow-xs',
                    rankNumBg: 'bg-slate-300 text-slate-900',
                  },
                  {
                    rankLabel: 'Rating #3 - Terbanyak Ke-3',
                    medalIcon: Award,
                    headerBg: 'bg-gradient-to-r from-amber-700 to-orange-700 text-white',
                    badge: 'bg-orange-100 text-orange-900 border-orange-200',
                    border: 'border-orange-200 shadow-xs',
                    rankNumBg: 'bg-amber-700 text-white',
                  },
                ][idx];

                const IconComp = podiums.medalIcon;

                return (
                  <div
                    key={item.cleanName}
                    className={`bg-white rounded-3xl border overflow-hidden transition-all hover:scale-[1.01] flex flex-col justify-between ${podiums.border}`}
                  >
                    <div>
                      {/* Card Header */}
                      <div className={`px-4 py-2.5 flex items-center justify-between font-black text-xs ${podiums.headerBg}`}>
                        <div className="flex items-center gap-1.5">
                          <IconComp className="w-4 h-4" />
                          <span>{podiums.rankLabel}</span>
                        </div>
                        <span className="font-mono text-xs">
                          {item.totalCases} Kasus ({item.percentage}%)
                        </span>
                      </div>

                      <div className="p-5 space-y-3.5">
                        <div>
                          <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold border mb-1.5 ${item.categoryTheme.badge}`}>
                            {item.category}
                          </span>
                          <h4 className="font-black text-slate-900 text-base leading-snug">
                            {item.cleanName}
                          </h4>
                          {item.icfCode && (
                            <span className="inline-block mt-1 text-[11px] font-mono font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                              ICF: {item.icfCode}
                            </span>
                          )}
                        </div>

                        {/* Progress Bar Active vs Completed */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-blue-700 font-bold">Aktif: {item.activeCases}</span>
                            <span className="text-emerald-700 font-bold">Selesai: {item.completedCases}</span>
                          </div>
                          <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden flex border border-slate-200 shadow-inner">
                            <div
                              style={{ width: `${item.totalCases > 0 ? (item.activeCases / item.totalCases) * 100 : 0}%` }}
                              className="bg-blue-600 h-full"
                              title={`Aktif: ${item.activeCases}`}
                            />
                            <div
                              style={{ width: `${item.totalCases > 0 ? (item.completedCases / item.totalCases) * 100 : 0}%` }}
                              className="bg-emerald-500 h-full"
                              title={`Selesai: ${item.completedCases}`}
                            />
                          </div>
                        </div>

                        {/* Metrics Breakdown */}
                        <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                          <div className="bg-slate-50 p-2 rounded-xl border border-slate-200/80">
                            <span className="text-[10px] text-slate-500 block">Rajal</span>
                            <strong className="font-mono text-slate-900 font-bold text-xs">{item.rajalCases}</strong>
                          </div>
                          <div className="bg-purple-50/60 p-2 rounded-xl border border-purple-200">
                            <span className="text-[10px] text-purple-800 block">Ranap</span>
                            <strong className="font-mono text-purple-900 font-bold text-xs">{item.ranapCases}</strong>
                          </div>
                          <div className="bg-rose-50/60 p-2 rounded-xl border border-rose-200">
                            <span className="text-[10px] text-rose-800 block">Warning</span>
                            <strong className="font-mono text-rose-900 font-bold text-xs">{item.warningCases}</strong>
                          </div>
                        </div>

                        {/* Top Therapists */}
                        {item.topTherapists.length > 0 && (
                          <div className="pt-2 border-t border-slate-100 text-xs">
                            <span className="text-[11px] text-slate-500 block mb-1 font-medium">Terapis Penangan:</span>
                            <div className="flex flex-wrap gap-1">
                              {item.topTherapists.map(t => (
                                <span key={t.boxId} className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md text-[11px] font-semibold">
                                  {t.officerName} ({t.count})
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="p-4 bg-slate-50 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setExpandedDiagRank(expandedDiagRank === item.rank ? null : item.rank)}
                        className="w-full py-2 bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                      >
                        <Users className="w-3.5 h-3.5 text-teal-600" />
                        <span>{expandedDiagRank === item.rank ? 'Tutup Daftar Pasien' : `Lihat ${item.totalCases} Pasien`}</span>
                        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expandedDiagRank === item.rank ? 'rotate-180' : ''}`} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Search, Filter, Sort, & Export Toolbar */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
              {/* Search Bar */}
              <div className="relative flex-1 min-w-[220px]">
                <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                <input
                  type="text"
                  value={diagSearch}
                  onChange={(e) => setDiagSearch(e.target.value)}
                  placeholder="Cari diagnosa, kode ICF, nama pasien, no RM..."
                  className="w-full pl-10 pr-4 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:ring-2 focus:ring-teal-500 focus:outline-hidden transition-all"
                />
                {diagSearch && (
                  <button
                    onClick={() => setDiagSearch('')}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Patient Type Filter */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl">
                {[
                  { id: 'all', label: 'Semua' },
                  { id: 'rajal', label: 'Rajal' },
                  { id: 'ranap', label: 'Ranap' },
                  { id: 'warning', label: 'Warning' },
                  { id: 'active', label: 'Sedang Antre' }
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelectedDiagType(t.id as any)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      selectedDiagType === t.id
                        ? 'bg-white text-slate-950 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Sort Order Selector & Excel Export */}
            <div className="flex items-center gap-2.5">
              <div className="flex items-center gap-1.5 text-xs bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
                <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-slate-500 font-medium">Urutan:</span>
                <select
                  value={diagSortOrder}
                  onChange={(e) => setDiagSortOrder(e.target.value as any)}
                  className="bg-transparent font-bold text-slate-800 focus:outline-hidden cursor-pointer"
                >
                  <option value="count_desc">🏆 Terbanyak → Tersedikit (Rating Default)</option>
                  <option value="count_asc">🔺 Tersedikit → Terbanyak</option>
                  <option value="name_asc">🔤 Nama Diagnosa (A-Z)</option>
                  <option value="active_desc">⏳ Kasus Aktif Terbanyak</option>
                </select>
              </div>

              <button
                type="button"
                onClick={handleExportDiagnosisExcel}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold rounded-xl text-xs shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
                title="Ekspor daftar rating diagnosa ke format Excel"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Export Rating (.xlsx)</span>
              </button>
            </div>
          </div>

          {/* Complete Ranked List of Diagnoses (Rating #1 to #N) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-slate-900 text-base">
                  Daftar Rating Sebaran Kasus Diagnosa
                </h3>
                <span className="px-2.5 py-0.5 bg-slate-900 text-white rounded-full text-xs font-mono font-bold">
                  {filteredDiagnosisRatings.length} Kasus
                </span>
              </div>
              <span className="text-xs text-slate-500">
                Diurutkan berdasarkan frekuensi kemunculan kasus
              </span>
            </div>

            {filteredDiagnosisRatings.length > 0 ? (
              filteredDiagnosisRatings.map((item) => {
                const isExpanded = expandedDiagRank === item.rank;

                return (
                  <div
                    key={item.cleanName}
                    className="bg-white rounded-3xl border border-slate-200 shadow-xs hover:shadow-md transition-all overflow-hidden"
                  >
                    {/* Main Diagnosis Card Body */}
                    <div className="p-5 sm:p-6">
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        {/* Rank Badge & Title */}
                        <div className="flex items-start gap-3.5 flex-1">
                          <div className={`w-11 h-11 rounded-2xl flex flex-col items-center justify-center font-black shrink-0 shadow-2xs ${
                            item.rank === 1
                              ? 'bg-amber-400 text-amber-950 ring-2 ring-amber-200'
                              : item.rank === 2
                              ? 'bg-slate-300 text-slate-900 ring-2 ring-slate-100'
                              : item.rank === 3
                              ? 'bg-amber-700 text-white ring-2 ring-amber-100'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}>
                            <span className="text-[9px] uppercase tracking-tighter opacity-75">Rank</span>
                            <span className="text-sm font-mono leading-none">#{item.rank}</span>
                          </div>

                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${item.categoryTheme.badge}`}>
                                {item.category}
                              </span>
                              {item.discipline !== 'ALL' && (
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  item.discipline === 'FT' ? 'bg-blue-100 text-blue-800 border border-blue-200' :
                                  item.discipline === 'OT' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                                  'bg-rose-100 text-rose-800 border border-rose-200'
                                }`}>
                                  {item.discipline === 'FT' ? '⚡ Fisioterapi' : item.discipline === 'OT' ? '🧩 Okupasi' : '🗣️ Wicara'}
                                </span>
                              )}
                              {item.icfCode && (
                                <span className="px-2 py-0.5 bg-slate-100 text-slate-700 font-mono text-[11px] font-bold rounded-md border border-slate-200">
                                  ICF: {item.icfCode}
                                </span>
                              )}
                            </div>

                            <h4 className="text-base sm:text-lg font-black text-slate-900 leading-snug">
                              {item.cleanName}
                            </h4>

                            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 pt-0.5">
                              <span>Rawat Jalan: <strong className="text-slate-800 font-mono">{item.rajalCases}</strong></span>
                              <span>•</span>
                              <span>Rawat Inap: <strong className="text-purple-700 font-mono">{item.ranapCases}</strong></span>
                              {item.warningCases > 0 && (
                                <>
                                  <span>•</span>
                                  <span className="text-rose-600 font-bold">⚠️ {item.warningCases} Pasien Warning</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Frequency & Progress Bar */}
                        <div className="lg:w-80 space-y-2 shrink-0">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-extrabold text-slate-900 text-sm">
                              {item.totalCases} <span className="text-xs font-medium text-slate-500">Pasien</span>
                            </span>
                            <span className="font-mono font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200">
                              {item.percentage}% dari total
                            </span>
                          </div>

                          {/* Relative Proportion Bar */}
                          <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden flex border border-slate-200 shadow-inner">
                            <div
                              style={{ width: `${item.totalCases > 0 ? (item.activeCases / item.totalCases) * 100 : 0}%` }}
                              className="bg-blue-600 h-full transition-all duration-500"
                              title={`Sedang Antre: ${item.activeCases} pasien`}
                            />
                            <div
                              style={{ width: `${item.totalCases > 0 ? (item.completedCases / item.totalCases) * 100 : 0}%` }}
                              className="bg-emerald-500 h-full transition-all duration-500"
                              title={`Selesai Dilayani: ${item.completedCases} pasien`}
                            />
                          </div>

                          <div className="flex items-center justify-between text-[11px] text-slate-500">
                            <span className="flex items-center gap-1 font-semibold text-blue-700">
                              <span className="w-2 h-2 rounded-full bg-blue-600" />
                              Antre: {item.activeCases}
                            </span>
                            <span className="flex items-center gap-1 font-semibold text-emerald-700">
                              <span className="w-2 h-2 rounded-full bg-emerald-500" />
                              Selesai: {item.completedCases}
                            </span>
                          </div>
                        </div>

                        {/* Action Toggle Button */}
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => setExpandedDiagRank(isExpanded ? null : item.rank)}
                            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border shadow-2xs ${
                              isExpanded
                                ? 'bg-slate-900 text-white border-slate-900'
                                : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200'
                            }`}
                          >
                            <Users className="w-4 h-4 text-teal-600" />
                            <span>{isExpanded ? 'Tutup Pasien' : `Daftar Pasien (${item.totalCases})`}</span>
                            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                          </button>
                        </div>
                      </div>

                      {/* Associated Therapists & Modalities Chips */}
                      <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-slate-500 font-medium mr-1">Terapis:</span>
                          {item.topTherapists.map(t => (
                            <span key={t.boxId} className="px-2.5 py-1 bg-slate-50 text-slate-800 rounded-xl border border-slate-200 font-semibold text-[11px] flex items-center gap-1">
                              <span>{t.officerName}</span>
                              <span className="font-mono text-teal-700 font-bold">({t.count})</span>
                            </span>
                          ))}
                        </div>

                        {item.commonProcedures.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-slate-500 font-medium mr-1">Modalitas/Tindakan:</span>
                            {item.commonProcedures.map(p => (
                              <span key={p.code} className="px-2 py-0.5 bg-teal-50 text-teal-800 rounded-lg border border-teal-200 font-bold font-mono text-[10px]">
                                {p.code} ({p.count})
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Expandable Patient List Accordion */}
                    {isExpanded && (
                      <div className="bg-slate-50/80 p-5 border-t border-slate-200 animate-in slide-in-from-top-2 duration-200">
                        <div className="flex items-center justify-between mb-3">
                          <h5 className="font-extrabold text-xs text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                            <FileText className="w-3.5 h-3.5 text-teal-600" />
                            Rincian Pasien Diagnosa: {item.cleanName}
                          </h5>
                          <span className="text-xs text-slate-500 font-medium">
                            {item.patients.length} Pasien Terdata
                          </span>
                        </div>

                        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-2xs">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-slate-100/80 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                              <tr>
                                <th className="py-3 px-3.5">No. Antrean</th>
                                <th className="py-3 px-3.5">Nama Pasien</th>
                                <th className="py-3 px-3.5">No. RM</th>
                                <th className="py-3 px-3.5">Terapis Penangan</th>
                                <th className="py-3 px-3.5">Ruangan / Poli</th>
                                <th className="py-3 px-3.5">Tindakan</th>
                                <th className="py-3 px-3.5">Tipe Rawat</th>
                                <th className="py-3 px-3.5">Status</th>
                                <th className="py-3 px-3.5 text-right">Aksi</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {item.patients.map((p, pIdx) => {
                                const parentBox = boxes.find(b => b.id === p.boxId);
                                const isMulti = p.sessionCount && p.sessionCount > 1;

                                return (
                                  <tr key={`diag-p-${p.id || pIdx}-${pIdx}`} className="hover:bg-slate-50/80 transition-colors">
                                    <td className="py-3 px-3.5 font-mono font-black text-slate-900 text-sm">
                                      <div className="flex flex-col">
                                        <span>{p.queueNumber}</span>
                                        {isMulti && (
                                          <span className="text-[10px] text-teal-700 font-bold font-sans">
                                            {p.sessionCount} Sesi / Tiket
                                          </span>
                                        )}
                                      </div>
                                    </td>
                                    <td className="py-3 px-3.5 font-bold text-slate-900">
                                      <div className="flex flex-col gap-1">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          <span>{p.patientName}</span>
                                          {p.isWarning && (
                                            <span className="px-1.5 py-0.2 bg-rose-100 text-rose-800 text-[10px] rounded font-bold">
                                              ⚠️ Warning
                                            </span>
                                          )}
                                        </div>
                                        {isMulti && (
                                          <div className="flex items-center gap-1 flex-wrap">
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-indigo-50 text-indigo-800 border border-indigo-200">
                                              <span>🌟 {p.sessionCount} Tempat:</span>
                                              <span className="font-bold">
                                                {p.therapyPlaces?.map(tp => tp === 'FT' ? 'Fisio' : tp === 'OT' ? 'Okupasi' : tp === 'TW' ? 'Wicara' : tp).join(' + ')}
                                              </span>
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                    </td>
                                    <td className="py-3 px-3.5 font-mono text-slate-600 font-semibold">
                                      {p.medicalRecordNo || '-'}
                                    </td>
                                    <td className="py-3 px-3.5 font-semibold text-slate-800">
                                      {p.therapistNames && p.therapistNames.length > 1 ? (
                                        <div className="flex flex-col gap-0.5">
                                          <span className="text-xs font-bold text-slate-900 leading-snug">
                                            {p.therapistNames.join(' • ')}
                                          </span>
                                          <span className="text-[10px] text-indigo-700 font-semibold">
                                            {p.therapistNames.length} Terapis Penangan
                                          </span>
                                        </div>
                                      ) : (
                                        parentBox?.officerName || '-'
                                      )}
                                    </td>
                                    <td className="py-3 px-3.5 text-slate-600">
                                      {p.therapyPlaces && p.therapyPlaces.length > 1 ? (
                                        <span className="font-semibold text-slate-800 text-xs">
                                          {p.therapyPlaces.map(tp => tp === 'FT' ? 'Fisioterapi' : tp === 'OT' ? 'Okupasi Terapi' : tp === 'TW' ? 'Terapi Wicara' : tp).join(', ')}
                                        </span>
                                      ) : (
                                        parentBox?.title || '-'
                                      )}
                                    </td>
                                    <td className="py-3 px-3.5">
                                      <span className="px-2 py-0.5 bg-slate-100 text-slate-800 rounded font-bold font-mono text-[10px]">
                                        {p.actionCode || 'Umum'}
                                      </span>
                                    </td>
                                    <td className="py-3 px-3.5">
                                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                        p.isRanap ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                                      }`}>
                                        {p.isRanap ? 'Rawat Inap' : 'Rawat Jalan'}
                                      </span>
                                    </td>
                                    <td className="py-3 px-3.5">
                                      {isMulti ? (
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 w-fit ${
                                          p.completed ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                                        }`}>
                                          <span className={`w-1.5 h-1.5 rounded-full ${p.completed ? 'bg-emerald-600' : 'bg-amber-600'}`} />
                                          {p.completed ? `Selesai (${p.sessionCount}/${p.sessionCount} Sesi)` : `${p.completedSessions || 0}/${p.sessionCount} Selesai`}
                                        </span>
                                      ) : (
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 w-fit ${
                                          p.completed ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                                        }`}>
                                          <span className={`w-1.5 h-1.5 rounded-full ${p.completed ? 'bg-emerald-600' : 'bg-amber-600'}`} />
                                          {p.completed ? 'Selesai' : 'Sedang Antre'}
                                        </span>
                                      )}
                                    </td>
                                    <td className="py-3 px-3.5 text-right">
                                      {parentBox && (
                                        <button
                                          type="button"
                                          onClick={() => onSelectTherapistFocus(parentBox.id)}
                                          className="px-2.5 py-1 bg-teal-50 hover:bg-teal-100 text-teal-800 rounded-lg text-xs font-bold border border-teal-200 transition-all cursor-pointer"
                                        >
                                          Buka Kotak
                                        </button>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                  <Search className="w-6 h-6" />
                </div>
                <h4 className="font-extrabold text-slate-800 text-base">
                  Tidak ada diagnosa yang cocok
                </h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Coba ubah kata kunci pencarian atau bersihkan filter kategori untuk melihat seluruh rating kasus.
                </p>
                <button
                  onClick={() => {
                    setDiagSearch('');
                    setSelectedDiagCategory('all');
                    setSelectedDiagType('all');
                  }}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Reset Semua Filter
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW TAB 2: SEBARAN UTILISASI ALAT & MODALITAS */}
      {activeTab === 'equipment' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* Executive Overview Stat Cards for Equipment */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Sesi Alat */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-black shrink-0 ring-1 ring-amber-200">
                <Cpu className="w-6 h-6" />
              </div>
              <div className="space-y-0.5">
                <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Total Sesi Pemakaian</p>
                <h3 className="text-2xl font-black text-slate-900 font-mono">
                  {equipmentAnalytics.totalEquipmentSessions} <span className="text-xs font-semibold text-slate-500 font-sans">sesi</span>
                </h3>
                <p className="text-[11px] text-slate-500">
                  Dari 8 jenis modalitas fisioterapi
                </p>
              </div>
            </div>

            {/* Rank #1 Terpopuler */}
            <div className="bg-gradient-to-br from-amber-500/10 via-yellow-500/5 to-white rounded-3xl p-5 border border-amber-300/80 shadow-xs flex items-center gap-4 relative overflow-hidden">
              <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center font-black shrink-0 shadow-md">
                <Trophy className="w-6 h-6" />
              </div>
              <div className="space-y-0.5 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-black uppercase px-2 py-0.2 bg-amber-500 text-white rounded-full">
                    Rank #1 Terpopuler
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-black text-amber-950 truncate">
                  {equipmentAnalytics.top1Equipment ? equipmentAnalytics.top1Equipment.shortName : '-'}
                </h3>
                <p className="text-[11px] text-amber-800 font-semibold">
                  {equipmentAnalytics.top1Equipment ? `${equipmentAnalytics.top1Equipment.totalSessions} sesi (${equipmentAnalytics.top1Equipment.percentageOfTotal}%)` : 'Belum ada data'}
                </p>
              </div>
            </div>

            {/* Sedang Berjalan (Active In-Use) */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-black shrink-0 ring-1 ring-blue-200">
                <Activity className="w-6 h-6 animate-pulse" />
              </div>
              <div className="space-y-0.5">
                <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Sedang Digunakan (Aktif)</p>
                <h3 className="text-2xl font-black text-blue-700 font-mono">
                  {equipmentAnalytics.activeEquipmentInUse} <span className="text-xs font-semibold text-slate-500 font-sans">unit / pasien</span>
                </h3>
                <p className="text-[11px] text-slate-500">
                  {equipmentAnalytics.completedEquipmentSessions} sesi selesai dilayani
                </p>
              </div>
            </div>

            {/* Cakupan Pasien */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center font-black shrink-0 ring-1 ring-teal-200">
                <Users className="w-6 h-6" />
              </div>
              <div className="space-y-0.5">
                <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Pasien dgn Modalitas</p>
                <h3 className="text-2xl font-black text-teal-800 font-mono">
                  {equipmentAnalytics.totalPatientsWithEquipment} <span className="text-xs font-semibold text-slate-500 font-sans">pasien</span>
                </h3>
                <p className="text-[11px] text-slate-500">
                  {patients.length > 0 ? Math.round((equipmentAnalytics.totalPatientsWithEquipment / patients.length) * 100) : 0}% dari seluruh antrean
                </p>
              </div>
            </div>
          </div>

          {/* Top 3 Podium Cards */}
          {equipmentAnalytics.top3Podium.length > 0 && (
            <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-700 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-amber-400/20 text-amber-300 font-black">
                      <Trophy className="w-4 h-4" />
                    </span>
                    <span className="text-xs font-black uppercase tracking-widest text-amber-400">
                      Podium Utilisasi Modalitas Tertinggi
                    </span>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-black text-white">
                    Top 3 Alat Terapi Paling Banyak Digunakan Hari Ini
                  </h3>
                </div>

                <span className="text-xs text-slate-300 bg-white/10 px-3 py-1.5 rounded-xl border border-white/10 w-fit">
                  Peringkat Berdasarkan Frekuensi Tindakan Pasien
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {equipmentAnalytics.top3Podium.map((item, idx) => {
                  const podiumStyles = [
                    {
                      medal: 'Juara 1 (Terbanyak)',
                      badgeBg: 'bg-amber-400 text-amber-950',
                      border: 'border-amber-400/50 ring-2 ring-amber-400/20',
                      cardBg: 'bg-gradient-to-b from-amber-500/20 to-slate-900/90',
                      iconColor: 'text-amber-400',
                    },
                    {
                      medal: 'Juara 2',
                      badgeBg: 'bg-slate-300 text-slate-950',
                      border: 'border-slate-400/40 ring-1 ring-slate-400/10',
                      cardBg: 'bg-gradient-to-b from-slate-400/15 to-slate-900/90',
                      iconColor: 'text-slate-300',
                    },
                    {
                      medal: 'Juara 3',
                      badgeBg: 'bg-amber-700 text-white',
                      border: 'border-amber-700/40',
                      cardBg: 'bg-gradient-to-b from-amber-700/15 to-slate-900/90',
                      iconColor: 'text-amber-500',
                    },
                  ][idx];

                  return (
                    <div
                      key={item.code}
                      className={`rounded-2xl p-5 border ${podiumStyles.border} ${podiumStyles.cardBg} space-y-4 backdrop-blur-md flex flex-col justify-between`}
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${podiumStyles.badgeBg}`}>
                            {podiumStyles.medal}
                          </span>
                          <span className="font-mono text-xs font-bold text-amber-300 bg-black/40 px-2 py-0.5 rounded-md border border-white/10">
                            Kode: {item.code}
                          </span>
                        </div>

                        <div>
                          <span className="text-[10px] font-semibold text-slate-300 uppercase tracking-wider block">
                            {item.category}
                          </span>
                          <h4 className="text-lg font-black text-white leading-tight">
                            {item.shortName}
                          </h4>
                          <p className="text-xs text-slate-300 line-clamp-2 mt-1">
                            {item.description}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2 pt-3 border-t border-white/10">
                        <div className="flex items-baseline justify-between">
                          <span className="text-2xl font-black font-mono text-white">
                            {item.totalSessions} <span className="text-xs font-normal text-slate-300 font-sans">sesi</span>
                          </span>
                          <span className="text-xs font-mono font-bold text-amber-300">
                            {item.percentageOfTotal}% share
                          </span>
                        </div>

                        {/* Mini Visual Bar */}
                        <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${item.theme.bar} rounded-full`}
                            style={{ width: `${item.relativePercentage}%` }}
                          />
                        </div>

                        <div className="flex items-center justify-between text-[10px] text-slate-300 pt-1 font-medium">
                          <span>Aktif: <strong className="text-blue-300">{item.activeSessions}</strong></span>
                          <span>•</span>
                          <span>Selesai: <strong className="text-emerald-300">{item.completedSessions}</strong></span>
                          <span>•</span>
                          <span>Ranap: <strong className="text-purple-300">{item.ranapSessions}</strong></span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Filters, Search & Toolbar */}
          <div className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              {/* Search input */}
              <div className="relative flex-1 min-w-[260px]">
                <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                <input
                  type="text"
                  value={equipSearch}
                  onChange={(e) => setEquipSearch(e.target.value)}
                  placeholder="Cari alat/tindakan (MWD, TENS, US, IRR, Manipulasi, Rehab, Paket Chest, Parafin, Nebu, Cryo, Vaccum, Chest), kode, atau nama pasien..."
                  className="w-full pl-10 pr-4 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-hidden transition-all"
                />
                {equipSearch && (
                  <button
                    onClick={() => setEquipSearch('')}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Status / Service Type Filter */}
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  onClick={() => setSelectedEquipType('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    selectedEquipType === 'all'
                      ? 'bg-slate-950 text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  Semua Status
                </button>
                <button
                  onClick={() => setSelectedEquipType('active')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    selectedEquipType === 'active'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200'
                  }`}
                >
                  Sedang Aktif ({equipmentAnalytics.activeEquipmentInUse})
                </button>
                <button
                  onClick={() => setSelectedEquipType('completed')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    selectedEquipType === 'completed'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200'
                  }`}
                >
                  Selesai ({equipmentAnalytics.completedEquipmentSessions})
                </button>
                <button
                  onClick={() => setSelectedEquipType('rajal')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    selectedEquipType === 'rajal'
                      ? 'bg-teal-600 text-white shadow-xs'
                      : 'bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200'
                  }`}
                >
                  Rajal
                </button>
                <button
                  onClick={() => setSelectedEquipType('ranap')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    selectedEquipType === 'ranap'
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200'
                  }`}
                >
                  Ranap
                </button>
              </div>

              {/* Sort Order Selector & Excel Button */}
              <div className="flex items-center gap-2 shrink-0">
                <select
                  value={equipSortOrder}
                  onChange={(e) => setEquipSortOrder(e.target.value as any)}
                  className="px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden cursor-pointer"
                >
                  <option value="sessions_desc">Sesi Terbanyak (Desc)</option>
                  <option value="sessions_asc">Sesi Tersedikit (Asc)</option>
                  <option value="active_desc">Sedang Aktif Terbanyak</option>
                  <option value="name_asc">Nama Alat (A-Z)</option>
                </select>

                <button
                  onClick={handleExportEquipmentExcel}
                  className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
                  title="Unduh Laporan Utilisasi Alat Format Excel"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Excel</span>
                </button>
              </div>
            </div>

            {/* Quick 8 Modalitas Filter Chips */}
            <div className="flex items-center gap-1.5 pt-2 border-t border-slate-100 overflow-x-auto no-scrollbar">
              <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider mr-1 shrink-0">
                Filter Alat:
              </span>
              <button
                onClick={() => setSelectedEquipCode('all')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0 ${
                  selectedEquipCode === 'all'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Semua (8)
              </button>
              {Object.values(KNOWN_EQUIPMENT).map((def) => {
                const isSelected = selectedEquipCode === def.code;
                const count = equipmentAnalytics.equipmentRatings.find(r => r.code === def.code)?.totalSessions || 0;
                return (
                  <button
                    key={def.code}
                    onClick={() => setSelectedEquipCode(isSelected ? 'all' : def.code)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0 flex items-center gap-1.5 border ${
                      isSelected
                        ? `${def.theme.badge} ring-2 ring-amber-400`
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <span className="font-mono text-[10px] opacity-75">#{def.code}</span>
                    <span>{def.shortName}</span>
                    <span className="px-1.5 py-0.2 bg-black/10 rounded-full text-[10px] font-mono">
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Ranked List of Equipment Cards (Terbanyak s/d Tersedikit) */}
          <div className="space-y-4">
            {filteredEquipmentRatings.length > 0 ? (
              filteredEquipmentRatings.map((item) => {
                const isExpanded = expandedEquipCode === item.code;

                return (
                  <div
                    key={item.code}
                    className="bg-white rounded-3xl border border-slate-200 shadow-xs hover:shadow-md transition-all overflow-hidden"
                  >
                    {/* Main Card Header & Row */}
                    <div className="p-5 sm:p-6">
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                        {/* Rank Badge, Code, and Tool Details */}
                        <div className="flex items-start gap-4 flex-1">
                          <div className={`w-12 h-12 rounded-2xl flex flex-col items-center justify-center font-black shrink-0 shadow-2xs ${
                            item.rank === 1
                              ? 'bg-amber-400 text-amber-950 ring-2 ring-amber-200'
                              : item.rank === 2
                              ? 'bg-slate-300 text-slate-900 ring-2 ring-slate-100'
                              : item.rank === 3
                              ? 'bg-amber-700 text-white ring-2 ring-amber-100'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}>
                            <span className="text-[9px] uppercase tracking-tighter opacity-75">Rank</span>
                            <span className="text-sm font-mono leading-none">#{item.rank}</span>
                          </div>

                          <div className="space-y-1.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="px-2.5 py-0.5 rounded-md font-mono text-xs font-black bg-slate-900 text-white">
                                Kode: {item.code}
                              </span>
                              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${item.theme.badge}`}>
                                {item.category}
                              </span>
                            </div>

                            <h4 className="text-base sm:text-lg font-black text-slate-900 leading-snug">
                              {item.name}
                            </h4>

                            <p className="text-xs text-slate-500 leading-relaxed max-w-xl">
                              {item.description}
                            </p>

                            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 pt-1">
                              <span>Rawat Jalan: <strong className="text-slate-800 font-mono">{item.rajalSessions}</strong></span>
                              <span>•</span>
                              <span>Rawat Inap: <strong className="text-purple-700 font-mono">{item.ranapSessions}</strong></span>
                              <span>•</span>
                              <span>Cakupan Pasien: <strong className="text-teal-700 font-mono">{item.patientCoveragePercentage}%</strong></span>
                            </div>
                          </div>
                        </div>

                        {/* Frequency & Progress Bar */}
                        <div className="lg:w-80 space-y-2 shrink-0">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-extrabold text-slate-900 text-sm">
                              {item.totalSessions} <span className="text-xs font-medium text-slate-500">Sesi Terapi</span>
                            </span>
                            <span className="font-mono font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                              {item.percentageOfTotal}% share
                            </span>
                          </div>

                          {/* Dual-bar: Active in use vs Completed */}
                          <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden flex border border-slate-200 shadow-inner">
                            <div
                              style={{ width: `${item.totalSessions > 0 ? (item.activeSessions / item.totalSessions) * 100 : 0}%` }}
                              className="bg-blue-600 h-full transition-all duration-500"
                              title={`Sedang Aktif Dipakai: ${item.activeSessions} pasien`}
                            />
                            <div
                              style={{ width: `${item.totalSessions > 0 ? (item.completedSessions / item.totalSessions) * 100 : 0}%` }}
                              className="bg-emerald-500 h-full transition-all duration-500"
                              title={`Selesai Dilayani: ${item.completedSessions} pasien`}
                            />
                          </div>

                          <div className="flex items-center justify-between text-[11px] text-slate-500">
                            <span className="flex items-center gap-1 font-semibold text-blue-700">
                              <span className="w-2 h-2 rounded-full bg-blue-600" />
                              Sedang Dipakai: {item.activeSessions} unit
                            </span>
                            <span className="flex items-center gap-1 font-semibold text-emerald-700">
                              <span className="w-2 h-2 rounded-full bg-emerald-500" />
                              Selesai: {item.completedSessions}
                            </span>
                          </div>
                        </div>

                        {/* Toggle Expand Patient List */}
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => setExpandedEquipCode(isExpanded ? null : item.code)}
                            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border shadow-2xs ${
                              isExpanded
                                ? 'bg-slate-900 text-white border-slate-900'
                                : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200'
                            }`}
                          >
                            <Users className="w-3.5 h-3.5" />
                            <span>{isExpanded ? 'Tutup Daftar' : `Daftar Pasien (${item.patients.length})`}</span>
                            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                          </button>
                        </div>
                      </div>

                      {/* Top Therapists & Top Diagnoses Badges */}
                      <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                        {/* Top Therapists for this tool */}
                        <div className="space-y-1.5">
                          <span className="font-extrabold text-slate-500 uppercase tracking-wider text-[10px] flex items-center gap-1">
                            <Users className="w-3 h-3 text-slate-400" />
                            Terapis Pengguna Terbanyak:
                          </span>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {item.topTherapists.length > 0 ? (
                              item.topTherapists.map(t => (
                                <button
                                  key={t.boxId}
                                  type="button"
                                  onClick={() => onSelectTherapistFocus(t.boxId)}
                                  className="px-2.5 py-1 bg-slate-50 hover:bg-teal-50 hover:border-teal-200 border border-slate-200 rounded-lg text-slate-800 hover:text-teal-900 font-medium transition-all flex items-center gap-1 cursor-pointer"
                                  title={`Klik untuk fokus kotak ${t.officerName}`}
                                >
                                  <span>{t.officerName}</span>
                                  <span className="px-1.5 py-0.2 bg-slate-200/80 rounded-full font-mono text-[10px] font-bold">
                                    {t.count}x
                                  </span>
                                </button>
                              ))
                            ) : (
                              <span className="text-slate-400 italic">Belum ada data terapis</span>
                            )}
                          </div>
                        </div>

                        {/* Top Diagnoses for this tool */}
                        <div className="space-y-1.5">
                          <span className="font-extrabold text-slate-500 uppercase tracking-wider text-[10px] flex items-center gap-1">
                            <Stethoscope className="w-3 h-3 text-slate-400" />
                            Kasus Diagnosa Terbanyak:
                          </span>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {item.topDiagnoses.length > 0 ? (
                              item.topDiagnoses.map(d => (
                                <span
                                  key={d.diagnosisName}
                                  className="px-2.5 py-1 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg font-medium flex items-center gap-1"
                                >
                                  <span className="truncate max-w-[150px]">{d.diagnosisName}</span>
                                  <span className="px-1.5 py-0.2 bg-amber-200/80 rounded-full font-mono text-[10px] font-bold">
                                    {d.count}
                                  </span>
                                </span>
                              ))
                            ) : (
                              <span className="text-slate-400 italic">Pemeriksaan umum</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Accordion Patient Details Table */}
                    {isExpanded && (
                      <div className="border-t border-slate-200 bg-slate-50/70 p-5 sm:p-6 animate-in slide-in-from-top-2 duration-200">
                        <div className="flex items-center justify-between mb-3">
                          <h5 className="font-black text-slate-900 text-xs sm:text-sm flex items-center gap-2">
                            <Users className="w-4 h-4 text-amber-600" />
                            Daftar Pasien Menggunakan Modalitas: {item.name}
                          </h5>
                          <span className="text-xs text-slate-500 font-mono">
                            Total {item.patients.length} Pasien
                          </span>
                        </div>

                        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-2xs">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-slate-100 text-slate-600 font-extrabold uppercase text-[10px] tracking-wider border-b border-slate-200">
                              <tr>
                                <th className="py-3 px-3.5">Antrean</th>
                                <th className="py-3 px-3.5">Nama Pasien</th>
                                <th className="py-3 px-3.5">No. RM</th>
                                <th className="py-3 px-3.5">Diagnosa</th>
                                <th className="py-3 px-3.5">Terapis</th>
                                <th className="py-3 px-3.5">Ruangan</th>
                                <th className="py-3 px-3.5">Tindakan</th>
                                <th className="py-3 px-3.5">Kategori</th>
                                <th className="py-3 px-3.5">Status</th>
                                <th className="py-3 px-3.5 text-right">Aksi</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {item.patients.map((p, pIdx) => {
                                const parentBox = boxes.find(b => b.id === p.boxId);
                                return (
                                  <tr key={`eq-p-${p.id || pIdx}-${pIdx}`} className="hover:bg-slate-50/80 transition-colors">
                                    <td className="py-3 px-3.5 font-mono font-black text-slate-900 text-sm">
                                      {p.queueNumber}
                                    </td>
                                    <td className="py-3 px-3.5 font-bold text-slate-900">
                                      <div className="flex items-center gap-1.5">
                                        <span>{p.patientName}</span>
                                        {p.isWarning && (
                                          <span className="px-1.5 py-0.2 bg-rose-100 text-rose-800 text-[10px] rounded font-bold">
                                            ⚠️ Warning
                                          </span>
                                        )}
                                      </div>
                                    </td>
                                    <td className="py-3 px-3.5 font-mono text-slate-600 font-semibold">
                                      {p.medicalRecordNo || '-'}
                                    </td>
                                    <td className="py-3 px-3.5 text-slate-800 font-medium">
                                      {p.diagnosis || 'Pemeriksaan Umum'}
                                    </td>
                                    <td className="py-3 px-3.5 font-semibold text-slate-800">
                                      {parentBox?.officerName || '-'}
                                    </td>
                                    <td className="py-3 px-3.5 text-slate-600">
                                      {parentBox?.title || '-'}
                                    </td>
                                    <td className="py-3 px-3.5">
                                      <span className="px-2 py-0.5 bg-amber-50 text-amber-900 border border-amber-200 rounded font-bold font-mono text-[10px]">
                                        {p.actionCode || 'Umum'}
                                      </span>
                                    </td>
                                    <td className="py-3 px-3.5">
                                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                        p.isRanap ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                                      }`}>
                                        {p.isRanap ? 'Rawat Inap' : 'Rawat Jalan'}
                                      </span>
                                    </td>
                                    <td className="py-3 px-3.5">
                                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 w-fit ${
                                        p.completed ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                                      }`}>
                                        <span className={`w-1.5 h-1.5 rounded-full ${p.completed ? 'bg-emerald-600' : 'bg-amber-600'}`} />
                                        {p.completed ? 'Selesai' : 'Sedang Antre'}
                                      </span>
                                    </td>
                                    <td className="py-3 px-3.5 text-right">
                                      {parentBox && (
                                        <button
                                          type="button"
                                          onClick={() => onSelectTherapistFocus(parentBox.id)}
                                          className="px-2.5 py-1 bg-teal-50 hover:bg-teal-100 text-teal-800 rounded-lg text-xs font-bold border border-teal-200 transition-all cursor-pointer"
                                        >
                                          Buka Kotak
                                        </button>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                  <Search className="w-6 h-6" />
                </div>
                <h4 className="font-extrabold text-slate-800 text-base">
                  Tidak ada data alat yang cocok
                </h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Coba ubah kata kunci pencarian atau bersihkan filter untuk melihat kembali seluruh sebaran utilisasi alat.
                </p>
                <button
                  onClick={() => {
                    setEquipSearch('');
                    setSelectedEquipCode('all');
                    setSelectedEquipType('all');
                  }}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Reset Semua Filter
                </button>
              </div>
            )}
          </div>

          {/* Popular Equipment Combinations Matrix */}
          {equipmentAnalytics.combinations.length > 0 && (
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center font-bold">
                    <Layers className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-base">
                      Kombinasi Modalitas Terapi Paling Sering Digunakan
                    </h3>
                    <p className="text-xs text-slate-500">
                      Pasien yang menerima lebih dari 1 modalitas alat secara simultan/bersamaan
                    </p>
                  </div>
                </div>
                <span className="text-xs font-mono font-bold text-purple-800 bg-purple-100 px-3 py-1 rounded-full">
                  {equipmentAnalytics.combinations.length} Pola Kombinasi
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
                {equipmentAnalytics.combinations.map((combo, idx) => (
                  <div
                    key={combo.key}
                    className="p-4 rounded-2xl border border-purple-100 bg-purple-50/40 space-y-2 flex flex-col justify-between"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-purple-200 text-purple-900 rounded-full">
                        Pola #{idx + 1}
                      </span>
                      <span className="font-mono text-xs font-black text-purple-950">
                        {combo.count} Pasien
                      </span>
                    </div>

                    <h5 className="font-black text-slate-900 text-sm">
                      {combo.label}
                    </h5>

                    <div className="pt-2 border-t border-purple-200/60 flex items-center justify-between text-[11px] text-slate-600">
                      <span>Porsi Pasien Modalitas:</span>
                      <strong className="font-mono font-bold text-purple-800">{combo.percentage}%</strong>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* VIEW TAB 3: THERAPIST CARDS MATRIX */}
      {activeTab === 'cards' && (
        <div className="space-y-6">
          {/* Visit Trend Charts (Daily Total, Daily by Division, Monthly Jan-Dec) */}
          <VisitTrendCharts />

          {/* Filters and Controls */}
          <div className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200 flex flex-wrap items-center justify-between gap-4">
            <div className="relative flex-1 min-w-[260px]">
              <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cari terapis, ruangan, lokasi, tindakan..."
                className="w-full pl-10 pr-4 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:ring-2 focus:ring-teal-500 focus:outline-hidden transition-all"
              />
            </div>

            {/* Load Status Filter Chips */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                onClick={() => setFilterLoad('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  filterLoad === 'all' ? 'bg-slate-950 text-white shadow-xs' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                Semua ({stats.length})
              </button>
              <button
                onClick={() => setFilterLoad('overload')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  filterLoad === 'overload' ? 'bg-rose-600 text-white shadow-xs' : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200'
                }`}
              >
                Overload ({stats.filter(s => s.loadStatus === 'overload').length})
              </button>
              <button
                onClick={() => setFilterLoad('busy')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  filterLoad === 'busy' ? 'bg-amber-500 text-white shadow-xs' : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200'
                }`}
              >
                Padat (4-5) ({stats.filter(s => s.loadStatus === 'busy').length})
              </button>
              <button
                onClick={() => setFilterLoad('optimal')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  filterLoad === 'optimal' ? 'bg-teal-600 text-white shadow-xs' : 'bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200'
                }`}
              >
                Optimal (1-3) ({stats.filter(s => s.loadStatus === 'optimal').length})
              </button>
              <button
                onClick={() => setFilterLoad('available')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  filterLoad === 'available' ? 'bg-slate-800 text-white shadow-xs' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                Luang (0) ({stats.filter(s => s.loadStatus === 'available').length})
              </button>
            </div>

            {/* Sort Select */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500 font-bold">Urutkan:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
              >
                <option value="active">Antrean Aktif Terbanyak</option>
                <option value="completed">Pasien Selesai Terbanyak</option>
                <option value="speed">Pelayanan Tercepat</option>
                <option value="name">Nama Terapis A-Z</option>
              </select>
            </div>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {displayStats.map((item) => {
              const isOver = item.loadStatus === 'overload';
              const isBusy = item.loadStatus === 'busy';
              const isAvail = item.loadStatus === 'available';

              return (
                <div
                  key={item.boxId}
                  className={`bg-white rounded-3xl p-5 border shadow-xs hover:shadow-md transition-all flex flex-col justify-between gap-4 ${
                    isOver 
                      ? 'border-rose-300 ring-2 ring-rose-500/20 bg-gradient-to-b from-rose-50/40 to-white' 
                      : isBusy 
                      ? 'border-amber-300 bg-gradient-to-b from-amber-50/20 to-white' 
                      : 'border-slate-200'
                  }`}
                >
                  {/* Header: Name and Status */}
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-slate-900 to-teal-900 text-white font-black text-sm flex items-center justify-center shadow-sm shrink-0">
                          {item.officerName.substring(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-extrabold text-slate-900 text-base leading-snug truncate">
                            {item.officerName}
                          </h3>
                          <p className="text-xs text-slate-500 font-medium truncate">
                            📍 {item.location} • {item.boxTitle.split('(')[0]}
                          </p>
                        </div>
                      </div>

                      <span
                        className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider shrink-0 shadow-2xs ${
                          isOver
                            ? 'bg-rose-600 text-white animate-pulse'
                            : isBusy
                            ? 'bg-amber-100 text-amber-900 border border-amber-300'
                            : isAvail
                            ? 'bg-slate-100 text-slate-700'
                            : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                        }`}
                      >
                        {isOver ? '⚠️ Overload (>5)' : isBusy ? 'Padat' : isAvail ? 'Luang' : 'Optimal'}
                      </span>
                    </div>

                    {/* Progress Bar and Active Queue */}
                    <div className="mt-4.5 space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span className="text-slate-600">Beban Antrean Aktif:</span>
                        <span className={`font-mono text-sm font-black ${isOver ? 'text-rose-700' : 'text-slate-900'}`}>
                          {item.activeCount} Pasien
                        </span>
                      </div>
                      <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            isOver
                              ? 'bg-rose-600'
                              : isBusy
                              ? 'bg-amber-500'
                              : isAvail
                              ? 'bg-slate-300'
                              : 'bg-teal-500'
                          }`}
                          style={{ width: `${Math.max(8, item.loadPercentage)}%` }}
                        />
                      </div>
                    </div>

                    {/* Metrics Grid */}
                    <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-slate-100 text-center">
                      <div className="bg-slate-50 p-2.5 rounded-2xl">
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Selesai</p>
                        <p className="text-xs font-black text-emerald-700 font-mono mt-0.5">{item.completedCount}</p>
                      </div>
                      <div className="bg-slate-50 p-2.5 rounded-2xl">
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Avg Respon</p>
                        <p className="text-xs font-black text-slate-800 font-mono mt-0.5">{item.avgResponseMinutes}m</p>
                      </div>
                      <div className="bg-slate-50 p-2.5 rounded-2xl">
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Est. Waktu</p>
                        <p className="text-xs font-black text-teal-800 font-mono mt-0.5">~{item.estimatedWaitMinutes}m</p>
                      </div>
                    </div>

                    {/* Top Procedures */}
                    <div className="mt-3.5">
                      <span className="text-[10px] font-bold text-slate-400 block mb-1">Tindakan Sering Dilakukan:</span>
                      <div className="flex flex-wrap gap-1">
                        {item.topProcedures.length > 0 ? (
                          item.topProcedures.map((p) => (
                            <span
                              key={p.code}
                              className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md text-[10px] font-medium border border-slate-200"
                            >
                              {p.code} ({p.count})
                            </span>
                          ))
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">Belum ada tindakan tercatat</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="pt-3.5 border-t border-slate-100 space-y-2">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onSelectTherapistFocus(item.boxId)}
                        className="flex-1 py-2 bg-teal-50 hover:bg-teal-100 active:scale-95 text-teal-800 font-bold rounded-xl text-xs border border-teal-200 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <Filter className="w-3.5 h-3.5" />
                        <span>Fokus Kotak</span>
                      </button>

                      <button
                        onClick={() => setSelectedDetailBoxId(item.boxId)}
                        className="p-2 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 rounded-xl transition-all cursor-pointer border border-slate-200"
                        title="Lihat Profil & Riwayat Detail"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onCallNextInBox(item.box)}
                        disabled={item.activeCount === 0}
                        className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                          item.activeCount > 0
                            ? 'bg-slate-900 hover:bg-slate-800 active:scale-95 text-white cursor-pointer shadow-xs'
                            : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        }`}
                        title="Panggil Pasien Berikutnya"
                      >
                        <Bell className="w-3.5 h-3.5" />
                        <span>Panggil Pasien</span>
                      </button>

                      <button
                        onClick={() => onAddPatientToBox(item.boxId)}
                        className="p-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-xl transition-all cursor-pointer shadow-xs"
                        title="Tambah Pasien ke Terapis Ini"
                      >
                        <UserPlus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW TAB 3: COMPREHENSIVE DATA TABLE */}
      {activeTab === 'table' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden space-y-4">
          <div className="p-5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-teal-100 text-teal-800 flex items-center justify-center">
                <BarChart3 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm sm:text-base text-slate-900">
                  Tabel Komprehensif Respon &amp; Kapasitas Terapis
                </h3>
                <p className="text-xs text-slate-500">
                  Rekapitulasi lengkap seluruh terapis, kepatuhan SPM, durasi tindakan, dan status beban
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleExportExcel}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Data (.xlsx)</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-4">Nama Terapis &amp; Ruangan</th>
                  <th className="p-4 text-center">Status Beban</th>
                  <th className="p-4 text-center">Antrean Aktif</th>
                  <th className="p-4 text-center">Pasien Selesai</th>
                  <th className="p-4 text-center">Avg Respon Time</th>
                  <th className="p-4 text-center">Kepatuhan SPM (&le; 30m)</th>
                  <th className="p-4">Tindakan Terbanyak</th>
                  <th className="p-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayStats.map((t) => (
                  <tr key={t.boxId} className={t.isOverloaded ? 'bg-rose-50/40 hover:bg-rose-50' : 'hover:bg-slate-50 transition-colors'}>
                    <td className="p-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-slate-900 text-white font-black text-xs flex items-center justify-center shrink-0">
                          {t.officerName.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 text-sm">{t.officerName}</p>
                          <p className="text-[11px] text-slate-500 font-medium">📍 {t.location} • {t.boxTitle}</p>
                        </div>
                      </div>
                    </td>

                    <td className="p-4 text-center">
                      <span
                        className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          t.isOverloaded
                            ? 'bg-rose-600 text-white animate-pulse'
                            : t.loadStatus === 'busy'
                            ? 'bg-amber-100 text-amber-900 border border-amber-300'
                            : t.loadStatus === 'available'
                            ? 'bg-slate-100 text-slate-700'
                            : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                        }`}
                      >
                        {t.isOverloaded ? '⚠️ Overload' : t.loadStatus === 'busy' ? 'Padat' : t.loadStatus === 'available' ? 'Luang' : 'Optimal'}
                      </span>
                    </td>

                    <td className="p-4 text-center">
                      <span className={`font-mono text-base font-black ${t.isOverloaded ? 'text-rose-700' : 'text-slate-900'}`}>
                        {t.activeCount}
                      </span>
                    </td>

                    <td className="p-4 text-center font-bold text-emerald-700 font-mono text-sm">
                      {t.completedCount}
                    </td>

                    <td className="p-4 text-center">
                      <span className={`inline-block px-2.5 py-1 rounded-lg font-mono font-bold text-xs ${
                        t.avgResponseMinutes > 30 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-800'
                      }`}>
                        {t.avgResponseMinutes} mnt
                      </span>
                    </td>

                    <td className="p-4 text-center">
                      <span className={`px-2.5 py-1 rounded-full font-mono font-black text-xs ${
                        t.complianceRate >= 80 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {t.complianceRate}%
                      </span>
                    </td>

                    <td className="p-4">
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
                          <span className="text-slate-400 text-[10px] italic">-</span>
                        )}
                      </div>
                    </td>

                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedDetailBoxId(t.boxId)}
                          className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all cursor-pointer"
                          title="Lihat Detail"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onSelectTherapistFocus(t.boxId)}
                          className="px-2.5 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-800 rounded-lg text-xs font-bold transition-all cursor-pointer border border-teal-200"
                        >
                          Kotak
                        </button>
                        <button
                          type="button"
                          onClick={() => onAddPatientToBox(t.boxId)}
                          className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all cursor-pointer shadow-2xs"
                        >
                          + Pasien
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* INDIVIDUAL THERAPIST DEEP DIVE MODAL */}
      {selectedTherapistDetail && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden my-8">
            {/* Modal Header */}
            <div className="p-6 bg-gradient-to-r from-slate-900 to-teal-950 text-white flex items-start justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-teal-500 text-slate-950 font-black text-base flex items-center justify-center shadow-md">
                  {selectedTherapistDetail.officerName.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-black text-white">
                      {selectedTherapistDetail.officerName}
                    </h3>
                    <span className="px-2 py-0.5 bg-teal-500/20 text-teal-300 border border-teal-500/30 rounded-full text-[10px] font-bold">
                      {selectedTherapistDetail.boxTitle}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-0.5">
                    📍 {selectedTherapistDetail.location} • Status: <strong className="uppercase text-teal-300">{selectedTherapistDetail.loadStatus}</strong>
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedDetailBoxId(null)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6">
              {/* Quick Metrics */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-2xl text-center">
                  <p className="text-[10px] font-bold text-blue-900 uppercase">Antrean Aktif</p>
                  <p className="text-2xl font-black text-blue-700 font-mono mt-1">{selectedTherapistDetail.activeCount}</p>
                </div>
                <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-2xl text-center">
                  <p className="text-[10px] font-bold text-emerald-900 uppercase">Pasien Selesai</p>
                  <p className="text-2xl font-black text-emerald-700 font-mono mt-1">{selectedTherapistDetail.completedCount}</p>
                </div>
                <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-2xl text-center">
                  <p className="text-[10px] font-bold text-purple-900 uppercase">Avg Respon Time</p>
                  <p className="text-2xl font-black text-purple-700 font-mono mt-1">{selectedTherapistDetail.avgResponseMinutes}m</p>
                </div>
              </div>

              {/* Active Patients in this therapist's queue */}
              <div className="space-y-3">
                <h4 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                  <Users className="w-4 h-4 text-teal-600" />
                  Daftar Pasien Sedang Antre ({selectedTherapistDetail.activePatients.length})
                </h4>

                <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                  {selectedTherapistDetail.activePatients.length > 0 ? (
                    selectedTherapistDetail.activePatients.map((p, idx) => (
                      <div key={`th-p-${p.id || idx}-${idx}`} className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2.5">
                          <span className="w-6 h-6 rounded-lg bg-slate-900 text-white font-mono font-bold text-[10px] flex items-center justify-center">
                            {idx + 1}
                          </span>
                          <div>
                            <p className="font-extrabold text-slate-900">{p.patientName || (p as any).name || 'Pasien'}</p>
                            <p className="text-[11px] text-slate-500 font-mono">RM: {p.medicalRecordNo} • {p.actionCode || 'Umum'}</p>
                          </div>
                        </div>

                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          p.isRanap ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                        }`}>
                          {p.isRanap ? 'Rawat Inap' : 'Rawat Jalan'}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-400 italic text-center py-4 bg-slate-50 rounded-xl">
                      Tidak ada antrean pasien saat ini
                    </p>
                  )}
                </div>
              </div>

              {/* Top Procedures for this therapist */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <h4 className="font-extrabold text-xs text-slate-700">Modalitas / Tindakan Paling Sering:</h4>
                <div className="flex flex-wrap gap-1.5">
                  {selectedTherapistDetail.topProcedures.length > 0 ? (
                    selectedTherapistDetail.topProcedures.map((p) => (
                      <span key={p.code} className="px-2.5 py-1 bg-slate-100 text-slate-800 rounded-xl text-xs font-bold border border-slate-200">
                        {p.code} ({p.count} tindakan)
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-slate-400 italic">Belum ada tindakan tercatat</span>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
              <button
                onClick={() => {
                  setSelectedDetailBoxId(null);
                  onSelectTherapistFocus(selectedTherapistDetail.boxId);
                }}
                className="px-4 py-2 bg-teal-50 hover:bg-teal-100 text-teal-800 font-bold rounded-xl text-xs border border-teal-200 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Filter className="w-3.5 h-3.5" />
                <span>Buka di Kotak Antrean</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setSelectedDetailBoxId(null);
                    onAddPatientToBox(selectedTherapistDetail.boxId);
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition-all cursor-pointer shadow-xs flex items-center gap-1.5"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Tambah Pasien</span>
                </button>
                <button
                  onClick={() => setSelectedDetailBoxId(null)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl text-xs transition-all cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
