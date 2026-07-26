// src/components/invoices/TaxInvoicesPage.jsx
// Halaman Faktur Pajak — pusat kepatuhan e-Faktur: status tiap faktur,
// kelengkapan dokumen (Faktur→Billing→PPN→NTPN), dan ekspor XML CoreTax.
import React, { useState, useEffect, useMemo } from 'react';
import { Landmark, Search, FileCode2, CheckCircle2, Clock, TriangleAlert } from 'lucide-react';
import PageHeader from '../ui/PageHeader';
import Button from '../ui/Button';
import { Card } from '../ui/Card';
import { Input, Select } from '../ui/Field';
import { Badge } from '../ui/Badge';
import { SkeletonListPage } from '../ui/Skeleton';
import EmptyState from '../ui/EmptyState';
import StatCard from '../ui/StatCard';
import TaxDocsModal from './TaxDocsModal';
import CoretaxExportModal from './CoretaxExportModal';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { getAllInvoices, taxDocsProgress, isPpnCair } from '../../services/invoices';
import { getCompanySettings, mergeCompanyInfo } from '../../services/settings';
import { getClientMap, clientDisplayName } from '../../services/clients';

const STAGES = ['Faktur Pajak', 'Billing', 'Setor PPN', 'NTPN'];

const TaxInvoicesPage = () => {
  const [invoices, setInvoices] = useState([]);
  const [clientMap, setClientMap] = useState({});
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // all | complete | incomplete
  const [taxDocsInvoice, setTaxDocsInvoice] = useState(null);
  const [showExport, setShowExport] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [inv, cmap, settings] = await Promise.all([
        getAllInvoices(),
        getClientMap().catch(() => ({})),
        getCompanySettings().catch(() => null)
      ]);
      setInvoices(inv.filter((i) => i.status !== 'void' && (i.pajak11 ?? i.totals?.ppn) > 0));
      setClientMap(cmap);
      setCompany(mergeCompanyInfo(settings));
    } catch (err) {
      console.error('Gagal memuat faktur pajak:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const clientNameOf = (inv) =>
    clientDisplayName(clientMap[inv.clientId]) || inv.clientName || inv.client?.client_name || '—';

  const filtered = useMemo(
    () =>
      invoices.filter((inv) => {
        const done = taxDocsProgress(inv).filter((p) => p.done).length;
        if (filter === 'complete' && done < 4) return false;
        if (filter === 'incomplete' && done === 4) return false;
        if (search) {
          const s = search.toLowerCase();
          return (
            (inv.invoiceNumber || '').toLowerCase().includes(s) ||
            (inv.taxInvoiceNumber || '').includes(s) ||
            clientNameOf(inv).toLowerCase().includes(s)
          );
        }
        return true;
      }),
    [invoices, filter, search, clientMap]
  );

  const stats = useMemo(() => {
    const totalPpn = invoices.reduce((s, i) => s + (i.pajak11 ?? i.totals?.ppn ?? 0), 0);
    const cair = invoices.filter((i) => isPpnCair(i));
    const belumLengkap = invoices.filter((i) => taxDocsProgress(i).filter((p) => p.done).length < 4);
    const ppnBelumSetor = invoices
      .filter((i) => !i.taxPaidAt)
      .reduce((s, i) => s + (i.pajak11 ?? i.totals?.ppn ?? 0), 0);
    return { count: invoices.length, totalPpn, cair: cair.length, belumLengkap: belumLengkap.length, ppnBelumSetor };
  }, [invoices]);

  if (loading) return <SkeletonListPage variant="cards" stats={4} />;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Faktur Pajak"
        subtitle="Kepatuhan e-Faktur: dokumen pajak per invoice & ekspor CoreTax"
        actions={
          invoices.length > 0 && (
            <Button variant="secondary" size="sm" onClick={() => setShowExport(true)}>
              <FileCode2 className="h-4 w-4" />
              Export XML CoreTax
            </Button>
          )
        }
      />

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        <StatCard icon={Landmark} tone="brand" label="Faktur Kena Pajak" value={stats.count} sub="Invoice ber-PPN" />
        <StatCard tone="violet" label="Total PPN" value={formatCurrency(stats.totalPpn)} sub="Seluruh periode" />
        <StatCard
          tone="emerald"
          label="PPN Cair"
          value={stats.cair}
          sub="Sudah ber-NTPN"
          subTone="text-emerald-600"
        />
        <StatCard
          tone={stats.ppnBelumSetor > 0 ? 'amber' : 'emerald'}
          label="Belum Disetor"
          value={formatCurrency(stats.ppnBelumSetor)}
          sub={`${stats.belumLengkap} dokumen belum lengkap`}
          subTone={stats.ppnBelumSetor > 0 ? 'text-amber-600' : 'text-emerald-600'}
        />
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:mb-6 sm:grid-cols-3">
        <div className="relative sm:col-span-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari no. invoice, no. faktur pajak, atau klien…"
            className="pl-9"
          />
        </div>
        <Select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">Semua Faktur</option>
          <option value="incomplete">Dokumen Belum Lengkap</option>
          <option value="complete">Dokumen Lengkap</option>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Landmark}
          title={invoices.length === 0 ? 'Belum ada faktur kena pajak' : 'Tidak ada yang cocok'}
          description={
            invoices.length === 0
              ? 'Invoice dengan PPN akan muncul di sini untuk dilengkapi dokumen pajaknya.'
              : 'Coba ubah kata kunci atau filter.'
          }
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((inv) => {
            const prog = taxDocsProgress(inv);
            const done = prog.filter((p) => p.done).length;
            const cair = isPpnCair(inv);
            return (
              <Card key={inv.id} className="p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display text-sm font-semibold text-slate-900">
                        {inv.invoiceNumber}
                      </h3>
                      {cair ? (
                        <Badge tone="cyan">
                          <CheckCircle2 className="h-3 w-3" />
                          PPN Cair
                        </Badge>
                      ) : (
                        <Badge tone={done === 4 ? 'emerald' : 'amber'}>
                          <Clock className="h-3 w-3" />
                          {done}/4 dokumen
                        </Badge>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-sm text-slate-600">{clientNameOf(inv)}</p>
                    <p className="truncate text-xs text-slate-400">
                      Terbit {formatDate(inv.issueDate || inv.date)}
                      {inv.taxInvoiceNumber && ` · Faktur ${inv.taxInvoiceNumber}`}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs text-slate-400">PPN</p>
                    <p className="tnum font-display text-lg font-bold text-slate-900">
                      {formatCurrency(inv.pajak11 ?? inv.totals?.ppn ?? 0)}
                    </p>
                  </div>
                </div>

                {/* Progres 4 langkah dengan label */}
                <div className="mt-3 grid grid-cols-4 gap-1.5">
                  {prog.map((p, i) => (
                    <div key={p.key}>
                      <div
                        className={`h-1.5 rounded-full ${p.done ? 'bg-emerald-500' : 'bg-slate-200'}`}
                      />
                      <p
                        className={`mt-1 truncate text-[10px] ${
                          p.done ? 'text-emerald-600' : 'text-slate-400'
                        }`}
                      >
                        {STAGES[i]}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  {!inv.taxPaidAt && (
                    <span className="inline-flex items-center gap-1.5 text-xs text-amber-600">
                      <TriangleAlert className="h-3.5 w-3.5" />
                      PPN belum tercatat disetor
                    </span>
                  )}
                  <Button
                    variant="secondary"
                    size="sm"
                    className="ml-auto"
                    onClick={() => setTaxDocsInvoice(inv)}
                  >
                    <Landmark className="h-4 w-4" />
                    Lengkapi Dokumen
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {taxDocsInvoice && (
        <TaxDocsModal
          isOpen={Boolean(taxDocsInvoice)}
          invoice={taxDocsInvoice}
          onClose={() => setTaxDocsInvoice(null)}
          onSaved={load}
        />
      )}

      {showExport && (
        <CoretaxExportModal
          isOpen={showExport}
          onClose={() => setShowExport(false)}
          invoices={filtered.length > 0 ? filtered : invoices}
          company={company}
        />
      )}
    </div>
  );
};

export default TaxInvoicesPage;
