import { InventoryItem, StockMutation, InventoryCategory, ToolCondition } from '../types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { cloudDatabaseService } from './cloudDatabaseService';

const INVENTORY_ITEMS_STORAGE_KEY = 'irm_inventory_items';
const STOCK_MUTATIONS_STORAGE_KEY = 'irm_stock_mutations';

// BroadcastChannel for instant same-browser cross-tab sync
let inventoryChannel: BroadcastChannel | null = null;
try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    inventoryChannel = new BroadcastChannel('irm_inventory_sync_channel');
  }
} catch {
  inventoryChannel = null;
}

export const INVENTORY_CATEGORIES: { id: InventoryCategory; label: string; icon: string; description: string }[] = [
  { id: 'bhp', label: 'Bahan Habis Pakai (BMHP)', icon: '🧴', description: 'Gel USG, Kinesiotape, Handschoen, Alkohol Swab, Underpad, dll.' },
  { id: 'alat_fisio', label: 'Alat Fisioterapi (FT)', icon: '⚡', description: 'Modalitas Elektroterapi, US, TENS, SWD, Gym Ball, Dumbbell, dll.' },
  { id: 'alat_okupasi', label: 'Alat Terapi Okupasi (OT)', icon: '🧩', description: 'Pegboard, Therapy Putty, Sensori Integrasi, Finger Exerciser, dll.' },
  { id: 'alat_wicara', label: 'Alat Terapi Wicara (TW)', icon: '🗣️', description: 'Cermin Terapi, Oral Motor Tool, Flashcard Artikulasi, Spatula, dll.' },
  { id: 'logistik_atk', label: 'Logistik & ATK IRM', icon: '📦', description: 'Kertas HVS, Map RM, Tinta Printer, Baterai, Tisu, dll.' }
];

export const getInventoryCategoryLabel = (cat: InventoryCategory | string): string => {
  const found = INVENTORY_CATEGORIES.find(c => c.id === cat);
  return found ? found.label : cat;
};

export const getInventoryCategoryIcon = (cat: InventoryCategory | string): string => {
  const found = INVENTORY_CATEGORIES.find(c => c.id === cat);
  return found ? found.icon : '📦';
};

