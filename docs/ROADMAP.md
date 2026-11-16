# Kontrack — Status & Roadmap

Sumber tunggal status pekerjaan. **Perbarui setiap menyelesaikan sesuatu**, supaya
agen/sesi berikutnya tidak mengulang yang sudah selesai.

Diperbarui: 2026-11-15

### Batch audit keamanan (2026-11-15, unit 5)
Temuan & perbaikan lengkap: `docs/SECURITY-AUDIT.md`. Singkat: catch-all
firestore.rules dibuang (menutup tulis `users`/`ai_usage`/`audit_logs` dari
klien), header keamanan + CSP di `firebase.json`, validasi ukuran/tipe di
semua callable, SSRF di lampiran email ditutup, kuota harian baru
(email/asset/whatsapp). Semua BELUM di-deploy. Gagal build saat audit berasal
dari `AppLayout.jsx` (unit lain), bukan dari berkas unit keamanan.

Menggantikan `PLAN-next-session.md` dan bagian status di `roadmap-invoice-pajak.md`
(dua berkas itu sudah dihapus karena isinya mulai saling bertentangan).

---

## Sudah selesai

### Batch arsip & penagihan (2026-11-15)
- Drawer detail invoice: tanpa duplikasi (grand total hanya di kepala), layout
  dua kolom, terverifikasi nol scroll di 1440×900.
- Arsip berkas per invoice: BAHK, WPHO/BAST, Faktur Pajak (Storage:
  `doc-archives/invoices/{id}/`), field `documents.{kind}` di dokumen invoice.
- Form proyek: unggah SPK/Kontrak & PK (Storage: `doc-archives/projects/{id}/`),
  tautan arsip tampil di detail proyek. BAHK/WPHO per invoice otomatis jadi
  rekap arsip digital penagihan.
- Revisi invoice: tombol Revisi di drawer (status terkirim) → nomor ditandai
  `Rev.N` (`reviseInvoice`), status reset ke draft.
- Label Kirim: PDF label pengiriman (pengirim dari profil perusahaan, penerima
  dari data klien, UP kustom, via default Lion Parcel).
- Kirim Email penagihan: Cloud Function `sendInvoiceEmail` (nodemailer, Gmail
  SMTP) + modal compose di drawer. PR: pemilik harus menjalankan
  `firebase functions:secrets:set SMTP_USER / SMTP_PASS` (Gmail App Password)
  untuk mengaktifkan pengiriman — saat ini secret berisi placeholder.
- Form invoice: field No. BAHK terpisah, unggah berkas BAHK & WPHO terpisah;
  Franco disembunyikan; Shipped Via default Lion Parcel.
- Export CoreTax: TrxCode default 04 (DPP Nilai Lain); XML diverifikasi cocok
  faktur asli (TaxBase=subtotal, OtherTaxBase=11/12, VAT=12%).


### Batch b18d8ea (2026-11-15)
- Perbaikan `)}` bocor di daftar proyek (sisa ternary lama di ProjectList).
- Kartu grid proyek didesain ulang: datar satu tingkat, tanpa panel kotak-dalam-kotak.
- Baris tabel proyek sekarang klik-able penuh → membuka detail proyek.
- Drawer detail invoice: layout dua kolom di desktop agar muat satu viewport.
- Form invoice: tombol utama "Simpan Draft" (tidak lagi otomatis generate PDF);
  PDF tetap tersedia dari detail invoice.
- Cloud Function baru `scanWphoDocument` (asia-southeast2): scan dokumen WPHO/BAST
  (nomor BA, nilai, nama pekerjaan, tanggal, kontrak/PK) dan Faktur Pajak
  (nomor faktur). Tombol scan di form invoice mengisi field otomatis; item
  pekerjaan mengambil nilai WPHO (masih bisa diubah manual).
- Export CoreTax: opsi kode transaksi 04 (DPP Nilai Lain, PMK 131/2024).
- PDF laporan proyek: tabel baru "Rincian per Kategori" (porsi per kategori,
  tidak terpotong — tableWidth fix).
- Share WhatsApp: kini menyertakan rincian pengeluaran per kategori (5 teratas).
- Laporan: retensi kini menghormati field `retentionPct` bila ada.
- Semua angka laporan (piutang termin, retensi, uang masuk/keluar, laba, PPN
  atas kontrak) dihitung dari Firestore asli — tidak ada mock; PR: alur scan
  WPHO end-to-end dengan login pemilik belum diuji.


### Fondasi
- Migrasi CRA → Vite 5
- Design system: CSS variables, 5 preset tema, Space Grotesk + Inter, angka tabular
- **Material kaca dua mode (terang/gelap)**: token `--glass-*`, `--line-*`, dan skala
  `slate` yang di-remap ke variabel, sehingga ~350 pemakaian `slate`/`white` di
  seluruh komponen ikut menyesuaikan mode tanpa ditambal satu per satu. Tombol
  Terang/Gelap ada di header; pilihan disimpan per-perangkat (`utils/colorMode.js`),
  nilai awalnya mengikuti preferensi sistem. **Terpisah dari 5 preset brand** yang
  tetap diganti per-tenant dari Pengaturan — keduanya tidak saling menimpa.
- Tidak ada scrim putih di mode gelap: token `--scrim`/`scrim` khusus supaya modal,
  drawer, dan lightbox selalu memakai lapisan gelap.
- Shell baru: **header kaca dua tingkat** (baris utilitas + rail modul horizontal),
  rail sidebar vertikal dihapus sesuai spesifikasi. Drawer geser untuk ponsel,
  rail bawah dipertahankan.
- `.preview/` — harness Vite yang merender komponen asli dengan data contoh, tanpa
  kredensial. Alias me-remap SEMUA modul yang menarik Firebase (`projects`,
  `transactions`, `invoices`, `settings`, `auth`, `clients`, `users`, `ai`,
  `firebase`, `aiInsights`, `pdfGenerator`). Daftar ekspor shim dihasilkan dari
  impor nyata lewat `scripts/list-service-imports.mjs` — bukan ditebak; satu nama
  kurang saja membuat halaman tampil kosong tanpa pesan.
- App shell: sidebar bisa disembunyikan, navigasi bawah ala aplikasi native di mobile
- `scripts/check-imports.mjs` masuk ke `npm run build` — menangkap komponen JSX yang
  dipakai tapi belum di-impor (esbuild membiarkannya lolos, halamannya jadi putih)
- `ErrorBoundary`, skeleton shimmer
- **Kartu proyek didesain ulang**: panel angka jadi satu blok inset (Nilai Kontrak /
  Terbayar / progres / sisa tagihan), referensi SPK di kaki kartu, dan strip warna
  tebal di sisi kiri dihapus — status dibawa pil status + panel angka.
