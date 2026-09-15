export type BoxColor = 
  | 'sage'
  | 'purple'
  | 'orange'
  | 'coral'
  | 'green'
  | 'yellow'
  | 'blue'
  | 'pink'
  | 'gray'
  | 'metallic-dark'
  | 'metallic-bronze'
  | 'metallic-emerald'
  | 'metallic-ocean'
  | 'metallic-blue'
  | 'metallic-purple'
  | 'metallic-orange'
  | 'metallic-red'
  | 'metallic-green'
  | 'metallic-sage'
  | 'metallic-yellow'
  | 'metallic-silver';

export interface PatientInstructionPhoto {
  id: string;
  url: string;
  dataUrl?: string; // base64 fallback for offline/instant preview
  uploadedAt: string;
  medicalRecordNo?: string;
  patientName?: string;
  patientId?: string;
  note?: string;
  boxId?: string;
  boxTitle?: string;
}

export interface DisciplineFirstTherapist {
  officerName: string;
  boxId?: string;
  boxTitle?: string;
  firstVisitDate?: string;
}

export interface PatientDisciplineTherapists {
  fisio?: DisciplineFirstTherapist;
  okupasi?: DisciplineFirstTherapist;
  wicara?: DisciplineFirstTherapist;
}

export interface PatientDisciplineVisitCounts {
  fisio?: number;
  okupasi?: number;
  wicara?: number;
}

export interface PatientVisitHistoryItem {
  visitNo: number;
  disciplineVisitNo?: number; // Kunjungan ke-X khusus pada divisi ini
  category?: 'fisio' | 'okupasi' | 'wicara' | string; // Divisi Terapi
  date: string; // YYYY-MM-DD
  boxId: string;
  boxTitle: string;
  officerName: string; // Terapis yang menangani
  actionCode?: string;
  diagnosis?: string;
  isRanap?: boolean;
  notes?: string;
  completedAt?: string;
}

export interface MasterPatient {
  id: string;
  medicalRecordNo: string; // e.g. "273267"
  patientName: string; // e.g. "MUFLIHATI, NY"
  identityNumber?: string; // NIK / No. BPJS
  phoneNumber?: string; // No. HP / WhatsApp
  birthDate?: string; // YYYY-MM-DD
  gender?: 'L' | 'P' | '';
  address?: string;
  defaultDiagnosis?: string;
  defaultActionCode?: string;
  notes?: string;
  registeredDate: string; // YYYY-MM-DD or ISO string
  lastVisitDate?: string;
  lastBoxId?: string; // ID of last therapist box visited
  lastOfficerName?: string; // Name of last therapist officer
  firstBoxId?: string; // ID kotak terapis pertama kali (fallback global)
  firstOfficerName?: string; // Nama terapis yang pertama kali menangani (fallback global)
  firstVisitDate?: string; // Tanggal kunjungan pertama kali (fallback global)
  
  // Multi-Disiplin: Terapis Pertama & Jumlah Kunjungan Mandiri (Fisio, Okupasi, Wicara)
  firstTherapists?: PatientDisciplineTherapists;
  disciplineVisitCounts?: PatientDisciplineVisitCounts;

  visitCount?: number; // Total hitungan kunjungan (alias totalVisits)
  visitHistory?: PatientVisitHistoryItem[]; // Riwayat seluruh kunjungan terapis sebelumnya
  instructionImageUrl?: string; // Last active instruction photo URL (Ranap / DPJP)
  instructionImageUrls?: string[]; // Multiple instruction photos
  instructionPhotos?: PatientInstructionPhoto[]; // Detailed photos history
  totalVisits: number;
  createdAt: string;
  updatedAt?: string;
}

