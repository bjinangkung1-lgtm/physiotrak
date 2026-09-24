import { SavedOfficer, BoxColor, QueueBox } from '../types';

export const SAVED_OFFICERS_STORAGE_KEY = 'antrian_irm_saved_officers_v1';

export type TherapyCategory = 'fisio' | 'okupasi' | 'wicara';

export const getTherapistCategory = (officerName: string, location?: string, explicitCategory?: string): TherapyCategory => {
  if (explicitCategory === 'okupasi' || explicitCategory === 'wicara' || explicitCategory === 'fisio') {
    return explicitCategory;
  }
  const nameLower = (officerName || '').toLowerCase();
  const locLower = (location || '').toLowerCase();
  const fullStr = `${nameLower} ${locLower}`;
  
  // 1. Wicara (TW) - Monalisa & Kalya and speech therapy terms take priority
  if (
    nameLower.includes('monalisa') ||
    nameLower.includes('kalya') ||
    fullStr.includes('wicara') ||
    fullStr.includes('speech') ||
    fullStr.includes('a.md.tw') ||
    fullStr.includes('s.tr.tw') ||
    /\btw\b/i.test(fullStr)
  ) {
    return 'wicara';
  }

  // 2. Okupasi (OT)
  if (
    nameLower.includes('cecep') ||
    nameLower.includes('gunandar') ||
    nameLower.includes('putri') ||
    fullStr.includes('okupasi') ||
    fullStr.includes('occupational') ||
    fullStr.includes('a.md.ot') ||
    fullStr.includes('s.tr.ot') ||
    /\bot\b/i.test(fullStr)
  ) {
    return 'okupasi';
  }

  // Default: Fisioterapi
  return 'fisio';
};

export const getCanonicalTherapistKey = (officerName: string = '', location: string = '', id: string = ''): string => {
  const nameLower = (officerName || '').toLowerCase();
  const idLower = (id || '').toLowerCase();

  if (nameLower.includes('peralihan') || idLower.includes('peralihan')) return 'box-peralihan-siang';
  if (nameLower.includes('jemputan') || idLower.includes('jemputan')) return 'box-jemputan';

  const full = nameLower;

  if (full.includes('cecep')) return 'ot-cecep';
  if (full.includes('gunandar')) return 'ot-gunandar';
  if (full.includes('putri')) return 'ot-putri';
  if (full.includes('monalisa')) return 'tw-monalisa';
  if (full.includes('kalya')) return 'tw-kalya';
  if (full.includes('bambang')) return 'ft-bambang';
  if (full.includes('musowir')) return 'ft-musowir';
  if (full.includes('vita')) return 'ft-vita';
  if (full.includes('nazrudin')) return 'ft-nazrudin';
  if (full.includes('umi animah') || full.includes('animah')) return 'ft-umi';
  if (full.includes('nuha')) return 'ft-nuha';
  if (full.includes('shiva')) return 'ft-shiva';
  if (full.includes('tara')) return 'ft-tara';
  if (full.includes('aliya')) return 'ft-aliya';
  if (full.includes('bagus')) return 'ft-bagus';
  if (full.includes('fikrilian')) return 'ft-fikrilian';
  if (full.includes('fikri')) return 'ft-fikri';
  if (full.includes('reva')) return 'ft-reva';
  if (full.includes('najjah')) return 'ft-najjah';
  if (full.includes('ayuning') || full.includes('ayu')) return 'ft-ayu';
  if (full.includes('ammell')) return 'ft-ammell';
  if (full.includes('saiful')) return 'ft-saiful';
  if (full.includes('ariq')) return 'ft-ariq';
  if (full.includes('tri handayani')) return 'ft-tri';
  if (full.includes('bustomi')) return 'ft-bustomi';

  const clean = nameLower.replace(/(sst\.ftr|sst\.ft|sstft|sst ft|amd\.ft|amd ft|amd\.kep|s\.kep|s\.ft|s\.ft|ftr|a\.md\.tw|a\.md\.ot|s\.tr\.tw|s\.tr\.ot|dr\.|drg\.)/gi, '').trim();
  return clean || idLower || nameLower;
};

