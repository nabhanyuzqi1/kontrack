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
  const meta = await fetchAssetPayload(url);
  return meta.dataUrl;
};

/**
 * Seperti `fetchAssetDataUrl`, tetapi mengembalikan metadata konversi.
 * Server mengubah TIFF menjadi PNG (peramban tidak dapat menampilkan TIFF),
 * sehingga pemanggil perlu tahu tipe asli dan alasan bila konversi gagal.
 *
 * @param {string} url
 * @returns {Promise<{dataUrl: string, contentType: string, converted: boolean,
 *   conversionNote: string, size: number}>}
 */
export const fetchAssetPayload = async (url) => {
  const fn = httpsCallable(legacyFunctions(), 'getStorageAssetDataUrl');
  const res = await fn({ url });
  const data = res?.data || {};
  const dataUrl = data.dataUrl || data.data || data;
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) {
    throw new Error('Respons function tidak berisi data URL');
  }
  return {
    dataUrl,
    contentType: data?.metadata?.contentType || '',
    originalContentType: data?.metadata?.originalContentType || '',
    converted: Boolean(data?.metadata?.converted),
    conversionNote: data?.metadata?.conversionNote || '',
    size: Number(data?.metadata?.size) || 0,
  };
};
