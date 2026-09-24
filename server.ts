import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, collection, getDocs, deleteDoc, setLogLevel } from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json';

// Suppress Firestore SDK internal logs during network/quota incidents
try {
  setLogLevel('silent');
} catch {
  // ignore
}

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Cloud Firestore client (server-side): dipakai sebagai cadangan/pemulihan bersama
// lintas-instance untuk state antrian, karena disk lokal (DB_FILE di bawah) TIDAK
// dijamin persisten di platform hosting auto-scaling/serverless (instance bisa
// di-recycle & disk lokal ikut hilang saat idle lalu ada request baru).
const firebaseServerApp = !getApps().length ? initializeApp(firebaseConfig as any) : getApp();
const firestoreDatabaseId = (firebaseConfig as any).firestoreDatabaseId && (firebaseConfig as any).firestoreDatabaseId !== '(default)'
  ? (firebaseConfig as any).firestoreDatabaseId
  : undefined;
const serverFirestoreDb = getFirestore(firebaseServerApp, firestoreDatabaseId);
const QUEUE_STATE_DOC_REF = doc(serverFirestoreDb, 'system_state', 'current_queue');
const DAILY_ARCHIVE_DOC_REF = doc(serverFirestoreDb, 'system_state', 'daily_archive');
const MASTER_PATIENTS_DOC_REF = doc(serverFirestoreDb, 'system_state', 'master_patients');
const RANAP_HISTORY_DOC_REF = doc(serverFirestoreDb, 'system_state', 'ranap_history');
// Catatan id pasien yang sudah dibersihkan oleh "Bersihkan Antrean". SENGAJA disimpan
// di dokumen TERPISAH dari current_queue: kalau ikut menumpang di sana, catatan ini akan
// ikut hilang/mundur persis pada saat ia paling dibutuhkan - yaitu ketika wadah server
// diganti dan current_queue dipulihkan dari cadangan yang masih versi SEBELUM reset.
const RESET_TOMBSTONE_DOC_REF = doc(serverFirestoreDb, 'system_state', 'reset_tombstones');

// Increase payload limit for image uploads
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Directories setup
const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'queue_store.json');
const MASTER_PATIENTS_FILE = path.join(DATA_DIR, 'patients_master.json');
const DAILY_ARCHIVE_DIR = path.join(DATA_DIR, 'daily_archive');
const LEGACY_DAILY_ARCHIVE_FILE = path.join(DATA_DIR, 'daily_archive.json');
const RANAP_HISTORY_FILE = path.join(DATA_DIR, 'ranap_history.json');
const PHOTOS_DB_FILE = path.join(DATA_DIR, 'photos_db.json');
const LAIN_LAIN_DB_FILE = path.join(DATA_DIR, 'lain_lain_db.json');
const INVENTORY_DB_FILE = path.join(DATA_DIR, 'inventory_db.json');
const SECURITY_CONFIG_FILE = path.join(DATA_DIR, 'security_config.json');
const DELETION_AUDIT_FILE = path.join(DATA_DIR, 'deletion_audit.json');
const RESET_TOMBSTONE_FILE = path.join(DATA_DIR, 'reset_tombstones.json');
const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Serve uploaded images directly from disk with caching
app.use('/uploads', express.static(UPLOADS_DIR, {
  maxAge: '7d',
  immutable: true,
}));

