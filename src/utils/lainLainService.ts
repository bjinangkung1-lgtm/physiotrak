import { KasTransaction, RotationSchedule, SaturdayDutyRecord, LeaveRequestRecord, QueueBox, StaffKasPayment } from '../types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { cloudDatabaseService } from './cloudDatabaseService';

const KAS_STORAGE_KEY = 'irm_kas_transactions';
const KAS_STAFF_PAYMENTS_STORAGE_KEY = 'irm_kas_staff_payments';
const ROTATION_STORAGE_KEY = 'irm_rotation_schedules';
const SATURDAY_STORAGE_KEY = 'irm_saturday_schedules';
const LEAVE_STORAGE_KEY = 'irm_leave_requests';

// BroadcastChannel for instant same-browser cross-tab sync
let lainLainChannel: BroadcastChannel | null = null;
try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    lainLainChannel = new BroadcastChannel('irm_lain_lain_sync_channel');
  }
} catch {
  lainLainChannel = null;
}

export const INDONESIAN_MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export const INDONESIAN_SHORT_MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'
];

export const formatRupiah = (amount: number): string => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
};

export const formatIndonesianDate = (dateStr: string, includeDayName = true): string => {
  try {
    if (!dateStr) return '-';
    // Use local time parsing to avoid timezone day shift
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const date = new Date(year, month, day);
      return date.toLocaleDateString('id-ID', {
        weekday: includeDayName ? 'long' : undefined,
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
    }
    const date = new Date(dateStr);
    return date.toLocaleDateString('id-ID', {
      weekday: includeDayName ? 'long' : undefined,
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  } catch {
    return dateStr;
  }
};

export const formatIndonesianShortDate = (dateStr: string): string => {
  try {
    if (!dateStr) return '-';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const date = new Date(year, month, day);
      return date.toLocaleDateString('id-ID', {
        weekday: 'short',
        day: 'numeric',
        month: 'short'
      });
    }
    return dateStr;
  } catch {
    return dateStr;
  }
};

// Default seed data
const DEFAULT_KAS_TRANSACTIONS: KasTransaction[] = [];

const DEFAULT_ROTATION_SCHEDULES: RotationSchedule[] = [
  {
    id: 'rot-2026-08',
    periodMonth: '2026-08',
    periodName: 'Agustus 2026 - Rotasi Pos Bulanan',
    startDate: '2026-08-01',
    endDate: '2026-08-31',
    assignments: [
      { therapistName: 'Najjah, S.Kep', station: 'Poli Rawat Inap (Ranap) & Jemputan', shiftNotes: 'Pagi 07:30 - 15:30' },
      { therapistName: 'Ayu, Amd.Kep', station: 'Ruang Latihan Aktif / Gimnasium', shiftNotes: 'Pagi 07:30 - 15:30' },
      { therapistName: 'Ammell, S.FT', station: 'Elektroterapi & Modalitas (SWD/TENS)', shiftNotes: 'Pagi 07:30 - 15:30' },
      { therapistName: 'Saiful, S.FT', station: 'Fisioterapi Dada & Anak (Pediatrik)', shiftNotes: 'Pagi 07:30 - 15:30' },
      { therapistName: 'Tri Handayani, S.FT', station: 'Poli Eksekutif / VIP & Konsul', shiftNotes: 'Pagi 07:30 - 15:30' },
      { therapistName: 'Bustomi, S.FT', station: 'Ruang Traksi & Terapi Manual', shiftNotes: 'Pagi 07:30 - 15:30' }
    ],
    notes: 'Rotasi pos berlaku efektif mulai awal bulan. Pertukaran pos harus atas koordinasi Kepala Instalasi.',
    updatedAt: new Date().toISOString()
  },
  {
    id: 'rot-2026-09',
    periodMonth: '2026-09',
    periodName: 'September 2026 - Rencana Rotasi',
    startDate: '2026-09-01',
    endDate: '2026-09-30',
    assignments: [
      { therapistName: 'Ayu, Amd.Kep', station: 'Poli Rawat Inap (Ranap) & Jemputan', shiftNotes: 'Pagi 07:30 - 15:30' },
      { therapistName: 'Ammell, S.FT', station: 'Ruang Latihan Aktif / Gimnasium', shiftNotes: 'Pagi 07:30 - 15:30' },
      { therapistName: 'Saiful, S.FT', station: 'Elektroterapi & Modalitas (SWD/TENS)', shiftNotes: 'Pagi 07:30 - 15:30' },
      { therapistName: 'Najjah, S.Kep', station: 'Fisioterapi Dada & Anak (Pediatrik)', shiftNotes: 'Pagi 07:30 - 15:30' },
      { therapistName: 'Bustomi, S.FT', station: 'Poli Eksekutif / VIP & Konsul', shiftNotes: 'Pagi 07:30 - 15:30' },
      { therapistName: 'Tri Handayani, S.FT', station: 'Ruang Traksi & Terapi Manual', shiftNotes: 'Pagi 07:30 - 15:30' }
    ],
    notes: 'Rencana jadwal rotasi untuk bulan September.',
    updatedAt: new Date().toISOString()
  }
];

const DEFAULT_SATURDAY_SCHEDULES: SaturdayDutyRecord[] = [
  {
    id: 'sat-2026-08-01',
    date: '2026-08-01',
    primaryTherapist: 'Najjah, S.Kep',
    assistantTherapist: 'Ayu, Amd.Kep',
    supervisor: 'dr. Sp.KFR',
    shiftHours: '07:30 - 13:00 WIB',
    status: 'completed',
    notes: 'Layanan selesai normal, 18 pasien ditangani.',
    updatedAt: '2026-08-01T13:30:00.000Z'
  },
  {
    id: 'sat-2026-08-08',
    date: '2026-08-08',
    primaryTherapist: 'Ammell, S.FT',
    assistantTherapist: 'Saiful, S.FT',
    supervisor: 'dr. Sp.KFR',
    shiftHours: '07:30 - 13:00 WIB',
    status: 'completed',
    notes: 'Layanan lancar.',
    updatedAt: '2026-08-08T13:30:00.000Z'
  },
  {
    id: 'sat-2026-08-15',
    date: '2026-08-15',
    primaryTherapist: 'Bustomi, S.FT',
    assistantTherapist: 'Tri Handayani, S.FT',
    supervisor: 'dr. Sp.KFR',
    shiftHours: '07:30 - 13:00 WIB',
    status: 'completed',
    notes: 'Pelayanan poli dan ranap.',
    updatedAt: '2026-08-15T13:30:00.000Z'
  },
  {
    id: 'sat-2026-08-22',
    date: '2026-08-22',
    primaryTherapist: 'Najjah, S.Kep',
    assistantTherapist: 'Saiful, S.FT',
    supervisor: 'dr. Sp.KFR',
    shiftHours: '07:30 - 13:00 WIB',
    status: 'completed',
    notes: 'Layanan Sabtu tertib.',
    updatedAt: '2026-08-22T13:30:00.000Z'
  },
  {
    id: 'sat-2026-08-29',
    date: '2026-08-29',
    primaryTherapist: 'Ayu, Amd.Kep',
    assistantTherapist: 'Ammell, S.FT',
    supervisor: 'dr. Sp.KFR',
    shiftHours: '07:30 - 13:00 WIB',
    status: 'scheduled',
    notes: 'Jadwal pelayanan Sabtu minggu ini.',
    updatedAt: new Date().toISOString()
  },
  {
    id: 'sat-2026-09-05',
    date: '2026-09-05',
    primaryTherapist: 'Bustomi, S.FT',
    assistantTherapist: 'Najjah, S.Kep',
    supervisor: 'dr. Sp.KFR',
    shiftHours: '07:30 - 13:00 WIB',
    status: 'scheduled',
    notes: 'Jadwal Sabtu awal September.',
    updatedAt: new Date().toISOString()
  }
];

const DEFAULT_LEAVE_REQUESTS: LeaveRequestRecord[] = [
  {
    id: 'leave-1',
    therapistName: 'Najjah, S.Kep',
    leaveType: 'Cuti Tahunan',
    selectedDates: ['2026-09-14', '2026-09-15', '2026-09-16'],
    totalDays: 3,
    reason: 'Keperluan keluarga di luar kota',
    replacementStaff: 'Ayu, Amd.Kep',
    isAccordingToPlan: true,
    status: 'approved',
    submittedAt: '2026-08-20T08:30:00.000Z',
    approvedBy: 'Kepala Instalasi IRM'
  },
  {
    id: 'leave-2',
    therapistName: 'Saiful, S.FT',
    leaveType: 'Cuti Alasan Penting',
    selectedDates: ['2026-09-21', '2026-09-22'],
    totalDays: 2,
    reason: 'Urusan administrasi pendidikan',
    replacementStaff: 'Ammell, S.FT',
    isAccordingToPlan: true,
    status: 'approved',
    submittedAt: '2026-08-22T09:00:00.000Z',
    approvedBy: 'Kepala Instalasi IRM'
  }
];

const KAS_CLEANED_RESET_KEY = 'irm_kas_cleaned_zero_v5';
const KAS_NOMINAL_STORAGE_KEY = 'irm_kas_nominal_per_month';

// ==========================================
// CENTRAL DATABASE ASYNC SYNC ENGINE
// ==========================================

export interface LainLainCompleteState {
  kasTransactions: KasTransaction[];
  staffKasPayments: Record<string, StaffKasPayment[]>;
  rotationSchedules: RotationSchedule[];
  saturdaySchedules: SaturdayDutyRecord[];
  leaveRequests: LeaveRequestRecord[];
  kasNominalPerMonth?: number;
  kasChecklistPassword?: string;
  lastUpdated?: string;
}

/**
 * Fetch complete Lain-Lain data from central server database,
 * update local cache, and return normalized state.
 */
export const fetchLainLainFromDb = async (): Promise<LainLainCompleteState | null> => {
  let serverData: LainLainCompleteState | null = null;
  try {
    const res = await fetch('/api/lain-lain');
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data === 'object') {
        serverData = data;
      }
    }
  } catch (err) {
    console.warn('Could not fetch from /api/lain-lain, checking Cloud Firestore...', err);
  }

  // Check if server data is non-empty
  const hasServerData = serverData && (
    (Array.isArray(serverData.kasTransactions) && serverData.kasTransactions.length > 0) ||
    (Array.isArray(serverData.leaveRequests) && serverData.leaveRequests.length > 0) ||
    (Array.isArray(serverData.rotationSchedules) && serverData.rotationSchedules.length > 0) ||
    (serverData.staffKasPayments && Object.keys(serverData.staffKasPayments).length > 0)
  );

  if (hasServerData && serverData) {
    // Sync to local cache
    if (Array.isArray(serverData.kasTransactions)) {
      localStorage.setItem(KAS_STORAGE_KEY, JSON.stringify(serverData.kasTransactions));
    }
    if (Array.isArray(serverData.rotationSchedules)) {
      localStorage.setItem(ROTATION_STORAGE_KEY, JSON.stringify(serverData.rotationSchedules));
    }
    if (Array.isArray(serverData.saturdaySchedules)) {
      localStorage.setItem(SATURDAY_STORAGE_KEY, JSON.stringify(serverData.saturdaySchedules));
    }
    if (Array.isArray(serverData.leaveRequests)) {
      localStorage.setItem(LEAVE_STORAGE_KEY, JSON.stringify(serverData.leaveRequests));
    }
    if (serverData.staffKasPayments && typeof serverData.staffKasPayments === 'object') {
      Object.keys(serverData.staffKasPayments).forEach(yr => {
        localStorage.setItem(`${KAS_STAFF_PAYMENTS_STORAGE_KEY}_${yr}`, JSON.stringify(serverData!.staffKasPayments[yr]));
      });
    }
    if (serverData.kasNominalPerMonth) {
      localStorage.setItem(KAS_NOMINAL_STORAGE_KEY, String(serverData.kasNominalPerMonth));
    }
    return serverData;
  }

  // If server is empty or cold-started, query Cloud Firestore as durable source of truth
  try {
    const cloudState = await cloudDatabaseService.getLainLainState();
    if (cloudState && typeof cloudState === 'object') {
      const hasCloudData = (
        (Array.isArray(cloudState.kasTransactions) && cloudState.kasTransactions.length > 0) ||
        (Array.isArray(cloudState.leaveRequests) && cloudState.leaveRequests.length > 0) ||
        (Array.isArray(cloudState.rotationSchedules) && cloudState.rotationSchedules.length > 0) ||
        (cloudState.staffKasPayments && Object.keys(cloudState.staffKasPayments).length > 0)
      );

      if (hasCloudData) {
        // Sync to local cache
        if (Array.isArray(cloudState.kasTransactions)) {
          localStorage.setItem(KAS_STORAGE_KEY, JSON.stringify(cloudState.kasTransactions));
        }
        if (Array.isArray(cloudState.rotationSchedules)) {
          localStorage.setItem(ROTATION_STORAGE_KEY, JSON.stringify(cloudState.rotationSchedules));
        }
        if (Array.isArray(cloudState.saturdaySchedules)) {
          localStorage.setItem(SATURDAY_STORAGE_KEY, JSON.stringify(cloudState.saturdaySchedules));
        }
        if (Array.isArray(cloudState.leaveRequests)) {
          localStorage.setItem(LEAVE_STORAGE_KEY, JSON.stringify(cloudState.leaveRequests));
        }
        if (cloudState.staffKasPayments && typeof cloudState.staffKasPayments === 'object') {
          Object.keys(cloudState.staffKasPayments).forEach(yr => {
            localStorage.setItem(`${KAS_STAFF_PAYMENTS_STORAGE_KEY}_${yr}`, JSON.stringify(cloudState.staffKasPayments[yr]));
          });
        }
        if (cloudState.kasNominalPerMonth) {
          localStorage.setItem(KAS_NOMINAL_STORAGE_KEY, String(cloudState.kasNominalPerMonth));
        }

        // Backfill server in background
        fetch('/api/lain-lain', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(cloudState)
        }).catch(e => console.warn('Background server Lain-Lain heal error:', e));

        return cloudState as LainLainCompleteState;
      }
    }
  } catch (cloudErr) {
    console.warn('Cloud Firestore Lain-Lain fallback error:', cloudErr);
  }

  return serverData;
};

