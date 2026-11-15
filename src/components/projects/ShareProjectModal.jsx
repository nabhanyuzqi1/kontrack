// src/components/projects/ShareProjectModal.jsx
//
// Bagikan ringkasan proyek ke WhatsApp dalam satu layar pratinjau.
//
// Kenapa menggantikan tombol sekali-klik: sebelumnya gambar ringkasan langsung
// diunduh diam-diam lalu tab WhatsApp dibuka, tanpa memperlihatkan hasilnya.
// Pengguna tidak tahu gambar apa yang dikirim, tidak bisa memeriksa angkanya,
// dan tidak bisa memilih menyalin teks saja. Di sini gambar ditampilkan lebih
// dulu, lalu ada tiga aksi eksplisit: bagikan (Web Share), unduh gambar, atau
// buka WhatsApp dengan teks.
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Share2, FileDown, MessageCircle, Copy, Check, Loader2, AlertTriangle } from 'lucide-react';
import Button from '../ui/Button';

const ShareProjectModal = ({ open, onClose, project, message, imageBlob, imageName = 'ringkasan-proyek.png' }) => {
  const [imageUrl, setImageUrl] = useState(null);
  const [copied, setCopied] = useState(false);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!imageBlob) {
      setImageUrl(null);
      return undefined;
    }
    const url = URL.createObjectURL(imageBlob);
    setImageUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [imageBlob]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  const canShareFile = Boolean(imageBlob) && typeof navigator !== 'undefined' && Boolean(navigator.canShare);

  const handleShare = async () => {
    setNote('');
    if (!canShareFile) {
      setNote('Perangkat ini tidak mendukung berbagi berkas langsung. Unduh gambar lalu lampirkan sendiri di WhatsApp.');
      return;
    }
    try {
      const file = new File([imageBlob], imageName, { type: 'image/png' });
      if (!navigator.canShare({ files: [file] })) {
        setNote('Perangkat ini tidak bisa membagikan berkas gambar. Unduh gambar lalu lampirkan manual.');
        return;
      }
      await navigator.share({ files: [file], text: message });
      setNote('Ringkasan terkirim.');
    } catch (e) {
      if (e?.name !== 'AbortError') setNote('Berbagi dibatalkan atau gagal. Coba unduh gambar.');
    }
  };

  const handleDownload = () => {
    if (!imageUrl) return;
    const a = document.createElement('a');
    a.href = imageUrl;
    a.download = imageName;
    a.click();
    setNote('Gambar diunduh. Lampirkan di WhatsApp.');
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setNote('Teks gagal disalin. Salin manual dari kotak di bawah.');
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-scrim/45 p-4 backdrop-blur-sm animate-fade-in"
      onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}
      role="dialog"
      aria-modal="true"
      aria-label="Bagikan proyek ke WhatsApp"
    >
      <div className="panel-solid flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200/70 px-5 py-3.5 dark:border-white/10">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900">Bagikan ke WhatsApp</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Periksa dulu isinya. Gambar dan teks di bawah ini yang akan dikirim.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-500/10 hover:text-slate-600"
            aria-label="Tutup"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto p-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          {/* Kiri: gambar ringkasan */}
          <div className="min-w-0">
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Gambar ringkasan</p>
            {imageUrl ? (
              <img
                src={imageUrl}
                alt="Ringkasan proyek"
                className="w-full rounded-[10px] ring-1 ring-inset ring-slate-200/70 dark:ring-white/10"
              />
            ) : (
              <div className="flex aspect-square w-full items-center justify-center rounded-[10px] bg-slate-500/5 text-slate-400 ring-1 ring-inset ring-slate-200/70 dark:ring-white/10">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                <span className="text-xs">Menyiapkan gambar…</span>
              </div>
            )}
          </div>

          {/* Kanan: teks pesan + aksi */}
          <div className="flex min-w-0 flex-col">
            <div className="mb-1.5 flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Teks pesan</p>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium text-brand-700 hover:bg-brand-500/10 dark:text-brand-300"
              >
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {copied ? 'Tersalin' : 'Salin'}
              </button>
            </div>
            <pre className="max-h-64 flex-1 overflow-auto whitespace-pre-wrap break-words rounded-[10px] bg-slate-500/5 p-3 text-[12px] leading-relaxed text-slate-700 ring-1 ring-inset ring-slate-200/70 dark:ring-white/10">
              {message}
            </pre>

            {note && (
              <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-800 dark:text-amber-300">
                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                {note}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200/70 px-5 py-3 dark:border-white/10">
          <Button variant="secondary" size="sm" onClick={handleDownload} disabled={!imageUrl}>
            <FileDown className="h-4 w-4" />
            Unduh gambar
          </Button>
          <a
            href={`https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`}
            target="_blank"
            rel="noreferrer"
          >
            <Button variant="secondary" size="sm">
              <MessageCircle className="h-4 w-4" />
              Buka WhatsApp
            </Button>
          </a>
          <Button size="sm" onClick={handleShare} disabled={!canShareFile}>
            <Share2 className="h-4 w-4" />
            Bagikan gambar
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ShareProjectModal;
