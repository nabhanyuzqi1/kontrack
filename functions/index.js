const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {logger} = require("firebase-functions");
const admin = require("firebase-admin");
const {getFirestore} = require("firebase-admin/firestore");
// Secret Manager (menggantikan defineString yang membaca .env plaintext ter-commit).
const {defineSecret} = require("firebase-functions/params");
const nodemailer = require("nodemailer");
const {tiffToPng, isTiff, isBigTiff} = require("./tiff");
// Node 22 sudah menyediakan fetch secara global — tidak perlu paket node-fetch
// (yang memang tidak terdaftar di dependencies dan membuat deploy gagal).

// gemini-flash-latest: alias yang selalu menunjuk Flash terbaru — cepat & murah,
// cocok untuk ekstraksi terstruktur & ringkasan analitik.
const GEMINI_MODEL = "gemini-flash-latest";
const GEMINI_API_URL =
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// Set nilainya sekali via: firebase functions:secrets:set GEMINI_API_KEY
const geminiApiKey = defineSecret("GEMINI_API_KEY");

// Kredensial SMTP untuk kirim email penagihan. Pakai Gmail App Password
// (bukan password akun) — set via:
//   firebase functions:secrets:set SMTP_USER
//   firebase functions:secrets:set SMTP_PASS
const smtpUser = defineSecret("SMTP_USER");
const smtpPass = defineSecret("SMTP_PASS");

// ---------------------------------------------------------------------------
// DUA JALUR MENUJU GEMINI
//
// 1. Vertex AI (UTAMA) — ditagih ke Cloud Billing proyek ini, sama seperti
//    Firestore/Functions. Tidak memakai API key sama sekali: otentikasinya
//    memakai service account function lewat metadata server, jadi tidak ada
//    kunci yang perlu dirotasi atau bisa bocor.
//
// 2. Gemini Developer API + API key (CADANGAN) — ditagih ke kredit prabayar
//    Google AI Studio. Inilah yang kehabisan kredit dan membuat fitur AI mati.
//
// Vertex dicoba lebih dulu; bila Vertex belum aktif di proyek (403/404), barulah
// jatuh ke API key. Dengan begitu fitur AI tidak lagi bergantung pada satu
// sumber tagihan.
// ---------------------------------------------------------------------------

// Vertex memakai nama model bertversi (bukan alias "-latest" milik Developer API).
const VERTEX_MODEL = "gemini-2.5-flash";
// Endpoint global: ketersediaan lebih baik daripada mengunci satu region, dan
// tidak membuat sumber daya baru di region mana pun.
const VERTEX_URL = () =>
  `https://aiplatform.googleapis.com/v1/projects/${process.env.GCLOUD_PROJECT}` +
  `/locations/global/publishers/google/models/${VERTEX_MODEL}:generateContent`;

/** Token service account function, diambil dari metadata server Cloud Run. */
const metadataToken = async () => {
  const res = await fetch(
      "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token",
      {headers: {"Metadata-Flavor": "Google"}},
  );
  if (!res.ok) throw new Error(`metadata token ${res.status}`);
  return (await res.json()).access_token;
};

/**
 * Panggil Gemini. Mengembalikan teks jawaban.
 * @param {object} body payload generateContent (contents + generationConfig)
 * @param {string} apiKey API key Developer API, dipakai hanya sebagai cadangan
 * @param {string} label untuk log
 */
const callGemini = async (body, apiKey, label) => {
  // Vertex menolak contents tanpa role ("Please use a valid role: user, model"),
  // sedangkan Developer API membolehkannya. Dinormalkan di sini supaya kedua
  // pemanggil tidak perlu tahu perbedaan itu.
  const payload = {
    ...body,
    contents: (body.contents || []).map((c) => ({role: "user", ...c})),
  };

  // --- Jalur 1: Vertex AI ---
  try {
    const token = await metadataToken();
    const res = await fetch(VERTEX_URL(), {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const data = await res.json();
      // parts[0] saja tidak cukup: dengan penalaran aktif, Gemini bisa
      // mengirim beberapa part teks. Mengambil hanya yang pertama berisiko
      // memotong JSON di tengah sehingga JSON.parse gagal.
      const cand = data.candidates?.[0];
      const text = (cand?.content?.parts || [])
        .map((p) => (typeof p.text === "string" ? p.text : ""))
        .join("")
        .trim();
      if (text) {
        // Dicatat supaya biaya bisa diaudit dari log, bukan ditebak.
        const u = data.usageMetadata || {};
        logger.info(
            `${label}: token in=${u.promptTokenCount} out=${u.candidatesTokenCount} ` +
            `think=${u.thoughtsTokenCount || 0} total=${u.totalTokenCount} finish=${cand?.finishReason || "-"}`,
        );
        return text;
      }
      logger.warn(`${label}: Vertex membalas tanpa teks (finish=${cand?.finishReason || "-"}), coba API key.`);
    } else {
      const errBody = await res.text();
      // 401/403/404 = Vertex belum aktif / SA belum diberi izin → wajar, mundur
      // ke API key. Status lain (429, 5xx) berarti Vertex aktif tetapi bermasalah,
      // dan itu harus dilaporkan apa adanya, bukan disamarkan.
      if (![401, 403, 404].includes(res.status)) {
        logger.error(`${label}: Vertex gagal.`, {status: res.status, body: errBody});
        throw geminiError(res.status, errBody);
      }
      logger.warn(`${label}: Vertex belum tersedia (${res.status}), memakai API key.`);
    }
  } catch (e) {
    if (e instanceof HttpsError) throw e;
    logger.warn(`${label}: Vertex tidak dapat dihubungi (${e?.message}), memakai API key.`);
  }

  // --- Jalur 2: Developer API + API key ---
  if (!apiKey) {
    throw new HttpsError(
        "failed-precondition",
        "Fitur AI belum dikonfigurasi: Vertex AI belum aktif dan GEMINI_API_KEY kosong.",
    );
  }

  const res = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errBody = await res.text();
    logger.error(`${label}: Gemini API gagal.`, {status: res.status, body: errBody});
    throw geminiError(res.status, errBody);
  }

  const data = await res.json();
  const cand = data.candidates?.[0];
  const text = (cand?.content?.parts || [])
    .map((p) => (typeof p.text === "string" ? p.text : ""))
    .join("")
    .trim();
  if (!text) {
    // finishReason diteruskan ke log: MAX_TOKENS (jatah habis) dan SAFETY
    // (ditolak filter) butuh tindakan berbeda, dan tanpa ini semuanya tampak
    // sebagai "AI tidak memberi respons".
    logger.error(`${label}: respons kosong.`, {finishReason: cand?.finishReason, usage: data.usageMetadata});
    throw new HttpsError(
        "internal",
        `AI tidak memberi respons (${cand?.finishReason || "tanpa finishReason"}). Coba lagi.`,
    );
  }
  return text;
};

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

// ---------------------------------------------------------------------------
// Kuota AI harian per pengguna
//
// Batas ditegakkan di SERVER. Menegakkannya di klien tidak ada artinya: siapa
// pun bisa memanggil callable ini langsung dan melewati UI.
//
// Angkanya dipasang jauh di bawah kuota gratis harian Gemini supaya satu
// pengguna tidak bisa menghabiskan jatah seluruh perusahaan dalam sekali duduk.
// ---------------------------------------------------------------------------

const DAILY_LIMITS = {
  image: 50, // analisis gambar transaksi (1 panggilan bisa memuat 8 gambar)
  insight: 20, // analisis keuangan Dashboard/Laporan
  email: 30, // kirim email penagihan (nodemailer + lampiran = mahal)
  asset: 500, // getStorageAssetDataUrl (download berkas untuk PDF)
  whatsapp: 30, // pesan WhatsApp lewat nomor resmi Kontrack
};

/** Tanggal WIB — pemakaian direset tengah malam waktu pengguna, bukan UTC. */
const jakartaDate = () =>
  new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);

/**
 * Tambah pemakaian & tolak bila kuota harian habis.
 *
 * Dijalankan dalam transaksi supaya dua permintaan bersamaan tidak sama-sama
 * lolos pada hitungan terakhir.
 *
 * @param {string} uid
 * @param {'image'|'insight'} kind
 * @param {number} cost jumlah unit yang dipakai panggilan ini
 */
const enforceDailyQuota = async (uid, kind, cost = 1) => {
  const limit = DAILY_LIMITS[kind];
  const day = jakartaDate();
  const ref = firestore.collection("ai_usage").doc(`${uid}_${day}`);

  const used = await firestore.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const current = snap.exists ? snap.data()[kind] || 0 : 0;

    if (current + cost > limit) return -1;

    tx.set(ref, {
      [kind]: current + cost,
      uid,
      day,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, {merge: true});

    return current + cost;
  });

  if (used === -1) {
    const label = {
      image: "analisis gambar",
      insight: "analisis keuangan",
      email: "kirim email",
      asset: "ambil berkas",
      whatsapp: "kirim WhatsApp",
    }[kind] || kind;
    throw new HttpsError(
        "resource-exhausted",
        `Kuota harian Anda habis (${limit} ${label} per hari). ` +
      "Kuota disetel ulang pukul 00:00 WIB.",
    );
  }

  logger.info(`Kuota AI ${kind} ${uid}: ${used}/${limit}`);
  // Sisa dikembalikan supaya pemanggil bisa menampilkan jatah tersisa.
  return {used, limit, remaining: Math.max(0, limit - used)};
};

