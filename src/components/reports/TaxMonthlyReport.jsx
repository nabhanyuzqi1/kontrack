// src/components/reports/TaxMonthlyReport.jsx
// Rekap pajak 12 bulan penuh: PPN keluaran (fokus utama) vs setoran PPN,
// PPh dipotong mitra sebagai informasi, dan penanda masa lapor SPT bulanan.
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

  const now = new Date();
  const nowYear = now.getFullYear();
  const nowMonth = now.getMonth() + 1; // 1-12
  // Masa lapor SPT bulanan yang sedang berjalan: bulan berjalan untuk tahun berjalan.
  // Tahun lampau: masa terakhir (Desember) yang dilaporkan; tahun mendatang: belum ada.
  const activeMonth = year === nowYear ? nowMonth : year < nowYear ? 12 : null;

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
          label="PPN Keluaran"
          value={formatCurrency(total.ppnTerhutang)}
          sub={`${total.invoiceCount} faktur ${year}`}
        />
        <StatCard
          tone="violet"
          label="Omzet (DPP)"
          value={formatCurrency(total.dpp)}
          sub="Dasar pengenaan PPN"
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
          <TaxMonthlyChart rows={rows} activeMonth={activeMonth} />
        </div>
      </Card>

      <Card>
        <CardHeader title={`PPN Keluaran Bulanan ${year}`} />
        <div className="custom-scrollbar overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-slate-50/70">
              <tr>
                <Th>Masa</Th>
                <Th className="text-right">Faktur</Th>
                <Th className="text-right">DPP</Th>
                <Th className="text-right">PPN Keluaran</Th>
                <Th className="text-right">PPN Disetor</Th>
                <Th className="text-right">Selisih</Th>
                <Th>Tenggat Setor</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/60">
              {rows.map((r) => {
                const diff = r.ppnTerhutang - r.ppnDisetor;
                const empty = r.invoiceCount === 0 && r.ppnDisetor === 0;
                const isActive = activeMonth === r.month;
                // Bulan tanpa aktivitas tidak diberi status tenggat: "Lunas" untuk
                // bulan yang belum terjadi akan menyesatkan. Bulan nihil tetap
                // ditampilkan karena SPT masa tetap wajib dilaporkan.
                // taxDueStatus menerima month 1-12 (lihat utils/reportCalc).
                const due = empty ? null : taxDueStatus(year, r.month, diff);
                return (
                  <tr
                    key={r.month}
                    className={
                      isActive
                        ? 'bg-brand-50/40 hover:bg-brand-50/60'
                        : empty
                          ? 'text-slate-400'
                          : 'hover:bg-slate-50/60'
                    }
                  >
                    <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-slate-700">
                      <span className="inline-flex items-center gap-2">
                        {r.label}
                        {isActive && <Badge tone="blue">Masa berjalan</Badge>}
                      </span>
                    </td>
                    <td className="tnum px-4 py-3 text-right text-sm text-slate-500">
                      {r.invoiceCount || '0'}
                    </td>
                    <td className="tnum px-4 py-3 text-right text-sm text-slate-600">
                      {r.dpp ? formatCurrency(r.dpp) : '—'}
                    </td>
                    <td className="tnum px-4 py-3 text-right text-sm font-medium text-slate-800">
                      {r.ppnTerhutang ? formatCurrency(r.ppnTerhutang) : '—'}
                    </td>
                    <td className="tnum px-4 py-3 text-right text-sm text-emerald-600">
                      {r.ppnDisetor ? formatCurrency(r.ppnDisetor) : '—'}
                    </td>
                    <td
                      className={`tnum px-4 py-3 text-right text-sm font-medium ${
                        diff > 0 ? 'text-amber-600' : diff < 0 ? 'text-slate-400' : 'text-slate-300'
                      }`}
                    >
                      {diff !== 0 ? formatCurrency(diff) : '—'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-500">
                      {formatDate(new Date(year, r.month, 0, 23, 59, 59, 999))}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm">
                      {due ? (
                        <div className="flex flex-col items-start gap-1">
                          <Badge tone={DUE_TONE[due.state]}>{due.label}</Badge>
                          {isActive && (
                            <span className="text-[11px] text-brand-700">Lapor SPT masa</span>
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-col items-start gap-1">
                          {/* Masa nihil tetap wajib dilaporkan (SPT masa PPN nihil). */}
                          <span className="text-xs text-slate-500">Nihil</span>
                          {isActive && (
                            <span className="text-[11px] text-brand-700">Lapor SPT masa</span>
                          )}
                        </div>
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
                <td
                  className={`tnum px-4 py-3 text-right text-sm ${
                    selisih > 0 ? 'text-amber-600' : 'text-slate-400'
                  }`}
                >
                  {formatCurrency(selisih)}
                </td>
                <td className="px-4 py-3" />
                <td className="px-4 py-3" />
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="border-t border-slate-100 px-4 py-3 text-xs text-slate-400">
          Tenggat setor PPN masa adalah akhir bulan berikutnya. Lewat tanggal itu, selisih yang
          belum disetor dikenakan sanksi bunga — karena itu bulannya ditandai, bukan hanya
          nominalnya. Bulan nihil tetap wajib dilaporkan lewat SPT masa.
        </p>
        {/* Tabel lebih lebar dari layar ponsel; tanpa petunjuk, kolom terakhir
            terbaca seolah hilang, bukan bisa digeser. */}
        <p className="px-4 pb-3 text-xs text-slate-400 sm:hidden">
          Geser tabel ke samping untuk melihat kolom lainnya.
        </p>
      </Card>

      <Card>
        <CardHeader title={`PPh Dipotong Mitra ${year}`} />
        <div className="p-4 sm:p-5">
          <div className="flex items-start gap-2.5 rounded-lg border border-slate-200 bg-slate-50/60 px-4 py-3">
            <p className="text-sm text-slate-600">
              <span className="font-semibold text-slate-800">{formatCurrency(total.pph)}</span>{' '}
              dipotong mitra dari nilai invoice sepanjang {year}. Angka ini <span className="font-semibold">bukan</span>{' '}
              kewajiban setor perusahaan: potongan PPh Pasal 4 ayat (2)/23 disetorkan oleh pemberi kerja
              sebagai pemotong. Ditampilkan sebagai informasi rekonsiliasi bukti potong, tidak ikut
              dihitung dalam selisih PPN.
            </p>
          </div>
          <div className="custom-scrollbar mt-3 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50/70">
                <tr>
                  <Th>Masa</Th>
                  <Th className="text-right">PPh Dipotong Mitra</Th>
                  <Th className="text-right">Faktur Terkait</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/60">
                {rows.map((r) => (
                  <tr key={r.month} className={r.pph ? 'hover:bg-slate-50/60' : 'text-slate-400'}>
                    <td className="whitespace-nowrap px-4 py-2.5 text-sm text-slate-700">{r.label}</td>
                    <td className="tnum px-4 py-2.5 text-right text-sm text-slate-600">
                      {r.pph ? formatCurrency(r.pph) : '—'}
                    </td>
                    <td className="tnum px-4 py-2.5 text-right text-sm text-slate-500">
                      {r.invoiceCount || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default TaxMonthlyReport;
