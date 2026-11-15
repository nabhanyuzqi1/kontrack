// src/utils/shippingLabel.js
// Label kirim fisik (softcopy untuk dicetak) — dipisah dari invoice karena
// pengiriman berkas fisik punya konteks sendiri: pengirim, penerima + UP,
// konteks berkas, dan jalur kirim (umumnya Lion Parcel).
import { jsPDF } from 'jspdf';

/**
 * @param {Object} invoice - invoice Kontrack
 * @param {Object} opts - { from, to, up, via, documents }
 *   from/to: { name, address, phone }
 */
export const generateShippingLabel = (invoice, opts = {}) => {
  const { from = {}, to = {}, up = '', via = 'Lion Parcel', documents = [] } = opts;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210;

  const block = (title, lines, x, y, w) => {
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.5);
    doc.rect(x, y, w, 52);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text(title.toUpperCase(), x + 5, y + 8);
    doc.setTextColor(0, 0, 0);
    let yy = y + 16;
    doc.setFontSize(11);
    lines.filter(Boolean).forEach((l) => {
      doc.setFont('helvetica', 'normal');
      doc.text(doc.splitTextToSize(String(l), w - 10), x + 5, yy);
      yy += 6;
    });
  };

  // Kop atas
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('LABEL PENGIRIMAN DOKUMEN', W / 2, 20, { align: 'center' });
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Ref: ${invoice.invoiceNumber || '-'}`, W / 2, 27, { align: 'center' });

  block(
    'Dari (Pengirim)',
    [from.name, from.address, from.phone].filter(Boolean),
    15,
    35,
    85
  );
  block(
    'Kepada (Penerima)',
    [to.name, up ? `u.p. ${up}` : null, to.address, to.phone].filter(Boolean),
    110,
    35,
    85
  );

  // Konteks berkas
  let y = 95;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('ISI PAKET:', 15, y);
  y += 7;
  doc.setFont('helvetica', 'normal');
  (documents.length ? documents : ['Dokumen penagihan']).forEach((d) => {
    doc.text(`- ${d}`, 20, y);
    y += 6;
  });

  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.text('Proyek:', 15, y);
  doc.setFont('helvetica', 'normal');
  doc.text(String(invoice.projectName || '-'), 45, y);
  y += 7;
  doc.setFont('helvetica', 'bold');
  doc.text('Via', 15, y);
  doc.setFont('helvetica', 'normal');
  doc.text(String(via || '-'), 45, y);

  // Tanda terima
  doc.setDrawColor(180, 180, 180);
  doc.rect(15, y + 25, 180, 22);
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text('Diterima oleh / tanda-tangan:', 20, y + 40);

  doc.save(`Label_${(invoice.invoiceNumber || 'invoice').replace(/[^a-z0-9-]+/gi, '_')}.pdf`);
};
