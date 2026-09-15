import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { QueueBox, PatientItem, CallHistoryRecord, BoxColor, AppNotification, DailyPatientVisit, MasterPatient, PatientVisitHistoryItem, RanapQueueItem, RanapCategory, RanapHistoryItem } from './types';
import { INITIAL_BOXES, INITIAL_PATIENTS, INITIAL_CALL_HISTORY } from './data/initialData';
import { getLocalDateStringWIB } from './utils/dateHelper';
import { playChimeSound } from './utils/audio';
import { Header } from './components/Header';
import { QueueBoxCard } from './components/QueueBoxCard';
import { AddPatientModal } from './components/AddPatientModal';
import { RanapQueueModal } from './components/RanapQueueModal';
import { AddRanapPatientModal } from './components/AddRanapPatientModal';
import { RanapHistoryModal } from './components/RanapHistoryModal';
import { AddBoxModal } from './components/AddBoxModal';
import { EditBoxModal } from './components/EditBoxModal';
import { CallHistoryModal } from './components/CallHistoryModal';
import { MonthlyReportModal } from './components/MonthlyReportModal';
import { QueueDisplayModal } from './components/QueueDisplayModal';
import { PatientQRModal } from './components/PatientQRModal';
import { DailyPatientDatabaseModal } from './components/DailyPatientDatabaseModal';
import { TherapistWorkloadIntelligence } from './components/TherapistWorkloadIntelligence';
import { TherapistAnalyticsView } from './components/TherapistAnalyticsView';
import { ResponseTimeAnalyticsModal } from './components/ResponseTimeAnalyticsModal';
import { LainLainModal } from './components/LainLainModal';
import { InventoryStockModal } from './components/InventoryStockModal';
import { ResetConfirmPinModal } from './components/ResetConfirmPinModal';
import { SopModal } from './components/SopModal';
import { TherapistSidebar } from './components/TherapistSidebar';
import { TherapistMobileBar } from './components/TherapistMobileBar';
import { MobileBottomNav } from './components/MobileBottomNav';
import { MobileMoreModal } from './components/MobileMoreModal';
import { AppLoginGateway } from './components/AppLoginGateway';
import { ChangeAppPasswordModal } from './components/ChangeAppPasswordModal';
import { isAppAuthenticated, lockApp, syncAppPasswordFromCloud, fetchAppPasswordFromCloud } from './utils/appAuthService';
import { syncDatabasePasswordFromCloud, fetchDatabasePasswordFromCloud, databaseService } from './utils/databaseService';
import { computeResponseTimeAnalytics } from './utils/responseTimeAnalytics';
import { compareRoomNumbers } from './utils/ranapQueueUtils';
import { Pin, Sparkles, AlertCircle, X } from 'lucide-react';
import { realtimeSync } from './utils/syncService';
import { cloudDatabaseService } from './utils/cloudDatabaseService';

import { getTherapistCategory, getCanonicalTherapistKey } from './utils/savedOfficersService';
import { getJemputanActionDurationMinutes } from './utils/jemputanTimerService';
import { getActionTokensOrFallback, getRemainingActionTokens } from './utils/actionCodeUtils';

export const normalizeAndMergeBoxes = (rawList: any[]): QueueBox[] => {
  if (!Array.isArray(rawList) || rawList.length === 0) {
    return INITIAL_BOXES.map((b, idx) => ({ ...b, order: idx }));
  }

  // Preserve explicit user-defined sequence order if available
  let list = [...rawList];
  const hasOrders = list.some(b => b && typeof b.order === 'number');
  if (hasOrders) {
    list.sort((a, b) => {
      const orderA = typeof a?.order === 'number' ? a.order : 9999;
      const orderB = typeof b?.order === 'number' ? b.order : 9999;
      return orderA - orderB;
    });
  }

  const cleaned = list
    .filter((b: QueueBox) => {
      if (!b) return false;
      const key = getCanonicalTherapistKey(b.officerName, b.location, b.id);
      return key !== 'ft-tri' && key !== 'ft-bustomi';
    })
    .map((b: QueueBox) => {
      let officerName = b.officerName || '';
      let category = b.category;
      // PENTING: `id` kotak TIDAK PERNAH ditulis ulang di sini lagi (dulu dipaksa
      // berubah berdasarkan kecocokan nama, mis. officerName mengandung "monalisa"
      // -> id dipaksa jadi 'box-monalisa'). Itu berbahaya: begitu 2 kotak sama-sama
      // "dipaksa" ke id yang sama (mis. staf ganti nama kotak lain jadi mengandung
      // kata yang sama), keduanya tabrakan lalu salah satunya dibuang di langkah
      // dedup di bawah - kotak itu hilang dari layar. Id sekarang dibuat SEKALI
      // saat kotak pertama kali dibuat (lihat handleAddBox) dan tidak pernah
      // berubah lagi oleh normalisasi ini - nama/kategori/judul tetap dirapikan
      // otomatis seperti biasa (aman, murni tampilan), cuma id yang dikunci.
      const id = b.id;
      let title = (b.title || '').trim();

      if (id === 'box-monalisa' || officerName.toLowerCase().includes('monalisa')) {
        officerName = 'Monalisa';
        category = 'wicara';
        title = 'MONALISA';
      } else if (id === 'box-kalya' || officerName.toLowerCase().includes('kalya')) {
        officerName = 'Kalya';
        category = 'wicara';
        title = 'KALYA';
      } else if (id === 'box-cecep' || officerName.toLowerCase().includes('cecep')) {
        officerName = 'Cecep, A.Md.OT';
        category = 'okupasi';
        title = 'CECEP';
      } else if (id === 'box-gunandar' || officerName.toLowerCase().includes('gunandar')) {
        officerName = 'Gunandar, A.Md.OT';
        category = 'okupasi';
        title = 'GUNANDAR';
      } else if (id === 'box-putri' || officerName.toLowerCase().includes('putri')) {
        officerName = 'Putri, A.Md.OT';
        category = 'okupasi';
        title = 'PUTRI';
      } else if (id === 'box-ariq' || officerName.toLowerCase().includes('ariq')) {
        officerName = 'Ariq Muafa Adli, Amd.Ft';
        category = 'fisio';
        title = 'ARIQ';
      } else if (id === 'box-peralihan-siang' || officerName.toLowerCase().includes('peralihan') || b.title?.toLowerCase().includes('peralihan')) {
        officerName = b.officerName || 'Petugas Shift Siang';
        category = 'fisio';
        title = 'PERALIHAN SIANG';
      } else if (id === 'box-jemputan') {
        title = 'ANTRIAN JEMPUTAN RANAP IRM RSPP';
      } else if (title.includes('(')) {
        // Strip any legacy date in parentheses for all boxes
        title = title.split('(')[0].trim();
      }

      const cat = category || getTherapistCategory(officerName, b.location, category);
      let loc = b.location || '';
      const legacyDefaultLocations = [
        'Lobby Utama / Instalasi Rehabilitasi Medis',
        'Lantai 2 - Ruang Fisioterapi 1',
        'Lantai 2 - Ruang Fisioterapi 2',
        'Lantai 2 - Ruang Fisioterapi 3',
        'Lantai 2 - Ruang Fisioterapi 4',
        'Lantai 2 - Ruang Terapi Khusus A',
        'Lantai 2 - Ruang Terapi Khusus B',
        'Lantai 2 - Ruang Gimnasium & Latihan',
        'Lantai 2 - Ruang Elektroterapi',
        'Lantai 2 - Ruang Traksi & Manual Terapi',
        'Lantai 1 - Poliklinik Saraf & Fisioterapi',
        'Lantai 2 - Ruang Fisioterapi Dada & Pediatrik',
        'Lantai 2 - Poliklinik Rehabilitasi Medis',
        'Lantai 2 - Ruang Terapi 2',
        'Lantai 2 - Ruang Rehabilitasi Medis',
        'Lantai 2 - Ruang Terapi Khusus',
        'Lantai 2 - Poli Eksekutif / VIP',
        'Lantai 2 - Ruang Terapi Okupasi 1',
        'Lantai 2 - Ruang Terapi Okupasi 2',
        'Lantai 2 - Ruang Terapi Okupasi Sensori Integrasi',
        'Lantai 2 - Ruang Terapi Wicara 1',
        'Lantai 2 - Ruang Terapi Wicara 2'
      ];
      if (legacyDefaultLocations.includes(loc.trim())) {
        loc = '';
      }

      return {
        ...b,
        id,
        title: title || b.title,
        officerName,
        location: loc,
        category: cat,
        instructionText: b.instructionText?.includes('Kode tindakan jangan lupa') ? '' : (b.instructionText || '')
      };
    });

  // Deduplicate boxes by canonical therapist key (ensures exactly 1 box per therapist)
  const seenTherapistKeys = new Set<string>();
  const deduplicated: QueueBox[] = [];

  for (const b of cleaned) {
    const key = getCanonicalTherapistKey(b.officerName, b.location, b.id);
    if (seenTherapistKeys.has(key)) {
      continue;
    }
    seenTherapistKeys.add(key);
    deduplicated.push(b);
  }

  // Ensure all standard INITIAL_BOXES are present
  const existingIds = new Set(deduplicated.map((b: QueueBox) => b.id));
  const missing = INITIAL_BOXES.filter(b => {
    if (existingIds.has(b.id)) return false;
    const key = getCanonicalTherapistKey(b.officerName, b.location, b.id);
    if (seenTherapistKeys.has(key)) return false;
    return true;
  });

  const result = missing.length > 0 ? [...deduplicated, ...missing] : deduplicated;
  return result.map((b, idx) => ({
    ...b,
    order: typeof b.order === 'number' ? b.order : idx
  }));
};

export function createLocalTombstoneStore(storageKey: string, maxItems: number = 1000) {
  const getTombstones = (): Set<string> => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return new Set();
      const arr = JSON.parse(raw);
      return new Set(Array.isArray(arr) ? arr : []);
    } catch {
      return new Set();
    }
  };

  const addTombstone = (id: string): void => {
    try {
      if (!id) return;
      const set = getTombstones();
      set.add(id);
      const arr = Array.from(set).slice(-maxItems);
      localStorage.setItem(storageKey, JSON.stringify(arr));
    } catch {}
  };

  const clearTombstones = (): void => {
    try {
      localStorage.removeItem(storageKey);
    } catch {}
  };

  return { getTombstones, addTombstone, clearTombstones };
}

const patientTombstoneStore = createLocalTombstoneStore('antrian_deleted_patient_tombstones');
export const getLocalTombstones = patientTombstoneStore.getTombstones;
export const addLocalTombstone = patientTombstoneStore.addTombstone;
export const clearLocalTombstones = patientTombstoneStore.clearTombstones;

const boxTombstoneStore = createLocalTombstoneStore('antrian_deleted_box_tombstones');
export const getLocalBoxTombstones = boxTombstoneStore.getTombstones;
export const addLocalBoxTombstone = boxTombstoneStore.addTombstone;
export const clearLocalBoxTombstones = boxTombstoneStore.clearTombstones;

const ranapTombstoneStore = createLocalTombstoneStore('antrian_deleted_ranap_tombstones');
export const getLocalRanapTombstones = ranapTombstoneStore.getTombstones;
export const addLocalRanapTombstone = ranapTombstoneStore.addTombstone;
export const clearLocalRanapTombstones = ranapTombstoneStore.clearTombstones;

// Safe recency-based box content reconciler: ensures newer color/name changes aren't overwritten by stale broadcasts
export const mergeBoxesByRecency = (currentBoxes: QueueBox[], incomingRaw: QueueBox[], deletedBoxIds?: string[]): QueueBox[] => {
  const localBoxTombstones = getLocalBoxTombstones();
  const deletedSet = new Set([...(deletedBoxIds || []), ...Array.from(localBoxTombstones)]);
  const normalizedIncoming = normalizeAndMergeBoxes(incomingRaw).filter(b => !deletedSet.has(b.id));
  const currentMap = new Map<string, QueueBox>(currentBoxes.filter(b => !deletedSet.has(b.id)).map(b => [b.id, b]));
  return normalizedIncoming.map(inB => {
    const cur = currentMap.get(inB.id);
    if (!cur) return inB;
    const curTime = cur.contentUpdatedAt ? new Date(cur.contentUpdatedAt).getTime() : 0;
    const inTime = inB.contentUpdatedAt ? new Date(inB.contentUpdatedAt).getTime() : 0;
    if (curTime > inTime) {
      return {
        ...cur,
        order: typeof inB.order === 'number' ? inB.order : cur.order,
        isPinned: inB.isPinned !== undefined ? inB.isPinned : cur.isPinned,
        hasUnreadNewInput: inB.hasUnreadNewInput !== undefined ? inB.hasUnreadNewInput : cur.hasUnreadNewInput
      };
    }
    return inB;
  });
};

// Safe collision-proof ID generator across 30+ simultaneous hospital devices
function generateUniqueId(prefix: string = 'id'): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  const entropy = Math.random().toString(36).substring(2, 9) + Math.random().toString(36).substring(2, 6);
  return `${prefix}-${Date.now()}-${entropy}`;
}

// Helper function to safely merge incoming patient array with current state (prevents accidental wiping on cold start)
export function reconcileClientPatients(
  currentPatients: PatientItem[],
  incomingPatients: PatientItem[],
  isExplicitReset?: boolean,
  deletedIds?: string[],
  lastResetAt?: string | null
): PatientItem[] {
  if (isExplicitReset) {
    return [];
  }

  const resetEpoch = lastResetAt ? new Date(lastResetAt).getTime() : 0;
  const localTombstones = getLocalTombstones();
  const deletedSet = new Set([...(deletedIds || []), ...Array.from(localTombstones)]);
  const patientMap = new Map<string, PatientItem>();

  // 1. Add current active local patients (unless deleted or expired by reset barrier)
  for (const p of currentPatients) {
    if (p && p.id && !deletedSet.has(p.id)) {
      if (resetEpoch > 0) {
        const itemTime = new Date(p.createdAt || (p as any).registeredAt || 0).getTime();
        if (!itemTime || itemTime <= resetEpoch) {
          continue; // Discard patient created before or at last reset watermark
        }
      }
      patientMap.set(p.id, { ...p });
    }
  }

  // 2. Merge incoming patients
  for (const inP of incomingPatients) {
    if (!inP || !inP.id || deletedSet.has(inP.id)) continue;

    if (resetEpoch > 0) {
      const itemTime = new Date(inP.createdAt || (inP as any).registeredAt || 0).getTime();
      if (!itemTime || itemTime <= resetEpoch) {
        continue; // Discard incoming patient created before or at last reset watermark
      }
    }

    const existing = patientMap.get(inP.id);
    if (!existing) {
      patientMap.set(inP.id, { ...inP });
    } else {
      const isCompleted = Boolean(inP.completed || existing.completed);
      const calledCount = Math.max(Number(inP.calledCount || 0), Number(existing.calledCount || 0));
      const lastCalledAt = inP.lastCalledAt && (!existing.lastCalledAt || new Date(inP.lastCalledAt) >= new Date(existing.lastCalledAt))
        ? inP.lastCalledAt
        : existing.lastCalledAt;
      const completedAt = inP.completedAt && (!existing.completedAt || new Date(inP.completedAt) >= new Date(existing.completedAt))
        ? inP.completedAt
        : existing.completedAt;

      patientMap.set(inP.id, {
        ...existing,
        ...inP,
        completed: isCompleted,
        calledCount,
        lastCalledAt,
        completedAt,
        boxId: inP.boxId || existing.boxId,
        patientName: inP.patientName || existing.patientName,
        medicalRecordNo: inP.medicalRecordNo || existing.medicalRecordNo,
        queueNumber: inP.queueNumber || existing.queueNumber,
        actionCode: inP.actionCode !== undefined ? inP.actionCode : existing.actionCode,
        diagnosis: inP.diagnosis !== undefined ? inP.diagnosis : existing.diagnosis,
        note: inP.note !== undefined ? inP.note : existing.note,
        isRanap: inP.isRanap !== undefined ? inP.isRanap : existing.isRanap,
        isWarning: inP.isWarning !== undefined ? inP.isWarning : existing.isWarning,
        phoneNumber: inP.phoneNumber || existing.phoneNumber,
        createdAt: existing.createdAt || inP.createdAt
      });
    }
  }

  return Array.from(patientMap.values());
}

