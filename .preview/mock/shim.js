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
export const setInvoiceStatus = noop;
export const markInvoicePaid = noop;
export const updateTaxDocs = noop;
export const calcInvoiceTotals = () => ({ dpp: 0, ppn: 0, grandTotal: 0 });
export const billingStageLabel = () => 'Belum';
export const taxDocsProgress = () => ({ done: 0, total: 3 });
export const isPpnCair = () => false;

// --- Klien ---
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
export const db = {};
export const storage = {};
export const auth = {};

// --- Laporan & PDF ---
// pdfGenerator juga dialihkan ke shim ini, jadi ekspornya wajib ada di sini.
export const generateFullReportPDF = noopSync;
export const generateTransactionReport = noopSync;
export const shareProjectWhatsAppRich = noopSync;
export const buildFinancialSummary = () => ({});
export const getFinancialInsight = async () => ({});
