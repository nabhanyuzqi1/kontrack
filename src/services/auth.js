// src/services/auth.js
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  browserPopupRedirectResolver,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import { collection, query, where, getDocs, doc, setDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { withTimeout } from '../utils/async';

// Sign in with email and password
export const signInUser = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Query users collection by email field
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('email', '==', user.email));
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      // Get the first matching document
      const userDoc = querySnapshot.docs[0];
      const userData = userDoc.data();
      
      console.log('User data found:', userData); // Debug log
      
      return {
        uid: user.uid,
        email: user.email,
        name: userData.name || user.email,
        role: userData.role || 'user',
        docId: userDoc.id // Store document ID for future reference
      };
    } else {
      console.log('No user document found for email:', user.email);
      // If no user document exists, create basic user object
      return {
        uid: user.uid,
        email: user.email,
        name: user.email,
        role: 'user' // Default role
      };
    }
  } catch (error) {
    console.error('Error signing in:', error);
    throw error;
  }
};

/**
 * Klaim dokumen `users` yang dibuat lebih dulu oleh administrator.
 *
 * Akun ganda dulu muncul begini: admin mengundang `budi@pt.co` (dokumen users
 * tanpa uid), lalu Budi mendaftar sendiri lewat form daftar. Pendaftaran selalu
 * membuat dokumen BARU, sehingga satu orang punya dua dokumen — dan yang dibaca
 * saat login hanya dokumen pertama, kadang yang masih 'viewer'.
 *
 * Karena itu pendaftaran mencari dokumen beremail sama yang belum punya uid dan
 * mengisinya, bukan menambah dokumen. Bila dokumen sudah punya uid lain, email
 * itu memang milik akun lain: hentikan pemakaian dokumen tersebut.
 */
const claimInvitedUserDoc = async (user, name) => {
  const usersRef = collection(db, 'users');
  const snap = await withTimeout(
    getDocs(query(usersRef, where('email', '==', user.email))),
    8000,
    null
  );

  const existing = snap?.docs?.[0] || null;
  if (existing) {
    const data = existing.data();
    if (data.uid && data.uid !== user.uid) {
      console.warn('Dokumen users sudah terikat uid lain, tidak diklaim:', existing.id);
      return null;
    }
    await setDoc(
      existing.ref,
      {
        uid: user.uid,
        name: data.name || (name || '').trim() || user.email,
        claimedAt: new Date().toISOString()
      },
      { merge: true }
    );
    return { id: existing.id, ...data, uid: user.uid };
  }

  const ref = doc(collection(db, 'users'));
  const fresh = {
    uid: user.uid,
    email: user.email,
    name: (name || '').trim() || user.email,
    role: 'staff',
    createdAt: new Date().toISOString()
  };
  await setDoc(ref, fresh);
  return { id: ref.id, ...fresh };
};

// Daftar akun baru (email/password): buat user auth + dokumen `users`
// berperan 'staff' — administrator menaikkan peran lewat Pengaturan.
export const signUpUser = async (email, password, name) => {
  const { user } = await createUserWithEmailAndPassword(auth, email.trim(), password);
  let profile = null;
  try {
    profile = await claimInvitedUserDoc(user, name);
  } catch (err) {
    // Akun auth sudah terbuat; dokumen profil gagal — jangan bikin login macet.
    console.error('Gagal membuat dokumen profil pengguna:', err);
  }
  return {
    uid: user.uid,
    email: user.email,
    name: profile?.name || (name || '').trim() || user.email,
    role: profile?.role || 'staff'
  };
};

/**
 * Masuk dengan akun Google.
 * Pengguna baru otomatis dibuatkan dokumen `users` berperan 'staff' —
 * administrator dapat menaikkan perannya lewat Pengaturan → Pengguna.
 */
