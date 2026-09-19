import { PatientItem, QueueBox } from '../types';
import { getServiceStartTimestampWIB } from './dateHelper';

const SERVICE_START_HOUR_WIB = 8;

export interface PatientTimeMetrics {
  patientId: string;
  queueNumber: string;
  patientName: string;
  medicalRecordNo: string;
  boxId: string;
  boxTitle: string;
  officerName: string;
  actionCode?: string;
  isWarning?: boolean;
  isRanap?: boolean;
  completed: boolean;
  registeredAt: Date;
  calledAt?: Date;
  completedAt?: Date;
  // Response time in minutes: dari saat didaftarkan/ditulis hingga saat diceklis (atau waktu berjalan jika belum diceklis)
  waitMinutes: number; 
  responseTimeMinutes: number; 
  serviceMinutes?: number;
  totalMinutes?: number; 
  waitStatus: 'fast' | 'normal' | 'moderate' | 'delayed';
  statusLabel: string;
  isCompliant: boolean;
  isCurrentlyWaiting: boolean;
  // true kalau waktu ceklis selesai tercatat lebih awal dari waktu input (mustahil secara nyata,
  // biasanya karena jam tablet yang mencatat ceklis salah/mundur) - dikecualikan dari rata-rata & SPM.
  isDataInvalid?: boolean;
  // true kalau kunjungan DITUTUP tanpa pernah diceklis selesai - pasiennya dipindahkan
  // ke terapis lain atau dihapus dari antrean. Timernya berhenti di waktu penutupan,
  // dan barisnya dikecualikan dari hitungan pasien aktif serta peringkat keterlambatan.
  isEnded?: boolean;
  endedReason?: 'dipindahkan' | 'dihapus';
  endedAt?: Date;
  formattedWait: string;
  formattedResponseTime: string;
  formattedService?: string;
  formattedTotal: string;
}

export interface BoxResponseMetrics {
  boxId: string;
  boxTitle: string;
  officerName: string;
  location: string;
  color: string;
  totalPatients: number;
  activeCount: number;
  completedCount: number;
  avgWaitMinutes: number; // Avg response time (input ke ceklis)
  avgResponseMinutes: number;
  avgTotalMinutes: number;
  complianceRate: number; // % response time <= 30 mins
  longestActiveWaitMinutes: number;
  delayedCount: number; // response time > 45 mins
}

export interface ResponseTimeAnalyticsSummary {
  totalPatients: number;
  activePatientsCount: number;
  completedPatientsCount: number;
  invalidDataCount: number; // Jumlah data dengan jam ceklis < jam input (data tidak valid)
  avgWaitMinutes: number; // Rata-rata respon time (input ke ceklis)
  avgResponseMinutes: number;
  avgTotalMinutes: number;
  // SPM Compliance
  spmComplianceRate: number; // % <= 30 mins
  fastRate: number; // % <= 15 mins
  normalRate: number; // % 16-30 mins
  moderateRate: number; // % 31-60 mins
  delayedRate: number; // % > 60 mins
  distribution: {
    fastCount: number; // <= 15 min
    normalCount: number; // 16 - 30 min
    moderateCount: number; // 31 - 60 min
    delayedCount: number; // > 60 min
  };
  longestWaitingActive: PatientTimeMetrics[];
  boxMetrics: BoxResponseMetrics[];
  patientMetrics: PatientTimeMetrics[];
}

export function formatMinutes(mins: number): string {
  if (mins < 1) return '< 1 mnt';
  if (mins < 60) return `${mins} mnt`;
  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  return remainingMins > 0 ? `${hours} jam ${remainingMins} mnt` : `${hours} jam`;
}

