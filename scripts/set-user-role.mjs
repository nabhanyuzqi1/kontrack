// scripts/set-user-role.mjs
//
// Menetapkan peran pengguna pada koleksi `users`.
//
// Kenapa ada skrip ini: Cloud Function `updateUserRole` hanya mengizinkan
// superadmin menetapkan superadmin. Saat belum ada satu pun superadmin, jalur
// aplikasi mustahil dipakai — dan memang begitu seharusnya, supaya peran
// tertinggi tidak bisa dinaikkan sendiri lewat UI. Penetapan pertama adalah
// tindakan pemilik, dijalankan dari mesin yang punya akses ke proyek.
//
// Pemakaian:
//   node scripts/set-user-role.mjs --email nabhanyuzqi1@gmail.com --role superadmin
//   node scripts/set-user-role.mjs --list
//
// Peran yang dikenal: admin | staff | viewer | superadmin

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const PROJECT = 'sistem-keuangan-ptpeb';
const DATABASE = 'kontrack';
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/${DATABASE}/documents`;
const VALID = ['admin', 'staff', 'viewer', 'superadmin'];

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : null;
};

const tokenPath = path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json');
const accessToken = JSON.parse(fs.readFileSync(tokenPath, 'utf8'))?.tokens?.access_token;
if (!accessToken) {
  console.error('Token firebase-tools tidak ditemukan. Jalankan: firebase login');
  process.exit(1);
}

const headers = { Authorization: `Bearer ${accessToken}` };

async function listUsers() {
  const res = await fetch(`${BASE}/users?pageSize=100`, { headers });
  if (!res.ok) throw new Error(`GET users ${res.status}: ${(await res.text()).slice(0, 160)}`);
  const json = await res.json();
  return (json.documents || []).map((d) => ({
    id: d.name.split('/').pop(),
    email: d.fields?.email?.stringValue || '',
    role: d.fields?.role?.stringValue || '',
    name: d.fields?.name?.stringValue || ''
  }));
}

async function setRole({ id, role }) {
  // updateMask membatasi tulis ke satu field: dokumen users berisi email, nama,
  // dan metadata lain yang tidak boleh tersentuh oleh perubahan peran.
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/${DATABASE}/documents/users/${id}?updateMask.fieldPaths=role`;
  const r = await fetch(url, {
    method: 'PATCH',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: { role: { stringValue: role } } })
  });
  if (!r.ok) throw new Error(`PATCH ${id} ${r.status}: ${(await r.text()).slice(0, 200)}`);
}

(async () => {
  const users = await listUsers();

  if (process.argv.includes('--list')) {
    users.forEach((u) => console.log(String(u.role || '(kosong)').padEnd(12), u.email.padEnd(32), u.id));
    return;
  }

  const email = arg('email');
  const role = arg('role');

  if (!email || !role) {
    console.error('Wajib: --email <alamat> --role <peran>   (atau --list)');
    process.exit(1);
  }
  if (!VALID.includes(role)) {
    console.error(`Peran tidak dikenal: ${role}. Pilih: ${VALID.join(', ')}`);
    process.exit(1);
  }

  const target = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (!target) {
    console.error(`Pengguna dengan email ${email} tidak ada di koleksi users.`);
    process.exit(1);
  }

  await setRole(target);
  console.log(`Selesai: ${target.email} (${target.id}) -> ${role}`);
})();
