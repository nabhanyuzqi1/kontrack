// src/components/invoices/InvoicesPage.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { ReceiptText, Search, FileText, Send, CheckCircle2, Trash2, Loader2, Landmark, FileCode2, ChevronRight, ArrowDownWideNarrow, ArrowUpNarrowWide } from 'lucide-react';
import TaxDocsModal from './TaxDocsModal';
import CoretaxExportModal from './CoretaxExportModal';
import InvoiceDetailModal from './InvoiceDetailModal';
import InvoiceModal from './InvoiceModal';
import PdfPreview from '../ui/PdfPreview';
import PageHeader from '../ui/PageHeader';
import Button from '../ui/Button';
import { Card } from '../ui/Card';
import { Input, Select } from '../ui/Field';
import { Badge } from '../ui/Badge';
import { SkeletonListPage } from '../ui/Skeleton';
import EmptyState from '../ui/EmptyState';
import StatCard from '../ui/StatCard';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { subscribe, CACHE_KEYS } from '../../services/cache';
import {
  getAllInvoices,
  setInvoiceStatus,
  deleteInvoice,
  markInvoicePaid,
  sortInvoiceList,
  taxDocsProgress,
  isPpnCair,
  billingStageLabel,
  INVOICE_STATUS,
  INVOICE_STATUS_LABEL,
  CORETAX_STATUS,
  BILLING_STAGES
} from '../../services/invoices';
import { generateInvoicePDF } from '../../utils/invoiceGenerator';
import { fetchAssetDataUrl } from '../../services/assets';
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
  const [sortBy, setSortBy] = useState('date');
  const [sortDir, setSortDir] = useState('desc');
  const [statusFilter, setStatusFilter] = useState('all');
  const [stageFilter, setStageFilter] = useState('all');
  const [busyId, setBusyId] = useState(null);
  const [taxDocsInvoice, setTaxDocsInvoice] = useState(null);
  const [showCoretax, setShowCoretax] = useState(false);
  const [company, setCompany] = useState(null);
  const [detailInvoice, setDetailInvoice] = useState(null);
  const [pdfPreview, setPdfPreview] = useState(null);
  const [editInvoice, setEditInvoice] = useState(null);
  const [reviseMode, setReviseMode] = useState(false);

  useEffect(() => {
    getCompanySettings()
      .then((s) => setCompany(mergeCompanyInfo(s)))
      .catch(() => setCompany(null));
  }, []);

  const load = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
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
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // Revalidasi SWR: data basi tampil seketika lalu diperbarui diam-diam
    // tanpa menampilkan skeleton lagi.
    const keys = [CACHE_KEYS.INVOICES, CACHE_KEYS.CLIENTS, CACHE_KEYS.PROJECTS];
    const unsubs = keys.map((k) => subscribe(k, () => load({ silent: true })));
    return () => unsubs.forEach((u) => u());
  }, []);

  // Nama client & proyek di-join dari koleksi masing-masing (invoice hanya simpan id).
  const clientNameOf = (inv) =>
    clientDisplayName(clientMap[inv.clientId]) || inv.clientName || '—';
  const projectNameOf = (inv) =>
    projectMap[inv.projectId]?.name || inv.projectName || '—';

  const filtered = useMemo(() => {
    const list = invoices.filter((inv) => {
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
    });
    // Tanggal dibandingkan sebagai waktu (Timestamp maupun string), bukan teks:
    // urutan teks membuat dokumen bertanggal Timestamp jatuh ke posisi acak.
    return sortInvoiceList(list, { sortBy, direction: sortDir, projectNameOf });
  }, [invoices, statusFilter, stageFilter, search, sortBy, sortDir, clientMap, projectMap]);

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
    client: clientMap[inv.clientId] || inv.client || null
  });

  const handlePreviewQuick = async (inv) => {
    setBusyId(inv.id);
    try {
      const settings = await getCompanySettings();
      const { blob, fileName } = await generateInvoicePDF(withDisplayNames(inv), mergeCompanyInfo(settings), { download: false, resolveAssetDataUrl: fetchAssetDataUrl });
      setPdfPreview({ blob, fileName });
    } catch (err) {
      console.error('Gagal membuat pratinjau PDF:', err);
      alert('Gagal membuat PDF. Coba lagi.');
    } finally {
      setBusyId(null);
    }
  };

  const handleStatus = async (inv, status) => {
    setBusyId(inv.id);
    try {
      await setInvoiceStatus(inv.id, status);
      await load({ silent: true });
    } catch (err) {
      console.error('Gagal ubah status:', err);
      alert(err?.message || 'Gagal mengubah status invoice.');
    } finally {
      setBusyId(null);
    }
  };

  const handleMarkPaid = async (inv) => {
    const received = inv.netProceeds ?? inv.grandTotal ?? 0;
    const ppn = inv.pajak11 ?? 0;
    const confirmed = window.confirm(
      `Tandai ${inv.invoiceNumber} terbayar?\n\nTransaksi otomatis akan dicatat:\n\u2022 Pemasukan "Pembayaran ${inv.invoiceNumber}" ${formatCurrency(received)}\n${ppn > 0 ? `\u2022 Pengeluaran "PPN Otomatis" ${formatCurrency(ppn)}\n` : ''}\nTerbayar proyek juga akan diperbarui.`
    );
    if (!confirmed) return;
    setBusyId(inv.id);
    try {
      await markInvoicePaid(withDisplayNames(inv));
      setDetailInvoice(null);
      await load({ silent: true });
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
      setDetailInvoice(null);
      await load({ silent: true });
    } catch (err) {
      console.error('Gagal hapus invoice:', err);
      alert(err?.message || 'Gagal menghapus invoice.');
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

      <div className="mb-4 grid grid-cols-1 gap-3 sm:mb-6 sm:grid-cols-2 lg:grid-cols-4">
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
        <div className="flex gap-2">
          <Select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="min-w-0 flex-1">
            <option value="date">Urutkan: tanggal</option>
            <option value="amount">Urutkan: nominal</option>
            <option value="number">Urutkan: no. invoice</option>
            <option value="project">Urutkan: proyek</option>
            <option value="status">Urutkan: status</option>
          </Select>
          <Button
            variant="secondary"
            onClick={() => setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))}
            title={sortDir === 'desc' ? 'Urutan menurun (terbaru/terbesar dulu). Klik untuk menaik.' : 'Urutan menaik (terlama/terkecil dulu). Klik untuk menurun.'}
            aria-label={sortDir === 'desc' ? 'Urutan menurun, ubah ke menaik' : 'Urutan menaik, ubah ke menurun'}
            className="shrink-0"
          >
            {sortDir === 'desc' ? <ArrowDownWideNarrow className="h-4 w-4" /> : <ArrowUpNarrowWide className="h-4 w-4" />}
            <span className="hidden sm:inline">{sortDir === 'desc' ? 'Turun' : 'Naik'}</span>
          </Button>
        </div>
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
            const isPaid = inv.status === INVOICE_STATUS.PAID;
            const docsDone = taxDocsProgress(inv).filter((p) => p.done).length;
            return (
              <Card
                key={inv.id}
                className="group cursor-pointer p-4 transition-colors hover:border-brand-300 sm:p-5"
                onClick={() => setDetailInvoice(withDisplayNames(inv))}
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Kolom identitas */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="tnum font-display text-sm font-bold text-slate-900 group-hover:text-brand-700">
                        {inv.invoiceNumber}
                      </h3>
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
                    <p className="mt-1 truncate text-sm font-medium text-slate-600">{projectNameOf(inv)}</p>
                    <p className="truncate text-xs text-slate-400">
                      {clientNameOf(inv)} · Terbit {formatDate(inv.issueDate)} · Jatuh tempo {formatDate(inv.dueDate)}
                    </p>

                    {/* Meta: pajak + dokumen */}
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                      <span className="text-slate-500">
                        PPN <span className="tnum font-semibold text-slate-700">{formatCurrency(inv.pajak11 || 0)}</span>
                      </span>
                      <span className="inline-flex items-center gap-1.5" title={`Dokumen pajak ${docsDone}/4`}>
                        <span className="text-slate-500">Dokumen</span>
                        <span className="flex items-center gap-0.5">
                          {taxDocsProgress(inv).map((p) => (
                            <span
                              key={p.key}
                              title={p.label}
                              className={`h-1.5 w-4 rounded-full ${p.done ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-600'}`}
                            />
                          ))}
                        </span>
                        <span className="tnum font-semibold text-slate-700">{docsDone}/4</span>
                      </span>
                    </div>
                  </div>

                  {/* Kolom angka */}
                  <div className="flex shrink-0 items-center gap-3 text-right">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Grand Total</p>
                      <p className="tnum font-display text-lg font-bold tracking-tight text-slate-900">
                        {formatCurrency(inv.grandTotal || 0)}
                      </p>
                      {inv.taxDeductedAmount > 0 && (
                        <p className="text-[11px] text-slate-400">
                          diterima <span className="tnum">{formatCurrency(inv.netProceeds)}</span>
                        </p>
                      )}
                    </div>
                    <ChevronRight className="h-5 w-5 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 dark:text-slate-600" />
                  </div>
                </div>

                {/* Aksi cepat — stopPropagation agar klik tidak membuka detail */}
                <div className="mt-3 flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
                  <Button variant="secondary" size="sm" onClick={() => handlePreviewQuick(inv)} disabled={busy}>
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                    Lihat PDF
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
                  {isPaid ? (
                    <span className="inline-flex items-center px-2 py-1.5 text-xs text-slate-400" title="Invoice terbayar terkunci — hanya dokumen pajak yang bisa diperbarui">
                      Terkunci
                    </span>
                  ) : (
                    <Button variant="danger-ghost" size="sm" onClick={() => handleDelete(inv)} disabled={busy}>
                      <Trash2 className="h-4 w-4" />
                      Hapus
                    </Button>
                  )}
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
          invoices={(filtered.length > 0 ? filtered : invoices).map(withDisplayNames)}
          company={company}
        />
      )}

      {taxDocsInvoice && (
        <TaxDocsModal
          isOpen={Boolean(taxDocsInvoice)}
          invoice={taxDocsInvoice}
          onClose={() => setTaxDocsInvoice(null)}
          onSaved={() => load({ silent: true })}
        />
      )}

      {pdfPreview && (
        <PdfPreview
          isOpen
          onClose={() => setPdfPreview(null)}
          blob={pdfPreview.blob}
          fileName={pdfPreview.fileName}
          title="Pratinjau Invoice"
        />
      )}

      {detailInvoice && (
        <InvoiceDetailModal
          invoice={detailInvoice}
          onClose={() => setDetailInvoice(null)}
          onEdit={(inv) => {
            setDetailInvoice(null);
            setEditInvoice(inv);
            setReviseMode(false);
          }}
          onTaxDocs={(inv) => {
            setDetailInvoice(null);
            setTaxDocsInvoice(inv);
          }}
          onMarkPaid={handleMarkPaid}
          onMarkSent={(inv) => handleStatus(inv, INVOICE_STATUS.SENT)}
          onRevise={(inv) => {
            setDetailInvoice(null);
            setEditInvoice(inv);
            setReviseMode(true);
          }}
          busy={busyId === (detailInvoice?.id || null)}
        />
      )}

      {editInvoice && (
        <InvoiceModal
          isOpen={Boolean(editInvoice)}
          revise={reviseMode}
          invoice={editInvoice}
          project={projectMap[editInvoice.projectId]}
          onClose={() => {
            setEditInvoice(null);
            setReviseMode(false);
          }}
          onSuccess={() => {
            setEditInvoice(null);
            setReviseMode(false);
            load({ silent: true });
          }}
        />
      )}
    </div>
  );
};

export default InvoicesPage;
