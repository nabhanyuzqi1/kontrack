// Shim layanan untuk pratinjau tampilan tanpa login.
//
// Daftar ekspor di bawah dihasilkan dari impor nyata di src/
// (lihat scripts/list-service-imports.mjs) — bukan ditebak. Kalau satu nama saja
// kurang, Vite gagal me-resolve modul dan halaman tampil KOSONG tanpa pesan:
// persis kegagalan yang harness ini ada untuk menangkap.
import { projects, transactions, invoices } from './data.js';
import { compareInvoices } from '../../src/utils/invoiceNormalization.js';

export const sortInvoiceList = (list, { sortBy = 'date', direction = 'desc', projectNameOf } = {}) =>
  [...list].sort((a, b) => compareInvoices(a, b, sortBy, direction, projectNameOf));
export const signUpUser = async () => ({ role: 'staff', name: 'Preview' });
export const generateProjectPDF = () => {};

// Mock doc/getDoc: ProjectDetail mengimpor keduanya langsung dari
// 'firebase/firestore' (dialihkan ke shim lewat vite.config.mjs).
export const doc = (_db, collection, id) => ({ collection, id });
export const getDoc = async (ref) => ({
  exists: () => Boolean(ref.id && projects.find((p) => p.id === ref.id)),
  data: () => projects.find((p) => p.id === ref.id) || {}
});

const noop = async () => {};
const noopSync = () => {};

// --- Konstanta ---
export const BILLING_STAGES = ['belum', 'billing', 'ntpn'];
export const CORETAX_STATUS = ['belum', 'siap', 'terkirim'];
export const INVOICE_STATUS = { DRAFT: 'draft', SENT: 'sent', PAID: 'paid', VOID: 'void' };
export const INVOICE_STATUS_LABEL = {
  draft: 'Draf',
  sent: 'Terkirim',
  paid: 'Lunas',
  void: 'Batal'
};
export const USER_ROLES = { ADMIN: 'admin', USER: 'user' };
export const legacyFunctions = {};

