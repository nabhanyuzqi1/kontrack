// src/components/reports/Reports.jsx
import React, { useState, useEffect } from 'react';
import {
  FileDown,
  FileSpreadsheet,
  FilterX,
  BarChart3,
  Landmark,
  CalendarRange,
  FolderKanban,
  Wallet,
  Clock3,
  PiggyBank,
  TrendingUp,
  TrendingDown,
  CircleDollarSign,
  Receipt,
  TriangleAlert
} from 'lucide-react';
import TaxMonthlyReport from './TaxMonthlyReport';
import AnnualReport from './AnnualReport';
import { getAllInvoices } from '../../services/invoices';
import { subscribe, CACHE_KEYS } from '../../services/cache';
import { availableYears, toDate, withinRange } from '../../utils/reportCalc';
import { getAllProjects } from '../../services/projects';
import { getAllTransactions } from '../../services/transactions';
import ReportCharts from './ReportCharts';
import { formatCurrency, formatDate, getStatusLabel, calculateProjectProgress } from '../../utils/formatters';
import { PROJECT_STATUS } from '../../utils/constants';
import { generateFullReportPDF, generateTransactionReport } from '../../utils/pdfGenerator';
import PageHeader from '../ui/PageHeader';
import Button from '../ui/Button';
import { Card, CardHeader } from '../ui/Card';
import { Field, Input, Select } from '../ui/Field';
import { StatusBadge } from '../ui/Badge';
import ProgressBar from '../ui/ProgressBar';
import StatCard from '../ui/StatCard';
import EmptyState from '../ui/EmptyState';
import { SkeletonListPage } from '../ui/Skeleton';

const Th = ({ children, className = '' }) => (
  <th
    className={`whitespace-nowrap px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400 ${className}`}
  >
    {children}
  </th>
);

const REPORT_TABS = [
  { key: 'summary', label: 'Ringkasan', short: 'Ringkasan', icon: BarChart3 },
  { key: 'tax', label: 'Pajak Bulanan', short: 'Pajak', icon: Landmark },
  { key: 'annual', label: 'Analisis Tahunan', short: 'Analisis', icon: CalendarRange }
];

