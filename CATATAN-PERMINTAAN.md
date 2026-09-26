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

## 4. Menu kotak terpotong batas kartu

**Ditemukan:** 25 September 2026 pagi, oleh pemakai setelah publish
**Status:** SUDAH DIPERBAIKI - commit c4a0ff0, prompt AI Studio sudah diserahkan

### Cacatnya

Elemen akar kartu kotak antrean memakai `overflow-hidden`. Setelah tombol menu
dipindah ke kaki kartu dan menunya dibuat membuka ke atas, menu itu terpotong oleh
batas kartu. Pada kotak KOSONG - kartu terpendek - tiga baris teratasnya hilang
sama sekali: Sematkan Kotak, Edit Judul Kotak, Ubah Warna Kotak.

`max-height` dan `overflow-y-auto` pada menunya TIDAK menolong. Yang memotong bukan
tinggi menu, melainkan batas kartu di luarnya.

### Perbaikannya

Menu digambar lewat `createPortal` ke `document.body` sehingga lepas dari overflow
kartu, lalu diposisikan `fixed` mengikuti letak tombol. Arah bukaan memilih sisi
yang ruangnya lebih lega; tinggi maksimum mengikuti ruang yang tersedia.

Karena menu tidak lagi berada di dalam kartu, penutupnya dipasang sendiri: tekan di
luar menu, gulir halaman, atau ubah ukuran jendela.

JANGAN diganti dengan membuang `overflow-hidden` dari kartu - itu yang menjaga sudut
membulat dan tata letak kartu.

### PELAJARAN PENTING TENTANG PENGUJIAN

Uji tata letak sebelumnya LOLOS padahal layarnya rusak, sebab ia hanya memeriksa
teks menu ADA di DOM. **Teks yang terpotong tetap ada di DOM.**

Untuk apa pun yang menyangkut tampilan, periksa apakah elemennya BENAR-BENAR
TERLIHAT, bukan sekadar ada:

    const r = el.getBoundingClientRect();
    const atasnya = document.elementFromPoint(r.left + r.width/2, r.top + r.height/2);
    const terlihat = atasnya === el || el.contains(atasnya);

Cara ini menangkap pemotongan oleh `overflow` induk, elemen yang tertutup elemen
lain, dan elemen yang keluar layar - tiga hal yang tidak terdeteksi oleh pemeriksaan
teks maupun oleh `isVisible()` biasa.

Gejalanya SEMPAT TERLIHAT pada tangkapan layar pemeriksaan, tetapi salah dinilai
sebagai potongan tangkapan layar. Kalau ada yang tampak terpotong di tangkapan
layar, periksa sungguh-sungguh - jangan dianggap artefak.

---

## 5. INSIDEN 25 September 2026 - 23 kunjungan hilang

**Status:** penyebab ditemukan, dua perlindungan sudah dipasang (commit c0cc66a).
Data yang hilang TIDAK dapat dipulihkan.

### Kronologi

| Waktu WIB | Kejadian |
|---|---|
| 10.13 | Reset ("Bersihkan Antrean") menutup hari sebelumnya - normal |
| 10.14 | Pasien hari ini mulai masuk |
| 13.50.38 | Perubahan papan terakhir yang tercadangkan |
| 13.50.42 | **Pencadangan terakhir yang BERHASIL** - 60 pasien |
| 13.51 | Seluruh pencadangan berhenti. Tidak ada tanda apa pun di layar |
| ~13.51-16.30 | Pasien bertambah 60 -> 83, semuanya tanpa salinan |
| 16.30 | Papan masih menampilkan 83 |
| 16.30-17.04 | Wadah server berganti; keadaan dipulihkan dari salinan 13.50 |
| 17.04 | Papan dan register kembali ke 60. **23 kunjungan hilang** |

### Bukti

- `current_queue.lastMirroredAt` = 13.50.42, `master_patients` = 13.51.27,
  arsip bulanan = **kemarin**. Ketiganya berhenti dalam rentang satu menit ->
  kegagalan menyeluruh, bukan satu dokumen.
