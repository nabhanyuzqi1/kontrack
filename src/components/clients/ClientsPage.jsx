// src/components/clients/ClientsPage.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Search, Users, PenLine, Trash2, Building2, Copy } from 'lucide-react';
import PageHeader from '../ui/PageHeader';
import Button from '../ui/Button';
import { Card } from '../ui/Card';
import { Input } from '../ui/Field';
import { Badge } from '../ui/Badge';
import { SkeletonListPage } from '../ui/Skeleton';
import EmptyState from '../ui/EmptyState';
import ClientModal from './ClientModal';
import { getAllClients, deleteClient, clientDisplayName } from '../../services/clients';

const ClientsPage = () => {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const list = await getAllClients();
      list.sort((a, b) => clientDisplayName(a).localeCompare(clientDisplayName(b)));
      setClients(list);
    } catch (err) {
      console.error('Error loading clients:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
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

  const handleEdit = (client) => {
    setEditing(client);
    setShowModal(true);
  };

  const handleDelete = async (client) => {
    if (!window.confirm(`Hapus klien "${clientDisplayName(client)}"?`)) return;
    try {
      await deleteClient(client.id);
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
        <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-2">
          {filtered.map((c) => (
            <Card key={c.id} hover className="p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="mt-0.5 shrink-0 rounded-lg bg-brand-50 p-2 text-brand-600">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate font-display text-sm font-semibold text-slate-900">
                        {clientDisplayName(c)}
                      </h3>
                      {c.clientType && <Badge tone="slate">{c.clientType}</Badge>}
                    </div>
                    {c.npwp && (
                      <button
                        onClick={() => copyNpwp(c.npwp)}
                        className="mt-1 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-brand-600"
                        title="Salin NPWP"
                      >
                        NPWP {c.npwp}
                        <Copy className="h-3 w-3" />
                      </button>
                    )}
                    {(c.city || c.province) && (
                      <p className="mt-0.5 truncate text-xs text-slate-400">
                        {[c.city, c.province].filter(Boolean).join(', ')}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    onClick={() => handleEdit(c)}
                    className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                    title="Edit"
                  >
                    <PenLine className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(c)}
                    className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                    title="Hapus"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
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
