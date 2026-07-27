// src/components/ai/AIInsightCard.jsx
// Kartu analisis AI — dipakai di Dashboard & Laporan.
// Analisis dipicu manual (tombol) agar tidak memanggil AI setiap halaman dibuka.
import React, { useState } from 'react';
import {
  Sparkles,
  RefreshCw,
  TrendingUp,
  AlertTriangle,
  Lightbulb,
  CheckCircle2,
  ChevronRight
} from 'lucide-react';
import { Card } from '../ui/Card';
import Button from '../ui/Button';
import { Skeleton } from '../ui/Skeleton';
import { buildFinancialSummary, getFinancialInsight } from '../../services/aiInsights';

const healthTone = {
  baik: { ring: 'ring-emerald-200', bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Sehat' },
  'perlu-perhatian': {
    ring: 'ring-amber-200',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    label: 'Perlu Perhatian'
  },
  kritis: { ring: 'ring-red-200', bg: 'bg-red-50', text: 'text-red-700', label: 'Kritis' }
};

const typeIcon = {
  positif: { icon: TrendingUp, cls: 'text-emerald-600 bg-emerald-50' },
  risiko: { icon: AlertTriangle, cls: 'text-red-600 bg-red-50' },
  peluang: { icon: Lightbulb, cls: 'text-brand-600 bg-brand-50' }
};

const AIInsightCard = ({ projects, transactions, invoices, period = 'keseluruhan', className = '' }) => {
  const [insight, setInsight] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const run = async (force = false) => {
    setLoading(true);
    setError('');
    try {
      const summary = buildFinancialSummary({ projects, transactions, invoices, period });
      setInsight(await getFinancialInsight(summary, { force }));
    } catch (err) {
      console.error('Analisis AI gagal:', err);
      // Cloud Function mengirim penyebab yang spesifik (kredit habis, key tidak
      // valid, model pensiun). Menampilkannya apa adanya jauh lebih berguna
      // daripada "AI belum tersedia" yang menyembunyikan akar masalahnya.
      if (err?.code === 'functions/unauthenticated') {
        setError('Sesi berakhir — masuk ulang untuk memakai analisis AI.');
      } else if (err?.message && !/^internal$/i.test(err.message)) {
        setError(err.message);
      } else {
        setError('Analisis AI belum tersedia. Pastikan fungsi AI sudah aktif.');
      }
    } finally {
      setLoading(false);
    }
  };

  const tone = healthTone[insight?.health] || healthTone['perlu-perhatian'];

  return (
    <Card className={`overflow-hidden ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div className="flex items-center gap-2.5">
          <span className="rounded-lg bg-brand-gradient p-1.5 text-white">
            <Sparkles className="h-4 w-4" />
          </span>
          <div>
            <h3 className="font-display text-sm font-semibold text-slate-800">Analisis AI</h3>
            <p className="text-xs text-slate-400">Ringkasan kondisi & saran tindakan</p>
          </div>
        </div>
        {insight && (
          <button
            onClick={() => run(true)}
            disabled={loading}
            title="Analisis ulang"
            className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:opacity-40"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        )}
      </div>

      <div className="p-5">
        {/* Belum dijalankan */}
        {!insight && !loading && !error && (
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-500">
              Minta AI membaca angka Anda dan menyoroti hal yang perlu ditindaklanjuti.
            </p>
            <Button variant="gradient" size="sm" onClick={() => run()} className="shrink-0">
              <Sparkles className="h-4 w-4" />
              Analisis Sekarang
            </Button>
          </div>
        )}

        {/* Memuat */}
        {loading && (
          <div className="space-y-3">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-16 w-full rounded-lg" />
          </div>
        )}

        {/* Galat */}
        {error && !loading && (
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-amber-700">{error}</p>
            <Button variant="secondary" size="sm" onClick={() => run(true)} className="shrink-0">
              <RefreshCw className="h-4 w-4" />
              Coba Lagi
            </Button>
          </div>
        )}

        {/* Hasil */}
        {insight && !loading && (
          <div className="space-y-4">
            <div className={`rounded-xl px-4 py-3 ring-1 ring-inset ${tone.bg} ${tone.ring}`}>
              <div className="flex items-start gap-2.5">
                <span className={`mt-0.5 text-xs font-semibold uppercase tracking-wide ${tone.text}`}>
                  {tone.label}
                </span>
              </div>
              <p className="mt-1 font-display text-[15px] font-semibold leading-snug text-slate-800">
                {insight.headline}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {(insight.insights || []).map((it, i) => {
                const t = typeIcon[it.type] || typeIcon.peluang;
                const Icon = t.icon;
                return (
                  <div key={i} className="rounded-xl border border-slate-200 p-3.5">
                    <div className="flex items-start gap-2.5">
                      <span className={`shrink-0 rounded-lg p-1.5 ${t.cls}`}>
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800">{it.title}</p>
                        <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{it.detail}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {insight.actions?.length > 0 && (
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Langkah Disarankan
                </p>
                <ul className="space-y-1.5">
                  {insight.actions.map((a, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                      <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-500" />
                      {a}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <p className="text-[11px] text-slate-400">
              Dihasilkan AI dari ringkasan angka Anda — periksa sebelum mengambil keputusan.
            </p>
          </div>
        )}
      </div>
    </Card>
  );
};

export default AIInsightCard;
