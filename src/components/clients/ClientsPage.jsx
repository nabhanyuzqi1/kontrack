// src/components/clients/ClientsPage.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import {
  Plus, Search, Users, PenLine, Trash2, Building2, Copy,
  FileText, Briefcase, ChevronRight
} from 'lucide-react';
import PageHeader from '../ui/PageHeader';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import { Badge, StatusBadge } from '../ui/Badge';
import { Input } from '../ui/Field';
import { SkeletonListPage } from '../ui/Skeleton';
import EmptyState from '../ui/EmptyState';
import ClientModal from './ClientModal';
import { getAllClients, deleteClient, clientDisplayName } from '../../services/clients';
import { getAllProjects } from '../../services/projects';
import { getAllInvoices, INVOICE_STATUS } from '../../services/invoices';
import { subscribe, CACHE_KEYS } from '../../services/cache';
import { formatCurrency } from '../../utils/formatters';

// Kunci nama seragam: data lama menyimpan relasi lewat nama (project.partner),
// data baru lewat id (invoice.clientId). Bandingkan case-insensitive supaya
// keduanya tetap terhubung tanpa migrasi.
const nameKey = (s) => String(s || '').trim().toLowerCase();

const projectBelongsTo = (client, p) =>
  p.clientId === client.id ||
  nameKey(p.partner) === nameKey(clientDisplayName(client)) ||
  nameKey(p.clientName) === nameKey(clientDisplayName(client));

const invoiceBelongsTo = (client, inv) =>
  inv.clientId === client.id ||
  nameKey(inv.clientName) === nameKey(clientDisplayName(client)) ||
  nameKey(inv.client?.client_name) === nameKey(clientDisplayName(client));

/**
 * Susun alamat tanpa pengulangan.
 *
 * Di data asli `address` sering SUDAH memuat kota dan provinsi
 * ("... Kabupaten Kotawaringin Timur, Kalimantan Tengah 74312") sementara
 * `city`/`province` juga terisi terpisah. Menggabungkan semuanya apa adanya
 * mencetak "Kasongan, Kasongan, Kalimantan Tengah, Kalimantan Tengah".
 * Bagian yang sudah muncul di address tidak diulang.
 */
const formatAddress = (c) => {
  const address = String(c.address || '').trim();
  const parts = [c.city, c.province, c.postalCode]
    .map((s) => String(s || '').trim())
    .filter(Boolean);

  if (!address) return parts.join(', ') || '-';

  const addressLower = address.toLowerCase();
  const extra = parts.filter((p) => !addressLower.includes(p.toLowerCase()));
  return [address, ...extra].join(', ');
};

// Agregat per klien: kontrak, invoice, terbayar, sisa.
const summarize = (client, projects, invoices) => {
  const projs = projects.filter((p) => projectBelongsTo(client, p));
  const invs = invoices.filter((inv) => invoiceBelongsTo(client, inv));
  const totalContract = projs.reduce((s, p) => s + (Number(p.value) || 0), 0);
  const totalInvoice = invs.reduce((s, inv) => s + (Number(inv.grandTotal) || 0), 0);
  const totalPaid = invs
    .filter((inv) => inv.status === INVOICE_STATUS.PAID)
    .reduce((s, inv) => s + (Number(inv.grandTotal) || 0), 0);
  return { projs, invs, totalContract, totalInvoice, totalPaid, remaining: totalInvoice - totalPaid };
};

const StatBox = ({ label, value, tone = '' }) => (
  <div className="min-w-0 rounded-lg border border-slate-200/70 p-3">
    <p className="text-xs text-slate-500">{label}</p>
    <p className={`tnum mt-0.5 break-words text-base font-semibold text-slate-900 ${tone}`}>
      {value}
    </p>
  </div>
);

