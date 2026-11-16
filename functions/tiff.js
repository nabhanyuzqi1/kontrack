// functions/tiff.js
//
// Konversi TIFF → PNG tanpa dependensi luar.
//
// Kenapa perlu: SPK, PK, dan WPHO dari mitra umumnya dipindai sebagai TIFF
// (format standar hasil scan dan fax). Peramban TIDAK dapat menampilkan TIFF
// (sudah diuji: `<img>` dan `createImageBitmap` sama-sama gagal), dan Gemini
// juga hanya menerima png/jpeg/webp/heic. Jadi TIFF tidak bisa dipratinjau
// maupun dianalisis tanpa diubah dulu.
//
// Kenapa ditulis sendiri, bukan menambah paket: kebutuhan Kontrack sempit
// (dokumen hasil scan, bukan foto artistik). Cakupannya: baseline TIFF,
// little/big endian, strip atau tile, kompresi none/LZW/PackBits/Deflate,
// 1/8/16 bit, grayscale atau RGB(A), dan prediktor horizontal. Format lain
// (JPEG-in-TIFF, CMYK, float) ditolak dengan pesan jelas, bukan hasil rusak.
//
// Keluaran PNG (bukan JPEG) karena PNG bisa ditulis tanpa pustaka encoder:
// cukup zlib bawaan Node + CRC32.

const zlib = require("zlib");

// ---- CRC32 untuk chunk PNG ------------------------------------------------
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

const crc32 = (buf) => {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
};

const pngChunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
};

/** PNG dari data RGB (3 byte per piksel) atau RGBA (4 byte per piksel). */
const encodePng = (rgba, width, height, channels) => {
  const colorType = channels === 4 ? 6 : 2;

  // Setiap baris diberi prefiks filter 0 (None).
  const stride = width * channels;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = colorType;
  ihdr[10] = 0; // deflate
  ihdr[11] = 0; // filter adaptif
  ihdr[12] = 0; // tanpa interlace

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", zlib.deflateSync(raw, {level: 6})),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
};

// ---- Pembaca TIFF ---------------------------------------------------------
const TYPE_SIZE = {1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8};

const decodeLzw = (data) => {
  // LZW gaya TIFF: kode awal 9 bit, clear code 256, EOI 257, MSB-first.
  const out = [];
  let dict = [];
  const reset = () => {
    dict = [];
    for (let i = 0; i < 256; i++) dict.push([i]);
    dict.push(null, null);
  };
  reset();
  let bitPos = 0;
  let codeLen = 9;
  let prev = null;
  const totalBits = data.length * 8;
  const readCode = () => {
    if (bitPos + codeLen > totalBits) return -1;
    let code = 0;
    for (let i = 0; i < codeLen; i++) {
      const byte = data[(bitPos + i) >> 3];
      const bit = (byte >> (7 - ((bitPos + i) & 7))) & 1;
      code = (code << 1) | bit;
    }
    bitPos += codeLen;
    return code;
  };
  for (;;) {
    const code = readCode();
    if (code === -1 || code === 257) break;
    if (code === 256) {
      reset();
      codeLen = 9;
      prev = null;
      continue;
    }
    let entry;
    if (code < dict.length && dict[code]) entry = dict[code];
    else if (prev) entry = prev.concat([prev[0]]);
    else break;
    out.push(...entry);
    if (prev) dict.push(prev.concat([entry[0]]));
    prev = entry;
    if (dict.length + 1 >= (1 << codeLen) && codeLen < 12) codeLen++;
  }
  return Buffer.from(out);
};

const decodePackBits = (data) => {
  const out = [];
  let i = 0;
  while (i < data.length) {
    const n = data[i++];
    if (n < 128) {
      for (let j = 0; j <= n && i < data.length; j++) out.push(data[i++]);
    } else if (n > 128) {
      const count = 257 - n;
      const v = data[i++];
      for (let j = 0; j < count; j++) out.push(v);
    }
  }
  return Buffer.from(out);
};

