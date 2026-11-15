// src/components/reports/ReportCharts.jsx
import React, { useEffect, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Tooltip,
  Legend
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import { getMonthYearLabel } from '../../utils/formatters';
import { Card, CardHeader } from '../ui/Card';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Tooltip, Legend);

// Token CSS dibaca dari <html>: preset brand diganti runtime (inline style),
// dan mode gelap meng-remap skala slate/status, jadi warna hex tetap akan salah.
const cssToken = (name, fallback) => {
  if (typeof window === 'undefined') return fallback;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if (!raw) return fallback;
  const parts = raw.split(/\s+/).map(Number);
  return parts.length === 3 && parts.every((n) => !isNaN(n)) ? `rgb(${parts[0]}, ${parts[1]}, ${parts[2]})` : fallback;
};

// Sumbu Y ringkas: juta/miliar. Tanda minus ditaruh sebelum "Rp" supaya
// "-Rp2,5 M" terbaca, bukan "Rp-2,5 M".
const axisRupiah = (value) => {
  const n = Number(value) || 0;
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1e9) return `${sign}Rp${(abs / 1e9).toLocaleString('id-ID', { maximumFractionDigits: 1 })} M`;
  if (abs >= 1e6) return `${sign}Rp${(abs / 1e6).toLocaleString('id-ID', { maximumFractionDigits: 1 })} jt`;
  if (abs >= 1e3) return `${sign}Rp${Math.round(abs / 1e3).toLocaleString('id-ID')} rb`;
  return `${sign}Rp${abs.toLocaleString('id-ID')}`;
};

// Tooltip rupiah penuh.
const fullRupiah = (value) => `Rp${(Number(value) || 0).toLocaleString('id-ID', { maximumFractionDigits: 0 })}`;

const EmptyChart = ({ label }) => (
  <p className="flex h-full items-center justify-center text-sm text-slate-400">{label}</p>
);