- Arsip awan tidak memuat 25 September di **keempat** tempat penyimpanan.
- `/api/deletion-audit` KOSONG - tidak ada yang menghapus. Audit disimpan di disk
  server yang ikut hilang saat wadah berganti; kosongnya audit justru bukti bahwa
  server sudah restart.
- `firestoreMirrorDisabled: false` - tetapi itu server BARU. Penanda kuota
  disimpan di disk dan ikut hilang.

### Penyebab - DIPASTIKAN 26 September (commit 1b910a7)

Pemicunya kuota Firestore bersama yang habis. Tetapi cacat yang membuatnya berakibat
fatal ada di kode, dan sudah ditemukan:

**Dua tempat MEMBUANG arsip yang sedang menunggu dicadangkan.**

1. `flushPendingFirestoreMirrors()` memanggil `pendingDailyArchiveMirrors.clear()`
   setiap kali pencadangan dimatikan karena kuota. Seluruh antrean arsip dibuang,
   sehingga ketika jeda kuota berakhir tidak ada lagi yang tersisa untuk dikirim.
2. `flushArchiveMonthMirrorNow()` langsung `return` saat kuota habis ketika MEMBACA
   cadangan - padahal antreannya sudah dihapus beberapa baris di atas.

Akibatnya arsip harian berhenti tercadangkan sejak **24 September 14.02 WIB**.
Register 25 September (60 kunjungan) TIDAK PERNAH sampai ke awan sama sekali. Karena
itulah kehilangan 23 kunjungan hari itu tidak punya jaring pengaman apa pun.

Diperbaiki: data yang menunggu selalu dikembalikan ke antrean, dan antrean arsip tidak
pernah dikosongkan hanya karena pencadangan sedang dijeda.

**Cacat lapis kedua**: disk server bersifat sementara, sehingga satu-satunya
penyimpanan yang bertahan adalah awan. Ini belum tertutup, dan hanya hilang setelah
pindah ke server dengan penyimpanan permanen.

### Yang sudah dipasang

1. **Keadaan pencadangan dilaporkan apa adanya.** Sebelumnya hanya kegagalan kuota
   yang menyalakan penanda. Sekarang `/api/system/status` mengirim `mirrorHealthy`,
   `mirrorPendingMinutes`, `lastMirrorSuccessAt`, `lastMirrorErrorAt`,
   `lastMirrorError`; spanduk merah tak bisa ditutup muncul setelah 10 menit.
   Ambang 10 menit JANGAN diperkecil - peringatan palsu membuat petugas berhenti
   membaca peringatan.
2. **Pemulihan menggabungkan, bukan menimpa.** `/api/backup/restore` dulu mengganti
   seluruh arsip; memulihkan cadangan lama akan menghapus catatan yang lebih baru.

### Peringatan palsu yang sempat saya buat sendiri

Versi pertama penanda "tertunda" dipasang di baris pertama keempat fungsi
pencadangan. Semuanya punya jalan keluar lebih awal yang sah - misalnya tidak ada
riwayat ranap - dan tandanya tidak pernah dibersihkan, sehingga peringatan bisa
muncul walau papan tercadangkan baik-baik saja.

Diperbaiki: ditandai PER KANAL, hanya kalau memang ada yang menunggu.

Pelajarannya: peringatan palsu melatih orang mengabaikan peringatan. Untuk sesuatu
yang dipasang justru agar dipercaya, ketepatan lebih penting daripada kepekaan.

### Tampilan peringatan

Spanduk merah selebar layar diganti tombol kecil di pojok kanan atas - kuning dan
tenang, berubah merah hanya setelah 30 menit. Alasannya: terapis melihat papan
sepanjang hari tetapi tidak bisa berbuat apa-apa soal pencadangan, dan peringatan
menakutkan yang tidak bisa ditindaklanjuti cepat diabaikan.

### Yang BELUM tertutup