- `.preview/` — harness Vite untuk memeriksa tampilan halaman tanpa login: layanan
  Firestore diganti shim berisi data contoh lewat alias, jadi tidak butuh
  kredensial. Baru mencakup Laporan. `vite --config .preview/vite.config.mjs`

### Proyek, transaksi, klien
- Daftar & kartu proyek, modal tambah/ubah, halaman detail
- Transaksi manual + unggah bukti
- CRM klien/mitra — **invoice tidak bisa dibuat tanpa klien terpilih**
- Lightbox bukti transaksi: zoom, putar, navigasi antar-bukti, tanpa buka tab baru

### Invoice & pajak
- Generator PDF meniru template asli PT PEB
- Builder invoice, konfigurasi perusahaan/bank/direktur
- Saklar tampil/sembunyi + hapus untuk kop surat & tanda tangan
- Termin, retensi, DPP Nilai Lain — **terverifikasi sampai rupiah** terhadap faktur
  asli `04002600186547696`
- Alur dokumen pajak per invoice (faktur, billing, NTPN)
- Ekspor XML CoreTax
- Transaksi otomatis dibuat saat invoice lunas

### Laporan
- Ringkasan, Pajak Bulanan, Analisis Tahunan
- Grafik dipindah ke Dashboard; Dashboard fokus ke transaksi terbaru + daftar proyek
- Ekspor PDF transaksi: teks tidak lagi terpotong, header berulang, baris tidak
  terbelah antar-halaman, footer TOTAL
- **Ringkasan dipoles**: kartu dipisah jadi dua kelompok yang jujur — "Posisi
  Kontrak" (seluruh waktu) dan "Arus Kas" (mengikuti periode). Sebelumnya empat
  kartu mencampur angka sepanjang waktu dengan angka terfilter tanpa keterangan.
  Ditambah kartu Piutang Termin & Retensi Tertahan (dua penyebab utama jeda arus
  kas), preset periode (Semua/Bulan/Kuartal/Tahun), dan peringatan bila rentang
  tanggal terbalik — dulu rentang terbalik menghasilkan laporan kosong tanpa
  penjelasan.
- **Tanggal transaksi dinormalkan sekali** (`reportCalc.toDate`): data lama
  menyimpan Timestamp, bukan ISO string, dan `new Date(t.date)` membuat laporan
  kosong tanpa error. Pengelompokan bulan juga tidak lagi memakai `toISOString()`
  (UTC) — transaksi 1 Januari 00:30 WIB dulu jatuh ke Desember.
- **Pajak Bulanan dipoles**: grafik PPN terhutang vs disetor per bulan, kolom
  "Status Setor" berisi tenggat (akhir bulan berikutnya) beserta tanggalnya, dan
  empty state saat tahun belum punya catatan. Bulan tanpa aktivitas tidak diberi
  status "Lunas" — itu menyesatkan untuk bulan yang belum terjadi.
- Label tab dipendekkan di mobile dan tabel lebar diberi petunjuk geser: tab
  ketiga dulu terpotong di layar 390px.

### AI
- Ekstraksi transaksi dari bukti transfer, banyak gambar dalam satu panggilan
- Analisis keuangan di Dashboard & Laporan (pemicu manual, bukan otomatis)
- **Vertex AI sebagai jalur utama** — ditagih ke Cloud Billing proyek, tanpa API key
- Developer API + `GEMINI_API_KEY` sebagai cadangan
- Kuota harian per pengguna, ditegakkan di server
- Pemakaian token tercatat di log

### Infrastruktur
- Migrasi penuh ke asia-southeast2: 226 dokumen + 265 objek, terverifikasi
- Semua function us-central1 dihapus, termasuk artifact registry & bucket build-nya
- Kompresi WebP sebelum unggah; mode `preserveAlpha` untuk tanda tangan & kop surat
- App Check reCAPTCHA v3
- Cache-aside berlapis dengan batas waktu
- `firestore.indexes.json` ditulis dari database live, bukan lagi kosong: 1 indeks
  composite `transactions` (projectId ASC + date DESC + `__name__` DESC).
  Terverifikasi identik dengan keluaran `firebase firestore:indexes --database kontrack`
  dan lolos validator `firebase-tools`. Belum di-`firebase deploy` (menunggu izin
  pemilik) — selama isinya sama dengan server, deploy hanya melaporkan tidak ada
  perubahan.
  Satu-satunya kueri di kode yang **tidak** tercakup indeks: `getProjectsByStatus`
  (`status` == + `startDate` desc). Saat ini mati — `hooks/useProjects.js`, satu-satunya
  pemanggilnya, tidak diimpor komponen mana pun. Kalau hook itu dihidupkan lagi,
  indeksnya harus dibuat lebih dulu atau kueri akan gagal di runtime.

---

## Perlu tindakan pemilik

Agen tidak boleh mengerjakan ini. Lihat AGENTS.md §8.

- [ ] **Aktifkan Google Sign-In** — saat ini tidak ada provider IdP terdaftar,
      login Google menghasilkan `auth/operation-not-allowed`.
      Firebase Console → Authentication → Sign-in method → Google → Enable.
- [ ] Rotasi API key Gemini lama dan `settings.ai.apiKey` di Firestore (pernah
      terekspos di percakapan).

## Belum terverifikasi

- [ ] **Halaman dalam baru dipoles di lapisan material, belum didesain ulang
      menyeluruh.** Yang sudah ikut mode terang/gelap: Laporan, Dashboard, Invoice,
      Pengaturan (judul, kartu, tabel, input). Yang BELUM dikerjakan dari spesifikasi
      "Sovereign Enterprise": strip metrik 4 kolom menyatu (masih 4 kartu terpisah),
      panel sorotan 42/58, footer institusional, drawer glass sudah ada tapi belum
      ada focus trap, dan view Grid/Table di halaman Proyek.
- [ ] Dashboard & Laporan **dirender dengan data Firestore sungguhan**. Jalur data
      sudah diperiksa read-only langsung ke Firestore `kontrack` (REST, sesi CLI):
      261 transaksi, 21 invoice, 5 proyek, 2 klien, 3 pengguna. Temuan bentuk data:
      `transactions.date` seluruhnya string; `invoices.issueDate` dan `taxPaidAt`
      **campuran** Timestamp dan string (inilah alasan `toDate` dipusatkan);
      tidak ada `totals` maupun `taxPaymentAmount` di invoice; `projects` tidak
      punya `retentionPct`. Yang belum: render UI-nya sendiri, karena perlu login —
      agen tidak memasukkan password.
- [ ] **Lonceng notifikasi di header hanya penanda visual.** Tidak ada sumber
      notifikasi di dalam aplikasi; ikonnya sengaja diberi tanda titik emas supaya
      tidak terbaca sebagai fitur yang sudah jalan. Jangan diklaim berfungsi
      sebelum ada pengirimnya.
- [ ] Kuota AI harian saat benar-benar tercapai.

---

## Berikutnya

### Prioritas 1 — menutup lubang yang sudah diketahui

