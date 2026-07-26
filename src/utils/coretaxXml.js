// src/utils/coretaxXml.js
// Generator XML bulk upload e-Faktur CoreTax (DJP) dari invoice Kontrack.
// Struktur mengikuti TaxInvoiceTemplate.xml resmi (skema TaxInvoice.xsd).
// Catatan: elemen <BuyerAdress> memang salah eja di skema resmi — JANGAN diperbaiki.

// Opsi barang/jasa: A = Barang, B = Jasa (kontraktor umumnya B).
export const GOODSERVICE_OPT = { BARANG: 'A', JASA: 'B' };

// Kode jasa konstruksi CoreTax yang umum dipakai kontraktor.
export const CORETAX_SERVICE_CODES = [
  { code: '010000', label: 'Jasa Konstruksi (Umum)' },
  { code: '010101', label: 'Konstruksi bangunan tempat tinggal' },
  { code: '010102', label: 'Konstruksi bangunan bukan tempat tinggal' },
  { code: '010201', label: 'Konstruksi jalan, rel, landasan' },
  { code: '010202', label: 'Konstruksi jembatan & terowongan' },
  { code: '010203', label: 'Konstruksi pelabuhan, bendungan, irigasi' },
  { code: '010303', label: 'Jasa penggalian & pemindahan tanah' },
  { code: '010504', label: 'Jasa pemasangan beton' },
  { code: '010506', label: 'Jasa tukang bangunan' },
  { code: '010601', label: 'Jasa instalasi listrik' },
  { code: '010602', label: 'Jasa instalasi pipa air / plumbing' },
  { code: '010607', label: 'Jasa finishing bangunan' }
];

// Kode transaksi: 01 = kepada selain pemungut PPN; 02 = kepada pemungut bendaharawan;
// 03 = kepada pemungut selain bendaharawan (BUMN dll).
export const TRX_CODES = [
  { code: '01', label: '01 — Kepada selain pemungut PPN (swasta)' },
  { code: '02', label: '02 — Kepada pemungut bendaharawan' },
  { code: '03', label: '03 — Kepada pemungut selain bendaharawan (BUMN)' }
];

// Satuan CoreTax. Faktur PT PEB memakai satuan yang tampil sebagai "Kegiatan".
// UM.0001 diambil dari TaxInvoiceTemplate.xml resmi; kode lain HARUS dicocokkan
// dengan daftar satuan di akun CoreTax Anda sebelum unggah massal.
export const CORETAX_UNITS = [
  { code: 'UM.0018', label: 'Kegiatan (dipakai faktur PT PEB)' },
  { code: 'UM.0001', label: 'UM.0001 (dari template resmi)' },
  { code: 'UM.0021', label: 'Paket' },
  { code: 'UM.0033', label: 'Unit' }
];

const esc = (v) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

// NPWP → digit saja (CoreTax memakai NPWP 16 digit tanpa titik/strip).
const cleanTin = (npwp) => String(npwp || '').replace(/\D/g, '');

// IDTKU = NPWP + kode cabang (default 000000 untuk pusat).
const toIdtku = (npwp, branch = '000000') => {
  const tin = cleanTin(npwp);
  if (!tin) return '';
  return tin.length > 16 ? tin : `${tin}${branch}`.slice(0, 22);
};

const isoDate = (d) => {
  if (!d) return new Date().toISOString().slice(0, 10);
  const date = typeof d === 'string' ? new Date(d) : d;
  return isNaN(date.getTime()) ? String(d).slice(0, 10) : date.toISOString().slice(0, 10);
};

const round = (n) => Math.round(Number(n) || 0);

/**
 * Bangun satu blok <GoodService> dari item invoice.
 * DPP Nilai Lain (11/12 × harga) dipetakan ke <OtherTaxBase> sesuai aturan PMK 131/2024.
 */
const buildGoodService = (item, opts) => {
  const { opt, code, unit, useDppNilaiLain, vatRate } = opts;
  const qty = Number(item.qty) || 1;
  const price = Number(item.unitPrice) || 0;
  const gross =
    item.amount !== '' && item.amount != null ? Number(item.amount) || 0 : qty * price;
  const discount = 0;
  const taxBase = round(gross - discount);
  const otherTaxBase = useDppNilaiLain ? round((taxBase * 11) / 12) : taxBase;
  const vat = round((otherTaxBase * vatRate) / 100);

  return [
    '        <GoodService>',
    `          <Opt>${esc(opt)}</Opt>`,
    `          <Code>${esc(code)}</Code>`,
    `          <Name>${esc(item.description || 'Jasa Konstruksi')}</Name>`,
    `          <Unit>${esc(unit)}</Unit>`,
    `          <Price>${round(price || gross)}</Price>`,
    `          <Qty>${qty}</Qty>`,
    `          <TotalDiscount>${discount}</TotalDiscount>`,
    `          <TaxBase>${taxBase}</TaxBase>`,
    `          <OtherTaxBase>${otherTaxBase}</OtherTaxBase>`,
    `          <VATRate>${vatRate}</VATRate>`,
    `          <VAT>${vat}</VAT>`,
    '          <STLGRate>0</STLGRate>',
    '          <STLG>0</STLG>',
    '        </GoodService>'
  ].join('\n');
};

