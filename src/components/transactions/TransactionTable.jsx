// src/components/transactions/TransactionTable.jsx
import React, { useMemo, useState } from 'react';
import { Sparkles, ImageIcon, PenLine, Trash2, Inbox } from 'lucide-react';
import { formatCurrency, formatDateTime } from '../../utils/formatters';
import { TRANSACTION_TYPES } from '../../utils/constants';
import { Badge } from '../ui/Badge';
import Lightbox from '../ui/Lightbox';

const Th = ({ children, className = '' }) => (
  <th
    className={`whitespace-nowrap px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400 ${className}`}
  >
    {children}
  </th>
);

const TransactionTable = ({ transactions, onEdit, onDelete, showProject = true }) => {
  const [deletingId, setDeletingId] = useState(null);
  const [previewIndex, setPreviewIndex] = useState(null);

  // Semua bukti pada tabel ini menjadi satu galeri, sehingga pengguna bisa
  // menelusuri bukti transaksi berikutnya tanpa menutup pratinjau.
  const proofs = useMemo(
    () =>
      transactions
        .filter((t) => t.imageUrl)
        .map((t) => ({
          url: t.imageUrl,
          name: `${t.description || 'Bukti'} — ${formatCurrency(t.amount)}`,
          id: t.id
        })),
    [transactions]
  );

  const handleDelete = async (transaction) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus transaksi ini?')) {
      return;
    }

    setDeletingId(transaction.id);

    try {
      if (onDelete) {
        await onDelete(transaction);
      }
    } catch (error) {
      console.error('Error deleting transaction:', error);
      alert('Gagal menghapus transaksi. Silakan coba lagi.');
    } finally {
      setDeletingId(null);
    }
  };

  if (transactions.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-slate-400">
        <Inbox className="h-8 w-8 text-slate-300" />
        <p className="text-sm">Belum ada transaksi</p>
      </div>
    );
  }

  return (
    <div className="custom-scrollbar overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-100">
        <thead className="bg-slate-50/70">
          <tr>
            <Th>Tanggal</Th>
            {showProject && <Th>Proyek</Th>}
            <Th>Keterangan</Th>
            <Th>Kategori</Th>
            <Th className="text-right">Nominal</Th>
            {(onEdit || onDelete) && <Th className="text-right">Aksi</Th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50 bg-white">
          {transactions.map((transaction) => {
            const isIncome = transaction.type === TRANSACTION_TYPES.INCOME;
            return (
              <tr key={transaction.id} className="transition-colors hover:bg-slate-50/60">
                <td className="whitespace-nowrap px-5 py-3.5 text-sm text-slate-600">
                  <div className="flex items-center gap-1.5">
                    {formatDateTime(transaction.date)}
                    {transaction.isAIProcessed && (
                      <span title="Diproses dengan AI">
                        <Sparkles className="h-3.5 w-3.5 text-violet-500" />
                      </span>
                    )}
                  </div>
                </td>
                {showProject && (
                  <td className="max-w-[180px] truncate px-5 py-3.5 text-sm text-slate-600">
                    {transaction.projectName || '—'}
                  </td>
                )}
                <td className="px-5 py-3.5 text-sm text-slate-700">
                  <div className="max-w-xs">
                    <p className="truncate">{transaction.description}</p>
                    {transaction.imageUrl && (
                      <button
                        type="button"
                        onClick={() =>
                          setPreviewIndex(proofs.findIndex((p) => p.id === transaction.id))
                        }
                        className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700"
                      >
                        <ImageIcon className="h-3 w-3" />
                        Lihat Bukti
                      </button>
                    )}
                  </div>
                </td>
                <td className="whitespace-nowrap px-5 py-3.5">
                  <Badge tone="slate">{transaction.category}</Badge>
                </td>
                <td
                  className={`whitespace-nowrap px-5 py-3.5 text-right text-sm font-semibold tabular-nums ${
                    isIncome ? 'text-emerald-600' : 'text-red-600'
                  }`}
                >
                  {isIncome ? '+' : '−'}
                  {formatCurrency(transaction.amount)}
                </td>
                {(onEdit || onDelete) && (
                  <td className="whitespace-nowrap px-5 py-3.5">
                    <div className="flex justify-end gap-1">
                      {onEdit && (
                        <button
                          onClick={() => onEdit(transaction)}
                          disabled={deletingId === transaction.id}
                          title="Edit transaksi"
                          className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40"
                        >
                          <PenLine className="h-4 w-4" />
                        </button>
                      )}
                      {onDelete && (
                        <button
                          onClick={() => handleDelete(transaction)}
                          disabled={deletingId === transaction.id}
                          title="Hapus transaksi"
                          className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>

      {previewIndex !== null && previewIndex >= 0 && (
        <Lightbox
          items={proofs}
          index={previewIndex}
          onNavigate={setPreviewIndex}
          onClose={() => setPreviewIndex(null)}
        />
      )}
    </div>
  );
};

export default TransactionTable;
