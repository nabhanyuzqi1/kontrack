// src/components/reports/TaxMonthlyChart.jsx
// Grafik PPN terhutang vs disetor per bulan. Dipisah dari ReportCharts supaya
// tab Pajak tidak ikut memuat grafik laba/rugi yang tidak relevan di sana.
import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { formatCurrency } from '../../utils/formatters';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

ChartJS.defaults.font.family = "'Inter', system-ui, sans-serif";
ChartJS.defaults.color = '#64748b';

const formatCompact = (value) =>
  new Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: 1 }).format(value);

/**
 * @param {Array} rows - 12 baris bulanan dari monthlyTaxReport
 * @param {number|null} activeMonth - nomor bulan berjalan (1-12), diberi penanda
 */
const TaxMonthlyChart = ({ rows = [], activeMonth = null }) => {
  const data = {
    labels: rows.map((r) => r.label),
    datasets: [
      {
        label: 'PPN keluar',
        data: rows.map((r) => r.ppnTerhutang),
        backgroundColor: 'rgba(51, 88, 244, 0.85)',
        hoverBackgroundColor: '#3358f4',
        borderRadius: 4,
        maxBarThickness: 22
      },
      {
        label: 'PPN disetor',
        data: rows.map((r) => r.ppnDisetor),
        backgroundColor: 'rgba(16, 185, 129, 0.85)',
        hoverBackgroundColor: '#10b981',
        borderRadius: 4,
        maxBarThickness: 22
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 250 },
    // Batang dirapatkan ke tengah label bulan: dengan dua seri, Chart.js menaruh
    // seri pertama di kiri dan kedua di kanan tick — kalau jaraknya lebar,
    // batang terbaca seolah milik bulan sebelah.
    categoryPercentage: 0.65,
    barPercentage: 0.9,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          usePointStyle: true,
          pointStyle: 'rectRounded',
          pointStyleWidth: 10,
          boxHeight: 8,
          padding: 16,
          font: { size: 11 }
        }
      },
      tooltip: {
        backgroundColor: '#0b1220',
        titleColor: '#e2e8f0',
        bodyColor: '#cbd5e1',
        padding: 10,
        cornerRadius: 8,
        displayColors: true,
        callbacks: {
          title: (items) => {
            const i = items[0]?.dataIndex ?? 0;
            return activeMonth === rows[i]?.month ? `${rows[i].label} (masa berjalan)` : rows[i]?.label;
          },
          label: (context) => `${context.dataset.label}: ${formatCurrency(context.parsed.y)}`,
          afterBody: (items) => {
            const r = rows[items[0]?.dataIndex ?? 0];
            if (!r) return '';
            const diff = r.ppnTerhutang - r.ppnDisetor;
            if (!r.ppnTerhutang && !r.ppnDisetor) return 'Masa nihil';
            return diff > 0 ? `Selisih belum disetor: ${formatCurrency(diff)}` : diff < 0 ? 'Lebih setor' : 'Sudah lunas';
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(148, 163, 184, 0.12)' },
        border: { display: false },
        ticks: { callback: (value) => formatCompact(value), font: { size: 11 } }
      },
      x: {
        grid: { display: false },
        border: { display: false },
        ticks: {
          font: { size: 11 },
          color: (ctx) => (activeMonth === rows[ctx.index]?.month ? '#3358f4' : '#64748b')
        }
      }
    }
  };

  return (
    <div className="chart-container">
      <Bar data={data} options={options} />
    </div>
  );
};

export default TaxMonthlyChart;