// ---------------------------------------------------------------------------
// Validasi input callable
//
// Callable Functions v2 bisa dipanggil langsung dari klien mana pun yang punya
// ID token — UI bukan pembatas. Batas ukuran di peramban (kompresi WebP, maks 8
// gambar) karena itu harus diulang di sini: tanpa batas, satu permintaan bisa
// mengirim base64 raksasa dan membakar memori function sebelum Gemini menolak.
// ---------------------------------------------------------------------------

/** Batas ukuran payload setelah di-decode dari base64 (byte). */
const MAX_IMAGE_BYTES = 6 * 1024 * 1024; // satu gambar: 6 MB (WebP hasil kompresi < 1 MB)
const MAX_IMAGES_TOTAL_BYTES = 24 * 1024 * 1024; // delapan gambar dalam satu panggilan
const MAX_SUMMARY_CHARS = 12000; // ringkasan metrik ~300 token; 12 KB sudah sangat longgar
const MAX_STORAGE_ASSET_BYTES = 15 * 1024 * 1024; // kop surat / tanda tangan / lampiran PDF
const MIME_IMAGE = /^image\/(png|jpe?g|webp|heic|heif|gif)$/i;

/** Panjang base64 tanpa mengubah string (lebih murah daripada decoding). */
const base64Bytes = (b64) => {
  const s = String(b64);
  const pad = s.endsWith("==") ? 2 : s.endsWith("=") ? 1 : 0;
  return Math.floor((s.length * 3) / 4) - pad;
};

/**
 * Validasi satu gambar base64 + mimeType.
 * Mengembalikan jumlah byte supaya pemanggil bisa menjumlahkan total.
 */
const assertInlineImage = (img, label = "Gambar") => {
  if (!img || typeof img !== "object") {
    throw new HttpsError("invalid-argument", `${label} harus berupa objek {base64String, mimeType}.`);
  }
  if (typeof img.base64String !== "string" || img.base64String.length === 0) {
    throw new HttpsError("invalid-argument", `${label} tidak berisi data (base64String).`);
  }
  if (typeof img.mimeType !== "string" || !MIME_IMAGE.test(img.mimeType)) {
    throw new HttpsError("invalid-argument", `${label}: mimeType hanya boleh gambar (png/jpg/webp).`);
  }
  // Data URL lengkap ("data:image/webp;base64,...") bukan bentuk yang dijanjikan
  // kontrak klien; menolaknya lebih jelas daripada meneruskan string rusak ke Gemini.
  if (img.base64String.startsWith("data:")) {
    throw new HttpsError("invalid-argument", `${label}: kirim base64 tanpa prefiks "data:".`);
  }
  const bytes = base64Bytes(img.base64String);
  if (bytes > MAX_IMAGE_BYTES) {
    throw new HttpsError("invalid-argument", `${label} melebihi batas 6 MB setelah dikompresi.`);
  }
  return bytes;
};

/** Panjang teks setelah dipangkas, tanpa mengubah nilainya. */
const assertText = (value, field, {max = 500, required = true} = {}) => {
  if (value === undefined || value === null || value === "") {
    if (required) throw new HttpsError("invalid-argument", `${field} wajib diisi.`);
    return "";
  }
  if (typeof value !== "string") {
    throw new HttpsError("invalid-argument", `${field} harus berupa teks.`);
  }
  if (value.length > max) {
    throw new HttpsError("invalid-argument", `${field} maksimal ${max} karakter.`);
  }
  return value;
};

/** Satu alamat email, bentuk ringan (nodemailer yang memvalidasi sisanya). */
const EMAIL_RE = /^[^\s@,<>]+@[^\s@,<>]+\.[^\s@,<>]+$/;
const assertEmail = (value, field, {required = true} = {}) => {
  if (value === undefined || value === null || value === "") {
    if (!required) return "";
    throw new HttpsError("invalid-argument", `${field} wajib diisi.`);
  }
  const s = String(value).trim();
  if (s.length > 254 || !EMAIL_RE.test(s)) {
    throw new HttpsError("invalid-argument", `${field} bukan alamat email yang valid.`);
  }
  return s;
};

/** Daftar email dipisah koma (cc/replyTo). Maksimal 5 penerima. */
const assertEmailList = (value, field) => {
  if (!value) return "";
  const parts = String(value).split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length > 5) {
    throw new HttpsError("invalid-argument", `${field} maksimal 5 alamat.`);
  }
  parts.forEach((p) => assertEmail(p, field));
  return parts.join(", ");
};

/**
 * Terjemahkan kegagalan Gemini menjadi pesan yang bisa ditindaklanjuti.
 * Tanpa ini, semua kegagalan tampil sebagai "AI tidak aktif" di aplikasi dan
 * penyebab sebenarnya (kredit habis, key salah, model pensiun) hanya terlihat
 * di Cloud Logging.
 */
const geminiError = (status, body) => {
  const text = String(body || "");

  if (status === 429) {
    if (/prepayment credits are depleted|RESOURCE_EXHAUSTED/i.test(text) &&
        /credits/i.test(text)) {
      return new HttpsError(
          "resource-exhausted",
          "Kredit Gemini habis. Isi ulang saldo di Google AI Studio " +
        "(ai.studio/projects) agar fitur AI aktif kembali.",
      );
    }
    return new HttpsError(
        "resource-exhausted",
        "Kuota AI sedang penuh. Coba lagi beberapa saat lagi.",
    );
  }

  if (status === 400 && /API key not valid/i.test(text)) {
    return new HttpsError(
        "failed-precondition",
        "API key Gemini tidak valid. Perbarui secret GEMINI_API_KEY.",
    );
  }

  if (status === 403) {
    return new HttpsError(
        "permission-denied",
        "API key Gemini ditolak. Pastikan Generative Language API aktif " +
      "untuk proyek pemilik key tersebut.",
    );
  }

  if (status === 404) {
    return new HttpsError(
        "failed-precondition",
        `Model AI "${GEMINI_MODEL}" tidak tersedia. Model mungkin sudah ` +
      "dihentikan Google — perbarui GEMINI_MODEL.",
    );
  }

  if (status >= 500) {
    return new HttpsError(
        "unavailable",
        "Layanan Gemini sedang bermasalah. Coba lagi beberapa saat lagi.",
    );
  }

  return new HttpsError("internal", `Gemini API error: ${status}`);
};

// Schema output (enum + tipe) → menegakkan struktur tanpa prompt panjang = hemat token.
//
// `category` WAJIB enum, bukan STRING bebas. Sebelumnya model bebas mengarang
// kategori ("Bon", "Konsumsi", "Transport") sehingga hasil analisis tidak cocok
// dengan daftar kategori aplikasi dan harus dibetulkan manual satu per satu.
const RESPONSE_SCHEMA = {
  type: "ARRAY",
  items: {
    type: "OBJECT",
    properties: {
      date: {
        type: "STRING",
        description:
          "Tanggal transaksi pada dokumen, format YYYY-MM-DD. Kosongkan bila dokumen benar-benar tidak memuat tanggal.",
      },
      time: {
        type: "STRING",
        description:
          "Jam transaksi HH:MM 24 jam bila tertera (termasuk jam cetak mesin EDC/ATM). Kosongkan bila hanya ada tanggal.",
      },
      amount: {
        type: "NUMBER",
        description: "Jumlah akhir yang dibayar/diterima, angka murni tanpa pemisah ribuan.",
      },
      type: {type: "STRING", enum: ["income", "expense"]},
      category: {
        type: "STRING",
        enum: [
          "Proyek",
          "Pembayaran Invoice",
          "Lainnya",
          "Operasional",
          "Material",
          "Upah Karyawan/Tukang",
          "Pajak",
          "Pengeluaran Lain",
        ],
      },
      description: {
        type: "STRING",
        description:
          "Ringkasan isi dokumen + catatan/berita transfer apa adanya, termasuk rincian barang bila ada.",
      },
      vendor: {
        type: "STRING",
        description: "Nama toko/penerima/pihak lawan bila tertera.",
      },
      paymentMethod: {
        type: "STRING",
        enum: ["tunai", "transfer", "qris", "lainnya"],
        description: "Cara bayar bila terbaca",
      },
      confidence: {
        type: "STRING",
        enum: ["yakin", "ragu"],
        description:
          "yakin bila dokumen jelas terbaca; ragu bila ada bagian penting yang tidak terbaca.",
      },
      reasoning: {
        type: "STRING",
        description:
          "Satu kalimat: kata kunci/bagian dokumen yang menjadi dasar kategori dan tanggal dipilih.",
      },
    },
    // `reasoning` diminta SEBELUM keputusan agar model berpikir dulu baru
    // memutuskan, bukan membenarkan pilihan yang sudah diambil.
    propertyOrdering: ["reasoning", "date", "time", "amount", "type", "category", "description", "vendor", "paymentMethod", "confidence"],
    required: ["amount", "type", "category", "description"],
  },
};