/**
 * Save complete or partial state to central server database + Firestore
 */
export const persistLainLainStateToDb = async (partialState: Partial<LainLainCompleteState>): Promise<boolean> => {
  try {
    // 1. Broadcast locally
    if (lainLainChannel) {
      lainLainChannel.postMessage({ type: 'LAIN_LAIN_UPDATED', payload: partialState });
    }

    // 2. Push to Express backend API
    fetch('/api/lain-lain', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(partialState)
    }).catch(e => console.warn('Lain-lain API push error:', e));

    // 3. Push to Cloud Firestore
    cloudDatabaseService.saveLainLainState(partialState).catch(e => {
      console.warn('Lain-lain Firestore push error:', e);
    });

    return true;
  } catch (err) {
    console.error('Failed to persist lain-lain state to DB:', err);
    return false;
  }
};

/**
 * Subscribe to real-time changes across tabs & devices
 */
export const subscribeLainLainSync = (onSync: (data: any) => void): (() => void) => {
  // A. BroadcastChannel listener (same browser, other tabs)
  const handleBcMessage = (event: MessageEvent) => {
    if (event.data && event.data.type === 'LAIN_LAIN_UPDATED') {
      onSync(event.data.payload);
    }
  };
  if (lainLainChannel) {
    lainLainChannel.addEventListener('message', handleBcMessage);
  }

  // B. Firestore real-time listener (cross-device)
  const unsubscribeFirestore = cloudDatabaseService.subscribeLainLainState((data) => {
    if (data) {
      if (Array.isArray(data.kasTransactions)) {
        localStorage.setItem(KAS_STORAGE_KEY, JSON.stringify(data.kasTransactions));
      }
      if (Array.isArray(data.rotationSchedules)) {
        localStorage.setItem(ROTATION_STORAGE_KEY, JSON.stringify(data.rotationSchedules));
      }
      if (Array.isArray(data.saturdaySchedules)) {
        localStorage.setItem(SATURDAY_STORAGE_KEY, JSON.stringify(data.saturdaySchedules));
      }
      if (Array.isArray(data.leaveRequests)) {
        localStorage.setItem(LEAVE_STORAGE_KEY, JSON.stringify(data.leaveRequests));
      }
      onSync(data);
    }
  });

  return () => {
    if (lainLainChannel) {
      lainLainChannel.removeEventListener('message', handleBcMessage);
    }
    unsubscribeFirestore();
  };
};

