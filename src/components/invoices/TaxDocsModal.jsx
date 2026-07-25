// src/components/invoices/TaxDocsModal.jsx
// Alur dokumen pajak per invoice (skema live): Faktur Pajak → Billing → PPN → NTPN.
import React, { useState } from 'react';
import { CheckCircle2, Circle, Save } from 'lucide-react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { Field, Input } from '../ui/Field';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { updateTaxDocs, taxDocsProgress } from '../../services/invoices';

const Section = ({ step, title, done, children }) => (
  <div className="rounded-xl border border-slate-200 p-4">
    <div className="mb-3 flex items-center gap-2.5">
      {done ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : <Circle className="h-5 w-5 text-slate-300" />}
      <h3 className="font-display text-sm font-semibold text-slate-800">{step}. {title}</h3>
    </div>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>
  </div>
);

const TaxDocsModal = ({ isOpen, onClose, invoice, onSaved }) => {
  // Prisi dari field live yang sudah ada di dokumen invoice.
  const [f, setF] = useState(() => ({
    taxInvoiceNumber: invoice?.taxInvoiceNumber || '',
    taxInvoiceRecordedAt: (invoice?.taxInvoiceRecordedAt || '').slice(0, 10),
    billingCode: invoice?.billingCode || '',
    billingDocumentUploadedAt: (invoice?.billingDocumentUploadedAt || '').slice(0, 10),
    taxPaymentAmount: invoice?.pajak11 || '',
    taxPaidAt: (invoice?.taxPaidAt || '').slice(0, 10),
    ntpnNumber: invoice?.ntpnNumber || '',
    ntpnRecordedAt: (invoice?.ntpnRecordedAt || '').slice(0, 10)
  }));
  const [saving, setSaving] = useState(false);

  const set = (field) => (e) => setF((prev) => ({ ...prev, [field]: e.target.value }));
  const progress = taxDocsProgress({
    taxInvoiceNumber: f.taxInvoiceNumber,
    billingCode: f.billingCode,
    taxPaidAt: f.taxPaidAt,
    ntpnNumber: f.ntpnNumber
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      const parts = [];
      if (f.taxInvoiceNumber) parts.push(`Faktur: ${f.taxInvoiceNumber}`);
      if (f.billingCode) parts.push(`Billing: ${f.billingCode}`);
      if (f.ntpnNumber) parts.push(`NTPN: ${f.ntpnNumber}`);
      await updateTaxDocs(
        invoice.id,
        {
          taxInvoiceNumber: f.taxInvoiceNumber,
          taxInvoiceRecordedAt: f.taxInvoiceRecordedAt,
          billingCode: f.billingCode,
          billingDocumentUploadedAt: f.billingDocumentUploadedAt,
          taxPaidAt: f.taxPaidAt,
          ntpnNumber: f.ntpnNumber,
          ntpnRecordedAt: f.ntpnRecordedAt
        },
        `Dokumen pajak diperbarui${parts.length ? ' · ' + parts.join(' · ') : ''}`
      );
      onSaved?.();
      onClose?.();
    } catch (err) {
      console.error('Gagal simpan dokumen pajak:', err);
      alert('Gagal menyimpan dokumen pajak. Coba lagi.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={saving ? undefined : onClose}
      title="Dokumen Pajak"
      subtitle={`${invoice?.invoiceNumber} · PPN ${formatCurrency(invoice?.pajak11 || 0)}`}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Batal</Button>
          <Button onClick={handleSave} loading={saving}>
            <Save className="h-4 w-4" />
            {saving ? 'Menyimpan…' : 'Simpan Dokumen Pajak'}
          </Button>
        </>
      }
    >
      <div className="mb-5 flex items-center gap-1.5">
        {progress.map((p) => (
          <div key={p.key} className={`h-1.5 flex-1 rounded-full ${p.done ? 'bg-emerald-500' : 'bg-slate-200'}`} title={p.label} />
        ))}
      </div>

      <div className="space-y-4">
        <Section step={1} title="Faktur Pajak (e-Faktur)" done={Boolean(f.taxInvoiceNumber)}>
          <Field label="Nomor Faktur Pajak">
            <Input value={f.taxInvoiceNumber} onChange={set('taxInvoiceNumber')} placeholder="040026001428…" />
          </Field>
          <Field label="Tanggal Faktur">
            <Input type="date" value={f.taxInvoiceRecordedAt} onChange={set('taxInvoiceRecordedAt')} />
          </Field>
        </Section>

        <Section step={2} title="Billing Pajak" done={Boolean(f.billingCode)}>
          <Field label="Kode Billing">
            <Input value={f.billingCode} onChange={set('billingCode')} placeholder="0420895367…" />
          </Field>
          <Field label="Tanggal Billing">
            <Input type="date" value={f.billingDocumentUploadedAt} onChange={set('billingDocumentUploadedAt')} />
          </Field>
        </Section>

        <Section step={3} title="Pembayaran PPN" done={Boolean(f.taxPaidAt)}>
          <Field label="Nominal Disetor (Rp)">
            <Input type="number" value={f.taxPaymentAmount} onChange={set('taxPaymentAmount')} placeholder={String(invoice?.pajak11 || 0)} />
          </Field>
          <Field label="Tanggal Setor">
            <Input type="date" value={f.taxPaidAt} onChange={set('taxPaidAt')} />
          </Field>
        </Section>

        <Section step={4} title="Nomor NTPN" done={Boolean(f.ntpnNumber)}>
          <Field label="NTPN">
            <Input value={f.ntpnNumber} onChange={set('ntpnNumber')} placeholder="3DC4E4D9JRD9EEL8" />
          </Field>
          <Field label="Tanggal Verifikasi">
            <Input type="date" value={f.ntpnRecordedAt} onChange={set('ntpnRecordedAt')} />
          </Field>
        </Section>
      </div>

      {invoice?.taxEvents?.length > 0 && (
        <div className="mt-5 rounded-xl bg-slate-50 p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Riwayat Pajak</p>
          <ul className="space-y-1.5">
            {[...invoice.taxEvents].reverse().map((h, i) => (
              <li key={i} className="text-xs text-slate-500">
                <span className="font-medium text-slate-600">{formatDate(h.createdAt)}</span>
                {' — '}
                {h.note || h.type || 'Dokumen pajak diperbarui'}
                {h.taxInvoiceNumber ? ` · Faktur: ${h.taxInvoiceNumber}` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Modal>
  );
};

export default TaxDocsModal;
