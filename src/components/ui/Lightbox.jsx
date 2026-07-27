// src/components/ui/Lightbox.jsx
// Penampil bukti transaksi tanpa meninggalkan halaman.
// Mendukung gambar maupun PDF, zoom, geser, dan navigasi antar-berkas.

import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ZoomIn, ZoomOut, Download, ChevronLeft, ChevronRight, RotateCw } from 'lucide-react';

const isPdf = (item) =>
  item?.type === 'pdf' || /\.pdf(\?|$)/i.test(item?.url || '');

/**
 * @param {{url: string, name?: string, type?: string}[]} items
 * @param {number} index  indeks berkas yang ditampilkan
 * @param {() => void} onClose
 * @param {(i: number) => void} onNavigate
 */
const Lightbox = ({ items = [], index = 0, onClose, onNavigate }) => {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [loading, setLoading] = useState(true);

  const item = items[index];
  const many = items.length > 1;

  const go = useCallback(
    (delta) => {
      if (!many || !onNavigate) return;
      onNavigate((index + delta + items.length) % items.length);
    },
    [index, items.length, many, onNavigate]
  );

  // Reset tampilan setiap kali berkas berganti.
  useEffect(() => {
    setZoom(1);
    setRotation(0);
    setLoading(true);
  }, [index, item?.url]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
      else if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === '+' || e.key === '=') setZoom((z) => Math.min(z + 0.25, 4));
      else if (e.key === '-') setZoom((z) => Math.max(z - 0.25, 1));
    };
    window.addEventListener('keydown', onKey);

    // Kunci gulir latar selama lightbox terbuka.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [go, onClose]);

  if (!item) return null;

  const pdf = isPdf(item);

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-slate-950/90 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={item.name || 'Pratinjau berkas'}
      onClick={onClose}
    >
      {/* Bilah alat */}
      <div
        className="flex items-center justify-between gap-3 px-4 py-3 text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{item.name || 'Bukti transaksi'}</p>
          {many && (
            <p className="text-xs text-white/60">
              {index + 1} dari {items.length}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {!pdf && (
            <>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(z - 0.25, 1))}
                disabled={zoom <= 1}
                className="rounded-lg p-2 transition hover:bg-white/10 disabled:opacity-30"
                aria-label="Perkecil"
              >
                <ZoomOut className="h-5 w-5" />
              </button>
              <span className="w-12 text-center text-xs tabular-nums text-white/70">
                {Math.round(zoom * 100)}%
              </span>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(z + 0.25, 4))}
                disabled={zoom >= 4}
                className="rounded-lg p-2 transition hover:bg-white/10 disabled:opacity-30"
                aria-label="Perbesar"
              >
                <ZoomIn className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => setRotation((r) => (r + 90) % 360)}
                className="rounded-lg p-2 transition hover:bg-white/10"
                aria-label="Putar"
              >
                <RotateCw className="h-5 w-5" />
              </button>
            </>
          )}

          <a
            href={item.url}
            download={item.name}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg p-2 transition hover:bg-white/10"
            aria-label="Unduh"
          >
            <Download className="h-5 w-5" />
          </a>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 transition hover:bg-white/10"
            aria-label="Tutup"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Isi */}
      <div className="relative flex flex-1 items-center justify-center overflow-auto p-4">
        {many && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              go(-1);
            }}
            className="absolute left-3 z-10 rounded-full bg-white/10 p-2.5 text-white transition hover:bg-white/20"
            aria-label="Sebelumnya"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        )}

        {loading && !pdf && (
          <div className="absolute h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-white" />
        )}

        {pdf ? (
          <iframe
            src={item.url}
            title={item.name || 'Dokumen'}
            className="h-full w-full rounded-lg bg-white"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <img
            src={item.url}
            alt={item.name || 'Bukti transaksi'}
            onLoad={() => setLoading(false)}
            onError={() => setLoading(false)}
            onClick={(e) => e.stopPropagation()}
            className="max-h-full max-w-full select-none rounded-lg object-contain shadow-2xl transition-transform duration-150"
            style={{
              transform: `scale(${zoom}) rotate(${rotation}deg)`,
              cursor: zoom > 1 ? 'grab' : 'default'
            }}
          />
        )}

        {many && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              go(1);
            }}
            className="absolute right-3 z-10 rounded-full bg-white/10 p-2.5 text-white transition hover:bg-white/20"
            aria-label="Berikutnya"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        )}
      </div>
    </div>,
    document.body
  );
};

export default Lightbox;
