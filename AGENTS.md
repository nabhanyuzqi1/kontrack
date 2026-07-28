# AGENTS.md — instruksi kerja untuk agen AI di repo Kontrack

Berkas ini adalah sumber tunggal konteks kerja. Berlaku untuk **agen AI mana pun**
(Claude Code, Kimi, Antigravity, Cursor, Copilot, dsb). `CLAUDE.md` hanya menunjuk
ke sini supaya tidak ada dua salinan yang bisa saling berbeda.

Baca berkas ini **sebelum** menyentuh kode. Lalu baca `README.md` untuk stack &
perintah.

---

## 1. Konteks produk

**Kontrack** = platform SaaS manajemen proyek & keuangan untuk kontraktor Indonesia.
**PT Permata Energi Borneo (PT PEB)** = perusahaan milik pemilik repo, tenant pertama.

Keduanya jangan tertukar. Kontrack adalah produknya; PT PEB adalah penggunanya.

Nama project Firebase masih `sistem-keuangan-ptpeb` — itu warisan, bukan merek.
Jangan diganti (mengganti project ID berarti membangun ulang semuanya).

Konsep produk yang diminta pemilik: **detailed, solution, tidak ribet** — informasi
lengkap tapi tidak membanjiri.

---

## 2. Cara kerja yang diharapkan

Ini yang membuat hasil kerja konsisten antar-agen. Ikuti, jangan disederhanakan.

### Perbaiki akar masalah, bukan gejalanya

Laporan bug menyebut gejala. Sebelum menyunting, telusuri semua pemanggil fungsi
yang akan diubah. Perbaikan di satu fungsi bersama lebih kecil diff-nya daripada
tambalan di setiap pemanggil — dan menambal hanya jalur yang dilaporkan
meninggalkan pemanggil lain tetap rusak.

Contoh nyata di repo ini: Dashboard & Laporan menggantung. Perbaikannya bukan di
dua halaman itu, melainkan satu batas waktu di `services/cache.js` yang
menyembuhkan seluruh pemanggil.

### Pakai yang sudah ada

Sebelum menulis kode baru, cek berurutan:

1. Apakah ini memang perlu ada? Kebutuhan spekulatif — lewati.
2. Sudah ada di repo? (`services/cache.js`, `utils/async.js`, `components/ui/`)
3. Bisa dengan pustaka bawaan / fitur native?
4. Dependensi yang sudah terpasang?
5. Baru tulis kode seminimalnya.

Jangan menambah dependensi untuk sesuatu yang beberapa baris pun cukup.

### Verifikasi, jangan mengklaim

Jangan menyatakan sesuatu berhasil tanpa bukti. Jalankan `npm run build`. Uji
endpoint dengan `curl`. Baca log. Kalau tidak bisa diverifikasi (mis. di balik
login), **katakan terus terang** bahwa bagian itu belum terverifikasi.

Ini pernah menyelamatkan dua bug: `finishReason: MAX_TOKENS` dengan jawaban kosong,
dan Vertex menolak `contents` tanpa `role`. Keduanya hanya ketahuan karena
endpoint benar-benar dipanggil.

### Komentar menjelaskan SEBAB, bukan isi kode

Tulis komentar untuk hal yang tidak terbaca dari kodenya: kenapa ada batas waktu,
kenapa salah eja dipertahankan, kenapa suatu opsi dipaksa. Bukan mengulang apa
yang sudah jelas dari nama fungsi.

Bahasa komentar & commit: **Indonesia**. Kode, nama API, dan pesan error: apa adanya.

### Batas yang tidak boleh dilanggar

- **Jangan pernah mengetikkan password, API key, atau kredensial** ke sistem mana
  pun. Minta pemilik yang melakukannya. Ini berlaku walau pemilik menyodorkan
  kredensialnya langsung.
- **Jangan menghapus atau menimpa sumber daya produksi** tanpa pemilik menyebut
  targetnya secara eksplisit. Cadangkan dulu.
- **Jangan mengubah setelan autentikasi / IAM** sendiri. Tunjukkan langkahnya ke
  pemilik.
- Deploy produksi hanya bila diminta.

---

## 3. Infrastruktur — hafalkan

Semua sumber daya di **asia-southeast2 (Jakarta)**. Region lain sudah ditakedown
total pada 2026-07-27. Default Firebase adalah `us-central1` — **selalu tetapkan
region secara eksplisit**.

