// src/services/email.js
// Pembuat isi email penagihan + pembuka draf di klien email pengguna.
//
// Kenapa TIDAK lewat SMTP: pengiriman invoice adalah korespondensi pemilik dengan
// mitranya, bukan pemberitahuan dari produk. Lewat SMTP, surat terkirim dari
// alamat server Kontrack (bukan alamat pemilik), mudah masuk spam, dan riwayat
// kirimnya tidak ada di kotak masuk pemilik. SMTP tetap dipakai HANYA untuk email
// dari Kontrack ke pengguna aplikasi (undangan, pemberitahuan, verifikasi).
//
// Draf dibuka di Gmail. Lampiran tidak bisa dibawa URL draf, jadi pemilik
// melampirkan sendiri dari tombol Unduh di pratinjau berkas.

export const buildGmailComposeUrl = ({ to = '', subject = '', body = '' }) => {
  const params = new URLSearchParams({ view: 'cm', fs: '1', to, su: subject, body });
  return `https://mail.google.com/mail/?${params.toString()}`;
};

export const buildBillingEmailContent = (invoice, company, { up = '', attachments = [] } = {}) => {
  const lines = [];
  const companyName = company?.name || company?.companyName || 'Kami';
  lines.push(`Kepada Yth.${up ? `\nu.p. ${up}` : ''}`);
  lines.push(`${invoice.clientName || invoice.client?.client_name || 'Bapak/Ibu'},`);
  lines.push('');
  lines.push(
    `Sehubungan dengan pekerjaan "${invoice.projectName || '-'}", dengan hormat kami lampirkan dokumen penagihan untuk invoice ${invoice.invoiceNumber || ''} dengan rincian sebagai berikut:`
  );
  lines.push('');
  lines.push(`Invoice No  : ${invoice.invoiceNumber || '-'}`);
  lines.push(`Nilai          : ${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(invoice.grandTotal || 0)}`);
  lines.push('');

  if (attachments.length > 0) {
    lines.push('Lampiran:');
    attachments.forEach(({ name, label }) => {
      lines.push(`  - ${label || name}`);
    });
    lines.push('');
  } else {
    lines.push('(Lampiran: PDF invoice + arsip berkas penagihan)');
    lines.push('');
  }

  lines.push('Demikian kami sampaikan. Atas perhatian dan kerja samanya kami ucapkan terima kasih.');
  lines.push('');
  lines.push('Hormat kami,');
  lines.push(companyName);
  const subject = `Penagihan ${invoice.invoiceNumber || ''}${invoice.projectName ? ` - ${invoice.projectName}` : ''}`;
  return { subject, body: lines.join('\n') };
};
