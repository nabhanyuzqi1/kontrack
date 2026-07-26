// src/components/reports/AnnualReport.jsx
// Laporan tahunan: laba rugi, efisiensi, efektivitas, indikasi kebocoran, neraca ringkas.
import React, { useMemo } from 'react';
import { TrendingUp, Target, ShieldAlert, Scale, Info } from 'lucide-react';
import { Card, CardHeader } from '../ui/Card';
import { Badge } from '../ui/Badge';
import ProgressBar from '../ui/ProgressBar';
import { formatCurrency } from '../../utils/formatters';
import {
  incomeStatement,
  efficiencyMetrics,
  effectivenessMetrics,
  leakageIndicators,
  balanceSheet
} from '../../utils/reportCalc';

const Row = ({ label, value, tone = 'text-slate-700', bold }) => (
  <div className={`flex items-center justify-between py-1.5 ${bold ? 'font-semibold' : ''}`}>
    <span className="text-sm text-slate-500">{label}</span>
    <span className={`tnum text-sm ${tone}`}>{value}</span>
  </div>
);

const severityTone = { high: 'red', medium: 'amber', low: 'slate' };

const AnnualReport = ({ projects, transactions, invoices, year }) => {
  const pl = useMemo(() => incomeStatement(transactions, year), [transactions, year]);
  const eff = useMemo(() => efficiencyMetrics(projects, transactions, year), [projects, transactions, year]);
  const effect = useMemo(() => effectivenessMetrics(projects, invoices), [projects, invoices]);
  const leaks = useMemo(
    () => leakageIndicators(projects, transactions, invoices, year),
    [projects, transactions, invoices, year]
  );
  const bs = useMemo(() => balanceSheet(projects, transactions, invoices), [projects, transactions, invoices]);

  const topExpenses = Object.entries(pl.expenseByCategory).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-5">
      {/* Laba Rugi + Neraca */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title={`Laba Rugi ${year}`} />
          <div className="p-5">
            <Row label="Pendapatan" value={formatCurrency(pl.income)} tone="text-emerald-600" />
            <div className="my-2 border-t border-slate-100" />
            {topExpenses.length === 0 && (
              <p className="py-2 text-sm text-slate-400">Belum ada beban tercatat.</p>
            )}
            {topExpenses.map(([cat, val]) => (
              <Row key={cat} label={cat} value={`(${formatCurrency(val)})`} tone="text-slate-500" />
            ))}
            <div className="my-2 border-t border-slate-100" />
            <Row label="Total Beban" value={`(${formatCurrency(pl.expense)})`} tone="text-red-600" />
            <div className="my-2 border-t-2 border-slate-200" />
            <Row
              label="Laba Bersih"
              value={formatCurrency(pl.netProfit)}
              tone={pl.netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}
              bold
            />
            <p className="mt-1 text-xs text-slate-400">Margin {pl.margin.toFixed(1)}% · basis kas</p>
          </div>
        </Card>

        <Card>
          <CardHeader title="Neraca Ringkas" />
          <div className="p-5">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Aset</p>
            <Row label="Kas (masuk − keluar)" value={formatCurrency(bs.cash)} />
            <Row label="Piutang usaha (invoice terkirim)" value={formatCurrency(bs.receivable)} />
            <Row label="Retensi tertahan" value={formatCurrency(bs.retention)} />
            <div className="my-2 border-t border-slate-100" />
            <Row label="Total Aset" value={formatCurrency(bs.assets)} bold />

            <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Kewajiban
            </p>
            <Row
              label="Utang pajak (PPN belum setor)"
              value={formatCurrency(bs.taxPayable)}
              tone={bs.taxPayable > 0 ? 'text-amber-600' : 'text-slate-700'}
            />
            <div className="my-2 border-t-2 border-slate-200" />
            <Row label="Ekuitas" value={formatCurrency(bs.equity)} bold tone="text-brand-600" />
            <p className="mt-2 flex items-start gap-1.5 text-xs text-slate-400">
              <Info className="mt-0.5 h-3 w-3 shrink-0" />
              Ringkasan berbasis kas, bukan neraca akuntansi penuh.
            </p>
          </div>
        </Card>
      </div>

      {/* Efisiensi & Efektivitas */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Efisiensi Biaya" />
          <div className="p-5">
            <div className="mb-4 flex items-end justify-between">
              <div>
                <p className="text-xs text-slate-400">Rata-rata rasio beban</p>
                <p className="font-display text-2xl font-bold text-slate-900">
                  {eff.avgCostRatio != null ? `${(eff.avgCostRatio * 100).toFixed(0)}%` : '—'}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-brand-200" />
            </div>
            <p className="mb-3 text-xs text-slate-400">
              Beban dibanding pemasukan tiap proyek. Di bawah 100% berarti proyek surplus.
            </p>
            <div className="space-y-2.5">
              {eff.perProject.slice(0, 5).map((p) => (
                <div key={p.id}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="truncate pr-2 text-slate-600">{p.name}</span>
                    <span
                      className={`tnum shrink-0 font-medium ${
                        p.costRatio == null
                          ? 'text-slate-300'
                          : p.costRatio > 1
                            ? 'text-red-600'
                            : 'text-emerald-600'
                      }`}
                    >
                      {p.costRatio != null ? `${(p.costRatio * 100).toFixed(0)}%` : '—'}
                    </span>
                  </div>
                  <ProgressBar value={p.costRatio != null ? Math.min(p.costRatio * 100, 100) : 0} className="mt-1 h-1.5" />
                </div>
              ))}
              {eff.perProject.length === 0 && (
                <p className="text-sm text-slate-400">Belum ada data transaksi proyek.</p>
              )}
            </div>
            <p className="mt-3 flex items-start gap-1.5 text-xs text-slate-400">
              <Info className="mt-0.5 h-3 w-3 shrink-0" />
              Dihitung dari transaksi tercatat, belum dibandingkan dengan RAB/anggaran.
            </p>
          </div>
        </Card>

        <Card>
          <CardHeader title="Efektivitas" />
          <div className="p-5 space-y-4">
            <div>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="text-slate-500">Tingkat penagihan</span>
                <span className="tnum font-semibold text-slate-800">
                  {effect.collectionRate.toFixed(1)}%
                </span>
              </div>
              <ProgressBar value={effect.collectionRate} />
              <p className="mt-1 text-xs text-slate-400">
                {formatCurrency(effect.totalPaid)} dari {formatCurrency(effect.totalValue)}
              </p>
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="text-slate-500">Invoice terbayar</span>
                <span className="tnum font-semibold text-slate-800">
                  {effect.invoicePaidRate.toFixed(0)}%
                </span>
              </div>
              <ProgressBar value={effect.invoicePaidRate} />
              <p className="mt-1 text-xs text-slate-400">
                Belum tertagih {formatCurrency(effect.invoiceUnpaidValue)}
              </p>
            </div>

            <div className="flex items-center gap-4 rounded-lg bg-slate-50 p-3">
              <Target className="h-5 w-5 shrink-0 text-brand-500" />
              <div className="text-sm">
                <p className="text-slate-600">
                  <span className="font-semibold text-slate-800">{effect.finishedCount}</span> proyek
                  selesai
                  {effect.onTimeRate != null && (
                    <>
                      {' · '}
                      <span className="font-semibold text-emerald-600">
                        {effect.onTimeRate.toFixed(0)}%
                      </span>{' '}
                      tepat waktu
                    </>
                  )}
                </p>
                <p className="text-xs text-slate-400">Sisa tagihan {formatCurrency(effect.outstanding)}</p>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Kebocoran dana */}
      <Card>
        <CardHeader
          title="Indikasi Kebocoran Dana"
          action={
            <Badge tone={leaks.length === 0 ? 'emerald' : 'amber'}>
              {leaks.length === 0 ? 'Tidak ada temuan' : `${leaks.length} temuan`}
            </Badge>
          }
        />
        <div className="p-5">
          {leaks.length === 0 ? (
            <p className="text-sm text-slate-500">
              Tidak ditemukan indikasi yang perlu diperiksa untuk periode ini.
            </p>
          ) : (
            <div className="space-y-3">
              {leaks.map((f, i) => (
                <div
                  key={i}
                  className={`rounded-xl border p-4 ${
                    f.severity === 'high'
                      ? 'border-red-200 bg-red-50/50'
                      : 'border-amber-200 bg-amber-50/50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <ShieldAlert
                        className={`mt-0.5 h-4 w-4 shrink-0 ${
                          f.severity === 'high' ? 'text-red-600' : 'text-amber-600'
                        }`}
                      />
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{f.title}</p>
                        <p className="mt-0.5 text-xs text-slate-500">{f.reason}</p>
                        <p className="mt-1 text-xs font-medium text-slate-600">→ {f.action}</p>
                        {f.items && (
                          <p className="mt-1 text-xs text-slate-400">{f.items.join(' · ')}</p>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <Badge tone={severityTone[f.severity]}>{f.count}×</Badge>
                      <p className="tnum mt-1 text-sm font-semibold text-slate-700">
                        {formatCurrency(f.value)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
              <p className="flex items-start gap-1.5 pt-1 text-xs text-slate-400">
                <Info className="mt-0.5 h-3 w-3 shrink-0" />
                Ini indikasi untuk diperiksa, bukan kesimpulan adanya penyimpangan.
              </p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default AnnualReport;
