// src/components/invoices/InvoicesPage.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { ReceiptText, Search, FileDown, Send, CheckCircle2, Trash2, Loader2, Landmark, FileCode2 } from 'lucide-react';
import TaxDocsModal from './TaxDocsModal';
import CoretaxExportModal from './CoretaxExportModal';
import PageHeader from '../ui/PageHeader';
import Button from '../ui/Button';
import { Card } from '../ui/Card';
import { Input, Select } from '../ui/Field';
import { Badge } from '../ui/Badge';
import { SkeletonListPage } from '../ui/Skeleton';
import EmptyState from '../ui/EmptyState';
import StatCard from '../ui/StatCard';
import { formatCurrency, formatDate } from '../../utils/formatters';
import {
  getAllInvoices,
  setInvoiceStatus,
  deleteInvoice,
  markInvoicePaid,
  taxDocsProgress,
  isPpnCair,
  billingStageLabel,
  INVOICE_STATUS,
  INVOICE_STATUS_LABEL,
  CORETAX_STATUS,
  BILLING_STAGES
} from '../../services/invoices';
import { generateInvoicePDF } from '../../utils/invoiceGenerator';
import { getCompanySettings, mergeCompanyInfo } from '../../services/settings';
import { getClientMap, clientDisplayName } from '../../services/clients';
import { getAllProjects } from '../../services/projects';

const statusTone = { draft: 'slate', sent: 'blue', paid: 'emerald', void: 'red' };

