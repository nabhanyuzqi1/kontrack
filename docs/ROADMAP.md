# Kontrack — Status & Roadmap

Sumber tunggal status pekerjaan. **Perbarui setiap menyelesaikan sesuatu**, supaya
agen/sesi berikutnya tidak mengulang yang sudah selesai.

Diperbarui: 2026-11-15

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
- TaxDocsModal: tombol Scan faktur pajak (AI isi nomor+tanggal, berkas ke arsip).
- Dashboard: grafik arus kas garis (toggle garis/batang), analisis AI berdampingan grafik + riwayat analisis tersimpan (localStorage `kontrack-ai-insight-history`).
- Login: daftar akun baru email/password (`signUpUser`, role staff) + link ke landing page `/welcome`.

Belum terverifikasi (butuh owner):
- Google Sign-In masih `auth/operation-not-allowed` — aktifkan provider Google di Firebase Console.
- Email penagihan nyata menunggu secret SMTP asli.
- Scan faktur/WPHO end-to-end dengan Gemini sungguhan; data Firestore asli.

