# PRD — Kontrack SaaS untuk Kontraktor

> **Dokumen historis.** Ditulis 2026-07-21 sebagai dasar perancangan; sebagian besar
> sudah terbangun. Untuk status terkini lihat [ROADMAP.md](ROADMAP.md), untuk aturan
> kerja lihat [../AGENTS.md](../AGENTS.md). Detail infrastruktur di sini sudah usang —
> semua sumber daya kini di asia-southeast2 dengan database `kontrack`.

Versi 1.0 · 2026-07-21 · Penyusun: audit produk + survey kontrack.web.app (live) & repo backup

---

## 0. Ringkasan Eksekutif

**Kontrack** adalah platform SaaS manajemen proyek & keuangan untuk kontraktor di Indonesia. Tagline: *"Plan smarter. Build faster."* Model: multi-tenant — setiap perusahaan (mis. PT Permata Energi Borneo sebagai tenant pertama) mendaftar via wizard, mengelola proyek, keuangan, pajak, invoice, dan portofolio publiknya sendiri.

**Keputusan strategis inti dokumen ini:** Kontrack sebaiknya diposisikan sebagai **platform kontraktor umum berbasis modul**, bukan khusus bangunan. Modul inti (proyek + keuangan + invoice + pajak) melayani semua kontraktor; satu **modul Aset & Alat Berat** opsional menutup vertikal penyewaan/jasa alat berat. Tipe bisnis yang dipilih saat registrasi menentukan modul mana yang aktif per tenant.

---

## 1. Pertanyaan Strategis: Bangunan Saja atau Semua Kontraktor?

### Kondisi model data saat ini

Kontrack (baik live maupun backup) memakai abstraksi **Proyek**: nilai kontrak → pajak → termin (paidAmount) → status `akan-datang / ongoing / retensi / selesai`, plus transaksi income/expense per proyek. Status **"retensi"** adalah konsep spesifik konstruksi (retensi = 5% ditahan pemberi kerja sampai masa pemeliharaan selesai). Artinya: **model sekarang paling pas untuk kontraktor bangunan/sipil.**

### Segmentasi kontraktor Indonesia & kecocokannya

| Tipe kontraktor | Model bisnis | Cocok dengan Kontrack sekarang? |
|---|---|---|
| **Bangunan/sipil** (gedung, jalan, jembatan, perumahan) | Berbasis proyek: RAB → SPK → termin → retensi → serah terima | ✅ Sangat cocok — ini core-nya |
| **Jasa dgn alat berat** (land clearing, hauling, cut & fill) | Berbasis kontrak + volume (m³, ritase, ton) | 🟡 Bisa dipaksakan sebagai "proyek", tapi tak ada tracking volume/unit |
| **Sewa/rental alat berat** (excavator, dozer, crane) | Berbasis utilisasi aset: sewa per jam/hari/bulan, rekurin | 🔴 Tidak cocok — tak ada registri aset, utilisasi, jadwal maintenance |
| **Mekanikal/Elektrikal (ME)** | Berbasis proyek | ✅ Cocok (sama seperti sipil) |
| **Supplier/trading material** | Berbasis order/stok | 🟡 Sebagian (tak ada inventory) |

**Catatan penting dari survey:** field "Assets" di wizard registrasi step 3 hanya soal **aset branding (logo)**, bukan alat berat. Jadi saat ini belum ada dukungan terstruktur untuk manajemen alat berat sama sekali.

### Rekomendasi

**Jangan batasi ke bangunan saja — tapi jangan pula klaim "semua kontraktor" sebelum modul alat berat ada.** Ambil pendekatan bertahap:

1. **Fase sekarang → posisikan "untuk kontraktor konstruksi & sipil"** (bangunan, jalan, ME). Ini jujur dan langsung sesuai kekuatan produk.
2. **Fase berikut → tambah Modul Aset & Alat Berat**, lalu naikkan positioning jadi "untuk semua kontraktor". Vertikal rental/alat berat besar di Indonesia (mining support, perkebunan, infrastruktur) dan under-served software-nya.
3. Registrasi wizard menambahkan pilihan **Tipe Usaha Kontraktor** (multi-select) → menyalakan modul yang relevan per tenant. Kontraktor bangunan tak melihat menu alat berat, dan sebaliknya.

---

## 2. Alur Bisnis Kontraktor (Referensi Domain)

### 2.1 Alur proyek kontraktor bangunan/sipil (siklus utama)

```
Tender/       Penawaran    Kontrak/     Pelaksanaan +      Pembayaran      Serah Terima      Masa
Prospek   →   + RAB     →  SPK/MOU  →   Progress/Opname →  Termin      →   (PHO)         →   Pemeliharaan → Retensi cair (FHO)
```

