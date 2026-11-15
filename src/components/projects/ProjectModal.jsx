// src/components/projects/ProjectModal.jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { addProject, updateProject } from '../../services/projects';
import { uploadInvoiceDocument } from '../../services/invoices';
import { getAllClients, clientDisplayName } from '../../services/clients';
import { PROJECT_STATUS, TAX_RATES } from '../../utils/constants';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { Field, Input, Select, Textarea } from '../ui/Field';

const formatNumberDisplay = (value) => {
  if (!value && value !== 0) return '';
  return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

const formatRupiah = (value) => 'Rp ' + formatNumberDisplay(Math.round(value || 0));

const formatDateForInput = (date) => {
  if (!date) return '';

  if (typeof date === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return date;
    }
    if (date.includes('T')) {
      return date.split('T')[0];
    }
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(date)) {
      const [day, month, year] = date.split('/');
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
  }

  try {
    const dateObj = new Date(date);
    if (!isNaN(dateObj.getTime())) {
      return dateObj.toISOString().split('T')[0];
    }
  } catch (e) {
    console.error('Error parsing date:', e);
  }

  return '';
};

const BILLING_METHODS = [
  { value: 'termin', label: 'Termin (progress billing)' },
  { value: 'bulanan', label: 'Bulanan' },
  { value: 'sekaligus', label: 'Sekaligus (lump sum)' },
];

const PAYMENT_TERMS = ['7 Hari', '14 Hari', '30 Hari', '45 Hari', '60 Hari', '90 Hari'];

// Pembungkus bagian form: judul + garis pemisah, supaya form panjang tetap mudah dipindai
const FormSection = ({ title, children }) => (
  <section className="border-t border-slate-200 pt-4 dark:border-white/10">
    <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
      {title}
    </h3>
    {children}
  </section>
);

