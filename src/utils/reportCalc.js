// src/utils/reportCalc.js
// Perhitungan laporan pajak bulanan & laporan tahunan (efisiensi, efektivitas,
// indikasi kebocoran dana, neraca ringkas, laba rugi).
//
// Catatan kejujuran data: aplikasi belum menyimpan RAB/anggaran per proyek,
// sehingga "efisiensi" dihitung dari rasio beban terhadap pendapatan yang
// tercatat — bukan realisasi vs anggaran. Lihat catatan di tiap fungsi.

const num = (v) => Number(v) || 0;
const monthKey = (d) => {
  const date = d?.seconds ? new Date(d.seconds * 1000) : new Date(d);
  return isNaN(date.getTime()) ? null : date.toISOString().slice(0, 7);
};
const yearOf = (d) => {
  const k = monthKey(d);
  return k ? Number(k.slice(0, 4)) : null;
};

export const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'
];

/**
 * Ringkasan pajak per bulan.
 * - terhutang: PPN dari invoice yang terbit bulan itu
 * - disetor: PPN yang dibayarkan (taxPaidAt) pada bulan itu
 * - pph: PPh yang dipotong klien
 */
export const monthlyTaxReport = (invoices = [], year) => {
  const rows = MONTH_LABELS.map((label, i) => ({
    month: i + 1,
    label,
    invoiceCount: 0,
    dpp: 0,
    ppnTerhutang: 0,
    ppnDisetor: 0,
    pph: 0,
    omzet: 0
  }));

  invoices.forEach((inv) => {
    if (inv.status === 'void') return;

    // Terbit
    const issueKey = monthKey(inv.issueDate || inv.date);
    if (issueKey && Number(issueKey.slice(0, 4)) === year) {
      const idx = Number(issueKey.slice(5, 7)) - 1;
      const r = rows[idx];
      r.invoiceCount += 1;
      r.dpp += num(inv.dppNilaiLain ?? inv.totals?.dpp);
      r.ppnTerhutang += num(inv.pajak11 ?? inv.totals?.ppn);
      r.pph += num(inv.taxDeductedAmount ?? inv.totals?.pph);
      r.omzet += num(inv.grandTotal ?? inv.totals?.grandTotal);
    }

    // Setoran PPN
    const paidKey = monthKey(inv.taxPaidAt);
    if (paidKey && Number(paidKey.slice(0, 4)) === year) {
      const idx = Number(paidKey.slice(5, 7)) - 1;
      rows[idx].ppnDisetor += num(inv.taxPaymentAmount ?? inv.pajak11 ?? inv.totals?.ppn);
    }
  });

  const total = rows.reduce(
    (acc, r) => ({
      invoiceCount: acc.invoiceCount + r.invoiceCount,
      dpp: acc.dpp + r.dpp,
      ppnTerhutang: acc.ppnTerhutang + r.ppnTerhutang,
      ppnDisetor: acc.ppnDisetor + r.ppnDisetor,
      pph: acc.pph + r.pph,
      omzet: acc.omzet + r.omzet
    }),
    { invoiceCount: 0, dpp: 0, ppnTerhutang: 0, ppnDisetor: 0, pph: 0, omzet: 0 }
  );

  return { rows, total, selisih: total.ppnTerhutang - total.ppnDisetor };
};

/** Laba rugi sederhana dari transaksi (cash basis). */
export const incomeStatement = (transactions = [], year) => {
  const inYear = transactions.filter((t) => yearOf(t.date) === year);
  const income = inYear.filter((t) => t.type === 'income').reduce((s, t) => s + num(t.amount), 0);

  const expenseByCategory = {};
  inYear
    .filter((t) => t.type === 'expense')
    .forEach((t) => {
      const c = t.category || 'Lainnya';
      expenseByCategory[c] = (expenseByCategory[c] || 0) + num(t.amount);
    });

  const expense = Object.values(expenseByCategory).reduce((s, v) => s + v, 0);
  const netProfit = income - expense;

  return {
    income,
    expense,
    expenseByCategory,
    netProfit,
    margin: income > 0 ? (netProfit / income) * 100 : 0
  };
};

/**
 * Efisiensi biaya — rasio beban terhadap pendapatan tercatat.
 * CATATAN: bukan realisasi vs anggaran (RAB belum tersimpan di sistem).
 */
