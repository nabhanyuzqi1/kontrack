// src/utils/async.js
// Guard untuk operasi jaringan yang bisa menggantung (Firestore saat offline
// tidak selalu reject). Tanpa ini, UI bisa "loading selamanya".

/**
 * Balapkan promise dengan timeout.
 * @param {Promise} promise
 * @param {number} ms - batas waktu
 * @param {*} fallback - nilai yang dikembalikan bila lewat batas (default: throw)
 */
export const withTimeout = (promise, ms = 12000, fallback = undefined) =>
  new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      if (fallback !== undefined) {
        console.warn(`Operasi melewati ${ms}ms — memakai fallback.`);
        resolve(fallback);
      } else {
        reject(new Error('Koneksi lambat atau terputus. Coba lagi.'));
      }
    }, ms);

    promise.then(
      (v) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(e);
      }
    );
  });

export default withTimeout;
