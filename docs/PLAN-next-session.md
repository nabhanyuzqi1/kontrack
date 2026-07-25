# Kontrack — Plan Sesi Berikutnya

Disusun akhir sesi (limit). Urutan mengikuti prioritas user. Semua tugas sudah
ada akar masalah + file target supaya bisa langsung dieksekusi.

## STATUS (update terakhir)
- ✅ P1 dropdown mitra di Tambah Proyek — SELESAI (ProjectModal Select dari clients)
- ✅ P2 fix sidebar admin flicker — SELESAI (auth.js cache role per-uid, tak downgrade transient)
- ✅ P3 tampilan GUEST share-link — SELESAI SEBAGIAN (Export PDF & back-link disembunyikan utk tamu; "Sisa Tagihan" negatif → "Lunas"). SISA: poles density ProjectList di DESKTOP lebar.
- ✅ P4 share WhatsApp — TEKS SELESAI (fix bug /0 → Infinity, format profesional + nama perusahaan). SISA: auto-kirim gambar/diagram (html2canvas) + webhook settings.notifications.whatsappWebhookUrl + tab Notifikasi di Pengaturan.
- ✅ P6 upload bukti di transaksi manual — SELESAI (TransactionModal, pakai uploadTransactionImage).
- ✅ P5 AI — SELESAI (kode). functions/index.js: defineSecret + auth + multi-gambar (images[]) + responseSchema hemat token. services/ai.js: analyzeTransactionImages (1 call banyak gambar). AITransactionModal: pilih banyak → verifikasi tiap hasil → simpan semua. WAJIB DEPLOY: firebase functions:secrets:set GEMINI_API_KEY + firebase deploy --only functions + revoke key lama (lihat docs/SETUP-ai-gemini.md). Build & syntax OK.
- Build lolos, dev server jalan, guest view terverifikasi di mobile.

## SISA (belum): 
- P3-lanjut: poles density ProjectList DESKTOP lebar.
- P4-lanjut: auto-kirim gambar/diagram (html2canvas) + webhook whatsappWebhookUrl + tab Notifikasi di Pengaturan.
- Ditunda user: Faktur Pajak CoreTax XML, Laporan bulanan/tahunan, reminder klien, dashboard AI analytic, API docs, Database Harga/BOQ, Fase 2 multi-tenant.
- Manual (user): gsutil CORS storage (kop surat), revoke+set Gemini secret & deploy function, deploy firestore.rules (setelah uji).

Baca dulu: `memory/kontrack-rebrand-saas.md` (konteks penuh) +
`docs/roadmap-invoice-pajak.md` + `docs/audit-saas-redesign.md`.

Verifikasi cepat kondisi sekarang: `npm run build` (harus lolos), lalu
`npm run dev` → login admin di localhost:3000.

---

## P1 — Tambah Proyek: dropdown Mitra dari daftar Klien
**Kenapa:** field "Mitra/Partner" masih input teks bebas → tak konsisten dgn Klien CRM.
**File:** `src/components/projects/ProjectModal.jsx` (field `partner`, baris ~219).
**Tugas:**
- Import `getAllClients`, `clientDisplayName` dari `services/clients`.
- Muat klien di `useEffect`; ganti `<input name="partner">` jadi `<Select>` berisi daftar klien (value = nama klien).
- Sisakan opsi "+ Klien baru" yang membuka ClientModal, atau minimal validasi: kalau kosong arahkan ke menu Klien.
- Pertahankan `partner` sebagai string nama (kompatibel data lama) — cukup dropdown yang mengeset nama.

## P2 — Fix bug sidebar (Invoice/Klien/Pengaturan kadang hilang)
**AKAR MASALAH (sudah dipastikan):** `services/auth.js` → `onAuthStateChange`
me-query ulang koleksi `users` by email SETIAP event auth (termasuk token refresh
tiap ±1 jam). Bila query sesekali kosong/error, `role` jatuh ke `'user'` →
menu admin (yang di-gate `isAdmin`) hilang. Ini sumber "kadang muncul kadang ga".
**File:** `src/services/auth.js` (baris 100-147), `src/App.jsx`.
**Tugas (pilih salah satu):**
- (Cepat) Jangan downgrade role saat error/empty transient: simpan role terakhir yang diketahui (mis. `localStorage`) dan pakai sebagai fallback alih-alih `'user'`.
- (Benar) Pindah role ke **custom claims** (bagian Fase 2 multi-tenant) → tak perlu query `users` sama sekali, `isAdmin` dari token. Ini juga menutup celah keamanan role.
- Sementara: di `App.jsx`, jangan render ulang nav berbasis role yang belum resolve — tahan nilai `isAdmin` sebelumnya.