export const efficiencyMetrics = (projects = [], transactions = [], year) => {
  const perProject = projects.map((p) => {
    const txns = transactions.filter((t) => t.projectId === p.id);
    const income = txns.filter((t) => t.type === 'income').reduce((s, t) => s + num(t.amount), 0);
    const expense = txns.filter((t) => t.type === 'expense').reduce((s, t) => s + num(t.amount), 0);
    const ratio = income > 0 ? expense / income : null;
    return {
      id: p.id,
      name: p.name,
      value: num(p.value),
      income,
      expense,
      profit: income - expense,
      costRatio: ratio, // <1 sehat, >1 rugi
      margin: income > 0 ? ((income - expense) / income) * 100 : null
    };
  });

  const withData = perProject.filter((p) => p.income > 0);
  const avgCostRatio =
    withData.length > 0 ? withData.reduce((s, p) => s + p.costRatio, 0) / withData.length : null;

  return {
    perProject: perProject.sort((a, b) => (b.expense || 0) - (a.expense || 0)),
    avgCostRatio,
    // Proyek dengan beban melebihi pemasukan
    lossMaking: perProject.filter((p) => p.income > 0 && p.expense > p.income)
  };
};

/**
 * Efektivitas — seberapa baik target tercapai:
 * - collectionRate: nilai tertagih / nilai kontrak
 * - onTimeRate: proyek selesai sebelum/di tanggal akhir
 * - invoicePaidRate: invoice terbayar / invoice terkirim
 */
export const effectivenessMetrics = (projects = [], invoices = []) => {
  const totalValue = projects.reduce((s, p) => s + num(p.value), 0);
  const totalPaid = projects.reduce((s, p) => s + num(p.paidAmount), 0);

  const finished = projects.filter((p) => p.status === 'selesai');
  const onTime = finished.filter((p) => {
    const end = new Date(p.endDate);
    const done = p.completedAt ? new Date(p.completedAt) : null;
    return done ? done <= end : true; // tanpa tanggal selesai, dianggap tepat waktu
  });

  const active = invoices.filter((i) => i.status !== 'void');
  const paid = active.filter((i) => i.status === 'paid');

  return {
    collectionRate: totalValue > 0 ? (totalPaid / totalValue) * 100 : 0,
    totalValue,
    totalPaid,
    outstanding: Math.max(totalValue - totalPaid, 0),
    finishedCount: finished.length,
    onTimeRate: finished.length > 0 ? (onTime.length / finished.length) * 100 : null,
    invoicePaidRate: active.length > 0 ? (paid.length / active.length) * 100 : 0,
    invoiceUnpaidValue: active
      .filter((i) => i.status !== 'paid')
      .reduce((s, i) => s + num(i.grandTotal ?? i.totals?.grandTotal), 0)
  };
};

/**
 * Indikasi kebocoran dana — bukan tuduhan, melainkan hal yang perlu DICEK.
 * Setiap temuan disertai alasan agar bisa ditindaklanjuti.
 */
