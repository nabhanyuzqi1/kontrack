// src/utils/projectPlanning.js
//
// Perhitungan perencanaan proyek: RAB, termin & kurva-S, retensi, umur piutang,
// proyeksi kas, dan dasbor pemilik.
//
// Sifat: MURNI (tanpa Firebase), supaya bisa diuji langsung di Node. Semua
// fungsi menerima data mentah dari Firestore dan mengembalikan angka siap
// tampil; tidak ada yang mengarang nilai yang tidak ada di data.
//
// Prinsip yang dipegang di seluruh berkas ini:
// - Uang adalah rupiah utuh; pembulatan hanya di lapisan tampilan.
// - Tanggal lewat toDate() karena `transactions.date` (string) dan
//   `invoices.issueDate` (campuran Timestamp/string) tidak seragam.
// - Bila data tidak cukup, kembalikan null/0 dan biarkan UI menyatakan
//   "belum ada data", bukan menebak.

import { toDate } from './reportCalc';

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const dayMs = 24 * 60 * 60 * 1000;

/** Selisih hari dari `a` ke `b` (b - a), dibulatkan ke bawah. */
export const daysBetween = (a, b) => {
  const da = toDate(a);
  const db = toDate(b);
  if (!da || !db) return null;
  return Math.floor((db.getTime() - da.getTime()) / dayMs);
};

// ---------------------------------------------------------------------------
// 1. Rencana vs realisasi biaya (RAB)
// ---------------------------------------------------------------------------

/**
 * Bandingkan anggaran per kategori (RAB) dengan realisasi pengeluaran.
 *
 * @param {Array} rab baris anggaran: [{ category, budget }]
 * @param {Array} transactions transaksi proyek
 * @returns {{ rows: Array, totals: object }} serapan per kategori + total
 *
 * Catatan: kategori transaksi sudah dinormalkan di lapisan service
 * (utils/transactionMeta.js), jadi pencocokan nama di sini aman.
 */
export const budgetVsActual = (rab = [], transactions = []) => {
  const realisasi = {};
  transactions
    .filter((t) => t.type === 'expense')
    .forEach((t) => {
      const k = t.category || 'Pengeluaran Lain';
      realisasi[k] = (realisasi[k] || 0) + num(t.amount);
    });

  const rows = (rab || [])
    .map((r) => {
      const budget = num(r.budget);
      const actual = realisasi[r.category] || 0;
      // Selisih positif = masih ada sisa anggaran; negatif = overbudget.
      const remaining = budget - actual;
      const pct = budget > 0 ? (actual / budget) * 100 : null;
      return {
        category: r.category,
        budget,
        actual,
        remaining,
        pct,
        over: budget > 0 && actual > budget
      };
    })
    // Kategori yang dibelanjakan tapi tidak dianggarkan tetap ditampilkan:
    // justru itu temuan yang paling perlu dilihat.
    .concat(
      Object.keys(realisasi)
        .filter((k) => !(rab || []).some((r) => r.category === k))
        .map((k) => ({
          category: k,
          budget: 0,
          actual: realisasi[k],
          remaining: -realisasi[k],
          pct: null,
          // Tidak dihitung "over": tidak ada anggaran yang dilampaui, hanya
          // anggaran yang belum dibuat. Dicatat terpisah sebagai unbudgeted.
          over: false,
          unbudgeted: true
        }))
    )
    .sort((a, b) => b.actual - a.actual);

  const totalBudget = rows.reduce((s, r) => s + r.budget, 0);
  const totalActual = rows.reduce((s, r) => s + r.actual, 0);

  return {
    rows,
    totals: {
      budget: totalBudget,
      actual: totalActual,
      remaining: totalBudget - totalActual,
      pct: totalBudget > 0 ? (totalActual / totalBudget) * 100 : null,
      overCount: rows.filter((r) => r.over).length,
      unbudgetedCount: rows.filter((r) => r.unbudgeted).length,
      // Realisasi yang tidak punya anggaran pembanding: ikut menambah biaya,
      // tapi tidak boleh disebut overbudget.
      unbudgetedActual: rows.filter((r) => r.unbudgeted).reduce((s, r) => s + r.actual, 0)
    }
  };
};

// ---------------------------------------------------------------------------
// 2. Termin & kurva-S
// ---------------------------------------------------------------------------