export interface DailyPatientVisit {
  id: string;
  visitDate: string; // YYYY-MM-DD
  patientId?: string; // Link to MasterPatient
  medicalRecordNo: string;
  patientName: string;
  boxId: string;
  boxTitle?: string; // e.g. "BOX 1 (Fisioterapi)" - nama kotak saat kunjungan
  officerName?: string; // e.g. "Ahmad Fauzi, S.Ft" - nama terapis saat kunjungan dibekukan
  category?: 'fisio' | 'okupasi' | 'wicara' | string; // Divisi Terapi saat kunjungan
  firstOfficerName?: string;
  firstBoxTitle?: string;
  queueNumber: string;
  actionCode?: string;
  diagnosis?: string;
  isWarning?: boolean;
  isRanap?: boolean;
  note?: string;
  phoneNumber?: string;
  instructionImageUrl?: string;
  instructionImageUrls?: string[];
  instructionPhotos?: PatientInstructionPhoto[];
  completed: boolean;
  registeredAt: string;
  calledAt?: string | null;
  completedAt?: string | null;
  calledCount: number;
}

export interface PatientItem {
  id: string;
  boxId: string;
  boxTitle?: string; // Judul kotak tempat pasien mengantri
  officerName?: string; // Nama terapis yang sedang / akan menangani
  queueNumber: string; // e.g. "A-001" or "1"
  patientName: string; // e.g. "MUFLIHATI, NY"
  medicalRecordNo: string; // e.g. "273267"
  actionCode?: string; // e.g. "NPC / REQUEST LBP"
  diagnosis?: string; // e.g. "Shoulder & Knee pain"
  isWarning?: boolean; // Pasien warning (🛑)
  isRanap?: boolean; // Pasien rawat inap (🛏️ / RANAP)
  note?: string; // Additional notes
  phoneNumber?: string; // For WA notifications
  patientId?: string; // Link to MasterPatient id
  instructionImageUrl?: string; // URL of single/cover instruction photo
  instructionImageUrls?: string[]; // Array of instruction photos
  instructionPhotos?: PatientInstructionPhoto[]; // Detailed photo objects with metadata
  completed: boolean; // Checked state
  createdAt: string; // ISO string
  completedAt?: string; // ISO string
  calledCount: number;
  lastCalledAt?: string; // ISO string
  originBoxId?: string; // ID kotak asal sebelum dialihkan ke peralihan siang
  originBoxTitle?: string; // Judul kotak asal sebelum peralihan siang
  isLepas?: boolean; // Ceklist status Lepas (tetap di Peralihan Siang saat Alihkan Kembali)
  kurangTindakan?: number; // Ceklist jumlah tindakan yang kurang: 2, 4, 6 dst
  kurangTindakanKode?: string; // Kode tindakan yang masih kurang, misal '2.6' atau '2'
  crossedActionCodes?: string[]; // Sub-tindakan yang sudah dicoret / selesai (misal ['4'] atau ['4', '6'])
  peralihanStatus?: 'lepas' | 'kurang';
  isReady?: boolean; // Status kesiapan pasien: true = Siap (Jempol OK menyala), false = Pasien tidak ada saat dipanggil (Hitam Putih)
  enteredJemputanAt?: string; // ISO string saat pasien masuk / dialihkan ke kotak jemputan ranap
  jemputanDurationMinutes?: number; // Durasi timer jemputan ranap (menit) berdasarkan kode tindakan
  category?: 'fisio' | 'okupasi' | 'wicara' | string; // Divisi Terapi Kotak Saat Ini
  firstOfficerName?: string; // Terapis yang pertama kali menangani (PJ Utama sesuai divisi atau global)
  firstBoxTitle?: string; // Judul kotak terapis pertama kali
  firstVisitDate?: string; // Tanggal pertama kali terapi
  visitCount?: number; // Total kunjungan atau kunjungan per divisi
  disciplineVisitCount?: number; // Kunjungan khusus pada divisi kotak saat ini (K-1, K-2 dst)
  firstTherapists?: PatientDisciplineTherapists; // Multi-disiplin 1st PJ (Fisio, Okupasi, Wicara)
  disciplineVisitCounts?: PatientDisciplineVisitCounts; // Multi-disiplin jumlah kunjungan
}

