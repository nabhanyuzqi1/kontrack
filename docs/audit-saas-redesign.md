# Kontrack — Audit & Desain Redesign SaaS

> **Dokumen historis.** Ditulis 2026-07-21 sebagai dasar perancangan; sebagian besar
> sudah terbangun. Untuk status terkini lihat [ROADMAP.md](ROADMAP.md), untuk aturan
> kerja lihat [../AGENTS.md](../AGENTS.md). Detail infrastruktur di sini sudah usang —
> semua sumber daya kini di asia-southeast2 dengan database `kontrack`.

Tanggal: 2026-07-21 · Basis audit: commit `a78b862` (main)

---

## Bagian 1 — Audit Kondisi Sekarang

Kontrack saat ini adalah aplikasi single-tenant untuk PT Permata Energi Borneo: React 18 (CRA) + Firebase (Auth, Firestore, Storage, Functions) + Gemini untuk analisis gambar transaksi. Arsitekturnya "fat client": semua query, agregasi, dan logika bisnis jalan di browser, Firestore diakses langsung.

### 🔴 Kritis (perbaiki sekarang, terlepas dari rencana SaaS)

**1. GEMINI_API_KEY ter-commit di git.**
File `functions/.env.sistem-keuangan-ptpeb` ada di git history dan berisi API key Gemini. Siapa pun yang punya akses repo (atau kalau repo pernah publik) bisa memakai kuota Anda.
→ **Revoke key ini di Google AI Studio hari ini**, ganti dengan key baru via Secret Manager (`firebase functions:secrets:set`), hapus file dari repo dan history (`git filter-repo`).

**2. Firestore rules tidak ada di repo — dan kemungkinan permissive.**
`firebase.json` menunjuk ke `firestore.rules`, tapi file itu masuk `.gitignore` dan tidak ada di working tree (begitu juga `firestore.indexes.json`). Artinya: (a) rules yang aktif di production tidak ter-review dan tidak ter-version, (b) `firebase deploy` dari clone bersih akan gagal. Melihat kode klien yang query koleksi `users`, `projects`, `transactions` secara bebas, kemungkinan besar rules-nya `allow read, write: if request.auth != null` (atau lebih longgar) — artinya **setiap user terautentikasi bisa baca/tulis/hapus seluruh data keuangan perusahaan, termasuk mengubah role dirinya sendiri di koleksi `users`**.
→ Keluarkan `firestore.rules` dari `.gitignore`, tulis rules eksplisit per koleksi, commit.

**3. Role hanya ditegakkan di client.**
`App.jsx` menyembunyikan Dashboard dari non-admin, tapi role diambil dari dokumen Firestore yang (lihat poin 2) bisa ditulis user sendiri. Route guard React bukan security boundary — siapa pun bisa panggil Firestore SDK langsung dari console browser.

**4. Cloud Function Gemini bisa dipanggil tanpa login.**
`analyzeTransactionImageWithAI` (`functions/index.js:19`) adalah `onCall` dengan CORS terbuka dan **tidak memeriksa `request.auth`**. Tidak ada App Check. Siapa pun yang tahu endpoint-nya bisa membakar kuota Gemini Anda.
→ Tambahkan `if (!request.auth) throw new HttpsError('unauthenticated', ...)` + aktifkan App Check.

**5. Bukti transfer bisa dibaca publik.**
`storage.rules` men-set `allow read: if true` untuk `transactions/{userId}/**`. Ini bukti transfer bank dan invoice — data finansial sensitif, terindeks siapa pun yang punya URL.

### 🟠 Struktural (akan meledak saat jadi SaaS)

