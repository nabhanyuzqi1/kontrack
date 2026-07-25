# Roadmap — Invoice & Kepatuhan Pajak Kontrack (bertahap)

Berdasarkan survey Kontrack live (kontrack.web.app) yang punya sistem kepatuhan pajak PKP penuh.
Tujuan: rekonstruksi bertahap di redesign baru tanpa membangun semua sekaligus.

## Fase A — Invoice PDF (SELESAI ~90%)
- ✅ Generator PDF meniru template PT PEB (header, meta PO/PK/WPHO/Faktur, Franco/Shipped/Term, item Unit/Qty/Amount, terbilang, total, note bank, ttd)
- ✅ Builder InvoiceModal + config perusahaan/bank/direktur
- ⬜ Embed logo (diamond) + tanda tangan PNG di header/ttd — butuh file dari user
- ⬜ Simpan invoice sebagai record (koleksi `invoices`), bukan hanya generate PDF

## Fase B — Invoice + Termin
- ⬜ Field termin (Termin 1–10 / Retensi / Pelunasan) + progress % per invoice
- ⬜ DPP Nilai Lain (dasar pengenaan pajak metode nilai lain) — hitung otomatis
- ⬜ NPWP client tersimpan (dari modul Klien)
- ⬜ Status invoice: Draft / Terkirim / Terbayar / Void
- ⬜ PPh per client (mis. 1.75%/2.65%) dengan catatan "Diterima: X (PPh Y%)"

## Fase C — Alur Dokumen Pajak (CoreTax)
- ⬜ Progress Dokumen Pajak per invoice: Faktur Pajak (e-faktur) → Billing Pajak (kode billing) → Pembayaran PPN (+bukti) → Nomor NTPN
- ⬜ Katalog Jasa CoreTax (kode 010000 dst) di Pengaturan, import CSV
- ⬜ Dokumen pendukung: WPHO, SPK (upload)
- ⬜ Riwayat pajak (audit log per invoice)
- ⬜ Import & Export Faktur Pajak

## Fase D — Otomasi Keuangan
- ⬜ Saat invoice ditandai "Terbayar": auto-buat transaksi (Pembayaran INV, PPN Otomatis, Setoran PPN)
- ⬜ Dashboard pajak: PPN 11%, PPh Dipotong, PPN Menunggu, Status Kepatuhan, kartu aksi
- ⬜ Laporan pajak

## Section pendukung (paralel, sesuai prioritas user)
- **Pengaturan** — identitas perusahaan, logo/kopsurat/TTD PNG, katalog CoreTax, tema warna configurable → menyelesaikan Fase A & mengatasi soal warna
- **Klien (CRM)** — NPWP, alamat, auto-isi invoice "Kepada Yth"
- **Database Harga/BOQ** — harga satuan, import RAB (AI), template estimasi
- **Portfolio Publik** — halaman publik perusahaan

## Catatan arsitektur
Saat multi-tenant: `orgs/{orgId}/invoices/{id}`, `.../clients/{id}`, `.../priceItems/{id}`; config perusahaan & tema di dokumen `orgs/{orgId}`. Auto-transaksi pajak sebaiknya via Cloud Function trigger (bukan client) agar konsisten.