// Harness: berkas diambil dari gambar contoh, bukan Storage. `converted`
// dipakai untuk menguji jalur "TIFF diubah server menjadi PNG".
export const fetchAssetPayload = async () => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="420">
    <rect width="640" height="420" fill="#ffffff"/>
    <rect x="24" y="24" width="592" height="372" fill="none" stroke="#1e293b" stroke-width="2"/>
    <text x="44" y="86" font-family="Georgia, serif" font-size="26" fill="#0f172a">SURAT PERINTAH KERJA</text>
    <text x="44" y="122" font-family="Georgia, serif" font-size="15" fill="#475569">No. 041/SPK/IPAL-SLM/2026</text>
    <text x="44" y="180" font-family="Georgia, serif" font-size="13" fill="#334155">Pekerjaan: Instalasi IPAL 17 unit - Kab. Katingan</text>
    <text x="44" y="210" font-family="Georgia, serif" font-size="13" fill="#334155">Nilai: Rp 4.250.000.000</text>
    <text x="44" y="240" font-family="Georgia, serif" font-size="13" fill="#334155">Retensi: 5% - masa pemeliharaan 3 bulan</text>
  </svg>`;
  return {
    dataUrl: `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`,
    contentType: 'image/png',
    originalContentType: 'image/tiff',
    converted: true,
    conversionNote: '',
    size: 2048,
  };
};

// --- Proyek ---
export const getAllProjects = async () => projects;
export const getProject = async (id) => projects.find((p) => p.id === id) || null;
export const getProjectsByStatus = async (status) => projects.filter((p) => p.status === status);
export const getProjectsWithUpcomingDeadlines = async () => [];
export const addProject = async () => 'p-baru';
export const updateProject = noop;
export const deleteProject = noop;

// --- Transaksi ---
export const getAllTransactions = async () => transactions;
export const getTransactionsByProject = async (id) =>
  transactions.filter((t) => t.projectId === id);
export const getTransactionStats = async () => ({ income: 0, expense: 0, count: 0 });
export const addTransaction = async () => 't-baru';
export const updateTransaction = noop;
export const deleteTransaction = noop;
export const uploadTransactionImage = async () => 'https://example.invalid/bukti.webp';
export const validateImageFile = () => true;
// Hasil analisis tiruan: sengaja mencakup tiga kondisi yang harus terlihat
// bedanya di UI — (a) nota "bon" upah dengan jam terbaca, (b) nota tanpa jam,
// (c) hasil tanpa tanggal sama sekali. Ketiganya menguji penanda sumber.
// Kontrak services/ai.js: mengembalikan ARRAY hasil yang sudah dinormalkan
// (bukan { transactions }), karena pemanggil langsung memanggil .map().
export const analyzeTransactionImages = async () => ([
  {
      type: 'expense',
      category: 'Upah Karyawan/Tukang',
      amount: 1350000,
      date: '2026-11-12T15:30',
      vendor: 'Toko Bangunan Sumber Rejeki',
      description: 'Bon upah 3 tukang harian',
      imageUrl: ''
    },
    {
      type: 'expense',
      category: 'Material',
      amount: 4875000,
      date: '2026-11-10',
      vendor: 'CV Karya Besi',
      description: 'Beli besi beton 12mm'
    },
    {
      type: 'income',
      category: 'Pembayaran Invoice',
      amount: 25000000,
      date: '',
      vendor: '',
      description: 'Transfer masuk tanpa tanggal pada bukti'
    }
]);
export const scanWphoDocument = async () => ({
  wphoNumber: 'SLM/WP/2611/00449',
  amount: 39710000,
  workName: 'BAK KOMPOSTING AFD XVI BLOK O078 KBN 5 (25 M2)',
  date: '2026-11-03',
  contractNumber: 'SLM/CR/2512/00835',
  pkNumber: 'SLM/PK-HO/TEK/37/7/2026'
});

// --- Invoice & dokumen pajak ---
export const getAllInvoices = async () => invoices;
export const addInvoice = async () => 'i-baru';
export const deleteInvoice = noop;
export const setInvoiceStatus = noop;
export const markInvoicePaid = noop;
export const updateTaxDocs = noop;
export const calcInvoiceTotals = () => ({ dpp: 0, ppn: 0, grandTotal: 0 });
export const billingStageLabel = (stage) => {
  if (!stage) return '';
  if (String(stage).startsWith('termin-')) return `Termin ${String(stage).split('-')[1]}`;
  return String(stage).charAt(0).toUpperCase() + String(stage).slice(1);
};
// Bentuknya ARRAY (bukan objek) — komponen memanggil .filter() padanya.
export const taxDocsProgress = (inv = {}) => [
  { key: 'faktur', label: 'Faktur Pajak', done: Boolean(inv.taxInvoiceNumber) },
  { key: 'billing', label: 'Billing Pajak', done: Boolean(inv.billingCode) },
  { key: 'ppn', label: 'Pembayaran PPN', done: Boolean(inv.taxPaidAt || inv.taxPaymentProofUrl) },
  { key: 'ntpn', label: 'Nomor NTPN', done: Boolean(inv.ntpnNumber) }
];
export const isPpnCair = (inv = {}) => inv.coreTaxStatus === 'cleared';

// --- Klien ---
export const getNextInvoiceNumber = async () => {
  const list = await getAllInvoices().catch(() => []);
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const re = new RegExp('^INV-(\d+)/PEB/' + mm + '/' + now.getFullYear() + '$', 'i');
  const max = list.reduce((acc, inv) => {
    const m = re.exec(String(inv.invoiceNumber || '').trim());
    return m ? Math.max(acc, Number(m[1])) : acc;
  }, 0);
  return `INV-${String(max + 1).padStart(3, '0')}/PEB/${mm}/${now.getFullYear()}`;
};

export const updateInvoice = noop;

// Klien contoh untuk pratinjau: proyek terkait lewat `partner` (bentuk data lama),
// invoice terkait lewat `clientId` (bentuk data baru) — kedua jalur join ikut teruji.
const clients = [
  {
    id: 'c1',
    client_name: 'Dinas PUPR Katingan',
    clientType: 'Instansi',
    npwp: '01.234.567.8-901.000',
    address: 'Jl. Pemuda No. 12, Kasongan',
    city: 'Kasongan',
    province: 'Kalimantan Tengah',
    postalCode: '74413',
    phone: '0536-22145',
    email: 'pupr@katingankab.go.id',
    contactPerson: 'Ir. Hadi Susanto',
    contactPosition: 'PPK Kegiatan Jalan',
    contactPhone: '0812-5100-7788',
    notes: 'Pembayaran termin mengikuti SPK: 30/40/25/5.'
  },
  {
    id: 'c2',
    client_name: 'Pemerintah Desa Baun Bango',
    clientType: 'Instansi',
    npwp: '02.345.678.9-902.000',
    address: 'Jl. Desa Baun Bango RT 2',
    city: 'Kamipang',
    province: 'Kalimantan Tengah',
    postalCode: '74462',
    phone: '0536-30011',
    email: 'pemdes@baunbango.desa.id',
    contactPerson: 'Rahmadi',
    contactPosition: 'Kepala Desa',
    contactPhone: '0813-4900-1122'
  },
  {
    id: 'c3',
    client_name: 'Pemerintah Kabupaten Kotim',
    clientType: 'Instansi',
    npwp: '03.456.789.0-903.000',
    address: 'Jl. Jend. Sudirman Km 3,5',
    city: 'Sampit',
    province: 'Kalimantan Tengah',
    postalCode: '74322',
    phone: '0531-21100',
    email: '',
    contactPerson: 'Drs. Supian',
    contactPosition: 'Kabid Cipta Karya',
    contactPhone: '0812-7700-4455'
  },
  {
    id: 'c4',
    client_name: 'CV Mitra Borneo',
    clientType: 'CV',
    npwp: '04.567.890.1-904.000',
    address: 'Jl. Pelita Raya No. 8',
    city: 'Sampit',
    province: 'Kalimantan Tengah',
    postalCode: '74312',
    phone: '0531-33890',
    email: 'admin@mitraborneo.co.id',
    contactPerson: 'Yanto',
    contactPosition: 'Direktur',
    contactPhone: '0811-5500-9900'
  }
];

export const getAllClients = async () => clients;
export const getClientMap = async () => Object.fromEntries(clients.map((c) => [c.id, c]));
export const clientDisplayName = (c) => c?.client_name || c?.name || 'Tanpa nama';
export const addClient = noop;
export const updateClient = noop;
export const deleteClient = noop;

// --- Pengguna ---
export const getAllUsers = async () => [];
export const inviteUser = noop;
export const changeUserRole = noop;
export const removeUser = noop;
export const roleLabel = (role) => (role === 'admin' ? 'Administrator' : 'Anggota');

// --- Pengaturan perusahaan ---
export const getCompanySettings = async () => ({
  companyName: 'PT. PERMATA ENERGI BORNEO',
  npwp: '01.234.567.8-901.000',
  city: 'Sampit'
});
export const getThemeFromSettings = () => 'electric';
export const saveCompanySettings = noop;
export const mergeCompanyInfo = (x) => x;
export const uploadLetterhead = async () => 'https://example.invalid/kop.webp';
export const uploadSignature = async () => 'https://example.invalid/ttd.webp';
export const removeCompanyAsset = noop;

// --- Auth: pratinjau selalu dianggap sudah masuk ---
export const onAuthStateChange = () => () => {};
export const signOutUser = noop;
export const signInUser = async () => ({ role: 'admin' });
export const signInWithGoogle = async () => ({ role: 'admin' });

// --- Firebase: modul yang mengimpor langsung (mis. ProjectDetail) ---
// `services/[^/]+` dialihkan seluruhnya, jadi nama dari functionsRegion dan
// cache pun wajib tersedia di sini.
export const db = {};
export const storage = {};
export const auth = {};
export const REGION = 'asia-southeast2';
export const AI_REGION = REGION;
export const LEGACY_REGION = REGION;
export const kontrackFunctions = () => ({});
export const aiFunctions = kontrackFunctions;
// Cache in-memory sederhana: kunci harus sama dengan services/cache.js asli
// supaya langganan SWR di halaman tetap bekerja di harness pratinjau.
export const CACHE_KEYS = {
  PROJECTS: 'projects:all',
  CLIENTS: 'clients:all',
  INVOICES: 'invoices:all',
  TRANSACTIONS: 'transactions:all',
  SETTINGS: 'settings:company'
};
const __subs = new Map();
export const subscribe = (key, cb) => {
  if (!__subs.has(key)) __subs.set(key, new Set());
  __subs.get(key).add(cb);
  return () => __subs.get(key).delete(cb);
};
export const cached = async (_k, fn) => fn();
export const invalidate = () => {};
export const withTimeout = (p) => p;

// --- Laporan & PDF ---
// pdfGenerator & invoiceGenerator juga dialihkan ke shim ini, jadi ekspornya
// wajib ada di sini. Tanpa ini, modul aslinya menarik `jspdf` mentah dan
// pratinjau gagal dengan "Failed to resolve module specifier".
export const generateFullReportPDF = noopSync;
export const generateTransactionReport = noopSync;
export const generateInvoicePDF = async () => ({
  // Blob PDF minimal (header %PDF) supaya PdfPreview bisa dirender di pratinjau
  // tanpa menjalankan jsPDF sungguhan.
  blob: new Blob(['%PDF-1.4\n% pratinjau\n'], { type: 'application/pdf' }),
  fileName: 'Invoice_pratinjau.pdf'
});
export const buildInvoiceNumber = () => `PREVIEW-${Date.now()}`;
export const shareProjectWhatsAppRich = noopSync;
// ProjectDetail kini memakai buildProjectWhatsAppMessage (bukan lagi
// shareProjectWhatsAppRich) untuk pratinjau berbagi. Bila ekspornya tidak ada di
// sini, impor modul gagal dengan "does not provide an export named ..." dan
// seluruh pratinjau tampil kosong tanpa pesan.
export const shareProjectWhatsApp = noopSync;
export const copyProjectLink = noop;
export const buildProjectWhatsAppMessage = (project) =>
  `*${project?.name || 'Proyek'}*

