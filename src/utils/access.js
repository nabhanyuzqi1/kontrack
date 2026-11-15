// src/utils/access.js
//
// Siapa boleh melihat apa. Satu tempat, supaya pembagian "sisi klien" dan
// "sisi developer" tidak ditentukan ulang di tiap komponen (dan tidak berbeda
// antar halaman seperti sebelumnya).

/**
 * Peran yang mengelola aplikasi, bukan memakainya.
 *
 * `admin` sengaja TIDAK termasuk: administrator perusahaan adalah pengguna
 * klien. Ia perlu mengatur profil perusahaan, pajak, dan anggota timnya, tetapi
 * tidak perlu melihat nama secret, alamat gateway, atau kesehatan Firestore.
 * Yang teknis hanya untuk `superadmin` (pemilik/platform).
 */
export const DEVELOPER_ROLES = ['superadmin'];

export const isDeveloper = (user) => DEVELOPER_ROLES.includes(user?.role);

/** Administrator perusahaan: pengguna klien dengan akses penuh atas datanya. */
export const isCompanyAdmin = (user) => user?.role === 'admin';
