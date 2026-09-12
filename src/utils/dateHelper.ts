/**
 * Helper untuk penanganan tanggal dan waktu lokal WIB (Asia/Jakarta).
 * Mencegah masalah pergeseran tanggal (UTC offset bug) pada jam 00:00 - 06:59 WIB.
 */

/**
 * Mengembalikan tanggal lokal WIB (Asia/Jakarta) dalam format YYYY-MM-DD.
 * Pengganti new Date().toISOString().split('T')[0] yang berbasis UTC.
 */
export function getLocalDateStringWIB(date: Date = new Date()): string {
  // Locale 'en-CA' secara standar menghasilkan format YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/**
 * Mengembalikan string tanggal-jam WIB dalam format YYYY-MM-DDTHH:mm:ss.
 * Digunakan untuk visual/logging waktu lokal.
 */
export function getLocalDateTimeStringWIB(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date).replace(' ', 'T');
}

/**
 * Mengembalikan timestamp epoch (ms) untuk jam buka layanan pada tanggal WIB terkait (default: 08:00 WIB).
 * WIB = UTC+7 tanpa DST, jadi 08:00 WIB == 01:00 UTC pada tanggal yang sama.
 */
export function getServiceStartTimestampWIB(date: Date, startHour: number = 8): number {
  const wibDateStr = getLocalDateStringWIB(date); // YYYY-MM-DD
  const [year, month, day] = wibDateStr.split('-').map(Number);
  // WIB = UTC+7 tetap tanpa DST, jadi 08:00 WIB == (startHour - 7):00 UTC pada tanggal itu
  return Date.UTC(year, month - 1, day, startHour - 7, 0, 0, 0);
}
