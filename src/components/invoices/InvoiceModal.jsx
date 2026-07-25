// src/components/invoices/InvoiceModal.jsx
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Plus, Trash2, FileDown } from 'lucide-react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { Field, Input, Textarea, Label } from '../ui/Field';
import { formatCurrency } from '../../utils/formatters';
import { terbilang } from '../../utils/terbilang';
import { generateInvoicePDF, buildInvoiceNumber } from '../../utils/invoiceGenerator';
import { COMPANY_INFO, INVOICE_DEFAULTS } from '../../utils/companyConfig';
import { getCompanySettings, mergeCompanyInfo } from '../../services/settings';
import { addInvoice, calcInvoiceTotals, BILLING_STAGES, billingStageLabel } from '../../services/invoices';
import { getAllClients, clientDisplayName } from '../../services/clients';
import { Select } from '../ui/Field';

const todayISO = () => new Date().toISOString().slice(0, 10);
const addDaysISO = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + Number(days || 0));
  return d.toISOString().slice(0, 10);
};

const emptyItem = () => ({ description: '', unit: '', qty: '', unitPrice: '', amount: '' });

const rowAmount = (it) => {
  if (it.amount !== '' && it.amount != null) return Number(it.amount) || 0;
  const q = Number(it.qty);
  return (isNaN(q) ? 1 : q) * (Number(it.unitPrice) || 0);
};

