#!/usr/bin/env node
/**
 * Migrasi Firestore: (default) @ asia-east1  →  kontrack @ asia-southeast2
 *
 * Menyalin SELURUH koleksi beserta subkoleksi, mempertahankan ID dokumen.
 * Sekaligus menulis ulang setiap URL Storage lama menjadi bucket baru
 * (gs://kontrack), karena berkas dipindah oleh scripts/migrate-storage.sh.
 *
 * Memakai REST API Firestore, bukan SDK Admin, karena:
 *   1. kredensialnya cukup token dari gcloud CLI yang sudah aktif (ADC di mesin
 *      ini memakai akun lain yang tidak punya akses ke proyek);
 *   2. nilai dokumen diteruskan dalam bentuk terketik apa adanya
 *      (timestampValue, referenceValue, bytesValue, …) sehingga tidak ada
 *      konversi tipe yang bisa merusak data.
 *
 * Pemakaian:
 *   node scripts/migrate-firestore.cjs            # dry-run (default, tidak menulis)
 *   node scripts/migrate-firestore.cjs --apply    # benar-benar menulis
 *   node scripts/migrate-firestore.cjs --apply --only=projects,invoices
 *   node scripts/migrate-firestore.cjs --verify   # bandingkan jumlah dokumen
 */

const { execFileSync } = require('child_process');

const PROJECT_ID = 'sistem-keuangan-ptpeb';
const SOURCE_DB = '(default)';
const TARGET_DB = 'kontrack';
const API = 'https://firestore.googleapis.com/v1';

const OLD_BUCKETS = [
  'sistem-keuangan-ptpeb.firebasestorage.app',
  'sistem-keuangan-ptpeb.appspot.com'
];
const NEW_BUCKET = 'kontrack';

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const VERIFY = args.includes('--verify');
const dumpArg = args.find((a) => a.startsWith('--dump='));
const DUMP = dumpArg ? dumpArg.slice('--dump='.length) : null;
const onlyArg = args.find((a) => a.startsWith('--only='));
const ONLY = onlyArg ? onlyArg.slice('--only='.length).split(',').map((s) => s.trim()) : null;

const root = (db) => `projects/${PROJECT_ID}/databases/${db}/documents`;

// --- kredensial --------------------------------------------------------------
// Token dibaca langsung dari gcloud oleh proses ini; tidak ditulis ke berkas.
let cachedToken = null;
let tokenAt = 0;
function token() {
  if (cachedToken && Date.now() - tokenAt < 45 * 60 * 1000) return cachedToken;
  cachedToken = execFileSync('gcloud', ['auth', 'print-access-token'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  }).trim();
  tokenAt = Date.now();
  return cachedToken;
}

