const functions = require("firebase-functions");
const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {logger} = require("firebase-functions");
// Secret Manager (menggantikan defineString yang membaca .env plaintext ter-commit).
const {defineSecret} = require("firebase-functions/params");
const fetch = require("node-fetch");

const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

// Set nilainya sekali via: firebase functions:secrets:set GEMINI_API_KEY
const geminiApiKey = defineSecret("GEMINI_API_KEY");

// Schema output (enum + tipe) → menegakkan struktur tanpa prompt panjang = hemat token.
const RESPONSE_SCHEMA = {
  type: "ARRAY",
  items: {
    type: "OBJECT",
    properties: {
      date: {type: "STRING", description: "ISO 8601, kosongkan bila tak ada"},
      amount: {type: "NUMBER"},
      type: {type: "STRING", enum: ["income", "expense"]},
      category: {type: "STRING"},
      description: {type: "STRING"},
    },
    required: ["amount", "type", "category", "description"],
  },
};

// Prompt ringkas — schema sudah mengatur format, jadi teks fokus ke ATURAN saja.
const PROMPT = `Ekstrak data transaksi keuangan dari SETIAP gambar (bukti transfer, invoice, atau penawaran). Hasilkan satu objek per gambar, urut sesuai urutan gambar.
Aturan:
- amount: jumlah total/ditransfer, angka murni tanpa titik.
- type: "income" bila ada kata terima/masuk/CR; selain itu "expense" (default).
- category income: Proyek | Pembayaran | Lainnya. category expense: Operasional | Material | Upah Karyawan/Tukang | Pengeluaran Lain.
- description: ringkas dari berita transfer / item utama.
- date: ISO 8601 bila tertera; jika tidak, kosongkan.`;

exports.analyzeTransactionImageWithAI = onCall(
    {cors: true, maxInstances: 5, secrets: [geminiApiKey]},
    async (request) => {
      // Wajib login — cegah pemakaian kuota Gemini oleh pihak luar.
      if (!request.auth) {
        throw new HttpsError("unauthenticated", "Anda harus login untuk memakai fitur AI.");
      }

      const apiKey = geminiApiKey.value();
      if (!apiKey) {
        logger.error("GEMINI_API_KEY belum di-set di Secret Manager.");
        throw new HttpsError("failed-precondition", "Fitur AI belum dikonfigurasi (API key).");
      }

      // Terima multi-gambar: images:[{base64String, mimeType}].
      // Backward-compat: single {base64String, mimeType}.
      let images = Array.isArray(request.data?.images) ? request.data.images : null;
      if (!images && request.data?.base64String && request.data?.mimeType) {
        images = [{base64String: request.data.base64String, mimeType: request.data.mimeType}];
      }

      if (!images || images.length === 0) {
        throw new HttpsError("invalid-argument", "Tidak ada gambar untuk dianalisis.");
      }
      if (images.length > 8) {
        throw new HttpsError("invalid-argument", "Maksimal 8 gambar per analisis.");
      }

      // Satu request Gemini berisi prompt + semua gambar → hemat biaya (prompt dipakai bersama).
      const parts = [{text: PROMPT}];
      for (const img of images) {
        if (!img.base64String || !img.mimeType) {
          throw new HttpsError("invalid-argument", "Setiap gambar butuh base64String & mimeType.");
        }
        parts.push({inlineData: {mime_type: img.mimeType, data: img.base64String}});
      }

      const requestBody = {
        contents: [{parts}],
        generationConfig: {
          temperature: 0.2,
          topK: 1,
          topP: 1,
          maxOutputTokens: 256 * images.length,
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA,
        },
      };

      logger.info(`Analisis ${images.length} gambar via Gemini.`);

      try {
        const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
          method: "POST",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          const errorBody = await response.text();
          logger.error("Gemini API gagal.", {status: response.status, body: errorBody});
          throw new HttpsError("internal", `Gemini API error: ${response.status}`);
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) {
          throw new HttpsError("internal", "AI tidak memberi respons.");
        }

        // responseSchema menjamin JSON array valid.
        const transactions = JSON.parse(text);
        return {transactions: Array.isArray(transactions) ? transactions : [transactions]};
      } catch (error) {
        if (error instanceof HttpsError) throw error;
        logger.error("Kesalahan memanggil Gemini:", error);
        throw new HttpsError("unknown", "Terjadi kesalahan saat menganalisis gambar.");
      }
    },
);
