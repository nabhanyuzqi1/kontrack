# Setup AI (Gemini)

Kondisi saat ini: **AI berjalan lewat Vertex AI tanpa API key.** Tidak ada langkah
setup yang tersisa, kecuali fitur ini dipindah ke proyek Firebase lain.

---

## Cara kerja

`callGemini` di `functions/index.js` mencoba dua jalur berurutan:

| Jalur | Model | Tagihan | Kredensial |
|---|---|---|---|
| 1. **Vertex AI** (utama) | `gemini-2.5-flash` | Cloud Billing proyek | Service account function, lewat metadata server |
| 2. Gemini Developer API (cadangan) | `gemini-flash-latest` | Kredit prabayar AI Studio | Secret `GEMINI_API_KEY` |

Jalur 2 hanya dipakai bila Vertex membalas 401/403/404 — artinya Vertex belum aktif
di proyek. Status lain (429, 5xx) berarti Vertex aktif tetapi bermasalah, dan
dilaporkan apa adanya, bukan disamarkan jadi "AI belum tersedia".

**Vertex tidak punya kuota gratis harian.** Free tier per hari itu milik Developer
API. Angka di `DAILY_LIMITS` adalah pagar biaya, bukan pemetaan free tier.

## Prasyarat (sudah terpenuhi di proyek ini)

- `aiplatform.googleapis.com` aktif
- Service account runtime function punya izin Vertex.
  `700252927467-compute@developer.gserviceaccount.com` punya `roles/editor` yang
  sudah mencakupnya — tidak perlu grant tambahan.

Kalau dipindah ke proyek lain:

```bash
gcloud services enable aiplatform.googleapis.com --project=PROJECT_ID
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:SERVICE_ACCOUNT" \
  --role="roles/aiplatform.user" --condition=None
```

## Dua hal yang wajib dipertahankan

### `contents` harus punya `role`

Vertex menolak tanpanya: `Please use a valid role: user, model`. Developer API
membolehkan. Dinormalkan sekali di `callGemini`, bukan di pemanggil — supaya
pemanggil baru tidak bisa lupa.

### `thinkingConfig: {thinkingBudget: 0}`

Gemini 2.5 adalah model *thinking* dan token berpikirnya **dihitung terhadap**
`maxOutputTokens`. Terverifikasi: dengan `maxOutputTokens: 10`, seluruh jatah habis
untuk berpikir dan jawabannya kosong —

```
finishReason: MAX_TOKENS
thoughtsTokenCount: 7
content: { role: "model" }        // tidak ada parts
```

Ekstraksi berpandu `responseSchema` tidak butuh penalaran bertahap, jadi
mematikannya sekaligus menekan biaya.

## Hemat token

- Klien mengirim **agregat** metrik (~300 token), bukan ratusan transaksi mentah —
  lihat `buildFinancialSummary` di `services/aiInsights.js`
- `responseSchema` menggantikan instruksi format panjang di prompt
- Banyak gambar dalam satu panggilan → prompt dipakai bersama
- Gambar dikompresi sekali, hasilnya dipakai untuk unggah **dan** kiriman ke AI
- Hasil di-cache 30 menit di `sessionStorage`

Audit pemakaian:

```bash
gcloud functions logs read analyzeFinancialInsights --region=asia-southeast2 --project=sistem-keuangan-ptpeb --limit=20 | grep token
```

## Kuota harian per pengguna

`DAILY_LIMITS` di `functions/index.js`, reset 00:00 WIB:

| Jenis | Batas |
|---|---|
| Analisis gambar | 50/hari (dihitung per gambar, bukan per panggilan) |
| Analisis keuangan | 20/hari |

Penghitung di koleksi `ai_usage`, dinaikkan dalam transaksi supaya dua permintaan
bersamaan tidak sama-sama lolos pada hitungan terakhir, dan dipotong **sebelum**
memanggil Gemini.

`ai_usage` ditutup dari klien di `firestore.rules` — kalau terbuka, pengguna
tinggal menol-kan penghitungnya sendiri dan batas harian jadi hiasan.

## Kalau AI mati

Jangan menebak, baca sebabnya:

```bash
gcloud logging read 'resource.labels.service_name="analyzefinancialinsights" AND severity>=WARNING' --project=sistem-keuangan-ptpeb --limit=5 --format=json
```

Pesan yang sampai ke pengguna sudah dipetakan per penyebab (kredit habis, key tidak
valid, kuota penuh, model pensiun) di `geminiError`.

## Riwayat

Jalur API key sempat jadi satu-satunya, dan mati total ketika kredit prabayar AI
Studio habis (`429 RESOURCE_EXHAUSTED: Your prepayment credits are depleted`).
Vertex ditambahkan supaya fitur AI tidak lagi bergantung pada satu sumber tagihan.
