// src/components/transactions/AITransactionModal.jsx
import React, { useState } from 'react';
import { Sparkles, UploadCloud, CheckCircle2, X, Trash2 } from 'lucide-react';
import { addTransaction } from '../../services/transactions';
import { analyzeTransactionImages, validateImageFile } from '../../services/ai';
import { formatDateTimeForInput, formatCurrency } from '../../utils/formatters';
import { TRANSACTION_TYPES, INCOME_CATEGORIES, EXPENSE_CATEGORIES } from '../../utils/constants';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { Field, Input, Select, Textarea } from '../ui/Field';

const StepBadge = ({ number, label, done }) => (
  <div className="mb-3 flex items-center gap-2.5">
    <span
      className={`flex h-7 w-7 items-center justify-center rounded-full font-display text-sm font-bold ${
        done ? 'bg-emerald-100 text-emerald-600' : 'bg-brand-gradient text-white'
      }`}
    >
      {done ? <CheckCircle2 className="h-4 w-4" /> : number}
    </span>
    <h3 className="font-display text-sm font-semibold text-slate-800">{label}</h3>
  </div>
);

const MAX_FILES = 8;

const AITransactionModal = ({ isOpen, onClose, onSuccess, projects, currentUser }) => {
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [files, setFiles] = useState([]); // {file, previewUrl}
  const [results, setResults] = useState(null); // array of edited results

  const handleFilesChange = (e) => {
    const picked = Array.from(e.target.files || []);
    if (picked.length === 0) return;
    setError('');
    const next = [...files];
    for (const file of picked) {
      if (next.length >= MAX_FILES) {
        setError(`Maksimal ${MAX_FILES} gambar per analisis.`);
        break;
      }
      try {
        validateImageFile(file);
        const reader = new FileReader();
        reader.onload = (ev) =>
          setFiles((prev) => [...prev, { file, previewUrl: ev.target.result }]);
        reader.readAsDataURL(file);
        next.push(file);
      } catch (err) {
        setError(err.message);
      }
    }
    e.target.value = ''; // izinkan pilih file yang sama lagi
  };

  const removeFile = (idx) => setFiles((prev) => prev.filter((_, i) => i !== idx));

  const handleAnalyze = async () => {
    if (!selectedProjectId) return setError('Pilih proyek terlebih dahulu');
    if (files.length === 0) return setError('Pilih minimal satu gambar');

    setAnalyzing(true);
    setError('');
    try {
      const raw = await analyzeTransactionImages(files.map((f) => f.file), currentUser.uid);
      setResults(raw.map((r) => ({ ...r, projectId: selectedProjectId })));
    } catch (err) {
      console.error('Analysis error:', err);
      setError(err.message || 'Gagal menganalisis gambar. Pastikan gambar jelas.');
    } finally {
      setAnalyzing(false);
    }
  };

  const updateResult = (idx, patch) =>
    setResults((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));

  const removeResult = (idx) => setResults((prev) => prev.filter((_, i) => i !== idx));

  const handleSubmit = async () => {
    if (!results || results.length === 0) return;
    setLoading(true);
    setError('');
    try {
      const project = projects.find((p) => p.id === selectedProjectId);
      if (!project) throw new Error('Proyek tidak ditemukan');

      for (const r of results) {
        await addTransaction({
          ...r,
          projectId: selectedProjectId,
          projectName: project.name,
          date: r.date || new Date().toISOString(),
          createdBy: currentUser.uid,
          isAIProcessed: true
        });
      }
      onSuccess();
      handleClose();
    } catch (err) {
      console.error('Submit error:', err);
      setError(err.message || 'Gagal menyimpan transaksi');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFiles([]);
    setResults(null);
    setError('');
    setSelectedProjectId('');
    onClose();
  };

  const busy = loading || analyzing;

  return (
    <Modal
      isOpen={isOpen}
      onClose={busy ? undefined : handleClose}
      title="Input Transaksi dengan AI"
      subtitle="Upload satu atau beberapa bukti transfer / invoice — AI membaca semuanya sekaligus"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={busy}>
            Batal
          </Button>
          {results && results.length > 0 && (
            <Button variant="success" onClick={handleSubmit} loading={loading}>
              {loading ? 'Menyimpan…' : `Simpan ${results.length} Transaksi`}
            </Button>
          )}
        </>
      }
    >
      {error && (
        <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Langkah 1: proyek */}
      <div className="mb-6">
        <StepBadge number={1} label="Pilih Proyek" done={Boolean(selectedProjectId)} />
        <Select value={selectedProjectId} onChange={(e) => setSelectedProjectId(e.target.value)} required>
          <option value="">— Pilih Proyek —</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name} — {project.partner}
            </option>
          ))}
        </Select>
      </div>

      {/* Langkah 2: upload multi */}
      {!results && (
        <div className="mb-6">
          <StepBadge number={2} label={`Upload Bukti (${files.length}/${MAX_FILES})`} done={files.length > 0} />
          <label className="group flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 px-6 py-6 text-center transition-colors hover:border-brand-300 hover:bg-brand-50/40">
            <input type="file" accept="image/*" multiple onChange={handleFilesChange} className="hidden" />
            <UploadCloud className="mb-2 h-9 w-9 text-slate-300 transition-colors group-hover:text-brand-400" />
            <p className="text-sm text-slate-600">
              <span className="font-semibold text-brand-600">Klik untuk upload</span> — bisa pilih banyak
            </p>
            <p className="mt-1 text-xs text-slate-400">JPG, PNG, WebP · maks 5MB/gambar</p>
          </label>

          {files.length > 0 && (
            <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
              {files.map((f, idx) => (
                <div key={idx} className="relative">
                  <img
                    src={f.previewUrl}
                    alt={`Bukti ${idx + 1}`}
                    className="h-24 w-full rounded-lg border border-slate-200 object-cover"
                  />
                  <button
                    onClick={() => removeFile(idx)}
                    disabled={busy}
                    className="absolute -right-1.5 -top-1.5 rounded-full bg-white p-1 text-slate-500 shadow-card ring-1 ring-slate-200 hover:text-red-600"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Langkah 3: analisis */}
      {!results && selectedProjectId && files.length > 0 && (
        <Button variant="gradient" size="lg" onClick={handleAnalyze} loading={analyzing} className="w-full">
          {analyzing ? (
            `Menganalisis ${files.length} gambar…`
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Analisis {files.length} Gambar dengan AI
            </>
          )}
        </Button>
      )}

      {/* Langkah 4: verifikasi tiap hasil */}
      {results && (
        <div>
          <StepBadge number={3} label={`Verifikasi ${results.length} Hasil`} done={false} />
          <p className="mb-4 text-sm text-slate-500">
            Periksa & edit tiap transaksi sebelum disimpan. Hapus yang tidak perlu.
          </p>

          <div className="space-y-4">
            {results.map((r, idx) => {
              const categories =
                r.type === TRANSACTION_TYPES.INCOME ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
              return (
                <div key={idx} className="rounded-xl border border-slate-200 p-4">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {r.imageUrl && (
                        <img
                          src={r.imageUrl}
                          alt=""
                          className="h-12 w-12 rounded-lg border border-slate-200 object-cover"
                        />
                      )}
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-violet-600">
                          Bukti #{idx + 1}
                        </p>
                        <p
                          className={`font-display text-sm font-bold ${
                            r.type === 'income' ? 'text-emerald-600' : 'text-red-600'
                          }`}
                        >
                          {r.type === 'income' ? '+' : '−'}
                          {formatCurrency(r.amount)}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => removeResult(idx)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                      title="Hapus hasil ini"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Field label="Tanggal & Waktu">
                      <Input
                        type="datetime-local"
                        value={formatDateTimeForInput(r.date)}
                        onChange={(e) => updateResult(idx, { date: e.target.value })}
                      />
                    </Field>
                    <Field label="Jenis">
                      <Select
                        value={r.type}
                        onChange={(e) => {
                          const newType = e.target.value;
                          updateResult(idx, {
                            type: newType,
                            category:
                              newType === TRANSACTION_TYPES.INCOME
                                ? INCOME_CATEGORIES[0]
                                : EXPENSE_CATEGORIES[0]
                          });
                        }}
                      >
                        <option value={TRANSACTION_TYPES.INCOME}>Pemasukan</option>
                        <option value={TRANSACTION_TYPES.EXPENSE}>Pengeluaran</option>
                      </Select>
                    </Field>
                    <Field label="Kategori">
                      <Select value={r.category} onChange={(e) => updateResult(idx, { category: e.target.value })}>
                        {categories.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Nominal (Rp)">
                      <Input
                        type="number"
                        value={r.amount}
                        onChange={(e) => updateResult(idx, { amount: Number(e.target.value) })}
                        min="0"
                        step="1000"
                      />
                    </Field>
                    <div className="sm:col-span-2">
                      <Field label="Deskripsi">
                        <Textarea
                          value={r.description}
                          onChange={(e) => updateResult(idx, { description: e.target.value })}
                          rows="2"
                        />
                      </Field>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Modal>
  );
};

export default AITransactionModal;
