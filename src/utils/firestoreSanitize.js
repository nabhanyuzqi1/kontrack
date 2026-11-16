// src/utils/firestoreSanitize.js
//
// Firestore MENOLAK seluruh penulisan bila satu field bernilai `undefined`
// ("Function addDoc() called with invalid data. Unsupported field value:
// undefined"). Satu field opsional yang lupa diisi sudah cukup untuk
// menggagalkan simpan transaksi, dan pesannya menyebut field yang salah
// (mis. `categoryFrom`) sehingga sumber aslinya sulit dilacak.
//
// Karena itu penyaringan dilakukan SEKALI di lapisan service, bukan di setiap
// pemanggil: pemanggil boleh mengirim objek bercampur `undefined` tanpa
// memikirkan bentuk internal Firestore.
//
// Aturan:
// - `undefined` dibuang (di objek) atau diganti `null` (di dalam array, karena
//   membuang elemen akan menggeser indeks).
// - `null` DIPERTAHANKAN: banyak dokumen sengaja menyimpan null sebagai
//   penanda "belum diisi", dan Firestore menerimanya.
// - Nilai penting Firestore (`Timestamp`, `FieldValue`, `DocumentReference`,
//   `GeoPoint`, `Bytes`) dilewatkan apa adanya. Ini krusial: keduanya adalah
//   objek tanpa enumerable key, sehingga penyalinan naif akan mengubah
//   `Timestamp` menjadi `{}` dan merusak tanggal di seluruh dokumen.
// - `Date` disimpan apa adanya (SDK yang mengonversinya).

const isFirestoreValue = (value) => {
  if (!value || typeof value !== 'object') return false;
  const name = value.constructor?.name || '';
  return (
    name === 'Timestamp' ||
    name === 'FieldValue' ||
    name === 'DocumentReference' ||
    name === 'GeoPoint' ||
    name === 'Bytes' ||
    name === 'VectorValue' ||
    // FieldValue bersifat statis pada beberapa versi SDK: deteksi lewat marker.
    typeof value._methodName === 'string' ||
    typeof value.isEqual === 'function' && name === 'Timestamp'
  );
};

/**
 * Buang `undefined` secara rekursif agar aman ditulis ke Firestore.
 *
 * @param {unknown} value
 * @returns {unknown} salinan tanpa `undefined`
 */
export const stripUndefined = (value) => {
  if (value === undefined) return undefined; // dibuang oleh pemanggil
  if (value === null) return null;
  if (Array.isArray(value)) {
    return value.map((item) => (item === undefined ? null : stripUndefined(item)));
  }
  if (value instanceof Date) return value;
  if (isFirestoreValue(value)) return value;
  if (typeof value !== 'object') return value;

  const out = {};
  for (const [key, item] of Object.entries(value)) {
    if (item === undefined) continue;
    out[key] = stripUndefined(item);
  }
  return out;
};

/**
 * Versi yang dipakai sebelum `addDoc`/`updateDoc`/`setDoc`.
 * Selalu mengembalikan objek siap tulis.
 *
 * @param {Record<string, unknown>} data
 * @returns {Record<string, unknown>}
 */
export const sanitizeForFirestore = (data) => {
  const clean = stripUndefined(data);
  return clean && typeof clean === 'object' && !Array.isArray(clean) ? clean : {};
};
