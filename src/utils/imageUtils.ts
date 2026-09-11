import React from 'react';
import { PhotoRecord, QueueBox, PatientItem, MasterPatient, DailyPatientVisit, PatientInstructionPhoto } from '../types';
import { cloudDatabaseService } from './cloudDatabaseService';

/**
 * Helper to safely extract all image URLs associated with a QueueBox,
 * maintaining backwards compatibility with instructionImageUrl.
 */
export function getBoxImageUrls(box?: Partial<QueueBox> | null): string[] {
  if (!box) return [];
  if (Array.isArray(box.instructionImageUrls) && box.instructionImageUrls.length > 0) {
    return box.instructionImageUrls.filter((u): u is string => typeof u === 'string' && u.trim().length > 0);
  }
  if (box.instructionImageUrl && typeof box.instructionImageUrl === 'string' && box.instructionImageUrl.trim().length > 0) {
    return [box.instructionImageUrl.trim()];
  }
  return [];
}

/**
 * Helper to safely extract all image URLs associated with a Patient,
 * maintaining backwards compatibility across PatientItem, MasterPatient, and DailyPatientVisit.
 */
export function getPatientImageUrls(patient?: Partial<PatientItem | MasterPatient | DailyPatientVisit> | null): string[] {
  if (!patient) return [];
  const urls: string[] = [];

  // Check instructionImageUrls array
  if (Array.isArray(patient.instructionImageUrls)) {
    patient.instructionImageUrls.forEach(u => {
      if (typeof u === 'string' && u.trim().length > 0 && !urls.includes(u.trim())) {
        urls.push(u.trim());
      }
    });
  }

  // Check instructionPhotos array
  if (Array.isArray(patient.instructionPhotos)) {
    patient.instructionPhotos.forEach(p => {
      const u = p?.url || p?.dataUrl;
      if (typeof u === 'string' && u.trim().length > 0 && !urls.includes(u.trim())) {
        urls.push(u.trim());
      }
    });
  }

  // Check single instructionImageUrl
  if (patient.instructionImageUrl && typeof patient.instructionImageUrl === 'string' && patient.instructionImageUrl.trim().length > 0) {
    const u = patient.instructionImageUrl.trim();
    if (!urls.includes(u)) {
      urls.unshift(u);
    }
  }

  return urls;
}

/**
 * Compresses an image file client-side to a lightweight base64 Data URL (optimized for high clarity & fast cloud sync)
 */
export async function processImageFile(file: File, maxWidth = 1200, quality = 0.78): Promise<string> {
  return new Promise((resolve, reject) => {
    // If not an image, read directly
    if (!file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (e) => reject(e);
      reader.readAsDataURL(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result;
      if (typeof result !== 'string') {
        reject(new Error('Gagal membaca data file gambar'));
        return;
      }

      // If SVG or animated GIF, keep original
      if (file.type === 'image/svg+xml' || file.type === 'image/gif') {
        resolve(result);
        return;
      }

      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          let width = img.naturalWidth || img.width;
          let height = img.naturalHeight || img.height;

          const maxDim = maxWidth || 1600;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          canvas.width = Math.max(1, width);
          canvas.height = Math.max(1, height);

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(result);
            return;
          }

          const outMime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
          if (outMime === 'image/jpeg') {
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
          }

          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const compressedDataUrl = canvas.toDataURL(outMime, quality);
          resolve(compressedDataUrl);
        } catch (canvasErr) {
          console.warn('Canvas compression error, using raw image data URL:', canvasErr);
          resolve(result);
        }
      };

      img.onerror = () => {
        resolve(result);
      };

      img.src = result;
    };

    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
}

export interface UploadImageMeta {
  boxId?: string;
  boxTitle?: string;
  title?: string;
  originalName?: string;
}

/**
 * Uploads a single image (File or base64 data URL) to the server storage and Photo Database
 */
