import { PatientItem } from '../types';

/**
 * Pemetaan Durasi Tindakan Antrean Jemputan Ranap IRM RSPP
 * 
 * Aturan Waktu:
 * - 1 = IR (15 menit)
 * - 2 = MWD / SWD (15 menit)
 * - 4 = US / Ultrasound (10 menit)
 * - 47 = Cryo (10 menit)
 * - 6 = TENS / ES (15 menit)
 * - 14 = Paket Chest (30 menit)
 * - 18 = Nebulizer (15 menit)
 * - 9 = Manipulasi (15 menit)
 * - 1+10 = IR + Rehab (30 menit)
 * - 15 = Parafin (20 menit)
 * - 10 = Rehab / Exercise (20 menit)
 * - 74 = Vaccum (20 menit)
 * - 75 = Chest Terapi (20 menit)
 * - OT = Terapi Okupasi (30 menit)
 * - TW = Terapi Wicara (30 menit)
 * - Default = 15 menit
 */

const BASE_CODE_DURATIONS: Record<string, number> = {
  '1+10': 30,
  '1-10': 30,
  '1.10': 30,
  '14': 30,
  'OT': 30,
  'TW': 30,
  '15': 20,
  '10': 20,
  '74': 20,
  '75': 20,
  '1': 15,
  '2': 15,
  '6': 15,
  '9': 15,
  '18': 15,
  '4': 10,
  '47': 10,
};

/**
 * Menghitung durasi timer jemputan dalam satuan menit berdasarkan kode tindakan
 */
export function getJemputanActionDurationMinutes(actionCode?: string): number {
  if (!actionCode || typeof actionCode !== 'string' || !actionCode.trim()) {
    return 15; // default fallback 15 menit
  }

  const rawUpper = actionCode.trim().toUpperCase();

  // 1. Cek kombinasi khusus 1+10 (IR + Rehab)
  if (
    rawUpper.includes('1+10') ||
    rawUpper.includes('1 + 10') ||
    rawUpper.includes('1-10') ||
    rawUpper.includes('1 - 10') ||
    rawUpper.includes('1.10') ||
    (rawUpper.includes('IR') && (rawUpper.includes('REHAB') || rawUpper.includes('10')))
  ) {
    return 30;
  }

  // 2. Cek kecocokan langsung pada pemetaan
  if (BASE_CODE_DURATIONS[rawUpper] !== undefined) {
    return BASE_CODE_DURATIONS[rawUpper];
  }

  // 3. Cek kata kunci spesifik
  if (rawUpper.includes('PAKET CHEST') || rawUpper.includes('CHEST+INHALASI') || rawUpper.includes('CHEST INHALASI')) {
    return 30;
  }
  if (rawUpper.includes('OKUPASI') || rawUpper.startsWith('OT')) {
    return 30;
  }
  if (rawUpper.includes('WICARA') || rawUpper.startsWith('TW')) {
    return 30;
  }
  if (rawUpper.includes('PARAFIN') || rawUpper.includes('PARAFFIN')) {
    return 20;
  }
  if (rawUpper.includes('VACCUM') || rawUpper.includes('VACUUM')) {
    return 20;
  }
  if (rawUpper.includes('CRYO')) {
    return 10;
  }
  if (rawUpper.includes('NEBU') || rawUpper.includes('NEBULIZER')) {
    return 15;
  }
  if (rawUpper.includes('MANIPULASI')) {
    return 15;
  }

  // 4. Tokenisasi kode majemuk (misal: "2.6" atau "2, 6" atau "4.6.1")
  const tokens = rawUpper
    .split(/[\s,\.\+\/]+/)
    .map(t => t.trim())
    .filter(Boolean);

  if (tokens.length === 1) {
    const singleToken = tokens[0];
    if (BASE_CODE_DURATIONS[singleToken] !== undefined) {
      return BASE_CODE_DURATIONS[singleToken];
    }
  } else if (tokens.length > 1) {
    // Jika ada kombinasi token 1 dan 10
    if (tokens.includes('1') && tokens.includes('10')) {
      return 30;
    }

    // Hitung total durasi dari token yang valid (dibatasi max 60 menit)
    let calculatedSum = 0;
    let validTokenCount = 0;

    for (const tok of tokens) {
      if (BASE_CODE_DURATIONS[tok] !== undefined) {
        calculatedSum += BASE_CODE_DURATIONS[tok];
        validTokenCount++;
      } else if (tok === 'OT' || tok === 'TW') {
        calculatedSum += 30;
        validTokenCount++;
      }
    }

    if (validTokenCount > 0 && calculatedSum > 0) {
      return Math.min(60, calculatedSum);
    }
  }

  return 15; // default fallback 15 menit
}

export interface JemputanTimerState {
  remainingSeconds: number;
  isExpired: boolean;
  formattedTimer: string;
  durationMinutes: number;
  elapsedSeconds: number;
  totalDurationSeconds: number;
}

/**
 * Menghitung status timer hitung mundur jemputan ranap
 */
export function getJemputanTimerState(patient: PatientItem, currentTimeMs: number = Date.now()): JemputanTimerState {
  const durationMinutes = patient.jemputanDurationMinutes || getJemputanActionDurationMinutes(patient.actionCode);
  const totalDurationSeconds = durationMinutes * 60;

  // Waktu awal masuk kotak jemputan
  let startTimeMs = 0;
  if (patient.enteredJemputanAt) {
    startTimeMs = new Date(patient.enteredJemputanAt).getTime();
  } else if (patient.createdAt) {
    startTimeMs = new Date(patient.createdAt).getTime();
  }

  if (!startTimeMs || isNaN(startTimeMs)) {
    startTimeMs = currentTimeMs;
  }

  const elapsedMs = Math.max(0, currentTimeMs - startTimeMs);
  const elapsedSeconds = Math.floor(elapsedMs / 1000);
  const remainingSeconds = Math.max(0, totalDurationSeconds - elapsedSeconds);
  const isExpired = remainingSeconds <= 0;

  // Format MM:SS
  const mins = Math.floor(remainingSeconds / 60);
  const secs = remainingSeconds % 60;
  const formattedTimer = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  return {
    remainingSeconds,
    isExpired,
    formattedTimer,
    durationMinutes,
    elapsedSeconds,
    totalDurationSeconds
  };
}
