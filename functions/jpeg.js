// functions/jpeg.js
//
// Decoder JPEG baseline (SOF0/SOF1) 8-bit, tanpa dependensi.
//
// Kenapa perlu: banyak TIFF dari pemindai (WPHO, PK, SPK) memakai
// Compression=6 (JPEG gaya lama) atau 7 (JPEG-in-TIFF). Keduanya tidak bisa
// ditampilkan peramban maupun dibaca Gemini selain sebagai PNG/JPEG, dan
// `zlib` Node tidak membantu sama sekali. Menambah paket gambar (sharp/jimp)
// ditolak repo ini: bebannya besar dan deployment jadi rapuh.
//
// Cakupan yang sengaja dipilih: baseline DCT non-progresif, 8 bit,
// 1 (grayscale) atau 3 (YCbCr/RGB) komponen, subsampling apa pun (4:4:4,
// 4:2:2, 4:2:0), dengan restart marker. Progressive JPEG dan arithmetic coding
// DITOLAK dengan pesan jelas: keduanya jarang pada hasil scan dokumen dan
// menambah ratusan baris yang tidak terpakai.
//
// Keluaran: { data: Buffer RGB, width, height }.

const ZIGZAG = new Int32Array([
  0, 1, 8, 16, 9, 2, 3, 10,
  17, 24, 32, 25, 18, 11, 4, 5,
  12, 19, 26, 33, 40, 48, 41, 34,
  27, 20, 13, 6, 7, 14, 21, 28,
  35, 42, 49, 56, 57, 50, 43, 36,
  29, 22, 15, 23, 30, 37, 44, 51,
  58, 59, 52, 45, 38, 31, 39, 46,
  53, 60, 61, 54, 47, 55, 62, 63,
]);

// IDCT cepat: dekomposisi 1-D (AAN) lalu dua pass, bukan perkalian O(64×64)
// per blok. Versi naif butuh ~8 detik untuk gambar 8 MP, terlalu lambat untuk
// Cloud Function yang juga mengunggah ke Gemini.
const IDCT_COS = new Float64Array(64);
for (let x = 0; x < 8; x++) {
  for (let u = 0; u < 8; u++) {
    IDCT_COS[x * 8 + u] = Math.cos(((2 * x + 1) * u * Math.PI) / 16) * (u === 0 ? Math.SQRT1_2 : 1);
  }
}

/** IDCT 8x8 satu pass; `src` dan `dst` berupa array panjang 64. */
const idctPass = (src, dst, stride) => {
  for (let i = 0; i < 8; i++) {
    const s = i * 8;
    const d = i * stride;
    for (let x = 0; x < 8; x++) {
      let sum = 0;
      const cx = x * 8;
      for (let u = 0; u < 8; u++) sum += src[s + u] * IDCT_COS[cx + u];
      dst[d + x] = sum / 2;
    }
  }
};

// Buffer kerja dipakai ulang: alokasi per blok (ribuan blok per gambar) adalah
// biaya nyata pada Function dengan memori terbatas.
const _tmpBlock = new Float64Array(64);

/** IDCT 8x8: masukan koefisien urut alami, keluaran 8x8 8-bit ke `out`. */
const idct8x8 = (coef, out, outStride) => {
  // Blok dengan HANYA komponen DC adalah mayoritas area pada scan dokumen
  // (latar putih/polos). Nilainya seragam, jadi IDCT penuh bisa dilewati:
  // ratusan ribu blok per halaman tidak perlu 1024 perkalian masing-masing.
  let onlyDC = true;
  for (let i = 1; i < 64; i++) {
    if (coef[i] !== 0) { onlyDC = false; break; }
  }
  if (onlyDC) {
    const val = Math.round(coef[0] / 8 + 128);
    const v = val < 0 ? 0 : val > 255 ? 255 : val;
    for (let y = 0; y < 8; y++) {
      const row = y * outStride;
      for (let x = 0; x < 8; x++) out[row + x] = v;
    }
    return;
  }

  idctPass(coef, _tmpBlock, 8); // baris
  // kolom: transpose sambil membaca _tmpBlock
  for (let x = 0; x < 8; x++) {
    for (let y = 0; y < 8; y++) {
      let sum = 0;
      const cy = y * 8;
      for (let v = 0; v < 8; v++) sum += _tmpBlock[v * 8 + x] * IDCT_COS[cy + v];
      const val = Math.round(sum / 2 + 128);
      out[y * outStride + x] = val < 0 ? 0 : val > 255 ? 255 : val;
    }
  }
};

