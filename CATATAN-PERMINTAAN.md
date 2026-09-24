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

## 2. Rantai terapis, pencatat ceklis, dan riwayat pra-antrean

**Diminta:** 25 September 2026
**Status:** SELESAI - commit 946d588, prompt AI Studio sudah diserahkan
**Menunggu:** penerapan di AI Studio dan publish

### Yang dikerjakan

1. **Rantai terapis per kunjungan.** Setiap perpindahan kotak dicatat sebagai satu
   mata rantai. Sebelumnya pemindahan lebih dari sekali membuat terapis di tengah
   hilang permanen.

2. **Pencatat ceklis, aturan B** (ceklis yang BERTAHAN):
   - Diceklis -> tercatat terapis kotak saat itu
   - Dibatalkan -> catatannya ikut dihapus
   - Diceklis lagi oleh terapis lain -> catatannya berpindah
   - Dipindahkan SESUDAH diceklis -> catatannya tidak bergeser

3. **Tombol "Riwayat"** pada laci "Cari & Ambil dari Database" di form Tambah
   Pasien, sehingga riwayat bisa dilihat sebelum pasien diantrekan. Hanya membaca;
   sudah diuji isian form tetap utuh setelah riwayat ditutup.

### Keputusan rancangan - JANGAN diubah tanpa alasan kuat

Pencatatan rantai ada di SISI SERVER, di tempat arsip harian disusun, bukan di
alur pemindahan milik petugas. Alasannya: pemindahan dari perangkat mana pun ikut
tercatat, dan alur kerja harian tidak tersentuh sehingga tidak bisa dirusak oleh
perubahan ini.

Konsekuensinya, `therapistChain` dan `completedBy` HARUS disebut di TIGA tempat
pada `server.ts`: saat arsip disusun, saat kunjungan disimpan dari klien, dan pada
endpoint riwayat. Kalau yang kedua terlewat, rantainya terhapus diam-diam setiap
kali pasien dipindahkan.

### Uji

Ditulis lebih dulu terhadap kode lama: 1/11, dan satu-satunya yang lulus pun lulus
semu. Sesudah perbaikan 11/11. Uji pra-antrean E2E 13/13.

### Berlaku surut atau tidak

- Berlaku surut: kunjungan lama yang terapis awalnya berbeda dari terapis akhir
  tetap menampilkan perpindahan itu.
- TIDAK berlaku surut: rantai penuh dan pencatat ceklis baru terkumpul sejak
  dipasang.

### Catatan untuk pengujian berikutnya

Ada 26 tombol bernama "Riwayat" di halaman utama. Uji E2E yang mencari tombol
berdasarkan teks akan menekan yang salah dan lolos semu. Targetkan lewat atribut
`title`, bukan teks.

---

## 3. Kartu kotak antrean lebih bersih

**Diminta:** 25 September 2026
**Status:** SELESAI - commit 6c8c0a3, prompt AI Studio sudah diserahkan
**Menunggu:** penerapan di AI Studio dan publish

### Yang dikerjakan

Baris judul dikosongkan dari seluruh tombol; semua perintah dikumpulkan ke menu
titik tiga yang dipindah ke pojok kanan bawah kartu. Pegangan geser dibuang atas
persetujuan pemakai - urutan kotak tetap bisa diatur lewat Geser Maju / Geser
Mundur / Pindah ke Paling Depan di dalam menu.

Pin ikut masuk ke menu, dan sebagai gantinya penanda sematan ditampilkan di
sebelah nama kotak. ALIHKAN SIANG hanya muncul kalau kotaknya berisi pasien.

### Tiga jebakan yang ditemukan saat mengerjakan

1. Menu HARUS membuka ke atas (`bottom-full`). Tombolnya di kaki kartu, jadi menu
   yang membuka ke bawah menjulur keluar kartu dan menimpa kotak di bawahnya.
2. Tinggi menu dibatasi `max-h-[70vh] overflow-y-auto`. Sembilan baris menu bisa
   lebih tinggi daripada ruang di atas tombolnya.
3. Tombol menu perlu `ml-auto shrink-0`, kalau tidak ia turun ke baris sendiri dan
   menempel kiri pada kartu yang tombolnya banyak.

### Keputusan: hover TIDAK dipakai

Ditanyakan pemakai, lalu ditolak dengan alasan teknis. Di layar sentuh hover
ditirukan peramban: ketukan pertama hanya memunculkan tombol, ketukan kedua baru
menekannya - kontrol satu ketukan berubah jadi dua, dan status hover tiruannya
sering menempel. Menu titik tiga bekerja sama persis di mouse maupun sentuh.

Kalau suatu saat tetap diinginkan, cara amannya lewat
`@media (hover: hover) and (pointer: fine)` sehingga perangkat sentuh tidak ikut
terpengaruh sama sekali.

### Uji

Uji kerapian ditulis lebih dulu: 0/6 terhadap tampilan lama, 12/12 sesudahnya.
Diperiksa juga lewat tangkapan layar, sebab untuk perubahan tampilan angka uji
saja tidak cukup.

### Catatan untuk pengujian berikutnya

- Label tombol yang berubah menurut keadaan (Sematkan / Lepas Sematan) jangan
  diuji dengan satu teks saja.
- Jangan membandingkan jumlah penanda di kartu dengan jumlah label di menu - menu
  kotak lain belum terbuka sehingga labelnya memang belum ada di halaman.
  Bandingkan dengan keadaan di server.

---

## 4. Fixture uji yang pecah saat melewati tengah malam WIB

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