/**
 * Rencana vs realisasi termin per tanggal.
 *
 * @param {Array} plan [{ label, dueDate, amount }]
 * @param {Array} invoices invoice proyek (untuk realisasi)
 * @param {string|Date} today acuan "hari ini" (bisa diinjeksi untuk uji)
 */
export const terminCurve = (plan = [], invoices = [], today = new Date()) => {
  // Dibandingkan nilai BRUTO (grandTotal), bukan netProceeds: netProceeds sudah
  // dipotong retensi/pajak sehingga bisa melebihi nilai termin terjadwal dan
  // membuat termin tampak "cair" lebih besar dari rencananya.
  const paidByInvoice = new Map(
    (invoices || []).map((i) => [i.id, i.status === 'paid' ? num(i.grandTotal) : 0])
  );

  const rows = (plan || []).map((p, idx) => {
    const planned = num(p.amount);
    // Realisasi diambil dari invoice termin yang tertaut, bila ada.
    const actual = p.invoiceId ? paidByInvoice.get(p.invoiceId) || 0 : 0;
    const due = toDate(p.dueDate);
    const late = due && actual === 0 ? daysBetween(due, today) : null;
    // Status eksplisit: kartu termin tanpa label memaksa pembaca menghitung
    // sendiri apakah sudah lewat jatuh tempo.
    let status = 'belum';
    if (actual >= planned && planned > 0) status = 'cair';
    else if (late != null && late > 0) status = 'telat';
    return {
      label: p.label || `Termin ${idx + 1}`,
      dueDate: p.dueDate || null,
      planned,
      actual,
      gap: planned - actual,
      status,
      daysLeft: late != null && late <= 0 ? Math.abs(late) : null,
      // Positif = sudah lewat jatuh tempo dan belum cair.
      overdueDays: late != null && late > 0 ? late : 0
    };
  });

  const totalPlanned = rows.reduce((s, r) => s + r.planned, 0);
  const totalActual = rows.reduce((s, r) => s + r.actual, 0);

  // Kurva-S: kumulatif rencana vs realisasi sepanjang urutan termin.
  let cp = 0;
  let ca = 0;
  const curve = rows.map((r) => {
    cp += r.planned;
    ca += r.actual;
    return {
      label: r.label,
      plannedCum: cp,
      actualCum: ca,
      plannedPct: totalPlanned > 0 ? (cp / totalPlanned) * 100 : 0,
      actualPct: totalPlanned > 0 ? (ca / totalPlanned) * 100 : 0
    };
  });

  return {
    rows,
    curve,
    totals: {
      planned: totalPlanned,
      actual: totalActual,
      gap: totalPlanned - totalActual,
      overdueCount: rows.filter((r) => r.overdueDays > 0).length
    }
  };
};

/**
 * Retensi: bagian nilai kontrak yang ditahan sampai masa pemeliharaan selesai.
 * @returns {{ amount, dueDate, daysLeft, status }} status: 'belum' | 'jatuh-tempo' | 'lewat'
 */
export const retentionStatus = (project = {}, today = new Date()) => {
  // Form proyek menyimpan `retentionPct` (bukan retentionPercent); dokumen lama
  // sempat memakai nama panjang, jadi keduanya dibaca.
  const pct = num(project.retentionPct ?? project.retentionPercent);
  const base = num(project.value);
  const amount = project.retentionAmount != null ? num(project.retentionAmount) : (base * pct) / 100;

  // Tanggal dasar: BA terakhir bila ada, selain itu akhir kontrak.
  const baseDate = toDate(project.lastBaDate || project.endDate);
  const months = project.retentionMonths != null ? num(project.retentionMonths) : 3;
  if (!baseDate || amount <= 0) return { amount, dueDate: null, daysLeft: null, status: 'belum' };

  const due = new Date(baseDate.getTime());
  due.setMonth(due.getMonth() + months);
  const daysLeft = daysBetween(today, due);

  return {
    amount,
    dueDate: due.toISOString().slice(0, 10),
    daysLeft,
    status: daysLeft > 0 ? 'belum' : daysLeft === 0 ? 'jatuh-tempo' : 'lewat'
  };
};

// ---------------------------------------------------------------------------
// 3. Umur piutang & proyeksi kas
// ---------------------------------------------------------------------------

