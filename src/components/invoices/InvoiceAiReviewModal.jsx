// src/components/invoices/InvoiceAiReviewModal.jsx
// Konfirmasi hasil analisis AI arsip invoice (WPHO / BAHK / Faktur Pajak).
//
// Kenapa bukan langsung diterapkan: pembacaan AI atas dokumen pindai bisa salah
// (angka mirip, cap menutupi nomor). Pemilik harus melihat nilai lama vs nilai
// baru per dokumen, lalu memilih mana yang dipakai. Bidang yang tidak dipilih
// tetap seperti semula dan masih bisa diedit manual lewat form invoice.

import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, Loader2, Sparkles, X } from 'lucide-react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { INVOICE_DOC_LABELS } from '../../services/invoices';

const DOC_ORDER = ['wpho', 'bahk', 'faktur'];

const SEVERITY_STYLE = {
  error: { tone: 'text-rose-600 dark:text-rose-300', Icon: AlertTriangle, label: 'Perlu diperbaiki' },
  warning: { tone: 'text-amber-600 dark:text-amber-300', Icon: AlertTriangle, label: 'Perlu diperiksa' },
  info: { tone: 'text-slate-500', Icon: Info, label: 'Catatan' },
};

const formatIDR = (n) => {
  const value = Number(n);
  if (!Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value);
};

// Bandingkan field lama vs hasil AI, tampilkan hanya yang berbeda/terisi.
const rowFor = (key, label, oldValue, newValue, formatter = (v) => (v === undefined || v === null || v === '' ? '—' : String(v))) => ({
  key,
  label,
  old: formatter(oldValue),
  next: formatter(newValue),
  hasNew: newValue !== undefined && newValue !== null && newValue !== '',
});