// Builder invoice — meniru struktur template resmi PT PEB.
const InvoiceModal = ({ isOpen, onClose, onSuccess, project }) => {
  const [number, setNumber] = useState(() => buildInvoiceNumber());
  const [dueDate, setDueDate] = useState(addDaysISO(14));
  const [cityDate, setCityDate] = useState(todayISO());
  const [billingStage, setBillingStage] = useState('termin-1');
  const [progressPct, setProgressPct] = useState('');
  const [useDppNilaiLain, setUseDppNilaiLain] = useState(true);

  const [clients, setClients] = useState(null); // null = belum dimuat
  const [clientId, setClientId] = useState('');
  const [billToName, setBillToName] = useState('');
  const [billToAddress, setBillToAddress] = useState('');
  const [clientNpwp, setClientNpwp] = useState('');

  // Muat daftar klien; auto-pilih bila nama proyek.partner cocok satu klien.
  useEffect(() => {
    getAllClients()
      .then((list) => {
        setClients(list);
        if (project?.partner) {
          const match = list.find(
            (c) => clientDisplayName(c).toLowerCase() === project.partner.toLowerCase()
          );
          if (match) applyClient(match);
        }
      })
      .catch(() => setClients([]));
  }, []);

  const applyClient = (c) => {
    setClientId(c.id);
    setBillToName(clientDisplayName(c));
    setBillToAddress(
      [c.address, [c.city, c.province].filter(Boolean).join(', '), c.postalCode]
        .filter(Boolean)
        .join('\n')
    );
    setClientNpwp(c.npwp || '');
  };

  const handleClientChange = (e) => {
    const id = e.target.value;
    const c = (clients || []).find((x) => x.id === id);
    if (c) applyClient(c);
    else {
      setClientId('');
      setBillToName('');
      setBillToAddress('');
      setClientNpwp('');
    }
  };

  const [poNumber, setPoNumber] = useState('');
  const [pkNumber, setPkNumber] = useState(project?.contractNumber || '');
  const [wphoNumber, setWphoNumber] = useState('');
  const [taxInvoiceNumber, setTaxInvoiceNumber] = useState('');

  const [franco, setFranco] = useState('-');
  const [shippedVia, setShippedVia] = useState('-');
  const [paymentTerm, setPaymentTerm] = useState(INVOICE_DEFAULTS.paymentTerm);

  const [items, setItems] = useState(() => [
    {
      description: project?.name ? project.name.toUpperCase() : '',
      unit: 'Unit',
      qty: '100%',
      unitPrice: project?.value || '',
      amount: ''
    }
  ]);

  const [ppnRate, setPpnRate] = useState(project?.taxRate ?? INVOICE_DEFAULTS.ppnRate);
  const [pphRate, setPphRate] = useState(INVOICE_DEFAULTS.pphRate);
  const [paymentNote, setPaymentNote] = useState(INVOICE_DEFAULTS.paymentNote);
  const [signName, setSignName] = useState(COMPANY_INFO.signatory.name);
  const [signTitle, setSignTitle] = useState(COMPANY_INFO.signatory.title);
  const [company, setCompany] = useState(COMPANY_INFO);

  // Profil perusahaan tersimpan (Firestore settings/companyProfile) → default invoice
  useEffect(() => {
    getCompanySettings().then((settings) => {
      if (!settings) return;
      const merged = mergeCompanyInfo(settings);
      setCompany(merged);
      setSignName((prev) => (prev === COMPANY_INFO.signatory.name ? merged.signatory.name : prev));
      setSignTitle((prev) => (prev === COMPANY_INFO.signatory.title ? merged.signatory.title : prev));
    });
  }, []);

  const updateItem = (idx, field, value) =>
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, [field]: value } : it)));
  const addItem = () => setItems((prev) => [...prev, emptyItem()]);
  const removeItem = (idx) => setItems((prev) => prev.filter((_, i) => i !== idx));

  const itemsSubtotal = useMemo(() => items.reduce((s, it) => s + rowAmount(it), 0), [items]);

  const totals = useMemo(
    () =>
      calcInvoiceTotals({
        subtotal: itemsSubtotal,
        useDppNilaiLain,
        ppnRate: Number(ppnRate) || 0,
        pphRate: Number(pphRate) || 0
      }),
    [itemsSubtotal, useDppNilaiLain, ppnRate, pphRate]
  );

  const [generating, setGenerating] = useState(false);

  const handleGenerate = useCallback(async () => {
    if (!clientId) {
      alert('Pilih klien terlebih dahulu. Bila belum ada, tambahkan di menu Klien.');
      return;
    }
    setGenerating(true);
    try {
      // Payload skema LIVE (kompatibel dengan invoice PT PEB existing + app live).
      const payload = {
        invoiceNumber: number,
        issueDate: cityDate,
        dueDate,
        billingStage,
        quantity: progressPct ? `${progressPct}%` : '',
        description: items.map((it) => it.description).filter(Boolean).join('; '),
        invoiceItems: items,
        projectId: project?.id || '',
        projectName: project?.name || '',
        projectValue: Number(project?.value) || itemsSubtotal,
        clientId,
        clientName: billToName,
        // denormalisasi kecil supaya PDF punya alamat + NPWP client
        client: { client_name: billToName, address: billToAddress, npwp: clientNpwp },
        poNumber,
        pkNumber,
        wphoNumber,
        taxInvoiceNumber,
        franco,
        shippedVia,
        paymentTerm,
        useDppNilaiLain,
        pphRate: String(pphRate || ''),
        dppNilaiLain: totals.dppNilaiLain,
        pajak11: totals.pajak11,
        grandTotal: totals.grandTotal,
        netProceeds: totals.netProceeds,
        taxDeductedAmount: totals.taxDeductedAmount,
        paymentNote,
        signatory: { name: signName, title: signTitle },
        status: 'draft'
      };

      // Simpan record dulu (agar muncul di daftar Invoice), lalu generate PDF
      await addInvoice(payload);
      await generateInvoicePDF(payload, company);
      onSuccess?.();
      onClose?.();
    } catch (err) {
      console.error('Gagal generate invoice:', err);
      alert('Gagal membuat invoice. Coba lagi.');
    } finally {
      setGenerating(false);
    }
  }, [
    number, dueDate, cityDate, billingStage, progressPct, poNumber, pkNumber, wphoNumber,
    taxInvoiceNumber, billToName, billToAddress, franco, shippedVia, paymentTerm, items,
    itemsSubtotal, useDppNilaiLain, pphRate, totals, paymentNote, signName, signTitle,
    company, project, onSuccess, onClose
  ]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Buat Invoice"
      subtitle={project?.name}
      size="xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Batal
          </Button>
          <Button onClick={handleGenerate} loading={generating}>
            <FileDown className="h-4 w-4" />
            {generating ? 'Membuat…' : 'Generate PDF'}
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        {/* Peringatan bila belum ada klien */}
        {clients !== null && clients.length === 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Belum ada klien terdaftar. Tambahkan klien di menu <span className="font-semibold">Klien</span> terlebih dahulu — invoice tidak bisa dibuat tanpa data klien.
          </div>
        )}

        {/* Kepada (pilih klien) + meta */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="space-y-4">
            <Field label="Kepada Yth. (Klien)" required>
              <Select value={clientId} onChange={handleClientChange} disabled={!clients || clients.length === 0}>
                <option value="">— Pilih Klien —</option>
                {(clients || []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {clientDisplayName(c)}
                    {c.npwp ? ` · ${c.npwp}` : ''}
                  </option>
                ))}
              </Select>
            </Field>
            {clientId && (
              <div className="rounded-lg bg-slate-50 p-3 text-sm">
                <p className="font-semibold text-slate-800">{billToName}</p>
                {clientNpwp && <p className="text-xs text-slate-500">NPWP {clientNpwp}</p>}
                {billToAddress && (
                  <p className="mt-1 whitespace-pre-line text-xs text-slate-500">{billToAddress}</p>
                )}
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Invoice No">
              <Input value={number} onChange={(e) => setNumber(e.target.value)} />
            </Field>
            <Field label="Jatuh Tempo">
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </Field>
            <Field label="PO / PK">
              <Input value={poNumber} onChange={(e) => setPoNumber(e.target.value)} placeholder="022/SLM/LGL-K/II/2026" />
            </Field>
            <Field label="PK No.">
              <Input value={pkNumber} onChange={(e) => setPkNumber(e.target.value)} placeholder="SLM/PK-HO/TEK/11/3/2026" />
            </Field>
            <Field label="No. WPHO">
              <Input value={wphoNumber} onChange={(e) => setWphoNumber(e.target.value)} placeholder="SLM/WP/2605/00165" />
            </Field>
            <Field label="No. Faktur Pajak">
              <Input value={taxInvoiceNumber} onChange={(e) => setTaxInvoiceNumber(e.target.value)} placeholder="-" />
            </Field>
            <Field label="Termin">
              <Select value={billingStage} onChange={(e) => setBillingStage(e.target.value)}>
                {BILLING_STAGES.map((t) => (
                  <option key={t} value={t}>
                    {billingStageLabel(t)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Progress (%)">
              <Input
                value={progressPct}
                onChange={(e) => setProgressPct(e.target.value)}
                placeholder="cth. 100 atau 10.29"
              />
            </Field>
          </div>
        </div>

        {/* Franco / Shipped / Term */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Franco">
            <Input value={franco} onChange={(e) => setFranco(e.target.value)} />
          </Field>
          <Field label="Shipped Via">
            <Input value={shippedVia} onChange={(e) => setShippedVia(e.target.value)} />
          </Field>
          <Field label="Payment Term">
            <Input value={paymentTerm} onChange={(e) => setPaymentTerm(e.target.value)} placeholder="14 Hari" />
          </Field>
        </div>

        {/* Item */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <Label>Item Pekerjaan</Label>
            <Button variant="ghost" size="sm" onClick={addItem}>
              <Plus className="h-4 w-4" />
              Tambah Item
            </Button>
          </div>
          <div className="hidden grid-cols-12 gap-2 px-1 pb-1 text-xs font-medium text-slate-400 sm:grid">
            <span className="col-span-5">Deskripsi</span>
            <span className="col-span-1">Unit</span>
            <span className="col-span-1">Qty</span>
            <span className="col-span-2">Unit Price</span>
            <span className="col-span-2">Amount</span>
          </div>
          <div className="space-y-2">
            {items.map((it, idx) => (
              <div key={idx} className="grid grid-cols-12 items-start gap-2">
                <div className="col-span-12 sm:col-span-5">
                  <Textarea
                    value={it.description}
                    onChange={(e) => updateItem(idx, 'description', e.target.value)}
                    rows="1"
                    placeholder="Deskripsi pekerjaan"
                  />
                </div>
                <div className="col-span-3 sm:col-span-1">
                  <Input value={it.unit} onChange={(e) => updateItem(idx, 'unit', e.target.value)} placeholder="Unit" />
                </div>
                <div className="col-span-3 sm:col-span-1">
                  <Input value={it.qty} onChange={(e) => updateItem(idx, 'qty', e.target.value)} placeholder="100%" />
                </div>
                <div className="col-span-3 sm:col-span-2">
                  <Input
                    type="number"
                    value={it.unitPrice}
                    onChange={(e) => updateItem(idx, 'unitPrice', e.target.value)}
                    placeholder="Harga"
                  />
                </div>
                <div className="col-span-2 sm:col-span-2">
                  <Input
                    type="number"
                    value={it.amount}
                    onChange={(e) => updateItem(idx, 'amount', e.target.value)}
                    placeholder="auto"
                  />
                </div>
                <div className="col-span-1 flex justify-end pt-1 sm:hidden">
                  {items.length > 1 && (
                    <button
                      onClick={() => removeItem(idx)}
                      className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
                {items.length > 1 && (
                  <button
                    onClick={() => removeItem(idx)}
                    className="col-span-1 hidden justify-self-end rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 sm:block"
                    title="Hapus item"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
          <p className="mt-1.5 px-1 text-xs text-slate-400">
            Kosongkan <span className="font-medium">Amount</span> untuk hitung otomatis (Qty × Unit Price). Isi manual bila
            nilainya berbeda (mis. progres/retensi).
          </p>
        </div>

        {/* Pajak */}
        <div className="grid grid-cols-2 gap-4">
          <Field label="PPN (%)">
            <Input type="number" value={ppnRate} onChange={(e) => setPpnRate(e.target.value)} />
          </Field>
          <Field label="PPh (%)">
            <Input type="number" value={pphRate} onChange={(e) => setPphRate(e.target.value)} />
          </Field>
        </div>
        <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-slate-200 bg-slate-50/60 p-3">
          <input
            type="checkbox"
            checked={useDppNilaiLain}
            onChange={(e) => setUseDppNilaiLain(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
          />
          <span className="text-sm text-slate-600">
            <span className="font-medium text-slate-800">Gunakan DPP Nilai Lain</span> — DPP = 11/12
            × subtotal, PPN = 12% × DPP (efektif 11%, sesuai PMK 131/2024 untuk PKP)
          </span>
        </label>

        {/* Ringkasan */}
        <div className="rounded-xl bg-slate-50 p-4">
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between text-slate-500">
              <span>Subtotal</span>
              <span className="tnum">{formatCurrency(totals.subtotal)}</span>
            </div>
            {useDppNilaiLain && totals.pajak11 > 0 && (
              <div className="flex justify-between text-slate-500">
                <span>DPP Nilai Lain</span>
                <span className="tnum">{formatCurrency(totals.dppNilaiLain)}</span>
              </div>
            )}
            {totals.pajak11 > 0 && (
              <div className="flex justify-between text-slate-500">
                <span>PPN {ppnRate}%</span>
                <span className="tnum">{formatCurrency(totals.pajak11)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-slate-200 pt-1.5 font-display text-base font-bold text-brand-600">
              <span>Grand Total</span>
              <span>{formatCurrency(totals.grandTotal)}</span>
            </div>
            {totals.taxDeductedAmount > 0 && (
              <>
                <div className="flex justify-between text-slate-500">
                  <span>PPh {pphRate}% (dipotong client)</span>
                  <span className="tnum">−{formatCurrency(totals.taxDeductedAmount)}</span>
                </div>
                <div className="flex justify-between font-semibold text-slate-800">
                  <span>Diterima</span>
                  <span className="tnum">{formatCurrency(totals.netProceeds)}</span>
                </div>
              </>
            )}
          </div>
          <p className="mt-3 border-t border-slate-200 pt-2 text-xs italic text-slate-500">
            Terbilang:{' '}
            <span className="font-medium text-slate-700">{terbilang(totals.grandTotal)}</span>
          </p>
        </div>

        {/* Note + tanda tangan */}
        <Field label="Catatan Pembayaran">
          <Textarea value={paymentNote} onChange={(e) => setPaymentNote(e.target.value)} rows="2" />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Kota (tanda tangan)">
            <Input value={COMPANY_INFO.city} disabled />
          </Field>
          <Field label="Nama Penanda Tangan">
            <Input value={signName} onChange={(e) => setSignName(e.target.value)} />
          </Field>
          <Field label="Jabatan">
            <Input value={signTitle} onChange={(e) => setSignTitle(e.target.value)} />
          </Field>
        </div>
      </div>
    </Modal>
  );
};

export default InvoiceModal;