export const getSavedKasNominal = (): number => {
  try {
    const saved = localStorage.getItem(KAS_NOMINAL_STORAGE_KEY);
    return saved ? parseInt(saved, 10) || 50000 : 50000;
  } catch {
    return 50000;
  }
};

export const setSavedKasNominal = (nominal: number): void => {
  try {
    localStorage.setItem(KAS_NOMINAL_STORAGE_KEY, String(nominal));
    persistLainLainStateToDb({ kasNominalPerMonth: nominal });
  } catch (e) {
    console.error('Error saving kas nominal:', e);
  }
};

// Data Access API
export const getKasTransactions = (): KasTransaction[] => {
  try {
    const isCleaned = localStorage.getItem(KAS_CLEANED_RESET_KEY);
    if (!isCleaned) {
      localStorage.setItem(KAS_CLEANED_RESET_KEY, 'true');
      localStorage.setItem(KAS_STORAGE_KEY, JSON.stringify([]));
      return [];
    }
    const raw = localStorage.getItem(KAS_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(KAS_STORAGE_KEY, JSON.stringify([]));
      return [];
    }
    return JSON.parse(raw);
  } catch {
    return [];
  }
};

export const saveKasTransactions = (items: KasTransaction[]): void => {
  localStorage.setItem(KAS_STORAGE_KEY, JSON.stringify(items));
  persistLainLainStateToDb({ kasTransactions: items });
};