/** Tabel Huffman: bangun peta kode -> nilai dari DHT.
 *
 * Kunci memakai angka `(panjang << 16) | kode`, bukan string "len:code".
 * Decoding memanggil ini jutaan kali per gambar; pembentukan string pada setiap
 * bit adalah biaya besar.
 */
const buildHuffTable = (counts, values) => {
  const table = new Map();
  let code = 0;
  let k = 0;
  for (let len = 1; len <= 16; len++) {
    for (let i = 0; i < counts[len - 1]; i++) {
      table.set((len << 16) | code, values[k++]);
      code++;
    }
    code <<= 1;
  }
  return table;
};

/** Pembaca bit MSB-first dengan penanganan 0xFF00 dan restart. */
class BitReader {
  constructor(buf, pos = 0) {
    this.buf = buf;
    this.pos = pos;
    this.bitBuf = 0;
    this.bitCnt = 0;
    this.markerHit = null;
  }

  /** Isi buffer bit sampai minimal 16 bit tersedia (atau data habis). */
  fill() {
    while (this.bitCnt <= 16) {
      let byte = 0;
      if (this.pos < this.buf.length) {
        byte = this.buf[this.pos++];
        if (byte === 0xff) {
          const next = this.buf[this.pos];
          if (next === 0x00) {
            this.pos++; // 0xFF00 = byte data 0xFF
          } else {
            // Penanda sebenarnya (RST/EOI): jangan dimakan.
            this.pos--;
            this.markerHit = this.pos;
            byte = 0;
            this.bitBuf = (this.bitBuf << 8) | byte;
            this.bitCnt += 8;
            break;
          }
        }
      }
      // Data habis: dorong nol agar decoder berhenti mulus, bukan crash.
      this.bitBuf = ((this.bitBuf << 8) | byte) >>> 0;
      this.bitCnt += 8;
    }
  }

  readBit() {
    if (this.bitCnt === 0) this.fill();
    this.bitCnt--;
    return (this.bitBuf >>> this.bitCnt) & 1;
  }

  /**
   * Baca n bit sekaligus. Di sinilah hampir seluruh waktu decoding habis:
   * satu blok 8x8 bisa memanggil jutaan kali bila memakai readBit per bit.
   */
  readBits(n) {
    if (n === 0) return 0;
    if (this.bitCnt < n) this.fill();
    this.bitCnt -= n;
    return (this.bitBuf >>> this.bitCnt) & ((1 << n) - 1);
  }

  huffDecode(table) {
    let code = 0;
    for (let len = 1; len <= 16; len++) {
      if (this.bitCnt === 0) this.fill();
      this.bitCnt--;
      code = (code << 1) | ((this.bitBuf >>> this.bitCnt) & 1);
      const v = table.get((len << 16) | code);
      if (v !== undefined) return v;
    }
    throw new Error("JPEG rusak: kode Huffman tidak dikenal.");
  }

  /** Lewati penanda RSTn bila ditemukan. */
  alignToMarker() {
    this.bitCnt = 0;
    while (this.pos + 1 < this.buf.length) {
      if (this.buf[this.pos] === 0xff) {
        const m = this.buf[this.pos + 1];
        if (m !== 0x00) return m;
      }
      this.pos++;
    }
    return null;
  }
}

const extend = (v, t) => (v < 1 << (t - 1) ? v - (1 << t) + 1 : v);

/**
 * Decode JPEG utuh (SOI..EOI).
 * @param {Buffer} buf
 * @returns {{data: Buffer, width: number, height: number, components: number}}
 */
