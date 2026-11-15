// src/components/invoices/TaxInvoicesPage.jsx
// Dasbor pemantauan pajak ala ERP: status pajak & XML tiap invoice,
// unduh/ekspor XML CoreTax per invoice maupun massal, tenggat setor
// PPN dan ringkasan PPN per bulan.
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Landmark,
  Search,
  FileCode2,
  CheckCircle2,
  Clock,
  TriangleAlert,
  Download,
  CalendarClock
} from 'lucide-react';
import PageHeader from '../ui/PageHeader';
import Button from '../ui/Button';
import { Card, CardHeader } from '../ui/Card';
import { Input, Select } from '../ui/Field';
import { Badge } from '../ui/Badge';
import { SkeletonListPage } from '../ui/Skeleton';
import EmptyState from '../ui/EmptyState';
import StatCard from '../ui/StatCard';
import TaxDocsModal from './TaxDocsModal';
import CoretaxExportModal from './CoretaxExportModal';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { getAllInvoices, markCoretaxExported, INVOICE_STATUS_LABEL } from '../../services/invoices';
import { getCompanySettings, mergeCompanyInfo } from '../../services/settings';
import { getClientMap, clientDisplayName } from '../../services/clients';
import { downloadCoretaxXml, validateForCoretax, GOODSERVICE_OPT, DEFAULT_UNIT_FOR_OPT } from '../../utils/coretaxXml';
import { monthlyTaxReport, taxDueStatus, taxDueDate } from '../../utils/reportCalc';

// Status XML CoreTax per invoice.
const XML_READY = 'ready'; // data lengkap, belum pernah diekspor
const XML_EMPTY = 'empty'; // data belum lengkap, belum bisa diekspor
const XML_DONE = 'done'; // sudah diekspor (coretaxExportedAt terisi)

const TAX_STATUS_TONE = {
  draft: 'slate',
  sent: 'blue',
  paid: 'emerald'
};