export const getInventoryCategoryBadgeClass = (cat: InventoryCategory | string): string => {
  switch (cat) {
    case 'bhp':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'alat_fisio':
      return 'bg-teal-100 text-teal-800 border-teal-200';
    case 'alat_okupasi':
      return 'bg-purple-100 text-purple-800 border-purple-200';
    case 'alat_wicara':
      return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'logistik_atk':
      return 'bg-slate-100 text-slate-800 border-slate-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

export const getStockStatus = (item: InventoryItem): { status: 'aman' | 'menipis' | 'habis'; label: string; badgeClass: string } => {
  if (item.quantity <= 0) {
    return {
      status: 'habis',
      label: 'Habis (0)',
      badgeClass: 'bg-rose-500 text-white font-black animate-pulse'
    };
  }
  if (item.quantity <= item.minStock) {
    return {
      status: 'menipis',
      label: 'Stok Menipis',
      badgeClass: 'bg-amber-500 text-white font-black'
    };
  }
  return {
    status: 'aman',
    label: 'Aman',
    badgeClass: 'bg-emerald-600 text-white font-bold'
  };
};

export const getConditionBadge = (condition?: ToolCondition): { label: string; badgeClass: string } => {
  switch (condition) {
    case 'baik':
      return { label: 'Baik & Siap Pakai', badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
    case 'perlu_servis':
      return { label: 'Perlu Servis / Kalibrasi', badgeClass: 'bg-amber-100 text-amber-800 border-amber-300' };
    case 'rusak':
      return { label: 'Rusak / Afkir', badgeClass: 'bg-rose-100 text-rose-800 border-rose-300' };
    default:
      return { label: 'Baik', badgeClass: 'bg-slate-100 text-slate-800 border-slate-200' };
  }
};

// INITIAL SEED DATA FOR IRM RSPP
export const INITIAL_INVENTORY_ITEMS: InventoryItem[] = [
  // 1. BAHAN HABIS PAKAI (BMHP)
  {
    id: 'item-bhp-001',
    code: 'BHP-001',
    name: 'Gel Ultrasound 5 Liter',
    category: 'bhp',
    quantity: 6,
    minStock: 2,
    unit: 'Galon 5L',
    location: 'Gudang Logistik IRM',
    brand: 'Aquasonic 100 / OneMed',
    specification: 'Water soluble, acoustic transmission gel',
    expiryDate: '2027-12-31',
    lastRestockDate: '2026-08-15',
    notes: 'Dipakai untuk terapi US Fisioterapi harian',
    createdAt: '2026-08-01T08:00:00.000Z',
    updatedAt: '2026-08-20T10:00:00.000Z'
  },
  {
    id: 'item-bhp-002',
    code: 'BHP-002',
    name: 'Kinesiotape Elastis 5cm x 5m',
    category: 'bhp',
    quantity: 14,
    minStock: 5,
    unit: 'Roll',
    location: 'Ruang Fisioterapi 1',
    brand: 'Kinesio Tex Gold / Nitto',
    specification: 'Waterproof elastic therapeutic tape, warna biru, hitam, krem',
    expiryDate: '2028-06-30',
    lastRestockDate: '2026-08-10',
    notes: 'Untuk taping muskuloskeletal, sprain & strain',
    createdAt: '2026-08-01T08:00:00.000Z',
    updatedAt: '2026-08-25T11:00:00.000Z'
  },
  {
    id: 'item-bhp-003',
    code: 'BHP-003',
    name: 'Alkohol Swab 70% (Box isi 100)',
    category: 'bhp',
    quantity: 8,
    minStock: 3,
    unit: 'Box',
    location: 'Gudang Logistik IRM',
    brand: 'OneMed / BD',
    specification: 'Non-woven swab jenuh Isopropyl Alcohol 70%',
    expiryDate: '2027-09-30',
    lastRestockDate: '2026-08-05',
    notes: 'Desinfeksi probe USG & pad elektroda',
    createdAt: '2026-08-01T08:00:00.000Z',
    updatedAt: '2026-08-05T08:00:00.000Z'
  },
  {
    id: 'item-bhp-004',
    code: 'BHP-004',
    name: 'Handscoon Medis Non-Steril Size M',
    category: 'bhp',
    quantity: 12,
    minStock: 4,
    unit: 'Box (100 pcs)',
    location: 'Ruang Terapi & Tindakan',
    brand: 'Sensi Gloves Latex',
    specification: 'Powder-free examination gloves size M',
    expiryDate: '2028-01-31',
    lastRestockDate: '2026-08-12',
    notes: 'Alat pelindung diri pemeriksaan & manipulasi',
    createdAt: '2026-08-01T08:00:00.000Z',
    updatedAt: '2026-08-12T09:00:00.000Z'
  },
  {
    id: 'item-bhp-005',
    code: 'BHP-005',
    name: 'Underpad Alas Bed Pasien 60x90cm',
    category: 'bhp',
    quantity: 18,
    minStock: 6,
    unit: 'Pack (10 lembar)',
    location: 'Gudang Logistik IRM',
    brand: 'Oto / Sensipad',
    specification: 'High absorbent disposable bed sheet 60x90cm',
    expiryDate: '2029-12-31',
    lastRestockDate: '2026-08-18',
    notes: 'Alas bed terapi modalitas & ranap',
    createdAt: '2026-08-01T08:00:00.000Z',
    updatedAt: '2026-08-18T14:00:00.000Z'
  },
  {
    id: 'item-bhp-006',
    code: 'BHP-006',
    name: 'Electrode Pads TENS Reusable 5x5cm',
    category: 'bhp',
    quantity: 16,
    minStock: 5,
    unit: 'Set (4 pads)',
    location: 'Ruang Elektroterapi',
    brand: 'Axelgaard ValuTrode',
    specification: 'Self-adhesive hydrogel electrode pad with pin connector',
    expiryDate: '2027-10-31',
    lastRestockDate: '2026-08-02',
    notes: 'Diganti berkala saat daya rekat berkurang',
    createdAt: '2026-08-01T08:00:00.000Z',
    updatedAt: '2026-08-02T10:00:00.000Z'
  },
  {
    id: 'item-bhp-007',
    code: 'BHP-007',
    name: 'Masker Medis 3-Ply Earloop',
    category: 'bhp',
    quantity: 10,
    minStock: 3,
    unit: 'Box (50 pcs)',
    location: 'Meja Nurse Station IRM',
    brand: 'Sensi / Diapro',
    specification: 'BFE 99% 3-ply surgical mask',
    expiryDate: '2028-11-30',
    lastRestockDate: '2026-08-14',
    notes: 'Stok APD harian petugas dan pasien',
    createdAt: '2026-08-01T08:00:00.000Z',
    updatedAt: '2026-08-14T08:30:00.000Z'
  },

  // 2. ALAT & MODALITAS FISIOTERAPI
  {
    id: 'item-alt-001',
    code: 'ALT-FT-001',
    name: 'Alat Ultrasound Therapy Dual Freq (1 & 3 MHz)',
    category: 'alat_fisio',
    quantity: 3,
    minStock: 1,
    unit: 'Unit',
    location: 'Ruang Elektroterapi Bed 1, 2, 3',
    condition: 'baik',
    brand: 'BTL 4000 Smart / Enraf Nonius',
    specification: 'Continuous & Pulsed mode, probe head 5cm2, timer digital',
    lastRestockDate: '2025-11-10',
    notes: 'Kalibrasi rutin berikutnya: November 2026',
    createdAt: '2026-08-01T08:00:00.000Z',
    updatedAt: '2026-08-20T08:00:00.000Z'
  },
  {
    id: 'item-alt-002',
    code: 'ALT-FT-002',
    name: 'TENS 4-Channel Digital Therapy Unit',
    category: 'alat_fisio',
    quantity: 5,
    minStock: 2,
    unit: 'Unit',
    location: 'Ruang Elektroterapi & Trolley',
    condition: 'baik',
    brand: 'Ito Physio Trio / Chattanooga',
    specification: '4 channel independen, 8 elektroda pad, burst, continuous, mod',
    lastRestockDate: '2025-12-01',
    notes: 'Kondisi kabel dan baterai dalam keadaan prima',
    createdAt: '2026-08-01T08:00:00.000Z',
    updatedAt: '2026-08-01T08:00:00.000Z'
  },
  {
    id: 'item-alt-003',
    code: 'ALT-FT-003',
    name: 'Shortwave Diathermy (SWD) Unit',
    category: 'alat_fisio',
    quantity: 2,
    minStock: 1,
    unit: 'Unit',
    location: 'Ruang Terapi Khusus SWD Bed A & B',
    condition: 'baik',
    brand: 'Curapuls 670 Enraf Nonius',
    specification: 'Inductive electrode, continuous & pulsed deep heat RF 27.12 MHz',
    lastRestockDate: '2025-06-15',
    notes: 'Wajib screening logam dan pacemaker sebelum tindakan',
    createdAt: '2026-08-01T08:00:00.000Z',
    updatedAt: '2026-08-01T08:00:00.000Z'
  },
  {
    id: 'item-alt-004',
    code: 'ALT-FT-004',
    name: 'Infrared (IR) Therapy Lamp 250W Stand',
    category: 'alat_fisio',
    quantity: 4,
    minStock: 1,
    unit: 'Unit',
    location: 'Ruang Fisioterapi Bed 1 - 4',
    condition: 'baik',
    brand: 'Philips Infraphil Medical Stand',
    specification: 'Bulb 250W E27, adjustable height & arm, timer otomatis',
    lastRestockDate: '2026-01-20',
    notes: 'Lampu bohlam cadangan tersedia di gudang',
    createdAt: '2026-08-01T08:00:00.000Z',
    updatedAt: '2026-08-01T08:00:00.000Z'
  },
  {
    id: 'item-alt-005',
    code: 'ALT-FT-005',
    name: 'Lumbar & Cervical Traction Machine Bed',
    category: 'alat_fisio',
    quantity: 2,
    minStock: 1,
    unit: 'Unit',
    location: 'Ruang Traksi & Terapi Manual',
    condition: 'baik',
    brand: 'Chattanooga Triton DTS',
    specification: 'Computerized motorized traction with patient stop switch',
    lastRestockDate: '2025-08-10',
    notes: 'Belt pelvic dan thorax lengkap',
    createdAt: '2026-08-01T08:00:00.000Z',
    updatedAt: '2026-08-01T08:00:00.000Z'
  },
  {
    id: 'item-alt-006',
    code: 'ALT-FT-006',
    name: 'Resistance Bands Set (Kuning, Merah, Hijau, Biru)',
    category: 'alat_fisio',
    quantity: 8,
    minStock: 2,
    unit: 'Set (4 bands)',
    location: 'Ruang Latihan Gimnasium',
    condition: 'baik',
    brand: 'TheraBand Original Latex',
    specification: 'Panjang 1.5m, resistensi bertingkat ringan - ekstra berat',
    lastRestockDate: '2026-07-05',
    notes: 'Untuk penguatan otot sendi dan ekstremitas',
    createdAt: '2026-08-01T08:00:00.000Z',
    updatedAt: '2026-08-01T08:00:00.000Z'
  },
  {
    id: 'item-alt-007',
    code: 'ALT-FT-007',
    name: 'Gym Ball / Bobath Ball 65cm & 75cm',
    category: 'alat_fisio',
    quantity: 6,
    minStock: 2,
    unit: 'Pcs',
    location: 'Ruang Latihan Gimnasium',
    condition: 'baik',
    brand: 'Gymnic / Ledragomma',
    specification: 'Anti-burst heavy duty exercise ball with hand pump',
    lastRestockDate: '2026-03-12',
    notes: 'Latihan core stability dan balance neuro/ortopedi',
    createdAt: '2026-08-01T08:00:00.000Z',
    updatedAt: '2026-08-01T08:00:00.000Z'
  },
  {
    id: 'item-alt-008',
    code: 'ALT-FT-008',
    name: 'Dumbbell Set Cast Iron (1kg, 2kg, 3kg, 5kg)',
    category: 'alat_fisio',
    quantity: 6,
    minStock: 2,
    unit: 'Pasang',
    location: 'Rak Alat Gimnasium',
    condition: 'baik',
    brand: 'Kettler / Berwyn',
    specification: 'Neoprene coated cast iron hand weight',
    lastRestockDate: '2025-05-10',
    notes: 'Latihan penguatan ekstremitas atas',
    createdAt: '2026-08-01T08:00:00.000Z',
    updatedAt: '2026-08-01T08:00:00.000Z'
  },
  {
    id: 'item-alt-009',
    code: 'ALT-FT-009',
    name: 'Goniometer Stainless Steel (ROM Universal)',
    category: 'alat_fisio',
    quantity: 5,
    minStock: 2,
    unit: 'Pcs',
    location: 'Meja Fisioterapis',
    condition: 'baik',
    brand: 'Prestige Medical 360 Degree',
    specification: 'Skala 0-360 derajat panjang 20cm dan 30cm',
    lastRestockDate: '2026-02-15',
    notes: 'Alat ukur lingkup gerak sendi pasien',
    createdAt: '2026-08-01T08:00:00.000Z',
    updatedAt: '2026-08-01T08:00:00.000Z'
  },
  {
    id: 'item-alt-010',
    code: 'ALT-FT-010',
    name: 'Kursi Roda Pasien Standar Chrome',
    category: 'alat_fisio',
    quantity: 4,
    minStock: 2,
    unit: 'Unit',
    location: 'Lobi & Ruang Tunggu IRM',
    condition: 'baik',
    brand: 'Sella / GEA Medical',
    specification: 'Rangka besi chrome, velg racing, rem tangan ganda',
    lastRestockDate: '2026-01-10',
    notes: 'Untuk mobilisasi pasien lanjut usia & ranap',
    createdAt: '2026-08-01T08:00:00.000Z',
    updatedAt: '2026-08-01T08:00:00.000Z'
  },

  // 3. ALAT TERAPI OKUPASI (OT)
  {
    id: 'item-ot-001',
    code: 'ALT-OT-001',
    name: 'Wooden Pegboard & Pegs Set (Fine Motor)',
    category: 'alat_okupasi',
    quantity: 3,
    minStock: 1,
    unit: 'Set',
    location: 'Ruang Terapi Okupasi (OT)',
    condition: 'baik',
    brand: 'Sammons Preston / Rolyan',
    specification: 'Papan kayu 100 lubang dengan pin aneka warna & bentuk',
    lastRestockDate: '2025-09-01',
    notes: 'Latihan motorik halus, koordinasi mata-tangan stroke/anak',
    createdAt: '2026-08-01T08:00:00.000Z',
    updatedAt: '2026-08-01T08:00:00.000Z'
  },
  {
    id: 'item-ot-002',
    code: 'ALT-OT-002',
    name: 'Therapy Putty / Plastisin Terapi Hand Rehab',
    category: 'alat_okupasi',
    quantity: 8,
    minStock: 2,
    unit: 'Pot (85 gram)',
    location: 'Ruang Terapi Okupasi (OT)',
    brand: 'TheraPutty CanDo',
    specification: 'Non-toxic silicone, 4 warna resistensi (Tan, Yellow, Red, Green)',
    lastRestockDate: '2026-06-20',
    notes: 'Latihan kekuatan cengkeraman jari dan tangan',
    createdAt: '2026-08-01T08:00:00.000Z',
    updatedAt: '2026-08-01T08:00:00.000Z'
  },
  {
    id: 'item-ot-003',
    code: 'ALT-OT-003',
    name: 'Sensory Brush / Sikat Wilbarger',
    category: 'alat_okupasi',
    quantity: 10,
    minStock: 3,
    unit: 'Pcs',
    location: 'Ruang Sensori Integrasi OT',
    brand: 'Therapro Wilbarger Brush',
    specification: 'High density soft bristle surgical brush for sensory diet',
    lastRestockDate: '2026-07-15',
    notes: 'Protokol brushing sensori taktil pediatrik',
    createdAt: '2026-08-01T08:00:00.000Z',
    updatedAt: '2026-08-01T08:00:00.000Z'
  },
  {
    id: 'item-ot-004',
    code: 'ALT-OT-004',
    name: 'Hand & Finger Exerciser Grip Master',
    category: 'alat_okupasi',
    quantity: 6,
    minStock: 2,
    unit: 'Pcs',
    location: 'Ruang Terapi Okupasi (OT)',
    condition: 'baik',
    brand: 'Gripmaster / Digi-Flex',
    specification: 'Individual spring finger button mechanism',
    lastRestockDate: '2026-02-10',
    notes: 'Isolasi kekuatan masing-masing jari pasca trauma/stroke',
    createdAt: '2026-08-01T08:00:00.000Z',
    updatedAt: '2026-08-01T08:00:00.000Z'
  },

  // 4. ALAT TERAPI WICARA (TW)
  {
    id: 'item-tw-001',
    code: 'ALT-TW-001',
    name: 'Cermin Terapi Artikulasi Berdiri (Standing Mirror)',
    category: 'alat_wicara',
    quantity: 2,
    minStock: 1,
    unit: 'Unit',
    location: 'Ruang Terapi Wicara 1 & 2',
    condition: 'baik',
    brand: 'Custom Wood Standing Rehab Mirror',
    specification: 'Cermin bebas distorsi 120x40cm dengan roda pengunci',
    lastRestockDate: '2025-08-20',
    notes: 'Biofeedback visual artikulasi dan posisi bibir/lidah',
    createdAt: '2026-08-01T08:00:00.000Z',
    updatedAt: '2026-08-01T08:00:00.000Z'
  },
  {
    id: 'item-tw-002',
    code: 'ALT-TW-002',
    name: 'Flashcard Terapi Wicara & Kosakata (Set Lengkap)',
    category: 'alat_wicara',
    quantity: 6,
    minStock: 2,
    unit: 'Set Box',
    location: 'Ruang Terapi Wicara',
    brand: 'Smart Speech Therapy Cards',
    specification: 'Laminated cards tema kata kerja, benda, emosi, fonem',
    lastRestockDate: '2026-04-10',
    notes: 'Stimulasi bahasa reseptif dan ekspresif',
    createdAt: '2026-08-01T08:00:00.000Z',
    updatedAt: '2026-08-01T08:00:00.000Z'
  },
  {
    id: 'item-tw-003',
    code: 'ALT-TW-003',
    name: 'Oral Motor Chewy Tubes & Z-Vibe Set',
    category: 'alat_wicara',
    quantity: 8,
    minStock: 2,
    unit: 'Set',
    location: 'Ruang Terapi Wicara',
    condition: 'baik',
    brand: 'ARK Therapeutic Z-Vibe',
    specification: 'Medical grade vibration oral probe with textured tips',
    lastRestockDate: '2026-05-18',
    notes: 'Stimulasi sensori oral dan penguatan rahang',
    createdAt: '2026-08-01T08:00:00.000Z',
    updatedAt: '2026-08-01T08:00:00.000Z'
  },
  {
    id: 'item-tw-004',
    code: 'BHP-TW-004',
    name: 'Spatula Lidah Kayu / Tongue Depressor (Box isi 100)',
    category: 'alat_wicara',
    quantity: 6,
    minStock: 2,
    unit: 'Box',
    location: 'Ruang Terapi Wicara',
    brand: 'OneMed Disposable Wooden',
    specification: 'Smooth polished wood, non-sterile disposable',
    expiryDate: '2029-05-30',
    lastRestockDate: '2026-08-11',
    notes: 'Pemeriksaan oral motor dan penahanan lidah',
    createdAt: '2026-08-01T08:00:00.000Z',
    updatedAt: '2026-08-11T10:00:00.000Z'
  },

  // 5. LOGISTIK & ATK
  {
    id: 'item-atk-001',
    code: 'ATK-001',
    name: 'Kertas HVS A4 80 Gram',
    category: 'logistik_atk',
    quantity: 8,
    minStock: 3,
    unit: 'Rim',
    location: 'Gudang ATK IRM',
    brand: 'PaperOne All Purpose 80gsm',
    specification: 'Ukuran A4 210x297mm 500 lembar per rim',
    lastRestockDate: '2026-08-19',
    notes: 'Cetak register harian, rekam medis, dan form klaim BPJS',
    createdAt: '2026-08-01T08:00:00.000Z',
    updatedAt: '2026-08-19T13:00:00.000Z'
  },
  {
    id: 'item-atk-002',
    code: 'ATK-002',
    name: 'Map Rekam Medis IRM Plastik Clip',
    category: 'logistik_atk',
    quantity: 45,
    minStock: 15,
    unit: 'Pcs',
    location: 'Meja Pendaftaran IRM',
    brand: 'Biola / InterX Folder',
    specification: 'Plastik PP bening dengan clip pengait rekam medik',
    lastRestockDate: '2026-08-08',
    notes: 'Penyimpanan berkas evaluasi & asesmen pasien',
    createdAt: '2026-08-01T08:00:00.000Z',
    updatedAt: '2026-08-08T09:00:00.000Z'
  },
  {
    id: 'item-atk-003',
    code: 'ATK-003',
    name: 'Tinta Printer Epson Original Black 003',
    category: 'logistik_atk',
    quantity: 4,
    minStock: 2,
    unit: 'Botol',
    location: 'Ruang Administrasi IRM',
    brand: 'Epson Original Ink T00V1',
    specification: 'Black ink bottle 65ml untuk printer L3110 / L3210',
    lastRestockDate: '2026-08-15',
    notes: 'Printer utama operasional dan antrean poli',
    createdAt: '2026-08-01T08:00:00.000Z',
    updatedAt: '2026-08-15T11:00:00.000Z'
  },
  {
    id: 'item-atk-004',
    code: 'ATK-004',
    name: 'Baterai Timbangan & TENS Alkaline AA',
    category: 'logistik_atk',
    quantity: 6,
    minStock: 2,
    unit: 'Pack (4 pcs)',
    location: 'Gudang Logistik IRM',
    brand: 'ABC Alkaline Millennium Power AA',
    specification: 'Tegangan 1.5V leak-proof',
    expiryDate: '2030-12-31',
    lastRestockDate: '2026-08-05',
    notes: 'Cadangan baterai alat ukur dan unit TENS portabel',
    createdAt: '2026-08-01T08:00:00.000Z',
    updatedAt: '2026-08-05T10:00:00.000Z'
  }
];

export const INITIAL_STOCK_MUTATIONS: StockMutation[] = [
  {
    id: 'mut-001',
    itemId: 'item-bhp-001',
    itemCode: 'BHP-001',
    itemName: 'Gel Ultrasound 5 Liter',
    itemCategory: 'bhp',
    type: 'in',
    quantity: 4,
    previousStock: 2,
    newStock: 6,
    unit: 'Galon 5L',
    date: '2026-08-15',
    officerName: 'Najjah, S.Kep',
    recipientOrSource: 'Penerimaan Drop Rutin Farmasi & Logistik RSPP',
    notes: 'Restock bulanan gel USG untuk seluruh bed elektroterapi',
    createdAt: '2026-08-15T09:30:00.000Z'
  },
  {
    id: 'mut-002',
    itemId: 'item-bhp-002',
    itemCode: 'BHP-002',
    itemName: 'Kinesiotape Elastis 5cm x 5m',
    itemCategory: 'bhp',
    type: 'out',
    quantity: 2,
    previousStock: 16,
    newStock: 14,
    unit: 'Roll',
    date: '2026-08-25',
    officerName: 'Ammell, S.FT',
    recipientOrSource: 'Penggunaan Poli Fisioterapi Pasien Nyeri Lutut & Bahu',
    notes: 'Dipakai untuk 6 pasien rawat jalan poli pagi',
    createdAt: '2026-08-25T11:00:00.000Z'
  },
  {
    id: 'mut-003',
    itemId: 'item-atk-001',
    itemCode: 'ATK-001',
    itemName: 'Kertas HVS A4 80 Gram',
    itemCategory: 'logistik_atk',
    type: 'in',
    quantity: 5,
    previousStock: 3,
    newStock: 8,
    unit: 'Rim',
    date: '2026-08-19',
    officerName: 'Ayu, Amd.Kep',
    recipientOrSource: 'Gudang Pengadaan ATK Rumah Sakit',
    notes: 'Amprahan ATK pertengahan bulan',
    createdAt: '2026-08-19T13:00:00.000Z'
  },
  {
    id: 'mut-004',
    itemId: 'item-ot-002',
    itemCode: 'ALT-OT-002',
    itemName: 'Therapy Putty / Plastisin Terapi Hand Rehab',
    itemCategory: 'alat_okupasi',
    type: 'in',
    quantity: 4,
    previousStock: 4,
    newStock: 8,
    unit: 'Pot (85 gram)',
    date: '2026-08-20',
    officerName: 'Cecep, A.Md.OT',
    recipientOrSource: 'Pengadaan Sarana Terapi Okupasi',
    notes: 'Tambahan varian warna merah dan hijau untuk pediatrik',
    createdAt: '2026-08-20T10:15:00.000Z'
  }
];

// ==========================================
// CENTRAL DATABASE ASYNC SYNC ENGINE
// ==========================================

export interface InventoryCompleteState {
  items: InventoryItem[];
  mutations: StockMutation[];
  lastUpdated?: string;
}

/**
 * Fetch complete inventory data from central server database,
 * update local cache, and return state.
 */
export const fetchInventoryFromDb = async (): Promise<InventoryCompleteState | null> => {
  let serverData: InventoryCompleteState | null = null;
  try {
    const res = await fetch('/api/inventory');
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data === 'object') {
        serverData = data;
      }
    }
  } catch (err) {
    console.warn('Could not fetch from /api/inventory, checking Cloud Firestore...', err);
  }

  const hasServerData = serverData && (
    (Array.isArray(serverData.items) && serverData.items.length > 0) ||
    (Array.isArray(serverData.mutations) && serverData.mutations.length > 0)
  );

  if (hasServerData && serverData) {
    if (Array.isArray(serverData.items)) {
      localStorage.setItem(INVENTORY_ITEMS_STORAGE_KEY, JSON.stringify(serverData.items));
    }
    if (Array.isArray(serverData.mutations)) {
      localStorage.setItem(STOCK_MUTATIONS_STORAGE_KEY, JSON.stringify(serverData.mutations));
    }
    return serverData;
  }

  // If server is empty or cold-started, query Cloud Firestore as durable source of truth
  try {
    const cloudState = await cloudDatabaseService.getInventoryState();
    if (cloudState && typeof cloudState === 'object') {
      const hasCloudData = (
        (Array.isArray(cloudState.items) && cloudState.items.length > 0) ||
        (Array.isArray(cloudState.mutations) && cloudState.mutations.length > 0)
      );

      if (hasCloudData) {
        if (Array.isArray(cloudState.items)) {
          localStorage.setItem(INVENTORY_ITEMS_STORAGE_KEY, JSON.stringify(cloudState.items));
        }
        if (Array.isArray(cloudState.mutations)) {
          localStorage.setItem(STOCK_MUTATIONS_STORAGE_KEY, JSON.stringify(cloudState.mutations));
        }

        // Backfill server in background
        fetch('/api/inventory', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(cloudState)
        }).catch(e => console.warn('Background server Inventory heal error:', e));

        return cloudState as InventoryCompleteState;
      }
    }
  } catch (cloudErr) {
    console.warn('Cloud Firestore Inventory fallback error:', cloudErr);
  }

  return serverData;
};

