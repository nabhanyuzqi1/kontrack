import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { aiFunctions } from './functionsRegion';
import { storage } from './firebase'; // Pastikan firebase.js Anda sudah diinisialisasi

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
export const uploadTransactionImage = async (file, userId) => {
  try {
    const timestamp = Date.now();
    const fileName = `transactions/${userId}/${timestamp}_${file.name}`;
    const storageRef = ref(storage, fileName);
    
    const snapshot = await uploadBytes(storageRef, file);
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

  // Unggah semua + konversi base64 paralel
  const [uploads, base64List] = await Promise.all([
    Promise.all(files.map((f) => uploadTransactionImage(f, userId))),
    Promise.all(files.map((f) => fileToBase64(f))),
  ]);

  const images = files.map((f, i) => ({
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