- Perlindungan di atas membuat kegagalan **terlihat**, bukan mencegahnya.
- Belum ada jalur cadangan kedua dengan kuota terpisah (usulan: unggah otomatis ke
  Google Drive; perlu kunci akun layanan, menunggu keputusan pemakai).
- Selama disk server sementara dan kuota berbagi, kejadian ini bisa terulang.

### Untuk laporan supervisor

> Aplikasi berjalan pada wadah sementara yang kehilangan seluruh isinya setiap kali
> berganti. Satu-satunya perlindungan adalah pencadangan ke layanan awan berkuota
> bersama. Ketika kuota itu habis pada 25 September pukul 13.51, sistem terus
> berjalan tanpa salinan selama 2 jam 40 menit tanpa peringatan apa pun, lalu
> kehilangan 23 kunjungan saat wadah berganti.

Ditambah 11 kunjungan yang hilang pada 21 September, totalnya **34 kunjungan hilang
dalam lima hari**. Ini dasar terkuat untuk memindahkan aplikasi ke server rumah
sakit dengan penyimpanan permanen.

### Kebiasaan yang perlu dijalankan sampai pindah

- **Backup Lengkap dua kali sehari** (siang dan sore), simpan ke folder Google Drive
  yang tersinkron. Ini satu-satunya salinan yang tidak bergantung pada kuota
  maupun wadah server.
- Kalau spanduk merah muncul, segera Backup Lengkap - jangan menunggu.

### Catatan: "Bersihkan Antrean" adalah RESET PENUH

Tombol merah di Database Harian memanggil `executeResetAllData` lewat dialog PIN.
Ia mengosongkan papan, menandai seluruh id pasien sebagai dihapus **permanen**
(tombstone yang bertahan antar wadah), serta menghapus log panggilan dan notifikasi.
Arsip harian tetap selamat. Perlu diketahui pemakai - namanya terdengar jauh lebih
ringan daripada yang sebenarnya dilakukannya.

---

## 6. Fixture uji yang pecah saat melewati tengah malam WIB

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

## 26 September 2026 - Pencadangan mati total: panggilan Firestore yang menggantung

**Gejala yang mustahil dibaca:** `/api/system/status` melaporkan
`mirrorHealthy:false`, `mirrorPendingMinutes:48`, tetapi
`lastMirrorSuccessAt:null` **dan** `lastMirrorErrorAt:null`.
Tidak pernah berhasil, tapi juga tidak pernah gagal.

**Akar masalah:** pustaka Firestore tidak punya batas waktu bawaan. Kalau
sambungan tersangkut, `getDoc` mengembalikan janji yang tidak pernah ditepati
maupun diingkari - ia menggantung. Karena setiap penulisan wajib membaca dulu
(baca-gabung-tulis, yang justru dipasang untuk melindungi data), satu pembacaan
yang menggantung memblokir SELURUH pencadangan - antrean, arsip, pasien, ranap -
selamanya dan tanpa suara.

**Perbaikan:** semua 22 panggilan Firestore dibungkus batas waktu 15 detik
(`denganBatasWaktu` + `bacaDoc`/`tulisDoc`/`bacaKoleksi`/`hapusDoc`). Penulisan
foto diberi anggaran sendiri 60 detik karena isinya besar dan wifi rumah sakit
sering lambat - batas 15 detik di sana justru akan menggagalkan unggahan yang sehat.

**Pelajaran uji:** dua harness lama memanggil `getDoc` langsung dan jadi
tertinggal setelah nama pemanggilnya berubah, sehingga `uji_kuota_arsip` jatuh
ke 4/6. Itu lubang harness, BUKAN regresi - terbukti setelah harness-nya diajari
mengambil `const` panah dari sumber asli, kembali 6/6. Pemeriksa tipe juga
menangkap versi pertama pembungkus yang memakai `ref: any` dan menghapus tipe
hasil bacaan; tanda tangannya kini disamakan dengan fungsi asli (`typeof getDoc`).

**Catatan penting:** selama arsip awan belum menerima 25 dan 26 September,
JANGAN bersihkan antrean. Papan antrean adalah satu-satunya jalan pulang data itu.
