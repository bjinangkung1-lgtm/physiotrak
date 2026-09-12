import { RanapCategory, RanapQueueItem } from '../types';

export const RANAP_CATEGORY_ORDER: RanapCategory[] = ['fisio', 'okupasi', 'wicara'];

export const RANAP_CATEGORY_LABELS: Record<RanapCategory, string> = {
  fisio: 'Antrean Ranap Fisio',
  okupasi: 'Antrean Ranap Okupasi',
  wicara: 'Antrean Ranap Wicara',
};

export const RANAP_CATEGORY_SHORT_LABELS: Record<RanapCategory, string> = {
  fisio: 'Fisio',
  okupasi: 'Okupasi',
  wicara: 'Wicara',
};

/**
 * Nomor ruangan sering ditulis campuran angka+huruf (mis. "4A", "10").
 * Urutkan berdasarkan angka di depannya dulu (3, 4, 5 ... 10, bukan
 * "10" < "3" secara alfabet), baru sisa hurufnya sebagai tiebreaker.
 */
export function getRoomSortKey(roomNumber?: string): { num: number; rest: string } {
  const raw = (roomNumber || '').trim();
  const match = raw.match(/^(\d+)(.*)$/);
  if (match) {
    return { num: parseInt(match[1], 10), rest: match[2].trim().toLowerCase() };
  }
  // Tidak ada angka di depan - taruh di akhir urutan kelompoknya, urut alfabet
  return { num: Number.MAX_SAFE_INTEGER, rest: raw.toLowerCase() };
}

export function compareByRoomNumber(a: RanapQueueItem, b: RanapQueueItem): number {
  const keyA = getRoomSortKey(a.roomNumber);
  const keyB = getRoomSortKey(b.roomNumber);
  if (keyA.num !== keyB.num) return keyA.num - keyB.num;
  return keyA.rest.localeCompare(keyB.rest);
}

/**
 * Urutkan antrean ranap: kelompok per divisi terapi (Fisio -> Okupasi -> Wicara)
 * lebih dulu, lalu di dalam tiap kelompok diurutkan naik berdasarkan nomor
 * ruangan (3, 4, 5, 6, 7 ...).
 */
export function sortRanapQueue(items: RanapQueueItem[]): RanapQueueItem[] {
  return [...items].sort((a, b) => {
    const orderA = RANAP_CATEGORY_ORDER.indexOf(a.category);
    const orderB = RANAP_CATEGORY_ORDER.indexOf(b.category);
    if (orderA !== orderB) return orderA - orderB;
    return compareByRoomNumber(a, b);
  });
}

export function groupRanapQueueByCategory(items: RanapQueueItem[]): Record<RanapCategory, RanapQueueItem[]> {
  const sorted = sortRanapQueue(items);
  const grouped: Record<RanapCategory, RanapQueueItem[]> = { fisio: [], okupasi: [], wicara: [] };
  sorted.forEach((item) => {
    if (grouped[item.category]) {
      grouped[item.category].push(item);
    }
  });
  return grouped;
}
