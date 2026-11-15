// Audit read-only Firestore Kontrack.
//   node scripts/audit-firestore-data.mjs --dump=<dir>
// Menulis cadangan mentah (nilai terketik apa adanya) + laporan bentuk field.
// TIDAK menulis apa pun ke Firestore. Token dibaca dari configstore firebase-tools.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PROJECT = 'sistem-keuangan-ptpeb';
const DB = 'kontrack';
const API = 'https://firestore.googleapis.com/v1';
const root = `projects/${PROJECT}/databases/${DB}/documents`;

const dumpArg = process.argv.find((a) => a.startsWith('--dump='));
const DUMP = dumpArg ? dumpArg.slice('--dump='.length) : null;

const cfg = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json'), 'utf8'));
const TOKEN = cfg.tokens?.access_token;
if (!TOKEN) { console.error('Token firebase-tools tidak ada. Jalankan firebase login (oleh pemilik).'); process.exit(1); }

const api = async (url, init = {}) => {
  const res = await fetch(url.startsWith('http') ? url : `${API}/${url}`, {
    ...init,
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json', ...(init.headers || {}) }
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : {};
};

async function listCollections(parent) {
  const out = [];
  let pageToken;
  do {
    const body = { pageSize: 300 };
    if (pageToken) body.pageToken = pageToken;
    const res = await api(`${parent}:listCollectionIds`, { method: 'POST', body: JSON.stringify(body) });
    out.push(...(res.collectionIds || []));
    pageToken = res.nextPageToken;
  } while (pageToken);
  return out;
}

async function listDocs(parent, collectionId) {
  const out = [];
  let pageToken;
  do {
    const q = new URLSearchParams({ pageSize: '300', showMissing: 'true' });
    if (pageToken) q.set('pageToken', pageToken);
    const res = await api(`${parent}/${encodeURIComponent(collectionId)}?${q}`);
    out.push(...(res.documents || []));
    pageToken = res.nextPageToken;
  } while (pageToken);
  return out;
}

const typeOf = (v) => Object.keys(v || {})[0] || 'unknown';

/** Rekursif: kumpulkan semua dokumen dengan path relatifnya. */
async function walk(parent, relPath, acc) {
  for (const c of await listCollections(parent)) {
    const docs = await listDocs(parent, c);
    const key = relPath ? `${relPath}/${c}` : c;
    for (const d of docs) {
      const id = d.name.slice(d.name.lastIndexOf('/') + 1);
      if (d.fields) acc.push({ path: `${key}/${id}`, collection: key, id, fields: d.fields, createTime: d.createTime, updateTime: d.updateTime });
      for (const sub of await listCollections(d.name)) {
        await walk(d.name, `${key}/${id}`, acc);
      }
    }
  }
  return acc;
}

const asString = (v) => v?.stringValue;
const field = (fields, name) => fields?.[name];

function detectIssues(docs) {
  const issues = [];
  for (const d of docs.filter((x) => x.collection === 'invoices')) {
    const f = d.fields;
    const add = (code, detail) => issues.push({ id: d.id, code, detail });
    if (!asString(field(f, 'invoiceNumber')) && !asString(field(f, 'number'))) add('number-missing', 'tidak ada invoiceNumber/number');
    const hasItems = (field(f, 'invoiceItems')?.arrayValue?.values || []).length > 0 || (field(f, 'items')?.arrayValue?.values || []).length > 0;
    if (!hasItems) add('items-missing', 'invoiceItems/items kosong');
    const grand = Number(field(f, 'grandTotal')?.doubleValue ?? field(f, 'grandTotal')?.integerValue ?? field(f, 'totals')?.mapValue?.fields?.grandTotal?.doubleValue ?? NaN);
    if (!Number.isFinite(grand) || grand <= 0) add('total-missing', 'grandTotal/totals.grandTotal tidak terbaca');
    const dateType = typeOf(field(f, 'issueDate'));
    if (!['timestampValue', 'stringValue'].includes(dateType)) add('date-invalid', `issueDate bertipe ${dateType}`);
    const clientId = asString(field(f, 'clientId')) || field(f, 'client')?.mapValue?.fields?.id?.stringValue;
    if (!clientId && !field(f, 'client')) add('client-missing', 'clientId/client kosong');
  }
  for (const d of docs.filter((x) => x.collection === 'transactions')) {
    const f = d.fields;
    const t = typeOf(field(f, 'date'));
    if (!['stringValue', 'timestampValue'].includes(t)) issues.push({ id: d.id, code: 'tx-date-invalid', detail: `date bertipe ${t}` });
    if (!Number.isFinite(Number(field(f, 'amount')?.doubleValue ?? field(f, 'amount')?.integerValue))) issues.push({ id: d.id, code: 'tx-amount-missing', detail: 'amount tidak terbaca' });
  }
  for (const d of docs.filter((x) => x.collection === 'projects')) {
    const f = d.fields;
    if (!asString(field(f, 'contractNumber'))) issues.push({ id: d.id, code: 'project-spk-missing', detail: 'contractNumber kosong' });
    if (!field(f, 'pkNumber')) issues.push({ id: d.id, code: 'project-pk-missing', detail: 'pkNumber kosong (aditif)' });
  }
  return issues;
}

const docs = await walk(root, '', []);
const byCollection = docs.reduce((acc, d) => ({ ...acc, [d.collection]: (acc[d.collection] || 0) + 1 }), {});
const issues = detectIssues(docs);

console.log(`Total dokumen: ${docs.length}`);
console.table(byCollection);
const byCode = issues.reduce((acc, i) => ({ ...acc, [i.code]: (acc[i.code] || 0) + 1 }), {});
console.log('Temuan bentuk data:'); console.table(byCode);

if (DUMP) {
  fs.mkdirSync(DUMP, { recursive: true });
  fs.writeFileSync(path.join(DUMP, 'documents.json'), JSON.stringify(docs, null, 2));
  fs.writeFileSync(path.join(DUMP, 'report.json'), JSON.stringify({ at: new Date().toISOString(), total: docs.length, byCollection, issues }, null, 2));
  console.log(`Cadangan mentah + laporan ditulis ke ${DUMP}`);
}
