import { PatientItem, QueueBox } from '../types';

export interface EquipmentDefinition {
  code: number;
  codeStr: string;
  name: string;
  shortName: string;
  category: string;
  description: string;
  theme: {
    bg: string;
    text: string;
    border: string;
    bar: string;
    badge: string;
    iconBg: string;
    accentColor: string;
  };
}

export const KNOWN_EQUIPMENT: Record<number, EquipmentDefinition> = {
  2: {
    code: 2,
    codeStr: '2',
    name: 'MWD (Microwave Diathermy)',
    shortName: 'MWD',
    category: 'Termoterapi Dalam',
    description: 'Pemanasan jaringan dalam dengan gelombang mikro elektromagnetik',
    theme: {
      bg: 'bg-rose-50/80',
      text: 'text-rose-950',
      border: 'border-rose-200',
      bar: 'bg-gradient-to-r from-rose-500 to-red-600',
      badge: 'bg-rose-100 text-rose-800 border-rose-200',
      iconBg: 'bg-rose-600 text-white',
      accentColor: '#e11d48',
    },
  },
  6: {
    code: 6,
    codeStr: '6',
    name: 'TENS (Transcutaneous Electrical Nerve Stimulation)',
    shortName: 'TENS',
    category: 'Elektroterapi / Nyeri',
    description: 'Stimulasi saraf listrik transkutan untuk manajemen modulasi nyeri',
    theme: {
      bg: 'bg-amber-50/80',
      text: 'text-amber-950',
      border: 'border-amber-200',
      bar: 'bg-gradient-to-r from-amber-500 to-yellow-600',
      badge: 'bg-amber-100 text-amber-900 border-amber-200',
      iconBg: 'bg-amber-500 text-white',
      accentColor: '#d97706',
    },
  },
  4: {
    code: 4,
    codeStr: '4',
    name: 'Ultrasound Therapy (US)',
    shortName: 'Ultrasound',
    category: 'Gelombang Suara Termal',
    description: 'Gelombang ultrasonik untuk mikromasase jaringan & percepatan pemulihan',
    theme: {
      bg: 'bg-blue-50/80',
      text: 'text-blue-950',
      border: 'border-blue-200',
      bar: 'bg-gradient-to-r from-blue-500 to-indigo-600',
      badge: 'bg-blue-100 text-blue-900 border-blue-200',
      iconBg: 'bg-blue-600 text-white',
      accentColor: '#2563eb',
    },
  },
  1: {
    code: 1,
    codeStr: '1',
    name: 'IRR (Infra Red Radiation)',
    shortName: 'IRR',
    category: 'Termoterapi Superfisial',
    description: 'Radiasi infra merah untuk vasodilatasi & relaksasi otot superfisial',
    theme: {
      bg: 'bg-orange-50/80',
      text: 'text-orange-950',
      border: 'border-orange-200',
      bar: 'bg-gradient-to-r from-orange-500 to-red-500',
      badge: 'bg-orange-100 text-orange-900 border-orange-200',
      iconBg: 'bg-orange-600 text-white',
      accentColor: '#ea580c',
    },
  },
  15: {
    code: 15,
    codeStr: '15',
    name: 'Parafin Bath (Wax Therapy)',
    shortName: 'Parafin',
    category: 'Termoterapi Konduksi',
    description: 'Mandi lilin parafin hangat untuk sendi ekstremitas tangan & kaki',
    theme: {
      bg: 'bg-yellow-50/80',
      text: 'text-yellow-950',
      border: 'border-yellow-200',
      bar: 'bg-gradient-to-r from-yellow-500 to-amber-600',
      badge: 'bg-yellow-100 text-yellow-900 border-yellow-200',
      iconBg: 'bg-yellow-600 text-white',
      accentColor: '#ca8a04',
    },
  },
  18: {
    code: 18,
    codeStr: '18',
    name: 'Nebulizer Inhalasi',
    shortName: 'Nebulizer',
    category: 'Kardiorespirasi / Inhalasi',
    description: 'Aerosolisasi medikasi untuk saluran pernapasan & pembersihan jalan napas',
    theme: {
      bg: 'bg-teal-50/80',
      text: 'text-teal-950',
      border: 'border-teal-200',
      bar: 'bg-gradient-to-r from-teal-500 to-emerald-600',
      badge: 'bg-teal-100 text-teal-900 border-teal-200',
      iconBg: 'bg-teal-600 text-white',
      accentColor: '#0d9488',
    },
  },
  47: {
    code: 47,
    codeStr: '47',
    name: 'Cryotherapy / Cryo',
    shortName: 'Cryo',
    category: 'Krioterapi / Terapi Dingin',
    description: 'Aplikasi suhu dingin untuk reduksi inflamasi akut & spastisitas',
    theme: {
      bg: 'bg-sky-50/80',
      text: 'text-sky-950',
      border: 'border-sky-200',
      bar: 'bg-gradient-to-r from-sky-500 to-cyan-600',
      badge: 'bg-sky-100 text-sky-900 border-sky-200',
      iconBg: 'bg-sky-600 text-white',
      accentColor: '#0284c7',
    },
  },
  74: {
    code: 74,
    codeStr: '74',
    name: 'Vaccum Kompresi (DVT / Vaskular)',
    shortName: 'Vaccum Kompresi',
    category: 'Vaskular & Kompresi',
    description: 'Dekompresi ritmik intermiten untuk drainase limfatik & sirkulasi darah',
    theme: {
      bg: 'bg-indigo-50/80',
      text: 'text-indigo-950',
      border: 'border-indigo-200',
      bar: 'bg-gradient-to-r from-indigo-500 to-purple-600',
      badge: 'bg-indigo-100 text-indigo-900 border-indigo-200',
      iconBg: 'bg-indigo-600 text-white',
      accentColor: '#4f46e5',
    },
  },
  9: {
    code: 9,
    codeStr: '9',
    name: 'Manipulasi (Manual Therapy)',
    shortName: 'Manipulasi',
    category: 'Manual Therapy & Mobilisasi',
    description: 'Teknik terapi manual mobilisasi sendi dan manipulasi jaringan lunak',
    theme: {
      bg: 'bg-fuchsia-50/80',
      text: 'text-fuchsia-950',
      border: 'border-fuchsia-200',
      bar: 'bg-gradient-to-r from-fuchsia-500 to-pink-600',
      badge: 'bg-fuchsia-100 text-fuchsia-900 border-fuchsia-200',
      iconBg: 'bg-fuchsia-600 text-white',
      accentColor: '#c026d3',
    },
  },
  10: {
    code: 10,
    codeStr: '10',
    name: 'Rehab (Rehabilitasi Medik / Terapi Latihan)',
    shortName: 'Rehab',
    category: 'Rehabilitasi & Latihan',
    description: 'Program terapi latihan fungsional, penguatan otot, dan reedukasi postural',
    theme: {
      bg: 'bg-emerald-50/80',
      text: 'text-emerald-950',
      border: 'border-emerald-200',
      bar: 'bg-gradient-to-r from-emerald-500 to-teal-600',
      badge: 'bg-emerald-100 text-emerald-900 border-emerald-200',
      iconBg: 'bg-emerald-600 text-white',
      accentColor: '#059669',
    },
  },
  14: {
    code: 14,
    codeStr: '14',
    name: 'Paket Chest + Inhalasi',
    shortName: 'Paket Chest+Inhalasi',
    category: 'Kardiorespirasi Komprehensif',
    description: 'Kombinasi terapi inhalasi medikasi dan fisioterapi dada / pembersihan sputum',
    theme: {
      bg: 'bg-cyan-50/80',
      text: 'text-cyan-950',
      border: 'border-cyan-200',
      bar: 'bg-gradient-to-r from-cyan-500 to-teal-600',
      badge: 'bg-cyan-100 text-cyan-900 border-cyan-200',
      iconBg: 'bg-cyan-600 text-white',
      accentColor: '#0891b2',
    },
  },
  75: {
    code: 75,
    codeStr: '75',
    name: 'Chest Physiotherapy (Fisioterapi Dada)',
    shortName: 'Chest',
    category: 'Kardiorespirasi',
    description: 'Clapping, postural drainage, dan breathing exercise untuk paru & jalan napas',
    theme: {
      bg: 'bg-violet-50/80',
      text: 'text-violet-950',
      border: 'border-violet-200',
      bar: 'bg-gradient-to-r from-violet-500 to-purple-600',
      badge: 'bg-violet-100 text-violet-900 border-violet-200',
      iconBg: 'bg-violet-600 text-white',
      accentColor: '#7c3aed',
    },
  },
};