export interface CallHistoryRecord {
  id: string;
  boxId: string;
  boxTitle: string;
  patientId: string;
  queueNumber: string;
  patientName: string;
  medicalRecordNo: string;
  calledAt: string; // ISO string
  officerName: string;
  status: 'called' | 'recalled' | 'completed' | 'skipped';
  notes?: string;
}

export interface CommunicationNoteReadReceipt {
  name: string;
  at: string; // ISO string
}

export interface CommunicationNoteReply {
  id: string;
  authorName: string;
  message: string;
  createdAt: string; // ISO string
}

export interface CommunicationNote {
  id: string;
  type: 'penting' | 'info' | 'pengumuman';
  authorName: string;
  message: string;
  targetBoxId?: string;
  targetBoxTitle?: string;
  createdAt: string; // ISO string
  readBy: CommunicationNoteReadReceipt[];
  replies: CommunicationNoteReply[];
}

export interface PhotoRecord {
  id: string;
  url: string;
  filename: string;
  dataUrl?: string;
  originalName?: string;
  title?: string;
  boxId?: string;
  boxTitle?: string;
  medicalRecordNo?: string;
  patientName?: string;
  patientId?: string;
  photoType?: 'box_instruction' | 'patient_ranap' | 'general';
  size?: number;
  uploadedAt: string;
}

export interface QueueBox {
  id: string;
  title: string; // e.g. "NAJJAH (SABTU, 25 JULI 2026)"
  subtitle?: string; // e.g. "🛑=PASIEN WARNING"
  officerName: string; // e.g. "Najjah, S.Kep"
  location: string; // e.g. "Poli Rehabitasi Medis / Ranap"
  category?: 'fisio' | 'okupasi' | 'wicara' | string; // Divisi Terapi
  color: BoxColor;
  isPinned: boolean;
  instructionImageUrl?: string; // Header image / banner (single / cover)
  instructionImageUrls?: string[]; // Multiple instruction images / collage
  instructionText?: string; // e.g. "Kode tindakan jangan lupa ya, terimakasih 😊"
  generalNotes?: string[]; // General instruction check items
  autoCallNext?: boolean; // Legacy optional field
  hasUnreadNewInput?: boolean;
  order?: number; // Explicit visual sequence order index
  contentUpdatedAt?: string; // Timestamp of last content/color/title/image update
  createdAt: string;
}

export interface AppNotification {
  id: string;
  boxId: string;
  boxTitle: string;
  officerName?: string;
  patientName: string;
  queueNumber: string;
  medicalRecordNo?: string;
  actionCode?: string;
  isRanap?: boolean;
  isWarning?: boolean;
  timestamp: string;
  createdAt?: string;
  isRead: boolean;
}

export interface DailyReportFilter {
  date: string; // YYYY-MM-DD
  boxId?: string;
  searchQuery?: string;
}

export interface SavedOfficer {
  id: string;
  name: string;
  shortTitle?: string;
  location?: string;
  category?: 'fisio' | 'okupasi' | 'wicara' | string;
  color?: BoxColor;
  role?: string;
  isDefault?: boolean;
  createdAt?: string;
}

// ==================== LAIN-LAIN / MISC IRM MODULES ====================
export interface KasTransaction {
  id: string;
  date: string; // YYYY-MM-DD
  type: 'in' | 'out'; // 'in' = Pemasukan, 'out' = Pengeluaran
  category: string; // e.g. "Iuran Kas Bulanan", "ATK & Logistik", "Konsumsi / Snack", "Operasional Poli", "Sosial / Santunan", "Lain-lain"
  amount: number; // Rupiah
  description: string;
  recordedBy: string; // Petugas pencatat
  proofNote?: string;
  createdAt: string;
}

export interface StaffKasPayment {
  id: string;
  staffName: string;
  year: number; // e.g. 2026
  months: { [monthNum: number]: boolean }; // 1 to 12: true = paid, false = unpaid
  nominalPerMonth: number; // e.g. 50000
  notes?: string;
  updatedAt?: string;
}