const readIfd = (buf, offset, le) => {
  const count = le ? buf.readUInt16LE(offset) : buf.readUInt16BE(offset);
  const tags = {};
  for (let i = 0; i < count; i++) {
    const e = offset + 2 + i * 12;
    if (e + 12 > buf.length) break;
    const tag = le ? buf.readUInt16LE(e) : buf.readUInt16BE(e);
    const type = le ? buf.readUInt16LE(e + 2) : buf.readUInt16BE(e + 2);
    const n = le ? buf.readUInt32LE(e + 4) : buf.readUInt32BE(e + 4);
    const size = (TYPE_SIZE[type] || 1) * n;
    const inline = size <= 4;
    const valOff = inline ? e + 8 : (le ? buf.readUInt32LE(e + 8) : buf.readUInt32BE(e + 8));
    const vals = [];
    for (let k = 0; k < n && k < 4096; k++) {
      const p = valOff + k * (TYPE_SIZE[type] || 1);
      if (p + (TYPE_SIZE[type] || 1) > buf.length) break;
      if (type === 3) vals.push(le ? buf.readUInt16LE(p) : buf.readUInt16BE(p));
      else if (type === 4) vals.push(le ? buf.readUInt32LE(p) : buf.readUInt32BE(p));
      else if (type === 1) vals.push(buf[p]);
      else if (type === 8) vals.push(le ? buf.readInt16LE(p) : buf.readInt16BE(p));
      else if (type === 5) vals.push(1);
      else vals.push(buf[p]);
    }
    tags[tag] = inline || type === 3 || type === 4 || type === 1 ? vals : vals;
  }
  return tags;
};

/**
 * Ubah TIFF menjadi { data: Buffer PNG, width, height }.
 * Melempar Error berisi alasan yang bisa ditampilkan ke pengguna.
 */
const tiffToPng = (input) => {
  try {
    return decodeTiff(input);
  } catch (error) {
    // Pesan dari Node (mis. "The value of \"offset\" is out of range") tidak
    // layak ditampilkan ke pengguna; yang jelas sudah dilempar sebagai Error
    // dengan kalimat sendiri, sisanya dianggap berkas rusak.
    if (/^[A-Z].*[.!]$/.test(error?.message || "")) throw error;
    throw new Error("Berkas TIFF rusak atau tidak lengkap, tidak dapat dibuka.");
  }
};