export interface EquipmentRatingItem {
  rank: number;
  code: number;
  codeStr: string;
  name: string;
  shortName: string;
  category: string;
  description: string;
  theme: EquipmentDefinition['theme'];
  totalSessions: number; // Total uses
  activeSessions: number; // In-use right now (patient not completed)
  completedSessions: number; // Finished sessions
  rajalSessions: number;
  ranapSessions: number;
  percentageOfTotal: number; // % of all equipment sessions
  patientCoveragePercentage: number; // % of total patients receiving this tool
  relativePercentage: number; // 0-100 based on top tool for bar visualization
  patients: PatientItem[];
  topTherapists: { boxId: string; officerName: string; boxTitle: string; count: number }[];
  topDiagnoses: { diagnosisName: string; count: number }[];
}

export interface EquipmentCombinationItem {
  key: string;
  codes: number[];
  label: string;
  count: number;
  percentage: number;
  patients: PatientItem[];
}

export interface EquipmentAnalyticsResult {
  totalEquipmentSessions: number;
  totalPatientsWithEquipment: number;
  totalUniquePatients: number;
  activeEquipmentInUse: number;
  completedEquipmentSessions: number;
  equipmentRatings: EquipmentRatingItem[]; // Ordered from highest totalSessions to lowest
  top1Equipment: EquipmentRatingItem | null;
  top3Podium: EquipmentRatingItem[];
  combinations: EquipmentCombinationItem[];
  nonEquipmentSessionsCount: number;
}

