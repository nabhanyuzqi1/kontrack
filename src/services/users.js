// src/services/users.js
// Manajemen pengguna — koleksi `users` (skema live: email, name, role).
// Pembuatan akun & perubahan peran memakai Cloud Function yang SUDAH ter-deploy
// (addUserToCompany, updateUserRole) agar konsisten dengan Kontrack lama.

import { collection, getDocs } from 'firebase/firestore';
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
export const inviteUser = async ({ email, name, role, sendEmail = true }) => {
  const fn = httpsCallable(legacyFunctions(), 'addUserToCompany');
  const res = await fn({ email, name, role, sendEmail });
  invalidate(CACHE_KEY);
  // { userId, reused, accountCreated, emailSent, emailError }
  return res?.data;
};

/**
 * Ubah peran lewat Cloud Function `updateUserRole`.
 *
 * Tidak ada fallback tulis langsung ke `users`: rules sengaja menolak perubahan
 * `role` dari klien (itu jalur eskalasi hak akses). Kegagalan function harus
 * dilaporkan, bukan ditambal dengan penulisan yang pasti ditolak.
 */
export const changeUserRole = async (userId, role, email) => {
  const fn = httpsCallable(legacyFunctions(), 'updateUserRole');
  try {
    await fn({ userId, uid: userId, email, role });
  } catch (e) {
    throw new Error(e?.message || 'Gagal mengubah peran pengguna.');
  }
  invalidate(CACHE_KEY);
};

/**
 * Cabut akses pengguna lewat Cloud Function `removeUserAccess`.
 *
 * Penghapusan tidak lagi ditulis langsung dari klien: rules `users` menolak
 * delete dari siapa pun (hanya Admin SDK), supaya pencabutan akses selalu
 * lewat pemeriksaan peran di server.
 */
export const removeUser = async (userId, email) => {
  const fn = httpsCallable(legacyFunctions(), 'removeUserAccess');
  try {
    await fn({ userId, email });
  } catch (e) {
    throw new Error(e?.message || 'Gagal menghapus akses pengguna.');
  }
  invalidate(CACHE_KEY);
};
