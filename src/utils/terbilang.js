// src/utils/terbilang.js
// Konversi angka rupiah ke kata (bahasa Indonesia) — wajib untuk invoice/kuitansi resmi.

const SATUAN = [
  '',
  'satu',
  'dua',
  'tiga',
  'empat',
  'lima',
  'enam',
  'tujuh',
  'delapan',
  'sembilan',
  'sepuluh',
  'sebelas'
];

const toWords = (n) => {
  n = Math.floor(Math.abs(n));
  if (n < 12) return SATUAN[n];
  if (n < 20) return `${toWords(n - 10)} belas`;
  if (n < 100) {
    const sisa = n % 10;
    return `${toWords(Math.floor(n / 10))} puluh${sisa ? ' ' + toWords(sisa) : ''}`;
  }
  if (n < 200) return `seratus${n % 100 ? ' ' + toWords(n % 100) : ''}`;
  if (n < 1000) {
    const sisa = n % 100;
    return `${toWords(Math.floor(n / 100))} ratus${sisa ? ' ' + toWords(sisa) : ''}`;
  }
  if (n < 2000) return `seribu${n % 1000 ? ' ' + toWords(n % 1000) : ''}`;
  if (n < 1_000_000) {
    const sisa = n % 1000;
    return `${toWords(Math.floor(n / 1000))} ribu${sisa ? ' ' + toWords(sisa) : ''}`;
  }
  if (n < 1_000_000_000) {
    const sisa = n % 1_000_000;
    return `${toWords(Math.floor(n / 1_000_000))} juta${sisa ? ' ' + toWords(sisa) : ''}`;
  }
  if (n < 1_000_000_000_000) {
    const sisa = n % 1_000_000_000;
    return `${toWords(Math.floor(n / 1_000_000_000))} miliar${sisa ? ' ' + toWords(sisa) : ''}`;
  }
  const sisa = n % 1_000_000_000_000;
  return `${toWords(Math.floor(n / 1_000_000_000_000))} triliun${sisa ? ' ' + toWords(sisa) : ''}`;
};

// "2400000" -> "Dua juta empat ratus ribu rupiah"
export const terbilang = (amount) => {
  const n = Math.floor(Math.abs(Number(amount) || 0));
  if (n === 0) return 'Nol rupiah';
  const words = toWords(n).replace(/\s+/g, ' ').trim();
  const capitalized = words.charAt(0).toUpperCase() + words.slice(1);
  return `${capitalized} rupiah`;
};

export default terbilang;