export const getRotationSchedules = (): RotationSchedule[] => {
  try {
    const raw = localStorage.getItem(ROTATION_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(ROTATION_STORAGE_KEY, JSON.stringify(DEFAULT_ROTATION_SCHEDULES));
      return DEFAULT_ROTATION_SCHEDULES;
    }
    return JSON.parse(raw);
  } catch {
    return DEFAULT_ROTATION_SCHEDULES;
  }
};

export const saveRotationSchedules = (items: RotationSchedule[]): void => {
  localStorage.setItem(ROTATION_STORAGE_KEY, JSON.stringify(items));
  persistLainLainStateToDb({ rotationSchedules: items });
};

export const getSaturdaySchedules = (): SaturdayDutyRecord[] => {
  try {
    const raw = localStorage.getItem(SATURDAY_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(SATURDAY_STORAGE_KEY, JSON.stringify(DEFAULT_SATURDAY_SCHEDULES));
      return DEFAULT_SATURDAY_SCHEDULES;
    }
    return JSON.parse(raw);
  } catch {
    return DEFAULT_SATURDAY_SCHEDULES;
  }
};

export const saveSaturdaySchedules = (items: SaturdayDutyRecord[]): void => {
  localStorage.setItem(SATURDAY_STORAGE_KEY, JSON.stringify(items));
  persistLainLainStateToDb({ saturdaySchedules: items });
};

export const getLeaveRequests = (): LeaveRequestRecord[] => {
  try {
    const raw = localStorage.getItem(LEAVE_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(LEAVE_STORAGE_KEY, JSON.stringify(DEFAULT_LEAVE_REQUESTS));
      return DEFAULT_LEAVE_REQUESTS;
    }
    return JSON.parse(raw);
  } catch {
    return DEFAULT_LEAVE_REQUESTS;
  }
};

export const saveLeaveRequests = (items: LeaveRequestRecord[]): void => {
  localStorage.setItem(LEAVE_STORAGE_KEY, JSON.stringify(items));
  persistLainLainStateToDb({ leaveRequests: items });
};

// ==========================================
// ADVANCED LEAVE MANAGEMENT LOGIC
// ==========================================