const BUCKETS = [
  { key: 'lancar', label: 'Belum jatuh tempo', min: -Infinity, max: 0 },
  { key: '1-30', label: '1–30 hari', min: 1, max: 30 },
  { key: '31-60', label: '31–60 hari', min: 31, max: 60 },
  { key: '61-90', label: '61–90 hari', min: 61, max: 90 },
  { key: '90+', label: '> 90 hari', min: 91, max: Infinity }
];

/**
 * Umur piutang dari invoice yang belum dibayar.
 * @returns {{ buckets, total, oldestDays, items }}
 */
export const receivableAging = (invoices = [], today = new Date()) => {
  const items = (invoices || [])
    .filter((i) => i.status !== 'void' && i.status !== 'paid')
    .map((i) => {
      const amount = num(i.netProceeds ?? i.grandTotal);
      const dueRef = i.dueDate || i.issueDate;
      const late = daysBetween(dueRef, today);
      return {
        id: i.id,
        invoiceNumber: i.invoiceNumber,
        projectName: i.projectName,
        clientName: i.clientName,
        amount,
        overdueDays: late != null && late > 0 ? late : 0,
        dueDate: i.dueDate || null
      };
    });

  const buckets = BUCKETS.map((b) => {
    const list = items.filter((i) => i.overdueDays >= b.min && i.overdueDays <= b.max);
    return { ...b, count: list.length, amount: list.reduce((s, i) => s + i.amount, 0) };
  });

  return {
    buckets,
    items: items.sort((a, b) => b.overdueDays - a.overdueDays),
    total: items.reduce((s, i) => s + i.amount, 0),
    oldestDays: items.reduce((m, i) => Math.max(m, i.overdueDays), 0)
  };
};

/**
 * Proyeksi kas masuk 30/60/90 hari: dari termin terjadwal dan invoice bertempo.
 * Yang dihitung hanya uang yang BELUM masuk.
 */
export const cashForecast = (invoices = [], terminPlan = [], today = new Date()) => {
  const horizon = [30, 60, 90];
  const outstanding = [];

  (invoices || [])
    .filter((i) => i.status !== 'void' && i.status !== 'paid')
    .forEach((i) => {
      const due = toDate(i.dueDate || i.issueDate);
      if (!due) return;
      outstanding.push({ source: 'invoice', label: i.invoiceNumber, due, amount: num(i.netProceeds ?? i.grandTotal) });
    });

  (terminPlan || []).forEach((p) => {
    if (p.realized) return;
    const due = toDate(p.dueDate);
    if (!due) return;
    outstanding.push({ source: 'termin', label: p.label, due, amount: num(p.amount) });
  });

  const rows = horizon.map((h) => {
    const limit = new Date(today.getTime() + h * dayMs);
    const inWindow = outstanding.filter((o) => o.due <= limit);
    return {
      days: h,
      count: inWindow.length,
      amount: inWindow.reduce((s, o) => s + o.amount, 0)
    };
  });

  return {
    rows,
    // Lewat jatuh tempo: perlu ditagih sekarang, bukan bagian proyeksi.
    overdue: outstanding
      .filter((o) => o.due < today)
      .reduce((s, o) => s + o.amount, 0)
  };
};

// ---------------------------------------------------------------------------
// 4. Margin & proyek terancam
// ---------------------------------------------------------------------------

/**
 * Margin per proyek: pendapatan dikurangi biaya langsung.
 *
 * Pendapatan memakai nilai kontrak (bukan kas masuk), karena pertanyaannya
 * "untung tidak proyek ini", bukan "berapa uang di bank".
 */
export const projectMargin = (project = {}, transactions = []) => {
  const revenue = num(project.value);
  const cost = transactions.filter((t) => t.type === 'expense').reduce((s, t) => s + num(t.amount), 0);
  const margin = revenue - cost;
  const pct = revenue > 0 ? (margin / revenue) * 100 : null;
  const progress = num(project.progress);
  const rabBudget = num(project.rabTotal);

  return {
    revenue,
    cost,
    margin,
    pct,
    progress,
    rabBudget,
    // Proyek berjalan yang biayanya melampaui anggaran adalah peringatan.
    overBudget: rabBudget > 0 && cost > rabBudget,
    // Margin menipis bila sisa anggaran lebih kecil dari sisa pekerjaan.
    atRisk: pct != null && pct < 10 && progress < 100
  };
};

