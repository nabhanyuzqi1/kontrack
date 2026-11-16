// Verifikasi konversi TIFF JPEG (kompresi 6 & 7) terhadap Pillow.
// Menjalankan: node scratch/verify-tiff.cjs
const fs = require("fs");
const path = require("path");
const {execFileSync} = require("child_process");
const {tiffToPng} = require("../functions/tiff.js");

const scratch = require("os").tmpdir();
const png = (f) => path.join(scratch, f);

const py = (code) => {
  try {
    return execFileSync("python3", ["-c", code], {encoding: "utf8"}).trim();
  } catch (e) {
    return "PYERR " + (e.stderr || e.message).slice(0, 200);
  }
};

// 1. Siapkan bahan: JPEG 4:4:4, TIFF kompresi 7 dari Pillow.
py(`
from PIL import Image
im = Image.open('C:/Windows/Web/4K/Wallpaper/Windows/img0_1024x768.jpg').convert('RGB').resize((400,300))
im.save('${png("v444.jpg").replace(/\\/g, "/")}', quality=88, subsampling=0)
im.save('${png("v7.tif").replace(/\\/g, "/")}', compression='tiff_jpeg')
im.convert('CMYK').save('${png("vcmyk.tif").replace(/\\/g, "/")}')
`);

const cases = [
  {file: "v7.tif", ok: true, label: "TIFF kompresi 7 (JPEGTables)"},
  {file: "vcmyk.tif", ok: false, label: "TIFF CMYK (harus ditolak)"},
];

let pass = 0;
let fail = 0;

for (const c of cases) {
  let result;
  try {
    const out = tiffToPng(fs.readFileSync(png(c.file)));
    fs.writeFileSync(png(c.file + ".png"), out.data);
    result = {ok: true, size: `${out.width}x${out.height}`};
  } catch (e) {
    result = {ok: false, message: e.message};
  }

  if (result.ok !== c.ok) {
    console.log(`GAGAL  ${c.label}: ${JSON.stringify(result)}`);
    fail++;
    continue;
  }
  if (!c.ok) {
    console.log(`LULUS  ${c.label} -> "${result.message}"`);
    pass++;
    continue;
  }

  // Bandingkan piksel terhadap Pillow sebagai acuan.
  const cmp = py(`
from PIL import Image
ref = Image.open('${png(c.file).replace(/\\/g, "/")}').convert('RGB')
dec = Image.open('${png(c.file + ".png").replace(/\\/g, "/")}').convert('RGB')
rp, dp = ref.load(), dec.load()
md = bad = n = 0
for y in range(ref.height):
    for x in range(ref.width):
        a, b = rp[x, y], dp[x, y]
        d = max(abs(a[i] - b[i]) for i in range(3))
        md = max(md, d); n += 1
        if d > 12: bad += 1
print(f"{md} {bad} {n}")
`);
  const [md, bad, n] = cmp.split(" ").map(Number);
  if (n > 0 && bad === 0 && md <= 12) {
    console.log(`LULUS  ${c.label} ${result.size}: selisih maks ${md}/255, ${bad} dari ${n} piksel menyimpang`);
    pass++;
  } else {
    console.log(`GAGAL  ${c.label}: maks ${md}, menyimpang ${bad}/${n} (${cmp})`);
    fail++;
  }
}

// 2. Decoder JPEG biasa harus tetap akurat (regresi).
try {
  const {decodeJpeg} = require("../functions/jpeg.js");
  const img = decodeJpeg(fs.readFileSync(png("v444.jpg")));
  fs.writeFileSync(png("v444.raw"), img.data);
  const cmp = py(`
from PIL import Image
ref = Image.open('${png("v444.jpg").replace(/\\/g, "/")}').convert('RGB')
mine = open('${png("v444.raw").replace(/\\/g, "/")}', 'rb').read()
rp = ref.load(); md = bad = 0
for y in range(ref.height):
    for x in range(ref.width):
        r, g, b = rp[x, y]; o = (y * ref.width + x) * 3
        d = max(abs(r - mine[o]), abs(g - mine[o+1]), abs(b - mine[o+2]))
        md = max(md, d)
        if d > 12: bad += 1
print(f"{md} {bad}")
`);
  const [md, bad] = cmp.split(" ").map(Number);
  if (bad === 0 && md <= 12) {
    console.log(`LULUS  JPEG 4:4:4 langsung: selisih maks ${md}/255`);
    pass++;
  } else {
    console.log(`GAGAL  JPEG 4:4:4 langsung: maks ${md}, ${bad} menyimpang`);
    fail++;
  }
} catch (e) {
  console.log(`GAGAL  JPEG langsung: ${e.message}`);
  fail++;
}

for (const f of ["v444.jpg", "v7.tif", "vcmyk.tif", "v7.tif.png", "vcmyk.tif.png", "v444.raw"]) {
  try { fs.unlinkSync(png(f)); } catch {}
}

console.log(`\nhasil: ${pass} lulus, ${fail} gagal`);
process.exit(fail ? 1 : 0);