/**
 * Parses actionCode string or text into a list of matched equipment codes.
 * Examples handled:
 * - "2" -> [2]
 * - "2, 6" -> [2, 6]
 * - "2 + 4 + 6" -> [2, 4, 6]
 * - "15, 6" -> [15, 6]
 * - "18" -> [18]
 * - "47" -> [47]
 * - "74" -> [74]
 * - "MWD + TENS" -> [2, 6]
 * - "Ultrasound & IRR" -> [4, 1]
 * - "Paraffin, Cryo" -> [15, 47]
 * - "Vaccum, Nebu" -> [74, 18]
 */
export function extractEquipmentCodes(rawAction?: string): number[] {
  if (!rawAction) return [];
  const text = String(rawAction).trim();
  if (!text) return [];

  const foundCodes = new Set<number>();

  // 1. Extract explicit numeric tokens (e.g. "2, 6", "15 + 4", "74", "18/6", "C 2, 6", "P: 4+6", "PP 15")
  // Matches digits 1, 2, 4, 6, 15, 18, 47, 74 as discrete numbers even when prefixed with letters
  const tokens = text.split(/[^0-9a-zA-Z]+/);
  for (const token of tokens) {
    const trimmed = token.trim();
    if (!trimmed) continue;
    
    // Direct number check
    const num = parseInt(trimmed, 10);
    if (!isNaN(num) && KNOWN_EQUIPMENT[num]) {
      foundCodes.add(num);
    } else {
      // Check if token has prefix attached (e.g. "C2", "P6", "PP15", "J74")
      const matchedNumInToken = trimmed.match(/\d+/);
      if (matchedNumInToken) {
        const parsed = parseInt(matchedNumInToken[0], 10);
        if (!isNaN(parsed) && KNOWN_EQUIPMENT[parsed]) {
          foundCodes.add(parsed);
        }
      }
    }
  }

  // Also scan all numeric matches in the whole string directly
  const allNumberMatches = text.match(/\b(1|2|4|6|9|10|14|15|18|47|74|75)\b/g);
  if (allNumberMatches) {
    allNumberMatches.forEach((n) => {
      const codeNum = parseInt(n, 10);
      if (KNOWN_EQUIPMENT[codeNum]) {
        foundCodes.add(codeNum);
      }
    });
  }

  const lower = text.toLowerCase();

  // 2. Text keyword detection if not matched by numbers or as companion
  if (lower.includes('mwd') || lower.includes('microwave')) foundCodes.add(2);
  if (lower.includes('tens') || lower.includes('estim') || lower.includes('elektroterapi')) foundCodes.add(6);
  if (lower.includes('ultrasound') || lower.includes('usg') || /\bus\b/.test(lower)) foundCodes.add(4);
  if (lower.includes('irr') || lower.includes('infra red') || lower.includes('infrared') || lower.includes('sinar')) foundCodes.add(1);
  if (lower.includes('parafin') || lower.includes('paraffin') || lower.includes('wax')) foundCodes.add(15);
  if (lower.includes('nebu') || lower.includes('nebulizer') || lower.includes('inhalasi')) {
    // If text specifically says paket chest + inhalasi, assign 14, otherwise 18
    if (lower.includes('paket chest') || lower.includes('chest+inhalasi') || lower.includes('chest inhalasi')) {
      foundCodes.add(14);
    } else {
      foundCodes.add(18);
    }
  }
  if (lower.includes('cryo') || lower.includes('krio') || lower.includes('cold therapy') || lower.includes('kompres dingin')) foundCodes.add(47);
  if (lower.includes('vaccum') || lower.includes('vacuum') || lower.includes('kompresi') || lower.includes('dvt')) foundCodes.add(74);
  if (lower.includes('manipulasi') || lower.includes('manual therapy') || lower.includes('mobilisasi')) foundCodes.add(9);
  if (lower.includes('rehab') || lower.includes('rehabilitasi') || lower.includes('exercise')) foundCodes.add(10);
  if (lower.includes('chest') || lower.includes('fisioterapi dada') || lower.includes('postural drainage')) {
    if (lower.includes('paket chest') || lower.includes('chest+inhalasi') || lower.includes('chest inhalasi')) {
      foundCodes.add(14);
    } else {
      foundCodes.add(75);
    }
  }

  return Array.from(foundCodes);
}

