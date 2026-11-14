// src/components/invoices/InvoiceDetailModal.jsx
// Detail invoice ala ERP: satu layar berisi identitas, nomor referensi
// (PO, PK, WPHO), rincian item, perhitungan pajak, dan progres dokumen.
// PDF tetap tersedia sebagai salah satu aksi — bukan satu-satunya cara
// melihat isi invoice.
import React, { useState } from 'react';
import {
  FileDown,
  Landmark,
  PenLine,
  Send,
  CheckCircle2,
  CalendarDays,
  Building2,
  Briefcase,
  FileText
} from 'lucide-react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { Badge } from '../ui/Badge';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { generateInvoicePDF } from '../../utils/invoiceGenerator';
import {
  INVOICE_STATUS,
  INVOICE_STATUS_LABEL,
  billingStageLabel,
  taxDocsProgress,
  isPpnCair
} from '../../services/invoices';
import { getCompanySettings, mergeCompanyInfo } from '../../services/settings';

const statusTone = { draft: 'slate', sent: 'blue', paid: 'emerald', void: 'red' };

const RefRow = ({ label, value }) => (
  <div className="flex items-baseline justify-between gap-3 py-1.5">
    <span className="shrink-0 text-xs font-medium uppercase tracking-wide text-slate-400">{label}</span>
    <span className="tnum truncate text-sm font-semibold text-slate-800">{value || '—'}</span>
  </div>
);