const TaxInvoicesPage = () => {
  const [invoices, setInvoices] = useState([]);
  const [clientMap, setClientMap] = useState({});
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // all | draft | sent | paid | xml-pending | xml-done
  const [taxDocsInvoice, setTaxDocsInvoice] = useState(null);
  const [showExport, setShowExport] = useState(false);
  const [selected, setSelected] = useState(() => new Set());
  const [exporting, setExporting] = useState(false);

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

  // Invoice di Firestore hanya menyimpan `clientId` (kadang objek `client` tanpa
  // NPWP). Generator XML membaca `inv.client`, jadi data klien dari koleksi
  // `clients` harus ditempelkan dulu — tanpa itu setiap faktur terlihat
  // "belum lengkap" padahal NPWP klien ada.
  const withClient = useCallback(
    (inv) => {
      const fromMap = clientMap[inv.clientId];
      const merged = { ...(fromMap || {}), ...(inv.client || {}) };
      return {
        ...inv,
        client: Object.keys(merged).length ? merged : inv.client,
        clientNpwp: inv.clientNpwp || merged.npwp,
        clientName: inv.clientName || merged.client_name || merged.name
      };
    },
    [clientMap]
  );

  const xmlStateOf = useCallback(
    (inv) => {
      if (inv.coretaxExportedAt) return XML_DONE;
      // Validasi per invoice; satuan/jenis default mengikuti CoretaxExportModal.
      const issues = validateForCoretax([withClient(inv)], company, {
        unit: DEFAULT_UNIT_FOR_OPT[GOODSERVICE_OPT.JASA],
        opt: GOODSERVICE_OPT.JASA
      });
      return issues.length === 0 ? XML_READY : XML_EMPTY;
    },
    [company, withClient]
  );

  const filtered = useMemo(
    () =>
      invoices.filter((inv) => {
        if (filter === 'draft' && inv.status !== 'draft') return false;
        if (filter === 'sent' && inv.status !== 'sent') return false;
        if (filter === 'paid' && inv.status !== 'paid') return false;
        if (filter === 'xml-pending' && xmlStateOf(inv) !== XML_READY) return false;
        if (filter === 'xml-done' && xmlStateOf(inv) !== XML_DONE) return false;
        if (search) {
          const s = search.toLowerCase();
          const hit =
            (inv.invoiceNumber || '').toLowerCase().includes(s) ||
            (inv.taxInvoiceNumber || '').toLowerCase().includes(s) ||
            clientNameOf(inv).toLowerCase().includes(s);
          if (!hit) return false;
        }
        return true;
      }),
    [invoices, filter, search, clientMap, xmlStateOf]
  );

  const stats = useMemo(() => {
    const totalPpn = invoices.reduce((s, i) => s + (i.pajak11 ?? i.totals?.ppn ?? 0), 0);
    const ppnBelumSetor = invoices
      .filter((i) => !i.taxPaidAt)
      .reduce((s, i) => s + (i.pajak11 ?? i.totals?.ppn ?? 0), 0);
    const siapEkspor = invoices.filter((i) => xmlStateOf(i) === XML_READY).length;
    const sudahEkspor = invoices.filter((i) => xmlStateOf(i) === XML_DONE).length;
    return {
      count: invoices.length,
      totalPpn,
      ppnBelumSetor,
      siapEkspor,
      sudahEkspor
    };
  }, [invoices, xmlStateOf]);

  // Ringkasan PPN & tenggat setor per bulan (tahun berjalan).
  const monthly = useMemo(() => {
    const year = new Date().getFullYear();
    const { rows, total } = monthlyTaxReport(invoices, year);
    return { year, rows, total };
  }, [invoices]);

  const toggleSelected = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const toggleAll = () =>
    setSelected((prev) => (prev.size === filtered.length ? new Set() : new Set(filtered.map((i) => i.id))));

  // Unduh ulang XML satu invoice; tandai coretaxExportedAt setelah berhasil.
  const handleDownloadXml = async (inv) => {
    downloadCoretaxXml([withClient(inv)], company, { trxCode: '04', opt: GOODSERVICE_OPT.JASA, vatRate: 12 });
    try {
      setExporting(true);
      await markCoretaxExported([inv.id]);
      await load();
    } catch (err) {
      console.error('Gagal menandai ekspor XML:', err);
    } finally {
      setExporting(false);
    }
  };

  if (loading) return <SkeletonListPage variant="cards" stats={4} />;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Pajak"
        subtitle="Pemantauan PPN per invoice, ekspor XML CoreTax, dan tenggat setor per masa"
        actions={
          invoices.length > 0 && (
            <Button variant="secondary" size="sm" onClick={() => setShowExport(true)}>
              <FileCode2 className="h-4 w-4" />
              Ekspor XML Massal
            </Button>
          )
        }
      />

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        <StatCard icon={Landmark} tone="brand" label="Faktur Kena Pajak" value={stats.count} sub="Invoice ber-PPN" />
        <StatCard tone="violet" label="Total PPN" value={formatCurrency(stats.totalPpn)} sub="Seluruh periode" />
        <StatCard
          tone={stats.ppnBelumSetor > 0 ? 'amber' : 'emerald'}
          label="Belum Disetor"
          value={formatCurrency(stats.ppnBelumSetor)}
          sub={stats.ppnBelumSetor > 0 ? 'Belum tercatat disetor' : 'Semua sudah disetor'}
          subTone={stats.ppnBelumSetor > 0 ? 'text-amber-600' : 'text-emerald-600'}
        />
        <StatCard
          icon={FileCode2}
          tone="cyan"
          label="XML CoreTax"
          value={`${stats.sudahEkspor}/${stats.count}`}
          sub={`${stats.siapEkspor} siap diekspor`}
        />
      </div>

      {/* Ringkasan PPN per masa + tenggat setor */}
      <Card className="mb-5">
        <CardHeader title={`PPN & Tenggat Setor ${monthly.year}`} />
        <div className="custom-scrollbar overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-slate-50/70">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Masa</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-400">Faktur</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-400">PPN Terhutang</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Tenggat Setor</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/60">
              {monthly.rows.map((r) => {
                const empty = r.invoiceCount === 0 && r.ppnDisetor === 0;
                const due = empty ? null : taxDueStatus(monthly.year, r.month, r.ppnTerhutang - r.ppnDisetor);
                return (
                  <tr key={r.month} className={empty ? 'text-slate-300' : 'hover:bg-slate-50/60'}>
                    <td className="whitespace-nowrap px-4 py-2.5 text-sm font-medium text-slate-700">
                      {r.label} {monthly.year}
                    </td>
                    <td className="tnum px-4 py-2.5 text-right text-sm text-slate-500">{r.invoiceCount || '—'}</td>
                    <td className="tnum px-4 py-2.5 text-right text-sm text-slate-700">
                      {r.ppnTerhutang ? formatCurrency(r.ppnTerhutang) : '—'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-sm text-slate-500">
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarClock className="h-3.5 w-3.5" />
                        {formatDate(taxDueDate(monthly.year, r.month))}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-sm">
                      {due ? (
                        <Badge
                          tone={due.state === 'telat' ? 'red' : due.state === 'jalan' ? 'amber' : due.state === 'lebih' ? 'violet' : 'emerald'}
                        >
                          {due.state === 'jalan' ? `${due.daysLeft} hari lagi` : due.label}
                        </Badge>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

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
          <option value="draft">Draft</option>
          <option value="sent">Terbit</option>
          <option value="paid">Dibayar</option>
          <option value="xml-pending">XML: siap diekspor</option>
          <option value="xml-done">XML: sudah diekspor</option>
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
        <Card>
          <div className="custom-scrollbar overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50/70">
                <tr>
                  <th className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={filtered.length > 0 && selected.size === filtered.length}
                      onChange={toggleAll}
                      className="h-4 w-4 rounded border-slate-300 text-brand-700 focus:ring-brand-500"
                      aria-label="Pilih semua"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Invoice</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Terbit</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-400">PPN</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">XML CoreTax</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-400">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/60">
                {filtered.map((inv) => {
                  const xml = xmlStateOf(inv);
                  return (
                    <tr key={inv.id} className="hover:bg-slate-50/60">
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selected.has(inv.id)}
                          onChange={() => toggleSelected(inv.id)}
                          className="h-4 w-4 rounded border-slate-300 text-brand-700 focus:ring-brand-500"
                          aria-label={`Pilih ${inv.invoiceNumber}`}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-semibold text-slate-900">{inv.invoiceNumber}</p>
                        <p className="text-xs text-slate-500">{clientNameOf(inv)}</p>
                        {inv.taxInvoiceNumber && (
                          <p className="text-xs text-slate-400">Faktur {inv.taxInvoiceNumber}</p>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">
                        {formatDate(inv.issueDate || inv.date)}
                      </td>
                      <td className="tnum whitespace-nowrap px-4 py-3 text-right text-sm font-semibold text-slate-900">
                        {formatCurrency(inv.pajak11 ?? inv.totals?.ppn ?? 0)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <Badge tone={TAX_STATUS_TONE[inv.status] || 'slate'}>
                          {INVOICE_STATUS_LABEL[inv.status] || inv.status}
                        </Badge>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {xml === XML_DONE ? (
                          <Badge tone="emerald">
                            <CheckCircle2 className="h-3 w-3" />
                            Diekspor {formatDate(inv.coretaxExportedAt)}
                          </Badge>
                        ) : xml === XML_READY ? (
                          <Badge tone="cyan">
                            <FileCode2 className="h-3 w-3" />
                            Siap diekspor
                          </Badge>
                        ) : (
                          <Badge tone="slate">
                            <TriangleAlert className="h-3 w-3" />
                            Data belum lengkap
                          </Badge>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <div className="flex justify-end gap-1.5">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleDownloadXml(inv)}
                            disabled={exporting || xml === XML_EMPTY}
                            title={xml === XML_EMPTY ? 'Lengkapi data invoice (NPWP klien, nilai) sebelum ekspor' : 'Unduh XML CoreTax invoice ini'}
                          >
                            <Download className="h-4 w-4" />
                            XML
                          </Button>
                          <Button variant="secondary" size="sm" onClick={() => setTaxDocsInvoice(inv)}>
                            <Landmark className="h-4 w-4" />
                            Dokumen
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {selected.size > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-4 py-3">
              <p className="text-sm text-slate-600">
                <span className="font-semibold">{selected.size}</span> invoice dipilih
              </p>
              <Button size="sm" onClick={() => setShowExport(true)}>
                <FileCode2 className="h-4 w-4" />
                Ekspor XML Terpilih
              </Button>
            </div>
          )}
        </Card>
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
          invoices={(selected.size > 0 ? filtered.filter((i) => selected.has(i.id)) : filtered.length > 0 ? filtered : invoices).map(
            withClient
          )}
          company={company}
        />
      )}
    </div>
  );
};

export default TaxInvoicesPage;