/**
 * Computes comprehensive Equipment Utilization analytics and rankings (Terbanyak ke Tersedikit)
 */
export function computeEquipmentAnalytics(
  patients: PatientItem[],
  boxes: QueueBox[] = []
): EquipmentAnalyticsResult {
  const totalUniquePatients = patients.length;

  const equipmentMap = new Map<number, {
    def: EquipmentDefinition;
    patients: PatientItem[];
    therapistMap: Record<string, { officerName: string; boxTitle: string; count: number; boxId: string }>;
    diagnosisMap: Record<string, number>;
  }>();

  // Initialize all known equipment definitions
  Object.values(KNOWN_EQUIPMENT).forEach((def) => {
    equipmentMap.set(def.code, {
      def,
      patients: [],
      therapistMap: {},
      diagnosisMap: {},
    });
  });

  const combinationMap = new Map<string, {
    codes: number[];
    patients: PatientItem[];
  }>();

  let patientsWithEquipmentCount = 0;
  let nonEquipmentSessionsCount = 0;

  patients.forEach((p) => {
    const codes = extractEquipmentCodes(p.actionCode);
    const parentBox = boxes.find((b) => b.id === p.boxId);
    const boxId = p.boxId || 'unknown';
    const officerName = parentBox?.officerName || parentBox?.title || 'Terapis';
    const boxTitle = parentBox?.title || 'Ruangan';
    const diagName = p.diagnosis && p.diagnosis.trim() ? p.diagnosis.trim() : 'Pemeriksaan Umum';

    if (codes.length > 0) {
      patientsWithEquipmentCount++;

      // Track individual equipment usage
      codes.forEach((c) => {
        const item = equipmentMap.get(c);
        if (item) {
          item.patients.push(p);

          // Therapist track (skip staging/transfer boxes like jemputan and peralihan)
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
            if (!item.therapistMap[boxId]) {
              item.therapistMap[boxId] = {
                boxId,
                officerName,
                boxTitle,
                count: 0,
              };
            }
            item.therapistMap[boxId].count += 1;
          }

          // Diagnosis track
          item.diagnosisMap[diagName] = (item.diagnosisMap[diagName] || 0) + 1;
        }
      });

      // Track combination if multiple equipment used together
      if (codes.length > 1) {
        const sortedCodes = [...codes].sort((a, b) => a - b);
        const comboKey = sortedCodes.join(' + ');
        if (!combinationMap.has(comboKey)) {
          combinationMap.set(comboKey, {
            codes: sortedCodes,
            patients: [],
          });
        }
        combinationMap.get(comboKey)!.patients.push(p);
      }
    } else {
      nonEquipmentSessionsCount++;
    }
  });

  // Calculate total sessions across all equipment
  let totalEquipmentSessions = 0;
  let activeEquipmentInUse = 0;
  let completedEquipmentSessions = 0;

  const rawList = Array.from(equipmentMap.values()).map((entry) => {
    const totalSessions = entry.patients.length;
    const activeSessions = entry.patients.filter((p) => !p.completed).length;
    const completedSessions = entry.patients.filter((p) => p.completed).length;
    const ranapSessions = entry.patients.filter((p) => p.isRanap).length;
    const rajalSessions = totalSessions - ranapSessions;

    totalEquipmentSessions += totalSessions;
    activeEquipmentInUse += activeSessions;
    completedEquipmentSessions += completedSessions;

    const topTherapists = Object.values(entry.therapistMap)
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);

    const topDiagnoses = Object.entries(entry.diagnosisMap)
      .map(([diagnosisName, count]) => ({ diagnosisName, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);

    return {
      code: entry.def.code,
      codeStr: entry.def.codeStr,
      name: entry.def.name,
      shortName: entry.def.shortName,
      category: entry.def.category,
      description: entry.def.description,
      theme: entry.def.theme,
      totalSessions,
      activeSessions,
      completedSessions,
      rajalSessions,
      ranapSessions,
      percentageOfTotal: 0,
      patientCoveragePercentage: totalUniquePatients > 0 ? Number(((totalSessions / totalUniquePatients) * 100).toFixed(1)) : 0,
      relativePercentage: 0,
      patients: entry.patients,
      topTherapists,
      topDiagnoses,
    };
  });

  // Sort descending: Terbanyak s/d Tersedikit
  rawList.sort((a, b) => b.totalSessions - a.totalSessions || a.code - b.code);

  const maxSessions = rawList.length > 0 && rawList[0].totalSessions > 0 ? rawList[0].totalSessions : 1;

  const equipmentRatings: EquipmentRatingItem[] = rawList.map((item, idx) => ({
    ...item,
    rank: idx + 1,
    percentageOfTotal: totalEquipmentSessions > 0 ? Number(((item.totalSessions / totalEquipmentSessions) * 100).toFixed(1)) : 0,
    relativePercentage: Math.max(item.totalSessions > 0 ? 8 : 0, Math.round((item.totalSessions / maxSessions) * 100)),
  }));

  const top1Equipment = equipmentRatings.length > 0 && equipmentRatings[0].totalSessions > 0 ? equipmentRatings[0] : null;
  const top3Podium = equipmentRatings.slice(0, 3);

  // Combinations ranking
  const combinations: EquipmentCombinationItem[] = Array.from(combinationMap.entries())
    .map(([key, data]) => {
      const label = data.codes
        .map((c) => KNOWN_EQUIPMENT[c]?.shortName || `Kode ${c}`)
        .join(' + ');
      const count = data.patients.length;
      const percentage = patientsWithEquipmentCount > 0 ? Number(((count / patientsWithEquipmentCount) * 100).toFixed(1)) : 0;
      return {
        key,
        codes: data.codes,
        label,
        count,
        percentage,
        patients: data.patients,
      };
    })
    .sort((a, b) => b.count - a.count);

  return {
    totalEquipmentSessions,
    totalPatientsWithEquipment: patientsWithEquipmentCount,
    totalUniquePatients,
    activeEquipmentInUse,
    completedEquipmentSessions,
    equipmentRatings,
    top1Equipment,
    top3Podium,
    combinations,
    nonEquipmentSessionsCount,
  };
}