const ClientsPage = () => {
  const [clients, setClients] = useState([]);
  const [projects, setProjects] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [detailId, setDetailId] = useState(null);
  const navigate = useNavigate();

  const load = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      // Proyek & invoice diambil sekali untuk agregat daftar; keduanya sudah
      // melewati cache-aside jadi biaya tambahan kunjungan berikutnya kecil.
      const [list, projs, invs] = await Promise.all([
        getAllClients(),
        getAllProjects().catch(() => []),
        getAllInvoices().catch(() => [])
      ]);
      list.sort((a, b) => clientDisplayName(a).localeCompare(clientDisplayName(b)));
      setClients(list);
      setProjects(projs);
      setInvoices(invs);
    } catch (err) {
      console.error('Error loading clients:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // SWR: perbarui diam-diam saat cache disegarkan di belakang layar.
    const un = subscribe(CACHE_KEYS.CLIENTS, () => load({ silent: true }));
    return () => un();
  }, []);

  const filtered = useMemo(() => {
    if (!search) return clients;
    const s = search.toLowerCase();
    return clients.filter(
      (c) =>
        clientDisplayName(c).toLowerCase().includes(s) ||
        (c.npwp || '').includes(s) ||
        (c.city || '').toLowerCase().includes(s)
    );
  }, [clients, search]);

  const detail = useMemo(
    () => clients.find((c) => c.id === detailId) || null,
    [clients, detailId]
  );
  const detailSummary = useMemo(
    () => (detail ? summarize(detail, projects, invoices) : null),
    [detail, projects, invoices]
  );

  const handleEdit = (client) => {
    setEditing(client);
    setShowModal(true);
  };

  const handleDelete = async (client) => {
    if (!window.confirm(`Hapus klien "${clientDisplayName(client)}"?`)) return;
    try {
      await deleteClient(client.id);
      if (detailId === client.id) setDetailId(null);
      await load();
    } catch (err) {
      console.error('Gagal hapus klien:', err);
      alert('Gagal menghapus klien.');
    }
  };

  const copyNpwp = (npwp) => {
    navigator.clipboard.writeText(npwp).then(() => {});
  };

  if (loading) return <SkeletonListPage variant="cards" />;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Klien & Mitra"
        subtitle={`${clients.length} klien terdaftar`}
        actions={
          <Button
            variant="gradient"
            onClick={() => {
              setEditing(null);
              setShowModal(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Tambah Klien
          </Button>
        }
      />

      <div className="relative mb-4 sm:mb-6">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari nama, NPWP, atau kota…"
          className="pl-9"
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title={clients.length === 0 ? 'Belum ada klien' : 'Tidak ada klien yang cocok'}
          description={
            clients.length === 0
              ? 'Tambahkan klien/mitra agar bisa membuat invoice.'
              : 'Coba kata kunci lain.'
          }
          action={
            clients.length === 0 && (
              <Button variant="gradient" onClick={() => setShowModal(true)}>
                <Plus className="h-4 w-4" />
                Tambah Klien Pertama
              </Button>
            )
          }
        />
      ) : (
        <div className="glass-2 overflow-hidden rounded-xl">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200/70 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3 font-medium">Klien</th>
                  <th className="hidden px-4 py-3 font-medium md:table-cell">NPWP</th>
                  <th className="hidden px-4 py-3 font-medium lg:table-cell">Kota</th>
                  <th className="px-4 py-3 text-right font-medium">Nilai Kontrak</th>
                  <th className="px-4 py-3 text-right font-medium">Sisa Tagihan</th>
                  <th className="w-20 px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => {
                  const s = summarize(c, projects, invoices);
                  return (
                    <tr
                      key={c.id}
                      onClick={() => setDetailId(c.id)}
                      className="cursor-pointer border-b border-slate-200/50 transition-colors last:border-0 hover:bg-slate-100/60"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Building2 className="hidden h-4 w-4 shrink-0 text-slate-400 sm:block" />
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-slate-900">
                              {clientDisplayName(c)}
                            </span>
                            <span className="block text-xs text-slate-400">
                              {s.projs.length} proyek · {s.invs.length} invoice
                            </span>
                          </span>
                          {c.clientType && (
                            <Badge tone="slate" className="hidden sm:inline-flex">
                              {c.clientType}
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="hidden px-4 py-3 md:table-cell">
                        {c.npwp ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              copyNpwp(c.npwp);
                            }}
                            className="tnum inline-flex items-center gap-1 text-xs text-slate-500 hover:text-brand-700"
                            title="Salin NPWP"
                          >
                            {c.npwp}
                            <Copy className="h-3 w-3" />
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </td>
                      <td className="hidden px-4 py-3 text-slate-500 lg:table-cell">
                        {[c.city, c.province].filter(Boolean).join(', ') || '-'}
                      </td>
                      <td className="tnum px-4 py-3 text-right text-slate-900">
                        {s.totalContract > 0 ? formatCurrency(s.totalContract) : '-'}
                      </td>
                      <td
                        className={`tnum px-4 py-3 text-right ${
                          s.remaining > 0 ? 'text-amber-600' : 'text-slate-400'
                        }`}
                      >
                        {s.totalInvoice > 0 ? formatCurrency(s.remaining) : '-'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEdit(c);
                            }}
                            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                            title="Edit"
                          >
                            <PenLine className="h-4 w-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(c);
                            }}
                            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-500/10 hover:text-red-600"
                            title="Hapus"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {detail && detailSummary && (
        <Modal
          isOpen
          onClose={() => setDetailId(null)}
          title={clientDisplayName(detail)}
          subtitle={detail.clientType || 'Detail Klien'}
          drawer
          footer={
            <>
              <Button variant="secondary" onClick={() => setDetailId(null)}>
                Tutup
              </Button>
              <Button
                onClick={() => {
                  setDetailId(null);
                  handleEdit(detail);
                }}
              >
                <PenLine className="h-4 w-4" />
                Edit Klien
              </Button>
            </>
          }
        >
          <div className="space-y-6">
            {/* Ringkasan keuangan */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <StatBox label="Total Nilai Kontrak" value={formatCurrency(detailSummary.totalContract)} />
              <StatBox label="Total Invoice" value={formatCurrency(detailSummary.totalInvoice)} />
              <StatBox label="Total Terbayar" value={formatCurrency(detailSummary.totalPaid)} tone="text-emerald-600" />
              <StatBox
                label="Sisa Tagihan"
                value={formatCurrency(detailSummary.remaining)}
                tone={detailSummary.remaining > 0 ? 'text-amber-600' : ''}
              />
            </div>

            {/* Identitas */}
            <section>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Identitas
              </p>
              <dl className="space-y-2 text-sm">
                {detail.npwp && (
                  <div className="flex items-start gap-2">
                    <dt className="w-28 shrink-0 text-slate-500">NPWP</dt>
                    <dd className="flex items-center gap-1">
                      <span className="tnum break-all text-slate-900">{detail.npwp}</span>
                      <button
                        onClick={() => copyNpwp(detail.npwp)}
                        className="text-slate-400 hover:text-brand-700"
                        title="Salin NPWP"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    </dd>
                  </div>
                )}
                {(detail.address || detail.city || detail.province) && (
                  <div className="flex items-start gap-2">
                    <dt className="w-28 shrink-0 text-slate-500">Alamat</dt>
                    <dd className="text-slate-900">
                      {formatAddress(detail)}
                    </dd>
                  </div>
                )}
              </dl>
            </section>

            {/* Kontak */}
            {(detail.phone || detail.email || detail.billingEmail || detail.contactPerson) && (
              <section>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Kontak
                </p>
                <dl className="space-y-2 text-sm">
                  {detail.phone && (
                    <div className="flex items-start gap-2">
                      <dt className="w-28 shrink-0 text-slate-500">Telepon</dt>
                      <dd className="tnum text-slate-900">{detail.phone}</dd>
                    </div>
                  )}
                  {detail.email && (
                    <div className="flex items-start gap-2">
                      <dt className="w-28 shrink-0 text-slate-500">Email</dt>
                      <dd className="break-all text-slate-900">{detail.email}</dd>
                    </div>
                  )}
                  {detail.billingEmail && (
                    <div className="flex items-start gap-2">
                      <dt className="w-28 shrink-0 text-slate-500">Email Tagih</dt>
                      <dd className="break-all text-slate-900">{detail.billingEmail}</dd>
                    </div>
                  )}
                  {detail.contactPerson && (
                    <div className="flex items-start gap-2">
                      <dt className="w-28 shrink-0 text-slate-500">Narahubung</dt>
                      <dd className="min-w-0 text-slate-900">
                        <span className="block">{detail.contactPerson}</span>
                        {detail.contactPosition && (
                          <span className="block text-slate-500">{detail.contactPosition}</span>
                        )}
                        {detail.contactPhone && (
                          <span className="tnum mt-1 block text-slate-500">Telp {detail.contactPhone}</span>
                        )}
                      </dd>
                    </div>
                  )}
                </dl>
              </section>
            )}

            {/* Daftar proyek */}
            <section>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Proyek ({detailSummary.projs.length})
              </p>
              {detailSummary.projs.length === 0 ? (
                <p className="text-sm text-slate-400">
                  Belum ada proyek untuk klien ini.
                </p>
              ) : (
                <div className="divide-y divide-slate-200/60 rounded-lg border border-slate-200/70">
                  {detailSummary.projs.map((p) => (
                    <Link
                      key={p.id}
                      to={`/app/projects/${p.id}`}
                      className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-slate-100/60"
                    >
                      <Briefcase className="h-4 w-4 shrink-0 text-slate-400" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium leading-snug text-slate-900">
                          {p.name}
                        </span>
                        <span className="tnum block text-xs text-slate-500">
                          {formatCurrency(Number(p.value) || 0)}
                        </span>
                      </span>
                      <StatusBadge status={p.status} />
                      <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                    </Link>
                  ))}
                </div>
              )}
            </section>

            {/* Daftar invoice */}
            <section>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Invoice ({detailSummary.invs.length})
              </p>
              {detailSummary.invs.length === 0 ? (
                <p className="text-sm text-slate-400">
                  Belum ada invoice untuk klien ini.
                </p>
              ) : (
                <div className="divide-y divide-slate-200/60 rounded-lg border border-slate-200/70">
                  {detailSummary.invs.slice(0, 10).map((inv) => (
                    <button
                      key={inv.id}
                      onClick={() => navigate('/app/invoices')}
                      className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-slate-100/60"
                    >
                      <FileText className="h-4 w-4 shrink-0 text-slate-400" />
                      <span className="min-w-0 flex-1">
                        <span className="block break-all text-sm font-medium text-slate-900">
                          {inv.invoiceNumber}
                        </span>
                        <span className="tnum block text-xs text-slate-500">
                          {formatCurrency(Number(inv.grandTotal) || 0)}
                        </span>
                      </span>
                      <Badge
                        tone={
                          inv.status === INVOICE_STATUS.PAID
                            ? 'emerald'
                            : inv.status === INVOICE_STATUS.SENT
                              ? 'blue'
                              : 'slate'
                        }
                      >
                        {inv.status === INVOICE_STATUS.PAID
                          ? 'Terbayar'
                          : inv.status === INVOICE_STATUS.SENT
                            ? 'Terkirim'
                            : 'Draft'}
                      </Badge>
                      <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                    </button>
                  ))}
                </div>
              )}
            </section>

            {detail.notes && (
              <section>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Catatan
                </p>
                <p className="text-sm text-slate-700">{detail.notes}</p>
              </section>
            )}
          </div>
        </Modal>
      )}

      {showModal && (
        <ClientModal
          isOpen={showModal}
          client={editing}
          onClose={() => {
            setShowModal(false);
            setEditing(null);
          }}
          onSuccess={load}
        />
      )}
    </div>
  );
};

export default ClientsPage;
