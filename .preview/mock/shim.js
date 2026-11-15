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
export const generateProjectSummaryImage = () => '';

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
export const analyzeTransactionImages = async () => ({ transactions: [] });
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
