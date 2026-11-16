import React from 'react';
import { Plus, X, Copy } from 'lucide-react';

const rupiah = (n) => 'Rp' + (Number(n) || 0).toLocaleString('id-ID', { maximumFractionDigits: 0 });

const Field = ({ label, children, hint }) => (
  <label className="block min-w-0">
    <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</span>
    {children}
    {hint && <span className="mt-0.5 block text-[11px] text-slate-500">{hint}</span>}
  </label>
);

const inputCls =
  'field-surface h-10 w-full rounded-lg border border-slate-200/70 px-2.5 text-sm text-slate-800 outline-none focus:border-brand-500';

/**
 * Daftar unit pekerjaan di dalam form proyek.
 *
 * Kenapa tiap unit punya BAHK sendiri: mitra menerbitkan BAHK per unit (atau
 * per kelompok unit di satu lokasi), bukan per SPK. Retensi lahir dari BAHK
 * unit itu, jadi tanggal BAHK disimpan di tingkat unit, dan formulir ini
 * menampilkan nilai retensi tiap unit secara langsung supaya bisa dicocokkan
 * dengan dokumen mitra.
 */
const UnitsEditor = ({ rows, setRows, retentionPct = 0 }) => {
  const pct = Number(retentionPct) || 0;
  const total = rows.reduce((a, r) => a + (Number(r.value) || 0), 0);

  const update = (idx, patch) => {
    const next = [...rows];
    next[idx] = { ...next[idx], ...patch };
    // Progres 100 atau status selesai membuat unit dianggap selesai; keduanya
    // diselaraskan di sini agar data tidak saling bertentangan saat disimpan.
    if (patch.progress !== undefined && Number(patch.progress) >= 100) next[idx].status = 'selesai';
    if (patch.status === 'selesai') next[idx].progress = 100;
    setRows(next);
  };

  const add = () =>
    setRows([
      ...rows,
      { id: '', name: '', location: '', value: '', pkNumber: '', progress: 0, status: 'belum', bahkNumber: '', bahkDate: '' }
    ]);

  // "17 unit IPAL di lokasi berbeda": menambah satu-satu melelahkan, jadi
  // sediakan pengganda yang menyalin baris terakhir menjadi N baris bernomor.
  const duplicateLast = () => {
    const last = rows[rows.length - 1];
    if (!last) return;
    const extra = [];
    for (let i = 1; i <= 4; i++) {
      extra.push({ ...last, id: '', name: last.name ? `${last.name.replace(/\s*\d+$/, '')} ${i + 1}` : '', bahkNumber: '', bahkDate: '', progress: 0, status: 'belum' });
    }
    setRows([...rows, ...extra]);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <p className="text-xs text-slate-500">
          Satu SPK boleh memuat banyak unit. PK boleh sama untuk unit yang satu lokasi, atau berbeda tiap unit. Retensi
          dihitung per unit dari tanggal BAHK unit itu.
        </p>
        <div className="flex shrink-0 gap-2">
          {rows.length > 0 && (
            <button
              type="button"
              onClick={duplicateLast}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200/70 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-500/10"
            >
              <Copy className="h-3.5 w-3.5" />
              Salin 4 baris
            </button>
          )}
          <button
            type="button"
            onClick={add}
            className="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-brand-700"
          >
            <Plus className="h-3.5 w-3.5" />
            Tambah Unit
          </button>
        </div>
      </div>

      {rows.length === 0 && (
        <p className="rounded-lg border border-dashed border-slate-300/70 px-3 py-4 text-center text-xs text-slate-500">
          Belum ada unit. Proyek satu unit bisa dibiarkan kosong dan memakai nilai proyek sebagai retensi.
        </p>
      )}

      {rows.map((row, idx) => {
        const value = Number(row.value) || 0;
        const retention = (value * pct) / 100;
        return (
          <div key={idx} className="rounded-lg border border-slate-200/70 p-2.5">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Unit {idx + 1}</span>
              <button
                type="button"
                onClick={() => setRows(rows.filter((_, i) => i !== idx))}
                className="rounded p-1 text-slate-400 hover:bg-red-500/10 hover:text-red-600"
                aria-label={`Hapus unit ${idx + 1}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
              <Field label="Nama unit">
                <input className={inputCls} value={row.name || ''} onChange={(e) => update(idx, { name: e.target.value })} placeholder="cth. IPAL Unit 1" />
              </Field>
              <Field label="Lokasi">
                <input className={inputCls} value={row.location || ''} onChange={(e) => update(idx, { location: e.target.value })} placeholder="cth. Kasongan" />
              </Field>
              <Field label="Nilai unit">
                <input
                  type="number"
                  inputMode="numeric"
                  className={inputCls}
                  value={row.value ?? ''}
                  onChange={(e) => update(idx, { value: e.target.value })}
                  placeholder="0"
                />
              </Field>
              <Field label="PK">
                <input className={inputCls} value={row.pkNumber || ''} onChange={(e) => update(idx, { pkNumber: e.target.value })} placeholder="No. PK" />
              </Field>
              <Field label="BaHK">
                <input className={inputCls} value={row.bahkNumber || ''} onChange={(e) => update(idx, { bahkNumber: e.target.value })} placeholder="No. BAHK" />
              </Field>
              <Field label="Tanggal BAHK">
                <input type="date" className={inputCls} value={row.bahkDate || ''} onChange={(e) => update(idx, { bahkDate: e.target.value })} />
              </Field>
              <Field label="Progres (%)">
                <input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  max="100"
                  className={inputCls}
                  value={row.progress ?? 0}
                  onChange={(e) => update(idx, { progress: e.target.value })}
                />
              </Field>
              <Field label="Status">
                <select className={inputCls} value={row.status || 'belum'} onChange={(e) => update(idx, { status: e.target.value })}>
                  <option value="belum">Belum mulai</option>
                  <option value="berjalan">Berjalan</option>
                  <option value="selesai">Selesai</option>
                </select>
              </Field>
            </div>
            <p className="mt-1.5 text-[11px] text-slate-500">
              Retensi unit ini {rupiah(retention)} ({pct}%){row.bahkDate ? `, cair 3 bulan setelah BAHK` : ', menunggu BAHK'}.
            </p>
          </div>
        );
      })}

      {rows.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-500/10 px-3 py-2 text-xs">
          <span className="text-slate-600">{rows.length} unit</span>
          <span className="tnum font-semibold text-slate-800">Total nilai unit {rupiah(total)}</span>
        </div>
      )}
    </div>
  );
};

export default UnitsEditor;
