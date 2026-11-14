// src/hooks/useColorMode.js
// Mode tampilan (terang/gelap) untuk komponen React.
// Nilai awal dibaca dari localStorage/preferensi sistem lewat utils/colorMode.js,
// lalu disinkronkan sebagai atribut data-theme di <html>.
import { useState, useEffect, useCallback } from 'react';
import { resolveMode, applyMode, toggleMode, MODES } from '../utils/colorMode';

export const useColorMode = () => {
  const [mode, setMode] = useState(() => resolveMode());

  // Pasang atribut segera saat komponen pertama hidup — termasuk bila mode
  // ditentukan preferensi sistem, bukan pilihan tersimpan.
  useEffect(() => {
    applyMode(mode);
  }, [mode]);

  // Ikuti perubahan preferensi sistem, tetapi hanya selama pengguna belum memilih
  // sendiri. Setelah memilih, pilihannya yang berlaku.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e) => {
      try {
        if (localStorage.getItem('kontrack-color-mode')) return;
      } catch (err) {
        /* mode privat: tetap ikuti sistem */
      }
      setMode(e.matches ? MODES.DARK : MODES.LIGHT);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const toggle = useCallback(() => {
    setMode(toggleMode());
  }, []);

  return { mode, setMode, toggle };
};

export default useColorMode;