- **Tidak ada konsep tenant.** Koleksi `projects`, `transactions`, `users` flat dan global. Ini gap terbesar menuju SaaS.
- **`paidAmount` di-recompute di client** (`transactions.js:325`): setiap tambah/edit/hapus transaksi, client membaca ulang semua transaksi proyek lalu menulis balik total ke dokumen proyek. Race condition kalau dua user menulis bersamaan; drift permanen kalau client crash di tengah jalan. Harus pindah ke Cloud Function trigger atau Firestore transaction.
- **Tanpa pagination.** `getAllProjects()` / `getAllTransactions()` menarik seluruh koleksi, statistik dihitung di browser. Aman untuk 1 perusahaan, tidak untuk N tenant × M tahun data.
- **Lookup user by email, bukan by uid** (`auth.js`): satu query ekstra di setiap auth state change, dan email bisa berubah. Dokumen user seharusnya ber-key `uid`; role seharusnya custom claim.
- **Transisi status proyek dihitung di client** (`projects.js:274`) — logika bisnis yang seharusnya server-side/scheduled.

### 🟡 Kualitas

- CRA (`react-scripts` 5) sudah deprecated — migrasi ke Vite.
- Testing library terpasang, nol test.
- `console.log` data user/keuangan bertebaran di production code.
- `README.md` adalah artefak AI migrasi lama, bukan dokumentasi proyek.
- File util besar tanpa pemisahan (`pdfGenerator.js` 994 baris).

---

## Bagian 2 — Desain SaaS Multi-Tenant

### Asumsi (koreksi kalau salah)

- Target: kontraktor/UMKM konstruksi di Indonesia, puluhan–ratusan tenant tahun pertama, tim kecil per tenant (2–10 user).
- Tim pengembang: solo/kecil → time-to-market dan biaya operasional menang atas kemurnian arsitektur.
- Pembayaran: pasar Indonesia → Midtrans/Xendit lebih relevan daripada Stripe.

### Keputusan platform: tetap Firebase

| Opsi | Plus | Minus |
|---|---|---|
| **Firebase (rekomendasi)** | Tim sudah familiar, data sudah di sana, auth+storage+functions terintegrasi, biaya ~nol saat sepi | Query relasional/laporan kompleks susah, rules multi-tenant harus disiplin |
| Supabase/Postgres | RLS native, SQL untuk laporan keuangan, data finansial memang relasional | Migrasi total (auth, data, storage), belajar stack baru, menunda launch berbulan-bulan |

Data keuangan sebenarnya "berbau SQL", tapi skala per-tenant kecil dan pola query sederhana (per proyek, per periode). Firestore cukup — dengan catatan agregasi pindah ke server. Revisit kalau kebutuhan laporan lintas-dimensi membesar (lihat akhir dokumen).

### Arsitektur target

```
┌─────────────┐     ┌────────────────────────────────────────┐
│  React SPA   │────▶│ Firebase Auth (custom claims: orgId,   │
│  (Vite + TS) │     │ role) + App Check                      │
└──────┬───────┘     └────────────────────────────────────────┘
       │ SDK (dibatasi security rules per-org)
       ▼
┌──────────────────────────────┐    ┌───────────────────────┐
│ Firestore                     │◀──│ Cloud Functions        │
│ orgs/{orgId}/                 │    │ - onTxnWrite: update   │
│   members/{uid}               │    │   agregat (idempotent) │
│   projects/{pid}              │    │ - inviteUser (set      │
│   projects/{pid}/txns/{tid}   │    │   claims)              │
│   aggregates/{...}            │    │ - analyzeImage (auth + │
│ billing/{orgId} (server-only) │    │   App Check + Gemini)  │
└──────────────────────────────┘    │ - webhook Midtrans     │
┌──────────────────────────────┐    │ - scheduled: status    │
│ Storage                       │    │   proyek, reminder     │
│ orgs/{orgId}/receipts/...     │    └───────────────────────┘
└──────────────────────────────┘
```

### Model data

```
orgs/{orgId}                     → name, plan, createdAt, ownerUid
orgs/{orgId}/members/{uid}       → role: 'owner'|'admin'|'staff', email, joinedAt
orgs/{orgId}/projects/{pid}      → name, partner, value, taxRate, status,
                                   paidAmount (server-maintained), startDate, endDate
orgs/{orgId}/projects/{pid}/transactions/{tid}
                                 → type, amount, category, date, imagePath, createdBy
orgs/{orgId}/aggregates/summary  → totalValue, totalPaid, byStatus (trigger-maintained)
invites/{inviteId}               → orgId, email, role, expiresAt
billing/{orgId}                  → planId, status, periodEnd  (tulis: webhook saja)
```

