// src/utils/colorMode.js
// Mode tampilan (terang/gelap) — TERPISAH dari preset brand di utils/themes.js.
//
// Dua hal berbeda yang mudah tertukar:
//  - preset brand (`--brand-*`)  : warna aksen, diganti per-tenant dari Pengaturan
//  - mode tampilan (`data-theme`) : material kaca terang/gelap, disimpan lokal
//
// Disimpan di localStorage, bukan Firestore: ini preferensi per-perangkat
// (layar ruangan gelap vs terang), bukan setelan perusahaan.

const STORAGE_KEY = 'kontrack-color-mode';
export const MODES = { LIGHT: 'light', DARK: 'dark' };

export const getStoredMode = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === MODES.LIGHT || stored === MODES.DARK) return stored;
  } catch (e) {
    /* mode privat: jatuh ke preferensi sistem */
  }
  return null;
};

export const getSystemMode = () => {
  if (typeof window === 'undefined' || !window.matchMedia) return MODES.LIGHT;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? MODES.DARK : MODES.LIGHT;
};

// Mode efektif = pilihan pengguna, kalau belum ada ikuti preferensi sistem.
export const resolveMode = () => getStoredMode() || getSystemMode();

export const applyMode = (mode) => {
  const next = mode === MODES.DARK ? MODES.DARK : MODES.LIGHT;
  const root = document.documentElement;
  root.setAttribute('data-theme', next);
  // Dipakai juga oleh <meta name="theme-color"> agar bilah peramban ikut berubah.
  root.style.colorScheme = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch (e) {
    /* mode privat */
  }
  return next;
};

export const toggleMode = () => applyMode(resolveMode() === MODES.DARK ? MODES.LIGHT : MODES.DARK);