// ---------------------------------------------------------------------------
// Pengaman hasil analisis gambar
//
// responseSchema membuat JSON hampir selalu valid, tetapi "hampir" tidak cukup
// bila hasilnya langsung masuk ke dokumen transaksi. Tiga kegagalan nyata yang
// ditutup di sini:
// 1. Model membungkus JSON dengan pagar markdown atau kalimat pengantar →
//    JSON.parse gagal dan seluruh analisis hilang.
// 2. Satu gambar menghasilkan objek tunggal, bukan array.
// 3. Nominal terbaca sebagai teks ("Rp1.350.000", "1,5 jt") atau negatif,
//    sehingga jumlahnya masuk sebagai 0 dan transaksi tampak tanpa nilai.
// ---------------------------------------------------------------------------

/** Buang pagar markdown dan ambil bagian array/objek JSON saja. */
const extractJson = (raw) => {
  let text = String(raw || "").trim();
  if (!text) return null;

  // Pagar ```json ... ``` atau ``` ... ```
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();

  try {
    return JSON.parse(text);
  } catch (e) {
    // Kalimat pengantar sebelum JSON: ambil dari '[' pertama sampai ']' terakhir.
    const startArr = text.indexOf("[");
    const endArr = text.lastIndexOf("]");
    if (startArr !== -1 && endArr > startArr) {
      try {
        return JSON.parse(text.slice(startArr, endArr + 1));
      } catch (e2) { /* lanjut ke objek */ }
    }
    const startObj = text.indexOf("{");
    const endObj = text.lastIndexOf("}");
    if (startObj !== -1 && endObj > startObj) {
      try {
        return JSON.parse(text.slice(startObj, endObj + 1));
      } catch (e3) { /* menyerah */ }
    }
    return null;
  }
};

/** Nominal dari teks bebas: "Rp1.350.000" → 1350000, "1,5 jt" → 1500000. */
const toAmount = (value) => {
  if (typeof value === "number") return Number.isFinite(value) ? Math.abs(Math.round(value)) : 0;
  let raw = String(value == null ? "" : value).toLowerCase().trim();
  if (!raw) return 0;

  // Satuan singkat yang lazim di nota: "1,5 jt", "450rb", "200k".
  let mult = 1;
  if (/juta|(^|[^a-z])jt([^a-z]|$)/.test(raw)) mult = 1000000;
  else if (/ribu|(^|[^a-z])rb([^a-z]|$)/.test(raw)) mult = 1000;
  else if (/(^|[^a-z])k([^a-z]|$)/.test(raw)) mult = 1000;

  let num = raw.replace(/[^0-9.,]/g, "");
  if (!num) return 0;

  if (mult > 1) {
    // Satuan: satu pemisah adalah desimal ("2.5 jt" -> 2.5), pemisah
    // berulang adalah ribuan ("1.200 jt" -> 1200).
    if ((num.match(/[.,]/g) || []).length > 1) num = num.replace(/[.,]/g, "");
    else num = num.replace(/,/g, ".");
  } else {
    // Tanpa satuan: titik DAN koma adalah pemisah ribuan. Desimal pada nota
    // ("1.200.000,00") dibuang, karena rupiah transaksi selalu utuh.
    const koma = num.lastIndexOf(",");
    const titik = num.lastIndexOf(".");
    if (koma > titik && num.length - koma - 1 === 2) {
      num = num.slice(0, koma).replace(/[.,]/g, "") + "." + num.slice(koma + 1);
    } else {
      num = num.replace(/[.,]/g, "");
    }
  }
  const n = Number(num);
  return Number.isFinite(n) ? Math.abs(Math.round(n * mult)) : 0;
};


const KATEGORI_SAH = [
  "Proyek", "Pembayaran Invoice", "Lainnya", "Operasional",
  "Material", "Upah Karyawan/Tukang", "Pajak", "Pengeluaran Lain",
];

/**
 * Rapikan satu objek hasil model.
 * Tidak mengarang nilai: tanggal/jam yang tidak terbaca dikosongkan, bukan
 * diisi tanggal hari ini (pemilik yang memutuskan).
 */
const sanitizeTx = (item) => {
  if (!item || typeof item !== "object") return null;

  let category = String(item.category || "").trim();
  if (!KATEGORI_SAH.includes(category)) category = "Pengeluaran Lain";

  const dateRaw = String(item.date || "").trim();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(dateRaw) ? dateRaw : "";
  let time = String(item.time || "").trim();
  if (!/^\d{1,2}:\d{2}$/.test(time)) time = "";

  const amount = toAmount(item.amount);
  const type = item.type === "income" ? "income" : "expense";

  const method = String(item.paymentMethod || "").toLowerCase();
  const paymentMethod = ["tunai", "transfer", "qris", "lainnya"].includes(method) ? method : "lainnya";

  // `reasoning` dan `confidence` dibuang sebelum dikirim ke klien: keduanya
  // hanya untuk audit, dan klien tidak membutuhkannya di dokumen transaksi.
  return {
    date,
    time,
    amount,
    type,
    category,
    description: String(item.description || "").trim().slice(0, 400),
    vendor: String(item.vendor || "").trim().slice(0, 160),
    paymentMethod,
    confidence: item.confidence === "ragu" ? "ragu" : "yakin",
    reasoning: String(item.reasoning || "").trim().slice(0, 300),
  };
};

