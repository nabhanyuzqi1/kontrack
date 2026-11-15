// src/components/dashboard/CashflowChart.jsx
// Grafik arus kas 6 bulan terakhir — pemasukan vs pengeluaran.
// Sengaja ringkas: dashboard menjawab "bagaimana kondisi kas saya?",
// analisis mendalam ada di halaman Laporan.
import React, { useMemo, useState, useEffect } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Tooltip,
  Legend
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';
import { Card, CardHeader } from '../ui/Card';
import { formatCurrency } from '../../utils/formatters';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Legend);

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

// Token CSS dibaca dari <html> supaya grafik ikut preset brand & mode.
const cssToken = (name, fallback) => {
  if (typeof window === 'undefined') return fallback;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if (!raw) return fallback;
  const parts = raw.split(/\s+/).map(Number);
  return parts.length === 3 && parts.every((n) => !isNaN(n)) ? `rgb(${parts[0]}, ${parts[1]}, ${parts[2]})` : fallback;
};

// Sumbu Y ringkas: juta/miliar.
const axisRupiah = (value) => {
  const n = Number(value) || 0;
  const abs = Math.abs(n);
  if (abs >= 1e9) return `Rp${(n / 1e9).toLocaleString('id-ID', { maximumFractionDigits: 1 })} M`;
  if (abs >= 1e6) return `Rp${(n / 1e6).toLocaleString('id-ID', { maximumFractionDigits: 1 })} jt`;
  if (abs >= 1e3) return `Rp${Math.round(n / 1e3).toLocaleString('id-ID')} rb`;
  return `Rp${n.toLocaleString('id-ID')}`;
};

// Tooltip rupiah penuh.
const fullRupiah = (value) => `Rp${(Number(value) || 0).toLocaleString('id-ID', { maximumFractionDigits: 0 })}`;

const CashflowChart = ({ transactions = [], months = 6 }) => {
  const [mode, setMode] = useState('line');
  const [theme, setTheme] = useState(
    () => (typeof document !== 'undefined' ? document.documentElement.getAttribute('data-theme') || 'light' : 'light')
  );

  // Pantau mode terang/gelap: warna teks & grid harus berubah agar tetap terbaca.
  useEffect(() => {
    const root = document.documentElement;
    const sync = () => setTheme(root.getAttribute('data-theme') || 'light');
    const obs = new MutationObserver(sync);
    obs.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);

  const dark = theme === 'dark';
  // Label sumbu/mode gelap memakai slate-600 (186 196 210): slate-500 masih
  // terasa pudar pada teks 11px di atas #181A1F.
  const tickColor = dark ? 'rgb(186, 196, 210)' : 'rgb(100, 116, 139)';
  const legendColor = dark ? 'rgb(214, 221, 232)' : 'rgb(71, 85, 105)';
  const gridColor = dark ? 'rgba(148, 163, 184, 0.16)' : 'rgba(100, 116, 139, 0.16)';

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

  // Warna solid dari token (tanpa gradasi). fill:false supaya tidak ada
  // bidang ber-gradasi di bawah garis.
  const emerald = cssToken('--emerald-500', 'rgb(16, 185, 129)');
  const red = cssToken('--red-500', 'rgb(239, 68, 68)');

  const data = {
    labels,
    datasets:
      mode === 'line'
        ? [
            {
              label: 'Pemasukan',
              data: income,
              borderColor: emerald,
              backgroundColor: emerald,
              pointRadius: 3,
              pointBackgroundColor: emerald,
              borderWidth: 2,
              tension: 0.3,
              fill: false
            },
            {
              label: 'Pengeluaran',
              data: expense,
              borderColor: red,
              backgroundColor: red,
              pointRadius: 3,
              pointBackgroundColor: red,
              borderWidth: 2,
              tension: 0.3,
              fill: false
            }
          ]
        : [
            {
              label: 'Pemasukan',
              data: income,
              backgroundColor: emerald,
              borderRadius: 4,
              maxBarThickness: 24
            },
            {
              label: 'Pengeluaran',
              data: expense,
              backgroundColor: red,
              borderRadius: 4,
              maxBarThickness: 24
            }
          ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        position: 'bottom',
        labels: { usePointStyle: true, pointStyleWidth: 8, boxHeight: 8, padding: 14, color: legendColor }
      },
      tooltip: {
        backgroundColor: dark ? '#1c1f25' : '#0b1220',
        titleColor: dark ? 'rgb(248, 250, 252)' : '#e2e8f0',
        bodyColor: dark ? 'rgb(203, 213, 225)' : '#cbd5e1',
        padding: 10,
        cornerRadius: 8,
        callbacks: {
          label: (ctx) => `${ctx.dataset.label}: ${fullRupiah(ctx.parsed.y)}`
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: gridColor, drawTicks: false },
        border: { display: false },
        ticks: { callback: (v) => axisRupiah(v), font: { size: 11 }, color: tickColor, maxTicksLimit: 6 }
      },
      x: {
        grid: { display: false },
        border: { display: false },
        ticks: { font: { size: 11 }, color: tickColor }
      }
    }
  };

  return (
    <Card className="mb-6">
      <CardHeader
        title={`Arus Kas ${months} Bulan Terakhir`}
        action={
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-slate-200 p-0.5">
              {[
                ['line', 'Garis'],
                ['bar', 'Batang']
              ].map(([m, label]) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`rounded-md px-2 py-0.5 text-xs font-medium transition-colors ${
                    mode === m ? 'bg-brand-600 text-white' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <span className={`tnum text-sm font-semibold ${net >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {net >= 0 ? '+' : ''}
              {formatCurrency(net)}
            </span>
          </div>
        }
      />
      <div className="p-4 sm:p-5">
        <div style={{ height: 240 }}>
          {hasData ? (
            mode === 'line' ? <Line data={data} options={options} /> : <Bar data={data} options={options} />
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
