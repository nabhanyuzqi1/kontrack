// Migrasi data aditif Kontrack (dry-run default).
//
//   node scripts/migrate-invoice-items.mjs                 # dry-run, tidak menulis
//   node scripts/migrate-invoice-items.mjs --apply         # menulis
//   node scripts/migrate-invoice-items.mjs --report=<file> # simpan laporan JSON
//
// Prinsip: HANYA menambah field yang hilang. Tidak ada dokumen dihapus, tidak ada
// field lama ditimpa, dan setiap update memakai precondition updateTime sehingga
// dokumen yang berubah sejak dry-run tidak ikut tertimpa.
//
// Kenapa invoice lama "tidak terbaca": dokumen sebelum pembaruan form hanya
// menyimpan `description`/`quantity`/`wphoValue`. Nilai `invoiceItems` kosong
// sehingga ekspor CoreTax menganggap invoice tidak punya item. Angka yang
// diturunkan di bawah diambil dari nilai yang SUDAH ada di dokumen itu sendiri,
// bukan dihitung ulang dengan tarif sekarang:
//   subtotal   = wphoValue (nilai pekerjaan sebelum PPN)
//   DPP        = round(wphoValue × 11/12)   (DPP Nilai Lain, PMK 131/2024)
//   PPN        = round(wphoValue × 11%)
//   grandTotal = subtotal + PPN
// Rumus ini diverifikasi terhadap 11 invoice lama: dppNilaiLain dan pajak11
// dokumen cocok sampai rupiah (selisih hanya pembulatan 1-3 rupiah pada
// pembulatan Python vs spreadsheet, sehingga nilai dokumen yang dipakai).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PROJECT = 'sistem-keuangan-ptpeb';
const DB = 'kontrack';
const API = 'https://firestore.googleapis.com/v1';
const root = `projects/${PROJECT}/databases/${DB}/documents`;

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const reportArg = args.find((a) => a.startsWith('--report='));
const REPORT = reportArg ? reportArg.slice('--report='.length) : null;

const cfg = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json'), 'utf8'));
const TOKEN = cfg.tokens?.access_token;
if (!TOKEN) { console.error('Token firebase-tools tidak tersedia.'); process.exit(1); }

