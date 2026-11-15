# Audit Keamanan Kontrack

Tanggal: 2026-11-15 · Branch: `rebrand/kontrack-saas` · Unit 5.
Lingkup: `firestore.rules`, `storage.rules`, `firebase.json`,
`functions/index.js`, `index.html`. UI tidak diubah.

Status: **belum di-deploy**. Semua perbaikan di berkas; penerapan menunggu
izin pemilik (`firebase deploy --only firestore:rules,storage,hosting`).

---

## Ringkasan

| # | Temuan | Risiko | Status |
|---|---|---|---|
| 1 | Catch-all Firestore membuka tulis `users`/`ai_usage`/`audit_logs` | **Kritis** | Diperbaiki (kode), perlu deploy |
| 2 | `getStorageAssetDataUrl` meneruskan `bucket` dari klien (Admin SDK lewati rules) | **Kritis** | Diperbaiki |
| 3 | `sendInvoiceEmail` mengunduh URL sembarang dari klien (SSRF) | **Tinggi** | Diperbaiki |
| 4 | Tidak ada header keamanan (CSP, HSTS, nosniff, frame) | **Tinggi** | Diperbaiki |
| 5 | Callable tanpa batas ukuran payload (base64 raksasa) | **Tinggi** | Diperbaiki |
| 6 | Pesan error internal bocor ke klien (SMTP, WhatsApp) | **Sedang** | Diperbaiki |
| 7 | `notifyUsers` menerima alamat email bebas dari klien | **Sedang** | Diperbaiki |
| 8 | Unggahan arsip `doc-archives/**` ditolak rules (path tidak cocok) | **Sedang** (fungsional) | Diperbaiki, perlu uji |
| 9 | `role` tidak divalidasi di `updateUserRole` | **Sedang** | Diperbaiki |
| 10 | Tanpa rate limit pada endpoint mahal (email, WhatsApp, aset) | **Sedang** | Diperbaiki (kuota harian) |
| 11 | `projects` publik total (semua field) | **Tinggi** | Perlu pemilik (Fase 2) |
| 12 | Semua user login dianggap tim internal (tanpa cek peran di rules) | **Tinggi** | Perlu pemilik (custom claims) |
| 13 | Tanpa anti-DDoS/WAF; hosting statis | **Sedang** | Perlu pemilik (Cloud Armor/CDN) |
| 14 | App Check belum ditegakkan di callable | **Sedang** | Perlu pemilik |

---

## Detail temuan

### 1. Catch-all Firestore membuka tulis koleksi peka (Kritis)
**Masalah.** Rules punya blok spesifik `users` (`allow write: if false`) dan
`ai_usage` (`allow read, write: if false`), tetapi di bawahnya ada
`match /{document=**} { allow read, write: if signedIn(); }`. Karena rules
dievaluasi **OR** (satu `allow` yang benar sudah meloloskan permintaan), setiap
user login tetap bisa:
- menulis `role` dirinya sendiri di `users` → eskalasi hak akses,
- menol-kan penghitung `ai_usage` → kuota AI harian jadi hiasan,
- menulis `audit_logs` → menghapus jejak.

**Perbaikan.** Catch-all dihapus. Setiap koleksi yang dipakai aplikasi
didaftarkan eksplisit (`projects`, `transactions`, `invoices`, `clients`,
`settings`, `users`, `ai_usage`, `audit_logs`, `priceItems`), sisanya ditolak
lewat `match /{document=**} { allow read, write: if false; }`. `users` kini:
baca bila login; create bila uid cocok + `role == 'staff'`; update bila uid
cocok + `role` tidak berubah; delete ditolak. Signup mandiri dan login Google
tetap jalan.

**Perlu pemilik.** Deploy rules. Uji: (a) user login gagal menulis
`users/<dirinya>.role`; (b) signup baru tetap membuat dokumen; (c) tulis
`ai_usage` dari klien ditolak.

### 2. `getStorageAssetDataUrl` menerima `bucket` dari klien (Kritis)
**Masalah.** `resolvedBucket = bucket || parsed.bucket || STORAGE_BUCKET`. Nilai
`bucket` dari klien diteruskan ke `admin.storage().bucket(...)`, yang memakai
service account function dan **melewati storage.rules**. Akun login mana pun
bisa membaca objek dari bucket lain yang terjangkau service account itu.

**Perbaikan.** `bucket` dari klien ditolak kecuali sama dengan bucket Kontrack;
selalu pakai `STORAGE_BUCKET`. Ditambah batas panjang path (512), batas ukuran
berkas (15 MB), dan kuota harian.

### 3. SSRF di `sendInvoiceEmail` (Tinggi)
**Masalah.** Lampiran berisi `{url}` yang diunduh function tanpa validasi
skema/host. URL seperti `http://metadata.google.internal/...` bisa dipakai
memanggil endpoint internal memakai kredensial function.

