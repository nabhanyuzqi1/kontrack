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
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  arrayUnion
} from 'firebase/firestore';
import { db } from './firebase';
import { cached, invalidate, CACHE_KEYS } from './cache';
import { addTransaction } from './transactions';

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

export const getAllInvoices = async () =>
  cached(CACHE_KEYS.INVOICES, async () => {
    // orderBy issueDate desc; fallback tanpa order bila field campur/absen.
    let snapshot;
    try {
      snapshot = await getDocs(query(collection(db, COLLECTION), orderBy('issueDate', 'desc')));
    } catch (e) {
      snapshot = await getDocs(collection(db, COLLECTION));
    }
    const list = [];
    snapshot.forEach((d) => list.push({ id: d.id, ...d.data() }));
    return list;
  });

export const updateInvoice = async (invoiceId, data) => {
  await updateDoc(doc(db, COLLECTION, invoiceId), { ...data, updatedAt: new Date().toISOString() });
  invalidate(CACHE_KEYS.INVOICES);
};

export const setInvoiceStatus = (invoiceId, status) =>
  updateInvoice(invoiceId, { status, statusUpdatedAt: new Date().toISOString() });

export const deleteInvoice = async (invoiceId) => {
  await deleteDoc(doc(db, COLLECTION, invoiceId));
  invalidate(CACHE_KEYS.INVOICES);
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

// ---------- Auto-transaksi saat terbayar (Fase D) ----------
// Membuat transaksi income "Pembayaran INV" (netProceeds) + expense
// "PPN Otomatis" (pajak11), menyimpan id-nya ke invoice (seperti live).
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
      category: 'Pembayaran',
      amount: received,
      description: `Pembayaran ${invoice.invoiceNumber}`,
      isAutoGenerated: true,
      invoiceId: invoice.id
    });

    if (ppn > 0) {
      patch.taxExpenseTransactionId = await addTransaction({
        projectId: invoice.projectId,
        projectName: invoice.projectName || '',
        date: now,
        type: 'expense',
        category: 'Pengeluaran Lain',
        amount: ppn,
        description: `PPN Otomatis - ${invoice.invoiceNumber}`,
        isAutoGenerated: true,
        invoiceId: invoice.id
      });
    }
  }

  await updateInvoice(invoice.id, patch);
};