/**
 * Save complete or partial inventory state to central server database + Firestore
 */
export const persistInventoryStateToDb = async (partialState: Partial<InventoryCompleteState>): Promise<boolean> => {
  try {
    // 1. Broadcast locally
    if (inventoryChannel) {
      inventoryChannel.postMessage({ type: 'INVENTORY_UPDATED', payload: partialState });
    }

    // 2. Push to Express backend API
    fetch('/api/inventory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(partialState)
    }).catch(e => console.warn('Inventory API push error:', e));

    // 3. Push to Cloud Firestore
    cloudDatabaseService.saveInventoryState(partialState).catch(e => {
      console.warn('Inventory Firestore push error:', e);
    });

    return true;
  } catch (err) {
    console.error('Failed to persist inventory state to DB:', err);
    return false;
  }
};

/**
 * Subscribe to real-time inventory changes across tabs & devices
 */
export const subscribeInventorySync = (onSync: (data: any) => void): (() => void) => {
  // A. BroadcastChannel listener (same browser, other tabs)
  const handleBcMessage = (event: MessageEvent) => {
    if (event.data && event.data.type === 'INVENTORY_UPDATED') {
      onSync(event.data.payload);
    }
  };
  if (inventoryChannel) {
    inventoryChannel.addEventListener('message', handleBcMessage);
  }

  // B. Firestore real-time listener (cross-device)
  const unsubscribeFirestore = cloudDatabaseService.subscribeInventoryState((data) => {
    if (data) {
      if (Array.isArray(data.items)) {
        localStorage.setItem(INVENTORY_ITEMS_STORAGE_KEY, JSON.stringify(data.items));
      }
      if (Array.isArray(data.mutations)) {
        localStorage.setItem(STOCK_MUTATIONS_STORAGE_KEY, JSON.stringify(data.mutations));
      }
      onSync(data);
    }
  });

  return () => {
    if (inventoryChannel) {
      inventoryChannel.removeEventListener('message', handleBcMessage);
    }
    unsubscribeFirestore();
  };
};

