// src/components/dashboard/CashflowChart.jsx
// Grafik arus kas 6 bulan terakhir — pemasukan vs pengeluaran.
// Sengaja ringkas: dashboard menjawab "bagaimana kondisi kas saya?",
// analisis mendalam ada di halaman Laporan.
import React, { useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { Card, CardHeader } from '../ui/Card';
import { formatCurrency } from '../../utils/formatters';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

const compact = (v) =>
  new Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: 1 }).format(v);

const CashflowChart = ({ transactions = [], months = 6 }) => {
  const { labels, income, expense, net } = useMemo(() => {
    const buckets = [];
    const now = new Date();
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        label: MONTHS[d.getMonth()],
        income: 0,
        expense: 0
      });
    }
    const index = Object.fromEntries(buckets.map((b, i) => [b.key, i]));

    transactions.forEach((t) => {
      const raw = t.date?.seconds ? new Date(t.date.seconds * 1000) : new Date(t.date);
      if (isNaN(raw.getTime())) return;
      const key = `${raw.getFullYear()}-${String(raw.getMonth() + 1).padStart(2, '0')}`;
      const i = index[key];
      if (i === undefined) return;
      if (t.type === 'income') buckets[i].income += Number(t.amount) || 0;
      else buckets[i].expense += Number(t.amount) || 0;
    });

    const inc = buckets.map((b) => b.income);
    const exp = buckets.map((b) => b.expense);
    return {
      labels: buckets.map((b) => b.label),
      income: inc,
      expense: exp,
      net: inc.reduce((s, v) => s + v, 0) - exp.reduce((s, v) => s + v, 0)
    };
  }, [transactions, months]);

  const hasData = income.some((v) => v > 0) || expense.some((v) => v > 0);

  const data = {
    labels,
    datasets: [
      {
        label: 'Pemasukan',
        data: income,
        backgroundColor: 'rgba(16, 185, 129, 0.85)',
        borderRadius: 5,
        maxBarThickness: 26
      },
      {
        label: 'Pengeluaran',
        data: expense,
        backgroundColor: 'rgba(239, 68, 68, 0.75)',
        borderRadius: 5,
        maxBarThickness: 26
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: { usePointStyle: true, pointStyleWidth: 8, boxHeight: 8, padding: 14 }
      },
      tooltip: {
        backgroundColor: '#0b1220',
        padding: 12,
        cornerRadius: 10,
        callbacks: {
          label: (ctx) => `${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y)}`
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(148,163,184,0.12)' },
        border: { display: false },
        ticks: { callback: (v) => compact(v), font: { size: 11 } }
      },
      x: { grid: { display: false }, border: { display: false }, ticks: { font: { size: 11 } } }
    }
  };

  return (
    <Card className="mb-6">
      <CardHeader
        title={`Arus Kas ${months} Bulan Terakhir`}
        action={
          <span
            className={`tnum text-sm font-semibold ${net >= 0 ? 'text-emerald-600' : 'text-red-600'}`}
          >
            {net >= 0 ? '+' : ''}
            {formatCurrency(net)}
          </span>
        }
      />
      <div className="p-4 sm:p-5">
        <div style={{ height: 240 }}>
          {hasData ? (
            <Bar data={data} options={options} />
          ) : (
            <p className="flex h-full items-center justify-center text-sm text-slate-400">
              Belum ada transaksi pada periode ini
            </p>
          )}
        </div>
      </div>
    </Card>
  );
};

export default CashflowChart;
