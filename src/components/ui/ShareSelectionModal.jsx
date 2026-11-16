import React, { useState } from 'react';
import { MessageCircle, Copy, Check, X, Square, CheckSquare } from 'lucide-react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { copyText, shareTextWhatsApp } from '../../utils/sharing';

/**
 * Panel pratinjau ringkasan pilihan (invoice atau proyek).
 *
 * Kenapa pratinjau dulu, bukan langsung membuka WhatsApp: ringkasan dikirim ke
 * mitra, jadi pemilik harus bisa membaca dan memperbaiki sebelum terkirim.
 * Teks boleh disunting di kotak ini; yang dikirim adalah hasil suntingan.
 */
const ShareSelectionModal = ({ isOpen, onClose, title, subtitle, message, onMessageChange, count = 0 }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const ok = await copyText(message);
    setCopied(ok);
    if (ok) setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Tutup
          </Button>
          <Button variant="outline" onClick={handleCopy} disabled={!count}>
            {copied ? <Check className="mr-1.5 h-4 w-4" /> : <Copy className="mr-1.5 h-4 w-4" />}
            {copied ? 'Tersalin' : 'Salin'}
          </Button>
          <Button variant="success" onClick={() => shareTextWhatsApp(message)} disabled={!count}>
            <MessageCircle className="mr-1.5 h-4 w-4" />
            Buka WhatsApp
          </Button>
        </>
      }
    >
      {count === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300/70 px-4 py-8 text-center text-sm text-slate-500">
          Belum ada yang dipilih. Centang minimal satu baris di daftar.
        </p>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <label className="text-xs font-medium uppercase tracking-wide text-slate-500">Pratinjau pesan</label>
            <span className="text-xs text-slate-500">{message.length} karakter</span>
          </div>
          <textarea
            value={message}
            onChange={(e) => onMessageChange(e.target.value)}
            rows={16}
            spellCheck={false}
            className="field-surface custom-scrollbar w-full rounded-lg border border-slate-200/70 p-3 font-mono text-xs leading-relaxed text-slate-800 outline-none focus:border-brand-500"
          />
        </div>
      )}
    </Modal>
  );
};

/**
 * Bar aksi melayang saat mode pilih aktif: jumlah terpilih, pilih semua,
 * batal, dan buka ringkasan. Ditempel di bawah agar di ponsel tetap terjangkau
 * ibu jari (pola aplikasi Android).
 */
export const SelectionActionBar = ({ count, total, onSelectAll, onClear, onShare, label = 'dokumen' }) => {
  if (count === 0) return null;
  return (
    <div className="sticky bottom-0 z-30 mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200/70 bg-glass-3 px-3 py-2 shadow-lg backdrop-blur">
      <div className="flex items-center gap-2 text-sm">
        <span className="rounded-md bg-brand-600 px-1.5 py-0.5 text-xs font-semibold text-white">{count}</span>
        <span className="text-slate-700">
          {label} dipilih{total ? ` dari ${total}` : ''}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {onSelectAll && (
          <button onClick={onSelectAll} className="rounded-lg px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-500/10">
            Pilih semua
          </button>
        )}
        <button onClick={onClear} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-500/10">
          <X className="h-3.5 w-3.5" />
          Batal
        </button>
        <Button size="sm" onClick={onShare}>
          <MessageCircle className="mr-1.5 h-3.5 w-3.5" />
          Ringkasan
        </Button>
      </div>
    </div>
  );
};

/** Kotak centang besar untuk layar sentuh (target minimal 18px). */
export const SelectBox = ({ checked, onChange, label }) => (
  <button
    type="button"
    onClick={(e) => {
      e.stopPropagation();
      onChange(!checked);
    }}
    aria-pressed={checked}
    aria-label={label || (checked ? 'Batalkan pilihan' : 'Pilih')}
    className={`shrink-0 rounded p-0.5 transition-colors ${checked ? 'text-brand-600' : 'text-slate-400 hover:text-slate-600'}`}
  >
    {checked ? <CheckSquare className="h-5 w-5" /> : <Square className="h-5 w-5" />}
  </button>
);

export default ShareSelectionModal;