1. **Kartu proyek** — pemilik masih belum puas. Referensi: Pinterest/Dribbble.
   Konsepnya *detailed, solution, tidak ribet*.

### Prioritas 2 — fitur yang sudah dijanjikan

3. **Lanjutkan spesifikasi Sovereign Enterprise** yang belum dikerjakan:
   strip metrik 4 kolom menyatu dengan pembatas hairline, panel sorotan 42/58 di
   Dashboard, footer institusional, focus trap pada drawer, dan sakelar
   Grid/Table di halaman Proyek.
4. **Portofolio publik** — halaman profil kontraktor yang bisa dibagikan.
   Butuh share-token; jangan pakai `allow read: if true` seperti `projects` sekarang.
5. **BOQ & database harga** — 14 berkas RAB/BOQ ada di `~/Downloads`.
   `parseBoqWithAI` tersimpan di `functions-live/`, belum di-deploy karena belum
   ada yang memanggil. Deploy bersamaan dengan fiturnya, bukan sebelumnya.
6. **Webhook WhatsApp** — teks share sudah rapi; sisanya kirim gambar/diagram
   otomatis + `settings.notifications.whatsappWebhookUrl`.

### Prioritas 3 — utang arsitektur

7. **Multi-tenant penuh.** `firestore.rules` masih punya catch-all "semua pengguna
   login dianggap tim internal". Akarnya: koleksi `users` memakai ID acak dengan
   field `email`, sehingga rules tidak bisa mengecek peran.
   Urutan yang benar: pindahkan `users` ke `users/{uid}` → pasang custom claims →
   baru hapus catch-all.
8. **`projects` masih public-read** demi share-link mitra. Ganti dengan share-token.
9. **Pisahkan `functions/index.js`** kalau sudah melewati ~800 baris.

---

## Keputusan yang sudah final — jangan dibuka lagi

| Keputusan | Alasan |
|---|---|
| Semua sumber daya di asia-southeast2 | Pengguna di Indonesia; us-central1 menambah ±200ms |
| Vertex AI jalur utama, API key cadangan | Kredit prabayar AI Studio pernah habis dan mematikan fitur AI total |
| `authDomain` = domain default Firebase | Selain itu, login Google gagal `redirect_uri_mismatch` |
| Long-polling Firestore dipaksa | Safari menolak transport streaming |
| Kuota AI ditegakkan di server | Penegakan di klien bisa dilewati dengan memanggil callable langsung |
| Hanya `kontrack.web.app` yang dipakai | Domain lain akan dibuang pemilik |
## Batch 32ccfec (2026-11-15) — UX ERP batch besar

Selesai:
- Drawer detail invoice 2 tab (Detail | Arsip Berkas): urutan judul → nomor referensi full (grid 3 kolom, termasuk No. SPK) → rincian pekerjaan full → pembayaran & dokumen pajak 2 kolom. Grand total hanya sekali di kepala.
- Panel pejal: kelas `panel-solid` untuk modal/drawer, popover tidak transparan; header navbar pejal saat scroll, tinggi 52px, underline aktif dirapikan, search bar h-8.
- Menu "Faktur Pajak" → "Pajak" (nav + judul halaman).
- FIX export CoreTax: `coretaxXml.js` kini membaca `invoiceItems` + `subtotal`/`grandTotal` (bukan `items`/`totals`); validasi jadi peringatan tidak memblokir unduh. Diverifikasi di preview: XML terunduh, DPP=11/12×subtotal & PPN=12%×DPP cocok.
- Form proyek: No. SPK/Kontrak dan No. PK terpisah + upload masing-masing; form invoice otomatis terisi dari proyek (`spkNumber`/`pkNumber`).
- Detail proyek: rekap transaksi per kategori (pemasukan/pengeluaran), cari + urut (tanggal/nominal/kategori), kartu info/nilai/progress didesain ulang, arsip berkas proyek+invoice, reminder retensi 3 bulan sejak BA terakhir.
- Daftar invoice: sortir nominal/nomor/proyek/status.
- Invoice: urut naik/turun memakai waktu (Timestamp/string); adapter baca-only menormalkan alias legacy tanpa menulis Firestore; ekspor CoreTax single/massal memakai satuan sesuai jenis dan memblokir data wajib yang kosong.
- TaxDocsModal: tombol Scan faktur pajak (AI isi nomor+tanggal, berkas ke arsip).
- Dashboard: grafik arus kas garis (toggle garis/batang), analisis AI berdampingan grafik + riwayat analisis tersimpan (localStorage `kontrack-ai-insight-history`).
- Login: daftar akun baru email/password (`signUpUser`, role staff) + link ke landing page `/welcome`.

Belum terverifikasi (butuh owner):
- Google Sign-In masih `auth/operation-not-allowed` — aktifkan provider Google di Firebase Console.
- Email penagihan nyata menunggu secret SMTP asli.
- Scan faktur/WPHO end-to-end dengan Gemini sungguhan; data Firestore asli.


## Batch landing/routing/migrasi (2026-11-15, lanjutan 32ccfec)

Selesai dan terverifikasi di live `kontrack.web.app`:
- **Routing**: `/` = landing publik (juga saat login), aplikasi di `/app/*`, `/login` tetap. `App.jsx`, `ProtectedRoute`, sidebar, kartu/tabel proyek, dan tautan berbagi sudah memakai `/app`. URL lama (`/projects|reports|invoices|tax-invoices|clients|settings`) dialihkan utuh (query+hash) ke `/app/...`; dibuktikan `/projects?x=1` → `/login`. Halaman publik `/privacy`, `/terms`, `/support` merespons 200.
- **Landing v2**: layout korporat dua kolom, mode terang/gelap sendiri (`kontrack-public-mode`, diisolasi lewat `public.css` + `data-public-mode` agar remap slate aplikasi tidak menghapus teks), contoh antarmuka berlabel SIMULASI, konten masalah→solusi (jeda kas, arsip penagihan, retensi/pajak). Tanpa emoji dan tanpa gradasi.
- **Login**: latar/panel/input pejal, mesh gradient dihapus, kontras teks dan tautan diperbaiki, tautan jelas ke `/` dan halaman legal.
- **Detail proyek React #310**: seluruh hook dipindah ke atas early return; dibuktikan di harness `.preview` dengan rute `/projects/:id` (halaman ter-render penuh, tanpa error).
- **Header**: `sticky` tanpa padding atas (celah tembus hilang); terukur `top:0`, lebar penuh, `overflow-x: 0` pada 390px.
- **Transisi**: `page-in` per rute (`main` ber-key `pathname`), kurva `cubic-bezier(0.22,1,0.36,1)`, dan `prefers-reduced-motion`.
- **Cache**: uji Node membuktikan dedup in-flight, hit TTL, `invalidate`/`primeCache` menang atas query lama yang telat selesai, dan pemulihan error sinkron.
- **Migrasi Firestore (SUDAH DIJALANKAN)**: `scripts/audit-firestore-data.mjs` + `scripts/migrate-invoice-items.mjs`. Cadangan mentah 323 dokumen di `~/Kontrack-backup/audit-20261115/`. Ditambahkan `invoiceItems` dan `subtotal` untuk 21 invoice lama (sebelumnya 11 tanpa item sehingga ekspor CoreTax menganggap "tanpa item/nilai"). Hanya penambahan field, memakai precondition `updateTime`. Verifikasi: 323 → 323 dokumen, ID identik, 0 field lama hilang/berubah, 0 nilai finansial berubah, jumlah grandTotal Rp1.831.726.560,64 identik, 21/21 invoice kini punya item + subtotal. Satu catatan: `INV-003/PEB/10/2025` DPP historisnya selisih 4 rupiah dari rumus 11/12 (nilai dokumen dipertahankan).

