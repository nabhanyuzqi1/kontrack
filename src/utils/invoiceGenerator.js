// src/utils/invoiceGenerator.js
// Generator PDF invoice yang meniru template resmi PT Permata Energi Borneo.
// Layout: header logo+perusahaan → INVOICE → Kepada Yth + meta → Franco/Shipped/Term
// → tabel item → terbilang (kiri) + total (kanan) → note transfer → tanda tangan.

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCurrency } from './formatters';
import { terbilang } from './terbilang';
import { COMPANY_INFO, INVOICE_DEFAULTS } from './companyConfig';

const INK = [20, 20, 20];
const MUTED = [90, 90, 90];
const LINE = [180, 180, 180];

const formatDateShort = (date) => {
  if (!date) return '-';
  const d = date && typeof date === 'object' && date.seconds ? new Date(date.seconds * 1000) : new Date(date);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
};

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
export const buildInvoiceNumber = () => {
  const now = new Date();
  const seq = '011';
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  return `INV-${seq}/PEB/${mm}/${now.getFullYear()}`;
};

// Ukur dimensi dari data URL.
const imageSize = (dataUrl) =>
  new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => resolve({ w: 0, h: 0 });
    img.src = dataUrl;
  });

// Muat gambar (letterhead/tanda tangan dari Firebase Storage) → { dataUrl, w, h }.
// Pakai fetch→blob→dataURL: butuh CORS bucket aktif (lihat storage.cors.json).
// Mengembalikan null bila gagal agar invoice tetap tergenerate tanpa gambar.
const loadImage = async (url) => {
  if (!url) return null;
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    const { w, h } = await imageSize(dataUrl);
    return { dataUrl, w, h };
  } catch (e) {
    console.warn(
      'Letterhead/tanda tangan tak dapat dimuat (CORS bucket belum aktif?):',
      e?.message || e
    );
    return null;
  }
};

/**
 * @param {Object} invoice
 *   number, dueDate, poNumber, pkNumber, wphoNumber, taxInvoiceNumber,
 *   billTo {name, address}, franco, shippedVia, paymentTerm,
 *   items [{description, unit, qty, unitPrice, amount}],
 *   ppnRate, pphRate, paymentNote, cityDate (Date), signatory {name, title}
 * @param {Object} company
 */
// Normalisasi: dokumen invoice bisa berasal dari skema LIVE (invoiceNumber,
// grandTotal, pajak11, description, quantity, projectValue, client{}) atau dari
// builder baru (number, totals{}, items[], billTo{}). Ubah ke bentuk internal.
const normalizeInvoice = (inv) => {
  if (!inv.invoiceNumber) return inv; // sudah bentuk builder

  const subtotal = (inv.grandTotal || 0) - (inv.pajak11 || 0);
  const client = inv.client || {};
  const clientAddress = [
    client.address,
    [client.city, client.province].filter(Boolean).join(', '),
    client.postalCode
  ]
    .filter(Boolean)
    .join('\n');

  return {
    number: inv.invoiceNumber,
    date: inv.issueDate,
    dueDate: inv.dueDate,
    cityDate: inv.issueDate,
    poNumber: inv.poNumber,
    pkNumber: inv.pkNumber,
    wphoNumber: inv.wphoNumber,
    taxInvoiceNumber: inv.taxInvoiceNumber,
    billTo: {
      name: inv.clientName || client.client_name || client.name || '',
      address: clientAddress,
      npwp: client.npwp || ''
    },
    franco: inv.franco || '-',
    shippedVia: inv.shippedVia || '-',
    paymentTerm: inv.paymentTerm || '',
    items:
      inv.invoiceItems && inv.invoiceItems.length
        ? inv.invoiceItems
        : [
            {
              description: inv.description || '',
              unit: 'Unit',
              qty: inv.quantity || '',
              unitPrice: inv.projectValue || subtotal,
              amount: subtotal
            }
          ],
    ppnRate: 11,
    pphRate: Number(inv.pphRate) || 0,
    // DPP tidak ditampilkan di PDF (mengikuti template PT PEB) → dpp null
    totals: { subtotal, dpp: null, ppn: inv.pajak11 || 0, pph: inv.taxDeductedAmount || 0, grandTotal: inv.grandTotal || 0 },
    useDppNilaiLain: false,
    paymentNote: inv.paymentNote,
    signatory: inv.signatory
  };
};

