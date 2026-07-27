// src/services/firebase.js
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  initializeFirestore,
  getFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  CACHE_SIZE_UNLIMITED
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);

// Cache persisten di IndexedDB: data yang sudah pernah dimuat tampil INSTAN
// (bahkan offline), lalu disegarkan di latar belakang. Ini memangkas jumlah
// dokumen yang dibaca dari server tiap kali pengguna berpindah menu.
// persistentMultipleTabManager → aman bila aplikasi dibuka di beberapa tab.
let db;
try {
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager(),
      cacheSizeBytes: CACHE_SIZE_UNLIMITED
    }),
    // Firestore memakai WebChannel (streaming) yang kerap tersendat di balik
    // proxy/CDN atau jaringan seluler — gejalanya: request `channel` menggantung
    // sampai semenit dan data tidak muncul sampai pengguna berpindah menu.
    // Opsi ini membuat SDK mendeteksi kondisi tersebut dan otomatis beralih ke
    // long-polling yang lebih tahan banting.
    experimentalAutoDetectLongPolling: true
  });
} catch (e) {
  // Fallback: browser tanpa IndexedDB (mode privat/Safari lama) tetap jalan,
  // hanya tanpa cache persisten.
  console.warn('Cache persisten tidak tersedia, memakai cache memori:', e?.message || e);
  db = getFirestore(app);
}

export { db };
export const storage = getStorage(app);

export default app;
