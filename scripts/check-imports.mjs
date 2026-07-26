#!/usr/bin/env node
/**
 * Pemeriksa impor komponen JSX.
 *
 * Vite/esbuild tidak melakukan type-check, sehingga komponen yang dipakai tapi
 * lupa di-import LOLOS build dan baru meledak saat halaman dibuka
 * (mis. <Select> di Reports, <ImageIcon> di Pengaturan).
 * Skrip ini menangkapnya sebelum sampai ke pengguna.
 *
 * Jalankan: npm run check
 */
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, extname } from 'path';

const SRC = 'src';
// Nama yang berasal dari HTML/global, bukan komponen React
const IGNORE = new Set(['React', 'Fragment']);

const walk = (dir, out = []) => {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (extname(full) === '.jsx') out.push(full);
  }
  return out;
};

let problems = 0;

for (const file of walk(SRC)) {
  const code = readFileSync(file, 'utf8');

  // Komponen yang dipakai di JSX: <NamaKapital ...
  const used = new Set(
    [...code.matchAll(/<([A-Z][A-Za-z0-9_]*)[\s/>]/g)].map((m) => m[1])
  );

  // Nama yang tersedia: hasil import + deklarasi lokal
  const declared = new Set();

  // Buang impor efek-samping (`import './x.css'`) agar tidak mengacaukan
  // pencocokan klausa impor bernama di bawahnya.
  const codeForImports = code.replace(/import\s+['"][^'"]+['"]\s*;?/g, '');

  for (const m of codeForImports.matchAll(/import\s+([\s\S]*?)\s+from\s+['"][^'"]+['"]/g)) {
    const clause = m[1];
    // default: `import App from …` / `import App, { x } from …`
    const def = clause.match(/^\s*([A-Za-z0-9_$]+)\s*(?:,|$)/);
    if (def) declared.add(def[1]);
    // namespace: `import * as Foo`
    for (const d of clause.matchAll(/\*\s+as\s+([A-Za-z0-9_$]+)/g)) declared.add(d[1]);
    // named + alias
    const braces = clause.match(/\{([\s\S]*?)\}/);
    if (braces) {
      for (const part of braces[1].split(',')) {
        const alias = part.includes(' as ') ? part.split(' as ')[1] : part;
        const name = alias.trim();
        if (name) declared.add(name);
      }
    }
  }

  // Deklarasi lokal
  for (const m of code.matchAll(/(?:const|let|var|function|class)\s+([A-Z][A-Za-z0-9_]*)/g)) {
    declared.add(m[1]);
  }
  // Destructuring bernama-ulang, mis. props `{ icon: Icon }` → Icon tersedia
  for (const m of code.matchAll(/:\s*([A-Z][A-Za-z0-9_]*)/g)) declared.add(m[1]);

  const missing = [...used].filter((n) => !declared.has(n) && !IGNORE.has(n));
  if (missing.length) {
    problems += missing.length;
    console.error(`✗ ${file}`);
    missing.forEach((n) => console.error(`    <${n}> dipakai tapi tidak di-import`));
  }
}

if (problems) {
  console.error(`\n${problems} komponen tidak ter-import. Perbaiki sebelum deploy.`);
  process.exit(1);
}
console.log('✓ Semua komponen JSX ter-import dengan benar.');