/** Rekap lintas proyek untuk dasbor pemilik. */
export const ownerSummary = ({ projects = [], invoices = [], transactions = [], today = new Date() } = {}) => {
  const active = projects.filter((p) => p.status === 'active' || p.status === 'ongoing');
  const margins = projects.map((p) => ({
    project: p,
    ...projectMargin(p, transactions.filter((t) => t.projectId === p.id))
  }));

  const aging = receivableAging(invoices, today);
  const forecast = cashForecast(invoices, [], today);

  return {
    activeCount: active.length,
    contractValue: projects.reduce((s, p) => s + num(p.value), 0),
    atRisk: margins.filter((m) => m.atRisk || m.overBudget).sort((a, b) => (a.pct ?? 100) - (b.pct ?? 100)),
    receivable: aging.total,
    oldestOverdueDays: aging.oldestDays,
    forecast,
    margins
  };
};

// ---------------------------------------------------------------------------
// 8. Unit pekerjaan, BAHK, dan retensi per unit
// ---------------------------------------------------------------------------
//
// Kenapa per unit, bukan per proyek:
// Satu SPK bisa memuat 17 unit IPAL di lokasi berbeda (kasus IPAL SLM 2026).
// Satu PK bisa memuat satu unit, beberapa unit sekaligus (bila satu lokasi),
// dan unit yang sama bisa berbeda PK. Tiap unit punya BAHK sendiri dan
// ditagih menurut kesiapan unit itu, bukan menurut jadwal termin yang
// seragam. Karena itu retensi pun lahir per unit: persen retensi x nilai
// unit, jatuh tempo beberapa bulan setelah BAHK unit tersebut.
//
// Bentuk data `project.units`:
//   { id, name, location, value, pkNumber, spkNumber,
//     progress,           // 0..100, boleh diperbarui manual
//     status,             // 'belum' | 'berjalan' | 'selesai'
//     bahkNumber, bahkDate, retainedAmount, retentionReleasedDate }
//
// `retentionStatus` versi proyek tetap ada untuk proyek lama yang tidak
// memecah unit; proyek yang punya `units` memakai `unitRetentionSummary`.

const UNIT_DONE_STATUS = 'selesai';

/** Nilai satu unit: `value` bila ada, kalau tidak porsi dari nilai proyek. */
const unitValue = (unit, totalValue, unitCount) => {
  const v = num(unit?.value);
  if (v > 0) return v;
  // Tanpa nilai per unit, jangan mengarang angka: bagi rata hanya bila
  // memang ada patokan nilai proyek dan jumlah unitnya.
  if (totalValue > 0 && unitCount > 0) return totalValue / unitCount;
  return 0;
};

/**
 * Status retensi satu unit.
 * Jatuh tempo = BAHK unit (atau tanggal selesai unit) + masa retensi.
 * Bila unit belum selesai, retensinya belum bisa dihitung: belum ada BAHK.
 */
export const unitRetention = (unit = {}, project = {}, today = new Date()) => {
  const pct = num(project.retentionPct ?? project.retentionPercent);
  const months = project.retentionMonths != null ? num(project.retentionMonths) : 3;
  const units = Array.isArray(project.units) ? project.units : [];
  const value = unitValue(unit, num(project.value), units.length || 1);
  const amount = num(unit.retainedAmount) > 0 ? num(unit.retainedAmount) : (value * pct) / 100;

  const done = unit.status === UNIT_DONE_STATUS || num(unit.progress) >= 100;
  const baseDate = toDate(unit.bahkDate || unit.finishedDate);

  if (!done) {
    return {
      id: unit.id,
      name: unit.name || 'Unit',
      value,
      amount,
      pct,
      done: false,
      dueDate: null,
      daysLeft: null,
      status: 'belum' // retensi belum lahir: BAHK belum ada
    };
  }

  // Selesai tetapi belum ada BAHK: retensi sudah ditahan, tanggalnya belum pasti.
  if (!baseDate) {
    return {
      id: unit.id,
      name: unit.name || 'Unit',
      value,
      amount,
      pct,
      done: true,
      dueDate: null,
      daysLeft: null,
      status: 'tanpa-bahk'
    };
  }

  const due = new Date(baseDate.getTime());
  due.setMonth(due.getMonth() + months);
  const daysLeft = daysBetween(today, due);
  const released = toDate(unit.retentionReleasedDate);

  return {
    id: unit.id,
    name: unit.name || 'Unit',
    value,
    amount,
    pct,
    done: true,
    bahkNumber: unit.bahkNumber || '',
    bahkDate: baseDate.toISOString().slice(0, 10),
    dueDate: due.toISOString().slice(0, 10),
    daysLeft,
    releasedDate: released ? released.toISOString().slice(0, 10) : null,
    status: released ? 'cair' : daysLeft > 0 ? 'belum' : daysLeft === 0 ? 'jatuh-tempo' : 'lewat'
  };
};

