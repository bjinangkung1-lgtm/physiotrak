import { MasterPatient, DailyPatientVisit, RanapHistoryItem } from '../types';
import { cloudDatabaseService } from './cloudDatabaseService';
import { getLocalDateStringWIB } from './dateHelper';
import * as XLSX from 'xlsx';

export interface DailyDatabaseResponse {
  status: string;
  date: string;
  visits: DailyPatientVisit[];
  summary: {
    total: number;
    completed: number;
    pending: number;
    warning: number;
    ranap: number;
  };
  allDates: string[];
}

export const DB_PASSWORD_STORAGE_KEY = 'irm_database_security_password_v1';
export const DEFAULT_DB_PASSWORD = 'admin';

let cachedDatabasePassword: string | null = null;

export const getDatabasePassword = (): string => {
  if (cachedDatabasePassword && cachedDatabasePassword.trim().length > 0) {
    return cachedDatabasePassword.trim();
  }
  try {
    const saved = localStorage.getItem(DB_PASSWORD_STORAGE_KEY);
    if (saved && saved.trim().length > 0) {
      cachedDatabasePassword = saved.trim();
      return cachedDatabasePassword;
    }
  } catch {}
  return DEFAULT_DB_PASSWORD;
};

export const setDatabasePassword = (newPassword: string): boolean => {
  try {
    if (!newPassword || newPassword.trim().length < 3) return false;
    const clean = newPassword.trim();
    cachedDatabasePassword = clean;
    try {
      localStorage.setItem(DB_PASSWORD_STORAGE_KEY, clean);
    } catch {}

    // 1. Push to Express Server
    fetch('/api/security-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ databasePassword: clean })
    }).catch(err => console.warn('Failed to sync database password to backend API:', err));

    // 2. Push update to Cloud Firestore across all devices
    cloudDatabaseService.saveSecurityConfig({
      databasePassword: clean
    }).catch(err => console.warn('Failed to sync database password to cloud:', err));

    return true;
  } catch {
    return false;
  }
};

export const setDatabasePasswordAsync = async (newPassword: string): Promise<boolean> => {
  try {
    if (!newPassword || newPassword.trim().length < 3) return false;
    const clean = newPassword.trim();
    cachedDatabasePassword = clean;
    try {
      localStorage.setItem(DB_PASSWORD_STORAGE_KEY, clean);
    } catch {}

    await Promise.allSettled([
      fetch('/api/security-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ databasePassword: clean })
      }),
      cloudDatabaseService.saveSecurityConfig({
        databasePassword: clean
      })
    ]);

    return true;
  } catch (err) {
    console.error('Failed to save database password to cloud:', err);
    return false;
  }
};

export const syncDatabasePasswordFromCloud = (cloudPassword?: string): void => {
  if (!cloudPassword || cloudPassword.trim().length < 3) return;
  const clean = cloudPassword.trim();
  cachedDatabasePassword = clean;
  try {
    localStorage.setItem(DB_PASSWORD_STORAGE_KEY, clean);
  } catch {}
};

export const verifyDatabasePassword = (inputPassword: string): boolean => {
  if (!inputPassword) return false;
  const currentPassword = getDatabasePassword();
  return (inputPassword || '').trim() === currentPassword.trim();
};

export const fetchDatabasePasswordFromCloud = async (): Promise<string> => {
  try {
    const [apiResult, cloudResult] = await Promise.allSettled([
      fetch('/api/security-config').then(r => r.json()),
      cloudDatabaseService.getSecurityConfig()
    ]);

    let latestPassword: string | null = null;

    if (apiResult.status === 'fulfilled' && apiResult.value?.config?.databasePassword) {
      latestPassword = apiResult.value.config.databasePassword.trim();
    }

    if (cloudResult.status === 'fulfilled' && cloudResult.value?.databasePassword) {
      latestPassword = cloudResult.value.databasePassword.trim();
    }

    if (latestPassword && latestPassword.length >= 3) {
      cachedDatabasePassword = latestPassword;
      try {
        localStorage.setItem(DB_PASSWORD_STORAGE_KEY, latestPassword);
      } catch {}
      return latestPassword;
    }
  } catch (err) {
    console.warn('Failed to fetch database password from cloud:', err);
  }
  return getDatabasePassword();
};