Pratinjau pesan pada harness. Teks asli dibangun utils/sharing.js.`;
export const generateProjectSummaryImage = async () => {
  // Gambar 2x2 PNG transparan: cukup untuk menguji alur pratinjau gambar
  // tanpa menjalankan canvas sungguhan.
  const px = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='), (c) => c.charCodeAt(0));
  return new Blob([px], { type: 'image/png' });
};
export const buildFinancialSummary = () => ({});
export const getFinancialInsight = async () => ({});

// services/email
export const sendInvoiceEmail = async () => ({ messageId: 'mock' });
export const buildBillingEmailContent = (invoice) => ({
  subject: `Penagihan ${invoice?.invoiceNumber || ''}`,
  body: 'mock body'
});

// Dokumen arsip + revisi invoice
export const INVOICE_DOC_LABELS = {
  bahk: 'BAHK (Berita Acara Hasil Kerja)',
  wpho: 'WPHO / BAST',
  spk: 'SPK / Kontrak Kerja',
  pk: 'Perjanjian Kerja (PK)',
  faktur: 'Faktur Pajak'
};
export const uploadInvoiceDocument = async () => ({ url: 'https://example.invalid/doc.pdf', name: 'doc.pdf' });
export const reviseInvoice = async () => ({ revision: 1, invoiceNumber: 'INV-001/PEB/11/2026 Rev.1' });
export const markCoretaxExported = noop;

// services/notify — dipakai NotifySettings (Pengaturan) & NotificationCenter
export const getNotifyChannels = async () => ({ email: true, whatsapp: false, whatsappMode: null });
export const notifyByEmail = async () => ({ sent: 1, skipped: 0 });
export const sendWhatsApp = async () => ({ sent: false, configured: false, reason: 'Gateway WhatsApp belum disetel pemilik.' });

// dipakai invoice (share WhatsApp)
export const buildInvoiceWhatsApp = () => ({ url: 'https://wa.me/0', text: '' });
export const sendInvoiceWhatsApp = async () => ({ ok: true });

// dipakai generator PDF untuk mengambil kop/tanda tangan dari Storage.
// Di harness tidak ada token Storage; generator asli melewati gambar bila ini
// mengembalikan null (catch di loadImage), jadi PDF tetap tergenerate.
export const fetchAssetDataUrl = async () => {
  throw new Error('Harness: pengambilan aset Storage dilewati.');
};
// Viewer memakai `fetchAssetPayload`; aset kop PDF tetap dilewati di atas.


// --- Ringkasan pilihan (invoice/proyek) ---
// `utils/sharing` dialiaskan ke modul ini di harness, jadi setiap ekspor baru
// di berkas asli harus dicerminkan di sini; kalau tidak, seluruh halaman
// gagal dimuat dengan "does not provide an export named ...".
export const buildInvoicesSummaryMessage = (invoices = [], opts = {}) => {
  const rows = [];
  const name = opts.company?.name || opts.company?.companyName;
  if (name) rows.push(`*${name}*`);
  rows.push('*RINGKASAN INVOICE*', '', `Jumlah invoice: *${invoices.length}*`);
  invoices.forEach((inv) => {
    rows.push(`- ${inv.invoiceNumber || 'Tanpa nomor'}: Rp${Number(inv.grandTotal || inv.total || 0).toLocaleString('id-ID')}`);
  });
  return rows.join(String.fromCharCode(10));
};

export const buildProjectsSummaryMessage = (list = [], opts = {}) => {
  const rows = [];
  const name = opts.company?.name || opts.company?.companyName;
  if (name) rows.push(`*${name}*`);
  rows.push('*RINGKASAN PROYEK*', '', `Jumlah proyek: *${list.length}*`);
  list.forEach((p) => rows.push(`- ${p.name}: Rp${Number(p.value || 0).toLocaleString('id-ID')}`));
  return rows.join(String.fromCharCode(10));
};

export const shareTextWhatsApp = (message) => {
  // Di harness jangan benar-benar membuka jendela baru.
  if (typeof console !== 'undefined') console.info('[shim] WhatsApp:', message.slice(0, 40));
};

export const copyText = async (message) => {
  try {
    await navigator.clipboard.writeText(message);
    return true;
  } catch {
    return false;
  }
};
