// src/components/reports/ReportCharts.jsx
import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import { formatCurrency, getMonthYearLabel } from '../../utils/formatters';
import { Card, CardHeader } from '../ui/Card';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

// Palet chart brand Kontrack
const PALETTE = {
  brand: '#3358f4',
  cyan: '#06b6d4',
  emerald: '#10b981',
  red: '#ef4444',
  amber: '#f59e0b',
  violet: '#8b5cf6',
  slate: '#94a3b8'
};

ChartJS.defaults.font.family = "'Inter', system-ui, sans-serif";
ChartJS.defaults.color = '#64748b';

const formatCompact = (value) =>
  new Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: 1 }).format(value);

const EmptyChart = ({ label }) => (
  <p className="flex h-full items-center justify-center text-sm text-slate-400">{label}</p>
);

const ReportCharts = ({ projects, transactions, monthlyData }) => {
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
        backgroundColor: [
          PALETTE.brand,
          PALETTE.cyan,
          PALETTE.amber,
          PALETTE.violet,
          PALETTE.emerald,
          PALETTE.slate
        ],
        borderWidth: 2,
        borderColor: '#ffffff',
        hoverOffset: 6
      }
    ]
  };

  const partnerData = {
    labels: sortedPartners.map(([partner]) => partner),
    datasets: [
      {
        label: 'Nilai Proyek',
        data: sortedPartners.map(([, data]) => data.value),
        backgroundColor: 'rgba(51, 88, 244, 0.85)',
        hoverBackgroundColor: PALETTE.brand,
        borderRadius: 6,
        maxBarThickness: 42
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
        backgroundColor: 'rgba(16, 185, 129, 0.10)',
        pointBackgroundColor: PALETTE.emerald,
        pointRadius: 3,
        borderWidth: 2,
        tension: 0.35,
        fill: true
      },
      {
        label: 'Pengeluaran',
        data: months.map((m) => monthlyData[m].expense),
        borderColor: PALETTE.red,
        backgroundColor: 'rgba(239, 68, 68, 0.08)',
        pointBackgroundColor: PALETTE.red,
        pointRadius: 3,
        borderWidth: 2,
        tension: 0.35,
        fill: true
      }
    ]
  };

  const baseOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: { usePointStyle: true, pointStyleWidth: 8, boxHeight: 8, padding: 16 }
      },
      tooltip: {
        backgroundColor: '#0b1220',
        padding: 12,
        cornerRadius: 10,
        titleFont: { weight: '600' },
        callbacks: {
          label: (context) => {
            let label = context.dataset.label || '';
            if (label) label += ': ';
            const value = context.parsed.y ?? context.parsed;
            if (value !== null && value !== undefined) {
              label += formatCurrency(value);
            }
            return label;
          }
        }
      }
    }
  };

  const cartesianScales = {
    y: {
      beginAtZero: true,
      grid: { color: 'rgba(148, 163, 184, 0.12)' },
      border: { display: false },
      ticks: { callback: (value) => formatCompact(value) }
    },
    x: {
      grid: { display: false },
      border: { display: false }
    }
  };

  const lineChartOptions = { ...baseOptions, scales: cartesianScales };

  const barChartOptions = {
    ...baseOptions,
    scales: {
      ...cartesianScales,
      x: {
        ...cartesianScales.x,
        ticks: { maxRotation: 45, minRotation: 0, autoSkip: true }
      }
    }
  };

  const doughnutOptions = {
    ...baseOptions,
    cutout: '62%',
    plugins: {
      ...baseOptions.plugins,
      tooltip: {
        ...baseOptions.plugins.tooltip,
        callbacks: {
          label: (context) => {
            const label = context.label || '';
            const value = formatCurrency(context.parsed);
            const total = context.dataset.data.reduce((a, b) => a + b, 0);
            const percentage = ((context.parsed / total) * 100).toFixed(1);
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
        <div className="p-5">
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
        <div className="p-5">
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
        <div className="p-5">
          <div className="chart-container" style={{ height: '380px' }}>
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