export const leakageIndicators = (projects = [], transactions = [], invoices = [], year) => {
  const findings = [];
  const inYear = transactions.filter((t) => !year || yearOf(t.date) === year);

  // 1. Pengeluaran tanpa bukti gambar
  const noProof = inYear.filter((t) => t.type === 'expense' && !t.imageUrl);
  const noProofValue = noProof.reduce((s, t) => s + num(t.amount), 0);
  if (noProof.length > 0) {
    findings.push({
      severity: noProof.length > 10 ? 'high' : 'medium',
      title: 'Pengeluaran tanpa bukti',
      count: noProof.length,
      value: noProofValue,
      reason: 'Transaksi keluar tanpa lampiran nota/bukti transfer sulit diaudit.',
      action: 'Lampirkan bukti pada transaksi terkait.'
    });
  }

  // 2. PPN dipungut tapi belum disetor
  const unremitted = invoices.filter(
    (i) => i.status === 'paid' && num(i.pajak11 ?? i.totals?.ppn) > 0 && !i.taxPaidAt
  );
  const unremittedValue = unremitted.reduce((s, i) => s + num(i.pajak11 ?? i.totals?.ppn), 0);
  if (unremitted.length > 0) {
    findings.push({
      severity: 'high',
      title: 'PPN sudah diterima tapi belum disetor',
      count: unremitted.length,
      value: unremittedValue,
      reason: 'Dana pajak yang tertahan berisiko terpakai untuk operasional.',
      action: 'Setor PPN dan catat NTPN pada Dokumen Pajak.'
    });
  }

  // 3. Proyek rugi (beban > pemasukan)
  const eff = efficiencyMetrics(projects, transactions, year);
  if (eff.lossMaking.length > 0) {
    findings.push({
      severity: 'high',
      title: 'Proyek dengan beban melebihi pemasukan',
      count: eff.lossMaking.length,
      value: eff.lossMaking.reduce((s, p) => s + (p.expense - p.income), 0),
      reason: 'Biaya tercatat lebih besar dari dana masuk pada proyek tersebut.',
      action: 'Periksa pencatatan atau evaluasi harga kontrak.',
      items: eff.lossMaking.map((p) => p.name)
    });
  }

  // 4. Nominal ganda di hari yang sama (indikasi input dobel)
  const seen = new Map();
  const dupes = [];
  inYear.forEach((t) => {
    const k = `${t.projectId}|${t.amount}|${String(t.date).slice(0, 10)}|${t.type}`;
    if (seen.has(k)) dupes.push(t);
    else seen.set(k, t);
  });
  if (dupes.length > 0) {
    findings.push({
      severity: 'medium',
      title: 'Kemungkinan transaksi dobel',
      count: dupes.length,
      value: dupes.reduce((s, t) => s + num(t.amount), 0),
      reason: 'Nominal, tanggal, dan proyek sama persis — bisa jadi input ganda.',
      action: 'Periksa dan hapus salah satunya bila benar duplikat.'
    });
  }

  // 5. Selisih antara terbayar proyek vs invoice terbayar
  const invoicePaidTotal = invoices
    .filter((i) => i.status === 'paid')
    .reduce((s, i) => s + num(i.grandTotal ?? i.totals?.grandTotal), 0);
  const projectPaidTotal = projects.reduce((s, p) => s + num(p.paidAmount), 0);
  const gap = Math.abs(projectPaidTotal - invoicePaidTotal);
  if (invoicePaidTotal > 0 && gap > invoicePaidTotal * 0.05) {
    findings.push({
      severity: 'medium',
      title: 'Selisih pembayaran proyek vs invoice',
      count: 1,
      value: gap,
      reason: 'Total terbayar di proyek berbeda >5% dari total invoice terbayar.',
      action: 'Rekonsiliasi pencatatan pembayaran.'
    });
  }

  return findings.sort((a, b) => (a.severity === 'high' ? -1 : 1));
};

/**
 * Neraca ringkas (bukan neraca akuntansi penuh — sistem memakai cash basis).
 * Aset: kas bersih + piutang usaha. Kewajiban: utang pajak PPN belum setor.
 */
export const balanceSheet = (projects = [], transactions = [], invoices = []) => {
  const income = transactions.filter((t) => t.type === 'income').reduce((s, t) => s + num(t.amount), 0);
  const expense = transactions.filter((t) => t.type === 'expense').reduce((s, t) => s + num(t.amount), 0);
  const cash = income - expense;

  const receivable = invoices
    .filter((i) => i.status === 'sent')
    .reduce((s, i) => s + num(i.grandTotal ?? i.totals?.grandTotal), 0);

  const retention = projects
    .filter((p) => p.status === 'retensi')
    .reduce((s, p) => s + Math.max(num(p.value) - num(p.paidAmount), 0), 0);

  const taxPayable = invoices
    .filter((i) => i.status === 'paid' && !i.taxPaidAt)
    .reduce((s, i) => s + num(i.pajak11 ?? i.totals?.ppn), 0);

  const assets = cash + receivable + retention;
  const liabilities = taxPayable;

  return {
    cash,
    receivable,
    retention,
    assets,
    taxPayable,
    liabilities,
    equity: assets - liabilities
  };
};

/** Tahun yang tersedia dari data (untuk pemilih tahun). */
export const availableYears = (...datasets) => {
  const years = new Set();
  datasets.flat().forEach((d) => {
    const y = yearOf(d?.issueDate || d?.date || d?.startDate || d?.createdAt);
    if (y) years.add(y);
  });
  const list = [...years].sort((a, b) => b - a);
  return list.length ? list : [new Date().getFullYear()];
};