/**
 * Bangun XML bulk e-Faktur CoreTax.
 * @param {Array} invoices - invoice Kontrack (butuh: date/tanggalTerbit, items, totals, client)
 * @param {Object} company - profil perusahaan (npwp, dst) dari settings
 * @param {Object} options - { opt, code, unit, trxCode, vatRate, sellerBranch }
 * @returns {string} XML siap unggah ke CoreTax
 */
export const buildCoretaxXml = (invoices, company, options = {}) => {
  const {
    opt = GOODSERVICE_OPT.JASA,
    code = '010000',
    unit = 'UM.0018', // tampil "Kegiatan" pada faktur PT PEB
    trxCode = '01',
    vatRate = 12, // DPP Nilai Lain 11/12 × 12% = efektif 11%
    sellerBranch = '000000'
  } = options;

  const sellerTin = cleanTin(company?.npwp);
  const sellerIdtku = toIdtku(company?.npwp, sellerBranch);

  const blocks = invoices.map((inv) => {
    const client = inv.client || {};
    const buyerTin = cleanTin(client.npwp || inv.clientNpwp);
    const useDppNilaiLain = inv.useDppNilaiLain !== false;
    const items = (inv.items || []).filter((i) => i.description);
    const list = (items.length ? items : [{ description: inv.projectName, amount: inv.totals?.subtotal }])
      .map((item) => buildGoodService(item, { opt, code, unit, useDppNilaiLain, vatRate }))
      .join('\n');

    return [
      '    <TaxInvoice>',
      `      <TaxInvoiceDate>${isoDate(inv.date || inv.tanggalTerbit)}</TaxInvoiceDate>`,
      '      <TaxInvoiceOpt>Normal</TaxInvoiceOpt>',
      `      <TrxCode>${esc(trxCode)}</TrxCode>`,
      `      <AddInfo />`,
      '      <CustomDoc />',
      `      <RefDesc>${esc(inv.taxRefDesc || inv.invoiceNumber || inv.number || '')}</RefDesc>`,
      '      <FacilityStamp />',
      `      <SellerIDTKU>${esc(sellerIdtku)}</SellerIDTKU>`,
      `      <BuyerTin>${esc(buyerTin)}</BuyerTin>`,
      '      <BuyerDocument>TIN</BuyerDocument>',
      '      <BuyerCountry>IND</BuyerCountry>',
      '      <BuyerDocumentNumber />',
      `      <BuyerName>${esc(client.client_name || inv.clientName || '')}</BuyerName>`,
      `      <BuyerAdress>${esc((client.address || '').replace(/\n/g, ', '))}</BuyerAdress>`,
      `      <BuyerEmail>${esc(client.email || '')}</BuyerEmail>`,
      `      <BuyerIDTKU>${esc(toIdtku(client.npwp || inv.clientNpwp))}</BuyerIDTKU>`,
      '      <ListOfGoodService>',
      list,
      '      </ListOfGoodService>',
      '    </TaxInvoice>'
    ].join('\n');
  });

  return [
    '<TaxInvoiceBulk xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="TaxInvoice.xsd">',
    `  <TIN>${esc(sellerTin)}</TIN>`,
    '  <ListOfTaxInvoice>',
    ...blocks,
    '  </ListOfTaxInvoice>',
    '</TaxInvoiceBulk>'
  ].join('\n');
};

// Unduh XML sebagai file.
export const downloadCoretaxXml = (invoices, company, options = {}) => {
  const xml = buildCoretaxXml(invoices, company, options);
  const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `CoreTax_FakturPajak_${invoices.length}inv_${stamp}.xml`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return xml;
};

// Validasi sebelum ekspor — kembalikan daftar masalah (kosong = siap).
export const validateForCoretax = (invoices, company) => {
  const issues = [];
  if (!cleanTin(company?.npwp)) issues.push('NPWP perusahaan belum diisi di Pengaturan.');
  invoices.forEach((inv) => {
    const no = inv.invoiceNumber || inv.number || '(tanpa nomor)';
    const client = inv.client || {};
    if (!cleanTin(client.npwp || inv.clientNpwp)) issues.push(`${no}: NPWP klien kosong.`);
    if (!(client.client_name || inv.clientName)) issues.push(`${no}: nama klien kosong.`);
    if (!(inv.totals?.subtotal || inv.items?.length)) issues.push(`${no}: tidak ada item/nilai.`);
  });
  return issues;
};
