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
  Paperclip,
  History
} from 'lucide-react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Field, Input, Textarea } from '../ui/Field';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { generateInvoicePDF } from '../../utils/invoiceGenerator';
import { fetchAssetDataUrl } from '../../services/assets';
import FileViewer from '../ui/FileViewer';
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
import { buildGmailComposeUrl, buildBillingEmailContent } from '../../services/email';
import { analyzeInvoiceDocs } from '../../services/ai';
import CoretaxExportModal from './CoretaxExportModal';
import InvoiceAiReviewModal from './InvoiceAiReviewModal';
import { Sparkles } from 'lucide-react';

const statusTone = { draft: 'slate', sent: 'blue', paid: 'emerald', void: 'red' };

// Label kolom tetap, nilai rata kanan: dengan begitu semua nilai duduk pada
// satu garis vertikal walau panjang labelnya berbeda (PO vs No. SPK / Kontrak).
const RefRow = ({ label, value }) => (
  <div className="flex items-baseline justify-between gap-4 border-b border-slate-200/40 py-1 last:border-0 dark:border-white/5">
    <span className="shrink-0 text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</span>
    <span className="tnum min-w-0 truncate text-right text-[13px] font-semibold text-slate-800">{value || '—'}</span>
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
  const [downloading, setDownloading] = useState(false);
  // Pratinjau PDF: blob disimpan di state, PdfPreview yang membuat/mencabut object URL.
  const [pdfPreview, setPdfPreview] = useState(null);
  const [coretaxOpen, setCoretaxOpen] = useState(false);
  const [companyForCoretax, setCompanyForCoretax] = useState(null);
  const [uploading, setUploading] = useState(null);
  const [docView, setDocView] = useState(null);

  // Form email penagihan
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailTo, setEmailTo] = useState('');
  const [emailUp, setEmailUp] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');

  // Berkas yang baru diunggah di sesi modal ini. Detail invoice menerima salinan
  // `invoice` dari daftar, jadi tanpa state ini label berkas baru berubah setelah
  // halaman dimuat ulang — terasa seperti unggahan hilang.
  const [uploadedDocs, setUploadedDocs] = useState({});

  // Analisis AI arsip invoice: hasil ditampilkan, pemilik konfirmasi dulu
  // sebelum diterapkan — tidak ada bidang tertimpa tanpa persetujuan.
  const [aiState, setAiState] = useState('idle'); // idle | busy | done | error
  const [aiResult, setAiResult] = useState(null);
  const [aiError, setAiError] = useState('');
  const [aiOpen, setAiOpen] = useState(false);

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
  const docs = { ...(inv.documents || {}), ...uploadedDocs };
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
    const emailAttachments = attachments.map((a, i) => ({
      name: a.name,
      label: INVOICE_DOC_LABELS[DOC_KEYS[i]] || a.name,
      url: a.url,
    }));
    const c = buildBillingEmailContent(inv, merged, {
      up: emailUp,
      attachments: emailAttachments,
    });
    setEmailTo(inv.client?.billingEmail || inv.client?.email || '');
    setEmailSubject(c.subject);
    setEmailBody(c.body);
    setEmailOpen(true);
  };

  // Unduh PDF invoice + semua berkas arsip, lalu buka draf Gmail.
  // Tidak bisa melampirkan file langsung ke Gmail (keterbatasan browser),
  // tetapi pemilik mendapat semua berkas sekaligus siap dilampirkan.
  const handleSendEmail = async () => {
    if (!emailTo.trim()) {
      alert('Isi alamat email tujuan terlebih dahulu.');
      return;
    }

    const downloadBusy = async (name) => {
      try {
        const res = await fetch(name.url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = name.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(a.href);
      } catch {
        alert(`Gagal mengunduh: ${name.name}`);
      }
    };

    // 1) Unduh PDF invoice
    setDownloading(true);
    let pdfBlob = null;
    let pdfName = 'Invoice.pdf';
    try {
      const settings = await getCompanySettings().catch(() => null);
      const { blob, fileName } = await generateInvoicePDF(inv, mergeCompanyInfo(settings || {}), {
        download: false,
        resolveAssetDataUrl: fetchAssetDataUrl,
      });
      pdfBlob = blob;
      pdfName = fileName || 'Invoice.pdf';
    } catch {
      alert('Gagal membuat PDF invoice. Pesan email tetap terbuka.');
    }
    setDownloading(false);

    // 2) Unduh PDF invoice
    if (pdfBlob) {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(pdfBlob);
      a.download = pdfName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
    }

    // 3) Unduh semua berkas arsip
    for (const att of attachments) {
      await downloadBusy(att);
    }

    // 4) Buka Gmail
    const url = buildGmailComposeUrl({
      to: emailTo.trim(),
      subject: emailSubject,
      body: emailBody,
    });
    window.open(url, '_blank', 'noopener,noreferrer');
    setEmailOpen(false);
  };

  const handleUpload = async (kind, file) => {
    if (!file) return;
    setUploading(kind);
    try {
      const entry = await uploadInvoiceDocument(inv.id, kind, file);
      setUploadedDocs((prev) => ({ ...prev, [kind]: entry }));
    } catch (err) {
      console.error('Gagal unggah berkas:', err);
      const code = err?.code || '';
      let msg = 'Gagal mengunggah berkas. Coba lagi.';
      if (code === 'storage/unauthorized') msg = 'Tidak berhak mengunggah ke arsip ini. Masuk ulang lalu coba lagi.';
      else if (code === 'storage/retry-limit-exceeded') msg = 'Jaringan lambat: unggahan habis waktu. Coba lagi.';
      else if (/exceeds the maximum/i.test(err?.message || '')) msg = 'Berkas melebihi batas ukuran. Perkecil atau simpan sebagai PDF.';
      alert(msg);
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

  const runAiAnalysis = async () => {
    const present = DOC_KEYS.filter((k) => docs[k]);
    if (present.length === 0) {
      setAiError('Belum ada berkas di arsip. Unggah WPHO, BAHK, atau faktur lebih dulu.');
      setAiState('error');
      setAiOpen(true);
      return;
    }
    setAiState('busy');
    setAiOpen(true);
    try {
      const result = await analyzeInvoiceDocs(
        present.map((k) => ({ kind: k, name: docs[k].name, url: docs[k].url })),
        {
          invoiceNumber: inv.invoiceNumber,
          grandTotal: inv.grandTotal,
          quantity: inv.quantity,
          invoiceItems: items,
        }
      );
      setAiResult(result);
      setAiState('done');
      setAiError('');
    } catch (err) {
      console.error('Gagal analisis AI:', err);
      const code = err?.code || '';
      setAiError(
        code === 'functions/resource-exhausted' ? 'Kuota harian AI habis. Coba lagi besok.'
        : code === 'functions/unauthenticated' ? 'Sesi login habis. Masuk ulang lalu coba lagi.'
        : err?.message || 'Dokumen tidak dapat dianalisis. Pastikan berkas jelas dan coba lagi.'
      );
      setAiState('error');
    }
  };

  // Terapkan bidang yang dikonfirmasi pemilik (per dokumen, satu tombol "ya").
  const applyAiResults = async (selections) => {
    try {
      const fields = {};
      const wpho = selections.wpho;
      if (wpho?.applied) {
        if (wpho.number !== undefined) fields.wphoNumber = wpho.number;
        if (wpho.amount !== undefined) fields.wphoValue = wpho.amount;
        if (wpho.date !== undefined) fields.cityDate = String(wpho.date).slice(0, 10);
        if (wpho.workName !== undefined) fields.workName = wpho.workName;
      }
      const bahk = selections.bahk;
      if (bahk?.applied) {
        if (bahk.number !== undefined) fields.bahkNumber = bahk.number;
        if (bahk.amount !== undefined) fields.bahkValue = bahk.amount;
        if (bahk.date !== undefined) fields.lastBaDate = String(bahk.date).slice(0, 10);
      }
      const faktur = selections.faktur;
      if (faktur?.applied) {
        if (faktur.number !== undefined) fields.taxInvoiceNumber = faktur.number;
        if (faktur.amount !== undefined) fields.subtotal = faktur.amount;
      }
      if (Object.keys(fields).length > 0) {
        await updateInvoice(inv.id, fields);
      }
      setAiOpen(false);
      setAiResult(null);
      setAiState('idle');
    } catch (err) {
      console.error('Gagal menerapkan hasil AI:', err);
      alert(err?.message || 'Gagal menerapkan hasil. Coba lagi.');
    }
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
      drawerWidth="full"
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
      {/*
        Dua kolom, bukan dua tab.
        Sebab: isi invoice (nomor referensi, rincian pekerjaan, pembayaran,
        dokumen pajak, arsip berkas) tadinya dipotong menjadi dua tab yang
        saling menyembunyikan. Dengan panel selebar layar, semuanya terbaca
        sekaligus tanpa menggulir bolak-balik; kekurangan tempat di layar
        kecil diserahkan ke breakpoint, bukan ke tab.
      */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] lg:items-start">
        {/* KIRI — identitas, nomor referensi, rincian pekerjaan */}
        <div className="min-w-0 space-y-4">
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
          </div>

          <div>
            <SectionLabel>
              <FileText className="mr-1 inline h-3.5 w-3.5" />
              Nomor Referensi
            </SectionLabel>
            <div className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
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

          {items.length === 0 && (
            <div>
              <SectionLabel>Rincian Pekerjaan</SectionLabel>
              <p className="rounded-[10px] px-3 py-2.5 text-xs text-slate-400 ring-1 ring-inset ring-slate-200/70 dark:ring-white/10">
                Invoice ini tidak memuat baris pekerjaan (dibuat sebelum rincian item diwajibkan).
                Nilainya tetap sah: lihat Subtotal dan PPN pada bagian nilai di bawah.
              </p>
            </div>
          )}
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

        {/* KANAN — pembayaran dan arsip berkas */}
        <div className="min-w-0 space-y-4 lg:border-l lg:border-slate-200/70 lg:pl-6 dark:lg:border-white/10">
          {/* Grand Total di sini, bukan di kepala kolom kiri: angka total hanya
              bermakna berdampingan dengan Subtotal/PPN yang membentuknya. */}
          <div className="rounded-[10px] bg-slate-500/5 px-3.5 py-3">
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

          {/* Status penagihan: mengisi kolom kanan dan menjawab pertanyaan yang
              paling sering muncul saat membuka invoice — uangnya sudah masuk?
              pajaknya sudah disetor? tanpanya kolom kanan menggantung kosong. */}
          <div>
            <SectionLabel>Status Penagihan</SectionLabel>
            <div className="space-y-1.5 text-[13px]">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Terbit</span>
                <span className="tnum font-medium text-slate-800">{formatDate(inv.issueDate) || '—'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Jatuh tempo</span>
                <span className="tnum font-medium text-slate-800">{formatDate(inv.dueDate) || '—'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Tanggal terbayar</span>
                <span className="tnum font-medium text-slate-800">
                  {formatDate(inv.paidAt || inv.paymentDate) || '—'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">PPN disetor</span>
                <span className="font-medium text-slate-800">
                  {inv.taxPaidAt || inv.taxPaymentProofUrl ? 'Sudah ada bukti' : 'Belum disetor'}
                </span>
              </div>
            </div>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <SectionLabel>Arsip Berkas</SectionLabel>
              <span className="text-xs text-slate-400">{Object.keys(docs).length}/3</span>
            </div>
            <p className="mb-2 text-xs text-slate-400">
              Berkas penagihan terkait invoice ini membentuk arsip digital.
            </p>
            <button
              type="button"
              onClick={runAiAnalysis}
              className="mb-3 flex w-full items-center justify-center gap-1.5 rounded-[10px] border border-brand-300 px-3 py-2 text-xs font-semibold text-brand-700 transition-colors hover:bg-brand-50 dark:border-brand-500/40 dark:text-brand-300 dark:hover:bg-brand-500/10"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Analisis AI: cek nomor, nilai & kesalahan
            </button>
            <div className="space-y-2">
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
                      <button
                        type="button"
                        onClick={() => setDocView({ url: docs[k].url, name: docs[k].name || `${INVOICE_DOC_LABELS[k]}.pdf` })}
                        className="text-xs font-medium text-brand-700 hover:underline dark:text-brand-300"
                      >
                        Lihat
                      </button>
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
          </div>
        </div>
      </div>
    </Modal>

    {pdfPreview && (
      <FileViewer
        file={{ blob: pdfPreview.blob, name: pdfPreview.fileName || 'Invoice.pdf' }}
        onClose={() => setPdfPreview(null)}
      />
    )}

    {/* Berkas arsip (BAHK/WPHO/Faktur Pajak) dibuka di tempat. */}
    <FileViewer file={docView} onClose={() => setDocView(null)} />

    {coretaxOpen && (
      <CoretaxExportModal
        isOpen
        onClose={() => setCoretaxOpen(false)}
        invoices={[{ ...inv, invoiceItems: items, client: inv.client || { client_name: inv.clientName } }]}
        company={companyForCoretax}
      />
    )}

    <InvoiceAiReviewModal
      isOpen={aiOpen}
      state={aiState}
      error={aiError}
      result={aiResult}
      invoice={inv}
      onClose={() => {
        setAiOpen(false);
        setAiState('idle');
        setAiError('');
      }}
      onApply={applyAiResults}
    />
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
        subtitle="PDF + semua berkas diunduh otomatis, lalu buka Gmail untuk kirim"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEmailOpen(false)}>Batal</Button>
            <Button onClick={handleSendEmail} loading={downloading}>
              <Mail className="h-4 w-4" />
              Unduh + Kirim via Gmail
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
          {attachments.length > 0 && (
            <div className="rounded-[10px] bg-slate-50 p-3 dark:bg-white/5">
              <p className="mb-2 text-xs font-medium text-slate-500">Yang akan diunduh:</p>
              <ul className="space-y-1">
                <li className="flex items-center gap-1.5 text-xs text-slate-600">
                  <FileText className="h-3.5 w-3.5 shrink-0 text-brand-700" />
                  PDF Invoice <span className="text-slate-400">(otomatis)</span>
                </li>
                {attachments.map((a, i) => (
                  <li key={i} className="flex items-center gap-1.5 text-xs text-slate-600">
                    <Paperclip className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    {a.name}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-xs text-slate-400">
            {attachments.length > 0
              ? 'Berkas diunduh lalu Gmail terbuka. Lampirkan berkas dari folder Unduhan.'
              : 'Tambahkan berkas di arsip dulu agar bisa dilampirkan.'}
          </p>
        </div>
      </Modal>
    )}
    </>
  );
};

export default InvoiceDetailModal;
