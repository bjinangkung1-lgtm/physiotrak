# Catatan Permintaan

Berkas ini menampung permintaan yang sudah disepakati tetapi belum dikerjakan,
supaya tidak hilang antar sesi.

---

## 1. Riwayat terapis per pasien

**Diminta:** 24 September 2026
**Status:** belum dikerjakan

### Yang diminta

Pencatatan riwayat: seorang pasien pernah dikerjakan oleh terapis siapa saja.

### Keadaan sekarang (sudah diperiksa)

Satu kunjungan hanya menyimpan **dua** nama terapis:

| Field | Isi |
|---|---|
| `firstOfficerName` | terapis pertama yang menangani |
| `officerName` | terapis terakhir yang menangani |
| `firstBoxTitle` / `boxTitle` | kotak pertama dan kotak terakhir |

Artinya kalau pasien berpindah kotak lebih dari sekali dalam satu kunjungan,
**terapis di tengah tidak tercatat sama sekali** - hanya yang pertama dan yang
terakhir yang tersimpan. Rantai perpindahannya hilang.

Antar kunjungan, datanya sebetulnya ada di arsip harian (tiap kunjungan membawa
`officerName` dan `medicalRecordNo`), tetapi belum pernah dikumpulkan menjadi satu
tampilan riwayat per pasien.

### Dua lingkup yang perlu dipastikan dulu

1. **Dalam satu kunjungan** - mencatat seluruh rantai terapis saat pasien
   berpindah kotak, bukan hanya yang pertama dan terakhir.
   Ini butuh perubahan struktur data (menambah larik riwayat pada kunjungan).

2. **Antar kunjungan** - menampilkan daftar "pasien ini pernah ditangani oleh
   siapa saja, kapan" dari arsip harian yang sudah ada.
   Ini kemungkinan besar bisa dikerjakan **tanpa mengubah struktur data**, cukup
   membaca arsip yang sudah tersimpan - termasuk untuk data lama.

Perbedaannya penting: lingkup 2 bisa langsung menampilkan riwayat lama, lingkup 1
hanya berlaku untuk kunjungan yang akan datang.

### Yang perlu ditanyakan sebelum mulai

- Lingkup mana yang lebih dibutuhkan lebih dulu? (atau keduanya)
- Riwayatnya ditampilkan di mana - pada kartu pasien, pada Database Harian, atau
  halaman tersendiri?
- Perlu bisa diekspor/dicetak, atau cukup dilihat di layar?

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
