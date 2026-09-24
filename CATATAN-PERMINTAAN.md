# Catatan Permintaan

Berkas ini menampung permintaan yang sudah disepakati tetapi belum dikerjakan,
supaya tidak hilang antar sesi.

---

## 1. Riwayat terapis per pasien

**Diminta:** 24 September 2026
**Status:** SELESAI - commit 96dda7d, prompt AI Studio sudah diserahkan
**Menunggu:** penerapan di AI Studio dan publish

### Yang dikerjakan

- `server.ts`: endpoint `GET /api/patient-history?rm=...` mengumpulkan seluruh
  kunjungan satu nomor RM dari arsip harian lintas bulan. Kunjungan dinomori dari
  yang terlama, nomor per disiplin dihitung, dikirim dari yang terbaru.
- `PatientTimelineModal.tsx`: membaca dari endpoint itu; `visitHistory` jadi
  cadangan saja; baris kunjungan karangan DIHAPUS; saat kosong menampilkan
  keterangan jujur.
- `QueueBoxCard.tsx`: nomor RM jadi pemicu modal riwayat, di daftar antrean
  maupun daftar selesai.

Karena sumbernya arsip harian, riwayat LAMA ikut tampil - tidak mulai dari nol.

### Uji

Ditulis lebih dulu, dijalankan terhadap kode lama untuk membuktikan ujinya
menangkap masalah: endpoint 0/1 -> 11/11, tampilan E2E 6/16 -> 16/16. Modal lama
terbukti hanya menampilkan 1 kunjungan dari 6, lengkap dengan baris karangannya.

### Keputusan yang diambil, perlu persetujuan kalau mau diubah

Pemicunya dipasang di **nomor RM**, BUKAN nama pasien seperti yang diminta.
Sebabnya nama pasien sudah dipakai `startEditPatient` - "Edit Data & Tindakan" -
yang dipakai petugas setiap hari.

Kalau tetap ingin di nama pasien, tombol Edit harus dipindah dulu ke tempat lain.
Itu mengubah kebiasaan petugas, jadi perlu diputuskan pemakainya.

### Sisa yang belum bisa dikerjakan

Perpindahan kotak DI DALAM satu kunjungan yang sama tidak pernah disimpan - satu
kunjungan hanya menyimpan `firstOfficerName` dan `officerName`. Kalau rantai
perpindahan ini dibutuhkan, itu pekerjaan terpisah dan hanya berlaku untuk
kunjungan yang akan datang.

---

## 2. Fixture uji yang pecah saat melewati tengah malam WIB

**Ditemukan:** 25 September 2026, dini hari
**Status:** sudah diperbaiki di berkas uji (di luar repositori aplikasi)

`uji_tutup.py` dan `uji_tutup2.py` memberi stempel waktu "1 jam lalu". Kalau uji
dijalankan sekitar pukul 00.30 WIB, stempel itu jatuh ke tanggal kemarin,
sementara arsip yang ditanya adalah tanggal hari ini - jadi hasilnya kosong dan
uji gagal padahal tidak ada yang rusak.

Sudah dipastikan BUKAN regresi: gagal sama persis pada kode HEAD tanpa perubahan.
Aturan "tanggal kunjungan = tanggal pendaftaran" justru bekerja benar.

Pelajaran untuk uji berikutnya: setiap stempel waktu pada fixture harus dipatok
agar tetap berada pada hari WIB yang sama dengan tanggal arsip yang diuji.

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
