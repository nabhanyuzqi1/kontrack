// src/utils/txDateTime.js
//
// Tanggal + jam transaksi: satu tempat untuk menggabung, memvalidasi, dan
// merapikan. Semua fungsi MURNI (tanpa Firebase) supaya bisa diuji di Node.
//
// Kenapa perlu berkas sendiri:
// - Hasil AI sering memberi tanggal TANPA jam ("2026-05-01"), sementara input
//   manual memakai datetime-local ("2026-05-01T14:30"). Dulu nilai itu disimpan
//   apa adanya, sehingga jam hilang dan urutan transaksi dalam satu hari acak.
// - `new Date('2026-05-01')` ditafsirkan sebagai tengah malam UTC (07:00 WIB),
//   bukan waktu lokal. Jam transaksi jadi bergeser tanpa terlihat.
// - Tanggal yang tak terbaca jangan sampai diam-diam menjadi "sekarang",
//   karena itu mengarang waktu yang tidak ada di nota.

/** Jam default bila nota hanya memuat tanggal: awal hari kerja, bukan tengah malam. */
export const DEFAULT_HOUR = 8;

const pad = (n) => String(n).padStart(2, '0');

/**
 * Parse tanggal apa pun menjadi { y, m, d, hh, mm } atau null.
 * Diterima: "2026-05-01", "2026-05-01T14:30", "2026-05-01 14:30",
 * "01/05/2026", "1 Mei 2026".
 */
export const parseTxDateTime = (value) => {
  if (value == null || value === '') return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return {
      y: value.getFullYear(),
      m: value.getMonth() + 1,
      d: value.getDate(),
      hh: value.getHours(),
      mm: value.getMinutes()
    };
  }

  // Timestamp Firestore ({ seconds }) — bentuk campuran yang ada di data produksi.
  if (typeof value === 'object' && typeof value.seconds === 'number') {
    const dt = new Date(value.seconds * 1000);
    return { y: dt.getFullYear(), m: dt.getMonth() + 1, d: dt.getDate(), hh: dt.getHours(), mm: dt.getMinutes() };
  }

  const s = String(value).trim();

  // ISO / datetime-local: 2026-05-01, 2026-05-01T14:30, 2026-05-01 14:30(:00)
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{1,2}):(\d{2}))?/);
  if (m) {
    return {
      y: +m[1],
      m: +m[2],
      d: +m[3],
      // Tanpa jam: penanda `null` agar pemanggil tahu ini bukan jam sungguhan.
      hh: m[4] == null ? null : +m[4],
      mm: m[5] == null ? null : +m[5]
    };
  }

  // dd/mm/yyyy atau dd-mm-yyyy (umum di nota Indonesia)
  m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:[T ](\d{1,2}):(\d{2}))?/);
  if (m) {
    return {
      y: +m[3],
      m: +m[2],
      d: +m[1],
      hh: m[4] == null ? null : +m[4],
      mm: m[5] == null ? null : +m[5]
    };
  }

  const fallback = new Date(s);
  if (!Number.isNaN(fallback.getTime())) {
    return {
      y: fallback.getFullYear(),
      m: fallback.getMonth() + 1,
      d: fallback.getDate(),
      hh: fallback.getHours(),
      mm: fallback.getMinutes()
    };
  }

  // Nama bulan Indonesia, urutan hari-bulan-tahun: "1 Mei 2026", "15 Agustus 2026".
  // Ditangani eksplisit karena new Date() tidak mengenal nama bulan Indonesia
  // (hasilnya Invalid Date, lalu tanggal transaksi hilang tanpa pesan).
  const m2 = s.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})(?:\s+(\d{1,2})[:.](\d{2}))?/);
  if (m2) {
    const bulan = {
      januari: 1, februari: 2, maret: 3, april: 4, mei: 5, juni: 6,
      juli: 7, agustus: 8, september: 9, oktober: 10, november: 11, desember: 12,
      jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, agu: 8, agt: 8,
      sep: 9, okt: 10, nov: 11, des: 12
    };
    const key = m2[2].toLowerCase();
    if (bulan[key]) {
      return {
        y: +m2[3],
        m: bulan[key],
        d: +m2[1],
        hh: m2[4] == null ? null : +m2[4],
        mm: m2[5] == null ? null : +m2[5]
      };
    }
  }

  return null;
};

/** Apakah nilai ini memuat jam yang benar-benar terbaca (bukan hasil tambahan). */
export const hasExplicitTime = (value) => {
  const p = parseTxDateTime(value);
  return Boolean(p && p.hh != null && p.mm != null);
};

/**
 * Gabungkan tanggal dan jam menjadi string ISO LOKAL ("2026-05-01T08:00").
 * Sengaja bukan toISOString(): itu mengubah ke UTC sehingga tanggal bisa
 * bergeser sehari untuk transaksi pagi WIB.
 */
export const toLocalIso = ({ y, m, d, hh = DEFAULT_HOUR, mm = 0 }) =>
  `${y}-${pad(m)}-${pad(d)}T${pad(hh)}:${pad(mm)}`;

/**
 * Nilai siap simpan untuk sebuah transaksi.
 *
 * @param {string} date nilai tanggal dari AI/manual
 * @param {string} time jam terpisah dari AI ("14:30"), opsional
 * @param {{ fallbackToNow?: boolean }} opts
 * @returns {string} "YYYY-MM-DDTHH:MM" atau '' bila tak terbaca dan tidak boleh menebak
 */
export const normalizeTxDateTime = (date, time, { fallbackToNow = true } = {}) => {
  const parts = parseTxDateTime(date);

  if (!parts) {
    // Tanggal tak terbaca: pemanggil memutuskan apakah memakai waktu sekarang
    // (input manual) atau membiarkan kosong untuk dikoreksi (hasil AI).
    return fallbackToNow ? toLocalIso(parseTxDateTime(new Date())) : '';
  }

  let { hh, mm } = parts;

  // Jam terpisah dari AI hanya dipakai bila benar-benar ada.
  if ((hh == null || hh === 0 && !hasExplicitTime(date)) && typeof time === 'string') {
    const tm = time.match(/^(\d{1,2}):(\d{2})/);
    if (tm) {
      hh = +tm[1];
      mm = +tm[2];
    }
  }

  return toLocalIso({ y: parts.y, m: parts.m, d: parts.d, hh: hh ?? DEFAULT_HOUR, mm: mm ?? 0 });
};

/** Label ringkas untuk ditampilkan/dirapikan: "01 Mei 2026, 14:30" (tanpa jam bila memang tidak ada). */
export const describeTxDateTime = (value) => {
  const p = parseTxDateTime(value);
  if (!p) return '—';
  const date = `${pad(p.d)}/${pad(p.m)}/${p.y}`;
  if (p.hh == null || p.mm == null) return date;
  return `${date} ${pad(p.hh)}:${pad(p.mm)}`;
};
