// src/components/reports/TaxMonthlyReport.jsx
// Ringkasan pajak per bulan: PPN terhutang vs disetor, PPh dipotong.
import React, { useMemo } from 'react';
import { TriangleAlert, CheckCircle2 } from 'lucide-react';
import { Card, CardHeader } from '../ui/Card';
import StatCard from '../ui/StatCard';
import { formatCurrency } from '../../utils/formatters';
import { monthlyTaxReport } from '../../utils/reportCalc';

const Th = ({ children, className = '' }) => (
  <th
    className={`whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400 ${className}`}
  >
    {children}
  </th>
);

const TaxMonthlyReport = ({ invoices, year }) => {
  const { rows, total, selisih } = useMemo(() => monthlyTaxReport(invoices, year), [invoices, year]);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        <StatCard
          tone="cyan"
          label="Omzet (DPP)"
          value={formatCurrency(total.dpp)}
          sub={`${total.invoiceCount} faktur ${year}`}
        />
        <StatCard
          tone="violet"
          label="PPN Terhutang"
          value={formatCurrency(total.ppnTerhutang)}
          sub="Dipungut dari klien"
        />
        <StatCard
          tone="emerald"
          label="PPN Disetor"
          value={formatCurrency(total.ppnDisetor)}
          sub="Sudah dibayar ke kas negara"
        />
        <StatCard
          tone={selisih > 0 ? 'amber' : 'emerald'}
          label="Belum Disetor"
          value={formatCurrency(Math.max(selisih, 0))}
          sub={selisih > 0 ? 'Perlu segera disetor' : 'Semua sudah disetor'}
          subTone={selisih > 0 ? 'text-amber-600' : 'text-emerald-600'}
        />
      </div>

      {selisih > 0 ? (
        <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <p className="text-sm text-amber-800">
            Ada <span className="font-semibold">{formatCurrency(selisih)}</span> PPN yang sudah
            dipungut namun belum tercatat disetor. Lengkapi Dokumen Pajak pada invoice terkait.
          </p>
        </div>
      ) : (
        total.ppnTerhutang > 0 && (
          <div className="flex items-center gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            <p className="text-sm text-emerald-800">Seluruh PPN {year} sudah tercatat disetor.</p>
          </div>
        )
      )}

      <Card>
        <CardHeader title={`Rekap Pajak Bulanan ${year}`} />
        <div className="custom-scrollbar overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-slate-50/70">
              <tr>
                <Th>Bulan</Th>
                <Th className="text-right">Faktur</Th>
                <Th className="text-right">DPP</Th>
                <Th className="text-right">PPN Terhutang</Th>
                <Th className="text-right">PPN Disetor</Th>
                <Th className="text-right">PPh Dipotong</Th>
                <Th className="text-right">Selisih</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 bg-white">
              {rows.map((r) => {
                const diff = r.ppnTerhutang - r.ppnDisetor;
                const empty = r.invoiceCount === 0 && r.ppnDisetor === 0;
                return (
                  <tr key={r.month} className={empty ? 'text-slate-300' : 'hover:bg-slate-50/60'}>
                    <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-slate-700">
                      {r.label}
                    </td>
                    <td className="tnum px-4 py-3 text-right text-sm text-slate-500">
                      {r.invoiceCount || '—'}
                    </td>
                    <td className="tnum px-4 py-3 text-right text-sm text-slate-600">
                      {r.dpp ? formatCurrency(r.dpp) : '—'}
                    </td>
                    <td className="tnum px-4 py-3 text-right text-sm text-slate-700">
                      {r.ppnTerhutang ? formatCurrency(r.ppnTerhutang) : '—'}
                    </td>
                    <td className="tnum px-4 py-3 text-right text-sm text-emerald-600">
                      {r.ppnDisetor ? formatCurrency(r.ppnDisetor) : '—'}
                    </td>
                    <td className="tnum px-4 py-3 text-right text-sm text-slate-500">
                      {r.pph ? formatCurrency(r.pph) : '—'}
                    </td>
                    <td
                      className={`tnum px-4 py-3 text-right text-sm font-medium ${
                        diff > 0 ? 'text-amber-600' : diff < 0 ? 'text-slate-400' : 'text-slate-300'
                      }`}
                    >
                      {diff !== 0 ? formatCurrency(diff) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="border-t-2 border-slate-200 bg-slate-50/70">
              <tr className="font-semibold">
                <td className="px-4 py-3 text-sm text-slate-800">Total</td>
                <td className="tnum px-4 py-3 text-right text-sm">{total.invoiceCount}</td>
                <td className="tnum px-4 py-3 text-right text-sm">{formatCurrency(total.dpp)}</td>
                <td className="tnum px-4 py-3 text-right text-sm">
                  {formatCurrency(total.ppnTerhutang)}
                </td>
                <td className="tnum px-4 py-3 text-right text-sm text-emerald-600">
                  {formatCurrency(total.ppnDisetor)}
                </td>
                <td className="tnum px-4 py-3 text-right text-sm">{formatCurrency(total.pph)}</td>
                <td
                  className={`tnum px-4 py-3 text-right text-sm ${
                    selisih > 0 ? 'text-amber-600' : 'text-slate-400'
                  }`}
                >
                  {formatCurrency(selisih)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default TaxMonthlyReport;