export interface TherapistLeaveBalance {
  therapistName: string;
  year: number;
  maxAnnualQuota: number;
  usedDays: number;
  approvedDays: number;
  pendingDays: number;
  remainingAnnualDays: number;
  totalLeaveRecords: number;
}

/**
 * Calculate leave usage and remaining balance for a therapist in a specific year.
 */
export const calculateLeaveBalance = (
  therapistName: string,
  year: number,
  allLeaves: LeaveRequestRecord[],
  maxAnnualQuota = 12
): TherapistLeaveBalance => {
  const yearStr = String(year);
  const therapistLeaves = allLeaves.filter(
    l => l.therapistName === therapistName &&
         l.selectedDates.some(d => d.startsWith(yearStr))
  );

  let approvedDays = 0;
  let pendingDays = 0;

  therapistLeaves.forEach(l => {
    // Only count dates in that specific year
    const yearDates = l.selectedDates.filter(d => d.startsWith(yearStr));
    if (l.status === 'approved') {
      approvedDays += yearDates.length;
    } else if (l.status === 'pending') {
      pendingDays += yearDates.length;
    }
  });

  const usedDays = approvedDays;
  const remainingAnnualDays = Math.max(0, maxAnnualQuota - usedDays);

  return {
    therapistName,
    year,
    maxAnnualQuota,
    usedDays,
    approvedDays,
    pendingDays,
    remainingAnnualDays,
    totalLeaveRecords: therapistLeaves.length
  };
};

/**
 * Check if the requested dates conflict with other therapists on leave
 * (e.g. if 2 or more therapists are already off on that day).
 */
export const checkLeaveConflicts = (
  selectedDates: string[],
  applicantName: string,
  allLeaves: LeaveRequestRecord[],
  maxConcurrentLeaves = 2
): Array<{ date: string; otherTherapists: string[]; isCritical: boolean }> => {
  const conflicts: Array<{ date: string; otherTherapists: string[]; isCritical: boolean }> = [];

  selectedDates.forEach(dateStr => {
    const onLeave = allLeaves
      .filter(l => l.status !== 'rejected' && l.therapistName !== applicantName && l.selectedDates.includes(dateStr))
      .map(l => l.therapistName);

    if (onLeave.length >= maxConcurrentLeaves) {
      conflicts.push({
        date: dateStr,
        otherTherapists: onLeave,
        isCritical: onLeave.length >= maxConcurrentLeaves
      });
    }
  });

  return conflicts;
};

// Add or update single leave request in DB
export const saveLeaveRequestToDb = async (item: LeaveRequestRecord): Promise<boolean> => {
  try {
    const current = getLeaveRequests();
    const idx = current.findIndex(l => l.id === item.id);
    let updated: LeaveRequestRecord[];
    if (idx >= 0) {
      updated = [...current];
      updated[idx] = item;
    } else {
      updated = [item, ...current];
    }
    saveLeaveRequests(updated);

    // Call server endpoint
    fetch('/api/lain-lain/leave', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item)
    }).catch(e => console.warn('API leave post error:', e));

    return true;
  } catch (err) {
    console.error('Error saving leave to DB:', err);
    return false;
  }
};