const decodeJpeg = (buf, opts = {}) => {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) {
    throw new Error("JPEG tidak diawali penanda SOI.");
  }

  let pos = 2;
  let qt = {};
  let huffDC = {};
  let huffAC = {};
  let frame = null;
  let restartInterval = 0;
  let scan = null;
  let adobeTransform = null;

  const u16 = (p) => (buf[p] << 8) | buf[p + 1];

  while (pos < buf.length) {
    if (buf[pos] !== 0xff) { pos++; continue; }
    const marker = buf[pos + 1];
    pos += 2;

    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (marker === 0xd9) break;

    const len = u16(pos);
    const seg = buf.slice(pos + 2, pos + len);
    pos += len;

    if (marker === 0xdb) { // DQT
      let p = 0;
      while (p < seg.length) {
        const pq = seg[p] >> 4;
        const tq = seg[p] & 0x0f;
        p++;
        const table = new Int32Array(64);
        for (let i = 0; i < 64; i++) {
          table[ZIGZAG[i]] = pq ? (seg[p] << 8) | seg[p + 1] : seg[p];
          p += pq ? 2 : 1;
        }
        qt[tq] = table;
      }
    } else if (marker === 0xc4) { // DHT
      let p = 0;
      while (p < seg.length) {
        const tc = seg[p] >> 4;
        const th = seg[p] & 0x0f;
        p++;
        const counts = Array.from(seg.slice(p, p + 16));
        const total = counts.reduce((a, b) => a + b, 0);
        p += 16;
        const values = Array.from(seg.slice(p, p + total));
        p += total;
        const table = buildHuffTable(counts, values);
        if (tc === 0) huffDC[th] = table;
        else huffAC[th] = table;
      }
    } else if (marker === 0xdd) { // DRI
      restartInterval = u16(0) && ((seg[0] << 8) | seg[1]);
    } else if (marker === 0xee) { // APP14 (Adobe)
      if (seg.length >= 12 && seg.slice(0, 5).toString("ascii") === "Adobe") {
        adobeTransform = seg[11];
      }
    } else if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      if (marker === 0xc2 || marker === 0xc6 || marker === 0xca || marker === 0xce) {
        throw new Error("JPEG progresif belum didukung. Simpan ulang sebagai JPEG biasa atau PNG.");
      }
      if (marker >= 0xc9 && marker <= 0xcb || marker >= 0xcd && marker <= 0xcf) {
        throw new Error("JPEG arithmetic coding belum didukung. Simpan ulang sebagai JPEG biasa atau PNG.");
      }
      if (seg[0] !== 8) throw new Error(`JPEG ${seg[0]} bit belum didukung. Simpan ulang sebagai 8 bit.`);

      const height = (seg[1] << 8) | seg[2];
      const width = (seg[3] << 8) | seg[4];
      const n = seg[5];
      const comps = [];
      for (let i = 0; i < n; i++) {
        const off = 6 + i * 3;
        comps.push({
          id: seg[off],
          h: seg[off + 1] >> 4,
          v: seg[off + 1] & 0x0f,
          tq: seg[off + 2],
        });
      }
      frame = { marker, height, width, comps };
    } else if (marker === 0xda) { // SOS
      const ns = seg[0];
      const parts = [];
      for (let i = 0; i < ns; i++) {
        const off = 1 + i * 2;
        parts.push({
          id: seg[off],
          dc: seg[off + 1] >> 4,
          ac: seg[off + 1] & 0x0f,
        });
      }
      scan = { parts, dataStart: pos };
      break; // entropy data menyusul
    }
  }

  if (!frame || !scan) throw new Error("JPEG tidak memuat frame atau scan.");

  const { width, height } = frame;
  const ncomp = frame.comps.length;
  if (ncomp !== 1 && ncomp !== 3) {
    throw new Error(`JPEG ${ncomp} komponen (CMYK) belum didukung. Simpan ulang sebagai RGB.`);
  }
  if (!width || !height) throw new Error("JPEG tanpa ukuran.");

  const hmax = Math.max(...frame.comps.map((c) => c.h));
  const vmax = Math.max(...frame.comps.map((c) => c.v));
  const mcuW = hmax * 8;
  const mcuH = vmax * 8;
  const mcusX = Math.ceil(width / mcuW);
  const mcusY = Math.ceil(height / mcuH);

  // Bidang per komponen
  const planes = frame.comps.map((c) => {
    const cw = Math.ceil((width * c.h) / hmax);
    const ch = Math.ceil((height * c.v) / vmax);
    return { data: new Uint8Array(cw * ch), cw, ch, h: c.h, v: c.v };
  });

  const reader = new BitReader(buf, scan.dataStart);
  let preds = new Array(ncomp).fill(0);
  const coef = new Float64Array(64);
  const block = new Float64Array(64);

  const decodeBlock = (compIdx, plane, bx, by) => {
    const part = scan.parts[compIdx];
    const dcTable = huffDC[part.dc];
    const acTable = huffAC[part.ac];
    const q = qt[frame.comps[compIdx].tq];
    if (!dcTable || !acTable || !q) throw new Error("JPEG tanpa tabel kuantisasi/Huffman.");

    coef.fill(0);
    const t = reader.huffDecode(dcTable);
    const diff = t === 0 ? 0 : extend(reader.readBits(t), t);
    preds[compIdx] += diff;
    coef[0] = preds[compIdx] * q[0];

    for (let k = 1; k < 64;) {
      const rs = reader.huffDecode(acTable);
      const r = rs >> 4;
      const s = rs & 0x0f;
      if (s === 0) {
        if (r === 15) { k += 16; continue; }
        break;
      }
      k += r;
      if (k > 63) break;
      const val = extend(reader.readBits(s), s);
      coef[ZIGZAG[k]] = val * q[ZIGZAG[k]];
      k++;
    }

    block.fill(0);
    idct8x8(coef, block, 8);

    // Tulis blok ke bidang komponen
    for (let y = 0; y < 8; y++) {
      const py = by + y;
      if (py >= plane.ch) break;
      for (let x = 0; x < 8; x++) {
        const px = bx + x;
        if (px >= plane.cw) break;
        plane.data[py * plane.cw + px] = block[y * 8 + x];
      }
    }
  };

  let mcuCount = 0;
  for (let my = 0; my < mcusY; my++) {
    for (let mx = 0; mx < mcusX; mx++) {
      if (restartInterval && mcuCount > 0 && mcuCount % restartInterval === 0) {
        const m = reader.alignToMarker();
        reader.pos += 2;
        reader.bitCnt = 0;
        preds = new Array(ncomp).fill(0);
        if (m === null) throw new Error("JPEG rusak: restart marker hilang.");
      }
      for (let ci = 0; ci < ncomp; ci++) {
        const c = frame.comps[ci];
        const plane = planes[ci];
        for (let v = 0; v < c.v; v++) {
          for (let h = 0; h < c.h; h++) {
            decodeBlock(ci, plane, (mx * c.h + h) * 8, (my * c.v + v) * 8);
          }
        }
      }
      mcuCount++;
    }
  }

  // Susun RGB. Komponen chroma yang lebih kecil dari luma di-upsample dengan
  // interpolasi bilinear; memakai "piksel terdekat" (floor) membuat tepi warna
  // bergerigi dan, pada teks hitam-putih hasil scan, memunculkan bintik warna.
  // Penanda Adobe (APP14) menyatakan transform warna; bila tidak ada, JPEG
  // 3 komponen standar adalah YCbCr. Pengecualian nyata: JPEG yang tertanam di
  // TIFF (Photoshop/Pillow) kadang menyimpan data RGB apa adanya dan hanya
  // menandai komponennya "R","G","B" (0x52,0x47,0x42) di SOF. Tanpa cek ini,
  // RGB dibaca sebagai YCbCr dan seluruh gambar bergeser warna (biru jadi hijau).
  const compIds = frame.comps.map((c) => c.id).join(",");
  const tiffRgb = compIds === "82,71,66";
  const isRGB = ncomp === 3 &&
    (opts.forceRgb ? true : opts.forceYcbcr ? false : (adobeTransform === 0 || tiffRgb));

  // Sampel satu komponen pada koordinat luma, dengan penskalaan bilinear.
  const sampleAt = (plane, x, y) => {
    if (plane.cw === width && plane.ch === height) {
      return plane.data[y * plane.cw + x] || 0;
    }
    const fx = ((x + 0.5) * plane.cw) / width - 0.5;
    const fy = ((y + 0.5) * plane.ch) / height - 0.5;
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const tx = fx - x0;
    const ty = fy - y0;
    const clampX = (v) => (v < 0 ? 0 : v >= plane.cw ? plane.cw - 1 : v);
    const clampY = (v) => (v < 0 ? 0 : v >= plane.ch ? plane.ch - 1 : v);
    const p = (xx, yy) => plane.data[clampY(yy) * plane.cw + clampX(xx)] || 0;
    const a = p(x0, y0);
    const b = p(x0 + 1, y0);
    const c = p(x0, y0 + 1);
    const d = p(x0 + 1, y0 + 1);
    return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
  };

  const out = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 3;
      if (ncomp === 1) {
        const v = Math.round(sampleAt(planes[0], x, y));
        out[o] = v; out[o + 1] = v; out[o + 2] = v;
      } else {
        const c0 = sampleAt(planes[0], x, y);
        const c1 = sampleAt(planes[1], x, y);
        const c2 = sampleAt(planes[2], x, y);
        if (isRGB) {
          out[o] = Math.round(c0); out[o + 1] = Math.round(c1); out[o + 2] = Math.round(c2);
        } else {
          // YCbCr -> RGB
          const cb = c1 - 128;
          const cr = c2 - 128;
          const r = c0 + 1.402 * cr;
          const g = c0 - 0.344136 * cb - 0.714136 * cr;
          const b = c0 + 1.772 * cb;
          out[o] = r < 0 ? 0 : r > 255 ? 255 : Math.round(r);
          out[o + 1] = g < 0 ? 0 : g > 255 ? 255 : Math.round(g);
          out[o + 2] = b < 0 ? 0 : b > 255 ? 255 : Math.round(b);
        }
      }
    }
  }

  return { data: out, width, height, components: ncomp };
};

module.exports = { decodeJpeg };