| Sumber daya | Nilai |
|---|---|
| Project ID | `sistem-keuangan-ptpeb` |
| Firestore | database **`kontrack`** (bukan `(default)` — sudah dihapus) |
| Storage | bucket **`kontrack`** (tanpa sufiks `.firebasestorage.app`) |
| Functions | `asia-southeast2` |
| Hosting | site `kontrack` → https://kontrack.web.app |
| Cadangan Firestore | `~/Kontrack-backup/firestore-default-20260727/` (226 dokumen) |

---

## 4. Jebakan yang mahal ditemukan ulang

Setiap butir di bawah ini pernah memakan waktu berjam-jam. Jangan "perbaiki"
tanpa membaca sebabnya.

### `authDomain` harus domain default

`signInWithPopup` mengarahkan Google ke `redirect_uri=https://{authDomain}/__/auth/handler`.
Firebase hanya mendaftarkan handler domain default di OAuth client-nya. Menambah
`kontrack.web.app` ke *Authorized domains* Firebase **tidak** mendaftarkan redirect
URI itu → `Error 400: redirect_uri_mismatch`.

Untuk memakai `kontrack.web.app`, daftarkan dulu
`https://kontrack.web.app/__/auth/handler` di Google Cloud Console → Credentials →
OAuth 2.0 Client ID → Authorized redirect URIs.

### Iframe auth jangan dimuat di setiap page load

`getAuth()` otomatis memasang popup/redirect resolver, yang memuat iframe gapi di
**setiap** page load. Di Safari iframe itu menggantung dan menahan koneksi.

Karena itu `services/firebase.js` memakai `initializeAuth` **tanpa**
`popupRedirectResolver`, dan resolver dioper eksplisit ke `signInWithPopup` di
`services/auth.js`. Jangan dikembalikan ke `getAuth()`.

### Long-polling Firestore dipaksa

Safari menolak transport streaming Firestore:
`Fetch API cannot load … due to access control checks`. `experimentalAutoDetectLongPolling`
menjajal transport itu lebih dulu dan baru mundur setelah probe habis waktu —
selama jeda itu halaman berputar.

Karena itu dipakai `experimentalForceLongPolling: true` + `useFetchStreams: false`.

### Batas waktu di lapisan cache

Firestore **tidak selalu me-reject** saat koneksi tersendat; `getDocs` bisa
menggantung tanpa batas. `services/cache.js` punya dedup in-flight, jadi satu
permintaan macet membuat **setiap** kunjungan berikutnya menunggu promise yang
sama selamanya.

Karena itu fetcher dibatasi 10 detik, jatuh ke data lama bila ada, dan entri
in-flight selalu dibersihkan di `finally`.

### Vertex wajib `role` di `contents`

Vertex menolak `contents` tanpa `role` (`Please use a valid role: user, model`);
Developer API membolehkan. Dinormalkan sekali di `callGemini`, bukan di pemanggil.

### `thinkingBudget: 0`

Gemini 2.5 adalah model *thinking* dan token berpikirnya **dihitung terhadap**
`maxOutputTokens`. Dengan batas kecil, seluruh jatah habis untuk berpikir dan
jawabannya kosong (`finishReason: MAX_TOKENS`, `parts` kosong). Ekstraksi berpandu
`responseSchema` tidak butuh penalaran bertahap.

### `<BuyerAdress>` memang salah eja

Skema CoreTax menuliskannya begitu. **Jangan diperbaiki** — XML akan ditolak.
Lihat `utils/coretaxXml.js`.

### `check-imports.mjs` bukan basa-basi

esbuild **tidak** menggagalkan build untuk komponen JSX yang dipakai tapi belum
di-impor; halamannya baru tampak putih saat dibuka. `npm run build` menjalankan
pemeriksa ini lebih dulu. Jangan dilewati.

### Functions v2: `request` ADALAH context

`request.context` selalu `undefined`. Versi live lama memakai
`authenticateUser(request.context)` sehingga dua function user-management selalu
gagal auth. Pakai `request.auth`.

### Koleksi `users` memakai ID acak

Bukan `users/{uid}`. Cari lewat field `email`. Ini menyebabkan `firestore.rules`
belum bisa mengecek peran, sehingga masih ada catch-all "semua pengguna login
dianggap tim internal".

---

## 5. Peta kode