const InvoiceDetailModal = ({ invoice, onClose, onEdit, onTaxDocs, onMarkPaid, onMarkSent, busy }) => {
  const [downloading, setDownloading] = useState(false);
  if (!invoice) return null;

  const inv = { ...invoice };
  const items = Array.isArray(inv.invoiceItems) ? inv.invoiceItems : [];
  const isPaid = inv.status === INVOICE_STATUS.PAID;
  const progress = taxDocsProgress(inv);
  const doneCount = progress.filter((p) => p.done).length;

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const settings = await getCompanySettings();
      await generateInvoicePDF(inv, mergeCompanyInfo(settings));
    } catch (err) {
      console.error('Gagal unduh PDF:', err);
      alert('Gagal membuat PDF. Coba lagi.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Modal
      isOpen={Boolean(invoice)}
      onClose={onClose}
      title={inv.invoiceNumber || 'Detail Invoice'}
      subtitle={inv.projectName}
      size="xl"
      footer={
        <>
          {isPaid ? (
            <p className="mr-auto hidden text-xs text-slate-400 sm:block">
              Invoice terbayar terkunci — hanya dokumen pajak yang bisa diperbarui.
            </p>
          ) : (
            <>
              <Button variant="danger-ghost" size="sm" onClick={() => onMarkPaid(inv)} disabled={busy}>
                <CheckCircle2 className="h-4 w-4" />
                Tandai Terbayar
              </Button>
            </>
          )}
          <div className="flex flex-wrap gap-2 sm:justify-end">
            {!isPaid && inv.status === INVOICE_STATUS.DRAFT && (
              <Button variant="secondary" size="sm" onClick={() => onMarkSent(inv)} disabled={busy}>
                <Send className="h-4 w-4" />
                Tandai Terkirim
              </Button>
            )}
            <Button variant="secondary" size="sm" onClick={() => onTaxDocs(inv)}>
              <Landmark className="h-4 w-4" />
              Dokumen Pajak
            </Button>
            {!isPaid && onEdit && (
              <Button variant="secondary" size="sm" onClick={() => onEdit(inv)}>
                <PenLine className="h-4 w-4" />
                Edit
              </Button>
            )}
            <Button size="sm" onClick={handleDownload} loading={downloading}>
              <FileDown className="h-4 w-4" />
              Unduh PDF
            </Button>
          </div>
        </>
      }
    >
      <div className="space-y-5">
        {/* Identitas + status */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={statusTone[inv.status] || 'slate'}>
                {INVOICE_STATUS_LABEL[inv.status] || inv.status || 'Draft'}
              </Badge>
              {inv.billingStage && (
                <Badge tone="violet">
                  {billingStageLabel(inv.billingStage)}
                  {inv.quantity ? ` · ${inv.quantity}` : ''}
                </Badge>
              )}
              {isPpnCair(inv) && <Badge tone="cyan">PPN Cair</Badge>}
            </div>
            <p className="mt-2 flex items-center gap-1.5 text-sm text-slate-600">
              <Building2 className="h-4 w-4 shrink-0 text-slate-400" />
              {inv.clientName || inv.client?.client_name || '—'}
            </p>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm text-slate-500">
              <Briefcase className="h-4 w-4 shrink-0 text-slate-400" />
              {inv.projectName || '—'}
            </p>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-400">
              <CalendarDays className="h-4 w-4 shrink-0" />
              Terbit {formatDate(inv.issueDate)} · Jatuh tempo {formatDate(inv.dueDate)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Grand Total</p>
            <p className="tnum font-display text-2xl font-bold tracking-tight text-slate-900">
              {formatCurrency(inv.grandTotal || 0)}
            </p>
            {inv.taxDeductedAmount > 0 && (
              <p className="mt-0.5 text-xs text-slate-500">
                Diterima <span className="tnum font-medium">{formatCurrency(inv.netProceeds)}</span>
              </p>
            )}
          </div>
        </div>

        {/* Nomor referensi */}
        <div className="rounded-[10px] glass-3 p-4">
          <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            <FileText className="h-3.5 w-3.5" />
            Nomor Referensi
          </p>
          <div className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
            <RefRow label="No. PO" value={inv.poNumber} />
            <RefRow label="No. PK" value={inv.pkNumber} />
            <RefRow label="No. WPHO / BAST" value={inv.wphoNumber} />
            <RefRow label="No. Faktur Pajak" value={inv.taxInvoiceNumber} />
            <RefRow label="Kode Billing" value={inv.billingCode} />
            <RefRow label="NTPN" value={inv.ntpnNumber} />
          </div>
        </div>

        {/* Rincian item */}
        {items.length > 0 && (
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Rincian Pekerjaan
            </p>
            <div className="overflow-hidden rounded-[10px] ring-1 ring-inset ring-slate-200/70 dark:ring-white/10">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200/70 text-left text-[11px] uppercase tracking-wide text-slate-400 dark:border-white/10">
                    <th className="px-3 py-2 font-medium">Deskripsi</th>
                    <th className="px-3 py-2 font-medium">Qty</th>
                    <th className="px-3 py-2 text-right font-medium">Harga</th>
                    <th className="px-3 py-2 text-right font-medium">Jumlah</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, i) => (
                    <tr key={i} className="border-b border-slate-200/50 last:border-0 dark:border-white/5">
                      <td className="px-3 py-2 text-slate-800">{it.description || '—'}</td>
                      <td className="px-3 py-2 text-slate-500">
                        {it.qty || '—'} {it.unit || ''}
                      </td>
                      <td className="tnum px-3 py-2 text-right text-slate-500">
                        {it.unitPrice ? formatCurrency(it.unitPrice) : '—'}
                      </td>
                      <td className="tnum px-3 py-2 text-right font-semibold text-slate-800">
                        {formatCurrency(
                          it.amount !== '' && it.amount != null
                            ? Number(it.amount)
                            : (Number(it.qty) || 1) * (Number(it.unitPrice) || 0)
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Perhitungan */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-[10px] glass-3 p-4">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Perhitungan
            </p>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-slate-500">
                <span>Subtotal</span>
                <span className="tnum">{formatCurrency(inv.subtotal ?? inv.dppNilaiLain ?? 0)}</span>
              </div>
              {inv.dppNilaiLain > 0 && (
                <div className="flex justify-between text-slate-500">
                  <span>DPP Nilai Lain</span>
                  <span className="tnum">{formatCurrency(inv.dppNilaiLain)}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-500">
                <span>PPN</span>
                <span className="tnum">{formatCurrency(inv.pajak11 || 0)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200/70 pt-1.5 font-display text-base font-bold text-brand-700 dark:border-white/10">
                <span>Grand Total</span>
                <span className="tnum">{formatCurrency(inv.grandTotal || 0)}</span>
              </div>
              {inv.taxDeductedAmount > 0 && (
                <>
                  <div className="flex justify-between text-slate-500">
                    <span>PPh (dipotong client)</span>
                    <span className="tnum">−{formatCurrency(inv.taxDeductedAmount)}</span>
                  </div>
                  <div className="flex justify-between font-semibold text-slate-800">
                    <span>Diterima</span>
                    <span className="tnum">{formatCurrency(inv.netProceeds)}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Progres dokumen pajak */}
          <div className="rounded-[10px] glass-3 p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Dokumen Pajak
              </p>
              <p className="text-xs text-slate-400">{doneCount}/4</p>
            </div>
            <div className="space-y-2">
              {progress.map((p) => (
                <div key={p.key} className="flex items-center justify-between text-sm">
                  <span className={p.done ? 'font-medium text-slate-800' : 'text-slate-400'}>
                    {p.label}
                  </span>
                  <span
                    className={`h-2 w-2 rounded-full ${p.done ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default InvoiceDetailModal;
