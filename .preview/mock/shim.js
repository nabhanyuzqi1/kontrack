// Shim layanan: halaman Laporan mengambil data lewat modul ini, bukan Firebase,
// supaya tampilan bisa diperiksa tanpa login. Hanya untuk pratinjau lokal.
export { projects as getAllProjectsData } from './data.js';
import { projects, transactions, invoices } from './data.js';

export const getAllProjects = async () => projects;
export const getAllTransactions = async () => transactions;
export const getAllInvoices = async () => invoices;
export const availableYears = () => [2026, 2025];

export const generateFullReportPDF = () => console.log('[preview] PDF laporan lengkap');
export const generateTransactionReport = () => console.log('[preview] PDF transaksi');

export const buildFinancialSummary = () => ({});
export const getFinancialInsight = async () => ({});
