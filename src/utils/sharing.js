// src/utils/sharing.js
import { formatCurrency, formatDate, getStatusLabel, calculateProjectProgress } from './formatters';

// Susun pesan WhatsApp profesional untuk update proyek ke mitra/klien.
// `company` opsional (dari settings) untuk kop nama perusahaan.
export const buildProjectWhatsAppMessage = (project, transactions = [], company = null) => {
  const income = transactions.filter((t) => t.type === 'income').reduce((s, t) => s + (t.amount || 0), 0);
  const expense = transactions.filter((t) => t.type === 'expense').reduce((s, t) => s + (t.amount || 0), 0);

  // PPN kontraktor memakai DPP Nilai Lain (PMK 131/2024): DPP = 11/12 x nilai,
  // PPN = 12% x DPP, jadi efektif 11% dari nilai kontrak. Menghitung 11% langsung
  // dari nilai kontrak menghasilkan angka yang sama, tetapi ditulis eksplisit
  // supaya tidak tampak seperti kesalahan pembulatan bila tarif berubah.
  const taxRate = Number(project.taxRate) || 0;
  const dpp = (project.value * 11) / 12;
  const taxAmount = Math.round((dpp * taxRate) / 100);
  const total = project.value + taxAmount;
  const paid = project.paidAmount || 0;
  const outstanding = Math.max(project.value - paid, 0);
  const progress = calculateProjectProgress(project);
  const companyName = company?.name || company?.companyName || '';

  const line = '━━━━━━━━━━━━━━━';
  const rows = [];
  if (companyName) rows.push(`*${companyName}*`);
  rows.push('*UPDATE PROYEK*', line, '');
  rows.push(`*${project.name}*`);
  rows.push(`Mitra: ${project.partner || '-'}`);
  if (project.contractNumber) rows.push(`No. SPK: ${project.contractNumber}`);
  rows.push('');
  rows.push(`Status: *${getStatusLabel(project.status)}*`);
  rows.push(`Periode: ${formatDate(project.startDate)} - ${formatDate(project.endDate)}`);
  rows.push(`Progress: *${progress}%*`);
  rows.push('');
  rows.push('*Ringkasan Nilai*');
  rows.push(`- Nilai Kontrak: ${formatCurrency(project.value)}`);
  if (taxRate > 0) rows.push(`- DPP Nilai Lain: ${formatCurrency(dpp)}`);
  if (taxRate > 0) rows.push(`- PPN (${taxRate}% x DPP): ${formatCurrency(taxAmount)}`);
  rows.push(`- Total: ${formatCurrency(total)}`);
  rows.push(`- Terbayar: ${formatCurrency(paid)}`);
  rows.push(`- Sisa Tagihan: ${formatCurrency(outstanding)}`);
  // Arus kas internal hanya bila transaksi disertakan (bukan untuk mitra murni)
  if (transactions.length > 0) {
    rows.push('');
    rows.push('*Arus Kas Proyek*');
    rows.push(`- Pemasukan: ${formatCurrency(income)}`);
    rows.push(`- Pengeluaran: ${formatCurrency(expense)}`);
    rows.push(`- Saldo: ${formatCurrency(income - expense)}`);

    // Rincian per kategori (maks. 5 teratas tiap arah) — informasi tanpa banjir teks.
    const byCategory = (type) => {
      const map = {};
      transactions
        .filter((t) => t.type === type && t.amount)
        .forEach((t) => {
          map[t.category || 'Lainnya'] = (map[t.category || 'Lainnya'] || 0) + (Number(t.amount) || 0);
        });
      return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 5);
    };
    const pengeluaran = byCategory('expense');
    if (pengeluaran.length > 0) {
      rows.push('');
      rows.push('*Pengeluaran per Kategori*');
      pengeluaran.forEach(([kat, amt]) => {
        const pct = expense > 0 ? ((amt / expense) * 100).toFixed(1) : '0';
        rows.push(`- ${kat}: ${formatCurrency(amt)} (${pct}%)`);
      });
    }
  }
  rows.push('');
  rows.push(line);
  rows.push(`Detail: ${window.location.origin}/app/projects/${project.id}`);

  return rows.join('\n').trim();
};

export const shareProjectWhatsApp = (project, transactions, company = null) => {
  const message = buildProjectWhatsAppMessage(project, transactions, company);
  const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
  window.open(whatsappUrl, '_blank');
};

