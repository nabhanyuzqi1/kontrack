// Adapter baca saja: field lama tetap dipertahankan, tanpa menulis ulang dokumen.
import { toDate } from './reportCalc.js';

const present = (v) => v !== undefined && v !== null && v !== '';
const first = (...values) => values.find(present);
const numeric = (v) => present(v) && Number.isFinite(Number(v)) ? Number(v) : v;

export const normalizeInvoice = (source = {}) => {
  const inv = { ...source };
  const aliases = {
    invoiceNumber: [source.number],
    issueDate: [source.date, source.tanggalTerbit],
    clientName: [source.client?.client_name, source.client?.name, source.billTo?.name],
    clientNpwp: [source.client?.npwp, source.billTo?.npwp],
    subtotal: [source.totals?.subtotal],
    dppNilaiLain: [source.totals?.dpp],
    pajak11: [source.totals?.ppn],
    taxDeductedAmount: [source.totals?.pph],
    grandTotal: [source.totals?.grandTotal],
    netProceeds: [source.totals?.netProceeds]
  };
  for (const [key, values] of Object.entries(aliases)) {
    const value = first(source[key], ...values);
    if (value !== undefined) inv[key] = value;
  }
  for (const key of ['subtotal', 'dppNilaiLain', 'pajak11', 'taxDeductedAmount', 'grandTotal', 'netProceeds']) {
    if (present(inv[key])) inv[key] = numeric(inv[key]);
  }
  // Total historis tidak dihitung ulang dengan tarif pajak saat ini.
  if (!present(inv.subtotal) && Number.isFinite(inv.grandTotal) && Number.isFinite(inv.pajak11)) {
    inv.subtotal = inv.grandTotal - inv.pajak11;
  }
  if (!present(inv.netProceeds) && Number.isFinite(inv.grandTotal) && Number.isFinite(inv.taxDeductedAmount)) {
    inv.netProceeds = inv.grandTotal - inv.taxDeductedAmount;
  }
  if (!source.client && source.billTo) inv.client = { ...source.billTo, client_name: source.billTo.name };
  const items = Array.isArray(source.invoiceItems) && source.invoiceItems.length
    ? source.invoiceItems : Array.isArray(source.items) ? source.items : [];
  if (items.length) inv.invoiceItems = items.map((item) => item && ({ ...item }));
  else if (source.description && Number.isFinite(inv.subtotal)) {
    // Persentase termin bukan jumlah unit: tampilkan nilai historis sebagai satu pekerjaan.
    inv.invoiceItems = [{ description: source.description, qty: 1, unitPrice: inv.subtotal, amount: inv.subtotal }];
  }
  return inv;
};

export const compareInvoices = (a, b, sortBy = 'date', direction = 'desc', projectNameOf = (i) => i.projectName || '') => {
  const text = (x, y) => String(x ?? '').localeCompare(String(y ?? ''), 'id', { numeric: true });
  let result;
  let missingDate = false;
  if (sortBy === 'amount') result = (Number(a.grandTotal) || 0) - (Number(b.grandTotal) || 0);
  else if (sortBy === 'number') result = text(a.invoiceNumber, b.invoiceNumber);
  else if (sortBy === 'project') result = text(projectNameOf(a), projectNameOf(b));
  else if (sortBy === 'status') result = text(a.status, b.status);
  else {
    const da = toDate(a.issueDate)?.getTime();
    const db = toDate(b.issueDate)?.getTime();
    missingDate = !Number.isFinite(da) || !Number.isFinite(db);
    result = !Number.isFinite(da) ? (!Number.isFinite(db) ? text(a.id, b.id) : 1)
      : !Number.isFinite(db) ? -1 : da - db;
  }
  if (sortBy === 'date' && missingDate && result !== 0) return result;
  return (direction === 'asc' ? 1 : -1) * result || text(a.id, b.id);
};