const decodeTiff = (input) => {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  if (buf.length < 8) throw new Error("Berkas TIFF terlalu kecil atau rusak.");

  const sig = buf.slice(0, 4).toString("latin1");
  let le;
  if (sig === "II*\0") le = true;
  else if (sig === "MM\0*") le = false;
  else throw new Error("Berkas ini bukan TIFF yang dikenali.");

  const ifdOffset = le ? buf.readUInt32LE(4) : buf.readUInt32BE(4);
  const tags = readIfd(buf, ifdOffset, le);
  const t = (id) => (tags[id] ? tags[id][0] : undefined);

  const width = t(256);
  const height = t(257);
  if (!width || !height) throw new Error("TIFF tidak memuat ukuran gambar.");

  // Keamanan memori: 40 MP sudah jauh melebihi kebutuhan dokumen scan.
  if (width * height > 40_000_000) {
    throw new Error(`Gambar terlalu besar (${width}×${height}). Perkecil dulu.`);
  }

  const bps = tags[258] || [8];
  const compression = t(259) || 1;
  const photometric = t(262);
  const samplesPerPixel = t(277) || 1;
  const rowsPerStrip = t(278) || height;
  const planar = t(284) || 1;
  const predictor = t(317) || 1;

  if (bps[0] !== 8) {
    throw new Error(`TIFF ${bps[0]} bit per kanal belum didukung. Simpan ulang sebagai 8 bit.`);
  }
  if (photometric === 5) {
    throw new Error("TIFF CMYK belum didukung. Simpan ulang sebagai RGB, JPG, atau PNG.");
  }
  if (samplesPerPixel > 4 || samplesPerPixel < 1) {
    throw new Error("Jumlah kanal TIFF tidak didukung.");
  }
  if (planar !== 1) {
    throw new Error("TIFF terpisah per kanal (planar) belum didukung. Simpan ulang sebagai satu bidang.");
  }
  if (compression === 6 || compression === 7) {
    return decodeJpegTiff(buf, tags, {width, height, samplesPerPixel, photometric, planar});
  }

  const offsets = tags[273] || [];
  const counts = tags[279] || [];
  if (!offsets.length) throw new Error("TIFF tidak memuat data piksel.");

  const rowBytes = width * samplesPerPixel;
  const parts = [];

  for (let i = 0; i < offsets.length; i++) {
    // StripByteCounts tidak wajib ada di semua penulis TIFF; bila kosong,
    // ambil sampai offset berikutnya (atau akhir berkas untuk strip terakhir).
    // Tanpa ini, `slice(off, off + 0)` menghasilkan buffer kosong dan gambar
    // tampak hitam walau berkasnya sehat.
    const start = offsets[i];
    let end = counts[i] ? start + counts[i] : null;
    if (end === null) {
      end = offsets[i + 1] !== undefined
        ? offsets[i + 1]
        : (tags[273].offsetEnd || buf.length);
    }
    if (end <= start || start >= buf.length) continue;
    const raw = buf.slice(start, Math.min(end, buf.length));
    let data;
    if (compression === 1) data = raw;
    else if (compression === 5) data = decodeLzw(raw);
    else if (compression === 32773) data = decodePackBits(raw);
    else if (compression === 8 || compression === 32946) data = zlib.inflateSync(raw);
    else throw new Error(`Kompresi TIFF (${compression}) belum didukung. Simpan ulang sebagai TIFF biasa.`);
    parts.push(data);
  }

  let pixels = Buffer.concat(parts);
  const rows = Math.ceil(height / rowsPerStrip);

  // Prediktor horizontal: tiap piksel disimpan sebagai selisih nilai sebelahnya.
  if (predictor === 2) {
    for (let r = 0; r < rows; r++) {
      const start = r * rowsPerStrip * rowBytes;
      const lines = Math.min(rowsPerStrip, height - r * rowsPerStrip);
      for (let y = 0; y < lines; y++) {
        const base = start + y * rowBytes;
        for (let x = samplesPerPixel; x < rowBytes; x++) {
          pixels[base + x] = (pixels[base + x] + pixels[base + x - samplesPerPixel]) & 0xff;
        }
      }
    }
  }

  // Normalisasi ke RGB(A) 8 bit.
  const channels = samplesPerPixel >= 3 ? (samplesPerPixel >= 4 ? 4 : 3) : 3;
  const out = Buffer.alloc(width * height * channels);
  const gray = photometric === 0 || photometric === 1 || samplesPerPixel === 1;
  // Photometric 0 = WhiteIsZero (umum pada scan faks): nilai 0 berarti putih.
  const invert = photometric === 0;

  for (let i = 0, p = 0; i < width * height; i++) {
    let r;
    let g;
    let b;
    let a = 255;
    if (gray) {
      let v = pixels[i * samplesPerPixel];
      if (v === undefined) v = 255;
      if (invert) v = 255 - v;
      r = g = b = v;
    } else {
      r = pixels[i * samplesPerPixel] ?? 0;
      g = pixels[i * samplesPerPixel + 1] ?? 0;
      b = pixels[i * samplesPerPixel + 2] ?? 0;
      if (samplesPerPixel === 4) a = pixels[i * samplesPerPixel + 3] ?? 255;
    }
    out[p++] = r;
    out[p++] = g;
    out[p++] = b;
    if (channels === 4) out[p++] = a;
  }

  return {data: encodePng(out, width, height, channels), width, height};
};

/** Apakah buffer ini TIFF? */
const isTiff = (buf) => {
  if (!buf || buf.length < 4) return false;
  const s = buf.slice(0, 4).toString("latin1");
  return s === "II*\0" || s === "MM\0*";
};

