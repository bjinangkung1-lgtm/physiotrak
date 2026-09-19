/**
 * Penulisan localStorage yang tidak pernah melempar error.
 *
 * KENAPA PERLU:
 * localStorage.setItem BISA melempar error, dan itu bukan kasus langka:
 *   - Safari di iPhone/iPad melempar QuotaExceededError saat mode Penyamaran
 *     (Private Browsing) aktif - Chrome tidak melakukan ini.
 *   - Kuota penyimpanan (sekitar 5 MB per situs) penuh.
 *   - Sebagian pengaturan privasi iOS membuat akses window.localStorage itu
 *     sendiri melempar SecurityError, bahkan sebelum setItem dipanggil.
 *
 * Kalau error itu terjadi di tengah sebuah useEffect, SEMUA baris sesudahnya
 * tidak pernah berjalan - termasuk pengiriman perubahan ke server. Akibatnya
 * perangkat itu terlihat normal di layarnya sendiri, tapi perubahannya diam-diam
 * tidak pernah sampai ke perangkat lain. Justru inilah yang paling sulit dilacak.
 *
 * Penyimpanan lokal di aplikasi ini hanya berfungsi sebagai SALINAN cepat; sumber
 * kebenarannya ada di server. Jadi gagal menyimpan salinan tidak boleh sampai
 * menghentikan penyinkronan - itu membuat keadaan justru lebih buruk.
 */

// Peringatan cukup sekali per kunci, supaya konsol tidak dibanjiri.
const sudahDiperingatkan = new Set<string>();

/**
 * Menyimpan ke localStorage. Mengembalikan true kalau berhasil, false kalau gagal.
 * TIDAK PERNAH melempar error.
 */
export function safeLocalSet(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (err) {
    if (!sudahDiperingatkan.has(key)) {
      sudahDiperingatkan.add(key);
      console.warn(
        `[Storage] Gagal menyimpan "${key}" ke penyimpanan lokal ` +
        `(kemungkinan kuota penuh atau mode Penyamaran Safari). ` +
        `Aplikasi tetap berjalan dan tetap menyinkronkan ke server.`,
        err
      );
    }
    return false;
  }
}
