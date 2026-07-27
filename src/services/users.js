// src/services/users.js
// Manajemen pengguna — koleksi `users` (skema live: email, name, role).
// Pembuatan akun & perubahan peran memakai Cloud Function yang SUDAH ter-deploy
// (addUserToCompany, updateUserRole) agar konsisten dengan Kontrack lama.

import { collection, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { legacyFunctions } from './functionsRegion';
import { db } from './firebase';
import { cached, invalidate } from './cache';

const COLLECTION = 'users';
const CACHE_KEY = 'users:all';

export const USER_ROLES = [
  { value: 'admin', label: 'Administrator', desc: 'Akses penuh termasuk pengaturan & invoice' },
  { value: 'staff', label: 'Staf', desc: 'Input proyek & transaksi, tanpa pengaturan' },
  { value: 'viewer', label: 'Peninjau', desc: 'Hanya melihat data' }
];

export const roleLabel = (role) =>
  USER_ROLES.find((r) => r.value === role)?.label || role || 'Pengguna';

export const getAllUsers = async () =>
  cached(CACHE_KEY, async () => {
    const snap = await getDocs(collection(db, COLLECTION));
    const list = [];
    snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
    return list.sort((a, b) => (a.email || '').localeCompare(b.email || ''));
  });

/**
 * Undang/buat pengguna baru lewat Cloud Function `addUserToCompany`.
 * Function yang membuat akun Auth + dokumen user, sehingga password tidak
 * pernah melewati aplikasi ini.
 */
export const inviteUser = async ({ email, name, role }) => {
  const fn = httpsCallable(legacyFunctions(), 'addUserToCompany');
  const res = await fn({ email, name, role });
  invalidate(CACHE_KEY);
  return res?.data;
};

/** Ubah peran lewat Cloud Function `updateUserRole` (fallback: tulis langsung). */
export const changeUserRole = async (userId, role, email) => {
  try {
    const fn = httpsCallable(legacyFunctions(), 'updateUserRole');
    await fn({ userId, uid: userId, email, role });
  } catch (e) {
    console.warn('updateUserRole function gagal, menulis langsung:', e?.message || e);
    await updateDoc(doc(db, COLLECTION, userId), { role, updatedAt: new Date().toISOString() });
  }
  invalidate(CACHE_KEY);
};

export const removeUser = async (userId) => {
  await deleteDoc(doc(db, COLLECTION, userId));
  invalidate(CACHE_KEY);
};
