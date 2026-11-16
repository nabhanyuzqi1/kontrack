// src/components/projects/ProjectPlanningPanel.jsx
//
// Panel perencanaan proyek: RAB vs realisasi, termin & kurva-S, retensi, dan
// margin. Semua angka berasal dari utils/projectPlanning.js — panel ini hanya
// menyajikan, tidak menghitung ulang (supaya tidak ada dua rumus berbeda).
import React, { useMemo } from 'react';
import { Target, CalendarClock, ShieldCheck, TrendingUp, AlertTriangle, ArrowRight } from 'lucide-react';
import { Card } from '../ui/Card';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { budgetVsActual, terminCurve, retentionStatus, projectMargin } from '../../utils/projectPlanning';

const pctLabel = (p) => (p == null ? '—' : `${p.toFixed(0)}%`);

// Batang serapan: warna solid sesuai status, bukan gradasi.
const Bar = ({ pct, over }) => {
  const width = Math.max(0, Math.min(100, pct ?? 0));
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-500/15">
      <div
        className={`h-full rounded-full ${over ? 'bg-red-500' : width >= 80 ? 'bg-amber-500' : 'bg-emerald-500'}`}
        style={{ width: `${width}%` }}
      />
    </div>
  );
};

const Row = ({ label, value, tone = 'default' }) => (
  <div className="flex items-baseline justify-between gap-3 py-1">
    <span className="text-[12px] text-slate-500">{label}</span>
    <span
      className={`tnum text-[13px] font-semibold ${
        tone === 'bad' ? 'text-red-700' : tone === 'good' ? 'text-emerald-700' : 'text-slate-800'
      }`}
    >
      {value}
    </span>
  </div>
);

const Empty = ({ children }) => (
  <p className="rounded-lg bg-slate-500/5 px-3 py-2.5 text-xs text-slate-400">{children}</p>
);

