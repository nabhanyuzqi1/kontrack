// src/components/settings/UsersTab.jsx
// Manajemen pengguna: daftar, undang, ubah peran, hapus.
import React, { useState, useEffect } from 'react';
import { UserPlus, Trash2, ShieldCheck, Loader2, Mail } from 'lucide-react';
import { Card } from '../ui/Card';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import { Field, Input, Select } from '../ui/Field';
import { Badge } from '../ui/Badge';
import { Skeleton } from '../ui/Skeleton';
import EmptyState from '../ui/EmptyState';
import { getAllUsers, inviteUser, changeUserRole, removeUser, USER_ROLES, roleLabel } from '../../services/users';

const roleTone = { admin: 'brand', staff: 'cyan', viewer: 'slate' };

const InviteModal = ({ isOpen, onClose, onSuccess }) => {
  const [form, setForm] = useState({ email: '', name: '', role: 'staff' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleInvite = async () => {
    if (!form.email.trim()) return setError('Email wajib diisi');
    setSaving(true);
    setError('');
    try {
      await inviteUser(form);
      onSuccess?.();
      onClose?.();
    } catch (err) {
      console.error('Gagal mengundang pengguna:', err);
      setError(err?.message || 'Gagal mengundang pengguna. Pastikan email belum terdaftar.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={saving ? undefined : onClose}
      title="Undang Pengguna"
      subtitle="Akun dibuat lewat server — password diatur pengguna sendiri"
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Batal
          </Button>
          <Button onClick={handleInvite} loading={saving}>
            <Mail className="h-4 w-4" />
            {saving ? 'Mengundang…' : 'Undang'}
          </Button>
        </>
      }
    >
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
          {error}
        </div>
      )}
      <div className="space-y-4">
        <Field label="Email" required>
          <Input
            type="email"
            value={form.email}
            onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
            placeholder="nama@perusahaan.com"
          />
        </Field>
        <Field label="Nama">
          <Input
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            placeholder="Nama lengkap"
          />
        </Field>
        <Field label="Peran">
          <Select value={form.role} onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}>
            {USER_ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label} — {r.desc}
              </option>
            ))}
          </Select>
        </Field>
      </div>
    </Modal>
  );
};

const UsersTab = ({ currentUser }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      setUsers(await getAllUsers());
    } catch (err) {
      console.error('Gagal memuat pengguna:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleRoleChange = async (user, role) => {
    setBusyId(user.id);
    try {
      await changeUserRole(user.id, role, user.email);
      await load();
    } catch (err) {
      alert('Gagal mengubah peran pengguna.');
    } finally {
      setBusyId(null);
    }
  };

  const handleRemove = async (user) => {
    if (!window.confirm(`Hapus akses untuk ${user.email}?`)) return;
    setBusyId(user.id);
    try {
      await removeUser(user.id);
      await load();
    } catch (err) {
      alert('Gagal menghapus pengguna.');
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <Card className="p-5">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 py-3">
            <Skeleton className="h-9 w-9 rounded-full" />
            <div className="flex-1">
              <Skeleton className="h-3.5 w-48" />
              <Skeleton className="mt-1.5 h-3 w-32" />
            </div>
            <Skeleton className="h-8 w-28 rounded-lg" />
          </div>
        ))}
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <Card className="p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-sm font-semibold text-slate-800">Pengguna</h3>
            <p className="text-xs text-slate-400">{users.length} akun memiliki akses</p>
          </div>
          <Button variant="gradient" size="sm" onClick={() => setShowInvite(true)}>
            <UserPlus className="h-4 w-4" />
            Undang Pengguna
          </Button>
        </div>

        {users.length === 0 ? (
          <EmptyState icon={ShieldCheck} title="Belum ada pengguna" description="Undang anggota tim Anda." />
        ) : (
          <div className="divide-y divide-slate-100">
            {users.map((u) => {
              const isSelf = u.email === currentUser?.email;
              const busy = busyId === u.id;
              return (
                <div key={u.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-gradient font-display text-sm font-bold text-white">
                    {(u.name || u.email || '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 truncate text-sm font-medium text-slate-800">
                      {u.name || u.email}
                      {isSelf && <Badge tone="slate">Anda</Badge>}
                    </p>
                    <p className="truncate text-xs text-slate-400">{u.email}</p>
                  </div>
                  <Badge tone={roleTone[u.role] || 'slate'}>{roleLabel(u.role)}</Badge>
                  <div className="flex items-center gap-2">
                    <Select
                      value={u.role || 'staff'}
                      onChange={(e) => handleRoleChange(u, e.target.value)}
                      disabled={busy || isSelf}
                      className="!w-36 !py-1.5 text-xs"
                    >
                      {USER_ROLES.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </Select>
                    {busy ? (
                      <Loader2 className="h-4 w-4 animate-spin text-brand-600" />
                    ) : (
                      !isSelf && (
                        <button
                          onClick={() => handleRemove(u)}
                          className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                          title="Hapus akses"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <p className="mt-4 rounded-lg bg-slate-50 px-3.5 py-2.5 text-xs text-slate-500">
          Peran menentukan akses menu. Anda tidak dapat mengubah atau menghapus peran akun sendiri
          untuk mencegah kehilangan akses administrator.
        </p>
      </Card>

      {showInvite && (
        <InviteModal isOpen={showInvite} onClose={() => setShowInvite(false)} onSuccess={load} />
      )}
    </div>
  );
};

export default UsersTab;