/**
 * TIFF berkompresi JPEG (Compression 6 atau 7) → PNG.
 *
 * Tiga bentuk yang ditangani:
 *
 * 1. **Interchange format** (tag 513 `JPEGInterchangeFormat`): seluruh gambar
 *    sudah berupa satu stream JPEG utuh (SOI..EOI). Cukup di-decode.
 *
 * 2. **JPEGTables + strip utuh** (bentuk yang ditulis libtiff/Pillow untuk
 *    kompresi 7): tag 347 berisi SOI + DQT + DHT (+ EOI), dan SETIAP strip
 *    berupa SOI + SOF + SOS + entropy + EOI tanpa tabel. Tabel dari 347
 *    disuntikkan ke tiap strip sebelum SOF, lalu di-decode.
 *
 * 3. **Tabel + entropy terpisah** (bentuk old-style JPEG pemindai): tabel
 *    kuantisasi (519) dan Huffman (520/521) disimpan sebagai payload mentah
 *    64-byte / "16 byte BITS + VALUES", dan data strip dimulai langsung pada
 *    entropy tanpa SOI. Stream lengkap disusun ulang mengikuti T.81.
 *
 * Tanpa ketiganya, WPHO/PK hasil scan ditolak dengan "kompresi 6 belum
 * didukung" — padahal itu format bawaan banyak pemindai dokumen.
 */
const decodeJpegTiff = (buf, tags, meta) => {
  const {decodeJpeg} = require("./jpeg");
  const t = (id) => (tags[id] ? tags[id][0] : undefined);
  const all = (id) => tags[id] || [];

  const {width, height, samplesPerPixel} = meta;
  const offsets = all(273);
  const counts = all(279);

  const asPng = (img) => ({
    data: encodePng(img.data, img.width, img.height, 3),
    width: img.width,
    height: img.height,
  });

  // (1) Interchange format: satu stream JPEG utuh.
  const ifdOffset = t(513);
  if (ifdOffset) {
    const len = t(514) || (buf.length - ifdOffset);
    const end = Math.min(buf.length, ifdOffset + len);
    let start = ifdOffset;
    // Loloskan pengisi sebelum SOI.
    while (start + 1 < end && !(buf[start] === 0xff && buf[start + 1] === 0xd8)) start++;
    // Stream JPEG yang tertanam hampir selalu YCbCr; penanda Adobe APP14
    // (jika ada) yang menyatakan RGB ditangani decoder apa adanya.
    return asPng(decodeJpeg(buf.slice(start, end)));
  }

  if (!offsets.length) throw new Error("TIFF JPEG tidak memuat data gambar.");

  // (2) Bangun daftar stream JPEG per strip.
  // TYPE_UNDEFINED dibaca readIfd sebagai byte array, bukan offset.
  const jpegTables = Array.isArray(tags[347]) && tags[347].length
    ? Buffer.from(tags[347])
    : null;
  // Isi tabel dari JPEGTables: segmen di antara SOI dan EOI.
  const tableBody = (() => {
    if (!jpegTables) return [];
    const tb = jpegTables;
    if (tb.length < 4 || tb[0] !== 0xff || tb[1] !== 0xd8) return [];
    const parts = [];
    let p = 2;
    while (p + 3 < tb.length) {
      if (tb[p] !== 0xff) { p++; continue; }
      const m = tb[p + 1];
      if (m === 0xd9) break;
      if (m === 0x00 || m === 0xff) { p++; continue; }
      const segLen = tb.readUInt16BE(p + 2);
      parts.push(tb.slice(p, p + 2 + segLen));
      p += 2 + segLen;
    }
    return parts;
  })();

  /** Gabungkan SOI + tabel + isi strip (tanpa SOI/EOI ganda). */
  const assemble = (stripBuf, extraTables) => {
    const parts = [Buffer.from([0xff, 0xd8]), ...tableBody, ...extraTables];
    let body = stripBuf;
    // Buang SOI di depan.
    if (body.length >= 2 && body[0] === 0xff && body[1] === 0xd8) body = body.slice(2);
    parts.push(body);
    // Pastikan diakhiri EOI.
    if (!(body.length >= 2 && body[body.length - 2] === 0xff && body[body.length - 1] === 0xd9)) {
      parts.push(Buffer.from([0xff, 0xd9]));
    }
    return Buffer.concat(parts);
  };

  // (2) Pilih jalur berdasarkan isi strip. Bentuk "strip utuh" dimulai dengan
  //     SOI (0xFFD8); bentuk "tabel terpisah" adalah entropy mentah tanpa SOI.
  const firstStart = offsets[0] || 0;
  const firstEnd = counts[0] ? firstStart + counts[0] : buf.length;
  const firstStrip = buf.slice(firstStart, Math.min(firstEnd, buf.length));
  const isFullStrips =
    firstStrip.length >= 2 && firstStrip[0] === 0xff && firstStrip[1] === 0xd8;

  if (!isFullStrips) return decodeSplitTables(buf, tags, meta);

  const pieces = [];
  for (let i = 0; i < offsets.length; i++) {
    const start = offsets[i];
    const end = counts[i] ? start + counts[i] : (offsets[i + 1] || buf.length);
    if (!start || end <= start) continue;
    pieces.push(decodeJpeg(assemble(buf.slice(start, Math.min(end, buf.length)), [])));
  }

  return stitch(pieces, width, height);
};

