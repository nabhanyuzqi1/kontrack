// src/services/invoices.js
// CRUD invoice — koleksi Firestore `invoices`, SKEMA MENGIKUTI KONTRACK LIVE
// agar 11 invoice PT PEB yang sudah ada terbaca & invoice baru kompatibel.
//
// Skema live (field flat): invoiceNumber, issueDate, dueDate, billingStage
// ("termin-4"), quantity ("85.51%"), sequence, description, projectId,
// projectValue, clientId, poNumber, pkNumber, dppNilaiLain, pajak11,
// grandTotal, netProceeds, taxDeductedAmount, pphRate, status, paidAt,
// taxInvoiceNumber, billingCode, ntpnNumber, coreTaxStatus ("menunggu"|
// "dicairkan"), taxEvents[], wpho*/bap* (dokumen pendukung),
// paymentTransactionId, taxExpenseTransactionId.

import {
  collection,
  doc,
  addDoc,
  getDocs,
  getDoc,
  updateDoc,
  deleteDoc,
  arrayUnion
} from 'firebase/firestore';
import { db, storage } from './firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { cached, invalidate, CACHE_KEYS } from './cache';
import { addTransaction } from './transactions';
import { normalizeInvoice, compareInvoices } from '../utils/invoiceNormalization';
import { AUTO_CATEGORY, TX_SOURCE } from '../utils/transactionMeta';

const COLLECTION = 'invoices';

export const INVOICE_STATUS = { DRAFT: 'draft', SENT: 'sent', PAID: 'paid', VOID: 'void' };
export const INVOICE_STATUS_LABEL = {
  draft: 'Draft',
  sent: 'Terkirim',
  paid: 'Terbayar',
  void: 'Void'
};

export const CORETAX_STATUS = { WAITING: 'menunggu', CLEARED: 'dicairkan' };

// billingStage disimpan lowercase-hyphen ("termin-4"); UI menampilkan "Termin 4".
export const BILLING_STAGES = [
  'termin-1',
  'termin-2',
  'termin-3',
  'termin-4',
  'termin-5',
  'termin-6',
  'termin-7',
  'termin-8',
  'termin-9',
  'termin-10',
  'retensi',
  'pelunasan'
];

export const billingStageLabel = (stage) => {
  if (!stage) return '';
  if (stage.startsWith('termin-')) return `Termin ${stage.split('-')[1]}`;
  return stage.charAt(0).toUpperCase() + stage.slice(1);
};

// PPN DPP Nilai Lain (PMK 131/2024, PKP): DPP = subtotal × 11/12, PPN = DPP × 12%.
// Mode normal (non-PKP / opsi): PPN = subtotal × ppnRate.
export const calcInvoiceTotals = ({ subtotal = 0, useDppNilaiLain = true, ppnRate = 11, pphRate = 0 }) => {
  const base = Number(subtotal) || 0;
  let dppNilaiLain = base;
  let pajak11 = 0;
  if (ppnRate > 0) {
    if (useDppNilaiLain) {
      dppNilaiLain = Math.round((base * 11) / 12);
      pajak11 = Math.round(dppNilaiLain * 0.12);
    } else {
      pajak11 = Math.round((base * ppnRate) / 100);
    }
  }
  const taxDeductedAmount = Math.round((base * (Number(pphRate) || 0)) / 100);
  const grandTotal = base + pajak11;
  const netProceeds = grandTotal - taxDeductedAmount;
  return { subtotal: base, dppNilaiLain, pajak11, grandTotal, netProceeds, taxDeductedAmount };
};

// Progres dokumen pajak 4 langkah (baca field live).
export const taxDocsProgress = (inv = {}) => [
  { key: 'faktur', label: 'Faktur Pajak', done: Boolean(inv.taxInvoiceNumber) },
  { key: 'billing', label: 'Billing Pajak', done: Boolean(inv.billingCode) },
  { key: 'ppn', label: 'Pembayaran PPN', done: Boolean(inv.taxPaidAt || inv.taxPaymentProofUrl) },
  { key: 'ntpn', label: 'Nomor NTPN', done: Boolean(inv.ntpnNumber) }
];

export const isPpnCair = (inv = {}) => inv.coreTaxStatus === CORETAX_STATUS.CLEARED;