export async function uploadImageToServer(
  fileOrDataUrl: File | string,
  meta?: UploadImageMeta
): Promise<string> {
  let base64Data = '';
  let originalName = meta?.originalName;

  if (fileOrDataUrl instanceof File) {
    originalName = originalName || fileOrDataUrl.name;
    base64Data = await processImageFile(fileOrDataUrl);
  } else {
    base64Data = fileOrDataUrl;
  }

  // If already a valid public / uploaded URL, return immediately
  if (
    typeof base64Data === 'string' &&
    (base64Data.startsWith('/uploads/') ||
      base64Data.startsWith('http://') ||
      base64Data.startsWith('https://'))
  ) {
    return base64Data;
  }

  const response = await fetch('/api/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      image: base64Data,
      originalName,
      boxId: meta?.boxId,
      boxTitle: meta?.boxTitle,
      title: meta?.title,
    }),
  });

  if (!response.ok) {
    let errMsg = `Gagal mengunggah foto (HTTP ${response.status})`;
    try {
      const errJson = await response.json();
      if (errJson?.error) errMsg = errJson.error;
    } catch {}
    throw new Error(errMsg);
  }

  const data = await response.json();
  if (data.url) {
    const photoId = data.photo?.id || data.url.replace('/uploads/', '').replace(/\.[^/.]+$/, '');
    // Ensure photo is backed up to Cloud Firestore irm_photos collection
    cloudDatabaseService.savePhotoToCloud({
      id: photoId,
      url: data.url,
      filename: data.photo?.filename || `${photoId}.jpg`,
      dataUrl: base64Data,
      originalName,
      title: meta?.title || meta?.originalName || 'Foto Instruksi IRM',
      boxId: meta?.boxId,
      boxTitle: meta?.boxTitle,
      size: base64Data.length,
      uploadedAt: new Date().toISOString(),
    }).catch((err) => console.warn('[CloudPhotoSync] Notice:', err));

    return data.url;
  }

  throw new Error('Server tidak mengembalikan URL foto yang valid');
}

/**
 * Uploads multiple image files to the server and registers them into the Photo Database.
 */
export async function uploadMultipleImagesToServer(
  files: File[],
  meta?: UploadImageMeta,
  onProgress?: (completed: number, total: number) => void
): Promise<string[]> {
  if (!files || files.length === 0) return [];

  const total = files.length;
  let completed = 0;
  const urls: string[] = [];

  for (const file of files) {
    try {
      const url = await uploadImageToServer(file, {
        ...meta,
        originalName: file.name,
      });
      if (url) urls.push(url);
    } catch (e: any) {
      console.error('Failed to upload file:', file.name, e);
      throw new Error(`Gagal mengunggah file "${file.name}": ${e?.message || 'Error server'}`);
    }
    completed++;
    if (onProgress) onProgress(completed, total);
  }

  return urls;
}

/**
 * Retrieves all photos stored in the system Photo Database, merging backend and cloud records
 */
export async function getPhotosFromDatabase(): Promise<PhotoRecord[]> {
  const photoMap = new Map<string, PhotoRecord>();

  // 1. Fetch from server REST API
  try {
    const res = await fetch('/api/photos');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.photos)) {
        data.photos.forEach((p: PhotoRecord) => {
          if (p && p.id) photoMap.set(p.id, p);
        });
      }
    }
  } catch (err) {
    console.warn('Failed to fetch photos from /api/photos:', err);
  }

  // 2. Hydrate & merge from Cloud Firestore irm_photos collection
  try {
    const cloudPhotos = await cloudDatabaseService.getAllPhotosFromCloud();
    if (Array.isArray(cloudPhotos)) {
      cloudPhotos.forEach((cp) => {
        if (cp && cp.id && !photoMap.has(cp.id)) {
          photoMap.set(cp.id, cp);
        }
      });
    }
  } catch (err) {
    console.warn('Failed to fetch photos from Cloud Firestore:', err);
  }

  return Array.from(photoMap.values()).sort(
    (a, b) => new Date(b.uploadedAt || 0).getTime() - new Date(a.uploadedAt || 0).getTime()
  );
}

