import { PatientItem, QueueBox } from '../types';
import { ICF_DIAGNOSES } from '../data/icfDiagnoses';

export interface DiagnosisCategoryTheme {
  bg: string;
  text: string;
  border: string;
  bar: string;
  badge: string;
  iconBg: string;
}

export interface UnifiedPatientDetail extends PatientItem {
  allQueueNumbers?: string[];
  allBoxIds?: string[];
  therapyPlaces?: ('FT' | 'OT' | 'TW' | string)[];
  therapistNames?: string[];
  sessionCount?: number;
  completedSessions?: number;
  activeSessions?: number;
  secondaryDiagnoses?: string[];
}

export interface DiagnosisRatingItem {
  rank: number;
  diagnosisName: string;
  icfCode?: string;
  cleanName: string;
  category: string;
  discipline: 'FT' | 'OT' | 'TW' | 'ALL';
  disciplineName: string;
  categoryTheme: DiagnosisCategoryTheme;
  totalCases: number;
  activeCases: number;
  completedCases: number;
  ranapCases: number;
  rajalCases: number;
  warningCases: number;
  percentage: number;
  relativePercentage: number;
  patients: UnifiedPatientDetail[];
  topTherapists: { officerName: string; boxTitle: string; count: number; boxId: string }[];
  commonProcedures: { code: string; count: number }[];
}

export interface DiagnosisCategorySummary {
  category: string;
  discipline: 'FT' | 'OT' | 'TW' | 'ALL';
  disciplineLabel: string;
  totalCases: number;
  percentage: number;
  uniqueDiagnosesCount: number;
  theme: DiagnosisCategoryTheme;
}

export interface DisciplineBreakdown {
  ftCases: number;
  otCases: number;
  twCases: number;
  otherCases: number;
  ftPercentage: number;
  otPercentage: number;
  twPercentage: number;
}

export interface DiagnosisAnalyticsResult {
  totalPatients: number; // Jumlah pasien unik (1 pasien terapi di 3 tempat tetap dihitung 1)
  totalSessions: number; // Total tiket/sesi terapi keseluruhan
  totalDiagnosed: number;
  uniqueDiagnosesCount: number;
  ratings: DiagnosisRatingItem[]; // Ordered from highest count to lowest count
  top3Podium: DiagnosisRatingItem[];
  categorySummaries: DiagnosisCategorySummary[];
  dominantCategory: string;
  dominantDiagnosis: DiagnosisRatingItem | null;
  disciplineBreakdown: DisciplineBreakdown;
  multiTherapyPatientsCount: number; // Jumlah pasien dengan terapi di >= 2 tempat (Fisio, OT, TW)
}

