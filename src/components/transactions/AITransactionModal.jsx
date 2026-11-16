// src/components/transactions/AITransactionModal.jsx
import React, { useState } from 'react';
import { Sparkles, UploadCloud, CheckCircle2, X } from 'lucide-react';
import { addTransaction } from '../../services/transactions';
import { analyzeTransactionImages, validateImageFile } from '../../services/ai';
import { normalizeTxDateTime } from '../../utils/txDateTime';
import { correctCategoryFromText } from '../../utils/transactionMeta';
import AITransactionCard from './AITransactionCard';


import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { Select } from '../ui/Field';

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
      // Tanggal dinormalkan SEKALI di sini: hasil AI bisa berbentuk
      // "2026-05-01" (tanpa jam) atau "1 Mei 2026". Tanpa normalisasi, jam
      // hilang dan input datetime-local tampil kosong.
      setResults(raw.map((r) => {
        // Jaring pengaman: kata kunci pada catatan (mis. "bon gendro") memaksa
        // kategori yang benar walau model memilih "Pengeluaran Lain".
        const fixed = correctCategoryFromText(r);
        return {
          ...r,
          projectId: selectedProjectId,
          category: fixed || r.category,
          // Dicatat supaya kartu bisa memberi tahu bahwa kategori diubah, bukan
          // diam-diam berbeda dari hasil AI.
          categoryCorrectedFrom: fixed ? r.category : undefined,
          date: normalizeTxDateTime(r.date, r.time, { fallbackToNow: false }) || '',
        };
      }));
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
          // Bila tanggal tetap kosong (pengguna tidak mengisi), barulah pakai
          // waktu sekarang — dicatat sebagai koreksi sistem, bukan hasil bacaan.
          date: normalizeTxDateTime(r.date, null),
          dateSource: r.date ? 'ai' : 'system',
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
      size="screen"
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
              <span className="font-semibold text-brand-700">Klik untuk upload</span> — bisa pilih banyak
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
                    className="absolute -right-1.5 -top-1.5 rounded-full bg-slate-100 p-1 text-slate-500 shadow-card ring-1 ring-slate-200 hover:text-red-600"
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
            {results.some((x) => !x.date) && (
              <span className="ml-1 font-medium text-amber-700 dark:text-amber-400">
                {results.filter((x) => !x.date).length} hasil belum bertanggal.
              </span>
            )}
          </p>

          {/* pb-1 memberi napas ke kartu terakhir di depan footer modal; tanpa
              ini kartu terlihat menempel/terpotong tepi panel. */}
          <div className="space-y-3 pb-1">
            {results.map((r, idx) => (
              <AITransactionCard
                key={idx}
                index={idx}
                result={r}
                onUpdate={updateResult}
                onRemove={removeResult}
                disabled={busy}
              />
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
};

export default AITransactionModal;
