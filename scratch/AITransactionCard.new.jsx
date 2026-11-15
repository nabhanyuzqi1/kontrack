import React from 'react';
import { CalendarClock, AlertCircle, Sparkles, Receipt, ArrowDownLeft, ArrowUpRight, X } from 'lucide-react';
import { Input, Select } from '../ui/Field';
import { formatCurrency } from '../../utils/formatters';
import { INCOME_CATEGORIES, EXPENSE_CATEGORIES } from '../../utils/constants';
import { describeTxDateTime, hasExplicitTime, DEFAULT_HOUR } from '../../utils/txDateTime';

// Kartu verifikasi satu hasil AI.
//
// Prinsip tampilan: pengguna harus bisa memutuskan "percaya atau koreksi" dalam
// sekali lihat. Karena itu setiap nilai yang AI TIDAK temukan diberi penanda
// eksplisit, bukan dibiarkan tampak seperti hasil bacaan. Sebelumnya tanggal
// kosong diam-diam diganti "sekarang", sehingga jam transaksi salah tanpa ada
// yang tahu.
//
// Tata letak: bukti di kiri (tetap terlihat saat mengoreksi), isian dikelompokkan
// di kanan dalam blok "Nilai & Klasifikasi", "Waktu Transaksi", dan "Keterangan"
// — mengikuti pola dokumen invoice, bukan tumpukan field datar.

const Label = ({ children }) => (
  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
    {children}
  </label>
);

const SourceNote = ({ children, tone = 'neutral' }) => {
  const toneCls = tone === 'warn' ? 'text-amber-700 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400';
  const Icon = tone === 'warn' ? AlertCircle : Sparkles;
  return (
    <p className={`mt-1 flex items-start gap-1 text-[11px] leading-snug ${toneCls}`}>
      <Icon className="mt-0.5 h-3 w-3 shrink-0" />
      <span>{children}</span>
    </p>
  );
};

