/**
 * Utilitas untuk mengunduh dokumen Standar Operasional Prosedur (SOP)
 * dalam format Microsoft Word (.doc / .docx compatible HTML-Word format)
 */

export function generateSopWordContent(): string {
  const dateFormatted = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  return `
  <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
  <head>
    <meta charset="utf-8">
    <title>SOP Penggunaan Sistem Antrean & Database Pasien IRM</title>
    <!--[if gte mso 9]>
    <xml>
      <w:WordDocument>
        <w:View>Print</w:View>
        <w:Zoom>100</w:Zoom>
        <w:DoNotOptimizeForBrowser/>
      </w:WordDocument>
    </xml>
    <![endif]-->
    <style>
      @page Section1 {
        size: 595.3pt 841.9pt; /* A4 */
        margin: 54.0pt 54.0pt 54.0pt 54.0pt;
        mso-header-margin: 35.4pt;
        mso-footer-margin: 35.4pt;
        mso-paper-source: 0;
      }
      div.Section1 { page: Section1; }
      body {
        font-family: 'Calibri', 'Segoe UI', Arial, sans-serif;
        font-size: 11pt;
        line-height: 1.45;
        color: #1e293b;
      }
      h1 {
        font-size: 16pt;
        font-weight: bold;
        color: #0f766e;
        text-align: center;
        margin-top: 12pt;
        margin-bottom: 2pt;
        text-transform: uppercase;
      }
      h2 {
        font-size: 12pt;
        font-weight: bold;
        color: #334155;
        text-align: center;
        margin-top: 0pt;
        margin-bottom: 12pt;
      }
      h3 {
        font-size: 12pt;
        font-weight: bold;
        color: #0f766e;
        border-bottom: 1.5pt solid #0f766e;
        padding-bottom: 3pt;
        margin-top: 14pt;
        margin-bottom: 6pt;
      }
      h4 {
        font-size: 11pt;
        font-weight: bold;
        color: #1e293b;
        margin-top: 10pt;
        margin-bottom: 4pt;
      }
      p, li {
        font-size: 11pt;
        line-height: 1.4;
        margin-top: 2pt;
        margin-bottom: 4pt;
        text-align: justify;
      }
      table.doc-header {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 14pt;
      }
      table.doc-header td {
        border: 1.5pt solid #0f766e;
        padding: 6pt 8pt;
        font-size: 10pt;
      }
      table.content-table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 6pt;
        margin-bottom: 10pt;
      }
      table.content-table th {
        background-color: #f0fdfa;
        color: #0f766e;
        border: 1pt solid #cbd5e1;
        padding: 6pt 8pt;
        font-size: 10pt;
        font-weight: bold;
        text-align: left;
      }
      table.content-table td {
        border: 1pt solid #cbd5e1;
        padding: 5pt 8pt;
        font-size: 10.5pt;
        vertical-align: top;
      }
      .bg-highlight {
        background-color: #f8fafc;
      }
      .badge {
        display: inline-block;
        padding: 2pt 6pt;
        border-radius: 4pt;
        font-weight: bold;
        font-size: 9pt;
        background-color: #ccfbf1;
        color: #0f766e;
      }
      .flowchart-box {
        background-color: #f8fafc;
        border: 1pt dashed #0d9488;
        padding: 10pt;
        margin: 10pt 0;
        font-family: 'Consolas', 'Courier New', monospace;
        font-size: 10pt;
        color: #0f172a;
        line-height: 1.35;
      }
      .signature-table {
        width: 100%;
        margin-top: 25pt;
        border-collapse: collapse;
      }
      .signature-table td {
        width: 50%;
        text-align: center;
        vertical-align: top;
        font-size: 11pt;
      }
    </style>
  </head>
  <body>
    <div class="Section1">
      <!-- HEADER DOKUMEN SOP RESMI -->
      <table class="doc-header">
        <tr>
          <td rowspan="3" style="width: 22%; text-align: center; vertical-align: middle; background-color: #f0fdfa;">
            <div style="font-size: 14pt; font-weight: bold; color: #0f766e;">RSPP</div>
            <div style="font-size: 8.5pt; font-weight: bold; color: #334155;">INSTALASI REHABILITASI MEDIK</div>
          </td>
          <td colspan="2" style="text-align: center; background-color: #f0fdfa;">
            <div style="font-size: 13pt; font-weight: bold; color: #0f766e;">STANDAR OPERASIONAL PROSEDUR (SOP)</div>
            <div style="font-size: 11pt; font-weight: bold; color: #334155;">SISTEM ANTREAN &amp; DATABASE PASIEN IRM</div>
          </td>
        </tr>
        <tr>
          <td style="width: 40%;"><strong>No. Dokumen:</strong> SOP-IRM-IT-001</td>
          <td style="width: 38%;"><strong>Unit Kerja:</strong> Instalasi Rehabilitasi Medik</td>
        </tr>
        <tr>
          <td><strong>Tanggal Berlaku:</strong> ${dateFormatted}</td>
          <td><strong>Status Revisi:</strong> 02 / Master Cloud Sync</td>
        </tr>
      </table>

      <!-- 1. TUJUAN -->
      <h3>1. TUJUAN</h3>
      <ol>
        <li>Memberikan standarisasi panduan operasional bagi Petugas Pendaftaran (Admisi), Terapis (Fisioterapi, Terapi Okupasi, Terapi Wicara), serta Penanggung Jawab Unit dalam mengoperasikan sistem antrean dan data rekam medik IRM.</li>
        <li>Mencegah terjadinya antrean penumpukan pasien, kesalahan kamar/box tindakan, dan memastikan transparansi alur pemanggilan suara otomatis (<em>Voice Chime</em>).</li>
        <li>Menjamin keutuhan, keamanan, dan ketersediaan data pasien (Database Master, Buku Register Harian, dan Laporan Bulanan) secara permanen di Cloud Firestore dan Server.</li>
      </ol>

      <!-- 2. RUANG LINGKUP -->
      <h3>2. RUANG LINGKUP</h3>
      <p>Prosedur ini berlaku di seluruh lingkungan operasional Instalasi Rehabilitasi Medik (IRM), meliputi:</p>
      <ul>
        <li>Autentikasi keamanan dan kontrol akses aplikasi (<em>Login Gateway</em>).</li>
        <li>Pendaftaran pasien baru dan pencarian cepat data pasien lama (Master Data Pasien).</li>
        <li>Manajemen antrean, pemanggilan suara digital, dan layar display TV ruang tunggu.</li>
        <li>Pencatatan tindakan medis per box, kode tindakan (ICF/Tarif), dan status selesai.</li>
        <li>Prosedur pengalihan pasien antar-box (<em>Cross-Box Service</em>).</li>
        <li>Prosedur pergantian shift tengah hari (Peralihan Siang).</li>
        <li>Penyusunan laporan harian/bulanan, evaluasi response time (SPM), dan penutupan antrean harian.</li>
      </ul>

      <!-- 3. WEWENANG DAN TANGGUNG JAWAB -->
      <h3>3. WEWENANG DAN TANGGUNG JAWAB</h3>
      <table class="content-table">
        <tr>
          <th style="width: 25%;">Peran / Petugas</th>
          <th>Tanggung Jawab Utama</th>
        </tr>
        <tr>
          <td><strong>Petugas Admisi / Pendaftaran</strong></td>
          <td>
            • Melakukan verifikasi data pasien dan menginput pasien baru/lama ke dalam sistem.<br>
            • Mengarahkan pasien ke Box Terapis yang sesuai (FT, OT, TW) dengan beban seimbang.<br>
            • Memberikan informasi estimasi waktu tunggu dan mencetak/menunjukkan nomor antrean.
          </td>
        </tr>
        <tr class="bg-highlight">
          <td><strong>Terapis / Petugas Box</strong></td>
          <td>
            • Memanggil pasien melalui tombol pemanggilan suara otomatis.<br>
            • Mengisi kode tindakan dan diagnosa ICF saat pelayanan berlangsung.<br>
            • Menandai status penyelesaian tindakan segera setelah sesi terapi tuntas.<br>
            • Melakukan pengalihan pasien ke box lain jika membutuhkan kombinasi modalitas terapi.
          </td>
        </tr>
        <tr>
          <td><strong>Kepala Instalasi / Koordinator IT</strong></td>
          <td>
            • Memantau indikator response time (SPM) dan analitik beban kerja (Workload Intelligence).<br>
            • Memverifikasi dan mengunduh laporan bulanan serta rekapan register harian.<br>
            • Bertanggung jawab atas pengelolaan kata sandi dan otorisasi pembersihan antrean (PIN Reset).
          </td>
        </tr>
      </table>

      <!-- 4. DIAGRAM ALUR PELAYANAN -->
      <h3>4. DIAGRAM ALUR PELAYANAN PASIEN (FLOWCHART)</h3>
      <div class="flowchart-box">
[Pasien Datang di IRM] 
       │
       ▼
[1. Pendaftaran di Admisi] ──► Cari Pasien Lama / Input Pasien Baru ──► Simpan ke Cloud Master
       │
       ▼
[2. Masuk Antrean Box] ────► Nomor Antrean Terbit & Muncul di Display TV
       │
       ▼
[3. Pemanggilan Suara] ────► Terapis klik ikon "Panggil" (Voice Chime Bahasa Indonesia)
       │
       ▼
[4. Pelaksanaan Terapi] ───► Input Kode Tindakan & Diagnosa ICF di Kartu Pasien
       │
       ├─► [Perlu Terapi Lanjutan di Box Lain?] ──► Klik "Alihkan ke Box Lain"
       │
       ▼
[5. Selesai Tindakan] ─────► Terapis klik centang hijau "Selesai"
       │
       ▼
[6. Penutupan Shift Sore] ─► Unduh Laporan Harian/Bulanan ──► Bersihkan Antrean (Auto-Archive)
      </div>

      <!-- 5. TATA CARA OPERASIONAL DETAIL -->
      <h3>5. TATA CARA OPERASIONAL DETAIL</h3>

      <h4>5.1. Pembukaan Layanan &amp; Autentikasi Sistem</h4>
      <ol>
        <li>Nyalakan komputer pendaftaran, tablet terapis, dan TV display ruang tunggu.</li>
        <li>Buka aplikasi IRM pada peramban web (Google Chrome / Microsoft Edge).</li>
        <li>Masukkan <strong>Kata Sandi Akses</strong> aplikasi dan pilih identitas petugas yang sedang bertugas.</li>
        <li>Pastikan indikator status di bagian atas menampilkan <strong>"☁️ Cloud Live"</strong> (berwarna hijau).</li>
      </ol>

      <h4>5.2. Pendaftaran Pasien (Admisi)</h4>
      <ol>
        <li>Klik tombol biru <strong>"+ Pasien"</strong> di bilah navigasi atas.</li>
        <li><strong>Pasien Lama:</strong> Masukkan No. Rekam Medis (No. RM) atau Nama Pasien pada kotak pencarian cepat. Pilih dari daftar saran; seluruh data identitas, diagnosis, dan riwayat tindakan akan terisi otomatis.</li>
        <li><strong>Pasien Baru:</strong> Masukkan No. RM, Nama Lengkap, NIK, No. HP (WhatsApp), Jenis Kelamin, Tanggal Lahir, dan Alamat. Sistem otomatis menyimpan ke <em>Master Patients Database</em> Cloud.</li>
        <li>Tentukan <strong>Box Tujuan</strong>:
          <ul>
            <li>Perhatikan tanda hijau/rekomendasi terapis dengan beban terendah pada tombol <strong>Fisio / Okupasi / Wicara</strong> untuk pemerataan distribusi pasien.</li>
          </ul>
        </li>
        <li>Pilih <strong>Kode Tindakan</strong> yang direncanakan dan beri tanda centang jika pasien merupakan pasien <strong>Rawat Inap (Ranap)</strong> atau <strong>Perlu Perhatian Khusus (Warning)</strong>.</li>
        <li>Klik <strong>"Simpan &amp; Masukkan Antrean"</strong>.</li>
      </ol>

      <h4>5.3. Pemanggilan dan Pelayanan Pasien di Box</h4>
      <ol>
        <li>Terapis membuka kartu box masing-masing pada layar kerja.</li>
        <li>Tekan tombol <strong>"Panggil" (Ikon Speaker)</strong> untuk memanggil pasien antrean teratas. Suara digital akan berbunyi di seluruh pengeras suara dan nomor pasien berkedip di Layar TV Display.</li>
        <li>Lakukan tindakan terapi sesuai advis dokter Sp.KFR.</li>
        <li>Periksa kembali atau tambahkan kode tindakan spesifik (misal: <em>MWD, US, TENS, IR, Manual Therapy, Active Exercise</em>) serta kode ICF.</li>
        <li><strong>Prosedur Pengalihan Antar-Box:</strong> Jika pasien memerlukan tindakan lanjutan di divisi lain (misal: selesai Fisioterapi lanjut ke Okupasi Terapi), klik <strong>"Alihkan Box"</strong>, pilih box tujuan baru. Riwayat kedatangan pasien tetap terjaga dan tidak menduplikasi data master.</li>
        <li>Setelah tindakan selesai, klik tombol <strong>"Selesai" (Centang Hijau)</strong>. Waktu selesai otomatis tercatat untuk kalkulasi Standar Pelayanan Minimal (SPM).</li>
      </ol>

      <h4>5.4. Pergantian Shift Tengah Hari (Peralihan Siang)</h4>
      <ol>
        <li>Pada pukul 12.00 - 13.00, buka menu <strong>"Peralihan Siang"</strong>.</li>
        <li>Evaluasi pasien yang masih menunggu tindakan dan sesuaikan alokasi box dengan terapis jaga siang.</li>
        <li>Konfirmasikan peralihan agar pemanggilan shift siang berjalan berkesinambungan.</li>
      </ol>

      <h4>5.5. Pengelolaan Database &amp; Laporan (Pelaporan)</h4>
      <ol>
        <li><strong>Database Pasien:</strong> Buka menu samping (<em>Sidebar</em>) &gt; <strong>"Database Pasien"</strong>. Masukkan PIN untuk melihat seluruh buku register pasien, riwayat kunjungan, dan master data pasien.</li>
        <li><strong>Laporan Harian:</strong> Klik menu <strong>"Laporan Harian"</strong> untuk mengunduh rekapitulasi harian dalam bentuk cetak, PDF, atau spreadsheet Excel (.xlsx).</li>
        <li><strong>Laporan Bulanan:</strong> Klik menu <strong>"Bulanan Terapis"</strong> untuk mencetak rekapitulasi kinerja bulanan per terapis, total kunjungan Ranap/Ralan, dan statistik modalitas tindakan.</li>
      </ol>

      <h4>5.6. Penutupan Layanan &amp; Pembersihan Antrean (Reset Harian)</h4>
      <ol>
        <li>Setelah seluruh pelayanan hari tersebut tuntas, Koordinator IRM mengklik menu <strong>"Bersihkan Antrean"</strong>.</li>
        <li>Sistem secara otomatis mengeksekusi <strong>Auto-Commit Data</strong>: memastikan seluruh register hari ini tersimpan 100% permanen di Cloud Firestore dan Database Master sebelum tampilan visual antrean dikosongkan.</li>
        <li>Masukkan <strong>PIN Konfirmasi</strong> untuk mereset antrean harian siap menyongsong pelayanan hari berikutnya.</li>
      </ol>

      <!-- 6. PENANGANAN KENDALA & TROUBLESHOOTING -->
      <h3>6. PANDUAN PENANGANAN KENDALA (TROUBLESHOOTING)</h3>
      <table class="content-table">
        <tr>
          <th style="width: 25%;">Gejala Masalah</th>
          <th style="width: 35%;">Kemungkinan Penyebab</th>
          <th>Langkah Tindakan Solusi</th>
        </tr>
        <tr>
          <td><strong>Status Berubah Jadi "Lokal" (Kuning)</strong></td>
          <td>Koneksi internet rumah sakit terputus sementara.</td>
          <td>Aplikasi tetap dapat digunakan tanpa gangguan (<em>Offline-First</em>). Begitu internet pulih, seluruh data akan disinkronisasikan otomatis ke Cloud.</td>
        </tr>
        <tr class="bg-highlight">
          <td><strong>Layar Display TV Tidak Berubah</strong></td>
          <td>Koneksi websocket/cloud sync di layar monitor terputus atau mode layar penuh belum aktif.</td>
          <td>1. Muat ulang (refresh) halaman Display TV.<br>2. Pastikan status Cloud di pojok kanan atas menunjukkan hijau (Cloud Live).<br>3. Tekan F11 untuk mode layar penuh TV.</td>
        </tr>
        <tr>
          <td><strong>Salah Memasukkan Pasien ke Box</strong></td>
          <td>Kesalahan pemilihan saat pendaftaran.</td>
          <td>Klik tombol <strong>"Alihkan Box"</strong> pada kartu pasien dan pilih box yang benar tanpa perlu menghapus pasien.</td>
        </tr>
        <tr class="bg-highlight">
          <td><strong>Lupa Kata Sandi / PIN</strong></td>
          <td>Petugas lupa kredensial yang disetel.</td>
          <td>Gunakan fitur <em>Ganti Password</em> dengan otorisasi Administrator Unit atau hubungi Tim IT Rumah Sakit.</td>
        </tr>
      </table>

      <!-- 7. PENGESAHAN DOKUMEN -->
      <h3>7. LEMBAR PENGESAHAN DOKUMEN</h3>
      <table class="signature-table">
        <tr>
          <td>
            Disiapkan Oleh,<br>
            <strong>Koordinator Administrasi &amp; IT IRM</strong>
            <br><br><br><br>
            ( ........................................................... )<br>
            NIP/NRP: ...........................................
          </td>
          <td>
            Disetujui &amp; Disahkan Oleh,<br>
            <strong>Kepala Instalasi Rehabilitasi Medik</strong>
            <br><br><br><br>
            ( ........................................................... )<br>
            NIP/NRP: ...........................................
          </td>
        </tr>
      </table>

      <div style="margin-top: 30pt; text-align: center; font-size: 9pt; color: #94a3b8; border-top: 1pt solid #e2e8f0; padding-top: 8pt;">
        Dokumen Resmi Rumah Sakit Pusat Pertamina (RSPP) • Sistem Antrean Cerdas &amp; Manajemen Pasien IRM PRO
      </div>
    </div>
  </body>
  </html>
  `;
}

/**
 * Memicu pengunduhan file Word (.doc) secara langsung di browser pengguna
 */
export function downloadSopAsWordDocument(filename = 'SOP_Sistem_Antrean_dan_Database_Pasien_IRM.doc'): void {
  const content = generateSopWordContent();
  const blob = new Blob(['\ufeff', content], {
    type: 'application/msword;charset=utf-8'
  });

  const url = URL.createObjectURL(blob);
  const downloadLink = document.createElement('a');
  downloadLink.href = url;
  downloadLink.download = filename;
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);
  URL.revokeObjectURL(url);
}
