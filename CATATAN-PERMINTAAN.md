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

## 5. Fixture uji yang pecah saat melewati tengah malam WIB

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

## 6. Header ringkas - area kotak antrean diperluas

**Diminta:** 25 September 2026
**Status:** SELESAI - commit c352eef, prompt AI Studio sudah diserahkan
**Menunggu:** penerapan di AI Studio dan publish

### Masalahnya

Header memakan 209 px dari 589 px tinggi layar tablet (35%), dan karena menempel
di atas, ruang itu tetap hilang walau halaman digulir. Isinya 4 baris: judul,
11 tombol, tombol divisi, dan pencarian.

### Susunan baru (rancangan pemakai)

- Kiri: tombol cari dan Fisio / Okupasi / Wicara
- Tengah: logo Smart IRM RSPP, menonjol 14 px ke bawah dari tepi atas layar saat
  halaman di puncak, merapat ke bilah saat digulir
- Kanan: Semua / Menunggu / Selesai / Warning - tetap tombol saringan
- Tab menu di tepi kiri layar, hanya tampil sebagian, membuka sidebar

Tinggi header: tablet 209 -> 55 px, HP 186 -> 100 px.

### Ke mana tombol-tombol lama

| Tombol | Sekarang di |
|---|---|
| Menu | Tab tepi kiri (lg ke atas); di bawah lg tetap di bilah bawah HP |
| + Pasien, + Kotak | Jendela Database, setelah password database dimasukkan |
| Display TV, Riwayat, Link Aplikasi, Notifikasi | Aksi cepat di atas sidebar |
| Ganti Password, Kunci/Logout | Kartu petugas di bawah sidebar |
| SOP Word | Sudah ada di sidebar, jadi cukup dihapus dari header |
| MENUNGGU / DIPANGGIL | Digabung ke tombol saringan |
| Kembali ke Kotak Antrean | Dihapus; halaman analitik punya tombol "← Kotak Antrean" sendiri |

+ Pasien di bilah bawah HP TIDAK dipindah, atas permintaan pemakai.

### Keputusan - JANGAN diubah tanpa alasan kuat

1. **MENUNGGU/DIPANGGIL identik dengan Aktif/Selesai.** Angkanya dihitung dengan
   rumus yang sama dengan syarat saringan `active`/`completed` di `App.tsx`.
   Menampilkan keduanya berdampingan hanya mengulang angka yang sama.

2. **Label "Dipanggil" selama ini KELIRU.** Menekan tombol panggil hanya menambah
   `calledCount` dan `lastCalledAt`; ia TIDAK menandai pasien selesai. Angka
   "Dipanggil" baru naik ketika pasien DICEKLIS. Pasien yang sudah dipanggil ke TV
   tetapi belum diceklis tetap terhitung Menunggu. Karena itu labelnya "Selesai".
   Kalau suatu saat ingin hitungan "sudah dipanggil tapi belum diceklis"
   (`calledCount > 0 && !completed`), itu angka BARU, bukan sekadar ganti label.

3. **+ Pasien dan + Kotak hanya ada di Database**, yang dikunci password database.
   Petugas tanpa password tetap bisa menambah pasien lewat "Tambah Item" di tiap
   kotak - form yang sama, kotak tujuannya sudah terisi.

4. **Klik + Pasien / + Kotak di Database MENUTUP jendela Database dulu.** Ketiga
   jendela memakai `z-50`, dan Database digambar paling akhir di `App.tsx`. Kalau
   Database dibiarkan terbuka, form tambah muncul di BELAKANGNYA.

5. **Tab menu di tepi kiri dipasang di `App.tsx`, bukan di dalam header.** Elemen
   `fixed` di dalam induk yang memakai `backdrop-filter` menempel ke induk itu,
   bukan ke layar.

6. **Muat di lebar 1024 px pas-pasan.** Separuh kiri header di 1024 px persis
   375 px. Ikon divisi dan label PRO baru tampil mulai 1280 px (`xl`), padding
   header `lg:px-6`. Kalau menambah apa pun ke header, ukur ulang di 1024 px.

### Jebakan yang ditemukan

- **`npm run lint` TIDAK memeriksa props komponen.** `@types/react` tidak terpasang,
  sehingga JSX bertipe `any` dan prop salah nama lolos diam-diam. Cara memeriksa:
  salin `@types/react` dan `@types/react-dom` sementara ke `node_modules/@types`
  (jangan disimpan ke `package.json`), jalankan `npx tsc --noEmit`, lalu bandingkan
  dengan hasil sebelum perubahan. Saat ini ada 8 error lama yang bukan dari
  perubahan ini.
- **Uji E2E: `page.goto(..., { waitUntil: 'networkidle' })` tidak pernah selesai**
  di aplikasi ini karena ada permintaan berkala. Pakai `'load'`, lalu tunggu
  `header h1`.
- **Banner "Status:" diberi `capitalize` oleh CSS**, jadi `innerText` mengembalikan
  "Active", bukan "active". Bandingkan tanpa peduli huruf besar-kecil.
- **Isi sidebar bisa digulir.** Butir paling bawah (SOP) berada di luar layar
  sampai digulir; periksa keterlihatannya sesudah `scrollIntoView`.

### Id tombol

Id lama dipertahankan di tempat barunya supaya uji yang menarget id tetap
menemukan tombolnya: `btn-toggle-menu-sidebar` (tab tepi kiri), `btn-open-tv`,
`btn-global-history`, `btn-general-qr`, `btn-header-notifications`,
`btn-header-change-password`, `btn-header-lock` (sidebar), `btn-add-patient`,
`btn-add-box` (Database, hanya setelah dibuka). Yang hilang: `btn-mobile-menu`,
`btn-open-sop-word`. Yang baru: `btn-header-search`.

### Uji

Uji E2E dijalankan pada salinan aplikasi dengan konfigurasi Firebase palsu, jadi
database produksi tidak tersentuh. Setiap elemen diperiksa BENAR-BENAR TERLIHAT
lewat `elementFromPoint`, bukan sekadar ada di DOM (lihat bagian 4).

- Tata letak dan alur (lebar 390, 800, 1024, 1066, 1280): 84/84. Terhadap kode
  lama, bagian tata letaknya hanya 32/49 - ujinya memang menangkap masalahnya.
- Data sungguhan (tambah pasien, saringan, cari, ceklis): 8/8.
- Notifikasi di sidebar (lencana di tab dan tile, daftar, fokus ke kotak, Hapus
  Semua): 9/9. Notifikasinya diisi lewat pintu uji yang hanya dipasang di
  salinan, sebab sinkronisasi antarperangkat lewat Firestore diputus.
- Pemeriksaan tipe dengan `@types/react` sementara: 8 error, sama persis dengan
  sebelum perubahan. `npm run lint` dan `vite build` lulus.

### Perilaku lama yang ditemukan, TIDAK diubah

- Notifikasi pasien dari perangkat lain hanya menaikkan angka lencana
  (`App.tsx`, bagian `newRemotePatients`): objek `arrivalNotif` dibuat tetapi
  tidak pernah dimasukkan ke daftar. Pasien yang ditambah dari perangkat sendiri
  tidak menaikkan lencana sama sekali. Sama persis di kode lama.
- Saringan Selesai menampilkan kotak dengan bagian "n Item Selesai" yang
  terlipat, bukan nama pasiennya langsung.
- Di layar lebar, butir menu sidebar seperti Database Pasien tidak menutup
  sidebar (`handleActionClick` hanya menutup di bawah 1024 px).

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