Istilah & tahapan penting:
- **RAB (Rencana Anggaran Biaya)** — estimasi biaya proyek (material, upah, alat, overhead, profit). Dasar penawaran.
- **Penawaran/Tender** — mengajukan harga ke pemberi kerja (owner/bouwheer).
- **SPK (Surat Perintah Kerja) / MOU / Kontrak** — dokumen legal, memuat nilai kontrak, lingkup, jangka waktu, cara bayar.
- **Termin pembayaran** — pembayaran bertahap sesuai progres. Umum: DP (uang muka) → termin per progres (mis. 25/50/75/100%) → retensi.
- **Progress / Opname / MC (Monthly Certificate)** — pengukuran kemajuan fisik di lapangan; jadi dasar penagihan termin.
- **Uang Muka (DP)** — biasanya 10–30%, dipotong proporsional tiap termin.
- **Retensi** — 5% nilai kontrak ditahan owner sampai masa pemeliharaan selesai; jaminan mutu.
- **PHO (Provisional Hand Over)** — serah terima pertama, mulai masa pemeliharaan.
- **Masa Pemeliharaan** — biasanya 90–180 hari; kontraktor perbaiki cacat.
- **FHO (Final Hand Over)** — serah terima akhir; **retensi cair**.
- **Pajak** — PPN 11%, PPh final jasa konstruksi (mis. 1,75%/2,65% tergantung kualifikasi), faktur pajak (CoreTax untuk PKP).

### 2.2 Alur kontraktor alat berat (rental) — berbeda

```
Katalog     Kontrak      Mobilisasi   Operasi harian    Penagihan       Demobilisasi
Unit    →   Sewa      →  Unit ke   →  (timesheet jam/  → rekurin      →  + maintenance
            (rate)       lokasi       hari + fuel +       (mingguan/       unit
                                      operator)          bulanan)
```

Kebutuhan data berbeda: **registri unit** (merk, tipe, jam operasi/HM), **kontrak sewa** (rate per jam/hari/bulan), **timesheet & fuel log**, **jadwal maintenance & service**, **utilisasi unit** (idle vs kerja), **biaya operator**.

### 2.3 Titik keuangan yang harus ditangkap platform (semua tipe)

Arus kas kontraktor: **modal keluar duluan** (beli material, bayar upah) sebelum termin masuk → **cash flow gap** adalah masalah #1 kontraktor. Platform yang bagus harus menonjolkan: piutang termin (belum tertagih), retensi tertahan, proyeksi kas, dan margin per proyek.

---

## 3. Fitur Kontrack Live (hasil survey kontrack.web.app)

Yang **sudah ada di produksi** (dan hilang di repo backup — perlu direkonstruksi/dipertahankan saat rebrand):

1. **Multi-tenant** — wizard registrasi perusahaan 5 langkah:
   - Step 1: Tipe & legalitas (PT/CV/Firma/UD/Koperasi/Yayasan, PKP/Non-PKP, NPWP, tgl berdiri)
   - Step 2: Kontak (alamat, telepon, website, email)
   - Step 3: Profil bisnis & aset branding (deskripsi, aktivitas, logo)
   - Step 4: Evaluasi user (ukuran perusahaan, volume transaksi, goals, level pengalaman)
   - Step 5: Konfigurasi invoice + pembuatan akun admin
2. **Invoice** — template ganda: Standard, Professional, Minimal, **Construction**, Corporate PT, PKP Professional; payment terms 7–60 hari; numbering (auto/sequential/PT corporate)
3. **Pajak** — kalkulasi PPN otomatis; **integrasi CoreTax** untuk faktur pajak PKP
4. **AI** — analisis transaksi otomatis dari gambar/screenshot (sudah ada di backup via Cloud Function Gemini)
5. **Webhook** — notifikasi otomatis
6. **Portofolio publik** — halaman publik perusahaan untuk citra/marketing
7. **RBAC** — multi-user berbasis peran
8. **Dark/light theme**, onboarding modal, responsive
9. **Dashboard real-time**, laporan keuangan & pajak

> Implikasi: repo backup ini **tertinggal jauh**. Rencana rebrand harus memperlakukan fitur di atas sebagai baseline yang harus ada, bukan fitur baru.

---

## 4. Ruang Lingkup Produk (Scope)

### 4.1 Modul Inti (semua tenant)

| Modul | Fitur |
|---|---|
| **Onboarding** | Wizard registrasi 5 langkah + pilihan tipe usaha (NEW), verifikasi email, akun admin |
| **Proyek** | CRUD proyek, status akan-datang/ongoing/retensi/selesai, RAB ringkas, termin, retensi, progress, deadline reminder |
| **Keuangan** | Transaksi income/expense per proyek, input manual + AI (screenshot), kategori, bukti transfer |
| **Invoice** | Generate invoice (template per tipe perusahaan), penomoran, payment terms, status bayar |
| **Pajak** | PPN otomatis, PPh jasa konstruksi, faktur pajak CoreTax (PKP) |
| **Laporan** | Dashboard, laporan keuangan, laporan pajak, laba/rugi per proyek, arus kas |
| **Portofolio publik** | Halaman publik perusahaan (proyek terpilih, profil) |
| **Tim & Peran** | Undang user, peran owner/admin/staf/viewer |
| **Notifikasi** | Webhook + reminder deadline/termin/retensi |