## P3 — UI/UX halaman Project + tampilan guest (share link) — desktop & mobile
**Kenapa:** user bilang masih "berantakan". Dashboard sudah OK.
**File:** `src/components/projects/ProjectList.jsx`, `ProjectCard.jsx`, `ProjectDetail.jsx`.
**Fokus:**
- **ProjectDetail untuk guest** (dibuka via `/projects/:id` tanpa login): saat `txnRestricted`, header aksi (WhatsApp/PDF/Invoice/Salin Link) & 3 kartu info perlu ditata ulang — untuk guest sembunyikan tombol internal (Invoice, Export PDF admin), tampilkan versi publik yang rapi (nama proyek, mitra, nilai, progres, status) — jadikan ini "public project view" yang cakep di mobile & desktop.
- **ProjectList/Card**: rapikan grid & density desktop (saat ini kartu terlalu lebar/renggang di desktop lebar). Pertimbangkan tabel/list padat sebagai opsi tampilan.
- Pakai skill `ui-ux-pro-max` (aktif) — `python3 <skill>/scripts/search.py "project detail public share" --domain ux`.
- Uji di viewport 375 / 768 / 1280.

## P4 — Share WhatsApp (DAHULUKAN sebelum AI)
**Kenapa:** user pilih ini dulu. Live punya `settings.notifications.whatsappWebhookUrl` + `whatsappEnabled`.
**File saat ini:** `src/utils/sharing.js` (`shareProjectWhatsApp`), tombol di `ProjectDetail.jsx`.
**Tugas:**
- Refine format teks WA jadi profesional & rapi (header perusahaan, ringkas: nama proyek, mitra, nilai kontrak, terbayar, progres %, sisa, link publik proyek). Rapikan emoji/bullet, hindari terlalu panjang.
- **Auto kirim gambar/diagram analitik saat share:** generate kartu ringkasan proyek (PNG) via `html2canvas` dari elemen tersembunyi (atau chart) → sertakan. Untuk kirim otomatis (bukan hanya buka wa.me), integrasikan `whatsappWebhookUrl` dari settings (POST teks+gambar ke webhook). Bila webhook kosong → fallback `wa.me` share manual.
- Tambah konfig webhook WA di halaman Pengaturan (tab baru "Notifikasi") membaca/menulis `settings.notifications`.

## P5 — AI: multi-gambar + prompt efisien + fix "Gemini key tidak tersedia"
**AKAR MASALAH key:** function `functions/index.js` pakai `defineString("GEMINI_API_KEY")`
membaca `functions/.env.sistem-keuangan-ptpeb` (ada, 56 byte). "Tidak tersedia"
berarti **environment function ter-deploy tidak memuat key** saat runtime.
Catatan: `src/services/ai.js` `getFunctions()` TANPA region → default `us-central1`;
kalau function di-deploy region lain, panggilan gagal (cek region deploy).
**Tugas:**
- **Keamanan dulu:** revoke key lama (ter-commit di git) di Google AI Studio; set ulang via `firebase functions:secrets:set GEMINI_API_KEY`; ubah `defineString` → `defineSecret("GEMINI_API_KEY")` + daftarkan di opsi function; redeploy. (Auth-check `request.auth` sudah saya tambahkan tapi BELUM deploy.)
- Set region eksplisit di `getFunctions(app, '<region>')` sesuai deploy.
- **Multi-gambar:** ubah function agar terima `images: [{base64String, mimeType}]` (backward-compat dgn single), kirim semua sebagai beberapa `inlineData` dalam SATU request Gemini → hemat biaya (1 panggilan, prompt dipakai bersama), minta output array (1 transaksi per gambar).
- **Prompt efisien:** rapikan prompt panjang di `functions/index.js` (potong instruksi berulang, tetap akurat) untuk hemat token. Set `maxOutputTokens` wajar.
- **Client:** `services/ai.js` + `AITransactionModal.jsx` dukung multi-file upload + verifikasi banyak hasil sekaligus.

## P6 — Transaksi Manual: upload bukti gambar
**Kenapa:** input manual belum bisa lampirkan bukti; hanya jalur AI yang upload gambar.
**File:** `src/components/transactions/TransactionModal.jsx`, `services/transactions.js`, `services/ai.js` (`uploadTransactionImage` bisa dipakai ulang).
**Tugas:**
- Tambah field upload gambar (opsional) di TransactionModal; pakai `uploadTransactionImage(file, uid)` → simpan `imageUrl`/`imagePath` di transaksi.
- TransactionTable sudah menampilkan link "Lihat Bukti" bila `imageUrl` ada — otomatis jalan.

---

## Ditunda (permintaan user)
- **Faktur Pajak (CoreTax XML)** — kemudian. Riset format XML e-Faktur/CoreTax dulu.
- **Laporan** (pajak bulanan, tahunan: efisiensi/efektivitas/kebocoran dana/neraca) — nanti.
- **Reminder/status ke klien**, **Dashboard AI analytic**, **API docs**, **Database Harga/BOQ** — nanti.
- **Fase 2 multi-tenant** `orgs/{orgId}` (PT PEB jadi tenant pertama) — besar, terpisah.

## Keamanan yang masih menggantung (JANGAN lupa)
- **Deploy `firestore.rules`** yang sudah ditulis — TAPI user minta JANGAN sekarang (takut konflik app live). Uji dulu di staging/emulator.
- **CORS Storage** untuk kop surat: `gsutil cors set storage.cors.json gs://sistem-keuangan-ptpeb.firebasestorage.app` (lihat `docs/SETUP-storage-cors.md`).
- **Revoke GEMINI_API_KEY** ter-commit (lihat P5).
