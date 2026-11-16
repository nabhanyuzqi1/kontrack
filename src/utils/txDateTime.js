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
//
// URUTAN PENTING: semua pola tertulis diurai SEBELUM `new Date()`. Sebelumnya
// `new Date()` dicoba lebih dulu dan itu punya dua cacat nyata:
//   "12-11-2026"  → dibaca 11 Desember (V8 menganggap pola "-" sebagai
//                   tahun-bulan-hari), padahal nota Indonesia menulis hari dulu.
//   "1 Mei 2026"  → diterima tetapi menghasilkan jam 00:00 palsu yang lalu
//                   MENIMPA jam sungguhan dari AI (jam transaksi jadi 00:00).
// Pola Indonesia harus menang; `new Date()` hanya jalan terakhir.

/** Jam default bila nota hanya memuat tanggal: awal hari kerja, bukan tengah malam. */
export const DEFAULT_HOUR = 8;

const pad = (n) => String(n).padStart(2, '0');

const BULAN = {
  januari: 1, februari: 2, maret: 3, april: 4, mei: 5, juni: 6,
  juli: 7, agustus: 8, september: 9, oktober: 10, november: 11, desember: 12,
  jan: 1, feb: 2, peb: 2, mar: 3, apr: 4, jun: 6, jul: 7,
  agu: 8, agt: 8, ags: 8, sep: 9, sept: 9, okt: 10, nov: 11, nop: 11, des: 12
};

// Nama bulan Inggris juga dibaca: bukti transfer bank kadang berbahasa Inggris
// ("12 NOV 2026"), dan itu sebelumnya jatuh ke new Date() dengan hasil lokal
// yang bisa bergeser satu hari.
const BULAN_EN = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
  aug: 8, oct: 10, dec: 12
};

const bulanKe = (kata) => {
  const k = String(kata).toLowerCase().replace(/\.$/, '');
  return BULAN[k] || BULAN_EN[k] || 0;
};

/** Tanggal valid? Menolak 31 Februari, bulan 13, dan tanggal 0. */
const valid = (y, m, d) => {
  if (!y || !m || !d) return false;
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const kabisat = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  const dim = [31, kabisat ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return d <= dim[m - 1];
};

/** Tahun wajar untuk transaksi; "26" menjadi 2026, bukan tahun 26. */
const normalYear = (y) => {
  const n = +y;
  if (n < 100) return n < 70 ? 2000 + n : 1900 + n;
  return n;
};

/**
 * Parse tanggal apa pun menjadi { y, m, d, hh, mm } atau null.
 * Diterima: "2026-05-01", "2026-05-01T14:30", "2026-05-01 14:30",
 * "01/05/2026", "12-11-2026", "1 Mei 2026", "12 NOV 2026",
 * "KASONGAN 12 NOV 2026", "Tgl. 12/11/2026 15:30".
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

  // 1. ISO / datetime-local: 2026-05-01, 2026-05-01T14:30, 2026-05-01 14:30(:00)
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ](\d{1,2}):(\d{2}))?/);
  if (m && valid(+m[1], +m[2], +m[3])) {
    return {
      y: +m[1],
      m: +m[2],
      d: +m[3],
      // Tanpa jam: penanda `null` agar pemanggil tahu ini bukan jam sungguhan.
      hh: m[4] == null ? null : +m[4],
      mm: m[5] == null ? null : +m[5]
    };
  }

  // 2. Nama bulan, hari lebih dulu: "1 Mei 2026", "12 NOV 2026",
  //    "KASONGAN 12 NOVEMBER 2026", "12 Nov 2026 15:30".
  m = s.match(/(\d{1,2})\s+([A-Za-z]{3,9})\.?\s+(\d{2,4})(?:[\s,T]+(\d{1,2})[:.](\d{2}))?/);
  if (m) {
    const bl = bulanKe(m[2]);
    if (bl && valid(normalYear(m[3]), bl, +m[1])) {
      return {
        y: normalYear(m[3]),
        m: bl,
        d: +m[1],
        hh: m[4] == null ? null : +m[4],
        mm: m[5] == null ? null : +m[5]
      };
    }
  }

  // 3. Nama bulan di depan: "NOV 12, 2026" (format bank asing).
  m = s.match(/([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{2,4})(?:[\s,T]+(\d{1,2}):(\d{2}))?/);
  if (m) {
    const bl = bulanKe(m[1]);
    if (bl && valid(normalYear(m[3]), bl, +m[2])) {
      return {
        y: normalYear(m[3]),
        m: bl,
        d: +m[2],
        hh: m[4] == null ? null : +m[4],
        mm: m[5] == null ? null : +m[5]
      };
    }
  }

  // 4. Angka semua, pemisah "/", "-", atau ".": "12/11/2026", "12-11-2026".
  //    Pola bertahun-di-depan sudah ditangani di (1), jadi di sini urutannya
  //    HARI-BULAN-TAHUN (kebiasaan Indonesia), kecuali angka kedua > 12 yang
  //    menandakan gaya Amerika ("11/25/2026").
  m = s.match(/(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})(?:[\s,T]+(\d{1,2})[:.](\d{2}))?/);
  if (m) {
    let d = +m[1];
    let mo = +m[2];
    if (d <= 12 && mo > 12) {
      const tmp = d;
      d = mo;
      mo = tmp;
    }
    if (valid(normalYear(m[3]), mo, d)) {
      return {
        y: normalYear(m[3]),
        m: mo,
        d,
        hh: m[4] == null ? null : +m[4],
        mm: m[5] == null ? null : +m[5]
      };
    }
  }

  // 5. Jalan terakhir: biarkan mesin mengurainya (mis. "Wed Nov 12 2026").
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

/** Parse jam lepas: "15:30", "15.30", "1530", "pukul 15:30 WIB". */
export const parseClock = (value) => {
  if (value == null || value === '') return null;
  const s = String(value).trim();
  let m = s.match(/(\d{1,2})[:.](\d{2})/);
  if (m) {
    const hh = +m[1];
    const mm = +m[2];
    return hh <= 23 && mm <= 59 ? { hh, mm } : null;
  }
  m = s.match(/^(\d{3,4})$/);
  if (m) {
    const n = m[1].padStart(4, '0');
    const hh = +n.slice(0, 2);
    const mm = +n.slice(2);
    return hh <= 23 && mm <= 59 ? { hh, mm } : null;
  }
  return null;
};

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

  // Jam dari parameter hanya mengisi bagian yang KOSONG. Jam 00:00 yang terbaca
  // dari nota tetap dipertahankan; dulu kondisi `hh === 0` membuatnya dianggap
  // "tidak ada jam" lalu ditimpa.
  let { hh, mm } = parts;
  const clock = parseClock(time);
  if (clock && (hh == null || mm == null)) {
    hh = clock.hh;
    mm = clock.mm;
  }

  return toLocalIso({ y: parts.y, m: parts.m, d: parts.d, hh: hh ?? DEFAULT_HOUR, mm: mm ?? 0 });
};

/** Label ringkas untuk ditampilkan/dirapikan: "01/05/2026, 14:30" (tanpa jam bila memang tidak ada). */
export const describeTxDateTime = (value) => {
  const p = parseTxDateTime(value);
  if (!p) return '—';
  const date = `${pad(p.d)}/${pad(p.m)}/${p.y}`;
  if (p.hh == null || p.mm == null) return date;
  return `${date}, ${pad(p.hh)}:${pad(p.mm)}`;
};
