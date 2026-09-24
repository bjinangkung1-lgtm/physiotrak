# Catatan Permintaan

Berkas ini menampung permintaan yang sudah disepakati tetapi belum dikerjakan,
supaya tidak hilang antar sesi.

---

## 1. Riwayat terapis per pasien

**Diminta:** 24 September 2026
**Status:** tampilannya sudah ada, DATANYA yang tidak sampai
**Bukti:** pasien RM 283139 - header "Total Kunjungan: 7x", tetapi daftar
riwayatnya hanya menampilkan 1 baris

### Yang diminta

Klik nama pasien -> muncul riwayat kunjungan pertama hingga terakhir, beserta
terapis yang mengerjakan tiap kunjungan.

### Temuan A - riwayat tidak pernah sampai ke modal

`PatientTimelineModal` membaca riwayat dari satu tempat saja:
`masterPatient.visitHistory`.

Field itu **hanya diisi di sisi klien** (`src/App.tsx:1601-1632`, saat pasien
didaftarkan). Di `server.ts` kata `visitHistory` **tidak muncul sama sekali** -
server tidak pernah menyimpan, menggabungkan, atau mengembalikannya.

Akibatnya riwayat itu tidak bertahan: tidak tersimpan di server, tidak menyeberang
antar perangkat, dan hilang begitu data master disegarkan dari server.

Yang ganjil pada tampilan RM 283139 menegaskan ini: kartu 1st PJ tahu ada
Okupasi (Cecep, 14 Sep) dan Wicara (Monalisa, 14 Sep), tetapi keduanya tidak ada
di daftar - sebab kartu itu dihitung dari sumber lain
(`getPatientMultiDisciplineSummary`), bukan dari `visitHistory`.

### Temuan B - baris riwayat PALSU saat data kosong (PENTING)

`PatientTimelineModal.tsx` baris 59-70: kalau `visitHistory` kosong, modal
**mengarang satu baris kunjungan** dari `firstVisitDate` + `firstOfficerName`,
diberi catatan "Kedatangan / Kunjungan Awal Terapi Pasien" dan diagnosa dari
`defaultDiagnosis`.

Baris itu tampil persis seperti catatan kunjungan sungguhan - bertanggal,
bernama terapis, berdiagnosa - padahal bukan rekaman kejadian. Pada konteks
rekam medis ini berbahaya: petugas bisa membacanya sebagai riwayat asli.

Baris karangan inilah yang terlihat pada RM 283139, bukan data sebenarnya.

**Perbaikan minimal yang harus ikut dikerjakan:** kalau riwayat kosong, tampilkan
keterangan "riwayat belum tersedia" - jangan mengarang baris.

### Usul cara mengerjakan

Jangan menambal `visitHistory`. Sumber yang benar sudah ada: **arsip harian**
menyimpan tiap kunjungan lengkap dengan `medicalRecordNo`, `officerName`,
`boxTitle`, `visitDate`, `diagnosis`, dan `actionCode`.

Usulnya: endpoint baru yang mengumpulkan seluruh kunjungan satu nomor RM dari
arsip harian, lalu modal membaca dari situ.

Keunggulannya - riwayat **lama langsung ikut tampil**, termasuk 7 kunjungan
RM 283139 itu, tanpa menunggu data baru terkumpul. Menambal `visitHistory` hanya
akan berlaku untuk kunjungan yang akan datang.

### Yang tetap tidak bisa ditampilkan

Perpindahan kotak **di dalam satu kunjungan yang sama** tidak pernah disimpan -
satu kunjungan hanya menyimpan `firstOfficerName` dan `officerName`. Riwayat
antar kunjungan tidak terpengaruh.

### Pekerjaan kecil yang menyusul

Nama pasien belum menjadi pemicu modal. Pemicunya sekarang lencana kecil
`1st: <Nama>` / `K-3` di `QueueBoxCard.tsx` baris 1259, 1274, 1657, 1670.

---

## Sudah selesai, tinggal catatan

- Kalau suatu hari ada stempel waktu yang disimpan sebagai tipe `Timestamp`
  Firestore (bukan string ISO), fungsi `buangUndefined` di `server.ts` perlu
  dikecualikan untuk tipe itu - objek `Timestamp` akan diratakan jadi `{}`.
  Sekarang belum ada satu pun, jadi belum perlu.

## Belum dikerjakan, sudah pernah ditawarkan

- Membuat kegagalan pencadangan **terlihat**. Sekarang `handleFirestoreQuotaError`
  hanya menyalakan tanda untuk error kuota; error jenis lain cuma masuk log, jadi
  `/api/system/status` tetap menjawab sehat padahal pencadangan mati.
- Membersihkan baris ganda di dua tanggal (perlu cadangan dan persetujuan dulu).
- Mengarsipkan riwayat log panggilan sebelum dibersihkan.
- 28 baris data uji yang masih tersisa di register 20 September.
