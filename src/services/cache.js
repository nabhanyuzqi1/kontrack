// src/services/cache.js
// Lapis cache kedua (cache-aside) di memori aplikasi.
//
// Firestore sudah punya cache IndexedDB, tapi setiap getDocs tetap menyentuh
// SDK + revalidasi. Cache ini membuat perpindahan menu dalam satu sesi tidak
// memicu query sama sekali selama data masih segar (TTL), sehingga daftar
// tampil seketika dan jumlah read jauh berkurang.
//
// Pola: Cache-Aside — cek cache dulu; bila kosong/kedaluwarsa, ambil dari
// sumber lalu simpan. Mutasi (tambah/ubah/hapus) meng-invalidasi kuncinya.

import { withTimeout } from '../utils/async';

const store = new Map(); // key → { data, at }
const inflight = new Map(); // key → Promise (mencegah query ganda bersamaan)

const DEFAULT_TTL = 60_000; // 1 menit — cukup untuk berpindah menu

// Firestore TIDAK selalu me-reject saat koneksi tersendat: getDocs bisa
// menggantung tanpa batas. Tanpa batas waktu di sini, satu permintaan macet
// membuat halaman "loading" selamanya — dan karena ada dedup in-flight,
// SETIAP kunjungan berikutnya ikut menunggu promise macet yang sama.
const FETCH_TIMEOUT = 10_000;

/**
 * Ambil dari cache, atau jalankan fetcher lalu simpan.
 *
 * Bila fetcher melewati batas waktu, data lama (walau kedaluwarsa) dipakai
 * sebagai penyelamat — halaman tetap terisi, hanya sedikit basi. Bila belum
 * pernah ada data sama sekali, barulah error dilempar supaya pemanggil bisa
 * menampilkan pesan, bukan berputar selamanya.
 *
 * @param {string} key
 * @param {Function} fetcher - () => Promise<data>
 * @param {number} ttl - masa berlaku (ms)
 */
export const cached = async (key, fetcher, ttl = DEFAULT_TTL) => {
  const hit = store.get(key);
  if (hit && Date.now() - hit.at < ttl) {
    return hit.data;
  }

  // Bila permintaan yang sama sedang berjalan, ikut menunggu — jangan query dua kali.
  if (inflight.has(key)) return inflight.get(key);

  const p = (async () => {
    try {
      const data = await withTimeout(fetcher(), FETCH_TIMEOUT);
      store.set(key, { data, at: Date.now() });
      return data;
    } catch (e) {
      const stale = store.get(key);
      if (stale) {
        console.warn(`[cache] ${key} gagal disegarkan, memakai data lama.`, e?.message || e);
        return stale.data;
      }
      throw e;
    } finally {
      // Wajib dibersihkan walau gagal — kalau tidak, permintaan macet akan
      // "menular" ke semua kunjungan berikutnya dan tidak pernah bisa dicoba ulang.
      inflight.delete(key);
    }
  })();

  inflight.set(key, p);
  return p;
};

/** Hapus satu kunci atau semua kunci berawalan tertentu. */
export const invalidate = (prefix) => {
  if (!prefix) {
    store.clear();
    return;
  }
  [...store.keys()].filter((k) => k.startsWith(prefix)).forEach((k) => store.delete(k));
};

/** Perbarui isi cache tanpa query (mis. setelah menyimpan data). */
export const primeCache = (key, data) => store.set(key, { data, at: Date.now() });

export const CACHE_KEYS = {
  PROJECTS: 'projects:all',
  CLIENTS: 'clients:all',
  INVOICES: 'invoices:all',
  TRANSACTIONS: 'transactions:all',
  SETTINGS: 'settings:company'
};

export default cached;