const CATEGORY_THEMES: Record<string, DiagnosisCategoryTheme> = {
  // FT Themes
  'FT - Muskuloskeletal & Nyeri Tulang Belakang': {
    bg: 'bg-blue-50/90',
    text: 'text-blue-900',
    border: 'border-blue-200',
    bar: 'bg-gradient-to-r from-blue-500 to-indigo-600',
    badge: 'bg-blue-100 text-blue-800 border-blue-200',
    iconBg: 'bg-blue-600 text-white',
  },
  'FT - Muskuloskeletal Ekstremitas & Cedera Sendi': {
    bg: 'bg-indigo-50/90',
    text: 'text-indigo-900',
    border: 'border-indigo-200',
    bar: 'bg-gradient-to-r from-indigo-500 to-blue-600',
    badge: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    iconBg: 'bg-indigo-600 text-white',
  },
  'FT - Neurologis & Neuromuskular Dewasa': {
    bg: 'bg-purple-50/90',
    text: 'text-purple-900',
    border: 'border-purple-200',
    bar: 'bg-gradient-to-r from-purple-500 to-violet-600',
    badge: 'bg-purple-100 text-purple-800 border-purple-200',
    iconBg: 'bg-purple-600 text-white',
  },
  'FT - Kardiorespirasi, Vaskular & Pediatrik Fisik': {
    bg: 'bg-teal-50/90',
    text: 'text-teal-900',
    border: 'border-teal-200',
    bar: 'bg-gradient-to-r from-teal-500 to-emerald-600',
    badge: 'bg-teal-100 text-teal-800 border-teal-200',
    iconBg: 'bg-teal-600 text-white',
  },

  // OT Themes
  'OT - Pediatrik, Sensori Integrasi & Perilaku': {
    bg: 'bg-emerald-50/90',
    text: 'text-emerald-950',
    border: 'border-emerald-200',
    bar: 'bg-gradient-to-r from-emerald-500 to-teal-600',
    badge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    iconBg: 'bg-emerald-600 text-white',
  },
  'OT - Dewasa, Hand Injury, Kognitif & Kemandirian ADL': {
    bg: 'bg-cyan-50/90',
    text: 'text-cyan-950',
    border: 'border-cyan-200',
    bar: 'bg-gradient-to-r from-cyan-500 to-blue-600',
    badge: 'bg-cyan-100 text-cyan-800 border-cyan-200',
    iconBg: 'bg-cyan-600 text-white',
  },

  // TW Themes
  'TW - Bahasa, Bicara & Komunikasi Pediatrik': {
    bg: 'bg-amber-50/90',
    text: 'text-amber-950',
    border: 'border-amber-200',
    bar: 'bg-gradient-to-r from-amber-500 to-yellow-600',
    badge: 'bg-amber-100 text-amber-800 border-amber-200',
    iconBg: 'bg-amber-500 text-white',
  },
  'TW - Afasia, Disartria, Disfagia & Gangguan Suara Dewasa': {
    bg: 'bg-rose-50/90',
    text: 'text-rose-950',
    border: 'border-rose-200',
    bar: 'bg-gradient-to-r from-rose-500 to-pink-600',
    badge: 'bg-rose-100 text-rose-800 border-rose-200',
    iconBg: 'bg-rose-600 text-white',
  },

  // Legacy & Fallback
  'Muskuloskeletal & Nyeri': {
    bg: 'bg-blue-50/80',
    text: 'text-blue-900',
    border: 'border-blue-200',
    bar: 'bg-gradient-to-r from-blue-500 to-indigo-600',
    badge: 'bg-blue-100 text-blue-800 border-blue-200',
    iconBg: 'bg-blue-600 text-white',
  },
  'Neuromuskular / Saraf': {
    bg: 'bg-purple-50/80',
    text: 'text-purple-900',
    border: 'border-purple-200',
    bar: 'bg-gradient-to-r from-purple-500 to-violet-600',
    badge: 'bg-purple-100 text-purple-800 border-purple-200',
    iconBg: 'bg-purple-600 text-white',
  },
  'Pediatrik / Anak': {
    bg: 'bg-amber-50/80',
    text: 'text-amber-900',
    border: 'border-amber-200',
    bar: 'bg-gradient-to-r from-amber-500 to-orange-500',
    badge: 'bg-amber-100 text-amber-900 border-amber-200',
    iconBg: 'bg-amber-500 text-white',
  },
  'Kardiorespirasi / Pernafasan': {
    bg: 'bg-teal-50/80',
    text: 'text-teal-900',
    border: 'border-teal-200',
    bar: 'bg-gradient-to-r from-teal-500 to-emerald-600',
    badge: 'bg-teal-100 text-teal-900 border-teal-200',
    iconBg: 'bg-teal-600 text-white',
  },
  'Geriatri & Kasus Lainnya': {
    bg: 'bg-slate-50/80',
    text: 'text-slate-900',
    border: 'border-slate-200',
    bar: 'bg-gradient-to-r from-slate-500 to-slate-700',
    badge: 'bg-slate-100 text-slate-800 border-slate-200',
    iconBg: 'bg-slate-700 text-white',
  },
};

/**
 * Normalizes a raw diagnosis string to standardize grouping
 */