// LocalStorage helpers
export const getInventoryItems = (): InventoryItem[] => {
  if (typeof window === 'undefined') return INITIAL_INVENTORY_ITEMS;
  try {
    const saved = localStorage.getItem(INVENTORY_ITEMS_STORAGE_KEY);
    if (!saved) {
      localStorage.setItem(INVENTORY_ITEMS_STORAGE_KEY, JSON.stringify(INITIAL_INVENTORY_ITEMS));
      return INITIAL_INVENTORY_ITEMS;
    }
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_INVENTORY_ITEMS;
  } catch (err) {
    console.error('Error reading inventory items:', err);
    return INITIAL_INVENTORY_ITEMS;
  }
};

export const saveInventoryItems = (items: InventoryItem[]): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(INVENTORY_ITEMS_STORAGE_KEY, JSON.stringify(items));
    persistInventoryStateToDb({ items });
  } catch (err) {
    console.error('Error saving inventory items:', err);
  }
};

export const getStockMutations = (): StockMutation[] => {
  if (typeof window === 'undefined') return INITIAL_STOCK_MUTATIONS;
  try {
    const saved = localStorage.getItem(STOCK_MUTATIONS_STORAGE_KEY);
    if (!saved) {
      localStorage.setItem(STOCK_MUTATIONS_STORAGE_KEY, JSON.stringify(INITIAL_STOCK_MUTATIONS));
      return INITIAL_STOCK_MUTATIONS;
    }
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed : INITIAL_STOCK_MUTATIONS;
  } catch (err) {
    console.error('Error reading stock mutations:', err);
    return INITIAL_STOCK_MUTATIONS;
  }
};