export function calculatePatientTimeMetrics(
  patient: PatientItem,
  boxes: QueueBox[],
  now: number = Date.now(),
  clampToServiceStart: boolean = true
): PatientTimeMetrics {
  const registeredAt = new Date(patient.createdAt);
  const regTime = registeredAt.getTime();
  const serviceStartTime = !isNaN(regTime) ? getServiceStartTimestampWIB(registeredAt, SERVICE_START_HOUR_WIB) : NaN;

  // Jam mulai HANYA digeser maju ke jam buka (08:00 WIB) kalau acuan akhirnya (jam ceklis, atau
  // jam sekarang kalau belum selesai) memang jatuh di jam buka atau sesudahnya - supaya pasien
  // yang SELURUH riwayatnya (daftar sampai ceklis) terjadi sebelum jam buka (mis. Antrian
  // Jemputan tengah malam) tidak dibandingkan terhadap jam mulai yang lebih telat dari jam
  // ceklisnya sendiri, yang akan selalu menghasilkan durasi negatif / "Data Tidak Valid" palsu.
  const getEffectiveStartTime = (referenceTime: number): number => {
    if (isNaN(regTime)) return regTime;
    if (!clampToServiceStart || isNaN(serviceStartTime) || serviceStartTime > referenceTime) {
      return regTime;
    }
    return Math.max(regTime, serviceStartTime);
  };

  const calledAt = patient.lastCalledAt ? new Date(patient.lastCalledAt) : undefined;
  const completedAt = patient.completedAt ? new Date(patient.completedAt) : undefined;

  // Kunjungan yang ditutup tanpa pernah diceklis (dipindahkan / dihapus). Hanya berlaku
  // kalau memang BELUM selesai - kalau sudah diceklis, jam ceklis yang menang.
  const endedAtDate = patient.endedAt ? new Date(patient.endedAt) : undefined;
  const isEnded = !patient.completed && !!endedAtDate && !isNaN(endedAtDate.getTime());

  const parentBox = boxes.find(b => b.id === patient.boxId);
  const boxTitle = parentBox 
    ? parentBox.title.split('(')[0].trim() 
    : ((patient as any).boxTitle ? String((patient as any).boxTitle).split('(')[0].trim() : 'Kotak');
  const officerName = parentBox 
    ? parentBox.officerName 
    : ((patient as any).officerName || 'Petugas');

  let responseTimeMinutes = 0;
  let isDataInvalid = false;

  if (patient.completed && completedAt && !isNaN(completedAt.getTime())) {
    // Respon time dihitung dari saat didaftarkan / ditulis hingga saat diceklis (dimulai paling awal dari jam buka 08:00 WIB)
    const effectiveStartTime = getEffectiveStartTime(completedAt.getTime());
    const rawMinutes = !isNaN(effectiveStartTime) ? Math.round((completedAt.getTime() - effectiveStartTime) / 60000) : NaN;
    if (isNaN(rawMinutes) || rawMinutes < 0) {
      // Ceklis selesai tercatat lebih awal dari waktu input - mustahil secara nyata, biasanya
      // karena jam tablet yang mencatat ceklis salah/mundur. Tandai sebagai data tidak valid
      // alih-alih diam-diam ditampilkan sebagai "< 1 mnt" (yang menyesatkan laporan kepatuhan SPM).
      isDataInvalid = true;
      responseTimeMinutes = 0;
    } else {
      responseTimeMinutes = rawMinutes;
    }
  } else if (patient.completed) {
    // Selesai tapi tidak ada timestamp completedAt spesifik
    const effectiveStartTime = getEffectiveStartTime(now);
    const elapsedMinutes = !isNaN(effectiveStartTime) ? Math.round((now - effectiveStartTime) / 60000) : 25;
    if (elapsedMinutes > 180 || elapsedMinutes < 0) {
      responseTimeMinutes = 25; // standar durasi tindakan terapi IRM
    } else {
      responseTimeMinutes = Math.max(0, elapsedMinutes);
    }
  } else if (isEnded && endedAtDate) {
    // Kunjungan ditutup tanpa pernah diceklis. Timernya BERHENTI di waktu penutupan -
    // tidak boleh terus berjalan sampai sekarang. Tanpa ini, baris di terapis asal
    // terus membesar selamanya setelah pasien dipindahkan, dan mencemari laporan.
    const effectiveStartTime = getEffectiveStartTime(endedAtDate.getTime());
    const rawMinutes = !isNaN(effectiveStartTime)
      ? Math.round((endedAtDate.getTime() - effectiveStartTime) / 60000)
      : NaN;
    responseTimeMinutes = (isNaN(rawMinutes) || rawMinutes < 0) ? 0 : rawMinutes;
  } else {
    // Pasien masih antre / berjalan -> Waktu respon dihitung dari pendaftaran hingga saat ini (dimulai paling awal dari jam buka 08:00 WIB)
    const effectiveStartTime = getEffectiveStartTime(now);
    const isToday = !isNaN(regTime) && new Date().toDateString() === registeredAt.toDateString();
    const elapsedMinutes = !isNaN(effectiveStartTime) ? Math.round((now - effectiveStartTime) / 60000) : 15;
    if (!isToday && elapsedMinutes > 180) {
      responseTimeMinutes = 35;
    } else {
      responseTimeMinutes = Math.max(0, elapsedMinutes);
    }
  }

  const waitMinutes = responseTimeMinutes;
  const totalMinutes = responseTimeMinutes;

  let waitStatus: 'fast' | 'normal' | 'moderate' | 'delayed' = 'fast';
  let statusLabel = 'Sangat Cepat (<=15m)';
  if (responseTimeMinutes > 60) {
    waitStatus = 'delayed';
    statusLabel = 'Terlambat (>60m)';
  } else if (responseTimeMinutes > 30) {
    waitStatus = 'moderate';
    statusLabel = 'Perhatian (31-60m)';
  } else if (responseTimeMinutes > 15) {
    waitStatus = 'normal';
    statusLabel = 'Standar SPM (16-30m)';
  }
  if (isDataInvalid) {
    statusLabel = 'Data Tidak Valid (jam ceklis < jam input)';
  }
  if (isEnded) {
    statusLabel = patient.endedReason === 'dipindahkan'
      ? 'Dipindahkan ke terapis lain'
      : 'Dihapus dari antrean';
  }

  const isCompliant = !isDataInvalid && responseTimeMinutes <= 30;

  return {
    patientId: patient.id,
    queueNumber: patient.queueNumber,
    patientName: patient.patientName,
    medicalRecordNo: patient.medicalRecordNo,
    boxId: patient.boxId,
    boxTitle,
    officerName,
    actionCode: patient.actionCode,
    isWarning: patient.isWarning,
    isRanap: patient.isRanap,
    completed: patient.completed,
    registeredAt,
    calledAt,
    completedAt,
    waitMinutes,
    responseTimeMinutes,
    serviceMinutes: responseTimeMinutes,
    totalMinutes,
    waitStatus,
    statusLabel,
    isCompliant,
    isCurrentlyWaiting: !patient.completed && !isEnded,
    isDataInvalid,
    isEnded,
    endedReason: patient.endedReason,
    endedAt: isEnded ? endedAtDate : undefined,
    formattedWait: isDataInvalid ? 'Data Tidak Valid' : formatMinutes(responseTimeMinutes),
    formattedResponseTime: isDataInvalid ? 'Data Tidak Valid' : formatMinutes(responseTimeMinutes),
    formattedService: isDataInvalid ? 'Data Tidak Valid' : formatMinutes(responseTimeMinutes),
    formattedTotal: isDataInvalid ? 'Data Tidak Valid' : formatMinutes(totalMinutes),
  };
}

