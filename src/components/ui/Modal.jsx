import React, { useEffect } from 'react';
import { X } from 'lucide-react';

const sizes = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl'
};

/**
 * Modal dengan dua varian.
 * - default: dialog terpusat.
 * - drawer: slide-over dari kanan (gaya ERP modern — konten di belakang tetap
 *   terlihat, cepat dibuka-tutup untuk melihat detail sambil membandingkan
 *   daftar di belakangnya).
 */
const Modal = ({ isOpen, onClose, title, subtitle, size = 'md', drawer = false, children, footer }) => {
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

  return (
    <div
      className={`fixed inset-0 z-50 bg-scrim/45 backdrop-blur-sm animate-fade-in ${
        drawer ? 'flex justify-end' : 'flex items-center justify-center p-4'
      }`}
      onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <div
        className={
          drawer
            ? 'glass-1 flex h-full w-full max-w-2xl flex-col overflow-hidden shadow-2xl animate-slide-in-right'
            : `glass-1 flex max-h-[92vh] w-full flex-col overflow-hidden shadow-2xl animate-scale-in ${sizes[size]}`
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

        <div className="custom-scrollbar flex-1 overflow-y-auto px-6 py-5">{children}</div>

        {footer && (
          <div className="flex justify-end gap-3 border-t border-slate-200/70 bg-slate-100/60 px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export default Modal;