// Share kaya: teks + kartu ringkasan (PNG). Prioritas:
// 1) Web Share API dengan file (mobile) → teks & gambar sekaligus.
// 2) Webhook WhatsApp (bila diset di settings) → kirim otomatis.
// 3) Fallback: unduh gambar + buka wa.me dengan teks.
export const shareProjectWhatsAppRich = async (project, transactions, company, imageBlob) => {
  const message = buildProjectWhatsAppMessage(project, transactions, company);
  const fileName = `Proyek_${(project.name || 'kontrack').replace(/[^a-z0-9]/gi, '_')}.png`;

  // 1) Web Share API dengan file
  if (imageBlob && navigator.canShare) {
    const file = new File([imageBlob], fileName, { type: 'image/png' });
    if (navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], text: message });
        return 'shared';
      } catch (e) {
        if (e?.name === 'AbortError') return 'cancelled';
      }
    }
  }

  // 2) Webhook WhatsApp (opsional)
  const webhook = company?.whatsappWebhookUrl;
  if (webhook) {
    try {
      let imageBase64 = null;
      if (imageBlob) {
        imageBase64 = await new Promise((res) => {
          const r = new FileReader();
          r.onload = () => res(r.result);
          r.readAsDataURL(imageBlob);
        });
      }
      await fetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: message, image: imageBase64, project: project.name })
      });
      return 'webhook';
    } catch (e) {
      console.warn('Webhook WA gagal, fallback ke wa.me:', e);
    }
  }

  // 3) Fallback: unduh gambar + buka wa.me
  if (imageBlob) {
    const url = URL.createObjectURL(imageBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`, '_blank');
  return 'fallback';
};

export const copyProjectLink = (projectId) => {
  const link = `${window.location.origin}/app/projects/${projectId}`;
  
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(link)
      .then(() => {
        alert('Link proyek berhasil disalin!');
        return true;
      })
      .catch(err => {
        console.error('Failed to copy:', err);
        // Fallback method
        return fallbackCopyTextToClipboard(link);
      });
  } else {
    // Fallback method for older browsers
    return fallbackCopyTextToClipboard(link);
  }
};

function fallbackCopyTextToClipboard(text) {
  const textArea = document.createElement("textarea");
  textArea.value = text;
  
  // Avoid scrolling to bottom
  textArea.style.top = "0";
  textArea.style.left = "0";
  textArea.style.position = "fixed";

  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();

  try {
    const successful = document.execCommand('copy');
    if (successful) {
      alert('Link proyek berhasil disalin!');
    } else {
      alert('Gagal menyalin link');
    }
    return successful;
  } catch (err) {
    console.error('Fallback: Oops, unable to copy', err);
    alert('Gagal menyalin link');
    return false;
  } finally {
    document.body.removeChild(textArea);
  }
}
// ---------------------------------------------------------------------------
// Ringkasan pilihan: beberapa invoice atau beberapa proyek sekaligus
// ---------------------------------------------------------------------------
//
// Kenapa "simpel": pemilik memilih beberapa invoice/proyek lalu mengirim satu
// ringkasan ke mitra. Yang dibutuhkan hanya identitas, nilai, status, dan
// jumlah; rincian per dokumen tetap bisa dilihat di aplikasi. Karena itu
// ringkasan ini TIDAK memuat transaksi, kategori pengeluaran, atau arus kas
// internal — isinya aman dikirim ke pihak luar tanpa membocorkan margin.

const line = '━━━━━━━━━━━━━━━';

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

// Status invoice dibaca dari beberapa nama field karena dokumen lama sempat
// memakai `status` huruf besar dan `paid` boolean.
const invoiceState = (inv = {}) => {
  const raw = String(inv.status || '').toUpperCase();
  if (raw === 'PAID' || inv.paid === true) return { key: 'paid', label: 'Lunas' };
  if (raw === 'PARTIAL' || num(inv.paidAmount) > 0) return { key: 'partial', label: 'Dibayar sebagian' };
  if (raw === 'OVERDUE') return { key: 'overdue', label: 'Lewat jatuh tempo' };
  if (raw === 'DRAFT') return { key: 'draft', label: 'Draf' };
  return { key: 'sent', label: 'Terkirim' };
};

const invoiceTotal = (inv = {}) => num(inv.grandTotal ?? inv.total ?? num(inv.subtotal) + num(inv.taxAmount));
const invoicePaid = (inv = {}) => num(inv.paidAmount ?? (invoiceState(inv).key === 'paid' ? invoiceTotal(inv) : 0));

/**
 * Ringkasan beberapa invoice untuk dikirim/di-copy.
 * @param {Array} invoices daftar invoice terpilih
 * @param {Object} opts { company, title }
 */
export const buildInvoicesSummaryMessage = (invoices = [], opts = {}) => {
  const list = Array.isArray(invoices) ? invoices : [];
  const companyName = opts.company?.name || opts.company?.companyName || '';
  const title = opts.title || 'RINGKASAN INVOICE';
  const rows = [];
  if (companyName) rows.push(`*${companyName}*`);
  rows.push(`*${title}*`, line, '');
  rows.push(`Jumlah invoice: *${list.length}*`);

  if (list.length === 0) {
    rows.push('', 'Tidak ada invoice yang dipilih.');
    return rows.join('\n').trim();
  }

  // Kelompokkan per status supaya mitra langsung tahu mana yang masih perlu
  // dibayar tanpa membaca satu per satu.
  const groups = { overdue: [], sent: [], partial: [], draft: [], paid: [] };
  let total = 0;
  let paid = 0;

  list.forEach((inv, i) => {
    const st = invoiceState(inv);
    const t = invoiceTotal(inv);
    const p = invoicePaid(inv);
    total += t;
    paid += p;
    if (!groups[st.key]) groups[st.key] = [];
    groups[st.key].push({ inv, st, t, p, no: i + 1 });
  });

  const order = [
    ['overdue', 'LEWAT JATUH TEMPO'],
    ['sent', 'BELUM DIBAYAR'],
    ['partial', 'DIBAYAR SEBAGIAN'],
    ['draft', 'DRAF'],
    ['paid', 'LUNAS']
  ];

  order.forEach(([key, label]) => {
    const items = groups[key] || [];
    if (!items.length) return;
    rows.push('', `*${label}* (${items.length})`);
    items.forEach(({ inv, t, p }) => {
      const due = inv.dueDate ? ` | tempo ${formatDate(inv.dueDate)}` : '';
      rows.push(`- ${inv.invoiceNumber || inv.number || 'Tanpa nomor'}: ${formatCurrency(t)}${due}`);
      if (key === 'partial') rows.push(`  terbayar ${formatCurrency(p)}, sisa ${formatCurrency(t - p)}`);
      if (inv.clientName || inv.partner) rows.push(`  ${inv.clientName || inv.partner}`);
    });
  });

  rows.push('', line);
  rows.push(`*Total:* ${formatCurrency(total)}`);
  rows.push(`*Terbayar:* ${formatCurrency(paid)}`);
  rows.push(`*Sisa:* ${formatCurrency(Math.max(total - paid, 0))}`);

  return rows.join('\n').trim();
};

/**
 * Progres untuk laporan ke mitra.
 *
 * `calculateProjectProgress` mengukur dari PEMBAYARAN, yang tepat untuk kartu
 * keuangan tetapi salah untuk laporan pekerjaan: proyek bisa selesai 100%
 * sementara baru ditagih sebagian. Bila proyek dipecah per unit, progres
 * berbobot nilai unit jauh lebih dekat ke kenyataan lapangan.
 */
const progressOf = (project = {}) => {
  const units = Array.isArray(project.units) ? project.units : [];
  if (units.length) {
    const sumValue = units.reduce((a, u) => a + num(u.value), 0);
    if (sumValue > 0) {
      const done = units.reduce((a, u) => {
        const p = Math.max(0, Math.min(100, num(u.progress)));
        return a + (num(u.value) * (u.status === 'selesai' ? 100 : p)) / 100;
      }, 0);
      return Math.round((done / sumValue) * 1000) / 10;
    }
  }
  if (project.progress != null) return num(project.progress);
  return calculateProjectProgress(project);
};

/**
 * Ringkasan beberapa proyek terpilih. Isinya sengaja hanya angka yang pantas
 * dibaca mitra: nilai, terbayar, sisa, progres.
 */
export const buildProjectsSummaryMessage = (projects = [], opts = {}) => {
  const list = Array.isArray(projects) ? projects : [];
  const companyName = opts.company?.name || opts.company?.companyName || '';
  const title = opts.title || 'RINGKASAN PROYEK';
  const rows = [];
  if (companyName) rows.push(`*${companyName}*`);
  rows.push(`*${title}*`, line, '');
  rows.push(`Jumlah proyek: *${list.length}*`);

  if (list.length === 0) {
    rows.push('', 'Tidak ada proyek yang dipilih.');
    return rows.join('\n').trim();
  }

  let totalValue = 0;
  let totalPaid = 0;

  list.forEach((p) => {
    const value = num(p.value);
    const paid = num(p.paidAmount);
    totalValue += value;
    totalPaid += paid;
    rows.push('');
    rows.push(`*${p.name || 'Tanpa nama'}*`);
    if (p.partner) rows.push(`Mitra: ${p.partner}`);
    rows.push(`Status: ${getStatusLabel(p.status)} | Progres: ${progressOf(p)}%`);
    rows.push(`Nilai: ${formatCurrency(value)}`);
    rows.push(`Terbayar: ${formatCurrency(paid)} | Sisa: ${formatCurrency(Math.max(value - paid, 0))}`);
  });

  rows.push('', line);
  rows.push(`*Total nilai:* ${formatCurrency(totalValue)}`);
  rows.push(`*Total terbayar:* ${formatCurrency(totalPaid)}`);
  rows.push(`*Total sisa:* ${formatCurrency(Math.max(totalValue - totalPaid, 0))}`);

  return rows.join('\n').trim();
};

/** Buka WhatsApp dengan teks tertentu. Dipakai kedua ringkasan. */
export const shareTextWhatsApp = (message) => {
  window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`, '_blank');
};

/** Salin teks ke papan klip; mengembalikan true bila berhasil. */
export const copyText = async (message) => {
  try {
    await navigator.clipboard.writeText(message);
    return true;
  } catch {
    return false;
  }
};