// Fallback image recovery route: If image is requested by another device/instance and not on local disk
app.get('/uploads/:filename', async (req, res, next) => {
  const filename = req.params.filename;
  const localPath = path.join(UPLOADS_DIR, filename);

  if (fs.existsSync(localPath)) {
    return res.sendFile(localPath);
  }

  // Not on local disk (e.g. multi-instance or after server restart). Fetch from Cloud Firestore irm_photos
  try {
    const photoId = filename.replace(/\.[^/.]+$/, ""); // strip extension
    const photoDocRef = doc(serverFirestoreDb, 'irm_photos', photoId);
    const snap = await getDoc(photoDocRef);

    if (snap.exists()) {
      const data = snap.data() as any;
      if (data && data.dataUrl && typeof data.dataUrl === 'string') {
        let base64Clean = data.dataUrl;
        let mimeType = 'image/jpeg';

        const matches = data.dataUrl.match(/^data:([A-Za-z0-9-+\/]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          mimeType = matches[1];
          base64Clean = matches[2];
        } else {
          base64Clean = data.dataUrl.replace(/^data:image\/\w+;base64,/, '');
        }

        const buffer = Buffer.from(base64Clean, 'base64');
        if (buffer.length > 0) {
          // Write back to local cache disk for future instant hits
          try {
            if (!fs.existsSync(UPLOADS_DIR)) {
              fs.mkdirSync(UPLOADS_DIR, { recursive: true });
            }
            fs.writeFileSync(localPath, buffer);
          } catch {}

          res.setHeader('Content-Type', mimeType);
          res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
          return res.send(buffer);
        }
      }
    }
  } catch (err) {
    console.warn(`[ImageFallback] Failed to recover ${filename} from Cloud Firestore:`, err);
  }

  next();
});

// Timezone helper for Asia/Jakarta (WIB = UTC+7)
function getLocalDateStringWIB(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

// Initial sample master patients for realistic medical rehab database
function getInitialMasterPatients() {
  const todayWIB = getLocalDateStringWIB();
  return [
    {
      id: 'mp-1',
      medicalRecordNo: '273267',
      patientName: 'MUFLIHATI, NY',
      identityNumber: '3171015609800001',
      phoneNumber: '081298765432',
      birthDate: '1980-09-15',
      gender: 'P',
      address: 'Jl. Wijaya I No. 42, Kebayoran Baru, Jakarta Selatan',
      defaultDiagnosis: 'Cervical Root Syndrome & Shoulder Impingement',
      defaultActionCode: 'MWD + TENS + EXERCISE',
      notes: 'Hati-hati posisi leher saat traksi manual',
      registeredDate: '2026-01-10',
      lastVisitDate: todayWIB,
      totalVisits: 8,
      createdAt: new Date().toISOString()
    },
    {
      id: 'mp-2',
      medicalRecordNo: '273289',
      patientName: 'BAMBANG SUTEDJO, TN',
      identityNumber: '3172021204650002',
      phoneNumber: '081387654321',
      birthDate: '1965-04-12',
      gender: 'L',
      address: 'Jl. Gandaria Tengah III No. 15, Jakarta Selatan',
      defaultDiagnosis: 'Post Stroke Iskemik Hemiparesis Sinistra',
      defaultActionCode: 'TERAPI LATIHAN AMBULASI + ES',
      notes: 'Pasien menggunakan walker, perlu pendampingan',
      registeredDate: '2026-02-05',
      lastVisitDate: todayWIB,
      totalVisits: 14,
      createdAt: new Date().toISOString()
    },
    {
      id: 'mp-3',
      medicalRecordNo: '273310',
      patientName: 'SITI RAHMAWATI, NY',
      identityNumber: '3174034508750003',
      phoneNumber: '085712345678',
      birthDate: '1975-08-20',
      gender: 'P',
      address: 'Pondok Indah Plaza 2, Blok B-12, Jakarta Selatan',
      defaultDiagnosis: 'Low Back Pain (LBP) e.c. HNP L4-L5',
      defaultActionCode: 'TRAKSI LUMBAL + TENS + CORE STABILITY',
      notes: '🛑 PERIKSA TEKANAN DARAH SEBELUM TRAKSI',
      registeredDate: '2026-03-12',
      lastVisitDate: todayWIB,
      totalVisits: 6,
      createdAt: new Date().toISOString()
    },
    {
      id: 'mp-4',
      medicalRecordNo: '273402',
      patientName: 'AHMAD FAUZI, TN',
      identityNumber: '3175061802900004',
      phoneNumber: '081809876543',
      birthDate: '1990-02-18',
      gender: 'L',
      address: 'Jl. RS Fatmawati No. 88, Cilandak, Jakarta Selatan',
      defaultDiagnosis: 'Post Op ACL Reconstruction Knee Dextra (Wk 6)',
      defaultActionCode: 'ROM EXERCISE + QUADRICEPS STRENGTHENING',
      notes: 'ROM target minggu ini 0 - 110 derajat',
      registeredDate: '2026-04-01',
      lastVisitDate: todayWIB,
      totalVisits: 10,
      createdAt: new Date().toISOString()
    },
    {
      id: 'mp-5',
      medicalRecordNo: '273511',
      patientName: 'MARIA NATALIA, NN',
      identityNumber: '3171096512980005',
      phoneNumber: '087812349876',
      birthDate: '1998-12-25',
      gender: 'P',
      address: 'Jl. Barito II No. 7, Jakarta Selatan',
      defaultDiagnosis: 'De Quervain Tenosynovitis Wrist Dextra',
      defaultActionCode: 'ULTRASOUND THERAPY (US) + STRETCHING',
      notes: 'Hindari gerakan repetitive thumb adduction',
      registeredDate: '2026-05-18',
      lastVisitDate: todayWIB,
      totalVisits: 4,
      createdAt: new Date().toISOString()
    }
  ];
}

// Master Patients File Helpers
function loadMasterPatients(): any[] {
  try {
    if (fs.existsSync(MASTER_PATIENTS_FILE)) {
      const content = fs.readFileSync(MASTER_PATIENTS_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('Error reading MASTER_PATIENTS_FILE:', err);
  }

  const initial = getInitialMasterPatients();
  saveMasterPatients(initial);
  return initial;
}

// Safe Atomic File Writing helper with temp-file swap to prevent JSON corruption
function safeAtomicWriteJson(filePath: string, data: any) {
  const tmpPath = `${filePath}.${Date.now()}.${Math.random().toString(36).substring(2, 6)}.tmp`;
  try {
    const jsonStr = JSON.stringify(data, null, 2);
    fs.writeFileSync(tmpPath, jsonStr, 'utf-8');
    fs.renameSync(tmpPath, filePath);
  } catch (err) {
    console.error(`[Storage] Atomic write failed for ${filePath}, attempting direct write:`, err);
    try {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
      if (fs.existsSync(tmpPath)) {
        try { fs.unlinkSync(tmpPath); } catch {}
      }
    } catch (e2) {
      console.error(`[Storage] Direct write fallback failed for ${filePath}:`, e2);
    }
  }
}

function saveMasterPatients(patients: any[]) {
  try {
    safeAtomicWriteJson(MASTER_PATIENTS_FILE, patients);
  } catch (err) {
    console.error('Error writing MASTER_PATIENTS_FILE:', err);
  }
  mirrorMasterPatientsToFirestore(patients);
}

// Daily Archive File Helpers (Partitioned by month: data/daily_archive/YYYY-MM.json)
function monthKeyOfDate(dateKey: string): string {
  return dateKey.slice(0, 7);
}
function archiveMonthFilePath(monthKey: string): string {
  return path.join(DAILY_ARCHIVE_DIR, `${monthKey}.json`);
}
function loadArchiveMonth(monthKey: string): Record<string, any[]> {
  try {
    const p = archiveMonthFilePath(monthKey);
    if (fs.existsSync(p)) {
      const parsed = JSON.parse(fs.readFileSync(p, 'utf-8'));
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch (err) {
    console.error(`Error reading archive month ${monthKey}:`, err);
  }
  return {};
}
function saveArchiveMonthLocalOnly(monthKey: string, data: Record<string, any[]>) {
  try {
    if (!fs.existsSync(DAILY_ARCHIVE_DIR)) fs.mkdirSync(DAILY_ARCHIVE_DIR, { recursive: true });
    safeAtomicWriteJson(archiveMonthFilePath(monthKey), data);
  } catch (err) {
    console.error(`Error writing archive month ${monthKey}:`, err);
  }
}
function saveArchiveMonth(monthKey: string, data: Record<string, any[]>) {
  saveArchiveMonthLocalOnly(monthKey, data);
  mirrorArchiveMonthToFirestore(monthKey, data);
}
function listArchiveMonthKeys(): string[] {
  try {
    if (!fs.existsSync(DAILY_ARCHIVE_DIR)) return [];
    return fs.readdirSync(DAILY_ARCHIVE_DIR)
      .filter((f) => /^\d{4}-\d{2}\.json$/.test(f))
      .map((f) => f.replace(/\.json$/, ''))
      .sort();
  } catch (err) {
    console.error('Error listing archive months:', err);
    return [];
  }
}
function loadDailyArchiveForDate(date: string): any[] {
  return loadArchiveMonth(monthKeyOfDate(date))[date] || [];
}
function saveDailyArchiveForDate(date: string, visits: any[]) {
  const monthKey = monthKeyOfDate(date);
  const monthData = loadArchiveMonth(monthKey);
  monthData[date] = visits;
  saveArchiveMonth(monthKey, monthData);
}
function loadDailyArchiveForMonth(monthKey: string): Record<string, any[]> {
  return loadArchiveMonth(monthKey);
}
function loadDailyArchiveForYear(year: number | string): Record<string, any[]> {
  const result: Record<string, any[]> = {};
  for (let m = 1; m <= 12; m++) {
    const monthKey = `${year}-${String(m).padStart(2, '0')}`;
    Object.assign(result, loadArchiveMonth(monthKey));
  }
  return result;
}
function listAllArchiveDateKeys(): string[] {
  const dates: string[] = [];
  for (const monthKey of listArchiveMonthKeys()) {
    dates.push(...Object.keys(loadArchiveMonth(monthKey)));
  }
  return dates.sort().reverse();
}
function loadFullDailyArchive(): Record<string, any[]> {
  const result: Record<string, any[]> = {};
  for (const monthKey of listArchiveMonthKeys()) {
    Object.assign(result, loadArchiveMonth(monthKey));
  }
  return result;
}
function flattenArchiveDates(raw: any, out: Record<string, any[]> = {}): Record<string, any[]> {
  if (!raw || typeof raw !== 'object') return out;
  Object.keys(raw).forEach((key) => {
    const value = raw[key];
    if (/^\d{4}-\d{2}-\d{2}$/.test(key) && Array.isArray(value)) {
      const existing = out[key] || [];
      const map = new Map();
      existing.forEach((v: any) => { if (v && v.id) map.set(v.id, v); });
      value.forEach((v: any) => { if (v && v.id) map.set(v.id, v); });
      out[key] = Array.from(map.values());
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      flattenArchiveDates(value, out);
    }
  });
  return out;
}
function saveFullDailyArchive(archive: Record<string, any[]>) {
  const flattened = flattenArchiveDates(archive);
  const byMonth = new Map<string, Record<string, any[]>>();
  Object.keys(flattened).forEach((dateKey) => {
    const monthKey = monthKeyOfDate(dateKey);
    if (!byMonth.has(monthKey)) byMonth.set(monthKey, {});
    byMonth.get(monthKey)![dateKey] = flattened[dateKey];
  });
  byMonth.forEach((data, monthKey) => saveArchiveMonth(monthKey, data));
}
function migrateLegacyDailyArchiveIfNeeded() {
  try {
    if (!fs.existsSync(LEGACY_DAILY_ARCHIVE_FILE)) return;
    const raw = fs.readFileSync(LEGACY_DAILY_ARCHIVE_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    const flattened = flattenArchiveDates(parsed);
    const dateCount = Object.keys(flattened).length;
    if (dateCount > 0) {
      console.log(`[Migration] Memecah daily_archive.json lama (${dateCount} tanggal) menjadi file per-bulan...`);
      saveFullDailyArchive(flattened);
    }
    const backupPath = `${LEGACY_DAILY_ARCHIVE_FILE}.migrated-${Date.now()}.bak`;
    fs.renameSync(LEGACY_DAILY_ARCHIVE_FILE, backupPath);
    console.log(`[Migration] daily_archive.json lama diamankan sebagai backup: ${path.basename(backupPath)}`);
  } catch (err) {
    console.error('[Migration] Gagal memecah daily_archive.json lama:', err);
  }
}

// Ranap History File Helpers
function loadRanapHistory(): any[] {
  try {
    if (fs.existsSync(RANAP_HISTORY_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(RANAP_HISTORY_FILE, 'utf-8'));
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.error('Error reading RANAP_HISTORY_FILE:', err);
  }
  const initial: any[] = [];
  saveRanapHistory(initial);
  return initial;
}

function saveRanapHistory(history: any[]) {
  try {
    safeAtomicWriteJson(RANAP_HISTORY_FILE, history);
  } catch (err) {
    console.error('Error writing RANAP_HISTORY_FILE:', err);
  }
  mirrorRanapHistoryToFirestore(history);
}

// Photos Database File Helpers
function loadPhotosDb(): any[] {
  try {
    if (fs.existsSync(PHOTOS_DB_FILE)) {
      const content = fs.readFileSync(PHOTOS_DB_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('Error reading PHOTOS_DB_FILE:', err);
  }
  const initialPhotos: any[] = [];
  savePhotosDb(initialPhotos);
  return initialPhotos;
}

function savePhotosDb(photos: any[]) {
  try {
    safeAtomicWriteJson(PHOTOS_DB_FILE, photos);
  } catch (err) {
    console.error('Error writing PHOTOS_DB_FILE:', err);
  }
}

// Initial default seed for Lain-Lain IRM (Kas, Rotasi, Jadwal Sabtu, Cuti)
function getInitialLainLainDb() {
  return {
    kasTransactions: [],
    staffKasPayments: {},
    rotationSchedules: [
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
    ],
    saturdaySchedules: [
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
        notes: 'Jadwal dinas Sabtu minggu ini.',
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
    ],
    leaveRequests: [
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
    ],
    kasNominalPerMonth: 50000,
    kasChecklistPassword: 'irm2026',
    lastUpdated: new Date().toISOString()
  };
}

function loadLainLainDb(): any {
  try {
    if (fs.existsSync(LAIN_LAIN_DB_FILE)) {
      const content = fs.readFileSync(LAIN_LAIN_DB_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (parsed && typeof parsed === 'object') {
        return parsed;
      }
    }
  } catch (err) {
    console.error('Error reading LAIN_LAIN_DB_FILE:', err);
  }
  const initial = getInitialLainLainDb();
  saveLainLainDb(initial);
  return initial;
}

function saveLainLainDb(data: any) {
  try {
    safeAtomicWriteJson(LAIN_LAIN_DB_FILE, data);
  } catch (err) {
    console.error('Error writing LAIN_LAIN_DB_FILE:', err);
  }
}

// Initial seed for Inventory
function getInitialInventoryDb() {
  return {
    items: [
      {
        id: 'item-bhp-001',
        code: 'BHP-001',
        name: 'Gel Ultrasound 5 Liter',
        category: 'bhp',
        quantity: 6,
        minStock: 2,
        unit: 'Galon 5L',
        location: 'Gudang Logistik IRM',
        brand: 'Aquasonic 100 / OneMed',
        specification: 'Water soluble, acoustic transmission gel',
        expiryDate: '2027-12-31',
        lastRestockDate: '2026-08-15',
        notes: 'Dipakai untuk terapi US Fisioterapi harian',
        createdAt: '2026-08-01T08:00:00.000Z',
        updatedAt: '2026-08-20T10:00:00.000Z'
      },
      {
        id: 'item-bhp-002',
        code: 'BHP-002',
        name: 'Kinesiotape Elastis 5cm x 5m',
        category: 'bhp',
        quantity: 14,
        minStock: 5,
        unit: 'Roll',
        location: 'Ruang Fisioterapi 1',
        brand: 'Kinesio Tex Gold / Nitto',
        specification: 'Waterproof elastic therapeutic tape',
        expiryDate: '2028-06-30',
        lastRestockDate: '2026-08-10',
        notes: 'Untuk taping muskuloskeletal, sprain & strain',
        createdAt: '2026-08-01T08:00:00.000Z',
        updatedAt: '2026-08-25T11:00:00.000Z'
      },
      {
        id: 'item-bhp-003',
        code: 'BHP-003',
        name: 'Alkohol Swab 70% (Box isi 100)',
        category: 'bhp',
        quantity: 8,
        minStock: 3,
        unit: 'Box',
        location: 'Ruang Elektroterapi',
        brand: 'OneMed / Sensi',
        specification: '70% Isopropyl Alcohol',
        expiryDate: '2028-01-31',
        lastRestockDate: '2026-08-12',
        notes: 'Disinfeksi elektroda dan kulit pasien',
        createdAt: '2026-08-01T08:00:00.000Z',
        updatedAt: '2026-08-20T10:00:00.000Z'
      },
      {
        id: 'item-bhp-004',
        code: 'BHP-004',
        name: 'Underpad Bed Pasien 60x90cm (Isi 10)',
        category: 'bhp',
        quantity: 10,
        minStock: 4,
        unit: 'Pack',
        location: 'Ruang Fisioterapi 2 & 3',
        brand: 'Sensi / Confidence',
        specification: 'Alas tidur higienis perlak sekali pakai',
        expiryDate: '2029-01-01',
        lastRestockDate: '2026-08-18',
        notes: 'Alas bed tindakan fisioterapi & ranap',
        createdAt: '2026-08-01T08:00:00.000Z',
        updatedAt: '2026-08-20T10:00:00.000Z'
      },
      {
        id: 'item-bhp-005',
        code: 'BHP-005',
        name: 'TENS Electrode Pad 5x5cm (Set isi 4)',
        category: 'bhp',
        quantity: 12,
        minStock: 5,
        unit: 'Set',
        location: 'Ruang Elektroterapi',
        brand: 'Chattanooga / Enraf',
        specification: 'Self-adhesive reusable hydrogel pads',
        expiryDate: '2027-10-31',
        lastRestockDate: '2026-08-05',
        notes: 'Elektroda pad modalitas TENS/ES',
        createdAt: '2026-08-01T08:00:00.000Z',
        updatedAt: '2026-08-22T09:00:00.000Z'
      },
      {
        id: 'item-ft-001',
        code: 'ALT-FT-001',
        name: 'Ultrasound Therapy Unit 1 & 3 MHz',
        category: 'alat_fisio',
        quantity: 2,
        minStock: 1,
        unit: 'Unit',
        location: 'Ruang Fisioterapi 1 & 2',
        condition: 'baik',
        brand: 'Enraf Nonius Sonopuls 490',
        specification: 'Dual frequency 1 & 3 MHz, continuous & pulsed',
        notes: 'Kalibrasi rutin berkala tiap 6 bulan',
        createdAt: '2026-08-01T08:00:00.000Z',
        updatedAt: '2026-08-01T08:00:00.000Z'
      },
      {
        id: 'item-ft-002',
        code: 'ALT-FT-002',
        name: 'TENS 4-Channel Digital Therapy',
        category: 'alat_fisio',
        quantity: 3,
        minStock: 1,
        unit: 'Unit',
        location: 'Ruang Elektroterapi',
        condition: 'baik',
        brand: 'ITO Japan / BTL',
        specification: '4 channel independent, tens + interferential + galvanic',
        notes: 'Kondisi baik, kabel leadwire lengkap',
        createdAt: '2026-08-01T08:00:00.000Z',
        updatedAt: '2026-08-01T08:00:00.000Z'
      },
      {
        id: 'item-ft-003',
        code: 'ALT-FT-003',
        name: 'Shortwave Diathermy (SWD)',
        category: 'alat_fisio',
        quantity: 1,
        minStock: 1,
        unit: 'Unit',
        location: 'Ruang SWD / Elektroterapi Khusus',
        condition: 'baik',
        brand: 'Enraf Curapuls 970',
        specification: '27.12 MHz continuous and pulsed SWD with capacitive electrodes',
        notes: 'Pemeriksaan kabel induksi rutin sebelum tindakan',
        createdAt: '2026-08-01T08:00:00.000Z',
        updatedAt: '2026-08-01T08:00:00.000Z'
      },
      {
        id: 'item-ot-001',
        code: 'ALT-OT-001',
        name: 'Wooden Pegboard & 100 Pegs Set',
        category: 'alat_okupasi',
        quantity: 2,
        minStock: 1,
        unit: 'Set',
        location: 'Ruang Terapi Okupasi 1',
        condition: 'baik',
        brand: 'Sammons Preston',
        specification: 'Papan pasak kayu latihan koordinasi fine motor & dexterity',
        notes: 'Lengkap dan siap pakai',
        createdAt: '2026-08-01T08:00:00.000Z',
        updatedAt: '2026-08-01T08:00:00.000Z'
      },
      {
        id: 'item-tw-001',
        code: 'ALT-TW-001',
        name: 'Cermin Terapi Artikulasi Berdiri',
        category: 'alat_wicara',
        quantity: 2,
        minStock: 1,
        unit: 'Unit',
        location: 'Ruang Terapi Wicara 1 & 2',
        condition: 'baik',
        brand: 'Custom Medical Mirror',
        specification: 'Cermin refleksi visual artikulasi mulut dan lidah dengan roda',
        notes: 'Bersihkan dengan glass cleaner setelah sesi',
        createdAt: '2026-08-01T08:00:00.000Z',
        updatedAt: '2026-08-01T08:00:00.000Z'
      },
      {
        id: 'item-atk-001',
        code: 'LOG-001',
        name: 'Kertas HVS A4 80gr (Rim)',
        category: 'logistik_atk',
        quantity: 8,
        minStock: 3,
        unit: 'Rim',
        location: 'Ruang Administrasi IRM',
        brand: 'PaperOne / Sinar Dunia',
        specification: 'A4 80 GSM white paper',
        notes: 'Untuk print lembar formulir asesmen fisioterapi',
        createdAt: '2026-08-01T08:00:00.000Z',
        updatedAt: '2026-08-15T08:00:00.000Z'
      }
    ],
    mutations: [
      {
        id: 'mut-1',
        itemId: 'item-bhp-001',
        itemCode: 'BHP-001',
        itemName: 'Gel Ultrasound 5 Liter',
        type: 'in',
        quantity: 4,
        previousStock: 2,
        currentStock: 6,
        date: '2026-08-15',
        recordedBy: 'Bambang Jinangkung SST.Ftr',
        recipientOrSource: 'Gudang Farmasi & Logistik RS',
        notes: 'Penerimaan amprahan rutin BMHP bulanan IRM',
        createdAt: '2026-08-15T09:30:00.000Z'
      },
      {
        id: 'mut-2',
        itemId: 'item-bhp-002',
        itemCode: 'BHP-002',
        itemName: 'Kinesiotape Elastis 5cm x 5m',
        type: 'out',
        quantity: 2,
        previousStock: 16,
        currentStock: 14,
        date: '2026-08-25',
        recordedBy: 'Najjah, S.Kep',
        recipientOrSource: 'Ruang Fisioterapi 1 & 2',
        notes: 'Pemakaian tindakan taping pasien poli muskuloskeletal',
        createdAt: '2026-08-25T11:15:00.000Z'
      }
    ],
    lastUpdated: new Date().toISOString()
  };
}

function loadInventoryDb(): any {
  try {
    if (fs.existsSync(INVENTORY_DB_FILE)) {
      const content = fs.readFileSync(INVENTORY_DB_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (parsed && typeof parsed === 'object') {
        return parsed;
      }
    }
  } catch (err) {
    console.error('Error reading INVENTORY_DB_FILE:', err);
  }
  const initial = getInitialInventoryDb();
  saveInventoryDb(initial);
  return initial;
}

function saveInventoryDb(data: any) {
  try {
    safeAtomicWriteJson(INVENTORY_DB_FILE, data);
  } catch (err) {
    console.error('Error writing INVENTORY_DB_FILE:', err);
  }
}

// Security Configuration storage helpers
function loadSecurityConfig(): { appPassword?: string; databasePassword?: string; lastUpdated?: string } {
  try {
    if (fs.existsSync(SECURITY_CONFIG_FILE)) {
      const content = fs.readFileSync(SECURITY_CONFIG_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (parsed && typeof parsed === 'object') {
        return parsed;
      }
    }
  } catch (err) {
    console.error('Error reading SECURITY_CONFIG_FILE:', err);
  }
  return { appPassword: 'admin', databasePassword: 'admin', lastUpdated: new Date().toISOString() };
}

function saveSecurityConfig(data: { appPassword?: string; databasePassword?: string; lastUpdated?: string }) {
  try {
    const existing = loadSecurityConfig();
    const updated = {
      ...existing,
      ...data,
      lastUpdated: new Date().toISOString()
    };
    safeAtomicWriteJson(SECURITY_CONFIG_FILE, updated);
    return updated;
  } catch (err) {
    console.error('Error writing SECURITY_CONFIG_FILE:', err);
    return data;
  }
}

// Tanggal sebuah KUNJUNGAN ditentukan oleh kapan pasien itu DIDAFTARKAN, bukan oleh
// tanggal saat sinkronisasi kebetulan berjalan.
//
// Sebelumnya SELURUH pasien yang masih ada di antrean ditulis ulang ke tanggal HARI INI
// setiap kali sinkronisasi berjalan, sementara catatannya di tanggal kemarin TETAP ADA.
// Akibatnya satu kunjungan yang melewati tengah malam tercatat DUA KALI - muncul di
// register kemarin DAN register hari ini - lalu ikut terhitung dua kali di rekap bulanan
// dan SPM. Pasien yang menginap dua malam terhitung tiga kali.
//
// Dengan aturan ini satu kunjungan selalu milik SATU tanggal saja: tanggal ia didaftarkan.
function tanggalKunjungan(v: any, cadangan: string): string {
  const sumber = v && (v.registeredAt || v.createdAt);
  if (sumber) {
    const t = new Date(sumber);
    if (!isNaN(t.getTime())) return getLocalDateStringWIB(t);
  }
  return cadangan;
}

// Helper: sync patient array to today's daily archive and update master patient visits
function syncPatientsToMasterAndArchive(patients: any[], boxes?: any[]) {
  if (!Array.isArray(patients) || patients.length === 0) return;

  const today = getLocalDateStringWIB();
  const masterPatients = loadMasterPatients();

  let masterUpdated = false;

  // 1. Sync or update Master Patients
  patients.forEach((p) => {
    if (!p.patientName || !p.medicalRecordNo) return;
    const cleanRM = p.medicalRecordNo.trim();
    const cleanName = p.patientName.trim();

    const existingIdx = masterPatients.findIndex(
      (mp) => mp.medicalRecordNo.toLowerCase() === cleanRM.toLowerCase()
    );

    if (existingIdx >= 0) {
      const current = masterPatients[existingIdx];
      let fieldChanged = false;

      // Update patientName if corrected in active queue
      if (cleanName && current.patientName !== cleanName) {
        current.patientName = cleanName;
        fieldChanged = true;
      }

      // Update last visited date and increment if new visit day.
      // Memakai tanggal kunjungan pasien ini sendiri, BUKAN tanggal hari ini: pasien
      // yang masih di antrean saat hari berganti bukan kunjungan baru, jadi tidak boleh
      // menambah hitungan lagi. Syarat "hanya maju" menjaga agar catatan kunjungan
      // terakhir tidak pernah tertarik mundur oleh data lama yang masuk belakangan.
      const tglKunjungan = tanggalKunjungan(p, today);
      if (!current.lastVisitDate || tglKunjungan > current.lastVisitDate) {
        current.lastVisitDate = tglKunjungan;
        current.totalVisits = (current.totalVisits || 1) + 1;
        fieldChanged = true;
      }
      if (p.diagnosis && !current.defaultDiagnosis) {
        current.defaultDiagnosis = p.diagnosis;
        fieldChanged = true;
      }
      if (p.actionCode && !current.defaultActionCode) {
        current.defaultActionCode = p.actionCode;
        fieldChanged = true;
      }
      if (p.phoneNumber && !current.phoneNumber) {
        current.phoneNumber = p.phoneNumber;
        fieldChanged = true;
      }

      if (fieldChanged) {
        current.updatedAt = new Date().toISOString();
        masterUpdated = true;
      }
    } else {
      // Auto-register new patient to master if not found
      masterPatients.push({
        id: `mp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        medicalRecordNo: cleanRM,
        patientName: cleanName,
        phoneNumber: p.phoneNumber || '',
        birthDate: '',
        gender: '',
        address: '',
        defaultDiagnosis: p.diagnosis || '',
        defaultActionCode: p.actionCode || '',
        notes: p.note || '',
        registeredDate: tanggalKunjungan(p, today),
        lastVisitDate: tanggalKunjungan(p, today),
        totalVisits: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      masterUpdated = true;
    }
  });

  if (masterUpdated) {
    saveMasterPatients(masterPatients);
  }

  // 2. ACCUMULATIVE Sync to Daily Archive (DO NOT OVERWRITE OR WIPE PREVIOUS PATIENTS)
  // Hanya baca+tulis file arsip bulan berjalan, bukan seluruh riwayat.
  //
  // Pasien dikelompokkan menurut TANGGAL KUNJUNGANNYA MASING-MASING, lalu tiap kelompok
  // ditulis ke berkas tanggalnya sendiri. Dulu semuanya dipaksa ke tanggal hari ini,
  // sehingga pasien yang melewati tengah malam tercatat dua kali (lihat tanggalKunjungan).
  const stateSekarang = loadStateFromFile();
  const currentBoxes = (boxes && Array.isArray(boxes))
    ? boxes
    : ((stateSekarang && Array.isArray(stateSekarang.boxes)) ? stateSekarang.boxes : []);
  // Id pasien yang BENAR-BENAR masih ada di antrean SAAT INI. Dipakai di bawah untuk
  // memutuskan apakah penanda penutup kunjungan boleh dibersihkan.
  const idAntreanHidup = new Set<string>(
    (stateSekarang && Array.isArray(stateSekarang.patients))
      ? stateSekarang.patients.map((p: any) => p && p.id).filter(Boolean)
      : []
  );

  const perTanggal = new Map<string, any[]>();
  patients.forEach((p) => {
    if (!p || !p.id || !p.patientName || !p.medicalRecordNo) return;
    const tgl = tanggalKunjungan(p, today);
    const daftar = perTanggal.get(tgl);
    if (daftar) daftar.push(p); else perTanggal.set(tgl, [p]);
  });

  perTanggal.forEach((daftarPasien, tglArsip) => {
  const existingVisits = loadDailyArchiveForDate(tglArsip);
  const visitsMap = new Map<string, any>();

  // Keep all existing visits recorded on that date
  existingVisits.forEach((v: any) => {
    if (v && v.id) visitsMap.set(v.id, v);
  });

  // Upsert incoming active patients
  daftarPasien.forEach((p) => {
    const prev = visitsMap.get(p.id) || {};
    const boxMatch = currentBoxes.find((b: any) => b.id === (p.boxId || prev.boxId));

    visitsMap.set(p.id, {
      ...prev,
      id: p.id,
      visitDate: tglArsip,
      patientId: p.patientId || p.id,
      medicalRecordNo: p.medicalRecordNo.trim(),
      patientName: p.patientName.trim(),
      boxId: p.boxId || prev.boxId || 'box-1',
      boxTitle: p.boxTitle || prev.boxTitle || boxMatch?.title || p.boxId || '',
      officerName: p.officerName || prev.officerName || boxMatch?.officerName || '',
      category: p.category || prev.category || boxMatch?.category || '',
      firstOfficerName: p.firstOfficerName || prev.firstOfficerName || '',
      firstBoxTitle: p.firstBoxTitle || prev.firstBoxTitle || '',
      queueNumber: p.queueNumber || prev.queueNumber || '',
      actionCode: p.actionCode || prev.actionCode || '',
      diagnosis: p.diagnosis || prev.diagnosis || '',
      isWarning: p.isWarning !== undefined ? !!p.isWarning : (prev.isWarning !== undefined ? !!prev.isWarning : false),
      isRanap: p.isRanap !== undefined ? !!p.isRanap : (prev.isRanap !== undefined ? !!prev.isRanap : false),
      note: p.note !== undefined ? p.note : (prev.note || ''),
      phoneNumber: p.phoneNumber || prev.phoneNumber || '',
      completed: p.completed !== undefined ? !!p.completed : (prev.completed !== undefined ? !!prev.completed : false),
      registeredAt: p.createdAt || prev.registeredAt || new Date().toISOString(),
      calledAt: p.lastCalledAt || prev.calledAt || null,
      completedAt: p.completedAt || prev.completedAt || null,
      calledCount: p.calledCount !== undefined ? p.calledCount : (prev.calledCount || 0),
      // Pasien yang MASIH ada di antrean hidup menurut definisinya BELUM ditutup, jadi
      // penandanya dibersihkan. Ini yang membuat "Restore Antrean" bekerja benar: pasien
      // yang tadinya dihapus lalu dikembalikan tidak ikut membawa status "dipindahkan"
      // yang sudah tidak berlaku.
      //
      // PENTING: yang menentukan adalah antrean SAAT INI (idAntreanHidup), BUKAN daftar
      // `patients` yang dikirim ke fungsi ini. Sinkronisasi ini ditunda 1,5 detik, jadi
      // daftar itu bisa berupa cuplikan dari SEBELUM antrean dibersihkan. Kalau cuplikan
      // lama itu yang dipercaya, penanda penutup yang baru saja ditulis oleh "Bersihkan
      // Antrean" akan terhapus lagi - dan timer Respon Time pasien yang sudah dibersihkan
      // kembali berjalan abadi. Pasien yang sudah tidak ada di antrean TIDAK disentuh,
      // sehingga penanda penutupnya (dari ...prev) tetap utuh.
      ...(idAntreanHidup.has(p.id) ? { endedAt: null, endedReason: undefined } : {}),
    });
  });

  saveDailyArchiveForDate(tglArsip, Array.from(visitsMap.values()));
  });
}

// Debounced master patient & daily archive synchronization helper
let masterArchiveDebounceTimer: NodeJS.Timeout | null = null;
let pendingMasterArchivePatients: any[] | null = null;
let pendingMasterArchiveBoxes: any[] | null = null;

function flushPendingMasterArchiveSync() {
  if (masterArchiveDebounceTimer) {
    clearTimeout(masterArchiveDebounceTimer);
    masterArchiveDebounceTimer = null;
    const toSyncP = pendingMasterArchivePatients;
    const toSyncB = pendingMasterArchiveBoxes;
    pendingMasterArchivePatients = null;
    pendingMasterArchiveBoxes = null;
    if (toSyncP) {
      try {
        syncPatientsToMasterAndArchive(toSyncP, toSyncB || undefined);
      } catch (err) {
        console.warn('[Shutdown] Gagal flush sinkronisasi arsip/master pasien:', err);
      }
    }
  }
}

function scheduleSyncPatientsToMasterAndArchive(patients: any[], boxes?: any[]) {
  pendingMasterArchivePatients = patients;
  if (boxes && Array.isArray(boxes)) pendingMasterArchiveBoxes = boxes;
  if (masterArchiveDebounceTimer) clearTimeout(masterArchiveDebounceTimer);
  masterArchiveDebounceTimer = setTimeout(() => {
    masterArchiveDebounceTimer = null;
    const toSyncP = pendingMasterArchivePatients;
    const toSyncB = pendingMasterArchiveBoxes;
    pendingMasterArchivePatients = null;
    pendingMasterArchiveBoxes = null;
    if (toSyncP) {
      try {
        syncPatientsToMasterAndArchive(toSyncP, toSyncB || undefined);
      } catch (err) {
        console.error('[MasterArchiveSync] Deferred sync error:', err);
      }
    }
  }, 1500);
}

// Serve uploaded images statically
app.use('/uploads', express.static(UPLOADS_DIR));

// Serialized write queue mutex to prevent concurrent file corruption
let isWritingQueueFile = false;
const writeQueueTasks: Array<() => Promise<void>> = [];

function enqueueQueueWrite(task: () => Promise<void>): Promise<void> {
  return new Promise((resolve, reject) => {
    writeQueueTasks.push(async () => {
      try {
        await task();
        resolve();
      } catch (err) {
        reject(err);
      }
    });
    processQueueWriteTasks();
  });
}

async function processQueueWriteTasks() {
  if (isWritingQueueFile || writeQueueTasks.length === 0) return;
  isWritingQueueFile = true;
  const nextTask = writeQueueTasks.shift();
  if (nextTask) {
    try {
      await nextTask();
    } catch (e) {
      console.error('[Storage Mutex] Task error:', e);
    } finally {
      isWritingQueueFile = false;
      processQueueWriteTasks();
    }
  }
}

// SSE clients for real-time synchronization across devices
interface SSEClientInfo {
  id: string;
  res: express.Response;
  ip: string;
  connectedAt: string;
}

let sseClients: SSEClientInfo[] = [];

function sanitizeResetFlagsForBroadcast(data: any): any {
  if (!data || typeof data !== 'object' || !data.state || typeof data.state !== 'object') return data;
  const state = data.state;
  if (!state.isExplicitReset && !state.resetConfirmed) return data;
  const patientCount = Array.isArray(state.patients) ? state.patients.length : 0;
  if (patientCount === 0) return data;

  console.warn(`[Broadcast] Flag reset ikut terbawa padahal masih ada ${patientCount} pasien - flag dinetralkan agar perangkat lain tidak ikut terkosongkan.`);
  return { ...data, state: { ...state, isExplicitReset: false, resetConfirmed: false } };
}

function broadcastUpdate(rawData: any) {
  const data = sanitizeResetFlagsForBroadcast(rawData);
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  const deadClientIds: string[] = [];

  for (const client of sseClients) {
    try {
      const success = client.res.write(payload);
      if (!success && (client.res.writableEnded || client.res.destroyed)) {
        deadClientIds.push(client.id);
      }
    } catch (e) {
      deadClientIds.push(client.id);
    }
  }

  if (deadClientIds.length > 0) {
    sseClients = sseClients.filter((c) => !deadClientIds.includes(c.id));
    console.log(`[SSE Broadcast] Pruned ${deadClientIds.length} inactive connection(s). Active: ${sseClients.length}`);
  }
}

// Heartbeat interval every 15s to prevent proxy timeouts and idle socket closures on mobile devices & smart TVs
setInterval(() => {
  const deadClientIds: string[] = [];
  for (const client of sseClients) {
    try {
      const ok = client.res.write(': heartbeat\n\n');
      if (!ok && (client.res.writableEnded || client.res.destroyed)) {
        deadClientIds.push(client.id);
      }
    } catch {
      deadClientIds.push(client.id);
    }
  }
  if (deadClientIds.length > 0) {
    sseClients = sseClients.filter((c) => !deadClientIds.includes(c.id));
    console.log(`[SSE Heartbeat] Evicted ${deadClientIds.length} dead socket(s). Active: ${sseClients.length}`);
  }
}, 15000);

// Helper: generate initial server state
function getInitialServerState() {
  return {
    boxes: [
      {
        id: 'box-jemputan',
        title: 'ANTRIAN JEMPUTAN RANAP IRM RSPP',
        officerName: 'Tim Transport IRM RSPP',
        location: '',
        color: 'sage',
        isPinned: true,
        instructionText: '',
        autoCallNext: false,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'box-bambang',
        title: 'BAMBANG JINANGKUNG',
        officerName: 'Bambang Jinangkung SST.Ftr',
        location: '',
        color: 'blue',
        isPinned: true,
        instructionText: '',
        autoCallNext: false,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'box-musowir',
        title: 'MUSOWIR',
        officerName: 'Musowir SST.FT',
        location: '',
        color: 'purple',
        isPinned: false,
        instructionText: '',
        autoCallNext: false,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'box-vita',
        title: 'VITA PUSPITANINGRUM',
        officerName: 'Vita Puspitaningrum Amd FT',
        location: '',
        color: 'pink',
        isPinned: false,
        instructionText: '',
        autoCallNext: false,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'box-nazrudin',
        title: 'NAZRUDIN',
        officerName: 'Nazrudin, Amd.Ft',
        location: '',
        color: 'orange',
        isPinned: false,
        instructionText: '',
        autoCallNext: false,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'box-umi',
        title: 'UMI ANIMAH',
        officerName: 'umi animah Ftr',
        location: '',
        color: 'green',
        isPinned: false,
        instructionText: '',
        autoCallNext: false,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'box-nuha',
        title: 'NUHA FADHILLAH',
        officerName: 'Nuha Fadhillah, Ftr',
        location: '',
        color: 'coral',
        isPinned: false,
        instructionText: '',
        autoCallNext: false,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'box-shiva',
        title: 'SHIVA WIDIATY',
        officerName: 'Shiva widiaty Ftr',
        location: '',
        color: 'purple',
        isPinned: false,
        instructionText: '',
        autoCallNext: false,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'box-tara',
        title: 'TARA LUFITASARI',
        officerName: 'Tara Lufitasari Ftr',
        location: '',
        color: 'yellow',
        isPinned: false,
        instructionText: '',
        autoCallNext: false,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'box-aliya',
        title: 'ALIYA RAMADHANI',
        officerName: 'Aliya Ramadhani SstFt',
        location: '',
        color: 'blue',
        isPinned: false,
        instructionText: '',
        autoCallNext: false,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'box-bagus',
        title: 'BAGUS DHIKA',
        officerName: 'Bagus Dhika SsT Ft',
        location: '',
        color: 'sage',
        isPinned: false,
        instructionText: '',
        autoCallNext: false,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'box-zainul',
        title: 'ZAINUL FIKRILIAN',
        officerName: 'Zainul FIKRILIAN SST.Ft',
        location: '',
        color: 'green',
        isPinned: false,
        instructionText: '',
        autoCallNext: false,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'box-fikri',
        title: 'FIKRI',
        officerName: 'Fikri',
        location: '',
        color: 'orange',
        isPinned: false,
        instructionText: '',
        autoCallNext: false,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'box-reva',
        title: 'REVA',
        officerName: 'Reva Nanda Saputra S.Ft',
        location: '',
        color: 'yellow',
        isPinned: false,
        instructionText: '',
        autoCallNext: false,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'box-najjah',
        title: 'NAJJAH',
        officerName: 'Najjah, S.Kep',
        location: '',
        color: 'blue',
        isPinned: false,
        instructionText: '',
        autoCallNext: false,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'box-ayu',
        title: 'AYU',
        officerName: 'Ayu, Amd.Kep',
        location: '',
        color: 'purple',
        isPinned: false,
        instructionText: '',
        autoCallNext: false,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'box-ammell',
        title: 'AMMELL',
        officerName: 'Ammell, S.FT',
        location: '',
        color: 'orange',
        isPinned: false,
        instructionText: '',
        autoCallNext: false,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'box-saiful',
        title: 'SAIFUL',
        officerName: 'Saiful, S.FT',
        location: '',
        color: 'coral',
        isPinned: false,
        instructionText: '',
        autoCallNext: false,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'box-ariq',
        title: 'ARIQ',
        officerName: 'Ariq Muafa Adli, Amd.Ft',
        location: '',
        category: 'fisio',
        color: 'sage',
        isPinned: false,
        instructionText: '',
        autoCallNext: false,
        createdAt: new Date().toISOString(),
      },
      // ===== TERAPI OKUPASI (OT) =====
      {
        id: 'box-cecep',
        title: 'CECEP',
        officerName: 'Cecep, A.Md.OT',
        location: '',
        category: 'okupasi',
        color: 'purple',
        isPinned: false,
        instructionText: '',
        autoCallNext: false,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'box-gunandar',
        title: 'GUNANDAR',
        officerName: 'Gunandar, A.Md.OT',
        location: '',
        category: 'okupasi',
        color: 'pink',
        isPinned: false,
        instructionText: '',
        autoCallNext: false,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'box-putri',
        title: 'PUTRI',
        officerName: 'Putri, A.Md.OT',
        location: '',
        category: 'okupasi',
        color: 'coral',
        isPinned: false,
        instructionText: '',
        autoCallNext: false,
        createdAt: new Date().toISOString(),
      },
      // ===== TERAPI WICARA (TW) =====
      {
        id: 'box-monalisa',
        title: 'MONALISA',
        officerName: 'Monalisa',
        location: '',
        category: 'wicara',
        color: 'yellow',
        isPinned: false,
        instructionText: '',
        autoCallNext: false,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'box-kalya',
        title: 'KALYA',
        officerName: 'Kalya',
        location: '',
        category: 'wicara',
        color: 'orange',
        isPinned: false,
        instructionText: '',
        autoCallNext: false,
        createdAt: new Date().toISOString(),
      },
      // ===== KOTAK PERALIHAN SIANG =====
      {
        id: 'box-peralihan-siang',
        title: 'PERALIHAN SIANG',
        officerName: 'Petugas Shift Siang',
        location: 'Instalasi Rehabilitasi Medis',
        category: 'fisio',
        color: 'metallic-bronze',
        isPinned: true,
        instructionText: 'Kotak antrean peralihan pasien shift siang IRM RSPP.',
        autoCallNext: false,
        createdAt: new Date().toISOString(),
      }
    ],
    patients: [],
    callLogs: [],
    notifications: [],
    ranapQueue: [],
    communicationNotes: [],
    currentCallingPatient: null,
    currentCallingBox: null,
    boxOrderUpdatedAt: null,
    deletedPatientIds: [],
    preResetPatientIds: [],
    lastUpdated: new Date().toISOString(),
  };
}

// Helper: clean and sanitize box titles (removes legacy hardcoded dates)
function sanitizeServerBox(b: any) {
  if (!b || typeof b !== 'object') return b;
  let title = (b.title || '').trim();
  let boxId = b.id || '';
  const officer = (b.officerName || '').toLowerCase();

  if (boxId === 'box-monalisa' || officer.includes('monalisa')) {
    title = 'MONALISA';
  } else if (boxId === 'box-kalya' || officer.includes('kalya')) {
    title = 'KALYA';
  } else if (boxId === 'box-cecep' || officer.includes('cecep')) {
    title = 'CECEP';
  } else if (boxId === 'box-gunandar' || officer.includes('gunandar')) {
    title = 'GUNANDAR';
  } else if (boxId === 'box-putri' || officer.includes('putri')) {
    title = 'PUTRI';
  } else if (boxId === 'box-ariq' || officer.includes('ariq')) {
    title = 'ARIQ';
  } else if (boxId === 'box-peralihan-siang' || officer.includes('peralihan') || title.toLowerCase().includes('peralihan')) {
    title = 'PERALIHAN SIANG';
    boxId = 'box-peralihan-siang';
  } else if (boxId === 'box-jemputan') {
    title = 'ANTRIAN JEMPUTAN RANAP IRM RSPP';
  } else if (title.includes('(')) {
    title = title.split('(')[0].trim();
  }

  return {
    ...b,
    id: boxId || b.id,
    title: title || b.title
  };
}

// Helper: load state from file
// ============================================================================
// CATATAN RESET YANG TAHAN GANTI-WADAH
// ----------------------------------------------------------------------------
// Sebelum ini, id pasien yang dibersihkan lewat "Bersihkan Antrean" HANYA hidup
// di dalam objek state antrean (field preResetPatientIds). Selama state itu utuh
// semuanya benar: perangkat yang ketiduran dan menyiarkan ulang daftar lamanya
// akan ditolak. Masalahnya, catatan itu ikut lenyap justru pada saat ia paling
// dibutuhkan - saat wadah server diganti (platform me-recycle instance yang idle,
// disk lokalnya ikut hilang):
//
//   a. Cadangan Cloud Firestore tidak terbaca (jaringan/kuota) -> server mulai
//      dari state bawaan, preResetPatientIds kosong.
//   b. Cadangan Cloud Firestore terbaca tapi isinya masih versi SEBELUM reset
//      (mirror terakhir belum sempat terkirim / sedang jeda kuota) -> yang
//      dipulihkan justru pasien lama BESERTA catatan reset yang ikut mundur.
//
// Di kedua keadaan itu tidak ada lagi yang menahan pasien lama, sehingga perangkat
// mana pun yang masih menyimpan daftar lama cukup sekali menyiarkan untuk
// menghidupkannya kembali - persis gejala "semalam sudah dibersihkan, pagi muncul
// lagi".
//
// Jadi catatan ini dipisahkan: berkas lokal sendiri + dokumen Firestore sendiri,
// dan SELALU ditulis dengan pola baca-gabung-tulis (tidak pernah menimpa buta),
// sama seperti pola cadangan arsip harian per tanggal. Sifatnya hanya BERTAMBAH,
// jadi tidak bisa mundur walau ada instance basi yang ikut menulis.
// ============================================================================
const RESET_TOMBSTONE_MAX = 5000;
let tombstoneResetPermanen = new Set<string>();
let lastResetAtPermanen: string | null = null;

function simpanTombstoneResetKeDisk() {
  try {
    safeAtomicWriteJson(RESET_TOMBSTONE_FILE, {
      ids: Array.from(tombstoneResetPermanen).slice(-RESET_TOMBSTONE_MAX),
      lastResetAt: lastResetAtPermanen,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('[ResetTombstone] Gagal menyimpan catatan reset ke disk:', err);
  }
}

function muatTombstoneResetDariDisk() {
  try {
    if (!fs.existsSync(RESET_TOMBSTONE_FILE)) return;
    const raw = JSON.parse(fs.readFileSync(RESET_TOMBSTONE_FILE, 'utf-8'));
    if (Array.isArray(raw?.ids)) {
      for (const id of raw.ids) if (id) tombstoneResetPermanen.add(String(id));
    }
    if (typeof raw?.lastResetAt === 'string') lastResetAtPermanen = raw.lastResetAt;
  } catch (err) {
    console.warn('[ResetTombstone] Catatan reset lokal tidak terbaca, dilewati:', err);
  }
}
muatTombstoneResetDariDisk();

// Cadangkan catatan reset ke Firestore dengan BACA -> GABUNG -> TULIS. Kalau
// dokumennya tidak bisa dibaca, penulisan sengaja DIBATALKAN (bukan ditimpa),
// supaya instance yang jaringannya sedang bermasalah tidak menghapus catatan
// yang sudah ada di sana.
async function cadangkanTombstoneResetKeFirestore(): Promise<void> {
  if (isFirestoreMirrorDisabled) return;
  try {
    let gabungan = new Set<string>(tombstoneResetPermanen);
    let resetTerbaru = lastResetAtPermanen;
    const snapshot = await getDoc(RESET_TOMBSTONE_DOC_REF);
    if (snapshot.exists()) {
      const data: any = snapshot.data();
      if (Array.isArray(data?.ids)) {
        for (const id of data.ids) if (id) gabungan.add(String(id));
      }
      if (typeof data?.lastResetAt === 'string') {
        if (!resetTerbaru || new Date(data.lastResetAt).getTime() > new Date(resetTerbaru).getTime()) {
          resetTerbaru = data.lastResetAt;
        }
      }
    }
    const idsFinal = Array.from(gabungan).slice(-RESET_TOMBSTONE_MAX);
    await setDoc(RESET_TOMBSTONE_DOC_REF, {
      ids: idsFinal,
      lastResetAt: resetTerbaru || null,
      lastMirroredAt: new Date().toISOString(),
    });
    tombstoneResetPermanen = new Set(idsFinal);
    lastResetAtPermanen = resetTerbaru;
    simpanTombstoneResetKeDisk();
  } catch (err: any) {
    handleFirestoreQuotaError(err, 'ResetTombstone');
  }
}

// Dipanggil setiap kali antrean dibersihkan. Menulis ke disk lebih dulu (selalu
// berhasil & langsung berlaku untuk instance ini), lalu mencadangkan ke Firestore
// di latar belakang.
function catatTombstoneReset(ids: any[], lastResetAt?: string | null) {
  let bertambah = false;
  for (const id of Array.isArray(ids) ? ids : []) {
    if (id && !tombstoneResetPermanen.has(String(id))) {
      tombstoneResetPermanen.add(String(id));
      bertambah = true;
    }
  }
  if (lastResetAt && (!lastResetAtPermanen || new Date(lastResetAt).getTime() > new Date(lastResetAtPermanen).getTime())) {
    lastResetAtPermanen = lastResetAt;
    bertambah = true;
  }
  if (!bertambah) return;
  simpanTombstoneResetKeDisk();
  void cadangkanTombstoneResetKeFirestore();
}

// Saat instance baru menyala, tarik catatan reset dari Firestore SEBELUM state
// antrean dipakai, supaya pembersihan yang dilakukan instance sebelumnya tetap
// berlaku walau disk lokal wadah ini masih kosong.
async function hydrateResetTombstonesFromFirestoreIfNeeded(): Promise<void> {
  try {
    const snapshot = await getDoc(RESET_TOMBSTONE_DOC_REF);
    if (!snapshot.exists()) return;
    const data: any = snapshot.data();
    let bertambah = false;
    if (Array.isArray(data?.ids)) {
      for (const id of data.ids) {
        if (id && !tombstoneResetPermanen.has(String(id))) {
          tombstoneResetPermanen.add(String(id));
          bertambah = true;
        }
      }
    }
    if (typeof data?.lastResetAt === 'string') {
      if (!lastResetAtPermanen || new Date(data.lastResetAt).getTime() > new Date(lastResetAtPermanen).getTime()) {
        lastResetAtPermanen = data.lastResetAt;
        bertambah = true;
      }
    }
    if (bertambah) {
      simpanTombstoneResetKeDisk();
      console.log(`[ResetTombstone] ${tombstoneResetPermanen.size} id pasien yang sudah dibersihkan dipulihkan dari cadangan Cloud Firestore.`);
    }
  } catch (err) {
    console.warn('[ResetTombstone] Gagal memulihkan catatan reset dari Cloud Firestore:', err);
  }
}

// Cabut catatan penghapusan untuk id tertentu. Dipakai HANYA saat petugas sengaja
// mengembalikan pasien dari Database Harian ("Kembalikan ke Antrean"). Tanpa ini,
// pasien yang dikembalikan akan langsung tersaring lagi oleh catatan reset.
function cabutTombstoneReset(ids: any[]): number {
  let dicabut = 0;
  for (const id of Array.isArray(ids) ? ids : []) {
    if (id && tombstoneResetPermanen.delete(String(id))) dicabut++;
  }
  if (dicabut > 0) {
    simpanTombstoneResetKeDisk();
    // Sengaja TIDAK memanggil cadangkanTombstoneResetKeFirestore(): fungsi itu
    // hanya menggabung (union), jadi id yang baru dicabut akan langsung masuk lagi
    // dari dokumen cloud. Pencabutan ditulis langsung supaya benar-benar hilang.
    void tulisUlangTombstoneResetKeFirestore();
  }
  return dicabut;
}

async function tulisUlangTombstoneResetKeFirestore(): Promise<void> {
  if (isFirestoreMirrorDisabled) return;
  try {
    await setDoc(RESET_TOMBSTONE_DOC_REF, {
      ids: Array.from(tombstoneResetPermanen).slice(-RESET_TOMBSTONE_MAX),
      lastResetAt: lastResetAtPermanen || null,
      lastMirroredAt: new Date().toISOString(),
    });
  } catch (err: any) {
    handleFirestoreQuotaError(err, 'ResetTombstone');
  }
}

// Terapkan catatan reset permanen ke sebuah state antrean: pasien yang sudah
// dibersihkan dibuang, dan daftar preResetPatientIds-nya dilengkapi kembali.
// Ini yang membuat cadangan Firestore versi LAMA (berisi pasien sebelum reset)
// tidak bisa lagi menghidupkan pasien yang sudah dihapus.
function terapkanTombstoneReset(state: any): { state: any; dibuang: number } {
  if (!state || typeof state !== 'object' || tombstoneResetPermanen.size === 0) {
    return { state, dibuang: 0 };
  }
  let dibuang = 0;
  if (Array.isArray(state.patients)) {
    const sisa = state.patients.filter((p: any) => !(p && p.id && tombstoneResetPermanen.has(String(p.id))));
    dibuang = state.patients.length - sisa.length;
    if (dibuang > 0) state.patients = sisa;
  }
  const gabungan = new Set<string>(Array.isArray(state.preResetPatientIds) ? state.preResetPatientIds.map(String) : []);
  const sebelum = gabungan.size;
  for (const id of tombstoneResetPermanen) gabungan.add(id);
  if (gabungan.size !== sebelum) {
    state.preResetPatientIds = Array.from(gabungan).slice(-RESET_TOMBSTONE_MAX);
  }
  return { state, dibuang };
}

function loadStateFromFile() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const content = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (parsed && typeof parsed === 'object') {
        const initial = getInitialServerState();
        if (Array.isArray(parsed.boxes)) {
          const hasOrders = parsed.boxes.some((b: any) => b && typeof b.order === 'number');
          if (hasOrders) {
            parsed.boxes.sort((a: any, b: any) => {
              const orderA = typeof a?.order === 'number' ? a.order : 9999;
              const orderB = typeof b?.order === 'number' ? b.order : 9999;
              return orderA - orderB;
            });
          }
          parsed.boxes = parsed.boxes.map(sanitizeServerBox);
          const existingIds = new Set(parsed.boxes.map((b: any) => b.id));
          const deletedBoxIdSet = new Set(Array.isArray(parsed.deletedBoxIds) ? parsed.deletedBoxIds : []);
          const missingBoxes = initial.boxes.filter((b: any) => !existingIds.has(b.id) && !deletedBoxIdSet.has(b.id));
          if (missingBoxes.length > 0) {
            // HANYA menyimpan kalau memang ada yang berubah (kotak bawaan yang hilang
            // dikembalikan). Sebelumnya penyimpanan ini berada DI LUAR pengecekan,
            // sehingga SETIAP KALI state dibaca - termasuk sekadar menampilkan antrean -
            // ikut mencadangkan ke Cloud Firestore. Dua akibatnya:
            //   1. Kalau instance baru menyala dengan state bawaan (0 pasien) karena
            //      pengambilan cadangan gagal, pembacaan pertama langsung MENIMPA
            //      cadangan yang masih berisi pasien sungguhan.
            //   2. Kuota Firestore terpakai untuk penulisan yang tidak mengubah apa pun.
            // Membaca tidak boleh menulis - penyimpanan hanya dilakukan saat ada
            // perubahan nyata, seperti semua jalur lain di server ini.
            parsed.boxes = [...parsed.boxes, ...missingBoxes];
            saveStateToFile(parsed);
          }
        }
        // Saring pasien yang sudah pernah dibersihkan lewat "Bersihkan Antrean".
        // Penting saat wadah server baru memulihkan current_queue dari cadangan
        // Cloud Firestore yang ternyata masih versi SEBELUM reset: tanpa saringan
        // ini, pasien lama ikut hidup lagi dan langsung tersiar ke semua perangkat.
        const hasilSaring = terapkanTombstoneReset(parsed);
        if (hasilSaring.dibuang > 0) {
          console.log(`[ResetTombstone] ${hasilSaring.dibuang} pasien lama yang sudah dibersihkan disaring dari state yang dimuat.`);
          saveStateToFile(parsed);
        }
        return parsed;
      }
    }
  } catch (err) {
    console.error('Error reading DB_FILE:', err);
  }

  // Sampai di sini artinya file state tidak ada atau rusak, jadi kita terpaksa memulai
  // dari state bawaan (25 kotak terapis, TANPA satu pun pasien).
  //
  // PENTING: state bawaan ini ditulis ke disk LOKAL SAJA, JANGAN dicadangkan ke Cloud
  // Firestore. Alasannya: keadaan ini juga terjadi saat sebuah instance baru menyala
  // tapi pengambilan cadangan gagal (gangguan jaringan sesaat / kuota Firestore habis).
  // Kalau state bawaan yang kosong itu ikut tercadangkan, ia akan MENIMPA cadangan yang
  // masih berisi pasien sungguhan - dan sesudah itu tidak ada lagi tempat memulihkannya.
  // Bentuknya pun terlihat "sah" (kotak-kotaknya lengkap, cuma nol pasien), jadi tidak
  // ada yang menandainya sebagai data rusak.
  //
  // Dengan cadangan dibiarkan utuh, instance ini akan pulih sendiri: sinkronisasi
  // periodik menarik kembali pasien dari cadangan, atau perangkat yang mengirim datanya
  // akan mengisinya lewat penggabungan biasa. Begitu ada perubahan nyata, penyimpanan
  // normal (saveStateToFile) mencadangkan lagi seperti biasa.
  //
  // Pola "tulis lokal saja" ini sama dengan saveArchiveMonthLocalOnly untuk arsip harian.
  const initialState = getInitialServerState();
  // Bawa serta catatan reset permanen. Tanpa ini, wadah server yang baru menyala
  // tanpa disk & tanpa cadangan akan mulai dengan daftar tombstone KOSONG - dan
  // perangkat mana pun yang masih menyimpan antrean lama cukup sekali menyiarkan
  // untuk menghidupkannya kembali. Inilah yang membuat antrean yang sudah
  // dibersihkan semalam bisa muncul lagi keesokan paginya.
  terapkanTombstoneReset(initialState);
  try {
    safeAtomicWriteJson(DB_FILE, initialState);
  } catch (err) {
    console.error('Error writing initial DB_FILE:', err);
  }
  console.warn('[QueueState] File state tidak ada/rusak - memulai dari state bawaan (0 pasien). Cadangan Cloud Firestore SENGAJA tidak disentuh agar data yang ada di sana tetap bisa dipulihkan.');
  return initialState;
}

// Helper: save state to file using safe atomic writer
function saveStateToFile(state: any) {
  try {
    safeAtomicWriteJson(DB_FILE, state);
  } catch (err) {
    console.error('Error writing DB_FILE:', err);
  }
  // Cadangkan ke Cloud Firestore di background (tidak memblokir response request).
  // Ini membuat instance backend lain / instance yang baru dinyalakan ulang bisa
  // memulihkan state terakhir walau disk lokalnya sendiri kosong.
  mirrorStateToFirestore(state);
}

// Cadangkan state terkini ke Cloud Firestore (fire-and-forget, gagal diam-diam
// tanpa mengganggu request yang sedang berjalan; disk lokal tetap sumber utama
// untuk instance yang sama).
const FIRESTORE_QUOTA_FLAG_FILE = path.join(DATA_DIR, '.firestore_quota_disabled');
const FIRESTORE_QUOTA_COOLDOWN_MS = 5 * 60 * 1000; // 5 menit
let needsQuotaRetryScheduleOnBoot = false;
let isFirestoreMirrorDisabled = (() => {
  try {
    if (fs.existsSync(FIRESTORE_QUOTA_FLAG_FILE)) {
      const content = fs.readFileSync(FIRESTORE_QUOTA_FLAG_FILE, 'utf-8');
      const flagTs = parseInt(content, 10);
      if (flagTs && Date.now() - flagTs < FIRESTORE_QUOTA_COOLDOWN_MS) {
        needsQuotaRetryScheduleOnBoot = true;
        return true;
      }
      try { fs.unlinkSync(FIRESTORE_QUOTA_FLAG_FILE); } catch {}
    }
  } catch {}
  return false;
})();

let firestoreQuotaRetryTimer: NodeJS.Timeout | null = null;

function scheduleFirestoreQuotaRetry() {
  if (firestoreQuotaRetryTimer) {
    clearTimeout(firestoreQuotaRetryTimer);
  }
  firestoreQuotaRetryTimer = setTimeout(async () => {
    firestoreQuotaRetryTimer = null;
    isFirestoreMirrorDisabled = false;
    try { fs.unlinkSync(FIRESTORE_QUOTA_FLAG_FILE); } catch {}
    console.log('[FirestoreMirror] Jeda kuota selesai, mencoba mencadangkan ke Cloud Firestore lagi secara otomatis.');

    try {
      await flushPendingFirestoreMirrors();
      console.log('[FirestoreMirror] Berhasil mengirim ulang data yang tertunda setelah jeda kuota berakhir.');
    } catch (err: any) {
      handleFirestoreQuotaError(err, 'FirestoreMirror-Retry');
    }
  }, FIRESTORE_QUOTA_COOLDOWN_MS);
}

if (needsQuotaRetryScheduleOnBoot) {
  console.log('[FirestoreMirror] Server dimulai ulang saat jeda kuota masih aktif, menjadwalkan percobaan otomatis lagi.');
  scheduleFirestoreQuotaRetry();
}

function handleFirestoreQuotaError(err: any, label: string): boolean {
  const errMsg = err?.message || String(err);
  const isQuotaError =
    errMsg.includes('RESOURCE_EXHAUSTED') ||
    errMsg.includes('Quota exceeded') ||
    err?.code === 'resource-exhausted' ||
    err?.code === 8;
  if (isQuotaError) {
    isFirestoreMirrorDisabled = true;
    try { fs.writeFileSync(FIRESTORE_QUOTA_FLAG_FILE, Date.now().toString(), 'utf-8'); } catch {}
    console.warn(`[${label}] Kuota Firestore habis, mirroring dinonaktifkan sementara (akan dicoba lagi otomatis dalam ${Math.round(FIRESTORE_QUOTA_COOLDOWN_MS / 60000)} menit).`);
    scheduleFirestoreQuotaRetry();
  } else {
    console.warn(`[${label}] Gagal mencadangkan ke Cloud Firestore:`, err);
  }
  return isQuotaError;
}

// Gabungkan cadangan papan antrean yang SUDAH ADA di awan dengan yang mau ditulis.
//
// KENAPA: berbeda dari arsip harian yang sudah kita lindungi, snapshot papan antrean
// dulu ditulis dengan setDoc apa adanya - menimpa utuh, tanpa membaca lebih dulu dan
// tanpa penjaga. Artinya instance mana pun yang kebetulan gambarannya kurang lengkap
// langsung menjadikan kekurangannya sebagai kebenaran baru di awan, dan saat wadah
// server berikutnya menyala ia memulihkan versi yang sudah cacat itu. Kerusakannya
// lalu mengalir ke register harian lewat sinkronisasi. Ini kelas kerusakan yang sama
// dengan 19 September 2026, hanya di bagian yang saat itu belum ikut ditutup.
//
// Penggabungan ini TIDAK menghalangi penghapusan yang sah: pasien yang memang dihapus
// atau dibersihkan tetap tersaring lewat tombstone, dan "Bersihkan Antrean" tetap bisa
// mengosongkan papan sepenuhnya.
function gabungkanSnapshotAntrean(cloud: any, lokal: any): { hasil: any; ditahan: string[] } {
  if (!cloud || typeof cloud !== 'object') return { hasil: lokal, ditahan: [] };
  if (!lokal || typeof lokal !== 'object') return { hasil: lokal, ditahan: [] };

  // Reset yang sah HARUS tetap bisa mengosongkan papan: kalau sisi lokal memang
  // membawa penanda reset (isExplicitReset / resetConfirmed) dengan 0 pasien,
  // jangan masukkan kembali pasien lama dari cloud.
  const isResetLokal = (lokal.isExplicitReset === true || lokal.resetConfirmed === true)
    && (!Array.isArray(lokal.patients) || lokal.patients.length === 0);
  if (isResetLokal) return { hasil: lokal, ditahan: [] };

  const ditolakId = new Set<string>([
    ...tombstoneResetPermanen,
    ...(Array.isArray(lokal.deletedPatientIds) ? lokal.deletedPatientIds.map(String) : []),
    ...(Array.isArray(lokal.preResetPatientIds) ? lokal.preResetPatientIds.map(String) : []),
  ]);

  const pasienLokal: any[] = Array.isArray(lokal.patients) ? lokal.patients : [];
  const pasienCloud: any[] = Array.isArray(cloud.patients) ? cloud.patients : [];

  const peta = new Map<string, any>();
  pasienLokal.forEach((p) => { if (p && p.id) peta.set(p.id, { ...p }); });

  const ditahan: string[] = [];
  pasienCloud.forEach((cp) => {
    if (!cp || !cp.id || ditolakId.has(String(cp.id))) return;
    const lp = peta.get(cp.id);
    if (!lp) {
      // Pasien masih ada di cadangan awan dan BELUM pernah dihapus/dibersihkan secara sah -> tahan
      peta.set(cp.id, { ...cp });
      ditahan.push(cp.id);
    } else {
      // Ada di kedua sisi: satukan status ceklis tanpa memundurkannya.
      //
      // URUTAN ARGUMENNYA PENTING. pickCompletionState(existing, incoming) memperlakukan
      // sisi KEDUA sebagai klaim yang lebih baru. Sisi yang lebih baru di sini adalah
      // sisi LOKAL - dialah yang baru saja memproses tindakan petugas - sedangkan
      // cadangan awan justru yang lebih tua. Kalau urutannya terbalik, cadangan lama
      // dianggap klaim baru, dan pembatalan ceklis yang SAH dari petugas langsung
      // dikembalikan jadi "selesai" lagi - ceklis terlihat berkedip sendiri.
      const { completed, completionUpdatedAt } = pickCompletionState(cp, lp);
      peta.set(cp.id, {
        ...cp,
        ...lp,
        completed,
        completionUpdatedAt,
        calledCount: Math.max(Number(lp.calledCount || 0), Number(cp.calledCount || 0)),
        lastCalledAt: (lp.lastCalledAt && (!cp.lastCalledAt || new Date(lp.lastCalledAt) >= new Date(cp.lastCalledAt)))
          ? lp.lastCalledAt
          : (cp.lastCalledAt || lp.lastCalledAt),
      });
    }
  });

  const kotakLokal: any[] = Array.isArray(lokal.boxes) ? lokal.boxes : [];
  const kotakCloud: any[] = Array.isArray(cloud.boxes) ? cloud.boxes : [];
  const hapusKotak = new Set<string>(Array.isArray(lokal.deletedBoxIds) ? lokal.deletedBoxIds.map(String) : []);
  const idKotakLokal = new Set<string>(kotakLokal.map((b) => b && b.id).filter(Boolean));
  const kotakGabung = [...kotakLokal];
  kotakCloud.forEach((cb) => {
    if (cb && cb.id && !idKotakLokal.has(cb.id) && !hapusKotak.has(String(cb.id))) {
      kotakGabung.push(cb);
    }
  });

  return {
    hasil: {
      ...cloud,
      ...lokal,
      patients: Array.from(peta.values()),
      boxes: kotakGabung,
    },
    ditahan,
  };
}

// ---------------------------------------------------------------------------
// Firestore Mirror Channels with Debounce + MaxWait Guarantees
// ---------------------------------------------------------------------------
// 1. Queue State (Antrean Utama)
let mirrorDebounceTimer: NodeJS.Timeout | null = null;
let mirrorMaxWaitTimer: NodeJS.Timeout | null = null;
let pendingMirrorState: any = null;

async function flushQueueStateMirrorNow(): Promise<void> {
  if (mirrorDebounceTimer) {
    clearTimeout(mirrorDebounceTimer);
    mirrorDebounceTimer = null;
  }
  if (mirrorMaxWaitTimer) {
    clearTimeout(mirrorMaxWaitTimer);
    mirrorMaxWaitTimer = null;
  }
  if (isFirestoreMirrorDisabled) return;

  const currentState = pendingMirrorState;
  if (!currentState) return;

  try {
    const sanitized = JSON.parse(JSON.stringify(currentState));

    // Baca dulu apa yang SUDAH ada di cadangan awan, lalu gabungkan.
    let cloudState: any = null;
    try {
      const snapshot = await getDoc(QUEUE_STATE_DOC_REF);
      if (snapshot.exists()) {
        cloudState = snapshot.data();
      }
    } catch (readErr: any) {
      if (handleFirestoreQuotaError(readErr, 'QueueStateMirror-Read')) return;
      console.warn('[QueueStateMirror] Tidak bisa membaca cadangan papan antrean, penulisan dilewati agar tidak menimpa data yang ada.');
      return;
    }

    const { hasil: merged, ditahan } = gabungkanSnapshotAntrean(cloudState, sanitized);

    if (ditahan.length > 0) {
      console.log(`[QueueStateMirror] Menahan ${ditahan.length} pasien dari cadangan awan yang belum ada di disk lokal instance ini: ${ditahan.join(', ')}`);
      // Lengkapi juga disk lokal instance ini supaya tidak terus berbeda
      try {
        const diskState = loadStateFromFile();
        if (diskState && Array.isArray(diskState.patients)) {
          const diskIds = new Set(diskState.patients.map((p: any) => p && p.id).filter(Boolean));
          const tambahan = (merged.patients || []).filter((p: any) => p && p.id && !diskIds.has(p.id));
          if (tambahan.length > 0) {
            diskState.patients = [...diskState.patients, ...tambahan];
            safeAtomicWriteJson(DB_FILE, diskState);
            broadcastUpdate({ type: 'SYNC_STATE', state: diskState });
          }
        }
      } catch (localErr) {
        console.warn('[QueueStateMirror] Gagal melengkapi disk lokal dengan pasien yang ditahan:', localErr);
      }
    }

    await setDoc(QUEUE_STATE_DOC_REF, {
      ...merged,
      lastMirroredAt: new Date().toISOString(),
    });
  } catch (err: any) {
    handleFirestoreQuotaError(err, 'FirestoreMirror');
  }
}

async function mirrorStateToFirestore(state: any): Promise<void> {
  pendingMirrorState = state;

  // If Firestore mirror is disabled due to quota exhaustion, exit immediately
  if (isFirestoreMirrorDisabled) {
    return;
  }

  // Jaring pengaman MaxWait: hanya dijadwalkan saat belum ada timer maxWait yang berjalan.
  // Tidak di-reset oleh perubahan susulan, menjamin penulisan terjadi maksimal 5s sejak perubahan pertama.
  if (!mirrorMaxWaitTimer) {
    mirrorMaxWaitTimer = setTimeout(() => {
      flushQueueStateMirrorNow().catch((err) => console.warn('[FirestoreMirror] MaxWait flush error:', err));
    }, 5000);
  }

  if (mirrorDebounceTimer) {
    clearTimeout(mirrorDebounceTimer);
  }

  // Debounce writes by 5s to batch rapid changes and minimize write units
  mirrorDebounceTimer = setTimeout(() => {
    flushQueueStateMirrorNow().catch((err) => console.warn('[FirestoreMirror] Debounce flush error:', err));
  }, 5000);
}

// ---------------------------------------------------------------------------
// 2. Mirror & Hydrate for Daily Archive (Laporan Harian & Bulanan per Terapis)
// ---------------------------------------------------------------------------
const DAILY_ARCHIVE_MONTHS_COLLECTION = 'daily_archive_months';
function dailyArchiveMonthDocRef(monthKey: string) {
  return doc(serverFirestoreDb, DAILY_ARCHIVE_MONTHS_COLLECTION, monthKey);
}

// Cadangan PER TANGGAL - satu dokumen untuk satu hari.
//
// KENAPA ADA DUA BENTUK CADANGAN:
// Dokumen per-bulan menyimpan seluruh tanggal dalam satu dokumen, jadi menulisnya
// sama saja dengan menyatakan "inilah SELURUH tanggal bulan ini". Satu instance yang
// datanya kurang lengkap otomatis menghapus tanggal yang tidak dia punya - persis yang
// terjadi 19 September 2026 pukul 11.17 WIB, dua hari kunjungan lenyap sekaligus.
//
// Bentuk per-tanggal tidak punya sifat itu. Menulis dokumen 2026-09-19 tidak
// mengatakan apa pun tentang 2026-09-18. Tanggal yang tidak dipunyai sebuah instance
// sama sekali tidak tersentuh olehnya - tidak bisa dirusak karena tidak pernah ditulis.
// Kerusakan terparah dari satu penulisan yang salah jadi terbatas pada SATU HARI.
//
// Keduanya tetap ditulis dengan sengaja. Dua salinan berbentuk berbeda di tempat
// berbeda; kalau salah satu jalur bermasalah, satunya lagi masih utuh. Pemulihan saat
// server menyala membaca dua-duanya lalu menggabungkannya.
const DAILY_ARCHIVE_DAYS_COLLECTION = 'daily_archive_days';
function dailyArchiveDayDocRef(dateKey: string) {
  return doc(serverFirestoreDb, DAILY_ARCHIVE_DAYS_COLLECTION, dateKey);
}

// Sidik isi tanggal yang terakhir berhasil dicadangkan instance ini, supaya tanggal
// yang tidak berubah tidak ditulis ulang. Inilah yang membuat hari-hari yang sudah
// lewat praktis membeku: begitu tercadangkan dan tidak ada perubahan, ia tidak pernah
// disentuh lagi sepanjang instance ini hidup.
const sidikTanggalTercadangkan = new Map<string, string>();

function sidikKunjungan(visits: any[]): string {
  if (!Array.isArray(visits)) return '0';
  return visits.length + ':' + visits.map((v: any) => v && v.id).sort().join(',');
}

// Menyatukan dua daftar kunjungan pada SATU tanggal berdasarkan id.
function mergeVisitsById(base: any[], incoming: any[]): any[] {
  const map = new Map<string, any>();
  (Array.isArray(base) ? base : []).forEach((v: any) => { if (v && v.id) map.set(v.id, v); });
  (Array.isArray(incoming) ? incoming : []).forEach((v: any) => {
    if (v && v.id) map.set(v.id, { ...map.get(v.id), ...v });
  });
  return Array.from(map.values());
}

// Mencadangkan satu tanggal ke dokumennya sendiri. Dibaca dulu lalu digabung, supaya
// instance yang salinan harinya tertinggal tidak mengurangi isi yang sudah tersimpan.
// Mengembalikan true kalau tanggal itu aman tercadangkan.
async function mirrorSatuTanggal(dateKey: string, visits: any[]): Promise<boolean> {
  try {
    let existing: any[] = [];
    try {
      const snap = await getDoc(dailyArchiveDayDocRef(dateKey));
      if (snap.exists()) {
        const d = snap.data();
        if (Array.isArray(d?.visits)) existing = d.visits;
      }
    } catch (readErr: any) {
      if (handleFirestoreQuotaError(readErr, 'DailyArchiveDay-Read')) return false;
      console.warn(`[DailyArchiveDay] Tidak bisa membaca cadangan tanggal ${dateKey}, penulisan dilewati agar tidak mengurangi isinya.`);
      return false;
    }

    const gabung = mergeVisitsById(existing, Array.isArray(visits) ? visits : []);
    if (gabung.length < existing.length) {
      console.warn(`[DailyArchiveDay] Penulisan ${dateKey} dibatalkan: hasil gabungan (${gabung.length}) lebih sedikit dari yang tersimpan (${existing.length}).`);
      return false;
    }

    await setDoc(dailyArchiveDayDocRef(dateKey), {
      dateKey,
      visits: JSON.parse(JSON.stringify(gabung)),
      lastMirroredAt: new Date().toISOString(),
    });
    return true;
  } catch (err: any) {
    handleFirestoreQuotaError(err, 'DailyArchiveDay');
    return false;
  }
}
const dailyArchiveMirrorDebounceTimers = new Map<string, NodeJS.Timeout>();
const dailyArchiveMirrorMaxWaitTimers = new Map<string, NodeJS.Timeout>();
const pendingDailyArchiveMirrors = new Map<string, Record<string, any[]>>();

// Menyatukan dua versi arsip satu bulan. Tanggal yang hanya ada di salah satu sisi
// TETAP IKUT; untuk tanggal yang ada di dua-duanya, kunjungan disatukan per id dan
// versi yang masuk (dari disk instance ini) menang per-field.
//
// Aman dilakukan karena arsip harian TIDAK PERNAH menghapus kunjungan - ketiga jalur
// penulisannya (endpoint /visit, /batch, dan penyelarasan antrean) semuanya hanya
// menambah atau memperbarui berdasarkan id. Jadi penggabungan ini tidak bisa
// menghidupkan kembali sesuatu yang sengaja dihapus, karena memang tidak ada
// mekanisme penghapusan yang perlu dihormati.
function mergeArchiveMonths(base: any, incoming: any): Record<string, any[]> {
  const out: Record<string, any[]> = {};
  const tanggal = new Set<string>([
    ...Object.keys(base && typeof base === 'object' ? base : {}),
    ...Object.keys(incoming && typeof incoming === 'object' ? incoming : {}),
  ]);
  tanggal.forEach((d) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return;
    const map = new Map<string, any>();
    const sisiLama = Array.isArray(base?.[d]) ? base[d] : [];
    const sisiBaru = Array.isArray(incoming?.[d]) ? incoming[d] : [];
    sisiLama.forEach((v: any) => { if (v && v.id) map.set(v.id, v); });
    sisiBaru.forEach((v: any) => { if (v && v.id) map.set(v.id, { ...map.get(v.id), ...v }); });
    out[d] = Array.from(map.values());
  });
  return out;
}

async function flushArchiveMonthMirrorNow(monthKey: string): Promise<void> {
  const existingTimer = dailyArchiveMirrorDebounceTimers.get(monthKey);
  if (existingTimer) clearTimeout(existingTimer);
  dailyArchiveMirrorDebounceTimers.delete(monthKey);
  const maxWaitTimer = dailyArchiveMirrorMaxWaitTimers.get(monthKey);
  if (maxWaitTimer) clearTimeout(maxWaitTimer);
  dailyArchiveMirrorMaxWaitTimers.delete(monthKey);

  if (isFirestoreMirrorDisabled) return;
  const current = pendingDailyArchiveMirrors.get(monthKey);
  pendingDailyArchiveMirrors.delete(monthKey);
  if (!current) return;

  // Menunda pencadangan tanpa membuang datanya: dikembalikan ke antrean lalu dicoba
  // lagi sebentar kemudian. Dipakai kalau kita TIDAK BISA memastikan isi cadangan
  // yang sekarang - lebih baik telat mencadangkan daripada menimpa data yang baik.
  const tundaDanCobaLagi = (alasan: string) => {
    const tertunda = pendingDailyArchiveMirrors.get(monthKey);
    pendingDailyArchiveMirrors.set(monthKey, tertunda ? mergeArchiveMonths(current, tertunda) : current);
    console.warn(`[DailyArchiveMirror] ${alasan} - pencadangan arsip ${monthKey} DITUNDA, data lokal tidak dibuang dan akan dicoba lagi.`);
    if (!dailyArchiveMirrorDebounceTimers.has(monthKey)) {
      dailyArchiveMirrorDebounceTimers.set(monthKey, setTimeout(() => { void flushArchiveMonthMirrorNow(monthKey); }, 30000));
    }
  };

  try {
    const sanitized = JSON.parse(JSON.stringify(current));

    // Baca dulu apa yang SUDAH ada di cadangan, lalu gabungkan.
    //
    // KENAPA: setDoc menimpa dokumen secara utuh. Sebelumnya isi disk instance ini
    // langsung ditulis apa adanya, sehingga instance yang kebetulan datanya belum
    // lengkap - misalnya wadah baru yang pemulihannya tidak sempat/tidak penuh -
    // MENGHAPUS tanggal-tanggal yang sebenarnya masih tersimpan di cadangan. Persis
    // itu yang terjadi pada 19 September 2026 pukul 11.17 WIB: dokumen bulan September
    // ditimpa salinan yang hanya berisi sampai 17 September, dan kunjungan dua hari
    // hilang tanpa jejak. Sejak sekarang penulisan hanya boleh MENAMBAH.
    let cloudArchive: any = null;
    try {
      const snapshot = await getDoc(dailyArchiveMonthDocRef(monthKey));
      cloudArchive = snapshot.exists() ? snapshot.data()?.archive : null;
    } catch (readErr: any) {
      if (handleFirestoreQuotaError(readErr, 'DailyArchiveMirror-Read')) return;
      tundaDanCobaLagi('Tidak bisa membaca cadangan yang sekarang');
      return;
    }

    const merged = (cloudArchive && typeof cloudArchive === 'object')
      ? mergeArchiveMonths(cloudArchive, sanitized)
      : sanitized;

    // Penjaga terakhir: kalau karena alasan apa pun hasil gabungan justru KEHILANGAN
    // tanggal yang sudah ada di cadangan, batalkan. Dengan penggabungan di atas ini
    // seharusnya mustahil - justru itu gunanya, supaya kekeliruan di kemudian hari
    // tertahan di sini, bukan diketahui setelah data hilang.
    if (cloudArchive && typeof cloudArchive === 'object') {
      const hilang = Object.keys(cloudArchive).filter(
        (d) => /^\d{4}-\d{2}-\d{2}$/.test(d)
          && Array.isArray(cloudArchive[d]) && cloudArchive[d].length > 0
          && (!Array.isArray(merged[d]) || merged[d].length === 0)
      );
      if (hilang.length > 0) {
        tundaDanCobaLagi(`Penulisan dibatalkan karena akan menghilangkan tanggal: ${hilang.join(', ')}`);
        return;
      }
    }

    // Cadangan PER TANGGAL dulu, baru yang per-bulan. Bentuk per-tanggal yang lebih
    // aman didahulukan supaya kalau penulisan per-bulan gagal, salinan hariannya sudah
    // mendarat. Yang ditulis HANYA tanggal yang benar-benar dipunyai instance ini
    // (ada di sanitized) DAN isinya berubah sejak terakhir tercadangkan - jadi hari
    // yang sudah lewat tidak pernah ditulis ulang tanpa alasan.
    for (const dateKey of Object.keys(sanitized)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) continue;
      const isiTanggal = Array.isArray(merged[dateKey]) ? merged[dateKey] : sanitized[dateKey];
      const sidik = sidikKunjungan(isiTanggal);
      if (sidikTanggalTercadangkan.get(dateKey) === sidik) continue;
      const berhasil = await mirrorSatuTanggal(dateKey, isiTanggal);
      if (berhasil) sidikTanggalTercadangkan.set(dateKey, sidik);
    }

    await setDoc(dailyArchiveMonthDocRef(monthKey), { archive: merged, lastMirroredAt: new Date().toISOString() });

    // Simpan hasil gabungan ke disk lokal juga (TANPA memicu pencadangan lagi), supaya
    // instance yang tadinya datanya belum lengkap ikut lengkap setelah satu putaran.
    try {
      const lokal = loadArchiveMonth(monthKey);
      const lokalGabung = mergeArchiveMonths(lokal, merged);
      if (JSON.stringify(lokalGabung) !== JSON.stringify(lokal)) {
        saveArchiveMonthLocalOnly(monthKey, lokalGabung);
        console.log(`[DailyArchiveMirror] Disk lokal ikut dilengkapi dari cadangan untuk ${monthKey}.`);
      }
    } catch (localErr) {
      console.warn('[DailyArchiveMirror] Gagal melengkapi disk lokal:', localErr);
    }
  } catch (err: any) {
    if (!handleFirestoreQuotaError(err, 'DailyArchiveMirror')) {
      tundaDanCobaLagi('Penulisan cadangan gagal');
    }
  }
}

async function mirrorArchiveMonthToFirestore(monthKey: string, data: Record<string, any[]>) {
  // PENTING: catat dulu data TERBARU yang ingin dicadangkan, SEBELUM memeriksa apakah
  // mirroring sedang dijeda karena kuota habis. Urutan yang salah (cek dulu, baru catat)
  // membuat penulisan arsip yang terjadi PERSIS selama jeda kuota hilang sepenuhnya -
  // tidak pernah dicoba lagi walau jedanya sudah selesai - persis gejala jumlah kunjungan
  // hari itu yang tiba-tiba menyusut drastis setelah server sempat restart.
  pendingDailyArchiveMirrors.set(monthKey, data);
  if (isFirestoreMirrorDisabled) return;

  if (!dailyArchiveMirrorMaxWaitTimers.has(monthKey)) {
    const maxTimer = setTimeout(() => {
      flushArchiveMonthMirrorNow(monthKey).catch((err) => console.warn(`[DailyArchiveMirror] MaxWait flush error (${monthKey}):`, err));
    }, 5000);
    dailyArchiveMirrorMaxWaitTimers.set(monthKey, maxTimer);
  }

  const existingTimer = dailyArchiveMirrorDebounceTimers.get(monthKey);
  if (existingTimer) clearTimeout(existingTimer);
  const timer = setTimeout(() => {
    flushArchiveMonthMirrorNow(monthKey).catch((err) => console.warn(`[DailyArchiveMirror] Debounce flush error (${monthKey}):`, err));
  }, 5000);
  dailyArchiveMirrorDebounceTimers.set(monthKey, timer);
}

async function hydrateDailyArchiveFromFirestoreIfNeeded() {
  try {
    // Dulu di sini ada pintasan: "kalau disk lokal sudah punya isi, jangan tarik dari
    // cloud". Pintasan itu berbahaya. Instance yang datanya cuma sebagian - misalnya
    // baru sempat mencatat satu kunjungan hari ini - dianggap sudah lengkap, tidak
    // pernah menarik sisanya, lalu penulisan berikutnya MENIMPA cadangan dengan
    // isinya yang bolong. Sekarang cadangan SELALU ditarik lalu DIGABUNG dengan yang
    // ada di disk, jadi instance ini tidak mungkin lagi punya gambaran yang kurang.
    let totalDates = 0;

    // 1. Coba pulihkan dari koleksi per-bulan (format baru)
    try {
      const snapshot = await getDocs(collection(serverFirestoreDb, DAILY_ARCHIVE_MONTHS_COLLECTION));
      snapshot.forEach((docSnap) => {
        const archive = docSnap.data()?.archive;
        if (archive && typeof archive === 'object' && Object.keys(archive).length > 0) {
          const lokal = loadArchiveMonth(docSnap.id);
          const gabung = mergeArchiveMonths(lokal, archive);
          if (JSON.stringify(gabung) !== JSON.stringify(lokal)) {
            saveArchiveMonthLocalOnly(docSnap.id, gabung);
          }
          totalDates += Object.keys(gabung).length;
        }
      });
    } catch (err) {
      console.warn('[FirestoreHydrate] Gagal memulihkan daily_archive_months:', err);
    }

    // 1b. Tarik juga cadangan PER TANGGAL lalu gabungkan. Bentuk ini lebih tahan
    // terhadap penulisan yang tidak lengkap, jadi ia yang paling mungkin menyimpan
    // hari-hari terakhir dengan utuh. Digabung, bukan menimpa - sama seperti di atas.
    try {
      const daySnapshot = await getDocs(collection(serverFirestoreDb, DAILY_ARCHIVE_DAYS_COLLECTION));
      const perBulan = new Map<string, Record<string, any[]>>();
      daySnapshot.forEach((docSnap) => {
        const dateKey = docSnap.id;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return;
        const visits = docSnap.data()?.visits;
        if (!Array.isArray(visits) || visits.length === 0) return;
        const monthKey = dateKey.slice(0, 7);
        const bucket = perBulan.get(monthKey) || {};
        bucket[dateKey] = visits;
        perBulan.set(monthKey, bucket);
      });
      perBulan.forEach((isi, monthKey) => {
        const lokal = loadArchiveMonth(monthKey);
        const gabung = mergeArchiveMonths(lokal, isi);
        if (JSON.stringify(gabung) !== JSON.stringify(lokal)) {
          saveArchiveMonthLocalOnly(monthKey, gabung);
          console.log(`[FirestoreHydrate] Cadangan per-tanggal melengkapi ${monthKey} menjadi ${Object.keys(gabung).length} tanggal.`);
        }
        totalDates = Math.max(totalDates, Object.keys(gabung).length);
      });
    } catch (err) {
      console.warn('[FirestoreHydrate] Gagal memulihkan daily_archive_days:', err);
    }
    if (totalDates === 0) {
      try {
        const legacySnapshot = await getDoc(DAILY_ARCHIVE_DOC_REF);
        if (legacySnapshot.exists()) {
          const legacyArchive = legacySnapshot.data()?.archive;
          if (legacyArchive && typeof legacyArchive === 'object' && Object.keys(legacyArchive).length > 0) {
            // Digabung dengan yang sudah ada di disk, bukan ditimpa - alasan sama
            // seperti di jalur per-bulan di atas.
            const gabungLegacy = mergeArchiveMonths(loadFullDailyArchive(), legacyArchive);
            saveFullDailyArchive(gabungLegacy);
            totalDates = Object.keys(gabungLegacy).length;
          }
        }
      } catch (err) {
        console.warn('[FirestoreHydrate] Gagal memulihkan daily_archive (format lama):', err);
      }
    }
    if (totalDates > 0) {
      console.log(`[FirestoreHydrate] Memulihkan ${totalDates} tanggal arsip dari Firestore.`);
    }
  } catch (err) {
    console.warn('[FirestoreHydrate] Gagal memulihkan daily_archive:', err);
  }
}

// ---------------------------------------------------------------------------
// 3. Mirror & Hydrate for Master Patients (Database Pasien)
// ---------------------------------------------------------------------------
let masterPatientsMirrorDebounceTimer: NodeJS.Timeout | null = null;
let masterPatientsMirrorMaxWaitTimer: NodeJS.Timeout | null = null;
let pendingMasterPatientsMirror: any[] | null = null;

async function flushMasterPatientsMirrorNow(): Promise<void> {
  if (masterPatientsMirrorDebounceTimer) {
    clearTimeout(masterPatientsMirrorDebounceTimer);
    masterPatientsMirrorDebounceTimer = null;
  }
  if (masterPatientsMirrorMaxWaitTimer) {
    clearTimeout(masterPatientsMirrorMaxWaitTimer);
    masterPatientsMirrorMaxWaitTimer = null;
  }
  if (isFirestoreMirrorDisabled) return;

  const current = pendingMasterPatientsMirror;
  if (!current) return;

  try {
    const sanitized = JSON.parse(JSON.stringify(current));
    await setDoc(MASTER_PATIENTS_DOC_REF, { patients: sanitized, lastMirroredAt: new Date().toISOString() });
  } catch (err: any) {
    handleFirestoreQuotaError(err, 'MasterPatientsMirror');
  }
}

async function mirrorMasterPatientsToFirestore(patients: any[]): Promise<void> {
  // Catat dulu data TERBARU sebelum memeriksa jeda kuota - lihat komentar di
  // mirrorArchiveMonthToFirestore untuk alasannya.
  pendingMasterPatientsMirror = patients;
  if (isFirestoreMirrorDisabled) return;

  if (!masterPatientsMirrorMaxWaitTimer) {
    masterPatientsMirrorMaxWaitTimer = setTimeout(() => {
      flushMasterPatientsMirrorNow().catch((err) => console.warn('[MasterPatientsMirror] MaxWait flush error:', err));
    }, 5000);
  }

  if (masterPatientsMirrorDebounceTimer) clearTimeout(masterPatientsMirrorDebounceTimer);
  masterPatientsMirrorDebounceTimer = setTimeout(() => {
    flushMasterPatientsMirrorNow().catch((err) => console.warn('[MasterPatientsMirror] Debounce flush error:', err));
  }, 5000);
}

async function hydrateMasterPatientsFromFirestoreIfNeeded(): Promise<void> {
  try {
    if (fs.existsSync(MASTER_PATIENTS_FILE)) {
      try {
        const raw = JSON.parse(fs.readFileSync(MASTER_PATIENTS_FILE, 'utf-8'));
        if (Array.isArray(raw) && raw.length > 0) return;
      } catch {}
    }
    const snapshot = await getDoc(MASTER_PATIENTS_DOC_REF);
    if (!snapshot.exists()) return;
    const cloudPatients = snapshot.data()?.patients;
    if (Array.isArray(cloudPatients) && cloudPatients.length > 0) {
      console.log(`[FirestoreHydrate] Memulihkan ${cloudPatients.length} master pasien dari Firestore.`);
      safeAtomicWriteJson(MASTER_PATIENTS_FILE, cloudPatients);
    }
  } catch (err) {
    console.warn('[FirestoreHydrate] Gagal memulihkan master_patients:', err);
  }
}

// ---------------------------------------------------------------------------
// 4. Mirror & Hydrate for Ranap History (Riwayat Antrean Rawat Inap)
// ---------------------------------------------------------------------------
let ranapHistoryMirrorDebounceTimer: NodeJS.Timeout | null = null;
let ranapHistoryMirrorMaxWaitTimer: NodeJS.Timeout | null = null;
let pendingRanapHistoryMirror: any[] | null = null;

async function flushRanapHistoryMirrorNow(): Promise<void> {
  if (ranapHistoryMirrorDebounceTimer) {
    clearTimeout(ranapHistoryMirrorDebounceTimer);
    ranapHistoryMirrorDebounceTimer = null;
  }
  if (ranapHistoryMirrorMaxWaitTimer) {
    clearTimeout(ranapHistoryMirrorMaxWaitTimer);
    ranapHistoryMirrorMaxWaitTimer = null;
  }
  if (isFirestoreMirrorDisabled) return;

  const current = pendingRanapHistoryMirror;
  if (!current) return;

  try {
    const sanitized = JSON.parse(JSON.stringify(current));
    await setDoc(RANAP_HISTORY_DOC_REF, { history: sanitized, lastMirroredAt: new Date().toISOString() });
  } catch (err: any) {
    handleFirestoreQuotaError(err, 'RanapHistoryMirror');
  }
}

async function mirrorRanapHistoryToFirestore(history: any[]): Promise<void> {
  // Catat dulu data TERBARU sebelum memeriksa jeda kuota - lihat komentar di
  // mirrorArchiveMonthToFirestore untuk alasannya.
  pendingRanapHistoryMirror = history;
  if (isFirestoreMirrorDisabled) return;

  if (!ranapHistoryMirrorMaxWaitTimer) {
    ranapHistoryMirrorMaxWaitTimer = setTimeout(() => {
      flushRanapHistoryMirrorNow().catch((err) => console.warn('[RanapHistoryMirror] MaxWait flush error:', err));
    }, 5000);
  }

  if (ranapHistoryMirrorDebounceTimer) clearTimeout(ranapHistoryMirrorDebounceTimer);
  ranapHistoryMirrorDebounceTimer = setTimeout(() => {
    flushRanapHistoryMirrorNow().catch((err) => console.warn('[RanapHistoryMirror] Debounce flush error:', err));
  }, 5000);
}

async function hydrateRanapHistoryFromFirestoreIfNeeded(): Promise<void> {
  try {
    if (fs.existsSync(RANAP_HISTORY_FILE)) {
      try {
        const raw = JSON.parse(fs.readFileSync(RANAP_HISTORY_FILE, 'utf-8'));
        if (Array.isArray(raw) && raw.length > 0) return;
      } catch {}
    }
    const snapshot = await getDoc(RANAP_HISTORY_DOC_REF);
    if (!snapshot.exists()) return;
    const cloudHistory = snapshot.data()?.history;
    if (Array.isArray(cloudHistory) && cloudHistory.length > 0) {
      console.log(`[FirestoreHydrate] Memulihkan ${cloudHistory.length} riwayat ranap dari Firestore.`);
      safeAtomicWriteJson(RANAP_HISTORY_FILE, cloudHistory);
    }
  } catch (err) {
    console.warn('[FirestoreHydrate] Gagal memulihkan ranap_history:', err);
  }
}

// Dipanggil sekali saat server baru menyala. Kalau file lokal ternyata kosong/baru
// (indikasi instance baru/di-recycle oleh platform hosting), pulihkan dari cadangan
// Cloud Firestore sebelum mulai melayani request.
async function hydrateStateFromFirestoreIfNeeded(): Promise<void> {
  try {
    // Cek file mentah secara langsung (TANPA lewat loadStateFromFile()) supaya kita
    // tidak memicu efek samping auto-create-nya (yang akan langsung menulis state
    // kosong ke Firestore juga & bisa balapan menimpa cadangan yang baik).
    if (fs.existsSync(DB_FILE)) {
      try {
        const raw = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
        if (raw && typeof raw === 'object' && Array.isArray(raw.boxes)) {
          // File lokal sudah valid dan terkonfigurasi, tidak perlu menimpa dengan snapshot lama
          return;
        }
      } catch {
        // file corrupt, lanjutkan hydrate
      }
    }

    const snapshot = await getDoc(QUEUE_STATE_DOC_REF);
    if (!snapshot.exists()) {
      return;
    }

    const cloudState = snapshot.data();
    const cloudHasBoxes = Array.isArray(cloudState?.boxes) && cloudState.boxes.length > 0;
    const cloudHasPatients = Array.isArray(cloudState?.patients) && cloudState.patients.length > 0;
    if (cloudHasBoxes || cloudHasPatients) {
      console.log(`[FirestoreHydrate] File lokal kosong (kemungkinan instance baru/di-restart). Memulihkan ${cloudState?.patients?.length || 0} pasien & ${cloudState?.boxes?.length || 0} kotak dari cadangan Cloud Firestore.`);
      // Cadangan bisa saja masih versi SEBELUM "Bersihkan Antrean" terakhir (mirror
      // terakhir belum sempat terkirim / sedang jeda kuota). Saring dulu di sini,
      // jangan sampai pasien yang sudah dibersihkan ikut dipulihkan lalu tersiar.
      const hasilSaring = terapkanTombstoneReset(cloudState);
      if (hasilSaring.dibuang > 0) {
        console.log(`[ResetTombstone] ${hasilSaring.dibuang} pasien dari cadangan diabaikan karena sudah pernah dibersihkan.`);
      }
      saveStateToFile(cloudState);
    }
  } catch (err) {
    console.warn('[FirestoreHydrate] Gagal memulihkan state dari Cloud Firestore, melanjutkan dengan state lokal:', err);
  }
}

const PERIODIC_FIRESTORE_SYNC_INTERVAL_MS = 15 * 1000;

function supplementStateFromCloud(localState: any, cloudState: any) {
  let changed = false;

  const deletedPatientIds = new Set(Array.isArray(localState.deletedPatientIds) ? localState.deletedPatientIds : []);
  const preResetPatientIds = new Set([
    ...tombstoneResetPermanen,
    ...(Array.isArray(localState.preResetPatientIds) ? localState.preResetPatientIds : [])
  ]);
  const deletedBoxIds = new Set(Array.isArray(localState.deletedBoxIds) ? localState.deletedBoxIds : []);

  const localPatients = Array.isArray(localState.patients) ? localState.patients : [];
  const localPatientMap = new Map<string, any>();
  localPatients.forEach((p) => { if (p && p.id) localPatientMap.set(p.id, { ...p }); });

  const cloudPatients = Array.isArray(cloudState.patients) ? cloudState.patients : [];
  const missingPatients: any[] = [];

  for (const cp of cloudPatients) {
    if (!cp || !cp.id || deletedPatientIds.has(cp.id) || preResetPatientIds.has(cp.id)) continue;
    const lp = localPatientMap.get(cp.id);
    if (!lp) {
      missingPatients.push(cp);
      localPatientMap.set(cp.id, cp);
      changed = true;
    } else {
      // Pasien ada di kedua sisi: harmonisasikan status ceklis tanpa memundurkannya
      const { completed, completionUpdatedAt } = pickCompletionState(lp, cp);
      if (lp.completed !== completed) {
        lp.completed = completed;
        lp.completionUpdatedAt = completionUpdatedAt;
        if (completed && !lp.completedAt) {
          lp.completedAt = cp.completedAt || new Date().toISOString();
        }
        changed = true;
      }
    }
  }

  const localBoxes = Array.isArray(localState.boxes) ? localState.boxes : [];
  const localBoxIds = new Set(localBoxes.map((b) => b && b.id).filter(Boolean));
  const cloudBoxes = Array.isArray(cloudState.boxes) ? cloudState.boxes : [];
  const missingBoxes = cloudBoxes.filter((b) => b && b.id && !localBoxIds.has(b.id) && !deletedBoxIds.has(b.id));
  if (missingBoxes.length > 0) changed = true;

  if (!changed) {
    return { merged: localState, changed: false };
  }

  const mergedPatients = Array.from(localPatientMap.values());

  return {
    merged: {
      ...localState,
      patients: mergedPatients,
      boxes: [...localBoxes, ...missingBoxes],
      isExplicitReset: Boolean(localState.isExplicitReset) && mergedPatients.length === 0,
      resetConfirmed: Boolean(localState.resetConfirmed) && mergedPatients.length === 0,
    },
    changed: true,
  };
}

function startPeriodicFirestoreSync() {
  setInterval(async () => {
    try {
      if (isFirestoreMirrorDisabled) return;
      const snapshot = await getDoc(QUEUE_STATE_DOC_REF);
      if (!snapshot.exists()) return;
      const cloudState = snapshot.data();
      if (!cloudState || (!Array.isArray(cloudState.boxes) && !Array.isArray(cloudState.patients))) return;

      await enqueueQueueWrite(async () => {
        const localState = loadStateFromFile() || getInitialServerState();
        const { merged, changed } = supplementStateFromCloud(localState, cloudState);
        if (!changed) return;
        saveStateToFile(merged);
        broadcastUpdate({ type: 'SYNC_STATE', state: merged });
        console.log('[PeriodicSync] Instance ini menambahkan data yang tadinya belum ada (ditemukan dari instance lain).');
      });
    } catch (err) {
      console.warn('[PeriodicSync] Gagal sinkronisasi periodik dari Firestore:', err);
    }
  }, PERIODIC_FIRESTORE_SYNC_INTERVAL_MS);
}

// Helper: reconcile box content based on contentUpdatedAt recency to prevent race condition regressions
function pickBoxContentBase(existing: any, incoming: any): any {
  if (!existing) return incoming;
  if (!incoming) return existing;
  const exTime = existing.contentUpdatedAt ? new Date(existing.contentUpdatedAt).getTime() : 0;
  const inTime = incoming.contentUpdatedAt ? new Date(incoming.contentUpdatedAt).getTime() : 0;
  if (exTime > inTime) {
    return {
      ...incoming,
      title: existing.title,
      officerName: existing.officerName,
      location: existing.location,
      color: existing.color,
      category: existing.category,
      instructionText: existing.instructionText,
      instructionImageUrl: existing.instructionImageUrl,
      instructionImageUrls: existing.instructionImageUrls,
      autoCallNext: existing.autoCallNext,
      contentUpdatedAt: existing.contentUpdatedAt
    };
  }
  return {
    ...existing,
    ...incoming
  };
}

// ---------------------------------------------------------------------------
// Log Audit Penghapusan & Reset (dipakai fitur "Restore Antrean" untuk
// membedakan pasien yang MEMANG sengaja dihapus/direset dari yang benar-benar
// hilang tanpa sebab - tanpa log ini, alat restore tidak bisa membedakan
// keduanya dan berisiko "menghidupkan lagi" pasien yang sudah sengaja
// dihapus atau sudah lewat setelah "Bersihkan Antrean" rutin).
// ---------------------------------------------------------------------------
function appendDeletionAudit(entry: Record<string, any>) {
  try {
    let list: any[] = [];
    if (fs.existsSync(DELETION_AUDIT_FILE)) {
      try {
        const raw = JSON.parse(fs.readFileSync(DELETION_AUDIT_FILE, 'utf-8'));
        if (Array.isArray(raw)) list = raw;
      } catch {
        // file corrupt, mulai ulang dari daftar kosong
      }
    }
    list.unshift({
      id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      ...entry,
    });
    safeAtomicWriteJson(DELETION_AUDIT_FILE, list.slice(0, 1000));
  } catch (err) {
    console.warn('[DeletionAudit] Gagal menyimpan log audit:', err);
  }
}

function loadDeletionAudit(): any[] {
  try {
    if (fs.existsSync(DELETION_AUDIT_FILE)) {
      const raw = JSON.parse(fs.readFileSync(DELETION_AUDIT_FILE, 'utf-8'));
      if (Array.isArray(raw)) return raw;
    }
  } catch (err) {
    console.warn('[DeletionAudit] Gagal membaca log audit:', err);
  }
  return [];
}

// Deteksi ID pasien/kotak yang BARU PERTAMA KALI muncul di tombstone request ini
// (belum pernah tercatat sebelumnya di existingState), lalu catat detailnya
// (nama, No. RM, kotak, status selesai/belum) SEBELUM data itu difilter hilang
// oleh reconcileQueueStates. Harus dipanggil SEBELUM reconcileQueueStates supaya
// existingState masih punya data lengkap pasien/kotak yang mau dihapus.
function logNewDeletionsForAudit(existingState: any, incomingPayload: any) {
  try {
    const existingDeletedP = new Set(Array.isArray(existingState?.deletedPatientIds) ? existingState.deletedPatientIds : []);
    const incomingDeletedP: string[] = Array.isArray(incomingPayload?.deletedPatientIds) ? incomingPayload.deletedPatientIds : [];
    const existingPatients: any[] = Array.isArray(existingState?.patients) ? existingState.patients : [];
    for (const id of incomingDeletedP) {
      if (id && !existingDeletedP.has(id)) {
        const p = existingPatients.find((x) => x && x.id === id);
        appendDeletionAudit({
          type: 'patient',
          targetId: id,
          targetName: p?.patientName || null,
          medicalRecordNo: p?.medicalRecordNo || null,
          boxId: p?.boxId || null,
          wasCompleted: p ? !!p.completed : null,
        });
      }
    }

    const existingDeletedB = new Set(Array.isArray(existingState?.deletedBoxIds) ? existingState.deletedBoxIds : []);
    const incomingDeletedB: string[] = Array.isArray(incomingPayload?.deletedBoxIds) ? incomingPayload.deletedBoxIds : [];
    const existingBoxes: any[] = Array.isArray(existingState?.boxes) ? existingState.boxes : [];
    for (const id of incomingDeletedB) {
      if (id && !existingDeletedB.has(id)) {
        const b = existingBoxes.find((x) => x && x.id === id);
        appendDeletionAudit({
          type: 'box',
          targetId: id,
          targetName: b?.title || null,
        });
      }
    }
  } catch (err) {
    console.warn('[DeletionAudit] Gagal mendeteksi penghapusan baru:', err);
  }
}

function pickCompletionState(
  existing: any,
  incoming: any
): { completed: boolean; completionUpdatedAt?: string } {
  const exCompleted = Boolean(existing && existing.completed);
  const inCompleted = Boolean(incoming && incoming.completed);

  // Arah 1: Kalau SALAH SATU menandai selesai, selesai SELALU menang kecuali ada
  // pembatalan yang sah. Menandai selesai tidak diperketat supaya tombol ceklis
  // tetap responsif dan tidak tertolak oleh perbedaan waktu antarperangkat.
  if (exCompleted !== inCompleted) {
    const mauBatal = !inCompleted; // existing selesai, incoming meminta batal
    if (mauBatal) {
      // Pembatalan (selesai -> belum) HANYA menang kalau KEDUA sisi berstempel waktu
      // dan stempel pembatalan benar-benar lebih baru daripada stempel penyelesaian.
      // Catatan tanpa stempel adalah catatan paling tua, jadi tidak boleh membatalkan
      // status selesai yang sudah ada.
      const exMs = existing && existing.completionUpdatedAt ? new Date(existing.completionUpdatedAt).getTime() : NaN;
      const inMs = incoming && incoming.completionUpdatedAt ? new Date(incoming.completionUpdatedAt).getTime() : NaN;
      if (!isNaN(exMs) && !isNaN(inMs) && inMs > exMs) {
        return { completed: false, completionUpdatedAt: incoming.completionUpdatedAt };
      }
      return { completed: true, completionUpdatedAt: existing?.completionUpdatedAt };
    } else {
      // incoming menandai selesai
      return {
        completed: true,
        completionUpdatedAt: incoming?.completionUpdatedAt || existing?.completionUpdatedAt || new Date().toISOString(),
      };
    }
  }

  // Kedua sisi sama (sama-sama selesai atau sama-sama belum): pilih stempel terbaru
  const exMs = existing && existing.completionUpdatedAt ? new Date(existing.completionUpdatedAt).getTime() : NaN;
  const inMs = incoming && incoming.completionUpdatedAt ? new Date(incoming.completionUpdatedAt).getTime() : NaN;
  const updatedAt = (!isNaN(inMs) && (isNaN(exMs) || inMs >= exMs))
    ? incoming.completionUpdatedAt
    : (existing?.completionUpdatedAt || incoming?.completionUpdatedAt);

  return { completed: inCompleted, completionUpdatedAt: updatedAt };
}

// Smart State Reconciliation Helper (prevents lost updates when 30+ devices sync simultaneously)
function reconcileQueueStates(existingState: any, incomingPayload: any) {
  if (!existingState) existingState = getInitialServerState();

  const isExplicitReset = (incomingPayload.isExplicitReset === true ||
    incomingPayload.isReset === true ||
    incomingPayload.resetConfirmed === true) && 
    (!Array.isArray(incomingPayload.patients) || incomingPayload.patients.length === 0);

  if (isExplicitReset) {
    const resetTime = incomingPayload.lastResetAt || new Date().toISOString();
    const preResetPatientIds = Array.from(new Set([
      ...(Array.isArray(existingState.preResetPatientIds) ? existingState.preResetPatientIds : []),
      ...(Array.isArray(existingState.patients) ? existingState.patients.map((p: any) => p && p.id).filter(Boolean) : []),
    ])).slice(-2000);
    return {
      boxes: Array.isArray(incomingPayload.boxes) && incomingPayload.boxes.length > 0 ? incomingPayload.boxes : (existingState.boxes || []),
      patients: [],
      callLogs: [],
      notifications: [],
      savedOfficers: Array.isArray(incomingPayload.savedOfficers) ? incomingPayload.savedOfficers : (existingState.savedOfficers || []),
      ranapQueue: Array.isArray(existingState.ranapQueue) ? existingState.ranapQueue : [],
      communicationNotes: Array.isArray(existingState.communicationNotes) ? existingState.communicationNotes : [],
      currentCallingPatient: null,
      currentCallingBox: null,
      isExplicitReset: true,
      resetConfirmed: true,
      lastResetAt: resetTime,
      boxOrderUpdatedAt: incomingPayload.boxOrderUpdatedAt || existingState.boxOrderUpdatedAt || null,
      deletedPatientIds: [],
      preResetPatientIds,
      deletedRanapIds: Array.isArray(existingState.deletedRanapIds) ? existingState.deletedRanapIds : [],
      deletedCommunicationNoteIds: Array.isArray(existingState.deletedCommunicationNoteIds) ? existingState.deletedCommunicationNoteIds : [],
      deletedBoxIds: Array.isArray(existingState.deletedBoxIds) ? existingState.deletedBoxIds : [],
      lastUpdated: new Date().toISOString(),
    };
  }

  // Preserve and determine highest lastResetAt watermark
  const existingResetAt = existingState?.lastResetAt;
  const incomingResetAt = incomingPayload?.lastResetAt;
  let effectiveResetAt = existingResetAt;
  if (incomingResetAt) {
    if (!effectiveResetAt || new Date(incomingResetAt).getTime() > new Date(effectiveResetAt).getTime()) {
      effectiveResetAt = incomingResetAt;
    }
  }
  // 1. Reconcile Patients
  const existingPatients: any[] = Array.isArray(existingState.patients) ? existingState.patients : [];
  const incomingPatients: any[] = Array.isArray(incomingPayload.patients) ? incomingPayload.patients : [];

  // Accumulate deleted patient tombstones across devices and sessions
  const existingDeleted: string[] = Array.isArray(existingState.deletedPatientIds) ? existingState.deletedPatientIds : [];
  const incomingDeleted: string[] = Array.isArray(incomingPayload.deletedPatientIds) ? incomingPayload.deletedPatientIds : [];
  const cumulativeDeletedList = Array.from(new Set([...existingDeleted, ...incomingDeleted])).slice(-1000);
  const deletedPatientIds = new Set(cumulativeDeletedList);

  const preResetPatientIds = new Set<string>(
    Array.isArray(existingState.preResetPatientIds) ? existingState.preResetPatientIds : []
  );

  const patientMap = new Map<string, any>();
  for (const p of existingPatients) {
    if (p && p.id && !deletedPatientIds.has(p.id) && !preResetPatientIds.has(p.id)) {
      patientMap.set(p.id, { ...p });
    }
  }

  for (const inP of incomingPatients) {
    if (!inP || !inP.id || deletedPatientIds.has(inP.id) || preResetPatientIds.has(inP.id)) continue;

    const existing = patientMap.get(inP.id);
    if (!existing) {
      // Percayai jam ASLI device untuk pasien yang benar-benar baru, SELAMA masih masuk akal
      // (tidak di masa depan lebih dari beberapa menit, tidak lebih dari 48 jam ke belakang) -
      // supaya pasien yang diinput lalu perangkatnya dimatikan/offline sebelum sempat
      // tersinkron tetap mencatat jam INPUT ASLINYA untuk laporan respon time, bukan "jam
      // saat online lagi" (gejala yang dilaporkan: respon time tercatat dari saat dibuka,
      // bukan dari saat input). Kalau jam device jelas tidak masuk akal (mis. jam/tanggal
      // salah total), baru pakai jam SERVER sebagai jaring pengaman.
      const nowMs = Date.now();
      const serverNow = new Date(nowMs).toISOString();
      const clientCreatedMs = inP.createdAt ? new Date(inP.createdAt).getTime() : NaN;
      const isPlausibleCreated = !isNaN(clientCreatedMs)
        && clientCreatedMs <= nowMs + 5 * 60 * 1000
        && clientCreatedMs >= nowMs - 48 * 60 * 60 * 1000;
      const effectiveCreatedAt = isPlausibleCreated ? inP.createdAt : serverNow;

      const clientCompletedMs = inP.completedAt ? new Date(inP.completedAt).getTime() : NaN;
      const isPlausibleCompleted = !isNaN(clientCompletedMs)
        && clientCompletedMs <= nowMs + 5 * 60 * 1000
        && clientCompletedMs >= new Date(effectiveCreatedAt).getTime();
      const effectiveCompletedAt = inP.completed
        ? (isPlausibleCompleted ? inP.completedAt : serverNow)
        : inP.completedAt;

      patientMap.set(inP.id, {
        ...inP,
        createdAt: effectiveCreatedAt,
        completedAt: effectiveCompletedAt,
      });
    } else {
      const wasCompleted = Boolean(existing.completed);
      const { completed: isCompleted, completionUpdatedAt } = pickCompletionState(existing, inP);
      const calledCount = Math.max(Number(inP.calledCount || 0), Number(existing.calledCount || 0));

      const lastCalledAt = inP.lastCalledAt && (!existing.lastCalledAt || new Date(inP.lastCalledAt) >= new Date(existing.lastCalledAt))
        ? inP.lastCalledAt
        : existing.lastCalledAt;

      // Kalau hasil akhirnya TIDAK selesai (ceklis dibatalkan), jam selesai lama ikut
      // dibersihkan - jangan sampai ada pasien aktif yang masih menyimpan jam selesai.
      const completedAt = !isCompleted
        ? undefined
        : (!wasCompleted
          ? new Date().toISOString()
          : (inP.completedAt && (!existing.completedAt || new Date(inP.completedAt) >= new Date(existing.completedAt))
            ? inP.completedAt
            : existing.completedAt));

      patientMap.set(inP.id, {
        ...existing,
        ...inP,
        completed: isCompleted,
        completionUpdatedAt,
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
        instructionImageUrl: inP.instructionImageUrl !== undefined ? inP.instructionImageUrl : existing.instructionImageUrl,
        instructionImageUrls: inP.instructionImageUrls !== undefined ? inP.instructionImageUrls : existing.instructionImageUrls,
        instructionPhotos: inP.instructionPhotos !== undefined ? inP.instructionPhotos : existing.instructionPhotos,
        createdAt: existing.createdAt || inP.createdAt || new Date().toISOString()
      });
    }
  }

  const mergedPatients = Array.from(patientMap.values());

  // Reconcile Ranap Queue (Rawat Inap)
  const existingRanapQueue = Array.isArray(existingState.ranapQueue) ? existingState.ranapQueue : [];
  const incomingRanapQueue = Array.isArray(incomingPayload.ranapQueue) ? incomingPayload.ranapQueue : [];
  const existingDeletedRanap = Array.isArray(existingState.deletedRanapIds) ? existingState.deletedRanapIds : [];
  const incomingDeletedRanap = Array.isArray(incomingPayload.deletedRanapIds) ? incomingPayload.deletedRanapIds : [];
  const cumulativeDeletedRanapList = Array.from(new Set([...existingDeletedRanap, ...incomingDeletedRanap])).slice(-1000);
  const deletedRanapIds = new Set(cumulativeDeletedRanapList);
  const ranapMap = new Map<string, any>();
  for (const r of existingRanapQueue) {
    if (r && r.id && !deletedRanapIds.has(r.id)) ranapMap.set(r.id, { ...r });
  }
  for (const inR of incomingRanapQueue) {
    if (!inR || !inR.id || deletedRanapIds.has(inR.id)) continue;
    const existing = ranapMap.get(inR.id);
    ranapMap.set(inR.id, existing
      ? { ...existing, ...inR, createdAt: existing.createdAt || inR.createdAt || new Date().toISOString() }
      : { ...inR, createdAt: inR.createdAt || new Date().toISOString() });
  }
  const mergedRanapQueue = Array.from(ranapMap.values());

  // 2. Reconcile Boxes
  const existingBoxes: any[] = Array.isArray(existingState.boxes) ? existingState.boxes : [];
  const incomingBoxes: any[] = Array.isArray(incomingPayload.boxes) ? incomingPayload.boxes : [];

  const existingDeletedBoxIds: string[] = Array.isArray(existingState.deletedBoxIds) ? existingState.deletedBoxIds : [];
  const incomingDeletedBoxIds: string[] = Array.isArray(incomingPayload.deletedBoxIds) ? incomingPayload.deletedBoxIds : [];
  const cumulativeDeletedBoxList = Array.from(new Set([...existingDeletedBoxIds, ...incomingDeletedBoxIds])).slice(-500);
  const deletedBoxIds = new Set(cumulativeDeletedBoxList);

  const existingOrderWatermark = existingState.boxOrderUpdatedAt
    ? new Date(existingState.boxOrderUpdatedAt).getTime() : 0;
  const incomingOrderWatermark = incomingPayload.boxOrderUpdatedAt
    ? new Date(incomingPayload.boxOrderUpdatedAt).getTime() : 0;
  const isExplicitReorder = incomingBoxes.length > 0
    && incomingOrderWatermark > 0
    && incomingOrderWatermark > existingOrderWatermark;
  const effectiveBoxOrderUpdatedAt = isExplicitReorder
    ? incomingPayload.boxOrderUpdatedAt
    : (existingState.boxOrderUpdatedAt || null);

  const existingBoxMap = new Map<string, any>();
  for (const b of existingBoxes) {
    if (b && b.id && !deletedBoxIds.has(b.id)) {
      existingBoxMap.set(b.id, { ...b });
    }
  }

  const incomingBoxMap = new Map<string, any>();
  for (const b of incomingBoxes) {
    if (b && b.id && !deletedBoxIds.has(b.id)) {
      incomingBoxMap.set(b.id, { ...b });
    }
  }

  const mergedBoxes: any[] = [];
  const seenIds = new Set<string>();

  if (isExplicitReorder) {
    // 1. Maintain incomingBoxes explicit order as determined by user drag-and-drop or reorder actions
    for (let idx = 0; idx < incomingBoxes.length; idx++) {
      const inB = incomingBoxes[idx];
      if (!inB || !inB.id || deletedBoxIds.has(inB.id) || seenIds.has(inB.id)) continue;
      seenIds.add(inB.id);
      const existing = existingBoxMap.get(inB.id);
      if (existing) {
        const base = pickBoxContentBase(existing, inB);
        // Preserve instructionImageUrls if incoming did not supply them or passed undefined
        let finalImageUrls = base.instructionImageUrls;
        if (finalImageUrls === undefined && existing.instructionImageUrls) {
          finalImageUrls = existing.instructionImageUrls;
        }

        mergedBoxes.push(sanitizeServerBox({
          ...base,
          instructionImageUrls: finalImageUrls,
          instructionImageUrl: (Array.isArray(finalImageUrls) && finalImageUrls.length > 0)
            ? finalImageUrls[0]
            : (base.instructionImageUrl || undefined),
          order: typeof inB.order === 'number' ? inB.order : idx,
          hasUnreadNewInput: inB.hasUnreadNewInput !== undefined ? inB.hasUnreadNewInput : existing.hasUnreadNewInput
        }));
      } else {
        mergedBoxes.push(sanitizeServerBox({
          ...inB,
          order: typeof inB.order === 'number' ? inB.order : idx
        }));
      }
    }

    // 2. Append any existing boxes that were not in incomingBoxes
    for (const b of existingBoxes) {
      if (b && b.id && !deletedBoxIds.has(b.id) && !seenIds.has(b.id)) {
        seenIds.add(b.id);
        mergedBoxes.push(sanitizeServerBox({
          ...b,
          order: typeof b.order === 'number' ? b.order : mergedBoxes.length
        }));
      }
    }
  } else if (incomingBoxes.length > 0) {
    // Preserves existing server order, only merges box contents by id
    const sortedExisting = [...existingBoxes].sort((a, b) => {
      const orderA = typeof a?.order === 'number' ? a.order : 9999;
      const orderB = typeof b?.order === 'number' ? b.order : 9999;
      return orderA - orderB;
    });

    for (let idx = 0; idx < sortedExisting.length; idx++) {
      const existing = sortedExisting[idx];
      if (!existing || !existing.id || deletedBoxIds.has(existing.id) || seenIds.has(existing.id)) continue;
      seenIds.add(existing.id);

      const inB = incomingBoxMap.get(existing.id);
      if (inB) {
        const base = pickBoxContentBase(existing, inB);
        let finalImageUrls = base.instructionImageUrls;
        if (finalImageUrls === undefined && existing.instructionImageUrls) {
          finalImageUrls = existing.instructionImageUrls;
        }

        mergedBoxes.push(sanitizeServerBox({
          ...base,
          instructionImageUrls: finalImageUrls,
          instructionImageUrl: (Array.isArray(finalImageUrls) && finalImageUrls.length > 0)
            ? finalImageUrls[0]
            : (base.instructionImageUrl || undefined),
          order: typeof existing.order === 'number' ? existing.order : idx,
          hasUnreadNewInput: inB.hasUnreadNewInput !== undefined ? inB.hasUnreadNewInput : existing.hasUnreadNewInput
        }));
      } else {
        mergedBoxes.push(sanitizeServerBox({
          ...existing,
          order: typeof existing.order === 'number' ? existing.order : idx
        }));
      }
    }

    // Append newly created boxes from incoming that are not yet in existingBoxes
    for (let idx = 0; idx < incomingBoxes.length; idx++) {
      const inB = incomingBoxes[idx];
      if (inB && inB.id && !deletedBoxIds.has(inB.id) && !seenIds.has(inB.id)) {
        seenIds.add(inB.id);
        mergedBoxes.push(sanitizeServerBox({
          ...inB,
          order: typeof inB.order === 'number' ? inB.order : mergedBoxes.length
        }));
      }
    }
  } else {
    for (let idx = 0; idx < existingBoxes.length; idx++) {
      const b = existingBoxes[idx];
      if (b && b.id && !deletedBoxIds.has(b.id) && !seenIds.has(b.id)) {
        seenIds.add(b.id);
        mergedBoxes.push(sanitizeServerBox({
          ...b,
          order: typeof b.order === 'number' ? b.order : idx
        }));
      }
    }
  }

  // 3. Reconcile Call Logs
  const existingLogs: any[] = Array.isArray(existingState.callLogs) ? existingState.callLogs : [];
  const incomingLogs: any[] = Array.isArray(incomingPayload.callLogs) ? incomingPayload.callLogs : [];
  const logMap = new Map<string, any>();
  for (const l of existingLogs) {
    if (l && l.id) logMap.set(l.id, l);
  }
  for (const l of incomingLogs) {
    if (l && l.id) logMap.set(l.id, l);
  }
  const mergedLogs = Array.from(logMap.values())
    .sort((a, b) => new Date(b.calledAt || 0).getTime() - new Date(a.calledAt || 0).getTime())
    .slice(0, 300);

  // 4. Reconcile Notifications
  const existingNotifs: any[] = Array.isArray(existingState.notifications) ? existingState.notifications : [];
  const incomingNotifs: any[] = Array.isArray(incomingPayload.notifications) ? incomingPayload.notifications : [];
  const notifMap = new Map<string, any>();
  for (const n of existingNotifs) {
    if (n && n.id) notifMap.set(n.id, n);
  }
  for (const n of incomingNotifs) {
    if (n && n.id) notifMap.set(n.id, n);
  }
  const mergedNotifs = Array.from(notifMap.values()).slice(0, 100);

  // 5. Reconcile Saved Officers
  const existingOfficers: any[] = Array.isArray(existingState.savedOfficers) ? existingState.savedOfficers : [];
  const incomingOfficers: any[] = Array.isArray(incomingPayload.savedOfficers) ? incomingPayload.savedOfficers : [];
  const officerMap = new Map<string, any>();
  for (const o of existingOfficers) {
    if (o && o.id) officerMap.set(o.id, o);
  }
  for (const o of incomingOfficers) {
    if (o && o.id) officerMap.set(o.id, o);
  }
  const mergedOfficers = Array.from(officerMap.values());

  // 6. Reconcile Communication Notes (Papan Komunikasi Admin <-> Terapis)
  const existingCommNotesDeleted: string[] = Array.isArray(existingState.deletedCommunicationNoteIds) ? existingState.deletedCommunicationNoteIds : [];
  const incomingCommNotesDeleted: string[] = Array.isArray(incomingPayload.deletedCommunicationNoteIds) ? incomingPayload.deletedCommunicationNoteIds : [];
  const cumulativeDeletedCommNoteIds = Array.from(new Set([...existingCommNotesDeleted, ...incomingCommNotesDeleted])).slice(-500);
  const deletedCommNoteIdsSet = new Set(cumulativeDeletedCommNoteIds);

  const existingCommNotes: any[] = Array.isArray(existingState.communicationNotes) ? existingState.communicationNotes : [];
  const incomingCommNotes: any[] = Array.isArray(incomingPayload.communicationNotes) ? incomingPayload.communicationNotes : [];
  const commNoteMap = new Map<string, any>();
  for (const n of existingCommNotes) {
    if (n && n.id && !deletedCommNoteIdsSet.has(n.id)) commNoteMap.set(n.id, n);
  }
  for (const inN of incomingCommNotes) {
    if (!inN || !inN.id || deletedCommNoteIdsSet.has(inN.id)) continue;
    const existingNote = commNoteMap.get(inN.id);
    if (!existingNote) {
      commNoteMap.set(inN.id, inN);
    } else {
      const readByMap = new Map<string, any>();
      for (const r of (existingNote.readBy || [])) if (r && r.name) readByMap.set(r.name, r);
      for (const r of (inN.readBy || [])) if (r && r.name && !readByMap.has(r.name)) readByMap.set(r.name, r);
      const replyMap = new Map<string, any>();
      for (const r of (existingNote.replies || [])) if (r && r.id) replyMap.set(r.id, r);
      for (const r of (inN.replies || [])) if (r && r.id) replyMap.set(r.id, r);
      commNoteMap.set(inN.id, {
        ...existingNote,
        ...inN,
        readBy: Array.from(readByMap.values()),
        replies: Array.from(replyMap.values()).sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()),
      });
    }
  }
  const mergedCommNotes = Array.from(commNoteMap.values())
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    .slice(0, 200);

  const currentCallingPatient = incomingPayload.currentCallingPatient !== undefined
    ? incomingPayload.currentCallingPatient
    : (existingState.currentCallingPatient || null);

  const currentCallingBox = incomingPayload.currentCallingBox !== undefined
    ? incomingPayload.currentCallingBox
    : (existingState.currentCallingBox || null);

  return {
    boxes: mergedBoxes,
    patients: mergedPatients,
    ranapQueue: mergedRanapQueue,
    callLogs: mergedLogs,
    notifications: mergedNotifs,
    savedOfficers: mergedOfficers,
    communicationNotes: mergedCommNotes,
    currentCallingPatient,
    currentCallingBox,
    isExplicitReset: Boolean(existingState?.isExplicitReset && mergedPatients.length === 0),
    resetConfirmed: Boolean(existingState?.resetConfirmed && mergedPatients.length === 0),
    lastResetAt: effectiveResetAt || null,
    boxOrderUpdatedAt: effectiveBoxOrderUpdatedAt,
    deletedPatientIds: cumulativeDeletedList,
    preResetPatientIds: Array.from(preResetPatientIds),
    deletedRanapIds: cumulativeDeletedRanapList,
    deletedCommunicationNoteIds: cumulativeDeletedCommNoteIds,
    deletedBoxIds: cumulativeDeletedBoxList,
    lastUpdated: new Date().toISOString(),
  };
}

// REST API Endpoints

// GET /api/security-config
app.get('/api/security-config', (req, res) => {
  const config = loadSecurityConfig();
  res.json({ status: 'ok', config });
});

// POST /api/security-config (Updates master password across all connected devices)
app.post('/api/security-config', (req, res) => {
  try {
    const { appPassword, databasePassword, senderDeviceId } = req.body || {};
    const updated = saveSecurityConfig({ appPassword, databasePassword });
    
    // Broadcast immediately to all connected devices via SSE
    broadcastUpdate({
      type: 'SECURITY_CONFIG_UPDATE',
      config: updated,
      senderDeviceId
    });

    console.log(`[SecuritySync] Security configuration updated from ${senderDeviceId || 'unknown'}.`);
    res.json({ status: 'ok', config: updated });
  } catch (err: any) {
    console.error('[SecuritySync] Error saving security config:', err);
    res.status(500).json({ error: 'Gagal memperbarui security config' });
  }
});

// GET current state
app.get('/api/queue', (req, res) => {
  const state = loadStateFromFile();
  // PENTING: isExplicitReset/resetConfirmed HANYA boleh berarti "reset baru saja
  // terjadi SEKARANG" - bukan properti permanen yang ikut tersimpan di disk.
  // Kalau field ini diteruskan apa adanya dari disk, dan disk KEBETULAN
  // menyimpannya true dari reset lama (mis. karena antrean sempat benar-benar
  // kosong), maka SETIAP klien yang me-refresh/membuka aplikasi dan membaca
  // status ini akan mengira reset baru saja terjadi lagi, lalu mengosongkan
  // tampilan pasiennya sendiri - walau pasien di server sebenarnya ada/normal
  // (persis gejala "refresh hilang, refresh lagi timbul" yang dilaporkan).
  // Sinyal reset yang SUNGGUHAN sudah dikirim lewat siaran real-time saat
  // /api/queue/reset dipanggil; endpoint baca biasa ini tidak perlu (dan tidak
  // boleh) ikut memicu itu lagi.
  const { isExplicitReset, resetConfirmed, ...safeState } = state || {};
  res.json({ status: 'ok', state: { ...safeState, isExplicitReset: false, resetConfirmed: false } });
});

// GET status kesehatan sistem (dipakai klien untuk menampilkan indikator kalau
// cadangan otomatis ke Cloud Firestore sedang bermasalah/dinonaktifkan).
app.get('/api/system/status', (req, res) => {
  res.json({ status: 'ok', firestoreMirrorDisabled: isFirestoreMirrorDisabled });
});

// GET log audit penghapusan pasien/kotak & reset antrean (dipakai fitur "Restore
// Antrean" di klien untuk membedakan pasien yang memang sengaja dihapus/direset
// dari yang benar-benar hilang tanpa sebab).
app.get('/api/deletion-audit', (req, res) => {
  res.json({ status: 'ok', entries: loadDeletionAudit() });
});

// POST update full queue state and notify all connected devices instantly
app.post('/api/queue', async (req, res) => {
  try {
    const payload = req.body;
    if (!payload || typeof payload !== 'object') {
      return res.status(400).json({ error: 'Payload tidak valid' });
    }

    const { senderDeviceId } = payload;

    await enqueueQueueWrite(async () => {
      const existingState = loadStateFromFile() || getInitialServerState();
      logNewDeletionsForAudit(existingState, payload);
      const mergedState = reconcileQueueStates(existingState, payload);

      // Reset yang datang sebagai SIARAN dari perangkat (bukan lewat /api/queue/reset)
      // harus ikut dicatat permanen, kalau tidak pembersihan lewat jalur ini tetap
      // bisa mundur saat wadah server diganti.
      if (mergedState && mergedState.isExplicitReset === true) {
        catatTombstoneReset(mergedState.preResetPatientIds, mergedState.lastResetAt);
      }

      saveStateToFile(mergedState);

      broadcastUpdate({ type: 'SYNC_STATE', state: mergedState, senderDeviceId });
      console.log(`[QueueSync] Synced from device ${senderDeviceId || 'unknown'}: ${mergedState.patients.length} patients, ${mergedState.boxes.length} boxes.`);

      if (Array.isArray(mergedState.patients) && mergedState.patients.length > 0) {
        scheduleSyncPatientsToMasterAndArchive(mergedState.patients, mergedState.boxes);
      }
    });

    res.json({ status: 'ok', updated: new Date().toISOString() });
  } catch (error: any) {
    console.error('[QueueSync] Error updating state:', error);
    res.status(500).json({ error: 'Gagal memperbarui antrian' });
  }
});

// POST /api/queue/restore-patient - Cabut catatan penghapusan supaya pasien yang
// SENGAJA dikembalikan dari Database Harian tidak tersaring lagi oleh catatan reset.
app.post('/api/queue/restore-patient', async (req, res) => {
  try {
    const ids = Array.isArray(req.body?.patientIds) ? req.body.patientIds.filter(Boolean).map(String) : [];
    if (ids.length === 0) {
      return res.status(400).json({ error: 'patientIds kosong' });
    }
    const idSet = new Set(ids);
    const dicabut = cabutTombstoneReset(ids);

    await enqueueQueueWrite(async () => {
      const state = loadStateFromFile() || getInitialServerState();
      const sebelum = JSON.stringify([state.preResetPatientIds, state.deletedPatientIds]);
      state.preResetPatientIds = (Array.isArray(state.preResetPatientIds) ? state.preResetPatientIds : [])
        .filter((id: any) => !idSet.has(String(id)));
      state.deletedPatientIds = (Array.isArray(state.deletedPatientIds) ? state.deletedPatientIds : [])
        .filter((id: any) => !idSet.has(String(id)));
      if (JSON.stringify([state.preResetPatientIds, state.deletedPatientIds]) !== sebelum) {
        saveStateToFile(state);
      }
    });

    console.log(`[ResetTombstone] ${dicabut} catatan penghapusan dicabut untuk pemulihan pasien dari Database Harian.`);
    res.json({ status: 'ok', dicabut });
  } catch (error: any) {
    console.error('[ResetTombstone] Gagal mencabut catatan penghapusan:', error);
    res.status(500).json({ error: 'Gagal mencabut catatan penghapusan' });
  }
});

// POST /api/queue/reset - Explicit authoritative queue purge across all connected devices
app.post('/api/queue/reset', async (req, res) => {
  try {
    const { lastResetAt, senderDeviceId } = req.body || {};
    const resetTime = lastResetAt || new Date().toISOString();

    await enqueueQueueWrite(async () => {
      const existingState = loadStateFromFile() || getInitialServerState();
      const preResetPatientIds = Array.from(new Set([
        ...(Array.isArray(existingState.preResetPatientIds) ? existingState.preResetPatientIds : []),
        ...(Array.isArray(existingState.patients) ? existingState.patients.map((p: any) => p && p.id).filter(Boolean) : []),
      ])).slice(-2000);
      const resetState = {
        boxes: Array.isArray(existingState.boxes) && existingState.boxes.length > 0 ? existingState.boxes : getInitialServerState().boxes,
        patients: [],
        ranapQueue: Array.isArray(existingState.ranapQueue) ? existingState.ranapQueue : [],
        callLogs: [],
        notifications: [],
        savedOfficers: Array.isArray(existingState.savedOfficers) ? existingState.savedOfficers : [],
        communicationNotes: Array.isArray(existingState.communicationNotes) ? existingState.communicationNotes : [],
        currentCallingPatient: null,
        currentCallingBox: null,
        isExplicitReset: true,
        resetConfirmed: true,
        lastResetAt: resetTime,
        boxOrderUpdatedAt: existingState.boxOrderUpdatedAt || null,
        deletedPatientIds: [],
        preResetPatientIds,
        deletedRanapIds: Array.isArray(existingState.deletedRanapIds) ? existingState.deletedRanapIds : [],
        deletedCommunicationNoteIds: Array.isArray(existingState.deletedCommunicationNoteIds) ? existingState.deletedCommunicationNoteIds : [],
        deletedBoxIds: Array.isArray(existingState.deletedBoxIds) ? existingState.deletedBoxIds : [],
        lastUpdated: new Date().toISOString(),
      };

      // Catat DULU ke penyimpanan permanen (berkas & dokumen Firestore terpisah),
      // baru simpan state. Urutannya sengaja begini: kalau wadah server mati tepat
      // setelah ini, catatan reset sudah aman di tempat yang tidak ikut mundur
      // bersama cadangan current_queue.
      catatTombstoneReset(preResetPatientIds, resetTime);

      saveStateToFile(resetState);
      appendDeletionAudit({
        type: 'reset',
        timestamp: resetTime,
        patientsCleared: Array.isArray(existingState.patients) ? existingState.patients.length : 0,
      });
      broadcastUpdate({ type: 'SYNC_STATE', state: resetState, senderDeviceId });
      console.log(`[QueueReset] Queue purged clean by ${senderDeviceId || 'unknown'} at ${resetTime}.`);
    });

    res.json({ status: 'ok', message: 'Antrean berhasil dibersihkan secara permanen', lastResetAt: resetTime });
  } catch (error: any) {
    console.error('[QueueReset] Error purging queue:', error);
    res.status(500).json({ error: 'Gagal membersihkan antrean server' });
  }
});

// Master Patient Registry APIs

// GET /api/master-patients?search=...
app.get('/api/master-patients', (req, res) => {
  const search = typeof req.query.search === 'string' ? req.query.search.toLowerCase().trim() : '';
  const patients = loadMasterPatients();

  if (!search) {
    return res.json({ status: 'ok', patients });
  }

  const filtered = patients.filter((p) => {
    return (
      (p.medicalRecordNo && p.medicalRecordNo.toLowerCase().includes(search)) ||
      (p.patientName && p.patientName.toLowerCase().includes(search)) ||
      (p.identityNumber && p.identityNumber.toLowerCase().includes(search)) ||
      (p.phoneNumber && p.phoneNumber.toLowerCase().includes(search)) ||
      (p.defaultDiagnosis && p.defaultDiagnosis.toLowerCase().includes(search))
    );
  });

  res.json({ status: 'ok', patients: filtered });
});

// POST /api/master-patients (Create or Update Master Patient)
app.post('/api/master-patients', (req, res) => {
  try {
    const {
      id,
      medicalRecordNo,
      patientName,
      identityNumber,
      phoneNumber,
      birthDate,
      gender,
      address,
      defaultDiagnosis,
      defaultActionCode,
      notes
    } = req.body;

    if (!medicalRecordNo || !patientName) {
      return res.status(400).json({ error: 'No. RM dan Nama Pasien wajib diisi' });
    }

    const cleanRM = medicalRecordNo.trim();
    const cleanName = patientName.trim();
    const patients = loadMasterPatients();
    const today = getLocalDateStringWIB();

    const existingIndex = id 
      ? patients.findIndex((p) => p.id === id)
      : patients.findIndex((p) => p.medicalRecordNo.toLowerCase() === cleanRM.toLowerCase());

    let savedPatient: any;

    if (existingIndex >= 0) {
      // Update existing
      patients[existingIndex] = {
        ...patients[existingIndex],
        medicalRecordNo: cleanRM,
        patientName: cleanName,
        identityNumber: identityNumber !== undefined ? identityNumber : patients[existingIndex].identityNumber,
        phoneNumber: phoneNumber !== undefined ? phoneNumber : patients[existingIndex].phoneNumber,
        birthDate: birthDate !== undefined ? birthDate : patients[existingIndex].birthDate,
        gender: gender !== undefined ? gender : patients[existingIndex].gender,
        address: address !== undefined ? address : patients[existingIndex].address,
        defaultDiagnosis: defaultDiagnosis !== undefined ? defaultDiagnosis : patients[existingIndex].defaultDiagnosis,
        defaultActionCode: defaultActionCode !== undefined ? defaultActionCode : patients[existingIndex].defaultActionCode,
        notes: notes !== undefined ? notes : patients[existingIndex].notes,
        updatedAt: new Date().toISOString(),
      };
      savedPatient = patients[existingIndex];
    } else {
      // Create new
      savedPatient = {
        id: id || `mp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        medicalRecordNo: cleanRM,
        patientName: cleanName,
        identityNumber: identityNumber || '',
        phoneNumber: phoneNumber || '',
        birthDate: birthDate || '',
        gender: gender || '',
        address: address || '',
        defaultDiagnosis: defaultDiagnosis || '',
        defaultActionCode: defaultActionCode || '',
        notes: notes || '',
        registeredDate: today,
        lastVisitDate: today,
        totalVisits: 1,
        createdAt: new Date().toISOString(),
      };
      patients.unshift(savedPatient);
    }

    saveMasterPatients(patients);
    res.json({ status: 'ok', patient: savedPatient });
  } catch (error: any) {
    console.error('Error saving master patient:', error);
    res.status(500).json({ error: error?.message || 'Gagal menyimpan data master pasien' });
  }
});

// POST /api/master-patients/batch - Batch import / restore master patients
app.post('/api/master-patients/batch', (req, res) => {
  try {
    const { patients: newPatients } = req.body;
    if (!Array.isArray(newPatients) || newPatients.length === 0) {
      return res.status(400).json({ error: 'Data pasien array kosong atau tidak valid' });
    }

    const today = getLocalDateStringWIB();
    let currentPatients = loadMasterPatients();

    let addedCount = 0;
    let updatedCount = 0;

    for (const item of newPatients) {
      if (!item.patientName || !item.medicalRecordNo) continue;

      const cleanRM = item.medicalRecordNo.toString().trim();
      const cleanName = item.patientName.toString().trim().toUpperCase();

      const existingIndex = currentPatients.findIndex(
        (p) => p.medicalRecordNo.toLowerCase() === cleanRM.toLowerCase()
      );

      if (existingIndex >= 0) {
        currentPatients[existingIndex] = {
          ...currentPatients[existingIndex],
          patientName: cleanName,
          identityNumber: item.identityNumber || currentPatients[existingIndex].identityNumber || '',
          phoneNumber: item.phoneNumber || currentPatients[existingIndex].phoneNumber || '',
          birthDate: item.birthDate || currentPatients[existingIndex].birthDate || '',
          gender: item.gender || currentPatients[existingIndex].gender || '',
          address: item.address || currentPatients[existingIndex].address || '',
          defaultDiagnosis: item.defaultDiagnosis || currentPatients[existingIndex].defaultDiagnosis || '',
          defaultActionCode: item.defaultActionCode || currentPatients[existingIndex].defaultActionCode || '',
          notes: item.notes || currentPatients[existingIndex].notes || '',
          updatedAt: new Date().toISOString(),
        };
        updatedCount++;
      } else {
        currentPatients.unshift({
          id: item.id || `mp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          medicalRecordNo: cleanRM,
          patientName: cleanName,
          identityNumber: item.identityNumber || '',
          phoneNumber: item.phoneNumber || '',
          birthDate: item.birthDate || '',
          gender: item.gender || '',
          address: item.address || '',
          defaultDiagnosis: item.defaultDiagnosis || '',
          defaultActionCode: item.defaultActionCode || '',
          notes: item.notes || '',
          registeredDate: item.registeredDate || today,
          lastVisitDate: item.lastVisitDate || today,
          totalVisits: item.totalVisits || 1,
          createdAt: item.createdAt || new Date().toISOString(),
        });
        addedCount++;
      }
    }

    saveMasterPatients(currentPatients);
    res.json({
      status: 'ok',
      message: `Berhasil mengimpor ${addedCount} data baru dan memperbarui ${updatedCount} data`,
      total: currentPatients.length,
      addedCount,
      updatedCount,
      patients: currentPatients
    });
  } catch (error: any) {
    console.error('Error batch saving master patients:', error);
    res.status(500).json({ error: error?.message || 'Gagal mengimpor batch master pasien' });
  }
});

// GET /api/ranap-history
app.get('/api/ranap-history', (req, res) => {
  try {
    const { category, search, startDate, endDate } = req.query;
    let history = loadRanapHistory();

    if (category && category !== 'all') {
      const catStr = String(category).toLowerCase();
      history = history.filter((item: any) => (item.category || '').toLowerCase() === catStr);
    }

    if (search) {
      const q = String(search).toLowerCase().trim();
      history = history.filter((item: any) =>
        (item.patientName || '').toLowerCase().includes(q) ||
        (item.medicalRecordNo || '').toLowerCase().includes(q) ||
        (item.roomNumber || '').toLowerCase().includes(q) ||
        (item.diagnosis || '').toLowerCase().includes(q)
      );
    }

    if (startDate) {
      const start = new Date(String(startDate)).getTime();
      if (!isNaN(start)) {
        history = history.filter((item: any) => {
          const itemDate = new Date(item.completedAt || item.createdAt || 0).getTime();
          return itemDate >= start;
        });
      }
    }

    if (endDate) {
      let endStr = String(endDate);
      if (endStr.length === 10) endStr += 'T23:59:59.999Z';
      const end = new Date(endStr).getTime();
      if (!isNaN(end)) {
        history = history.filter((item: any) => {
          const itemDate = new Date(item.completedAt || item.createdAt || 0).getTime();
          return itemDate <= end;
        });
      }
    }

    history.sort((a: any, b: any) => new Date(b.completedAt || 0).getTime() - new Date(a.completedAt || 0).getTime());

    res.json({ status: 'ok', history });
  } catch (error: any) {
    console.error('Error fetching ranap history:', error);
    res.status(500).json({ error: error?.message || 'Gagal memuat riwayat antrean rawat inap' });
  }
});

// POST /api/ranap-history
app.post('/api/ranap-history', (req, res) => {
  try {
    const item = req.body;
    if (!item || !item.id || !item.patientName || !item.category) {
      return res.status(400).json({ error: 'Data riwayat ranap tidak lengkap (id, patientName, category wajib)' });
    }

    const completedItem = {
      ...item,
      completedAt: item.completedAt || new Date().toISOString()
    };

    const history = loadRanapHistory();
    const existingIndex = history.findIndex((h: any) => h.id === completedItem.id);
    if (existingIndex >= 0) {
      history[existingIndex] = { ...history[existingIndex], ...completedItem };
    } else {
      history.unshift(completedItem);
    }

    saveRanapHistory(history);
    res.json({ status: 'ok', item: completedItem });
  } catch (error: any) {
    console.error('Error saving ranap history:', error);
    res.status(500).json({ error: error?.message || 'Gagal menyimpan riwayat antrean rawat inap' });
  }
});

// GET /api/backup/export - Export complete database snapshot
app.get('/api/backup/export', (req, res) => {
  try {
    const masterPatients = loadMasterPatients();
    const dailyArchive = loadFullDailyArchive();
    const queueState = loadStateFromFile();
    const inventory = loadInventoryDb();
    const lainLain = loadLainLainDb();
    const photos = loadPhotosDb();

    res.json({
      app: 'Sistem Antrean IRM',
      version: '2.0.0',
      exportedAt: new Date().toISOString(),
      exportDateWIB: getLocalDateStringWIB(),
      data: {
        masterPatients,
        dailyArchive,
        queueState,
        inventory,
        lainLain,
        photos
      }
    });
  } catch (error: any) {
    console.error('Error exporting backup:', error);
    res.status(500).json({ error: 'Gagal mengekspor backup sistem' });
  }
});

// POST /api/backup/restore - Restore full database snapshot
app.post('/api/backup/restore', (req, res) => {
  try {
    const { data, options } = req.body;
    if (!data || typeof data !== 'object') {
      return res.status(400).json({ error: 'Format data backup tidak valid' });
    }

    if (Array.isArray(data.masterPatients)) {
      saveMasterPatients(data.masterPatients);
    }
    if (data.dailyArchive && typeof data.dailyArchive === 'object') {
      saveFullDailyArchive(data.dailyArchive);
    }
    if (data.inventory && typeof data.inventory === 'object') {
      saveInventoryDb(data.inventory);
    }
    if (data.lainLain && typeof data.lainLain === 'object') {
      saveLainLainDb(data.lainLain);
    }
    if (Array.isArray(data.photos)) {
      savePhotosDb(data.photos);
    }

    // Only restore queueState if explicitly requested (default is false to preserve current box colors, therapists, and live queue)
    if (options?.restoreQueueState && data.queueState && typeof data.queueState === 'object') {
      saveStateToFile(data.queueState);
      broadcastUpdate({ type: 'SYNC_STATE', state: data.queueState });
    }

    res.json({ status: 'ok', message: 'Semua data backup berhasil dipulihkan' });
  } catch (error: any) {
    console.error('Error restoring backup:', error);
    res.status(500).json({ error: 'Gagal memulihkan backup sistem' });
  }
});

// DELETE /api/master-patients (Clear All Master Patients)
app.delete('/api/master-patients', (req, res) => {
  try {
    saveMasterPatients([]);
    res.json({ status: 'ok', message: 'Semua data master pasien berhasil dibersihkan', count: 0 });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Gagal membersihkan data master pasien' });
  }
});

// POST /api/master-patients/clear (Alternative Clear All Master Patients)
app.post('/api/master-patients/clear', (req, res) => {
  try {
    saveMasterPatients([]);
    res.json({ status: 'ok', message: 'Semua data master pasien berhasil dibersihkan', count: 0 });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Gagal membersihkan data master pasien' });
  }
});

// DELETE /api/master-patients/:id
app.delete('/api/master-patients/:id', (req, res) => {
  try {
    const { id } = req.params;
    let patients = loadMasterPatients();
    patients = patients.filter((p) => p.id !== id && p.medicalRecordNo !== id);
    saveMasterPatients(patients);
    res.json({ status: 'ok', message: 'Data master pasien berhasil dihapus' });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Gagal menghapus data' });
  }
});

// Daily Archive & Daily Patient Database APIs

// GET /api/daily-database?date=YYYY-MM-DD
app.get('/api/daily-database', (req, res) => {
  try {
    const today = getLocalDateStringWIB();
    const targetDate = typeof req.query.date === 'string' && req.query.date.trim() ? req.query.date.trim() : today;
    let visits = loadDailyArchiveForDate(targetDate);
    const currentState = loadStateFromFile();

    // If querying today and archive is empty, populate from current queue
    if (targetDate === today && visits.length === 0 && currentState?.patients?.length > 0) {
      syncPatientsToMasterAndArchive(currentState.patients);
      visits = loadDailyArchiveForDate(targetDate);
    }

    const allDates = listAllArchiveDateKeys();
    if (!allDates.includes(today)) {
      allDates.unshift(today);
    }

    const totalPatients = visits.length;
    const completedPatients = visits.filter((v: any) => v.completed).length;
    const pendingPatients = totalPatients - completedPatients;
    const warningPatients = visits.filter((v: any) => v.isWarning).length;
    const ranapPatients = visits.filter((v: any) => v.isRanap).length;

    res.json({
      status: 'ok',
      date: targetDate,
      visits,
      summary: {
        total: totalPatients,
        completed: completedPatients,
        pending: pendingPatients,
        warning: warningPatients,
        ranap: ranapPatients,
      },
      allDates,
    });
  } catch (error: any) {
    console.error('Error fetching daily database:', error);
    res.status(500).json({ error: error?.message || 'Gagal memuat database harian' });
  }
});

// POST /api/daily-database/visit (Add or update a visit for a specific date)
app.post('/api/daily-database/visit', async (req, res) => {
  try {
    const { date, visit } = req.body;
    const today = getLocalDateStringWIB();
    // Tanggal diambil dari kapan pasien DIDAFTARKAN, bukan dari tanggal yang kebetulan
    // dikirim perangkat (yang selalu "hari ini"). Tanpa ini, pasien sisa semalam yang
    // baru ditutup pagi ini akan tercatat lagi di tanggal hari ini - padahal
    // kunjungannya milik kemarin.
    const targetDate = tanggalKunjungan(visit, date || today);
    if (!visit || !visit.patientName || !visit.medicalRecordNo) {
      return res.status(400).json({ error: 'Data kunjungan pasien tidak lengkap' });
    }

    let updatedVisit: any;

    await enqueueQueueWrite(async () => {
      const visits = loadDailyArchiveForDate(targetDate);
      const currentState = loadStateFromFile();
      const currentBoxes = (currentState && Array.isArray(currentState.boxes)) ? currentState.boxes : [];

      const existingIdx = visits.findIndex((v: any) => v.id === visit.id);
      const prev = existingIdx >= 0 ? visits[existingIdx] : {};
      const boxMatch = currentBoxes.find((b: any) => b.id === (visit.boxId || prev.boxId));

      updatedVisit = {
        ...prev,
        id: visit.id || `visit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        visitDate: targetDate,
        patientId: visit.patientId || visit.id,
        medicalRecordNo: visit.medicalRecordNo.trim(),
        patientName: visit.patientName.trim(),
        boxId: visit.boxId || prev.boxId || 'box-1',
        boxTitle: visit.boxTitle || prev.boxTitle || boxMatch?.title || visit.boxId || '',
        officerName: visit.officerName || prev.officerName || boxMatch?.officerName || '',
        category: visit.category || prev.category || boxMatch?.category || '',
        firstOfficerName: visit.firstOfficerName || prev.firstOfficerName || '',
        firstBoxTitle: visit.firstBoxTitle || prev.firstBoxTitle || '',
        queueNumber: visit.queueNumber || prev.queueNumber || '',
        actionCode: visit.actionCode || prev.actionCode || '',
        diagnosis: visit.diagnosis || prev.diagnosis || '',
        isWarning: visit.isWarning !== undefined ? !!visit.isWarning : (prev.isWarning !== undefined ? !!prev.isWarning : false),
        isRanap: visit.isRanap !== undefined ? !!visit.isRanap : (prev.isRanap !== undefined ? !!prev.isRanap : false),
        note: visit.note !== undefined ? visit.note : (prev.note || ''),
        phoneNumber: visit.phoneNumber || prev.phoneNumber || '',
        completed: visit.completed !== undefined ? !!visit.completed : (prev.completed !== undefined ? !!prev.completed : false),
        registeredAt: visit.registeredAt || prev.registeredAt || new Date().toISOString(),
        calledAt: visit.calledAt !== undefined ? visit.calledAt : (prev.calledAt || null),
        completedAt: visit.completedAt !== undefined ? visit.completedAt : (prev.completedAt || null),
        calledCount: visit.calledCount !== undefined ? visit.calledCount : (prev.calledCount || 0),
        // Penanda kunjungan yang ditutup tanpa pernah diceklis (dipindahkan/dihapus).
        // Dibangun eksplisit seperti field lain di sini, sebab objek ini disusun
        // field-per-field - kalau tidak disebut, penandanya akan hilang diam-diam.
        endedAt: visit.endedAt !== undefined ? visit.endedAt : (prev.endedAt ?? null),
        endedReason: visit.endedReason !== undefined ? visit.endedReason : prev.endedReason,
      };

      if (existingIdx >= 0) {
        visits[existingIdx] = updatedVisit;
      } else {
        visits.push(updatedVisit);
      }

      saveDailyArchiveForDate(targetDate, visits);

      // If target date is today, also sync safely with active queue
      if (targetDate === today) {
        const currentState = loadStateFromFile();
        if (currentState && Array.isArray(currentState.patients)) {
          const isDeleted = Array.isArray(currentState.deletedPatientIds) && currentState.deletedPatientIds.includes(updatedVisit.id);
          if (!isDeleted) {
            const existingQueueIdx = currentState.patients.findIndex((p: any) => p.id === updatedVisit.id);
            if (existingQueueIdx >= 0) {
              const queuePatient = currentState.patients[existingQueueIdx];
              // Status ceklis pada antrean AKTIF tidak boleh mundur oleh tambalan arsip harian.
              // Harmonisasikan status ceklis menggunakan pickCompletionState agar status selesai
              // pada antrean aktif tetap terjaga.
              const { completed, completionUpdatedAt } = pickCompletionState(queuePatient, updatedVisit);
              const { completed: _vc, completedAt: _vca, ...visitWithoutCompletion } = updatedVisit as any;
              currentState.patients[existingQueueIdx] = {
                ...queuePatient,
                ...visitWithoutCompletion,
                completed,
                completionUpdatedAt,
                completedAt: completed ? (queuePatient.completedAt || updatedVisit.completedAt || new Date().toISOString()) : undefined,
              };
              currentState.lastUpdated = new Date().toISOString();
              saveStateToFile(currentState);
              broadcastUpdate({ type: 'SYNC_STATE', state: currentState });
            }
          }
        }
      }
    });

    res.json({ status: 'ok', visit: updatedVisit });
  } catch (error: any) {
    console.error('Error saving daily visit:', error);
    res.status(500).json({ error: error?.message || 'Gagal menyimpan kunjungan pasien' });
  }
});

// POST /api/daily-database/batch (Batch restore/heal archives for a date from Cloud Firestore)
app.post('/api/daily-database/batch', async (req, res) => {
  try {
    const { date, visits } = req.body;
    if (!date || !Array.isArray(visits)) {
      return res.status(400).json({ error: 'Date and visits array are required' });
    }

    await enqueueQueueWrite(async () => {
      // Tiap kunjungan masuk ke berkas TANGGALNYA SENDIRI (tanggal pasien didaftarkan),
      // bukan ke satu tanggal yang dikirim perangkat. Ini yang membuat pembersihan
      // antrean pagi hari tidak memindahkan kunjungan semalam ke tanggal hari ini.
      const perTanggal = new Map<string, any[]>();
      visits.forEach((v: any) => {
        if (!v || !v.id) return;
        const tgl = tanggalKunjungan(v, date);
        const daftar = perTanggal.get(tgl);
        if (daftar) daftar.push(v); else perTanggal.set(tgl, [v]);
      });

      perTanggal.forEach((daftar, tgl) => {
        const existing = loadDailyArchiveForDate(tgl);
        const map = new Map<string, any>();
        existing.forEach((v: any) => { if (v && v.id) map.set(v.id, v); });
        daftar.forEach((v: any) => {
          const prev = map.get(v.id);
          map.set(v.id, { ...prev, ...v, visitDate: tgl });
        });
        saveDailyArchiveForDate(tgl, Array.from(map.values()));
      });
    });

    res.json({ status: 'ok', count: visits.length });
  } catch (error: any) {
    console.error('Error batch updating daily archive:', error);
    res.status(500).json({ error: error?.message || 'Failed to batch update archive' });
  }
});

// GET /api/monthly-report?year=YYYY&month=M
app.get('/api/monthly-report', (req, res) => {
  try {
    const today = getLocalDateStringWIB();
    const now = new Date();
    const targetYear = req.query.year ? parseInt(req.query.year as string, 10) : now.getFullYear();
    const targetMonth = req.query.month ? parseInt(req.query.month as string, 10) : now.getMonth() + 1;
    
    const monthPrefix = `${targetYear}-${String(targetMonth).padStart(2, '0')}`;
    let dailyArchive = loadDailyArchiveForMonth(monthPrefix);
    const currentState = loadStateFromFile();

    // If active queue has patients for today and today matches this month, ensure synced
    if (today.startsWith(monthPrefix) && (!dailyArchive[today] || dailyArchive[today].length === 0) && currentState?.patients?.length > 0) {
      syncPatientsToMasterAndArchive(currentState.patients);
      dailyArchive = loadDailyArchiveForMonth(monthPrefix);
    }

    // Collect all visits in this month.
    // JARING PENGAMAN: satu id kunjungan hanya boleh dihitung SEKALI, walau berkas
    // arsip lama masih menyimpannya di lebih dari satu tanggal (data yang terlanjur
    // terbentuk sebelum aturan tanggalKunjungan dipasang). Tanpa ini satu pasien yang
    // melewati tengah malam terhitung dua kali di jumlah kunjungan dan di SPM.
    // Yang dipertahankan adalah tanggal PALING AWAL - yaitu tanggal ia didaftarkan.
    const monthlyById = new Map<string, any>();
    const allMonthlyVisits: any[] = [];
    Object.keys(dailyArchive).sort().forEach((dateKey) => {
      if (dateKey.startsWith(monthPrefix) && Array.isArray(dailyArchive[dateKey])) {
        dailyArchive[dateKey].forEach((v: any) => {
          const kunjungan = { ...v, visitDate: dateKey };
          if (!v || !v.id) { allMonthlyVisits.push(kunjungan); return; }
          if (monthlyById.has(v.id)) return;
          monthlyById.set(v.id, kunjungan);
          allMonthlyVisits.push(kunjungan);
        });
      }
    });

    // Also include today's queue patients if any exist and not yet in archive
    if (today.startsWith(monthPrefix) && currentState && Array.isArray(currentState.patients)) {
      currentState.patients.forEach((qp: any) => {
        const alreadyExists = allMonthlyVisits.some((mv) => mv.id === qp.id);
        if (!alreadyExists) {
          allMonthlyVisits.push({
            ...qp,
            visitDate: today,
            registeredAt: qp.createdAt || new Date().toISOString()
          });
        }
      });
    }

    res.json({
      status: 'ok',
      year: targetYear,
      month: targetMonth,
      monthPrefix,
      totalVisits: allMonthlyVisits.length,
      visits: allMonthlyVisits
    });
  } catch (error: any) {
    console.error('Error fetching monthly report:', error);
    res.status(500).json({ error: error?.message || 'Gagal memuat laporan bulanan' });
  }
});

// Helper to infer therapy category from officer name and box title
function inferVisitTherapyCategory(officerName?: string, boxTitle?: string, explicitCategory?: string): 'fisio' | 'okupasi' | 'wicara' {
  if (explicitCategory === 'fisio' || explicitCategory === 'okupasi' || explicitCategory === 'wicara') {
    return explicitCategory;
  }
  const full = `${(officerName || '').toLowerCase()} ${(boxTitle || '').toLowerCase()}`;
  if (
    full.includes('monalisa') || full.includes('kalya') || full.includes('wicara') ||
    full.includes('speech') || full.includes('a.md.tw') || full.includes('s.tr.tw') || /\btw\b/i.test(full)
  ) {
    return 'wicara';
  }
  if (
    full.includes('cecep') || full.includes('gunandar') || full.includes('putri') ||
    full.includes('okupasi') || full.includes('occupational') || full.includes('a.md.ot') || full.includes('s.tr.ot') || /\bot\b/i.test(full)
  ) {
    return 'okupasi';
  }
  return 'fisio';
}

// GET /api/analytics/visit-trends?year=YYYY&month=M
app.get('/api/analytics/visit-trends', (req, res) => {
  try {
    const now = new Date();
    const targetYear = req.query.year ? parseInt(req.query.year as string, 10) : now.getFullYear();
    const targetMonth = req.query.month ? parseInt(req.query.month as string, 10) : now.getMonth() + 1;
    const monthPrefix = `${targetYear}-${String(targetMonth).padStart(2, '0')}`;
    const yearPrefix = `${targetYear}-`;

    const today = getLocalDateStringWIB();
    const dailyArchive = loadDailyArchiveForYear(targetYear);
    const currentState = loadStateFromFile();

    const visitsByDate: Record<string, any[]> = {};
    Object.keys(dailyArchive).forEach((dateKey) => {
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateKey) && Array.isArray(dailyArchive[dateKey])) {
        visitsByDate[dateKey] = dailyArchive[dateKey];
      }
    });
    if (currentState && Array.isArray(currentState.patients) && currentState.patients.length > 0) {
      const todayVisits = visitsByDate[today] ? [...visitsByDate[today]] : [];
      const existingIds = new Set(todayVisits.map((v: any) => v.id));
      currentState.patients.forEach((qp: any) => {
        if (!existingIds.has(qp.id)) {
          todayVisits.push({ ...qp, visitDate: today, registeredAt: qp.createdAt || new Date().toISOString() });
        }
      });
      visitsByDate[today] = todayVisits;
    }

    const dedupKey = (v: any) =>
      (v.medicalRecordNo && String(v.medicalRecordNo).trim()) ||
      (v.patientName && String(v.patientName).trim().toUpperCase()) ||
      v.id;

    const summarizeDay = (records: any[]) => {
      const totalSet = new Set<string>();
      const catSets = { fisio: new Set<string>(), okupasi: new Set<string>(), wicara: new Set<string>() };
      records.forEach((v) => {
        if (!v) return;
        const key = dedupKey(v);
        if (!key) return;
        totalSet.add(key);
        const cat = inferVisitTherapyCategory(v.officerName, v.boxTitle, v.category);
        catSets[cat].add(key);
      });
      return {
        total: totalSet.size,
        fisio: catSets.fisio.size,
        okupasi: catSets.okupasi.size,
        wicara: catSets.wicara.size,
      };
    };

    const daysInMonth = new Date(targetYear, targetMonth, 0).getDate();
    const daily: Array<{ date: string; day: number; total: number; fisio: number; okupasi: number; wicara: number }> = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const dateKey = `${monthPrefix}-${String(day).padStart(2, '0')}`;
      const summary = summarizeDay(visitsByDate[dateKey] || []);
      daily.push({ date: dateKey, day, ...summary });
    }

    const monthlyBuckets = Array.from({ length: 12 }, () => ({ total: 0, fisio: 0, okupasi: 0, wicara: 0 }));
    Object.keys(visitsByDate).forEach((dateKey) => {
      if (!dateKey.startsWith(yearPrefix)) return;
      const monthIdx = parseInt(dateKey.slice(5, 7), 10) - 1;
      if (monthIdx < 0 || monthIdx > 11) return;
      const summary = summarizeDay(visitsByDate[dateKey]);
      monthlyBuckets[monthIdx].total += summary.total;
      monthlyBuckets[monthIdx].fisio += summary.fisio;
      monthlyBuckets[monthIdx].okupasi += summary.okupasi;
      monthlyBuckets[monthIdx].wicara += summary.wicara;
    });
    const monthly = monthlyBuckets.map((bucket, idx) => ({ month: idx + 1, ...bucket }));

    res.json({ status: 'ok', year: targetYear, month: targetMonth, daily, monthly });
  } catch (error: any) {
    console.error('Error computing visit trends:', error);
    res.status(500).json({ error: error?.message || 'Gagal memuat data grafik kunjungan' });
  }
});

// GET /api/officers - Retrieve saved officers / therapists
app.get('/api/officers', (req, res) => {
  const state = loadStateFromFile() || {};
  const officers = state.savedOfficers || [];
  res.json({ status: 'ok', officers });
});

// POST /api/officers - Save / register custom officer
app.post('/api/officers', async (req, res) => {
  try {
    const officer = req.body;
    if (!officer || !officer.name) {
      return res.status(400).json({ error: 'Nama petugas wajib diisi' });
    }

    let savedOfficer: any;

    await enqueueQueueWrite(async () => {
      const state = loadStateFromFile() || {};
      const officers: any[] = Array.isArray(state.savedOfficers) ? state.savedOfficers : [];

      const existingIdx = officers.findIndex(
        (o: any) => o.name && o.name.trim().toLowerCase() === officer.name.trim().toLowerCase()
      );

      if (existingIdx >= 0) {
        officers[existingIdx] = { ...officers[existingIdx], ...officer };
        savedOfficer = officers[existingIdx];
      } else {
        const newOfficer = {
          id: officer.id || `off-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          name: officer.name.trim(),
          shortTitle: officer.shortTitle || officer.name.trim().toUpperCase(),
          location: officer.location || 'Ruang Terapi IRM',
          color: officer.color || 'blue',
          role: officer.role || 'Fisioterapis / Petugas IRM',
          isDefault: false,
          createdAt: officer.createdAt || new Date().toISOString(),
        };
        officers.push(newOfficer);
        savedOfficer = newOfficer;
      }

      state.savedOfficers = officers;
      state.lastUpdated = new Date().toISOString();
      saveStateToFile(state);

      broadcastUpdate({ type: 'SYNC_STATE', state });
    });

    res.json({ status: 'ok', officer: savedOfficer });
  } catch (err: any) {
    console.error('Error saving officer:', err);
    res.status(500).json({ error: err?.message || 'Gagal menyimpan data petugas' });
  }
});

// DELETE /api/officers/:id - Delete custom officer
app.delete('/api/officers/:id', async (req, res) => {
  try {
    const idOrName = decodeURIComponent(req.params.id);

    await enqueueQueueWrite(async () => {
      const state = loadStateFromFile() || {};
      let officers: any[] = Array.isArray(state.savedOfficers) ? state.savedOfficers : [];

      officers = officers.filter(
        (o: any) => o.id !== idOrName && o.name.trim().toLowerCase() !== idOrName.trim().toLowerCase()
      );

      state.savedOfficers = officers;
      state.lastUpdated = new Date().toISOString();
      saveStateToFile(state);

      broadcastUpdate({ type: 'SYNC_STATE', state });
    });

    res.json({ status: 'ok' });
  } catch (err: any) {
    console.error('Error deleting officer:', err);
    res.status(500).json({ error: err?.message || 'Gagal menghapus petugas' });
  }
});

// Helper to process a single base64 image data string or URL and save to disk + photo DB
function saveBase64ImageToDisk(imageData: string, meta: { 
  originalName?: string; 
  boxId?: string; 
  boxTitle?: string; 
  title?: string;
  medicalRecordNo?: string;
  patientName?: string;
  patientId?: string;
  photoType?: 'box_instruction' | 'patient_ranap' | 'general';
} = {}) {
  if (!imageData || typeof imageData !== 'string') {
    throw new Error('Data gambar tidak valid');
  }

  const trimmed = imageData.trim();

  // If already a valid public / uploaded URL or external HTTP URL, just register and return it
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('/uploads/')) {
    const filename = trimmed.split('/').pop()?.split('?')[0] || `photo_${Date.now()}.jpg`;
    const photoRecord = {
      id: `photo_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      url: trimmed,
      filename,
      originalName: meta.originalName || filename,
      title: meta.title || meta.originalName || (meta.patientName ? `Instruksi Ranap - ${meta.patientName}` : 'Foto Instruksi IRM'),
      boxId: meta.boxId || undefined,
      boxTitle: meta.boxTitle || undefined,
      medicalRecordNo: meta.medicalRecordNo || undefined,
      patientName: meta.patientName || undefined,
      patientId: meta.patientId || undefined,
      photoType: meta.photoType || (meta.patientName || meta.medicalRecordNo ? 'patient_ranap' : 'box_instruction'),
      size: 0,
      uploadedAt: new Date().toISOString(),
    };
    try {
      const photosDb = loadPhotosDb();
      if (!photosDb.some((p) => p.url === trimmed)) {
        photosDb.unshift(photoRecord);
        savePhotosDb(photosDb);
      }
    } catch {}
    return photoRecord;
  }

  let base64Data = trimmed;
  let extension = 'jpg';

  // Support all Data URI MIME types: data:image/png;base64, data:image/jpeg;charset=utf-8;base64, data:image/webp, etc.
  if (trimmed.includes(';base64,')) {
    const parts = trimmed.split(';base64,');
    const mimePart = parts[0].toLowerCase();
    base64Data = parts[1] || '';

    if (mimePart.includes('png')) {
      extension = 'png';
    } else if (mimePart.includes('webp')) {
      extension = 'webp';
    } else if (mimePart.includes('gif')) {
      extension = 'gif';
    } else if (mimePart.includes('svg')) {
      extension = 'svg';
    } else {
      extension = 'jpg';
    }
  } else if (trimmed.startsWith('data:')) {
    const commaIdx = trimmed.indexOf(',');
    if (commaIdx !== -1) {
      base64Data = trimmed.substring(commaIdx + 1);
    }
  }

  // Strip any unexpected whitespace, returns, or quotes
  base64Data = base64Data.replace(/[\r\n\s"']/g, '');

  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }

  const id = `photo_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const filename = `${id}.${extension}`;
  const filepath = path.join(UPLOADS_DIR, filename);

  const buffer = Buffer.from(base64Data, 'base64');
  if (buffer.length === 0) {
    throw new Error('Data gambar kosong setelah dikonversi');
  }

  fs.writeFileSync(filepath, buffer);

  const publicUrl = `/uploads/${filename}`;
  const photoRecord = {
    id,
    url: publicUrl,
    filename,
    originalName: meta.originalName || filename,
    title: meta.title || meta.originalName || (meta.patientName ? `Instruksi Ranap - ${meta.patientName}` : 'Foto Instruksi IRM'),
    boxId: meta.boxId || undefined,
    boxTitle: meta.boxTitle || undefined,
    medicalRecordNo: meta.medicalRecordNo || undefined,
    patientName: meta.patientName || undefined,
    patientId: meta.patientId || undefined,
    photoType: meta.photoType || (meta.patientName || meta.medicalRecordNo ? 'patient_ranap' : 'box_instruction'),
    size: buffer.length,
    uploadedAt: new Date().toISOString(),
  };

  // Register into Photos Database
  const photosDb = loadPhotosDb();
  photosDb.unshift(photoRecord);
  savePhotosDb(photosDb);

  // Synchronize to Cloud Firestore irm_photos collection for cross-device & cross-instance persistence
  if (!isFirestoreMirrorDisabled) {
    try {
      const mimeType = extension === 'png' ? 'image/png' : extension === 'svg' ? 'image/svg+xml' : 'image/jpeg';
      const fullDataUrl = `data:${mimeType};base64,${base64Data}`;
      const photoDocRef = doc(serverFirestoreDb, 'irm_photos', id);
      setDoc(photoDocRef, {
        id,
        url: publicUrl,
        filename,
        dataUrl: fullDataUrl,
        originalName: meta.originalName || filename,
        title: photoRecord.title,
        boxId: meta.boxId || null,
        boxTitle: meta.boxTitle || null,
        medicalRecordNo: meta.medicalRecordNo || null,
        patientName: meta.patientName || null,
        patientId: meta.patientId || null,
        photoType: photoRecord.photoType,
        size: buffer.length,
        uploadedAt: photoRecord.uploadedAt,
      }).catch((e) => console.warn('[FirestorePhoto] Gagal menyimpan ke irm_photos:', e?.message || e));
    } catch (err) {
      console.warn('[FirestorePhoto] Gagal menyiapkan photo doc ref:', err);
    }
  }

  return photoRecord;
}

// POST upload single or multiple images directly and return persistent public URLs
app.post('/api/upload', (req, res) => {
  try {
    const { image, images, originalName, boxId, boxTitle, title, medicalRecordNo, patientName, patientId, photoType } = req.body;
    
    // Batch multi-image upload support
    if (Array.isArray(images) && images.length > 0) {
      const results: any[] = [];
      for (const item of images) {
        const imgData = typeof item === 'string' ? item : item.image || item.data;
        if (!imgData) continue;
        const itemMeta = {
          originalName: item.originalName || originalName,
          boxId: item.boxId || boxId,
          boxTitle: item.boxTitle || boxTitle,
          title: item.title || title,
          medicalRecordNo: item.medicalRecordNo || medicalRecordNo,
          patientName: item.patientName || patientName,
          patientId: item.patientId || patientId,
          photoType: item.photoType || photoType,
        };
        const record = saveBase64ImageToDisk(imgData, itemMeta);
        results.push(record);
      }
      return res.json({
        status: 'ok',
        photos: results,
        urls: results.map((r) => r.url),
        url: results[0]?.url || '',
      });
    }

    // Single image upload support
    if (!image) {
      return res.status(400).json({ error: 'Image data missing' });
    }

    const record = saveBase64ImageToDisk(image, { 
      originalName, 
      boxId, 
      boxTitle, 
      title, 
      medicalRecordNo, 
      patientName, 
      patientId, 
      photoType 
    });
    res.json({ status: 'ok', url: record.url, photo: record, urls: [record.url], photos: [record] });
  } catch (error: any) {
    console.error('Image upload error:', error);
    res.status(500).json({ error: error?.message || 'Failed to process image' });
  }
});

// GET /api/photos - Retrieve all stored photos in the photo database
app.get('/api/photos', async (req, res) => {
  try {
    let photos = loadPhotosDb();

    // If local disk database has no photos, hydrate from Cloud Firestore irm_photos collection
    if (photos.length === 0 && !isFirestoreMirrorDisabled) {
      try {
        const colRef = collection(serverFirestoreDb, 'irm_photos');
        const snap = await getDocs(colRef);
        const cloudPhotos: any[] = [];
        snap.forEach((d) => {
          if (d.exists()) {
            const data = d.data();
            cloudPhotos.push({
              id: data.id || d.id,
              url: data.url || `/uploads/${data.filename || d.id + '.jpg'}`,
              filename: data.filename || `${d.id}.jpg`,
              originalName: data.originalName,
              title: data.title,
              boxId: data.boxId,
              boxTitle: data.boxTitle,
              size: data.size,
              uploadedAt: data.uploadedAt,
            });
          }
        });
        if (cloudPhotos.length > 0) {
          photos = cloudPhotos.sort((a, b) => new Date(b.uploadedAt || 0).getTime() - new Date(a.uploadedAt || 0).getTime());
          savePhotosDb(photos);
        }
      } catch (cloudErr) {
        console.warn('[PhotosHydrate] Could not hydrate photos from Cloud Firestore:', cloudErr);
      }
    }

    res.json({ status: 'ok', photos });
  } catch (err: any) {
    console.error('Error fetching photos database:', err);
    res.status(500).json({ error: err?.message || 'Failed to fetch photos' });
  }
});

// DELETE /api/photos/:id - Delete a photo from database and filesystem
app.delete('/api/photos/:id', async (req, res) => {
  try {
    const photoId = req.params.id;
    const photos = loadPhotosDb();
    const photoToDelete = photos.find((p) => p.id === photoId || p.url === photoId || p.filename === photoId);
    
    if (photoToDelete) {
      const remaining = photos.filter((p) => p.id !== photoToDelete.id);
      savePhotosDb(remaining);

      // Attempt to remove physical file
      if (photoToDelete.filename) {
        const filePath = path.join(UPLOADS_DIR, photoToDelete.filename);
        if (fs.existsSync(filePath)) {
          try { fs.unlinkSync(filePath); } catch {}
        }
      }

      // Delete from Cloud Firestore irm_photos
      try {
        const photoDocRef = doc(serverFirestoreDb, 'irm_photos', photoToDelete.id);
        await deleteDoc(photoDocRef);
      } catch (delErr) {
        console.warn('[FirestorePhotoDelete] Gagal menghapus dari Cloud Firestore:', delErr);
      }
    }

    res.json({ status: 'ok' });
  } catch (err: any) {
    console.error('Error deleting photo:', err);
    res.status(500).json({ error: err?.message || 'Failed to delete photo' });
  }
});

// POST /api/queue/box-images - Mutex-safe update for box images (single / multiple collage)
app.post('/api/queue/box-images', async (req, res) => {
  try {
    const { boxId, imageUrls, imageUrl, senderDeviceId } = req.body;
    if (!boxId) {
      return res.status(400).json({ error: 'Box ID is required' });
    }

    const cleanUrls: string[] = Array.isArray(imageUrls)
      ? imageUrls.filter((u: any) => typeof u === 'string' && u.trim().length > 0)
      : (imageUrl && typeof imageUrl === 'string' && imageUrl.trim().length > 0 ? [imageUrl.trim()] : []);

    await enqueueQueueWrite(async () => {
      const state = loadStateFromFile() || {};
      const boxes: any[] = Array.isArray(state.boxes) ? state.boxes : [];
      const boxIdx = boxes.findIndex((b: any) => b.id === boxId);

      if (boxIdx >= 0) {
        const stampedAt = new Date().toISOString();
        boxes[boxIdx] = {
          ...boxes[boxIdx],
          instructionImageUrls: cleanUrls,
          instructionImageUrl: cleanUrls[0] || undefined,
          contentUpdatedAt: stampedAt,
        };
        state.boxes = boxes;
        state.lastUpdated = stampedAt;
        saveStateToFile(state);
        broadcastUpdate({ type: 'SYNC_STATE', state, senderDeviceId });
      }
    });

    res.json({ status: 'ok', boxId, imageUrls: cleanUrls });
  } catch (err: any) {
    console.error('Error updating box images:', err);
    res.status(500).json({ error: err?.message || 'Failed to update box images' });
  }
});

// ==========================================
// LAIN-LAIN IRM API (CUTI, KAS, ROTASI, SABTU)
// ==========================================

// GET /api/lain-lain - Fetch complete Lain-Lain DB
app.get('/api/lain-lain', (req, res) => {
  try {
    const data = loadLainLainDb();
    res.json(data);
  } catch (err: any) {
    console.error('Error fetching lain-lain db:', err);
    res.status(500).json({ error: err?.message || 'Failed to load lain-lain database' });
  }
});

// POST /api/lain-lain - Save & reconcile complete Lain-Lain DB
app.post('/api/lain-lain', (req, res) => {
  try {
    const payload = req.body;
    if (!payload || typeof payload !== 'object') {
      return res.status(400).json({ error: 'Invalid payload' });
    }

    const current = loadLainLainDb();
    const updated = {
      ...current,
      ...payload,
      lastUpdated: new Date().toISOString()
    };

    saveLainLainDb(updated);
    broadcastUpdate({ type: 'SYNC_LAIN_LAIN', data: updated, senderDeviceId: req.headers['x-device-id'] });
    res.json({ status: 'ok', data: updated });
  } catch (err: any) {
    console.error('Error saving lain-lain db:', err);
    res.status(500).json({ error: err?.message || 'Failed to save lain-lain database' });
  }
});

// POST /api/lain-lain/leave - Add / Update leave request
app.post('/api/lain-lain/leave', (req, res) => {
  try {
    const leaveItem = req.body;
    if (!leaveItem || !leaveItem.therapistName || !Array.isArray(leaveItem.selectedDates)) {
      return res.status(400).json({ error: 'Nama terapis dan tanggal cuti wajib diisi' });
    }

    const current = loadLainLainDb();
    const leaves: any[] = Array.isArray(current.leaveRequests) ? current.leaveRequests : [];
    const existingIdx = leaves.findIndex((l: any) => l.id === leaveItem.id);

    if (existingIdx >= 0) {
      leaves[existingIdx] = {
        ...leaves[existingIdx],
        ...leaveItem,
        submittedAt: leaves[existingIdx].submittedAt || new Date().toISOString(),
      };
    } else {
      leaves.unshift({
        ...leaveItem,
        id: leaveItem.id || `leave-${Date.now()}`,
        submittedAt: leaveItem.submittedAt || new Date().toISOString(),
      });
    }

    current.leaveRequests = leaves;
    current.lastUpdated = new Date().toISOString();
    saveLainLainDb(current);

    broadcastUpdate({ type: 'SYNC_LAIN_LAIN', data: current, senderDeviceId: req.headers['x-device-id'] });
    res.json({ status: 'ok', leave: leaveItem, data: current });
  } catch (err: any) {
    console.error('Error updating leave request:', err);
    res.status(500).json({ error: err?.message || 'Failed to save leave request' });
  }
});

// DELETE /api/lain-lain/leave/:id - Delete leave request
app.delete('/api/lain-lain/leave/:id', (req, res) => {
  try {
    const { id } = req.params;
    const current = loadLainLainDb();
    const leaves: any[] = Array.isArray(current.leaveRequests) ? current.leaveRequests : [];
    current.leaveRequests = leaves.filter((l: any) => l.id !== id);
    current.lastUpdated = new Date().toISOString();
    saveLainLainDb(current);

    broadcastUpdate({ type: 'SYNC_LAIN_LAIN', data: current, senderDeviceId: req.headers['x-device-id'] });
    res.json({ status: 'ok', id });
  } catch (err: any) {
    console.error('Error deleting leave request:', err);
    res.status(500).json({ error: err?.message || 'Failed to delete leave request' });
  }
});

// ==========================================
// INVENTARIS & STOK IRM API
// ==========================================

// GET /api/inventory - Fetch complete inventory db
app.get('/api/inventory', (req, res) => {
  try {
    const data = loadInventoryDb();
    res.json(data);
  } catch (err: any) {
    console.error('Error fetching inventory db:', err);
    res.status(500).json({ error: err?.message || 'Failed to load inventory database' });
  }
});

// POST /api/inventory - Save & reconcile complete inventory db
app.post('/api/inventory', (req, res) => {
  try {
    const payload = req.body;
    if (!payload || typeof payload !== 'object') {
      return res.status(400).json({ error: 'Invalid payload' });
    }

    const current = loadInventoryDb();
    const updated = {
      ...current,
      ...payload,
      lastUpdated: new Date().toISOString()
    };

    saveInventoryDb(updated);
    broadcastUpdate({ type: 'SYNC_INVENTORY', data: updated, senderDeviceId: req.headers['x-device-id'] });
    res.json({ status: 'ok', data: updated });
  } catch (err: any) {
    console.error('Error saving inventory db:', err);
    res.status(500).json({ error: err?.message || 'Failed to save inventory database' });
  }
});

// POST /api/inventory/item - Create or update inventory item
app.post('/api/inventory/item', (req, res) => {
  try {
    const item = req.body;
    if (!item || !item.name) {
      return res.status(400).json({ error: 'Nama barang wajib diisi' });
    }

    const current = loadInventoryDb();
    const items: any[] = Array.isArray(current.items) ? current.items : [];
    const idx = items.findIndex((i: any) => i.id === item.id);

    if (idx >= 0) {
      items[idx] = {
        ...items[idx],
        ...item,
        updatedAt: new Date().toISOString()
      };
    } else {
      items.unshift({
        ...item,
        id: item.id || `item-${Date.now()}`,
        createdAt: item.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }

    current.items = items;
    current.lastUpdated = new Date().toISOString();
    saveInventoryDb(current);

    broadcastUpdate({ type: 'SYNC_INVENTORY', data: current, senderDeviceId: req.headers['x-device-id'] });
    res.json({ status: 'ok', item, data: current });
  } catch (err: any) {
    console.error('Error saving inventory item:', err);
    res.status(500).json({ error: err?.message || 'Failed to save inventory item' });
  }
});

// DELETE /api/inventory/item/:id - Delete inventory item
app.delete('/api/inventory/item/:id', (req, res) => {
  try {
    const { id } = req.params;
    const current = loadInventoryDb();
    const items: any[] = Array.isArray(current.items) ? current.items : [];
    current.items = items.filter((i: any) => i.id !== id);
    current.lastUpdated = new Date().toISOString();
    saveInventoryDb(current);

    broadcastUpdate({ type: 'SYNC_INVENTORY', data: current, senderDeviceId: req.headers['x-device-id'] });
    res.json({ status: 'ok', id });
  } catch (err: any) {
    console.error('Error deleting inventory item:', err);
    res.status(500).json({ error: err?.message || 'Failed to delete inventory item' });
  }
});

// POST /api/inventory/mutation - Record stock mutation and update quantity
app.post('/api/inventory/mutation', (req, res) => {
  try {
    const mut = req.body;
    if (!mut || !mut.itemId || !mut.quantity) {
      return res.status(400).json({ error: 'Item ID dan jumlah mutasi wajib diisi' });
    }

    const current = loadInventoryDb();
    const items: any[] = Array.isArray(current.items) ? current.items : [];
    const mutations: any[] = Array.isArray(current.mutations) ? current.mutations : [];

    const itemIdx = items.findIndex((i: any) => i.id === mut.itemId);
    if (itemIdx === -1) {
      return res.status(404).json({ error: 'Barang inventaris tidak ditemukan' });
    }

    const targetItem = items[itemIdx];
    const prevStock = targetItem.quantity || 0;
    const qty = parseInt(mut.quantity, 10) || 0;
    let newStock = prevStock;

    if (mut.type === 'in') {
      newStock = prevStock + qty;
    } else if (mut.type === 'out') {
      newStock = Math.max(0, prevStock - qty);
    } else if (mut.type === 'adjustment') {
      newStock = qty;
    }

    items[itemIdx] = {
      ...targetItem,
      quantity: newStock,
      lastRestockDate: mut.type === 'in' ? (mut.date || new Date().toISOString().slice(0, 10)) : targetItem.lastRestockDate,
      updatedAt: new Date().toISOString()
    };

    const newMutation = {
      ...mut,
      id: mut.id || `mut-${Date.now()}`,
      previousStock: prevStock,
      currentStock: newStock,
      createdAt: mut.createdAt || new Date().toISOString()
    };

    mutations.unshift(newMutation);

    current.items = items;
    current.mutations = mutations;
    current.lastUpdated = new Date().toISOString();
    saveInventoryDb(current);

    broadcastUpdate({ type: 'SYNC_INVENTORY', data: current, senderDeviceId: req.headers['x-device-id'] });
    res.json({ status: 'ok', mutation: newMutation, item: items[itemIdx], data: current });
  } catch (err: any) {
    console.error('Error recording stock mutation:', err);
    res.status(500).json({ error: err?.message || 'Failed to record stock mutation' });
  }
});

// GET Real-time SSE stream endpoint for all devices
app.get('/api/events', (req, res) => {
  const clientId = `client_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.socket) {
    req.socket.setTimeout(0);
    req.socket.setNoDelay(true);
    req.socket.setKeepAlive(true, 10000);
  }

  const clientInfo: SSEClientInfo = {
    id: clientId,
    res,
    ip: clientIp,
    connectedAt: new Date().toISOString(),
  };

  sseClients.push(clientInfo);

  // Send current state upon initial connection
  try {
    const currentState = loadStateFromFile();
    if (currentState) {
      // PENTING: sama seperti GET /api/queue - isExplicitReset/resetConfirmed
      // di disk HANYA boleh berarti "reset baru saja terjadi SEKARANG", bukan
      // properti permanen. Status INIT_STATE ini dikirim ke SETIAP klien yang
      // baru terhubung (termasuk setiap kali halaman dibuka/refresh) - kalau
      // disk kebetulan menyimpan flag ini true dari reset lama, klien akan
      // mengira reset baru saja terjadi LAGI dan mengosongkan tampilan
      // pasiennya sendiri walau data sebenarnya normal.
      res.write(`data: ${JSON.stringify({ type: 'INIT_STATE', state: { ...currentState, isExplicitReset: false, resetConfirmed: false } })}\n\n`);
    }
  } catch (e) {
    console.warn(`[SSE] Failed sending initial state to client ${clientId}:`, e);
  }

  const cleanupClient = () => {
    sseClients = sseClients.filter((client) => client.id !== clientId);
  };

  req.on('close', cleanupClient);
  req.on('end', cleanupClient);
  res.on('finish', cleanupClient);
  res.on('error', cleanupClient);
});

async function flushPendingFirestoreMirrors(): Promise<void> {
  // PENTING: cek dan eksekusi data pending langsung dengan membersihkan timer debounce
  // dan maxWait untuk keempat channel mirror ke Firestore.
  const tasks: Promise<any>[] = [];

  // 1. Queue State
  if (pendingMirrorState && !isFirestoreMirrorDisabled) {
    tasks.push(flushQueueStateMirrorNow().catch((err) => console.warn('[Shutdown] Gagal flush queue state mirror:', err)));
  } else {
    if (mirrorDebounceTimer) { clearTimeout(mirrorDebounceTimer); mirrorDebounceTimer = null; }
    if (mirrorMaxWaitTimer) { clearTimeout(mirrorMaxWaitTimer); mirrorMaxWaitTimer = null; }
  }

  // 2. Daily Archive Months
  const monthKeysToFlush = Array.from(pendingDailyArchiveMirrors.keys());
  for (const monthKey of monthKeysToFlush) {
    if (!isFirestoreMirrorDisabled) {
      tasks.push(flushArchiveMonthMirrorNow(monthKey).catch((err) => console.warn(`[Shutdown] Gagal flush daily archive mirror (${monthKey}):`, err)));
    }
  }
  for (const timer of dailyArchiveMirrorDebounceTimers.values()) clearTimeout(timer);
  dailyArchiveMirrorDebounceTimers.clear();
  for (const timer of dailyArchiveMirrorMaxWaitTimers.values()) clearTimeout(timer);
  dailyArchiveMirrorMaxWaitTimers.clear();
  if (isFirestoreMirrorDisabled) {
    pendingDailyArchiveMirrors.clear();
  }

  // 3. Master Patients
  if (pendingMasterPatientsMirror && !isFirestoreMirrorDisabled) {
    tasks.push(flushMasterPatientsMirrorNow().catch((err) => console.warn('[Shutdown] Gagal flush master patients mirror:', err)));
  } else {
    if (masterPatientsMirrorDebounceTimer) { clearTimeout(masterPatientsMirrorDebounceTimer); masterPatientsMirrorDebounceTimer = null; }
    if (masterPatientsMirrorMaxWaitTimer) { clearTimeout(masterPatientsMirrorMaxWaitTimer); masterPatientsMirrorMaxWaitTimer = null; }
  }

  // 4. Ranap History
  if (pendingRanapHistoryMirror && !isFirestoreMirrorDisabled) {
    tasks.push(flushRanapHistoryMirrorNow().catch((err) => console.warn('[Shutdown] Gagal flush ranap history mirror:', err)));
  } else {
    if (ranapHistoryMirrorDebounceTimer) { clearTimeout(ranapHistoryMirrorDebounceTimer); ranapHistoryMirrorDebounceTimer = null; }
    if (ranapHistoryMirrorMaxWaitTimer) { clearTimeout(ranapHistoryMirrorMaxWaitTimer); ranapHistoryMirrorMaxWaitTimer = null; }
  }

  if (tasks.length > 0) {
    console.log(`[FirestoreMirror] Flushing ${tasks.length} pending Firestore mirror write(s)...`);
    await Promise.allSettled(tasks);
  }
}

let isShuttingDown = false;
async function handleShutdownSignal(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`[Shutdown] Received ${signal}, flushing pending writes before exit...`);
  try {
    flushPendingMasterArchiveSync();
    await flushPendingFirestoreMirrors();
  } finally {
    process.exit(0);
  }
}

process.on('SIGTERM', () => { void handleShutdownSignal('SIGTERM'); });
process.on('SIGINT', () => { void handleShutdownSignal('SIGINT'); });

async function startServer() {
  migrateLegacyDailyArchiveIfNeeded();

  // Pulihkan state dari Cloud Firestore dulu kalau disk lokal instance ini kosong/baru
  // (mis. instance backend di-recycle oleh platform hosting saat idle) sebelum mulai
  // melayani request, supaya device yang connect tidak melihat papan antrian kosong.
  // HARUS paling dulu: catatan "pasien ini sudah dibersihkan" perlu sudah ada di
  // memori SEBELUM state antrean dipulihkan dari cadangan, supaya cadangan yang
  // kebetulan masih versi sebelum reset tidak sempat menghidupkan pasien lama.
  await hydrateResetTombstonesFromFirestoreIfNeeded();

  await Promise.all([
    hydrateStateFromFirestoreIfNeeded(),
    hydrateDailyArchiveFromFirestoreIfNeeded(),
    hydrateMasterPatientsFromFirestoreIfNeeded(),
    hydrateRanapHistoryFromFirestoreIfNeeded(),
  ]);

  startPeriodicFirestoreSync();

  // Vite integration in development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Sistem Antrian IRM RSPP Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