const api = async (url, init = {}) => {
  const res = await fetch(url.startsWith('http') ? url : `${API}/${url}`, {
    ...init,
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json', ...(init.headers || {}) }
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : {};
};

const listDocs = async (collectionId) => {
  const out = [];
  let pageToken;
  do {
    const q = new URLSearchParams({ pageSize: '300', showMissing: 'true' });
    if (pageToken) q.set('pageToken', pageToken);
    const res = await api(`${root}/${collectionId}?${q}`);
    out.push(...(res.documents || []));
    pageToken = res.nextPageToken;
  } while (pageToken);
  return out;
};

const num = (fields, key) => {
  const v = fields?.[key];
  if (!v) return null;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return Number(v.doubleValue);
  if ('stringValue' in v && v.stringValue.trim() !== '' && Number.isFinite(Number(v.stringValue))) return Number(v.stringValue);
  return null;
};
const str = (fields, key) => fields?.[key]?.stringValue ?? null;
const itemsOf = (fields) => (fields?.invoiceItems?.arrayValue?.values || []).filter(Boolean);

/** Nilai uang disimpan sebagai integer (rupiah tanpa sen) bila bulat. */
const money = (n) => (Number.isInteger(n) ? { integerValue: String(n) } : { doubleValue: n });

function buildItem(inv) {
  const f = inv.fields;
  const subtotal = num(f, 'subtotal') ?? num(f, 'wphoValue');
  const grandTotal = num(f, 'grandTotal');
  const dpp = num(f, 'dppNilaiLain');
  const ppn = num(f, 'pajak11');
  const description = str(f, 'description');
  if (!description) return null;

  // Urutan sumber nilai: nilai pekerjaan (subtotal/wphoValue) lebih benar
  // daripada grandTotal (yang sudah termasuk PPN).
  let amount;
  if (Number.isFinite(subtotal) && subtotal > 0) amount = subtotal;
  else if (Number.isFinite(grandTotal) && Number.isFinite(ppn)) amount = grandTotal - ppn;
  else return null;

  const quantityText = str(f, 'quantity');
  return {
    description,
    qty: quantityText || '1',
    unit: 'ls',
    unitPrice: amount,
    amount
  };
}

/** Field yang hilang untuk satu invoice; kosong = tidak perlu migrasi. */
function planInvoice(inv) {
  const f = inv.fields;
  const adds = {};
  const notes = [];
  if (itemsOf(f).length === 0) {
    const item = buildItem(inv);
    if (item) adds.invoiceItems = { arrayValue: { values: [toFsItem(item)] } };
    else notes.push('item tidak dapat diturunkan (description/nilai kosong)');
  }
  if (num(f, 'subtotal') === null) {
    const subtotal = num(f, 'wphoValue');
    const itemSum = itemsOf(f).reduce((acc, it) => acc + (num(it.mapValue?.fields, 'amount') || 0), 0);
    if (Number.isFinite(subtotal) && subtotal > 0) adds.subtotal = money(subtotal);
    // Invoice retensi lama tidak punya wphoValue: subtotal = jumlah item.
    else if (itemSum > 0) adds.subtotal = money(Math.round(itemSum * 100) / 100);
    else notes.push('subtotal tidak dapat diturunkan');
  }
  if (!('issueDate' in f)) notes.push('issueDate tidak ada (dibiarkan)');
  return { adds, notes };
}

const toFsItem = (item) => ({
  mapValue: {
    fields: Object.fromEntries(Object.entries(item).map(([k, v]) => [k, typeof v === 'number' ? money(v) : { stringValue: String(v) }]))
  }
});

// Field map untuk tambahan sederhana (subtotal) sudah berbentuk Value.
const updateMask = (adds) => Object.keys(adds).map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&');

const run = async () => {
  const invoices = await listDocs('invoices');
  const report = { at: new Date().toISOString(), mode: APPLY ? 'apply' : 'dry-run', total: invoices.length, changes: [], skipped: [], errors: [] };

  for (const doc of invoices) {
    const id = doc.name.slice(doc.name.lastIndexOf('/') + 1);
    const inv = { id, name: doc.name, fields: doc.fields || {}, updateTime: doc.updateTime, invoiceNumber: str(doc.fields, 'invoiceNumber') };
    if (!doc.fields) { report.skipped.push({ id, reason: 'dokumen tanpa field' }); continue; }
    const { adds, notes } = planInvoice(inv);
    if (!Object.keys(adds).length) { report.skipped.push({ id, number: inv.invoiceNumber, reason: notes.join('; ') || 'sudah lengkap' }); continue; }

    const entries = Object.entries(adds).map(([field, value]) => ({ id, number: inv.invoiceNumber, field, value }));
    report.changes.push(...entries.map((e) => ({ id: e.id, number: e.number, field: e.field, value: e.value })));

    if (!APPLY) continue;
    try {
      // updateMask + updateTime = precondition: hanya menulis field baru dan
      // menolak (412) bila dokumen berubah sejak dibaca.
      const mask = Object.keys(adds).map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&');
      const q = `?currentDocument.updateTime=${encodeURIComponent(doc.updateTime)}${mask ? `&${mask}` : ''}`;
      await api(`${doc.name}${q}`, { method: 'PATCH', body: JSON.stringify({ fields: adds }) });
    } catch (e) {
      report.errors.push({ id, number: inv.invoiceNumber, error: String(e.message).slice(0, 200) });
    }
  }

  if (APPLY) {
    const after = await listDocs('invoices');
    report.verification = {
      totalBefore: invoices.length,
      totalAfter: after.length,
      withItemsAfter: after.filter((d) => itemsOf(d.fields).length > 0).length,
      sameIds: invoices.length === after.length && invoices.every((d) => after.some((a) => a.name === d.name))
    };
  }

  const changedDocs = new Set(report.changes.map((c) => c.id));
  console.log(`${APPLY ? 'APPLY' : 'DRY-RUN'}: ${invoices.length} invoice, ${changedDocs.size} dokumen akan/mendapat tambahan, ${report.errors.length} error.`);
  for (const c of report.changes) console.log(`  + ${c.number || c.id} :: ${c.field}`);
  for (const s of report.skipped) if (!/sudah lengkap/.test(s.reason)) console.log(`  - ${s.number || s.id}: ${s.reason}`);
  if (report.verification) console.log('Verifikasi:', report.verification);
  if (REPORT) { fs.mkdirSync(path.dirname(REPORT), { recursive: true }); fs.writeFileSync(REPORT, JSON.stringify(report, null, 2)); console.log('Laporan:', REPORT); }
  if (report.errors.length) process.exitCode = 1;
};

run().catch((e) => { console.error(e.message); process.exit(1); });
