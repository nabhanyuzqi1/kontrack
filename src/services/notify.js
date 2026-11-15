// src/services/notify.js
// Pemberitahuan keluar: email (lewat Cloud Function `notifyUsers`) dan
// WhatsApp (lewat `sendWhatsApp`). Keduanya SERVER-SIDE: nomor pengirim adalah
// nomor resmi Kontrack, bukan nomor pribadi pemakai aplikasi.
//
// Semua fungsi di sini gagal-diam (tidak melempar) untuk pemanggilan
// pemberitahuan otomatis: perubahan data utama tidak boleh batal hanya karena
// email/WhatsApp belum dikonfigurasi pemilik. Hasilnya dikembalikan apa adanya
// supaya UI bisa berkata jujur ("terkirim" vs "belum disetel").

import { httpsCallable } from 'firebase/functions';
import { legacyFunctions } from './functionsRegion';

const call = (name, payload) => httpsCallable(legacyFunctions(), name)(payload).then((r) => r?.data);

/**
 * Kirim email pemberitahuan ke daftar penerima (maks 25 per panggilan).
 * @returns {Promise<{sent:number, skipped:number, reason?:string}>}
 */
export const notifyByEmail = async ({ kind, subject, summary, url, to }) => {
  try {
    return await call('notifyUsers', { kind, subject, summary, url, to });
  } catch (error) {
    console.warn('Pemberitahuan email dilewati:', error?.message || error);
    return { sent: 0, skipped: 0, reason: error?.message || 'gagal' };
  }
};

/**
 * Kirim WhatsApp lewat gateway server-side.
 * @returns {Promise<{sent:boolean, configured:boolean, mode?:string, reason?:string}>}
 */
export const sendWhatsApp = async ({ to, message }) => {
  try {
    return await call('sendWhatsApp', { to, message });
  } catch (error) {
    return { sent: false, configured: true, reason: error?.message || 'gagal' };
  }
};

/** Susun pesan WhatsApp penagihan ringkas (tanpa tabel, terbaca di ponsel). */
export const buildInvoiceWhatsApp = ({ invoice, company }) => {
  const rupiah = (n) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(
      Number(n) || 0
    );
  const lines = [
    `*${company?.name || 'Kontrack'}*`,
    '',
    `Penagihan invoice ${invoice.invoiceNumber || invoice.number || ''}`,
    `Proyek: ${invoice.projectName || '-'}`,
    `Nilai: ${rupiah(invoice.grandTotal)}`,
    invoice.dueDate ? `Jatuh tempo: ${new Date(invoice.dueDate).toLocaleDateString('id-ID')}` : null,
    '',
    'Mohon konfirmasi bila sudah diterima. Terima kasih.'
  ].filter(Boolean);
  return lines.join('\n');
};

/**
 * Keadaan kanal pemberitahuan menurut server.
 * @returns {Promise<{email:boolean, whatsapp:boolean, whatsappMode:string|null}>}
 */
export const getNotifyChannels = async () => {
  try {
    return await call('notifyChannels', {});
  } catch (error) {
    return { email: false, whatsapp: false, whatsappMode: null, error: error?.message || 'gagal' };
  }
};