const LiveClockFooter: React.FC = React.memo(() => {
  const [time, setTime] = useState<string>(() =>
    new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  );

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return <strong className="text-white font-bold">{time}</strong>;
});

export default function App() {
  const [boxes, setBoxes] = useState<QueueBox[]>(() => {
    const saved = localStorage.getItem('antrian_boxes');
    if (!saved) return INITIAL_BOXES;
    try {
      const parsed = JSON.parse(saved);
      return normalizeAndMergeBoxes(parsed);
    } catch {
      return INITIAL_BOXES;
    }
  });

  const [patients, setPatients] = useState<PatientItem[]>(() => {
    try {
      const saved = localStorage.getItem('antrian_patients');
      const lastReset = localStorage.getItem('antrian_last_reset_at');
      const resetEpoch = lastReset ? new Date(lastReset).getTime() : 0;
      const today = getLocalDateStringWIB();

      const list: PatientItem[] = saved ? JSON.parse(saved) : INITIAL_PATIENTS;
      const map = new Map<string, PatientItem>();
      (list || []).forEach(p => {
        if (p && p.id) {
          // Reject stale patient created prior to the last queue reset
          if (resetEpoch > 0) {
            const itemTime = new Date(p.createdAt || (p as any).registeredAt || 0).getTime();
            if (itemTime > 0 && itemTime < resetEpoch) return;
          }
          // Reject patient from a previous visit date
          if ((p as any).visitDate && (p as any).visitDate !== today) return;
          map.set(p.id, p);
        }
      });
      return Array.from(map.values());
    } catch {
      return INITIAL_PATIENTS;
    }
  });

  const [callLogs, setCallLogs] = useState<CallHistoryRecord[]>(() => {
    const saved = localStorage.getItem('antrian_call_logs');
    return saved ? JSON.parse(saved) : INITIAL_CALL_HISTORY;
  });

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Filters & Controls
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed' | 'warning'>('all');
  const [selectedTherapistBoxId, setSelectedTherapistBoxId] = useState<string | null>(null);
  const [isTherapistSidebarOpen, setIsTherapistSidebarOpen] = useState(false);
  const [soundEnabled] = useState(true);

  // Active Calling Patient
  const [currentCallingPatient, setCurrentCallingPatient] = useState<PatientItem | null>(null);
  const [currentCallingBox, setCurrentCallingBox] = useState<QueueBox | null>(null);

  // View Navigation: 'queue' (Kotak Antrean) or 'analytics' (Halaman Analitik Terapis Terpisah)
  const [currentView, setCurrentView] = useState<'queue' | 'analytics'>('queue');

  // Modals state
  const [isAddPatientOpen, setIsAddPatientOpen] = useState(false);
  const [addPatientBoxId, setAddPatientBoxId] = useState<string | undefined>(undefined);
  const [isRanapQueueOpen, setIsRanapQueueOpen] = useState(false);
  const [isAddRanapPatientOpen, setIsAddRanapPatientOpen] = useState(false);
  const [addRanapDefaultCategory, setAddRanapDefaultCategory] = useState<RanapCategory>('fisio');
  const [isRanapHistoryOpen, setIsRanapHistoryOpen] = useState(false);
  const [ranapQueue, setRanapQueue] = useState<RanapQueueItem[]>(() => {
    try {
      const saved = localStorage.getItem('antrian_ranap_queue');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const deletedRanapIdsRef = React.useRef<string[]>([]);
  const [isDailyDatabaseOpen, setIsDailyDatabaseOpen] = useState(false);
  const [isAddBoxOpen, setIsAddBoxOpen] = useState(false);
  const [editingBox, setEditingBox] = useState<QueueBox | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyBox, setHistoryBox] = useState<QueueBox | null>(null);
  const [isMonthlyReportOpen, setIsMonthlyReportOpen] = useState(false);
  const [isTVDisplayOpen, setIsTVDisplayOpen] = useState(false);
  const [isCloudBackupDegraded, setIsCloudBackupDegraded] = useState(false);
  const [showBackupDegradedInfo, setShowBackupDegradedInfo] = useState(false);
  const [isResponseTimeModalOpen, setIsResponseTimeModalOpen] = useState(false);
  const [isLainLainOpen, setIsLainLainOpen] = useState(false);
  const [lainLainInitialTab, setLainLainInitialTab] = useState<'kas' | 'rotasi' | 'sabtu' | 'cuti'>('kas');
  const [isInventoryOpen, setIsInventoryOpen] = useState(false);
  const [isSopOpen, setIsSopOpen] = useState(false);
  const [isMobileMoreOpen, setIsMobileMoreOpen] = useState(false);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(true);
  const knownPatientIdsRef = React.useRef<Set<string>>(new Set());
  const [boxColumnCount, setBoxColumnCount] = useState(() => {
    if (typeof window === 'undefined') return 1;
    const w = window.innerWidth;
    if (w >= 1536) return 5;
    if (w >= 1280) return 4;
    if (w >= 1024) return 3;
    if (w >= 768) return 2;
    return 1;
  });
  useEffect(() => {
    const computeColumnCount = () => {
      const w = window.innerWidth;
      if (w >= 1536) return 5;
      if (w >= 1280) return 4;
      if (w >= 1024) return 3;
      if (w >= 768) return 2;
      return 1;
    };
    const handleResize = () => setBoxColumnCount(computeColumnCount());
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Watermark ref for explicit box reordering (prevents stale devices from reverting box order)
  const boxOrderUpdatedAtRef = React.useRef<string | null>(
    typeof window !== 'undefined' ? localStorage.getItem('antrian_box_order_updated_at') : null
  );

  const stampBoxOrderUpdated = () => {
    const ts = new Date().toISOString();
    boxOrderUpdatedAtRef.current = ts;
    try {
      localStorage.setItem('antrian_box_order_updated_at', ts);
    } catch {}
  };

  const updateBoxOrderWatermarkIfNewer = (incomingWatermark?: string | null) => {
    if (!incomingWatermark) return;
    const incomingTs = new Date(incomingWatermark).getTime();
    const currentTs = boxOrderUpdatedAtRef.current ? new Date(boxOrderUpdatedAtRef.current).getTime() : 0;
    if (!isNaN(incomingTs) && incomingTs > currentTs) {
      boxOrderUpdatedAtRef.current = incomingWatermark;
      try {
        localStorage.setItem('antrian_box_order_updated_at', incomingWatermark);
      } catch {}
    }
  };

  // Drag-and-Drop & Reorder state
  const [draggedBoxId, setDraggedBoxId] = useState<string | null>(null);
  const [dragOverBoxId, setDragOverBoxId] = useState<string | null>(null);

  const handleDragStartBox = (boxId: string) => {
    setDraggedBoxId(boxId);
  };

  const handleDragEndBox = () => {
    setDraggedBoxId(null);
    setDragOverBoxId(null);
  };

  const handleDragOverBox = (e: React.DragEvent, boxId: string) => {
    e.preventDefault();
    if (draggedBoxId && draggedBoxId !== boxId) {
      setDragOverBoxId(boxId);
    }
  };

  const handleDropBox = (targetBoxId: string) => {
    if (!draggedBoxId || draggedBoxId === targetBoxId) {
      setDraggedBoxId(null);
      setDragOverBoxId(null);
      return;
    }

    stampBoxOrderUpdated();
    setBoxes(prev => {
      const sourceBox = prev.find(b => b.id === draggedBoxId);
      const targetBox = prev.find(b => b.id === targetBoxId);
      if (!sourceBox || !targetBox) return prev;

      const sourceIndex = prev.findIndex(b => b.id === draggedBoxId);
      const newBoxes = [...prev];
      const [removed] = newBoxes.splice(sourceIndex, 1);

      // If dropped onto a target in another section, harmonize isPinned flag
      const updatedItem: QueueBox = {
        ...removed,
        isPinned: targetBox.isPinned
      };

      const targetIndex = newBoxes.findIndex(b => b.id === targetBoxId);
      if (targetIndex === -1) {
        newBoxes.push(updatedItem);
      } else {
        newBoxes.splice(targetIndex, 0, updatedItem);
      }

      const reordered = newBoxes.map((b, idx) => ({ ...b, order: idx }));
      try {
        localStorage.setItem('antrian_boxes', JSON.stringify(reordered));
      } catch (e) {
        console.warn('Failed to save reordered boxes to localStorage:', e);
      }
      return reordered;
    });

    hasLocalMutationRef.current = true;
    setDraggedBoxId(null);
    setDragOverBoxId(null);
    showAppToast('Posisi kotak antrean berhasil dipindahkan.');
  };

  const handleMoveBoxStep = (boxId: string, direction: 'left' | 'right' | 'first' | 'last') => {
    stampBoxOrderUpdated();
    setBoxes(prev => {
      const targetBox = prev.find(b => b.id === boxId);
      if (!targetBox) return prev;

      const isPinned = !!targetBox.isPinned;
      const groupBoxes = prev.filter(b => !!b.isPinned === isPinned);
      const otherGroupBoxes = prev.filter(b => !!b.isPinned !== isPinned);

      const groupIndex = groupBoxes.findIndex(b => b.id === boxId);
      if (groupIndex === -1) return prev;

      const newGroup = [...groupBoxes];
      const [item] = newGroup.splice(groupIndex, 1);

      if (direction === 'first') {
        newGroup.unshift(item);
      } else if (direction === 'last') {
        newGroup.push(item);
      } else if (direction === 'left') {
        const targetIdx = Math.max(0, groupIndex - 1);
        newGroup.splice(targetIdx, 0, item);
      } else if (direction === 'right') {
        const targetIdx = Math.min(newGroup.length, groupIndex + 1);
        newGroup.splice(targetIdx, 0, item);
      }

      const combined = isPinned
        ? [...newGroup, ...otherGroupBoxes]
        : [...otherGroupBoxes, ...newGroup];

      const reordered = combined.map((b, idx) => ({ ...b, order: idx }));
      try {
        localStorage.setItem('antrian_boxes', JSON.stringify(reordered));
      } catch (e) {
        console.warn('Failed to save reordered boxes to localStorage:', e);
      }
      return reordered;
    });

    hasLocalMutationRef.current = true;
    showAppToast('Urutan posisi kotak berhasil diperbarui.');
  };

  const handleReorderBoxes = (newBoxes: QueueBox[]) => {
    stampBoxOrderUpdated();
    setBoxes(newBoxes);
    hasLocalMutationRef.current = true;
    try {
      localStorage.setItem('antrian_boxes', JSON.stringify(newBoxes));
    } catch (e) {
      console.warn('Failed to save reordered boxes to localStorage:', e);
    }
    realtimeSync.broadcastState({
      boxes: newBoxes,
      patients,
      ranapQueue,
      callLogs,
      notifications,
      currentCallingPatient,
      currentCallingBox,
      boxOrderUpdatedAt: boxOrderUpdatedAtRef.current || undefined,
      lastUpdated: new Date().toISOString(),
    });
    showAppToast('Urutan kotak terapis berhasil diperbarui & disinkronkan.');
  };

  // App Authentication & Security State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => isAppAuthenticated());
  const [isChangeAppPasswordOpen, setIsChangeAppPasswordOpen] = useState(false);
  const [appToastMessage, setAppToastMessage] = useState<string | null>(null);

  const showAppToast = (msg: string) => {
    setAppToastMessage(msg);
    setTimeout(() => {
      setAppToastMessage((prev) => (prev === msg ? null : prev));
    }, 3500);
  };

  const handleLockApp = () => {
    lockApp();
    setIsAuthenticated(false);
    showAppToast('Aplikasi telah dikunci');
  };

  // QR Modal State
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const [qrModalPatient, setQrModalPatient] = useState<PatientItem | null>(null);
  const [qrModalBox, setQrModalBox] = useState<QueueBox | null>(null);

  // Reference flags to manage real-time synchronization safely
  const isRemoteSyncRef = React.useRef(false);
  const isHydratedRef = React.useRef(false);
  const hasLocalMutationRef = React.useRef(false);
  const lastAnnouncedCallRef = React.useRef<string | null>(null);
  const deletedPatientIdsRef = React.useRef<string[]>([]);
  const deletedBoxIdsRef = React.useRef<string[]>([]);
  const broadcastDebounceTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  // Check URL query parameters on startup (e.g. ?mode=tv)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('mode') === 'tv' || params.get('tv') === 'true' || params.get('tv') === '1') {
        setIsTVDisplayOpen(true);
      }
    }
  }, []);

  // Pantau status kesehatan cadangan cloud (Firestore) secara berkala. Kalau
  // cadangan otomatis sedang dinonaktifkan (mis. kuota harian habis), tampilkan
  // peringatan yang TERLIHAT ke staf saat itu juga - supaya tidak ada lagi
  // kejadian "data hilang tanpa peringatan" yang baru ketahuan keesokan harinya.
  useEffect(() => {
    let isMounted = true;
    const checkBackupStatus = () => {
      fetch('/api/system/status')
        .then(res => res.json())
        .then(data => {
          if (isMounted) setIsCloudBackupDegraded(Boolean(data?.firestoreMirrorDisabled));
        })
        .catch(() => {});
    };
    checkBackupStatus();
    const interval = setInterval(checkBackupStatus, 30000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Self-healing: normalizeAndMergeBoxes/mergeBoxesByRecency kadang mengganti
  // atau menggabungkan id kotak (mis. kotak duplikat dari perangkat lain yang
  // id-nya berbeda tapi terapisnya sama, atau id lama yang belum ter-migrasi
  // ke id kanonik). Saat itu terjadi, pasien yang boxId-nya masih menunjuk ke
  // id kotak lama jadi tidak match dengan kotak manapun di state terbaru -
  // kotaknya sendiri tetap tampil, tapi daftar pasien di dalamnya kosong.
  // Perbaiki otomatis dengan mencocokkan ulang via nama terapis (officerName),
  // bukan cuma boxId literal, setiap kali daftar kotak berubah.
  useEffect(() => {
    if (boxes.length === 0) return;
    const boxIdSet = new Set(boxes.map(b => b.id));
    const boxIdByCanonicalKey = new Map<string, string>();
    boxes.forEach(b => {
      const key = getCanonicalTherapistKey(b.officerName, b.location, b.id);
      if (!boxIdByCanonicalKey.has(key)) boxIdByCanonicalKey.set(key, b.id);
    });

    setPatients(prev => {
      let changed = false;
      const next = prev.map(p => {
        if (!p.boxId || boxIdSet.has(p.boxId) || !p.officerName) return p;
        const key = getCanonicalTherapistKey(p.officerName, undefined, p.boxId);
        const targetBoxId = boxIdByCanonicalKey.get(key);
        if (targetBoxId && targetBoxId !== p.boxId) {
          changed = true;
          return { ...p, boxId: targetBoxId };
        }
        return p;
      });
      return changed ? next : prev;
    });
  }, [boxes]);

  // Multi-Device Real-Time Sync Subscription & Initial Server Fetch
  useEffect(() => {
    let isMounted = true;

    const unsubscribeStatus = realtimeSync.subscribeStatus((connected) => {
      if (isMounted) setIsRealtimeConnected(connected);
    });

    const unsubscribeData = realtimeSync.subscribe((syncData) => {
      if (!syncData || !isMounted) return;

      if (syncData.boxOrderUpdatedAt) {
        updateBoxOrderWatermarkIfNewer(syncData.boxOrderUpdatedAt);
      }

      isRemoteSyncRef.current = true;
      isHydratedRef.current = true;

      // Reconcile Ranap Queue first so that explicit reset of walk-in queue NEVER clears ranapQueue
      if (syncData.ranapQueue && Array.isArray(syncData.ranapQueue)) {
        setRanapQueue(prev => {
          const deletedSet = new Set(deletedRanapIdsRef.current);
          if (Array.isArray(syncData.deletedRanapIds)) {
            syncData.deletedRanapIds.forEach(id => deletedSet.add(id));
          }
          const map = new Map<string, RanapQueueItem>();
          prev.forEach(r => { if (r && r.id && !deletedSet.has(r.id)) map.set(r.id, r); });
          syncData.ranapQueue!.forEach(r => {
            if (r && r.id && !deletedSet.has(r.id)) {
              const ex = map.get(r.id);
              map.set(r.id, ex ? { ...ex, ...r } : r);
            }
          });
          const merged = Array.from(map.values()).sort((a, b) => compareRoomNumbers(a.roomNumber, b.roomNumber));
          return JSON.stringify(prev) === JSON.stringify(merged) ? prev : merged;
        });
      }

      // Handle Explicit Reset across all devices
      const isResetEvent = Boolean(
        syncData.isExplicitReset ||
        syncData.resetConfirmed
      );

      if (syncData.lastResetAt) {
        try {
          localStorage.setItem('antrian_last_reset_at', syncData.lastResetAt);
        } catch {
          // ignore
        }
      }

      if (isResetEvent) {
        knownPatientIdsRef.current.clear();
        clearLocalTombstones();
        hasLocalMutationRef.current = false;
        setPatients([]);
        setCallLogs([]);
        setNotifications([]);
        setUnreadCount(0);
        setCurrentCallingPatient(null);
        setCurrentCallingBox(null);
        localStorage.removeItem('antrian_patients');
        localStorage.removeItem('antrian_call_logs');

        if (syncData.boxes && Array.isArray(syncData.boxes) && syncData.boxes.length > 0) {
          setBoxes(prev => {
            const merged = mergeBoxesByRecency(prev, syncData.boxes);
            return JSON.stringify(prev) === JSON.stringify(merged) ? prev : merged;
          });
        }

        setTimeout(() => {
          if (isMounted) isRemoteSyncRef.current = false;
        }, 300);
        return;
      }

      if (syncData.boxes && Array.isArray(syncData.boxes) && syncData.boxes.length > 0) {
        setBoxes(prev => {
          const merged = mergeBoxesByRecency(prev, syncData.boxes);
          return JSON.stringify(prev) === JSON.stringify(merged) ? prev : merged;
        });
      }

      if (syncData.patients && Array.isArray(syncData.patients)) {
        if (syncData.patients.length > 0) {
          // Detect newly arrived active patients from other devices
          if (knownPatientIdsRef.current.size > 0) {
            const newRemotePatients = syncData.patients.filter(
              p => !p.completed && !knownPatientIdsRef.current.has(p.id)
            );
            if (newRemotePatients.length > 0) {
              if (soundEnabled) {
                playChimeSound('new-patient');
              }
              const latest = newRemotePatients[newRemotePatients.length - 1];
              const targetB = (syncData.boxes || boxes).find(b => b.id === latest.boxId);
              const arrivalNotif: AppNotification = {
                id: `notif-remote-${latest.id}`,
                boxId: latest.boxId,
                boxTitle: targetB ? targetB.title : 'Kotak Antrian',
                officerName: targetB ? targetB.officerName : '',
                patientName: latest.patientName,
                queueNumber: latest.queueNumber,
                medicalRecordNo: latest.medicalRecordNo,
                actionCode: latest.actionCode,
                isRanap: latest.isRanap,
                isWarning: latest.isWarning,
                timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB',
                createdAt: latest.createdAt || new Date().toISOString(),
                isRead: false
              };
              setUnreadCount(prev => prev + newRemotePatients.length);
            }
          }
          syncData.patients.forEach(p => knownPatientIdsRef.current.add(p.id));
        }

        if (Array.isArray(syncData.deletedPatientIds) && syncData.deletedPatientIds.length > 0) {
          syncData.deletedPatientIds.forEach((id: string) => addLocalTombstone(id));
        }

        setPatients(prev => {
          const merged = reconcileClientPatients(
            prev,
            syncData.patients,
            false,
            syncData.deletedPatientIds,
            syncData.lastResetAt
          );
          return JSON.stringify(prev) === JSON.stringify(merged) ? prev : merged;
        });
      }

      if (syncData.callLogs && Array.isArray(syncData.callLogs)) {
        setCallLogs(prev => {
          const map = new Map<string, CallHistoryRecord>();
          [...prev, ...syncData.callLogs].forEach(l => { if (l && l.id) map.set(l.id, l); });
          const merged = Array.from(map.values())
            .sort((a, b) => new Date(b.calledAt || 0).getTime() - new Date(a.calledAt || 0).getTime())
            .slice(0, 300);
          return JSON.stringify(prev) === JSON.stringify(merged) ? prev : merged;
        });
      }

      if (syncData.notifications && Array.isArray(syncData.notifications)) {
        setNotifications(prev => JSON.stringify(prev) === JSON.stringify(syncData.notifications) ? prev : syncData.notifications);
      }

      if (Array.isArray(syncData.savedOfficers) && syncData.savedOfficers.length > 0) {
        try {
          localStorage.setItem('antrian_irm_saved_officers_v1', JSON.stringify(syncData.savedOfficers));
        } catch {
          // ignore
        }
      }

      if (syncData.currentCallingPatient !== undefined) {
        setCurrentCallingPatient(syncData.currentCallingPatient);
        if (syncData.currentCallingPatient && syncData.currentCallingBox) {
          const callKey = `${syncData.currentCallingPatient.id}_${syncData.currentCallingPatient.lastCalledAt || ''}`;
          if (lastAnnouncedCallRef.current !== callKey) {
            lastAnnouncedCallRef.current = callKey;
          }
        }
      }
      if (syncData.currentCallingBox !== undefined) {
        setCurrentCallingBox(syncData.currentCallingBox);
      }

      // Reset remote flag after React render cycle settles
      setTimeout(() => {
        if (isMounted) isRemoteSyncRef.current = false;
      }, 150);
    });

    // 1. Initial durable hydration from Cloud Firestore
    cloudDatabaseService.getQueueState().then((cloudState) => {
      if (!isMounted || !cloudState) return;

      if (cloudState.lastResetAt) {
        try {
          localStorage.setItem('antrian_last_reset_at', cloudState.lastResetAt);
        } catch {
          // ignore
        }
      }

      if (cloudState.boxOrderUpdatedAt) {
        updateBoxOrderWatermarkIfNewer(cloudState.boxOrderUpdatedAt);
      }

      const cloudResetEpoch = cloudState.lastResetAt ? new Date(cloudState.lastResetAt).getTime() : 0;
      const validCloudPatients = (cloudState.patients || []).filter(p => {
        if (!p || !p.id) return false;
        if (cloudResetEpoch > 0) {
          const itemTime = new Date(p.createdAt || (p as any).registeredAt || 0).getTime();
          if (itemTime > 0 && itemTime < cloudResetEpoch) return false;
        }
        return true;
      });

      if (Array.isArray(cloudState.ranapQueue) && cloudState.ranapQueue.length > 0) {
        const deletedRanapSet = new Set(cloudState.deletedRanapIds || []);
        setRanapQueue(prev => {
          const map = new Map<string, RanapQueueItem>();
          prev.forEach(r => { if (r && r.id && !deletedRanapSet.has(r.id)) map.set(r.id, r); });
          cloudState.ranapQueue!.forEach(r => { if (r && r.id && !deletedRanapSet.has(r.id)) map.set(r.id, r); });
          return Array.from(map.values()).sort((a, b) => compareRoomNumbers(a.roomNumber, b.roomNumber));
        });
      }

      // PENTING: sama seperti di jalur sinkronisasi lain (SSE/BroadcastChannel &
      // REST fetch awal) - JANGAN anggap `lastResetAt` (watermark PERMANEN dari
      // reset TERAKHIR KALI, bisa dari kemarin) sebagai sinyal reset, dan JANGAN
      // anggap validCloudPatients kosong sebagai tanda reset. Snapshot Firestore
      // yang sedang di-hydrate saat cold-start/reload bisa kebetulan tertinggal
      // (belum ter-mirror pasien aktif terbaru dari perangkat lain) sehingga
      // tampak "0 pasien" padahal antrean sebenarnya tidak kosong - kalau ini
      // dianggap reset, `setPatients([])` di bawah akan menghapus pasien yang
      // BARU SAJA benar dipulihkan lewat fetch REST /api/queue (race kondisi
      // antara 2 sumber hydrasi awal). isExplicitReset/resetConfirmed sendiri
      // aman dipakai sendirian karena keduanya SELALU di-set eksplisit oleh
      // cloudDatabaseService.saveQueueState (lihat cloudDatabaseService.ts).
      const isCloudExplicitReset = Boolean(
        cloudState.isExplicitReset || cloudState.resetConfirmed
      );

      if (isCloudExplicitReset) {
        knownPatientIdsRef.current.clear();
        setPatients([]);
        setCallLogs([]);
        setNotifications([]);
        setUnreadCount(0);
        setCurrentCallingPatient(null);
        setCurrentCallingBox(null);
        localStorage.removeItem('antrian_patients');
        localStorage.removeItem('antrian_call_logs');
        if (Array.isArray(cloudState.boxes) && cloudState.boxes.length > 0) {
          setBoxes(normalizeAndMergeBoxes(cloudState.boxes));
        }
        return;
      }

      let hasRestoredPatients = false;
      if (validCloudPatients.length > 0) {
        hasRestoredPatients = true;
        setPatients(prev => {
          const merged = reconcileClientPatients(
            prev,
            validCloudPatients,
            false,
            cloudState.deletedPatientIds,
            cloudState.lastResetAt
          );
          merged.forEach(p => knownPatientIdsRef.current.add(p.id));
          return merged;
        });
      }
      if (Array.isArray(cloudState.boxes) && cloudState.boxes.length > 0) {
        setBoxes(prev => mergeBoxesByRecency(prev, cloudState.boxes));
      }
      if (Array.isArray(cloudState.callLogs) && cloudState.callLogs.length > 0) {
        setCallLogs(prev => {
          const map = new Map<string, CallHistoryRecord>();
          [...prev, ...cloudState.callLogs].forEach(l => { if (l && l.id) map.set(l.id, l); });
          return Array.from(map.values())
            .sort((a, b) => new Date(b.calledAt || 0).getTime() - new Date(a.calledAt || 0).getTime())
            .slice(0, 300);
        });
      }

      // If Cloud Firestore had verified patients, heal server in background
      if (hasRestoredPatients) {
        fetch('/api/queue', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            boxes: Array.isArray(cloudState.boxes) ? normalizeAndMergeBoxes(cloudState.boxes) : boxes,
            patients: validCloudPatients,
            ranapQueue: cloudState.ranapQueue || [],
            callLogs: cloudState.callLogs || [],
            notifications: cloudState.notifications || [],
            lastResetAt: cloudState.lastResetAt || null,
            boxOrderUpdatedAt: boxOrderUpdatedAtRef.current || undefined,
            isExplicitReset: false,
            resetConfirmed: false,
          }),
        }).catch(e => console.warn('Background server queue heal error:', e));
      }
    }).catch(err => {
      console.warn('Initial Cloud Firestore queue hydration error:', err);
    });

    // 1b. Proactive Master Patients & Daily Archive Warming & Resilient Cloud Auto-Healing
    databaseService.getMasterPatients().catch(err => {
      console.warn('Initial master patients hydration error:', err);
    });
    databaseService.getDailyDatabase().catch(err => {
      console.warn('Initial daily database hydration error:', err);
    });

    // 2. Immediate REST API fetch
    fetch('/api/queue')
      .then(res => res.json())
      .then(data => {
        if (!isMounted) return;
        if (data.status === 'ok' && data.state) {
          isRemoteSyncRef.current = true;
          isHydratedRef.current = true;

          if (data.state.boxOrderUpdatedAt) {
            updateBoxOrderWatermarkIfNewer(data.state.boxOrderUpdatedAt);
          }

          if (data.state.lastResetAt) {
            try {
              localStorage.setItem('antrian_last_reset_at', data.state.lastResetAt);
            } catch {
              // ignore
            }
          }

          const serverResetEpoch = data.state.lastResetAt ? new Date(data.state.lastResetAt).getTime() : 0;
          const validServerPatients = (data.state.patients || []).filter((p: PatientItem) => {
            if (!p || !p.id) return false;
            if (serverResetEpoch > 0) {
              const itemTime = new Date(p.createdAt || (p as any).registeredAt || 0).getTime();
              if (itemTime > 0 && itemTime < serverResetEpoch) return false;
            }
            return true;
          });

          if (Array.isArray(data.state.ranapQueue) && data.state.ranapQueue.length > 0) {
            const deletedRanapSet = new Set(data.state.deletedRanapIds || []);
            setRanapQueue(prev => {
              const map = new Map<string, RanapQueueItem>();
              prev.forEach(r => { if (r && r.id && !deletedRanapSet.has(r.id)) map.set(r.id, r); });
              data.state.ranapQueue.forEach((r: any) => {
                if (r && r.id && !deletedRanapSet.has(r.id)) {
                  const ex = map.get(r.id);
                  map.set(r.id, ex ? { ...ex, ...r } : r);
                }
              });
              return Array.from(map.values()).sort((a, b) => compareRoomNumbers(a.roomNumber, b.roomNumber));
            });
          }

          const isServerReset = Boolean(
            data.state.isExplicitReset ||
            data.state.resetConfirmed
          );

          if (isServerReset) {
            knownPatientIdsRef.current.clear();
            setPatients([]);
            setCallLogs([]);
            setNotifications([]);
            setUnreadCount(0);
            setCurrentCallingPatient(null);
            setCurrentCallingBox(null);
            localStorage.removeItem('antrian_patients');
            localStorage.removeItem('antrian_call_logs');
            if (Array.isArray(data.state.boxes) && data.state.boxes.length > 0) {
              setBoxes(normalizeAndMergeBoxes(data.state.boxes));
            }
            setTimeout(() => {
              if (isMounted) isRemoteSyncRef.current = false;
            }, 300);
            return;
          }

          if (Array.isArray(data.state.boxes) && data.state.boxes.length > 0) {
            setBoxes(prev => mergeBoxesByRecency(prev, data.state.boxes));
          }

          if (validServerPatients.length > 0) {
            // Authoritative initial state from server replaces local cache cleanly
            knownPatientIdsRef.current.clear();
            validServerPatients.forEach((p: PatientItem) => knownPatientIdsRef.current.add(p.id));
            setPatients(validServerPatients);
            localStorage.setItem('antrian_patients', JSON.stringify(validServerPatients));
          }

          if (Array.isArray(data.state.callLogs) && data.state.callLogs.length > 0) {
            setCallLogs(prev => {
              const map = new Map<string, CallHistoryRecord>();
              [...prev, ...data.state.callLogs].forEach(l => { if (l && l.id) map.set(l.id, l); });
              return Array.from(map.values())
                .sort((a, b) => new Date(b.calledAt || 0).getTime() - new Date(a.calledAt || 0).getTime())
                .slice(0, 300);
            });
          }

          if (Array.isArray(data.state.notifications)) setNotifications(data.state.notifications);

          if (Array.isArray(data.state.savedOfficers) && data.state.savedOfficers.length > 0) {
            try {
              localStorage.setItem('antrian_irm_saved_officers_v1', JSON.stringify(data.state.savedOfficers));
            } catch {
              // ignore
            }
          }

          if (data.state.currentCallingPatient !== undefined) setCurrentCallingPatient(data.state.currentCallingPatient);
          if (data.state.currentCallingBox !== undefined) setCurrentCallingBox(data.state.currentCallingBox);

          setTimeout(() => {
            if (isMounted) isRemoteSyncRef.current = false;
          }, 150);
        } else {
          isHydratedRef.current = true;
        }
      })
      .catch(err => {
        console.warn('Initial server queue fetch error:', err);
        if (isMounted) isHydratedRef.current = true;
      });

    // 3. Security Config Cross-Device Sync (App & Database Master Passwords)
    fetchAppPasswordFromCloud().catch(() => {});
    fetchDatabasePasswordFromCloud().catch(() => {});
    const unsubscribeSecurity = cloudDatabaseService.subscribeSecurityConfig((sec) => {
      if (!isMounted || !sec) return;
      if (sec.appPassword) {
        syncAppPasswordFromCloud(sec.appPassword);
      }
      if (sec.databasePassword) {
        syncDatabasePasswordFromCloud(sec.databasePassword);
      }
    });

    return () => {
      isMounted = false;
      unsubscribeStatus();
      unsubscribeData();
      unsubscribeSecurity();
    };
  }, []);

  const handleUpdateBox = (updatedBox: QueueBox) => {
    // Cegah kotak ini "bertabrakan" dengan kotak lain yang masih aktif untuk
    // terapis yang sama - kalau dibiarkan, keduanya akan dianggap 1 kotak
    // kembar dan salah satunya hilang dari layar di langkah dedup. Kalau
    // memang berniat menggabungkan 2 kotak jadi 1, gunakan Hapus Kotak dengan
    // opsi pindahkan pasien, bukan ganti nama.
    const newKey = getCanonicalTherapistKey(updatedBox.officerName, updatedBox.location, updatedBox.id);
    const collidesWith = boxes.find(b => b.id !== updatedBox.id && getCanonicalTherapistKey(b.officerName, b.location, b.id) === newKey);
    if (collidesWith) {
      showAppToast(`Nama "${updatedBox.officerName}" sudah dipakai kotak "${collidesWith.title}". Gunakan nama lain, atau hapus salah satu kotak dengan opsi pindahkan pasien kalau memang ingin digabungkan.`);
      return;
    }

    hasLocalMutationRef.current = true;
    const stamped = { ...updatedBox, contentUpdatedAt: new Date().toISOString() };
    setBoxes(prev => prev.map(b => b.id === stamped.id ? stamped : b));
  };

  // Broadcast local changes to all connected devices ONLY when triggered locally AND after hydration
  useEffect(() => {
    localStorage.setItem('antrian_boxes', JSON.stringify(boxes));
    localStorage.setItem('antrian_patients', JSON.stringify(patients));
    localStorage.setItem('antrian_ranap_queue', JSON.stringify(ranapQueue));
    localStorage.setItem('antrian_call_logs', JSON.stringify(callLogs));

    // CRITICAL FIX: Do NOT broadcast to backend if we haven't completed initial hydration or if no local user mutation occurred!
    if (!isHydratedRef.current) {
      return;
    }

    if (isRemoteSyncRef.current) {
      return;
    }

    if (!hasLocalMutationRef.current) {
      return;
    }

    hasLocalMutationRef.current = false;

    if (broadcastDebounceTimerRef.current) {
      clearTimeout(broadcastDebounceTimerRef.current);
    }

    broadcastDebounceTimerRef.current = setTimeout(() => {
      broadcastDebounceTimerRef.current = null;

      const localPatientTombstones = Array.from(getLocalTombstones());
      const combinedDeletedP = Array.from(new Set([...deletedPatientIdsRef.current, ...localPatientTombstones]));
      const deletedP = combinedDeletedP.length > 0 ? combinedDeletedP : undefined;

      const localBoxTombstones = Array.from(getLocalBoxTombstones());
      const combinedDeletedB = Array.from(new Set([...deletedBoxIdsRef.current, ...localBoxTombstones]));
      const deletedB = combinedDeletedB.length > 0 ? combinedDeletedB : undefined;

      const localRanapTombstones = Array.from(getLocalRanapTombstones());
      const combinedDeletedR = Array.from(new Set([...deletedRanapIdsRef.current, ...localRanapTombstones]));
      const deletedR = combinedDeletedR.length > 0 ? combinedDeletedR : undefined;

      deletedPatientIdsRef.current = [];
      deletedBoxIdsRef.current = [];
      deletedRanapIdsRef.current = [];

      realtimeSync.broadcastState({
        boxes,
        patients,
        ranapQueue,
        callLogs,
        notifications,
        currentCallingPatient,
        currentCallingBox,
        boxOrderUpdatedAt: boxOrderUpdatedAtRef.current || undefined,
        isExplicitReset: false,
        resetConfirmed: false,
        deletedPatientIds: deletedP,
        deletedBoxIds: deletedB,
        deletedRanapIds: deletedR,
      });
    }, 250);
  }, [boxes, patients, ranapQueue, callLogs, notifications, currentCallingPatient, currentCallingBox]);

  // Antrean Ranap Handlers
  const handleOpenAddRanap = (category: RanapCategory = 'fisio') => {
    setAddRanapDefaultCategory(category);
    setIsAddRanapPatientOpen(true);
  };

  const handleAddRanapPatient = (data: Omit<RanapQueueItem, 'id' | 'createdAt'>) => {
    const newRanapItem: RanapQueueItem = {
      ...data,
      id: `ranap-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      createdAt: new Date().toISOString(),
    };
    hasLocalMutationRef.current = true;
    setRanapQueue(prev => {
      const updated = [...prev, newRanapItem].sort((a, b) => compareRoomNumbers(a.roomNumber, b.roomNumber));
      try {
        localStorage.setItem('antrian_ranap_queue', JSON.stringify(updated));
      } catch {}
      return updated;
    });
    showAppToast(`Pasien ${newRanapItem.patientName} berhasil ditambahkan ke antrean ranap (Ruang ${newRanapItem.roomNumber})`);
  };

  const handleCompleteRanapPatient = async (id: string) => {
    const target = ranapQueue.find(r => r.id === id);
    if (!target) return;

    const completedHistoryItem: RanapHistoryItem = {
      ...target,
      completedAt: new Date().toISOString(),
    };

    // Save to permanent history backend API
    databaseService.saveRanapHistoryItem(completedHistoryItem).catch(err => {
      console.warn('Failed to save completed ranap history:', err);
    });

    // Remove from active queue
    addLocalRanapTombstone(id);
    deletedRanapIdsRef.current.push(id);
    hasLocalMutationRef.current = true;
    setRanapQueue(prev => {
      const updated = prev.filter(r => r.id !== id);
      try {
        localStorage.setItem('antrian_ranap_queue', JSON.stringify(updated));
      } catch {}
      return updated;
    });

    confetti({
      particleCount: 40,
      spread: 60,
      origin: { y: 0.8 }
    });
    showAppToast(`Tindakan Ranap ${target.patientName} (Ruang ${target.roomNumber}) selesai & tersimpan di Riwayat.`);
  };

  const handleDeleteRanapPatient = (id: string) => {
    addLocalRanapTombstone(id);
    deletedRanapIdsRef.current.push(id);
    hasLocalMutationRef.current = true;
    setRanapQueue(prev => {
      const updated = prev.filter(r => r.id !== id);
      try {
        localStorage.setItem('antrian_ranap_queue', JSON.stringify(updated));
      } catch {}
      return updated;
    });
    showAppToast('Antrean ranap berhasil dihapus.');
  };

  // Handle Calling a Patient
  const handleCallPatient = (patient: PatientItem, box: QueueBox) => {
    hasLocalMutationRef.current = true;
    const callTimestamp = new Date().toISOString();
    const updatedPatient: PatientItem = {
      ...patient,
      calledCount: patient.calledCount + 1,
      lastCalledAt: callTimestamp
    };

    setCurrentCallingPatient(updatedPatient);
    setCurrentCallingBox(box);

    // Update patient list with updated patient item
    setPatients(prev => prev.map(p => p.id === patient.id ? updatedPatient : p));

    // Record Call Log with safe collision-proof ID
    const newLog: CallHistoryRecord = {
      id: generateUniqueId('log'),
      boxId: box.id,
      boxTitle: box.title.split('(')[0].trim(),
      patientId: patient.id,
      queueNumber: patient.queueNumber,
      patientName: patient.patientName,
      medicalRecordNo: patient.medicalRecordNo,
      calledAt: callTimestamp,
      officerName: box.officerName,
      status: patient.calledCount > 0 ? 'recalled' : 'called',
      notes: `Dipanggil oleh ${box.officerName}`
    };

    setCallLogs(prev => [newLog, ...prev]);

    // Record last announced call
    lastAnnouncedCallRef.current = `${updatedPatient.id}_${callTimestamp}`;

    // Clear unread flag on box
    setBoxes(prev => prev.map(b => b.id === box.id ? { ...b, hasUnreadNewInput: false } : b));
  };

  // Call Next Patient in a specific Box (chronologically earliest active patient)
  const handleCallNextInBox = (box: QueueBox) => {
    const boxActivePatients = [...patients.filter(p => p.boxId === box.id && !p.completed)].sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeA - timeB;
    });
    if (boxActivePatients.length > 0) {
      handleCallPatient(boxActivePatients[0], box);
    }
  };

  // Toggle Checkbox / Completed Status
  const handleToggleCompletePatient = (patientId: string) => {
    hasLocalMutationRef.current = true;
    const target = patients.find(p => p.id === patientId);
    if (!target) return;

    const willBeCompleted = !target.completed;

    setPatients(prev => prev.map(p => {
      if (p.id === patientId) {
        return {
          ...p,
          completed: willBeCompleted,
          completedAt: willBeCompleted ? new Date().toISOString() : undefined
        };
      }
      return p;
    }));

    // Proactively sync completion status to daily archive & update MasterPatient visit history
    const targetBoxForArchive = boxes.find(b => b.id === target.boxId);
    const todayWIB = getLocalDateStringWIB();
    
    databaseService.saveDailyVisit(todayWIB, {
      id: target.id,
      visitDate: todayWIB,
      patientId: target.patientId || target.id,
      medicalRecordNo: target.medicalRecordNo,
      patientName: target.patientName,
      boxId: target.boxId,
      boxTitle: target.boxTitle || (targetBoxForArchive ? targetBoxForArchive.title : target.boxId),
      officerName: target.officerName || (targetBoxForArchive ? targetBoxForArchive.officerName : ''),
      category: target.category || (targetBoxForArchive ? targetBoxForArchive.category : 'fisio'),
      firstOfficerName: target.firstOfficerName,
      firstBoxTitle: target.firstBoxTitle,
      queueNumber: target.queueNumber || '',
      actionCode: target.actionCode || '',
      diagnosis: target.diagnosis || '',
      isWarning: !!target.isWarning,
      isRanap: !!target.isRanap,
      note: target.note || '',
      phoneNumber: target.phoneNumber || '',
      completed: willBeCompleted,
      registeredAt: target.createdAt,
      calledAt: target.lastCalledAt || null,
      completedAt: willBeCompleted ? new Date().toISOString() : null,
      calledCount: target.calledCount || 0,
    }).catch(err => console.warn('Proactive completion daily visit save error:', err));

    if (willBeCompleted) {
      // Update MasterPatient record with this completed visit entry
      try {
        const localMaster = localStorage.getItem('irm_master_patients');
        let masterList: MasterPatient[] = localMaster ? JSON.parse(localMaster) : [];
        const existingMaster = masterList.find(
          mp => mp.medicalRecordNo.toLowerCase() === target.medicalRecordNo.toLowerCase()
        );

        const targetBoxCategory = targetBoxForArchive 
          ? getTherapistCategory(targetBoxForArchive.officerName, targetBoxForArchive.location, targetBoxForArchive.category)
          : 'fisio';

        const existingDisciplineCounts = existingMaster?.disciplineVisitCounts || {};
        const currentDisciplineCount = (existingDisciplineCounts[targetBoxCategory] || 0) + 1;
        const updatedDisciplineCounts = {
          ...existingDisciplineCounts,
          [targetBoxCategory]: currentDisciplineCount,
        };

        const existingFirstTherapists = existingMaster?.firstTherapists || {};
        const currentFirstForDiscipline = existingFirstTherapists[targetBoxCategory] || (
          targetBoxForArchive?.officerName ? {
            officerName: targetBoxForArchive.officerName,
            boxId: target.boxId,
            boxTitle: targetBoxForArchive.title.split('(')[0].trim(),
            firstVisitDate: todayWIB,
          } : undefined
        );

        const updatedFirstTherapists = {
          ...existingFirstTherapists,
          ...(currentFirstForDiscipline ? { [targetBoxCategory]: currentFirstForDiscipline } : {}),
        };

        const newVisitHistoryItem: PatientVisitHistoryItem = {
          visitNo: (existingMaster?.visitHistory?.length || 0) + 1,
          disciplineVisitNo: currentDisciplineCount,
          category: targetBoxCategory,
          date: todayWIB,
          boxId: target.boxId,
          boxTitle: targetBoxForArchive ? targetBoxForArchive.title.split('(')[0].trim() : target.boxId,
          officerName: targetBoxForArchive ? targetBoxForArchive.officerName : '',
          actionCode: target.actionCode,
          diagnosis: target.diagnosis,
          notes: target.note,
          completedAt: new Date().toISOString(),
        };

        const updatedHistory = [...(existingMaster?.visitHistory || []), newVisitHistoryItem];
        const firstOfficer = existingMaster?.firstOfficerName || targetBoxForArchive?.officerName || '';
        const firstBox = existingMaster?.firstBoxId || target.boxId || '';
        const firstDate = existingMaster?.firstVisitDate || todayWIB;

        databaseService.saveMasterPatient({
          id: existingMaster?.id || target.patientId,
          medicalRecordNo: target.medicalRecordNo,
          patientName: target.patientName,
          defaultDiagnosis: target.diagnosis || existingMaster?.defaultDiagnosis,
          defaultActionCode: target.actionCode || existingMaster?.defaultActionCode,
          lastBoxId: target.boxId,
          lastOfficerName: targetBoxForArchive?.officerName,
          firstOfficerName: firstOfficer,
          firstBoxId: firstBox,
          firstVisitDate: firstDate,
          firstTherapists: updatedFirstTherapists,
          disciplineVisitCounts: updatedDisciplineCounts,
          visitHistory: updatedHistory,
          totalVisits: updatedHistory.length,
          visitCount: updatedHistory.length,
        }).catch(err => console.warn('Master patient history save error:', err));
      } catch (err) {
        console.warn('Error archiving visit to Master Patient:', err);
      }

      // Play completion chime
      if (soundEnabled) playChimeSound('success');

      // Trigger light confetti effect
      confetti({
        particleCount: 25,
        spread: 60,
        origin: { y: 0.8 },
        colors: ['#10b981', '#06b6d4', '#3b82f6']
      });

      // Log completion
      const targetBox = boxes.find(b => b.id === target.boxId);
      if (targetBox) {
        const compLog: CallHistoryRecord = {
          id: generateUniqueId('log-comp'),
          boxId: targetBox.id,
          boxTitle: targetBox.title.split('(')[0].trim(),
          patientId: target.id,
          queueNumber: target.queueNumber,
          patientName: target.patientName,
          medicalRecordNo: target.medicalRecordNo,
          calledAt: new Date().toISOString(),
          officerName: targetBox.officerName,
          status: 'completed',
          notes: 'Dicentang Selesai'
        };
        setCallLogs(prev => [compLog, ...prev]);
      }

      // Auto-copy Pasien Ranap (isRanap = true) to ANTRIAN JEMPUTAN RANAP (box-jemputan)
      if (target.isRanap && target.boxId !== 'box-jemputan') {
        const jemputanBox = boxes.find(b => b.id === 'box-jemputan');
        const targetBox = boxes.find(b => b.id === target.boxId);
        const originTitle = targetBox ? targetBox.title.split('(')[0].trim() : 'Poliklinik';

        // Check if patient is not already active in jemputan box
        const alreadyInJemputan = patients.some(
          p => p.boxId === 'box-jemputan' && p.medicalRecordNo === target.medicalRecordNo && !p.completed
        );

        if (!alreadyInJemputan) {
          const durationMinutes = getJemputanActionDurationMinutes(target.actionCode);
          const jemputanPatient: PatientItem = {
            id: generateUniqueId('pat-jemputan'),
            boxId: 'box-jemputan',
            queueNumber: target.queueNumber,
            patientName: target.patientName,
            medicalRecordNo: target.medicalRecordNo,
            actionCode: target.actionCode ? `${target.actionCode}` : `JEMPUTAN (${originTitle})`,
            diagnosis: target.diagnosis,
            isWarning: target.isWarning,
            isRanap: true,
            isReady: true,
            note: `Selesai tindakan di ${originTitle}. Mohon penjemputan pasien. ${target.note || ''}`.trim(),
            completed: false,
            createdAt: new Date().toISOString(),
            enteredJemputanAt: new Date().toISOString(),
            jemputanDurationMinutes: durationMinutes,
            calledCount: 0,
          };

          setPatients(prev => [jemputanPatient, ...prev.filter(p => p.id !== jemputanPatient.id)]);

          // Set unread flag on box-jemputan
          setBoxes(prev => prev.map(b => b.id === 'box-jemputan' ? { ...b, hasUnreadNewInput: true } : b));

          // Notification
          const jemputanNotif: AppNotification = {
            id: generateUniqueId('notif-jemputan'),
            boxId: 'box-jemputan',
            boxTitle: jemputanBox ? jemputanBox.title : 'ANTRIAN JEMPUTAN RANAP',
            patientName: target.patientName,
            queueNumber: target.queueNumber,
            timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
            isRead: false
          };
          setNotifications(prev => [jemputanNotif, ...prev]);
          setUnreadCount(prev => prev + 1);
        }
      }
    }
  };

  // Clear Unread Status of a Box
  const handleClearBoxUnread = (boxId: string) => {
    hasLocalMutationRef.current = true;
    setBoxes(prev => prev.map(b => b.id === boxId ? { ...b, hasUnreadNewInput: false } : b));
  };

  // Add New Patient Input
  const handleAddPatient = (patientData: Omit<PatientItem, 'id' | 'createdAt' | 'calledCount' | 'completed'>) => {
    hasLocalMutationRef.current = true;
    const isTargetJemputan = 
      patientData.boxId === 'box-jemputan' || 
      patientData.boxId.toLowerCase().includes('jemputan');

    const durationMinutes = isTargetJemputan 
      ? (patientData.jemputanDurationMinutes || getJemputanActionDurationMinutes(patientData.actionCode))
      : patientData.jemputanDurationMinutes;

    const enteredJemputanAt = isTargetJemputan
      ? (patientData.enteredJemputanAt || new Date().toISOString())
      : patientData.enteredJemputanAt;

    const targetBox = boxes.find(b => b.id === patientData.boxId);
    const targetCategory = targetBox 
      ? getTherapistCategory(targetBox.officerName, targetBox.location, targetBox.category)
      : 'fisio';
    
    // Check master patient record for first therapist & visit count per discipline
    let firstOfficer = patientData.firstOfficerName;
    let firstBoxTitle = patientData.firstBoxTitle;
    let firstDate = patientData.firstVisitDate;
    let visitCount = patientData.visitCount;
    let disciplineVisitCount = patientData.disciplineVisitCount;
    let patientFirstTherapists = patientData.firstTherapists;
    let patientDisciplineCounts = patientData.disciplineVisitCounts;

    try {
      const localMaster = localStorage.getItem('irm_master_patients');
      if (localMaster) {
        const list: MasterPatient[] = JSON.parse(localMaster);
        const found = list.find(mp => mp.medicalRecordNo.toLowerCase() === (patientData.medicalRecordNo || '').toLowerCase());
        if (found) {
          patientFirstTherapists = found.firstTherapists || patientFirstTherapists;
          patientDisciplineCounts = found.disciplineVisitCounts || patientDisciplineCounts;

          // Check if there is already a 1st therapist for this specific discipline (FT / OT / TW)
          const disciplineFirst = found.firstTherapists?.[targetCategory];
          if (disciplineFirst) {
            firstOfficer = disciplineFirst.officerName;
            firstBoxTitle = disciplineFirst.boxTitle || (disciplineFirst.boxId ? (boxes.find(b => b.id === disciplineFirst.boxId)?.title || disciplineFirst.boxId) : undefined);
            firstDate = disciplineFirst.firstVisitDate;
          } else {
            // Fallback to legacy global first officer if category matches or no discipline specific exists yet
            firstOfficer = found.firstOfficerName || found.lastOfficerName || targetBox?.officerName;
            firstBoxTitle = found.firstBoxId ? (boxes.find(b => b.id === found.firstBoxId)?.title || found.firstBoxId) : (targetBox?.title);
            firstDate = found.firstVisitDate || found.registeredDate;
          }

          disciplineVisitCount = (found.disciplineVisitCounts?.[targetCategory] || 0) + 1;
          visitCount = (found.visitCount || found.totalVisits || 0) + 1;
        }
      }
    } catch {}

    if (!firstOfficer && targetBox) {
      firstOfficer = targetBox.officerName;
      firstBoxTitle = targetBox.title;
      firstDate = getLocalDateStringWIB();
      visitCount = 1;
      disciplineVisitCount = 1;
    }

    const newPatient: PatientItem = {
      ...patientData,
      id: generateUniqueId('pat'),
      boxTitle: targetBox ? targetBox.title : patientData.boxId,
      officerName: targetBox ? targetBox.officerName : '',
      category: targetCategory,
      firstOfficerName: firstOfficer,
      firstBoxTitle: firstBoxTitle,
      firstVisitDate: firstDate,
      firstTherapists: patientFirstTherapists,
      disciplineVisitCounts: patientDisciplineCounts,
      disciplineVisitCount: disciplineVisitCount || 1,
      visitCount: visitCount || 1,
      isReady: patientData.isReady !== undefined ? patientData.isReady : true,
      completed: false,
      createdAt: new Date().toISOString(),
      enteredJemputanAt,
      jemputanDurationMinutes: durationMinutes,
      calledCount: 0,
    };

    knownPatientIdsRef.current.add(newPatient.id);

    // Append new patient at the bottom of the queue
    setPatients(prev => [...prev.filter(p => p.id !== newPatient.id), newPatient]);

    // Sound notification alert on new input
    if (soundEnabled) {
      playChimeSound('new-patient');
    }

    // Mark target box as having unread new input
    setBoxes(prev => prev.map(b => b.id === patientData.boxId ? { ...b, hasUnreadNewInput: true } : b));

    // Push notification toast
    // Proactively persist visit in daily archive
    databaseService.saveDailyVisit(getLocalDateStringWIB(), {
      id: newPatient.id,
      visitDate: getLocalDateStringWIB(),
      patientId: newPatient.patientId || newPatient.id,
      medicalRecordNo: newPatient.medicalRecordNo,
      patientName: newPatient.patientName,
      boxId: newPatient.boxId,
      boxTitle: targetBox ? targetBox.title : newPatient.boxId,
      officerName: targetBox ? targetBox.officerName : '',
      queueNumber: newPatient.queueNumber || '',
      actionCode: newPatient.actionCode || '',
      diagnosis: newPatient.diagnosis || '',
      isWarning: !!newPatient.isWarning,
      isRanap: !!newPatient.isRanap,
      note: newPatient.note || '',
      phoneNumber: newPatient.phoneNumber || '',
      completed: false,
      registeredAt: newPatient.createdAt,
      calledAt: null,
      completedAt: null,
      calledCount: 0,
    }).catch(err => console.warn('Proactive daily visit save error:', err));

    const newNotif: AppNotification = {
      id: generateUniqueId('notif'),
      boxId: patientData.boxId,
      boxTitle: targetBox ? targetBox.title : 'Kotak Antrian',
      officerName: targetBox ? targetBox.officerName : '',
      patientName: patientData.patientName,
      queueNumber: patientData.queueNumber,
      medicalRecordNo: patientData.medicalRecordNo,
      actionCode: patientData.actionCode,
      isRanap: patientData.isRanap,
      isWarning: patientData.isWarning,
      timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB',
      createdAt: newPatient.createdAt,
      isRead: false
    };

    setNotifications(prev => [newNotif, ...prev]);
    setUnreadCount(prev => prev + 1);
  };

  // Add New Box
  const handleAddBox = (boxData: Omit<QueueBox, 'id' | 'createdAt'>) => {
    // Cegah bikin kotak duplikat untuk terapis yang sama - kalau dibiarkan,
    // kotak baru ini akan langsung "hilang lagi" di sinkronisasi berikutnya
    // karena dianggap kembar dari kotak yang sudah ada (lihat langkah dedup
    // di normalizeAndMergeBoxes).
    const newKey = getCanonicalTherapistKey(boxData.officerName, boxData.location, '');
    const collidesWith = boxes.find(b => getCanonicalTherapistKey(b.officerName, b.location, b.id) === newKey);
    if (collidesWith) {
      showAppToast(`Kotak untuk "${boxData.officerName}" sudah ada ("${collidesWith.title}"). Edit kotak yang sudah ada itu, jangan buat baru.`);
      return;
    }

    hasLocalMutationRef.current = true;
    const determinedCategory = boxData.category || getTherapistCategory(boxData.officerName, boxData.location) || 'fisio';
    const now = new Date().toISOString();
    const newBox: QueueBox = {
      ...boxData,
      category: determinedCategory,
      id: generateUniqueId('box'),
      createdAt: now,
      contentUpdatedAt: now,
    };
    setBoxes(prev => [...prev, newBox]);
    showAppToast(`Kotak antrean "${newBox.title}" berhasil ditambahkan.`);
  };

  // Toggle Box Pin
  const handleTogglePin = (boxId: string) => {
    hasLocalMutationRef.current = true;
    setBoxes(prev => prev.map(b => b.id === boxId ? { ...b, isPinned: !b.isPinned } : b));
  };

  // Update Box Color Theme
  const handleUpdateBoxColor = (boxId: string, color: BoxColor) => {
    hasLocalMutationRef.current = true;
    const stampedAt = new Date().toISOString();
    setBoxes(prev => prev.map(b => b.id === boxId ? { ...b, color, contentUpdatedAt: stampedAt } : b));
  };

  // Update Box Instruction Image
  const handleUpdateBoxImage = (boxId: string, imageUrl: string) => {
    hasLocalMutationRef.current = true;
    const stampedAt = new Date().toISOString();
    setBoxes(prev => prev.map(b => b.id === boxId ? {
      ...b,
      instructionImageUrl: imageUrl || undefined,
      instructionImageUrls: imageUrl ? [imageUrl] : [],
      contentUpdatedAt: stampedAt
    } : b));
  };

  // Update Box Instruction Images (Multi-image collage support)
  const handleUpdateBoxImages = (boxId: string, imageUrls: string[]) => {
    hasLocalMutationRef.current = true;
    const cleanUrls = imageUrls.filter(u => typeof u === 'string' && u.trim().length > 0);
    const stampedAt = new Date().toISOString();
    setBoxes(prev => prev.map(b => b.id === boxId ? {
      ...b,
      instructionImageUrls: cleanUrls,
      instructionImageUrl: cleanUrls[0] || undefined,
      contentUpdatedAt: stampedAt
    } : b));
  };

  // Delete Box with safe patient transfer & system box protection
  const handleDeleteBox = (boxId: string, transferTargetBoxId?: string) => {
    const targetBox = boxes.find(b => b.id === boxId);
    if (!targetBox) return;

    if (boxId === 'box-peralihan-siang' || (targetBox.title || '').toUpperCase().includes('PERALIHAN SIANG')) {
      showAppToast('Kotak PERALIHAN SIANG adalah modul sistem utama dan tidak dapat dihapus.');
      return;
    }

    hasLocalMutationRef.current = true;
    addLocalBoxTombstone(boxId);
    deletedBoxIdsRef.current.push(boxId);

    // If transferTargetBoxId is provided, transfer active patients to target box
    if (transferTargetBoxId) {
      const nowTime = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
      setPatients(prev => prev.map(p => {
        if (p.boxId === boxId && !p.completed) {
          return {
            ...p,
            boxId: transferTargetBoxId,
            history: [
              ...(p.history || []),
              {
                boxId: transferTargetBoxId,
                timestamp: nowTime,
                calledAt: undefined,
              }
            ]
          };
        }
        return p;
      }).filter(p => p.boxId !== boxId));

      const targetDestBox = boxes.find(b => b.id === transferTargetBoxId);
      showAppToast(`Kotak "${targetBox.title}" berhasil dihapus. Pasien aktif dialihkan ke "${targetDestBox?.title || 'kotak tujuan'}".`);
    } else {
      setPatients(prev => prev.filter(p => p.boxId !== boxId));
      showAppToast(`Kotak "${targetBox.title}" dan seluruh antreannya berhasil dihapus.`);
    }

    setBoxes(prev => prev.filter(b => b.id !== boxId));
    if (selectedTherapistBoxId === boxId) {
      setSelectedTherapistBoxId(null);
    }
  };

  // Delete Patient
  const handleDeletePatient = (patientId: string) => {
    hasLocalMutationRef.current = true;
    addLocalTombstone(patientId);
    deletedPatientIdsRef.current.push(patientId);
    setPatients(prev => prev.filter(p => p.id !== patientId));
  };

  // Update Patient Details
  const handleUpdatePatient = (updatedPatient: PatientItem) => {
    hasLocalMutationRef.current = true;
    setPatients(prev => prev.map(p => p.id === updatedPatient.id ? updatedPatient : p));
  };

  // Transfer active patients from a source box to Kotak PERALIHAN SIANG
  const handleTransferToPeralihanSiang = (
    sourceBoxId: string, 
    selectedPatientIds?: string[],
    patientConfigs?: Record<string, { 
      isLepas: boolean; 
      kurangTindakan: number; 
      kurangTindakanKode?: string;
      crossedActionCodes?: string[];
    }>
  ) => {
    hasLocalMutationRef.current = true;
    
    // Find or create Kotak PERALIHAN SIANG
    let targetBox = boxes.find(
      b => b.id === 'box-peralihan-siang' || b.title.toUpperCase().includes('PERALIHAN SIANG')
    );

    let updatedBoxes = [...boxes];
    if (!targetBox) {
      targetBox = {
        id: 'box-peralihan-siang',
        title: 'PERALIHAN SIANG',
        officerName: 'Petugas Shift Siang',
        location: 'Instalasi Rehabilitasi Medis',
        category: 'fisio',
        color: 'orange',
        isPinned: true,
        instructionText: 'Kotak antrean peralihan pasien shift siang IRM RSPP.',
        createdAt: new Date().toISOString(),
        hasUnreadNewInput: true
      };
      updatedBoxes = [targetBox, ...updatedBoxes];
      setBoxes(updatedBoxes);
    } else {
      setBoxes(prev => prev.map(b => b.id === targetBox!.id ? { ...b, hasUnreadNewInput: true } : b));
    }

    const sourceBox = boxes.find(b => b.id === sourceBoxId);
    const sourceTitle = sourceBox ? sourceBox.title.split('(')[0].trim() : 'Kotak Asal';

    // Move matching active patients to targetBox, retaining origin box info
    let movedCount = 0;
    setPatients(prev => prev.map(p => {
      const isTarget = p.boxId === sourceBoxId && !p.completed && (
        selectedPatientIds ? selectedPatientIds.includes(p.id) : true
      );
      if (isTarget) {
        movedCount++;
        const customCfg = patientConfigs ? patientConfigs[p.id] : undefined;
        const isLepas = customCfg ? customCfg.isLepas : (p.isLepas ?? false);

        const tokens = getActionTokensOrFallback(p.actionCode);
        const crossedActionCodes = isLepas ? [] : (customCfg?.crossedActionCodes ?? (p.crossedActionCodes || []));
        const remainingTokens = getRemainingActionTokens(tokens, crossedActionCodes);
        const autoKurangTindakanKode = remainingTokens.length > 0 ? remainingTokens.join('.') : undefined;
        const autoKurangCount = remainingTokens.length > 0 ? remainingTokens.length : (p.kurangTindakan ?? 2);

        const kurangTindakan = isLepas ? undefined : (customCfg?.kurangTindakan ?? p.kurangTindakan ?? autoKurangCount);
        const kurangTindakanKode = isLepas ? undefined : (customCfg?.kurangTindakanKode ?? p.kurangTindakanKode ?? autoKurangTindakanKode);

        return {
          ...p,
          boxId: targetBox!.id,
          originBoxId: p.originBoxId || sourceBoxId,
          originBoxTitle: p.originBoxTitle || sourceTitle,
          isLepas,
          kurangTindakan,
          kurangTindakanKode,
          crossedActionCodes,
          peralihanStatus: isLepas ? 'lepas' : 'kurang',
          note: p.note ? `${p.note} (Peralihan dari ${sourceTitle})` : `Peralihan Siang dari ${sourceTitle}`
        };
      }
      return p;
    }));

    // Add Notification
    const transferNotif: AppNotification = {
      id: generateUniqueId('notif-peralihan'),
      boxId: targetBox.id,
      boxTitle: targetBox.title,
      officerName: targetBox.officerName,
      patientName: `${movedCount} Pasien dialihkan dari ${sourceTitle}`,
      queueNumber: 'SHIFT SIANG',
      timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB',
      isRead: false
    };
    setNotifications(prev => [transferNotif, ...prev]);
    setUnreadCount(prev => prev + 1);
  };

  // Transfer patients back from Kotak PERALIHAN SIANG to their origin / target boxes
  const handleTransferBackFromPeralihanSiang = (updatedPatientsList: PatientItem[]) => {
    hasLocalMutationRef.current = true;

    // Update state with modified patients list
    setPatients(prev => {
      const updatedMap = new Map(updatedPatientsList.map(p => [p.id, p]));
      return prev.map(p => updatedMap.has(p.id) ? updatedMap.get(p.id)! : p);
    });

    const returnedCount = updatedPatientsList.filter(
      p => !p.isLepas && p.boxId !== 'box-peralihan-siang' && !p.boxId.includes('peralihan')
    ).length;
    const stayedCount = updatedPatientsList.filter(
      p => p.isLepas || p.boxId === 'box-peralihan-siang' || p.boxId.includes('peralihan')
    ).length;

    if (soundEnabled) {
      playChimeSound('success');
    }

    confetti({
      particleCount: 45,
      spread: 75,
      origin: { y: 0.7 },
      colors: ['#0d9488', '#0284c7', '#10b981', '#f59e0b']
    });

    const returnNotif: AppNotification = {
      id: generateUniqueId('notif-kembali-peralihan'),
      boxId: 'box-peralihan-siang',
      boxTitle: 'PERALIHAN SIANG',
      officerName: 'Petugas Shift Siang',
      patientName: `${returnedCount} Pasien (Kurang Tindakan) dialihkan kembali ke kotak semula. ${stayedCount} Pasien (Lepas) tetap di Peralihan Siang.`,
      queueNumber: 'PENGALIHAN BALIK',
      timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB',
      isRead: false
    };
    setNotifications(prev => [returnNotif, ...prev]);
    setUnreadCount(prev => prev + 1);
  };

  // Reset/Clear All Queue Data & History
  const handleResetAllData = () => {
    setIsResetConfirmOpen(true);
  };

  // Clear / Empty patients from a specific queue box without deleting the box
  const handleClearBoxPatients = (boxId: string) => {
    const targetBox = boxes.find(b => b.id === boxId);
    const boxPatients = patients.filter(p => p.boxId === boxId);
    if (boxPatients.length === 0) {
      showAppToast(`Kotak "${targetBox?.title || boxId}" sudah bersih (0 pasien).`);
      return;
    }

    const patientIdsToClear = boxPatients.map(p => p.id);
    hasLocalMutationRef.current = true;
    patientIdsToClear.forEach(id => {
      addLocalTombstone(id);
      deletedPatientIdsRef.current.push(id);
    });

    const remainingPatients = patients.filter(p => p.boxId !== boxId);
    // 1. Immediately update local patients state
    setPatients(remainingPatients);

    let nextCallingPatient = currentCallingPatient;
    let nextCallingBox = currentCallingBox;
    if (currentCallingPatient && currentCallingPatient.boxId === boxId) {
      nextCallingPatient = null;
      nextCallingBox = null;
      setCurrentCallingPatient(null);
      setCurrentCallingBox(null);
    }

    // 2. Broadcast immediately to all connected devices via SSE and BroadcastChannel
    realtimeSync.broadcastState({
      boxes,
      patients: remainingPatients,
      ranapQueue,
      callLogs,
      notifications,
      currentCallingPatient: nextCallingPatient,
      currentCallingBox: nextCallingBox,
      boxOrderUpdatedAt: boxOrderUpdatedAtRef.current || undefined,
      isExplicitReset: false,
      resetConfirmed: false,
      deletedPatientIds: patientIdsToClear,
    }).catch(err => console.warn('Failed to broadcast box patient clear:', err));

    // 3. Archive patients to daily database in background
    const today = getLocalDateStringWIB();
    const currentVisits: DailyPatientVisit[] = boxPatients.map(p => ({
      id: p.id,
      visitDate: today,
      patientId: p.patientId || p.id,
      medicalRecordNo: p.medicalRecordNo,
      patientName: p.patientName,
      boxId: p.boxId,
      boxTitle: p.boxTitle || (targetBox ? targetBox.title : p.boxId),
      officerName: p.officerName || (targetBox ? targetBox.officerName : ''),
      category: p.category || (targetBox ? targetBox.category : 'fisio'),
      firstOfficerName: p.firstOfficerName,
      firstBoxTitle: p.firstBoxTitle,
      queueNumber: p.queueNumber || '',
      actionCode: p.actionCode || '',
      diagnosis: p.diagnosis || '',
      isWarning: !!p.isWarning,
      isRanap: !!p.isRanap,
      note: p.note || '',
      phoneNumber: p.phoneNumber || '',
      completed: !!p.completed,
      registeredAt: p.createdAt || new Date().toISOString(),
      calledAt: p.lastCalledAt || null,
      completedAt: p.completedAt || null,
      calledCount: p.calledCount || 0,
    }));

    // Async batch save to daily archive (non-blocking)
    fetch('/api/daily-database/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: today, visits: currentVisits }),
    }).catch(err => console.warn('Failed to commit daily archive for box clear:', err));

    showAppToast(`Antrean kotak "${targetBox?.title || 'Terapis'}" (${boxPatients.length} pasien) berhasil dibersihkan.`);
  };

  const executeResetAllData = (_officerName: string = 'Petugas IRM') => {
    // Collect all patient IDs being cleared so all peers can reject them explicitly
    const currentPatientIds = patients.map(p => p.id);
    const resetTimestamp = new Date().toISOString();

    // 1. Instantly and synchronously clear local UI state with 0ms delay!
    isRemoteSyncRef.current = true;
    hasLocalMutationRef.current = false;
    knownPatientIdsRef.current.clear();
    deletedPatientIdsRef.current = [...currentPatientIds];
    deletedBoxIdsRef.current = [];

    setPatients([]);
    setCallLogs([]);
    setNotifications([]);
    setUnreadCount(0);
    setCurrentCallingPatient(null);
    setCurrentCallingBox(null);
    setIsResetConfirmOpen(false);

    localStorage.removeItem('antrian_patients');
    localStorage.removeItem('antrian_call_logs');
    try {
      localStorage.setItem('antrian_last_reset_at', resetTimestamp);
    } catch {
      // ignore
    }

    showAppToast('Seluruh antrean kotak berhasil dibersihkan.');

    // 2. Commit all current patients to Daily Archive & Cloud Firestore in background so reports remain intact
    if (patients.length > 0) {
      const today = getLocalDateStringWIB();
      const currentVisits: DailyPatientVisit[] = patients.map(p => {
        const targetBox = boxes.find(b => b.id === p.boxId);
        return {
          id: p.id,
          visitDate: today,
          patientId: p.patientId || p.id,
          medicalRecordNo: p.medicalRecordNo,
          patientName: p.patientName,
          boxId: p.boxId,
          boxTitle: p.boxTitle || (targetBox ? targetBox.title : p.boxId),
          officerName: p.officerName || (targetBox ? targetBox.officerName : ''),
          category: p.category || (targetBox ? targetBox.category : 'fisio'),
          firstOfficerName: p.firstOfficerName,
          firstBoxTitle: p.firstBoxTitle,
          queueNumber: p.queueNumber || '',
          actionCode: p.actionCode || '',
          diagnosis: p.diagnosis || '',
          isWarning: !!p.isWarning,
          isRanap: !!p.isRanap,
          note: p.note || '',
          phoneNumber: p.phoneNumber || '',
          completed: !!p.completed,
          registeredAt: p.createdAt || new Date().toISOString(),
          calledAt: p.lastCalledAt || null,
          completedAt: p.completedAt || null,
          calledCount: p.calledCount || 0,
        };
      });

      // Flush to server daily archive
      fetch('/api/daily-database/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: today, visits: currentVisits }),
      }).catch(err => console.warn('Failed to commit daily archive batch on reset:', err));

      // Flush to Cloud Firestore daily archive
      cloudDatabaseService.getAllDailyArchives().then(archives => {
        const existing = archives[today] || [];
        const map = new Map<string, DailyPatientVisit>();
        existing.forEach(v => { if (v && v.id) map.set(v.id, v); });
        currentVisits.forEach(v => {
          if (v && v.id) {
            const prev = map.get(v.id);
            map.set(v.id, { ...prev, ...v });
          }
        });
        return cloudDatabaseService.saveDailyArchive(today, Array.from(map.values()));
      }).catch(err => console.warn('Failed to save daily archive to cloud on reset:', err));
    }

    // 3. Call server explicit purge endpoint
    fetch('/api/queue/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lastResetAt: resetTimestamp,
        deletedPatientIds: currentPatientIds,
        senderDeviceId: realtimeSync.getDeviceId(),
      }),
    }).catch(err => console.warn('Failed to post reset to /api/queue/reset:', err));

    // 4. Broadcast reset state to BroadcastChannel & Peers
    realtimeSync.broadcastState({
      boxes,
      patients: [],
      ranapQueue,
      callLogs: [],
      notifications: [],
      currentCallingPatient: null,
      currentCallingBox: null,
      isExplicitReset: true,
      resetConfirmed: true,
      lastResetAt: resetTimestamp,
      boxOrderUpdatedAt: boxOrderUpdatedAtRef.current || undefined,
      deletedPatientIds: currentPatientIds,
      lastUpdated: resetTimestamp,
    }).catch(err => console.warn('Failed to broadcast reset state:', err));

    setTimeout(() => {
      isRemoteSyncRef.current = false;
    }, 500);
  };

  // Filtered Boxes and Patients
  const filterPatientMatch = (p: PatientItem, box?: QueueBox) => {
    if (statusFilter === 'active' && p.completed) return false;
    if (statusFilter === 'completed' && !p.completed) return false;
    if (statusFilter === 'warning' && !p.isWarning) return false;

    if (!searchQuery.trim()) return true;
    const q = searchQuery.trim().toLowerCase();

    // Match parent box title, officer name, or location
    if (box) {
      const boxMatches =
        box.title.toLowerCase().includes(q) ||
        box.officerName.toLowerCase().includes(q) ||
        box.location.toLowerCase().includes(q);
      if (boxMatches) return true;
    }

    return (
      p.patientName.toLowerCase().includes(q) ||
      p.medicalRecordNo.toLowerCase().includes(q) ||
      p.queueNumber.toLowerCase().includes(q) ||
      (p.actionCode && p.actionCode.toLowerCase().includes(q)) ||
      (p.diagnosis && p.diagnosis.toLowerCase().includes(q)) ||
      (p.note && p.note.toLowerCase().includes(q))
    );
  };

  const isBoxVisibleInSearch = (box: QueueBox) => {
    if (selectedTherapistBoxId && box.id !== selectedTherapistBoxId) {
      return false;
    }

    if (!searchQuery.trim() && statusFilter === 'all') return true;

    const q = searchQuery.trim().toLowerCase();
    if (q && (
      box.title.toLowerCase().includes(q) ||
      box.officerName.toLowerCase().includes(q) ||
      box.location.toLowerCase().includes(q)
    )) {
      return true;
    }

    const boxPatients = patients.filter(p => p.boxId === box.id);
    return boxPatients.some(p => filterPatientMatch(p, box));
  };

  // Calculate Global Counts & Response Analytics
  const totalActiveCount = patients.filter(p => !p.completed).length;
  const totalCompletedCount = patients.filter(p => p.completed).length;
  const totalWarningCount = patients.filter(p => p.isWarning).length;
  const globalResponseAnalytics = computeResponseTimeAnalytics(patients, boxes);

  const overloadedTherapistsCount = boxes.filter(b => {
    const active = patients.filter(p => p.boxId === b.id && !p.completed);
    return active.length > 5;
  }).length;

  const pinnedBoxes = boxes.filter(b => b.isPinned);
  const otherBoxes = boxes.filter(b => !b.isPinned);

  const visiblePinnedBoxes = pinnedBoxes.filter(isBoxVisibleInSearch);
  const visibleOtherBoxes = otherBoxes.filter(isBoxVisibleInSearch);

  const estimateBoxHeight = (box: QueueBox): number => {
    const boxPatientCount = patients.filter(p => p.boxId === box.id && filterPatientMatch(p, box)).length;
    const baseHeight = 160; // header + footer + empty-state placeholder
    const perPatientHeight = 110;
    const overloadWarningHeight = boxPatientCount > 5 ? 70 : 0;
    return baseHeight + boxPatientCount * perPatientHeight + overloadWarningHeight;
  };

  const distributeIntoColumns = (items: QueueBox[], columnCount: number): QueueBox[][] => {
    const columns: QueueBox[][] = Array.from({ length: columnCount }, () => []);
    const columnHeights: number[] = Array(columnCount).fill(0);
    items.forEach((item) => {
      let shortestColumnIndex = 0;
      for (let i = 1; i < columnCount; i++) {
        if (columnHeights[i] < columnHeights[shortestColumnIndex]) {
          shortestColumnIndex = i;
        }
      }
      columns[shortestColumnIndex].push(item);
      columnHeights[shortestColumnIndex] += estimateBoxHeight(item);
    });
    return columns;
  };
  const hasAnyVisibleBox = visiblePinnedBoxes.length > 0 || visibleOtherBoxes.length > 0;
  const totalMatchingPatients = patients.filter(p => {
    const parentBox = boxes.find(b => b.id === p.boxId);
    return filterPatientMatch(p, parentBox);
  }).length;

  const handleOpenAnalytics = () => {
    setCurrentView('analytics');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectTherapistFocus = (boxId: string | null) => {
    if (currentView !== 'queue') {
      setCurrentView('queue');
    }
    setSelectedTherapistBoxId(boxId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleScrollToBox = (boxId: string) => {
    if (currentView !== 'queue') {
      setCurrentView('queue');
    }
    setSelectedTherapistBoxId(boxId);
    setTimeout(() => {
      const el = document.getElementById(`box-card-${boxId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('ring-4', 'ring-teal-500', 'shadow-2xl');
        setTimeout(() => {
          el.classList.remove('ring-4', 'ring-teal-500', 'shadow-2xl');
        }, 2500);
      }
    }, 100);
  };

  // If app is not authenticated and not in public TV display mode, render Login Gateway
  if (!isAuthenticated && !isTVDisplayOpen) {
    return (
      <>
        <AppLoginGateway
          onLoginSuccess={(officerName) => {
            setIsAuthenticated(true);
            showAppToast(`Selamat bertugas, ${officerName}!`);
          }}
          onOpenTVDisplay={() => setIsTVDisplayOpen(true)}
        />
        {appToastMessage && (
          <div className="fixed bottom-6 right-6 z-60 animate-in slide-in-from-bottom-5">
            <div className="bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-2xl border border-slate-700 text-xs font-bold flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-teal-400 animate-ping" />
              <span>{appToastMessage}</span>
            </div>
          </div>
        )}
      </>
    );
  }

  // If unauthenticated public TV kiosk mode is directly requested
  if (!isAuthenticated && isTVDisplayOpen) {
    return (
      <div className="min-h-screen bg-slate-950 text-white">
        <QueueDisplayModal
          isOpen={true}
          onClose={() => setIsTVDisplayOpen(false)}
          currentCallingPatient={currentCallingPatient}
          currentCallingBox={currentCallingBox}
          boxes={boxes}
          patients={patients}
          callLogs={callLogs}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100/70 to-slate-200/50 text-slate-900 flex flex-col font-sans antialiased selection:bg-teal-500 selection:text-white pb-16 relative">
      {/* Subtle modern ambient background glow for high-tech aesthetic */}
      <div className="fixed top-0 left-1/4 w-96 h-96 bg-teal-200/20 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="fixed bottom-10 right-1/4 w-96 h-96 bg-cyan-200/20 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* Indikator kecil kalau cadangan cloud sedang bermasalah - sengaja dibuat
          diskret (titik kuning berkedip, tanpa teks) supaya tidak bikin heboh
          staf umum; detailnya cuma muncul kalau diketuk. Otomatis hilang begitu
          statusnya pulih (polling tiap 30 detik). */}
      {isCloudBackupDegraded && (
        <div className="fixed top-2.5 right-2.5 z-[9999]">
          <button
            type="button"
            onClick={() => setShowBackupDegradedInfo(prev => !prev)}
            className="w-3.5 h-3.5 rounded-full bg-amber-400 shadow-lg ring-2 ring-amber-300/60 animate-pulse cursor-pointer"
            title="Status sistem"
          />
          {showBackupDegradedInfo && (
            <div className="absolute top-6 right-0 w-60 bg-slate-900 text-white text-[11px] rounded-xl p-3 shadow-2xl border border-slate-700 leading-relaxed">
              <p className="font-bold mb-1">🔄 Sinkronisasi cadangan tersendat</p>
              <p className="text-slate-300">Data tetap aman tersimpan. Sistem sedang mencoba menyambung lagi otomatis. Usahakan minimal 1 perangkat tetap terbuka sampai ini hilang sendiri.</p>
            </div>
          )}
        </div>
      )}

      {/* Therapist Sidebar */}
      <TherapistSidebar
        isOpen={isTherapistSidebarOpen}
        onClose={() => setIsTherapistSidebarOpen(false)}
        boxes={boxes}
        patients={patients}
        ranapQueue={ranapQueue}
        selectedBoxId={selectedTherapistBoxId}
        onSelectBox={(bId) => {
          setSelectedTherapistBoxId(bId);
          if (currentView !== 'queue') setCurrentView('queue');
        }}
        onCallNextInBox={handleCallNextInBox}
        onAddPatientToBox={(bId) => {
          setAddPatientBoxId(bId);
          setIsAddPatientOpen(true);
        }}
        onScrollToBox={handleScrollToBox}
        onOpenDailyDatabase={() => setIsDailyDatabaseOpen(true)}
        onOpenMonthlyReport={() => setIsMonthlyReportOpen(true)}
        onOpenResponseTimeAnalytics={() => setIsResponseTimeModalOpen(true)}
        onOpenIntelligence={handleOpenAnalytics}
        onOpenInventory={() => setIsInventoryOpen(true)}
        onOpenLainLain={(tab) => {
          setLainLainInitialTab(tab || 'kas');
          setIsLainLainOpen(true);
        }}
        onOpenSop={() => setIsSopOpen(true)}
        onOpenRanapQueue={() => setIsRanapQueueOpen(true)}
        avgWaitMinutes={globalResponseAnalytics.avgWaitMinutes}
        overloadCount={overloadedTherapistsCount}
      />

      {/* Top Header */}
      <Header
        boxes={boxes}
        patients={patients}
        notifications={notifications}
        selectedTherapistBoxId={selectedTherapistBoxId}
        onSelectTherapist={(boxId) => {
          setSelectedTherapistBoxId(boxId);
          if (currentView !== 'queue') setCurrentView('queue');
          if (boxId) handleScrollToBox(boxId);
        }}
        onReorderBoxes={handleReorderBoxes}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        onOpenAddPatient={() => {
          setAddPatientBoxId(undefined);
          setIsAddPatientOpen(true);
        }}
        onOpenDailyDatabase={() => setIsDailyDatabaseOpen(true)}
        onOpenAddBox={() => setIsAddBoxOpen(true)}
        onOpenMonthlyReport={() => setIsMonthlyReportOpen(true)}
        onOpenTVDisplay={() => setIsTVDisplayOpen(true)}
        onOpenGeneralQR={() => {
          setQrModalPatient(null);
          setQrModalBox(null);
          setIsQRModalOpen(true);
        }}
        onOpenGlobalHistory={() => {
          setHistoryBox(null);
          setIsHistoryOpen(true);
        }}
        onToggleTherapistSidebar={() => setIsTherapistSidebarOpen(prev => !prev)}
        isTherapistSidebarOpen={isTherapistSidebarOpen}
        therapistsCount={boxes.length}
        unreadNotificationsCount={unreadCount}
        onResetNotifications={() => setUnreadCount(0)}
        onClearAllNotifications={() => {
          hasLocalMutationRef.current = true;
          setNotifications([]);
          setUnreadCount(0);
        }}
        totalActiveCount={totalActiveCount}
        totalCompletedCount={totalCompletedCount}
        totalWarningCount={totalWarningCount}
        currentView={currentView}
        onNavigateView={(view) => setCurrentView(view)}
        overloadCount={overloadedTherapistsCount}
        avgWaitMinutes={globalResponseAnalytics.avgWaitMinutes}
        onOpenIntelligence={handleOpenAnalytics}
        onOpenResponseTimeAnalytics={() => setIsResponseTimeModalOpen(true)}
        onOpenLainLain={(tab) => {
          setLainLainInitialTab(tab || 'kas');
          setIsLainLainOpen(true);
        }}
        onOpenSop={() => setIsSopOpen(true)}
        isRealtimeConnected={isRealtimeConnected}
        onLockApp={handleLockApp}
        onOpenChangePassword={() => setIsChangeAppPasswordOpen(true)}
      />

      {/* Mobile Swipeable Therapist Bar (Visible on mobile/tablet) */}
      <TherapistMobileBar
        boxes={boxes}
        patients={patients}
        selectedBoxId={selectedTherapistBoxId}
        onSelectBox={(bId) => {
          setSelectedTherapistBoxId(bId);
          if (currentView !== 'queue') setCurrentView('queue');
        }}
        onOpenSidebar={() => setIsTherapistSidebarOpen(true)}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl 2xl:max-w-[1800px] w-full mx-auto px-3 sm:px-4 lg:px-8 pt-4 sm:pt-6 space-y-6 sm:space-y-8 pb-20 sm:pb-8">
        {currentView === 'analytics' ? (
          /* SEPARATE PAGE: ANALISIS DAN INTELIJEN BEBAN KERJA TERAPIS */
          <TherapistAnalyticsView
            boxes={boxes}
            patients={patients}
            onSelectTherapistFocus={(boxId) => {
              setSelectedTherapistBoxId(boxId);
              setCurrentView('queue');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onCallNextInBox={handleCallNextInBox}
            onAddPatientToBox={(boxId) => {
              setAddPatientBoxId(boxId);
              setIsAddPatientOpen(true);
            }}
            onBackToQueue={() => setCurrentView('queue')}
          />
        ) : (
          /* QUEUE PAGE: KOTAK ANTREAN PASIEN & TERAPIS */
          <>
            {/* Therapist Focus Filter Banner if selected */}
            {selectedTherapistBoxId && (
              <div className="p-3.5 bg-gradient-to-r from-teal-800 to-slate-900 text-white rounded-xl shadow-xs flex items-center justify-between gap-3 animate-in fade-in">
                <div className="flex items-center gap-2.5 text-xs">
                  <span className="w-2.5 h-2.5 rounded-full bg-teal-400 animate-ping" />
                  <span>
                    Fokus Kotak Terapis:{' '}
                    <strong className="text-teal-200 font-bold text-sm">
                      {boxes.find(b => b.id === selectedTherapistBoxId)?.officerName || 'Terapis'}
                    </strong>{' '}
                    ({boxes.find(b => b.id === selectedTherapistBoxId)?.title.split('(')[0]})
                  </span>
                </div>
                <button
                  onClick={() => setSelectedTherapistBoxId(null)}
                  className="px-3 py-1 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-lg border border-white/20 transition-all cursor-pointer"
                >
                  Tampilkan Semua Kotak Terapis
                </button>
              </div>
            )}

            {/* Active Search & Filter Indicator Bar */}
            {(searchQuery.trim() || statusFilter !== 'all') && (
              <div className="p-3 bg-teal-50 border border-teal-200 text-teal-900 rounded-xl flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold bg-teal-200/80 px-2 py-0.5 rounded-md text-teal-900">🔍 Filter/Pencarian Aktif</span>
                  {searchQuery.trim() && (
                    <span>Kata kunci: <strong className="underline">"{searchQuery.trim()}"</strong></span>
                  )}
                  {statusFilter !== 'all' && (
                    <span className="capitalize">Status: <strong>{statusFilter}</strong></span>
                  )}
                  <span className="text-teal-700 font-semibold">({totalMatchingPatients} pasien ditemukan)</span>
                </div>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setStatusFilter('all');
                  }}
                  className="px-2.5 py-1 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-lg text-xs cursor-pointer transition-colors shrink-0"
                >
                  Reset Filter
                </button>
              </div>
            )}

            {/* PINNED BOXES SECTION */}
            {visiblePinnedBoxes.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
                  <Pin className="w-3.5 h-3.5 text-amber-600 fill-amber-600 rotate-45" />
                  <span>Di-Sematkan (Pinned Counters) ({visiblePinnedBoxes.length})</span>
                </div>

                <div className="flex items-start gap-5">
                  {distributeIntoColumns(visiblePinnedBoxes, boxColumnCount).map((column, columnIndex) => (
                    <div key={columnIndex} className="flex-1 min-w-0 flex flex-col gap-5">
                      {column.map((box) => {
                        const boxPatients = patients.filter(p => p.boxId === box.id && filterPatientMatch(p, box));
                        return (
                          <QueueBoxCard
                            key={box.id}
                            box={box}
                            patients={boxPatients}
                            allBoxes={boxes}
                            isDragDisabled={!!searchQuery.trim() || !!selectedTherapistBoxId || statusFilter !== 'all'}
                            isDragging={draggedBoxId === box.id}
                            isDropTarget={dragOverBoxId === box.id && draggedBoxId !== box.id}
                            onDragStartBox={handleDragStartBox}
                            onDragEndBox={handleDragEndBox}
                            onDragOverBox={handleDragOverBox}
                            onDropBox={handleDropBox}
                            onMoveBoxStep={handleMoveBoxStep}
                            onTogglePin={handleTogglePin}
                            onToggleCompletePatient={handleToggleCompletePatient}
                            onCallPatient={handleCallPatient}
                            onCallNextInBox={handleCallNextInBox}
                            onClearUnread={handleClearBoxUnread}
                            onAddPatientToBox={(bId) => {
                              setAddPatientBoxId(bId);
                              setIsAddPatientOpen(true);
                            }}
                            onViewHistory={(b) => {
                              setHistoryBox(b);
                              setIsHistoryOpen(true);
                            }}
                            onUpdateBoxColor={handleUpdateBoxColor}
                            onUpdateBoxImage={handleUpdateBoxImage}
                            onUpdateBoxImages={handleUpdateBoxImages}
                            onDeleteBox={handleDeleteBox}
                            onClearBoxPatients={handleClearBoxPatients}
                            onDeletePatient={handleDeletePatient}
                            onUpdatePatient={handleUpdatePatient}
                            onEditBox={(b) => setEditingBox(b)}
                            onOpenPatientQR={(p, b) => {
                              setQrModalPatient(p);
                              setQrModalBox(b);
                              setIsQRModalOpen(true);
                            }}
                            onAddPatient={handleAddPatient}
                            onTransferToPeralihanSiang={handleTransferToPeralihanSiang}
                            onTransferBackFromPeralihanSiang={handleTransferBackFromPeralihanSiang}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
              </section>
            )}

        {/* OTHER BOXES SECTION */}
        <section className="space-y-3">
          {visiblePinnedBoxes.length > 0 && visibleOtherBoxes.length > 0 && (
            <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider pt-2 border-t border-slate-200">
              <Sparkles className="w-3.5 h-3.5 text-slate-400" />
              <span>Kotak Antrian Lainnya ({visibleOtherBoxes.length})</span>
            </div>
          )}

          {boxes.length === 0 ? (
            <div className="py-16 text-center bg-white rounded-2xl border border-dashed border-slate-300 p-8 space-y-3">
              <AlertCircle className="w-10 h-10 text-slate-400 mx-auto" />
              <h3 className="text-base font-bold text-slate-700">Belum ada kotak antrian</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Klik "Tambah Kotak" untuk membuat kategori atau ruang penanganan antrian pasien baru.
              </p>
              <button
                onClick={() => setIsAddBoxOpen(true)}
                className="px-4 py-2 bg-blue-600 text-white font-bold text-xs rounded-xl hover:bg-blue-700 cursor-pointer"
              >
                + Buat Kotak Antrian
              </button>
            </div>
          ) : !hasAnyVisibleBox ? (
            <div className="py-16 text-center bg-white rounded-2xl border border-dashed border-slate-300 p-8 space-y-3">
              <AlertCircle className="w-10 h-10 text-amber-500 mx-auto" />
              <h3 className="text-base font-bold text-slate-800">Tidak ada data yang cocok</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Tidak ditemukan pasien atau kotak antrian yang sesuai dengan pencarian <strong className="text-slate-800">"{searchQuery}"</strong> atau filter aktif.
              </p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('all');
                }}
                className="px-4 py-2 bg-teal-600 text-white font-bold text-xs rounded-xl hover:bg-teal-700 cursor-pointer transition-colors shadow-xs"
              >
                Reset Kata Kunci Pencarian
              </button>
            </div>
          ) : (
            <div className="flex items-start gap-5">
              {distributeIntoColumns(visibleOtherBoxes, boxColumnCount).map((column, columnIndex) => (
                <div key={columnIndex} className="flex-1 min-w-0 flex flex-col gap-5">
                  {column.map((box) => {
                    const boxPatients = patients.filter(p => p.boxId === box.id && filterPatientMatch(p, box));
                    return (
                      <QueueBoxCard
                        key={box.id}
                        box={box}
                        patients={boxPatients}
                        allBoxes={boxes}
                        isDragDisabled={!!searchQuery.trim() || !!selectedTherapistBoxId || statusFilter !== 'all'}
                        isDragging={draggedBoxId === box.id}
                        isDropTarget={dragOverBoxId === box.id && draggedBoxId !== box.id}
                        onDragStartBox={handleDragStartBox}
                        onDragEndBox={handleDragEndBox}
                        onDragOverBox={handleDragOverBox}
                        onDropBox={handleDropBox}
                        onMoveBoxStep={handleMoveBoxStep}
                        onTogglePin={handleTogglePin}
                        onToggleCompletePatient={handleToggleCompletePatient}
                        onCallPatient={handleCallPatient}
                        onCallNextInBox={handleCallNextInBox}
                        onClearUnread={handleClearBoxUnread}
                        onAddPatientToBox={(bId) => {
                          setAddPatientBoxId(bId);
                          setIsAddPatientOpen(true);
                        }}
                        onViewHistory={(b) => {
                          setHistoryBox(b);
                          setIsHistoryOpen(true);
                        }}
                        onUpdateBoxColor={handleUpdateBoxColor}
                        onUpdateBoxImage={handleUpdateBoxImage}
                        onUpdateBoxImages={handleUpdateBoxImages}
                        onDeleteBox={handleDeleteBox}
                        onClearBoxPatients={handleClearBoxPatients}
                        onDeletePatient={handleDeletePatient}
                        onUpdatePatient={handleUpdatePatient}
                        onEditBox={(b) => setEditingBox(b)}
                        onOpenPatientQR={(p, b) => {
                          setQrModalPatient(p);
                          setQrModalBox(b);
                          setIsQRModalOpen(true);
                        }}
                        onAddPatient={handleAddPatient}
                        onTransferToPeralihanSiang={handleTransferToPeralihanSiang}
                        onTransferBackFromPeralihanSiang={handleTransferBackFromPeralihanSiang}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </section>
        </>
        )}
      </main>

      {/* High Density Bottom Summary Footer Bar */}
      <footer className="bg-slate-900 text-slate-300 py-2.5 px-4 lg:px-8 border-t border-slate-800 text-xs flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
            <span className="font-extrabold text-white uppercase tracking-wider text-[11px]">Smart IRM RSPP</span>
          </div>
          <div className="text-slate-400 font-semibold border-l border-slate-700 pl-3">
            Total Antrean Selesai Hari Ini: <span className="font-black text-emerald-400">{totalCompletedCount} Pasien</span>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 border-l border-slate-700 pl-3 text-[11px]">
            <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700 font-mono font-bold">A-001 s/d A-050</span>
            <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700 font-mono font-bold">N-01 s/d N-25</span>
          </div>
        </div>

        <div className="flex items-center gap-3 text-slate-400 font-mono text-[11px]">
          <span className="flex items-center gap-1 text-emerald-400 font-semibold bg-emerald-950/60 px-2.5 py-0.5 rounded border border-emerald-800/60">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            Sync Multi-Perangkat Active
          </span>
          <span>Update otomatis: <LiveClockFooter /></span>
        </div>
      </footer>

      {/* MODALS */}
      <AddPatientModal
        isOpen={isAddPatientOpen}
        onClose={() => setIsAddPatientOpen(false)}
        boxes={boxes}
        defaultBoxId={addPatientBoxId}
        onAddPatient={handleAddPatient}
      />

      <RanapQueueModal
        isOpen={isRanapQueueOpen}
        onClose={() => setIsRanapQueueOpen(false)}
        ranapQueue={ranapQueue}
        onOpenAddPatient={(category) => {
          setAddRanapDefaultCategory(category);
          setIsAddRanapPatientOpen(true);
        }}
        onCompletePatient={handleCompleteRanapPatient}
        onDeletePatient={handleDeleteRanapPatient}
        onOpenHistory={() => setIsRanapHistoryOpen(true)}
      />

      <AddRanapPatientModal
        isOpen={isAddRanapPatientOpen}
        onClose={() => setIsAddRanapPatientOpen(false)}
        defaultCategory={addRanapDefaultCategory}
        onAddPatient={handleAddRanapPatient}
      />

      <RanapHistoryModal
        isOpen={isRanapHistoryOpen}
        onClose={() => setIsRanapHistoryOpen(false)}
      />

      <AddBoxModal
        isOpen={isAddBoxOpen}
        onClose={() => setIsAddBoxOpen(false)}
        onAddBox={handleAddBox}
      />

      <EditBoxModal
        isOpen={!!editingBox}
        onClose={() => setEditingBox(null)}
        box={editingBox}
        onUpdateBox={handleUpdateBox}
        onDeleteBox={handleDeleteBox}
      />

      <CallHistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        callLogs={callLogs}
        boxes={boxes}
        selectedBox={historyBox}
        onClearHistory={() => setCallLogs([])}
      />

      <MonthlyReportModal
        isOpen={isMonthlyReportOpen}
        onClose={() => setIsMonthlyReportOpen(false)}
        boxes={boxes}
        patients={patients}
      />

      <QueueDisplayModal
        isOpen={isTVDisplayOpen}
        onClose={() => setIsTVDisplayOpen(false)}
        currentCallingPatient={currentCallingPatient}
        currentCallingBox={currentCallingBox}
        boxes={boxes}
        patients={patients}
        callLogs={callLogs}
      />

      <DailyPatientDatabaseModal
        isOpen={isDailyDatabaseOpen}
        onClose={() => setIsDailyDatabaseOpen(false)}
        boxes={boxes}
        currentPatients={patients}
        onAddPatientToQueue={handleAddPatient}
        onResetAllData={handleResetAllData}
      />

      <PatientQRModal
        isOpen={isQRModalOpen}
        onClose={() => setIsQRModalOpen(false)}
        patient={qrModalPatient}
        box={qrModalBox}
        allBoxes={boxes}
      />

      <ResponseTimeAnalyticsModal
        isOpen={isResponseTimeModalOpen}
        onClose={() => setIsResponseTimeModalOpen(false)}
        boxes={boxes}
        patients={patients}
        callLogs={callLogs}
        onCallPatient={handleCallPatient}
        onSelectBoxFilter={handleSelectTherapistFocus}
      />

      <LainLainModal
        isOpen={isLainLainOpen}
        onClose={() => setIsLainLainOpen(false)}
        boxes={boxes}
        initialTab={lainLainInitialTab}
      />

      <InventoryStockModal
        isOpen={isInventoryOpen}
        onClose={() => setIsInventoryOpen(false)}
        boxes={boxes}
      />

      {/* Mobile More Sheet */}
      <MobileMoreModal
        isOpen={isMobileMoreOpen}
        onClose={() => setIsMobileMoreOpen(false)}
        onOpenDailyDatabase={() => setIsDailyDatabaseOpen(true)}
        onOpenMonthlyReport={() => setIsMonthlyReportOpen(true)}
        onOpenResponseTimeAnalytics={() => setIsResponseTimeModalOpen(true)}
        onOpenIntelligence={handleOpenAnalytics}
        onOpenInventory={() => setIsInventoryOpen(true)}
        onOpenGeneralQR={() => {
          setQrModalPatient(null);
          setQrModalBox(null);
          setIsQRModalOpen(true);
        }}
        onOpenGlobalHistory={() => {
          setHistoryBox(null);
          setIsHistoryOpen(true);
        }}
        onOpenAddBox={() => setIsAddBoxOpen(true)}
        onOpenTVDisplay={() => setIsTVDisplayOpen(true)}
        onOpenLainLain={(tab) => {
          setLainLainInitialTab(tab || 'kas');
          setIsLainLainOpen(true);
        }}
        onOpenSop={() => setIsSopOpen(true)}
        onResetAllData={handleResetAllData}
        onLockApp={handleLockApp}
        onOpenChangePassword={() => setIsChangeAppPasswordOpen(true)}
        isRealtimeConnected={isRealtimeConnected}
        overloadCount={overloadedTherapistsCount}
        avgWaitMinutes={globalResponseAnalytics.avgWaitMinutes}
        totalActiveCount={totalActiveCount}
        totalCompletedCount={totalCompletedCount}
      />

      {/* Standar Operasional Prosedur (SOP) Word Modal */}
      <SopModal
        isOpen={isSopOpen}
        onClose={() => setIsSopOpen(false)}
      />

      {/* Change Master App Password Modal */}
      <ChangeAppPasswordModal
        isOpen={isChangeAppPasswordOpen}
        onClose={() => setIsChangeAppPasswordOpen(false)}
        onSuccessToast={showAppToast}
      />

      {/* Mobile Floating Bottom Navigation Bar */}
      <MobileBottomNav
        boxes={boxes}
        selectedBoxId={selectedTherapistBoxId}
        onSelectTherapist={handleSelectTherapistFocus}
        activeCount={totalActiveCount}
        completedCount={totalCompletedCount}
        therapistsCount={boxes.length}
        onToggleSidebar={() => setIsTherapistSidebarOpen(prev => !prev)}
        onOpenDailyDatabase={() => setIsDailyDatabaseOpen(true)}
        onOpenAddPatient={() => {
          setAddPatientBoxId(undefined);
          setIsAddPatientOpen(true);
        }}
        onOpenTVDisplay={() => setIsTVDisplayOpen(true)}
        onOpenMore={() => setIsMobileMoreOpen(true)}
      />

      {/* In-App PIN Protected Reset Confirmation Dialog */}
      <ResetConfirmPinModal
        isOpen={isResetConfirmOpen}
        onClose={() => setIsResetConfirmOpen(false)}
        onConfirmReset={() => executeResetAllData()}
        boxes={boxes}
        patients={patients}
      />

      {/* Floating System Toast */}
      {appToastMessage && (
        <div className="fixed bottom-6 right-6 z-60 animate-in slide-in-from-bottom-5">
          <div className="bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-2xl border border-slate-700 text-xs font-bold flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-teal-400 animate-ping" />
            <span>{appToastMessage}</span>
          </div>
        </div>
      )}
    </div>
  );
}
