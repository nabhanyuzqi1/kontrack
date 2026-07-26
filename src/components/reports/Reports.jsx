// src/components/reports/Reports.jsx
import React, { useState, useEffect } from 'react';
import { FileDown, FileSpreadsheet, FilterX, BarChart3, Landmark, CalendarRange } from 'lucide-react';
import TaxMonthlyReport from './TaxMonthlyReport';
import AnnualReport from './AnnualReport';
import { getAllInvoices } from '../../services/invoices';
import { availableYears } from '../../utils/reportCalc';
import { getAllProjects } from '../../services/projects';
import { getAllTransactions } from '../../services/transactions';
import ReportCharts from './ReportCharts';
import { formatCurrency, getStatusLabel, calculateProjectProgress } from '../../utils/formatters';
import { PROJECT_STATUS } from '../../utils/constants';
import { generateFullReportPDF, generateTransactionReport } from '../../utils/pdfGenerator';
import PageHeader from '../ui/PageHeader';
import Button from '../ui/Button';
import { Card, CardHeader } from '../ui/Card';
import { Field, Input, Select } from '../ui/Field';
import { StatusBadge } from '../ui/Badge';
import ProgressBar from '../ui/ProgressBar';
import { SkeletonListPage } from '../ui/Skeleton';

const Th = ({ children, className = '' }) => (
  <th
    className={`whitespace-nowrap px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400 ${className}`}
  >
    {children}
  </th>
);

const REPORT_TABS = [
  { key: 'summary', label: 'Ringkasan', icon: BarChart3 },
  { key: 'tax', label: 'Pajak Bulanan', icon: Landmark },
  { key: 'annual', label: 'Analisis Tahunan', icon: CalendarRange }
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
    totalIncome: 0,
    totalExpense: 0,
    totalProfit: 0,
    projectsByStatus: {},
    monthlyData: {},
    margin: 0
  });
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });

  useEffect(() => {
    loadReportData();
  }, []);

  const loadReportData = async () => {
    setLoading(true);
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
    let filteredTransactions = transactionList;
    if (dateRange.startDate && dateRange.endDate) {
      filteredTransactions = transactionList.filter((t) => {
        const transDate = new Date(t.date);
        const start = new Date(dateRange.startDate);
        const end = new Date(dateRange.endDate);
        end.setHours(23, 59, 59, 999);
        return transDate >= start && transDate <= end;
      });
    }

    const totalProjects = projectList.length;
    const totalValue = projectList.reduce((sum, p) => sum + (p.value || 0), 0);
    const totalPaid = projectList.reduce((sum, p) => sum + (p.paidAmount || 0), 0);
    const totalTax = projectList.reduce((sum, p) => sum + ((p.value * p.taxRate) / 100 || 0), 0);

    const totalIncome = filteredTransactions
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + (t.amount || 0), 0);

    const totalExpense = filteredTransactions
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + (t.amount || 0), 0);

    const totalProfit = totalIncome - totalExpense;
    const margin = totalIncome > 0 ? ((totalProfit / totalIncome) * 100).toFixed(1) : 0;

    const projectsByStatus = {};
    Object.values(PROJECT_STATUS).forEach((status) => {
      projectsByStatus[status] = {
        count: projectList.filter((p) => p.status === status).length,
        value: projectList
          .filter((p) => p.status === status)
          .reduce((sum, p) => sum + (p.value || 0), 0)
      };
    });

    const monthlyData = {};
    filteredTransactions.forEach((t) => {
      const month = new Date(t.date).toISOString().slice(0, 7);
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
      totalIncome,
      totalExpense,
      totalProfit,
      margin,
      projectsByStatus,
      monthlyData
    });
  };

  const handleDateRangeChange = (e) => {
    const { name, value } = e.target;
    setDateRange((prev) => ({ ...prev, [name]: value }));
  };

  useEffect(() => {
    if (projects.length > 0 && transactions.length > 0) {
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
          {REPORT_TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-all ${
                tab === key
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-slate-50'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
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
      {/* Filter rentang tanggal */}
      <Card className="mb-6 p-4">
        <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-3">
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
            <Button variant="secondary" onClick={clearDateRange}>
              <FilterX className="h-4 w-4" />
              Reset Filter
            </Button>
          </div>
        </div>
      </Card>

      {/* Kartu ringkasan */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:mb-8 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        <Card className="p-5">
          <p className="text-sm font-medium text-slate-500">Total Nilai Proyek</p>
          <p className="mt-1.5 font-display text-2xl font-bold tracking-tight text-slate-900">
            {formatCurrency(stats.totalValue)}
          </p>
          <p className="mt-1 text-xs text-slate-400">Dari {stats.totalProjects} proyek</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm font-medium text-slate-500">Total Terbayar</p>
          <p className="mt-1.5 font-display text-2xl font-bold tracking-tight text-emerald-600">
            {formatCurrency(stats.totalPaid)}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            {stats.totalValue > 0 ? Math.round((stats.totalPaid / stats.totalValue) * 100) : 0}% dari
            total nilai
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-sm font-medium text-slate-500">Total Pengeluaran</p>
          <p className="mt-1.5 font-display text-2xl font-bold tracking-tight text-red-600">
            {formatCurrency(stats.totalExpense)}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Dari {transactions.filter((t) => t.type === 'expense').length} transaksi
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-sm font-medium text-slate-500">Keuntungan</p>
          <p className="mt-1.5 font-display text-2xl font-bold tracking-tight text-brand-600">
            {formatCurrency(stats.totalProfit)}
          </p>
          <p className="mt-1 text-xs text-slate-400">Margin {stats.margin}%</p>
        </Card>
      </div>

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
            <tbody className="divide-y divide-slate-50 bg-white">
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
      </Card>
      </>
      )}
    </div>
  );
};

export default Reports;
