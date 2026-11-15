// src/services/assets.js
// Pengambilan berkas Storage sebagai data URL, dipakai generator PDF untuk kop
// surat & tanda tangan.
//
// Dulu panggilan Cloud Function ini berada DI DALAM `src/utils/invoiceGenerator.js`,
// sehingga modul `utils/` mengimpor Firebase. Itu melanggar pemisahan repo
// (`utils/` murni, tanpa Firebase) dan membuat generator tidak bisa dijalankan
// di Node untuk diuji. I/O jaringan sekarang di sini, pemanggilnya menyuntikkan
// fungsi ini sebagai opsi.

import { httpsCallable } from 'firebase/functions';
import { legacyFunctions } from './functionsRegion';

/**
 * Ambil berkas Storage lewat Cloud Function `getStorageAssetDataUrl`.
 * Melempar bila gagal; pemanggil yang memutuskan mau jatuh ke apa.
 *
 * @param {string} url URL Storage (gs:// atau https://firebasestorage...)
 * @returns {Promise<string>} data URL
 */
export const fetchAssetDataUrl = async (url) => {
  const fn = httpsCallable(legacyFunctions(), 'getStorageAssetDataUrl');
  const res = await fn({ url });
  const dataUrl = res?.data?.dataUrl || res?.data?.data || res?.data;
  if (typeof dataUrl === 'string' && dataUrl.startsWith('data:')) return dataUrl;
  throw new Error('Respons function tidak berisi data URL');
};