const Reports = ({ currentUser }) => {
  const [tab, setTab] = useState('summary');
  const [year, setYear] = useState(new Date().getFullYear());
  const [invoices, setInvoices] = useState([]);
  const [projects, setProjects] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [stats, setStats] = useState({
    totalProjects: 0,
    totalValue: 0,
    totalPaid: 0,
    totalTax: 0,
    outstanding: 0,
    retention: 0,
    totalIncome: 0,
    totalExpense: 0,
    totalProfit: 0,
    projectsByStatus: {},
    monthlyData: {},
    margin: 0,
    incomeCount: 0,
    expenseCount: 0
  });
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });

  // Rentang hanya berlaku bila kedua batas terisi DAN urutannya benar. Rentang
  // terbalik sengaja diabaikan, bukan menghasilkan laporan kosong — laporan kosong
  // terbaca sebagai "tidak ada pemasukan", padahal masalahnya filter.
  const rangeActive =
    Boolean(dateRange.startDate && dateRange.endDate) &&
    dateRange.startDate <= dateRange.endDate;
  const rangeInvalid =
    Boolean(dateRange.startDate && dateRange.endDate) &&
    dateRange.startDate > dateRange.endDate;

  useEffect(() => {
    loadReportData();
    // SWR: perbarui diam-diam saat cache disegarkan di belakang layar.
    const keys = [CACHE_KEYS.PROJECTS, CACHE_KEYS.TRANSACTIONS, CACHE_KEYS.INVOICES];
    const unsubs = keys.map((k) => subscribe(k, () => loadReportData({ silent: true })));
    return () => unsubs.forEach((u) => u());
  }, []);

  const loadReportData = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const [projectList, transactionList, invoiceList] = await Promise.all([
        getAllProjects(),
        getAllTransactions(),
        getAllInvoices().catch(() => [])
      ]);

      setProjects(projectList);
      setTransactions(transactionList);
      setInvoices(invoiceList);
      const yrs = availableYears(projectList, transactionList, invoiceList);
      setYear((y) => (yrs.includes(y) ? y : yrs[0]));
      calculateStats(projectList, transactionList);
    } catch (error) {
      console.error('Error loading report data:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (projectList, transactionList) => {
    const inRange = (t) =>
      !rangeActive || withinRange(t.date, dateRange.startDate, dateRange.endDate);

    const totalProjects = projectList.length;
    const totalValue = projectList.reduce((sum, p) => sum + (p.value || 0), 0);
    const totalPaid = projectList.reduce((sum, p) => sum + (p.paidAmount || 0), 0);
    const totalTax = projectList.reduce((sum, p) => sum + ((p.value * p.taxRate) / 100 || 0), 0);

    // Piutang termin (belum tertagih) dan retensi yang ditahan pemberi kerja —
    // dua penyebab utama jeda arus kas kontraktor, jadi keduanya tampil di depan.
    const outstanding = Math.max(totalValue - totalPaid, 0);
    const retention = projectList
      .filter((p) => p.status === PROJECT_STATUS.RETENSI)
      .reduce((sum, p) => sum + Math.max((p.value || 0) - (p.paidAmount || 0), 0), 0);

    const incomeTxns = transactionList.filter((t) => inRange(t) && t.type === 'income');
    const expenseTxns = transactionList.filter((t) => inRange(t) && t.type === 'expense');

    const totalIncome = incomeTxns.reduce((sum, t) => sum + (t.amount || 0), 0);
    const totalExpense = expenseTxns.reduce((sum, t) => sum + (t.amount || 0), 0);
    const totalProfit = totalIncome - totalExpense;
    const margin = totalIncome > 0 ? ((totalProfit / totalIncome) * 100).toFixed(1) : 0;

    const projectsByStatus = {};
    Object.values(PROJECT_STATUS).forEach((status) => {
      const inStatus = projectList.filter((p) => p.status === status);
      projectsByStatus[status] = {
        count: inStatus.length,
        value: inStatus.reduce((sum, p) => sum + (p.value || 0), 0)
      };
    });

    // Bulan dikelompokkan menurut waktu lokal. toISOString() memakai UTC sehingga
    // transaksi 1 Januari 00:30 WIB jatuh ke Desember tahun sebelumnya.
    const monthlyData = {};
    transactionList.filter(inRange).forEach((t) => {
      const d = toDate(t.date);
      if (!d) return;
      const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!monthlyData[month]) {
        monthlyData[month] = { income: 0, expense: 0 };
      }
      if (t.type === 'income') {
        monthlyData[month].income += t.amount || 0;
      } else {
        monthlyData[month].expense += t.amount || 0;
      }
    });

    setStats({
      totalProjects,
      totalValue,
      totalPaid,
      totalTax,
      outstanding,
      retention,
      totalIncome,
      totalExpense,
      totalProfit,
      margin,
      projectsByStatus,
      monthlyData,
      incomeCount: incomeTxns.length,
      expenseCount: expenseTxns.length
    });
  };

  const handleDateRangeChange = (e) => {
    const { name, value } = e.target;
    setDateRange((prev) => ({ ...prev, [name]: value }));
  };

  const isoDate = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate()
    ).padStart(2, '0')}`;

  // Preset dihitung dengan fungsi yang sama dipakai tombolnya, sehingga penanda
  // "preset aktif" tidak bisa berbeda dari rentang yang benar-benar diterapkan.
  const presetRange = (key) => {
    if (key === 'all') return { startDate: '', endDate: '' };
    const today = new Date();
    const start = new Date(today);
    if (key === 'month') start.setDate(1);
    if (key === 'quarter') start.setMonth(Math.floor(today.getMonth() / 3) * 3, 1);
    if (key === 'year') start.setMonth(0, 1);
    return { startDate: isoDate(start), endDate: isoDate(today) };
  };

  const PRESETS = [
    { key: 'all', label: 'Semua' },
    { key: 'month', label: 'Bulan ini' },
    { key: 'quarter', label: 'Kuartal ini' },
    { key: 'year', label: 'Tahun ini' }
  ];

  const activePreset =
    PRESETS.find(({ key }) => {
      const r = presetRange(key);
      return r.startDate === dateRange.startDate && r.endDate === dateRange.endDate;
    })?.key || null;

  useEffect(() => {
    if (projects.length > 0 || transactions.length > 0) {
      calculateStats(projects, transactions);
    }
  }, [dateRange]);

  const clearDateRange = () => {
    setDateRange({ startDate: '', endDate: '' });
  };

  const handleExportFinancialReport = () => {
    generateFullReportPDF(projects, transactions, stats);
  };

  const handleExportTransactionReport = () => {
    let filteredTransactions = transactions;
    if (dateRange.startDate && dateRange.endDate) {
      filteredTransactions = transactions.filter((t) => {
        const transDate = new Date(t.date);
        const start = new Date(dateRange.startDate);
        const end = new Date(dateRange.endDate);
        end.setHours(23, 59, 59, 999);
        return transDate >= start && transDate <= end;
      });
    }

    const filters =
      dateRange.startDate && dateRange.endDate
        ? { dateRange: { start: dateRange.startDate, end: dateRange.endDate } }
        : {};

    generateTransactionReport(filteredTransactions, filters);
  };

  const years = availableYears(projects, transactions, invoices);

  if (loading) {
    return <SkeletonListPage variant="table" stats={4} />;
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Laporan Keuangan"
        subtitle="Ringkasan kinerja proyek, pajak, dan analisis tahunan"
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={handleExportTransactionReport}>
              <FileSpreadsheet className="h-4 w-4" />
              Export Transaksi
            </Button>
            <Button size="sm" onClick={handleExportFinancialReport}>
              <FileDown className="h-4 w-4" />
              Export PDF
            </Button>
          </>
        }
      />

      {/* Tab laporan + pemilih tahun */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="custom-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {REPORT_TABS.map(({ key, label, short, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-all ${
                tab === key
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'bg-slate-100/70 text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-slate-200/70'
              }`}
            >
              <Icon className="h-4 w-4" />
              {/* Label panjang dipendekkan di mobile — kalau tidak, tab ketiga
                  terpotong di layar 390px dan terbaca seperti layout rusak. */}
              <span className="hidden sm:inline">{label}</span>
              <span className="sm:hidden">{short}</span>
            </button>
          ))}
        </div>
        {tab !== 'summary' && (
          <div className="w-full sm:w-40">
            <Select value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {years.map((y) => (
                <option key={y} value={y}>
                  Tahun {y}
                </option>
              ))}
            </Select>
          </div>
        )}
      </div>

      {tab === 'tax' && <TaxMonthlyReport invoices={invoices} year={year} />}
      {tab === 'annual' && (
        <AnnualReport
          projects={projects}
          transactions={transactions}
          invoices={invoices}
          year={year}
        />
      )}

      {tab === 'summary' && (
      <>
      {/* Filter periode — preset + rentang manual */}
      <Card className="mb-6 p-4">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Periode
            </span>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setDateRange(presetRange(key))}
                  className={`inline-flex min-h-[34px] items-center rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    activePreset === key
                      ? 'bg-brand-600 text-white'
                      : 'bg-slate-50 text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Tanggal Mulai">
              <Input
                type="date"
                name="startDate"
                value={dateRange.startDate}
                onChange={handleDateRangeChange}
              />
            </Field>
            <Field label="Tanggal Akhir">
              <Input
                type="date"
                name="endDate"
                value={dateRange.endDate}
                onChange={handleDateRangeChange}
              />
            </Field>
            <div>
              <Button
                variant="secondary"
                onClick={clearDateRange}
                disabled={!dateRange.startDate && !dateRange.endDate}
              >
                <FilterX className="h-4 w-4" />
                Reset Filter
              </Button>
            </div>
          </div>
          <p className="text-xs text-slate-400">
            Periode hanya memengaruhi angka arus kas dan grafik. Posisi kontrak di bawah
            selalu dihitung dari seluruh proyek.
          </p>
          {rangeInvalid && (
            <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Tanggal mulai melewati tanggal akhir, jadi rentang diabaikan dan seluruh transaksi
              dihitung.
            </p>
          )}
        </div>
      </Card>

      {projects.length === 0 && transactions.length === 0 ? (
        <EmptyState
          icon={BarChart3}
          title="Belum ada data untuk dilaporkan"
          description="Laporan terbentuk otomatis begitu ada proyek dan transaksi yang tercatat."
        />
      ) : (
      <>
      {/* Posisi kontrak — seluruh waktu, sengaja tidak ikut filter periode */}
      <section className="mb-6">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-1">
          <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-slate-500">
            Posisi Kontrak
          </h2>
          <span className="text-xs text-slate-400">Seluruh waktu</span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
          <StatCard
            icon={FolderKanban}
            tone="brand"
            label="Nilai Kontrak"
            value={formatCurrency(stats.totalValue)}
            sub={`${stats.totalProjects} proyek`}
          />
          <StatCard
            icon={Wallet}
            tone="emerald"
            label="Sudah Terbayar"
            value={formatCurrency(stats.totalPaid)}
            sub={
              stats.totalValue > 0
                ? `${Math.round((stats.totalPaid / stats.totalValue) * 100)}% dari nilai kontrak`
                : 'Belum ada kontrak'
            }
          />
          <StatCard
            icon={Clock3}
            tone={stats.outstanding > 0 ? 'amber' : 'emerald'}
            label="Piutang Termin"
            value={formatCurrency(stats.outstanding)}
            sub={stats.outstanding > 0 ? 'Belum tertagih' : 'Semua sudah tertagih'}
            subTone={stats.outstanding > 0 ? 'text-amber-600' : 'text-emerald-600'}
          />
          <StatCard
            icon={PiggyBank}
            tone="violet"
            label="Retensi Tertahan"
            value={formatCurrency(stats.retention)}
            sub="Cair setelah FHO"
          />
        </div>
      </section>

      {/* Arus kas — mengikuti periode terpilih */}
      <section className="mb-6">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-1">
          <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-slate-500">
            Arus Kas
          </h2>
          <span className="text-xs text-slate-400">
            {rangeActive
              ? `${formatDate(dateRange.startDate)} – ${formatDate(dateRange.endDate)}`
              : 'Seluruh waktu'}
          </span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
          <StatCard
            icon={TrendingUp}
            tone="emerald"
            label="Uang Masuk"
            value={formatCurrency(stats.totalIncome)}
            sub={`${stats.incomeCount} transaksi`}
          />
          <StatCard
            icon={TrendingDown}
            tone="red"
            label="Uang Keluar"
            value={formatCurrency(stats.totalExpense)}
            sub={`${stats.expenseCount} transaksi`}
          />
          <StatCard
            icon={CircleDollarSign}
            tone={stats.totalProfit >= 0 ? 'brand' : 'red'}
            label="Laba Bersih"
            value={formatCurrency(stats.totalProfit)}
            sub={`Margin ${stats.margin}% · basis kas`}
            subTone={stats.totalProfit >= 0 ? 'text-slate-400' : 'text-red-600'}
          />
          <StatCard
            icon={Receipt}
            tone="cyan"
            label="PPN atas Kontrak"
            value={formatCurrency(stats.totalTax)}
            sub="Terhitung, bukan kas keluar"
          />
        </div>
      </section>

      {/* Status proyek */}
      <Card className="mb-8">
        <CardHeader title="Status Proyek" />
        <div className="grid grid-cols-2 gap-4 p-5 md:grid-cols-4">
          {Object.entries(stats.projectsByStatus).map(([status, data]) => (
            <div
              key={status}
              className="flex flex-col items-center rounded-xl bg-slate-50/70 p-4 text-center"
            >
              <StatusBadge status={status} />
              <p className="mt-2 font-display text-2xl font-bold text-slate-900">{data.count}</p>
              <p className="mt-0.5 text-xs text-slate-400">{formatCurrency(data.value)}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Grafik */}
      <ReportCharts projects={projects} transactions={transactions} monthlyData={stats.monthlyData} />

      {/* Tabel semua proyek */}
      <Card className="mt-8">
        <CardHeader title="Daftar Semua Proyek" />
        <div className="custom-scrollbar overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-slate-50/70">
              <tr>
                <Th>Proyek</Th>
                <Th>Mitra</Th>
                <Th>Status</Th>
                <Th>Nilai</Th>
                <Th>Terbayar</Th>
                <Th>Progress</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/60">
              {projects.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-5 py-8 text-center text-sm text-slate-400">
                    Belum ada data proyek
                  </td>
                </tr>
              ) : (
                projects.map((project) => {
                  const progress = calculateProjectProgress(project);
                  return (
                    <tr key={project.id} className="transition-colors hover:bg-slate-50/60">
                      <td className="px-5 py-3.5 text-sm font-medium text-slate-800">
                        {project.name}
                      </td>
                      <td className="px-5 py-3.5 text-sm text-slate-500">{project.partner}</td>
                      <td className="whitespace-nowrap px-5 py-3.5">
                        <StatusBadge status={project.status} />
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-sm tabular-nums text-slate-700">
                        {formatCurrency(project.value)}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-sm font-medium tabular-nums text-emerald-600">
                        {formatCurrency(project.paidAmount || 0)}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <ProgressBar value={progress} className="w-24" />
                          <span className="text-xs font-medium text-slate-500">{progress}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <p className="px-5 pb-3 text-xs text-slate-400 sm:hidden">
          Geser tabel ke samping untuk melihat kolom lainnya.
        </p>
      </Card>
      </>
      )}
      </>
      )}
    </div>
  );
};

export default Reports;
