// src/components/developer/DeveloperPage.jsx
//
// Konsol developer: semua yang berkaitan dengan cara APLIKASI dibangun dan
// dioperasikan, bukan dengan cara perusahaan memakainya.
//
// Sebab dipisahkan dari Pengaturan: sebelumnya tab "Dokumen & Data" dan
// "Notifikasi" tampil untuk administrator klien, padahal isinya nama secret
// (SMTP_USER, WA_TOKEN), alamat gateway, dan kesehatan koleksi Firestore.
// Itu milik developer/platform, bukan milik pengguna SaaS.
//
// Halaman ini hanya untuk peran `superadmin` (lihat utils/access.js) dan
// dijaga dua lapis: rute di App.jsx menolak selain developer, dan pemanggilan
// Cloud Function untuk mengirim surel/WhatsApp tetap divalidasi di server.
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Database,
  Mail,
  ShieldCheck,
  Wrench,
  Terminal
} from 'lucide-react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import NotifySettings from '../settings/NotifySettings';
import DataSettings from '../settings/DataSettings';

const TABS = [
  { key: 'channels', label: 'Kanal Keluar', icon: Mail },
  { key: 'data', label: 'Data & Retensi', icon: Database },
  { key: 'security', label: 'Keamanan', icon: ShieldCheck }
];

const ENV_ROWS = [
  { key: 'VITE_FIREBASE_PROJECT_ID', label: 'Project ID', note: 'Firestore database `kontrack`, region asia-southeast2' },
  { key: 'VITE_FIREBASE_AUTH_DOMAIN', label: 'Auth Domain', note: 'Wajib domain default untuk popup Google' },
  { key: 'VITE_FUNCTIONS_REGION', label: 'Region Functions', note: 'Tidak boleh mengandalkan default us-central1' },
  { key: 'VITE_STORAGE_BUCKET', label: 'Storage Bucket', note: 'Bucket `kontrack` tanpa sufiks .firebasestorage.app' }
];

const envValue = (key) => {
  try {
    return import.meta.env[key] || '(tidak diset)';
  } catch {
    return '(tidak diset)';
  }
};

const Section = ({ title, desc, children, icon: Icon }) => (
  <Card className="p-5">
    <div className="mb-3 flex items-start gap-2.5">
      {Icon && <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />}
      <div className="min-w-0">
        <h3 className="font-display text-sm font-semibold text-slate-800">{title}</h3>
        {desc && <p className="mt-0.5 text-xs text-slate-500">{desc}</p>}
      </div>
    </div>
    {children}
  </Card>
);

const DeveloperPage = ({ currentUser }) => {
  const [tab, setTab] = useState('channels');
  const [form, setForm] = useState({});
  const set = (key) => (val) => setForm((p) => ({ ...p, [key]: val }));
  const setNotif = (val) => setForm((p) => ({ ...p, notif: val }));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <Badge tone="amber">Developer</Badge>
            <span className="text-xs text-slate-400">{currentUser?.email}</span>
          </div>
          <h1 className="font-display text-xl font-bold tracking-tight text-slate-900">Konsol Developer</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Setelan teknis aplikasi. Tidak ditampilkan di sisi pengguna karena berisi nama secret,
            alamat gateway, dan kondisi infrastruktur.
          </p>
        </div>
        <Link
          to="/app"
          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-500/10 hover:text-slate-700"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Kembali ke aplikasi
        </Link>
      </div>

      <div className="flex items-center gap-1 overflow-hidden border-b border-slate-200/70 dark:border-white/10">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`-mb-px flex items-center gap-1.5 border-b-2 px-3 pb-2 pt-1 text-[13px] font-medium transition-colors ${
              tab === key
                ? 'border-brand-600 text-brand-700 dark:text-brand-300'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {tab === 'channels' && <NotifySettings form={form} set={set} setNotif={setNotif} />}

      {tab === 'data' && (
        <div className="space-y-4">
          <DataSettings form={form} set={set} />
        </div>
      )}

      {tab === 'security' && (
        <div className="space-y-4">
          <Section
            title="Lingkungan aplikasi"
            desc="Nilai yang tertanam saat build. Hanya penanda, bukan kredensial."
            icon={Terminal}
          >
            <div className="space-y-1.5">
              {ENV_ROWS.map((r) => (
                <div key={r.key} className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-200/50 py-1.5 last:border-0 dark:border-white/5">
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-slate-700">{r.label}</p>
                    <p className="text-xs text-slate-400">{r.note}</p>
                  </div>
                  <code className="rounded bg-slate-500/10 px-1.5 py-0.5 text-xs text-slate-600">
                    {envValue(r.key)}
                  </code>
                </div>
              ))}
            </div>
          </Section>

          <Section
            title="Batas kepercayaan"
            desc="Yang ditegakkan di server, bukan di tampilan."
            icon={ShieldCheck}
          >
            <ul className="space-y-1.5 text-[13px] text-slate-600">
              <li>Koleksi Firestore dibatasi per koleksi; tidak ada aturan longgar untuk seluruh dokumen.</li>
              <li>Penghitung kuota AI tertutup dari klien; hanya Cloud Function yang menulis.</li>
              <li>Kirim surel/WhatsApp divalidasi ulang di server, tidak bergantung pada tombol yang disembunyikan.</li>
              <li>Halaman ini hanya terbuka untuk peran superadmin; klien tidak melihatnya di navigasi.</li>
            </ul>
          </Section>

          <Section
            title="Tindakan pemilik"
            desc="Langkah yang tidak boleh dijalankan dari aplikasi."
            icon={Wrench}
          >
            <ul className="space-y-1.5 text-[13px] text-slate-500">
              <li>Mengaktifkan Google Sign-In di Firebase Console (Authentication &rarr; Sign-in method).</li>
              <li>Mengganti secret kanal keluar lewat CLI: <code className="rounded bg-slate-500/10 px-1">firebase functions:secrets:set</code>.</li>
              <li>Merotasi kredensial yang pernah terekspos.</li>
            </ul>
          </Section>
        </div>
      )}
    </div>
  );
};

export default DeveloperPage;
