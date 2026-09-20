import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { QueueBox, PatientItem, CallHistoryRecord } from '../types';
import { calculatePatientTimeMetrics, computeResponseTimeAnalytics, bangunKonteksAntrean } from './responseTimeAnalytics';

export interface DailyReportData {
  date: string;
  generatedAt: string;
  boxes: QueueBox[];
  patients: PatientItem[];
  callLogs: CallHistoryRecord[];
}

export function exportToExcel(data: DailyReportData, filename = `Laporan_Antrian_${data.date}.xlsx`) {
  const wb = XLSX.utils.book_new();

  // 1. Sheet Ringkasan (Summary)
  const totalPatients = data.patients.length;
  const completedPatients = data.patients.filter(p => p.completed).length;
  const activePatients = totalPatients - completedPatients;
  const warningPatients = data.patients.filter(p => p.isWarning).length;
  const responseAnalytics = computeResponseTimeAnalytics(data.patients, data.boxes);

  const summaryRows = [
    ['LAPORAN HARIAN ANTRIAN DIGITAL PASIEN'],
    ['Tanggal Laporan', data.date],
    ['Waktu Cetak', data.generatedAt],
    [''],
    ['RINGKASAN STATISTIK'],
    ['Total Pasien Diinput', totalPatients],
    ['Pasien Aktif dalam Antrian', activePatients],
    ['Pasien Selesai Tindakan', completedPatients],
    ['Pasien Kategori Warning (🛑)', warningPatients],
    [''],
    ['ANALISIS RESPON TIME (INPUT HINGGA CEKLIS SELESAI & STANDAR SPM)'],
    ['Rata-rata Respon Time Pasien', `${responseAnalytics.avgResponseMinutes} Menit`],
    ['Tingkat Kepatuhan Standar SPM (<= 30 mnt)', `${responseAnalytics.spmComplianceRate}%`],
    ['Sangat Cepat (<= 15 mnt)', `${responseAnalytics.distribution.fastCount} Pasien (${responseAnalytics.fastRate}%)`],
    ['Standar SPM (16 - 30 mnt)', `${responseAnalytics.distribution.normalCount} Pasien (${responseAnalytics.normalRate}%)`],
    ['Perhatian (31 - 60 mnt)', `${responseAnalytics.distribution.moderateCount} Pasien (${responseAnalytics.moderateRate}%)`],
    ['Keterlambatan (> 60 mnt)', `${responseAnalytics.distribution.delayedCount} Pasien (${responseAnalytics.delayedRate}%)`],
    [''],
    ['RINCIAN PER KOTAK / PETUGAS'],
    ['Nama Kotak', 'Petugas', 'Lokasi', 'Total Pasien', 'Aktif', 'Selesai', 'Avg Respon Time (Mnt)', 'Kepatuhan SPM']
  ];

  responseAnalytics.boxMetrics.forEach(b => {
    summaryRows.push([
      b.boxTitle,
      b.officerName,
      b.location,
      b.totalPatients,
      b.activeCount,
      b.completedCount,
      b.avgResponseMinutes,
      `${b.complianceRate}%`
    ]);
  });

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Ringkasan');

  // 2. Sheet Detail Pasien
  const patientHeaders = [
    'No. Antrean',
    'Nama Pasien',
    'No. RM',
    'Kotak/Ruang',
    'Petugas',
    'Kode Tindakan',
    'Diagnosa/Catatan',
    'Pasien Warning',
    'Status',
    'Jumlah Dipanggil',
    'Waktu Pendaftaran',
    'Waktu Ceklis Selesai',
    'Respon Time (Menit)',
    'Kategori Respon Time',
    'Kepatuhan SPM'
  ];

  const konteksBaris = bangunKonteksAntrean(data.patients);
  const patientRows = data.patients.map(p => {
    const box = data.boxes.find(b => b.id === p.boxId);
    const metrics = calculatePatientTimeMetrics(
      p, data.boxes, Date.now(), true, konteksBaris.tersediaSejak.get(p.id)
    );
    return [
      p.queueNumber,
      p.patientName,
      p.medicalRecordNo,
      box ? box.title : '-',
      box ? (box.officerName && !box.officerName.toLowerCase().startsWith('terapis irm') ? box.officerName : box.title.split('(')[0].trim()) : '-',
      p.actionCode || '-',
      p.diagnosis || p.note || '-',
      p.isWarning ? 'YA (🛑)' : 'TIDAK',
      p.completed ? 'Selesai' : 'Dalam Antrian',
      p.calledCount,
      p.createdAt && !isNaN(new Date(p.createdAt).getTime())
        ? new Date(p.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
        : '-',
      p.completedAt && !isNaN(new Date(p.completedAt).getTime())
        ? new Date(p.completedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
        : '-',
      metrics.responseTimeMinutes,
      metrics.statusLabel,
      metrics.isCompliant ? 'Sesuai SPM (<=30m)' : 'Melebihi SPM (>30m)'
    ];
  });

  const wsPatients = XLSX.utils.aoa_to_sheet([patientHeaders, ...patientRows]);
  XLSX.utils.book_append_sheet(wb, wsPatients, 'Daftar Pasien');

  // 3. Sheet Log Panggilan
  const logHeaders = [
    'Waktu Panggilan',
    'Kotak',
    'No. Antrean',
    'Nama Pasien',
    'No. RM',
    'Petugas Pemanggil',
    'Status Panggilan',
    'Catatan'
  ];

  const logRows = data.callLogs.map(l => [
    new Date(l.calledAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    l.boxTitle,
    l.queueNumber,
    l.patientName,
    l.medicalRecordNo,
    l.officerName,
    l.status === 'completed' ? 'Selesai' : l.status === 'recalled' ? 'Dipanggil Ulang' : 'Dipanggil',
    l.notes || '-'
  ]);

  const wsLogs = XLSX.utils.aoa_to_sheet([logHeaders, ...logRows]);
  XLSX.utils.book_append_sheet(wb, wsLogs, 'Riwayat Panggilan');

  XLSX.writeFile(wb, filename);
}

export function exportToPDF(data: DailyReportData, filename = `Laporan_Antrian_${data.date}.pdf`) {
  const doc = new jsPDF({
    orientation: 'p',
    unit: 'mm',
    format: 'a4'
  });

  // Header Banner
  doc.setFillColor(15, 23, 42); // Slate-900
  doc.rect(0, 0, 210, 26, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('LAPORAN HARIAN ANTRIAN & RESPON TIME PASIEN', 14, 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(203, 213, 225);
  doc.text(`Tanggal Laporan: ${data.date}   |   Dicetak: ${data.generatedAt}   |   Instalasi Rehabilitasi Medis`, 14, 19);

  // Calculate Comprehensive Metrics
  const totalPatients = data.patients.length;
  const completedPatients = data.patients.filter(p => p.completed).length;
  const activePatients = totalPatients - completedPatients;
  const warningPatients = data.patients.filter(p => p.isWarning).length;
  const responseAnalytics = computeResponseTimeAnalytics(data.patients, data.boxes);

  // Summary Metrics Box (6 Columns Grid)
  doc.setFillColor(248, 250, 252); // Slate-50
  doc.rect(14, 30, 182, 18, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.rect(14, 30, 182, 18, 'S');

  const colWidth = 182 / 6;

  // Metric 1: Total
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('TOTAL PASIEN', 14 + 3, 35.5);
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text(`${totalPatients}`, 14 + 3, 43.5);

  // Metric 2: Antri
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('ANTRIAN AKTIF', 14 + colWidth + 3, 35.5);
  doc.setFontSize(12);
  doc.setTextColor(2, 132, 199);
  doc.text(`${activePatients}`, 14 + colWidth + 3, 43.5);

  // Metric 3: Selesai
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('SELESAI', 14 + colWidth * 2 + 3, 35.5);
  doc.setFontSize(12);
  doc.setTextColor(22, 163, 74);
  doc.text(`${completedPatients}`, 14 + colWidth * 2 + 3, 43.5);

  // Metric 4: Avg Respon Time
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('AVG RESPON TIME', 14 + colWidth * 3 + 3, 35.5);
  doc.setFontSize(12);
  doc.setTextColor(79, 70, 229);
  doc.text(`${responseAnalytics.avgResponseMinutes}m`, 14 + colWidth * 3 + 3, 43.5);

  // Metric 5: SPM Kepatuhan
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('SPM (<=30M)', 14 + colWidth * 4 + 3, 35.5);
  doc.setFontSize(12);
  doc.setTextColor(13, 148, 136);
  doc.text(`${responseAnalytics.spmComplianceRate}%`, 14 + colWidth * 4 + 3, 43.5);

  // Metric 6: Warning
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('WARNING (🛑)', 14 + colWidth * 5 + 3, 35.5);
  doc.setFontSize(12);
  doc.setTextColor(220, 38, 38);
  doc.text(`${warningPatients}`, 14 + colWidth * 5 + 3, 43.5);

  // Table 1: Rincian per Kotak / Petugas & Analisis Waktu
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('1. Ringkasan Kinerja per Kotak Antrian & Standar SPM', 14, 54);

  const boxRows = responseAnalytics.boxMetrics.map(b => {
    return [
      b.boxTitle,
      b.officerName,
      b.location,
      `${b.totalPatients}`,
      `${b.activeCount}`,
      `${b.completedCount}`,
      `${b.avgResponseMinutes}m`,
      `${b.complianceRate}%`
    ];
  });

  autoTable(doc, {
    startY: 57,
    head: [['Kotak Antrian', 'Petugas', 'Lokasi', 'Total', 'Aktif', 'Selesai', 'Avg Respon', 'SPM (<=30m)']],
    body: boxRows,
    theme: 'grid',
    headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
    bodyStyles: { fontSize: 7.5, cellPadding: 2 },
    columnStyles: {
      3: { halign: 'center' },
      4: { halign: 'center' },
      5: { halign: 'center' },
      6: { halign: 'center' },
      7: { halign: 'center' }
    }
  });

  // Table 2: Detail Pasien
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lastY = (doc as any).lastAutoTable.finalY + 8;
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('2. Daftar Pasien Hari Ini & Respon Time', 14, lastY);

  const konteksTabel = bangunKonteksAntrean(data.patients);
  const patientTableRows = data.patients.map(p => {
    const box = data.boxes.find(b => b.id === p.boxId);
    const metrics = calculatePatientTimeMetrics(
      p, data.boxes, Date.now(), true, konteksTabel.tersediaSejak.get(p.id)
    );
    return [
      p.queueNumber,
      p.patientName + (p.isWarning ? ' (🛑)' : ''),
      p.medicalRecordNo,
      box ? box.title.split('(')[0].trim() : '-',
      p.actionCode || '-',
      p.completed ? 'Selesai' : 'Antri',
      p.createdAt && !isNaN(new Date(p.createdAt).getTime())
        ? new Date(p.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
        : '-',
      p.completedAt && !isNaN(new Date(p.completedAt).getTime())
        ? new Date(p.completedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
        : '-',
      `${metrics.responseTimeMinutes}m`,
      metrics.isCompliant ? 'Sesuai' : 'Melebihi'
    ];
  });

  autoTable(doc, {
    startY: lastY + 3,
    head: [['No', 'Nama Pasien', 'No. RM', 'Kotak', 'Tindakan', 'Status', 'Daftar', 'Ceklis', 'Respon', 'SPM']],
    body: patientTableRows,
    theme: 'striped',
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontSize: 7.5 },
    bodyStyles: { fontSize: 7.5, cellPadding: 2 },
    columnStyles: {
      0: { halign: 'center', fontStyle: 'bold' },
      5: { halign: 'center' },
      6: { halign: 'center' },
      7: { halign: 'center' },
      8: { halign: 'center' },
      9: { halign: 'center' }
    }
  });

  // Signature block for General Unit Daily Report
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let finalY = (doc as any).lastAutoTable?.finalY || 200;
  if (finalY > 240) {
    doc.addPage();
    finalY = 25;
  } else {
    finalY += 12;
  }

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);

  // Left: Coordinator
  doc.text('Mengetahui,', 20, finalY);
  doc.text('Kepala / Koordinator Instalasi IRM', 20, finalY + 5);
  doc.text('( ............................................................ )', 20, finalY + 26);
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('NIP / ID Petugas', 20, finalY + 30);

  // Right: Person in Charge / Admin
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  doc.text(`Jakarta, ${data.date}`, 140, finalY);
  doc.text('Petugas Pelapor / Verifikator', 140, finalY + 5);
  doc.text('( ............................................................ )', 140, finalY + 26);
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Instalasi Rehabilitasi Medis RSPP', 140, finalY + 30);

  doc.save(filename);
}

export interface TherapistDailyLogbookData {
  date: string;
  therapistName: string;
  boxTitle: string;
  location: string;
  generatedAt: string;
  patients: PatientItem[];
  boxes: QueueBox[];
}

export function exportTherapistDailyPDF(data: TherapistDailyLogbookData, filename?: string) {
  const safeFileName = filename || `Logbook_${data.therapistName.replace(/[^a-zA-Z0-9]/g, '_')}_${data.date}.pdf`;
  const doc = new jsPDF({
    orientation: 'p',
    unit: 'mm',
    format: 'a4'
  });

  // Header Banner
  doc.setFillColor(30, 41, 59); // Slate-800
  doc.rect(0, 0, 210, 28, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('LEMBAR LOGBOOK KINERJA HARIAN TERAPIS IRM', 14, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(226, 232, 240);
  doc.text('Instalasi Rehabilitasi Medis RSPP • Rumah Sakit Pusat Pertamina', 14, 19);
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text(`Dokumen Verifikasi Pelayanan Pasien & Log Tindakan Pribadi  |  Dicetak: ${data.generatedAt}`, 14, 24);

  // Identity Card Box
  doc.setFillColor(248, 250, 252);
  doc.rect(14, 32, 182, 18, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.rect(14, 32, 182, 18, 'S');

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('NAMA TERAPIS', 18, 38);
  doc.text('RUANG / POS', 90, 38);
  doc.text('TANGGAL TUGAS', 150, 38);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(data.therapistName, 18, 45);
  doc.setFontSize(9);
  doc.text(`${data.boxTitle} (${data.location})`, 90, 45);
  doc.text(data.date, 150, 45);

  // Summary Metrics Box
  const total = data.patients.length;
  const completed = data.patients.filter(p => p.completed).length;
  const active = total - completed;
  const ranap = data.patients.filter(p => p.isRanap).length;
  const rajal = total - ranap;

  let totalWait = 0;
  let compliantCount = 0;
  let countWithWait = 0;

  // Aturan yang sama dengan layar Respon Time: jam mulai menghormati saat pasien
  // benar-benar tersedia, dan tindakan tambahan (antrean kedua di kotak yang sama)
  // tidak ikut dihitung. Tanpa ini, angka di Excel akan berbeda dari angka di layar.
  const konteksRingkasan = bangunKonteksAntrean(data.patients);
  data.patients
    .filter(p => p.completed && !konteksRingkasan.tindakanTambahan.has(p.id))
    .forEach(p => {
      const metrics = calculatePatientTimeMetrics(
        p, data.boxes, Date.now(), true, konteksRingkasan.tersediaSejak.get(p.id)
      );
      if (metrics.isDataInvalid) return;
      totalWait += metrics.responseTimeMinutes;
      countWithWait++;
      if (metrics.isCompliant) compliantCount++;
    });

  const avgWait = countWithWait > 0 ? Math.round(totalWait / countWithWait) : 0;
  const compliance = countWithWait > 0 ? Math.round((compliantCount / countWithWait) * 100) : 100;

  doc.setFillColor(238, 242, 255); // Indigo-50
  doc.rect(14, 53, 182, 14, 'F');
  doc.setDrawColor(199, 210, 254);
  doc.rect(14, 53, 182, 14, 'S');

  const mWidth = 182 / 5;
  const metricsItems = [
    { label: 'TOTAL PASIEN', val: `${total}` },
    { label: 'SELESAI TINDAKAN', val: `${completed}` },
    { label: 'RANAP / RAJAL', val: `${ranap} / ${rajal}` },
    { label: 'AVG RESPON TIME', val: `${avgWait} Menit` },
    { label: 'KEPATUHAN SPM', val: `${compliance}%` },
  ];

  metricsItems.forEach((m, idx) => {
    const x = 14 + idx * mWidth + 4;
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(99, 102, 241);
    doc.text(m.label, x, 58);
    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 27, 75);
    doc.text(m.val, x, 64);
  });

  // Table of Patients
  const konteksPdf = bangunKonteksAntrean(data.patients);
  const patientRows = data.patients.map((p, idx) => {
    const metrics = calculatePatientTimeMetrics(
      p, data.boxes, Date.now(), true, konteksPdf.tersediaSejak.get(p.id)
    );
    const regTime = p.createdAt && !isNaN(new Date(p.createdAt).getTime())
      ? new Date(p.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
      : '-';
    const compTime = p.completedAt && !isNaN(new Date(p.completedAt).getTime())
      ? new Date(p.completedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
      : '-';

    return [
      idx + 1,
      p.queueNumber,
      p.patientName + (p.isRanap ? ' [Ranap]' : '') + (p.isWarning ? ' [!]' : ''),
      p.medicalRecordNo,
      p.actionCode || '-',
      p.diagnosis || p.note || '-',
      p.completed ? 'Selesai' : 'Antre',
      regTime,
      compTime,
      `${metrics.responseTimeMinutes}m`,
      metrics.isCompliant ? 'Sesuai' : 'Melebihi'
    ];
  });

  autoTable(doc, {
    startY: 71,
    head: [['No', 'Antrean', 'Nama Pasien', 'No. RM', 'Tindakan', 'Diagnosa', 'Status', 'Masuk', 'Selesai', 'Respon', 'SPM']],
    body: patientRows.length > 0 ? patientRows : [['-', '-', 'Belum ada pasien terdaftar untuk terapis ini.', '-', '-', '-', '-', '-', '-', '-', '-']],
    theme: 'grid',
    headStyles: { fillColor: [49, 46, 129], textColor: [255, 255, 255], fontSize: 7.5, fontStyle: 'bold' },
    bodyStyles: { fontSize: 7, cellPadding: 2 },
    columnStyles: {
      0: { halign: 'center', cellWidth: 8 },
      1: { halign: 'center', fontStyle: 'bold', cellWidth: 14 },
      2: { cellWidth: 32 },
      3: { cellWidth: 16 },
      4: { cellWidth: 18 },
      6: { halign: 'center', cellWidth: 14 },
      7: { halign: 'center', cellWidth: 13 },
      8: { halign: 'center', cellWidth: 13 },
      9: { halign: 'center', cellWidth: 14 },
      10: { halign: 'center', cellWidth: 14 }
    }
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let tLastY = (doc as any).lastAutoTable?.finalY || 200;
  if (tLastY > 235) {
    doc.addPage();
    tLastY = 25;
  } else {
    tLastY += 12;
  }

  // Official Signatures
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);

  doc.text('Mengetahui,', 20, tLastY);
  doc.text('Koordinator / Kepala Instalasi IRM', 20, tLastY + 5);
  doc.text('( ............................................................ )', 20, tLastY + 25);
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('NIP / ID Petugas', 20, tLastY + 29);

  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  doc.text(`Jakarta, ${data.date}`, 135, tLastY);
  doc.text('Terapis Pelaksana,', 135, tLastY + 5);
  doc.setFont('helvetica', 'bold');
  doc.text(`( ${data.therapistName} )`, 135, tLastY + 25);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`Pos Layanan: ${data.boxTitle}`, 135, tLastY + 29);

  doc.save(safeFileName);
}

export function exportTherapistDailyExcel(data: TherapistDailyLogbookData, filename?: string) {
  const safeFileName = filename || `Logbook_${data.therapistName.replace(/[^a-zA-Z0-9]/g, '_')}_${data.date}.xlsx`;
  const wb = XLSX.utils.book_new();

  // 1. Sheet Ringkasan
  const total = data.patients.length;
  const completed = data.patients.filter(p => p.completed).length;
  const active = total - completed;
  const ranap = data.patients.filter(p => p.isRanap).length;
  const rajal = total - ranap;

  let totalWait = 0;
  let compliantCount = 0;
  let countWithWait = 0;

  // Aturan yang sama dengan layar Respon Time: jam mulai menghormati saat pasien
  // benar-benar tersedia, dan tindakan tambahan (antrean kedua di kotak yang sama)
  // tidak ikut dihitung. Tanpa ini, angka di Excel akan berbeda dari angka di layar.
  const konteksRingkasan = bangunKonteksAntrean(data.patients);
  data.patients
    .filter(p => p.completed && !konteksRingkasan.tindakanTambahan.has(p.id))
    .forEach(p => {
      const metrics = calculatePatientTimeMetrics(
        p, data.boxes, Date.now(), true, konteksRingkasan.tersediaSejak.get(p.id)
      );
      if (metrics.isDataInvalid) return;
      totalWait += metrics.responseTimeMinutes;
      countWithWait++;
      if (metrics.isCompliant) compliantCount++;
    });

  const avgWait = countWithWait > 0 ? Math.round(totalWait / countWithWait) : 0;
  const compliance = countWithWait > 0 ? Math.round((compliantCount / countWithWait) * 100) : 100;

  const summaryRows: (string | number)[][] = [
    ['LOGBOOK KINERJA HARIAN TERAPIS IRM RSPP'],
    ['Nama Terapis', data.therapistName],
    ['Ruang / Pos', `${data.boxTitle} (${data.location})`],
    ['Tanggal Pelayanan', data.date],
    ['Waktu Cetak', data.generatedAt],
    [''],
    ['RINGKASAN STATISTIK PELAYANAN PRIBADI'],
    ['Total Pasien', total],
    ['Pasien Selesai Tindakan', completed],
    ['Pasien Masih Dalam Antrian', active],
    ['Pasien Rawat Inap (Ranap)', ranap],
    ['Pasien Rawat Jalan (Rajal)', rajal],
    ['Rata-rata Waktu Respon', `${avgWait} Menit`],
    ['Kepatuhan Standar SPM (<= 30 Menit)', `${compliance}%`],
  ];

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Ringkasan');

  // 2. Sheet Detail Tindakan
  const detailHeaders = [
    'No',
    'No. Antrean',
    'Nama Pasien',
    'No. RM',
    'Kode Tindakan',
    'Diagnosa Klinis / Catatan',
    'Tipe Pasien',
    'Status Pelayanan',
    'Jam Pendaftaran',
    'Jam Selesai Tindakan',
    'Respon Time (Menit)',
    'Kepatuhan SPM (<= 30m)'
  ];

  const konteksDetail = bangunKonteksAntrean(data.patients);
  const detailRows = data.patients.map((p, idx) => {
    const metrics = calculatePatientTimeMetrics(
      p, data.boxes, Date.now(), true, konteksDetail.tersediaSejak.get(p.id)
    );
    const regTime = p.createdAt && !isNaN(new Date(p.createdAt).getTime())
      ? new Date(p.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
      : '-';
    const compTime = p.completedAt && !isNaN(new Date(p.completedAt).getTime())
      ? new Date(p.completedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
      : '-';

    return [
      idx + 1,
      p.queueNumber,
      p.patientName,
      p.medicalRecordNo,
      p.actionCode || '-',
      p.diagnosis || p.note || '-',
      p.isRanap ? 'Rawat Inap (Ranap)' : 'Rawat Jalan (Rajal)',
      p.completed ? 'Selesai' : 'Dalam Antrian',
      regTime,
      compTime,
      metrics.responseTimeMinutes,
      metrics.isCompliant ? 'Sesuai SPM' : 'Melebihi SPM'
    ];
  });

  const wsDetail = XLSX.utils.aoa_to_sheet([detailHeaders, ...detailRows]);
  XLSX.utils.book_append_sheet(wb, wsDetail, 'Log Tindakan Pasien');

  XLSX.writeFile(wb, safeFileName);
}

export interface MonthlyTherapistGroup {
  therapistName: string;
  boxId: string;
  boxTitle: string;
  location: string;
  patients: PatientItem[];
  actionCounts: { [code: string]: number };
  ranapCount: number;
  rajalCount: number;
}

export interface MonthlyReportData {
  monthYearFormatted: string;
  year: number;
  month: number;
  generatedAt: string;
  therapistGroups: MonthlyTherapistGroup[];
  totalPatientsCount: number;
  totalRanapCount: number;
  totalRajalCount: number;
}

export function exportMonthlyTherapistPDF(data: MonthlyReportData, filename = `Laporan_Bulanan_Terapis_${data.year}_${data.month}.pdf`) {
  const doc = new jsPDF({
    orientation: 'p',
    unit: 'mm',
    format: 'a4'
  });

  // Header Banner
  doc.setFillColor(15, 118, 110); // Teal-700
  doc.rect(0, 0, 210, 28, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('LAPORAN BULANAN KINERJA TERAPIS & PENANGGULANGAN PASIEN', 14, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Periode: ${data.monthYearFormatted} | Dicetak: ${data.generatedAt}`, 14, 20);

  // Executive Metrics Card
  doc.setFillColor(240, 253, 250); // Teal-50
  doc.rect(14, 34, 182, 22, 'F');
  doc.setDrawColor(204, 251, 241);
  doc.rect(14, 34, 182, 22, 'S');

  const colW = 182 / 3;

  // Metric 1: Total Pasien Selesai
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 118, 110);
  doc.text('TOTAL PASIEN SELESAI', 14 + 6, 42);
  doc.setFontSize(14);
  doc.setTextColor(19, 78, 74);
  doc.text(`${data.totalPatientsCount} Pasien`, 14 + 6, 50);

  // Metric 2: Ranap
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 64, 175);
  doc.text('TINDAKAN PASIEN RANAP', 14 + colW + 6, 42);
  doc.setFontSize(14);
  doc.setTextColor(29, 78, 216);
  doc.text(`${data.totalRanapCount} Pasien`, 14 + colW + 6, 50);

  // Metric 3: Rajal
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(51, 65, 85);
  doc.text('TINDAKAN PASIEN RAJAL', 14 + colW * 2 + 6, 42);
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text(`${data.totalRajalCount} Pasien`, 14 + colW * 2 + 6, 50);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let currentY = 64;

  data.therapistGroups.forEach((group, index) => {
    // Check space for therapist block
    if (currentY > 250) {
      doc.addPage();
      currentY = 20;
    }

    // Therapist Header Box
    doc.setFillColor(30, 41, 59); // Slate-800
    doc.rect(14, currentY, 182, 9, 'F');

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(`${index + 1}. Terapis / Petugas: ${group.therapistName.toUpperCase()}`, 17, currentY + 6);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Ruangan: ${group.boxTitle} | Total: ${group.patients.length} Pasien (Ranap: ${group.ranapCount}, Rajal: ${group.rajalCount})`, 105, currentY + 6);

    currentY += 12;

    const patientRows = group.patients.map((p, pIdx) => {
      const completedTime = p.completedAt
        ? new Date(p.completedAt).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
        : new Date(p.createdAt).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

      return [
        `${pIdx + 1}`,
        completedTime,
        p.queueNumber,
        p.patientName + (p.isWarning ? ' (🛑)' : ''),
        p.medicalRecordNo,
        p.actionCode || '-',
        p.diagnosis || p.note || '-',
        p.isRanap ? 'RANAP (🛏️)' : 'RAJAL'
      ];
    });

    if (patientRows.length === 0) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(100, 116, 139);
      doc.text('Tidak ada pasien yang selesai pada bulan ini.', 18, currentY);
      currentY += 10;
    } else {
      autoTable(doc, {
        startY: currentY,
        head: [['No', 'Waktu Selesai', 'No. Antri', 'Nama Pasien', 'No. RM', 'Tindakan', 'Diagnosa / Catatan', 'Status']],
        body: patientRows,
        theme: 'striped',
        headStyles: { fillColor: [15, 118, 110], textColor: [255, 255, 255], fontSize: 8 },
        styles: { fontSize: 7, cellPadding: 1.5 },
        margin: { left: 14, right: 14 }
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      currentY = (doc as any).lastAutoTable.finalY + 8;
    }
  });

  doc.save(filename);
}

export function exportMonthlyTherapistExcel(data: MonthlyReportData, filename = `Laporan_Bulanan_Terapis_${data.year}_${data.month}.xlsx`) {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Ringkasan per Terapis
  const summaryRows: (string | number)[][] = [
    ['LAPORAN BULANAN KINERJA TERAPIS & PENANGGULANGAN PASIEN'],
    ['Periode', data.monthYearFormatted],
    ['Tanggal Cetak', data.generatedAt],
    [''],
    ['STATISTIK KELOMPOK TERAPIS'],
    ['Nama Terapis', 'Ruangan / Kotak', 'Lokasi', 'Total Selesai', 'Pasien Ranap', 'Pasien Rajal', 'Rincian Kode Tindakan']
  ];

  data.therapistGroups.forEach(g => {
    const actionCodesSummary = Object.entries(g.actionCounts)
      .map(([code, count]) => `${code}: ${count}`)
      .join(', ');

    summaryRows.push([
      g.therapistName,
      g.boxTitle,
      g.location,
      g.patients.length,
      g.ranapCount,
      g.rajalCount,
      actionCodesSummary || '-'
    ]);
  });

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Ringkasan Terapis');

  // Sheet 2: Detail Seluruh Pasien Bulanan
  const detailHeaders = [
    'No',
    'Terapis / Petugas',
    'Ruangan',
    'Waktu Selesai',
    'No. Antrean',
    'Nama Pasien',
    'No. RM',
    'Kode Tindakan',
    'Diagnosa / Catatan',
    'Tipe Pasien (Ranap/Rajal)',
    'Warning Flag'
  ];

  const detailRows: (string | number)[][] = [];
  let index = 1;

  data.therapistGroups.forEach(g => {
    g.patients.forEach(p => {
      const completedTime = p.completedAt
        ? new Date(p.completedAt).toLocaleString('id-ID')
        : new Date(p.createdAt).toLocaleString('id-ID');

      detailRows.push([
        index++,
        g.therapistName,
        g.boxTitle,
        completedTime,
        p.queueNumber,
        p.patientName,
        p.medicalRecordNo,
        p.actionCode || '-',
        p.diagnosis || p.note || '-',
        p.isRanap ? 'RANAP' : 'RAJAL',
        p.isWarning ? 'YA' : 'TIDAK'
      ]);
    });
  });

  const wsDetail = XLSX.utils.aoa_to_sheet([detailHeaders, ...detailRows]);
  XLSX.utils.book_append_sheet(wb, wsDetail, 'Detail Pasien Bulanan');

  XLSX.writeFile(wb, filename);
}