const ProjectPlanningPanel = ({ project, transactions = [], invoices = [] }) => {
  const today = useMemo(() => new Date(), []);

  const rab = useMemo(
    () => budgetVsActual(project?.rab || [], transactions),
    [project?.rab, transactions]
  );

  const termin = useMemo(
    () => terminCurve(project?.terminPlan || [], invoices, today),
    [project?.terminPlan, invoices, today]
  );

  const retention = useMemo(() => retentionStatus(project || {}, today), [project, today]);

  const margin = useMemo(() => projectMargin(project || {}, transactions), [project, transactions]);

  const hasRab = (project?.rab || []).length > 0 || rab.rows.length > 0;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* RAB vs realisasi */}
      <Card className="p-4 sm:p-5">
        <div className="mb-3 flex items-start gap-2.5">
          <Target className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
          <div className="min-w-0">
            <h3 className="font-display text-sm font-semibold text-slate-800">Rencana vs Realisasi Biaya</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Anggaran per kategori dibanding pengeluaran yang benar-benar tercatat.
            </p>
          </div>
        </div>

        {!hasRab ? (
          <Empty>RAB proyek ini belum diisi. Isi anggaran per kategori di form proyek agar serapan bisa dipantau.</Empty>
        ) : (
          <>
            <div className="space-y-2.5">
              {rab.rows.slice(0, 6).map((r) => (
                <div key={r.category}>
                  <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                    <span className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[12px] font-medium text-slate-700">
                      <span className="truncate">{r.category}</span>
                      {r.unbudgeted && (
                        <span className="shrink-0 rounded bg-amber-500/15 px-1 py-0.5 text-[10px] font-semibold text-amber-800">
                          tanpa anggaran
                        </span>
                      )}
                    </span>
                    <span className="tnum shrink-0 text-[11px] text-slate-500">
                      {formatCurrency(r.actual)} / {r.budget > 0 ? formatCurrency(r.budget) : '—'}
                      {r.pct != null && (
                        <span className={`ml-1 font-semibold ${r.over ? 'text-red-700' : 'text-slate-600'}`}>
                          ({r.pct.toFixed(0)}%)
                        </span>
                      )}
                    </span>
                  </div>
                  <Bar pct={r.pct} over={r.over} />
                </div>
              ))}
            </div>
            <div className="mt-3 border-t border-slate-200/60 pt-2 dark:border-white/10">
              <Row label="Total anggaran" value={formatCurrency(rab.totals.budget)} />
              <Row label="Total realisasi" value={formatCurrency(rab.totals.actual)} />
              <Row
                label="Sisa anggaran"
                value={formatCurrency(rab.totals.remaining)}
                tone={rab.totals.remaining < 0 ? 'bad' : 'good'}
              />
              {rab.totals.overCount > 0 && (
                <p className="mt-1.5 flex items-start gap-1.5 text-[11px] text-amber-800">
                  <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                  {rab.totals.overCount} kategori melampaui anggaran.
                </p>
              )}
              {rab.totals.unbudgetedCount > 0 && (
                <p className="mt-1 flex items-start gap-1.5 text-[11px] text-slate-500">
                  <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                  {formatCurrency(rab.totals.unbudgetedActual)} pengeluaran pada{' '}
                  {rab.totals.unbudgetedCount} kategori tanpa anggaran.
                </p>
              )}
            </div>
          </>
        )}
      </Card>

      {/* Termin & kurva-S */}
      <Card className="p-4 sm:p-5">
        <div className="mb-3 flex items-start gap-2.5">
          <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
          <div className="min-w-0">
            <h3 className="font-display text-sm font-semibold text-slate-800">Termin & Kurva-S</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Rencana pencairan dibanding yang sudah masuk ke kas.
            </p>
          </div>
        </div>

        {termin.rows.length === 0 ? (
          <Empty>Belum ada rencana termin. Tambahkan jadwal termin di form proyek.</Empty>
        ) : (
          <>
            <div className="space-y-2">
              {termin.rows.map((r) => (
                <div key={r.label} className="rounded-lg px-2.5 py-2 ring-1 ring-inset ring-slate-200/70 dark:ring-white/10">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-[12px] font-medium text-slate-700">{r.label}</span>
                    <span className="tnum shrink-0 text-[11px] text-slate-500">{formatDate(r.dueDate)}</span>
                  </div>
                  <div className="mt-1 flex items-baseline justify-between gap-2">
                    <span className="tnum text-[12px] text-slate-600">
                      {formatCurrency(r.actual)} <span className="text-slate-400">dari</span> {formatCurrency(r.planned)}
                    </span>
                    {r.status === 'telat' ? (
                      <span className="shrink-0 text-[11px] font-semibold text-red-700">
                        telat {r.overdueDays} hari
                      </span>
                    ) : r.status === 'cair' ? (
                      <span className="shrink-0 text-[11px] font-semibold text-emerald-700">cair</span>
                    ) : (
                      <span className="shrink-0 text-[11px] font-medium text-slate-500">
                        {r.daysLeft != null ? `${r.daysLeft} hari lagi` : 'belum jatuh tempo'}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 border-t border-slate-200/60 pt-2 dark:border-white/10">
              <Row label="Rencana total" value={formatCurrency(termin.totals.planned)} />
              <Row label="Sudah cair" value={formatCurrency(termin.totals.actual)} tone="good" />
              <Row label="Selisih" value={formatCurrency(termin.totals.gap)} tone={termin.totals.gap > 0 ? 'bad' : 'good'} />
            </div>
          </>
        )}
      </Card>

      {/* Retensi */}
      <Card className="p-4 sm:p-5">
        <div className="mb-3 flex items-start gap-2.5">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
          <div className="min-w-0">
            <h3 className="font-display text-sm font-semibold text-slate-800">Retensi</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Bagian nilai kontrak yang ditahan sampai masa pemeliharaan berakhir.
            </p>
          </div>
        </div>

        {retention.amount <= 0 ? (
          <Empty>Proyek ini tidak menahan retensi.</Empty>
        ) : (
          <div className="space-y-1">
            <Row label="Nilai retensi" value={formatCurrency(retention.amount)} />
            <Row label="Jatuh tempo penagihan" value={retention.dueDate ? formatDate(retention.dueDate) : '—'} />
            <Row
              label="Status"
              value={
                retention.status === 'lewat'
                  ? `Lewat ${Math.abs(retention.daysLeft)} hari — siap ditagih`
                  : retention.status === 'jatuh-tempo'
                    ? 'Jatuh tempo hari ini'
                    : retention.daysLeft != null
                      ? `${retention.daysLeft} hari lagi`
                      : '—'
              }
              tone={retention.status === 'lewat' ? 'bad' : 'default'}
            />
            {retention.status === 'lewat' && (
              <p className="mt-1.5 flex items-start gap-1.5 text-[11px] text-amber-800">
                <ArrowRight className="mt-0.5 h-3 w-3 shrink-0" />
                Masa pemeliharaan sudah berakhir. Terbitkan invoice retensi.
              </p>
            )}
          </div>
        )}
      </Card>

      {/* Margin */}
      <Card className="p-4 sm:p-5">
        <div className="mb-3 flex items-start gap-2.5">
          <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
          <div className="min-w-0">
            <h3 className="font-display text-sm font-semibold text-slate-800">Margin Proyek</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Nilai kontrak dikurangi biaya langsung yang sudah tercatat.
            </p>
          </div>
        </div>
        <div className="space-y-1">
          <Row label="Nilai kontrak" value={formatCurrency(margin.revenue)} />
          <Row label="Biaya tercatat" value={formatCurrency(margin.cost)} tone="bad" />
          <Row label="Margin" value={formatCurrency(margin.margin)} tone={margin.margin >= 0 ? 'good' : 'bad'} />
          <Row label="Persentase" value={pctLabel(margin.pct)} />
        </div>
        {(margin.atRisk || margin.overBudget) && (
          <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-800">
            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
            {margin.overBudget
              ? 'Biaya sudah melampaui anggaran proyek.'
              : 'Margin tipis sementara pekerjaan belum selesai.'}
          </p>
        )}
      </Card>
    </div>
  );
};

export default ProjectPlanningPanel;
