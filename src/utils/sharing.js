// src/utils/sharing.js
import { formatCurrency, formatDate, getStatusLabel, calculateProjectProgress } from './formatters';

// Susun pesan WhatsApp profesional untuk update proyek ke mitra/klien.
// `company` opsional (dari settings) untuk kop nama perusahaan.
export const buildProjectWhatsAppMessage = (project, transactions = [], company = null) => {
  const income = transactions.filter((t) => t.type === 'income').reduce((s, t) => s + (t.amount || 0), 0);
  const expense = transactions.filter((t) => t.type === 'expense').reduce((s, t) => s + (t.amount || 0), 0);

  const taxRate = Number(project.taxRate) || 0;
  const taxAmount = (project.value * taxRate) / 100;
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
  rows.push(`▪️ Status: *${getStatusLabel(project.status)}*`);
  rows.push(`▪️ Periode: ${formatDate(project.startDate)} – ${formatDate(project.endDate)}`);
  rows.push(`▪️ Progress: *${progress}%*`);
  rows.push('');
  rows.push('*Ringkasan Nilai*');
  rows.push(`• Nilai Kontrak: ${formatCurrency(project.value)}`);
  if (taxRate > 0) rows.push(`• Pajak (${taxRate}%): ${formatCurrency(taxAmount)}`);
  rows.push(`• Total: ${formatCurrency(total)}`);
  rows.push(`• Terbayar: ${formatCurrency(paid)}`);
  rows.push(`• Sisa Tagihan: ${formatCurrency(outstanding)}`);
  // Arus kas internal hanya bila transaksi disertakan (bukan untuk mitra murni)
  if (transactions.length > 0) {
    rows.push('');
    rows.push('*Arus Kas Proyek*');
    rows.push(`• Pemasukan: ${formatCurrency(income)}`);
    rows.push(`• Pengeluaran: ${formatCurrency(expense)}`);
    rows.push(`• Saldo: ${formatCurrency(income - expense)}`);
  }
  rows.push('');
  rows.push(line);
  rows.push(`🔗 Detail: ${window.location.origin}/projects/${project.id}`);

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
  const link = `${window.location.origin}/projects/${projectId}`;
  
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