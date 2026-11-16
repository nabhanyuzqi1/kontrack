import React, { useState } from 'react';
import { Grid3x3, List, CheckCircle2, Clock, AlertTriangle, FileText, ChevronDown, ChevronRight } from 'lucide-react';
import { unitProgress, unitRetentionSummary } from '../../utils/projectPlanning';

const rupiah = (n) =>
  'Rp' + (Number(n) || 0).toLocaleString('id-ID', { maximumFractionDigits: 0 });

const STATUS_STYLE = {
  cair: { cls: 'bg-emerald-500/10 text-emerald-700', label: 'Cair', Icon: CheckCircle2 },
  'jatuh-tempo': { cls: 'bg-amber-500/10 text-amber-700', label: 'Jatuh tempo', Icon: Clock },
  lewat: { cls: 'bg-red-500/10 text-red-700', label: 'Lewat', Icon: AlertTriangle },
  belum: { cls: 'bg-slate-500/10 text-slate-600', label: 'Belum jatuh tempo', Icon: Clock },
  'tanpa-bahk': { cls: 'bg-amber-500/10 text-amber-700', label: 'Selesai, BAHK belum ada', Icon: AlertTriangle }
};

/**
 * Panel unit pekerjaan: 17 unit IPAL dalam satu SPK adalah kasus normal, jadi
 * daftar unit HARUS bisa dipindai, bukan dibaca satu per satu. Karena itu ada
 * dua mode tampilan (tabel padat dan kartu), sama seperti daftar klien.
 *
 * Semua angka berasal dari utils/projectPlanning.js; panel ini tidak
 * menghitung ulang supaya tidak lahir rumus kedua.
 */
