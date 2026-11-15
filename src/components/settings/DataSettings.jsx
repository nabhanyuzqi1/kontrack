// src/components/settings/DataSettings.jsx
// Tab Dokumen & Data: nomor urut dokumen, arsip, dan tindakan pemeliharaan.
//
// Semua tombol di sini hanya MERINGKAS atau MEMBACA; tidak ada yang menghapus
// data. Praktik yang dipakai saat audit Firestore: cadangkan dulu, hitung
// sebelum vs sesudah, baru simpulkan.

import React, { useState } from 'react';
import {
  FileText,
  Database,
  Download,
  Loader2,
  AlertTriangle,
  Archive,
  CheckCircle2
} from 'lucide-react';
import { Card } from '../ui/Card';
import Button from '../ui/Button';
import { Field, Input } from '../ui/Field';
import { getAllInvoices } from '../../services/invoices';
import { getAllProjects } from '../../services/projects';
import { getAllClients } from '../../services/clients';
import { getCompanySettings } from '../../services/settings';

const countRows = async () => {
  const [invoices, projects, clients, settings] = await Promise.all([
    getAllInvoices().catch(() => []),
    getAllProjects().catch(() => []),
    getAllClients().catch(() => []),
    getCompanySettings().catch(() => null)
  ]);
  return {
    invoices: invoices.length,
    projects: projects.length,
    clients: clients.length,
    hasProfile: Boolean(settings?.companyName),
    archived: invoices.filter((i) => i.taxPaidAt).length,
    totalBilled: invoices.reduce((sum, i) => sum + (Number(i.grandTotal) || 0), 0)
  };
};

const DataSettings = ({ form, set }) => {
  const [checking, setChecking] = useState(false);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');

  const runCheck = async () => {
    setChecking(true);
    setError('');
    try {
      setSummary(await countRows());
    } catch (err) {
      setError(err?.message || 'Gagal membaca data.');
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="space-y-5">
      <Card className="p-4 sm:p-5">
        <div className="mb-4 flex items-start gap-2.5">
          <FileText className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" />
          <div>
            <h3 className="font-display text-sm font-semibold text-slate-800">Penomoran Dokumen</h3>
            <p className="mt-0.5 text-xs text-slate-400">
              Nomor invoice dibentuk otomatis dari urutan bulan berjalan. Awalan dipakai di semua dokumen resmi.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Awalan Invoice">
            <Input value={form.docPrefix || 'INV'} onChange={set('docPrefix')} placeholder="INV" />
          </Field>
          <Field label="Kode Perusahaan di Nomor" hint="Contoh: INV-007/PEB/11/2026">
            <Input value={form.docCompanyCode || 'PEB'} onChange={set('docCompanyCode')} placeholder="PEB" />
          </Field>
          <Field label="Jatuh Tempo Default (hari)">
            <Input
              type="number"
              min="0"
              max="180"
              value={form.defaultDueDays ?? 14}
              onChange={set('defaultDueDays')}
              placeholder="14"
            />
          </Field>
        </div>
      </Card>

      <Card className="p-4 sm:p-5">
        <div className="mb-4 flex items-start gap-2.5">
          <Archive className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" />
          <div>
            <h3 className="font-display text-sm font-semibold text-slate-800">Arsip & Retensi Berkas</h3>
            <p className="mt-0.5 text-xs text-slate-400">
              Berkas proyek (SPK, PK, WPHO, BAHK) disimpan di Cloud Storage dan tertaut ke invoice terkait.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Masa Simpan Arsip Invoice (tahun)" hint="Kewajiban dokumen pajak umumnya 10 tahun">
            <Input
              type="number"
              min="1"
              max="30"
              value={form.archiveYears ?? 10}
              onChange={set('archiveYears')}
              placeholder="10"
            />
          </Field>
          <Field label="Ukuran Maksimum Berkas (MB)">
            <Input
              type="number"
              min="1"
              max="25"
              value={form.maxUploadMb ?? 10}
              onChange={set('maxUploadMb')}
              placeholder="10"
            />
          </Field>
        </div>
      </Card>

      <Card className="p-4 sm:p-5">
        <div className="mb-3 flex items-start gap-2.5">
          <Database className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" />
          <div>
            <h3 className="font-display text-sm font-semibold text-slate-800">Kesehatan Data</h3>
            <p className="mt-0.5 text-xs text-slate-400">
              Menghitung ulang dokumen yang benar-benar ada di Firestore. Hanya membaca, tidak mengubah apa pun.
            </p>
          </div>
        </div>

        <Button variant="secondary" onClick={runCheck} disabled={checking}>
          {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Hitung Ulang Data
        </Button>

        {error && <p className="mt-3 text-xs text-red-600">{error}</p>}

        {summary && (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[
              { label: 'Invoice', value: summary.invoices },
              { label: 'Proyek', value: summary.projects },
              { label: 'Klien', value: summary.clients },
              { label: 'PPN tercatat', value: summary.archived },
              {
                label: 'Total ditagihkan',
                value: `Rp${Math.round(summary.totalBilled).toLocaleString('id-ID')}`
              },
              { label: 'Profil perusahaan', value: summary.hasProfile ? 'Lengkap' : 'Belum diisi' }
            ].map((row) => (
              <div key={row.label} className="rounded-lg border border-slate-200 px-3 py-2.5 dark:border-white/10">
                <p className="text-[11px] text-slate-400">{row.label}</p>
                <p className="mt-0.5 text-sm font-semibold text-slate-800">{row.value}</p>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/8 px-3.5 py-2.5">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
          <p className="text-xs text-slate-600">
            Pencadangan Firestore dan penghapusan data tidak dilakukan dari halaman ini. Tindakan itu memerlukan
            akses konsol pemilik dan harus dicadangkan lebih dulu.
          </p>
        </div>
      </Card>

      <Card className="p-4 sm:p-5">
        <div className="mb-3 flex items-start gap-2.5">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
          <div>
            <h3 className="font-display text-sm font-semibold text-slate-800">Praktik yang Sudah Diterapkan</h3>
            <p className="mt-0.5 text-xs text-slate-400">Ringkasan, bukan janji. Bukti ada di dokumentasi repo.</p>
          </div>
        </div>
        <ul className="space-y-1.5 text-xs text-slate-600">
          <li className="flex items-start gap-2">
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-400" />
            Akses data dibatasi aturan Firestore per koleksi; koleksi pemakaian AI tertutup dari klien.
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-400" />
            Kuota AI dan pengiriman pesan ditegakkan di server, reset tengah malam WIB.
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-400" />
            Header keamanan dan kebijakan konten dipasang di hosting.
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-400" />
            Migrasi data selalu aditif: cadangkan, hitung sebelum/sesudah, tanpa menghapus field lama.
          </li>
        </ul>
      </Card>
    </div>
  );
};

export default DataSettings;
