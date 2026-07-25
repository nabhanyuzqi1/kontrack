// src/components/transactions/TransactionModal.jsx
import React, { useState, useEffect } from 'react';
import { UploadCloud, X, ImageIcon } from 'lucide-react';
import { addTransaction, updateTransaction } from '../../services/transactions';
import { getAllProjects } from '../../services/projects';
import { uploadTransactionImage, validateImageFile } from '../../services/ai';
import { TRANSACTION_TYPES, INCOME_CATEGORIES, EXPENSE_CATEGORIES } from '../../utils/constants';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { Field, Input, Select, Textarea } from '../ui/Field';

const TransactionModal = ({
  isOpen,
  onClose,
  onSuccess,
  transaction,
  projectId,
  projects: providedProjects,
  currentUser
}) => {
  const isEdit = transaction !== null && transaction !== undefined;

  const [projects, setProjects] = useState(providedProjects || []);
  const [formData, setFormData] = useState({
    projectId: transaction?.projectId || projectId || '',
    date: transaction?.date || new Date().toISOString().slice(0, 16),
    type: transaction?.type || TRANSACTION_TYPES.EXPENSE,
    category: transaction?.category || '',
    amount: transaction?.amount || '',
    description: transaction?.description || ''
  });

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(transaction?.imageUrl || null);
  const [imageError, setImageError] = useState('');

  useEffect(() => {
    if (!providedProjects) {
      loadProjects();
    }
  }, [providedProjects]);

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      validateImageFile(file);
      setImageFile(file);
      setImageError('');
      const reader = new FileReader();
      reader.onload = (ev) => setImagePreview(ev.target.result);
      reader.readAsDataURL(file);
    } catch (err) {
      setImageError(err.message);
      setImageFile(null);
    }
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setImageError('');
  };

  useEffect(() => {
    if (!isEdit || formData.type !== transaction?.type) {
      const categories =
        formData.type === TRANSACTION_TYPES.INCOME ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
      setFormData((prev) => ({ ...prev, category: categories[0] }));
    }
  }, [formData.type, isEdit, transaction]);

  const loadProjects = async () => {
    try {
      const projectList = await getAllProjects();
      setProjects(projectList);
    } catch (error) {
      console.error('Error loading projects:', error);
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.projectId) {
      newErrors.projectId = 'Proyek harus dipilih';
    }

    if (!formData.date) {
      newErrors.date = 'Tanggal harus diisi';
    }

    if (!formData.category) {
      newErrors.category = 'Kategori harus dipilih';
    }

    if (!formData.amount || formData.amount <= 0) {
      newErrors.amount = 'Nominal harus lebih dari 0';
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Keterangan harus diisi';
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
      const project = projects.find((p) => p.id === formData.projectId);
      const transactionData = {
        ...formData,
        amount: parseFloat(formData.amount),
        projectName: project?.name || ''
      };

      // Unggah bukti gambar (opsional) bila ada file baru dipilih
      if (imageFile) {
        const uploaded = await uploadTransactionImage(imageFile, currentUser?.uid || 'manual');
        transactionData.imageUrl = uploaded.url;
        transactionData.imagePath = uploaded.path;
      } else if (isEdit && transaction?.imageUrl && imagePreview) {
        // Pertahankan bukti lama saat edit tanpa ganti gambar
        transactionData.imageUrl = transaction.imageUrl;
        transactionData.imagePath = transaction.imagePath;
      }

      if (isEdit) {
        await updateTransaction(transaction.id, transactionData);
      } else {
        await addTransaction(transactionData);
      }

      onSuccess();
    } catch (error) {
      console.error('Error saving transaction:', error);
      alert('Gagal menyimpan transaksi. Silakan coba lagi.');
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

  const categories =
    formData.type === TRANSACTION_TYPES.INCOME ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  return (
    <Modal
      isOpen={isOpen}
      onClose={loading ? undefined : onClose}
      title={isEdit ? 'Edit Transaksi' : 'Transaksi Manual'}
      subtitle="Catat pemasukan atau pengeluaran proyek"
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Batal
          </Button>
          <Button type="submit" form="transaction-form" loading={loading}>
            {loading ? 'Menyimpan…' : isEdit ? 'Simpan Perubahan' : 'Simpan Transaksi'}
          </Button>
        </>
      }
    >
      <form id="transaction-form" onSubmit={handleSubmit} className="space-y-4">
        <Field label="Proyek" required error={errors.projectId}>
          <Select
            name="projectId"
            value={formData.projectId}
            onChange={handleChange}
            error={errors.projectId}
            disabled={loading || Boolean(projectId)}
          >
            <option value="">Pilih Proyek</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name} — {project.partner}
              </option>
            ))}
          </Select>
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Tanggal" required error={errors.date}>
            <Input
              type="datetime-local"
              name="date"
              value={formData.date}
              onChange={handleChange}
              error={errors.date}
              disabled={loading}
            />
          </Field>

          <Field label="Tipe Transaksi" required>
            <Select name="type" value={formData.type} onChange={handleChange} disabled={loading}>
              <option value={TRANSACTION_TYPES.INCOME}>Pemasukan</option>
              <option value={TRANSACTION_TYPES.EXPENSE}>Pengeluaran</option>
            </Select>
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Kategori" required error={errors.category}>
            <Select
              name="category"
              value={formData.category}
              onChange={handleChange}
              error={errors.category}
              disabled={loading}
            >
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Nominal (Rp)" required error={errors.amount}>
            <Input
              type="number"
              name="amount"
              value={formData.amount}
              onChange={handleChange}
              error={errors.amount}
              min="0"
              step="1000"
              placeholder="0"
              disabled={loading}
            />
          </Field>
        </div>

        <Field label="Keterangan" required error={errors.description}>
          <Textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            error={errors.description}
            rows="3"
            placeholder="cth. Pembelian material semen 50 sak"
            disabled={loading}
          />
        </Field>

        {/* Bukti transaksi (opsional) */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            Bukti Transaksi <span className="font-normal text-slate-400">(opsional)</span>
          </label>
          {imagePreview ? (
            <div className="relative inline-block">
              <img
                src={imagePreview}
                alt="Bukti"
                className="h-32 w-auto rounded-lg border border-slate-200 object-contain"
              />
              <button
                type="button"
                onClick={removeImage}
                disabled={loading}
                className="absolute -right-2 -top-2 rounded-full bg-white p-1 text-slate-500 shadow-card ring-1 ring-slate-200 hover:text-red-600"
                title="Hapus gambar"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-slate-200 bg-slate-50/50 px-4 py-3 text-sm text-slate-500 transition-colors hover:border-brand-300 hover:bg-brand-50/40">
              <UploadCloud className="h-5 w-5 text-slate-400" />
              <span>
                <span className="font-medium text-brand-600">Upload bukti</span> — foto nota /
                transfer (JPG, PNG, maks 5MB)
              </span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageChange}
                disabled={loading}
              />
            </label>
          )}
          {imageError && <p className="mt-1 text-xs text-red-600">{imageError}</p>}
          {imageFile && (
            <p className="mt-1 flex items-center gap-1 text-xs text-slate-400">
              <ImageIcon className="h-3 w-3" />
              {imageFile.name} — diunggah saat disimpan
            </p>
          )}
        </div>
      </form>
    </Modal>
  );
};

export default TransactionModal;
