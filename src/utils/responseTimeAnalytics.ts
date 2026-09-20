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
  // true kalau ini entri KEDUA dan seterusnya untuk pasien yang sama di kotak yang
  // sama. Terapis sengaja mengantrekan satu pasien lebih dari sekali karena
  // tindakannya banyak, dan itu memang dihitung penuh sebagai beban kerja. Tapi
  // entri tambahan itu BUKAN "pasien yang sedang menunggu dilayani", jadi ia
  // dikecualikan dari rata-rata respon time dan kepatuhan SPM supaya angkanya
  // tidak menggambarkan antrean yang sebenarnya tidak ada.
  isTindakanTambahan?: boolean;
  // Jam saat pasien benar-benar TERSEDIA untuk kotak ini - yaitu setelah tindakannya
  // di kotak lain selesai. Dipakai sebagai batas bawah jam mulai.
  tersediaSejak?: Date;
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

// ---------------------------------------------------------------------------
// Konteks antrean satu hari: hal-hal yang TIDAK bisa diketahui dari satu baris
// antrean saja, melainkan hanya dengan melihat seluruh antrean pasien itu.
//
// Dua keadaan nyata di lapangan yang membuat angka respon time menyesatkan:
//
//  1. Satu pasien diantrekan DUA KALI di KOTAK YANG SAMA karena tindakannya banyak.
//     Itu memang disengaja dan dihitung penuh sebagai beban kerja terapis. Tapi
//     entri kedua bukan "pasien yang menunggu dilayani" - memasukkannya ke
//     rata-rata dan SPM hanya mengotori angka.
//
//  2. Satu pasien diantrekan di DUA KOTAK (mis. fisio dan okupasi). Kotak kedua
//     terpaksa menunggu tindakan di kotak pertama selesai, lalu tercatat lambat -
//     padahal terapisnya tidak lambat sama sekali. Satu pasien tidak bisa berada
//     di dua tempat sekaligus, jadi jam mulai yang adil adalah saat pasien
//     benar-benar TERSEDIA.
// ---------------------------------------------------------------------------
export interface KonteksAntrean {
  // id entri -> jam (epoch ms) saat pasien benar-benar tersedia untuk kotak itu
  tersediaSejak: Map<string, number>;
  // id entri yang merupakan antrean kedua dan seterusnya di kotak yang sama
  tindakanTambahan: Set<string>;
}

// Satu pasien dikenali dari nomor rekam medisnya. Kalau kosong, baru pakai
// patientId, lalu namanya - supaya data lama yang tidak lengkap tetap tertangani.
function kunciPasien(p: PatientItem): string {
  const rm = (p.medicalRecordNo || '').trim().toUpperCase();
  if (rm) return 'RM:' + rm;
  if (p.patientId) return 'PID:' + String(p.patientId);
  return 'NAMA:' + (p.patientName || '').trim().toUpperCase();
}

export function bangunKonteksAntrean(patients: PatientItem[]): KonteksAntrean {
  const tersediaSejak = new Map<string, number>();
  const tindakanTambahan = new Set<string>();

  const grup = new Map<string, PatientItem[]>();
  (patients || []).forEach((p) => {
    if (!p || !p.id) return;
    const k = kunciPasien(p);
    const daftar = grup.get(k) || [];
    daftar.push(p);
    grup.set(k, daftar);
  });

  grup.forEach((entri) => {
    // Pasien yang cuma punya satu antrean tidak terpengaruh sama sekali.
    if (entri.length < 2) return;

    // --- Aturan 1: entri kedua dst di kotak yang SAMA = tindakan tambahan ---
    const perKotak = new Map<string, PatientItem[]>();
    entri.forEach((p) => {
      const daftar = perKotak.get(p.boxId) || [];
      daftar.push(p);
      perKotak.set(p.boxId, daftar);
    });
    perKotak.forEach((daftar) => {
      if (daftar.length < 2) return;
      const urut = [...daftar].sort((a, b) => {
        const ta = new Date(a.createdAt).getTime();
        const tb = new Date(b.createdAt).getTime();
        const va = isNaN(ta) ? 0 : ta;
        const vb = isNaN(tb) ? 0 : tb;
        if (va !== vb) return va - vb;
        // Urutan harus STABIL walau jam inputnya sama persis, supaya entri yang
        // sama selalu dianggap "yang pertama" setiap kali laporan dibuka.
        return String(a.id).localeCompare(String(b.id));
      });
      urut.slice(1).forEach((p) => tindakanTambahan.add(p.id));
    });

    // --- Aturan 2: jam pasien benar-benar tersedia untuk tiap entri ---
    entri.forEach((p) => {
      // Batas akhir entri ini: jam ceklis, atau jam penutupan kalau ia dipindahkan/
      // dihapus tanpa pernah diceklis. WAJIB ikut menghitung endedAt - tanpa itu,
      // entri yang dipindahkan dianggap "belum punya akhir", sehingga tindakan di
      // kotak TUJUAN yang selesai BELAKANGAN malah dikira menahan pasien di kotak
      // ASAL. Akibatnya durasinya runtuh jadi 0 menit, yang jelas keliru.
      const akhirP = p.completedAt
        ? new Date(p.completedAt).getTime()
        : (p.endedAt ? new Date(p.endedAt).getTime() : NaN);
      let tersedia = NaN;
      entri.forEach((q) => {
        if (q.id === p.id) return;
        const akhirQ = q.completedAt ? new Date(q.completedAt).getTime() : NaN;
        if (isNaN(akhirQ)) return;
        // Hanya tindakan yang selesai BENAR-BENAR LEBIH DULU yang menahan pasien.
        // Kalau jamnya sama persis, urutannya tidak bisa dipastikan - dibiarkan
        // apa adanya (perilaku lama) daripada menebak lalu salah menilai.
        if (!isNaN(akhirP) && !(akhirQ < akhirP)) return;
        if (isNaN(tersedia) || akhirQ > tersedia) tersedia = akhirQ;
      });
      if (!isNaN(tersedia)) tersediaSejak.set(p.id, tersedia);
    });
  });

  return { tersediaSejak, tindakanTambahan };
}

