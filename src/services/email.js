// src/services/email.js
// Kirim email penagihan lewat Cloud Function sendInvoiceEmail.
// Lampiran: URL berkas Storage (BAHK/WPHO/PK/faktur) dan PDF invoice yang
// di-generate klien lalu dikirim sebagai base64.
import { httpsCallable } from 'firebase/functions';
import { aiFunctions } from './functionsRegion';

export const sendInvoiceEmail = async ({ to, cc, subject, body, attachments = [], replyTo }) => {
  const fn = httpsCallable(aiFunctions(), 'sendInvoiceEmail');
  const res = await fn({ to, cc, subject, body, attachments, replyTo });
  return res.data;
};

export const buildBillingEmailContent = (invoice, company, { up = '' }) => {
  const lines = [];
  const companyName = company?.name || company?.companyName || 'Kami';
  lines.push(`Kepada Yth.${up ? `\nu.p. ${up}` : ''}`);
  lines.push(`${invoice.clientName || invoice.client?.client_name || 'Bapak/Ibu'},`);
  lines.push('');
  lines.push(
    `Sehubungan dengan pekerjaan "${invoice.projectName || '-'}", dengan hormat kami lampirkan dokumen penagihan untuk invoice ${invoice.invoiceNumber || ''} dengan rincian sebagai berikut:`
  );
  lines.push('');
  lines.push(`Invoice No: ${invoice.invoiceNumber || '-'}`);
  lines.push(`Nilai: ${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(invoice.grandTotal || 0)}`);
  lines.push('');
  lines.push('Berkas yang dilampirkan tercantum pada daftar lampiran email ini.');
  lines.push('');
  lines.push('Demikian kami sampaikan. Atas perhatian dan kerja samanya kami ucapkan terima kasih.');
  lines.push('');
  lines.push(`Hormat kami,`);
  lines.push(companyName);
  const subject = `Penagihan ${invoice.invoiceNumber || ''}${invoice.projectName ? ` - ${invoice.projectName}` : ''}`;
  return { subject, body: lines.join('\n') };
};
