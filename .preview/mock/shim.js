// Shim layanan untuk pratinjau tampilan tanpa login.
//
// Daftar ekspor di bawah dihasilkan dari impor nyata di src/
// (lihat scripts/list-service-imports.mjs) — bukan ditebak. Kalau satu nama saja
// kurang, Vite gagal me-resolve modul dan halaman tampil KOSONG tanpa pesan:
// persis kegagalan yang harness ini ada untuk menangkap.
import { projects, transactions, invoices } from './data.js';

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
export const getAllClients = async () => [];
export const getClientMap = async () => ({});
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
export const generateInvoicePDF = noopSync;
export const buildInvoiceNumber = () => `PREVIEW-${Date.now()}`;
export const shareProjectWhatsAppRich = noopSync;
export const buildFinancialSummary = () => ({});
export const getFinancialInsight = async () => ({});
