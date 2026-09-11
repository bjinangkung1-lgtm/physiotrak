export type RehabilitationDiscipline = 'FT' | 'OT' | 'TW' | 'ALL';

export interface IcfDiagnosisItem {
  code?: string;
  name: string;
  icfCode?: string;
  description?: string;
  discipline: RehabilitationDiscipline;
  disciplineName: string;
  keywords?: string[];
}

export interface IcfDiagnosisCategory {
  category: string;
  discipline: RehabilitationDiscipline;
  disciplineLabel: string;
  disciplineBadge: string;
  items: IcfDiagnosisItem[];
}

export const ICF_DIAGNOSES: IcfDiagnosisCategory[] = [
  // ==========================================
  // FISIOTERAPI (FT) - MUSKULOSKELETAL & SPINE
  // ==========================================
  {
    category: 'FT - Muskuloskeletal & Nyeri Tulang Belakang',
    discipline: 'FT',
    disciplineLabel: 'Fisioterapi (FT)',
    disciplineBadge: 'bg-blue-100 text-blue-800 border-blue-200',
    items: [
      {
        name: 'LBP / Nyeri Pinggang Bawah (Low Back Pain)',
        icfCode: 'b280 / b710',
        description: 'Gangguan mobilitas lumbal & sensasi nyeri tulang belakang',
        discipline: 'FT',
        disciplineName: 'Fisioterapi',
        keywords: ['lbp', 'pinggang', 'lumbal', 'back pain', 'ischialgia', 'nyeri punggung'],
      },
      {
        name: 'HNP Lumbal / Radikulopati / Ischialgia',
        icfCode: 'b280 / b735',
        description: 'Kompresi saraf lumbal, nyeri radikular & parestesia tungkai',
        discipline: 'FT',
        disciplineName: 'Fisioterapi',
        keywords: ['hnp lumbal', 'radikulopati', 'sciatica', 'saraf terjepit', 'hernia nukleus'],
      },
      {
        name: 'Cervical Syndrome / Nyeri Leher / HNP Cervical',
        icfCode: 'b280 / b710',
        description: 'Gangguan mobilitas servikal, spasme leher & nyeri menjalar lengan',
        discipline: 'FT',
        disciplineName: 'Fisioterapi',
        keywords: ['cervical', 'leher', 'neck pain', 'hnp cervical', 'brachialgia', 'kaku leher'],
      },
      {
        name: 'Spondylosis / Spondylolisthesis / Stenosis Spinal',
        icfCode: 'b710 / b280',
        description: 'Degenerasi diskus/sendi faset tulang belakang & klaudikasio',
        discipline: 'FT',
        disciplineName: 'Fisioterapi',
        keywords: ['spondylosis', 'spondylolisthesis', 'stenosis spinal', 'pengapuran tulang belakang'],
      },
      {
        name: 'Skoliosis / Kifosis / Deformitas Postur',
        icfCode: 's760 / b710',
        description: 'Deviasi kurvatura tulang belakang & asimetri postur tubuh',
        discipline: 'FT',
        disciplineName: 'Fisioterapi',
        keywords: ['skoliosis', 'scoliosis', 'kifosis', 'lordosis', 'postur', 'asimetri tubuh'],
      },
      {
        name: 'Ankylosing Spondylitis / Sakroiliitis',
        icfCode: 'b710 / b280',
        description: 'Inflamasi kronis sendi sakroiliaka & kekakuan rigid tulang belakang',
        discipline: 'FT',
        disciplineName: 'Fisioterapi',
        keywords: ['ankylosing', 'sakroiliitis', 'sacroiliac', 'spondyloarthritis'],
      },
    ],
  },

  // ==========================================
  // FISIOTERAPI (FT) - MUSKULOSKELETAL EKSTREMITAS & OLAHRAGA
  // ==========================================
  {
    category: 'FT - Muskuloskeletal Ekstremitas & Cedera Sendi',
    discipline: 'FT',
    disciplineLabel: 'Fisioterapi (FT)',
    disciplineBadge: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    items: [
      {
        name: 'Osteoarthritis (OA) Genu / Knee Pain',
        icfCode: 'b710 / d450',
        description: 'Degenerasi sendi lutut, krepitasi & hambatan berjalan/menaiki tangga',
        discipline: 'FT',
        disciplineName: 'Fisioterapi',
        keywords: ['oa genu', 'osteoarthritis', 'lutut', 'knee pain', 'pengapuran lutut', 'gonarthrosis'],
      },
      {
        name: 'Frozen Shoulder / Capsulitis Adhesiva / Kaku Bahu',
        icfCode: 'b710',
        description: 'Kekakuan kapsul sendi glenohumeral & keterbatasan lingkup gerak sendi (LGS)',
        discipline: 'FT',
        disciplineName: 'Fisioterapi',
        keywords: ['frozen shoulder', 'capsulitis adhesiva', 'bahu', 'kaku bahu', 'shoulder stiffness'],
      },
      {
        name: 'Rotator Cuff Tendinopathy / Impingement Bahu',
        icfCode: 'b710 / b730',
        description: 'Inflamasi tendon supraspinatus/rotator cuff & nyeri saat elevasi lengan',
        discipline: 'FT',
        disciplineName: 'Fisioterapi',
        keywords: ['rotator cuff', 'impingement', 'supraspinatus', 'tendinitis bahu'],
      },
      {
        name: 'Tennis / Golfer Elbow (Epicondylitis Lateral/Medial)',
        icfCode: 'b280 / b730',
        description: 'Inflamasi origo tendon ekstensor/fleksor pergelangan tangan & nyeri siku',
        discipline: 'FT',
        disciplineName: 'Fisioterapi',
        keywords: ['tennis elbow', 'golfer elbow', 'epicondylitis', 'nyeri siku'],
      },
      {
        name: 'CTS / Carpal Tunnel Syndrome',
        icfCode: 'b280 / b730',
        description: 'Jepitan N. Medianus di terowongan karpal, kesemutan & kelemahan genggaman tangan',
        discipline: 'FT',
        disciplineName: 'Fisioterapi',
        keywords: ['cts', 'carpal tunnel', 'kesemutan tangan', 'kebas jari', 'n medianus'],
      },
      {
        name: 'De Quervain Tenosynovitis / Trigger Finger',
        icfCode: 'b730 / d440',
        description: 'Inflamasi sarung tendon abduktor ibu jari atau fleksi jari macet',
        discipline: 'FT',
        disciplineName: 'Fisioterapi',
        keywords: ['de quervain', 'trigger finger', 'tendinitis ibu jari', 'jari terkunci', 'snapping finger'],
      },
      {
        name: 'Plantar Fasciitis / Calcaneal Spur',
        icfCode: 'b280 / d450',
        description: 'Inflamasi fasia plantaris, nyeri tumit saat langkah pertama pagi hari',
        discipline: 'FT',
        disciplineName: 'Fisioterapi',
        keywords: ['plantar fasciitis', 'calcaneal spur', 'taji tumit', 'nyeri tumit', 'fascia telapak kaki'],
      },
      {
        name: 'Ankle Sprain / Cedera Ligamen Ankle',
        icfCode: 'b715 / d450',
        description: 'Cedera ligamen talofibular/kalkaneofibular & instabilitas pergelangan kaki',
        discipline: 'FT',
        disciplineName: 'Fisioterapi',
        keywords: ['ankle sprain', 'terkilir', 'cedera ligamen ankle', 'kaki keseleo'],
      },
      {
        name: 'Cedera Ligamen ACL / PCL / Meniscus Knee',
        icfCode: 'b715 / d450',
        description: 'Ruptur/strain ligamen krusiatum & robekan meniskus pasca cedera olahraga',
        discipline: 'FT',
        disciplineName: 'Fisioterapi',
        keywords: ['acl', 'pcl', 'meniscus', 'ligamen lutut', 'cedera lutut olahraga'],
      },
      {
        name: 'Post Fraktur / Post ORIF / Kekakuan Sendi',
        icfCode: 'b710 / d410',
        description: 'Kekakuan sendi pasca imobilisasi gips/operasi pasang plat fiksasi internal',
        discipline: 'FT',
        disciplineName: 'Fisioterapi',
        keywords: ['post fraktur', 'post orif', 'patah tulang', 'kekakuan sendi post op', 'imobilisasi'],
      },
      {
        name: 'Total Knee / Hip Arthroplasty (TKA / THA) Post-Op',
        icfCode: 'b710 / d450',
        description: 'Rehabilitasi mobilisasi dini & latihan pola jalan pasca ganti sendi panggul/lutut',
        discipline: 'FT',
        disciplineName: 'Fisioterapi',
        keywords: ['tka', 'tha', 'total knee replacement', 'total hip replacement', 'ganti sendi'],
      },
    ],
  },

  // ==========================================
  // FISIOTERAPI (FT) - NEUROLOGIS & NEUROMUSKULAR
  // ==========================================
  {
    category: 'FT - Neurologis & Neuromuskular Dewasa',
    discipline: 'FT',
    disciplineLabel: 'Fisioterapi (FT)',
    disciplineBadge: 'bg-purple-100 text-purple-800 border-purple-200',
    items: [
      {
        name: 'Hemiparese / Post Stroke (Fase Flaksid / Spastik)',
        icfCode: 'b730 / d450',
        description: 'Kelumpuhan separuh tubuh, kontrol motorik abnormal & hambatan berjalan',
        discipline: 'FT',
        disciplineName: 'Fisioterapi',
        keywords: ['stroke', 'hemiparese', 'hemiplegia', 'lumpuh separuh', 'pasca stroke', 'cva'],
      },
      {
        name: 'Bell\'s Palsy / Parese N. Facialis (Wajah Miring)',
        icfCode: 's110 / b730',
        description: 'Kelumpuhan otot mimik wajah sesisi & lagoftalmus (mata sulit menutup)',
        discipline: 'FT',
        disciplineName: 'Fisioterapi',
        keywords: ['bell\'s palsy', 'bells palsy', 'parese facialis', 'mulut miring', 'wajah perot', 'n vii'],
      },
      {
        name: 'Paraparese / Tetraplegia (Spinal Cord Injury / SCI)',
        icfCode: 'b730 / d450',
        description: 'Kelumpuhan kedua tungkai atau empat ekstremitas pasca cedera medula spinalis',
        discipline: 'FT',
        disciplineName: 'Fisioterapi',
        keywords: ['paraparese', 'tetraplegia', 'quadriplegia', 'spinal cord injury', 'sci', 'cedera saraf tulang belakang'],
      },
      {
        name: 'Parkinson\'s Disease / Gangguan Keseimbangan & Gait',
        icfCode: 'b760 / d450',
        description: 'Bradikinesia, rigiditas otot, tremor istirahat & freezing saat melangkah',
        discipline: 'FT',
        disciplineName: 'Fisioterapi',
        keywords: ['parkinson', 'parkinsonism', 'tremor', 'freezing gait', 'keseimbangan goyah'],
      },
      {
        name: 'Neuropati Perifer / Diabetic Polyneuropathy',
        icfCode: 'b265 / d450',
        description: 'Mati rasa telapak kaki, sensasi kesemutan stocking-glove & ataksia sensorik',
        discipline: 'FT',
        disciplineName: 'Fisioterapi',
        keywords: ['neuropati', 'neuropathy', 'neuropati perifer', 'diabetic neuropathy', 'kebas telapak kaki'],
      },
      {
        name: 'Guillain-Barré Syndrome (GBS)',
        icfCode: 'b730 / b740',
        description: 'Polineuropati inflamasi akut dengan kelemahan flaksid asenden dari tungkai',
        discipline: 'FT',
        disciplineName: 'Fisioterapi',
        keywords: ['gbs', 'guillain barre', 'polineuropati akut', 'kelemahan flaksid'],
      },
      {
        name: 'Vertigo Vestibular / BPPV / Gangguan Keseimbangan',
        icfCode: 'b235 / d450',
        description: 'Sensasi berputar saat perubahan posisi kepala & gangguan keseimbangan statis/dinamis',
        discipline: 'FT',
        disciplineName: 'Fisioterapi',
        keywords: ['vertigo', 'bppv', 'vestibular', 'pusing berputar', 'dizziness', 'gangguan keseimbangan'],
      },
      {
        name: 'Post Kraniotomi / Cedera Kepala Traumatik (TBI)',
        icfCode: 'b760 / d450',
        description: 'Rehabilitasi motorik, transfer fungsional & mobilisasi pasca bedah kepala',
        discipline: 'FT',
        disciplineName: 'Fisioterapi',
        keywords: ['kraniotomi', 'tbi', 'cedera kepala', 'post craniotomy', 'trauma kapitis'],
      },
    ],
  },

  // ==========================================
  // FISIOTERAPI (FT) - KARDIORESPIRASI & PEDIATRIK
  // ==========================================
  {
    category: 'FT - Kardiorespirasi, Vaskular & Pediatrik Fisik',
    discipline: 'FT',
    disciplineLabel: 'Fisioterapi (FT)',
    disciplineBadge: 'bg-teal-100 text-teal-800 border-teal-200',
    items: [
      {
        name: 'PPOK / Asma Bronkial / Gangguan Pola Nafas',
        icfCode: 'b440 / b455',
        description: 'Obstruksi jalan nafas kronis, spasme bronkus, sesak & penurunan toleransi aktivitas',
        discipline: 'FT',
        disciplineName: 'Fisioterapi',
        keywords: ['ppok', 'copd', 'asma', 'asthma', 'sesak nafas', 'bronkitis', 'emfisema'],
      },
      {
        name: 'Post Pneumonia / Retensi Sputum & Atelektasis',
        icfCode: 'b450',
        description: 'Penumpukan sekret di saluran pernafasan, batuk tidak efektif & restriksi paru',
        discipline: 'FT',
        disciplineName: 'Fisioterapi',
        keywords: ['pneumonia', 'sputum', 'dahak menumpuk', 'retensi sekret', 'atelektasis'],
      },
      {
        name: 'Post Bedah Toraks / Jantung / CABG',
        icfCode: 'b410 / b455',
        description: 'Mobilisasi toraks, ekspansi paru & peningkatan toleransi kardiovaskular',
        discipline: 'FT',
        disciplineName: 'Fisioterapi',
        keywords: ['cabg', 'post bedah toraks', 'rehabilitasi jantung', 'post op jantung', 'sternotomi'],
      },
      {
        name: 'Dekondisi Fisik / Tirah Baring Lama (ICU-AW)',
        icfCode: 'b455 / d410',
        description: 'Atrofi otot disuse, kelemahan umum & ketergantungan transfer tempat tidur',
        discipline: 'FT',
        disciplineName: 'Fisioterapi',
        keywords: ['dekondisi', 'tirah baring', 'bed rest', 'icu acquired weakness', 'lemah fisik'],
      },
      {
        name: 'Limfedema / Insufisiensi Vaskular & DVT',
        icfCode: 'b435 / s420',
        description: 'Pembengkakan ekstremitas akibat stasis cairan limfatik/gangguan aliran vena',
        discipline: 'FT',
        disciplineName: 'Fisioterapi',
        keywords: ['limfedema', 'lymphedema', 'dvt', 'edema tungkai', 'bengkak kaki vaskular'],
      },
      {
        name: 'Cerebral Palsy (CP Spastik / Diskinetik / Ataksik)',
        icfCode: 'b760 / d410',
        description: 'Abnormalitas tonus postural, spastisitas & hambatan tahapan perkembangan motorik kasar',
        discipline: 'FT',
        disciplineName: 'Fisioterapi',
        keywords: ['cerebral palsy', 'cp', 'cp spastik', 'anak lumpuh otak', 'spastisitas anak'],
      },
      {
        name: 'Global Developmental Delay (GDD) - Motorik Kasar',
        icfCode: 'b760 / d450',
        description: 'Keterlambatan tonggak motorik kasar anak (berguling, duduk, merangkak, berdiri, berjalan)',
        discipline: 'FT',
        disciplineName: 'Fisioterapi',
        keywords: ['gdd motorik', 'delayed development', 'terlambat jalan', 'belum bisa duduk'],
      },
      {
        name: 'Down Syndrome (Hipotonia & Motorik Kasar)',
        icfCode: 'b735 / d410',
        description: 'Hipotonia generalisata, hipermobilitas sendi & keterlambatan motorik postural',
        discipline: 'FT',
        disciplineName: 'Fisioterapi',
        keywords: ['down syndrome', 'hipotonia', 'down sindrom motorik', 'floppy child'],
      },
      {
        name: 'Congenital Talipes Equinovarus (CTEV) / Clubfoot / Flatfoot',
        icfCode: 's750 / d450',
        description: 'Deformitas equinovarus kongenital pada kaki anak & gangguan tumpuan berat badan',
        discipline: 'FT',
        disciplineName: 'Fisioterapi',
        keywords: ['ctev', 'clubfoot', 'kaki bengkok anak', 'pes planus', 'flatfoot'],
      },
      {
        name: 'Torticollis Kongenital / Spasmus Leher Bayi',
        icfCode: 'b710 / s760',
        description: 'Kontraktur M. Sternocleidomastoideus & kemiringan asimetris posisi kepala bayi',
        discipline: 'FT',
        disciplineName: 'Fisioterapi',
        keywords: ['torticollis', 'leher miring bayi', 'sternocleidomastoid', 'kaku leher bayi'],
      },
    ],
  },

  // ==========================================
  // OKUPASI TERAPI (OT) - PEDIATRIK & SENSORI INTEGRASI
  // ==========================================
  {
    category: 'OT - Pediatrik, Sensori Integrasi & Perilaku',
    discipline: 'OT',
    disciplineLabel: 'Okupasi Terapi (OT)',
    disciplineBadge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    items: [
      {
        name: 'Gangguan Sensori Integrasi (Sensory Processing Disorder / SPD)',
        icfCode: 'b156 / b760',
        description: 'Hipersensitif/hiposensitif terhadap stimulasi taktil, vestibular & proprioseptif',
        discipline: 'OT',
        disciplineName: 'Okupasi Terapi',
        keywords: ['sensori integrasi', 'spd', 'sensory processing', 'taktil', 'vestibular', 'sensori'],
      },
      {
        name: 'Autism Spectrum Disorder (ASD) & Interaksi Okupasi',
        icfCode: 'b122 / d710',
        description: 'Hambatan atensi bersama, stereotipik motorik & kesulitan adaptasi lingkungan',
        discipline: 'OT',
        disciplineName: 'Okupasi Terapi',
        keywords: ['autis', 'asd', 'autisme', 'autism spectrum', 'kontak mata kurang', 'stereotipik'],
      },
      {
        name: 'ADHD / GPPH (Gangguan Pemusatan Perhatian & Hiperaktivitas)',
        icfCode: 'b140 / d160',
        description: 'Impulsivitas, konsentrasi mudah teralih & ketidakmampuan menyelesaikan tugas terstruktur',
        discipline: 'OT',
        disciplineName: 'Okupasi Terapi',
        keywords: ['adhd', 'gpph', 'hiperaktif', 'tidak fokus', 'impulsif', 'pemusatan perhatian'],
      },
      {
        name: 'Keterlambatan Motorik Halus / Pre-Writing / Disgrafia',
        icfCode: 'b760 / d440',
        description: 'Kelemahan kekuatan genggaman jemari, koordinasi bilateral & kesulitan memegang pensil/menulis',
        discipline: 'OT',
        disciplineName: 'Okupasi Terapi',
        keywords: ['motorik halus', 'fine motor', 'pre-writing', 'disgrafia', 'pencil grip', 'gunting kancing'],
      },
      {
        name: 'Keterlambatan Kemandirian Bina Diri / ADL Anak',
        icfCode: 'd510 / d550',
        description: 'Ketergantungan pada aktivitas makan mandiri, berpakaian, memakai sepatu & toilet training',
        discipline: 'OT',
        disciplineName: 'Okupasi Terapi',
        keywords: ['bina diri', 'adl anak', 'toilet training', 'makan sendiri', 'kemandirian anak'],
      },
      {
        name: 'Gangguan Perilaku Makan Anak / Sensory Feeding Disorder',
        icfCode: 'b510 / d550',
        description: 'Aversi tekstur makanan tertentu (picky eater berat), hipersensitivitas oral sensorik',
        discipline: 'OT',
        disciplineName: 'Okupasi Terapi',
        keywords: ['feeding disorder', 'picky eater', 'sulit makan sensori', 'aversi tekstur makanan'],
      },
      {
        name: 'Retardasi Mental / Intellectual Disability & Keterampilan Adaptif',
        icfCode: 'b117 / d5',
        description: 'Keterbatasan fungsi kognitif adaptif & kemandirian fungsional harian',
        discipline: 'OT',
        disciplineName: 'Okupasi Terapi',
        keywords: ['retardasi mental', 'intellectual disability', 'tunagrahita', 'fungsi adaptif'],
      },
      {
        name: 'Down Syndrome / CP - Okupasi Motorik Halus & Play Skills',
        icfCode: 'b760 / d155',
        description: 'Pengembangan integrasi bilateral, manipulasi objek permainan & persepsi visual motorik',
        discipline: 'OT',
        disciplineName: 'Okupasi Terapi',
        keywords: ['ot down syndrome', 'ot cp', 'play skills', 'manipulasi objek', 'visual motorik'],
      },
    ],
  },

  // ==========================================
  // OKUPASI TERAPI (OT) - DEWASA, REHABILITASI TANGAN & ADL
  // ==========================================
  {
    category: 'OT - Dewasa, Hand Injury, Kognitif & Kemandirian ADL',
    discipline: 'OT',
    disciplineLabel: 'Okupasi Terapi (OT)',
    disciplineBadge: 'bg-cyan-100 text-cyan-800 border-cyan-200',
    items: [
      {
        name: 'Gangguan Kemandirian ADL Post Stroke (Makan, Mandi, Berpakaian)',
        icfCode: 'd510 / d550 / d6',
        description: 'Ketergantungan aktivitas bina diri dasar (BADL) & instrumental (IADL) pasca stroke',
        discipline: 'OT',
        disciplineName: 'Okupasi Terapi',
        keywords: ['adl stroke', 'kemandirian stroke', 'mandi makan mandiri', 'ot post stroke', 'iadl'],
      },
      {
        name: 'Hand Injury / Post Tendon Repair / Splinting Ortotik',
        icfCode: 's730 / d440',
        description: 'Rehabilitasi fungsional jemari tangan, tenodesis grasp & pembuatan splint adaptif/ortosis',
        discipline: 'OT',
        disciplineName: 'Okupasi Terapi',
        keywords: ['hand injury', 'cedera tangan', 'tendon repair', 'splinting', 'ortotik tangan', 'rehab tangan'],
      },
      {
        name: 'Gangguan Kognitif / Demensia / Alzheimer / Pasca Trauma Kepala',
        icfCode: 'b144 / b164',
        description: 'Penurunan memori kerja, fungsi eksekutif, kemampuan sequencing & pemecahan masalah',
        discipline: 'OT',
        disciplineName: 'Okupasi Terapi',
        keywords: ['demensia', 'alzheimer', 'kognitif', 'daya ingat', 'fungsi eksekutif', 'sequencing'],
      },
      {
        name: 'Penurunan Fungsi Okupasi Geriatri & Manajemen Risiko Jatuh',
        icfCode: 'b130 / d640',
        description: 'Penyesuaian rutinitas lanjut usia, modifikasi bahaya lingkungan rumah & pencegahan jatuh',
        discipline: 'OT',
        disciplineName: 'Okupasi Terapi',
        keywords: ['geriatri ot', 'lansia mandiri', 'risiko jatuh', 'adaptasi lingkungan rumah'],
      },
      {
        name: 'Preskripsi Alat Bantu Adaptif & Modifikasi Kursi Roda',
        icfCode: 'e115 / e120 / d465',
        description: 'Penyesuaian perabot rumah, pegangan kamar mandi, sendok modifikasi & positioning kursi roda',
        discipline: 'OT',
        disciplineName: 'Okupasi Terapi',
        keywords: ['alat bantu adaptif', 'kursi roda', 'wheelchair modification', 'ergonomi rumah'],
      },
      {
        name: 'Gangguan Psikososial / Depresi / Kecemasan Terkait Okupasi',
        icfCode: 'b152 / d720',
        description: 'Restrukturisasi jadwal produktivitas, manajemen stres & integrasi kembali ke pekerjaan',
        discipline: 'OT',
        disciplineName: 'Okupasi Terapi',
        keywords: ['psikososial', 'depresi okupasi', 'kembali bekerja', 'return to work'],
      },
    ],
  },

  // ==========================================
  // TERAPI WICARA (TW) - PEDIATRIK (BAHASA, BICARA & ORAL MOTOR)
  // ==========================================
  {
    category: 'TW - Bahasa, Bicara & Komunikasi Pediatrik',
    discipline: 'TW',
    disciplineLabel: 'Terapi Wicara (TW)',
    disciplineBadge: 'bg-amber-100 text-amber-800 border-amber-200',
    items: [
      {
        name: 'Speech Delay / Keterlambatan Bicara & Bahasa Perkembangan',
        icfCode: 'b310 / d310',
        description: 'Keterlambatan produksi kata pertama, perbendaharaan kosakata minim & pembentukan kalimat',
        discipline: 'TW',
        disciplineName: 'Terapi Wicara',
        keywords: ['speech delay', 'terlambat bicara', 'belum bisa ngomong', 'bicara lambat anak', 'kosa kata minim'],
      },
      {
        name: 'Gangguan Artikulasi & Fonologi (Dislalia / Cadel / Pelat)',
        icfCode: 'b320 / d330',
        description: 'Kesalahan substitusi, distorsi, omisi konsonan (misal r/s/k) sehingga artikulasi tidak jelas',
        discipline: 'TW',
        disciplineName: 'Terapi Wicara',
        keywords: ['cadel', 'dislalia', 'gangguan artikulasi', 'pelat bicara', 'fonologi', 'huruf r'],
      },
      {
        name: 'Gagap / Stuttering (Gangguan Kelancaran Bicara / Fluency)',
        icfCode: 'b330 / d330',
        description: 'Repetisi suku kata, prolongasi suara & bloking saat memulai percakapan',
        discipline: 'TW',
        disciplineName: 'Terapi Wicara',
        keywords: ['gagap', 'stuttering', 'kelancaran bicara', 'fluency', 'bicara tersendat'],
      },
      {
        name: 'Developmental Language Disorder (DLD) / Gangguan Bahasa Reseptif-Ekspresif',
        icfCode: 'b167 / d310',
        description: 'Kesulitan memahami instruksi bahasa lisan dan/atau menyusun struktur tata bahasa',
        discipline: 'TW',
        disciplineName: 'Terapi Wicara',
        keywords: ['dld', 'bahasa reseptif', 'bahasa ekspresif', 'gangguan bahasa spesifik', 'sulit paham kalimat'],
      },
      {
        name: 'Gangguan Bicara Pasca Operasi Labiopalatoskisis (Sumbing)',
        icfCode: 's320 / b320',
        description: 'Insufisiensi velofaringeal, resonansi hipernasalitas & emisi udara hidung saat bicara',
        discipline: 'TW',
        disciplineName: 'Terapi Wicara',
        keywords: ['labiopalatoskisis', 'sumbing', 'hipernasal', 'bibir sumbing bicara', 'suara sengau'],
      },
      {
        name: 'Gangguan Bicara Akibat Gangguan Pendengaran (Tunarungu)',
        icfCode: 'b230 / b310',
        description: 'Rehabilitasi auditori verbal & kejelasan pengucapan kata pasca penggunaan alat bantu dengar/implan koklea',
        discipline: 'TW',
        disciplineName: 'Terapi Wicara',
        keywords: ['tunarungu', 'gangguan dengar', 'alat bantu dengar', 'implan koklea bicara', 'avt'],
      },
      {
        name: 'Oral Motor Weakness & Drooling (Hipersalivasi / Ngeces)',
        icfCode: 'b510 / b320',
        description: 'Kelemahan tonus otot bibir/lidah, refleks menelan saliva lambat & kontrol oromotor anak',
        discipline: 'TW',
        disciplineName: 'Terapi Wicara',
        keywords: ['drooling', 'ngeces', 'oral motor', 'hipersalivasi', 'otot bibir lemah'],
      },
    ],
  },

  // ==========================================
  // TERAPI WICARA (TW) - DEWASA, AFASIA, DISFAGIA & SUARA
  // ==========================================
  {
    category: 'TW - Afasia, Disartria, Disfagia & Gangguan Suara Dewasa',
    discipline: 'TW',
    disciplineLabel: 'Terapi Wicara (TW)',
    disciplineBadge: 'bg-rose-100 text-rose-800 border-rose-200',
    items: [
      {
        name: 'Afasia Motorik / Ekspresif (Broca) Post Stroke',
        icfCode: 'b167 / d310',
        description: 'Pemahaman bahasa baik namun kesulitan memproduksi kata/berbicara lancar (anomia berat)',
        discipline: 'TW',
        disciplineName: 'Terapi Wicara',
        keywords: ['afasia motorik', 'afasia broca', 'sulit bicara stroke', 'tidak bisa keluar kata'],
      },
      {
        name: 'Afasia Sensorik / Reseptif (Wernicke) Post Stroke',
        icfCode: 'b167 / d310',
        description: 'Bicara lancar namun tidak bermakna (jargon) & gangguan pemahaman bahasa verbal',
        discipline: 'TW',
        disciplineName: 'Terapi Wicara',
        keywords: ['afasia sensorik', 'afasia wernicke', 'bicara ngelantur stroke', 'tidak paham ucapan'],
      },
      {
        name: 'Afasia Global / Campuran Pasca Cedera Otak / Stroke Luas',
        icfCode: 'b167 / d310',
        description: 'Gangguan berat pada pemahaman reseptif maupun kemampuan ekspresif berbahasa',
        discipline: 'TW',
        disciplineName: 'Terapi Wicara',
        keywords: ['afasia global', 'afasia campuran', 'lumpuh bahasa', 'stroke luas bahasa'],
      },
      {
        name: 'Disartria (Pelo / Bicara Tidak Jelas Pasca Stroke / Parkinson)',
        icfCode: 'b320 / d330',
        description: 'Kelemahan/kelumpuhan neuromuskular otot artikulasi, bicara pelo & volume suara melemah',
        discipline: 'TW',
        disciplineName: 'Terapi Wicara',
        keywords: ['disartria', 'dysarthria', 'bicara pelo', 'bicara cadel dewasa', 'pelo stroke'],
      },
      {
        name: 'Apraksia Bicara Dewasa (Verbal Apraxia / Motor Speech Planning)',
        icfCode: 'b176 / b320',
        description: 'Gangguan perencanaan motorik artikulasi, kesalahan bunyi inkonsisten tanpa kelemahan otot',
        discipline: 'TW',
        disciplineName: 'Terapi Wicara',
        keywords: ['apraksia bicara', 'verbal apraxia', 'planning bicara', 'motor speech disorder'],
      },
      {
        name: 'Disfagia / Gangguan Menelan Fase Oral & Faringeal',
        icfCode: 'b510 / d550',
        description: 'Tersedak saat makan/minum, kesulitan pembentukan bolus & risiko aspirasi paru',
        discipline: 'TW',
        disciplineName: 'Terapi Wicara',
        keywords: ['disfagia', 'dysphagia', 'sulit menelan', 'sering tersedak', 'terapi menelan', 'aspirasi'],
      },
      {
        name: 'Disfonia / Gangguan Kualitas Suara (Serak / Parau Kronis)',
        icfCode: 'b310 / s340',
        description: 'Suara serak, paresis pita suara, nodul vokal & penurunan kenyaringan nada bicara',
        discipline: 'TW',
        disciplineName: 'Terapi Wicara',
        keywords: ['disfonia', 'dysphonia', 'suara serak', 'pita suara', 'suara parau', 'vocal nodule'],
      },
      {
        name: 'Post Laringektomi / Rehabilitasi Suara Alaringeal',
        icfCode: 's340 / b310',
        description: 'Pelatihan bicara esofagus / elektrolaring pasca pengangkatan laring pita suara',
        discipline: 'TW',
        disciplineName: 'Terapi Wicara',
        keywords: ['laringektomi', 'laryngectomy', 'elektrolaring', 'suara esofagus', 'bicara tanpa laring'],
      },
    ],
  },
];
