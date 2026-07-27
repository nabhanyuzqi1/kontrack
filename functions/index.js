const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {logger} = require("firebase-functions");
const admin = require("firebase-admin");
const {getFirestore} = require("firebase-admin/firestore");
// Secret Manager (menggantikan defineString yang membaca .env plaintext ter-commit).
const {defineSecret} = require("firebase-functions/params");
// Node 22 sudah menyediakan fetch secara global — tidak perlu paket node-fetch
// (yang memang tidak terdaftar di dependencies dan membuat deploy gagal).

// gemini-flash-latest: alias yang selalu menunjuk Flash terbaru — cepat & murah,
// cocok untuk ekstraksi terstruktur & ringkasan analitik.
const GEMINI_MODEL = "gemini-flash-latest";
const GEMINI_API_URL =
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// Set nilainya sekali via: firebase functions:secrets:set GEMINI_API_KEY
const geminiApiKey = defineSecret("GEMINI_API_KEY");

// Seluruh sumber daya Kontrack berada di asia-southeast2 (Jakarta) — pengguna
// ada di Indonesia. us-central1 (Iowa) menambah ±200ms per panggilan.
const REGION = "asia-southeast2";
const TRANSACTION_AI_REGIONS = [REGION];

// Firestore & Storage Kontrack, keduanya di asia-southeast2.
// Database BUKAN "(default)" — itu database lama di asia-east1.
const FIRESTORE_DB = "kontrack";
const STORAGE_BUCKET = "kontrack";

admin.initializeApp({storageBucket: STORAGE_BUCKET});
const firestore = getFirestore(FIRESTORE_DB);

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
    {region: TRANSACTION_AI_REGIONS, cors: true, maxInstances: 5, secrets: [geminiApiKey]},
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
        const parsed = JSON.parse(text);
        const transactions = Array.isArray(parsed) ? parsed : [parsed];

        // Kompatibel dua arah:
        // - Kontrack baru membaca `transactions` (mendukung banyak gambar).
        // - Kontrack lama membaca `data` berupa string JSON satu objek.
        // Dengan menyertakan keduanya, aplikasi lama tetap berfungsi setelah
        // function ini di-deploy ulang.
        return {
          transactions,
          data: JSON.stringify(transactions[0] || {}),
        };
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
    {region: REGION, cors: true, maxInstances: 5, secrets: [geminiApiKey]},
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

// ---------------------------------------------------------------------------
// Fungsi warisan Kontrack lama, dipindah dari us-central1 ke asia-southeast2.
//
// Dua perbaikan dibanding versi live:
//  1. authenticateUser(request.context) → di Functions v2 `request` SUDAH
//     merupakan context, sehingga `request.context` selalu undefined dan
//     updateUserRole/addUserToCompany selalu gagal "unauthenticated".
//  2. Profil dicari lewat field `email`, bukan users/{uid}. Koleksi `users`
//     Kontrack memakai ID dokumen acak dengan field email — pencarian by-uid
//     tidak pernah menemukan siapa pun.
// ---------------------------------------------------------------------------

/** Ambil profil pemanggil dari koleksi `users`. */
const authenticateUser = async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Anda harus login.");
  }

  // Coba by-uid dulu (skema baru), lalu by-email (skema live).
  const byUid = await firestore.collection("users").doc(request.auth.uid).get();
  if (byUid.exists) return {uid: request.auth.uid, docId: byUid.id, ...byUid.data()};

  const email = request.auth.token?.email;
  if (email) {
    const snap = await firestore.collection("users").where("email", "==", email).limit(1).get();
    if (!snap.empty) {
      return {uid: request.auth.uid, docId: snap.docs[0].id, ...snap.docs[0].data()};
    }
  }

  throw new HttpsError("permission-denied", "Profil pengguna tidak ditemukan.");
};

const authorizeRole = (allowed) => (user) => {
  if (!allowed.includes(user.role)) {
    throw new HttpsError("permission-denied", "Peran Anda tidak berwenang untuk tindakan ini.");
  }
  return user;
};

/** Jejak audit — tidak boleh menggagalkan aksi utama bila penulisannya error. */
const logAuditEvent = async (eventType, details, request) => {
  try {
    await firestore.collection("audit_logs").add({
      eventType,
      details,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      ipAddress: request?.rawRequest?.ip || "unknown",
      userAgent: request?.rawRequest?.headers?.["user-agent"] || "unknown",
    });
  } catch (e) {
    logger.warn("Gagal menulis audit log:", e?.message || e);
  }
};

const guessContentType = (path = "", fallback = "application/octet-stream") => {
  const p = path.toLowerCase();
  if (p.endsWith(".png")) return "image/png";
  if (p.endsWith(".jpg") || p.endsWith(".jpeg")) return "image/jpeg";
  if (p.endsWith(".webp")) return "image/webp";
  if (p.endsWith(".gif")) return "image/gif";
  if (p.endsWith(".pdf")) return "application/pdf";
  return fallback;
};