// Nomor urut berikutnya: scan nomor invoice berjalan "INV-<seq>/PEB/<mm>/<yyyy>".
// Mengambil seq terbesar bulan berjalan + 1; bila belum ada di bulan ini, mulai 001.
// Format mengikuti nomor live PT PEB.
export const getNextInvoiceNumber = async () => {
  try {
    const list = await getAllInvoices();
    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const re = new RegExp(`^INV-(\\d+)/PEB/${mm}/${now.getFullYear()}$`, 'i');
    const max = list.reduce((acc, inv) => {
      const m = re.exec(String(inv.invoiceNumber || '').trim());
      return m ? Math.max(acc, Number(m[1])) : acc;
    }, 0);
    return `INV-${String(max + 1).padStart(3, '0')}/PEB/${mm}/${now.getFullYear()}`;
  } catch (e) {
    console.warn('[invoices] gagal hitung nomor otomatis', e?.message || e);
    return buildInvoiceNumber();
  }
};

export const addInvoice = async (data) => {
  const now = new Date().toISOString();
  const docRef = await addDoc(collection(db, COLLECTION), {
    ...data,
    status: data.status || INVOICE_STATUS.DRAFT,
    coreTaxStatus: data.coreTaxStatus || CORETAX_STATUS.WAITING,
    invoiceItems: data.invoiceItems || [],
    taxEvents: data.taxEvents || [],
    createdAt: now,
    updatedAt: now
  });
  invalidate(CACHE_KEYS.INVOICES);
  return docRef.id;
};

export const sortInvoiceList = (list, { sortBy = 'date', direction = 'desc', projectNameOf } = {}) =>
  [...list].sort((a, b) => compareInvoices(a, b, sortBy, direction, projectNameOf));

export const getAllInvoices = async () =>
  cached(CACHE_KEYS.INVOICES, async () => {
    // Tanpa orderBy: nilai tanggal bercampur Timestamp/string dan sebagian
    // dokumen lama tidak punya field itu — orderBy mengecualikannya diam-diam.
    // Urutan akhir ditentukan compareInvoices. Dokumen lama dinormalkan saat
    // dibaca saja; tidak ada penulisan balik (migrasi terpisah).
    const snapshot = await getDocs(collection(db, COLLECTION));
    const list = [];
    snapshot.forEach((d) => list.push(normalizeInvoice({ id: d.id, ...d.data() })));
    return sortInvoiceList(list, { sortBy: 'date', direction: 'desc' });
  });

// Invoice terbayar terkunci: tidak boleh diedit/dihapus (rekam jejak audit),
// hanya dokumen pajaknya (updateTaxDocs) yang masih bisa dimutakhirkan.
const assertMutable = async (invoiceId) => {
  const snap = await getDoc(doc(db, COLLECTION, invoiceId));
  const status = snap.exists() ? snap.data().status : null;
  if (status === INVOICE_STATUS.PAID) {
    throw new Error('Invoice terbayar tidak dapat diubah atau dihapus. Hanya dokumen pajak yang boleh diperbarui.');
  }
};

export const updateInvoice = async (invoiceId, data) => {
  await assertMutable(invoiceId);
  await updateDoc(doc(db, COLLECTION, invoiceId), { ...data, updatedAt: new Date().toISOString() });
  invalidate(CACHE_KEYS.INVOICES);
};

export const setInvoiceStatus = (invoiceId, status) =>
  updateInvoice(invoiceId, { status, statusUpdatedAt: new Date().toISOString() });

export const deleteInvoice = async (invoiceId) => {
  await assertMutable(invoiceId);
  await deleteDoc(doc(db, COLLECTION, invoiceId));
  invalidate(CACHE_KEYS.INVOICES);
};


// ---------- Dokumen pendukung (BAHK / WPHO / SPK / PK / faktur) ----------
// Tiap berkas disimpan di Storage under `invoice-docs/{invoiceId}/{kind}` dan
// jejaknya di field `documents` invoice — menjadi arsip digital penagihan.
export const INVOICE_DOC_LABELS = {
  bahk: 'BAHK (Berita Acara Hasil Kerja)',
  wpho: 'WPHO / BAST',
  spk: 'SPK / Kontrak Kerja',
  pk: 'Perjanjian Kerja (PK)',
  faktur: 'Faktur Pajak'
};

// `collectionName` memungkinkan arsip dipakai ulang untuk proyek (SPK/PK);
// path Storage tetap eksplisit per jenis dokumen.
export const uploadInvoiceDocument = async (invoiceId, kind, file, collectionName = COLLECTION) => {
  const safe = String(file.name || 'berkas').replace(/[^a-zA-Z0-9._-]+/g, '_');
  const path = `doc-archives/${collectionName}/${invoiceId}/${kind}_${Date.now()}_${safe}`;
  const snapshot = await uploadBytes(ref(storage, path), file);
  const url = await getDownloadURL(snapshot.ref);
  const entry = { url, path, name: safe, uploadedAt: new Date().toISOString() };
  await updateDoc(doc(db, collectionName, invoiceId), {
    [`documents.${kind}`]: entry,
    updatedAt: new Date().toISOString()
  });
  invalidate(CACHE_KEYS.INVOICES);
  invalidate(CACHE_KEYS.PROJECTS);
  return entry;
};


