# Catatan Permintaan

Berkas ini menampung permintaan yang sudah disepakati tetapi belum dikerjakan,
supaya tidak hilang antar sesi.

---

## 1. Riwayat terapis per pasien

**Diminta:** 24 September 2026
**Status:** SEBAGIAN BESAR SUDAH ADA - tinggal pemicunya

### Yang diminta

Klik nama pasien -> muncul riwayat dari kunjungan pertama hingga terakhir,
beserta terapis yang mengerjakan tiap kunjungan.

### Yang SUDAH ada (sudah diperiksa di kode)

`src/components/PatientTimelineModal.tsx` (492 baris) sudah menampilkan persis itu:

- Daftar kunjungan berurutan waktu, terbaru di atas
- Tiap kunjungan mencantumkan **nama terapis** (`v.officerName`), kotak terapi,
  dan disiplinnya (fisio / okupasi / wicara)
- Penanda **1st PJ (Terapis Awal)** per disiplin dan penanda kunjungan terakhir
- Penyaringan per disiplin, lengkap dengan jumlah kunjungan tiap disiplin
- Tombol "Arahkan Antrean ke terapis ini"

Jadi riwayatnya sudah lengkap dan sudah berjalan.

### Yang KURANG - hanya satu hal

Modal itu **tidak terbuka dari nama pasien**. Pemicunya ada di
`src/components/QueueBoxCard.tsx` baris 1259, 1274, 1657, 1670 - semuanya
menempel pada lencana kecil bertuliskan `1st: <Nama>` dan `K-3`.

Lencana itu kecil dan tidak terlihat seperti sesuatu yang bisa ditekan, jadi
wajar kalau tidak diketahui. Nama pasien sendiri belum menjadi pemicu.

### Pekerjaan yang perlu dilakukan

Membuat nama pasien ikut memanggil `setSelectedPatientForTimeline(patient)`,
dengan tanda visual bahwa nama itu bisa ditekan.

Perlu diperiksa saat mengerjakan:
- Jangan sampai bentrok dengan tindakan lain yang sudah menempel pada nama
  pasien (kalau ada) - terutama pada layar sentuh
- Empat titik pemicu lama tetap dipertahankan, jangan dihapus

### Yang benar-benar TIDAK bisa ditampilkan

Kalau pasien berpindah kotak lebih dari sekali **dalam satu kunjungan yang sama**,
terapis di tengah tidak pernah disimpan - satu kunjungan hanya menyimpan
`firstOfficerName` dan `officerName`. Riwayat antar kunjungan tidak terpengaruh
oleh keterbatasan ini.

Perlu ditanyakan: apakah rantai perpindahan dalam satu kunjungan juga dibutuhkan?
Kalau ya, itu pekerjaan terpisah dan hanya berlaku untuk kunjungan ke depan.

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