### 4.2 Modul Aset & Alat Berat (opsional, tenant yang memilih vertikal ini)

| Fitur | Detail |
|---|---|
| **Registri Unit** | Daftar alat berat: merk, tipe, no. seri, tahun, jam operasi (HM), status |
| **Kontrak Sewa** | Rate per jam/hari/bulan, penyewa, periode, mobilisasi/demob |
| **Timesheet & Fuel** | Log jam kerja harian, konsumsi BBM, operator |
| **Maintenance** | Jadwal service per HM/tanggal, riwayat perbaikan, biaya |
| **Utilisasi** | Dashboard idle vs kerja, pendapatan per unit, ROI unit |

### 4.3 Out of Scope (v1)

- Akuntansi double-entry penuh (jurnal, neraca) — cukup cash-basis + laba/rugi proyek
- Payroll lengkap
- Inventory/stok material (pertimbangkan v2)
- Mobile app native (PWA responsive dulu)

---

## 5. Arsitektur & Model Data (target multi-tenant)

Lihat detail di [audit-saas-redesign.md](audit-saas-redesign.md). Ringkas:

```
orgs/{orgId}                         → name, type[], companyType, legalStatus(PKP), npwp,
                                       plan, logoUrl, publicProfile, invoiceConfig
orgs/{orgId}/members/{uid}           → role: owner|admin|staff|viewer
orgs/{orgId}/projects/{pid}          → name, partner, value, taxRate, status,
                                       paidAmount*, dp, retentionPct, phoDate, ...
orgs/{orgId}/projects/{pid}/transactions/{tid}
orgs/{orgId}/invoices/{invId}        → projectId, number, template, items[], tax, status
orgs/{orgId}/equipment/{unitId}      → (modul alat berat) merk, tipe, HM, status
orgs/{orgId}/rentals/{rentalId}      → unitId, penyewa, rate, period, timesheets[]
orgs/{orgId}/aggregates/summary*     → (server-maintained)
```
`*` = hanya ditulis Cloud Function trigger; `orgId`+`role` di custom claims.

**Prinsip keamanan (dari audit):** deny-by-default rules, isolasi per-org via custom claims, agregat server-only, Cloud Function Gemini wajib cek auth + App Check, storage bukti transfer non-publik. Rotasi GEMINI_API_KEY yang pernah ter-commit.

---

## 6. Peran & Hak Akses

| Peran | Akses |
|---|---|
| **Owner** | Semua + billing + hapus org + kelola user |
| **Admin** | Semua data operasional (proyek, keuangan, invoice), kelola staf |
| **Staff** | Input transaksi & proyek, tak bisa hapus/lihat billing |
| **Viewer** | Read-only (mis. pemberi kerja / auditor lewat link) |

---

## 7. Roadmap Implementasi

**Fase 0 — Keamanan (blocking, dari audit):** rotasi API key, firestore.rules eksplisit, App Check di function Gemini, tutup storage publik.

**Fase 1 — Rebrand UI + rekonstruksi baseline (in progress):**
- ✅ Migrasi Vite, design system Kontrack, shell sidebar, halaman login/dashboard/proyek/laporan baru
- ⬜ Wizard registrasi perusahaan 5 langkah (multi-tenant onboarding) — belum ada di backup
- ⬜ Modul invoice + template konstruksi
- ⬜ Portofolio publik

**Fase 2 — Multi-tenant penuh:** skema `orgs/...`, custom claims, trigger agregat, billing (Midtrans/Xendit), migrasi PT PEB jadi tenant pertama.

**Fase 3 — Vertikal alat berat:** modul Aset & Alat Berat, pilihan tipe usaha di wizard, positioning "semua kontraktor".

**Fase 4 — Pematangan:** CoreTax otomasi, webhook, test rules (emulator), monitoring biaya.

---

## 8. Metrik Sukses

- Onboarding: % perusahaan yang menyelesaikan wizard 5 langkah
- Aktivasi: tenant yang membuat ≥1 proyek + ≥1 invoice dalam 7 hari
- Retensi: tenant aktif bulanan (login + transaksi)
- Nilai: total nilai proyek & invoice yang dikelola di platform
- Vertikal: rasio tenant bangunan vs alat berat (validasi ekspansi vertikal)

---

## 9. Keputusan yang Perlu Konfirmasi Pemilik

1. **Prioritas vertikal:** fokus dulu 100% ke kontraktor bangunan, atau paralel bangun modul alat berat? (Rekomendasi: bangunan dulu, alat berat Fase 3.)
2. **Billing:** model langganan (per bulan/tahun, per tenant) atau freemium? Payment gateway Midtrans/Xendit?
3. **Rekonstruksi vs lanjut backup:** repo live lebih maju — apakah ada akses ke source live, atau kita rekonstruksi fitur (wizard, invoice, CoreTax) di atas repo backup yang sudah di-rebrand?
