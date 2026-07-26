// src/components/invoices/CoretaxExportModal.jsx
// Ekspor faktur pajak massal ke XML CoreTax (unggah di menu e-Faktur → Impor).
import React, { useState, useMemo } from 'react';
import { FileCode2, TriangleAlert, CheckCircle2 } from 'lucide-react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { Field, Select, Input } from '../ui/Field';
import { formatCurrency } from '../../utils/formatters';
import {
  downloadCoretaxXml,
  validateForCoretax,
  CORETAX_SERVICE_CODES,
  CORETAX_UNITS,
  TRX_CODES,
  GOODSERVICE_OPT
} from '../../utils/coretaxXml';

const CoretaxExportModal = ({ isOpen, onClose, invoices, company }) => {
  const [selected, setSelected] = useState(() => new Set(invoices.map((i) => i.id)));
  const [code, setCode] = useState('010000');
  const [unit, setUnit] = useState('UM.0018');
  const [trxCode, setTrxCode] = useState('01');
  const [opt, setOpt] = useState(GOODSERVICE_OPT.JASA);

  const chosen = useMemo(() => invoices.filter((i) => selected.has(i.id)), [invoices, selected]);
  const issues = useMemo(() => validateForCoretax(chosen, company), [chosen, company]);

  const toggle = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const handleExport = () => {
    downloadCoretaxXml(chosen, company, { code, unit, trxCode, opt, vatRate: 12 });
    onClose?.();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Export Faktur Pajak (CoreTax)"
      subtitle="Hasilkan XML untuk unggah massal di CoreTax DJP"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Batal
          </Button>
          <Button onClick={handleExport} disabled={chosen.length === 0 || issues.length > 0}>
            <FileCode2 className="h-4 w-4" />
            Unduh XML ({chosen.length})
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {/* Opsi faktur */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Kode Barang/Jasa">
            <Select value={code} onChange={(e) => setCode(e.target.value)}>
              {CORETAX_SERVICE_CODES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} — {c.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Satuan">
            <Select value={unit} onChange={(e) => setUnit(e.target.value)}>
              {CORETAX_UNITS.map((u) => (
                <option key={u.code} value={u.code}>
                  {u.code} — {u.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Kode Transaksi">
            <Select value={trxCode} onChange={(e) => setTrxCode(e.target.value)}>
              {TRX_CODES.map((t) => (
                <option key={t.code} value={t.code}>
                  {t.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Jenis">
            <Select value={opt} onChange={(e) => setOpt(e.target.value)}>
              <option value={GOODSERVICE_OPT.JASA}>B — Jasa</option>
              <option value={GOODSERVICE_OPT.BARANG}>A — Barang</option>
            </Select>
          </Field>
        </div>

        <div className="rounded-lg border border-brand-100 bg-brand-50/50 px-3.5 py-2.5 text-xs text-slate-600">
          PPN dihitung <span className="font-semibold">12% × DPP Nilai Lain</span> (11/12 × harga) —
          sesuai PMK 131/2024, efektif 11%. Sudah cocok dengan faktur PT PEB.
        </div>

        {/* Validasi */}
        {issues.length > 0 ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3.5">
            <p className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-amber-800">
              <TriangleAlert className="h-4 w-4" />
              Perlu dilengkapi sebelum ekspor
            </p>
            <ul className="list-inside list-disc space-y-0.5 text-xs text-amber-700">
              {issues.slice(0, 6).map((it, i) => (
                <li key={i}>{it}</li>
              ))}
            </ul>
          </div>
        ) : (
          chosen.length > 0 && (
            <p className="flex items-center gap-1.5 text-sm text-emerald-600">
              <CheckCircle2 className="h-4 w-4" />
              {chosen.length} faktur siap diekspor.
            </p>
          )
        )}

        {/* Pilih invoice */}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Pilih Invoice
          </p>
          <div className="max-h-64 space-y-1.5 overflow-y-auto pr-1">
            {invoices.map((inv) => (
              <label
                key={inv.id}
                className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 p-2.5 hover:bg-slate-50"
              >
                <input
                  type="checkbox"
                  checked={selected.has(inv.id)}
                  onChange={() => toggle(inv.id)}
                  className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800">
                    {inv.invoiceNumber || inv.number}
                  </p>
                  <p className="truncate text-xs text-slate-400">
                    {inv.client?.client_name || inv.clientName || '—'}
                  </p>
                </div>
                <span className="tnum shrink-0 text-xs font-semibold text-slate-600">
                  {formatCurrency(inv.totals?.grandTotal || inv.grandTotal || 0)}
                </span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default CoretaxExportModal;