export function calculatePatientTimeMetrics(
  patient: PatientItem,
  boxes: QueueBox[],
  now: number = Date.now(),
  clampToServiceStart: boolean = true,
  // Jam saat pasien benar-benar tersedia untuk kotak ini (lihat bangunKonteksAntrean).
  // Kalau tidak diisi, perhitungannya PERSIS seperti sebelumnya - semua pemanggil lama
  // tidak berubah perilakunya sama sekali.
  tersediaSejakMs?: number
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
    let mulai = regTime;
    if (clampToServiceStart && !isNaN(serviceStartTime) && serviceStartTime <= referenceTime) {
      mulai = Math.max(mulai, serviceStartTime);
    }
    // Pasien tidak bisa berada di dua tempat sekaligus. Kalau tindakannya di kotak lain
    // baru selesai jam sekian, kotak ini tidak mungkin mulai sebelum itu - jadi terapis
    // di sini tidak pantas dinilai lambat karena menunggu kotak sebelumnya.
    // Syarat <= referenceTime menjaga agar jam mulai tidak pernah melewati jam acuan
    // akhirnya (yang akan menghasilkan durasi negatif / "Data Tidak Valid" palsu).
    if (typeof tersediaSejakMs === 'number' && !isNaN(tersediaSejakMs) && tersediaSejakMs <= referenceTime) {
      mulai = Math.max(mulai, tersediaSejakMs);
    }
    return mulai;
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
    tersediaSejak: (typeof tersediaSejakMs === 'number' && !isNaN(tersediaSejakMs))
      ? new Date(tersediaSejakMs) : undefined,
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
  const konteks = bangunKonteksAntrean(patients);
  const patientMetrics = patients.map((p) => {
    const m = calculatePatientTimeMetrics(p, boxes, now, true, konteks.tersediaSejak.get(p.id));
    m.isTindakanTambahan = konteks.tindakanTambahan.has(p.id);
    return m;
  });

  const totalPatients = patientMetrics.length;
  // Kunjungan yang sudah ditutup (dipindahkan/dihapus) BUKAN pasien aktif - kalau ikut
  // terhitung, satu pasien yang dipindahkan akan tampak sebagai dua pasien berjalan.
  const activePatientsCount = patientMetrics.filter(p => !p.completed && !p.isEnded).length;
  const completedPatientsCount = patientMetrics.filter(p => p.completed).length;
  const invalidDataCount = patientMetrics.filter(p => p.isDataInvalid).length;

  // Data tidak valid (jam ceklis < jam input, biasanya akibat jam tablet salah/mundur) dikecualikan
  // dari rata-rata, distribusi, dan kepatuhan SPM supaya laporan tidak menyesatkan.
  const completedMetrics = patientMetrics.filter(
    p => p.completed && !p.isDataInvalid && !p.isTindakanTambahan
  );

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

      const boxCompletedMetrics = boxPatients.filter(p => p.completed && !p.isDataInvalid && !p.isTindakanTambahan);

      const bRespList = boxCompletedMetrics.map(p => p.responseTimeMinutes);
      const bAvgResp = bRespList.length > 0 ? Math.round(bRespList.reduce((a, b) => a + b, 0) / bRespList.length) : 0;

      const bCompliant = boxCompletedMetrics.filter(p => p.responseTimeMinutes <= 30).length;
      // Penyebutnya HARUS himpunan yang sama dengan pembilangnya. Dulu memakai
      // completedBox (yang ikut menghitung data tidak valid dan tindakan tambahan),
      // sehingga kepatuhan terlihat lebih rendah dari yang sebenarnya.
      const bComplianceRate = boxCompletedMetrics.length > 0
        ? Math.round((bCompliant / boxCompletedMetrics.length) * 100)
        : 100;

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
