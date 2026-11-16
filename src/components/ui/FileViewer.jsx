// src/components/ui/FileViewer.jsx
//
// Penampil berkas dalam aplikasi: gambar dan PDF dilihat di tempat, tanpa
// memaksa unduh.
//
// Kenapa perlu komponen sendiri, bukan <a target="_blank">:
// - PDF di Cloud Storage dikirim dengan Content-Disposition: attachment, jadi
//   tab baru langsung memicu unduhan (atau halaman kosong "blocked").
// - Akibatnya PDF tidak pernah bisa DIPERIKSA sebelum diunduh, padahal berkas
//   seperti faktur pajak perlu dilihat cepat.
//
// Cara kerja: berkas diambil sebagai blob lalu dirender dari object URL
// (blob:) yang tidak membawa header lampiran. Gambar dirender langsung;
// PDF lewat <iframe>. Unduh tetap tersedia sebagai aksi terpisah.
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, FileDown, Loader2, AlertTriangle, FileText } from 'lucide-react';
import Button from './Button';
import { fetchAssetPayload } from '../../services/assets';

const isPdf = (name = '', url = '', type = '') => type === 'application/pdf' || /\.pdf($|\?)/i.test(name) || /\.pdf($|\?)/i.test(url);
const isTiff = (name = '', url = '') => /\.(tif|tiff)($|\?)/i.test(name) || /\.(tif|tiff)($|\?)/i.test(url);
const dataUrlToBlob = (url) => {
  const [head, b64] = url.split(',');
  const mime = /data:([^;]+)/.exec(head)?.[1] || 'application/octet-stream';
  const bin = atob(b64 || '');
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
};

const FileViewer = ({ file, onClose }) => {
  const [objectUrl, setObjectUrl] = useState(null);
  const [state, setState] = useState('idle'); // idle | loading | ready | error
  const [errorText, setErrorText] = useState('');
  const [conversionNote, setConversionNote] = useState('');

  const label = file?.name || 'Berkas';
  const pdf = isPdf(file?.name, file?.url);
  const tiff = isTiff(label, file?.url);

  useEffect(() => {
    if (!file?.url) return undefined;

    // Blob yang sudah disiapkan pemanggil (mis. PDF yang baru dibuat generator)
    if (file.blob) {
      const url = URL.createObjectURL(file.blob);
      setObjectUrl(url);
      setState('ready');
      return () => URL.revokeObjectURL(url);
    }

    let alive = true;
    let created = null;
    setState('loading');
    setObjectUrl(null);
    setConversionNote('');
    setErrorText('');

    fetchAssetPayload(file.url)
      .then((payload) => {
        if (!alive) return;
        const blob = dataUrlToBlob(payload.dataUrl);
        created = URL.createObjectURL(blob);
        setObjectUrl(created);
        setState('ready');
        if (payload.converted) setConversionNote('TIFF diubah menjadi PNG agar dapat ditampilkan. Berkas asli tidak berubah.');
        else if (isTiff(file.name, file.url)) setConversionNote(payload.conversionNote || 'TIFF tidak dapat ditampilkan di peramban.');
      })
      .catch((error) => {
        if (!alive) return;
        const code = error?.code || '';
        if (code === 'functions/resource-exhausted') setErrorText('Kuota harian membuka berkas sudah habis.');
        else if (code === 'functions/unauthenticated') setErrorText('Sesi login berakhir. Masuk ulang lalu coba lagi.');
        else if (code === 'functions/not-found') setErrorText('Berkas tidak ditemukan di arsip.');
        else setErrorText(error?.message || 'Berkas gagal dimuat.');
        setState('error');
      });

    return () => {
      alive = false;
      if (created) URL.revokeObjectURL(created);
    };
  }, [file?.url, file?.blob]);

  useEffect(() => {
    if (!file) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [file, onClose]);

  if (!file) return null;

  // Portal ke <body>: <main> memakai animasi ber-transform yang membentuk
  // stacking context, sehingga elemen fixed di dalamnya terkurung di bawah header.
  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-scrim/70 backdrop-blur-sm animate-fade-in"
      onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}
      role="dialog"
      aria-modal="true"
      aria-label={label}
    >
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-2.5">
        <p className="min-w-0 truncate text-sm font-medium text-white">
          {pdf ? <FileText className="mr-1.5 inline h-4 w-4" /> : null}
          {label}
        </p>
        <div className="flex shrink-0 items-center gap-2">
          {objectUrl && (
            <a href={objectUrl} download={label}>
              <Button variant="secondary" size="sm">
                <FileDown className="h-4 w-4" />
                Unduh
              </Button>
            </a>
          )}
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Tutup"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {conversionNote && (
        <p className="border-b border-white/10 bg-white/5 px-4 py-1.5 text-xs text-white/75">
          {conversionNote}
        </p>
      )}

      <div className="flex min-h-0 flex-1 items-center justify-center p-3">
        {state === 'loading' && (
          <p className="flex items-center gap-2 text-sm text-white/80">
            <Loader2 className="h-4 w-4 animate-spin" />
            Memuat berkas…
          </p>
        )}

        {state === 'error' && (
          <div className="max-w-md rounded-[10px] bg-white p-5 text-center">
            <AlertTriangle className="mx-auto mb-2 h-6 w-6 text-amber-600" />
            <p className="text-sm font-semibold text-slate-800">Berkas gagal dimuat di pratinjau</p>
            <p className="mt-1 text-xs text-slate-500">{errorText || 'Berkas gagal dimuat.'}</p>
            <a href={file.url} target="_blank" rel="noreferrer" className="mt-3 inline-block">
              <Button size="sm">Buka di tab baru</Button>
            </a>
          </div>
        )}

        {state === 'ready' && objectUrl && (
          pdf ? (
            <iframe
              src={objectUrl}
              title={label}
              className="h-full w-full rounded-[10px] bg-white"
            />
          ) : (
            <img
              src={objectUrl}
              alt={label}
              className="max-h-full max-w-full rounded-[10px] object-contain"
            />
          )
        )}
      </div>
    </div>,
    document.body
  );
};

export default FileViewer;