/**
 * Deletes a photo from the system Photo Database and Cloud Firestore
 */
export async function deletePhotoFromDatabase(photoIdOrUrl: string): Promise<boolean> {
  const photoId = photoIdOrUrl.replace('/uploads/', '').replace(/\.[^/.]+$/, '');

  // Delete from Cloud Firestore
  cloudDatabaseService.deletePhotoFromCloud(photoId).catch(() => {});

  // Delete from local server API
  try {
    const res = await fetch(`/api/photos/${encodeURIComponent(photoIdOrUrl)}`, {
      method: 'DELETE',
    });
    return res.ok;
  } catch (err) {
    console.warn('Failed to delete photo from server:', err);
    return false;
  }
}

/**
 * Persists box images to the backend queue store
 */
export async function saveBoxImagesToServer(boxId: string, imageUrls: string[], senderDeviceId?: string): Promise<boolean> {
  try {
    const res = await fetch('/api/queue/box-images', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ boxId, imageUrls, senderDeviceId }),
    });
    return res.ok;
  } catch (err) {
    console.warn('Failed to save box images to server:', err);
    return false;
  }
}

/**
 * Resolves a failed image URL by querying Cloud Firestore irm_photos collection
 */
export async function recoverImageFromCloud(failedUrl: string): Promise<string | null> {
  if (!failedUrl) return null;
  // Extract photoId from url like /uploads/photo_123_xyz.jpg or http://.../uploads/photo_123_xyz.jpg
  const filename = failedUrl.split('/').pop() || '';
  const photoId = filename.replace(/\.[^/.]+$/, '');
  if (!photoId || !photoId.startsWith('photo_')) return null;

  try {
    const record = await cloudDatabaseService.getPhotoFromCloud(photoId);
    if (record && record.dataUrl) {
      return record.dataUrl;
    }
  } catch (err) {
    console.warn('[ImageRecover] Failed to recover from cloud:', err);
  }
  return null;
}

/**
 * Image error handler with automatic Cloud Firestore recovery before falling back to stock image
 */
export function handleImageErrorWithCloudFallback(
  e: React.SyntheticEvent<HTMLImageElement>,
  customFallback?: string
): void {
  const imgEl = e.currentTarget;
  const failedSrc = imgEl.src;
  const fallback = customFallback || 'https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&w=600&q=80';

  if (imgEl.dataset.cloudFallbackTried === 'true') {
    imgEl.src = fallback;
    return;
  }
  imgEl.dataset.cloudFallbackTried = 'true';

  recoverImageFromCloud(failedSrc)
    .then((cloudDataUrl) => {
      if (cloudDataUrl) {
        imgEl.src = cloudDataUrl;
      } else {
        imgEl.src = fallback;
      }
    })
    .catch(() => {
      imgEl.src = fallback;
    });
}

/**
 * Uploads patient instruction photos to the server and mirrors them to Cloud Firestore.
 */