Belum terverifikasi (butuh owner):
- Impor XML CoreTax ke portal DJP (kode satuan jasa `UM.0030` belum diuji di sistem DJP).
- Tampilan data asli di balik login: preview memakai mock.
- 5 proyek tanpa `pkNumber` dan 2 proyek tanpa nomor kontrak — sengaja tidak diisi otomatis karena butuh data pemilik.

## Unit 4 batch (2026-11-15) — klien & grafik

Selesai:
- `ClientsPage`: daftar jadi tabel ERP (Klien + jumlah proyek/invoice, NPWP salin, kota, nilai kontrak, sisa tagihan) dan klik baris membuka drawer `Modal drawer` berisi ringkasan keuangan (kontrak, invoice, terbayar, sisa), identitas + NPWP, kontak/narahubung, daftar proyek bertaut ke `/app/projects/:id`, daftar invoice, catatan. Join proyek lewat id atau nama `partner` (data lama), invoice lewat `clientId` atau nama — dua bentuk data tetap terhubung tanpa migrasi.
- Tabel `min-w-[560px]` dalam wrapper `overflow-x-auto`; kolom NPWP/kota disembunyikan di layar sempit. Drawer 390px: ringkasan 1 kolom, nama proyek membungkus (tidak `truncate`), tanpa overflow horizontal.
- `CashflowChart` + `ReportCharts`: sumbu Y ringkas `Rp… rb/jt/M`, grid halus (`drawTicks:false`), tooltip rupiah penuh, legenda `usePointStyle` berwarna mode, warna solid dari token CSS (`--emerald-500`, `--red-500`, `--brand-500`), `fill:false` (gradasi dihapus), label mengikuti `data-theme` lewat MutationObserver (gelap memakai slate-600 agar 11px tetap terbaca), donut border = warna permukaan kartu, sumbu X bar dipotong pada 14 karakter.

Belum terverifikasi:
- Data Firestore asli: harness `.preview` memakai mock; relasi `project.partner`/`invoice.clientId` di produksi belum dihitung terhadap dokumen nyata.
- Tooltip diverifikasi lewat callback (format dicetak), bukan hover mouse langsung (daemon CDP tidak stabil saat dispatch mouse).

## Batch besar UI/UX & ERP (2026-11-15, lanjutan `d2bf146`)

Selesai dan sudah di-deploy (`index-BTtq8u2M.js`, functions 10 buah):

- **Modal tertutup header (akar, bukan tambalan)**: `<main className="page-enter">` memakai `transform`, sehingga membentuk stacking context dan mengurung `position: fixed` di bawah header `z-40`. `src/components/ui/Modal.jsx` sekarang merender lewat `createPortal(content, document.body)` dengan `z-[100]`. Terukur di harness: modal proyek, pratinjau PDF, dan detail klien semuanya `elementFromPoint` mengembalikan elemen dialog (`z:100`, `parent: DIV`).
- **Transisi halaman benar-benar jalan**: keyframes `page-in` dideklarasikan di `globals.css`, bukan hanya di `tailwind.config.js`. Tailwind hanya memancarkan keyframes sebuah animasi bila kelas utilitasnya (`animate-page-in`) dipakai; karena `.page-enter` CSS biasa, animasi dulu mati total. Dibuktikan: `animationName: page-in`, `0.34s`, keyframes ada di `document.styleSheets`.
- **Navbar tidak bisa di-scroll**: rail modul memakai `overflow-hidden` (bukan `overflow-x-auto`). Terukur di 1280px: `scrollWidth 1231 === clientWidth 1231`.
- **Pengaturan dipecah 6 tab**: Perusahaan, Dokumen & Data (penomoran, retensi arsip, kesehatan data baca-saja), Pajak (TrxCode/Opt/satuan/objek pajak + simulasi DPP 11/12 & PPN), Tema, Notifikasi, Pengguna.
- **Notifikasi jadi alat kerja**: `layout/NotificationCenter.jsx` berisi ringkasan belum dibaca, prioritas per urgensi (tagihan lama menunggu, PPN belum disetor, tenggat SPT Masa), filter belum-dibaca persisten, aksi cepat "Email pengingat"/"WhatsApp"/"Buka" per tagihan, dan "Ingatkan semua". Hasil kirim dilaporkan apa adanya (bukan diklaim terkirim).
- **Akun ganda undangan pengguna (akar)**: `addUserToCompany` lama hanya menulis dokumen `users` tanpa akun Auth, sehingga orang yang diundang mendaftar sendiri dan mendapat dokumen kedua. Sekarang function membuat akun Auth (tanpa password), **memakai ulang** dokumen beremail sama, idempoten, dan mengembalikan `{reused, accountCreated, emailSent, emailError}`. Sisi klien (`services/auth.js`) menambahkan `claimInvitedUserDoc` untuk pendaftaran email/Google agar dokumen undangan diklaim, bukan diduplikasi. `UsersTab` menandai "Belum masuk" dan memperingatkan email yang punya lebih dari satu dokumen.
- **WhatsApp server-side**: `sendWhatsApp` mendukung gateway tidak resmi (`WA_GATEWAY_URL`, mis. whatsapp-web.js/Baileys di VPS milik pemilik) atau Cloud API resmi (`WA_TOKEN` + `WA_PHONE_ID`), dibatasi kuota harian, nomor normalisasi `62…`, wajib https. Nomor pengirim adalah nomor resmi Kontrack, bukan nomor pribadi pengguna.
- **Email templat**: undangan & pemberitahuan memakai `emailLayout` (tabel + gaya inline, tanpa emoji/gradasi) menggantikan teks polos `white-space: pre-wrap`. Function baru `notifyUsers` (maks 25 penerima, validasi email, isi pesan disusun server) dan `notifyChannels` (melaporkan kanal siap tanpa membocorkan secret).
- **PDF invoice**: elemen yang tidak relevan untuk penagihan (kode billing, NTPN, status CoreTax, nomor faktur pajak) dihapus; `generateInvoicePDF({download:false})` mengembalikan blob, dan `ui/PdfPreview.jsx` menampilkan pratinjau lewat `URL.createObjectURL` dengan tombol Unduh terpisah serta `revokeObjectURL` saat ditutup.