export const DEFAULT_OFFICERS: SavedOfficer[] = [
  // ===== FISIOTERAPI =====
  { id: 'off-1', name: 'Bambang Jinangkung SST.Ftr', shortTitle: 'BAMBANG JINANGKUNG', location: '', category: 'fisio', role: 'Fisioterapis', color: 'blue', isDefault: true },
  { id: 'off-2', name: 'Musowir SST.FT', shortTitle: 'MUSOWIR', location: '', category: 'fisio', role: 'Fisioterapis', color: 'purple', isDefault: true },
  { id: 'off-3', name: 'Vita Puspitaningrum Amd FT', shortTitle: 'VITA PUSPITANINGRUM', location: '', category: 'fisio', role: 'Fisioterapis', color: 'pink', isDefault: true },
  { id: 'off-4', name: 'Nazrudin, Amd.Ft', shortTitle: 'NAZRUDIN', location: '', category: 'fisio', role: 'Fisioterapis', color: 'orange', isDefault: true },
  { id: 'off-5', name: 'umi animah Ftr', shortTitle: 'UMI ANIMAH', location: '', category: 'fisio', role: 'Fisioterapis', color: 'green', isDefault: true },
  { id: 'off-6', name: 'Nuha Fadhillah, Ftr', shortTitle: 'NUHA FADHILLAH', location: '', category: 'fisio', role: 'Fisioterapis', color: 'coral', isDefault: true },
  { id: 'off-7', name: 'Shiva widiaty Ftr', shortTitle: 'SHIVA WIDIATY', location: '', category: 'fisio', role: 'Fisioterapis', color: 'purple', isDefault: true },
  { id: 'off-8', name: 'Tara Lufitasari Ftr', shortTitle: 'TARA LUFITASARI', location: '', category: 'fisio', role: 'Fisioterapis', color: 'yellow', isDefault: true },
  { id: 'off-9', name: 'Aliya Ramadhani SstFt', shortTitle: 'ALIYA RAMADHANI', location: '', category: 'fisio', role: 'Fisioterapis', color: 'blue', isDefault: true },
  { id: 'off-10', name: 'Bagus Dhika SsT Ft', shortTitle: 'BAGUS DHIKA', location: '', category: 'fisio', role: 'Fisioterapis', color: 'sage', isDefault: true },
  { id: 'off-11', name: 'Zainul FIKRILIAN SST.Ft', shortTitle: 'ZAINUL FIKRILIAN', location: '', category: 'fisio', role: 'Fisioterapis', color: 'green', isDefault: true },
  { id: 'off-12', name: 'Fikri', shortTitle: 'FIKRI', location: '', category: 'fisio', role: 'Fisioterapis', color: 'orange', isDefault: true },
  { id: 'off-13', name: 'Reva Nanda Saputra S.Ft', shortTitle: 'REVA', location: '', category: 'fisio', role: 'Fisioterapis', color: 'yellow', isDefault: true },
  { id: 'off-14', name: 'Najjah, S.Kep', shortTitle: 'NAJJAH', location: '', category: 'fisio', role: 'Perawat / Fisioterapis', color: 'blue', isDefault: true },
  { id: 'off-15', name: 'Ayu, Amd.Kep', shortTitle: 'AYU', location: '', category: 'fisio', role: 'Perawat / Fisioterapis', color: 'purple', isDefault: true },
  { id: 'off-16', name: 'Ammell, S.FT', shortTitle: 'AMMELL', location: '', category: 'fisio', role: 'Fisioterapis', color: 'orange', isDefault: true },
  { id: 'off-17', name: 'Saiful, S.FT', shortTitle: 'SAIFUL', location: '', category: 'fisio', role: 'Fisioterapis', color: 'coral', isDefault: true },
  { id: 'off-18', name: 'Ariq Muafa Adli, Amd.Ft', shortTitle: 'ARIQ', location: '', category: 'fisio', role: 'Fisioterapis', color: 'sage', isDefault: true },
  { id: 'off-20', name: 'Tim Transport IRM RSPP', shortTitle: 'TIM TRANSPORT', location: '', category: 'fisio', role: 'Tim Transport', color: 'sage', isDefault: true },

  // ===== TERAPI OKUPASI (OT) =====
  { id: 'off-21', name: 'Cecep, A.Md.OT', shortTitle: 'CECEP', location: '', category: 'okupasi', role: 'Terapis Okupasi (OT)', color: 'purple', isDefault: true },
  { id: 'off-22', name: 'Gunandar, A.Md.OT', shortTitle: 'GUNANDAR', location: '', category: 'okupasi', role: 'Terapis Okupasi (OT)', color: 'pink', isDefault: true },
  { id: 'off-23', name: 'Putri, A.Md.OT', shortTitle: 'PUTRI', location: '', category: 'okupasi', role: 'Terapis Okupasi (OT)', color: 'coral', isDefault: true },

  // ===== TERAPI WICARA (TW) =====
  { id: 'off-24', name: 'Monalisa', shortTitle: 'MONALISA', location: '', category: 'wicara', role: 'Terapis Wicara (TW)', color: 'yellow', isDefault: true },
  { id: 'off-25', name: 'Kalya', shortTitle: 'KALYA', location: '', category: 'wicara', role: 'Terapis Wicara (TW)', color: 'orange', isDefault: true }
];

