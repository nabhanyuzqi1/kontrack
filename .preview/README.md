# `.preview/` — pratinjau tampilan tanpa login

Halaman aplikasi berada di balik login, jadi build yang hijau tidak membuktikan
apa pun soal tata letak. Folder ini memuat halaman Vite kecil yang merender
**komponen asli** (`src/components/reports/Reports.jsx`) memakai **data contoh** —
layanan Firestore diganti shim lewat alias, sehingga tidak ada kredensial, akun,
atau data produksi yang tersentuh.

```bash
./node_modules/.bin/vite --config .preview/vite.config.mjs
# http://localhost:5199
```

Yang berubah saat memakai harness ini: **tidak ada**. Kode aplikasi tidak diubah
sama sekali — alias hanya mengarahkan `../../services/projects`,
`../../services/transactions`, `../../services/invoices`, `../../utils/pdfGenerator`,
dan `../../services/aiInsights` ke `mock/shim.js` selama server ini berjalan.
`npm run build` dari akar repo tidak menyertakan folder ini (`check-imports.mjs`
hanya memindai `src/`).

## Menambah halaman

1. Tambahkan entri `alias` di `vite.config.mjs` bila halaman itu mengimpor layanan
   lain (pola sama: specifier relatif → `mock/shim.js`).
2. Tambahkan ekspor bernama yang dibutuhkan komponen ke `mock/shim.js`, isinya
   data contoh dari `mock/data.js`.
3. Kalau perlu, tambahkan tab/halaman di `main.jsx`.

## Batasnya

Data contoh tidak membuktikan apa pun soal Firestore: aturan keamanan, bentuk
dokumen asli, dan perilaku cache tetap **belum terverifikasi**. Sebutkan itu terus
terang di laporan; jangan mengklaim "sudah diuji" hanya karena tampilannya rapi.