/**
 * Ringkasan retensi seluruh unit sebuah proyek.
 * Bila proyek tidak memecah unit, hasilnya jatuh ke `retentionStatus` proyek
 * supaya proyek lama tetap menampilkan angka.
 */
export const unitRetentionSummary = (project = {}, today = new Date()) => {
  const units = Array.isArray(project.units) ? project.units : [];
  if (!units.length) {
    const single = retentionStatus(project, today);
    return { ...single, perUnit: [], hasUnits: false, unitCount: 0, doneCount: 0 };
  }

  const perUnit = units.map((u) => unitRetention(u, project, today));
  const total = perUnit.reduce((a, u) => a + u.amount, 0);
  const doneCount = perUnit.filter((u) => u.done).length;
  // Unit yang sudah punya tanggal cair dan belum dilepas. Status 'belum' di sini
  // berarti "belum jatuh tempo", jadi jangan disaring keluar.
  const next = perUnit
    .filter((u) => u.dueDate && !u.releasedDate)
    .sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)))[0];

  return {
    amount: total,
    pct: num(project.retentionPct ?? project.retentionPercent),
    hasUnits: true,
    unitCount: perUnit.length,
    doneCount,
    // Retensi baru bisa dicairkan penuh setelah SEMUA unit selesai dan BAHK
    // terakhir keluar; ini yang dipakai formulir tagihan.
    allDone: doneCount === perUnit.length,
    nextDue: next || null,
    dueDate: next ? next.dueDate : null,
    daysLeft: next ? next.daysLeft : null,
    status: next ? next.status : doneCount === perUnit.length ? 'cair' : 'belum',
    perUnit
  };
};

/**
 * Rekap progres unit: berapa selesai, nilai yang sudah punya BAHK, dan
 * nilai yang belum bisa ditagih karena BAHK-nya belum keluar.
 */
export const unitProgress = (project = {}) => {
  const units = Array.isArray(project.units) ? project.units : [];
  const totalValue = num(project.value);
  const rows = units.map((u) => {
    const value = unitValue(u, totalValue, units.length || 1);
    const progress = Math.max(0, Math.min(100, num(u.progress)));
    const done = u.status === UNIT_DONE_STATUS || progress >= 100;
    return {
      id: u.id,
      name: u.name || 'Unit',
      location: u.location || '',
      pkNumber: u.pkNumber || project.pkNumber || '',
      spkNumber: u.spkNumber || project.spkNumber || '',
      value,
      progress: done ? 100 : progress,
      done,
      hasBahk: Boolean(u.bahkDate || u.bahkNumber),
      bahkDate: u.bahkDate || null,
      // Nilai yang bisa ditagih: unit yang sudah ber-BAHK, bukan yang sekadar
      // progresnya tinggi.
      billable: Boolean(u.bahkDate || u.bahkNumber)
    };
  });

  const billableValue = rows.filter((r) => r.billable).reduce((a, r) => a + r.value, 0);
  const doneValue = rows.filter((r) => r.done).reduce((a, r) => a + r.value, 0);
  const sumValue = rows.reduce((a, r) => a + r.value, 0);
  const weighted = sumValue > 0
    ? (rows.reduce((a, r) => a + (r.value * r.progress) / 100, 0) / sumValue) * 100
    : 0;

  return {
    rows,
    unitCount: rows.length,
    doneCount: rows.filter((r) => r.done).length,
    bahkCount: rows.filter((r) => r.hasBahk).length,
    totalValue: rows.reduce((a, r) => a + r.value, 0),
    doneValue,
    billableValue,
    unbilledValue: rows.reduce((a, r) => a + r.value, 0) - billableValue,
    // Progres berbobot nilai, bukan rata-rata jumlah unit: unit mahal
    // menentukan besar kecilnya serapan, sama seperti laporan ke mitra.
    weightedProgress: Math.round(weighted * 10) / 10
  };
};
