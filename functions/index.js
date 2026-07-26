const functions = require("firebase-functions");
const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {logger} = require("firebase-functions");
// Secret Manager (menggantikan defineString yang membaca .env plaintext ter-commit).
const {defineSecret} = require("firebase-functions/params");
const fetch = require("node-fetch");

// gemini-flash-latest: alias yang selalu menunjuk Flash terbaru — cepat & murah,
// cocok untuk ekstraksi terstruktur & ringkasan analitik.
const GEMINI_MODEL = "gemini-flash-latest";
const GEMINI_API_URL =
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

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

// ---------------------------------------------------------------------------
// Analisis keuangan berbasis AI (untuk Dashboard & Laporan)
//
// HEMAT TOKEN: klien mengirim RINGKASAN metrik yang sudah dihitung di sisi
// aplikasi (bukan ratusan transaksi mentah). Payload tipikal ±300 token,
// jadi biaya per analisis sangat kecil dan hasilnya tetap relevan karena
// angka yang dikirim sudah agregat & bermakna.
// ---------------------------------------------------------------------------

const INSIGHT_SCHEMA = {
  type: "OBJECT",
  properties: {
    headline: {
      type: "STRING",
      description: "Satu kalimat kondisi keuangan, maksimal 90 karakter",
    },
    health: {type: "STRING", enum: ["baik", "perlu-perhatian", "kritis"]},
    insights: {
      type: "ARRAY",
      description: "3-4 temuan penting",
      items: {
        type: "OBJECT",
        properties: {
          title: {type: "STRING"},
          detail: {type: "STRING", description: "1-2 kalimat, sebut angkanya"},
          type: {type: "STRING", enum: ["positif", "risiko", "peluang"]},
        },
        required: ["title", "detail", "type"],
      },
    },
    actions: {
      type: "ARRAY",
      description: "2-3 langkah konkret & spesifik",
      items: {type: "STRING"},
    },
  },
  required: ["headline", "health", "insights", "actions"],
};

const INSIGHT_PROMPT = `Anda analis keuangan untuk perusahaan kontraktor Indonesia.
Analisis ringkasan metrik berikut, lalu beri temuan yang actionable.
Aturan:
- Bahasa Indonesia, lugas, tanpa basa-basi.
- Sebut angka konkret (rupiah/persen) pada tiap temuan.
- Fokus: arus kas, penagihan, kepatuhan PPN, margin proyek.
- Jangan mengarang data yang tidak ada di ringkasan.
- Bila PPN dipungut belum disetor, itu risiko prioritas.

Ringkasan:
`;

exports.analyzeFinancialInsights = onCall(
    {cors: true, maxInstances: 5, secrets: [geminiApiKey]},
    async (request) => {
      if (!request.auth) {
        throw new HttpsError("unauthenticated", "Anda harus login.");
      }

      const apiKey = geminiApiKey.value();
      if (!apiKey) {
        throw new HttpsError("failed-precondition", "Fitur AI belum dikonfigurasi.");
      }

      const summary = request.data?.summary;
      if (!summary || typeof summary !== "object") {
        throw new HttpsError("invalid-argument", "Ringkasan metrik tidak ada.");
      }

      const body = {
        contents: [{
          parts: [{text: INSIGHT_PROMPT + JSON.stringify(summary)}],
        }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 700,
          responseMimeType: "application/json",
          responseSchema: INSIGHT_SCHEMA,
        },
      };

      try {
        const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
          method: "POST",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const errBody = await response.text();
          logger.error("Gemini insight gagal.", {status: response.status, body: errBody});
          throw new HttpsError("internal", `Gemini API error: ${response.status}`);
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new HttpsError("internal", "AI tidak memberi respons.");

        return {insight: JSON.parse(text), model: GEMINI_MODEL};
      } catch (error) {
        if (error instanceof HttpsError) throw error;
        logger.error("Kesalahan analisis AI:", error);
        throw new HttpsError("unknown", "Gagal menganalisis data keuangan.");
      }
    },
);
