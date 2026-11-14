import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const shim = fileURLToPath(new URL('./mock/shim.js', import.meta.url));

// Specifier relatif dipakai sebagai kunci alias: modul asli tidak diubah sama
// sekali, hanya diarahkan ke shim selama pratinjau.
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [react()],
  resolve: {
    alias: [
      { find: '../../services/projects', replacement: shim },
      { find: '../../services/transactions', replacement: shim },
      { find: '../../services/invoices', replacement: shim },
      { find: '../../utils/pdfGenerator', replacement: shim },
      { find: '../../services/aiInsights', replacement: shim },
      { find: '../../services/settings', replacement: shim },
      { find: '../../services/auth', replacement: shim },
      // Modul berikut juga menarik Firebase saat diimpor; tanpa dialihkan,
      // initializeApp dijalankan tanpa API key dan seluruh halaman gagal render.
      { find: '../../services/clients', replacement: shim },
      { find: '../../services/users', replacement: shim },
      { find: '../../services/ai', replacement: shim },
      { find: '../../services/firebase', replacement: shim }
    ]
  },
  server: { port: 5199, strictPort: true }
});