export const deriveShortTitle = (name: string): string => {
  if (!name) return 'PETUGAS';
  // Remove degrees like SST.Ftr, S.Kep, Amd FT, A.Md.TW, A.Md.OT, etc.
  const cleaned = name
    .replace(/(SST\.Ftr|SST\.FT|SstFt|SsT Ft|Amd\.Ft|Amd FT|Amd\.Kep|S\.Kep|S\.Ft|S\.FT|Ftr|A\.Md\.TW|A\.Md\.OT|S\.Tr\.TW|S\.Tr\.OT|Dr\.|dr\.|drg\.)/gi, '')
    .replace(/[,.]/g, '')
    .trim();
  return (cleaned || name).toUpperCase();
};

export const getSavedOfficers = (boxes?: QueueBox[]): SavedOfficer[] => {
  try {
    const raw = localStorage.getItem(SAVED_OFFICERS_STORAGE_KEY);
    let list: SavedOfficer[] = [];

    if (raw) {
      list = JSON.parse(raw);
    }

    // Merge with DEFAULT_OFFICERS so defaults are always available
    const existingNameMap = new Map<string, SavedOfficer>();
    DEFAULT_OFFICERS.forEach(d => {
      const canonicalKey = getCanonicalTherapistKey(d.name, d.location, d.id);
      existingNameMap.set(canonicalKey, d);
    });

    list.forEach(item => {
      if (item && item.name) {
        const canonicalKey = getCanonicalTherapistKey(item.name, item.location, item.id);
        const existing = existingNameMap.get(canonicalKey);
        if (existing) {
          existingNameMap.set(canonicalKey, {
            ...existing,
            ...item,
            name: existing.name || item.name,
            category: existing.category || item.category || getTherapistCategory(item.name, item.location),
            shortTitle: existing.shortTitle || item.shortTitle || deriveShortTitle(item.name)
          });
        } else {
          existingNameMap.set(canonicalKey, {
            ...item,
            category: item.category || getTherapistCategory(item.name, item.location),
            shortTitle: item.shortTitle || deriveShortTitle(item.name)
          });
        }
      }
    });

    // Also include any officer names currently in active boxes
    if (boxes && Array.isArray(boxes)) {
      boxes.forEach(b => {
        if (b.officerName && b.officerName.trim()) {
          const key = getCanonicalTherapistKey(b.officerName, b.location, b.id);
          if (!existingNameMap.has(key)) {
            existingNameMap.set(key, {
              id: `off-box-${b.id}`,
              name: b.officerName.trim(),
              shortTitle: deriveShortTitle(b.officerName),
              location: b.location || 'Ruang Terapi IRM',
              category: b.category || getTherapistCategory(b.officerName, b.location),
              color: b.color || 'blue',
              isDefault: false,
              createdAt: b.createdAt || new Date().toISOString()
            });
          }
        }
      });
    }

    const merged = Array.from(existingNameMap.values()).filter(item => {
      const k = getCanonicalTherapistKey(item.name, item.location, item.id);
      return k !== 'ft-tri' && k !== 'ft-bustomi';
    });
    return merged;
  } catch (err) {
    console.error('Error loading saved officers:', err);
    return DEFAULT_OFFICERS;
  }
};

