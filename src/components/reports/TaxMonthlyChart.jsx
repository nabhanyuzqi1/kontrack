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

const TaxMonthlyChart = ({ rows }) => {
  const data = {
    labels: rows.map((r) => r.label),
    datasets: [
      {
        label: 'PPN terhutang',
        data: rows.map((r) => r.ppnTerhutang),
        backgroundColor: 'rgba(51, 88, 244, 0.85)',
        hoverBackgroundColor: '#3358f4',
        borderRadius: 6,
        maxBarThickness: 26
      },
      {
        label: 'PPN disetor',
        data: rows.map((r) => r.ppnDisetor),
        backgroundColor: 'rgba(16, 185, 129, 0.85)',
        hoverBackgroundColor: '#10b981',
        borderRadius: 6,
        maxBarThickness: 26
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    // Batang dibuat lebih rapat ke tengah label bulan: dengan dua seri, Chart.js
    // menaruh biru di kiri dan hijau di kanan tick — kalau jaraknya lebar, batang
    // terbaca seolah milik bulan sebelah.
    categoryPercentage: 0.7,
    barPercentage: 0.85,
    plugins: {
      legend: {
        position: 'bottom',
        labels: { usePointStyle: true, pointStyleWidth: 8, boxHeight: 8, padding: 16 }
      },
      tooltip: {
        backgroundColor: '#0b1220',
        padding: 12,
        cornerRadius: 10,
        callbacks: {
          label: (context) => `${context.dataset.label}: ${formatCurrency(context.parsed.y)}`
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(148, 163, 184, 0.12)' },
        border: { display: false },
        ticks: { callback: (value) => formatCompact(value) }
      },
      x: { grid: { display: false }, border: { display: false } }
    }
  };

  return (
    <div className="chart-container">
      <Bar data={data} options={options} />
    </div>
  );
};

export default TaxMonthlyChart;
