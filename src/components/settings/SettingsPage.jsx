// src/components/settings/SettingsPage.jsx
import React, { useState, useEffect } from 'react';
import {
  Building2,
  Palette,
  Bell,
  Users,
  UploadCloud,
  Check,
  Loader2,
  Image as ImageIcon,
  PenTool,
  Trash2
} from 'lucide-react';
import UsersTab from './UsersTab';
import PageHeader from '../ui/PageHeader';
import Button from '../ui/Button';
import { Card } from '../ui/Card';
import { Field, Input, Textarea, Label } from '../ui/Field';
import { PageLoader } from '../ui/Spinner';
import {
  getCompanySettings,
  saveCompanySettings,
  uploadLetterhead,
  uploadSignature,
  removeCompanyAsset,
  getThemeFromSettings
} from '../../services/settings';
import { THEME_PRESETS, applyTheme } from '../../utils/themes';

/** Saklar kecil untuk menyalakan/mematikan aset dokumen. */
const Switch = ({ checked, onChange, label }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    onClick={() => onChange(!checked)}
    className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
      checked ? 'bg-brand-600' : 'bg-slate-200'
    }`}
  >
    <span
      className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
        checked ? 'translate-x-4' : 'translate-x-0.5'
      }`}
    />
  </button>
);

/**
 * Kartu aset dokumen (kop surat / tanda tangan).
 *
 * Sebelumnya kedua aset ini ditulis sebagai dua blok JSX yang hampir identik.
 * Disatukan agar saklar dan tombol hapus cukup ditulis sekali dan keduanya
 * dijamin berperilaku sama.
 */