export const saveCustomOfficer = (officer: {
  name: string;
  shortTitle?: string;
  location?: string;
  category?: 'fisio' | 'okupasi' | 'wicara' | string;
  color?: BoxColor;
  role?: string;
}): SavedOfficer => {
  const cleanName = officer.name.trim();
  if (!cleanName) {
    throw new Error('Nama petugas tidak boleh kosong');
  }

  const currentList = getSavedOfficers();
  const existingIdx = currentList.findIndex(
    o => o.name.trim().toLowerCase() === cleanName.toLowerCase()
  );

  const shortTitle = officer.shortTitle?.trim() || deriveShortTitle(cleanName);
  const location = officer.location?.trim() || 'Ruang Terapi IRM';
  const color = officer.color || 'blue';
  const category = officer.category || getTherapistCategory(cleanName, location);

  let savedRecord: SavedOfficer;

  if (existingIdx >= 0) {
    savedRecord = {
      ...currentList[existingIdx],
      name: cleanName,
      shortTitle,
      location: officer.location ? location : currentList[existingIdx].location,
      color: officer.color ? color : currentList[existingIdx].color,
      category: category || currentList[existingIdx].category,
      role: officer.role || currentList[existingIdx].role,
    };
    currentList[existingIdx] = savedRecord;
  } else {
    savedRecord = {
      id: `off-custom-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: cleanName,
      shortTitle,
      location,
      color,
      category,
      role: officer.role || (category === 'okupasi' ? 'Terapis Okupasi' : category === 'wicara' ? 'Terapis Wicara' : 'Fisioterapis'),
      isDefault: false,
      createdAt: new Date().toISOString()
    };
    currentList.push(savedRecord);
  }

  // Persist locally
  try {
    localStorage.setItem(SAVED_OFFICERS_STORAGE_KEY, JSON.stringify(currentList));
    window.dispatchEvent(new CustomEvent('saved_officers_updated', { detail: currentList }));
  } catch (err) {
    console.error('Error saving officers to localStorage:', err);
  }

  // Sync with server in background
  try {
    fetch('/api/officers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(savedRecord)
    }).catch(() => {
      // Offline / server fallback is fine
    });
  } catch {
    // Ignore offline network errors
  }

  return savedRecord;
};

export const deleteCustomOfficer = (idOrName: string): void => {
  try {
    const currentList = getSavedOfficers();
    const updated = currentList.filter(
      o => o.id !== idOrName && o.name.trim().toLowerCase() !== idOrName.trim().toLowerCase()
    );
    localStorage.setItem(SAVED_OFFICERS_STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('saved_officers_updated', { detail: updated }));

    fetch(`/api/officers/${encodeURIComponent(idOrName)}`, {
      method: 'DELETE'
    }).catch(() => {});
  } catch (err) {
    console.error('Error deleting custom officer:', err);
  }
};

export const getAllTherapistNames = (boxes?: QueueBox[]): string[] => {
  const officers = getSavedOfficers(boxes);
  const names = officers
    .map(o => o.name.trim())
    .filter(name => Boolean(name) && !name.toLowerCase().includes('transport') && !name.toLowerCase().includes('jemputan'));
  
  return Array.from(new Set(names));
};

export const getAllOfficerNamesWithTransport = (boxes?: QueueBox[]): string[] => {
  const officers = getSavedOfficers(boxes);
  const names = officers.map(o => o.name.trim()).filter(Boolean);
  return Array.from(new Set(names));
};
