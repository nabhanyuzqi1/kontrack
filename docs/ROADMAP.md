# Kontrack — Status & Roadmap

Sumber tunggal status pekerjaan. **Perbarui setiap menyelesaikan sesuatu**, supaya
agen/sesi berikutnya tidak mengulang yang sudah selesai.

Diperbarui: 2026-07-28

Menggantikan `PLAN-next-session.md` dan bagian status di `roadmap-invoice-pajak.md`
(dua berkas itu sudah dihapus karena isinya mulai saling bertentangan).

---

## Sudah selesai

### Fondasi
- Migrasi CRA → Vite 5
- Design system: CSS variables, 5 preset tema, Space Grotesk + Inter, angka tabular
- App shell: sidebar bisa disembunyikan, navigasi bawah ala aplikasi native di mobile
- `scripts/check-imports.mjs` masuk ke `npm run build` — menangkap komponen JSX yang
  dipakai tapi belum di-impor (esbuild membiarkannya lolos, halamannya jadi putih)
- `ErrorBoundary`, skeleton shimmer

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

---

## Perlu tindakan pemilik

Agen tidak boleh mengerjakan ini. Lihat AGENTS.md §8.

- [ ] **Aktifkan Google Sign-In** — saat ini tidak ada provider IdP terdaftar,
      login Google menghasilkan `auth/operation-not-allowed`.
      Firebase Console → Authentication → Sign-in method → Google → Enable.
- [ ] Rotasi API key Gemini lama dan `settings.ai.apiKey` di Firestore (pernah
      terekspos di percakapan).

## Belum terverifikasi

- [ ] Dashboard & Laporan setelah perbaikan long-polling + batas waktu cache.
      Verifikasi terhenti di halaman login — agen tidak memasukkan password.
- [ ] Kuota AI harian saat benar-benar tercapai.

---

## Berikutnya

### Prioritas 1 — menutup lubang yang sudah diketahui

1. **Poles Laporan** — tab Ringkasan & Pajak Bulanan masih paling lemah dibanding
   Analisis Tahunan.
2. **Kartu proyek** — pemilik masih belum puas. Referensi: Pinterest/Dribbble.
   Konsepnya *detailed, solution, tidak ribet*.
3. **Deploy `firestore.indexes.json`** — saat ini kosong walau indeks composite
   sudah ada di database (dibuat manual). Kalau tidak dituliskan, indeks itu tidak
   bisa direproduksi ke environment lain.

### Prioritas 2 — fitur yang sudah dijanjikan

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