**Perbaikan.** Hanya `https:` dan host Firebase Storage yang diizinkan
(`firebasestorage.googleapis.com`, `storage.googleapis.com`, `*.firebasestorage.app`).

### 4. Header keamanan hilang (Tinggi)
**Perbaikan** (di `firebase.json`, source `**`): `X-Content-Type-Options:
nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`,
`X-Frame-Options: DENY`, `Permissions-Policy` (kamera/mik/lokasi/pembayaran/USB
mati), `Strict-Transport-Security: max-age=31536000; includeSubDomains`, dan
`Content-Security-Policy`. Cache aset `immutable` sudah ada sejak sebelumnya.

**CSP detail.** `script-src 'self'` (bundel Vite, tanpa inline JS),
`style-src` mengizinkan `fonts.googleapis.com` + `'unsafe-inline'` (Tailwind +
Google Fonts), `connect-src` mengizinkan `*.googleapis.com`, `*.google.com`,
`*.firebase.com`, `*.firebasestorage.app`, `wss://*.googleapis.com` (Firestore
streaming), `frame-ancestors 'none'`, `object-src 'none'`. **Auth popup**
memakai iframe domain default Firebase (`<project>.firebaseapp.com`) — tercakup
oleh wildcard google/firebase, tetapi **WAJIB diuji login Google + Firestore +
unggah Storage di 2 mode tema setelah deploy**; CSP yang terlalu ketat
mati; lihat AGENTS.md §4).

### 5. Callable tanpa batas ukuran payload (Tinggi)
**Masalah.** `analyzeTransactionImageWithAI`, `scanWphoDocument`, dan
`analyzeFinancialInsights` hanya mengecek "ada isinya". Klien bisa mengirim
base64 puluhan MB atau ringkasan 10 MB; function mengurainya di memori sebelum
Gemini menolak (biaya + risiko OOM). Batas di peramban bukan pembatas.

**Perbaikan.** Validator bersama: `assertInlineImage` (mime gambar saja, tanpa
prefiks `data:`, maks 6 MB/gambar, total 24 MB), `assertText` (batas karakter),
`assertEmail`, `assertEmailList`. Ringkasan metrik maks 12.000 karakter.
Validasi dijalankan **sebelum** kuota dipotong supaya permintaan cacat tidak
menghabiskan jatah pengguna. Endpoint AI diberi `timeoutSeconds` 120-180 dan
`memory: 1GiB`.

### 6. Pesan error internal bocor (Sedang)
**Perbaikan.** `sendInvoiceEmail` dan `sendWhatsApp` mengembalikan pesan umum
(`internal`), detail asli hanya ke Cloud Logging.

### 7. `notifyUsers` tanpa batas penerima (Sedang)
**Masalah.** Daftar `to` dari klien diterima apa adanya (hanya dicek format),
sehingga admin bisa memakai identitas domain perusahaan mengirim ke alamat luar,
dan tidak ada kuota.

**Perbaikan.** Penerima dibatasi ke email yang terdaftar di koleksi `users`
selain itu ditolak; kuota `email` dipotong sejumlah penerima.

### 8. Unggahan arsip `doc-archives/**` (Sedang, fungsional)
**Masalah.** Aplikasi mengunggah ke `doc-archives/{invoices|projects}/{id}/...`
(`uploadInvoiceDocument`), tetapi rules hanya membuka `invoices/**` dan
`projects/**`; catch-all menolak sisanya. Komentar lama menyebut path
`invoices/{id}` sehingga tidak cocok dengan kode.

**Perbaikan.** Ditambah match `doc-archives/invoices/**` dan
`doc-archives/projects/**` (login, gambar/PDF, maks 25 MB).
**Belum terverifikasi**: perlu uji unggah nyata setelah deploy. Bila ternyata
sebagian objek lama berada di `invoices/`/`projects/`, blok lama tetap ada.

### 9. `role` tidak divalidasi (Sedang)
**Perbaikan.** `updateUserRole` hanya menerima `admin|staff|viewer|superadmin`
(dengan cek superadmin tetap). `addUserToCompany` sudah punya validasi setara.

### 10. Rate limit (Sedang)
Kuota harian per pengguna (WIB, transaksional, koleksi `ai_usage`):
`image` 50, `insight` 20 (sudah ada) + **baru** `email` 30, `asset` 500,
`whatsapp` 30. Ini rate limit kasar berbasis hari, bukan per menit; lihat
temuan 13 untuk pembatasan di tepi jaringan.

---

## Perlu tindakan pemilik (tidak dikerjakan agen)