export const signInWithGoogle = async () => {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  // Resolver dioper di sini (bukan saat initializeAuth) supaya iframe gapi hanya
  // dimuat ketika pengguna benar-benar menekan tombol Google — lihat firebase.js.
  const { user } = await signInWithPopup(auth, provider, browserPopupRedirectResolver);

  // Cari dokumen user berdasarkan email (skema live memakai email, bukan uid)
  const usersRef = collection(db, 'users');
  const snap = await getDocs(query(usersRef, where('email', '==', user.email)));

  if (!snap.empty) {
    const userDoc = snap.docs[0];
    const data = userDoc.data();
    return {
      uid: user.uid,
      email: user.email,
      name: data.name || user.displayName || user.email,
      role: data.role || 'staff',
      photoURL: user.photoURL || '',
      docId: userDoc.id
    };
  }

  // Pengguna baru → pakai dokumen undangan bila ada (jangan bikin akun ganda),
  // kalau tidak ada baru daftarkan dengan peran paling terbatas.
  const claimed = await claimInvitedUserDoc(user, user.displayName || '');
  if (claimed) {
    await setDoc(
      doc(db, 'users', claimed.id),
      { photoURL: user.photoURL || '', provider: 'google' },
      { merge: true }
    );
    return {
      uid: user.uid,
      email: user.email,
      name: claimed.name || user.displayName || user.email,
      role: claimed.role || 'staff',
      photoURL: user.photoURL || '',
      docId: claimed.id
    };
  }

  const newUser = {
    uid: user.uid,
    email: user.email,
    name: user.displayName || user.email,
    role: 'staff',
    photoURL: user.photoURL || '',
    provider: 'google',
    createdAt: new Date().toISOString()
  };
  await setDoc(doc(db, 'users', user.uid), newUser);

  return { uid: user.uid, ...newUser, docId: user.uid };
};

// Sign out
export const signOutUser = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Error signing out:', error);
    throw error;
  }
};

// Get current user with role
export const getCurrentUserWithRole = async () => {
  const user = auth.currentUser;
  if (!user) return null;
  
  try {
    // Query users collection by email field
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('email', '==', user.email));
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const userDoc = querySnapshot.docs[0];
      const userData = userDoc.data();
      
      console.log('Current user data:', userData); // Debug log
      
      return {
        uid: user.uid,
        email: user.email,
        name: userData.name || user.email,
        role: userData.role || 'user',
        docId: userDoc.id
      };
    }
    
    return {
      uid: user.uid,
      email: user.email,
      name: user.email,
      role: 'user'
    };
  } catch (error) {
    console.error('Error getting user role:', error);
    return {
      uid: user.uid,
      email: user.email,
      name: user.email,
      role: 'user'
    };
  }
};

// Cache role terakhir yang diketahui per-uid. Mencegah menu admin "kadang hilang":
// onAuthStateChanged dipanggil ulang tiap token refresh (±1 jam); bila query
// koleksi `users` sesekali kosong/gagal (jaringan/eventual consistency), role
// tidak boleh terjun ke 'user' — pakai role tersimpan terakhir sebagai fallback.
const roleCacheKey = (uid) => `kontrack:role:${uid}`;

const readCachedRole = (uid) => {
  try {
    return localStorage.getItem(roleCacheKey(uid)) || null;
  } catch (e) {
    return null;
  }
};

const writeCachedRole = (uid, role) => {
  try {
    localStorage.setItem(roleCacheKey(uid), role);
  } catch (e) {
    /* private mode */
  }
};

// Auth state observer
export const onAuthStateChange = (callback) => {
  return onAuthStateChanged(auth, async (user) => {
    if (!user) {
      callback(null);
      return;
    }

    const fallbackRole = readCachedRole(user.uid) || 'user';

    try {
      // Query users collection by email field.
      // Dibatasi waktu: Firestore tidak selalu reject saat offline — tanpa guard
      // ini callback tak pernah dipanggil dan aplikasi macet di splash screen.
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('email', '==', user.email));
      const querySnapshot = await withTimeout(getDocs(q), 8000, null);

      if (!querySnapshot) {
        // Timeout → jangan blokir UI, pakai role cache.
        callback({ uid: user.uid, email: user.email, name: user.email, role: fallbackRole });
        return;
      }

      if (!querySnapshot.empty) {
        const userDoc = querySnapshot.docs[0];
        const userData = userDoc.data();
        const role = userData.role || fallbackRole;
        writeCachedRole(user.uid, role);

        callback({
          uid: user.uid,
          email: user.email,
          name: userData.name || user.email,
          role,
          docId: userDoc.id
        });
      } else {
        // Query kosong (transient / eventual consistency) → jangan downgrade
        console.warn('User doc tidak ditemukan, pakai role cache:', fallbackRole);
        callback({ uid: user.uid, email: user.email, name: user.email, role: fallbackRole });
      }
    } catch (error) {
      console.error('Error in auth state change, pakai role cache:', error);
      callback({ uid: user.uid, email: user.email, name: user.email, role: fallbackRole });
    }
  });
};