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
  // clampToServiceStart=true (dipakai untuk statistik SPM/analitik agregat):
  // jam mulai dihitung paling awal dari 08:00 WIB, supaya staf yang input
  // pasien sebelum jam buka tidak "dihukum" waktu respon jadi lebih lama.
  // clampToServiceStart=false (dipakai untuk badge "waktu tunggu" LIVE di
  // kartu kotak antrean): TIDAK di-clamp, supaya badge selalu menunjukkan
  // durasi tunggu SEBENARNYA sejak pasien didaftarkan dan terus berjalan -
  // kalau tetap di-clamp, badge akan terlihat "macet" di 0/"< 1 mnt" selama
  // waktu sekarang masih sebelum jam 08:00 (mis. staf input pasien jam
  // 05:30, di-clamp ke 08:00 yang notabene MASIH DI MASA DEPAN, jadi selisih
  // waktu-sekarang-dikurangi-jam-mulai selalu negatif/dibatasi ke 0).
  const effectiveStartTime = !isNaN(regTime)
    ? (clampToServiceStart
      ? Math.max(regTime, getServiceStartTimestampWIB(registeredAt, SERVICE_START_HOUR_WIB))
      : regTime)
    : regTime;
  const calledAt = patient.lastCalledAt ? new Date(patient.lastCalledAt) : undefined;
  const completedAt = patient.completedAt ? new Date(patient.completedAt) : undefined;

  const parentBox = boxes.find(b => b.id === patient.boxId);
  const boxTitle = parentBox 
    ? parentBox.title.split('(')[0].trim() 
    : ((patient as any).boxTitle ? String((patient as any).boxTitle).split('(')[0].trim() : 'Kotak');
  const officerName = parentBox 
    ? parentBox.officerName 
    : ((patient as any).officerName || 'Petugas');

  let responseTimeMinutes = 0;

  if (patient.completed && completedAt && !isNaN(completedAt.getTime()) && !isNaN(effectiveStartTime)) {
    // Respon time dihitung dari saat didaftarkan / ditulis hingga saat diceklis (dimulai paling awal dari jam buka 08:00 WIB)
    responseTimeMinutes = Math.max(0, Math.round((completedAt.getTime() - effectiveStartTime) / 60000));
  } else if (patient.completed) {
    // Selesai tapi tidak ada timestamp completedAt spesifik
    const elapsedMinutes = !isNaN(effectiveStartTime) ? Math.round((now - effectiveStartTime) / 60000) : 25;
    if (elapsedMinutes > 180 || elapsedMinutes < 0) {
      responseTimeMinutes = 25; // standar durasi tindakan terapi IRM
    } else {
      responseTimeMinutes = Math.max(0, elapsedMinutes);
    }
  } else {
    // Pasien masih antre / berjalan -> Waktu respon dihitung dari pendaftaran hingga saat ini (dimulai paling awal dari jam buka 08:00 WIB)
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

  const isCompliant = responseTimeMinutes <= 30;

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
    isCurrentlyWaiting: !patient.completed,
    formattedWait: formatMinutes(responseTimeMinutes),
    formattedResponseTime: formatMinutes(responseTimeMinutes),
    formattedService: formatMinutes(responseTimeMinutes),
    formattedTotal: formatMinutes(totalMinutes),
  };
}

export function computeResponseTimeAnalytics(
  patients: PatientItem[],
  boxes: QueueBox[],
  now: number = Date.now()
): ResponseTimeAnalyticsSummary {
  const patientMetrics = patients.map(p => calculatePatientTimeMetrics(p, boxes, now));

  const totalPatients = patientMetrics.length;
  const activePatientsCount = patientMetrics.filter(p => !p.completed).length;
  const completedPatientsCount = patientMetrics.filter(p => p.completed).length;

  const completedMetrics = patientMetrics.filter(p => p.completed);

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
    .filter(p => !p.completed)
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
      const activeBox = boxPatients.filter(p => !p.completed).length;
      const completedBox = boxPatients.filter(p => p.completed).length;

      const boxCompletedMetrics = boxPatients.filter(p => p.completed);

      const bRespList = boxCompletedMetrics.map(p => p.responseTimeMinutes);
      const bAvgResp = bRespList.length > 0 ? Math.round(bRespList.reduce((a, b) => a + b, 0) / bRespList.length) : 0;

      const bCompliant = boxCompletedMetrics.filter(p => p.responseTimeMinutes <= 30).length;
      const bComplianceRate = completedBox > 0 ? Math.round((bCompliant / completedBox) * 100) : 100;

      const activeBoxPatients = boxPatients.filter(p => !p.completed);
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
