// src/components/settings/SettingsPage.jsx
import React, { useState, useEffect } from 'react';
import { Building2, Palette, UploadCloud, Check, Loader2 } from 'lucide-react';
import PageHeader from '../ui/PageHeader';
import Button from '../ui/Button';
import { Card } from '../ui/Card';
import { Field, Input, Textarea, Label } from '../ui/Field';
import { PageLoader } from '../ui/Spinner';
import {
  getCompanySettings,
  saveCompanySettings,
  uploadLetterhead,
  getThemeFromSettings
} from '../../services/settings';
import { THEME_PRESETS, applyTheme } from '../../utils/themes';

const TABS = [
  { key: 'company', label: 'Perusahaan', icon: Building2 },
  { key: 'theme', label: 'Tema & Tampilan', icon: Palette }
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
  footerNote: '',
  themePreset: 'electric'
};

const SettingsPage = () => {
  const [tab, setTab] = useState('company');
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploadingLetterhead, setUploadingLetterhead] = useState(false);

  useEffect(() => {
    (async () => {
      const settings = await getCompanySettings();
      if (settings) {
        setForm((prev) => ({ ...prev, ...settings, themePreset: getThemeFromSettings(settings) }));
      }
      setLoading(false);
    })();
  }, []);

  const set = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
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
      const { url } = await uploadLetterhead(file);
      setForm((prev) => ({ ...prev, letterheadUrl: url }));
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

          <Card className="p-4 sm:p-5">
            <h3 className="mb-1 font-display text-sm font-semibold text-slate-800">
              Kopsurat / Letterhead
            </h3>
            <p className="mb-4 text-xs text-slate-400">
              PNG latar transparan, maks 10MB. Dipakai sebagai header invoice & dokumen resmi.
            </p>

            {form.letterheadUrl && (
              <div className="mb-4 overflow-hidden rounded-lg border border-slate-200 bg-white p-3">
                <img src={form.letterheadUrl} alt="Letterhead" className="max-h-28 w-auto" />
              </div>
            )}

            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-card transition-colors hover:border-brand-300 hover:bg-brand-50/40">
              {uploadingLetterhead ? (
                <Loader2 className="h-4 w-4 animate-spin text-brand-600" />
              ) : (
                <UploadCloud className="h-4 w-4 text-brand-600" />
              )}
              {uploadingLetterhead ? 'Mengunggah…' : form.letterheadUrl ? 'Ganti Kopsurat' : 'Upload Kopsurat'}
              <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={handleLetterheadUpload} />
            </label>
          </Card>
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
    </div>
  );
};

export default SettingsPage;