export interface RotationAssignment {
  therapistName: string;
  station: string; // e.g. "Ruang Latihan & Gimnasium", "Elektroterapi & Modalitas", "Fisioterapi Dada & Anak", "Rawat Inap (Ranap)", "Poli Eksekutif / VIP"
  shiftNotes?: string;
}

export interface RotationSchedule {
  id: string;
  periodMonth: string; // YYYY-MM
  periodName: string; // e.g. "September 2026 - Periode 1"
  startDate: string;
  endDate: string;
  assignments: RotationAssignment[];
  notes?: string;
  updatedAt: string;
}

export interface SaturdayDutyRecord {
  id: string;
  date: string; // YYYY-MM-DD (a Saturday)
  primaryTherapist: string; // Petugas Utama
  assistantTherapist?: string; // Petugas Pendamping
  supervisor?: string; // Penanggung Jawab
  shiftHours: string; // e.g. "07:30 - 13:00 WIB"
  status: 'scheduled' | 'completed' | 'swapped' | 'cancelled';
  notes?: string;
  updatedAt: string;
}

export interface LeaveRequestRecord {
  id: string;
  therapistName: string;
  leaveType: string; // 'Cuti Tahunan' | 'Cuti Alasan Penting' | 'Cuti Sakit' | 'Cuti Melahirkan' | 'Cuti Bersama' | 'Lainnya'
  selectedDates: string[]; // List of YYYY-MM-DD
  totalDays: number;
  reason: string;
  replacementStaff?: string; // Petugas pengganti
  isAccordingToPlan: boolean; // "Cuti ini sesuai rencana cuti yang sudah dibuat"
  status: 'approved' | 'pending' | 'rejected';
  submittedAt: string;
  approvedBy?: string;
}

// ==================== INVENTARIS & STOK IRM ====================
export type InventoryCategory = 
  | 'bhp' 
  | 'alat_fisio' 
  | 'alat_okupasi' 
  | 'alat_wicara' 
  | 'logistik_atk';

export type ToolCondition = 'baik' | 'perlu_servis' | 'rusak';

export interface InventoryItem {
  id: string;
  code: string; // e.g. "BHP-001", "ALT-002"
  name: string; // e.g. "Gel Ultrasound 5L", "Alat TENS Dual Channel"
  category: InventoryCategory;
  quantity: number; // Current stock level
  minStock: number; // Minimum stock threshold (triggers warning/critical)
  unit: string; // "Botol", "Pcs", "Roll", "Unit", "Box", "Set", "Rim", "Pack"
  location: string; // e.g. "Gudang IRM", "Ruang Elektroterapi", "Ruang Fisioterapi Gym", "Ruang Terapi Okupasi", "Ruang Terapi Wicara"
  condition?: ToolCondition; // Kondisi alat (baik, perlu servis, rusak)
  expiryDate?: string; // YYYY-MM-DD for BMHP
  brand?: string; // Merk / Produsen
  specification?: string; // Spesifikasi teknis
  lastRestockDate?: string; // YYYY-MM-DD
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StockMutation {
  id: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  itemCategory: InventoryCategory;
  type: 'in' | 'out' | 'adjustment'; // 'in' = Barang Masuk, 'out' = Barang Keluar / Pemakaian, 'adjustment' = Penyesuaian Opname
  quantity: number;
  previousStock: number;
  newStock: number;
  unit: string;
  date: string; // YYYY-MM-DD
  officerName: string; // Petugas penanggung jawab / penginput
  recipientOrSource?: string; // Asal barang (Drop Farmasi/Logistik) atau Tujuan Penggunaan (Ruang FT 1 / OT / TW)
  notes?: string;
  createdAt: string;
}

export type RanapCategory = 'fisio' | 'okupasi' | 'wicara';

export interface RanapQueueItem {
  id: string;
  category: RanapCategory;
  patientName: string;
  medicalRecordNo: string;
  roomNumber: string; // No. Ruangan, mis. "3", "4A" - dipakai untuk urutan otomatis
  diagnosis?: string;
  note?: string;
  officerName?: string;
  createdAt: string;
}

export interface RanapHistoryItem extends RanapQueueItem {
  completedAt: string;
}