// Prompt: penalaran penuh. Presisi dokumen diserahkan ke model, dan UI hanya
// memverifikasi hasilnya; karena itu token penalaran DIPAKAI (thinkingBudget > 0),
// bukan dimatikan seperti pada mode ekstraksi kaku sebelumnya.
//
// Kenapa prompt ini panjang: setiap aturan di bawah menutup kesalahan nyata yang
// terjadi di lapangan (bon gendro terbaca "Pengeluaran Lain", jam transfer hilang,
// angka pada struk EDC diambil dari baris yang salah, tanggal nota dibaca sebagai
// hari ini). Prompt panjang di sini LEBIH MURAH daripada salah kategori yang
// harus dibetulkan manual oleh pemilik.
const PROMPT = `Anda petugas akuntansi yang membaca dokumen keuangan proyek konstruksi Indonesia. Tugas: ubah SETIAP gambar menjadi data transaksi yang AKURAT. Satu objek per gambar, urut sesuai urutan gambar.

Berpikir dulu, baru simpulkan. Isi "reasoning" dulu (satu kalimat: bagian dokumen mana yang Anda baca untuk menentukan jenis, kategori, dan tanggal), baru isi field lainnya.

=== 1. KENALI JENIS DOKUMEN DULU ===
Tentukan lebih dulu gambar ini termasuk:
a) NOTA/BON/KWITANSI tulis tangan atau cetak (toko bangunan, bengkel, warung, kuitansi pembayaran upah).
b) BUKTI TRANSFER bank/mobile banking (ada "Transaksi Berhasil", "Berhasil", "Transfer ke", "No. Referensi", "NTPN").
c) STRUK EDC/QRIS (ada merchant, "QRIS", "Approval Code", "Card No").
d) FAKTUR/NOTES penjualan (ada nomor faktur, daftar barang, total).
e) TANDA TERIMA / SURAT JALAN (barang diserahkan, belum tentu ada harga).
f) INVOICE TAGIHAN (dokumen yang KITA terbitkan ke klien: ada nomor invoice, "Tagihan", "Termin").

Jenis dokumen menentukan cara membaca angka dan kategori. Jangan menyamakan bukti transfer dengan nota: bukti transfer biasanya HANYA memuat jumlah + catatan singkat, sedangkan nota memuat rincian barang.

=== 2. ANGKA (amount) — paling sering salah ===
- Ambil JUMLAH AKHIR yang benar-benar dibayar: "Total", "Grand Total", "Jumlah Transfer", "Nominal", "Total Bayar".
- JANGAN ambil: subtotal, DPP, PPN/pajak terpisah, "sisa saldo", "saldo akhir", nomor referensi, nomor rekening, atau angka pada baris diskon.
- Bila ada diskon, jumlah akhir = total dikurangi diskon. Bila ada PPN pada nota pembelian, jumlah yang dibayar SUDAH termasuk PPN (pakai baris total).
- Bila "Total" dan "Jumlah Transfer" berbeda pada satu dokumen, yang dibayar adalah jumlah transfer.
- Angka murni tanpa titik/koma pemisah ribuan. "Rp1.350.000" menjadi 1350000. "1,5 jt" menjadi 1500000. "450rb" menjadi 450000.
- Bila jumlah ditulis dengan huruf ("empat juta lima ratus ribu rupiah"), baca huruf itu.

=== 3. KATEGORI — putuskan dari MAKNA, bukan dari tampilan ===
Aturan tafsir (bukan daftar hafalan, gunakan penalaran):
- UPAH/TUKANG: uang keluar untuk TENAGA ORANG. Sinyal: bon/gendro/kendro, upah, honor, ongkos, opah, tukang, mandor, kuli, pekerja, borongan, harian/lepas, lembur, premi, uang makan tukang, kerja bakti, gaji, THR, atau TRANSFER KE NAMA ORANG PERORANGAN yang dibayar untuk pekerjaan. Kata "bon" dan "gendro" SENDIRIAN sudah cukup: "byr bon gendro", "BON GENDRO", "bon mandor", "upah hr" semuanya Upah Karyawan/Tukang.
- MATERIAL: barang habis pakai untuk pekerjaan. Sinyal: semen, pasir, batu/split, besi, beton, baja, kayu, papan, triplek, cat, pipa, keramik, genteng, paku, kawat, kabel, alat, atau nama toko bangunan/material ("Toko Sumber Rejeki", "UD Bangunan").
- OPERASIONAL: biaya menjalankan usaha, bukan bahan dan bukan tenaga. Sinyal: BBM/solar/bensin/pertalite/pertamax, tol, parkir, transport, sewa alat/mobil, konsumsi/makan rapat, ATK, listrik, air, telepon/pulsa, admin bank, materai, jasa non-tenaga (konsultan, notaris, survey, pengurusan izin).
- PAJAK: setoran ke negara. Sinyal: PPN, PPh, setoran pajak, kode billing, NTPN, faktur pajak, DJP, kas negara, MPN G3.
- PEMBAYARAN INVOICE (income): uang MASUK dari mitra atas termin/invoice proyek.
- PROYEK (income): uang muka/DP/pencairan proyek di luar invoice.
- LAINNYA (income): uang masuk yang bukan proyek.
- PENGELUARAN LAIN: HANYA bila setelah menimbang seluruh isi dokumen, pengeluaran itu memang tidak termasuk kategori di atas.

Kata kunci pada catatan/berita transfer MENANG atas kesan umum gambar. Bukti transfer bertuliskan "BON GENDRO" adalah upah, walaupun tampilannya dokumen bank.

=== 4. TANGGAL & JAM — baca yang tertulis, jangan mengarang ===
- Ambil tanggal TRANSAKSI: pada bukti transfer pakai tanggal/jam transaksi ("Tanggal", "Waktu", "Transaction Date"), BUKAN tanggal cetak/unduh.
- Pada nota tulis tangan, tanggal biasanya di sudut atas; bisa "12/11/26", "12-11-26", "12 Nov 2026", "12/11/2026".
- Nota Indonesia menulis HARI dulu: 12/11/2026 = 12 November 2026. Bila angka pertama > 12, itu jelas tanggal.
- Tahun dua angka: 26 = 2026.
- time: hanya bila jamnya tertulis (termasuk jam cetak EDC/ATM, "15:30:12 WIB"). Bila hanya tanggal, kosongkan time. JANGAN mengarang jam.
- Bila dokumen sama sekali tanpa tanggal, kosongkan date. JANGAN memakai tanggal hari ini, dan jangan menebak dari nomor dokumen.
- Bila ada dua tanggal (tanggal nota dan tanggal jatuh tempo), pakai tanggal nota.

=== 5. ARAH DANA (type) ===
"income" bila uang MASUK ke rekening kita: ada "CR", "Kredit", "Dana Masuk", "Terima dari", "Transfer Masuk", atau pembayaran dari mitra.
"expense" bila uang KELUAR: "DB", "Debit", "Transfer ke", pembayaran ke toko/orang.
Nota belanja dan kuitansi pembayaran selalu expense.

=== 6. DESKRIPSI & VENDOR ===
- description: SATU frasa padat, maks 6 kata. Sebutkan APA yang dibeli/dibayar, tidak lebih.
  JANGAN jelaskan konteks, alasan, atau rincian perhitungan (mis. "biaya admin bulanan
  untuk operasional proyek" → cukup "Biaya admin"). PERTAHANKAN kata kunci upah/material
  apa adanya ("bon gendro"), karena itu yang dipakai menentukan kategori.
  Contoh baik: "Bon gendro", "Semen 20 sak", "Solar 40 L", "Termin 2 SPK-041", "Upah 3 tukang".
- vendor: nama toko/penerima/pihak lawan bila tertera. Pada bukti transfer, nama PENERIMA (bukan pengirim). Bila hanya ada nama bank, kosongkan.
- paymentMethod: tunai, transfer, qris, atau lainnya — sesuai bukti pada dokumen.

=== CONTOH PENALARAN (bukan untuk dihafal) ===
1. Bukti transfer bank, catatan "BON GENDRO", nominal Rp5.000.000, tanggal 12/11/2026 15:30 → reasoning: "Bukti transfer dengan catatan bon gendro, yaitu pembayaran upah tukang." → expense, Upah Karyawan/Tukang, 5000000, 2026-11-12, 15:30.
2. Nota tulis tangan "Bon upah 3 tukang 450rb" → expense, Upah Karyawan/Tukang, 450000.
3. Nota toko "Semen 20 sak, Total Rp1.300.000" → expense, Material, 1300000.
4. Bukti transfer ke "Toko Sumber Rejeki", catatan "semen 20 sak" → expense, Material.
5. Struk EDC QRIS "Total Rp275.000" di SPBU → expense, Operasional (BBM).
6. Transfer masuk dari "KUASA PENGGUNA ANGGARAN" catatan "TERMIN 2" → income, Pembayaran Invoice.
7. Nota tanpa tanggal, hanya "Bon material 2 juta" → date kosong, jangan mengarang.

Bila ada bagian penting yang tidak terbaca (nominal atau tanggal), isi confidence "ragu" dan sebutkan di description apa yang tidak terbaca.`;

