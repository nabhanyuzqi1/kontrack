import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { aiFunctions } from './functionsRegion';
import { storage } from './firebase';
import { compressImage } from '../utils/imageCompress';

// Fungsi helper untuk memvalidasi file gambar
export const validateImageFile = (file) => {
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  const maxSize = 5 * 1024 * 1024; // 5MB

  if (!validTypes.includes(file.type)) {
    throw new Error('Format file tidak didukung. Gunakan JPG, PNG, atau WebP.');
  }

  if (file.size > maxSize) {
    throw new Error('Ukuran file terlalu besar. Maksimal 5MB.');
  }

  return true;
};

// Fungsi helper untuk mengubah file menjadi base64
const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
  });
};


// --- ALUR ANALISIS AI YANG TELAH DIREFAKTOR ---

// 1. Fungsi untuk mengunggah gambar ke Firebase Storage
export const uploadTransactionImage = async (file, userId, { compress = true } = {}) => {
  try {
    // Bukti transfer dikompresi ke WebP 1600px sebelum diunggah — foto WhatsApp
    // 3 MB menyusut ke ±150 KB, sehingga Storage & waktu muat jauh lebih hemat.
    // compress:false dipakai bila pemanggil SUDAH mengompresi, agar tidak
    // ter-encode dua kali (lossy ganda menurunkan kualitas tanpa hemat berarti).
    const compressed = compress ? await compressImage(file) : file;
    const timestamp = Date.now();
    const fileName = `transactions/${userId}/${timestamp}_${compressed.name}`;
    const storageRef = ref(storage, fileName);

    const snapshot = await uploadBytes(storageRef, compressed);
    const downloadURL = await getDownloadURL(snapshot.ref);
    
    console.log('Gambar diunggah ke Firebase Storage:', downloadURL);
    
    return {
      url: downloadURL,
      path: snapshot.metadata.fullPath,
    };
  } catch (error) {
    console.error('Kesalahan saat mengunggah gambar ke Firebase Storage:', error);
    throw new Error('Gagal mengunggah gambar. Silakan coba lagi.');
  }
};


// Normalisasi satu hasil mentah AI + lampirkan info unggahan gambar.
const normalizeResult = (parsed, upload) => {
  const type = parsed?.type === 'income' || parsed?.type === 'expense' ? parsed.type : 'expense';
  return {
    date: parsed?.date || new Date().toISOString(),
    amount: Math.abs(Number(parsed?.amount)) || 0,
    type,
    category: parsed?.category || (type === 'income' ? 'Pembayaran' : 'Operasional'),
    description: parsed?.description || 'Transaksi dari gambar',
    imageUrl: upload?.url,
    imagePath: upload?.path,
    isAIProcessed: true,
  };
};

// 2b. Analisis BANYAK gambar sekaligus — 1 panggilan fungsi (hemat biaya).
// Mengembalikan array hasil, satu per gambar (urut sesuai input).
export const analyzeTransactionImages = async (files, userId) => {
  if (!files || files.length === 0) {
    throw new Error('Pilih minimal satu gambar.');
  }
  files.forEach(validateImageFile);

  // Kompresi dilakukan SEKALI di sini, lalu hasilnya dipakai untuk dua-duanya:
  // diunggah ke Storage DAN dikirim ke Gemini. Gambar yang lebih kecil berarti
  // token vision lebih sedikit, jadi biaya analisis ikut turun.
  const compressed = await Promise.all(files.map((f) => compressImage(f)));

  const [uploads, base64List] = await Promise.all([
    Promise.all(compressed.map((f) => uploadTransactionImage(f, userId, { compress: false }))),
    Promise.all(compressed.map((f) => fileToBase64(f))),
  ]);

  const images = compressed.map((f, i) => ({
    base64String: base64List[i].split(',')[1],
    mimeType: f.type,
  }));

  const functions = aiFunctions();
  const analyzeFunction = httpsCallable(functions, 'analyzeTransactionImageWithAI');
  const response = await analyzeFunction({ images });

  // Kontrak baru: { transactions: [...] }. Fallback lama: { data: "<json string>" }.
  let transactions = response.data?.transactions;
  if (!transactions && response.data?.data) {
    const parsed = JSON.parse(response.data.data);
    transactions = Array.isArray(parsed) ? parsed : [parsed];
  }
  if (!Array.isArray(transactions) || transactions.length === 0) {
    throw new Error('AI tidak dapat menganalisis gambar. Pastikan gambar jelas.');
  }

  // Pasangkan tiap hasil dengan gambar yang diunggah (berdasar urutan).
  return transactions.map((t, i) => normalizeResult(t, uploads[i] || uploads[uploads.length - 1]));
};

// 2. Analisis satu gambar (backward-compat) — delegasi ke versi multi.
export const analyzeTransactionImage = async (file, userId) => {
  try {
    const [result] = await analyzeTransactionImages([file], userId);
    return result;
  } catch (error) {
    console.error('Kesalahan dalam analyzeTransactionImage:', error);
    throw new Error(error.message || 'Terjadi kesalahan saat menganalisis gambar. Coba lagi.');
  }
};