export function normalizeDiagnosisText(
  rawDiag?: string,
  rawAction?: string
): {
  name: string;
  cleanName: string;
  icfCode?: string;
  category: string;
  discipline: 'FT' | 'OT' | 'TW' | 'ALL';
  disciplineName: string;
} {
  let text = (rawDiag || '').trim();

  // If empty diagnosis, try to extract from actionCode or mark as general
  if (!text) {
    if (rawAction && rawAction.trim()) {
      const act = rawAction.trim();
      if (/lbp|pinggang|lumbal/i.test(act)) text = 'LBP / Nyeri Pinggang Bawah';
      else if (/oa|knee|genu|lutut/i.test(act)) text = 'Osteoarthritis (OA) Genu';
      else if (/shoulder|bahu|frozen/i.test(act)) text = 'Frozen Shoulder / Capsulitis Adhesiva';
      else if (/cervical|leher/i.test(act)) text = 'Cervical Syndrome / Nyeri Leher';
      else if (/stroke|hemiparese/i.test(act)) text = 'Hemiparese / Post Stroke';
      else if (/bell/i.test(act)) text = "Bell's Palsy / Parese Facialis";
      else if (/cts|carpal/i.test(act)) text = 'CTS / Carpal Tunnel Syndrome';
      else if (/trigger/i.test(act)) text = 'Trigger Finger / De Quervain';
      else if (/cp|cerebral palsy/i.test(act)) text = 'Cerebral Palsy';
      else if (/speech|bicara|wicara/i.test(act)) text = 'Speech Delay / Gangguan Wicara';
      else if (/afasia|aphasia/i.test(act)) text = 'Afasia Motorik / Ekspresif (Broca)';
      else if (/disfagia|dysphagia|menelan/i.test(act)) text = 'Disfagia / Gangguan Menelan';
      else if (/sensori|sensory|spd|autis|asd/i.test(act)) text = 'Gangguan Sensori Integrasi / ASD';
      else if (/motorik halus|fine motor|bina diri|adl/i.test(act)) text = 'Keterlambatan Motorik Halus & Bina Diri';
      else if (/ppok|asma|paru|respirasi/i.test(act)) text = 'PPOK / Asma Bronkial';
      else text = `Pemeriksaan Terapi (${act})`;
    } else {
      text = 'Pemeriksaan & Rehabilitasi Medik Umum';
    }
  }

  // Extract ICF code if in brackets e.g. "LBP (b280 / b710)"
  let icfCode: string | undefined;
  const icfMatch = text.match(/\((b\d+.*?|s\d+.*?|d\d+.*?|e\d+.*?)\)/i);
  if (icfMatch) {
    icfCode = icfMatch[1].trim();
  }

  // Detect category & discipline from predefined ICF list or keywords
  let matchedCategory = 'Geriatri & Kasus Lainnya';
  let matchedDiscipline: 'FT' | 'OT' | 'TW' | 'ALL' = 'ALL';
  let matchedDisciplineName = 'Rehabilitasi Umum';

  const lower = text.toLowerCase();

  // 1. Direct match with ICF dataset & keywords
  for (const cat of ICF_DIAGNOSES) {
    for (const item of cat.items) {
      const itemNameLower = item.name.toLowerCase();
      const directMatch = lower.includes(itemNameLower) || itemNameLower.includes(lower);
      const keywordMatch = item.keywords?.some((kw) => lower.includes(kw.toLowerCase()));

      if (directMatch || keywordMatch) {
        matchedCategory = cat.category;
        matchedDiscipline = item.discipline;
        matchedDisciplineName = item.disciplineName;
        if (!icfCode && item.icfCode) icfCode = item.icfCode;
        break;
      }
    }
    if (matchedCategory !== 'Geriatri & Kasus Lainnya') break;
  }

  // 2. Keyword heuristic fallback for clinical disciplines
  if (matchedCategory === 'Geriatri & Kasus Lainnya') {
    // TW Keywords (Speech & Language Pathology)
    if (
      /speech delay|bicara|wicara|artikulasi|fonologi|cadel|pelat|dislalia|gagap|stuttering|dld|reseptif|ekspresif|sumbing|labiopalatoskisis|tunarungu|drooling|ngeces|afasia|aphasia|broca|wernicke|disartria|dysarthria|pelo|apraksia|apraxia|disfagia|dysphagia|menelan|tersedak|disfonia|dysphonia|serak|parau|pita suara|laringektomi/i.test(
        lower
      )
    ) {
      matchedDiscipline = 'TW';
      matchedDisciplineName = 'Terapi Wicara';
      if (/speech delay|artikulasi|cadel|pelat|gagap|stuttering|dld|sumbing|ngeces|drooling/i.test(lower)) {
        matchedCategory = 'TW - Bahasa, Bicara & Komunikasi Pediatrik';
      } else {
        matchedCategory = 'TW - Afasia, Disartria, Disfagia & Gangguan Suara Dewasa';
      }
    }
    // OT Keywords (Occupational Therapy)
    else if (
      /sensori|sensory|spd|taktil|vestibular|autis|asd|autisme|adhd|gpph|hiperaktif|fokus|motorik halus|fine motor|pre-writing|disgrafia|pensil|bina diri|adl|toilet training|feeding|picky eater|retardasi mental|tunagrahita|hand injury|tendon repair|splinting|ortotik tangan|demensia|alzheimer|kognitif|risiko jatuh|alat bantu adaptif|kursi roda/i.test(
        lower
      )
    ) {
      matchedDiscipline = 'OT';
      matchedDisciplineName = 'Okupasi Terapi';
      if (/sensori|spd|autis|asd|adhd|gpph|motorik halus|fine motor|bina diri|feeding|picky eater/i.test(lower)) {
        matchedCategory = 'OT - Pediatrik, Sensori Integrasi & Perilaku';
      } else {
        matchedCategory = 'OT - Dewasa, Hand Injury, Kognitif & Kemandirian ADL';
      }
    }
    // FT Keywords (Physiotherapy)
    else if (
      /lbp|pinggang|lumbal|sciatica|ischialgia|hnp|cervical|leher|spondylosis|spondylolisthesis|skoliosis|kifosis|ankylosing|oa|osteoarthritis|genu|lutut|knee|frozen shoulder|bahu|rotator cuff|tennis elbow|golfer elbow|cts|carpal|de quervain|trigger finger|plantar|fasciitis|spur|ankle|sprain|keseleo|acl|pcl|meniscus|fraktur|orif|tka|tha|stroke|hemiparese|paresis|bell|facialis|paraparese|tetraplegia|sci|parkinson|tremor|neuropati|neuropathy|gbs|vertigo|bppv|kraniotomi|ppok|copd|asma|asthma|pneumonia|sputum|cabg|toraks|dekondisi|tirah baring|limfedema|cp|cerebral palsy|gdd|down syndrome|ctev|clubfoot|flatfoot|torticollis/i.test(
        lower
      )
    ) {
      matchedDiscipline = 'FT';
      matchedDisciplineName = 'Fisioterapi';
      if (/lbp|pinggang|lumbal|hnp|cervical|leher|spondylosis|skoliosis|ankylosing/i.test(lower)) {
        matchedCategory = 'FT - Muskuloskeletal & Nyeri Tulang Belakang';
      } else if (/oa|genu|lutut|knee|shoulder|bahu|rotator|elbow|cts|carpal|trigger|plantar|ankle|sprain|acl|fraktur|orif|tka/i.test(lower)) {
        matchedCategory = 'FT - Muskuloskeletal Ekstremitas & Cedera Sendi';
      } else if (/stroke|hemiparese|bell|facialis|paraparese|parkinson|neuropati|gbs|vertigo|kraniotomi/i.test(lower)) {
        matchedCategory = 'FT - Neurologis & Neuromuskular Dewasa';
      } else {
        matchedCategory = 'FT - Kardiorespirasi, Vaskular & Pediatrik Fisik';
      }
    }
  }

  const cleanName = text.replace(/\s*\([^)]*\)\s*$/, '').trim();

  return {
    name: text,
    cleanName,
    icfCode,
    category: matchedCategory,
    discipline: matchedDiscipline,
    disciplineName: matchedDisciplineName,
  };
}

