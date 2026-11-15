// src/components/settings/UsersTab.jsx
// Manajemen pengguna: daftar, undang, ubah peran, hapus.
//
// Pelajaran dari akun ganda: undangan kini memakai ulang dokumen `users` yang
// sudah ada dan melaporkan status emailnya apa adanya. Jangan pernah menulis
// "email terkirim" bila server hanya bilang "SMTP belum disetel".
import React, { useState, useEffect } from 'react';
import { UserPlus, Trash2, ShieldCheck, Loader2, Mail, MailX, Link2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Card } from '../ui/Card';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import { Field, Input, Select } from '../ui/Field';
import { Badge } from '../ui/Badge';
import { Skeleton } from '../ui/Skeleton';
import EmptyState from '../ui/EmptyState';
import { getAllUsers, inviteUser, changeUserRole, removeUser, USER_ROLES, roleLabel } from '../../services/users';

const roleTone = { admin: 'brand', staff: 'cyan', viewer: 'slate', superadmin: 'amber' };

const InviteModal = ({ isOpen, onClose, onSuccess }) => {
  const [form, setForm] = useState({ email: '', name: '', role: 'staff' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const close = () => {
    setForm({ email: '', name: '', role: 'staff' });
    setError('');
    setResult(null);
    onClose?.();
  };

  const handleInvite = async () => {
    const email = form.email.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return setError('Alamat email tidak valid');
    setSaving(true);
    setError('');
    try {
      const data = await inviteUser({ ...form, email });
      setResult(data || {});
      onSuccess?.();
    } catch (err) {
      console.error('Gagal mengundang pengguna:', err);
      const code = err?.code || '';
      const message = String(err?.message || '');
      if (code.includes('failed-precondition') || message.includes('terikat akun lain')) {
        setError('Email ini sudah terhubung ke dokumen pengguna lain. Periksa daftar di bawah sebelum mengundang ulang.');
      } else if (code.includes('permission-denied')) {
        setError('Anda tidak berwenang mengundang pengguna.');
      } else {
        setError(message || 'Gagal mengundang pengguna.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={saving ? undefined : close}
      title={result ? 'Undangan Diproses' : 'Undang Pengguna'}
      subtitle={
        result
          ? 'Akun dibuat di server; kata sandi diatur pengguna sendiri'
          : 'Email yang sudah terdaftar akan dipakai ulang, bukan dibuat ganda'
      }
      size="md"
      footer={
        result ? (
          <Button onClick={close}>Selesai</Button>
        ) : (
          <>
            <Button variant="secondary" onClick={close} disabled={saving}>
              Batal
            </Button>
            <Button onClick={handleInvite} loading={saving}>
              <Mail className="h-4 w-4" />
              {saving ? 'Mengundang…' : 'Kirim Undangan'}
            </Button>
          </>
        )
      }
    >
      {result ? (
        <div className="space-y-3">
          <div className="flex items-start gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-3">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            <div className="text-sm text-slate-700">
              <p className="font-medium">
                {result.reused ? 'Pengguna lama diperbarui' : 'Pengguna ditambahkan'}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                {result.accountCreated
                  ? 'Akun login baru dibuat. Pengguna masuk dengan "Lupa password" atau Google memakai email ini.'
                  : 'Akun login sudah ada dan dipakai ulang.'}
              </p>
            </div>
          </div>
          {result.emailSent ? (
            <div className="flex items-start gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-3">
              <Mail className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              <p className="text-sm text-slate-700">Email undangan terkirim.</p>
            </div>
          ) : (
            <div className="flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3.5 py-3">
              <MailX className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <div className="text-sm text-slate-700">
                <p className="font-medium">Email undangan belum terkirim</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {result.emailError || 'SMTP belum disetel.'} Sampaikan tautan masuk secara manual.
                </p>
                <p className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-600">
                  <Link2 className="h-3.5 w-3.5" />
                  kontrack.web.app/login
                </p>
              </div>
            </div>
          )}
        </div>
      ) : (
        <>
          {error && (
            <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-700">
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
                autoComplete="off"
              />
            </Field>
            <Field label="Nama" hint="Dipakai di email undangan; kosongkan untuk memakai bagian depan email">
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
        </>
      )}
    </Modal>
  );
};

/** Kelompokkan dokumen pengguna beremail sama (indikasi akun ganda). */
const findDuplicates = (users) => {
  const byEmail = new Map();
  users.forEach((u) => {
    const key = String(u.email || '').toLowerCase();
    if (!key) return;
    byEmail.set(key, [...(byEmail.get(key) || []), u]);
  });
  return [...byEmail.values()].filter((group) => group.length > 1);
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

  const duplicates = findDuplicates(users);

  return (
    <div className="space-y-5">
      {duplicates.length > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div className="text-sm text-slate-700">
            <p className="font-medium">{duplicates.length} email punya lebih dari satu dokumen pengguna</p>
            <p className="mt-0.5 text-xs text-slate-500">
              Penyebabnya undangan lama yang tidak membuat akun login. Sisakan dokumen dengan peran benar, lalu hapus
              yang lain. Login berikutnya otomatis memakai dokumen yang tersisa.
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {duplicates.map((g) => g[0].email).slice(0, 4).join(', ')}
              {duplicates.length > 4 ? `, dan ${duplicates.length - 4} lainnya` : ''}
            </p>
          </div>
        </div>
      )}

      <Card className="p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-sm font-semibold text-slate-800">Pengguna</h3>
            <p className="text-xs text-slate-400">
              {users.length} akun memiliki akses · {users.filter((u) => !u.uid).length} belum pernah masuk
            </p>
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
                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-800">
                      <span className="truncate">{u.name || u.email}</span>
                      {isSelf && <Badge tone="slate">Anda</Badge>}
                      {!u.uid && <Badge tone="amber">Belum masuk</Badge>}
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
                      <Loader2 className="h-4 w-4 animate-spin text-brand-700" />
                    ) : (
                      !isSelf && (
                        <button
                          onClick={() => handleRemove(u)}
                          className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-500/10 dark:hover:bg-red-500/10 hover:text-red-600"
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
          Peran menentukan akses menu. Anda tidak dapat mengubah atau menghapus peran akun sendiri untuk mencegah
          kehilangan akses administrator.
        </p>
      </Card>

      {showInvite && <InviteModal isOpen={showInvite} onClose={() => setShowInvite(false)} onSuccess={load} />}
    </div>
  );
};

export default UsersTab;
