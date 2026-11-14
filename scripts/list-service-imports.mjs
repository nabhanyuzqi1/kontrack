// Hasilkan daftar ekspor yang dibutuhkan shim pratinjau, dibaca dari impor nyata
// di src/ supaya tidak ada siklus coba-jalan.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const TARGETS = [
  'projects',
  'transactions',
  'invoices',
  'settings',
  'auth',
  'clients',
  'users',
  'ai',
  'firebase',
  'aiInsights',
  'functionsRegion',
  'cache'
];

const walk = (dir, out = []) => {
  for (const e of readdirSync(dir)) {
    const full = join(dir, e);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (['.js', '.jsx'].includes(extname(full))) out.push(full);
  }
  return out;
};

const names = new Set();
// [^}]* penting: mencegah regex melompati batas antar-import
const re = /import\s*\{([^}]*)\}\s*from\s*'([^']*services\/([a-zA-Z]+))'/g;

for (const file of walk('src')) {
  const text = readFileSync(file, 'utf8');
  for (const m of text.matchAll(re)) {
    const clause = m[1];
    const mod = m[3];
    if (!TARGETS.includes(mod)) continue;
    clause.split(',').forEach((raw) => {
      const name = raw.trim().split(/\s+as\s+/)[0].trim();
      if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) names.add(name);
    });
  }
}

console.log([...names].sort().join('\n'));
console.log('--- total:', names.size);