/**
 * Detects the discipline of a patient's visit: FT (Fisio), OT (Okupasi), or TW (Wicara)
 */
export function detectVisitDiscipline(
  p: PatientItem,
  box?: QueueBox
): 'FT' | 'OT' | 'TW' | 'ALL' {
  const boxTitle = (box?.title || '').toLowerCase();
  const officer = (box?.officerName || '').toLowerCase();
  const boxCategory = (box?.category || '').toLowerCase();
  const loc = (box?.location || '').toLowerCase();
  const act = (p.actionCode || '').toLowerCase();

  // 1. Wicara (TW)
  if (
    boxCategory === 'wicara' ||
    /wicara|speech|tw\b|afasia|disartria/i.test(boxTitle) ||
    /wicara|speech|amd\.tw|skm|tw\b/i.test(officer) ||
    /wicara/i.test(loc) ||
    /^tw\b|wicara/i.test(act)
  ) {
    return 'TW';
  }

  // 2. Okupasi (OT)
  if (
    boxCategory === 'okupasi' ||
    /okupasi|ot\b|sensori|integrasi|bina diri/i.test(boxTitle) ||
    /okupasi|amd\.ot|s\.tr\.kes|ot\b/i.test(officer) ||
    /okupasi/i.test(loc) ||
    /^ot\b|sensori/i.test(act)
  ) {
    return 'OT';
  }

  // 3. Fisioterapi (FT)
  if (
    boxCategory === 'fisio' ||
    /fisio|ft\b|gym|elektro/i.test(boxTitle) ||
    /fisio|sst\.ft|amd\.ft|ftr|ft\b/i.test(officer) ||
    /fisio/i.test(loc) ||
    /^ft\b|mwd|tens|us\b|irr|chest|nebu/i.test(act)
  ) {
    return 'FT';
  }

  return 'ALL';
}