export function computeResponseTimeAnalytics(
  patients: PatientItem[],
  boxes: QueueBox[],
  now: number = Date.now()
): ResponseTimeAnalyticsSummary {
  const patientMetrics = patients.map(p => calculatePatientTimeMetrics(p, boxes, now));

  const totalPatients = patientMetrics.length;
  // Kunjungan yang sudah ditutup (dipindahkan/dihapus) BUKAN pasien aktif - kalau ikut
  // terhitung, satu pasien yang dipindahkan akan tampak sebagai dua pasien berjalan.
  const activePatientsCount = patientMetrics.filter(p => !p.completed && !p.isEnded).length;
  const completedPatientsCount = patientMetrics.filter(p => p.completed).length;
  const invalidDataCount = patientMetrics.filter(p => p.isDataInvalid).length;

  // Data tidak valid (jam ceklis < jam input, biasanya akibat jam tablet salah/mundur) dikecualikan
  // dari rata-rata, distribusi, dan kepatuhan SPM supaya laporan tidak menyesatkan.
  const completedMetrics = patientMetrics.filter(p => p.completed && !p.isDataInvalid);

  // Calculate Averages - Respon Time (Daftar -> Ceklis) hanya untuk pasien yang sudah selesai
  const allResponseMinutes = completedMetrics.map(p => p.responseTimeMinutes);
  const avgResponseMinutes = allResponseMinutes.length > 0 
    ? Math.round(allResponseMinutes.reduce((a, b) => a + b, 0) / allResponseMinutes.length) 
    : 0;

  const avgWaitMinutes = avgResponseMinutes;
  const avgTotalMinutes = avgResponseMinutes;

  // Distribution (hanya pasien selesai)
  let fastCount = 0;
  let normalCount = 0;
  let moderateCount = 0;
  let delayedCount = 0;

  completedMetrics.forEach(p => {
    if (p.responseTimeMinutes <= 15) fastCount++;
    else if (p.responseTimeMinutes <= 30) normalCount++;
    else if (p.responseTimeMinutes <= 60) moderateCount++;
    else delayedCount++;
  });

  const totalCompleted = completedMetrics.length;
  const spmCompliantCount = fastCount + normalCount; // <= 30 min
  const spmComplianceRate = totalCompleted > 0 ? Math.round((spmCompliantCount / totalCompleted) * 100) : 100;
  const fastRate = totalCompleted > 0 ? Math.round((fastCount / totalCompleted) * 100) : 0;
  const normalRate = totalCompleted > 0 ? Math.round((normalCount / totalCompleted) * 100) : 0;
  const moderateRate = totalCompleted > 0 ? Math.round((moderateCount / totalCompleted) * 100) : 0;
  const delayedRate = totalCompleted > 0 ? Math.round((delayedCount / totalCompleted) * 100) : 0;

  // Longest Waiting Active Patients (Top 6)
  const longestWaitingActive = patientMetrics
    .filter(p => !p.completed && !p.isEnded)
    .sort((a, b) => b.responseTimeMinutes - a.responseTimeMinutes)
    .slice(0, 6);

  // Box / Therapist Metrics
  const boxMetrics: BoxResponseMetrics[] = boxes
    .filter(box => {
      const off = (box.officerName || box.title || '').trim().toLowerCase();
      return !off.startsWith('terapis irm') && off !== 'terapis irm';
    })
    .map(box => {
      const boxPatients = patientMetrics.filter(p => p.boxId === box.id);
      const totalBox = boxPatients.length;
      const activeBox = boxPatients.filter(p => !p.completed && !p.isEnded).length;
      const completedBox = boxPatients.filter(p => p.completed).length;

      const boxCompletedMetrics = boxPatients.filter(p => p.completed && !p.isDataInvalid);

      const bRespList = boxCompletedMetrics.map(p => p.responseTimeMinutes);
      const bAvgResp = bRespList.length > 0 ? Math.round(bRespList.reduce((a, b) => a + b, 0) / bRespList.length) : 0;

      const bCompliant = boxCompletedMetrics.filter(p => p.responseTimeMinutes <= 30).length;
      const bComplianceRate = completedBox > 0 ? Math.round((bCompliant / completedBox) * 100) : 100;

      const activeBoxPatients = boxPatients.filter(p => !p.completed && !p.isEnded);
      const longestActiveWaitMinutes = activeBoxPatients.length > 0 
        ? Math.max(...activeBoxPatients.map(p => p.responseTimeMinutes)) 
        : 0;

      const delayedCountBox = boxCompletedMetrics.filter(p => p.responseTimeMinutes > 45).length;

      const cleanOfficer = (box.officerName && !box.officerName.toLowerCase().startsWith('terapis irm'))
        ? box.officerName
        : box.title.split('(')[0].trim();

      return {
        boxId: box.id,
        boxTitle: box.title,
        officerName: cleanOfficer,
        location: box.location,
        color: box.color,
        totalPatients: totalBox,
        activeCount: activeBox,
        completedCount: completedBox,
        avgWaitMinutes: bAvgResp,
        avgResponseMinutes: bAvgResp,
        avgTotalMinutes: bAvgResp,
        complianceRate: bComplianceRate,
        longestActiveWaitMinutes,
        delayedCount: delayedCountBox,
      };
    });

  return {
    totalPatients,
    activePatientsCount,
    completedPatientsCount,
    invalidDataCount,
    avgWaitMinutes,
    avgResponseMinutes,
    avgTotalMinutes,
    spmComplianceRate,
    fastRate,
    normalRate,
    moderateRate,
    delayedRate,
    distribution: {
      fastCount,
      normalCount,
      moderateCount,
      delayedCount,
    },
    longestWaitingActive,
    boxMetrics,
    patientMetrics,
  };
}