const ReportCharts = ({ projects, transactions, monthlyData }) => {
  const [theme, setTheme] = useState(
    () => (typeof document !== 'undefined' ? document.documentElement.getAttribute('data-theme') || 'light' : 'light')
  );

  useEffect(() => {
    const root = document.documentElement;
    const sync = () => setTheme(root.getAttribute('data-theme') || 'light');
    const obs = new MutationObserver(sync);
    obs.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);

  const dark = theme === 'dark';
  // Mode gelap memakai slate-600 (186 196 210): slate-500 masih pudar untuk
  // teks 11px di atas #181A1F.
  const tickColor = dark ? 'rgb(186, 196, 210)' : 'rgb(100, 116, 139)';
  const legendColor = dark ? 'rgb(214, 221, 232)' : 'rgb(71, 85, 105)';
  const gridColor = dark ? 'rgba(148, 163, 184, 0.16)' : 'rgba(100, 116, 139, 0.16)';
  const surfaceColor = dark ? '#1c1f25' : '#ffffff';

  const PALETTE = {
    brand: cssToken('--brand-500', 'rgb(59, 108, 245)'),
    cyan: cssToken('--cyan-500', 'rgb(6, 182, 212)'),
    emerald: cssToken('--emerald-500', 'rgb(16, 185, 129)'),
    red: cssToken('--red-500', 'rgb(239, 68, 68)'),
    amber: cssToken('--amber-500', 'rgb(245, 158, 11)'),
    violet: cssToken('--violet-500', 'rgb(139, 92, 246)'),
    slate: cssToken('--slate-400', 'rgb(148, 163, 184)')
  };

  const expenseByCategory = {};
  transactions
    .filter((t) => t.type === 'expense')
    .forEach((t) => {
      expenseByCategory[t.category] = (expenseByCategory[t.category] || 0) + t.amount;
    });

  const projectsByPartner = {};
  projects.forEach((p) => {
    if (!projectsByPartner[p.partner]) {
      projectsByPartner[p.partner] = { count: 0, value: 0 };
    }
    projectsByPartner[p.partner].count += 1;
    projectsByPartner[p.partner].value += p.value;
  });

  const sortedPartners = Object.entries(projectsByPartner)
    .sort((a, b) => b[1].value - a[1].value)
    .slice(0, 10);

  const months = Object.keys(monthlyData).sort();
  const monthLabels = months.map((m) => getMonthYearLabel(m + '-01'));

  const expenseCategoryData = {
    labels: Object.keys(expenseByCategory),
    datasets: [
      {
        data: Object.values(expenseByCategory),
        // Warna solid; batas antar-segmen memakai warna permukaan kartu supaya
        // cincin tetap terpisah di mode gelap (border putih akan "berlubang").
        backgroundColor: [
          PALETTE.brand,
          PALETTE.cyan,
          PALETTE.amber,
          PALETTE.violet,
          PALETTE.emerald,
          PALETTE.slate
        ],
        borderWidth: 2,
        borderColor: surfaceColor,
        hoverOffset: 4
      }
    ]
  };

  const partnerData = {
    labels: sortedPartners.map(([partner]) => partner),
    datasets: [
      {
        label: 'Nilai Proyek',
        data: sortedPartners.map(([, data]) => data.value),
        backgroundColor: PALETTE.brand,
        hoverBackgroundColor: PALETTE.brand,
        borderRadius: 4,
        maxBarThickness: 28
      }
    ]
  };

  const monthlyTrendData = {
    labels: monthLabels,
    datasets: [
      {
        label: 'Pemasukan',
        data: months.map((m) => monthlyData[m].income),
        borderColor: PALETTE.emerald,
        backgroundColor: PALETTE.emerald,
        pointBackgroundColor: PALETTE.emerald,
        pointRadius: 3,
        borderWidth: 2,
        tension: 0.3,
        fill: false
      },
      {
        label: 'Pengeluaran',
        data: months.map((m) => monthlyData[m].expense),
        borderColor: PALETTE.red,
        backgroundColor: PALETTE.red,
        pointBackgroundColor: PALETTE.red,
        pointRadius: 3,
        borderWidth: 2,
        tension: 0.3,
        fill: false
      }
    ]
  };

  const baseOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        position: 'bottom',
        labels: { usePointStyle: true, pointStyleWidth: 8, boxHeight: 8, padding: 16, color: legendColor }
      },
      tooltip: {
        backgroundColor: dark ? '#1c1f25' : '#0b1220',
        titleColor: dark ? 'rgb(248, 250, 252)' : '#e2e8f0',
        bodyColor: dark ? 'rgb(203, 213, 225)' : '#cbd5e1',
        padding: 10,
        cornerRadius: 8,
        titleFont: { weight: '600' },
        callbacks: {
          label: (context) => {
            const value = context.parsed.y ?? context.parsed;
            const label = context.dataset.label || '';
            return value === null || value === undefined ? label : `${label ? `${label}: ` : ''}${fullRupiah(value)}`;
          }
        }
      }
    }
  };

  const cartesianScales = {
    y: {
      beginAtZero: true,
      grid: { color: gridColor, drawTicks: false },
      border: { display: false },
      ticks: { callback: (value) => axisRupiah(value), color: tickColor, maxTicksLimit: 6 }
    },
    x: {
      grid: { display: false },
      border: { display: false },
      ticks: { color: tickColor }
    }
  };

  const lineChartOptions = { ...baseOptions, scales: cartesianScales };

  const barChartOptions = {
    ...baseOptions,
    interaction: { mode: 'nearest', intersect: true },
    scales: {
      ...cartesianScales,
      x: {
        ...cartesianScales.x,
        ticks: {
          color: tickColor,
          callback(label) {
            const text = String(this.getLabelForValue(label) ?? '');
            return text.length > 14 ? `${text.slice(0, 13)}…` : text;
          }
        }
      }
    }
  };

  const doughnutOptions = {
    ...baseOptions,
    cutout: '62%',
    interaction: { mode: 'nearest', intersect: true },
    plugins: {
      ...baseOptions.plugins,
      tooltip: {
        ...baseOptions.plugins.tooltip,
        callbacks: {
          label: (context) => {
            const label = context.label || '';
            const value = fullRupiah(context.parsed);
            const total = context.dataset.data.reduce((a, b) => a + b, 0);
            const percentage = total > 0 ? ((context.parsed / total) * 100).toFixed(1) : '0.0';
            return `${label}: ${value} (${percentage}%)`;
          }
        }
      }
    }
  };

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <Card>
        <CardHeader title="Distribusi Pengeluaran" />
        <div className="p-4 sm:p-5">
          <div className="chart-container">
            {Object.keys(expenseByCategory).length > 0 ? (
              <Doughnut data={expenseCategoryData} options={doughnutOptions} />
            ) : (
              <EmptyChart label="Belum ada data pengeluaran" />
            )}
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Top 10 Mitra (Nilai Proyek)" />
        <div className="p-4 sm:p-5">
          <div className="chart-container">
            {sortedPartners.length > 0 ? (
              <Bar data={partnerData} options={barChartOptions} />
            ) : (
              <EmptyChart label="Belum ada data proyek" />
            )}
          </div>
        </div>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader title="Tren Bulanan" />
        <div className="p-4 sm:p-5">
          <div className="chart-container" style={{ height: '320px' }}>
            {months.length > 0 ? (
              <Line data={monthlyTrendData} options={lineChartOptions} />
            ) : (
              <EmptyChart label="Belum ada data transaksi" />
            )}
          </div>
        </div>
      </Card>
    </div>
  );
};

export default ReportCharts;