/**
 * Extracts a normalized unique key for a patient to deduplicate multiple sessions
 * across different therapy places (e.g. Fisio, OT, TW) on the same day.
 */
export function getPatientCanonicalKey(p: PatientItem, nameToRmMap?: Map<string, string>): string {
  const cleanRM = (p.medicalRecordNo || '')
    .trim()
    .toLowerCase()
    .replace(/^rm[:\s\-]*/, '')
    .replace(/[^a-z0-9]/g, '');

  if (cleanRM && cleanRM !== '-' && cleanRM !== '0' && cleanRM !== '000000') {
    return `rm:${cleanRM}`;
  }

  const cleanName = (p.patientName || '')
    .trim()
    .toLowerCase()
    .replace(/^(ny\.|tn\.|an\.|by\.|sdr\.|sdri\.)\s*/, '')
    .replace(/\s+/g, ' ');

  if (nameToRmMap && cleanName && nameToRmMap.has(cleanName)) {
    return `rm:${nameToRmMap.get(cleanName)}`;
  }

  if (p.patientId && p.patientId.trim()) {
    return `id:${p.patientId.trim().toLowerCase()}`;
  }

  if (cleanName) {
    return `name:${cleanName}`;
  }

  return `item:${p.id}`;
}

/**
 * Computes complete Diagnosis Analytics & Distribution Ranking from highest to lowest.
 * NOTE: If a patient attends multiple therapy places (e.g. Fisio, OT, TW) in one day,
 * they are unified and counted as 1 case in the diagnosis rating.
 */