async function api(method, url, body) {
  const res = await fetch(url.startsWith('http') ? url : `${API}/${url}`, {
    method,
    headers: {
      Authorization: `Bearer ${token()}`,
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${method} ${res.status}: ${text.slice(0, 400)}`);
  }
  return res.json();
}

const stats = { collections: 0, docs: 0, rewritten: 0, errors: 0 };

// --- transformasi nilai ------------------------------------------------------

function rewriteString(s) {
  let out = s;
  for (const b of OLD_BUCKETS) if (out.includes(b)) out = out.split(b).join(NEW_BUCKET);
  if (out !== s) stats.rewritten++;
  return out;
}

/**
 * Telusuri nilai terketik Firestore. Hanya dua hal yang diubah:
 *  - stringValue  → nama bucket lama ditukar bucket baru
 *  - referenceValue → diarahkan ke database tujuan (bukan lagi "(default)")
 * Sisanya (timestamp, bytes, geo, integer, …) diteruskan persis.
 */
function convertValue(v) {
  if (v == null || typeof v !== 'object') return v;

  if ('stringValue' in v) return { stringValue: rewriteString(v.stringValue) };

  if ('referenceValue' in v) {
    return { referenceValue: v.referenceValue.replace(`/databases/${SOURCE_DB}/`, `/databases/${TARGET_DB}/`) };
  }

  if ('mapValue' in v) {
    const fields = {};
    for (const [k, inner] of Object.entries(v.mapValue.fields || {})) fields[k] = convertValue(inner);
    return { mapValue: { fields } };
  }

  if ('arrayValue' in v) {
    return { arrayValue: { values: (v.arrayValue.values || []).map(convertValue) } };
  }

  return v;
}

function convertFields(fields) {
  const out = {};
  for (const [k, v] of Object.entries(fields || {})) out[k] = convertValue(v);
  return out;
}

// --- pembacaan ---------------------------------------------------------------

async function listCollectionIds(parent) {
  const ids = [];
  let pageToken;
  do {
    const body = { pageSize: 300 };
    if (pageToken) body.pageToken = pageToken;
    const res = await api('POST', `${parent}:listCollectionIds`, body);
    ids.push(...(res.collectionIds || []));
    pageToken = res.nextPageToken;
  } while (pageToken);
  return ids;
}

async function listDocuments(parent, collectionId) {
  const docs = [];
  let pageToken;
  do {
    // showMissing=true agar dokumen "hantu" (tidak punya field tetapi punya
    // subkoleksi) tetap terlihat sehingga subkoleksinya ikut tersalin.
    const q = new URLSearchParams({ pageSize: '300', showMissing: 'true' });
    if (pageToken) q.set('pageToken', pageToken);
    const res = await api('GET', `${parent}/${encodeURIComponent(collectionId)}?${q}`);
    docs.push(...(res.documents || []));
    pageToken = res.nextPageToken;
  } while (pageToken);
  return docs;
}

// --- penulisan ---------------------------------------------------------------

async function batchWrite(writes) {
  const CHUNK = 200;
  for (let i = 0; i < writes.length; i += CHUNK) {
    await api('POST', `projects/${PROJECT_ID}/databases/${TARGET_DB}/documents:commit`, {
      writes: writes.slice(i, i + CHUNK)
    });
  }
}

// --- rekursi -----------------------------------------------------------------

async function copyCollection(sourceParent, collectionId, depth, relPath) {
  const docs = await listDocuments(sourceParent, collectionId);
  stats.collections++;

  const real = docs.filter((d) => d.fields);
  console.log(`${'  '.repeat(depth)}• ${relPath} — ${real.length} dokumen`);

  if (real.length && APPLY) {
    await batchWrite(
      real.map((d) => {
        const id = d.name.slice(d.name.lastIndexOf('/') + 1);
        return {
          update: {
            name: `${root(TARGET_DB)}/${relPath}/${id}`,
            fields: convertFields(d.fields)
          }
        };
      })
    );
  }
  stats.docs += real.length;

  // Subkoleksi ditelusuri per dokumen — Firestore tidak menyediakan daftar global.
  for (const d of docs) {
    const id = d.name.slice(d.name.lastIndexOf('/') + 1);
    const subIds = await listCollectionIds(d.name);
    for (const sub of subIds) {
      await copyCollection(d.name, sub, depth + 1, `${relPath}/${id}/${sub}`);
    }
  }
}

// --- verifikasi --------------------------------------------------------------

async function countAll(db, parent, collectionId, relPath, out) {
  const docs = await listDocuments(parent, collectionId);
  const real = docs.filter((d) => d.fields);
  out[relPath] = (out[relPath] || 0) + real.length;
  for (const d of docs) {
    const id = d.name.slice(d.name.lastIndexOf('/') + 1);
    for (const sub of await listCollectionIds(d.name)) {
      await countAll(db, d.name, sub, `${relPath}/*/${sub}`, out);
    }
  }
  return out;
}

async function verify() {
  console.log('\nVerifikasi jumlah dokumen per koleksi:\n');
  const result = {};
  for (const db of [SOURCE_DB, TARGET_DB]) {
    const out = {};
    for (const c of await listCollectionIds(root(db))) {
      await countAll(db, root(db), c, c, out);
    }
    result[db] = out;
  }
  const keys = [...new Set([...Object.keys(result[SOURCE_DB]), ...Object.keys(result[TARGET_DB])])].sort();
  let ok = true;
  console.log(`${'koleksi'.padEnd(42)} ${'lama'.padStart(6)} ${'baru'.padStart(6)}`);
  for (const k of keys) {
    const a = result[SOURCE_DB][k] || 0;
    const b = result[TARGET_DB][k] || 0;
    if (a !== b) ok = false;
    console.log(`${k.padEnd(42)} ${String(a).padStart(6)} ${String(b).padStart(6)} ${a === b ? '' : '  <-- BEDA'}`);
  }
  console.log(ok ? '\nSemua koleksi cocok.\n' : '\nAda selisih — periksa baris bertanda.\n');
  return ok;
}

// --- main --------------------------------------------------------------------

/**
 * Cadangan mentah database SUMBER ke berkas JSON (satu berkas per koleksi,
 * nilai terketik apa adanya). Dijalankan sebelum database lama dihapus agar
 * ada salinan yang bisa dikembalikan sepenuhnya bila diperlukan.
 */
async function dumpTo(dir) {
  const fs = require('fs');
  const pathMod = require('path');
  fs.mkdirSync(dir, {recursive: true});

  const roots = await listCollectionIds(root(SOURCE_DB));
  const index = {};

  for (const c of roots) {
    const docs = await listDocuments(root(SOURCE_DB), c);
    const real = docs.filter((d) => d.fields);
    fs.writeFileSync(
        pathMod.join(dir, `${c}.json`),
        JSON.stringify(real.map((d) => ({
          id: d.name.slice(d.name.lastIndexOf('/') + 1),
          createTime: d.createTime,
          updateTime: d.updateTime,
          fields: d.fields,
        })), null, 2)
    );
    index[c] = real.length;
    console.log(`  ${c}: ${real.length} dokumen`);
  }

  fs.writeFileSync(pathMod.join(dir, '_index.json'), JSON.stringify({
    project: PROJECT_ID,
    database: SOURCE_DB,
    counts: index,
    total: Object.values(index).reduce((a, b) => a + b, 0),
  }, null, 2));

  return index;
}

(async () => {
  if (DUMP) {
    console.log(`\nMencadangkan ${SOURCE_DB} ke ${DUMP}\n`);
    const idx = await dumpTo(DUMP);
    console.log(`\nTotal ${Object.values(idx).reduce((a, b) => a + b, 0)} dokumen tercadang.\n`);
    process.exit(0);
  }

  if (VERIFY) {
    process.exit((await verify()) ? 0 : 1);
  }

  console.log(
    `\n${APPLY ? '>> MENULIS' : '>> DRY-RUN (tidak menulis apa pun)'}\n` +
      `   ${PROJECT_ID}: ${SOURCE_DB} (asia-east1)  ->  ${TARGET_DB} (asia-southeast2)\n`
  );

  const roots = await listCollectionIds(root(SOURCE_DB));
  console.log(`Koleksi akar: ${roots.join(', ') || '(kosong)'}\n`);

  const selected = ONLY ? roots.filter((c) => ONLY.includes(c)) : roots;
  if (ONLY) {
    const missing = ONLY.filter((n) => !roots.includes(n));
    if (missing.length) console.warn(`! koleksi tidak ditemukan: ${missing.join(', ')}\n`);
  }

  for (const c of selected) {
    try {
      await copyCollection(root(SOURCE_DB), c, 0, c);
    } catch (e) {
      stats.errors++;
      console.error(`  ! gagal pada ${c}: ${e.message}`);
    }
  }

  console.log(
    `\nSelesai. Koleksi: ${stats.collections}, dokumen: ${stats.docs}, ` +
      `URL storage ditulis ulang: ${stats.rewritten}, error: ${stats.errors}`
  );
  if (!APPLY) console.log('Jalankan ulang dengan --apply untuk benar-benar menyalin.\n');

  process.exit(stats.errors > 0 ? 1 : 0);
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