Verifikasi nyata: `npm run check` bersih, `npm run build` hijau (2015 modul), harness 390px `scrollWidth === innerWidth` (overflow 0), dan live `kontrack.web.app` menyajikan `/`, `/login`, `/terms`, `/privacy`, `/support` HTTP 200.

Temuan keamanan dari audit (detail: `docs/SECURITY-AUDIT.md`), **belum diterapkan**:
- Catch-all `match /{document=**} { allow read, write: if signedIn() }` membuat blok `allow write: if false` untuk `users`/`ai_usage` tidak berarti, karena rules dievaluasi OR. Deploy `firestore.rules`/`storage.rules` hasil audit **belum** dilakukan pada batch ini; menunggu keputusan pemilik karena berisiko mematikan fitur jika aturan belum lengkap.
- `projects` masih publik penuh; peran pengguna belum memakai custom claims; belum ada App Check dan WAF/Cloud Armor.

Belum terverifikasi (butuh pemilik):
- Email undangan/pengingat nyata: `SMTP_USER`/`SMTP_PASS` masih placeholder `BELUM-DISET`.
- WhatsApp nyata: secret `WA_GATEWAY_URL`/`WA_TOKEN`/`WA_PHONE_ID` dibuat dengan placeholder `BELUM-DISET`; status di Pengaturan akan menunjukkan "Belum disetel" sampai diisi.
- Pratinjau PDF diuji dengan blob mock di harness; PDF asli (jsPDF + kop surat) belum dibuka di perangkat pemilik.
- Tampilan halaman di balik login dengan data Firestore asli.

## Saran fitur kontraktor berikutnya (belum dikerjakan)

Diurutkan menurut dampak pada masalah utama kontraktor (jeda arus kas):

1. **Rencana vs realisasi biaya per proyek (RAB)**: anggaran per kategori pekerjaan, persen serap, dan peringatan ketika realisasi melampaui RAB. Saat ini "efisiensi" dihitung dari rasio beban terhadap pendapatan, bukan terhadap anggaran.
2. **Termin & kurva-S terjadwal**: rencana termin per tanggal, proyeksi kas masuk (bukan hanya kas tercatat), dan selisih terhadap realisasi pencairan.
3. **Retensi otomatis**: pengingat penagihan retensi berbasis tanggal BA terakhir + masa retensi, dengan daftar retensi jatuh tempo lintas proyek.
4. **Bukti potong PPh mitra**: unggah bukti potong, rekonsiliasi terhadap invoice, dan rekap PPh dipotong per lawan transaksi (melengkapi keputusan "PPN yang utama, PPh hanya info").
5. **Subkontraktor & mandor**: pembayaran ke pihak ketiga per proyek, utang berjalan, dan serapan biaya lapangan.
6. **Perencanaan material & stok proyek**: permintaan, penerimaan, sisa material per lokasi.
7. **Laporan progres harian/mingguan dengan foto bergeotag** dan rekap otomatis ke laporan progres proyek.
8. **Jadwal penagihan otomatis** (reminder H-7/H-1/H+3) yang terhubung ke kanal email/WhatsApp yang sudah ada.
9. **Rekonsiliasi bank**: impor mutasi rekening dan pencocokan otomatis ke invoice/transaksi.
10. **Dasbor pemilik**: kas masuk 30/60/90 hari ke depan, proyek dengan margin terancam, dan umur piutang.

## 2026-11-15 — Keamanan diterapkan ke produksi

Rules hasil audit sempat di-`git checkout` sebelum build hosting (untuk menjaga
perilaku produksi), lalu diterapkan ulang dengan sengaja setelah jalur tulis klien
disesuaikan. Yang berubah:

- `firestore.rules`: catch-all `if signedIn()` dihapus. Sembilan koleksi
  didaftarkan eksplisit (`transactions`, `invoices`, `clients`, `projects`,
  `users`, `ai_usage`, `audit_logs`, `settings`), sisanya `if false`.
  `users` hanya boleh dibuat pemilik email sendiri dengan `role == 'staff'`,
  dan `role` tidak bisa diubah dari klien.
- `storage.rules`: path `doc-archives/{invoices|projects}/{id}/{file}` diterima
  (sebelumnya arsip SPK/PK/WPHO selalu gagal unggah).
- `functions/index.js`: `removeUserAccess` baru (12 function total).
- `src/services/users.js`: `removeUser` dan `changeUserRole` hanya lewat Cloud
  Function, tanpa fallback tulis langsung.
- `src/components/settings/UsersTab.jsx`: `removeUser(id, email)`.

Diverifikasi di produksi: header keamanan + CSP aktif (`curl -I`), rules menolak
semua baca/tulis anonim ke koleksi peka (403), `projects`/`settings` tetap terbaca,
tidak ada dokumen uji tertinggal. Build live `index-BwasRS8X.js`.

Belum terverifikasi: perilaku aplikasi setelah LOGIN di balik rules baru (perlu
akun pemilik), unggah arsip nyata ke Storage, dan impor CoreTax.

## 2026-11-15 — Akurasi laporan PPN diperbaiki (akar, bukan tampilan)

Tiga cacat di `utils/reportCalc.js` membuat laporan pajak tidak pernah bisa
dipercaya, walau tabelnya rapi:

1. **Setoran dihitung walau belum dibayar.** `ppnDisetor` jatuh ke
   `inv.pajak11` bila `taxPaymentAmount` kosong, tanpa memeriksa apakah ada
   bukti setor. Akibatnya setiap masa berstatus "Lunas" dan tunggakan tidak
   pernah muncul. Sekarang hanya dihitung bila `taxPaidAt` **atau**
   `taxPaymentProofUrl` terisi.
2. **Setoran diatribusikan ke bulan bayar, bukan masa pajak.** Faktur Maret
   disetor April membuat April "Lebih setor" dan Maret "Lewat tenggat"
   sekaligus. Sekarang urutan sumber masa: `taxPeriod` eksplisit →
   `issueDate` → `taxPaidAt` (dokumen lama).
3. **Notifikasi tenggat PPN di navbar tidak pernah muncul** karena sebab (1):
   `selisih > 0` tidak pernah benar. Sekarang muncul saat memang ada tunggakan.

Diverifikasi lewat `monthlyTaxReport` langsung (bukan hanya tampilan): 12 bulan,
bulan nihil, Timestamp/string campur, invoice `void` diabaikan, bukti setor tanpa
tanggal, dan setoran lintas bulan. Tampilan Laporan → Pajak Bulanan dan dasbor
Pajak diperiksa ulang; 390px tanpa overflow. `npm run check` + `npm run build` hijau.