Prinsip kunci:
- **Transaksi jadi subcollection proyek** — path-nya sendiri sudah meng-encode relasi, query per-proyek gratis, dan collection-group query tetap bisa untuk laporan per-org.
- **`orgId` + `role` masuk custom claims** saat user join org → security rules memeriksa `request.auth.token.orgId == orgId` tanpa read tambahan (hemat biaya + latency).
- **Semua agregat (paidAmount, summary) hanya ditulis Cloud Function trigger**, rules menolak client menulis field ini. Ini menutup race condition yang ada sekarang.

Contoh inti security rules:

```
match /orgs/{orgId}/{document=**} {
  allow read: if request.auth.token.orgId == orgId;
}
match /orgs/{orgId}/projects/{pid} {
  allow create, update: if request.auth.token.orgId == orgId
                        && request.auth.token.role in ['owner','admin']
                        && !request.resource.data.diff(resource.data)
                             .affectedKeys().hasAny(['paidAmount']);
  allow delete: if request.auth.token.role == 'owner';
}
```

### Billing & plan gating

- Midtrans/Xendit recurring → webhook Cloud Function menulis `billing/{orgId}`.
- Trigger menyalin `plan` + `status` ke dokumen `orgs/{orgId}` sehingga rules bisa gate fitur (mis. limit jumlah proyek aktif, fitur AI hanya plan berbayar) tanpa read ekstra.
- Grace period ditangani scheduled function, bukan hard-cutoff di webhook.

### Estimasi beban & biaya

100 tenant aktif × ~50 write transaksi/hari × (1 write + 1 trigger read-modify-write) ≈ 15k ops/hari — jauh di bawah free tier Firestore. Komponen biaya dominan justru Gemini call; gate di plan berbayar + rate limit per org di function.

---

## Bagian 3 — Fase Eksekusi

**Fase 0 — Tambal keamanan (minggu ini, tanpa menyentuh arsitektur):**
1. Revoke & rotate Gemini key, pindah ke Secret Manager, bersihkan git history.
2. Tulis + commit `firestore.rules` eksplisit (deny-by-default, role check server-side).
3. `request.auth` check + App Check di function Gemini.
4. Tutup public read di `storage.rules`.

**Fase 1 — Fondasi multi-tenant (2–4 minggu):**
- Skema `orgs/...` + custom claims + rules baru.
- Trigger `onTxnWrite` untuk paidAmount/agregat (hapus recompute client).
- Script migrasi: data PT PEB jadi tenant pertama.
- Migrasi CRA → Vite (sekalian, karena banyak file tersentuh).

**Fase 2 — Jadi produk (4–6 minggu):**
- Signup + onboarding org, invite member via email.
- Integrasi Midtrans/Xendit + plan gating.
- Pagination + composite indexes; scheduled function untuk status proyek & reminder.

**Fase 3 — Pematangan:**
- Test untuk rules (emulator) dan trigger agregasi — dua titik paling rawan regresi.
- Monitoring: alert budget Firestore/Gemini, error reporting functions.

## Yang perlu direvisit saat tumbuh

- **Laporan lintas-dimensi** (per kategori × per bulan × per proyek, multi-tahun): kalau mulai berat, export Firestore → BigQuery (extension resmi) sebelum mempertimbangkan pindah ke SQL.
- **Tenant besar** (>10 user, ribuan transaksi/bulan): pagination berbasis cursor dan agregat per-bulan (bukan satu dokumen summary) untuk hindari hot document.
- **Satu user multi-org**: custom claims single `orgId` harus diganti mekanisme org-switcher (claims berisi map, atau re-mint token saat switch).