export function computeDiagnosisAnalytics(
  patients: PatientItem[],
  boxes: QueueBox[] = []
): DiagnosisAnalyticsResult {
  const totalSessions = patients.length;
  if (totalSessions === 0) {
    return {
      totalPatients: 0,
      totalSessions: 0,
      totalDiagnosed: 0,
      uniqueDiagnosesCount: 0,
      ratings: [],
      top3Podium: [],
      categorySummaries: [],
      dominantCategory: '-',
      dominantDiagnosis: null,
      disciplineBreakdown: {
        ftCases: 0,
        otCases: 0,
        twCases: 0,
        otherCases: 0,
        ftPercentage: 0,
        otPercentage: 0,
        twPercentage: 0,
      },
      multiTherapyPatientsCount: 0,
    };
  }

  // 1. Build Name -> Clean RM lookup map to handle any missing RM on secondary tickets
  const nameToRmMap = new Map<string, string>();
  patients.forEach((p) => {
    const cleanRM = (p.medicalRecordNo || '')
      .trim()
      .toLowerCase()
      .replace(/^rm[:\s\-]*/, '')
      .replace(/[^a-z0-9]/g, '');
    const cleanName = (p.patientName || '')
      .trim()
      .toLowerCase()
      .replace(/^(ny\.|tn\.|an\.|by\.|sdr\.|sdri\.)\s*/, '')
      .replace(/\s+/g, ' ');

    if (cleanRM && cleanRM !== '-' && cleanRM !== '0' && cleanRM !== '000000' && cleanName) {
      nameToRmMap.set(cleanName, cleanRM);
    }
  });

  // 2. Group patient items by canonical patient identity so that multiple sessions (e.g. Fisio, OT, TW) are unified
  const patientGroups = new Map<string, PatientItem[]>();
  patients.forEach((p) => {
    const key = getPatientCanonicalKey(p, nameToRmMap);
    if (!patientGroups.has(key)) {
      patientGroups.set(key, []);
    }
    patientGroups.get(key)!.push(p);
  });

  const totalPatients = patientGroups.size;

  // Map to group diagnoses by diagnosis cleanName
  const groupMap = new Map<
    string,
    {
      cleanName: string;
      fullName: string;
      icfCode?: string;
      category: string;
      discipline: 'FT' | 'OT' | 'TW' | 'ALL';
      disciplineName: string;
      patients: UnifiedPatientDetail[];
      therapistCounts: Record<string, { officerName: string; boxTitle: string; count: number; boxId: string }>;
      procedureCounts: Record<string, number>;
    }
  >();

  let diagnosedCount = 0;
  let ftCases = 0;
  let otCases = 0;
  let twCases = 0;
  let otherCases = 0;
  let multiTherapyPatientsCount = 0;

  // 3. Process each unique patient (Each unique patient is counted EXACTLY ONCE for diagnosis rating)
  patientGroups.forEach((visits) => {
    // Check if this patient has any diagnosis input
    const hasAnyDiagnosis = visits.some((v) => v.diagnosis && v.diagnosis.trim());
    if (hasAnyDiagnosis) {
      diagnosedCount++;
    }

    // Identify all visited disciplines
    let inFT = false;
    let inOT = false;
    let inTW = false;

    visits.forEach((v) => {
      const box = boxes.find((b) => b.id === v.boxId);
      const disc = detectVisitDiscipline(v, box);
      if (disc === 'FT') inFT = true;
      else if (disc === 'OT') inOT = true;
      else if (disc === 'TW') inTW = true;
    });

    const distinctCount = (inFT ? 1 : 0) + (inOT ? 1 : 0) + (inTW ? 1 : 0);
    if (distinctCount > 1 || visits.length > 1) {
      multiTherapyPatientsCount++;
    }

    if (inFT) ftCases++;
    if (inOT) otCases++;
    if (inTW) twCases++;
    if (!inFT && !inOT && !inTW) otherCases++;

    // Evaluate candidate diagnoses across all visits of this patient to choose canonical Primary Diagnosis
    interface Candidate {
      norm: ReturnType<typeof normalizeDiagnosisText>;
      hasExplicit: boolean;
      count: number;
    }
    const candMap = new Map<string, Candidate>();

    visits.forEach((v) => {
      const hasExplicit = Boolean(v.diagnosis && v.diagnosis.trim());
      const norm = normalizeDiagnosisText(v.diagnosis, v.actionCode);
      const k = norm.cleanName.toLowerCase();

      if (!candMap.has(k)) {
        candMap.set(k, {
          norm,
          hasExplicit,
          count: 0,
        });
      }
      const item = candMap.get(k)!;
      item.count++;
      if (hasExplicit) item.hasExplicit = true;
    });

    const candidates = Array.from(candMap.values()).map((c) => {
      const k = c.norm.cleanName.toLowerCase();
      const isGeneric =
        k === 'pemeriksaan & rehabilitasi medik umum' ||
        k.startsWith('pemeriksaan terapi') ||
        k === 'pemeriksaan umum';

      let score = 0;
      if (!isGeneric) score += 100;
      if (c.hasExplicit) score += 50;
      if (c.norm.icfCode) score += 10;
      score += c.count * 15;
      return { ...c, score, isGeneric };
    });

    candidates.sort((a, b) => b.score - a.score || b.count - a.count);
    const primaryCand = candidates[0];
    const primaryDiag = primaryCand.norm;

    const secondaryDiagnoses = candidates
      .slice(1)
      .filter((c) => !c.isGeneric && c.norm.cleanName !== primaryDiag.cleanName)
      .map((c) => c.norm.cleanName);

    // Identify visited places list (e.g. ['FT', 'OT', 'TW'])
    const placesArr: ('FT' | 'OT' | 'TW')[] = [];
    if (inFT) placesArr.push('FT');
    if (inOT) placesArr.push('OT');
    if (inTW) placesArr.push('TW');

    // Find primary visit representation
    const primaryVisit =
      visits.find((v) => {
        const norm = normalizeDiagnosisText(v.diagnosis, v.actionCode);
        return norm.cleanName.toLowerCase() === primaryDiag.cleanName.toLowerCase();
      }) || visits[0];

    const allQueueNumbers = visits.map((v) => v.queueNumber).filter(Boolean);
    const allActionCodes = Array.from(new Set(visits.map((v) => v.actionCode).filter(Boolean))) as string[];
    const therapistNames: string[] = [];
    visits.forEach((v) => {
      const b = boxes.find((bx) => bx.id === v.boxId);
      const name = b?.officerName || b?.title;
      if (name && !therapistNames.includes(name)) {
        therapistNames.push(name);
      }
    });

    const isAnyWarning = visits.some((v) => v.isWarning);
    const isAnyRanap = visits.some((v) => v.isRanap);
    const allCompleted = visits.every((v) => v.completed);
    const activeCount = visits.filter((v) => !v.completed).length;
    const completedCount = visits.filter((v) => v.completed).length;

    const unifiedPatient: UnifiedPatientDetail = {
      ...primaryVisit,
      diagnosis: primaryDiag.name,
      queueNumber: allQueueNumbers.join(', ') || primaryVisit.queueNumber,
      actionCode: allActionCodes.join(' • ') || primaryVisit.actionCode,
      isWarning: isAnyWarning,
      isRanap: isAnyRanap,
      completed: allCompleted,
      allQueueNumbers,
      allBoxIds: visits.map((v) => v.boxId),
      therapyPlaces: placesArr.length > 0 ? placesArr : (['ALL'] as any),
      therapistNames,
      sessionCount: visits.length,
      completedSessions: completedCount,
      activeSessions: activeCount,
      secondaryDiagnoses,
    };

    // Add to groupMap by primary diagnosis - PUSHED ONCE PER PATIENT
    const groupKey = primaryDiag.cleanName.toLowerCase();
    if (!groupMap.has(groupKey)) {
      groupMap.set(groupKey, {
        cleanName: primaryDiag.cleanName,
        fullName: primaryDiag.name,
        icfCode: primaryDiag.icfCode,
        category: primaryDiag.category,
        discipline: primaryDiag.discipline,
        disciplineName: primaryDiag.disciplineName,
        patients: [],
        therapistCounts: {},
        procedureCounts: {},
      });
    }

    const entry = groupMap.get(groupKey)!;
    // CRITICAL REQUIREMENT: This patient is pushed EXACTLY ONCE to this diagnosis rating
    entry.patients.push(unifiedPatient);

    // Track therapists & procedures from all visited boxes (FT, OT, TW)
    visits.forEach((v) => {
      const parentBox = boxes.find((b) => b.id === v.boxId);
      const boxId = v.boxId || 'unknown';
      const officerName = parentBox?.officerName || parentBox?.title || 'Terapis';
      const boxTitle = parentBox?.title || 'Ruangan';

      const isJemputanOrPeralihan =
        boxId === 'box-jemputan' ||
        boxId === 'box-peralihan-siang' ||
        boxId.toLowerCase().includes('jemputan') ||
        boxId.toLowerCase().includes('peralihan') ||
        boxTitle.toLowerCase().includes('jemputan') ||
        boxTitle.toLowerCase().includes('peralihan') ||
        officerName.toLowerCase().includes('jemputan') ||
        officerName.toLowerCase().includes('peralihan') ||
        officerName.toLowerCase().includes('transport') ||
        officerName.toLowerCase().includes('shift siang');

      if (!isJemputanOrPeralihan) {
        if (!entry.therapistCounts[boxId]) {
          entry.therapistCounts[boxId] = {
            boxId,
            officerName,
            boxTitle,
            count: 0,
          };
        }
        entry.therapistCounts[boxId].count += 1;
      }

      const procCode = (v.actionCode || 'UMUM').trim().toUpperCase();
      entry.procedureCounts[procCode] = (entry.procedureCounts[procCode] || 0) + 1;
    });
  });

  // Calculate raw items
  const rawItems = Array.from(groupMap.values()).map((entry) => {
    const totalCases = entry.patients.length;
    const activeCases = entry.patients.filter((p) => !p.completed).length;
    const completedCases = entry.patients.filter((p) => p.completed).length;
    const ranapCases = entry.patients.filter((p) => p.isRanap).length;
    const rajalCases = totalCases - ranapCases;
    const warningCases = entry.patients.filter((p) => p.isWarning).length;
    const percentage = totalPatients > 0 ? Number(((totalCases / totalPatients) * 100).toFixed(1)) : 0;

    const theme = CATEGORY_THEMES[entry.category] || CATEGORY_THEMES['Geriatri & Kasus Lainnya'];

    const topTherapists = Object.values(entry.therapistCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);

    const commonProcedures = Object.entries(entry.procedureCounts)
      .map(([code, count]) => ({ code, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);

    return {
      cleanName: entry.cleanName,
      diagnosisName: entry.fullName,
      icfCode: entry.icfCode,
      category: entry.category,
      discipline: entry.discipline,
      disciplineName: entry.disciplineName,
      categoryTheme: theme,
      totalCases,
      activeCases,
      completedCases,
      ranapCases,
      rajalCases,
      warningCases,
      percentage,
      relativePercentage: 0, // calculated below
      patients: entry.patients,
      topTherapists,
      commonProcedures,
    };
  });

  // Sort descending: Terbanyak sampai Tersedikit
  rawItems.sort(
    (a, b) =>
      b.totalCases - a.totalCases ||
      b.activeCases - a.activeCases ||
      a.cleanName.localeCompare(b.cleanName)
  );

  const maxCaseCount = rawItems.length > 0 ? rawItems[0].totalCases : 1;

  const ratings: DiagnosisRatingItem[] = rawItems.map((item, index) => ({
    ...item,
    rank: index + 1,
    relativePercentage: Math.max(8, Math.round((item.totalCases / maxCaseCount) * 100)),
  }));

  const top3Podium = ratings.slice(0, 3);
  const dominantDiagnosis = ratings.length > 0 ? ratings[0] : null;

  // Category Summaries
  const catMap = new Map<
    string,
    { total: number; discipline: 'FT' | 'OT' | 'TW' | 'ALL'; uniqueNames: Set<string> }
  >();
  ratings.forEach((r) => {
    if (!catMap.has(r.category)) {
      catMap.set(r.category, { total: 0, discipline: r.discipline, uniqueNames: new Set() });
    }
    const catData = catMap.get(r.category)!;
    catData.total += r.totalCases;
    catData.uniqueNames.add(r.cleanName);
  });

  const categorySummaries: DiagnosisCategorySummary[] = Array.from(catMap.entries()).map(
    ([category, data]) => {
      const theme = CATEGORY_THEMES[category] || CATEGORY_THEMES['Geriatri & Kasus Lainnya'];
      const percentage = totalPatients > 0 ? Number(((data.total / totalPatients) * 100).toFixed(1)) : 0;
      const disciplineLabels: Record<string, string> = {
        FT: 'Fisioterapi (FT)',
        OT: 'Okupasi Terapi (OT)',
        TW: 'Terapi Wicara (TW)',
        ALL: 'Rehabilitasi Umum',
      };
      return {
        category,
        discipline: data.discipline,
        disciplineLabel: disciplineLabels[data.discipline] || 'Rehabilitasi',
        totalCases: data.total,
        percentage,
        uniqueDiagnosesCount: data.uniqueNames.size,
        theme,
      };
    }
  );

  // Sort category summaries by totalCases descending
  categorySummaries.sort((a, b) => b.totalCases - a.totalCases);

  const dominantCategory = categorySummaries.length > 0 ? categorySummaries[0].category : '-';

  const disciplineBreakdown: DisciplineBreakdown = {
    ftCases,
    otCases,
    twCases,
    otherCases,
    ftPercentage: totalPatients > 0 ? Number(((ftCases / totalPatients) * 100).toFixed(1)) : 0,
    otPercentage: totalPatients > 0 ? Number(((otCases / totalPatients) * 100).toFixed(1)) : 0,
    twPercentage: totalPatients > 0 ? Number(((twCases / totalPatients) * 100).toFixed(1)) : 0,
  };

  return {
    totalPatients,
    totalSessions,
    totalDiagnosed: diagnosedCount,
    uniqueDiagnosesCount: ratings.length,
    ratings,
    top3Podium,
    categorySummaries,
    dominantCategory,
    dominantDiagnosis,
    disciplineBreakdown,
    multiTherapyPatientsCount,
  };
}
