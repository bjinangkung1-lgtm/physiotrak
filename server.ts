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

// Increase payload limit for image uploads
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Directories setup
const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'queue_store.json');
const MASTER_PATIENTS_FILE = path.join(DATA_DIR, 'patients_master.json');
const DAILY_ARCHIVE_FILE = path.join(DATA_DIR, 'daily_archive.json');
const RANAP_HISTORY_FILE = path.join(DATA_DIR, 'ranap_history.json');
const PHOTOS_DB_FILE = path.join(DATA_DIR, 'photos_db.json');
const LAIN_LAIN_DB_FILE = path.join(DATA_DIR, 'lain_lain_db.json');
const INVENTORY_DB_FILE = path.join(DATA_DIR, 'inventory_db.json');
const SECURITY_CONFIG_FILE = path.join(DATA_DIR, 'security_config.json');
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

// Daily Archive File Helpers (Map of date YYYY-MM-DD -> list of DailyPatientVisit)
function loadDailyArchive(): Record<string, any[]> {
  try {
    if (fs.existsSync(DAILY_ARCHIVE_FILE)) {
      const content = fs.readFileSync(DAILY_ARCHIVE_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (parsed && typeof parsed === 'object') {
        return parsed;
      }
    }
  } catch (err) {
    console.error('Error reading DAILY_ARCHIVE_FILE:', err);
  }

  const initial = {};
  saveDailyArchive(initial);
  return initial;
}

function saveDailyArchive(archive: Record<string, any[]>) {
  try {
    safeAtomicWriteJson(DAILY_ARCHIVE_FILE, archive);
  } catch (err) {
    console.error('Error writing DAILY_ARCHIVE_FILE:', err);
  }
  mirrorDailyArchiveToFirestore(archive);
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

// Helper: sync patient array to today's daily archive and update master patient visits
function syncPatientsToMasterAndArchive(patients: any[]) {
  if (!Array.isArray(patients) || patients.length === 0) return;

  const today = getLocalDateStringWIB();
  const masterPatients = loadMasterPatients();
  const dailyArchive = loadDailyArchive();

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

      // Update last visited date and increment if new visit day
      if (current.lastVisitDate !== today) {
        current.lastVisitDate = today;
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
        registeredDate: today,
        lastVisitDate: today,
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

  // 2. ACCUMULATIVE Sync to Daily Archive for today (DO NOT OVERWRITE OR WIPE PREVIOUS PATIENTS OF TODAY)
  const existingVisits = dailyArchive[today] || [];
  const visitsMap = new Map<string, any>();
  const currentStateForBoxes = loadStateFromFile();
  const currentBoxes = (currentStateForBoxes && Array.isArray(currentStateForBoxes.boxes)) ? currentStateForBoxes.boxes : [];

  // Keep all existing visits recorded today
  existingVisits.forEach((v: any) => {
    if (v && v.id) visitsMap.set(v.id, v);
  });

  // Upsert incoming active patients
  patients.forEach((p) => {
    if (!p || !p.id || !p.patientName || !p.medicalRecordNo) return;
    const prev = visitsMap.get(p.id) || {};
    const boxMatch = currentBoxes.find((b: any) => b.id === (p.boxId || prev.boxId));

    visitsMap.set(p.id, {
      ...prev,
      id: p.id,
      visitDate: today,
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
    });
  });

  dailyArchive[today] = Array.from(visitsMap.values());
  saveDailyArchive(dailyArchive);
}

// Debounced master patient & daily archive synchronization helper
let masterArchiveDebounceTimer: NodeJS.Timeout | null = null;
let pendingMasterArchivePatients: any[] | null = null;

function scheduleSyncPatientsToMasterAndArchive(patients: any[]) {
  pendingMasterArchivePatients = patients;
  if (masterArchiveDebounceTimer) clearTimeout(masterArchiveDebounceTimer);
  masterArchiveDebounceTimer = setTimeout(() => {
    masterArchiveDebounceTimer = null;
    const toSync = pendingMasterArchivePatients;
    pendingMasterArchivePatients = null;
    if (toSync) {
      try {
        syncPatientsToMasterAndArchive(toSync);
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

function broadcastUpdate(data: any) {
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
    currentCallingPatient: null,
    currentCallingBox: null,
    boxOrderUpdatedAt: null,
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
          const missingBoxes = initial.boxes.filter((b: any) => !existingIds.has(b.id));
          if (missingBoxes.length > 0) {
            parsed.boxes = [...parsed.boxes, ...missingBoxes];
          }
          saveStateToFile(parsed);
        }
        return parsed;
      }
    }
  } catch (err) {
    console.error('Error reading DB_FILE:', err);
  }

  // Initialize file with default state
  const initialState = getInitialServerState();
  saveStateToFile(initialState);
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
let isFirestoreMirrorDisabled = (() => {
  try {
    if (fs.existsSync(FIRESTORE_QUOTA_FLAG_FILE)) {
      const content = fs.readFileSync(FIRESTORE_QUOTA_FLAG_FILE, 'utf-8');
      const flagTs = parseInt(content, 10);
      if (flagTs && Date.now() - flagTs < 3600000) {
        return true;
      }
      try { fs.unlinkSync(FIRESTORE_QUOTA_FLAG_FILE); } catch {}
    }
  } catch {}
  return false;
})();
let mirrorDebounceTimer: NodeJS.Timeout | null = null;
let pendingMirrorState: any = null;

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
    console.warn(`[${label}] Kuota Firestore habis, mirroring dinonaktifkan sementara.`);
  } else {
    console.warn(`[${label}] Gagal mencadangkan ke Cloud Firestore:`, err);
  }
  return isQuotaError;
}

async function mirrorStateToFirestore(state: any): Promise<void> {
  // If Firestore mirror is disabled due to quota exhaustion, exit immediately
  if (isFirestoreMirrorDisabled) {
    return;
  }

  pendingMirrorState = state;

  if (mirrorDebounceTimer) {
    clearTimeout(mirrorDebounceTimer);
  }

  // Debounce writes by 5s to batch rapid changes and minimize write units
  mirrorDebounceTimer = setTimeout(async () => {
    mirrorDebounceTimer = null;
    if (isFirestoreMirrorDisabled) return;

    const currentState = pendingMirrorState;
    if (!currentState) return;

    try {
      const sanitized = JSON.parse(JSON.stringify(currentState));
      await setDoc(QUEUE_STATE_DOC_REF, {
        ...sanitized,
        lastMirroredAt: new Date().toISOString(),
      });
    } catch (err: any) {
      handleFirestoreQuotaError(err, 'FirestoreMirror');
    }
  }, 5000);
}

// Mirror & Hydrate for Daily Archive (Laporan Harian & Bulanan per Terapis)
let dailyArchiveMirrorDebounceTimer: NodeJS.Timeout | null = null;
let pendingDailyArchiveMirror: Record<string, any[]> | null = null;

async function mirrorDailyArchiveToFirestore(archive: Record<string, any[]>): Promise<void> {
  if (isFirestoreMirrorDisabled) return;
  pendingDailyArchiveMirror = archive;
  if (dailyArchiveMirrorDebounceTimer) clearTimeout(dailyArchiveMirrorDebounceTimer);
  dailyArchiveMirrorDebounceTimer = setTimeout(async () => {
    dailyArchiveMirrorDebounceTimer = null;
    if (isFirestoreMirrorDisabled) return;
    const current = pendingDailyArchiveMirror;
    if (!current) return;
    try {
      const sanitized = JSON.parse(JSON.stringify(current));
      await setDoc(DAILY_ARCHIVE_DOC_REF, { archive: sanitized, lastMirroredAt: new Date().toISOString() });
    } catch (err: any) {
      handleFirestoreQuotaError(err, 'DailyArchiveMirror');
    }
  }, 5000);
}

async function hydrateDailyArchiveFromFirestoreIfNeeded(): Promise<void> {
  try {
    if (fs.existsSync(DAILY_ARCHIVE_FILE)) {
      try {
        const raw = JSON.parse(fs.readFileSync(DAILY_ARCHIVE_FILE, 'utf-8'));
        if (raw && typeof raw === 'object' && Object.keys(raw).length > 0) return;
      } catch {}
    }
    const snapshot = await getDoc(DAILY_ARCHIVE_DOC_REF);
    if (!snapshot.exists()) return;
    const cloudArchive = snapshot.data()?.archive;
    if (cloudArchive && typeof cloudArchive === 'object' && Object.keys(cloudArchive).length > 0) {
      console.log(`[FirestoreHydrate] Memulihkan ${Object.keys(cloudArchive).length} tanggal arsip dari Firestore.`);
      safeAtomicWriteJson(DAILY_ARCHIVE_FILE, cloudArchive);
    }
  } catch (err) {
    console.warn('[FirestoreHydrate] Gagal memulihkan daily_archive:', err);
  }
}

// Mirror & Hydrate for Master Patients (Database Pasien)
let masterPatientsMirrorDebounceTimer: NodeJS.Timeout | null = null;
let pendingMasterPatientsMirror: any[] | null = null;

async function mirrorMasterPatientsToFirestore(patients: any[]): Promise<void> {
  if (isFirestoreMirrorDisabled) return;
  pendingMasterPatientsMirror = patients;
  if (masterPatientsMirrorDebounceTimer) clearTimeout(masterPatientsMirrorDebounceTimer);
  masterPatientsMirrorDebounceTimer = setTimeout(async () => {
    masterPatientsMirrorDebounceTimer = null;
    if (isFirestoreMirrorDisabled) return;
    const current = pendingMasterPatientsMirror;
    if (!current) return;
    try {
      const sanitized = JSON.parse(JSON.stringify(current));
      await setDoc(MASTER_PATIENTS_DOC_REF, { patients: sanitized, lastMirroredAt: new Date().toISOString() });
    } catch (err: any) {
      handleFirestoreQuotaError(err, 'MasterPatientsMirror');
    }
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

// Mirror & Hydrate for Ranap History (Riwayat Antrean Rawat Inap)
let ranapHistoryMirrorDebounceTimer: NodeJS.Timeout | null = null;
let pendingRanapHistoryMirror: any[] | null = null;

async function mirrorRanapHistoryToFirestore(history: any[]): Promise<void> {
  if (isFirestoreMirrorDisabled) return;
  pendingRanapHistoryMirror = history;
  if (ranapHistoryMirrorDebounceTimer) clearTimeout(ranapHistoryMirrorDebounceTimer);
  ranapHistoryMirrorDebounceTimer = setTimeout(async () => {
    ranapHistoryMirrorDebounceTimer = null;
    if (isFirestoreMirrorDisabled) return;
    const current = pendingRanapHistoryMirror;
    if (!current) return;
    try {
      const sanitized = JSON.parse(JSON.stringify(current));
      await setDoc(RANAP_HISTORY_DOC_REF, { history: sanitized, lastMirroredAt: new Date().toISOString() });
    } catch (err: any) {
      handleFirestoreQuotaError(err, 'RanapHistoryMirror');
    }
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
      saveStateToFile(cloudState);
    }
  } catch (err) {
    console.warn('[FirestoreHydrate] Gagal memulihkan state dari Cloud Firestore, melanjutkan dengan state lokal:', err);
  }
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
    return {
      boxes: Array.isArray(incomingPayload.boxes) && incomingPayload.boxes.length > 0 ? incomingPayload.boxes : (existingState.boxes || []),
      patients: [],
      callLogs: [],
      notifications: [],
      savedOfficers: Array.isArray(incomingPayload.savedOfficers) ? incomingPayload.savedOfficers : (existingState.savedOfficers || []),
      ranapQueue: Array.isArray(existingState.ranapQueue) ? existingState.ranapQueue : [],
      currentCallingPatient: null,
      currentCallingBox: null,
      isExplicitReset: true,
      resetConfirmed: true,
      lastResetAt: resetTime,
      boxOrderUpdatedAt: incomingPayload.boxOrderUpdatedAt || existingState.boxOrderUpdatedAt || null,
      deletedPatientIds: [],
      deletedRanapIds: Array.isArray(existingState.deletedRanapIds) ? existingState.deletedRanapIds : [],
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
  const resetEpoch = effectiveResetAt ? new Date(effectiveResetAt).getTime() : 0;

  // 1. Reconcile Patients
  const existingPatients: any[] = Array.isArray(existingState.patients) ? existingState.patients : [];
  const incomingPatients: any[] = Array.isArray(incomingPayload.patients) ? incomingPayload.patients : [];
  
  // Accumulate deleted patient tombstones across devices and sessions
  const existingDeleted: string[] = Array.isArray(existingState.deletedPatientIds) ? existingState.deletedPatientIds : [];
  const incomingDeleted: string[] = Array.isArray(incomingPayload.deletedPatientIds) ? incomingPayload.deletedPatientIds : [];
  const cumulativeDeletedList = Array.from(new Set([...existingDeleted, ...incomingDeleted])).slice(-1000);
  const deletedPatientIds = new Set(cumulativeDeletedList);

  const patientMap = new Map<string, any>();
  for (const p of existingPatients) {
    if (p && p.id && !deletedPatientIds.has(p.id)) {
      // Discard stale patients created before or at the last reset watermark
      if (resetEpoch > 0) {
        const itemTime = new Date(p.createdAt || p.registeredAt || 0).getTime();
        if (!itemTime || itemTime <= resetEpoch) {
          continue;
        }
      }
      patientMap.set(p.id, { ...p });
    }
  }

  for (const inP of incomingPatients) {
    if (!inP || !inP.id || deletedPatientIds.has(inP.id)) continue;

    // Discard stale incoming patients created before or at the last reset watermark
    if (resetEpoch > 0) {
      const itemTime = new Date(inP.createdAt || inP.registeredAt || 0).getTime();
      if (!itemTime || itemTime <= resetEpoch) {
        continue;
      }
    }

    const existing = patientMap.get(inP.id);
    if (!existing) {
      // Stempel createdAt memakai jam SERVER (bukan jam device pengirim) saat pasien
      // pertama kali muncul di state bersama, supaya device dengan jam salah/mundur
      // tidak membuat entrinya disaring diam-diam oleh device lain saat reconcile.
      patientMap.set(inP.id, { ...inP, createdAt: new Date().toISOString() });
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
  // Recency-wins helper for box CONTENT fields (warna, judul, gambar, dll):
  // tanpa ini, siapa pun yang broadcast full-state-nya sampai ke server
  // PALING TERAKHIR akan menang untuk semua field, walau isinya lebih basi
  // (mis. perangkat lain yang belum menerima perubahan warna terbaru lalu
  // ikut menyiarkan ulang warna lama - inilah sebab warna kotak "reset
  // sendiri" beberapa saat setelah diganti). Dengan watermark
  // `contentUpdatedAt` per kotak, box yang timestamp-nya lebih baru yang
  // menang untuk konten, sementara posisi/urutan tetap diatur terpisah oleh
  // boxOrderUpdatedAt di atas.
  const pickBoxContentBase = (existing: any, inB: any) => {
    const existingContentTime = existing.contentUpdatedAt ? new Date(existing.contentUpdatedAt).getTime() : 0;
    const incomingContentTime = inB.contentUpdatedAt ? new Date(inB.contentUpdatedAt).getTime() : 0;
    const existingIsNewer = existingContentTime > incomingContentTime;
    return {
      base: existingIsNewer ? existing : inB,
      other: existingIsNewer ? inB : existing,
      contentUpdatedAt: existingIsNewer ? existing.contentUpdatedAt : (inB.contentUpdatedAt || existing.contentUpdatedAt)
    };
  };

  const existingBoxes: any[] = Array.isArray(existingState.boxes) ? existingState.boxes : [];
  const incomingBoxes: any[] = Array.isArray(incomingPayload.boxes) ? incomingPayload.boxes : [];
  const deletedBoxIds = new Set(Array.isArray(incomingPayload.deletedBoxIds) ? incomingPayload.deletedBoxIds : []);

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
        const { base: contentBase, other: contentOther, contentUpdatedAt } = pickBoxContentBase(existing, inB);

        // Preserve instructionImageUrls if the winning content version did not supply them
        let finalImageUrls = contentBase.instructionImageUrls;
        if (finalImageUrls === undefined && contentOther.instructionImageUrls) {
          finalImageUrls = contentOther.instructionImageUrls;
        }

        mergedBoxes.push(sanitizeServerBox({
          ...contentOther,
          ...contentBase,
          instructionImageUrls: finalImageUrls,
          instructionImageUrl: (Array.isArray(finalImageUrls) && finalImageUrls.length > 0)
            ? finalImageUrls[0]
            : (contentBase.instructionImageUrl || contentOther.instructionImageUrl || undefined),
          order: typeof inB.order === 'number' ? inB.order : idx,
          hasUnreadNewInput: inB.hasUnreadNewInput !== undefined ? inB.hasUnreadNewInput : existing.hasUnreadNewInput,
          contentUpdatedAt
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
        const { base: contentBase, other: contentOther, contentUpdatedAt } = pickBoxContentBase(existing, inB);

        let finalImageUrls = contentBase.instructionImageUrls;
        if (finalImageUrls === undefined && contentOther.instructionImageUrls) {
          finalImageUrls = contentOther.instructionImageUrls;
        }

        mergedBoxes.push(sanitizeServerBox({
          ...contentOther,
          ...contentBase,
          instructionImageUrls: finalImageUrls,
          instructionImageUrl: (Array.isArray(finalImageUrls) && finalImageUrls.length > 0)
            ? finalImageUrls[0]
            : (contentBase.instructionImageUrl || contentOther.instructionImageUrl || undefined),
          order: typeof existing.order === 'number' ? existing.order : idx,
          hasUnreadNewInput: inB.hasUnreadNewInput !== undefined ? inB.hasUnreadNewInput : existing.hasUnreadNewInput,
          contentUpdatedAt
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
    currentCallingPatient,
    currentCallingBox,
    isExplicitReset: Boolean(existingState?.isExplicitReset && mergedPatients.length === 0),
    resetConfirmed: Boolean(existingState?.resetConfirmed && mergedPatients.length === 0),
    lastResetAt: effectiveResetAt || null,
    boxOrderUpdatedAt: effectiveBoxOrderUpdatedAt,
    deletedPatientIds: cumulativeDeletedList,
    deletedRanapIds: cumulativeDeletedRanapList,
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
  res.json({ status: 'ok', state });
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
      const mergedState = reconcileQueueStates(existingState, payload);

      saveStateToFile(mergedState);

      broadcastUpdate({ type: 'SYNC_STATE', state: mergedState, senderDeviceId });
      console.log(`[QueueSync] Synced from device ${senderDeviceId || 'unknown'}: ${mergedState.patients.length} patients, ${mergedState.boxes.length} boxes.`);

      if (Array.isArray(mergedState.patients) && mergedState.patients.length > 0) {
        scheduleSyncPatientsToMasterAndArchive(mergedState.patients);
      }
    });

    res.json({ status: 'ok', updated: new Date().toISOString() });
  } catch (error: any) {
    console.error('[QueueSync] Error updating state:', error);
    res.status(500).json({ error: 'Gagal memperbarui antrian' });
  }
});

// POST /api/queue/reset - Explicit authoritative queue purge across all connected devices
app.post('/api/queue/reset', async (req, res) => {
  try {
    const { lastResetAt, senderDeviceId } = req.body || {};
    const resetTime = lastResetAt || new Date().toISOString();

    await enqueueQueueWrite(async () => {
      const existingState = loadStateFromFile() || getInitialServerState();
      const resetState = {
        boxes: Array.isArray(existingState.boxes) && existingState.boxes.length > 0 ? existingState.boxes : getInitialServerState().boxes,
        patients: [],
        ranapQueue: Array.isArray(existingState.ranapQueue) ? existingState.ranapQueue : [],
        callLogs: [],
        notifications: [],
        savedOfficers: Array.isArray(existingState.savedOfficers) ? existingState.savedOfficers : [],
        currentCallingPatient: null,
        currentCallingBox: null,
        isExplicitReset: true,
        resetConfirmed: true,
        lastResetAt: resetTime,
        boxOrderUpdatedAt: existingState.boxOrderUpdatedAt || null,
        deletedPatientIds: [],
        deletedRanapIds: Array.isArray(existingState.deletedRanapIds) ? existingState.deletedRanapIds : [],
        lastUpdated: new Date().toISOString(),
      };

      saveStateToFile(resetState);
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
    const dailyArchive = loadDailyArchive();
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
      saveDailyArchive(data.dailyArchive);
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
    const dailyArchive = loadDailyArchive();
    const currentState = loadStateFromFile();

    // If querying today and archive is empty, populate from current queue
    if (targetDate === today && (!dailyArchive[today] || dailyArchive[today].length === 0) && currentState?.patients?.length > 0) {
      syncPatientsToMasterAndArchive(currentState.patients);
    }

    const visits = dailyArchive[targetDate] || [];
    const allDates = Object.keys(dailyArchive).sort().reverse();
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
    const targetDate = date || today;
    if (!visit || !visit.patientName || !visit.medicalRecordNo) {
      return res.status(400).json({ error: 'Data kunjungan pasien tidak lengkap' });
    }

    let updatedVisit: any;

    await enqueueQueueWrite(async () => {
      const dailyArchive = loadDailyArchive();
      const visits = dailyArchive[targetDate] || [];
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
      };

      if (existingIdx >= 0) {
        visits[existingIdx] = updatedVisit;
      } else {
        visits.push(updatedVisit);
      }

      dailyArchive[targetDate] = visits;
      saveDailyArchive(dailyArchive);

      // If target date is today, also sync safely with active queue
      if (targetDate === today) {
        const currentState = loadStateFromFile();
        if (currentState && Array.isArray(currentState.patients)) {
          const isDeleted = Array.isArray(currentState.deletedPatientIds) && currentState.deletedPatientIds.includes(updatedVisit.id);
          if (!isDeleted) {
            const existingQueueIdx = currentState.patients.findIndex((p: any) => p.id === updatedVisit.id);
            if (existingQueueIdx >= 0) {
              currentState.patients[existingQueueIdx] = {
                ...currentState.patients[existingQueueIdx],
                ...updatedVisit,
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
      const dailyArchive = loadDailyArchive();
      const existing = dailyArchive[date] || [];
      const map = new Map<string, any>();
      existing.forEach((v: any) => { if (v && v.id) map.set(v.id, v); });
      visits.forEach((v: any) => {
        if (v && v.id) {
          const prev = map.get(v.id);
          map.set(v.id, { ...prev, ...v, visitDate: date });
        }
      });
      dailyArchive[date] = Array.from(map.values());
      saveDailyArchive(dailyArchive);
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
    const dailyArchive = loadDailyArchive();
    const currentState = loadStateFromFile();

    // If active queue has patients for today and today matches this month, ensure synced
    if (today.startsWith(monthPrefix) && (!dailyArchive[today] || dailyArchive[today].length === 0) && currentState?.patients?.length > 0) {
      syncPatientsToMasterAndArchive(currentState.patients);
    }

    // Collect all visits in this month
    const allMonthlyVisits: any[] = [];
    Object.keys(dailyArchive).forEach((dateKey) => {
      if (dateKey.startsWith(monthPrefix) && Array.isArray(dailyArchive[dateKey])) {
        dailyArchive[dateKey].forEach((v: any) => {
          allMonthlyVisits.push({
            ...v,
            visitDate: dateKey
          });
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

// Infer divisi terapi (fisio/okupasi/wicara) dari nama petugas/judul kotak
// sebuah kunjungan arsip. Dipakai HANYA untuk analitik agregat (grafik
// kunjungan), bukan sumber kebenaran data pasien - meniru aturan penamaan
// yang sama dengan getTherapistCategory di src/utils/savedOfficersService.ts
// supaya konsisten dengan cara divisi ditentukan di seluruh aplikasi.
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

// GET /api/analytics/visit-trends?year=YYYY&month=MM
// Data untuk grafik "Kunjungan Harian" (bulan tertentu) & "Kunjungan Bulanan"
// (tahun tertentu) di tab Matriks Kartu Terapis. Dihitung dari arsip
// kunjungan harian (daily_archive.json) + antrean aktif hari ini (kalau
// tanggal/bulan/tahun yang diminta mencakup hari ini & belum sempat
// terarsip).
//
// ATURAN HITUNG "Total" per hari: 1 pasien yang ditangani di 3 tempat
// sekaligus (Fisio, Okupasi, Wicara) pada HARI YANG SAMA dihitung 1, bukan 3
// - dideduplikasi berdasarkan No. Rekam Medis (fallback ke nama kalau RM
// kosong). Untuk grafik per-divisi (Fisio/Okupasi/Wicara), tiap divisi
// dihitung terpisah (dedup di dalam divisi yang sama saja, supaya rekam
// medis ganda karena input ulang tidak dobel-hitung).
//
// "Kunjungan Bulanan": jumlah KUNJUNGAN (bukan pasien unik sepanjang bulan)
// - satu pasien yang datang 5 hari berbeda dalam sebulan dihitung 5
// kunjungan, karena tiap hari kedatangan adalah satu kunjungan terpisah.
app.get('/api/analytics/visit-trends', (req, res) => {
  try {
    const now = new Date();
    const targetYear = req.query.year ? parseInt(req.query.year as string, 10) : now.getFullYear();
    const targetMonth = req.query.month ? parseInt(req.query.month as string, 10) : now.getMonth() + 1;
    const monthPrefix = `${targetYear}-${String(targetMonth).padStart(2, '0')}`;
    const yearPrefix = `${targetYear}-`;

    const today = getLocalDateStringWIB();
    const dailyArchive = loadDailyArchive();
    const currentState = loadStateFromFile();

    // Gabungkan arsip hari ini dengan antrean aktif LIVE (kalau hari ini
    // belum sempat diarsipkan sepenuhnya), supaya grafik hari ini tetap
    // akurat tanpa menunggu debounce arsip 1.5 detik selesai.
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

    const dedupKey = (v: any) => (v.medicalRecordNo && String(v.medicalRecordNo).trim()) || (v.patientName && String(v.patientName).trim().toUpperCase()) || v.id;

    const summarizeDay = (records: any[]) => {
      const totalSet = new Set<string>();
      const catSets: Record<'fisio' | 'okupasi' | 'wicara', Set<string>> = { fisio: new Set(), okupasi: new Set(), wicara: new Set() };
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

    // --- Grafik Kunjungan Harian (bulan yang diminta) ---
    const daysInMonth = new Date(targetYear, targetMonth, 0).getDate();
    const daily = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const dateKey = `${monthPrefix}-${String(day).padStart(2, '0')}`;
      const summary = summarizeDay(visitsByDate[dateKey] || []);
      daily.push({ date: dateKey, day, ...summary });
    }

    // --- Grafik Kunjungan Bulanan (tahun yang diminta) ---
    const monthlyBuckets: Array<{ total: number; fisio: number; okupasi: number; wicara: number }> =
      Array.from({ length: 12 }, () => ({ total: 0, fisio: 0, okupasi: 0, wicara: 0 }));
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

    res.json({
      status: 'ok',
      year: targetYear,
      month: targetMonth,
      daily,
      monthly,
    });
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
        boxes[boxIdx] = {
          ...boxes[boxIdx],
          instructionImageUrls: cleanUrls,
          instructionImageUrl: cleanUrls[0] || undefined,
        };
        state.boxes = boxes;
        state.lastUpdated = new Date().toISOString();
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
      res.write(`data: ${JSON.stringify({ type: 'INIT_STATE', state: currentState })}\n\n`);
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
  const tasks: Promise<any>[] = [];

  if (mirrorDebounceTimer) {
    clearTimeout(mirrorDebounceTimer);
    mirrorDebounceTimer = null;
    if (pendingMirrorState && !isFirestoreMirrorDisabled) {
      tasks.push(setDoc(QUEUE_STATE_DOC_REF, {
        ...JSON.parse(JSON.stringify(pendingMirrorState)),
        lastMirroredAt: new Date().toISOString(),
      }).catch((err) => console.warn('[Shutdown] Gagal flush queue state mirror:', err)));
    }
  }
  if (dailyArchiveMirrorDebounceTimer) {
    clearTimeout(dailyArchiveMirrorDebounceTimer);
    dailyArchiveMirrorDebounceTimer = null;
    if (pendingDailyArchiveMirror && !isFirestoreMirrorDisabled) {
      tasks.push(setDoc(DAILY_ARCHIVE_DOC_REF, {
        archive: JSON.parse(JSON.stringify(pendingDailyArchiveMirror)),
        lastMirroredAt: new Date().toISOString(),
      }).catch((err) => console.warn('[Shutdown] Gagal flush daily archive mirror:', err)));
    }
  }
  if (masterPatientsMirrorDebounceTimer) {
    clearTimeout(masterPatientsMirrorDebounceTimer);
    masterPatientsMirrorDebounceTimer = null;
    if (pendingMasterPatientsMirror && !isFirestoreMirrorDisabled) {
      tasks.push(setDoc(MASTER_PATIENTS_DOC_REF, {
        patients: JSON.parse(JSON.stringify(pendingMasterPatientsMirror)),
        lastMirroredAt: new Date().toISOString(),
      }).catch((err) => console.warn('[Shutdown] Gagal flush master patients mirror:', err)));
    }
  }
  if (ranapHistoryMirrorDebounceTimer) {
    clearTimeout(ranapHistoryMirrorDebounceTimer);
    ranapHistoryMirrorDebounceTimer = null;
    if (pendingRanapHistoryMirror && !isFirestoreMirrorDisabled) {
      tasks.push(setDoc(RANAP_HISTORY_DOC_REF, {
        history: JSON.parse(JSON.stringify(pendingRanapHistoryMirror)),
        lastMirroredAt: new Date().toISOString(),
      }).catch((err) => console.warn('[Shutdown] Gagal flush ranap history mirror:', err)));
    }
  }

  if (tasks.length > 0) {
    console.log(`[Shutdown] Flushing ${tasks.length} pending Firestore mirror write(s)...`);
    await Promise.allSettled(tasks);
  }
}

let isShuttingDown = false;
async function handleShutdownSignal(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`[Shutdown] Received ${signal}, flushing pending writes before exit...`);
  try { await flushPendingFirestoreMirrors(); } finally { process.exit(0); }
}

process.on('SIGTERM', () => { void handleShutdownSignal('SIGTERM'); });
process.on('SIGINT', () => { void handleShutdownSignal('SIGINT'); });

async function startServer() {
  // Pulihkan state dari Cloud Firestore dulu kalau disk lokal instance ini kosong/baru
  // (mis. instance backend di-recycle oleh platform hosting saat idle) sebelum mulai
  // melayani request, supaya device yang connect tidak melihat papan antrian kosong.
  await Promise.all([
    hydrateStateFromFirestoreIfNeeded(),
    hydrateDailyArchiveFromFirestoreIfNeeded(),
    hydrateMasterPatientsFromFirestoreIfNeeded(),
    hydrateRanapHistoryFromFirestoreIfNeeded(),
  ]);

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
