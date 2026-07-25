// src/components/clients/ClientModal.jsx
import React, { useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { Field, Input, Select, Textarea } from '../ui/Field';
import { addClient, updateClient } from '../../services/clients';

const CLIENT_TYPES = ['PT', 'CV', 'Firma', 'UD', 'Koperasi', 'Instansi', 'Perorangan', 'Lainnya'];

const emptyForm = {
  client_name: '',
  clientType: 'PT',
  npwp: '',
  address: '',
  city: '',
  province: '',
  postalCode: '',
  phone: '',
  email: '',
  contactPerson: '',
  contactPhone: '',
  contactPosition: '',
  bankName: '',
  bankAccountNumber: '',
  bankAccountName: '',
  notes: ''
};

const ClientModal = ({ isOpen, onClose, onSuccess, client }) => {
  const isEdit = Boolean(client);
  const [form, setForm] = useState(() => ({ ...emptyForm, ...(client || {}) }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
    if (error) setError('');
  };

  const handleSave = async () => {
    if (!form.client_name.trim()) {
      setError('Nama klien wajib diisi');
      return;
    }
    setSaving(true);
    try {
      if (isEdit) {
        await updateClient(client.id, form);
      } else {
        await addClient(form);
      }
      onSuccess?.();
      onClose?.();
    } catch (err) {
      console.error('Gagal simpan klien:', err);
      setError('Gagal menyimpan klien. Coba lagi.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={saving ? undefined : onClose}
      title={isEdit ? 'Edit Klien' : 'Tambah Klien'}
      subtitle="Data klien dipakai otomatis saat membuat invoice"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Batal
          </Button>
          <Button onClick={handleSave} loading={saving}>
            {saving ? 'Menyimpan…' : isEdit ? 'Simpan Perubahan' : 'Simpan Klien'}
          </Button>
        </>
      }
    >
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <Field label="Nama Klien / PT / CV" required>
              <Input value={form.client_name} onChange={set('client_name')} placeholder="PT SALONOK LADANG MAS" />
            </Field>
          </div>
          <Field label="Jenis">
            <Select value={form.clientType} onChange={set('clientType')}>
              {CLIENT_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="NPWP">
            <Input value={form.npwp} onChange={set('npwp')} placeholder="00.000.000.0-000.000" />
          </Field>
          <Field label="Telepon">
            <Input value={form.phone} onChange={set('phone')} placeholder="0812…" />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Alamat">
              <Textarea value={form.address} onChange={set('address')} rows="2" placeholder="Alamat lengkap" />
            </Field>
          </div>
          <Field label="Kota">
            <Input value={form.city} onChange={set('city')} placeholder="Jakarta Selatan" />
          </Field>
          <Field label="Provinsi">
            <Input value={form.province} onChange={set('province')} placeholder="DKI Jakarta" />
          </Field>
          <Field label="Kode Pos">
            <Input value={form.postalCode} onChange={set('postalCode')} placeholder="12980" />
          </Field>
          <Field label="Email">
            <Input type="email" value={form.email} onChange={set('email')} placeholder="billing@klien.com" />
          </Field>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Kontak (opsional)
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Nama Kontak">
              <Input value={form.contactPerson} onChange={set('contactPerson')} />
            </Field>
            <Field label="Jabatan">
              <Input value={form.contactPosition} onChange={set('contactPosition')} />
            </Field>
            <Field label="No. HP Kontak">
              <Input value={form.contactPhone} onChange={set('contactPhone')} />
            </Field>
          </div>
        </div>

        <Field label="Catatan">
          <Textarea value={form.notes} onChange={set('notes')} rows="2" />
        </Field>
      </div>
    </Modal>
  );
};

export default ClientModal;
