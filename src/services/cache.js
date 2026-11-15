// src/services/cache.js
// Lapis cache kedua (cache-aside) di memori aplikasi.
//
// Firestore sudah punya cache IndexedDB, tapi setiap getDocs tetap menyentuh
// SDK + revalidasi. Cache ini membuat perpindahan menu dalam satu sesi tidak
// memicu query sama sekali selama data masih segar (TTL), sehingga daftar
// tampil seketika dan jumlah read jauh berkurang.
//
// Pola: Cache-Aside + Stale-While-Revalidate.
// - Data segar (< TTL): dipakai tanpa menyentuh jaringan.
// - Data basi (> TTL): data lama dikembalikan seketika, lalu fetcher dijalankan
//   di belakang layar. Hasilnya masuk cache dan memberi tahu semua pelanggan
//   `subscribe` — halaman memperbarui diri tanpa loading spinner.
// - Mutasi (tambah/ubah/hapus) tetap meng-invalidasi kuncinya.

import { withTimeout } from '../utils/async';

const store = new Map(); // key -> { data, at }
const inflight = new Map(); // key -> Promise (mencegah query ganda bersamaan)
const subscribers = new Map(); // key -> Set<(data) => void>

// 5 menit: cukup untuk berpindah-pindah menu. Di luar jendela ini data lama
// tetap langsung tampil (SWR) dan disegarkan diam-diam — biaya read hanya
// satu per jendela, bukan setiap navigasi.
const DEFAULT_TTL = 300_000;

// Firestore TIDAK selalu me-reject saat koneksi tersendat; getDocs bisa
// menggantung tanpa batas. Tanpa batas waktu di sini, satu permintaan macet
// membuat halaman "loading" selamanya — dan karena ada dedup in-flight,
// SETIAP kunjungan berikutnya ikut menunggu promise macet yang sama.
const FETCH_TIMEOUT = 10_000;

const notify = (key, data) => {
  (subscribers.get(key) || []).forEach((cb) => {
    try {
      cb(data);
    } catch (e) {
      console.warn(`[cache] subscriber ${key} error`, e);
    }
  });
};

const runFetcher = (key, fetcher) => {
  // Tunda fetcher satu microtask agar lemparan sinkron juga melewati cleanup,
  // dan promise sudah terdaftar sebelum fetcher bisa memanggil cache lagi.
  const p = Promise.resolve().then(async () => {
    try {
      const data = await withTimeout(Promise.resolve().then(fetcher), FETCH_TIMEOUT);
      // Invalidasi/prime selama query berjalan membatalkan hak query lama
      // untuk menimpa data yang lebih baru.
      if (inflight.get(key) === p) {
        store.set(key, { data, at: Date.now() });
        notify(key, data);
      }
      return data;
    } catch (e) {
      const stale = store.get(key);
      if (stale) {
        console.warn(`[cache] ${key} gagal disegarkan, memakai data lama.`, e?.message || e);
        return stale.data;
      }
      throw e;
    } finally {
      if (inflight.get(key) === p) inflight.delete(key);
    }
  });
  inflight.set(key, p);
  return p;
};

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
 * @param {number} ttl - masa hidup data (ms); setelah itu revalidate di belakang layar
 */
export const cached = async (key, fetcher, ttl = DEFAULT_TTL) => {
  const hit = store.get(key);
  if (hit && Date.now() - hit.at < ttl) {
    return hit.data;
  }

  // Bila permintaan yang sama sedang berjalan, ikut menunggu — jangan query dua kali.
  if (inflight.has(key)) {
    return hit ? hit.data : inflight.get(key);
  }

  // SWR: data basi tetap dipakai seketika; penyegaran berjalan di belakang.
  // Pelanggan subscribe() akan menerima data baru begitu selesai.
  if (hit) {
    runFetcher(key, fetcher).catch((e) => {
      console.warn(`[cache] ${key} gagal disegarkan.`, e?.message || e);
    }); // invalidasi dapat menghapus fallback ketika penyegaran masih berjalan
    return hit.data;
  }

  return runFetcher(key, fetcher);
};

/**
 * Berlangganan pembaruan sebuah kunci (mis. hasil revalidasi SWR).
 * Mengembalikan fungsi berhenti langganan.
 */
export const subscribe = (key, cb) => {
  if (!subscribers.has(key)) subscribers.set(key, new Set());
  subscribers.get(key).add(cb);
  return () => subscribers.get(key).delete(cb);
};

/** Hapus satu kunci atau semua kunci berawalan tertentu. */
export const invalidate = (prefix) => {
  const keys = new Set([...store.keys(), ...inflight.keys()]);
  keys.forEach((key) => {
    if (!prefix || key.startsWith(prefix)) {
      store.delete(key);
      inflight.delete(key);
    }
  });
};

/** Perbarui isi cache tanpa query (mis. setelah menyimpan data). */
export const primeCache = (key, data) => {
  inflight.delete(key);
  store.set(key, { data, at: Date.now() });
};

export const CACHE_KEYS = {
  PROJECTS: 'projects:all',
  CLIENTS: 'clients:all',
  INVOICES: 'invoices:all',
  TRANSACTIONS: 'transactions:all',
  SETTINGS: 'settings:company'
};

export default cached;
