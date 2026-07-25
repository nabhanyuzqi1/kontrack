// src/components/projects/ProjectModal.jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { addProject, updateProject } from '../../services/projects';
import { getAllClients, clientDisplayName } from '../../services/clients';
import { PROJECT_STATUS, TAX_RATES } from '../../utils/constants';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { Field, Input, Select, Textarea } from '../ui/Field';

const formatNumberDisplay = (value) => {
  if (!value && value !== 0) return '';
  return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

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

const ProjectModal = ({ isOpen, onClose, onSuccess, project, currentUser }) => {
  const isEdit = project !== null && project !== undefined;

  const [formData, setFormData] = useState({
    name: project?.name || '',
    partner: project?.partner || '',
    contractNumber: project?.contractNumber || '',
    status: project?.status || PROJECT_STATUS.AKAN_DATANG,
    value: project?.value ? project.value.toString() : '',
    taxRate: project?.taxRate !== undefined ? project.taxRate : 11,
    startDate: formatDateForInput(project?.startDate) || '',
    endDate: formatDateForInput(project?.endDate) || '',
    description: project?.description || ''
  });

  const [loading, setLoading] = useState(false);
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
      const initialValue = project?.value ? project.value.toString() : '';
      setFormData({
        name: project?.name || '',
        partner: project?.partner || '',
        contractNumber: project?.contractNumber || '',
        status: project?.status || PROJECT_STATUS.AKAN_DATANG,
        value: initialValue,
        taxRate: project?.taxRate !== undefined ? project.taxRate : 11,
        startDate: formatDateForInput(project?.startDate) || '',
        endDate: formatDateForInput(project?.endDate) || '',
        description: project?.description || ''
      });
      setDisplayValue(formatNumberDisplay(initialValue));
      setErrors({});
    }
  }, [isOpen, project]);

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Nama proyek harus diisi';
    }

    if (!formData.partner.trim()) {
      newErrors.partner = 'Mitra/Partner harus diisi';
    }

    const numericValue = parseInt(formData.value, 10) || 0;
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
      const numericValue = parseInt(formData.value, 10) || 0;
      const numericTaxRate = parseFloat(formData.taxRate) || 0;

      if (numericValue <= 0) {
        throw new Error('Nilai proyek harus lebih dari 0');
      }

      const cleanedFormData = {
        name: formData.name.trim(),
        partner: formData.partner.trim(),
        contractNumber: formData.contractNumber.trim(),
        status: formData.status,
        value: numericValue,
        taxRate: numericTaxRate,
        startDate: formData.startDate,
        endDate: formData.endDate,
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

    const numericValue = inputValue.replace(/\D/g, '');
    setFormData((prev) => ({ ...prev, value: numericValue }));
    setDisplayValue(formatNumberDisplay(numericValue));

    if (errors.value) {
      setErrors((prev) => ({ ...prev, value: '' }));
    }
  };

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
                <Link to="/clients" className="font-medium text-brand-600 hover:underline">
                  Tambah klien dulu
                </Link>
                .
              </p>
            )}
          </Field>

          <Field label="No. SPK/MOU">
            <Input
              type="text"
              name="contractNumber"
              value={formData.contractNumber}
              onChange={handleChange}
              placeholder="cth. SPK/2026/001"
              disabled={loading}
            />
          </Field>

          <Field label="Status" required>
            <Select name="status" value={formData.status} onChange={handleChange} disabled={loading}>
              <option value={PROJECT_STATUS.AKAN_DATANG}>Akan Datang</option>
              <option value={PROJECT_STATUS.ONGOING}>On Going</option>
              <option value={PROJECT_STATUS.RETENSI}>Retensi</option>
              <option value={PROJECT_STATUS.SELESAI}>Selesai</option>
            </Select>
          </Field>

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

        <div className="mt-4">
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
        </div>
      </form>
    </Modal>
  );
};

export default ProjectModal;