/** Uraikan URL Storage (gs:// atau https://firebasestorage…) jadi {bucket, path}. */
const parseStorageUrl = (url = "") => {
  if (!url) return {bucket: "", path: ""};

  if (url.startsWith("gs://")) {
    const rest = url.slice(5);
    const i = rest.indexOf("/");
    return i === -1 ? {bucket: rest, path: ""} : {bucket: rest.slice(0, i), path: rest.slice(i + 1)};
  }

  try {
    const seg = new URL(url).pathname.split("/").filter(Boolean);
    const b = seg.indexOf("b");
    const o = seg.indexOf("o");
    return {
      bucket: b !== -1 && seg[b + 1] ? decodeURIComponent(seg[b + 1]) : "",
      path: o !== -1 && seg[o + 1] ?
        decodeURIComponent(seg[o + 1]) :
        decodeURIComponent(seg[seg.length - 1] || ""),
    };
  } catch (e) {
    logger.warn("URL Storage tidak dapat diurai", {url});
    return {bucket: "", path: ""};
  }
};

/**
 * Ambil berkas Storage sebagai data URL.
 * Dipakai generator PDF invoice: kop surat & tanda tangan harus tertanam
 * sebagai data URL karena jsPDF tidak bisa memuat gambar lintas-origin.
 */
exports.getStorageAssetDataUrl = onCall(
    {region: REGION, cors: true, maxInstances: 5},
    async (request) => {
      if (!request.auth) {
        throw new HttpsError("unauthenticated", "Anda harus login.");
      }

      const {path, url, bucket} = request.data || {};
      if (!path && !url) {
        throw new HttpsError("invalid-argument", "Parameter \"path\" atau \"url\" wajib diisi.");
      }

      const parsed = url ? parseStorageUrl(url) : {bucket: "", path: ""};
      const objectPath = (path || parsed.path || "").replace(/^gs:\/\//, "").replace(/^\/+/, "");

      // Bucket lama tetap diterima agar dokumen yang belum ditulis ulang
      // masih bisa dibaca; selain itu selalu jatuh ke bucket Kontrack.
      const resolvedBucket = bucket || parsed.bucket || STORAGE_BUCKET;

      if (!objectPath) {
        throw new HttpsError("invalid-argument", "Path berkas tidak dapat ditentukan.");
      }

      try {
        const file = admin.storage().bucket(resolvedBucket).file(objectPath);
        const [[metadata], [buffer]] = await Promise.all([file.getMetadata(), file.download()]);
        const contentType = metadata?.contentType || guessContentType(objectPath);

        return {
          dataUrl: `data:${contentType};base64,${buffer.toString("base64")}`,
          metadata: {
            contentType,
            size: Number(metadata?.size) || buffer.length,
            bucket: resolvedBucket,
            path: objectPath,
          },
        };
      } catch (error) {
        logger.error("Gagal mengambil berkas Storage", {
          bucket: resolvedBucket, path: objectPath, code: error?.code,
        });
        if (String(error?.code) === "404") {
          throw new HttpsError("not-found", "Berkas tidak ditemukan di Storage.");
        }
        throw new HttpsError("internal", "Gagal mengambil berkas dari Storage.");
      }
    },
);

/** Tambah pengguna baru ke perusahaan (admin/superadmin saja). */
exports.addUserToCompany = onCall(
    {region: REGION, cors: true, maxInstances: 5},
    async (request) => {
      const actor = authorizeRole(["admin", "superadmin"])(await authenticateUser(request));

      const {email, name, role = "staff", companyId} = request.data || {};
      if (!email) throw new HttpsError("invalid-argument", "Email wajib diisi.");

      if (role === "superadmin" && actor.role !== "superadmin") {
        throw new HttpsError("permission-denied", "Hanya superadmin yang boleh menetapkan peran superadmin.");
      }

      const existing = await firestore.collection("users").where("email", "==", email).limit(1).get();
      if (!existing.empty) {
        throw new HttpsError("already-exists", "Pengguna dengan email tersebut sudah ada.");
      }

      const ref = firestore.collection("users").doc();
      await ref.set({
        email,
        name: name || email,
        role,
        ...(companyId ? {companyId} : {}),
        createdBy: actor.uid,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      await logAuditEvent("USER_CREATED", {newUserId: ref.id, email, role, performedBy: actor.uid}, request);

      return {userId: ref.id, success: true};
    },
);

/** Ubah peran pengguna (admin/superadmin saja). */
exports.updateUserRole = onCall(
    {region: REGION, cors: true, maxInstances: 5},
    async (request) => {
      const actor = authorizeRole(["admin", "superadmin"])(await authenticateUser(request));

      const {userId, role, email} = request.data || {};
      if (!role) throw new HttpsError("invalid-argument", "Peran baru wajib diisi.");

      if (role === "superadmin" && actor.role !== "superadmin") {
        throw new HttpsError("permission-denied", "Hanya superadmin yang boleh menetapkan peran superadmin.");
      }

      // userId adalah ID dokumen; bila tidak ada, cari lewat email.
      let docId = userId;
      if (docId) {
        const d = await firestore.collection("users").doc(docId).get();
        if (!d.exists) docId = null;
      }
      if (!docId && email) {
        const snap = await firestore.collection("users").where("email", "==", email).limit(1).get();
        if (!snap.empty) docId = snap.docs[0].id;
      }
      if (!docId) throw new HttpsError("not-found", "Pengguna tidak ditemukan.");

      await firestore.collection("users").doc(docId).update({
        role,
        updatedBy: actor.uid,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      await logAuditEvent("USER_ROLE_UPDATE", {targetUserId: docId, newRole: role, performedBy: actor.uid}, request);

      return {success: true};
    },
);
