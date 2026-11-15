// src/components/settings/NotificationPreferences.jsx
//
// Preferensi notifikasi milik PENGGUNA: pemberitahuan apa yang ingin diterima.
// Tidak memuat nama secret, gateway, atau status koneksi server.
//
// Isi yang benar-benar teknis (kesiapan kanal, secret SMTP, gateway WhatsApp,
// uji kirim) ada di /app/developer — lihat components/settings/NotifySettings.jsx.
import React from 'react';
import { Card } from '../ui/Card';
import { Field, Input } from '../ui/Field';
import { Bell } from 'lucide-react';

const ROWS = [
  { key: 'onPaid', label: 'Saat invoice ditandai terbayar', desc: 'Ringkasan dikirim ke admin.' },
  { key: 'onOverdue', label: 'Saat tagihan lewat jatuh tempo', desc: 'Pengingat dikirim ke klien.' },
  { key: 'onInvite', label: 'Saat pengguna baru diundang', desc: 'Surel undangan dikirim.' },
  { key: 'onTaxDue', label: 'Menjelang tenggat SPT Masa PPN', desc: 'Diingatkan 7 dan 3 hari sebelumnya.' }
];

const NotificationPreferences = ({ form, setNotif }) => (
  <div className="space-y-4">
    <Card className="p-4 sm:p-5">
      <h3 className="font-display text-sm font-semibold text-slate-800">Pemberitahuan yang Diterima</h3>
      <p className="mb-4 mt-0.5 text-xs text-slate-400">
        Pilih kejadian yang perlu Anda ketahui. Pengirimannya memakai kanal yang sudah disiapkan admin platform.
      </p>

      <div className="space-y-3">
        {ROWS.map((row) => (
          <label
            key={row.key}
            className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-slate-200 p-3 dark:border-white/10"
          >
            <input
              type="checkbox"
              checked={form.notifications?.[row.key] !== false}
              onChange={(e) => setNotif(row.key, e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-700 focus:ring-brand-500"
            />
            <span className="text-sm text-slate-600">
              <span className="font-medium text-slate-800">{row.label}</span>
              <span className="mt-0.5 block text-xs text-slate-500">{row.desc}</span>
            </span>
          </label>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Email Admin">
          <Input
            value={form.notifications?.adminEmail || ''}
            onChange={(e) => setNotif('adminEmail', e.target.value)}
            placeholder="admin@perusahaan.com"
          />
        </Field>
        <Field label="Nomor WhatsApp">
          <Input
            value={form.notifications?.waTestNumber || ''}
            onChange={(e) => setNotif('waTestNumber', e.target.value)}
            placeholder="0812…"
          />
        </Field>
      </div>
    </Card>

    <Card className="p-4 sm:p-5">
      <div className="mb-3 flex items-start gap-2.5">
        <Bell className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" />
        <div>
          <h3 className="font-display text-sm font-semibold text-slate-800">Notifikasi dalam Aplikasi</h3>
          <p className="mt-0.5 text-xs text-slate-400">
            Muncul di lonceng header, diurutkan menurut urgensi, dan bisa ditindak langsung.
          </p>
        </div>
      </div>
      <div className="space-y-2 text-xs text-slate-600">
        <p className="flex items-start gap-2">
          <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-400" />
          Proyek yang lewat tenggat atau akan berakhir dalam 14 hari.
        </p>
        <p className="flex items-start gap-2">
          <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-400" />
          Invoice terkirim yang belum dibayar, urut lama menunggu.
        </p>
        <p className="flex items-start gap-2">
          <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-400" />
          PPN yang belum disetor dan tenggat SPT Masa bulan berjalan.
        </p>
      </div>
    </Card>
  </div>
);

export default NotificationPreferences;
