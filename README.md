# Kontrack

Platform manajemen proyek & keuangan untuk kontraktor Indonesia — dari SPK, termin, invoice, sampai faktur pajak CoreTax.

PT Permata Energi Borneo adalah tenant pertama; Kontrack sendiri dirancang sebagai SaaS multi-tenant.

Live: https://kontrack.web.app

---

## Stack

| Lapisan | Teknologi |
|---|---|
| Build | Vite 5 |
| UI | React 18, Tailwind 3, lucide-react |
| Grafik | Recharts |
| PDF | jsPDF + jspdf-autotable |
| Backend | Firebase Auth, Firestore, Storage, Cloud Functions v2 (Node 22) |
| AI | Gemini 2.5 Flash lewat Vertex AI |

## Menjalankan

```bash
npm install
npm run dev
```

| Perintah | Kegunaan |
|---|---|
| `npm run dev` | Server pengembangan |
| `npm run build` | Cek impor lalu build produksi ke `build/` |
| `npm run check` | Cek komponen JSX yang dipakai tapi belum di-impor |
| `npm run preview` | Pratinjau hasil build |

`npm run build` menjalankan `scripts/check-imports.mjs` lebih dulu. esbuild **tidak** menggagalkan build untuk komponen JSX yang dipakai tapi belum di-impor — halamannya baru tampak putih saat dibuka. Pemeriksa ini menangkapnya sebelum deploy.

## Konfigurasi

Salin `.env.example` ke `.env`. Nilai yang tidak boleh diubah tanpa alasan kuat:

| Variabel | Nilai | Catatan |
|---|---|---|
| `VITE_FIREBASE_AUTH_DOMAIN` | `sistem-keuangan-ptpeb.firebaseapp.com` | **Harus domain default** — lihat di bawah |
| `VITE_FIREBASE_STORAGE_BUCKET` | `kontrack` | Tanpa sufiks `.firebasestorage.app` |
| `VITE_FIRESTORE_DATABASE_ID` | `kontrack` | Bukan `(default)` |

### authDomain harus domain default

`signInWithPopup` mengarahkan Google ke `redirect_uri=https://{authDomain}/__/auth/handler`. Firebase hanya mendaftarkan handler domain default di OAuth client-nya. Menambahkan `kontrack.web.app` ke *Authorized domains* Firebase **tidak** mendaftarkan redirect URI tersebut — login Google gagal dengan `Error 400: redirect_uri_mismatch`.

Untuk memakai `kontrack.web.app` di sini, daftarkan dulu `https://kontrack.web.app/__/auth/handler` di Google Cloud Console → Credentials → OAuth 2.0 Client ID → Authorized redirect URIs.

### Login Google

Provider Google harus diaktifkan di Firebase Console → Authentication → Sign-in method. Tanpa itu, klien menerima `auth/operation-not-allowed`.

## Infrastruktur

Semua sumber daya di **asia-southeast2 (Jakarta)**. Tidak ada yang tersisa di region lain.

| Sumber daya | Nama |
|---|---|
| Firestore | database `kontrack` |
| Storage | bucket `kontrack` |
| Functions | `asia-southeast2` |
| Hosting | site `kontrack` |

Saat menambah function, bucket, atau database baru — tetapkan region secara eksplisit. Default Firebase adalah `us-central1`.

### Cloud Functions

| Function | Kegunaan |
|---|---|
| `analyzeTransactionImageWithAI` | Ekstraksi transaksi dari bukti transfer (maks 8 gambar per panggilan) |
| `analyzeFinancialInsights` | Analisis keuangan untuk Dashboard & Laporan |
| `getStorageAssetDataUrl` | Ambil aset Storage sebagai data URL untuk jsPDF |
| `addUserToCompany` | Buat pengguna baru (admin/superadmin) |
| `updateUserRole` | Ubah peran pengguna (admin/superadmin) |

```bash
firebase deploy --only functions --project sistem-keuangan-ptpeb
```

## AI

Dua jalur ke Gemini, dicoba berurutan:

1. **Vertex AI** (utama) — ditagih ke Cloud Billing proyek. Tanpa API key: otentikasi memakai service account function lewat metadata server.
2. **Gemini Developer API** (cadangan) — memakai secret `GEMINI_API_KEY`, ditagih ke kredit prabayar AI Studio. Dipakai hanya bila Vertex belum aktif.

Dua hal yang mudah terlewat:

- **`contents` wajib punya `role`.** Vertex menolak tanpanya (`Please use a valid role: user, model`); Developer API membolehkan. Dinormalkan di `callGemini`.
- **`thinkingBudget: 0`.** Gemini 2.5 adalah model *thinking* dan token berpikirnya dihitung terhadap `maxOutputTokens`. Dengan batas kecil, seluruh jatah habis untuk berpikir dan jawabannya kosong (`finishReason: MAX_TOKENS`, `parts` kosong).