const InvoicesPage = () => {
  const [invoices, setInvoices] = useState([]);
  const [clientMap, setClientMap] = useState({});
  const [projectMap, setProjectMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [stageFilter, setStageFilter] = useState('all');
  const [busyId, setBusyId] = useState(null);
  const [taxDocsInvoice, setTaxDocsInvoice] = useState(null);
  const [showCoretax, setShowCoretax] = useState(false);
  const [company, setCompany] = useState(null);

  useEffect(() => {
    getCompanySettings()
      .then((s) => setCompany(mergeCompanyInfo(s)))
      .catch(() => setCompany(null));
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const [invs, clients, projects] = await Promise.all([
        getAllInvoices(),
        getClientMap().catch(() => ({})),
        getAllProjects().catch(() => [])
      ]);
      setInvoices(invs);
      setClientMap(clients);
      setProjectMap(projects.reduce((acc, p) => ({ ...acc, [p.id]: p }), {}));
    } catch (err) {
      console.error('Error loading invoices:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // Nama client & proyek di-join dari koleksi masing-masing (invoice hanya simpan id).
  const clientNameOf = (inv) =>
    clientDisplayName(clientMap[inv.clientId]) || inv.clientName || '—';
  const projectNameOf = (inv) =>
    projectMap[inv.projectId]?.name || inv.projectName || '—';

  const filtered = useMemo(
    () =>
      invoices.filter((inv) => {
        if (statusFilter !== 'all' && inv.status !== statusFilter) return false;
        if (stageFilter !== 'all' && inv.billingStage !== stageFilter) return false;
        if (search) {
          const s = search.toLowerCase();
          return (
            (inv.invoiceNumber || '').toLowerCase().includes(s) ||
            projectNameOf(inv).toLowerCase().includes(s) ||
            clientNameOf(inv).toLowerCase().includes(s)
          );
        }
        return true;
      }),
    [invoices, statusFilter, stageFilter, search, clientMap, projectMap]
  );

  const stats = useMemo(() => {
    const active = invoices.filter((i) => i.status !== INVOICE_STATUS.VOID);
    const totalValue = active.reduce((s, i) => s + (i.grandTotal || 0), 0);
    const totalPpn = active.reduce((s, i) => s + (i.pajak11 || 0), 0);
    const unpaidPpn = active
      .filter((i) => i.coreTaxStatus !== CORETAX_STATUS.CLEARED)
      .reduce((s, i) => s + (i.pajak11 || 0), 0);
    return { count: invoices.length, totalValue, totalPpn, unpaidPpn };
  }, [invoices]);

  const withDisplayNames = (inv) => ({
    ...inv,
    projectName: projectNameOf(inv),
    clientName: clientNameOf(inv),
    client: clientMap[inv.clientId] || null
  });

  const handleDownload = async (inv) => {
    setBusyId(inv.id);
    try {
      const settings = await getCompanySettings();
      await generateInvoicePDF(withDisplayNames(inv), mergeCompanyInfo(settings));
    } catch (err) {
      console.error('Gagal unduh PDF:', err);
      alert('Gagal membuat PDF. Coba lagi.');
    } finally {
      setBusyId(null);
    }
  };

  const handleStatus = async (inv, status) => {
    setBusyId(inv.id);
    try {
      await setInvoiceStatus(inv.id, status);
      await load();
    } catch (err) {
      console.error('Gagal ubah status:', err);
      alert('Gagal mengubah status invoice.');
    } finally {
      setBusyId(null);
    }
  };

  const handleMarkPaid = async (inv) => {
    const received = inv.netProceeds ?? inv.grandTotal ?? 0;
    const ppn = inv.pajak11 ?? 0;
    const confirmed = window.confirm(
      `Tandai ${inv.invoiceNumber} terbayar?\n\nTransaksi otomatis akan dicatat:\n• Pemasukan "Pembayaran ${inv.invoiceNumber}" ${formatCurrency(received)}\n${ppn > 0 ? `• Pengeluaran "PPN Otomatis" ${formatCurrency(ppn)}\n` : ''}\nTerbayar proyek juga akan diperbarui.`
    );
    if (!confirmed) return;
    setBusyId(inv.id);
    try {
      await markInvoicePaid(withDisplayNames(inv));
      await load();
    } catch (err) {
      console.error('Gagal tandai terbayar:', err);
      alert('Gagal menandai terbayar. Coba lagi.');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (inv) => {
    if (!window.confirm(`Hapus invoice ${inv.invoiceNumber}? Tindakan ini tidak bisa dibatalkan.`)) return;
    setBusyId(inv.id);
    try {
      await deleteInvoice(inv.id);
      await load();
    } catch (err) {
      console.error('Gagal hapus invoice:', err);
      alert('Gagal menghapus invoice.');
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <SkeletonListPage variant="cards" stats={4} />;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Invoice"
        subtitle="Pantau termin pembayaran dan nilai tagihan setiap proyek"
        actions={
          invoices.length > 0 && (
            <Button variant="secondary" size="sm" onClick={() => setShowCoretax(true)}>
              <FileCode2 className="h-4 w-4" />
              Export Faktur Pajak
            </Button>
          )
        }
      />

      <div className="mb-5 grid grid-cols-1 gap-3 sm:mb-6 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        <StatCard icon={ReceiptText} tone="brand" label="Total Invoice" value={stats.count} sub="Semua termin & status" />
        <StatCard tone="cyan" label="Nilai Tagihan" value={formatCurrency(stats.totalValue)} sub="Grand total seluruh invoice" />
        <StatCard tone="violet" label="Total PPN 11%" value={formatCurrency(stats.totalPpn)} sub="Pajak tercatat" />
        <StatCard tone="amber" label="PPN Menunggu" value={formatCurrency(stats.unpaidPpn)} sub="Belum dicairkan" subTone="text-amber-600" />
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:mb-6 sm:grid-cols-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari no. invoice, proyek, atau client…" className="pl-9" />
        </div>
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">Semua Status</option>
          {Object.entries(INVOICE_STATUS_LABEL).map(([val, label]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </Select>
        <Select value={stageFilter} onChange={(e) => setStageFilter(e.target.value)}>
          <option value="all">Semua Termin</option>
          {BILLING_STAGES.map((t) => (
            <option key={t} value={t}>{billingStageLabel(t)}</option>
          ))}
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={ReceiptText}
          title={invoices.length === 0 ? 'Belum ada invoice' : 'Tidak ada invoice yang cocok'}
          description={
            invoices.length === 0
              ? 'Buat invoice dari halaman detail proyek (tombol Invoice).'
              : 'Coba ubah kata kunci atau filter.'
          }
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((inv) => {
            const busy = busyId === inv.id;
            return (
              <Card key={inv.id} className="p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display text-sm font-semibold text-slate-900">{inv.invoiceNumber}</h3>
                      {inv.billingStage && (
                        <Badge tone="violet">
                          {billingStageLabel(inv.billingStage)}
                          {inv.quantity ? ` · ${inv.quantity}` : ''}
                        </Badge>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-sm text-slate-600">{projectNameOf(inv)}</p>
                    <p className="truncate text-xs text-slate-400">
                      {clientNameOf(inv)} · Terbit {formatDate(inv.issueDate)} · Jatuh tempo {formatDate(inv.dueDate)}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <Badge tone={statusTone[inv.status] || 'slate'}>
                      {INVOICE_STATUS_LABEL[inv.status] || inv.status || 'Draft'}
                    </Badge>
                    {isPpnCair(inv) && <Badge tone="cyan">PPN Cair</Badge>}
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-end justify-between gap-3 rounded-lg bg-slate-50 p-3">
                  <div>
                    <p className="text-xs text-slate-400">Grand Total</p>
                    <p className="font-display text-lg font-bold text-slate-900">{formatCurrency(inv.grandTotal || 0)}</p>
                  </div>
                  <div className="text-right text-xs text-slate-500">
                    {inv.dppNilaiLain > 0 && (
                      <p>DPP Nilai Lain <span className="tnum font-medium text-slate-700">{formatCurrency(inv.dppNilaiLain)}</span></p>
                    )}
                    <p>PPN 11% <span className="tnum font-medium text-slate-700">{formatCurrency(inv.pajak11 || 0)}</span></p>
                  </div>
                </div>

                <div className="mt-3">
                  <div className="mb-1 flex items-center justify-between">
                    <p className="text-xs font-medium text-slate-400">Progress Dokumen Pajak</p>
                    <p className="text-xs text-slate-400">{taxDocsProgress(inv).filter((p) => p.done).length}/4</p>
                  </div>
                  <div className="flex items-center gap-1">
                    {taxDocsProgress(inv).map((p) => (
                      <div key={p.key} title={p.label} className={`h-1.5 flex-1 rounded-full ${p.done ? 'bg-emerald-500' : 'bg-slate-200'}`} />
                    ))}
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Button variant="secondary" size="sm" onClick={() => handleDownload(inv)} disabled={busy}>
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
                    Unduh PDF
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => setTaxDocsInvoice(withDisplayNames(inv))} disabled={busy}>
                    <Landmark className="h-4 w-4" />
                    Dokumen Pajak
                  </Button>
                  {inv.status === INVOICE_STATUS.DRAFT && (
                    <Button variant="secondary" size="sm" onClick={() => handleStatus(inv, INVOICE_STATUS.SENT)} disabled={busy}>
                      <Send className="h-4 w-4" />
                      Tandai Terkirim
                    </Button>
                  )}
                  {inv.status !== INVOICE_STATUS.PAID && inv.status !== INVOICE_STATUS.VOID && (
                    <Button variant="success" size="sm" onClick={() => handleMarkPaid(inv)} disabled={busy}>
                      <CheckCircle2 className="h-4 w-4" />
                      Tandai Terbayar
                    </Button>
                  )}
                  <Button variant="danger-ghost" size="sm" onClick={() => handleDelete(inv)} disabled={busy}>
                    <Trash2 className="h-4 w-4" />
                    Hapus
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {showCoretax && (
        <CoretaxExportModal
          isOpen={showCoretax}
          onClose={() => setShowCoretax(false)}
          invoices={filtered.length > 0 ? filtered : invoices}
          company={company}
        />
      )}

      {taxDocsInvoice && (
        <TaxDocsModal
          isOpen={Boolean(taxDocsInvoice)}
          invoice={taxDocsInvoice}
          onClose={() => setTaxDocsInvoice(null)}
          onSaved={load}
        />
      )}
    </div>
  );
};

export default InvoicesPage;
