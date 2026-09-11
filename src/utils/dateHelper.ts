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