const AssetCard = ({
  title,
  description,
  hint,
  accept,
  icon: EmptyIcon,
  previewUrl,
  enabled,
  uploading,
  removing,
  onUpload,
  onToggle,
  onRemove
}) => (
  <Card className="flex flex-col p-4 sm:p-5">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h3 className="font-display text-sm font-semibold text-slate-800">{title}</h3>
        <p className="mb-4 mt-1 text-xs text-slate-400">{description}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2 pt-0.5">
        <span className={`text-[11px] font-medium ${enabled ? 'text-brand-600' : 'text-slate-400'}`}>
          {enabled ? 'Tampil' : 'Disembunyikan'}
        </span>
        <Switch checked={enabled} onChange={onToggle} label={`Tampilkan ${title} di invoice`} />
      </div>
    </div>

    <div className="flex flex-1 flex-col">
      {previewUrl ? (
        <div className="relative mb-3 flex flex-1 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50/60 p-3">
          {/* Saat dimatikan, pratinjau diredupkan supaya jelas aset masih
              tersimpan tetapi tidak ikut tercetak di invoice. */}
          <img
            src={previewUrl}
            alt={title}
            loading="lazy"
            decoding="async"
            className={`max-h-24 w-auto object-contain transition ${
              enabled ? '' : 'opacity-30 grayscale'
            }`}
          />
          <button
            type="button"
            onClick={onRemove}
            disabled={removing}
            title={`Hapus ${title}`}
            className="absolute right-2 top-2 rounded-lg bg-white/90 p-1.5 text-slate-400 shadow-sm transition-colors hover:text-red-600 disabled:opacity-40"
          >
            {removing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </button>
        </div>
      ) : (
        <div className="mb-3 flex flex-1 flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-200 bg-slate-50/40 px-4 py-6 text-center">
          <EmptyIcon className="mb-1.5 h-6 w-6 text-slate-300" />
          <p className="text-xs text-slate-400">Belum ada {title.toLowerCase()}</p>
        </div>
      )}

      <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:border-brand-300 hover:bg-brand-50/40">
        {uploading ? (
          <Loader2 className="h-4 w-4 animate-spin text-brand-600" />
        ) : (
          <UploadCloud className="h-4 w-4 text-brand-600" />
        )}
        {uploading ? 'Mengunggah…' : previewUrl ? `Ganti ${title}` : `Unggah ${title}`}
        <input type="file" accept={accept} className="hidden" onChange={onUpload} />
      </label>
      <p className="mt-2 text-center text-[11px] text-slate-400">{hint}</p>
    </div>
  </Card>
);

const TABS = [
  { key: 'company', label: 'Perusahaan', icon: Building2 },
  { key: 'theme', label: 'Tema & Tampilan', icon: Palette },
  { key: 'notifications', label: 'Notifikasi', icon: Bell },
  { key: 'users', label: 'Pengguna', icon: Users }
];

const emptyForm = {
  companyName: '',
  npwp: '',
  address: '',
  city: '',
  province: '',
  postalCode: '',
  phone: '',
  email: '',
  website: '',
  bankName: '',
  bankAccountNumber: '',
  bankAccountHolder: '',
  signatoryName: '',
  signatoryTitle: '',
  letterheadUrl: '',
  letterheadDataUrl: '',
  letterheadPath: '',
  letterheadEnabled: true,
  signatureUrl: '',
  signatureDataUrl: '',
  signaturePath: '',
  signatureEnabled: true,
  footerNote: '',
  themePreset: 'electric',
  notifications: { whatsappWebhookUrl: '', whatsappEnabled: false }
};

const SettingsPage = ({ currentUser }) => {
  const [tab, setTab] = useState('company');
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploadingLetterhead, setUploadingLetterhead] = useState(false);
  const [uploadingSignature, setUploadingSignature] = useState(false);
  const [removingAsset, setRemovingAsset] = useState('');

  /**
   * Hapus kop surat / tanda tangan. Penghapusan langsung disimpan ke Firestore
   * (tidak menunggu tombol Simpan) supaya berkas Storage dan dokumen settings
   * tidak pernah berbeda keadaan.
   */
  const handleRemoveAsset = async (kind) => {
    const label = kind === 'letterhead' ? 'kopsurat' : 'tanda tangan';
    if (!window.confirm(`Hapus ${label}? Invoice akan memakai tampilan cadangan tanpa gambar.`)) {
      return;
    }

    setRemovingAsset(kind);
    try {
      await removeCompanyAsset(kind, form);
      setForm((prev) => ({
        ...prev,
        [`${kind}Url`]: '',
        [`${kind}DataUrl`]: '',
        [`${kind}Path`]: '',
        [`${kind}Enabled`]: false
      }));
    } catch (err) {
      console.error(`Hapus ${kind} gagal:`, err);
      alert(`Gagal menghapus ${label}. Coba lagi.`);
    } finally {
      setRemovingAsset('');
    }
  };

  const handleSignatureUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('Ukuran file maksimal 5MB');
      return;
    }
    setUploadingSignature(true);
    try {
      const { url, dataUrl, path } = await uploadSignature(file);
      // path disimpan agar tombol Hapus tahu berkas Storage mana yang dibuang.
      // Mengunggah juga otomatis menyalakan kembali asetnya — pengguna yang
      // baru saja mengunggah jelas ingin aset itu tampil.
      setForm((prev) => ({
        ...prev,
        signatureUrl: url,
        signatureDataUrl: dataUrl || '',
        signaturePath: path || '',
        signatureEnabled: true
      }));
      setSaved(false);
    } catch (err) {
      console.error('Upload tanda tangan gagal:', err);
      alert('Gagal mengunggah tanda tangan. Coba lagi.');
    } finally {
      setUploadingSignature(false);
    }
  };

  useEffect(() => {
    (async () => {
      const settings = await getCompanySettings();
      if (settings) {
        setForm((prev) => ({
          ...prev,
          ...settings,
          notifications: { ...prev.notifications, ...(settings.notifications || {}) },
          themePreset: getThemeFromSettings(settings)
        }));
      }
      setLoading(false);
    })();
  }, []);

  const set = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
    setSaved(false);
  };

  const setNotif = (field, value) => {
    setForm((prev) => ({ ...prev, notifications: { ...prev.notifications, [field]: value } }));
    setSaved(false);
  };

  const handleThemeSelect = (presetName) => {
    setForm((prev) => ({ ...prev, themePreset: presetName }));
    applyTheme(presetName); // langsung terlihat di UI
    setSaved(false);
  };

  const handleLetterheadUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      alert('Ukuran file maksimal 10MB');
      return;
    }
    setUploadingLetterhead(true);
    try {
      // dataUrl disimpan agar PDF tetap memuat kop surat tanpa bergantung CORS
      const { url, dataUrl, path } = await uploadLetterhead(file);
      setForm((prev) => ({
        ...prev,
        letterheadUrl: url,
        letterheadDataUrl: dataUrl || '',
        letterheadPath: path || '',
        letterheadEnabled: true
      }));
      setSaved(false);
    } catch (err) {
      console.error('Upload letterhead gagal:', err);
      alert('Gagal mengunggah kopsurat. Coba lagi.');
    } finally {
      setUploadingLetterhead(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveCompanySettings(form);
      setSaved(true);
    } catch (err) {
      console.error('Gagal menyimpan pengaturan:', err);
      alert('Gagal menyimpan pengaturan. Periksa koneksi lalu coba lagi.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <PageLoader label="Memuat pengaturan…" />;
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Pengaturan"
        subtitle="Identitas perusahaan, dokumen, dan tampilan aplikasi"
        actions={
          <Button onClick={handleSave} loading={saving}>
            {saving ? 'Menyimpan…' : saved ? 'Tersimpan ✓' : 'Simpan Pengaturan'}
          </Button>
        }
      />

      {/* Tab bar */}
      <div className="custom-scrollbar -mx-1 mb-5 flex gap-2 overflow-x-auto px-1 pb-1">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-all ${
              tab === key
                ? 'bg-brand-600 text-white shadow-sm'
                : 'bg-white text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-slate-50'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === 'company' && (
        <div className="space-y-5">
          <Card className="p-4 sm:p-5">
            <h3 className="mb-4 font-display text-sm font-semibold text-slate-800">
              Identitas Perusahaan
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Nama Perusahaan">
                <Input value={form.companyName} onChange={set('companyName')} placeholder="PT. PERMATA ENERGI BORNEO" />
              </Field>
              <Field label="NPWP">
                <Input value={form.npwp} onChange={set('npwp')} placeholder="00.000.000.0-000.000" />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Alamat">
                  <Textarea value={form.address} onChange={set('address')} rows="2" placeholder="Jalan Gatot Subroto (Gedung Permata) RT.20 RW.07…" />
                </Field>
              </div>
              <Field label="Kota">
                <Input value={form.city} onChange={set('city')} placeholder="Sampit" />
              </Field>
              <Field label="Provinsi">
                <Input value={form.province} onChange={set('province')} placeholder="Kalimantan Tengah" />
              </Field>
              <Field label="Kode Pos">
                <Input value={form.postalCode} onChange={set('postalCode')} placeholder="74321" />
              </Field>
              <Field label="Telepon">
                <Input value={form.phone} onChange={set('phone')} placeholder="08115188808" />
              </Field>
              <Field label="Email">
                <Input type="email" value={form.email} onChange={set('email')} placeholder="permataenergiborneo@gmail.com" />
              </Field>
              <Field label="Website (opsional)">
                <Input value={form.website} onChange={set('website')} placeholder="https://…" />
              </Field>
            </div>
          </Card>

          <Card className="p-4 sm:p-5">
            <h3 className="mb-4 font-display text-sm font-semibold text-slate-800">
              Rekening & Penanda Tangan
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="Nama Bank">
                <Input value={form.bankName} onChange={set('bankName')} placeholder="BCA" />
              </Field>
              <Field label="Nomor Rekening">
                <Input value={form.bankAccountNumber} onChange={set('bankAccountNumber')} placeholder="6695593736" />
              </Field>
              <Field label="Atas Nama">
                <Input value={form.bankAccountHolder} onChange={set('bankAccountHolder')} placeholder="PT PERMATA ENERGI BORNEO" />
              </Field>
              <Field label="Nama Penanda Tangan">
                <Input value={form.signatoryName} onChange={set('signatoryName')} placeholder="Noor Febriyanto" />
              </Field>
              <Field label="Jabatan">
                <Input value={form.signatoryTitle} onChange={set('signatoryTitle')} placeholder="Direktur" />
              </Field>
              <Field label="Catatan Kaki Dokumen (opsional)">
                <Input value={form.footerNote} onChange={set('footerNote')} placeholder="Teks kecil di bawah dokumen" />
              </Field>
            </div>
          </Card>

          {/* Aset dokumen — dua kartu berdampingan agar tidak menumpuk */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <AssetCard
              title="Kopsurat"
              description="Muncul sebagai header invoice & dokumen resmi."
              hint="PNG latar transparan · maks 10MB"
              accept="image/png,image/jpeg"
              icon={ImageIcon}
              previewUrl={form.letterheadDataUrl || form.letterheadUrl}
              enabled={form.letterheadEnabled !== false}
              uploading={uploadingLetterhead}
              removing={removingAsset === 'letterhead'}
              onUpload={handleLetterheadUpload}
              onToggle={(v) => setForm((prev) => ({ ...prev, letterheadEnabled: v }))}
              onRemove={() => handleRemoveAsset('letterhead')}
            />

            <AssetCard
              title="Tanda Tangan"
              description="Ditempatkan di atas nama penanda tangan pada invoice."
              hint="PNG latar transparan · maks 5MB"
              accept="image/png"
              icon={PenTool}
              previewUrl={form.signatureDataUrl || form.signatureUrl}
              enabled={form.signatureEnabled !== false}
              uploading={uploadingSignature}
              removing={removingAsset === 'signature'}
              onUpload={handleSignatureUpload}
              onToggle={(v) => setForm((prev) => ({ ...prev, signatureEnabled: v }))}
              onRemove={() => handleRemoveAsset('signature')}
            />
          </div>
        </div>
      )}

      {tab === 'theme' && (
        <Card className="p-4 sm:p-5">
          <h3 className="mb-1 font-display text-sm font-semibold text-slate-800">Warna Brand</h3>
          <p className="mb-5 text-xs text-slate-400">
            Mempengaruhi tombol, badge, grafik, dan aksen di seluruh aplikasi. Perubahan langsung
            terlihat — tekan Simpan untuk permanen.
          </p>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {Object.entries(THEME_PRESETS).map(([key, preset]) => {
              const active = form.themePreset === key;
              return (
                <button
                  key={key}
                  onClick={() => handleThemeSelect(key)}
                  className={`group relative overflow-hidden rounded-xl border p-3.5 text-left transition-all ${
                    active
                      ? 'border-brand-500 ring-2 ring-brand-500/40'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div
                    className="mb-3 h-10 rounded-lg"
                    style={{
                      background: `linear-gradient(135deg, ${preset.preview[0]} 0%, ${preset.preview[1]} 100%)`
                    }}
                  />
                  <p className="text-sm font-medium text-slate-800">{preset.label}</p>
                  {active && (
                    <span className="absolute right-2.5 top-2.5 rounded-full bg-brand-600 p-1 text-white">
                      <Check className="h-3 w-3" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Preview elemen ber-tema */}
          <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
            <Label>Preview</Label>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <Button size="sm">Tombol Utama</Button>
              <Button variant="gradient" size="sm">
                Gradient
              </Button>
              <span className="inline-flex items-center rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700 ring-1 ring-inset ring-brand-200">
                Badge Brand
              </span>
              <div className="h-2 w-32 overflow-hidden rounded-full bg-slate-200">
                <div className="h-full w-2/3 rounded-full bg-brand-gradient" />
              </div>
            </div>
          </div>
        </Card>
      )}

      {tab === 'users' && <UsersTab currentUser={currentUser} />}

      {tab === 'notifications' && (
        <Card className="p-4 sm:p-5">
          <h3 className="mb-1 font-display text-sm font-semibold text-slate-800">
            WhatsApp Webhook
          </h3>
          <p className="mb-4 text-xs text-slate-400">
            Bila diisi, "Bagikan ke WhatsApp" pada proyek akan mengirim pesan + kartu ringkasan
            otomatis ke webhook ini (mis. n8n, Zapier, atau gateway WhatsApp Anda). Kosongkan untuk
            memakai share manual (wa.me).
          </p>

          <div className="space-y-4">
            <Field label="URL Webhook WhatsApp">
              <Input
                type="url"
                value={form.notifications?.whatsappWebhookUrl || ''}
                onChange={(e) => setNotif('whatsappWebhookUrl', e.target.value)}
                placeholder="https://…/webhook"
              />
            </Field>

            <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-slate-200 bg-slate-50/60 p-3">
              <input
                type="checkbox"
                checked={Boolean(form.notifications?.whatsappEnabled)}
                onChange={(e) => setNotif('whatsappEnabled', e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              />
              <span className="text-sm text-slate-600">
                <span className="font-medium text-slate-800">Aktifkan pengiriman otomatis</span> —
                kirim update proyek ke webhook saat tombol WhatsApp ditekan.
              </span>
            </label>

            <div className="rounded-lg bg-slate-50 p-3.5 text-xs text-slate-500">
              <p className="mb-1 font-semibold text-slate-600">Format payload (POST JSON):</p>
              <pre className="overflow-x-auto text-[11px] leading-relaxed text-slate-500">{`{
  "text": "pesan update proyek",
  "image": "data:image/png;base64,…",
  "project": "Nama Proyek"
}`}</pre>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};

export default SettingsPage;
