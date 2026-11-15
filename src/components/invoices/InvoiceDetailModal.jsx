// src/components/invoices/InvoiceDetailModal.jsx
// Detail invoice ala ERP dalam drawer. Urutan mengikuti dokumen nyata:
// judul -> nomor referensi (lebar penuh) -> rincian pekerjaan (lebar penuh)
// -> pembayaran & dokumen pajak berdampingan. Arsip berkas di tab kedua
// supaya tab pertama tetap muat satu viewport.
import React, { useMemo, useState } from 'react';
import {
  FileText,
  FileCode2,
  Landmark,
  PenLine,
  Send,
  CheckCircle2,
  CalendarDays,
  Building2,
  Briefcase,
  Upload,
  Mail,
  Package,
  History
} from 'lucide-react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Field, Input, Textarea } from '../ui/Field';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { generateInvoicePDF } from '../../utils/invoiceGenerator';
import { fetchAssetDataUrl } from '../../services/assets';
import PdfPreview from '../ui/PdfPreview';
import { generateShippingLabel } from '../../utils/shippingLabel';
import {
  INVOICE_STATUS,
  INVOICE_STATUS_LABEL,
  billingStageLabel,
  taxDocsProgress,
  isPpnCair,
  INVOICE_DOC_LABELS,
  uploadInvoiceDocument
} from '../../services/invoices';
import { getCompanySettings, mergeCompanyInfo } from '../../services/settings';
import { sendInvoiceEmail, buildBillingEmailContent } from '../../services/email';
import CoretaxExportModal from './CoretaxExportModal';

const statusTone = { draft: 'slate', sent: 'blue', paid: 'emerald', void: 'red' };

const RefRow = ({ label, value }) => (
  <div className="flex items-baseline justify-between gap-3 py-1">
    <span className="shrink-0 text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</span>
    <span className="tnum truncate text-[13px] font-semibold text-slate-800">{value || '—'}</span>
  </div>
);

const SectionLabel = ({ children }) => (
  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
    {children}
  </p>
);

const DOC_KEYS = ['bahk', 'wpho', 'faktur'];