// Revisi invoice terkirim: penomoran ditandai Rev.N dan status kembali ke
// draft (belum terkirim) — sesuai praktik surat-menyurat kontrak.
export const reviseInvoice = async (invoiceId, data) => {
  const snap = await getDoc(doc(db, COLLECTION, invoiceId));
  const current = snap.exists() ? snap.data() : {};
  const revision = (Number(current.revision) || 0) + 1;
  const baseNumber = String(data.invoiceNumber || current.invoiceNumber || '')
    .replace(/\s*Rev\.?\s*\d+$/i, '')
    .trim();
  const invoiceNumber = `${baseNumber} Rev.${revision}`;
  await updateInvoice(invoiceId, {
    ...data,
    invoiceNumber,
    revision,
    status: INVOICE_STATUS.DRAFT,
    statusUpdatedAt: new Date().toISOString()
  });
  return { revision, invoiceNumber };
};

// ---------- Dokumen pajak (Fase C) ----------
export const updateTaxDocs = async (invoiceId, fields, historyNote) => {
  const now = new Date().toISOString();
  const cleared = Boolean(fields.ntpnNumber);
  await updateDoc(doc(db, COLLECTION, invoiceId), {
    ...fields,
    coreTaxStatus: cleared ? CORETAX_STATUS.CLEARED : CORETAX_STATUS.WAITING,
    coreTaxUpdatedAt: now,
    updatedAt: now,
    taxEvents: arrayUnion({
      type: 'tax-document',
      createdAt: now,
      taxInvoiceNumber: fields.taxInvoiceNumber || '',
      billingCode: fields.billingCode || '',
      note: historyNote || 'Dokumen pajak diperbarui'
    })
  });
  invalidate(CACHE_KEYS.INVOICES);
};

// ---------- Ekspor XML CoreTax ----------
// Catat waktu ekspor XML per invoice. Tidak lewat updateInvoice karena
// invoice terbayar (terkunci) tetap boleh ditandai sudah diekspor —
// dokumen pajak boleh berubah setelah lunas.
export const markCoretaxExported = async (invoiceIds) => {
  if (!Array.isArray(invoiceIds) || invoiceIds.length === 0) return;
  const now = new Date().toISOString();
  await Promise.all(
    invoiceIds.map((id) =>
      updateDoc(doc(db, COLLECTION, id), { coretaxExportedAt: now, updatedAt: now })
    )
  );
  invalidate(CACHE_KEYS.INVOICES);
};

// ---------- Auto-transaksi saat terbayar (Fase D) ----------
//
// Membuat transaksi income "Pembayaran Invoice" (netProceeds) + expense "Pajak"
// (pajak11). Nama kategori dan `source` diambil dari utils/transactionMeta.js
// supaya sama persis dengan data angkatan sebelumnya dan dengan normalisasi
// data lama — lihat catatan di berkas itu untuk riwayat penamaan yang berbeda.
export const markInvoicePaid = async (invoice) => {
  if (invoice.status === INVOICE_STATUS.PAID) return;

  const now = new Date().toISOString();
  const received = invoice.netProceeds ?? invoice.grandTotal ?? 0;
  const ppn = invoice.pajak11 ?? 0;
  const patch = { status: INVOICE_STATUS.PAID, paidAt: now, statusUpdatedAt: now };

  if (!invoice.paymentTransactionId && invoice.projectId) {
    patch.paymentTransactionId = await addTransaction({
      projectId: invoice.projectId,
      projectName: invoice.projectName || '',
      date: now,
      type: 'income',
      category: AUTO_CATEGORY.payment,
      amount: received,
      description: `Pembayaran ${invoice.invoiceNumber}`,
      isAutoGenerated: true,
      source: TX_SOURCE.invoicePayment,
      invoiceId: invoice.id
    });

    if (ppn > 0) {
      patch.taxExpenseTransactionId = await addTransaction({
        projectId: invoice.projectId,
        projectName: invoice.projectName || '',
        date: now,
        type: 'expense',
        category: AUTO_CATEGORY.tax,
        amount: ppn,
        description: `PPN Otomatis - ${invoice.invoiceNumber}`,
        isAutoGenerated: true,
        source: TX_SOURCE.invoicePpn,
        invoiceId: invoice.id
      });
    }
  }

  await updateInvoice(invoice.id, patch);
};