const InvoiceAiReviewModal = ({ isOpen, state, error, result, invoice, onClose, onApply }) => {
  const [selected, setSelected] = useState(() =>
    DOC_ORDER.reduce((acc, k) => ({ ...acc, [k]: true }), {})
  );
  const [applying, setApplying] = useState(false);

  const docs = Array.isArray(result?.documents) ? result.documents : [];
  const issues = Array.isArray(result?.issues) ? result.issues : [];

  // Kelompokkan hasil per jenis dokumen; server boleh mengembalikan beberapa
  // potongan untuk satu jenis (mis. dokumen multi-halaman).
  const byKind = useMemo(() => {
    const acc = {};
    docs.forEach((d) => {
      const kind = DOC_ORDER.includes(d.kind) ? d.kind : null;
      if (!kind) return;
      if (!acc[kind]) acc[kind] = [];
      acc[kind].push(d);
    });
    return acc;
  }, [docs]);

  const rowsFor = (kind) => {
    const found = (byKind[kind] || [])[0] || {};
    const old = invoice || {};
    if (kind === 'wpho') {
      return [
        rowFor('number', 'Nomor WPHO/BAST', old.wphoNumber, found.number),
        rowFor('amount', 'Nilai pekerjaan', old.wphoValue, found.amount, formatIDR),
        rowFor('date', 'Tanggal BA', old.cityDate, found.date),
        rowFor('workName', 'Uraian pekerjaan', old.workName || old.projectName, found.workName),
      ].filter((r) => r.hasNew);
    }
    if (kind === 'bahk') {
      return [
        rowFor('number', 'Nomor BAHK', old.bahkNumber, found.number),
        rowFor('amount', 'Nilai BAHK', old.bahkValue, found.amount, formatIDR),
        rowFor('date', 'Tanggal BAHK', old.lastBaDate, found.date),
      ].filter((r) => r.hasNew);
    }
    return [
      rowFor('number', 'Nomor Faktur Pajak', old.taxInvoiceNumber, found.number),
      rowFor('amount', 'DPP / harga jual', old.subtotal, found.amount, formatIDR),
      rowFor('date', 'Tanggal faktur', old.issueDate, found.date),
    ].filter((r) => r.hasNew);
  };

  const available = DOC_ORDER.filter((k) => (byKind[k] || []).length > 0);
  const chosenCount = available.filter((k) => selected[k]).length;

  const handleApply = async () => {
    if (chosenCount === 0) return;
    setApplying(true);
    try {
      const selections = {};
      available.forEach((k) => {
        if (!selected[k]) return;
        const found = byKind[k][0] || {};
        selections[k] = {
          applied: true,
          number: found.number || undefined,
          amount: Number.isFinite(Number(found.amount)) ? Number(found.amount) : undefined,
          date: found.date || undefined,
          workName: found.workName || undefined,
        };
      });
      await onApply(selections);
    } finally {
      setApplying(false);
    }
  };

  const footer = state === 'done' && available.length > 0 ? (
    <>
      <Button variant="secondary" onClick={onClose} disabled={applying}>
        Tidak, biarkan seperti sekarang
      </Button>
      <Button onClick={handleApply} loading={applying} disabled={chosenCount === 0}>
        <CheckCircle2 className="h-4 w-4" />
        Terapkan {chosenCount} dokumen
      </Button>
    </>
  ) : (
    <Button variant="secondary" onClick={onClose}>
      Tutup
    </Button>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={applying ? undefined : onClose}
      title="Periksa Hasil Analisis AI"
      subtitle="Tidak ada yang diubah sampai Anda menyetujuinya"
      size="lg"
      footer={footer}
    >
      {state === 'busy' && (
        <div className="flex items-center gap-2 py-8 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Membaca dokumen arsip…
        </div>
      )}

      {state === 'error' && (
        <div className="rounded-[10px] bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
          {error || 'Dokumen tidak dapat dianalisis.'}
        </div>
      )}

      {state === 'done' && (
        <div className="space-y-5">
          {available.length === 0 && (
            <p className="text-sm text-slate-500">
              Tidak ada data yang terbaca dari dokumen. Isi bidangnya secara manual.
            </p>
          )}

          {available.map((kind) => {
            const rows = rowsFor(kind);
            const conf = (byKind[kind][0] || {}).confidence;
            return (
              <div
                key={kind}
                className="rounded-[10px] border border-slate-200 p-3 dark:border-white/10"
              >
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={Boolean(selected[kind])}
                    onChange={(e) => setSelected((p) => ({ ...p, [kind]: e.target.checked }))}
                    className="h-4 w-4 accent-brand-600"
                  />
                  <span className="text-sm font-semibold text-slate-800">
                    {INVOICE_DOC_LABELS[kind] || kind}
                  </span>
                  {conf && conf !== 'yakin' && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                      {conf}
                    </span>
                  )}
                </label>

                {rows.length === 0 ? (
                  <p className="mt-2 text-xs text-slate-400">Tidak ada nilai baru yang terbaca.</p>
                ) : (
                  <div className="mt-2 space-y-1.5">
                    {rows.map((r) => (
                      <div key={r.key} className="grid grid-cols-[1fr_auto] gap-2 text-xs">
                        <span className="text-slate-500">{r.label}</span>
                        <span className="text-right">
                          <span className="text-slate-400 line-through">{r.old}</span>
                          <span className="mx-1.5 text-slate-300">→</span>
                          <span className="font-semibold text-slate-800">{r.next}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {issues.length > 0 && (
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                <Sparkles className="h-3.5 w-3.5" />
                Temuan pemeriksaan
              </p>
              <ul className="space-y-1.5">
                {issues.map((issue, i) => {
                  const style = SEVERITY_STYLE[issue.severity] || SEVERITY_STYLE.info;
                  const Icon = style.Icon;
                  return (
                    <li key={i} className="flex items-start gap-2 text-xs">
                      <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${style.tone}`} />
                      <span className="text-slate-600">{issue.message}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <p className="text-xs text-slate-400">
            Hasil AI bisa salah pada pindaian buram. Setelah diterapkan, bidangnya masih bisa
            diedit manual lewat tombol Edit.
          </p>
        </div>
      )}
    </Modal>
  );
};

export default InvoiceAiReviewModal;