```
src/
  components/
    dashboard/    Dashboard, CashflowChart, RecentProjects, RecentTransactions
    projects/     daftar, kartu, modal, detail
    invoices/     builder invoice + dokumen pajak
    reports/      Reports, AnnualReport, TaxMonthlyReport, ReportCharts
    clients/      CRM mitra/klien
    settings/     SettingsPage (perusahaan, tema, notifikasi, pengguna)
    ai/           AIInsightCard (pemicu manual)
    ui/           Card, Button, Field, Skeleton, Lightbox, ErrorBoundary
  services/       akses Firebase + cache
  utils/          logika murni, tanpa Firebase
functions/        Cloud Functions (satu index.js)
scripts/          check-imports, migrate-firestore, migrate-storage
```

Berkas yang paling sering jadi akar masalah:

| Berkas | Kenapa penting |
|---|---|
| `services/firebase.js` | Init Auth/Firestore/Storage — semua jebakan transport ada di sini |
| `services/cache.js` | Cache-aside + batas waktu; menyembuhkan atau merusak semua halaman |
| `functions/index.js` | Seluruh Cloud Function, jalur AI, kuota harian |
| `utils/invoiceGenerator.js` | PDF invoice tiruan template PT PEB |
| `utils/coretaxXml.js` | Ekspor faktur pajak |

Aturan: `utils/` tidak boleh mengimpor Firebase. Mutasi di `services/` wajib
memanggil `invalidate(CACHE_KEYS.…)`.

---

## 6. Domain pajak & kontraktor

- **PPN 12% dengan DPP Nilai Lain** (PMK 131/2024): DPP = 11/12 × subtotal,
  PPN = 12% × DPP → **efektif 11%**. Sudah diverifikasi sampai rupiah terhadap
  faktur asli `04002600186547696`.
- Alur kontraktor: RAB → penawaran → SPK → termin → retensi → PHO → FHO.
- Masalah nomor satu kontraktor: **jeda arus kas** antara mengeluarkan biaya dan
  termin cair. Fitur apa pun sebaiknya menjawab ini.

---

## 7. AI

Dua jalur, dicoba berurutan di `callGemini`:

1. **Vertex AI** (utama) — ditagih ke Cloud Billing proyek. Tanpa API key;
   otentikasi memakai service account function lewat metadata server.
2. **Gemini Developer API** (cadangan) — secret `GEMINI_API_KEY`, ditagih ke kredit
   prabayar AI Studio. Dipakai hanya bila Vertex belum aktif (401/403/404).

Vertex **tidak punya kuota gratis harian** — free tier itu milik Developer API.

Prinsip hemat token yang harus dipertahankan:

- Kirim **agregat** metrik (~300 token), bukan ratusan transaksi mentah.
- `responseSchema` menggantikan instruksi format panjang di prompt.
- Banyak gambar dalam satu panggilan → prompt dipakai bersama.
- Gambar dikompresi sekali, hasilnya dipakai untuk unggah **dan** kiriman ke AI.
- Hasil di-cache 30 menit di `sessionStorage`.

Kuota harian per pengguna ditegakkan **di server** (`DAILY_LIMITS`), reset 00:00 WIB:
50 analisis gambar, 20 analisis keuangan. Penghitung di koleksi `ai_usage` yang
tertutup dari klien lewat rules — kalau terbuka, pengguna tinggal menol-kannya.

Pemakaian token tercatat di log Cloud Functions.

---

## 8. Yang perlu pemilik lakukan sendiri

Agen tidak boleh mengerjakan ini:

- [ ] **Aktifkan Google Sign-In** — Firebase Console → Authentication → Sign-in
      method → Google → Enable → pilih support email → Save.
      Saat ini tidak ada provider IdP terdaftar, sehingga login Google menghasilkan
      `auth/operation-not-allowed`.
- [ ] **Rotasi kredensial yang pernah terekspos di percakapan**: API key Gemini
      lama, dan `settings.ai.apiKey` yang tersimpan di Firestore.
- [ ] Isi ulang kredit AI Studio **jika** ingin jalur cadangan tetap hidup
      (tidak wajib — Vertex sudah jalan).

---

## 9. Status & rencana

Lihat `docs/ROADMAP.md`. Perbarui berkas itu setiap menyelesaikan sesuatu, supaya
agen berikutnya tidak mengulang pekerjaan yang sudah selesai.