const ProjectUnitsPanel = ({ project = {}, today = new Date() }) => {
  const [view, setView] = useState('table');
  const [openId, setOpenId] = useState(null);

  const prog = unitProgress(project);
  const retention = unitRetentionSummary(project, today);

  if (!prog.unitCount) {
    return (
      <div className="glass-1 rounded-xl p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Unit Pekerjaan</h3>
        <p className="mt-2 text-sm text-slate-500">
          Proyek ini belum dipecah per unit. Buka Ubah Proyek lalu tambahkan unit bila satu SPK memuat beberapa
          pekerjaan (mis. 17 unit IPAL di lokasi berbeda).
        </p>
      </div>
    );
  }

  const stat = (label, value, sub) => (
    <div className="min-w-0">
      <p className="text-[11px] uppercase leading-tight tracking-wide text-slate-500">{label}</p>
      <p className="tnum mt-0.5 text-sm font-semibold text-slate-800">{value}</p>
      {sub && <p className="text-[11px] leading-tight text-slate-600">{sub}</p>}
    </div>
  );

  return (
    <div className="glass-1 overflow-hidden rounded-xl">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/70 px-4 py-3">
        <div className="min-w-0">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Unit Pekerjaan</h3>
          <p className="mt-0.5 text-sm text-slate-600">
            {prog.unitCount} unit · {prog.doneCount} selesai · {prog.bahkCount} ber-BAHK
          </p>
        </div>
        {/* Dua mode: tabel untuk memindai 17 baris, kartu untuk membaca detail
            di layar sempit. */}
        <div className="flex shrink-0 items-center gap-1 rounded-lg bg-slate-500/10 p-0.5">
          <button
            onClick={() => setView('table')}
            title="Tabel"
            aria-pressed={view === 'table'}
            className={`rounded-md px-2 py-1 transition-colors ${
              view === 'table' ? 'bg-glass-3 text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <List className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setView('grid')}
            title="Kartu"
            aria-pressed={view === 'grid'}
            className={`rounded-md px-2 py-1 transition-colors ${
              view === 'grid' ? 'bg-glass-3 text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Grid3x3 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Ringkasan: empat angka yang benar-benar dipakai pemilik. */}
      <div className="grid grid-cols-2 gap-3 border-b border-slate-200/70 px-4 py-3 sm:grid-cols-4">
        {stat('Progres berbobot', `${prog.weightedProgress}%`, 'menurut nilai unit')}
        {stat('Bisa ditagih', rupiah(prog.billableValue), `${prog.bahkCount} unit ber-BAHK`)}
        {stat('Belum bisa ditagih', rupiah(prog.unbilledValue), 'BAHK belum keluar')}
        {stat('Retensi ditahan', rupiah(retention.amount), `${retention.pct}% × nilai unit`)}
      </div>

      {view === 'table' ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200/70 text-left text-[11px] uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2 font-medium">Unit</th>
                <th className="px-3 py-2 font-medium">PK</th>
                <th className="px-3 py-2 text-right font-medium">Nilai</th>
                <th className="px-3 py-2 font-medium">Progres</th>
                <th className="px-3 py-2 text-right font-medium">Retensi</th>
                <th className="px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {retention.perUnit.map((r) => {
                const row = prog.rows.find((x) => x.id === r.id) || {};
                const st = STATUS_STYLE[r.status] || STATUS_STYLE.belum;
                return (
                  <tr key={r.id} className="border-b border-slate-200/50 last:border-0">
                    <td className="px-4 py-2">
                      <p className="font-medium text-slate-800">{r.name}</p>
                      {row.location && <p className="text-xs text-slate-500">{row.location}</p>}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-600">{row.pkNumber || '-'}</td>
                    <td className="tnum px-3 py-2 text-right text-slate-700">{rupiah(r.value)}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-500/15">
                          <div className="h-full rounded-full bg-brand-600" style={{ width: `${row.progress || 0}%` }} />
                        </div>
                        <span className="tnum text-xs text-slate-600">{row.progress || 0}%</span>
                      </div>
                    </td>
                    <td className="tnum px-3 py-2 text-right text-slate-700">{rupiah(r.amount)}</td>
                    <td className="px-4 py-2">
                      <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium ${st.cls}`}>
                        {st.label}
                      </span>
                      {r.dueDate && <p className="mt-0.5 text-[11px] text-slate-600">cair {r.dueDate}</p>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
          {retention.perUnit.map((r) => {
            const row = prog.rows.find((x) => x.id === r.id) || {};
            const st = STATUS_STYLE[r.status] || STATUS_STYLE.belum;
            const open = openId === r.id;
            return (
              <div key={r.id} className="rounded-lg border border-slate-200/70 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-800">{r.name}</p>
                    <p className="truncate text-xs text-slate-500">{row.location || 'Tanpa lokasi'}</p>
                  </div>
                  <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-medium ${st.cls}`}>{st.label}</span>
                </div>
                <dl className="mt-2 grid grid-cols-2 gap-1 text-xs">
                  <div><dt className="text-slate-500">Nilai</dt><dd className="tnum font-medium text-slate-700">{rupiah(r.value)}</dd></div>
                  <div><dt className="text-slate-500">Retensi</dt><dd className="tnum font-medium text-slate-700">{rupiah(r.amount)}</dd></div>
                </dl>
                <button
                  onClick={() => setOpenId(open ? null : r.id)}
                  className="mt-2 flex items-center gap-1 text-[11px] font-medium text-brand-700"
                >
                  {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                  {open ? 'Tutup' : 'BAHK & PK'}
                </button>
                {open && (
                  <div className="mt-1 space-y-0.5 border-t border-slate-200/70 pt-1 text-[11px] text-slate-600">
                    <p>PK: {row.pkNumber || '-'}</p>
                    <p>BAHK: {r.bahkNumber || '-'}</p>
                    <p>Tanggal BAHK: {r.bahkDate || '-'}</p>
                    <p>Jatuh tempo: {r.dueDate || '-'}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!retention.allDone && (
        <p className="flex items-start gap-1.5 border-t border-slate-200/70 px-4 py-2 text-[11px] text-slate-500">
          <FileText className="mt-0.5 h-3 w-3 shrink-0" />
          Retensi baru dicairkan penuh setelah semua unit selesai dan BAHK terakhir keluar.
        </p>
      )}
    </div>
  );
};

export default ProjectUnitsPanel;