Catatan data: invoice lama tidak menyimpan `taxPeriod`, jadi masa pajak
diturunkan dari `issueDate`. Kalau suatu saat faktur dibuat untuk masa sebelumnya,
isi `taxPeriod` agar tidak salah masa.

## 2026-11-15 — Form proyek berbagian & pratinjau PDF invoice

Diverifikasi sendiri (laporan subagent terpotong, tidak dipercaya begitu saja):

- `ProjectModal.jsx`: 8 bagian (Ringkasan Nilai, Identitas, Kontrak & Mitra,
  Nilai & Pajak, Jadwal, Termin & Retensi, Berkas, Catatan). Diuji di harness:
  isi nilai Rp1.100.000.000 → DPP 11/12 Rp1.008.333.333, PPN 11%
  Rp110.916.667, total Rp1.210.916.667, retensi 5% Rp55.000.000. Validasi
  tanggal menolak simpan dengan pesan spesifik. Dialog `z:100`, portal ke body,
  mulai y=17 di atas header (111), 390px tanpa overflow.
- `PdfPreview.jsx`: tombol "Lihat PDF" membuka pratinjau `blob:` + Unduh terpisah.

Perbaikan tambahan hasil pengujian:

- **`utils/invoiceGenerator.js` tidak lagi mengimpor Firebase.** Panggilan
  `getStorageAssetDataUrl` dipindah ke `services/assets.js` dan disuntikkan
  sebagai opsi (`resolveAssetDataUrl`). Modul `utils/` harus murni, dan ini juga
  membuat generator bisa dijalankan di Node untuk diuji.
- **"Kepada Yth. -"**: `normalizeInvoice` membuang `billTo` kiriman pemanggil dan
  hanya membaca `client`/`clientName`. Sekarang `billTo` diutamakan. Ditemukan
  karena PDF dijalankan sungguhan dan teksnya dibaca dengan `pdftotext`.
- **Harness tidak lagi memalsukan generator PDF.** Shim mengembalikan Blob 21
  byte, sehingga pratinjau tampak "berhasil" tanpa PDF nyata. Pola
  `utils/invoiceGenerator` dikeluarkan dari daftar TAILS; shim hanya menyediakan
  `fetchAssetDataUrl` yang melempar (gambar kop dilewati, PDF tetap tergenerate).

Bukti nyata: PDF 10.934-13.883 byte, `%PDF-1.3/1.4`, isi lengkap (kop, klien,
SPK/PK/WPHO, item, DPP/PPN/Grand Total/Netto, rekening, tanda tangan) dan TIDAK
memuat NTPN, kode billing, CoreTax, maupun nomor faktur pajak. Di browser:
generate 153ms, blob bisa di-fetch utuh. Build live `index-D5xZjxjh.js`.

Catatan harness: merender iframe PDF membuat tab headless macet (`Runtime.evaluate`
timeout). Itu artefak viewer headless, bukan bug aplikasi — diuji dengan generator
dipanggil langsung, tanpa iframe.

## 2026-11-15 — Klien & mitra + grafik (diverifikasi sendiri)

Unit 4 sudah ter-commit di `9a15ea9`; diverifikasi ulang dengan menjalankan
aplikasinya, bukan membaca laporannya.

- Tabel klien: agregat benar (Dinas PUPR Katingan: 3 proyek Rp7.770.000.000,
  3 invoice Rp2.494.774.772, terbayar Rp2.202.162.160, sisa Rp292.612.612).
- Drawer detail: `z:100`, portal, tautan proyek `/app/projects/p1|p3|p5`.
- Grafik: label sumbu ringkas (`Rp800 jt`, `Rp1,5 M`) diuji di Node; legenda
  satu baris, tanpa overflow di 390px; mode terang & gelap diperiksa dengan
  screenshot (label, bulan, legenda terbaca di keduanya).

Perbaikan dari pengujian:

- **Alamat dobel**: `address` di data asli sering SUDAH memuat kota/provinsi
  ("... Kabupaten Kotawaringin Timur, Kalimantan Tengah 74312") sementara
  `city`/`province` terisi terpisah, sehingga tercetak "Kasongan, Kasongan,
  Kalimantan Tengah, Kalimantan Tengah". Ditambah `formatAddress` yang tidak
  mengulang bagian yang sudah ada di address; diuji terhadap 5 bentuk data asli.
- **Tanda minus sumbu grafik**: `Rp-2,5 M` diperbaiki jadi `-Rp2,5 M`
  (`CashflowChart.jsx` dan `ReportCharts.jsx`).

## 2026-11-16 — Kategori seragam, invoice dua kolom, konsol developer

**1. Kategori transaksi: satu sumber, data produksi dinormalkan**

Tiga angkatan penamaan untuk hal yang sama ditemukan di data produksi (261
transaksi): `Pembayaran`/`Pembayaran Invoice` untuk uang masuk invoice, dan
`Pengeluaran Lain`/`Pajak` untuk PPN invoice.

- `src/utils/transactionMeta.js` jadi satu-satunya sumber kanon: daftar
  kategori, `canonicalCategory()`, `AUTO_CATEGORY`, dan `TX_SOURCE`.
  `utils/constants.js` hanya me-re-export (tidak ada salinan kedua).
- `markInvoicePaid` menulis `Pembayaran Invoice` + `Pajak` dan menyertakan
  `source` (`invoice`, `invoice-ppn`) supaya asal transaksi tidak perlu ditebak
  dari teks deskripsi.
- Semua jalur baca `services/transactions.js` melewati `withCanonicalCategory`,
  sehingga data lama tampil benar walau belum dimigrasi.
- `scripts/normalize-transaction-categories.mjs`: dry-run 17/261 dokumen,
  `--apply` 17 diubah 0 gagal, dijalankan ulang 0 (idempoten). Jumlah dokumen
  tetap 261. Cadangan: `~/Kontrack-backup/tx-normalize-*/plan.json`.

**2. Detail invoice: panel penuh dua kolom**

Tab `Detail | Arsip Berkas` dihapus supaya isi tidak saling menyembunyikan.
`Modal` mendapat `drawerWidth="full"` (lebar layar, tinggi penuh). Kolom kiri:
identitas, nomor referensi, rincian pekerjaan, dokumen pajak. Kolom kanan:
Grand Total, pembayaran, status penagihan, arsip berkas.

Diukur: 1440px → kolom 821/529px, tinggi 447/523px, tanpa scroll; 390px → satu
kolom, `overflowX` false, tanpa teks terpotong.

**3. Setelan teknis dipindah ke `/app/developer`**

