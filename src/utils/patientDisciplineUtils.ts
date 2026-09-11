import { 
  MasterPatient, 
  PatientItem, 
  PatientVisitHistoryItem, 
  QueueBox, 
  PatientDisciplineTherapists, 
  PatientDisciplineVisitCounts,
  DisciplineFirstTherapist 
} from '../types';
import { getTherapistCategory, TherapyCategory } from './savedOfficersService';

export const normalizeCategory = (cat?: string): TherapyCategory => {
  if (cat === 'okupasi' || cat === 'wicara' || cat === 'fisio') {
    return cat;
  }
  return 'fisio';
};

export const getDisciplineBadgeInfo = (category?: string) => {
  const norm = normalizeCategory(category);
  switch (norm) {
    case 'okupasi':
      return {
        key: 'okupasi' as const,
        label: 'Terapi Okupasi',
        shortName: 'OT',
        fullTitle: 'Terapi Okupasi (OT)',
        badgeBg: 'bg-purple-100',
        badgeText: 'text-purple-900',
        badgeBorder: 'border-purple-300',
        accentColor: 'text-purple-600',
        tagBg: 'bg-purple-50 text-purple-800 border-purple-200',
      };
    case 'wicara':
      return {
        key: 'wicara' as const,
        label: 'Terapi Wicara',
        shortName: 'TW',
        fullTitle: 'Terapi Wicara (TW)',
        badgeBg: 'bg-amber-100',
        badgeText: 'text-amber-950',
        badgeBorder: 'border-amber-300',
        accentColor: 'text-amber-600',
        tagBg: 'bg-amber-50 text-amber-900 border-amber-200',
      };
    case 'fisio':
    default:
      return {
        key: 'fisio' as const,
        label: 'Fisioterapi',
        shortName: 'FT',
        fullTitle: 'Fisioterapi (FT)',
        badgeBg: 'bg-teal-100',
        badgeText: 'text-teal-950',
        badgeBorder: 'border-teal-300',
        accentColor: 'text-teal-600',
        tagBg: 'bg-teal-50 text-teal-900 border-teal-200',
      };
  }
};

/**
 * Returns the first therapist for a specific discipline (fisio, okupasi, or wicara).
 */
export const getDisciplineFirstTherapist = (
  patient: Partial<MasterPatient> | Partial<PatientItem> | null | undefined,
  category: TherapyCategory
): DisciplineFirstTherapist | undefined => {
  if (!patient) return undefined;

  const mp = patient as Partial<MasterPatient>;
  const pi = patient as Partial<PatientItem>;

  // 1. Direct check in firstTherapists record
  if (patient.firstTherapists && patient.firstTherapists[category]) {
    return patient.firstTherapists[category];
  }

  // 2. Derive from visit history if available
  if (mp.visitHistory && mp.visitHistory.length > 0) {
    const matchingVisits = mp.visitHistory.filter((v) => {
      const vCat = v.category || getTherapistCategory(v.officerName, v.boxTitle);
      return vCat === category;
    });

    if (matchingVisits.length > 0) {
      // Oldest matching visit is the first visit for this discipline
      const oldest = matchingVisits[0];
      return {
        officerName: oldest.officerName,
        boxId: oldest.boxId,
        boxTitle: oldest.boxTitle,
        firstVisitDate: oldest.date,
      };
    }
  }

  // 3. Fallback: if patient has legacy firstOfficerName and the category matches
  if (patient.firstOfficerName) {
    const boxTitle = pi.firstBoxTitle || mp.firstBoxId;
    const legacyCategory = getTherapistCategory(patient.firstOfficerName, boxTitle);
    if (legacyCategory === category) {
      return {
        officerName: patient.firstOfficerName,
        boxId: mp.firstBoxId || pi.boxId,
        boxTitle: pi.firstBoxTitle,
        firstVisitDate: patient.firstVisitDate,
      };
    }
  }

  return undefined;
};

/**
 * Returns the visit count for a specific discipline (e.g. 10 for Fisio, 2 for Okupasi).
 */
export const getDisciplineVisitCount = (
  patient: Partial<MasterPatient> | Partial<PatientItem> | null | undefined,
  category: TherapyCategory
): number => {
  if (!patient) return 0;

  const mp = patient as Partial<MasterPatient>;
  const pi = patient as Partial<PatientItem>;

  // 1. Check disciplineVisitCounts directly
  if (patient.disciplineVisitCounts && typeof patient.disciplineVisitCounts[category] === 'number') {
    return patient.disciplineVisitCounts[category] || 0;
  }

  // 2. Count from visit history
  if (mp.visitHistory && mp.visitHistory.length > 0) {
    const count = mp.visitHistory.filter((v) => {
      const vCat = v.category || getTherapistCategory(v.officerName, v.boxTitle);
      return vCat === category;
    }).length;
    if (count > 0) return count;
  }

  // 3. Fallback for legacy single-division patients
  if (patient.firstOfficerName) {
    const boxTitle = pi.firstBoxTitle || mp.firstBoxId;
    const legacyCat = getTherapistCategory(patient.firstOfficerName, boxTitle);
    if (legacyCat === category) {
      return pi.visitCount || mp.totalVisits || 1;
    }
  }

  return 0;
};

/**
 * Returns a complete overview of 1st PJ and visit counts across all 3 disciplines (FT, OT, TW)
 */
export const getPatientMultiDisciplineSummary = (
  patient: Partial<MasterPatient> | Partial<PatientItem> | null | undefined
) => {
  const fisioTherapist = getDisciplineFirstTherapist(patient, 'fisio');
  const okupasiTherapist = getDisciplineFirstTherapist(patient, 'okupasi');
  const wicaraTherapist = getDisciplineFirstTherapist(patient, 'wicara');

  const fisioCount = getDisciplineVisitCount(patient, 'fisio');
  const okupasiCount = getDisciplineVisitCount(patient, 'okupasi');
  const wicaraCount = getDisciplineVisitCount(patient, 'wicara');

  const activeDisciplines: TherapyCategory[] = [];
  if (fisioTherapist || fisioCount > 0) activeDisciplines.push('fisio');
  if (okupasiTherapist || okupasiCount > 0) activeDisciplines.push('okupasi');
  if (wicaraTherapist || wicaraCount > 0) activeDisciplines.push('wicara');

  return {
    fisio: {
      firstTherapist: fisioTherapist,
      visitCount: fisioCount,
      hasHistory: !!fisioTherapist || fisioCount > 0,
    },
    okupasi: {
      firstTherapist: okupasiTherapist,
      visitCount: okupasiCount,
      hasHistory: !!okupasiTherapist || okupasiCount > 0,
    },
    wicara: {
      firstTherapist: wicaraTherapist,
      visitCount: wicaraCount,
      hasHistory: !!wicaraTherapist || wicaraCount > 0,
    },
    activeDisciplines,
    totalDisciplinesCount: activeDisciplines.length,
  };
};
