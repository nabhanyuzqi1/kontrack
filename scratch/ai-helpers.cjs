globalThis.extractJson = (raw) => {
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
globalThis.toAmount = (value) => {
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
globalThis.sanitizeTx = (item) => {
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