Tab "Dokumen & Data" dan "Notifikasi" (isi: nama secret `SMTP_USER`/`SMTP_PASS`,
`WA_GATEWAY_URL`/`WA_TOKEN`, kesehatan Firestore) tidak boleh terlihat klien.
Dipindah ke `components/developer/DeveloperPage.jsx`, dijaga
`utils/access.js` (`superadmin` saja; `admin` klien TIDAK termasuk). Pengaturan
klien kini: Perusahaan, Pajak, Tema, Notifikasi (preferensi saja), Pengguna.
Diverifikasi: halaman klien nol penyebutan SMTP/Firestore/WA_TOKEN.

**4. CSP: callable AI tidak lagi diblokir**

`connect-src` di `firebase.json` tidak memuat `*.cloudfunctions.net`, sehingga
setiap panggilan Cloud Function dari browser ditolak. Bukan karena anonymous
auth dimatikan: endpoint menjawab `UNAUTHENTICATED` dengan pesan benar saat
diuji langsung lewat curl, dan preflight `OPTIONS` 204. Sudah ditambahkan dan
diverifikasi pada header hosting live.

**Belum terverifikasi:** login sebagai superadmin sungguhan (gating peran diuji
lewat fungsi + harness, bukan sesi nyata), dan pemakaian konsol developer di
produksi.

## 2026-11-16 — Analisis AI, penampil berkas, bagikan proyek, perencanaan proyek

### Analisis AI
- `RESPONSE_SCHEMA` Fungsi AI: `category` kini **enum** 8 nilai (bukan string
  bebas) + field `time` dan `vendor`. Model tidak bisa lagi mengarang kategori;
  "bon" upah dipetakan ke `Upah Karyawan/Tukang` oleh enum, bukan tebakan prompt.
- `src/utils/txDateTime.js` — parser tanggal/jam Indonesia (`1 Mei 2026`,
  `15 Agustus 2026 09:15`, `5 Agt 2026`, `2026-11-12T15:30`). Tanggal tak terbaca
  tidak lagi diam-diam diganti "sekarang".
- `AITransactionCard.jsx` dirombak: bukti di kiri, tiga blok berbingkai seragam
  (Nilai & Klasifikasi / Waktu Transaksi / Pihak & Deskripsi), badge
  "tanpa tanggal" pada kartu yang memang tanpa tanggal.

### Berkas gambar & PDF
- Akar "content blocked": `frame-src` CSP tanpa `blob:`, dan Storage mengirim
  `Content-Disposition: attachment` sehingga PDF langsung terunduh.
- `src/components/ui/FileViewer.jsx` — gambar & PDF dibuka in-app lewat object
  URL, tombol Unduh terpisah. Dipakai detail proyek dan detail invoice.

### Bagikan proyek ke WhatsApp
- `ShareProjectModal.jsx` — modal pratinjau (gambar + teks) dengan empat aksi
  eksplisit: Bagikan, Unduh gambar, Buka WhatsApp, Salin teks. Menggantikan
  perilaku lama yang mengunduh diam-diam lalu membuka tab WhatsApp.
- `utils/sharing.js`: PPN lewat DPP Nilai Lain (PMK 131/2024) ditulis eksplisit,
  seluruh emoji dihapus.

### Detail proyek
- `TransactionFilterBar.jsx`: grid 12 kolom, tiga kontrol 43px sejajar, ikon
  pencarian, hitungan hasil lebih kontras, tombol reset filter.
- `ProjectPlanningPanel.jsx` + `src/utils/projectPlanning.js` (murni, teruji di
  Node): RAB vs realisasi, termin & kurva-S, retensi, margin. Form proyek kini
  punya pengisian RAB dan tanggal BA terakhir.
- Kategori **tanpa anggaran** tidak lagi dihitung "melampaui anggaran" (dulu
  memicu peringatan palsu); dilaporkan terpisah sebagai pengeluaran tanpa
  anggaran. Termin selalu berstatus: cair / telat N hari / N hari lagi.

### Bug lama yang ketemu saat verifikasi
- `AITransactionModal.jsx` tidak bisa dikompilasi (penutup `</div>` yatim) —
  membuat seluruh harness kosong tanpa pesan. Seluruh 100+ berkas kini lolos
  parse esbuild.
- Shim harness: `analyzeTransactionImages` mengembalikan `{transactions}` padahal
  kontraknya array (`raw.map is not a function`).
- `retentionStatus` membaca `retentionPercent` padahal form menulis
  `retentionPct` → retensi selalu "tidak menahan".
- Pencairan termin memakai `netProceeds` (dana bersih) sehingga tampak melebihi
  nilai termin; kini memakai `grandTotal`.

### Belum terverifikasi
- Hasil AI dari Gemini sungguhan (butuh login pemilik), termasuk pemetaan nota
  "bon" ke `Upah Karyawan/Tukang`.
- `FileViewer` untuk PDF dari Storage produksi (butuh login).
- Pengiriman WhatsApp/email nyata — secret masih placeholder `BELUM-DISET`.

## 2026-11-16 — Analisis AI diserahkan penuh ke LLM, retensi per unit, ringkasan pilihan

### Analisis dokumen (prompt + server)
- Prompt ditulis ulang: model mengenali JENIS dokumen dulu (nota, bukti transfer,
  struk EDC/QRIS, faktur, surat jalan, invoice), baru menyimpulkan. Menutup kasus
  "bon gendro terbaca Pengeluaran Lain".
- Penalaran AKTIF (`thinkingBudget: 512`, dulu 0) + `temperature` 0.1. Field
  `reasoning` diminta lebih dulu lewat `propertyOrdering`, jadi model menimbang
  bukti sebelum memutuskan.
- `maxOutputTokens` 512 → 1024 per gambar: cukup untuk penalaran tanpa memotong JSON.
- `callGemini` menggabungkan SEMUA part teks (dulu hanya `parts[0]`, bisa memotong
  JSON di tengah) dan meneruskan `finishReason` ke log.
- Pengaman server baru: `extractJson` (memulihkan JSON dari pagar markdown atau
  kalimat pengantar), `toAmount` (nominal "Rp1.350.000", "1,5 jt", "450rb"),
  `sanitizeTx` (kategori di luar enum → Pengeluaran Lain, tanggal/jam tidak sah
  dikosongkan, bukan dikarang). JSON yang tak dapat dipulihkan → error jelas,
  bukan hasil palsu.

### Tanggal & jam
- `txDateTime.js` diurutkan ulang: pola Indonesia diurai SEBELUM `new Date()`.
  Dua bug nyata ditutup: "12-11-2026" dulu terbaca 11 Desember; nama bulan
  ("1 Mei 2026") menghasilkan jam 00:00 palsu yang menimpa jam dari AI.
- Dukungan baru: "12 NOV 2026", "KASONGAN 12 NOV 2026", "NOV 12, 2026",
  "1530" (jam tanpa titik dua), tahun 2 angka, validasi tanggal mustahil.

### Retensi per unit (BAHK per unit)
- `unitRetention`, `unitRetentionSummary`, `unitProgress` di `projectPlanning.js`.
  Retensi = persen × nilai UNIT, jatuh tempo +3 bulan setelah BAHK unit itu.
  Unit selesai tanpa BAHK berstatus `tanpa-bahk` (retensi sudah ditahan, tanggal
  belum pasti), bukan dianggap cair.