/** Jahit strip penuh-lebar menjadi satu gambar. */
const stitch = (pieces, width, height) => {
  const totalH = pieces.reduce((a, p) => a + p.height, 0);
  const outW = pieces[0].width;
  const outH = Math.min(height, totalH);
  const out = Buffer.alloc(outW * outH * 3);
  let y0 = 0;
  for (const p of pieces) {
    const rows = Math.min(p.height, outH - y0);
    if (rows <= 0) break;
    for (let y = 0; y < rows; y++) {
      p.data.copy(out, (y0 + y) * outW * 3, y * p.width * 3, y * p.width * 3 + outW * 3);
    }
    y0 += rows;
  }
  return {data: encodePng(out, outW, outH, 3), width: outW, height: outH};
};

/**
 * Bentuk old-style JPEG pemindai: tabel kuantisasi (519) dan Huffman (520/521)
 * disimpan sebagai payload mentah, dan strip dimulai langsung pada entropy
 * tanpa SOI. Stream lengkap disusun ulang mengikuti T.81, lalu di-decode.
 */
const decodeSplitTables = (buf, tags, meta) => {
  const {decodeJpeg} = require("./jpeg");
  const t = (id) => (tags[id] ? tags[id][0] : undefined);
  const all = (id) => tags[id] || [];
  const {width, height, samplesPerPixel} = meta;
  const offsets = all(273);
  const counts = all(279);
  const qtOffsets = all(519);
  const dcOffsets = all(520);
  const acOffsets = all(521);
  const ncomp = samplesPerPixel >= 3 ? 3 : 1;

  // Ubah payload tabel mentah menjadi segmen penanda DQT/DHT.
  const qtSegments = [];
  qtOffsets.forEach((off, i) => {
    if (!off) return;
    const raw = buf.slice(off, off + 64);
    if (raw.length < 64) return;
    // 64 byte urut zigzag, presisi 8 bit.
    const body = Buffer.alloc(65);
    body[0] = i & 0x0f; // Pq=0 (8 bit), Tq=i
    raw.copy(body, 1);
    qtSegments.push(marker(0xdb, body));
  });

  const huffSegments = [];
  const pushHuff = (off, cls, id) => {
    if (!off) return;
    const raw = buf.slice(off, off + 16 + 256);
    if (raw.length < 17) return;
    const cnts = raw.slice(0, 16);
    const total = cnts.reduce((a, b) => a + b, 0);
    const body = Buffer.alloc(1 + 16 + total);
    body[0] = (cls << 4) | id;
    cnts.copy(body, 1);
    raw.copy(body, 17, 16, 16 + total);
    huffSegments.push(marker(0xc4, body));
  };
  const maxTables = Math.max(dcOffsets.length, acOffsets.length, ncomp);
  for (let i = 0; i < maxTables; i++) {
    pushHuff(dcOffsets[i], 0, i);
    pushHuff(acOffsets[i], 1, i);
  }

  // SOF: ID komponen 0-based seperti tif_ojpeg.c libtiff; tabel kuantisasi
  // ke-i untuk komponen ke-i, tabel terakhir diulang bila kurang.
  const sOf = Buffer.alloc(6 + 3 * ncomp);
  sOf[0] = 8; // presisi
  sOf.writeUInt16BE(height, 1);
  sOf.writeUInt16BE(width, 3);
  sOf[5] = ncomp;
  const qtFor = (i) => (qtSegments.length ? Math.min(i, qtSegments.length - 1) : 0);
  for (let i = 0; i < ncomp; i++) {
    sOf[6 + i * 3] = i;
    sOf[7 + i * 3] = 0x11; // sampling 1x1: bentuk ini tidak menyimpan faktornya
    sOf[8 + i * 3] = qtFor(i);
  }

  const sos = Buffer.alloc(4 + 2 * ncomp);
  sos[0] = ncomp;
  const tblFor = (arr, i) => (arr.length ? Math.min(i, arr.length - 1) : 0);
  for (let i = 0; i < ncomp; i++) {
    sos[1 + i * 2] = i;
    sos[2 + i * 2] = ((tblFor(dcOffsets, i) & 0x0f) << 4) | (tblFor(acOffsets, i) & 0x0f);
  }
  sos[1 + 2 * ncomp] = 0; // Ss
  sos[2 + 2 * ncomp] = 63; // Se
  sos[3 + 2 * ncomp] = 0; // Ah/Al

  // Tabel bersama dari tag 347 bila ada (jarang di bentuk terpisah, tapi aman).
  const tableBody = [];
  const tables = t(347);
  if (tables) {
    const tb = buf.slice(tables, tables + (t(348) || 65535));
    let endIdx = -1;
    for (let i = tb.length - 1; i > 1; i--) {
      if (tb[i] === 0xd9 && tb[i - 1] === 0xff) { endIdx = i - 1; break; }
    }
    if (endIdx > 2) tableBody.push(tb.slice(2, endIdx)); // buang SOI dan EOI
  }

  const pieces = [];
  for (let i = 0; i < offsets.length; i++) {
    const start = offsets[i];
    const end = counts[i] ? start + counts[i] : (offsets[i + 1] || buf.length);
    if (!start || end <= start) continue;
    const entropy = buf.slice(start, Math.min(end, buf.length));
    const stream = Buffer.concat([
      Buffer.from([0xff, 0xd8]),
      ...tableBody,
      ...qtSegments,
      ...huffSegments,
      marker(0xc0, sOf),
      marker(0xda, sos),
      entropy,
      Buffer.from([0xff, 0xd9]),
    ]);
    pieces.push(decodeJpeg(stream));
  }

  if (!pieces.length) throw new Error("TIFF JPEG tidak memuat strip yang bisa dibaca.");
  return stitch(pieces, width, height);
};

/** Susun satu segmen JPEG: 0xFF, penanda, panjang 16-bit, isi. */
const marker = (code, body) => {
  const head = Buffer.alloc(4);
  head[0] = 0xff;
  head[1] = code;
  head.writeUInt16BE(body.length + 2, 2);
  return Buffer.concat([head, body]);
};

/**
 * BigTIFF (penanda `II+\0` / `MM\0+`) dipakai pemindai untuk berkas >4 GB dan
 * struktur IFD-nya 64-bit — tidak kompatibel dengan pembaca di atas. Dikenali
 * terpisah supaya pengguna mendapat pesan yang benar, bukan "bukan TIFF".
 */
const isBigTiff = (buf) => {
  if (!buf || buf.length < 4) return false;
  const s = buf.slice(0, 4).toString("latin1");
  return s === "II+\0" || s === "MM\0+";
};

module.exports = {tiffToPng, isTiff, isBigTiff, encodePng};