const ProjectModal = ({ isOpen, onClose, onSuccess, project, currentUser }) => {
  const isEdit = project !== null && project !== undefined;

  const buildFormData = (p) => ({
    name: p?.name || '',
    partner: p?.partner || '',
    ownerName: p?.ownerName || '',
    location: p?.location || '',
    contractNumber: p?.contractNumber || '',
    pkNumber: p?.pkNumber || '',
    status: p?.status || PROJECT_STATUS.AKAN_DATANG,
    value: p?.value ? p.value.toString() : '',
    taxRate: p?.taxRate !== undefined ? p.taxRate : 11,
    startDate: formatDateForInput(p?.startDate) || '',
    endDate: formatDateForInput(p?.endDate) || '',
    paymentTerm: p?.paymentTerm || '14 Hari',
    billingMethod: p?.billingMethod || 'termin',
    terminCount: p?.terminCount !== undefined ? p.terminCount.toString() : '',
    retentionPct: p?.retentionPct !== undefined ? p.retentionPct.toString() : '5',
    retentionMonths: p?.retentionMonths !== undefined ? p.retentionMonths.toString() : '3',
    description: p?.description || ''
  });

  const [formData, setFormData] = useState(() => buildFormData(project));

  const [loading, setLoading] = useState(false);
  const [docBusy, setDocBusy] = useState(null);
  const [errors, setErrors] = useState({});
  const [displayValue, setDisplayValue] = useState(() => formatNumberDisplay(project?.value || ''));
  const [clients, setClients] = useState(null); // null = belum dimuat

  useEffect(() => {
    getAllClients()
      .then((list) => {
        list.sort((a, b) => clientDisplayName(a).localeCompare(clientDisplayName(b)));
        setClients(list);
      })
      .catch(() => setClients([]));
  }, []);

  useEffect(() => {
    if (isOpen) {
      setFormData(buildFormData(project));
      setDisplayValue(formatNumberDisplay(project?.value || ''));
      setErrors({});
    }
  }, [isOpen, project]);

  const numericValue = parseInt(formData.value, 10) || 0;
  const taxRate = parseFloat(formData.taxRate) || 0;
  // PMK 131/2024: PPN 12% di atas DPP Nilai Lain → efektif 11% dari nilai kontrak.
  const dppValue = (numericValue * 11) / 12;
  const taxValue = (dppValue * taxRate) / 100;
  const totalWithTax = numericValue + taxValue;
  const retentionPctNum = parseFloat(formData.retentionPct);
  const retentionValue = isNaN(retentionPctNum)
    ? 0
    : (numericValue * retentionPctNum) / 100;

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Nama proyek harus diisi';
    }

    if (!formData.partner.trim()) {
      newErrors.partner = 'Mitra/Partner harus diisi';
    }

    if (!formData.value || formData.value === '' || numericValue <= 0) {
      newErrors.value = 'Nilai proyek harus lebih dari 0';
    }

    if (!formData.startDate) {
      newErrors.startDate = 'Tanggal mulai harus diisi';
    }

    if (!formData.endDate) {
      newErrors.endDate = 'Tanggal selesai harus diisi';
    }

    if (
      formData.startDate &&
      formData.endDate &&
      new Date(formData.endDate) < new Date(formData.startDate)
    ) {
      newErrors.endDate = 'Tanggal selesai harus setelah tanggal mulai';
    }

    const pct = parseFloat(formData.retentionPct);
    if (isNaN(pct) || pct < 0 || pct > 100) {
      newErrors.retentionPct = 'Retensi harus di antara 0-100%';
    }

    if (formData.terminCount !== '') {
      const termin = parseInt(formData.terminCount, 10);
      if (isNaN(termin) || termin < 1 || termin > 20) {
        newErrors.terminCount = 'Jumlah termin harus di antara 1-20';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      if (numericValue <= 0) {
        throw new Error('Nilai proyek harus lebih dari 0');
      }

      const cleanedFormData = {
        name: formData.name.trim(),
        partner: formData.partner.trim(),
        contractNumber: formData.contractNumber.trim(),
        pkNumber: formData.pkNumber.trim(),
        status: formData.status,
        value: numericValue,
        taxRate: parseFloat(formData.taxRate) || 0,
        startDate: formData.startDate,
        endDate: formData.endDate,
        ownerName: formData.ownerName.trim(),
        location: formData.location.trim(),
        paymentTerm: formData.paymentTerm,
        billingMethod: formData.billingMethod,
        terminCount: formData.terminCount === '' ? null : parseInt(formData.terminCount, 10),
        retentionPct: parseFloat(formData.retentionPct),
        retentionMonths: parseInt(formData.retentionMonths, 10),
        description: formData.description.trim()
      };

      if (isEdit) {
        await updateProject(project.id, cleanedFormData, currentUser.uid, currentUser.email);
      } else {
        await addProject(cleanedFormData, currentUser.uid, currentUser.email);
      }

      onSuccess();
    } catch (error) {
      console.error('Error saving project:', error);
      alert(`Gagal menyimpan proyek: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const handleValueChange = (e) => {
    const inputValue = e.target.value;

    if (inputValue === '') {
      setFormData((prev) => ({ ...prev, value: '' }));
      setDisplayValue('');
      return;
    }

    const numeric = inputValue.replace(/\D/g, '');
    setFormData((prev) => ({ ...prev, value: numeric }));
    setDisplayValue(formatNumberDisplay(numeric));

    if (errors.value) {
      setErrors((prev) => ({ ...prev, value: '' }));
    }
  };

  const summaryRows = [
    { label: 'Nilai kontrak', value: formatRupiah(numericValue) },
    { label: 'DPP (11/12)', value: formatRupiah(dppValue) },
    { label: 'PPN 11%', value: formatRupiah(taxValue) },
    { label: 'Total + pajak', value: formatRupiah(totalWithTax) },
    { label: 'Retensi', value: formatRupiah(retentionValue) }
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={loading ? undefined : onClose}
      title={isEdit ? 'Edit Proyek' : 'Tambah Proyek'}
      subtitle={isEdit ? project?.name : 'Lengkapi detail proyek atau kontrak baru'}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Batal
          </Button>
          <Button type="submit" form="project-form" loading={loading}>
            {loading ? 'Menyimpan…' : isEdit ? 'Simpan Perubahan' : 'Simpan Proyek'}
          </Button>
        </>
      }
    >
      <form id="project-form" onSubmit={handleSubmit}>
        <div className="space-y-4">
          {/* Ringkasan nilai: mengikuti edit secara real time */}
          <div className="panel-solid rounded-xl p-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Ringkasan Nilai
            </h3>
            <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {summaryRows.map((row) => (
                <div key={row.label} className="flex items-baseline justify-between gap-2">
                  <dt className="text-xs text-slate-500">{row.label}</dt>
                  <dd className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <FormSection title="Identitas">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Nama Proyek" required error={errors.name}>
                <Input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  error={errors.name}
                  placeholder="cth. Pembangunan Gudang A"
                  disabled={loading}
                />
              </Field>

              <Field label="Lokasi Pekerjaan">
                <Input
                  type="text"
                  name="location"
                  value={formData.location}
                  onChange={handleChange}
                  placeholder="cth. Balikpapan, Kalimantan Timur"
                  disabled={loading}
                />
              </Field>
            </div>
          </FormSection>

          <FormSection title="Kontrak & Mitra">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Mitra/Klien" required error={errors.partner}>
                <Select
                  name="partner"
                  value={formData.partner}
                  onChange={handleChange}
                  error={errors.partner}
                  disabled={loading || !clients}
                >
                  <option value="">
                    {clients === null ? 'Memuat klien…' : '— Pilih Klien —'}
                  </option>
                  {(clients || []).map((c) => (
                    <option key={c.id} value={clientDisplayName(c)}>
                      {clientDisplayName(c)}
                    </option>
                  ))}
                  {/* Jaga kompatibilitas: bila proyek lama punya partner yg tak ada di daftar */}
                  {formData.partner &&
                    !(clients || []).some((c) => clientDisplayName(c) === formData.partner) && (
                      <option value={formData.partner}>{formData.partner} (lama)</option>
                    )}
                </Select>
                {clients !== null && clients.length === 0 && (
                  <p className="mt-1 text-xs text-slate-500">
                    Belum ada klien.{' '}
                    <Link to="/app/clients" className="font-medium text-brand-700 hover:underline">
                      Tambah klien dulu
                    </Link>
                    .
                  </p>
                )}
              </Field>

              <Field label="Pemberi Kerja / PPK">
                <Input
                  type="text"
                  name="ownerName"
                  value={formData.ownerName}
                  onChange={handleChange}
                  placeholder="cth. PT Pertamina (Persero)"
                  disabled={loading}
                />
              </Field>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="No. SPK / Kontrak Kerja">
                  <Input
                    type="text"
                    name="contractNumber"
                    value={formData.contractNumber}
                    onChange={handleChange}
                    placeholder="cth. SPK/2026/001"
                    disabled={loading}
                  />
                </Field>
                <Field label="No. PK (Perjanjian Kerja)">
                  <Input
                    type="text"
                    name="pkNumber"
                    value={formData.pkNumber}
                    onChange={handleChange}
                    placeholder="cth. SLM/PK-HO/TEK/37/7/2026"
                    disabled={loading}
                  />
                </Field>
              </div>

              <Field label="Status" required>
                <Select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  disabled={loading}
                >
                  <option value={PROJECT_STATUS.AKAN_DATANG}>Akan Datang</option>
                  <option value={PROJECT_STATUS.ONGOING}>On Going</option>
                  <option value={PROJECT_STATUS.RETENSI}>Retensi</option>
                  <option value={PROJECT_STATUS.SELESAI}>Selesai</option>
                </Select>
              </Field>
            </div>
          </FormSection>

          <FormSection title="Nilai & Pajak">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Nilai Proyek (Rp)" required error={errors.value}>
                <Input
                  type="text"
                  inputMode="numeric"
                  name="value"
                  value={displayValue}
                  onChange={handleValueChange}
                  error={errors.value}
                  placeholder="0"
                  disabled={loading}
                />
              </Field>

              <Field label="Pajak" required>
                <Select
                  name="taxRate"
                  value={formData.taxRate}
                  onChange={handleChange}
                  disabled={loading}
                >
                  {TAX_RATES.map((rate) => (
                    <option key={rate.value} value={rate.value}>
                      {rate.label}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          </FormSection>

          <FormSection title="Jadwal">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Tanggal Mulai" required error={errors.startDate}>
                <Input
                  type="date"
                  name="startDate"
                  value={formData.startDate}
                  onChange={handleChange}
                  error={errors.startDate}
                  disabled={loading}
                />
              </Field>

              <Field label="Tanggal Selesai" required error={errors.endDate}>
                <Input
                  type="date"
                  name="endDate"
                  value={formData.endDate}
                  onChange={handleChange}
                  error={errors.endDate}
                  disabled={loading}
                />
              </Field>
            </div>
          </FormSection>

          <FormSection title="Termin & Retensi">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Metode Tagihan">
                <Select
                  name="billingMethod"
                  value={formData.billingMethod}
                  onChange={handleChange}
                  disabled={loading}
                >
                  {BILLING_METHODS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Jumlah Termin" error={errors.terminCount}>
                <Input
                  type="number"
                  name="terminCount"
                  value={formData.terminCount}
                  onChange={handleChange}
                  error={errors.terminCount}
                  min="1"
                  max="20"
                  placeholder="cth. 5"
                  disabled={loading}
                />
              </Field>

              <Field label="Jatuh Tempo Pembayaran">
                <Select
                  name="paymentTerm"
                  value={formData.paymentTerm}
                  onChange={handleChange}
                  disabled={loading}
                >
                  {PAYMENT_TERMS.map((term) => (
                    <option key={term} value={term}>
                      {term}
                    </option>
                  ))}
                </Select>
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Retensi (%)" error={errors.retentionPct}>
                  <Input
                    type="number"
                    name="retentionPct"
                    value={formData.retentionPct}
                    onChange={handleChange}
                    error={errors.retentionPct}
                    min="0"
                    max="100"
                    step="0.5"
                    disabled={loading}
                  />
                </Field>
                <Field label="Masa Retensi (bln)">
                  <Input
                    type="number"
                    name="retentionMonths"
                    value={formData.retentionMonths}
                    onChange={handleChange}
                    min="0"
                    disabled={loading}
                  />
                </Field>
              </div>
            </div>
          </FormSection>

          <FormSection title="Berkas">
            {/* Arsip digital: SPK & PK diunggah per proyek; tiap BAHK/WPHO
                per invoice otomatis menempel di arsip invoice masing-masing. */}
            {isEdit ? (
              <>
                <div className="grid grid-cols-2 gap-2">
                  {['spk', 'pk'].map((kind) => (
                    <label
                      key={kind}
                      title={kind === 'spk' ? 'Unggah SPK / Kontrak Kerja' : 'Unggah Perjanjian Kerja (PK)'}
                      className="flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-2 py-1.5 text-xs text-slate-500 transition-colors hover:border-brand-400 hover:text-brand-700 dark:border-white/15"
                    >
                      {kind === 'spk' ? 'SPK / Kontrak' : 'PK'}
                      {project?.documents?.[kind] ? ' (ada)' : ''}
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*,.pdf,.tif,.tiff"
                        disabled={docBusy === kind}
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          e.target.value = '';
                          if (!file || !project?.id) return;
                          setDocBusy(kind);
                          try {
                            await uploadInvoiceDocument(project.id, kind, file, 'projects');
                            alert('Berkas terunggah ke arsip proyek.');
                          } catch (err) {
                            alert('Gagal mengunggah berkas.');
                          } finally {
                            setDocBusy(null);
                          }
                        }}
                      />
                    </label>
                  ))}
                </div>
                {project?.documents && (project.documents.spk || project.documents.pk) && (
                  <p className="mt-1 text-[11px] text-slate-400">
                    Terunggah:{' '}
                    {[project.documents.spk && 'SPK', project.documents.pk && 'PK'].filter(Boolean).join(' · ')}
                    {' '}— ganti lewat tombol di atas.
                  </p>
                )}
              </>
            ) : (
              <p className="text-xs text-slate-500">
                Unggah SPK dan PK tersedia setelah proyek disimpan — simpan dulu proyeknya,
                lalu edit untuk melampirkan berkas.
              </p>
            )}
          </FormSection>

          <FormSection title="Catatan">
            <Field label="Deskripsi">
              <Textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows="3"
                placeholder="Catatan atau lingkup pekerjaan proyek…"
                disabled={loading}
              />
            </Field>
          </FormSection>
        </div>
      </form>
    </Modal>
  );
};

export default ProjectModal;
