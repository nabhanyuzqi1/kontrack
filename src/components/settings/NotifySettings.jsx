// src/components/settings/NotifySettings.jsx
// Tab Notifikasi: keadaan nyata kanal keluar (email & WhatsApp).
//
// Panel lama hanya meminta URL webhook dan menaruh contoh payload. Itu membuat
// pemilik mengira notifikasi sudah berjalan padahal gateway-nya belum ada.
// Tab ini menampilkan: kanal mana yang aktif, lewat mana pesan dikirim, dan
// yang paling penting — kalimat jujur bila kanal belum disetel server.

import React, { useEffect, useState } from 'react';
import { Bell, Mail, MessageCircle, CheckCircle2, AlertTriangle, Loader2, Send, Info } from 'lucide-react';
import { Card } from '../ui/Card';
import Button from '../ui/Button';
import { Field, Input } from '../ui/Field';
import { notifyByEmail, sendWhatsApp, getNotifyChannels } from '../../services/notify';

const StatusPill = ({ ok, label }) => (
  <span
    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${
      ok
        ? 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-400'
        : 'bg-amber-500/12 text-amber-700 dark:text-amber-400'
    }`}
  >
    {ok ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
    {label}
  </span>
);

const NotifySettings = ({ form, set, setNotif }) => {
  const [status, setStatus] = useState(null);
  const [checking, setChecking] = useState(true);
  const [testing, setTesting] = useState('');
  const [result, setResult] = useState('');

  const load = async () => {
    setChecking(true);
    try {
      setStatus(await getNotifyChannels());
    } catch (err) {
      setStatus({ email: false, whatsapp: false, error: err?.message });
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const runTest = async (channel) => {
    setTesting(channel);
    setResult('');
    try {
      if (channel === 'email') {
        const to = form.email || '';
        if (!to) {
          setResult('Isi email perusahaan di tab Perusahaan lebih dulu.');
          return;
        }
        const res = await notifyByEmail({
          kind: 'user',
          subject: 'Uji kanal email Kontrack',
          summary: 'Uji kirim email dari halaman Pengaturan. Bila Anda menerima pesan ini, kanal email sudah benar.',
          url: '/app/settings',
          to: [to]
        });
        setResult(res?.sent ? `Email uji terkirim ke ${to}.` : res?.reason || 'Email uji gagal.');
      } else {
        const to = form.notifications?.waTestNumber || form.phone || '';
        const res = await sendWhatsApp({
          to,
          message: 'Uji kanal WhatsApp Kontrack. Bila pesan ini diterima, gateway sudah benar.'
        });
        setResult(res?.sent ? 'Pesan WhatsApp uji terkirim.' : res?.reason || 'WhatsApp belum disetel.');
      }
    } finally {
      setTesting('');
    }
  };

  return (
    <div className="space-y-5">
      <Card className="p-4 sm:p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-sm font-semibold text-slate-800">Kanal Pemberitahuan</h3>
            <p className="mt-0.5 text-xs text-slate-400">
              Pesan dikirim dari server Kontrack, bukan dari perangkat atau nomor pribadi pengguna.
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={load} disabled={checking}>
            {checking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Periksa Ulang
          </Button>
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-3.5 dark:border-white/10">
            <div className="flex items-start gap-3">
              <Mail className="mt-0.5 h-4 w-4 text-slate-500" />
              <div>
                <p className="text-sm font-medium text-slate-800">Email</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Undangan pengguna, pengingat tagihan, dan ringkasan perubahan lewat SMTP perusahaan.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {checking ? (
                <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
              ) : (
                <StatusPill ok={Boolean(status?.email)} label={status?.email ? 'Aktif' : 'Belum disetel'} />
              )}
              <Button variant="secondary" size="sm" onClick={() => runTest('email')} loading={testing === 'email'}>
                <Send className="h-3.5 w-3.5" />
                Uji
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-3.5 dark:border-white/10">
            <div className="flex items-start gap-3">
              <MessageCircle className="mt-0.5 h-4 w-4 text-slate-500" />
              <div>
                <p className="text-sm font-medium text-slate-800">WhatsApp</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Dikirim dari nomor resmi Kontrack lewat gateway server-side (Cloud API resmi atau gateway
                  tidak resmi milik perusahaan).
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {checking ? (
                <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
              ) : (
                <StatusPill
                  ok={Boolean(status?.whatsapp)}
                  label={
                    status?.whatsapp
                      ? status?.whatsappMode === 'cloud'
                        ? 'Cloud API'
                        : 'Gateway'
                      : 'Belum disetel'
                  }
                />
              )}
              <Button
                variant="secondary"
                size="sm"
                onClick={() => runTest('wa')}
                loading={testing === 'wa'}
                disabled={!status?.whatsapp}
              >
                <Send className="h-3.5 w-3.5" />
                Uji
              </Button>
            </div>
          </div>
        </div>

        {result && (
          <p className="mt-3 rounded-lg bg-slate-500/8 px-3.5 py-2.5 text-xs text-slate-600">{result}</p>
        )}

        {!checking && (!status?.email || !status?.whatsapp) && (
          <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/8 p-3.5">
            <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
              Ada kanal yang belum siap
            </p>
            <p className="mt-1 text-xs text-slate-600">
              Penyiapan memerlukan kredensial, sehingga hanya pemilik yang boleh melakukannya:
            </p>
            <ul className="mt-2 space-y-1.5 text-xs text-slate-600">
              {!status?.email && (
                <li className="flex items-start gap-2">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-400" />
                  <span>
                    Email: setel secret <code className="rounded bg-slate-500/10 px-1">SMTP_USER</code> dan{' '}
                    <code className="rounded bg-slate-500/10 px-1">SMTP_PASS</code> (Gmail App Password), lalu deploy
                    ulang functions.
                  </span>
                </li>
              )}
              {!status?.whatsapp && (
                <li className="flex items-start gap-2">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-400" />
                  <span>
                    WhatsApp: setel <code className="rounded bg-slate-500/10 px-1">WA_GATEWAY_URL</code> (gateway
                    sendiri) atau <code className="rounded bg-slate-500/10 px-1">WA_TOKEN</code> +{' '}
                    <code className="rounded bg-slate-500/10 px-1">WA_PHONE_ID</code> (Cloud API resmi).
                  </span>
                </li>
              )}
            </ul>
          </div>
        )}
      </Card>

      <Card className="p-4 sm:p-5">
        <h3 className="font-display text-sm font-semibold text-slate-800">Preferensi Notifikasi</h3>
        <p className="mb-4 mt-0.5 text-xs text-slate-400">
          Dipakai saat aplikasi mengirim pemberitahuan otomatis.
        </p>

        <div className="space-y-3">
          {[
            { key: 'onPaid', label: 'Saat invoice ditandai terbayar', desc: 'Kirim ringkasan ke admin.' },
            { key: 'onOverdue', label: 'Saat tagihan lewat jatuh tempo', desc: 'Kirim pengingat ke klien.' },
            { key: 'onInvite', label: 'Saat pengguna baru diundang', desc: 'Kirim email undangan.' },
            { key: 'onTaxDue', label: 'Menjelang tenggat SPT Masa PPN', desc: 'Ingatkan pemilik 7 dan 3 hari sebelumnya.' }
          ].map((row) => (
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
      </Card>

      <Card className="p-4 sm:p-5">
        <div className="mb-3 flex items-start gap-2.5">
          <Bell className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" />
          <div>
            <h3 className="font-display text-sm font-semibold text-slate-800">Notifikasi dalam Aplikasi</h3>
            <p className="mt-0.5 text-xs text-slate-400">
              Muncul di lonceng header. Diurutkan berdasarkan urgensi dan bisa ditindak langsung dari panelnya.
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

      <Card className="p-4 sm:p-5">
        <h3 className="mb-1 font-display text-sm font-semibold text-slate-800">Penerima Cadangan</h3>
        <p className="mb-4 text-xs text-slate-400">
          Alamat ini menerima salinan pemberitahuan penting bila kanal di atas aktif. Pisahkan dengan koma.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Email Admin">
            <Input
              value={form.notifications?.adminEmail || ''}
              onChange={(e) => setNotif('adminEmail', e.target.value)}
              placeholder="admin@perusahaan.com"
            />
          </Field>
          <Field label="Nomor WhatsApp Uji">
            <Input
              value={form.notifications?.waTestNumber || ''}
              onChange={(e) => setNotif('waTestNumber', e.target.value)}
              placeholder="0812…"
            />
          </Field>
        </div>
        <div className="mt-4 flex items-start gap-2 rounded-lg bg-slate-50 px-3.5 py-2.5 text-xs text-slate-500">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p>
            Kirim WhatsApp dari Kontrack masuk ke nomor klien lewat nomor resmi Kontrack. Balasan dari klien masuk ke
            perangkat yang menjalankan gateway, jadi pastikan perangkat itu memang dipantau.
          </p>
        </div>
      </Card>
    </div>
  );
};

export default NotifySettings;