// Delete single leave request from DB
export const deleteLeaveRequestFromDb = async (id: string): Promise<boolean> => {
  try {
    const current = getLeaveRequests();
    const updated = current.filter(l => l.id !== id);
    saveLeaveRequests(updated);

    // Call server endpoint
    fetch(`/api/lain-lain/leave/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    }).catch(e => console.warn('API leave delete error:', e));

    return true;
  } catch (err) {
    console.error('Error deleting leave from DB:', err);
    return false;
  }
};

// ==========================================
// KAS STAFF MONTHLY DUES (12 MONTHS CHECKLIST)
// ==========================================
export const createDefaultStaffPayments = (year: number, boxes?: QueueBox[], defaultNominal?: number): StaffKasPayment[] => {
  const nominal = defaultNominal !== undefined ? defaultNominal : getSavedKasNominal();
  const defaultTherapists = extractTherapistsList(boxes || []);

  return defaultTherapists.map((name, idx) => {
    const monthsObj: { [monthNum: number]: boolean } = {};
    for (let m = 1; m <= 12; m++) {
      // Clean start: all months set to false (unpaid / 0) for manual filling
      monthsObj[m] = false;
    }
    return {
      id: `kas-staff-${year}-${idx + 1}`,
      staffName: name,
      year,
      months: monthsObj,
      nominalPerMonth: nominal,
      notes: ''
    };
  });
};

export const getStaffKasPayments = (year: number, boxes?: QueueBox[]): StaffKasPayment[] => {
  try {
    const isCleaned = localStorage.getItem(KAS_CLEANED_RESET_KEY);
    const storageKey = `${KAS_STAFF_PAYMENTS_STORAGE_KEY}_${year}`;
    const raw = localStorage.getItem(storageKey);
    const savedNominal = getSavedKasNominal();
    let list: StaffKasPayment[] = [];

    if (!isCleaned || !raw) {
      list = createDefaultStaffPayments(year, boxes, savedNominal);
      localStorage.setItem(storageKey, JSON.stringify(list));
      localStorage.setItem(KAS_CLEANED_RESET_KEY, 'true');
    } else {
      list = JSON.parse(raw);
    }
    return list;
  } catch {
    return createDefaultStaffPayments(year, boxes, getSavedKasNominal());
  }
};

export const saveStaffKasPayments = (year: number, items: StaffKasPayment[]): void => {
  const storageKey = `${KAS_STAFF_PAYMENTS_STORAGE_KEY}_${year}`;
  localStorage.setItem(storageKey, JSON.stringify(items));
  persistLainLainStateToDb({
    staffKasPayments: {
      [year]: items
    }
  });
};

export const clearAllKasData = (year: number, boxes?: QueueBox[], nominal?: number): { kas: KasTransaction[]; staff: StaffKasPayment[] } => {
  const currentNominal = nominal !== undefined ? nominal : getSavedKasNominal();
  const resetStaff = createDefaultStaffPayments(year, boxes, currentNominal);
  localStorage.setItem(KAS_STORAGE_KEY, JSON.stringify([]));
  localStorage.setItem(`${KAS_STAFF_PAYMENTS_STORAGE_KEY}_${year}`, JSON.stringify(resetStaff));
  persistLainLainStateToDb({
    kasTransactions: [],
    staffKasPayments: {
      [year]: resetStaff
    }
  });
  return { kas: [], staff: resetStaff };
};

export const resetStaffTherapistRoster = (year: number, boxes?: QueueBox[], nominal?: number): StaffKasPayment[] => {
  const currentNominal = nominal !== undefined ? nominal : getSavedKasNominal();
  const defaultStaff = createDefaultStaffPayments(year, boxes, currentNominal);
  localStorage.setItem(`${KAS_STAFF_PAYMENTS_STORAGE_KEY}_${year}`, JSON.stringify(defaultStaff));
  persistLainLainStateToDb({
    staffKasPayments: {
      [year]: defaultStaff
    }
  });
  return defaultStaff;
};

import { getAllTherapistNames } from './savedOfficersService';

// Helper to extract default therapists list (includes saved & newly input officers)
export const extractTherapistsList = (boxes?: QueueBox[]): string[] => {
  return getAllTherapistNames(boxes);
};

// Helper: generate list of Saturdays for a given month (YYYY-MM)
export const getSaturdaysInMonth = (yearMonthStr: string): string[] => {
  const [yearStr, monthStr] = yearMonthStr.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10) - 1; // 0-indexed
  const saturdays: string[] = [];

  const date = new Date(year, month, 1);
  while (date.getMonth() === month) {
    if (date.getDay() === 6) { // 6 = Saturday
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      saturdays.push(`${y}-${m}-${d}`);
    }
    date.setDate(date.getDate() + 1);
  }
  return saturdays;
};

// PDF Exporters
export const exportKasReportPDF = (transactions: KasTransaction[], currentBalance: number, totalIn: number, totalOut: number, filterMonth?: string) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  // Header Banner
  doc.setFillColor(15, 23, 42); // Slate-900
  doc.rect(0, 0, 210, 26, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('LAPORAN BUKU KAS KEUANGAN INSTALASI REHABILITASI MEDIS', 14, 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(203, 213, 225);
  doc.text(`Periode: ${filterMonth || 'Semua Periode'}   |   Dicetak: ${new Date().toLocaleString('id-ID')}   |   Unit IRM RSPP`, 14, 19);

  // Summary Metrics Box
  doc.setFillColor(248, 250, 252);
  doc.rect(14, 30, 182, 18, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.rect(14, 30, 182, 18, 'S');

  const colWidth = 182 / 3;

  // Metric 1: Total Pemasukan
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('TOTAL PEMASUKAN (+)', 14 + 4, 36);
  doc.setFontSize(12);
  doc.setTextColor(22, 163, 74);
  doc.text(formatRupiah(totalIn), 14 + 4, 44);

  // Metric 2: Total Pengeluaran
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('TOTAL PENGELUARAN (-)', 14 + colWidth + 4, 36);
  doc.setFontSize(12);
  doc.setTextColor(220, 38, 38);
  doc.text(formatRupiah(totalOut), 14 + colWidth + 4, 44);

  // Metric 3: Saldo Kas
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('SISA SALDO KAS IRM', 14 + colWidth * 2 + 4, 36);
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text(formatRupiah(currentBalance), 14 + colWidth * 2 + 4, 44);

  // Table Transaksi
  const rows = transactions.map((t, idx) => [
    `${idx + 1}`,
    formatIndonesianDate(t.date, false),
    t.description,
    t.category,
    t.recordedBy,
    t.type === 'in' ? formatRupiah(t.amount) : '-',
    t.type === 'out' ? formatRupiah(t.amount) : '-'
  ]);

  autoTable(doc, {
    startY: 53,
    head: [['No', 'Tanggal', 'Uraian / Keterangan', 'Kategori', 'Petugas', 'Pemasukan (+)', 'Pengeluaran (-)']],
    body: rows,
    theme: 'striped',
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8, cellPadding: 2.5 },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { cellWidth: 26 },
      2: { cellWidth: 50 },
      3: { cellWidth: 32 },
      4: { cellWidth: 26 },
      5: { halign: 'right', cellWidth: 22, textColor: [22, 163, 74] },
      6: { halign: 'right', cellWidth: 22, textColor: [220, 38, 38] }
    }
  });

  doc.save(`Laporan_Kas_IRM_${new Date().toISOString().slice(0, 10)}.pdf`);
};

export const exportLeaveReportPDF = (leaves: LeaveRequestRecord[]) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  // Header Banner
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 210, 26, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('REKAPITULASI JADWAL CUTI FISIOTERAPIS IRM', 14, 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(203, 213, 225);
  doc.text(`Dicetak: ${new Date().toLocaleString('id-ID')}   |   Unit Instalasi Rehabilitasi Medis`, 14, 19);

  const rows = leaves.map((l, idx) => {
    const datesFormatted = l.selectedDates.map(d => formatIndonesianShortDate(d)).join(', ');
    return [
      `${idx + 1}`,
      l.therapistName,
      l.leaveType,
      `${l.totalDays} Hari`,
      datesFormatted,
      l.reason || '-',
      l.replacementStaff || '-',
      l.isAccordingToPlan ? 'Sesuai Rencana' : 'Di Luar Rencana',
      l.status.toUpperCase()
    ];
  });

  autoTable(doc, {
    startY: 32,
    head: [['No', 'Nama Fisioterapis', 'Jenis Cuti', 'Durasi', 'Tanggal Cuti', 'Keterangan / Alasan', 'Pengganti', 'Rencana Cuti', 'Status']],
    body: rows,
    theme: 'grid',
    headStyles: { fillColor: [13, 148, 136], textColor: [255, 255, 255], fontSize: 7.5, fontStyle: 'bold' },
    bodyStyles: { fontSize: 7.5, cellPadding: 2 },
    columnStyles: {
      0: { halign: 'center' },
      3: { halign: 'center', fontStyle: 'bold' },
      7: { halign: 'center' },
      8: { halign: 'center' }
    }
  });

  doc.save(`Rekap_Jadwal_Cuti_IRM_${new Date().toISOString().slice(0, 10)}.pdf`);
};

export const exportStaffKas12MonthsPDF = (
  payments: StaffKasPayment[],
  year: number,
  nominalPerMonth: number
) => {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  // Header Banner
  doc.setFillColor(15, 23, 42); // Slate-900
  doc.rect(0, 0, 297, 24, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(`REKAPITULASI CEKLIST PEMBAYARAN UANG KAS FISIOTERAPIS IRM TAHUN ${year}`, 14, 10);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(203, 213, 225);
  doc.text(
    `Iuran Kas Wajib: ${formatRupiah(nominalPerMonth)} / Orang / Bulan   |   Dicetak: ${new Date().toLocaleString('id-ID')}   |   Instalasi Rehabilitasi Medis`,
    14,
    17
  );

  const monthCols = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

  const rows = payments.map((p, idx) => {
    let paidCount = 0;
    const monthChecks = monthCols.map((_, mIdx) => {
      const isPaid = !!p.months[mIdx + 1];
      if (isPaid) paidCount++;
      return isPaid ? 'V' : '-';
    });

    const totalPaid = paidCount * (p.nominalPerMonth || nominalPerMonth);
    const status =
      paidCount === 12
        ? 'LUNAS (12 Bln)'
        : paidCount > 0
        ? `${paidCount} Bln Lunas`
        : 'Belum Bayar';

    return [
      `${idx + 1}`,
      p.staffName,
      ...monthChecks,
      `${paidCount}/12 Bln`,
      formatRupiah(totalPaid),
      status
    ];
  });

  const monthlyTotals = monthCols.map((_, mIdx) => {
    const count = payments.filter(p => !!p.months[mIdx + 1]).length;
    return `${count}/${payments.length}`;
  });

  const grandTotalPaid = payments.reduce((sum, p) => {
    const paidCount = Object.values(p.months).filter(Boolean).length;
    return sum + paidCount * (p.nominalPerMonth || nominalPerMonth);
  }, 0);

  const grandTarget = payments.length * 12 * nominalPerMonth;

  // Summary row
  rows.push([
    '',
    'TOTAL LUNAS / BULAN',
    ...monthlyTotals,
    '-',
    formatRupiah(grandTotalPaid),
    `${Math.round((grandTotalPaid / (grandTarget || 1)) * 100)}% Target`
  ]);

  autoTable(doc, {
    startY: 28,
    head: [['No', 'Nama Petugas / Fisioterapis', ...monthCols, 'Total Bln', 'Total Kas', 'Status']],
    body: rows,
    theme: 'grid',
    headStyles: {
      fillColor: [13, 148, 136],
      textColor: [255, 255, 255],
      fontSize: 7.5,
      fontStyle: 'bold',
      halign: 'center'
    },
    bodyStyles: { fontSize: 7, cellPadding: 1.8 },
    columnStyles: {
      0: { halign: 'center', cellWidth: 8 },
      1: { cellWidth: 50, fontStyle: 'bold' },
      2: { halign: 'center', cellWidth: 12 },
      3: { halign: 'center', cellWidth: 12 },
      4: { halign: 'center', cellWidth: 12 },
      5: { halign: 'center', cellWidth: 12 },
      6: { halign: 'center', cellWidth: 12 },
      7: { halign: 'center', cellWidth: 12 },
      8: { halign: 'center', cellWidth: 12 },
      9: { halign: 'center', cellWidth: 12 },
      10: { halign: 'center', cellWidth: 12 },
      11: { halign: 'center', cellWidth: 12 },
      12: { halign: 'center', cellWidth: 12 },
      13: { halign: 'center', cellWidth: 12 },
      14: { halign: 'center', cellWidth: 20, fontStyle: 'bold' },
      15: { halign: 'right', cellWidth: 28, fontStyle: 'bold', textColor: [13, 148, 136] },
      16: { halign: 'center', cellWidth: 24, fontStyle: 'bold' }
    },
    didParseCell: (data) => {
      if (data.section === 'body') {
        if (data.row.index === rows.length - 1) {
          data.cell.styles.fillColor = [241, 245, 249];
          data.cell.styles.fontStyle = 'bold';
        } else if (data.column.index >= 2 && data.column.index <= 13) {
          if (data.cell.raw === 'V') {
            data.cell.styles.textColor = [16, 185, 129];
            data.cell.styles.fontStyle = 'bold';
          } else {
            data.cell.styles.textColor = [148, 163, 184];
          }
        }
      }
    }
  });

  doc.save(`Rekap_Ceklist_Uang_Kas_IRM_${year}.pdf`);
};

// ==========================================
// KAS CHECKLIST PASSWORD MANAGEMENT
// ==========================================
const KAS_PASSWORD_STORAGE_KEY = 'irm_kas_checklist_password';
export const DEFAULT_KAS_CHECKLIST_PASSWORD = 'irm2026';

export const getKasChecklistPassword = (): string => {
  try {
    const saved = localStorage.getItem(KAS_PASSWORD_STORAGE_KEY);
    return saved && saved.trim() ? saved.trim() : DEFAULT_KAS_CHECKLIST_PASSWORD;
  } catch {
    return DEFAULT_KAS_CHECKLIST_PASSWORD;
  }
};

export const verifyKasChecklistPassword = (input: string): boolean => {
  const current = getKasChecklistPassword();
  const trimmed = (input || '').trim();
  // Support active password or fallback defaults
  return trimmed === current || trimmed === DEFAULT_KAS_CHECKLIST_PASSWORD || trimmed === '123456' || trimmed === 'bendahara';
};

export const setKasChecklistPassword = (newPass: string): void => {
  localStorage.setItem(KAS_PASSWORD_STORAGE_KEY, newPass.trim());
  persistLainLainStateToDb({ kasChecklistPassword: newPass.trim() });
};

// ==========================================
// KAS CHECKLIST AUTOMATIC TRANSACTION SYNC
// ==========================================
export const getChecklistTxId = (staffId: string, year: number, monthNum: number): string => {
  return `kas-tx-staff-${staffId}-${year}-${monthNum}`;
};

export const createChecklistTx = (
  staff: { id: string; staffName: string; nominalPerMonth?: number },
  year: number,
  monthNum: number,
  defaultNominal = 50000
): KasTransaction => {
  const mName = INDONESIAN_MONTHS[monthNum - 1];
  const txDate = `${year}-${String(monthNum).padStart(2, '0')}-01`;
  const amount = staff.nominalPerMonth || defaultNominal;

  return {
    id: getChecklistTxId(staff.id, year, monthNum),
    date: txDate,
    type: 'in',
    category: 'Iuran Kas Bulanan',
    amount: amount,
    description: `Iuran Kas ${mName} ${year} - ${staff.staffName}`,
    recordedBy: 'Bendahara IRM',
    proofNote: 'Ceklist Uang Kas 12 Bulan',
    createdAt: new Date().toISOString()
  };
};

export const syncStaffChecklistWithKas = (
  currentKas: KasTransaction[],
  payments: StaffKasPayment[],
  year: number,
  defaultNominal = 50000
): KasTransaction[] => {
  // Map of target checklist transactions that should exist
  const expectedTxMap = new Map<string, KasTransaction>();
  
  payments.forEach(staff => {
    for (let m = 1; m <= 12; m++) {
      if (staff.months && staff.months[m]) {
        const tx = createChecklistTx(staff, year, m, staff.nominalPerMonth || defaultNominal);
        expectedTxMap.set(tx.id, tx);
      }
    }
  });

  // Filter out any checklist transactions for this year that are no longer expected/checked
  const filteredKas = currentKas.filter(t => {
    if (t.id.startsWith('kas-tx-staff-') && t.id.includes(`-${year}-`)) {
      return expectedTxMap.has(t.id);
    }
    return true;
  });

  // Ensure all expected transactions exist in the list
  const existingIds = new Set(filteredKas.map(t => t.id));
  const newTxsToAdd: KasTransaction[] = [];

  expectedTxMap.forEach((tx, id) => {
    if (!existingIds.has(id)) {
      newTxsToAdd.push(tx);
    }
  });

  if (newTxsToAdd.length > 0) {
    return [...newTxsToAdd, ...filteredKas];
  }

  return filteredKas;
};