const AITransactionCard = ({ result: r, index, onUpdate, onRemove, disabled }) => {
  const isIncome = r.type === 'income';
  const categories = isIncome ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  // Kategori hasil AI bisa berada di daftar sisi lain (mis. AI menebak
  // "Material" padahal jenis dibaca income). Diselaraskan di sini supaya
  // dropdown tidak tampil kosong tanpa penjelasan.
  const categoryInList = categories.includes(r.category);
  const shownCategory = categoryInList ? r.category : categories[0];

  const dateKnown = Boolean(r.date);
  const timeKnown = hasExplicitTime(r.date);
  const datePart = dateKnown ? String(r.date).slice(0, 10) : '';
  const timePart = timeKnown ? String(r.date).slice(11, 16) : '';

  return (
    <div className="overflow-hidden rounded-[10px] panel-solid ring-1 ring-inset ring-slate-200/70 dark:ring-white/10">
      {/* Kepala kartu: nomor bukti, jenis, dan nominal —
          garis besar yang perlu diverifikasi lebih dulu. */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-200/70 bg-slate-500/5 px-3.5 py-2.5 dark:border-white/10">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-slate-500/10 font-display text-[11px] font-bold text-slate-500">
            {index + 1}
          </span>
          <span
            className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
              isIncome
                ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300'
                : 'bg-red-500/15 text-red-800 dark:text-red-300'
            }`}
          >
            {isIncome ? <ArrowDownLeft className="h-2.5 w-2.5" /> : <ArrowUpRight className="h-2.5 w-2.5" />}
            {isIncome ? 'Masuk' : 'Keluar'}
          </span>
          <p className={`tnum truncate font-display text-sm font-bold ${isIncome ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
            {isIncome ? '+' : '−'}{formatCurrency(r.amount || 0)}
          </p>
        </div>
        <button
          onClick={() => onRemove(index)}
          disabled={disabled}
          className="shrink-0 rounded p-1 text-slate-400 transition-colors hover:bg-red-500/10 hover:text-red-600"
          title="Hapus hasil ini"
          aria-label={`Hapus hasil ${index + 1}`}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 p-3.5 md:grid-cols-[150px_minmax(0,1fr)]">
        {/* Kiri: bukti gambar */}
        <div className="min-w-0">
          {r.imageUrl ? (
            <img
              src={r.imageUrl}
              alt={`Bukti ${index + 1}`}
              className="h-32 w-full rounded-lg object-cover ring-1 ring-inset ring-slate-200/70 md:h-full md:max-h-44 dark:ring-white/10"
            />
          ) : (
            <div className="flex h-32 w-full flex-col items-center justify-center gap-1 rounded-lg bg-slate-500/5 text-slate-400 ring-1 ring-inset ring-slate-200/70 md:h-full dark:ring-white/10">
              <Receipt className="h-5 w-5" />
              <span className="text-[10px]">Tanpa gambar</span>
            </div>
          )}
        </div>

        {/* Kanan: isian berkelompok */}
        <div className="min-w-0 space-y-3">
          {/* Blok 1: nilai & klasifikasi */}
          <div className="rounded-lg px-3 py-2.5 ring-1 ring-inset ring-slate-200/60 dark:ring-white/10">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Nilai &amp; Klasifikasi</p>
            <div className="grid grid-cols-2 gap-2.5">
              <div className="min-w-0">
                <Label>Jenis</Label>
                <Select
                  value={r.type}
                  disabled={disabled}
                  onChange={(e) => {
                    const nextType = e.target.value;
                    onUpdate(index, {
                      type: nextType,
                      category: nextType === 'income' ? INCOME_CATEGORIES[0] : EXPENSE_CATEGORIES[0]
                    });
                  }}
                >
                  <option value="income">Pemasukan</option>
                  <option value="expense">Pengeluaran</option>
                </Select>
              </div>

              <div className="min-w-0">
                <Label>Nominal (Rp)</Label>
                <Input
                  type="number"
                  value={r.amount ?? ''}
                  onChange={(e) => onUpdate(index, { amount: Number(e.target.value) })}
                  min="0"
                  step="any"
                  disabled={disabled}
                />
              </div>

              <div className="col-span-2 min-w-0">
                <Label>Kategori</Label>
                <Select value={shownCategory} onChange={(e) => onUpdate(index, { category: e.target.value })} disabled={disabled}>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </Select>
                {!categoryInList && (
                  <SourceNote tone="warn">
                    AI menebak &ldquo;{r.category}&rdquo; yang bukan kategori {isIncome ? 'pemasukan' : 'pengeluaran'}. Diganti ke pilihan pertama.
                  </SourceNote>
                )}
              </div>
            </div>
          </div>

          {/* Blok 2: waktu */}
          <div className="rounded-lg px-3 py-2.5 ring-1 ring-inset ring-slate-200/60 dark:ring-white/10">
            <p className="mb-2 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              <CalendarClock className="h-3 w-3" />
              Waktu Transaksi
            </p>
            <div className="grid grid-cols-[minmax(0,1fr)_110px] gap-2.5">
              <div className="min-w-0">
                <Label>Tanggal</Label>
                <Input
                  type="date"
                  value={datePart}
                  disabled={disabled}
                  onChange={(e) =>
                    onUpdate(index, {
                      // Jam yang sudah diketahui dipertahankan; bila belum ada,
                      // dipakai DEFAULT_HOUR dan tetap ditandai di bawah.
                      date: `${e.target.value}T${timePart || String(DEFAULT_HOUR).padStart(2, '0') + ':00'}`
                    })
                  }
                />
              </div>
              <div className="min-w-0">
                <Label>Jam</Label>
                <Input
                  type="time"
                  value={timePart}
                  disabled={disabled}
                  onChange={(e) =>
                    onUpdate(index, {
                      date: `${datePart || new Date().toISOString().slice(0, 10)}T${e.target.value}`
                    })
                  }
                />
              </div>
            </div>
            {!dateKnown && (
              <SourceNote tone="warn">Tanggal tidak terbaca dari gambar. Isi manual, jangan biarkan kosong.</SourceNote>
            )}
            {dateKnown && !timeKnown && (
              <SourceNote tone="warn">Jam tidak tertera pada nota. Dikosongkan, bukan dikarang.</SourceNote>
            )}
            {dateKnown && timeKnown && <SourceNote>{describeTxDateTime(r.date)}</SourceNote>}
          </div>

          {/* Blok 3: keterangan */}
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-[minmax(0,180px)_minmax(0,1fr)]">
            <div className="min-w-0">
              <Label>Pihak / Toko</Label>
              <Input
                value={r.vendor || ''}
                placeholder="Nama toko atau penerima"
                onChange={(e) => onUpdate(index, { vendor: e.target.value })}
                disabled={disabled}
              />
            </div>
            <div className="min-w-0">
              <Label>Deskripsi</Label>
              <Input
                value={r.description || ''}
                onChange={(e) => onUpdate(index, { description: e.target.value })}
                placeholder="Isi nota, mis. Bon upah 3 tukang"
                disabled={disabled}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AITransactionCard;
export { describeTxDateTime };