### 11. `projects` dapat dibaca siapa saja (Tinggi)
`match /projects/{id} { allow read: if true; }` membuka **seluruh field** proyek
tanpa login: nilai kontrak, klien, nomor kontrak. Hanya dibutuhkan untuk
share-link mitra.
**Langkah:** tetapkan share-token (koleksi `project_shares` dengan token acak +
`expiresAt`), lalu ubah `allow read` menjadi cek token. Sampai itu ada,
pertimbangkan minimal memisahkan field publik ke subdokumen
(`projects/{id}/public/summary`) yang boleh dibaca.

### 12. Peran tidak ditegakkan di rules (Tinggi)
Semua user login setara di Firestore. `viewer` pun bisa menulis invoice.
**Langkah** (urutan yang benar, dari ROADMAP): pindahkan `users` ke
`users/{uid}` → pasang custom claim `role` lewat Cloud Function (Admin SDK) →
baru rules memakai `request.auth.token.role`.

### 13. Anti-DDoS / WAF (Sedang)
Hosting statis Firebase **tidak** menyediakan load balancer atau anti-DDoS
yang bisa disetel sendiri; agen tidak bisa (dan tidak boleh mengarang) menambah
lapisan itu. Yang tersedia tanpa mengubah arsitektur:
- **App Check** (sudah terpasang reCAPTCHA v3 di klien) → tegakkan di callable
  dengan `enforceAppCheck: true` agar hanya klien resmi yang bisa memanggil.
- **Cloud Armor** hanya berlaku di belakang HTTPS Load Balancer: perlu memindah
  domain ke LB + Cloud CDN (biaya + setelan DNS). Ini keputusan pemilik.
- **Firebase App Hosting / Cloud Run** punya pembatasan kuota; hosting statis
  tidak. Jangan klaim terlindungi sebelum ada LB.
**Langkah pemilik:** (a) putuskan apakah domain akan dipindah ke HTTPS LB +
Cloud CDN + Cloud Armor; (b) bila tidak, minimal aktifkan App Check enforcement
pada callable dan pantau kuota hosting di Console.

### 14. App Check belum ditegakkan di server
Klien sudah menginisialisasi App Check, tetapi callable tidak memakai
`enforceAppCheck: true`, sehingga token App Check tidak wajib.
**Langkah:** uji di emulator/klik nyata, lalu tambahkan
`enforceAppCheck: true` pada setiap `onCall`. Jangan lakukan bersamaan dengan
deploy header/CSP — dua perubahan sekaligus menyulitkan isolasi penyebab bila
klien lama belum punya token.

### 15. Kredensial yang pernah terekspos
Masih terbuka dari AGENTS.md §8: rotasi API key Gemini lama dan
`settings.ai.apiKey` di Firestore. Tidak dikerjakan agen.

---

## Belum terverifikasi

1. **Deploy.** Tidak ada deploy (sesuai instruksi). Header, rules, dan function
   versi baru belum aktif di `kontrack.web.app`.
2. **CSP tidak merusak Auth/Storage.** Perlu uji manual setelah deploy: login
   Google (popup, iframe `__/auth/handler`), login email/password, baca
   Firestore, unggah bukti transaksi, unduh PDF invoice (memakai
   `getStorageAssetDataUrl`).
3. **Rules Firestore lolos validasi server.** Untuk menyimpan `users` dari
   klien, Firebase Console harus punya field `role` bertipe `string`; bila belum,
   `request.resource.data.role == 'staff'` gagal evaluasi dan create ditolak.
   Cadangkan dulu lalu uji di Rules Playground.
4. **Unggah `doc-archives/**` setelah rules baru** (temuan 8).
5. **Uji regresi callable**: `analyzeTransactionImageWithAI` (1 dan 8 gambar),
   `scanWphoDocument`, `analyzeFinancialInsights`, `sendInvoiceEmail` dengan
   lampiran, `getStorageAssetDataUrl`. Build hijau bukan bukti; perlu panggilan
   nyata dengan akun uji.
6. **`npm run build` saat audit** gagal di `src/components/layout/AppLayout.jsx`
   (JSX tidak seimbang: `</div>` menutup `<header>`), berkas yang **tidak**
   diubah unit ini dan sedang disunting unit lain pada saat yang sama. `npm run
   check` lulus. Build harus diulang dari working tree akhir.

---

## Aturan yang harus dipertahankan

- **Jangan** menambah `match /{document=**} { allow ...: if signedIn(); }` lagi:
  OR-evaluation membuatnya membuka semua pengecualian di atasnya.
- Header `connect-src` CSP hanya boleh diperluas setelah memastikan domain baru
  memang dipanggil aplikasi (Firestore/Auth/Storage/Functions), bukan
  "supaya tidak error".
- Kuota harian ditegakkan server; koleksi `ai_usage` harus tetap tertutup klien.
- Validasi ukuran di callable tidak boleh dihapus demi "biar cepat".
