import React from 'react';
import { Search, X, SlidersHorizontal, ArrowDownUp } from 'lucide-react';
import { Select } from '../ui/Field';

// Bilah filter tabel transaksi proyek.
//
// Sebelumnya tiga kontrol polos berdampingan tanpa label dan tanpa umpan balik,
// sehingga tidak jelas apa yang sedang menyaring (dan tidak ada cara cepat
// mengosongkan pencarian). Di sini tiap kontrol punya label di atas, hasil
// penyaringan ditampilkan sebagai hitungan, dan filter aktif bisa direset sekali klik.
const Label = ({ htmlFor, icon: Icon, children }) => (
  <label
    htmlFor={htmlFor}
    className="mb-1 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
  >
    {Icon && <Icon className="h-3 w-3 shrink-0" />}
    <span className="truncate">{children}</span>
  </label>
);

const TransactionFilterBar = ({
  search,
  onSearch,
  category,
  onCategory,
  categories,
  sortBy,
  onSortBy,
  shown,
  total
}) => {
  const filtered = shown !== total;

  return (
    <div className="mb-3 rounded-[10px] bg-slate-500/5 p-2.5 ring-1 ring-inset ring-slate-200/60 dark:ring-white/10">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-12 lg:items-start">
        {/* Pencarian: mengisi sisa lebar di desktop */}
        <div className="min-w-0 sm:col-span-2 lg:col-span-6">
          <Label htmlFor="tx-search">Cari transaksi</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              id="tx-search"
              type="search"
              value={search}
              onChange={(e) => onSearch(e.target.value)}
              placeholder="Deskripsi, kategori, atau keterangan"
              className="field-surface h-[43px] w-full rounded-[10px] py-0 pl-9 pr-9 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/60"
            />
            {search && (
              <button
                type="button"
                onClick={() => onSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:bg-slate-500/10 hover:text-slate-600"
                aria-label="Kosongkan pencarian"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Kategori & urutan: lebar sama supaya tepi kanannya satu garis */}
        <div className="min-w-0 lg:col-span-3">
            <Label htmlFor="tx-cat" icon={SlidersHorizontal}>Kategori</Label>
            <Select id="tx-cat" value={category} onChange={(e) => onCategory(e.target.value)} className="w-full text-sm">
              <option value="all">Semua kategori</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </Select>
          </div>

        <div className="min-w-0 lg:col-span-3">
            <Label htmlFor="tx-sort" icon={ArrowDownUp}>Urutan</Label>
            <Select id="tx-sort" value={sortBy} onChange={(e) => onSortBy(e.target.value)} className="w-full text-sm">
              <option value="date">Tanggal terbaru</option>
              <option value="amount">Nominal terbesar</option>
              <option value="category">Kategori (A-Z)</option>
            </Select>
        </div>
      </div>

      {/* Umpan balik: tanpa ini, pengguna tidak tahu apakah daftar kosong karena
          filternya atau karena memang tidak ada transaksi. */}
      <div className="mt-2 flex items-center justify-between gap-2 border-t border-slate-200/50 pt-2 dark:border-white/5">
        <p className="text-[11px] font-medium text-slate-600">
          Menampilkan <span className="tnum font-bold text-slate-800">{shown}</span> dari{' '}
          <span className="tnum font-bold text-slate-800">{total}</span> transaksi
        </p>
        {filtered && (
          <button
            type="button"
            onClick={() => { onSearch(''); onCategory('all'); }}
            className="shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold text-brand-700 hover:bg-brand-500/10 dark:text-brand-300"
          >
            Reset filter
          </button>
        )}
      </div>
    </div>
  );
};

export default TransactionFilterBar;
