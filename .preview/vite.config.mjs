import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// Alih-alih resolve.alias (yang bekerja pada teks specifier dan rapuh terhadap
// bentuk path Windows/URL), pengalihan dipakai lewat plugin resolveId: kita
// menerima specifier mentah MAUPUN id hasil resolusi, lalu mengembalikan path
// absolut berkas shim. Tanpa ini, modul Firebase ikut termuat di pratinjau
// (`auth/invalid-api-key`) dan halaman kosong total tanpa pesan.
const BS = String.fromCharCode(92); // backslash, terhindar dari perang escaping
const shimFs = fileURLToPath(new URL('./mock/shim.js', import.meta.url))
  .split(BS)
  .join('/');

// Daftar ujung path yang WAJIB dialihkan ke shim. Ditulis sebagai pola ujung
// (tanpa awalan absolut) supaya cocok untuk '../../services/auth',
// '/@fs/C:/.../src/services/auth.js', maupun 'C:\...\services\auth.js'.
const TAILS = [
  new RegExp('services/[^/]+(' + BS + '.[cm]?jsx?)?$'),
  new RegExp('hooks/(useAuth|useProjects|useTransactions)(' + BS + '.[cm]?jsx?)?$'),
  new RegExp('utils/(pdfGenerator|invoiceGenerator|sharing|projectImage)(' + BS + '.[cm]?jsx?)?$')
];

const shimPlugin = {
  name: 'preview-shim-firebase',
  enforce: 'pre',
  resolveId(source) {
    const id = String(source).split('?')[0].split(BS).join('/');
    if (TAILS.some((re) => re.test(id))) {
      return shimFs;
    }
    return null;
  }
};

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [shimPlugin, react()],
  server: { port: 5199, strictPort: true }
});