export const saveStockMutations = (mutations: StockMutation[]): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STOCK_MUTATIONS_STORAGE_KEY, JSON.stringify(mutations));
    persistInventoryStateToDb({ mutations });
  } catch (err) {
    console.error('Error saving stock mutations:', err);
  }
};

// Add new inventory item
export const addInventoryItem = (itemData: Omit<InventoryItem, 'id' | 'createdAt' | 'updatedAt'>): InventoryItem => {
  const items = getInventoryItems();
  const newItem: InventoryItem = {
    ...itemData,
    id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  const updated = [newItem, ...items];
  saveInventoryItems(updated);
  return newItem;
};

// Update existing inventory item
export const updateInventoryItem = (id: string, updates: Partial<InventoryItem>): InventoryItem[] => {
  const items = getInventoryItems();
  const updated = items.map(item => {
    if (item.id === id) {
      return {
        ...item,
        ...updates,
        updatedAt: new Date().toISOString()
      };
    }
    return item;
  });
  saveInventoryItems(updated);
  return updated;
};

// Delete inventory item
export const deleteInventoryItem = (id: string): InventoryItem[] => {
  const items = getInventoryItems();
  const updated = items.filter(item => item.id !== id);
  saveInventoryItems(updated);
  return updated;
};

// Record a stock mutation (In / Out / Adjustment) and automatically update current stock
export const recordStockMutation = (mutationData: {
  itemId: string;
  type: 'in' | 'out' | 'adjustment';
  quantity: number;
  date: string;
  officerName: string;
  recipientOrSource?: string;
  notes?: string;
}): { updatedItem: InventoryItem | null; newMutation: StockMutation; allItems: InventoryItem[]; allMutations: StockMutation[] } => {
  const items = getInventoryItems();
  const mutations = getStockMutations();

  const targetItemIndex = items.findIndex(i => i.id === mutationData.itemId);
  if (targetItemIndex === -1) {
    throw new Error('Barang tidak ditemukan dalam inventaris.');
  }

  const targetItem = items[targetItemIndex];
  const previousStock = targetItem.quantity;
  let newStock = previousStock;

  if (mutationData.type === 'in') {
    newStock = previousStock + mutationData.quantity;
  } else if (mutationData.type === 'out') {
    if (mutationData.quantity > previousStock) {
      throw new Error(`Jumlah barang keluar (${mutationData.quantity} ${targetItem.unit}) melebihi stok yang ada (${previousStock} ${targetItem.unit}).`);
    }
    newStock = Math.max(0, previousStock - mutationData.quantity);
  } else if (mutationData.type === 'adjustment') {
    // In adjustment mode, quantity is the new actual counted stock
    newStock = Math.max(0, mutationData.quantity);
  }

  const updatedItem: InventoryItem = {
    ...targetItem,
    quantity: newStock,
    lastRestockDate: mutationData.type === 'in' ? mutationData.date : targetItem.lastRestockDate,
    updatedAt: new Date().toISOString()
  };

  items[targetItemIndex] = updatedItem;
  saveInventoryItems(items);

  const newMutation: StockMutation = {
    id: `mut-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    itemId: targetItem.id,
    itemCode: targetItem.code,
    itemName: targetItem.name,
    itemCategory: targetItem.category,
    type: mutationData.type,
    quantity: mutationData.type === 'adjustment' ? Math.abs(newStock - previousStock) : mutationData.quantity,
    previousStock,
    newStock,
    unit: targetItem.unit,
    date: mutationData.date,
    officerName: mutationData.officerName,
    recipientOrSource: mutationData.recipientOrSource || '',
    notes: mutationData.notes || '',
    createdAt: new Date().toISOString()
  };

  const updatedMutations = [newMutation, ...mutations];
  saveStockMutations(updatedMutations);

  return {
    updatedItem,
    newMutation,
    allItems: items,
    allMutations: updatedMutations
  };
};

// Reset to factory defaults
export const resetInventoryToDefault = (): void => {
  saveInventoryItems(INITIAL_INVENTORY_ITEMS);
  saveStockMutations(INITIAL_STOCK_MUTATIONS);
};

// Export to PDF
export const exportInventoryReportPDF = (
  items: InventoryItem[],
  mutations: StockMutation[],
  categoryFilter: string = 'all'
): void => {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  const printDateStr = new Date().toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  // Header Title
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('INSTALASI REHABILITASI MEDIS (IRM) - RS PERTAMINA PUSAT', 14, 15);
  
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text('LAPORAN INVENTARIS ALAT & STOK BAHAN HABIS PAKAI (BMHP)', 14, 21);

  doc.setFontSize(9);
  doc.text(`Dicetak Pada: ${printDateStr} | Kategori: ${categoryFilter === 'all' ? 'Semua Kategori' : getInventoryCategoryLabel(categoryFilter)}`, 14, 27);

  // Filter items
  const filteredItems = categoryFilter === 'all' 
    ? items 
    : items.filter(i => i.category === categoryFilter);

  // Table Data
  const tableData = filteredItems.map((item, idx) => {
    const status = getStockStatus(item);
    const cond = item.condition ? getConditionBadge(item.condition).label : '-';
    return [
      idx + 1,
      item.code,
      item.name,
      getInventoryCategoryLabel(item.category),
      `${item.quantity} ${item.unit}`,
      `${item.minStock} ${item.unit}`,
      status.label,
      cond,
      item.location,
      item.expiryDate || item.lastRestockDate || '-'
    ];
  });

  autoTable(doc, {
    startY: 32,
    head: [[
      'No',
      'Kode',
      'Nama Barang / Alat',
      'Kategori',
      'Stok Saat Ini',
      'Min Stok',
      'Status Stok',
      'Kondisi',
      'Lokasi Ruangan',
      'ED / Restock'
    ]],
    body: tableData,
    styles: {
      fontSize: 8,
      cellPadding: 2
    },
    headStyles: {
      fillColor: [15, 76, 92],
      textColor: 255,
      fontStyle: 'bold'
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    }
  });

  const filename = `Laporan_Inventaris_Stok_IRM_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
};

// Export to CSV
export const exportInventoryToCSV = (items: InventoryItem[]): void => {
  const headers = ['No', 'Kode Barang', 'Nama Barang / Alat', 'Kategori', 'Stok Saat Ini', 'Batas Min Stok', 'Satuan', 'Lokasi', 'Kondisi', 'Merk', 'Tanggal ED', 'Restock Terakhir', 'Catatan'];
  
  const rows = items.map((item, idx) => [
    idx + 1,
    `"${item.code}"`,
    `"${item.name.replace(/"/g, '""')}"`,
    `"${getInventoryCategoryLabel(item.category)}"`,
    item.quantity,
    item.minStock,
    `"${item.unit}"`,
    `"${item.location}"`,
    `"${item.condition || '-'}"`,
    `"${item.brand || '-'}"`,
    `"${item.expiryDate || '-'}"`,
    `"${item.lastRestockDate || '-'}"`,
    `"${(item.notes || '').replace(/"/g, '""')}"`
  ]);

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `Inventaris_Stok_IRM_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
