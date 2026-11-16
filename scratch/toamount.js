const toAmount = (value) => {
  if (typeof value === "number") return Number.isFinite(value) ? Math.abs(Math.round(value)) : 0;
  let raw = String(value == null ? "" : value).toLowerCase().trim();
  if (!raw) return 0;

  // Satuan singkat yang lazim di nota: "1,5 jt", "450rb", "200k".
  let mult = 1;
  if (/juta|jt/.test(raw)) mult = 1000000;
  else if (/rb|ribu/.test(raw)) mult = 1000;
  else if (/k/.test(raw)) mult = 1000;

  let num = raw.replace(/[^0-9.,]/g, "");
  if (!num) return 0;

  if (mult > 1) {
    // Angka bersatuan memakai koma sebagai desimal: "1,5" -> 1.5
    num = num.replace(/\./g, "").replace(/,/g, ".");
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
module.exports = { toAmount };
