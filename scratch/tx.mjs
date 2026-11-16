// src/utils/txDateTime.js
var DEFAULT_HOUR = 8;
var pad = (n) => String(n).padStart(2, "0");
var BULAN = {
  januari: 1,
  februari: 2,
  maret: 3,
  april: 4,
  mei: 5,
  juni: 6,
  juli: 7,
  agustus: 8,
  september: 9,
  oktober: 10,
  november: 11,
  desember: 12,
  jan: 1,
  feb: 2,
  peb: 2,
  mar: 3,
  apr: 4,
  jun: 6,
  jul: 7,
  agu: 8,
  agt: 8,
  ags: 8,
  sep: 9,
  sept: 9,
  okt: 10,
  nov: 11,
  nop: 11,
  des: 12
};
var BULAN_EN = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
  aug: 8,
  oct: 10,
  dec: 12
};
var bulanKe = (kata) => {
  const k = String(kata).toLowerCase().replace(/\.$/, "");
  return BULAN[k] || BULAN_EN[k] || 0;
};
var valid = (y, m, d) => {
  if (!y || !m || !d) return false;
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const kabisat = y % 4 === 0 && y % 100 !== 0 || y % 400 === 0;
  const dim = [31, kabisat ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return d <= dim[m - 1];
};
var normalYear = (y) => {
  const n = +y;
  if (n < 100) return n < 70 ? 2e3 + n : 1900 + n;
  return n;
};
var parseTxDateTime = (value) => {
  if (value == null || value === "") return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return {
      y: value.getFullYear(),
      m: value.getMonth() + 1,
      d: value.getDate(),
      hh: value.getHours(),
      mm: value.getMinutes()
    };
  }
  if (typeof value === "object" && typeof value.seconds === "number") {
    const dt = new Date(value.seconds * 1e3);
    return { y: dt.getFullYear(), m: dt.getMonth() + 1, d: dt.getDate(), hh: dt.getHours(), mm: dt.getMinutes() };
  }
  const s = String(value).trim();
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
var hasExplicitTime = (value) => {
  const p = parseTxDateTime(value);
  return Boolean(p && p.hh != null && p.mm != null);
};
var toLocalIso = ({ y, m, d, hh = DEFAULT_HOUR, mm = 0 }) => `${y}-${pad(m)}-${pad(d)}T${pad(hh)}:${pad(mm)}`;
var parseClock = (value) => {
  if (value == null || value === "") return null;
  const s = String(value).trim();
  let m = s.match(/(\d{1,2})[:.](\d{2})/);
  if (m) {
    const hh = +m[1];
    const mm = +m[2];
    return hh <= 23 && mm <= 59 ? { hh, mm } : null;
  }
  m = s.match(/^(\d{3,4})$/);
  if (m) {
    const n = m[1].padStart(4, "0");
    const hh = +n.slice(0, 2);
    const mm = +n.slice(2);
    return hh <= 23 && mm <= 59 ? { hh, mm } : null;
  }
  return null;
};
var normalizeTxDateTime = (date, time, { fallbackToNow = true } = {}) => {
  const parts = parseTxDateTime(date);
  if (!parts) {
    return fallbackToNow ? toLocalIso(parseTxDateTime(/* @__PURE__ */ new Date())) : "";
  }
  let { hh, mm } = parts;
  const clock = parseClock(time);
  if (clock && (hh == null || mm == null)) {
    hh = clock.hh;
    mm = clock.mm;
  }
  return toLocalIso({ y: parts.y, m: parts.m, d: parts.d, hh: hh ?? DEFAULT_HOUR, mm: mm ?? 0 });
};
var describeTxDateTime = (value) => {
  const p = parseTxDateTime(value);
  if (!p) return "\u2014";
  const date = `${pad(p.d)}/${pad(p.m)}/${p.y}`;
  if (p.hh == null || p.mm == null) return date;
  return `${date}, ${pad(p.hh)}:${pad(p.mm)}`;
};
export {
  DEFAULT_HOUR,
  describeTxDateTime,
  hasExplicitTime,
  normalizeTxDateTime,
  parseClock,
  parseTxDateTime,
  toLocalIso
};