- `ProjectUnitsPanel` (tabel + kartu) di detail proyek, `UnitsEditor` di form
  proyek dengan "Tambah Unit" dan "Salin 4 baris" untuk 17 unit IPAL.
- Dua bug diperbaiki lewat uji: `nextDue` menyaring unit yang belum jatuh tempo;
  pembagi progres berbobot salah (~1/17 dari nilai sebenarnya).

### Ringkasan pilihan
- `buildInvoicesSummaryMessage` / `buildProjectsSummaryMessage` (kelompok per
  status, total/terbayar/sisa, tanpa emoji, tanpa data internal).
- Mode pilih di halaman Proyek (tabel DAN grid) dan Invoice; modal pratinjau
  dengan teks yang bisa disunting sebelum dikirim ke WhatsApp.

### Full layar & dark mode
- `Modal` varian `size="screen"`: form proyek, invoice, transaksi AI, dan detail
  klien kini memakai seluruh layar.
- `applyTheme(name, resolveMode())`: ganti tema tidak lagi menghapus mode gelap.
- Override `dark:text-slate-100..300` dihapus (token itu PERMUKAAN di dark).
  Kontras terukur turun dari 10 kegagalan WCAG menjadi 0.

### Deploy
- Hosting + functions di-deploy. Live `index-FvybG11y.js`, identik dengan build lokal.

### Belum diverifikasi (butuh pemilik)
- Hasil Gemini SUNGGUHAN untuk nota/bukti transfer baru (butuh login).
- Akurasi tanggal pada foto nota buram.
- Kirim WhatsApp/email nyata: secret masih `BELUM-DISET`.

## 2026-11-16 — Perbaikan unggah SPK, pratinjau berkas, TIFF, dan error edit proyek

### Error `Cannot read properties of null (reading 'toString')`
- Sebab: `buildFormData` di `ProjectModal` memakai `terminCount !== undefined ? .toString() : ''`.
  Firestore menyimpan field kosong sebagai `null`, dan `null !== undefined` bernilai
  benar, jadi `null.toString()` melempar error setiap kali form proyek dibuka.
- Perbaikan di akar: helper `numText()` menutup `undefined`, `null`, string kosong,
  dan angka tak sah sekaligus; dipakai untuk `value`, `terminCount`, `retentionPct`,
  `retentionMonths`. `taxRate` juga tidak lagi menjadi `null` (jatuh ke 11).
- Uji helper: 7/7 bentuk masukan lulus (null, undefined, '', 0, angka, 'abc', NaN).

### Pratinjau "server berkas menolak permintaan ini"
- Sebab: `FileViewer` memakai `fetch()` langsung ke URL Storage. Storage menolak
  permintaan tanpa token (401) DAN respons galatnya tidak membawa header CORS,
  sehingga peramban melaporkannya sebagai kegagalan jaringan. Akibatnya SEMUA
  berkas proyek/invoice gagal dipratinjau, bukan hanya berkas tertentu.
- Perbaikan: berkas diambil lewat Cloud Function `getStorageAssetDataUrl`
  (sudah memeriksa login + kuota, membaca objek dengan Admin SDK) melalui
  `fetchAssetPayload()` baru di `services/assets.js`.
- Pesan galat kini spesifik: kuota habis, sesi berakhir, berkas tidak ditemukan.

### Unggah SPK/PK tidak muncul di form
- Form memegang salinan `project` dari props, jadi setelah unggahan sukses label
  dan pratinjau tidak berubah sampai halaman dimuat ulang. Ditambah state
  `uploadedDocs` yang digabung ke data proyek, label "(ada)" langsung berubah.
- `alert()` diganti pesan inline yang menjelaskan sebab (hak akses, ukuran,
  jaringan), bukan "Gagal mengunggah berkas" yang tidak bisa ditindaklanjuti.

### Dukungan TIFF (SPK, PK, WPHO)
- Diuji langsung di peramban: `<img>` dan `createImageBitmap` sama-sama GAGAL
  membuka TIFF. Gemini juga hanya menerima png/jpeg/webp/heic. Jadi TIFF tidak
  mungkin dipratinjau atau dianalisis tanpa konversi.
- `functions/tiff.js` (baru, tanpa dependensi): decoder TIFF baseline yang menulis
  PNG memakai `zlib` bawaan Node. Cakupan: little/big endian, strip/tile, kompresi
  none/LZW/PackBits/Deflate, 1 kanal atau RGB(A), WhiteIsZero (hasil faks),
  prediktor horizontal, dan TIFF tanpa `StripByteCounts`.
- `getStorageAssetDataUrl` mengubah TIFF menjadi PNG sekali di server; hasilnya
  dipakai pratinjau, unduhan, dan analisis AI. Berkas asli tidak diubah.
- Format yang belum didukung (TIFF berkompresi JPEG, CMYK, planar, 16 bit) ditolak
  dengan pesan yang meminta simpan ulang, bukan menghasilkan gambar rusak.
- Uji decoder: 11/11 lulus (RGB, grayscale, WhiteIsZero, prediktor, deflate,
  PackBits, strip tanpa byte count, berkas bukan TIFF, TIFF rusak).

### Deploy dan belum terverifikasi
- Deploy gabungan sempat gagal pada timeout analisis Firebase (10 detik), bukan error kode. Deploy dipisah dan berhasil: Functions + Hosting.
- Hosting live diperbarui; Functions live memuat getStorageAssetDataUrl dengan konversi TIFF.
- Belum terverifikasi: pratinjau TIFF sungguhan dan unggah SPK dari UI live (butuh berkas asli + login pemilik).

## 2026-11-16 — Upgrade `firebase-functions` v7

- `firebase-functions` dari `^6.0.1` ke `^7.4.0`, `firebase-admin` dari `^12.6.0` ke `^13.10.0`; versi terpasang di lockfile 7.4.0/13.x.
- `firebase-functions-test` tetap `^3.1.0` karena versi terbaru menolak `firebase-admin@14`, sementara v13 didukung penuh. `firebase-admin@14` sengaja TIDAK dipasang.
- Verifikasi lokal: `node --check` lulus untuk `index.js`/`tiff.js`; `require('./index.js')` mengekspor 11 function dalam sekitar 2,8 detik.
- Deploy Functions sukses untuk 11 function, tanpa peringatan versi usang. Endpoint `getStorageAssetDataUrl` dan `analyzeTransactionImageWithAI` menjawab 400 untuk payload kosong tanpa auth, sesuai perilaku callable.
- Lint ESLint masih gagal pada parser lama `ecmaVersion: 2018` (optional chaining) dan aturan CRLF; masalah ini sudah ada sebelum upgrade, bukan regresi dependensi.