export const verifyDatabasePasswordAsync = async (inputPassword: string): Promise<boolean> => {
  if (!inputPassword) return false;
  const clean = inputPassword.trim();
  try {
    const latest = await fetchDatabasePasswordFromCloud();
    if (clean === latest) {
      return true;
    }
  } catch {}
  return clean === getDatabasePassword().trim();
};

const pickMoreRecentPatient = (a?: MasterPatient, b?: MasterPatient): MasterPatient | undefined => {
  if (!a) return b;
  if (!b) return a;
  const stamp = (p: MasterPatient) => p.updatedAt || p.lastVisitDate || p.createdAt || '';
  return new Date(stamp(b)).getTime() >= new Date(stamp(a)).getTime() ? b : a;
};

export const databaseService = {
  // Master Patient APIs - 3-Way Resilient Smart Sync (Server + Cloud Firestore + LocalStorage)
  async getMasterPatients(search = ''): Promise<MasterPatient[]> {
    let serverPatients: MasterPatient[] = [];
    let cloudPatients: MasterPatient[] = [];
    let localPatients: MasterPatient[] = [];

    // 1. Read immediate local cache
    try {
      const local = localStorage.getItem('irm_master_patients');
      if (local) {
        localPatients = JSON.parse(local);
      }
    } catch {}

    // 2. Concurrently query Server API and Cloud Firestore
    const [serverRes, cloudRes] = await Promise.allSettled([
      fetch('/api/master-patients').then(r => r.ok ? r.json() : null),
      cloudDatabaseService.getMasterPatients()
    ]);

    if (serverRes.status === 'fulfilled' && serverRes.value?.patients && Array.isArray(serverRes.value.patients)) {
      serverPatients = serverRes.value.patients;
    }
    if (cloudRes.status === 'fulfilled' && Array.isArray(cloudRes.value) && cloudRes.value.length > 0) {
      cloudPatients = cloudRes.value;
    }

    // 3. Intelligent Multi-Source Merge keyed by Medical Record Number (and fallback ID)
    const patientMap = new Map<string, MasterPatient>();

    // Layer 1: Server data
    serverPatients.forEach(p => {
      if (p && (p.medicalRecordNo || p.id)) {
        const key = (p.medicalRecordNo || p.id).toLowerCase().trim();
        patientMap.set(key, { ...p });
      }
    });

    // Layer 2: LocalStorage cache (merge user edits)
    localPatients.forEach(p => {
      if (p && (p.medicalRecordNo || p.id)) {
        const key = (p.medicalRecordNo || p.id).toLowerCase().trim();
        const existing = patientMap.get(key);
        if (!existing) {
          patientMap.set(key, { ...p });
        } else {
          const newer = pickMoreRecentPatient(existing, p);
          // Merge prioritizing richer data
          const mergedPhotos = [
            ...(Array.isArray(existing.instructionPhotos) ? existing.instructionPhotos : []),
            ...(Array.isArray(p.instructionPhotos) ? p.instructionPhotos : [])
          ];
          const uniquePhotos = Array.from(new Map(mergedPhotos.map(item => [item.id || item.url, item])).values());
          const mergedUrls = Array.from(new Set([
            ...(Array.isArray(existing.instructionImageUrls) ? existing.instructionImageUrls : []),
            ...(Array.isArray(p.instructionImageUrls) ? p.instructionImageUrls : []),
            ...(existing.instructionImageUrl ? [existing.instructionImageUrl] : []),
            ...(p.instructionImageUrl ? [p.instructionImageUrl] : [])
          ]));

          patientMap.set(key, {
            ...existing,
            ...p,
            patientName: newer?.patientName || existing.patientName || p.patientName,
            medicalRecordNo: newer?.medicalRecordNo || existing.medicalRecordNo || p.medicalRecordNo,
            updatedAt: newer?.updatedAt || p.updatedAt || existing.updatedAt,
            totalVisits: Math.max(existing.totalVisits || 1, p.totalVisits || 1),
            firstOfficerName: existing.firstOfficerName || p.firstOfficerName,
            firstBoxId: existing.firstBoxId || p.firstBoxId,
            firstVisitDate: existing.firstVisitDate || p.firstVisitDate,
            firstTherapists: {
              ...(existing.firstTherapists || {}),
              ...(p.firstTherapists || {}),
            },
            disciplineVisitCounts: {
              ...(existing.disciplineVisitCounts || {}),
              ...(p.disciplineVisitCounts || {}),
            },
            visitHistory: (existing.visitHistory && existing.visitHistory.length > 0) ? existing.visitHistory : p.visitHistory,
            identityNumber: p.identityNumber || existing.identityNumber || '',
            phoneNumber: p.phoneNumber || existing.phoneNumber || '',
            birthDate: p.birthDate || existing.birthDate || '',
            gender: p.gender || existing.gender || '',
            address: p.address || existing.address || '',
            defaultDiagnosis: p.defaultDiagnosis || existing.defaultDiagnosis || '',
            defaultActionCode: p.defaultActionCode || existing.defaultActionCode || '',
            notes: p.notes || existing.notes || '',
            instructionImageUrl: p.instructionImageUrl || existing.instructionImageUrl || (mergedUrls[0] || undefined),
            instructionImageUrls: mergedUrls.length > 0 ? mergedUrls : undefined,
            instructionPhotos: uniquePhotos.length > 0 ? uniquePhotos : undefined,
          });
        }
      }
    });

    // Layer 3: Cloud Firestore (durable multi-device source of truth)
    cloudPatients.forEach(p => {
      if (p && (p.medicalRecordNo || p.id)) {
        const key = (p.medicalRecordNo || p.id).toLowerCase().trim();
        const existing = patientMap.get(key);
        if (!existing) {
          patientMap.set(key, { ...p });
        } else {
          const newer = pickMoreRecentPatient(existing, p);
          const mergedPhotos = [
            ...(Array.isArray(existing.instructionPhotos) ? existing.instructionPhotos : []),
            ...(Array.isArray(p.instructionPhotos) ? p.instructionPhotos : [])
          ];
          const uniquePhotos = Array.from(new Map(mergedPhotos.map(item => [item.id || item.url, item])).values());
          const mergedUrls = Array.from(new Set([
            ...(Array.isArray(existing.instructionImageUrls) ? existing.instructionImageUrls : []),
            ...(Array.isArray(p.instructionImageUrls) ? p.instructionImageUrls : []),
            ...(existing.instructionImageUrl ? [existing.instructionImageUrl] : []),
            ...(p.instructionImageUrl ? [p.instructionImageUrl] : [])
          ]));

          patientMap.set(key, {
            ...existing,
            ...p,
            patientName: newer?.patientName || existing.patientName || p.patientName,
            medicalRecordNo: newer?.medicalRecordNo || existing.medicalRecordNo || p.medicalRecordNo,
            updatedAt: newer?.updatedAt || p.updatedAt || existing.updatedAt,
            totalVisits: Math.max(existing.totalVisits || 1, p.totalVisits || 1),
            firstOfficerName: existing.firstOfficerName || p.firstOfficerName,
            firstBoxId: existing.firstBoxId || p.firstBoxId,
            firstVisitDate: existing.firstVisitDate || p.firstVisitDate,
            firstTherapists: {
              ...(existing.firstTherapists || {}),
              ...(p.firstTherapists || {}),
            },
            disciplineVisitCounts: {
              ...(existing.disciplineVisitCounts || {}),
              ...(p.disciplineVisitCounts || {}),
            },
            visitHistory: (existing.visitHistory && existing.visitHistory.length > 0) ? existing.visitHistory : p.visitHistory,
            identityNumber: p.identityNumber || existing.identityNumber || '',
            phoneNumber: p.phoneNumber || existing.phoneNumber || '',
            birthDate: p.birthDate || existing.birthDate || '',
            gender: p.gender || existing.gender || '',
            address: p.address || existing.address || '',
            defaultDiagnosis: p.defaultDiagnosis || existing.defaultDiagnosis || '',
            defaultActionCode: p.defaultActionCode || existing.defaultActionCode || '',
            notes: p.notes || existing.notes || '',
            instructionImageUrl: p.instructionImageUrl || existing.instructionImageUrl || (mergedUrls[0] || undefined),
            instructionImageUrls: mergedUrls.length > 0 ? mergedUrls : undefined,
            instructionPhotos: uniquePhotos.length > 0 ? uniquePhotos : undefined,
          });
        }
      }
    });

    const mergedPatients = Array.from(patientMap.values());

    // 4. Auto-heal all layers in background if data discrepancies exist
    if (mergedPatients.length > 0) {
      // Update local storage
      try {
        localStorage.setItem('irm_master_patients', JSON.stringify(mergedPatients));
      } catch {}

      // Heal Server if it has fewer records (e.g., container cold-restarted after hours of inactivity)
      if (serverPatients.length < mergedPatients.length) {
        fetch('/api/master-patients/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ patients: mergedPatients }),
        }).catch(err => console.warn('Background server master patients heal error:', err));
      }

      // Heal Cloud Firestore if cloud had fewer records than local/server
      if (cloudPatients.length < mergedPatients.length) {
        cloudDatabaseService.saveMasterPatientsBundle(mergedPatients).catch(console.warn);
      }
    }

    // 5. Search filtering if requested
    if (search) {
      const s = search.toLowerCase().trim();
      return mergedPatients.filter((p: MasterPatient) => 
        (p.medicalRecordNo && p.medicalRecordNo.toLowerCase().includes(s)) || 
        (p.patientName && p.patientName.toLowerCase().includes(s)) ||
        (p.identityNumber && p.identityNumber.toLowerCase().includes(s)) ||
        (p.phoneNumber && p.phoneNumber.toLowerCase().includes(s)) ||
        (p.defaultDiagnosis && p.defaultDiagnosis.toLowerCase().includes(s))
      );
    }

    return mergedPatients;
  },

  async saveMasterPatient(patient: Partial<MasterPatient>): Promise<MasterPatient | null> {
    const cleanRM = (patient.medicalRecordNo || '').trim();
    const cleanName = (patient.patientName || '').trim();

    // Check existing records from localStorage to preserve first therapist & history
    let existingRecord: MasterPatient | undefined;
    try {
      const local = localStorage.getItem('irm_master_patients');
      if (local) {
        const list: MasterPatient[] = JSON.parse(local);
        existingRecord = list.find(p => p.medicalRecordNo.toLowerCase() === cleanRM.toLowerCase());
      }
    } catch {}

    const firstOfficer = patient.firstOfficerName || existingRecord?.firstOfficerName || patient.lastOfficerName || '';
    const firstBox = patient.firstBoxId || existingRecord?.firstBoxId || patient.lastBoxId || '';
    const firstDate = patient.firstVisitDate || existingRecord?.firstVisitDate || patient.registeredDate || getLocalDateStringWIB();

    const saved: MasterPatient = {
      id: patient.id || existingRecord?.id || `mp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      medicalRecordNo: cleanRM,
      patientName: cleanName,
      identityNumber: patient.identityNumber || existingRecord?.identityNumber || '',
      phoneNumber: patient.phoneNumber || existingRecord?.phoneNumber || '',
      birthDate: patient.birthDate || existingRecord?.birthDate || '',
      gender: patient.gender || existingRecord?.gender || '',
      address: patient.address || existingRecord?.address || '',
      defaultDiagnosis: patient.defaultDiagnosis || existingRecord?.defaultDiagnosis || '',
      defaultActionCode: patient.defaultActionCode || existingRecord?.defaultActionCode || '',
      notes: patient.notes || existingRecord?.notes || '',
      instructionImageUrl: patient.instructionImageUrl || existingRecord?.instructionImageUrl,
      instructionImageUrls: patient.instructionImageUrls || existingRecord?.instructionImageUrls,
      instructionPhotos: patient.instructionPhotos || existingRecord?.instructionPhotos,
      registeredDate: patient.registeredDate || existingRecord?.registeredDate || getLocalDateStringWIB(),
      lastVisitDate: getLocalDateStringWIB(),
      lastBoxId: patient.lastBoxId || existingRecord?.lastBoxId,
      lastOfficerName: patient.lastOfficerName || existingRecord?.lastOfficerName,
      firstOfficerName: firstOfficer,
      firstBoxId: firstBox,
      firstVisitDate: firstDate,
      firstTherapists: {
        ...(existingRecord?.firstTherapists || {}),
        ...(patient.firstTherapists || {}),
      },
      disciplineVisitCounts: {
        ...(existingRecord?.disciplineVisitCounts || {}),
        ...(patient.disciplineVisitCounts || {}),
      },
      visitHistory: patient.visitHistory || existingRecord?.visitHistory || [],
      totalVisits: Math.max(patient.totalVisits || 1, existingRecord?.totalVisits || 1),
      createdAt: patient.createdAt || existingRecord?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // 1. LocalStorage immediate update
    try {
      const local = localStorage.getItem('irm_master_patients');
      let list: MasterPatient[] = local ? JSON.parse(local) : [];
      const idx = list.findIndex(p => p.medicalRecordNo.toLowerCase() === saved.medicalRecordNo.toLowerCase());
      if (idx >= 0) {
        list[idx] = { ...list[idx], ...saved };
      } else {
        list.unshift(saved);
      }
      localStorage.setItem('irm_master_patients', JSON.stringify(list));
    } catch {}

    // 2. Cloud Firestore write (individual & bundle)
    cloudDatabaseService.saveMasterPatient(saved).catch(err => {
      console.warn('Cloud Firestore master patient save error:', err);
    });

    // 3. Server API write
    try {
      const res = await fetch('/api/master-patients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(saved),
      });
      if (res.ok) {
        const data = await res.json();
        return data.patient || saved;
      }
    } catch (err) {
      console.warn('Server master patient save error, local fallback used:', err);
    }

    return saved;
  },

  // Batch import master patients
  async saveMasterPatientsBatch(patients: Partial<MasterPatient>[]): Promise<{ total: number; added: number; updated: number }> {
    const today = getLocalDateStringWIB();
    const cleanList: MasterPatient[] = patients
      .filter((p) => p.patientName && p.medicalRecordNo)
      .map((p) => ({
        id: p.id || `mp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        medicalRecordNo: (p.medicalRecordNo || '').trim(),
        patientName: (p.patientName || '').trim().toUpperCase(),
        identityNumber: p.identityNumber || '',
        phoneNumber: p.phoneNumber || '',
        birthDate: p.birthDate || '',
        gender: p.gender || '',
        address: p.address || '',
        defaultDiagnosis: p.defaultDiagnosis || '',
        defaultActionCode: p.defaultActionCode || '',
        notes: p.notes || '',
        instructionImageUrl: p.instructionImageUrl,
        instructionImageUrls: p.instructionImageUrls,
        instructionPhotos: p.instructionPhotos,
        registeredDate: p.registeredDate || today,
        lastVisitDate: p.lastVisitDate || today,
        lastBoxId: p.lastBoxId,
        lastOfficerName: p.lastOfficerName,
        firstOfficerName: p.firstOfficerName,
        firstBoxId: p.firstBoxId,
        firstVisitDate: p.firstVisitDate,
        firstTherapists: p.firstTherapists,
        disciplineVisitCounts: p.disciplineVisitCounts,
        visitHistory: p.visitHistory || [],
        totalVisits: p.totalVisits || 1,
        createdAt: p.createdAt || new Date().toISOString(),
      }));

    // 1. Update localStorage
    const local = localStorage.getItem('irm_master_patients');
    let existingList: MasterPatient[] = local ? JSON.parse(local) : [];
    let added = 0;
    let updated = 0;

    cleanList.forEach((newP) => {
      const idx = existingList.findIndex(
        (ep) => ep.medicalRecordNo.toLowerCase() === newP.medicalRecordNo.toLowerCase()
      );
      if (idx >= 0) {
        existingList[idx] = { ...existingList[idx], ...newP };
        updated++;
      } else {
        existingList.unshift(newP);
        added++;
      }
    });

    localStorage.setItem('irm_master_patients', JSON.stringify(existingList));

    // 2. Cloud Firestore batch write
    cloudDatabaseService.saveMasterPatientsBatch(existingList).catch(err => {
      console.warn('Cloud Firestore batch save error:', err);
    });

    // 3. Write to server batch API
    try {
      const res = await fetch('/api/master-patients/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patients: cleanList }),
      });
      if (res.ok) {
        const data = await res.json();
        return {
          total: data.total || existingList.length,
          added: data.addedCount || added,
          updated: data.updatedCount || updated,
        };
      }
    } catch (err) {
      console.warn('Server batch save failed, local and cloud used:', err);
    }

    return { total: existingList.length, added, updated };
  },

  async deleteMasterPatient(id: string): Promise<boolean> {
    // 1. LocalStorage delete
    try {
      const local = localStorage.getItem('irm_master_patients');
      if (local) {
        let list: MasterPatient[] = JSON.parse(local);
        list = list.filter(p => p.id !== id && p.medicalRecordNo !== id);
        localStorage.setItem('irm_master_patients', JSON.stringify(list));
        // Update cloud bundle
        cloudDatabaseService.saveMasterPatientsBundle(list).catch(console.warn);
      }
    } catch (e) {
      // ignore
    }

    // 2. Cloud Firestore delete
    cloudDatabaseService.deleteMasterPatient(id).catch(err => {
      console.warn('Cloud Firestore master patient delete error:', err);
    });

    // 3. Server API delete
    try {
      const res = await fetch(`/api/master-patients/${id}`, { method: 'DELETE' });
      return res.ok;
    } catch (err) {
      console.error('Failed to delete master patient:', err);
      return true;
    }
  },

  async clearAllMasterPatients(): Promise<boolean> {
    // 1. LocalStorage clear
    try {
      localStorage.removeItem('irm_master_patients');
    } catch (e) {
      // ignore
    }

    // 2. Cloud Firestore clear
    cloudDatabaseService.clearMasterPatients().catch(err => {
      console.warn('Cloud Firestore master patient clear error:', err);
    });

    // 3. Server API clear
    try {
      const res = await fetch('/api/master-patients/clear', { method: 'POST' });
      return res.ok;
    } catch (err) {
      console.error('Failed to clear master patients on server:', err);
      return true;
    }
  },

  // Export Master Patients to formatted Excel (.xlsx)
  exportMasterPatientsToExcel(patients: MasterPatient[], filename?: string) {
    const data = patients.map((p, idx) => ({
      'No': idx + 1,
      'No. RM': p.medicalRecordNo,
      'Nama Pasien': p.patientName,
      'NIK / Identitas': p.identityNumber || '',
      'No. HP / WA': p.phoneNumber || '',
      'Jenis Kelamin': p.gender || '',
      'Tanggal Lahir': p.birthDate || '',
      'Alamat': p.address || '',
      'Diagnosa Utama': p.defaultDiagnosis || '',
      'Tindakan Rutin': p.defaultActionCode || '',
      'Catatan': p.notes || '',
      'Total Kunjungan': p.totalVisits || 1,
      'Kunjungan Terakhir': p.lastVisitDate || '',
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    // Auto-fit column widths
    const colWidths = [
      { wch: 5 },  // No
      { wch: 14 }, // No. RM
      { wch: 28 }, // Nama Pasien
      { wch: 18 }, // NIK
      { wch: 16 }, // No. HP
      { wch: 14 }, // Gender
      { wch: 14 }, // Birthdate
      { wch: 30 }, // Alamat
      { wch: 25 }, // Diagnosa
      { wch: 15 }, // Tindakan
      { wch: 25 }, // Catatan
      { wch: 15 }, // Total
      { wch: 18 }, // Last visit
    ];
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Master Pasien IRM');
    XLSX.writeFile(wb, filename || `Master_Pasien_IRM_${getLocalDateStringWIB()}.xlsx`);
  },

  // Download Sample Excel Template for Import
  downloadMasterPatientTemplate() {
    const templateData = [
      {
        'No. RM': '01-23-45',
        'Nama Pasien': 'AHMAD SURYANA',
        'NIK / Identitas': '3201012345670001',
        'No. HP / WA': '081234567890',
        'Jenis Kelamin': 'Laki-laki',
        'Tanggal Lahir': '1985-05-12',
        'Alamat': 'Jl. Melati No. 12, Kebon Jeruk',
        'Diagnosa Utama': 'Low Back Pain (LBP) Kronis',
        'Tindakan Rutin': 'P + C',
        'Catatan': 'Pasien post op lumbal',
      },
      {
        'No. RM': '02-34-56',
        'Nama Pasien': 'SITI RAHMAWATI',
        'NIK / Identitas': '3201018765430002',
        'No. HP / WA': '085712345678',
        'Jenis Kelamin': 'Perempuan',
        'Tanggal Lahir': '1992-09-20',
        'Alamat': 'Kompleks Asri Blok B3',
        'Diagnosa Utama': 'Frozen Shoulder Dextra',
        'Tindakan Rutin': 'J + P',
        'Catatan': 'Nyeri gerak abduksi',
      }
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    ws['!cols'] = [
      { wch: 14 },
      { wch: 26 },
      { wch: 20 },
      { wch: 16 },
      { wch: 14 },
      { wch: 14 },
      { wch: 30 },
      { wch: 28 },
      { wch: 16 },
      { wch: 26 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template Import Pasien');
    XLSX.writeFile(wb, 'Template_Import_Master_Pasien_IRM.xlsx');
  },

  // Export Full Database Backup JSON
  async exportFullDatabaseBackup(): Promise<void> {
    try {
      const res = await fetch('/api/backup/export');
      let backupObj: any;
      if (res.ok) {
        backupObj = await res.json();
      } else {
        // Build client-side fallback backup
        const masterLocal = localStorage.getItem('irm_master_patients');
        const queueLocal = localStorage.getItem('irm_queue_state');
        backupObj = {
          app: 'Sistem Antrean IRM',
          version: '2.0.0',
          exportedAt: new Date().toISOString(),
          exportDateWIB: getLocalDateStringWIB(),
          data: {
            masterPatients: masterLocal ? JSON.parse(masterLocal) : [],
            queueState: queueLocal ? JSON.parse(queueLocal) : null,
          }
        };
      }

      const jsonStr = JSON.stringify(backupObj, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Backup_Database_IRM_Lengkap_${getLocalDateStringWIB()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export full database backup:', err);
      throw err;
    }
  },

  // Restore Full Database Backup JSON
  async restoreFullDatabaseBackup(backupData: any, options?: { restoreQueueState?: boolean; restoreBoxes?: boolean }): Promise<boolean> {
    try {
      if (!backupData || !backupData.data) {
        throw new Error('Format berkas backup tidak sesuai');
      }

      const { masterPatients, dailyArchive, inventory, lainLain } = backupData.data;

      // 1. Restore master patients
      if (Array.isArray(masterPatients) && masterPatients.length > 0) {
        await databaseService.saveMasterPatientsBatch(masterPatients);
      }

      // 2. Restore daily archives
      if (dailyArchive && typeof dailyArchive === 'object') {
        for (const [date, visits] of Object.entries(dailyArchive)) {
          if (Array.isArray(visits)) {
            cloudDatabaseService.saveDailyArchive(date, visits as DailyPatientVisit[]).catch(console.warn);
          }
        }
      }

      // 3. Restore inventory & lain-lain
      if (inventory) {
        cloudDatabaseService.saveInventoryState(inventory).catch(console.warn);
      }
      if (lainLain) {
        cloudDatabaseService.saveLainLainState(lainLain).catch(console.warn);
      }

      // 4. Send to server
      try {
        await fetch('/api/backup/restore', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            data: backupData.data,
            options: {
              restoreQueueState: options?.restoreQueueState || false,
              restoreBoxes: options?.restoreBoxes || false,
            }
          }),
        });
      } catch (e) {
        console.warn('Server restore call fallback:', e);
      }

      return true;
    } catch (err) {
      console.error('Failed to restore database backup:', err);
      return false;
    }
  },

  // Daily Patient Database APIs
  async getDailyDatabase(date?: string): Promise<DailyDatabaseResponse> {
    const targetDate = date || getLocalDateStringWIB();
    let serverResponse: DailyDatabaseResponse | null = null;

    try {
      const res = await fetch(`/api/daily-database?date=${encodeURIComponent(targetDate)}`);
      if (res.ok) {
        serverResponse = await res.json();
      }
    } catch (err) {
      console.warn('Failed to fetch daily database from server, checking Cloud Firestore...', err);
    }

    // Always fetch archives from Cloud Firestore to guarantee no historical dates/visits are missing
    try {
      const cloudArchives = await cloudDatabaseService.getAllDailyArchives();
      const cloudDates = Object.keys(cloudArchives).sort().reverse();

      if (cloudDates.length > 0) {
        const cloudVisits = cloudArchives[targetDate] || [];

        // Combine all known dates
        const serverDates = serverResponse?.allDates || [targetDate];
        const allUniqueDates = Array.from(new Set([targetDate, ...serverDates, ...cloudDates])).sort().reverse();

        // Merge visits for target date. Server (dari file lokal, selalu terbaru dan konsisten
        // lewat upsert aditif yang aman) HARUS menang atas cloudVisits (koleksi Firestore lama
        // yang ditulis langsung oleh browser lewat baca-ubah-tulis seluruh array - rawan race
        // antar beberapa perangkat/tab yang bisa membuat status "selesai" balik jadi "berjalan"
        // kalau salinan cloud kebetulan lebih basi). Cloud HANYA dipakai untuk mengisi kunjungan
        // yang server-nya benar-benar tidak punya sama sekali (mis. disk lokal baru saja hilang).
        const mergedVisitsMap = new Map<string, DailyPatientVisit>();
        (serverResponse?.visits || []).forEach(v => { if (v && v.id) mergedVisitsMap.set(v.id, v); });
        cloudVisits.forEach(v => {
          if (v && v.id && !mergedVisitsMap.has(v.id)) {
            mergedVisitsMap.set(v.id, v);
          }
        });
        const combinedVisits = Array.from(mergedVisitsMap.values());

        // Recalculate summary metrics
        const total = combinedVisits.length;
        const completed = combinedVisits.filter(v => v.completed).length;
        const pending = combinedVisits.filter(v => !v.completed).length;
        const warning = combinedVisits.filter(v => !v.completed && v.calledCount >= 3).length;
        const ranap = combinedVisits.filter(v => v.isRanap).length;

        // If server had fewer records than cloud, backfill server in the background
        if (!serverResponse || (serverResponse.visits?.length || 0) < combinedVisits.length) {
          fetch('/api/daily-database/batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ date: targetDate, visits: combinedVisits }),
          }).catch(err => console.warn('Background server archive heal error:', err));
        }

        return {
          status: 'ok',
          date: targetDate,
          visits: combinedVisits,
          summary: { total, completed, pending, warning, ranap },
          allDates: allUniqueDates,
        };
      }
    } catch (cloudErr) {
      console.warn('Cloud Firestore daily archive fallback error:', cloudErr);
    }

    if (serverResponse && serverResponse.status === 'ok') {
      return serverResponse;
    }

    return {
      status: 'fallback',
      date: targetDate,
      visits: [],
      summary: { total: 0, completed: 0, pending: 0, warning: 0, ranap: 0 },
      allDates: [targetDate],
    };
  },

  async saveDailyVisit(date: string, visit: Partial<DailyPatientVisit>): Promise<DailyPatientVisit | null> {
    const targetDate = date || getLocalDateStringWIB();
    try {
      const res = await fetch('/api/daily-database/visit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: targetDate, visit }),
      });
      let savedVisit: DailyPatientVisit | null = null;
      if (res.ok) {
        const data = await res.json();
        savedVisit = data.visit;
      }

      // Server sudah menyimpan ke daily_archive via write queue dan mencadangkannya ke Firestore
      // secara konsisten (mirrorArchiveMonthToFirestore). Direct write dari klien ke Firestore
      // dihapus untuk mencegah race condition / penimpaan data antar tablet.

      return savedVisit || (visit as DailyPatientVisit);
    } catch (err) {
      console.error('Failed to save daily visit:', err);
      return null;
    }
  },

  async getRanapHistory(filters?: { category?: string; search?: string; startDate?: string; endDate?: string }): Promise<RanapHistoryItem[]> {
    try {
      const params = new URLSearchParams();
      if (filters?.category) params.append('category', filters.category);
      if (filters?.search) params.append('search', filters.search);
      if (filters?.startDate) params.append('startDate', filters.startDate);
      if (filters?.endDate) params.append('endDate', filters.endDate);

      const qs = params.toString();
      const res = await fetch(`/api/ranap-history${qs ? `?${qs}` : ''}`);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      return Array.isArray(data.history) ? data.history : [];
    } catch (err) {
      console.warn('Failed to fetch ranap history:', err);
      return [];
    }
  },

  async saveRanapHistoryItem(item: RanapHistoryItem): Promise<RanapHistoryItem | null> {
    try {
      const res = await fetch('/api/ranap-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item),
      });
      if (res.ok) {
        const data = await res.json();
        return data.item || item;
      }
      return item;
    } catch (err) {
      console.error('Failed to save ranap history item:', err);
      return null;
    }
  }
};

