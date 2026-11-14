import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const shim = fileURLToPath(new URL('./mock/shim.js', import.meta.url));

// Alias memakai POLA PATH, bukan teks specifier relatif.
//
// Alasannya konkret: specifier yang sama datang dalam beberapa bentuk prefix
// (`../../services/auth` dari components/, `../services/auth` dari hooks/,
// `./services/auth` dari dalam services/). Alias berbasis teks hanya mengenai
// bentuk yang dituliskan, sehingga modul yang terlewat tetap menarik Firebase →
// `auth/invalid-api-key` → SELURUH halaman tampil kosong tanpa pesan.
//
// Pola di bawah mengenai berkasnya dari mana pun ia diimpor. Utilitas murni
// (formatters, reportCalc) sengaja TIDAK dialihkan.
const shimPaths = [
  'services/[^/]+',
  'utils/pdfGenerator',
  'utils/sharing',
  'utils/projectImage',
  'hooks/useAuth',
  'hooks/useProjects',
  'hooks/useTransactions'
];

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [react()],
  resolve: {
    alias: shimPaths.map((p) => ({
      find: new RegExp(`^.*/src/${p}(\\.jsx?)?$`),
      replacement: shim
    }))
  },  server: { port: 5199, strictPort: true }
});