export const generateInvoicePDF = async (rawInvoice, company = COMPANY_INFO) => {
  const invoice = normalizeInvoice(rawInvoice);
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.width; // 210
  const pageH = doc.internal.pageSize.height; // 297
  const mL = 18;
  const mR = pageW - 18;

  // ---------- HEADER ----------
  let headerBottom;
  const letterhead = await loadImage(company.letterheadUrl);

  if (letterhead) {
    // Letterhead PNG (logo + identitas) sebagai banner, jaga rasio
    const imgW = mR - mL;
    const imgH = (letterhead.h / letterhead.w) * imgW;
    doc.addImage(letterhead.dataUrl, 'PNG', mL, 12, imgW, imgH);
    headerBottom = 12 + imgH + 3;
    doc.setDrawColor(...INK);
    doc.setLineWidth(0.6);
    doc.line(mL, headerBottom, mR, headerBottom);
  } else {
    // Fallback: gambar header dari teks + logo opsional
    let headTextX = mL;
    if (company.logoDataUrl) {
      try {
        doc.addImage(company.logoDataUrl, 'PNG', mL, 12, 22, 22);
        headTextX = mL + 28;
      } catch (e) {
        /* lanjut tanpa logo */
      }
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...INK);
    doc.text(company.name, headTextX, 17);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...MUTED);
    let hy = 22;
    (company.addressLines || []).forEach((line) => {
      doc.text(line, headTextX, hy);
      hy += 4;
    });
    if (company.email) {
      doc.text(`Email: ${company.email}`, headTextX, hy);
      hy += 4;
    }
    headerBottom = Math.max(hy + 2, 38);
    doc.setDrawColor(...INK);
    doc.setLineWidth(0.6);
    doc.line(mL, headerBottom, mR, headerBottom);
  }

  // ---------- JUDUL ----------
  let y = headerBottom + 14;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(...INK);
  doc.text('INVOICE', pageW / 2, y, { align: 'center' });

  // ---------- KEPADA YTH (kiri) + META (kanan) ----------
  y += 12;
  const metaX = pageW / 2 + 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...INK);
  doc.text('Kepada Yth.', mL, y);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(invoice.billTo?.name || '-', mL, y + 7);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  const addrLines = invoice.billTo?.address
    ? doc.splitTextToSize(invoice.billTo.address, pageW / 2 - mL - 6)
    : [];
  let ay = y + 13;
  addrLines.forEach((line) => {
    doc.text(line, mL, ay);
    ay += 4.5;
  });

  // Meta (label : value)
  const metaRows = [
    ['Invoice No', invoice.number],
    ['Jatuh Tempo', formatDateShort(invoice.dueDate)],
    ['PO / PK', invoice.poNumber],
    ['PK No.', invoice.pkNumber],
    ['No. WPHO', invoice.wphoNumber],
    ['No. Faktur Pajak', invoice.taxInvoiceNumber]
  ];
  doc.setFontSize(9);
  let my = y;
  const metaLabelW = 34;
  metaRows.forEach(([label, val]) => {
    doc.setTextColor(...INK);
    doc.setFont('helvetica', 'normal');
    doc.text(label, metaX, my);
    doc.text(':', metaX + metaLabelW, my);
    doc.text(String(val || '-'), metaX + metaLabelW + 3, my);
    my += 5.5;
  });

  y = Math.max(ay, my) + 6;

  // ---------- FRANCO / SHIPPED VIA / PAYMENT TERM ----------
  autoTable(doc, {
    startY: y,
    head: [['Franco', 'Shipped Via', 'Payment Term']],
    body: [[invoice.franco || '-', invoice.shippedVia || '-', invoice.paymentTerm || INVOICE_DEFAULTS.paymentTerm]],
    theme: 'grid',
    headStyles: { fillColor: [245, 245, 245], textColor: INK, fontStyle: 'normal', fontSize: 9, halign: 'center', cellPadding: 2.5 },
    bodyStyles: { halign: 'center', fontSize: 9, cellPadding: 3, textColor: INK },
    styles: { lineColor: LINE, lineWidth: 0.2 },
    columnStyles: { 0: { cellWidth: (mR - mL) / 3 }, 1: { cellWidth: (mR - mL) / 3 }, 2: { cellWidth: (mR - mL) / 3 } },
    margin: { left: mL, right: 18 }
  });

  y = doc.lastAutoTable.finalY + 6;

  // ---------- TABEL ITEM ----------
  const items = (invoice.items || []).filter((it) => it.description);
  const rowAmount = (it) => {
    if (it.amount !== '' && it.amount != null) return Number(it.amount) || 0;
    const q = Number(it.qty);
    return (isNaN(q) ? 1 : q) * (Number(it.unitPrice) || 0);
  };
  const body = items.map((it, i) => [
    String(i + 1),
    it.description,
    it.unit || '',
    it.qty != null ? String(it.qty) : '',
    formatCurrency(it.unitPrice || 0),
    formatCurrency(rowAmount(it))
  ]);

  autoTable(doc, {
    startY: y,
    head: [['No', 'Deskripsi', 'Unit', 'Qty', 'Unit Price', 'Amount']],
    body: body.length ? body : [['1', '-', '', '', formatCurrency(0), formatCurrency(0)]],
    theme: 'grid',
    headStyles: { fillColor: [245, 245, 245], textColor: INK, fontStyle: 'normal', fontSize: 9, cellPadding: 2.5 },
    styles: { fontSize: 9, cellPadding: 3, textColor: INK, lineColor: LINE, lineWidth: 0.2, valign: 'top' },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 20, halign: 'center' },
      3: { cellWidth: 18, halign: 'center' },
      4: { cellWidth: 34, halign: 'right' },
      5: { cellWidth: 34, halign: 'right' }
    },
    margin: { left: mL, right: 18 }
  });

  y = doc.lastAutoTable.finalY + 8;

  // ---------- TERBILANG (kiri) + TOTAL (kanan) ----------
  // Pakai totals terhitung dari caller (mendukung DPP Nilai Lain) bila tersedia.
  const ppnRate = invoice.ppnRate ?? INVOICE_DEFAULTS.ppnRate;
  const pphRate = invoice.pphRate ?? INVOICE_DEFAULTS.pphRate;
  let subtotal;
  let dpp = null;
  let ppn;
  let pph;
  let grandTotal;
  if (invoice.totals) {
    ({ subtotal, ppn, pph, grandTotal } = invoice.totals);
    dpp = invoice.useDppNilaiLain ? invoice.totals.dpp : null;
  } else {
    subtotal = items.reduce((s, it) => s + rowAmount(it), 0);
    ppn = (subtotal * ppnRate) / 100;
    pph = (subtotal * pphRate) / 100;
    grandTotal = subtotal + ppn;
  }

  // Terbilang kiri
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...INK);
  const terbilangText = doc.splitTextToSize(terbilang(grandTotal), pageW / 2 - mL);
  doc.text(terbilangText, mL, y + 4);

  // Box total kanan
  const boxX = pageW / 2 + 6;
  const boxW = mR - boxX;
  const totalRows = [['Subtotal', subtotal]];
  if (dpp != null && ppnRate > 0) totalRows.push(['DPP Nilai Lain', dpp]);
  if (ppnRate > 0) totalRows.push([`PPN ${ppnRate}%`, ppn]);
  if (pphRate > 0) totalRows.push([`PPh ${pphRate}%`, -pph]);
  totalRows.push(['Grand Total', grandTotal]);

  const boxPadY = 4;
  const rowH = 8;
  const boxH = boxPadY * 2 + rowH * totalRows.length;
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.3);
  doc.rect(boxX, y - 2, boxW, boxH);

  let ty = y - 2 + boxPadY + 5;
  totalRows.forEach(([label, val], idx) => {
    const isGrand = idx === totalRows.length - 1;
    doc.setFont('helvetica', isGrand ? 'bold' : 'normal');
    doc.setFontSize(isGrand ? 10.5 : 9.5);
    doc.setTextColor(...INK);
    doc.text(label, boxX + 5, ty);
    doc.text(formatCurrency(val), boxX + boxW - 5, ty, { align: 'right' });
    ty += rowH;
  });

  y = Math.max(y + terbilangText.length * 4.5, y - 2 + boxH) + 12;

  // ---------- NOTE TRANSFER ----------
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...INK);
  const note = invoice.paymentNote || INVOICE_DEFAULTS.paymentNote;
  doc.text(doc.splitTextToSize(note, pageW / 2 + 10), mL, y);

  // ---------- TANDA TANGAN (kanan) ----------
  const sig = invoice.signatory || company.signatory || {};
  const sigX = mR - 60;
  let sy = y + 2;
  doc.setTextColor(...INK);
  doc.text(`${company.city || 'Sampit'}, ${formatDateShort(invoice.cityDate || new Date())}`, mR, sy, { align: 'right' });
  sy += 6;
  doc.text('Hormat kami,', mR, sy, { align: 'right' });

  // Gambar tanda tangan (bila ada) di atas nama penanda tangan
  const signature = await loadImage(company.signatureUrl);
  if (signature && signature.w) {
    const sigW = 38;
    const sigH = Math.min((signature.h / signature.w) * sigW, 22);
    doc.addImage(signature.dataUrl, 'PNG', mR - sigW, sy + 2, sigW, sigH);
  }
  sy += 26;
  doc.setFont('helvetica', 'bold');
  doc.text(company.name, mR, sy, { align: 'right' });
  sy += 6;
  doc.text(sig.name || '(...........................)', mR, sy, { align: 'right' });
  sy += 5;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...MUTED);
  doc.text(sig.title || 'Direktur', mR, sy, { align: 'right' });

  // ---------- SIMPAN ----------
  const safeClient = (invoice.billTo?.name || 'invoice').replace(/[^a-z0-9]/gi, '_');
  const safeNo = (invoice.number || '').replace(/[^a-z0-9]/gi, '_');
  doc.save(`Invoice_${safeClient}_${safeNo}.pdf`);
};

export default generateInvoicePDF;
