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
      { find: '../../services/aiInsights', replacement: shim }
    ]
  },
  server: { port: 5199, strictPort: true }
});
