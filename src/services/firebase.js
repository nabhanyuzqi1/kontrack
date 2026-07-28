// src/services/firebase.js
import { initializeApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import {
  initializeAuth,
  getAuth,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  browserSessionPersistence
} from 'firebase/auth';
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

// Semua sumber daya Kontrack berada di asia-southeast2 (Jakarta).
// Firestore memakai database bernama (bukan "(default)" yang ada di asia-east1).
const FIRESTORE_DB_ID = import.meta.env.VITE_FIRESTORE_DATABASE_ID || 'kontrack';

const app = initializeApp(firebaseConfig);

// App Check (reCAPTCHA v3) — memastikan hanya aplikasi ini yang boleh memakai
// Firestore/Storage/Functions. Aktif hanya bila site key tersedia, sehingga
// pengembangan lokal tanpa key tetap jalan.
const recaptchaSiteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
if (recaptchaSiteKey) {
  try {
    // Debug token untuk localhost — dicetak di console saat pertama dijalankan,
    // daftarkan token itu di Firebase Console → App Check → Apps → Debug tokens.
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-undef
      self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
    }
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(recaptchaSiteKey),
      isTokenAutoRefreshEnabled: true
    });
  } catch (e) {
    console.warn('App Check gagal diinisialisasi:', e?.message || e);
  }
}

// PENTING: memakai initializeAuth (bukan getAuth) TANPA popupRedirectResolver.
// getAuth() memasang resolver popup/redirect secara otomatis, dan resolver itu
// memuat iframe gapi (/__/auth/iframe) di SETIAP page load untuk mengecek hasil
// redirect — padahal aplikasi ini hanya memakai popup. Di Safari iframe tersebut
// menggantung (Status kosong) dan menahan koneksi. Dengan resolver tidak dipasang
// di sini, iframe hanya dimuat ketika tombol "Masuk dengan Google" ditekan
// (resolver dioper eksplisit di services/auth.js).
let auth;
try {
  auth = initializeAuth(app, {
    persistence: [indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence]
  });
} catch (e) {
  // initializeAuth melempar bila Auth sudah pernah diinisialisasi (mis. HMR).
  auth = getAuth(app);
}
export { auth };

// Cache persisten di IndexedDB: data yang sudah pernah dimuat tampil INSTAN
// (bahkan offline), lalu disegarkan di latar belakang. Ini memangkas jumlah
// dokumen yang dibaca dari server tiap kali pengguna berpindah menu.
// persistentMultipleTabManager → aman bila aplikasi dibuka di beberapa tab.
let db;
try {
  db = initializeFirestore(
    app,
    {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
        cacheSizeBytes: CACHE_SIZE_UNLIMITED
      }),
      // Long-polling DIPAKSA, bukan auto-deteksi.
      //
      // Auto-deteksi menjajal transport streaming lebih dulu. Di Safari,
      // permintaan Listen/channel-nya gagal dengan
      //   "Fetch API cannot load ... due to access control checks"
      // dan SDK baru mundur ke long-polling setelah probe itu habis waktunya —
      // selama jeda tersebut halaman diam berputar. Memaksa long-polling
      // melewatkan probe yang memang selalu gagal di Safari.
      experimentalForceLongPolling: true,
      // Long-polling paksa harus memakai XHR; fetch-stream itulah yang diblokir.
      useFetchStreams: false
    },
    FIRESTORE_DB_ID
  );
} catch (e) {
  // Fallback: browser tanpa IndexedDB (mode privat/Safari lama) tetap jalan,
  // hanya tanpa cache persisten.
  console.warn('Cache persisten tidak tersedia, memakai cache memori:', e?.message || e);
  db = getFirestore(app, FIRESTORE_DB_ID);
}

export { db, FIRESTORE_DB_ID };
export const storage = getStorage(app);

export default app;
