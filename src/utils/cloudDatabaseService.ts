import { 
  doc, 
  setDoc, 
  getDoc,
  onSnapshot, 
  collection, 
  getDocs, 
  deleteDoc 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { QueueBox, PatientItem, CallHistoryRecord, AppNotification, MasterPatient, DailyPatientVisit, PhotoRecord } from '../types';
import { SyncDataState } from './syncService';

// Firestore collection & document references
const QUEUE_DOC_PATH = 'system_state';
const QUEUE_DOC_ID = 'current_queue';
const MASTER_COLLECTION = 'master_patients';
const DAILY_COLLECTION = 'daily_archives';
const PHOTOS_COLLECTION = 'irm_photos';

const QUOTA_STORAGE_KEY = 'irm_firestore_quota_disabled_until';

let clientQuotaCooldownUntil = (() => {
  try {
    const val = localStorage.getItem(QUOTA_STORAGE_KEY);
    return val ? parseInt(val, 10) || 0 : 0;
  } catch {
    return 0;
  }
})();

function checkQuotaCooldown(): boolean {
  return Date.now() < clientQuotaCooldownUntil;
}

function handleFirestoreError(context: string, err: any): void {
  const errMsg = err?.message || String(err);
  if (
    errMsg.includes('RESOURCE_EXHAUSTED') ||
    errMsg.includes('Quota exceeded') ||
    err?.code === 'resource-exhausted' ||
    err?.code === 8
  ) {
    // Suppress further writes for 24h (until next daily quota reset)
    clientQuotaCooldownUntil = Date.now() + 24 * 60 * 60 * 1000;
    try {
      localStorage.setItem(QUOTA_STORAGE_KEY, clientQuotaCooldownUntil.toString());
    } catch {
      // ignore
    }
    console.warn(`[CloudDB:${context}] Kuota harian Firestore gratis telah mencapai batas harian. Mode offline/local storage diaktifkan. Local backend & SSE menangani sinkronisasi data 100% normal.`);
  } else {
    console.warn(`[CloudDB:${context}]`, err);
  }
}

// PENTING: isExplicitReset/resetConfirmed di dokumen Firestore HANYA boleh
// berarti "reset baru saja terjadi SAAT DOKUMEN INI DITULIS" - bukan properti
// permanen. Firestore itu sendiri baru ter-mirror lagi setelah beberapa detik
// (didebounce), jadi dokumennya BISA saja masih membawa isExplicitReset=true
// dari reset lama walau antrean sekarang sudah normal berisi pasien. Kalau
// dibiarkan apa adanya, setiap kali listener/snapshot ini menyala (termasuk
// setiap kali halaman dibuka/refresh) klien akan mengira reset baru saja
// terjadi LAGI dan mengosongkan tampilan pasiennya sendiri - persis gejala
// "refresh hilang, refresh lagi timbul". Sinyal reset yang sungguhan tetap
// sampai lewat siaran real-time (SSE/BroadcastChannel) saat reset ditekan;
// pemfilteran pasien lama sebelum reset tetap aman lewat watermark
// lastResetAt yang independen dari flag ini.
function stripStaleResetFlags(state: SyncDataState | null): SyncDataState | null {
  if (!state) return state;
  return { ...state, isExplicitReset: false, resetConfirmed: false };
}

export const cloudDatabaseService = {
  // 1. Real-time Firestore Queue Sync listener
  subscribeQueueState(onUpdate: (state: SyncDataState) => void, onError?: (err: any) => void) {
    try {
      const docRef = doc(db, QUEUE_DOC_PATH, QUEUE_DOC_ID);
      return onSnapshot(docRef, (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data() as SyncDataState;
          onUpdate(stripStaleResetFlags(data)!);
        }
      }, (err) => {
        handleFirestoreError('subscribeQueueState', err);
        if (onError) onError(err);
      });
    } catch (e) {
      console.warn('Failed to attach Firestore snapshot listener:', e);
      return () => {};
    }
  },

  // 1b. Fetch Queue State directly once from Cloud Firestore
  async getQueueState(): Promise<SyncDataState | null> {
    if (checkQuotaCooldown()) return null;
    try {
      const docRef = doc(db, QUEUE_DOC_PATH, QUEUE_DOC_ID);
      const snapshot = await getDoc(docRef);
      if (snapshot.exists()) {
        return stripStaleResetFlags(snapshot.data() as SyncDataState);
      }
      return null;
    } catch (err) {
      handleFirestoreError('getQueueState', err);
      return null;
    }
  },

  // 2. Push Queue State to Cloud Firestore
  async saveQueueState(state: SyncDataState): Promise<boolean> {
    if (checkQuotaCooldown()) return false;
    try {
      const docRef = doc(db, QUEUE_DOC_PATH, QUEUE_DOC_ID);
      // Clean undefined values before writing to Firestore
      const sanitized = JSON.parse(JSON.stringify({
        ...state,
        isExplicitReset: state.isExplicitReset || false,
        resetConfirmed: state.resetConfirmed || false,
        lastResetAt: state.lastResetAt || null,
        deletedPatientIds: state.deletedPatientIds || [],
        deletedBoxIds: state.deletedBoxIds || [],
        deletedRanapIds: state.deletedRanapIds || [],
        ranapQueue: state.ranapQueue || [],
        lastUpdated: new Date().toISOString()
      }));
      // Overwrite the single system_state document cleanly to prevent stale deletedPatientIds or isExplicitReset flags
      await setDoc(docRef, sanitized);
      return true;
    } catch (err) {
      handleFirestoreError('saveQueueState', err);
      return false;
    }
  },

  // 3. Master Patients Cloud Firestore CRUD
  async getMasterPatients(): Promise<MasterPatient[]> {
    if (checkQuotaCooldown()) return [];
    const resultMap = new Map<string, MasterPatient>();

    // Source A: Read individual documents from master_patients collection
    try {
      const colRef = collection(db, MASTER_COLLECTION);
      const snapshot = await getDocs(colRef);
      snapshot.forEach(docSnap => {
        const p = docSnap.data() as MasterPatient;
        if (p && (p.medicalRecordNo || p.id)) {
          const key = (p.medicalRecordNo || p.id).toLowerCase().trim();
          resultMap.set(key, p);
        }
      });
    } catch (err) {
      handleFirestoreError('getMasterPatients:col', err);
    }

    // Source B: Read consolidated master_patients_bundle document
    try {
      const docRef = doc(db, QUEUE_DOC_PATH, 'master_patients_bundle');
      const snapshot = await getDoc(docRef);
      if (snapshot.exists()) {
        const bundleData = snapshot.data();
        if (bundleData && Array.isArray(bundleData.list)) {
          bundleData.list.forEach((p: MasterPatient) => {
            if (p && (p.medicalRecordNo || p.id)) {
              const key = (p.medicalRecordNo || p.id).toLowerCase().trim();
              const existing = resultMap.get(key);
              resultMap.set(key, { ...existing, ...p });
            }
          });
        }
      }
    } catch (err) {
      handleFirestoreError('getMasterPatients:bundle', err);
    }

    return Array.from(resultMap.values());
  },

  async saveMasterPatient(patient: MasterPatient): Promise<boolean> {
    if (checkQuotaCooldown()) return false;
    try {
      const docKey = (patient.id || patient.medicalRecordNo || `mp-${Date.now()}`).replace(/\//g, '_');
      const docRef = doc(db, MASTER_COLLECTION, docKey);
      await setDoc(docRef, JSON.parse(JSON.stringify(patient)), { merge: true });
      return true;
    } catch (err) {
      handleFirestoreError('saveMasterPatient', err);
      return false;
    }
  },

  async saveMasterPatientsBundle(patients: MasterPatient[]): Promise<boolean> {
    if (checkQuotaCooldown()) return false;
    try {
      const docRef = doc(db, QUEUE_DOC_PATH, 'master_patients_bundle');
      const sanitized = JSON.parse(JSON.stringify({
        list: patients,
        total: patients.length,
        lastUpdated: new Date().toISOString()
      }));
      await setDoc(docRef, sanitized, { merge: true });
      return true;
    } catch (err) {
      handleFirestoreError('saveMasterPatientsBundle', err);
      return false;
    }
  },

  async saveMasterPatientsBatch(patients: MasterPatient[]): Promise<boolean> {
    if (checkQuotaCooldown()) return false;
    try {
      // 1. Save bundle document for fast single-read resilience
      await this.saveMasterPatientsBundle(patients);

      // 2. Save individual documents in chunks to avoid Firestore write limit
      const chunkSize = 20;
      for (let i = 0; i < patients.length; i += chunkSize) {
        const chunk = patients.slice(i, i + chunkSize);
        await Promise.allSettled(
          chunk.map(p => {
            const docKey = (p.id || p.medicalRecordNo || `mp-${Date.now()}`).replace(/\//g, '_');
            const docRef = doc(db, MASTER_COLLECTION, docKey);
            return setDoc(docRef, JSON.parse(JSON.stringify(p)), { merge: true });
          })
        );
      }
      return true;
    } catch (err) {
      handleFirestoreError('saveMasterPatientsBatch', err);
      return false;
    }
  },

  async deleteMasterPatient(id: string): Promise<boolean> {
    if (checkQuotaCooldown()) return false;
    try {
      const docKey = id.replace(/\//g, '_');
      const docRef = doc(db, MASTER_COLLECTION, docKey);
      await deleteDoc(docRef);
      return true;
    } catch (err) {
      handleFirestoreError('deleteMasterPatient', err);
      return false;
    }
  },

  async clearMasterPatients(): Promise<boolean> {
    if (checkQuotaCooldown()) return false;
    try {
      // 1. Clear bundle doc
      const bundleDocRef = doc(db, QUEUE_DOC_PATH, 'master_patients_bundle');
      await setDoc(bundleDocRef, { list: [], total: 0, lastUpdated: new Date().toISOString() });

      // 2. Clear collection
      const colRef = collection(db, MASTER_COLLECTION);
      const snapshot = await getDocs(colRef);
      const deletePromises = snapshot.docs.map((docSnap) => deleteDoc(docSnap.ref));
      await Promise.all(deletePromises);
      return true;
    } catch (err) {
      handleFirestoreError('clearMasterPatients', err);
      return false;
    }
  },

  // 4. Daily Archive Cloud Firestore
  async saveDailyArchive(date: string, visits: DailyPatientVisit[]): Promise<boolean> {
    if (checkQuotaCooldown()) return false;
    try {
      const docRef = doc(db, DAILY_COLLECTION, date);
      await setDoc(docRef, { date, visits: JSON.parse(JSON.stringify(visits)), updatedAt: new Date().toISOString() }, { merge: true });
      return true;
    } catch (err) {
      handleFirestoreError('saveDailyArchive', err);
      return false;
    }
  },

  async getAllDailyArchives(): Promise<Record<string, DailyPatientVisit[]>> {
    if (checkQuotaCooldown()) return {};
    try {
      const collRef = collection(db, DAILY_COLLECTION);
      const snapshot = await getDocs(collRef);
      const result: Record<string, DailyPatientVisit[]> = {};
      snapshot.forEach(d => {
        const data = d.data();
        if (data && Array.isArray(data.visits)) {
          result[d.id] = data.visits;
        }
      });
      return result;
    } catch (err) {
      handleFirestoreError('getAllDailyArchives', err);
      return {};
    }
  },

  // 5. Lain-Lain IRM (Cuti, Kas, Rotasi, Jadwal Sabtu) Cloud Firestore
  async getLainLainState(): Promise<any | null> {
    if (checkQuotaCooldown()) return null;
    try {
      const docRef = doc(db, QUEUE_DOC_PATH, 'irm_lain_lain');
      const snapshot = await getDoc(docRef);
      if (snapshot.exists()) {
        return snapshot.data();
      }
      return null;
    } catch (err) {
      handleFirestoreError('getLainLainState', err);
      return null;
    }
  },

  subscribeLainLainState(onUpdate: (data: any) => void, onError?: (err: any) => void) {
    try {
      const docRef = doc(db, QUEUE_DOC_PATH, 'irm_lain_lain');
      return onSnapshot(docRef, (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          onUpdate(data);
        }
      }, (err) => {
        handleFirestoreError('subscribeLainLainState', err);
        if (onError) onError(err);
      });
    } catch (e) {
      console.warn('Failed to attach Firestore Lain-Lain snapshot listener:', e);
      return () => {};
    }
  },

  async saveLainLainState(data: any): Promise<boolean> {
    if (checkQuotaCooldown()) return false;
    try {
      const docRef = doc(db, QUEUE_DOC_PATH, 'irm_lain_lain');
      const sanitized = JSON.parse(JSON.stringify({
        ...data,
        lastUpdated: new Date().toISOString()
      }));
      await setDoc(docRef, sanitized, { merge: true });
      return true;
    } catch (err) {
      handleFirestoreError('saveLainLainState', err);
      return false;
    }
  },

  // 6. Inventaris & Stok IRM Cloud Firestore
  async getInventoryState(): Promise<any | null> {
    if (checkQuotaCooldown()) return null;
    try {
      const docRef = doc(db, QUEUE_DOC_PATH, 'irm_inventory');
      const snapshot = await getDoc(docRef);
      if (snapshot.exists()) {
        return snapshot.data();
      }
      return null;
    } catch (err) {
      handleFirestoreError('getInventoryState', err);
      return null;
    }
  },

  subscribeInventoryState(onUpdate: (data: any) => void, onError?: (err: any) => void) {
    try {
      const docRef = doc(db, QUEUE_DOC_PATH, 'irm_inventory');
      return onSnapshot(docRef, (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          onUpdate(data);
        }
      }, (err) => {
        handleFirestoreError('subscribeInventoryState', err);
        if (onError) onError(err);
      });
    } catch (e) {
      console.warn('Failed to attach Firestore Inventory snapshot listener:', e);
      return () => {};
    }
  },

  async saveInventoryState(data: any): Promise<boolean> {
    if (checkQuotaCooldown()) return false;
    try {
      const docRef = doc(db, QUEUE_DOC_PATH, 'irm_inventory');
      const sanitized = JSON.parse(JSON.stringify({
        ...data,
        lastUpdated: new Date().toISOString()
      }));
      await setDoc(docRef, sanitized, { merge: true });
      return true;
    } catch (err) {
      handleFirestoreError('saveInventoryState', err);
      return false;
    }
  },

  // 7. Security & Master Passwords Cloud Firestore Synchronization
  async getSecurityConfig(): Promise<{ appPassword?: string; databasePassword?: string } | null> {
    if (checkQuotaCooldown()) return null;
    try {
      const docRef = doc(db, QUEUE_DOC_PATH, 'security_config');
      const snapshot = await getDoc(docRef);
      if (snapshot.exists()) {
        return snapshot.data() as { appPassword?: string; databasePassword?: string };
      }
      return null;
    } catch (err) {
      handleFirestoreError('getSecurityConfig', err);
      return null;
    }
  },

  subscribeSecurityConfig(onUpdate: (data: { appPassword?: string; databasePassword?: string }) => void, onError?: (err: any) => void) {
    try {
      const docRef = doc(db, QUEUE_DOC_PATH, 'security_config');
      return onSnapshot(docRef, (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data() as { appPassword?: string; databasePassword?: string };
          onUpdate(data);
        }
      }, (err) => {
        handleFirestoreError('subscribeSecurityConfig', err);
        if (onError) onError(err);
      });
    } catch (e) {
      console.warn('Failed to attach Firestore security snapshot listener:', e);
      return () => {};
    }
  },

  async saveSecurityConfig(config: { appPassword?: string; databasePassword?: string }): Promise<boolean> {
    if (checkQuotaCooldown()) return false;
    try {
      const docRef = doc(db, QUEUE_DOC_PATH, 'security_config');
      const sanitized = JSON.parse(JSON.stringify({
        ...config,
        lastUpdated: new Date().toISOString()
      }));
      await setDoc(docRef, sanitized, { merge: true });
      return true;
    } catch (err) {
      handleFirestoreError('saveSecurityConfig', err);
      return false;
    }
  },

  // 6. Persistent Cloud Photos Storage (Synchronized across all devices)
  async savePhotoToCloud(photo: PhotoRecord & { dataUrl?: string }): Promise<boolean> {
    if (checkQuotaCooldown() || !photo || !photo.id) return false;
    try {
      const docRef = doc(db, PHOTOS_COLLECTION, photo.id);
      const sanitized = JSON.parse(JSON.stringify({
        id: photo.id,
        url: photo.url || `/uploads/${photo.filename || photo.id + '.jpg'}`,
        filename: photo.filename || `${photo.id}.jpg`,
        dataUrl: photo.dataUrl || '',
        title: photo.title || 'Foto Instruksi IRM',
        originalName: photo.originalName || photo.filename,
        boxId: photo.boxId || null,
        boxTitle: photo.boxTitle || null,
        size: photo.size || (photo.dataUrl ? photo.dataUrl.length : 0),
        uploadedAt: photo.uploadedAt || new Date().toISOString(),
      }));
      await setDoc(docRef, sanitized, { merge: true });
      return true;
    } catch (err) {
      handleFirestoreError('savePhotoToCloud', err);
      return false;
    }
  },

  async getPhotoFromCloud(photoId: string): Promise<PhotoRecord | null> {
    if (checkQuotaCooldown() || !photoId) return null;
    try {
      const docRef = doc(db, PHOTOS_COLLECTION, photoId);
      const snapshot = await getDoc(docRef);
      if (snapshot.exists()) {
        return snapshot.data() as PhotoRecord;
      }
      return null;
    } catch (err) {
      handleFirestoreError('getPhotoFromCloud', err);
      return null;
    }
  },

  async getAllPhotosFromCloud(): Promise<PhotoRecord[]> {
    if (checkQuotaCooldown()) return [];
    try {
      const colRef = collection(db, PHOTOS_COLLECTION);
      const snapshot = await getDocs(colRef);
      const photos: PhotoRecord[] = [];
      snapshot.forEach(docSnap => {
        if (docSnap.exists()) {
          photos.push(docSnap.data() as PhotoRecord);
        }
      });
      return photos.sort((a, b) => new Date(b.uploadedAt || 0).getTime() - new Date(a.uploadedAt || 0).getTime());
    } catch (err) {
      handleFirestoreError('getAllPhotosFromCloud', err);
      return [];
    }
  },

  async deletePhotoFromCloud(photoId: string): Promise<boolean> {
    if (checkQuotaCooldown() || !photoId) return false;
    try {
      const docRef = doc(db, PHOTOS_COLLECTION, photoId);
      await deleteDoc(docRef);
      return true;
    } catch (err) {
      handleFirestoreError('deletePhotoFromCloud', err);
      return false;
    }
  }
};
