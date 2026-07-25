# Setup AI (Gemini) — fix "Gemini key tidak tersedia" + multi-gambar

## Apa yang berubah di kode
- `functions/index.js`: `defineString("GEMINI_API_KEY")` → **`defineSecret("GEMINI_API_KEY")`**
  (Secret Manager, tidak lagi baca `.env` plaintext yang ter-commit/bocor).
- Function kini **wajib login** (`request.auth`) + terima **multi-gambar**
  (`images: [{base64String, mimeType}]`, backward-compat dengan single).
- Prompt diringkas + pakai `responseSchema` (JSON array) → hemat token, output robust.
- Client `services/ai.js`: `analyzeTransactionImages(files, userId)` → 1 panggilan untuk banyak gambar.

## Langkah deploy (WAJIB, oleh pemilik)
1. **Revoke key lama** (bocor di git) di https://aistudio.google.com/apikey → buat key baru.
2. Set secret (bukan .env):
   ```bash
   firebase functions:secrets:set GEMINI_API_KEY
   # tempel key baru saat diminta
   ```
3. Deploy function:
   ```bash
   firebase deploy --only functions
   ```
   Saat deploy, Firebase otomatis mengikat secret ke function (lihat `secrets: [geminiApiKey]`).
4. Hapus file plaintext lama dari repo + history:
   ```bash
   git rm --cached functions/.env.sistem-keuangan-ptpeb
   # lalu bersihkan history dgn git filter-repo bila perlu
   ```
   (sudah masuk .gitignore).

## Kenapa dulu "tidak tersedia"
`defineString` membaca `.env.<project>` saat deploy; bila environment ter-deploy
tak memuat nilainya (atau deploy dari sumber berbeda), function melihat key kosong.
`defineSecret` mengikat nilai dari Secret Manager langsung ke runtime function —
lebih aman dan tak bergantung file .env yang ikut ter-commit.

## Catatan region
`getFunctions()` (client) & `onCall` (function) sama-sama default `us-central1` — cocok.
Bila nanti deploy region lain (mis. asia-southeast2), set juga di client:
`getFunctions(app, 'asia-southeast2')`.
