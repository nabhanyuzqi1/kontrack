// src/utils/projectImage.js
// Membuat kartu ringkasan proyek (PNG) untuk dibagikan ke WhatsApp.
// Digambar langsung di canvas (tanpa html2canvas) agar robust & tanpa dependensi CSS.

import { formatCurrency, formatDate, getStatusLabel, calculateProjectProgress } from './formatters';

const brandColor = () => {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue('--brand-600').trim();
    if (v) return `rgb(${v.replace(/\s+/g, ',')})`;
  } catch (e) {
    /* fallback */
  }
  return '#3358f4';
};

const accentColor = () => {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue('--accent-500').trim();
    if (v) return `rgb(${v.replace(/\s+/g, ',')})`;
  } catch (e) {
    /* fallback */
  }
  return '#06b6d4';
};

// Bungkus teks ke beberapa baris sesuai lebar maksimum.
const wrapText = (ctx, text, maxWidth) => {
  const words = String(text).split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
};

export const generateProjectSummaryImage = (project, transactions = [], company = null) => {
  const W = 1080;
  const H = 1080;
  const P = 72; // padding
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  // Latar
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, W, H);

  // Header gradien brand
  const grad = ctx.createLinearGradient(0, 0, W, 260);
  grad.addColorStop(0, brandColor());
  grad.addColorStop(1, accentColor());
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, 260);

  // Nama perusahaan + label
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = '600 30px Inter, system-ui, sans-serif';
  ctx.fillText((company?.name || company?.companyName || 'KONTRACK').toUpperCase(), P, 90);
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 52px "Space Grotesk", Inter, sans-serif';
  ctx.fillText('Update Proyek', P, 160);

  // Status pill
  const status = getStatusLabel(project.status);
  ctx.font = '600 26px Inter, sans-serif';
  const sw = ctx.measureText(status).width + 44;
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  const pillY = 196;
  ctx.beginPath();
  ctx.roundRect(P, pillY, sw, 46, 23);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.fillText(status, P + 22, pillY + 31);

  // Nama proyek
  let y = 360;
  ctx.fillStyle = '#0f172a';
  ctx.font = '700 46px "Space Grotesk", Inter, sans-serif';
  const nameLines = wrapText(ctx, project.name, W - P * 2).slice(0, 2);
  nameLines.forEach((ln) => {
    ctx.fillText(ln, P, y);
    y += 58;
  });

  // Mitra + periode
  ctx.fillStyle = '#475569';
  ctx.font = '500 30px Inter, sans-serif';
  ctx.fillText(project.partner || '-', P, y + 6);
  y += 46;
  ctx.fillStyle = '#94a3b8';
  ctx.font = '400 26px Inter, sans-serif';
  ctx.fillText(`${formatDate(project.startDate)} – ${formatDate(project.endDate)}`, P, y);
  y += 60;

  // Kotak metrik
  const taxRate = Number(project.taxRate) || 0;
  const paid = project.paidAmount || 0;
  const outstanding = Math.max(project.value - paid, 0);
  const progress = calculateProjectProgress(project);

  const rows = [
    ['Nilai Kontrak', formatCurrency(project.value), '#0f172a'],
    [`Pajak (${taxRate}%)`, formatCurrency((project.value * taxRate) / 100), '#475569'],
    ['Terbayar', formatCurrency(paid), '#059669'],
    ['Sisa Tagihan', outstanding <= 0 ? 'Lunas' : formatCurrency(outstanding), outstanding <= 0 ? '#059669' : '#dc2626']
  ];

  const boxY = y;
  const boxH = rows.length * 76 + 40;
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(P, boxY, W - P * 2, boxH, 24);
  ctx.fill();
  ctx.stroke();

  let ry = boxY + 60;
  rows.forEach(([label, val, color]) => {
    ctx.fillStyle = '#64748b';
    ctx.font = '400 30px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(label, P + 40, ry);
    ctx.fillStyle = color;
    ctx.font = '700 32px Inter, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(val, W - P - 40, ry);
    ry += 76;
  });
  ctx.textAlign = 'left';

  // Progress bar
  const pY = boxY + boxH + 60;
  ctx.fillStyle = '#0f172a';
  ctx.font = '600 30px Inter, sans-serif';
  ctx.fillText('Progress', P, pY);
  ctx.textAlign = 'right';
  ctx.fillStyle = brandColor();
  ctx.font = '700 34px "Space Grotesk", Inter, sans-serif';
  ctx.fillText(`${progress}%`, W - P, pY);
  ctx.textAlign = 'left';

  const barY = pY + 24;
  const barW = W - P * 2;
  ctx.fillStyle = '#e2e8f0';
  ctx.beginPath();
  ctx.roundRect(P, barY, barW, 22, 11);
  ctx.fill();
  const pg = ctx.createLinearGradient(P, 0, P + barW, 0);
  pg.addColorStop(0, brandColor());
  pg.addColorStop(1, accentColor());
  ctx.fillStyle = pg;
  ctx.beginPath();
  ctx.roundRect(P, barY, Math.max((barW * progress) / 100, 22), 22, 11);
  ctx.fill();

  // Footer
  ctx.fillStyle = '#94a3b8';
  ctx.font = '400 24px Inter, sans-serif';
  ctx.fillText('Dibuat dengan Kontrack', P, H - 48);

  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), 'image/png'));
};