### Hemat token

- Klien mengirim **agregat** metrik (~300 token), bukan ratusan transaksi mentah.
- `responseSchema` menggantikan instruksi format panjang di prompt.
- Banyak gambar digabung dalam satu panggilan sehingga prompt dipakai bersama.
- Gambar dikompresi sekali, hasilnya dipakai untuk unggah **dan** kiriman ke AI.
- Hasil analisis di-cache 30 menit di `sessionStorage`.

Pemakaian token tercatat di log:

```bash
gcloud functions logs read analyzeFinancialInsights --region=asia-southeast2 --project=sistem-keuangan-ptpeb --limit=20 | grep token
```

### Kuota harian per pengguna

Ditegakkan di server (`DAILY_LIMITS` di `functions/index.js`), direset 00:00 WIB:

- 50 analisis gambar
- 20 analisis keuangan

Penghitung disimpan di koleksi `ai_usage`, yang **tertutup dari klien** lewat `firestore.rules` — kalau tidak, pengguna tinggal menol-kan penghitungnya sendiri.

## Struktur

```
src/
  components/     UI per domain (dashboard, projects, invoices, reports, settings, …)
  services/       Akses Firebase + cache (firebase, projects, transactions, invoices, cache)
  utils/          Logika murni (invoiceGenerator, coretaxXml, reportCalc, imageCompress)
functions/        Cloud Functions
scripts/          Perkakas build & migrasi
docs/             PRD, audit, roadmap, panduan setup
```

### Cache

`services/cache.js` — cache-aside di memori (TTL 60 detik) dengan dedup permintaan bersamaan.

Fetcher dibatasi 10 detik. Firestore tidak selalu me-reject saat koneksi tersendat, dan karena ada dedup in-flight, satu permintaan macet membuat **setiap** kunjungan berikutnya menunggu promise yang sama selamanya. Saat gagal, data lama dipakai bila ada.

Mutasi wajib memanggil `invalidate(CACHE_KEYS.…)`.

### Transport Firestore

Long-polling **dipaksa** (`experimentalForceLongPolling` + `useFetchStreams: false`). Safari menolak transport streaming Firestore dengan `Fetch API cannot load … due to access control checks`; auto-deteksi menjajal transport itu lebih dulu dan baru mundur setelah probe habis waktu — selama jeda itu halaman berputar.

## Domain

- **PPN 12% dengan DPP Nilai Lain** (PMK 131/2024): DPP = 11/12 × subtotal, PPN = 12% × DPP — efektif 11%.
- **Ekspor CoreTax**: `utils/coretaxXml.js`. Salah eja `<BuyerAdress>` **wajib dipertahankan** — begitulah skema CoreTax menuliskannya.
- Alur kontraktor: RAB → penawaran → SPK → termin → retensi → PHO → FHO.

## Migrasi data

Dipakai saat pindah region; disimpan untuk kebutuhan serupa.

```bash
node scripts/migrate-firestore.cjs                 # dry-run
node scripts/migrate-firestore.cjs --apply
node scripts/migrate-firestore.cjs --verify        # bandingkan jumlah dokumen
node scripts/migrate-firestore.cjs --dump=DIR      # cadangkan ke JSON
bash scripts/migrate-storage.sh --apply
```

Memakai REST API Firestore, bukan Admin SDK: kredensialnya cukup token gcloud yang sedang aktif, dan nilai dokumen diteruskan dalam bentuk terketik apa adanya sehingga tidak ada konversi tipe yang bisa merusak data.

## Deploy

```bash
npm run build
firebase deploy --project sistem-keuangan-ptpeb
```

## Dokumentasi

| Berkas | Isi |
|---|---|
| [AGENTS.md](AGENTS.md) | **Instruksi kerja untuk agen AI mana pun** — konteks, cara kerja, jebakan. Baca ini dulu. |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Status & rencana. Perbarui setiap menyelesaikan sesuatu. |
| [docs/SETUP-ai-gemini.md](docs/SETUP-ai-gemini.md) | Jalur AI, kuota, hemat token |
| [docs/PRD-kontrack-saas.md](docs/PRD-kontrack-saas.md) | Spesifikasi produk SaaS (historis) |
| [docs/audit-saas-redesign.md](docs/audit-saas-redesign.md) | Audit & rencana redesign (historis) |

## Belum selesai

Ringkasnya: portofolio publik, BOQ & database harga, multi-tenant penuh.
Daftar lengkap beserta urutan dan alasannya di [docs/ROADMAP.md](docs/ROADMAP.md).

---

Mengerjakan repo ini dengan agen AI? Baca **[AGENTS.md](AGENTS.md)** lebih dulu.
