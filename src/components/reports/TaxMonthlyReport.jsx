// src/components/reports/TaxMonthlyReport.jsx
// Ringkasan pajak per bulan: PPN terhutang vs disetor, PPh dipotong, tenggat setor.
import React, { useMemo } from 'react';
import { TriangleAlert, CheckCircle2, Landmark } from 'lucide-react';
import { Card, CardHeader } from '../ui/Card';
import StatCard from '../ui/StatCard';
import { Badge } from '../ui/Badge';
import EmptyState from '../ui/EmptyState';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { monthlyTaxReport, taxDueStatus } from '../../utils/reportCalc';
import TaxMonthlyChart from './TaxMonthlyChart';

const Th = ({ children, className = '' }) => (
  <th
    className={`whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400 ${className}`}
  >
    {children}
  </th>
);

// Warna tenggat: hanya bulan yang punya aktivitas pajak yang diberi status.
const DUE_TONE = { telat: 'red', jalan: 'amber', lunas: 'emerald', lebih: 'violet' };

const TaxMonthlyReport = ({ invoices, year }) => {
  const { rows, total, selisih } = useMemo(() => monthlyTaxReport(invoices, year), [invoices, year]);

  const hasData = total.invoiceCount > 0 || total.ppnDisetor > 0;

  if (!hasData) {
    return (
      <EmptyState
        icon={Landmark}
        title={`Belum ada catatan pajak untuk ${year}`}
        description="Rekap terbentuk dari invoice yang terbit pada tahun ini dan setoran PPN yang dicatat di Dokumen Pajak."
      />
    );
  }

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
        <CardHeader title={`PPN Terhutang vs Disetor ${year}`} />
        <div className="p-4 sm:p-5">
          <TaxMonthlyChart rows={rows} />
        </div>
      </Card>

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
                <Th>Status Setor</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 bg-white">
              {rows.map((r) => {
                const diff = r.ppnTerhutang - r.ppnDisetor;
                const empty = r.invoiceCount === 0 && r.ppnDisetor === 0;
                // Bulan tanpa aktivitas tidak diberi status tenggat: "Lunas" untuk
                // bulan yang belum terjadi akan menyesatkan.
                const due = empty ? null : taxDueStatus(year, r.month, diff);
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
                    <td className="whitespace-nowrap px-4 py-3 text-sm">
                      {due ? (
                        <div className="flex flex-col items-start gap-1">
                          <Badge tone={DUE_TONE[due.state]}>{due.label}</Badge>
                          {/* Tanggal tenggat ditulis apa adanya: badge "3 hari lagi"
                              tidak menjawab "kapan tepatnya" saat rapat dengan pemilik. */}
                          {due.state !== 'lunas' && (
                            <span className="text-[11px] text-slate-400">
                              {formatDate(due.due)}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
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
                <td className="px-4 py-3" />
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="border-t border-slate-100 px-4 py-3 text-xs text-slate-400">
          Tenggat setor PPN masa adalah akhir bulan berikutnya. Lewat tanggal itu, selisih yang
          belum disetor dikenakan sanksi bunga — karena itu bulannya ditandai, bukan hanya
          nominalnya.
        </p>
        {/* Tabel lebih lebar dari layar ponsel; tanpa petunjuk, kolom terakhir
            terbaca seolah hilang, bukan bisa digeser. */}
        <p className="px-4 pb-3 text-xs text-slate-400 sm:hidden">
          Geser tabel ke samping untuk melihat kolom lainnya.
        </p>
      </Card>
    </div>
  );
};

export default TaxMonthlyReport;
