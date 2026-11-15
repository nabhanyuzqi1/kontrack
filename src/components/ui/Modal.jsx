import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

const sizes = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  // Halaman penuh: dipakai detail dokumen yang isinya panjang (invoice).
  // Lebar dibatasi supaya baris teks tidak melebar tanpa batas di layar ultrawide,
  // tetapi tinggi selalu penuh sehingga isi tidak "dipotong" oleh viewport.
  full: 'max-w-[1400px]'
};

// Varian drawer: `width` menentukan batas lebarnya.
const DRAWER_WIDTH = {
  narrow: 'max-w-2xl',
  wide: 'max-w-5xl',
  full: 'max-w-none'
};

/**
 * Modal dengan dua varian.
 * - default: dialog terpusat.
 * - drawer: slide-over dari kanan (gaya ERP modern — konten di belakang tetap
 *   terlihat, cepat dibuka-tutup untuk melihat detail sambil membandingkan
 *   daftar di belakangnya).
 */
const Modal = ({ isOpen, onClose, title, subtitle, size = 'md', drawer = false, drawerWidth = 'narrow', children, footer }) => {
  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Dirender lewat portal ke <body>, bukan di tempat pemanggilnya.
  // Sebab: <main> memakai .page-enter (animasi dengan `transform`), dan elemen
  // ber-transform membentuk stacking context baru — `position: fixed` di
  // dalamnya ikut terkurung, sehingga modal tampil DI BAWAH header sticky
  // (z-40). Menaikkan z-index tidak menyelesaikan ini; portal memindahkan
  // modal ke akar dokumen sehingga lapisannya benar-benar global.
  const content = (
    <div
      className={`fixed inset-0 z-[100] bg-scrim/45 backdrop-blur-sm animate-fade-in ${
        drawer ? 'flex justify-end' : 'flex items-center justify-center p-4'
      }`}
      onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <div
        className={
          drawer
            ? `panel-solid flex h-full w-full flex-col overflow-hidden shadow-2xl animate-slide-in-right ${
                DRAWER_WIDTH[drawerWidth] || DRAWER_WIDTH.narrow
              }`
            : `panel-solid flex max-h-[92vh] w-full flex-col overflow-hidden shadow-2xl animate-scale-in ${sizes[size]}`
        }
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-start justify-between border-b border-slate-200/70 px-6 py-4">
          <div>
            <h2 className="font-display text-lg font-semibold text-slate-900">{title}</h2>
            {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            aria-label="Tutup"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className={`custom-scrollbar flex-1 overflow-y-auto pb-10 pt-5 ${drawerWidth === "full" ? "px-6 md:px-8" : "px-6"}`}>{children}</div>

        {footer && (
          <div className="flex justify-end gap-3 border-t border-slate-200/70 bg-slate-100/60 px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(content, document.body);
};

export default Modal;