exports.analyzeTransactionImageWithAI = onCall(
    // timeout + memory: 8 gambar hingga ~24 MB harus diurai di memori sebelum
    // dikirim ke Gemini. Batas lama (default 60 detik) memotong panggilan lambat.
    {region: TRANSACTION_AI_REGIONS, cors: true, maxInstances: 5, memory: "1GiB", timeoutSeconds: 180, secrets: [geminiApiKey]},
    async (request) => {
      // Wajib login — cegah pemakaian kuota Gemini oleh pihak luar.
      if (!request.auth) {
        throw new HttpsError("unauthenticated", "Anda harus login untuk memakai fitur AI.");
      }

      // API key opsional: hanya dipakai bila Vertex AI belum aktif.
      const apiKey = geminiApiKey.value();

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

      // Validasi SEMUA gambar (tipe, mime, ukuran) SEBELUM kuota dipotong:
      // permintaan cacat tidak boleh menghabiskan jatah harian pengguna.
      let totalBytes = 0;
      images.forEach((img, i) => {
        totalBytes += assertInlineImage(img, `Gambar ${i + 1}`);
      });
      if (totalBytes > MAX_IMAGES_TOTAL_BYTES) {
        throw new HttpsError("invalid-argument", "Total ukuran gambar melebihi 24 MB.");
      }

      // Kuota dipotong SEBELUM memanggil Gemini — kalau dipotong sesudah,
      // permintaan yang gagal di tengah tetap membakar biaya tanpa tercatat.
      await enforceDailyQuota(request.auth.uid, "image", images.length);

      // Satu request Gemini berisi prompt + semua gambar → hemat biaya (prompt dipakai bersama).
      const parts = [{text: PROMPT}];
      for (const img of images) {
        parts.push({inlineData: {mime_type: img.mimeType, data: img.base64String}});
      }

      const requestBody = {
        contents: [{parts}],
        generationConfig: {
          // 0.2 → 0.1: pembacaan dokumen menuntut konsistensi, bukan variasi.
          temperature: 0.1,
          topK: 1,
          topP: 0.95,
          // +1024 token per gambar di atas anggaran lama: memuat penalaran
          // (`reasoning`) dan field tambahan (vendor/confidence) tanpa memotong
          // jawaban. Batas tetap ada supaya satu panggilan tidak melar.
          maxOutputTokens: 1024 * images.length,
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA,
          // Penalaran AKTIF. Sebelumnya 0 karena ekstraksi dianggap kaku, dan
          // akibatnya dokumen ambigu (nota tulis tangan, bukti transfer dengan
          // catatan singkat) dipaksa ke kategori aman "Pengeluaran Lain".
          // Anggaran dibatasi, bukan tak terbatas: cukup untuk menimbang bukti,
          // tidak sampai menghabiskan maxOutputTokens (yang membuat jawaban
          // kosong, finishReason MAX_TOKENS).
          thinkingConfig: {thinkingBudget: 512},
        },
      };

      logger.info(`Analisis ${images.length} gambar via Gemini.`);

      try {
        const text = await callGemini(requestBody, apiKey, "analyzeTransactionImage");

        // `responseSchema` mengurangi kesalahan, tetapi tidak boleh dipercaya
        // sebagai jaminan absolut: panggilan bisa dipindah ke model lain, dan
        // model tetap dapat mengirim pagar markdown/pengantar.
        const parsed = extractJson(text);
        if (!parsed) {
          logger.error("AI mengembalikan JSON yang tidak dapat dipulihkan.", {text: String(text).slice(0, 1000)});
          throw new HttpsError(
              "data-loss",
              "AI membaca gambar tetapi format hasilnya tidak valid. Coba ulangi atau unggah gambar lebih jelas.",
          );
        }
        const candidates = Array.isArray(parsed) ? parsed : [parsed];
        const transactions = candidates.map(sanitizeTx).filter(Boolean);
        if (transactions.length !== images.length) {
          logger.warn(`Jumlah hasil (${transactions.length}) tidak sama dengan gambar (${images.length}).`);
        }
        if (!transactions.length) {
          throw new HttpsError("data-loss", "AI tidak menghasilkan data transaksi yang valid. Coba ulangi.");
        }

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
// Kirim email penagihan lengkap dengan lampiran berkas (WPHO, BAHK, PK,
// INVOICE, FAKTUR). Lampiran diunduh dari Cloud Storage memakai URL yang
// tersimpan di dokumen invoice.
// ---------------------------------------------------------------------------

/** Unduh satu URL menjadi Buffer. Mendukung URL Firebase Storage. */
const fetchAttachment = async (url, name) => {
  // Batasi skema & host: hanya URL Firebase Storage yang sah. Tanpa ini, fungsi
  // bisa dipakai sebagai SSRF untuk memanggil endpoint internal/metadata server
  // (memakai kredensial service account function) dari lampiran yang dikirim klien.
  let parsed;
  try {
    parsed = new URL(String(url));
  } catch (e) {
    throw new HttpsError("invalid-argument", `URL lampiran ${name} tidak valid.`);
  }
  if (parsed.protocol !== "https:") {
    throw new HttpsError("invalid-argument", `URL lampiran ${name} harus https.`);
  }
  const host = parsed.hostname;
  const allowedHost =
    host === "firebasestorage.googleapis.com" ||
    host === "storage.googleapis.com" ||
    host.endsWith(".firebasestorage.app");
  if (!allowedHost) {
    throw new HttpsError("invalid-argument", `URL lampiran ${name} bukan dari Firebase Storage.`);
  }

  const res = await fetch(parsed.href);
  if (!res.ok) throw new Error(`Gagal mengunduh lampiran ${name}: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  return {filename: name || "lampiran", content: buf};
};

exports.sendInvoiceEmail = onCall(
    {region: TRANSACTION_AI_REGIONS, cors: true, maxInstances: 5, timeoutSeconds: 120, secrets: [smtpUser, smtpPass]},
    async (request) => {
      if (!request.auth) {
        throw new HttpsError("unauthenticated", "Anda harus login untuk mengirim email.");
      }

      const data = request.data || {};
      const to = assertEmail(data.to, "Alamat email tujuan");
      const cc = assertEmailList(data.cc, "Alamat cc");
      const replyTo = assertEmailList(data.replyTo, "Alamat reply-to");
      const subject = assertText(data.subject === undefined ? "Penagihan" : data.subject, "Subjek", {max: 200});
      const body = assertText(data.body, "Isi email", {max: 20000, required: false});
      const attachments = Array.isArray(data.attachments) ? data.attachments : [];

      if (!smtpUser.value() || !smtpPass.value()) {
        throw new HttpsError(
            "failed-precondition",
            "SMTP belum dikonfigurasi. Pemilik perlu menyetel secret SMTP_USER dan SMTP_PASS.",
        );
      }

      // Kuota harian: kirim email (SMTP + unduh lampiran) adalah operasi mahal.
      await enforceDailyQuota(request.auth.uid, "email");

      // Batasi jumlah & ukuran lampiran: total maksimal ~20 MB.
      let totalBytes = 0;
      const files = [];
      for (const att of attachments.slice(0, 12)) {
        if (!att || !att.url) continue;
        const file = await fetchAttachment(att.url, att.name);
        totalBytes += file.content.length;
        if (totalBytes > 20 * 1024 * 1024) {
          throw new HttpsError("invalid-argument", "Total lampiran melebihi 20 MB.");
        }
        files.push(file);
      }

      const transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        auth: {user: smtpUser.value(), pass: smtpPass.value()},
      });

      try {
        const info = await transporter.sendMail({
          from: smtpUser.value(),
          to,
          cc: cc || undefined,
          replyTo: replyTo || smtpUser.value(),
          subject,
          text: body || "",
          html: body ? `<div style="font-family:Arial,sans-serif;font-size:14px;white-space:pre-wrap">${String(body).replace(/[<>]/g, "")}</div>` : undefined,
          attachments: files,
        });
        logger.info(`Email penagihan terkirim: ${info.messageId}`);
        return {messageId: info.messageId, accepted: info.accepted || [], attachmentCount: files.length};
      } catch (error) {
        // Jangan bocorkan pesan SMTP mentah ke klien (bisa memuat detail server);
        // detail lengkap tetap masuk Cloud Logging untuk pemilik.
        logger.error("Gagal kirim email:", error);
        throw new HttpsError("internal", "Gagal mengirim email. Periksa konfigurasi SMTP atau coba lagi.");
      }
    },
);

// ---------------------------------------------------------------------------
// Scan dokumen WPHO / BAST (Berita Acara Hasil Kerja / BAST kontraktor).
// Ekstrak nomor BA, nilai pekerjaan, nama pekerjaan, tanggal, dan referensi
// kontrak/PK — dipakai form invoice untuk mengisi otomatis item pekerjaan.
// ---------------------------------------------------------------------------

const WPHO_SCHEMA = {
  type: "OBJECT",
  properties: {
    wphoNumber: {type: "STRING", description: "Nomor BA/WPHO, kosongkan bila tak ada"},
    amount: {type: "NUMBER", description: "Nilai total pekerjaan (Jumlah), angka murni tanpa pemisah"},
    workName: {type: "STRING", description: "Nama/uraian pekerjaan"},
    date: {type: "STRING", description: "Tanggal BA, ISO 8601, kosongkan bila tak ada"},
    contractNumber: {type: "STRING", description: "Nomor kontrak, kosongkan bila tak ada"},
    pkNumber: {type: "STRING", description: "Nomor PK, kosongkan bila tak ada"},
  },
  required: ["wphoNumber", "amount", "workName"],
};

// Skema untuk foto/scan Faktur Pajak (e-Faktur/CoreTax).
const FAKTUR_SCHEMA = {
  type: "OBJECT",
  properties: {
    taxInvoiceNumber: {type: "STRING", description: "Kode dan nomor seri faktur pajak, kosongkan bila tak ada"},
    amount: {type: "NUMBER", description: "Harga jual/penggantian/termin (Rp), angka murni tanpa pemisah"},
    workName: {type: "STRING", description: "Nama barang/jasa kena pajak"},
    date: {type: "STRING", description: "Tanggal faktur, ISO 8601, kosongkan bila tak ada"},
  },
  required: ["taxInvoiceNumber", "amount", "workName"],
};

const WPHO_PROMPT = `Ekstrak data dari dokumen WPHO/BAST (Berita Acara Hasil Kerja) kontraktor.
Aturan:
- wphoNumber: nomor BA/WPHO (bukan nomor kontrak).
- amount: nilai "Jumlah"/"Total" pekerjaan (SEBELUM PPN), angka murni tanpa titik/koma desimal.
- workName: nama pekerjaan dari kolom Kegiatan/Keterangan.
- date: tanggal BA (Tanggal BA), format YYYY-MM-DD.`;

const FAKTUR_PROMPT = `Ekstrak data dari Faktur Pajak (e-Faktur/CoreTax).
Aturan:
- taxInvoiceNumber: "Kode dan Nomor Seri Faktur Pajak".
- amount: "Harga Jual / Penggantian / Uang Muka / Termin" (Rp), angka murni tanpa pemisah.
- workName: nama barang/jasa kena pajak dari tabel rincian.
- date: tanggal faktur, format YYYY-MM-DD.`;
exports.scanWphoDocument = onCall(
    {region: TRANSACTION_AI_REGIONS, cors: true, maxInstances: 5, timeoutSeconds: 120, secrets: [geminiApiKey]},
    async (request) => {
      if (!request.auth) {
        throw new HttpsError("unauthenticated", "Anda harus login untuk memakai fitur AI.");
      }

      const apiKey = geminiApiKey.value();
      const {base64String, mimeType, kind = "wpho"} = request.data || {};
      if (kind !== "wpho" && kind !== "faktur") {
        throw new HttpsError("invalid-argument", "Jenis dokumen (kind) hanya \"wpho\" atau \"faktur\".");
      }
      // Validasi ukuran & tipe sebelum kuota dipotong.
      assertInlineImage({base64String, mimeType}, "Dokumen");
      const schema = kind === "faktur" ? FAKTUR_SCHEMA : WPHO_SCHEMA;
      const prompt = kind === "faktur" ? FAKTUR_PROMPT : WPHO_PROMPT;

      // Scan WPHO dihitung ke kuota gambar yang sama dengan analisis transaksi.
      await enforceDailyQuota(request.auth.uid, "image", 1);

      const requestBody = {
        contents: [
          {
            role: "user",
            parts: [
              {text: prompt},
              {inlineData: {mime_type: mimeType, data: base64String}},
            ],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          topK: 1,
          topP: 1,
          maxOutputTokens: 512,
          responseMimeType: "application/json",
          responseSchema: schema,
          thinkingConfig: {thinkingBudget: 0},
        },
      };

      logger.info("Scan dokumen WPHO via Gemini.");

      try {
        const text = await callGemini(requestBody, apiKey, "scanWphoDocument");
        return {document: JSON.parse(text)};
      } catch (error) {
        if (error instanceof HttpsError) throw error;
        logger.error("Kesalahan memanggil Gemini (scanWphoDocument):", error);
        throw new HttpsError("unknown", "Terjadi kesalahan saat memindai dokumen.");
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

      const summary = request.data?.summary;
      if (!summary || typeof summary !== "object" || Array.isArray(summary)) {
        throw new HttpsError("invalid-argument", "Ringkasan metrik tidak ada.");
      }
      // Ringkasan dihitung klien: batasi ukurannya supaya satu payload raksasa
      // tidak membakar token/biaya. Serialisasi sekali, dipakai untuk cek & kirim.
      const summaryJson = JSON.stringify(summary);
      if (summaryJson.length > MAX_SUMMARY_CHARS) {
        throw new HttpsError("invalid-argument", "Ringkasan metrik terlalu besar.");
      }

      await enforceDailyQuota(request.auth.uid, "insight");

      const body = {
        contents: [{
          parts: [{text: INSIGHT_PROMPT + summaryJson}],
        }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 1200,
          responseMimeType: "application/json",
          responseSchema: INSIGHT_SCHEMA,
          // Lihat catatan thinkingConfig di analyzeTransactionImageWithAI.
          thinkingConfig: {thinkingBudget: 0},
        },
      };

      try {
        const text = await callGemini(body, apiKey, "analyzeFinancialInsights");
        return {insight: JSON.parse(text), model: VERTEX_MODEL};
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
      if (path !== undefined && typeof path !== "string") {
        throw new HttpsError("invalid-argument", "Parameter \"path\" harus berupa teks.");
      }

      const parsed = url ? parseStorageUrl(url) : {bucket: "", path: ""};
      const objectPath = (path || parsed.path || "").replace(/^gs:\/\//, "").replace(/^\/+/, "");

      // Hanya bucket Kontrack. Sebelumnya `bucket` dari klien diteruskan apa
      // adanya, sehingga akun login mana pun bisa memakai Admin SDK (yang
      // melewati storage.rules) untuk membaca objek dari bucket proyek lain
      // yang masih terjangkau service account ini.
      if (bucket && bucket !== STORAGE_BUCKET) {
        throw new HttpsError("permission-denied", "Bucket di luar Kontrack tidak diizinkan.");
      }
      const resolvedBucket = STORAGE_BUCKET;

      if (!objectPath) {
        throw new HttpsError("invalid-argument", "Path berkas tidak dapat ditentukan.");
      }
      if (objectPath.length > 512) {
        throw new HttpsError("invalid-argument", "Path berkas terlalu panjang.");
      }

      // Kuota harian: setiap panggilan membaca berkas penuh ke memori lalu
      // mengembalikannya sebagai base64 (≈33% lebih besar) ke klien.
      await enforceDailyQuota(request.auth.uid, "asset");

      try {
        const file = admin.storage().bucket(resolvedBucket).file(objectPath);
        const [metadata] = await file.getMetadata();
        const size = Number(metadata?.size) || 0;
        if (size > MAX_STORAGE_ASSET_BYTES) {
          throw new HttpsError("invalid-argument", "Berkas terlalu besar untuk diambil lewat fungsi ini.");
        }
        const [buffer] = await file.download();
        let contentType = metadata?.contentType || guessContentType(objectPath);
        let payload = buffer;

        // Peramban tidak dapat menampilkan TIFF sama sekali, dan Gemini pun
        // hanya menerima png/jpeg/webp/heic. Dokumen SPK/PK/WPHO dari mitra
        // sering berupa TIFF, jadi diubah di server sekali di sini: pratinjau,
        // unduhan pratinjau, dan analisis AI memakai hasil yang sama.
        let converted = false;
        let conversionNote = "";
        if (isBigTiff(buffer)) {
          contentType = "image/tiff";
          conversionNote = "Berkas ini BigTIFF (TIFF 64-bit), format khusus pemindai untuk berkas sangat besar. " +
            "Simpan ulang sebagai TIFF biasa, JPG, atau PDF agar dapat dipratinjau.";
        } else if (isTiff(buffer)) {
          try {
            const png = tiffToPng(buffer);
            payload = png.data;
            contentType = "image/png";
            converted = true;
          } catch (error) {
            // Berkas tetap dikirim apa adanya supaya pengguna masih bisa
            // mengunduhnya; klien menampilkan alasan konversi gagal.
            conversionNote = error?.message || "TIFF tidak dapat dikonversi.";
            contentType = "image/tiff";
          }
        }

        return {
          dataUrl: `data:${contentType};base64,${payload.toString("base64")}`,
          metadata: {
            contentType,
            originalContentType: metadata?.contentType || guessContentType(objectPath),
            converted,
            conversionNote,
            size: converted ? payload.length : Number(metadata?.size) || buffer.length,
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

// ---------------------------------------------------------------------------
// Email templat (undangan & pemberitahuan)
//
// Dulu email dikirim sebagai teks polos hasil escape, jadi undangan pengguna
// tampak seperti log server. Template di bawah memakai tabel + gaya inline
// (satu-satunya yang dihormati Gmail/Outlook) dan pejal tanpa gradasi/emoji.
// ---------------------------------------------------------------------------

const SITE_URL = "https://kontrack.web.app";

const escapeHtml = (v) =>
  String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);

/**
 * Kerangka email Kontrack. `rows` = pasangan label/nilai yang dirender sebagai
 * tabel dua kolom agar terbaca di klien mana pun.
 */
const emailLayout = ({title, intro, rows = [], action = null, footer = ""}) => {
  const rowHtml = rows
      .filter((r) => r && r.value)
      .map(
          (r) => `
        <tr>
          <td style="padding:8px 0;color:#64748b;font-size:13px;width:150px;vertical-align:top">${escapeHtml(r.label)}</td>
          <td style="padding:8px 0;color:#0f172a;font-size:14px;font-weight:600">${escapeHtml(r.value)}</td>
        </tr>`,
      )
      .join("");

  const actionHtml = action ?
    `<tr><td style="padding:24px 0 8px">
       <a href="${escapeHtml(action.url)}" style="background:#1d4ed8;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 22px;border-radius:6px;display:inline-block">${escapeHtml(action.label)}</a>
     </td></tr>` :
    "";

  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#eef2f7">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f7;padding:28px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #dbe3ee;border-radius:10px;overflow:hidden">
        <tr><td style="background:#0b1b33;padding:18px 24px">
          <span style="color:#ffffff;font-size:16px;font-weight:700;letter-spacing:.02em">Kontrack</span>
          <span style="color:#93a4bd;font-size:12px;padding-left:8px">Manajemen proyek &amp; keuangan kontraktor</span>
        </td></tr>
        <tr><td style="padding:26px 24px 8px">
          <h1 style="margin:0 0 10px;font-size:18px;color:#0f172a;font-family:Arial,sans-serif">${escapeHtml(title)}</h1>
          <p style="margin:0;font-size:14px;line-height:1.6;color:#334155;font-family:Arial,sans-serif">${escapeHtml(intro)}</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;border-top:1px solid #e6ebf3">${rowHtml}${actionHtml}</table>
        </td></tr>
        <tr><td style="padding:18px 24px 24px;border-top:1px solid #e6ebf3">
          <p style="margin:0;font-size:12px;line-height:1.6;color:#64748b;font-family:Arial,sans-serif">${escapeHtml(footer || "Email ini dikirim otomatis oleh Kontrack. Jangan balas email ini.")}</p>
        </td></tr>
      </table>
      <p style="margin:14px 0 0;font-size:11px;color:#8a97ab;font-family:Arial,sans-serif">Kontrack &middot; ${SITE_URL.replace("https://", "")}</p>
    </td></tr>
  </table>
</body></html>`;
};

/** Transporter SMTP tunggal (Gmail App Password). */
const mailTransporter = () => nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {user: smtpUser.value(), pass: smtpPass.value()},
});

/** SMTP dianggap siap hanya bila kedua secret berisi nilai nyata. */
const smtpReady = () => {
  const user = smtpUser.value() || "";
  const pass = smtpPass.value() || "";
  return Boolean(user && pass && !/^BELUM-DISET$/i.test(user) && !/^BELUM-DISET$/i.test(pass));
};

// ---------------------------------------------------------------------------
// Undang pengguna
//
// Versi lama hanya menulis dokumen `users` tanpa akun Auth. Akibatnya orang
// yang diundang tidak bisa login, lalu mendaftar sendiri lewat form daftar dan
// mendapat dokumen KEDUA — akun ganda, dengan peran berbeda di dua dokumen.
//
// Versi ini:
// 1. membuat akun Auth (tanpa password; pengguna memakai "lupa password" atau
//    Google dengan email yang sama),
// 2. memakai ULANG dokumen `users` beremail sama bila sudah ada (idempoten),
// 3. mengirim email undangan berisi tautan masuk,
// 4. mengembalikan `emailSent` supaya UI tidak mengklaim email terkirim bila
//    SMTP belum disetel pemilik.
// ---------------------------------------------------------------------------

exports.addUserToCompany = onCall(
    {region: REGION, cors: true, maxInstances: 5, secrets: [smtpUser, smtpPass]},
    async (request) => {
      const actor = authorizeRole(["admin", "superadmin"])(await authenticateUser(request));
      const data = request.data || {};
      const rawEmail = String(data.email || "").trim().toLowerCase();
      const {name, role = "staff", companyId, sendEmail = true} = data;

      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(rawEmail)) {
        throw new HttpsError("invalid-argument", "Alamat email tidak valid.");
      }
      if (!["admin", "staff", "viewer"].includes(role) && role !== "superadmin") {
        throw new HttpsError("invalid-argument", "Peran tidak dikenal.");
      }
      if (role === "superadmin" && actor.role !== "superadmin") {
        throw new HttpsError("permission-denied", "Hanya superadmin yang boleh menetapkan peran superadmin.");
      }

      const displayName = String(name || "").trim() || rawEmail.split("@")[0];

      // Pemakaian ulang dokumen yang sudah ada = kunci anti-akun-ganda.
      const snap = await firestore.collection("users").where("email", "==", rawEmail).limit(1).get();
      const existing = snap.empty ? null : snap.docs[0];

      let uid = existing?.get("uid") || null;
      let accountCreated = false;

      try {
        const account = await admin.auth().getUserByEmail(rawEmail);
        uid = account.uid;
      } catch (error) {
        if (error.code !== "auth/user-not-found") throw error;
        const created = await admin.auth().createUser({
          email: rawEmail,
          displayName,
          emailVerified: false,
        });
        uid = created.uid;
        accountCreated = true;
      }

      const payload = {
        uid,
        email: rawEmail,
        name: existing?.get("name") || displayName,
        role,
        ...(companyId ? {companyId} : {}),
        status: "invited",
        invitedBy: actor.uid,
        invitedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      let userId;
      if (existing) {
        userId = existing.id;
        if (existing.get("uid") && existing.get("uid") !== uid) {
          throw new HttpsError(
              "failed-precondition",
              "Dokumen pengguna untuk email ini terikat akun lain. Periksa Pengaturan → Pengguna.",
          );
        }
        await existing.ref.set(payload, {merge: true});
      } else {
        const ref = firestore.collection("users").doc();
        userId = ref.id;
        await ref.set({
          ...payload,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      await logAuditEvent(
          existing ? "USER_INVITE_UPDATED" : "USER_CREATED",
          {userId, email: rawEmail, role, accountCreated, performedBy: actor.uid},
          request,
      );

      // Email tidak boleh menggagalkan undangan: dokumen sudah tersimpan.
      let emailSent = false;
      let emailError = null;
      if (sendEmail) {
        if (!smtpReady()) {
          emailError = "SMTP belum disetel pemilik (secret SMTP_USER & SMTP_PASS).";
        } else {
          try {
            await mailTransporter().sendMail({
              from: `"Kontrack" <${smtpUser.value()}>`,
              to: rawEmail,
              replyTo: smtpUser.value(),
              subject: "Undangan bergabung ke Kontrack",
              text:
                `Anda diundang bergabung ke Kontrack dengan peran ${role}.\n` +
                `Masuk di ${SITE_URL}/login menggunakan email ini ` +
                `(pilih "Lupa password" untuk membuat kata sandi, atau masuk dengan Google).`,
              html: emailLayout({
                title: "Undangan bergabung ke Kontrack",
                intro: `Anda diundang untuk bekerja di Kontrack, aplikasi manajemen proyek dan keuangan kontraktor.`,
                rows: [
                  {label: "Nama", value: existing?.get("name") || displayName},
                  {label: "Email", value: rawEmail},
                  {label: "Peran", value: role},
                  {label: "Diundang oleh", value: actor.email || actor.uid},
                ],
                action: {label: "Buka Kontrack", url: `${SITE_URL}/login`},
                footer: accountCreated ?
                  "Akun Anda sudah dibuat. Gunakan menu \"Lupa password\" di halaman masuk untuk membuat kata sandi, atau masuk memakai Google dengan email yang sama." :
                  "Akun Anda sudah ada di Kontrack. Silakan masuk seperti biasa.",
              }),
            });
            emailSent = true;
          } catch (error) {
            logger.error("Gagal mengirim email undangan:", error);
            emailError = "Email undangan gagal dikirim.";
          }
        }
      }

      return {userId, uid, reused: Boolean(existing), accountCreated, emailSent, emailError, success: true};
    },
);

// ---------------------------------------------------------------------------
// Pemberitahuan email
//
// Notifikasi di dalam aplikasi hanya terlihat kalau orangnya membuka aplikasi.
// Function ini mengirim ringkasan perubahan (invoice baru, status berubah,
// proyek, pengguna) ke alamat email yang dipilih administrator. Isi pesan
// disusun di sini, bukan dipercaya dari klien, agar tidak bisa dipakai
// mengirim teks bebas ke alamat sembarang.
// ---------------------------------------------------------------------------

const NOTIFY_KINDS = {
  invoice: "Invoice penagihan",
  payment: "Pembayaran diterima",
  project: "Proyek",
  user: "Akun pengguna",
  tax: "Pajak",
};

exports.notifyUsers = onCall(
    {region: REGION, cors: true, maxInstances: 5, secrets: [smtpUser, smtpPass]},
    async (request) => {
      const actor = authorizeRole(["admin", "superadmin"])(await authenticateUser(request));
      const data = request.data || {};
      const kind = String(data.kind || "");
      if (!NOTIFY_KINDS[kind]) {
        throw new HttpsError("invalid-argument", "Jenis pemberitahuan tidak dikenal.");
      }
      if (!smtpReady()) {
        return {sent: 0, skipped: 0, reason: "SMTP belum disetel pemilik."};
      }

      const subject = String(data.subject || NOTIFY_KINDS[kind]).slice(0, 120);
      const summary = String(data.summary || "").slice(0, 1200);
      const url = String(data.url || "").slice(0, 300);
      // Penerima bisa dikirim bebas oleh klien. Dibatasi ke email pengguna
      // Kontrack yang sudah terdaftar: tanpa itu, akun login mana pun yang
      // berperan admin bisa memakai identitas domain perusahaan untuk
      // mengirim pesan ke alamat luar (spam/phishing atas nama Kontrack).
      const requested = Array.isArray(data.to) ? data.to.slice(0, 25) : [];
      if (requested.length === 0) {
        throw new HttpsError("invalid-argument", "Tidak ada penerima.");
      }
      const usersSnap = await firestore.collection("users").get();
      const knownEmails = new Set(
          usersSnap.docs
              .map((d) => String(d.get("email") || "").trim().toLowerCase())
              .filter(Boolean),
      );
      const recipients = requested
          .map((r) => String(r || "").trim().toLowerCase())
          .filter((r) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(r) && knownEmails.has(r));
      if (recipients.length === 0) {
        throw new HttpsError("invalid-argument", "Penerima bukan pengguna terdaftar Kontrack.");
      }

      // Kuota harian: satu panggilan bisa mengirim sampai 25 email.
      await enforceDailyQuota(actor.uid, "email", recipients.length);

      const transporter = mailTransporter();
      let sent = 0;
      let skipped = 0;

      for (const raw of recipients) {
        const to = String(raw || "").trim().toLowerCase();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) {
          skipped += 1;
          continue;
        }
        try {
          await transporter.sendMail({
            from: `"Kontrack" <${smtpUser.value()}>`,
            to,
            replyTo: smtpUser.value(),
            subject: `[Kontrack] ${subject}`,
            text: `${summary}\n\n${url ? `Buka: ${SITE_URL}${url}\n` : ""}`,
            html: emailLayout({
              title: subject,
              intro: summary || NOTIFY_KINDS[kind],
              rows: [
                {label: "Jenis", value: NOTIFY_KINDS[kind]},
                {label: "Dari", value: actor.email || "Kontrack"},
              ],
              action: url ? {label: "Lihat di Kontrack", url: `${SITE_URL}${url}`} : null,
            }),
          });
          sent += 1;
        } catch (error) {
          logger.error(`Gagal notifikasi ke ${to}:`, error);
          skipped += 1;
        }
      }

      await logAuditEvent("NOTIFY_USERS", {kind, sent, skipped, performedBy: actor.uid}, request);
      return {sent, skipped};
    },
);

// ---------------------------------------------------------------------------
// WhatsApp (gateway server-side)
//
// Aplikasi mengirim lewat nomor resmi Kontrack, bukan nomor pribadi pengguna.
// Dua mode didukung, dipilih otomatis dari secret yang tersedia:
//   WA_GATEWAY_URL  — gateway tidak resmi (whatsapp-web.js / Baileys) yang
//                     dijalankan pemilik di VPS. Request: POST JSON
//                     {to: "62812...", message: "...", token?: "..."}.
//   WA_TOKEN + WA_PHONE_ID — WhatsApp Cloud API resmi (graph.facebook.com).
// Bila keduanya kosong, function melaporkan "belum disetel" dan tidak
// mengarang hasil kirim.
// ---------------------------------------------------------------------------

const waGatewayUrl = defineSecret("WA_GATEWAY_URL");
const waGatewayToken = defineSecret("WA_GATEWAY_TOKEN");
const waToken = defineSecret("WA_TOKEN");
const waPhoneId = defineSecret("WA_PHONE_ID");

/** Normalisasi nomor Indonesia ke format 62... tanpa spasi/tanda. */
/**
 * Baca secret WhatsApp dengan aman.
 *
 * `defineSecret().value()` MELEMPAR bila secret belum pernah disetel, sehingga
 * pemanggilan langsung akan mematikan function pada instalasi baru. Di sini
 * ketiadaan secret dianggap "belum disetel" (string kosong), bukan kegagalan.
 */
const readSecret = (param) => {
  try {
    const value = String(param.value() || "").trim();
    return /^BELUM-DISET$/i.test(value) ? "" : value;
  } catch (error) {
    return "";
  }
};

const normalizeWaNumber = (raw) => {
  const digits = String(raw || "").replace(/[^\d]/g, "");
  if (!digits) return null;
  if (digits.startsWith("62")) return digits;
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  if (digits.startsWith("8")) return `62${digits}`;
  return digits;
};

exports.sendWhatsApp = onCall(
    // Secret WA WAJIB terdaftar di sini, kalau tidak nilainya tidak pernah
    // disuntikkan ke function. Secret dibuat dengan placeholder "BELUM-DISET"
    // (sama seperti SMTP) supaya deploy tidak gagal sebelum pemilik menyetel
    // nilai aslinya; readSecret + cek placeholder memperlakukannya sebagai kosong.
    {region: REGION, cors: true, maxInstances: 5, secrets: [waGatewayUrl, waGatewayToken, waToken, waPhoneId]},
    async (request) => {
      const actor = authorizeRole(["admin", "superadmin"])(await authenticateUser(request));
      const data = request.data || {};
      const to = normalizeWaNumber(data.to);
      const message = String(data.message || "").slice(0, 2000);

      if (!to || to.length < 10) {
        throw new HttpsError("invalid-argument", "Nomor WhatsApp tidak valid.");
      }
      if (!message.trim()) {
        throw new HttpsError("invalid-argument", "Isi pesan kosong.");
      }

      // Batas harian per pengguna: mencegah nomor resmi dipakai membanjiri kontak.
      const quota = await enforceDailyQuota(actor.uid, "whatsapp", 1);

      const gateway = readSecret(waGatewayUrl);
      const officialToken = readSecret(waToken);
      const officialPhone = readSecret(waPhoneId);

      if (!gateway && !(officialToken && officialPhone)) {
        return {sent: false, configured: false, reason: "Gateway WhatsApp belum disetel pemilik."};
      }

      // Gateway adalah URL yang DIKONFIGURASI PEMILIK lewat secret, bukan input
      // klien — tapi tetap diverifikasi https supaya salah setel tidak
      // mengirim pesan ke skema tak aman.
      if (gateway && !/^https:\/\//i.test(gateway)) {
        logger.error("WA_GATEWAY_URL bukan https — pengiriman dibatalkan.");
        throw new HttpsError("failed-precondition", "Gateway WhatsApp harus memakai https.");
      }

      try {
        if (gateway) {
          const res = await fetch(gateway, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(waGatewayToken.value() ? {"X-Api-Token": waGatewayToken.value()} : {}),
            },
            body: JSON.stringify({to, message, sender: "kontrack"}),
          });
          const text = await res.text();
          if (!res.ok) throw new Error(`gateway ${res.status}: ${text.slice(0, 200)}`);
          await logAuditEvent("WA_SENT", {to, mode: "gateway", performedBy: actor.uid}, request);
          return {sent: true, configured: true, mode: "gateway", remaining: quota.remaining};
        }

        const res = await fetch(`https://graph.facebook.com/v20.0/${officialPhone}/messages`, {
          method: "POST",
          headers: {"Content-Type": "application/json", Authorization: `Bearer ${officialToken}`},
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to,
            type: "text",
            text: {body: message},
          }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error?.message || `cloud api ${res.status}`);
        await logAuditEvent("WA_SENT", {to, mode: "cloud", performedBy: actor.uid}, request);
        return {sent: true, configured: true, mode: "cloud", remaining: quota.remaining};
      } catch (error) {
        // Detail penyedia (token salah, nomor diblokir) hanya ke log; klien
        // menerima pesan umum supaya tidak ada info internal yang bocor.
        logger.error("Gagal kirim WhatsApp:", error);
        throw new HttpsError("internal", "Gagal mengirim WhatsApp. Periksa konfigurasi gateway atau coba lagi.");
      }
    },
);

// ---------------------------------------------------------------------------
// Keadaan kanal pemberitahuan
//
// Halaman Pengaturan perlu tahu kanal mana yang benar-benar siap, tanpa harus
// mengirim pesan percobaan. Function ini hanya melaporkan ada/tidaknya secret;
// nilai secret tidak pernah dikembalikan.
// ---------------------------------------------------------------------------

exports.notifyChannels = onCall(
    {region: REGION, cors: true, maxInstances: 5, secrets: [smtpUser, smtpPass, waGatewayUrl, waToken, waPhoneId]},
    async (request) => {
      authorizeRole(["admin", "superadmin"])(await authenticateUser(request));
      const gateway = readSecret(waGatewayUrl);
      const cloud = readSecret(waToken) && readSecret(waPhoneId);
      return {
        email: smtpReady(),
        whatsapp: Boolean(gateway) || Boolean(cloud),
        whatsappMode: gateway ? "gateway" : cloud ? "cloud" : null,
      };
    },
);

/** Ubah peran pengguna (admin/superadmin saja). */
exports.updateUserRole = onCall(
    {region: REGION, cors: true, maxInstances: 5},
    async (request) => {
      const actor = authorizeRole(["admin", "superadmin"])(await authenticateUser(request));

      const {userId, role, email} = request.data || {};
      if (!role) throw new HttpsError("invalid-argument", "Peran baru wajib diisi.");
      if (!["admin", "staff", "viewer"].includes(role) && role !== "superadmin") {
        throw new HttpsError("invalid-argument", "Peran tidak dikenal.");
      }

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

// ---------------------------------------------------------------------------
// Hapus akses pengguna
//
// Dulu dihapus langsung dari klien (`deleteDoc`). Setelah rules diperketat,
// penghapusan dari klien ditolak dan itu memang disengaja: hanya administrator
// yang boleh mencabut akses. Dijadikan Cloud Function agar pengecekan peran
// tetap ada dan tidak bisa dilewati.
// ---------------------------------------------------------------------------

exports.removeUserAccess = onCall(
    {region: REGION, cors: true, maxInstances: 5},
    async (request) => {
      const actor = authorizeRole(["admin", "superadmin"])(await authenticateUser(request));
      const {userId, email} = request.data || {};

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

      const target = await firestore.collection("users").doc(docId).get();
      if (target.get("uid") === actor.uid) {
        throw new HttpsError("failed-precondition", "Anda tidak dapat menghapus akses akun sendiri.");
      }

      await firestore.collection("users").doc(docId).delete();
      await logAuditEvent("USER_ACCESS_REMOVED", {targetUserId: docId, performedBy: actor.uid}, request);

      return {success: true, userId: docId};
    },
);