const InvoiceDetailModal = ({
  invoice,
  onClose,
  onEdit,
  onTaxDocs,
  onMarkPaid,
  onMarkSent,
  onRevise,
  busy
}) => {
  const [tab, setTab] = useState('detail');
  const [downloading, setDownloading] = useState(false);
  // Pratinjau PDF: blob disimpan di state, PdfPreview yang membuat/mencabut object URL.
  const [pdfPreview, setPdfPreview] = useState(null);
  const [coretaxOpen, setCoretaxOpen] = useState(false);
  const [companyForCoretax, setCompanyForCoretax] = useState(null);
  const [uploading, setUploading] = useState(null);

  // Form email penagihan
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailTo, setEmailTo] = useState('');
  const [emailUp, setEmailUp] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [emailBusy, setEmailBusy] = useState(false);

  // Form label kirim
  const [labelOpen, setLabelOpen] = useState(false);
  const [labelUp, setLabelUp] = useState('');
  const [labelVia, setLabelVia] = useState('Lion Parcel');

  if (!invoice) return null;

  const inv = { ...invoice };
  const items = Array.isArray(inv.invoiceItems) ? inv.invoiceItems : [];
  const isPaid = inv.status === INVOICE_STATUS.PAID;
  const isSent = inv.status === INVOICE_STATUS.SENT;
  const progress = taxDocsProgress(inv);
  const doneCount = progress.filter((p) => p.done).length;
  const docs = inv.documents || {};
  const attachments = useMemo(
    () =>
      DOC_KEYS.map((k) => (docs[k] ? { name: `${INVOICE_DOC_LABELS[k]} (${docs[k].name})`, url: docs[k].url } : null)).filter(Boolean),
    [inv.id]
  );

  const handlePreviewPdf = async () => {
    setDownloading(true);
    try {
      const settings = await getCompanySettings();
      const { blob, fileName } = await generateInvoicePDF(inv, mergeCompanyInfo(settings), { download: false, resolveAssetDataUrl: fetchAssetDataUrl });
      setPdfPreview({ blob, fileName });
    } catch (err) {
      console.error('Gagal membuat pratinjau PDF:', err);
      alert('Gagal membuat PDF. Coba lagi.');
    } finally {
      setDownloading(false);
    }
  };

  const handleExportCoretax = async () => {
    const settings = await getCompanySettings().catch(() => null);
    setCompanyForCoretax(mergeCompanyInfo(settings || {}));
    setCoretaxOpen(true);
  };

  const openEmail = async () => {
    const settings = await getCompanySettings().catch(() => null);
    const merged = mergeCompanyInfo(settings || {});
    const c = buildBillingEmailContent(inv, merged, { up: emailUp });
    setEmailTo(inv.client?.email || '');
    setEmailSubject(c.subject);
    setEmailBody(c.body);
    setEmailOpen(true);
  };

  const handleSendEmail = async () => {
    if (!emailTo) {
      alert('Isi alamat email tujuan terlebih dahulu.');
      return;
    }
    setEmailBusy(true);
    try {
      await sendInvoiceEmail({
        to: emailTo,
        subject: emailSubject,
        body: emailBody,
        attachments,
      });
      alert('Email penagihan terkirim.');
      setEmailOpen(false);
    } catch (err) {
      console.error('Gagal kirim email:', err);
      alert(err?.message || 'Gagal mengirim email.');
    } finally {
      setEmailBusy(false);
    }
  };

  const handleUpload = async (kind, file) => {
    if (!file) return;
    setUploading(kind);
    try {
      await uploadInvoiceDocument(inv.id, kind, file);
      alert('Berkas terunggah.');
    } catch (err) {
      console.error('Gagal unggah berkas:', err);
      alert('Gagal mengunggah berkas. Coba lagi.');
    } finally {
      setUploading(null);
    }
  };

  const printLabel = async () => {
    const settings = await getCompanySettings().catch(() => null);
    const merged = mergeCompanyInfo(settings || {});
    generateShippingLabel(inv, {
      from: { name: merged.name, address: [merged.address, merged.city].filter(Boolean).join(', '), phone: merged.phone },
      to: {
        name: inv.clientName || inv.client?.client_name || '',
        address: inv.client?.address || '',
        phone: inv.client?.phone || ''
      },
      up: labelUp,
      via: labelVia,
      documents: attachments.map((a) => a.name)
    });
    setLabelOpen(false);
  };

  return (
    <>
    <Modal
      isOpen={Boolean(invoice)}
      onClose={onClose}
      title={inv.invoiceNumber || 'Detail Invoice'}
      subtitle={inv.projectName}
      size="xl"
      drawer
      footer={
        <>
          {isPaid ? (
            <p className="mr-auto hidden text-xs text-slate-400 sm:block">
              Invoice terbayar terkunci — hanya dokumen pajak yang bisa diperbarui.
            </p>
          ) : (
            <Button variant="danger-ghost" size="sm" onClick={() => onMarkPaid(inv)} disabled={busy}>
              <CheckCircle2 className="h-4 w-4" />
              Tandai Terbayar
            </Button>
          )}
          <div className="flex flex-wrap gap-2 sm:justify-end">
            {isSent && onRevise && (
              <Button variant="secondary" size="sm" onClick={() => onRevise(inv)}>
                <History className="h-4 w-4" />
                Revisi
              </Button>
            )}
            {!isPaid && inv.status === INVOICE_STATUS.DRAFT && (
              <Button variant="secondary" size="sm" onClick={() => onMarkSent(inv)} disabled={busy}>
                <Send className="h-4 w-4" />
                Tandai Terkirim
              </Button>
            )}
            <Button variant="secondary" size="sm" onClick={() => { setLabelOpen(true); setEmailUp((p) => p || inv.client?.contactPerson || ''); }}>
              <Package className="h-4 w-4" />
              Label Kirim
            </Button>
            <Button variant="secondary" size="sm" onClick={openEmail}>
              <Mail className="h-4 w-4" />
              Kirim Email
            </Button>
            <Button variant="secondary" size="sm" onClick={() => onTaxDocs(inv)}>
              <Landmark className="h-4 w-4" />
              Dokumen Pajak
            </Button>
            {!isPaid && onEdit && (
              <Button variant="secondary" size="sm" onClick={() => onEdit(inv)}>
                <PenLine className="h-4 w-4" />
                Edit
              </Button>
            )}
            <Button variant="secondary" size="sm" onClick={handleExportCoretax}>
              <FileCode2 className="h-4 w-4" />
              Export CoreTax
            </Button>
            <Button size="sm" onClick={handlePreviewPdf} loading={downloading}>
              <FileText className="h-4 w-4" />
              Lihat PDF
            </Button>
          </div>
        </>
      }
    >
      {/* Tab: Detail | Arsip Berkas */}
      <div className="mb-4 flex items-center gap-1 border-b border-slate-200/70 dark:border-white/10">
        {['detail', 'arsip'].map((k) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`-mb-px border-b-2 px-3 pb-2 pt-1 text-sm font-medium transition-colors ${
              tab === k
                ? 'border-brand-600 text-brand-700 dark:text-brand-300'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            {k === 'detail' ? 'Detail' : `Arsip Berkas${Object.keys(docs).length ? ` (${Object.keys(docs).length})` : ''}`}
          </button>
        ))}
      </div>

      {tab === 'detail' ? (
      <div className="space-y-4">
        {/* Kepala: identitas | grand total — tampil sekali saja */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={statusTone[inv.status] || 'slate'}>
                {INVOICE_STATUS_LABEL[inv.status] || inv.status || 'Draft'}
              </Badge>
              {inv.billingStage && (
                <Badge tone="violet">
                  {billingStageLabel(inv.billingStage)}
                  {inv.quantity ? ` · ${inv.quantity}` : ''}
                </Badge>
              )}
              {isPpnCair(inv) && <Badge tone="cyan">PPN Cair</Badge>}
            </div>
            <p className="mt-1.5 flex items-center gap-1.5 text-sm text-slate-600">
              <Building2 className="h-4 w-4 shrink-0 text-slate-400" />
              {inv.clientName || inv.client?.client_name || '—'}
            </p>
            <p className="mt-0.5 flex items-center gap-1.5 text-[13px] text-slate-500">
              <Briefcase className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              {inv.projectName || '—'}
            </p>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-400">
              <CalendarDays className="h-3.5 w-3.5 shrink-0" />
              Terbit {formatDate(inv.issueDate)} · Jatuh tempo {formatDate(inv.dueDate)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Grand Total</p>
            <p className="tnum font-display text-2xl font-bold tracking-tight text-slate-900">
              {formatCurrency(inv.grandTotal || 0)}
            </p>
            {inv.taxDeductedAmount > 0 && (
              <p className="mt-0.5 text-xs text-slate-500">
                Diterima <span className="tnum font-medium">{formatCurrency(inv.netProceeds)}</span>
              </p>
            )}
          </div>
        </div>

        {/* Nomor referensi — lebar penuh, grid 3 kolom */}
        <div>
          <SectionLabel>
            <FileText className="mr-1 inline h-3.5 w-3.5" />
            Nomor Referensi
          </SectionLabel>
          <div className="grid grid-cols-1 gap-x-6 sm:grid-cols-3">
            <RefRow label="No. PO" value={inv.poNumber} />
            <RefRow label="No. SPK / Kontrak" value={inv.spkNumber} />
            <RefRow label="No. PK" value={inv.pkNumber} />
            <RefRow label="No. BAHK" value={inv.bahkNumber} />
            <RefRow label="No. WPHO / BAST" value={inv.wphoNumber} />
            <RefRow label="No. Faktur Pajak" value={inv.taxInvoiceNumber} />
            <RefRow label="Kode Billing" value={inv.billingCode} />
            <RefRow label="NTPN" value={inv.ntpnNumber} />
          </div>
        </div>

        {/* Rincian pekerjaan — lebar penuh */}
        {items.length > 0 && (
          <div>
            <SectionLabel>Rincian Pekerjaan</SectionLabel>
            <div className="overflow-hidden rounded-[10px] ring-1 ring-inset ring-slate-200/70 dark:ring-white/10">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-slate-200/70 text-left text-[11px] uppercase tracking-wide text-slate-400 dark:border-white/10">
                    <th className="px-3 py-1.5 font-medium">Deskripsi</th>
                    <th className="px-3 py-1.5 font-medium">Qty</th>
                    <th className="px-3 py-1.5 text-right font-medium">Harga</th>
                    <th className="px-3 py-1.5 text-right font-medium">Jumlah</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, i) => (
                    <tr key={i} className="border-b border-slate-200/50 last:border-0 dark:border-white/5">
                      <td className="px-3 py-1.5 text-slate-800">{it.description || '—'}</td>
                      <td className="px-3 py-1.5 text-slate-500">
                        {it.qty || '—'} {it.unit || ''}
                      </td>
                      <td className="tnum px-3 py-1.5 text-right text-slate-500">
                        {it.unitPrice ? formatCurrency(it.unitPrice) : '—'}
                      </td>
                      <td className="tnum px-3 py-1.5 text-right font-semibold text-slate-800">
                        {formatCurrency(
                          it.amount !== '' && it.amount != null
                            ? Number(it.amount)
                            : (Number(it.qty) || 1) * (Number(it.unitPrice) || 0)
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Pembayaran & dokumen pajak — berdampingan */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div>
            <SectionLabel>Pembayaran</SectionLabel>
            <div className="space-y-1 text-[13px]">
              <div className="flex justify-between text-slate-500">
                <span>Subtotal</span>
                <span className="tnum">{formatCurrency(inv.subtotal ?? inv.dppNilaiLain ?? 0)}</span>
              </div>
              {inv.dppNilaiLain > 0 && (
                <div className="flex justify-between text-slate-500">
                  <span>DPP Nilai Lain</span>
                  <span className="tnum">{formatCurrency(inv.dppNilaiLain)}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-500">
                <span>PPN</span>
                <span className="tnum">{formatCurrency(inv.pajak11 || 0)}</span>
              </div>
              {inv.taxDeductedAmount > 0 && (
                <>
                  <div className="flex justify-between text-slate-500">
                    <span>PPh (dipotong client)</span>
                    <span className="tnum">−{formatCurrency(inv.taxDeductedAmount)}</span>
                  </div>
                  <div className="flex justify-between font-semibold text-slate-800">
                    <span>Diterima</span>
                    <span className="tnum">{formatCurrency(inv.netProceeds)}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <SectionLabel>Dokumen Pajak</SectionLabel>
              <span className="text-xs text-slate-400">{doneCount}/4</span>
            </div>
            <div className="space-y-1.5">
              {progress.map((p) => (
                <div key={p.key} className="flex items-center justify-between text-[13px]">
                  <span className={p.done ? 'font-medium text-slate-800' : 'text-slate-400'}>
                    {p.label}
                  </span>
                  <span
                    className={`h-2 w-2 rounded-full ${p.done ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      ) : (
      <div className="space-y-2">
        <p className="text-xs text-slate-400">
          Semua berkas penagihan terkait invoice ini. Kumpulannya membentuk arsip digital penagihan.
        </p>
        {DOC_KEYS.map((k) => (
          <div key={k} className="flex items-center justify-between gap-2 rounded-[10px] px-3 py-2.5 ring-1 ring-inset ring-slate-200/70 dark:ring-white/10">
            <div className="min-w-0">
              <p className={docs[k] ? 'text-sm font-medium text-slate-800' : 'text-sm text-slate-400'}>
                {INVOICE_DOC_LABELS[k]}
              </p>
              {docs[k] && <p className="truncate text-xs text-slate-400">{docs[k].name}</p>}
            </div>
            <div className="flex shrink-0 items-center gap-3">
              {docs[k] ? (
                <a
                  href={docs[k].url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-medium text-brand-700 hover:underline dark:text-brand-300"
                >
                  Lihat
                </a>
              ) : (
                <span className="text-xs text-slate-300">belum ada</span>
              )}
              <label
                title={`Unggah ${INVOICE_DOC_LABELS[k]}`}
                className="cursor-pointer rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-brand-700"
              >
                <Upload className="h-3.5 w-3.5" />
                <input
                  type="file"
                  className="hidden"
                  accept="image/*,.pdf,.tif,.tiff"
                  disabled={uploading === k}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (file) handleUpload(k, file);
                  }}
                />
              </label>
            </div>
          </div>
        ))}
      </div>
      )}
    </Modal>

    {pdfPreview && (
      <PdfPreview
        isOpen
        onClose={() => setPdfPreview(null)}
        blob={pdfPreview.blob}
        fileName={pdfPreview.fileName}
        title="Pratinjau Invoice"
      />
    )}

    {coretaxOpen && (
      <CoretaxExportModal
        isOpen
        onClose={() => setCoretaxOpen(false)}
        invoices={[{ ...inv, invoiceItems: items, client: inv.client || { client_name: inv.clientName } }]}
        company={companyForCoretax}
      />
    )}
    {labelOpen && (
      <Modal
        isOpen
        onClose={() => setLabelOpen(false)}
        title="Label Kirim"
        subtitle="Cetak label pengiriman berkas fisik"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setLabelOpen(false)}>Batal</Button>
            <Button onClick={printLabel}>Cetak Label</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="UP (kepada)">
            <Input value={labelUp} onChange={(e) => setLabelUp(e.target.value)} placeholder="Nama pegawai tujuan" />
          </Field>
          <Field label="Jalur kirim">
            <Input value={labelVia} onChange={(e) => setLabelVia(e.target.value)} placeholder="Lion Parcel" />
          </Field>
          <p className="text-xs text-slate-400">
            Alamat pengirim otomatis dari profil perusahaan; penerima dari data klien.
          </p>
        </div>
      </Modal>
    )}

    {emailOpen && (
      <Modal
        isOpen
        onClose={() => setEmailOpen(false)}
        title="Kirim Email Penagihan"
        subtitle={`${attachments.length} berkas dilampirkan`}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEmailOpen(false)}>Batal</Button>
            <Button onClick={handleSendEmail} loading={emailBusy}>
              <Mail className="h-4 w-4" />
              Kirim
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Kepada (email)">
            <Input value={emailTo} onChange={(e) => setEmailTo(e.target.value)} placeholder="apfinance@slm.com" />
          </Field>
          <Field label="UP (untuk perhatian)">
            <Input value={emailUp} onChange={(e) => setEmailUp(e.target.value)} placeholder="Opsional" />
          </Field>
          <Field label="Subjek">
            <Input value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} />
          </Field>
          <Field label="Isi email">
            <Textarea rows={10} value={emailBody} onChange={(e) => setEmailBody(e.target.value)} />
          </Field>
          <p className="text-xs text-slate-400">
            Lampiran: {attachments.length > 0 ? attachments.map((a) => a.name).join(', ') : 'belum ada berkas di arsip — buka tab Arsip Berkas untuk mengunggah.'}
          </p>
        </div>
      </Modal>
    )}
    </>
  );
};

export default InvoiceDetailModal;
