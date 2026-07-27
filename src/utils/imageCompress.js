// src/utils/imageCompress.js
// Kompresi gambar di sisi peramban SEBELUM diunggah.
//
// Alasan: bukti transfer umumnya foto WhatsApp/tangkapan layar 2-5 MB dengan
// resolusi jauh di atas kebutuhan. Menyimpannya mentah membebani Storage,
// kuota unduh, dan waktu muat halaman. Diubah ke WebP pada sisi terpanjang
// 1600px, ukurannya turun 85-95% tanpa mengurangi keterbacaan nominal & tanggal.
//
// Berkas non-gambar (PDF dokumen pajak, SPK) diteruskan apa adanya.

const DEFAULTS = {
  maxDimension: 1600, // cukup untuk membaca nominal & berita transfer
  quality: 0.82,
  // Di bawah ini kompresi tidak sepadan dengan risiko turunnya kualitas.
  skipBelowBytes: 120 * 1024
};

let webpSupport = null;

/** Apakah peramban bisa MENG-ENCODE WebP (bukan sekadar menampilkan). */
const supportsWebp = () => {
  if (webpSupport !== null) return webpSupport;
  try {
    const c = document.createElement('canvas');
    c.width = 1;
    c.height = 1;
    webpSupport = c.toDataURL('image/webp').startsWith('data:image/webp');
  } catch (e) {
    webpSupport = false;
  }
  return webpSupport;
};

const loadBitmap = async (file) => {
  // createImageBitmap jauh lebih cepat & tidak memblokir, tetapi Safari lama
  // belum mendukungnya untuk Blob — sediakan jalur cadangan lewat <img>.
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file);
    } catch (e) {
      /* jatuh ke cadangan */
    }
  }

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Gambar tidak dapat dibaca.'));
    };
    img.src = url;
  });
};

const toBlob = (canvas, type, quality) =>
  new Promise((resolve) => canvas.toBlob(resolve, type, quality));

const swapExtension = (name, ext) => name.replace(/\.[^.]+$/, '') + ext;

/**
 * Kompres satu berkas gambar.
 * Selalu mengembalikan File — berkas asli bila kompresi tidak menguntungkan,
 * gagal, atau berkasnya memang bukan gambar raster.
 *
 * @param {File} file
 * @param {{maxDimension?: number, quality?: number, skipBelowBytes?: number}} opts
 * @returns {Promise<File>}
 */
export const compressImage = async (file, opts = {}) => {
  const { maxDimension, quality, skipBelowBytes, preserveAlpha } = { ...DEFAULTS, ...opts };

  if (!file || !file.type?.startsWith('image/')) return file;
  // GIF animasi akan kehilangan animasinya bila digambar ke canvas.
  if (file.type === 'image/gif') return file;
  if (file.size < skipBelowBytes) return file;

  // Aset yang wajib tetap transparan (tanda tangan, kop surat) hanya boleh
  // dikompresi ke WebP, satu-satunya target di sini yang mendukung alpha.
  // Tanpa dukungan WebP, biarkan berkas asli daripada merusak transparansi.
  if (preserveAlpha && !supportsWebp()) return file;

  try {
    const bitmap = await loadBitmap(file);
    const w = bitmap.width || bitmap.naturalWidth;
    const h = bitmap.height || bitmap.naturalHeight;
    if (!w || !h) return file;

    const scale = Math.min(1, maxDimension / Math.max(w, h));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);

    const ctx = canvas.getContext('2d');
    if (!preserveAlpha) {
      // Latar putih: JPEG tidak punya alpha, dan PNG transparan tanpa ini
      // akan menjadi hitam. Untuk bukti bayar, latar putih justru benar.
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    if (bitmap.close) bitmap.close();

    const useWebp = preserveAlpha || supportsWebp();
    const type = useWebp ? 'image/webp' : 'image/jpeg';
    const blob = await toBlob(canvas, type, quality);
    if (!blob) return file;

    // Kompresi yang justru memperbesar berkas tidak ada gunanya.
    if (blob.size >= file.size) return file;

    return new File([blob], swapExtension(file.name, useWebp ? '.webp' : '.jpg'), {
      type,
      lastModified: Date.now()
    });
  } catch (e) {
    console.warn('Kompresi gambar dilewati:', e?.message || e);
    return file;
  }
};

/** Kompres beberapa berkas sekaligus. */
export const compressImages = (files, opts) =>
  Promise.all(Array.from(files || []).map((f) => compressImage(f, opts)));

/** Ringkasan penghematan, untuk ditampilkan ke pengguna. */
export const compressionSummary = (before, after) => {
  const saved = before - after;
  if (saved <= 0) return null;
  const kb = (n) => (n / 1024 < 1024 ? `${Math.round(n / 1024)} KB` : `${(n / 1048576).toFixed(1)} MB`);
  return `${kb(before)} → ${kb(after)} (hemat ${Math.round((saved / before) * 100)}%)`;
};
