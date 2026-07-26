// src/services/aiInsights.js
// Analisis keuangan berbasis AI. Kunci efisiensi: kirim RINGKASAN metrik yang
// sudah dihitung lokal (~300 token), bukan ratusan dokumen transaksi.
// Hasil di-cache di sessionStorage agar tidak memanggil AI berulang kali.

import { getFunctions, httpsCallable } from 'firebase/functions';

const CACHE_PREFIX = 'kontrack-ai-insight:';
const CACHE_TTL = 30 * 60 * 1000; // 30 menit

// Bulatkan angka besar → payload lebih kecil & AI tak terganggu presisi receh.
const r = (n) => Math.round(Number(n) || 0);
const pct = (n) => Math.round((Number(n) || 0) * 10) / 10;

/**
 * Susun ringkasan metrik untuk dikirim ke AI.
 * Sengaja ringkas: hanya angka yang benar-benar mengubah kesimpulan.
 */
export const buildFinancialSummary = ({
  projects = [],
  transactions = [],
  invoices = [],
  period = 'keseluruhan'
}) => {
  const income = transactions
    .filter((t) => t.type === 'income')
    .reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const expense = transactions
    .filter((t) => t.type === 'expense')
    .reduce((s, t) => s + (Number(t.amount) || 0), 0);

  const expenseByCategory = {};
  transactions
    .filter((t) => t.type === 'expense')
    .forEach((t) => {
      const c = t.category || 'Lainnya';
      expenseByCategory[c] = (expenseByCategory[c] || 0) + (Number(t.amount) || 0);
    });
  const topExpenses = Object.entries(expenseByCategory)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([kategori, nilai]) => ({ kategori, nilai: r(nilai) }));

  const totalValue = projects.reduce((s, p) => s + (Number(p.value) || 0), 0);
  const totalPaid = projects.reduce((s, p) => s + (Number(p.paidAmount) || 0), 0);

  const activeInv = invoices.filter((i) => i.status !== 'void');
  const ppnDipungut = activeInv.reduce((s, i) => s + (Number(i.pajak11) || 0), 0);
  const ppnDisetor = activeInv
    .filter((i) => i.taxPaidAt)
    .reduce((s, i) => s + (Number(i.pajak11) || 0), 0);
  const invBelumBayar = activeInv.filter((i) => i.status !== 'paid');

  return {
    periode: period,
    proyek: {
      total: projects.length,
      berjalan: projects.filter((p) => p.status === 'ongoing').length,
      retensi: projects.filter((p) => p.status === 'retensi').length,
      nilaiKontrak: r(totalValue),
      sudahTertagih: r(totalPaid),
      sisaTagihan: r(Math.max(totalValue - totalPaid, 0)),
      tingkatPenagihanPersen: pct(totalValue > 0 ? (totalPaid / totalValue) * 100 : 0)
    },
    kas: {
      pemasukan: r(income),
      pengeluaran: r(expense),
      saldo: r(income - expense),
      marginPersen: pct(income > 0 ? ((income - expense) / income) * 100 : 0),
      bebanTerbesar: topExpenses
    },
    pajak: {
      ppnDipungut: r(ppnDipungut),
      ppnSudahDisetor: r(ppnDisetor),
      ppnBelumDisetor: r(Math.max(ppnDipungut - ppnDisetor, 0))
    },
    invoice: {
      total: activeInv.length,
      belumTerbayar: invBelumBayar.length,
      nilaiBelumTerbayar: r(
        invBelumBayar.reduce((s, i) => s + (Number(i.grandTotal) || 0), 0)
      )
    }
  };
};

const cacheKey = (summary) => {
  // Kunci dari angka inti — bila data berubah, analisis diperbarui.
  const sig = [
    summary.periode,
    summary.proyek?.nilaiKontrak,
    summary.proyek?.sudahTertagih,
    summary.kas?.saldo,
    summary.pajak?.ppnBelumDisetor,
    summary.invoice?.belumTerbayar
  ].join('|');
  return CACHE_PREFIX + sig;
};

const readCache = (key) => {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const { at, data } = JSON.parse(raw);
    return Date.now() - at < CACHE_TTL ? data : null;
  } catch (e) {
    return null;
  }
};

const writeCache = (key, data) => {
  try {
    sessionStorage.setItem(key, JSON.stringify({ at: Date.now(), data }));
  } catch (e) {
    /* kuota penuh / private mode */
  }
};

/**
 * Minta analisis AI. force=true melewati cache.
 * @returns {Promise<{headline, health, insights[], actions[]}>}
 */
export const getFinancialInsight = async (summary, { force = false } = {}) => {
  const key = cacheKey(summary);
  if (!force) {
    const hit = readCache(key);
    if (hit) return hit;
  }

  const fn = httpsCallable(getFunctions(), 'analyzeFinancialInsights');
  const res = await fn({ summary });
  const insight = res?.data?.insight;
  if (!insight) throw new Error('AI tidak memberi hasil analisis.');

  writeCache(key, insight);
  return insight;
};