export async function uploadPatientInstructionPhotos(
  filesOrDataUrls: (File | string)[],
  patientMeta: {
    medicalRecordNo: string;
    patientName: string;
    patientId?: string;
    boxId?: string;
    boxTitle?: string;
    note?: string;
  }
): Promise<{ urls: string[]; photos: PatientInstructionPhoto[] }> {
  if (!filesOrDataUrls || filesOrDataUrls.length === 0) {
    return { urls: [], photos: [] };
  }

  const processedDataUrls: { dataUrl: string; name?: string }[] = [];

  for (const item of filesOrDataUrls) {
    if (typeof item === 'string') {
      if (item.trim().length > 0) {
        processedDataUrls.push({ dataUrl: item.trim() });
      }
    } else if (item instanceof File) {
      try {
        const compressed = await processImageFile(item, 1400, 0.82);
        processedDataUrls.push({ dataUrl: compressed, name: item.name });
      } catch (err) {
        console.warn('Failed to process image file:', err);
      }
    }
  }

  if (processedDataUrls.length === 0) {
    return { urls: [], photos: [] };
  }

  const payload = {
    images: processedDataUrls.map((p) => ({
      image: p.dataUrl,
      originalName: p.name || `instruksi_ranap_${patientMeta.medicalRecordNo || 'pasien'}.jpg`,
      title: `Instruksi Ranap - ${patientMeta.patientName || patientMeta.medicalRecordNo || 'Pasien'}`,
      medicalRecordNo: patientMeta.medicalRecordNo,
      patientName: patientMeta.patientName,
      patientId: patientMeta.patientId,
      boxId: patientMeta.boxId,
      boxTitle: patientMeta.boxTitle,
      photoType: 'patient_ranap',
    })),
    medicalRecordNo: patientMeta.medicalRecordNo,
    patientName: patientMeta.patientName,
    patientId: patientMeta.patientId,
    boxId: patientMeta.boxId,
    boxTitle: patientMeta.boxTitle,
    photoType: 'patient_ranap',
  };

  const returnedPhotos: PatientInstructionPhoto[] = [];
  const returnedUrls: string[] = [];

  try {
    const res = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.photos)) {
        data.photos.forEach((p: any) => {
          const photoObj: PatientInstructionPhoto = {
            id: p.id || `photo_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            url: p.url,
            dataUrl: p.dataUrl,
            uploadedAt: p.uploadedAt || new Date().toISOString(),
            medicalRecordNo: patientMeta.medicalRecordNo,
            patientName: patientMeta.patientName,
            patientId: patientMeta.patientId,
            boxId: patientMeta.boxId,
            boxTitle: patientMeta.boxTitle,
            note: patientMeta.note,
          };
          returnedPhotos.push(photoObj);
          if (p.url && !returnedUrls.includes(p.url)) returnedUrls.push(p.url);
        });
      } else if (data.url) {
        returnedUrls.push(data.url);
        returnedPhotos.push({
          id: data.photo?.id || `photo_${Date.now()}`,
          url: data.url,
          uploadedAt: new Date().toISOString(),
          medicalRecordNo: patientMeta.medicalRecordNo,
          patientName: patientMeta.patientName,
          patientId: patientMeta.patientId,
          note: patientMeta.note,
        });
      }
    }
  } catch (err) {
    console.warn('Failed to upload patient instruction photos via backend API, saving locally/dataUrls:', err);
  }

  // If backend was offline/fallback, use local compressed dataUrls
  if (returnedUrls.length === 0) {
    processedDataUrls.forEach((p, idx) => {
      const id = `photo_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`;
      returnedUrls.push(p.dataUrl);
      returnedPhotos.push({
        id,
        url: p.dataUrl,
        dataUrl: p.dataUrl,
        uploadedAt: new Date().toISOString(),
        medicalRecordNo: patientMeta.medicalRecordNo,
        patientName: patientMeta.patientName,
        patientId: patientMeta.patientId,
        note: patientMeta.note,
      });

      // Also mirror directly to Cloud Firestore
      cloudDatabaseService.savePhotoToCloud({
        id,
        url: p.dataUrl,
        dataUrl: p.dataUrl,
        filename: `${id}.jpg`,
        title: `Instruksi Ranap - ${patientMeta.patientName || patientMeta.medicalRecordNo || 'Pasien'}`,
        medicalRecordNo: patientMeta.medicalRecordNo,
        patientName: patientMeta.patientName,
        patientId: patientMeta.patientId,
        photoType: 'patient_ranap',
        uploadedAt: new Date().toISOString(),
      }).catch((e) => console.warn('Cloud save photo failed:', e));
    });
  }

  return { urls: returnedUrls, photos: returnedPhotos };
}

