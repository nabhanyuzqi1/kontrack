import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

const sizes = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  // Lebar besar tetapi tetap berbingkai: untuk dokumen yang isinya panjang
  // namun tidak perlu memakai seluruh layar (mis. pratinjau ringkasan).
  full: 'max-w-[1400px]',
  // PENUH LAYAR: untuk form dan detail yang datanya panjang (form proyek,
  // invoice, transaksi AI, detail klien). Tidak ada sisa latar yang terlihat,
  // tombol tutup tetap di kanan atas, dan isi bergulir di dalam panel.
  screen: 'max-w-none'
};

// Varian drawer: `width` menentukan batas lebarnya.
const DRAWER_WIDTH = {
  narrow: 'max-w-2xl',
  wide: 'max-w-5xl',
  full: 'max-w-none'
};

/**
 * Modal dengan tiga varian.
 * - default: dialog terpusat.
 * - screen: panel penuh layar (semua form panjang) — data tidak terpotong.
 * - drawer: slide-over dari kanan (gaya ERP modern — konten di belakang tetap
 *   terlihat, cepat dibuka-tutup untuk melihat detail sambil membandingkan
 *   daftar di belakangnya).
 *
 * Kenapa `screen` bukan sekadar `full`: `full` hanya melebarkan panel sampai
 * 1400px, sehingga di layar 1366px form masih terkurung dan isi panjang tetap
 * bergulir dalam kotak sempit. `screen` membuang batas lebar sekaligus latar
 * gelap di belakangnya, jadi perilakunya seperti halaman penuh (dan seperti
 * aplikasi mobile: header + isi + footer).
 */
const Modal = ({
  isOpen,
  onClose,
  title,
  subtitle,
  size = 'md',
  drawer = false,
  drawerWidth = 'narrow',
  children,
  footer
}) => {
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

  const isScreen = size === 'screen';

  // Dirender lewat portal ke <body>, bukan di tempat pemanggilnya.
  // Sebab: <main> memakai .page-enter (animasi dengan `transform`), dan elemen
  // ber-transform membentuk stacking context baru — `position: fixed` di
  // dalamnya ikut terkurung, sehingga modal tampil DI BAWAH header sticky
  // (z-40). Menaikkan z-index tidak menyelesaikan ini; portal memindahkan
  // modal ke akar dokumen sehingga lapisannya benar-benar global.
  const content = (
    <div
      className={`fixed inset-0 z-[100] animate-fade-in ${
        isScreen
          ? 'flex' // penuh: tanpa padding, tanpa latar tembus pandang
          : `bg-scrim/45 backdrop-blur-sm ${drawer ? 'flex justify-end' : 'flex items-center justify-center p-4'}`
      }`}
      onMouseDown={(e) => e.target === e.currentTarget && !isScreen && onClose?.()}
    >
      <div
        className={
          drawer
            ? `panel-solid flex h-full w-full flex-col overflow-hidden shadow-2xl animate-slide-in-right ${
                DRAWER_WIDTH[drawerWidth] || DRAWER_WIDTH.narrow
              }`
            : isScreen
              ? 'panel-solid flex h-full max-h-none w-full flex-col overflow-hidden animate-scale-in'
              : `panel-solid flex max-h-[92vh] w-full flex-col overflow-hidden shadow-2xl animate-scale-in ${sizes[size]}`
        }
        role="dialog"
        aria-modal="true"
      >
        {/* Header: tinggi tetap. Di layar kecil padding mengecil agar judul
            panjang tidak mendorong tombol tutup keluar layar. */}
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200/70 px-4 py-3 sm:px-6 sm:py-4">
          <div className="min-w-0">
            <h2 className="font-display text-base font-semibold text-slate-900 sm:text-lg">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-500/10 hover:text-slate-600"
            aria-label="Tutup"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div
          className={`custom-scrollbar flex-1 overflow-y-auto ${
            isScreen ? 'px-4 pb-10 pt-4 sm:px-6 sm:pt-5 lg:px-8' : 'px-4 pb-10 pt-5 sm:px-6'
          } ${drawerWidth === 'full' ? 'md:px-8' : ''}`}
        >
          {children}
        </div>

        {/* Footer: aman untuk layar kecil (tombol membungkus, tidak terpotong). */}
        {footer && (
          <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-slate-200/70 bg-slate-500/5 px-4 py-3 sm:gap-3 sm:px-6 sm:py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(content, document.body);
};

export default Modal;
