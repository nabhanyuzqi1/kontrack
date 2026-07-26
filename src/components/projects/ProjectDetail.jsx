// src/components/projects/ProjectDetail.jsx
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import {
  ArrowLeft,
  Link2,
  FileDown,
  FileText,
  Sparkles,
  Plus,
  ArrowDownRight,
  ArrowUpRight,
  Scale,
  CalendarDays,
  FileSignature
} from 'lucide-react';
import { db } from '../../services/firebase';
import { getTransactionsByProject, deleteTransaction } from '../../services/transactions';
import TransactionModal from '../transactions/TransactionModal';
import AITransactionModal from '../transactions/AITransactionModal';
import TransactionTable from '../transactions/TransactionTable';
import InvoiceModal from '../invoices/InvoiceModal';
import { formatCurrency, formatDate, calculateProjectProgress, calculateDaysLeft } from '../../utils/formatters';
import { shareProjectWhatsAppRich } from '../../utils/sharing';
import { generateProjectSummaryImage } from '../../utils/projectImage';
import { generateProjectPDF } from '../../utils/pdfGenerator';
import { getCompanySettings, mergeCompanyInfo } from '../../services/settings';
import Button from '../ui/Button';
import { Card, CardHeader } from '../ui/Card';
import { StatusBadge } from '../ui/Badge';
import ProgressBar from '../ui/ProgressBar';
import { SkeletonDetail } from '../ui/Skeleton';
import EmptyState from '../ui/EmptyState';

const WhatsAppIcon = ({ className = 'h-4 w-4' }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
  </svg>
);

const SummaryTile = ({ icon: Icon, label, value, tone }) => (
  <div className={`flex items-center gap-3 rounded-xl border p-4 ${tone.wrap}`}>
    <div className={`rounded-lg p-2.5 ${tone.icon}`}>
      <Icon className="h-5 w-5" />
    </div>
    <div className="min-w-0">
      <p className={`text-xs font-medium ${tone.label}`}>{label}</p>
      <p className={`truncate font-display text-lg font-bold ${tone.value}`}>{value}</p>
    </div>
  </div>
);

const ProjectDetail = ({ currentUser }) => {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [txnRestricted, setTxnRestricted] = useState(false);

  useEffect(() => {
    if (id) {
      loadProjectData();
    }
  }, [id]);

  const loadProjectData = async () => {
    setLoading(true);
    setError(null);
    try {
      const projectRef = doc(db, 'projects', id);
      const projectSnap = await getDoc(projectRef);

      if (projectSnap.exists()) {
        const projectData = { id: projectSnap.id, ...projectSnap.data() };
        setProject(projectData);

        // Transaksi butuh login (security rules) — pengunjung share-link
        // tetap bisa melihat info & progres proyek tanpa transaksi internal.
        try {
          const transactionData = await getTransactionsByProject(id);
          setTransactions(transactionData);
          setTxnRestricted(false);
        } catch (txnErr) {
          console.warn('Transaksi tidak dapat diakses (butuh login):', txnErr?.code || txnErr);
          setTransactions([]);
          setTxnRestricted(true);
        }
      } else {
        setError('Proyek tidak ditemukan');
      }
    } catch (err) {
      console.error('Error loading project:', err);
      setError('Gagal memuat data proyek. Silakan coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  const handleEditTransaction = (transaction) => {
    setEditingTransaction(transaction);
    setShowTransactionModal(true);
  };

  const handleDeleteTransaction = async (transaction) => {
    try {
      await deleteTransaction(transaction.id, transaction);
      await loadProjectData();
    } catch (err) {
      console.error('Error deleting transaction:', err);
      alert('Gagal menghapus transaksi');
    }
  };

  const handleModalClose = () => {
    setShowTransactionModal(false);
    setShowAIModal(false);
    setEditingTransaction(null);
  };

  const handleModalSuccess = () => {
    handleModalClose();
    loadProjectData();
  };

  const [sharingWa, setSharingWa] = useState(false);

  const handleShareWhatsApp = async () => {
    if (!project || sharingWa) return;
    setSharingWa(true);
    try {
      const settings = await getCompanySettings().catch(() => null);
      const company = mergeCompanyInfo(settings);
      const image = await generateProjectSummaryImage(project, transactions, company).catch(() => null);
      await shareProjectWhatsAppRich(project, transactions, company, image);
    } catch (err) {
      console.error('Gagal share WhatsApp:', err);
    } finally {
      setSharingWa(false);
    }
  };

  const copyProjectLink = () => {
    const link = `${window.location.origin}/projects/${project.id}`;
    navigator.clipboard
      .writeText(link)
      .then(() => alert('Link proyek berhasil disalin!'))
      .catch((err) => {
        console.error('Failed to copy:', err);
        alert('Gagal menyalin link');
      });
  };

  const handleExportPDF = () => {
    if (project) {
      generateProjectPDF(project, transactions);
    }
  };

  const handleGenerateInvoice = () => {
    if (project) {
      setShowInvoiceModal(true);
    }
  };

  if (loading) {
    return <SkeletonDetail />;
  }

  if (error || !project) {
    return (
      <EmptyState
        icon={FileText}
        title={error || 'Proyek tidak ditemukan'}
        action={
          <Link to="/projects">
            <Button variant="secondary">
              <ArrowLeft className="h-4 w-4" />
              Kembali ke Daftar Proyek
            </Button>
          </Link>
        }
      />
    );
  }

  const progress = calculateProjectProgress(project);
  const daysLeft = calculateDaysLeft(project.endDate);
  const totalValue = project.value * (1 + project.taxRate / 100);
  const income = transactions.filter((t) => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
  const expense = transactions.filter((t) => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  const balance = income - expense;
  const isAdmin = currentUser && currentUser.role === 'admin';

  return (
    <div className="animate-fade-in">
      {/* Navigasi kembali — hanya untuk pengguna internal (tamu share-link tak punya daftar) */}
      {currentUser && (
        <Link
          to="/projects"
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-brand-600"
        >
          <ArrowLeft className="h-4 w-4" />
          Daftar Proyek
        </Link>
      )}

      {/* Header proyek */}
      <div className="mb-5 flex flex-col gap-3 sm:mb-6 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <h1 className="font-display text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
              {project.name}
            </h1>
            <StatusBadge status={project.status} />
          </div>
          <p className="mt-0.5 text-sm text-slate-500 sm:mt-1">{project.partner}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={copyProjectLink}>
            <Link2 className="h-4 w-4" />
            Salin Link
          </Button>
          <Button variant="success" size="sm" onClick={handleShareWhatsApp} loading={sharingWa}>
            {!sharingWa && <WhatsAppIcon />}
            {sharingWa ? 'Menyiapkan…' : 'WhatsApp'}
          </Button>
          {/* Export PDF & Invoice hanya untuk pengguna internal, bukan tamu share-link */}
          {currentUser && (
            <Button variant="secondary" size="sm" onClick={handleExportPDF}>
              <FileDown className="h-4 w-4" />
              Export PDF
            </Button>
          )}
          {isAdmin && (
            <Button variant="primary" size="sm" onClick={handleGenerateInvoice}>
              <FileSignature className="h-4 w-4" />
              Invoice
            </Button>
          )}
        </div>
      </div>

      {/* Kartu info */}
      <div className="mb-5 grid grid-cols-1 gap-4 sm:mb-6 lg:grid-cols-3">
        <Card className="p-4 sm:p-5">
          <h3 className="mb-3 font-display text-xs font-semibold uppercase tracking-wide text-slate-400">
            Informasi Proyek
          </h3>
          <dl className="space-y-2.5 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-500">Mulai</dt>
              <dd className="flex items-center gap-1.5 font-medium text-slate-700">
                <CalendarDays className="h-3.5 w-3.5 text-slate-400" />
                {formatDate(project.startDate)}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-500">Selesai</dt>
              <dd className="flex items-center gap-1.5 font-medium text-slate-700">
                <CalendarDays className="h-3.5 w-3.5 text-slate-400" />
                {formatDate(project.endDate)}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-500">No. SPK/MOU</dt>
              <dd className="font-medium text-slate-700">{project.contractNumber || '—'}</dd>
            </div>
            {project.description && (
              <div className="border-t border-slate-100 pt-2.5">
                <dt className="mb-1 text-slate-500">Deskripsi</dt>
                <dd className="leading-relaxed text-slate-600">{project.description}</dd>
              </div>
            )}
          </dl>
        </Card>

        <Card className="p-4 sm:p-5">
          <h3 className="mb-3 font-display text-xs font-semibold uppercase tracking-wide text-slate-400">
            Nilai & Pembayaran
          </h3>
          <dl className="space-y-2.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Nilai Kontrak</dt>
              <dd className="font-semibold text-slate-800">{formatCurrency(project.value)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Pajak ({project.taxRate}%)</dt>
              <dd className="text-slate-600">
                {formatCurrency((project.value * project.taxRate) / 100)}
              </dd>
            </div>
            <div className="flex justify-between border-t border-slate-100 pt-2.5">
              <dt className="font-medium text-slate-600">Total + Pajak</dt>
              <dd className="font-display font-bold text-slate-900">{formatCurrency(totalValue)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Terbayar</dt>
              <dd className="font-semibold text-emerald-600">
                {formatCurrency(project.paidAmount || 0)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Sisa Tagihan</dt>
              {project.value - (project.paidAmount || 0) <= 0 ? (
                <dd className="font-semibold text-emerald-600">Lunas</dd>
              ) : (
                <dd className="font-semibold text-red-600">
                  {formatCurrency(project.value - (project.paidAmount || 0))}
                </dd>
              )}
            </div>
          </dl>
        </Card>

        <Card className="p-4 sm:p-5">
          <h3 className="mb-3 font-display text-xs font-semibold uppercase tracking-wide text-slate-400">
            Progress
          </h3>
          <div className="mb-2 flex items-end justify-between">
            <span className="font-display text-3xl font-bold text-slate-900">{progress}%</span>
            {project.status === 'ongoing' && daysLeft > 0 && (
              <span className="text-xs text-slate-400">Sisa {daysLeft} hari</span>
            )}
            {project.status === 'ongoing' && daysLeft === 0 && (
              <span className="text-xs font-semibold text-red-600">Deadline hari ini!</span>
            )}
            {project.status === 'ongoing' && daysLeft < 0 && (
              <span className="text-xs font-semibold text-red-600">
                Terlambat {Math.abs(daysLeft)} hari
              </span>
            )}
          </div>
          <ProgressBar value={progress} className="h-2.5" />
          <p className="mt-3 text-xs leading-relaxed text-slate-400">
            Progress dihitung dari pembayaran yang diterima terhadap nilai kontrak.
          </p>
        </Card>
      </div>

      {/* Ringkasan & tabel transaksi — tersembunyi untuk pengunjung share-link */}
      {txnRestricted ? (
        <Card className="p-6 text-center">
          <p className="text-sm font-medium text-slate-600">
            Transaksi proyek hanya terlihat setelah login.
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Anda melihat halaman ini melalui link berbagi — informasi proyek dan progres tetap
            tersedia di atas.
          </p>
        </Card>
      ) : (
        <>
      <div className="mb-5 grid grid-cols-1 gap-3 sm:mb-6 sm:gap-4 md:grid-cols-3">
        <SummaryTile
          icon={ArrowDownRight}
          label="Total Pemasukan"
          value={formatCurrency(income)}
          tone={{
            wrap: 'border-emerald-100 bg-emerald-50/60',
            icon: 'bg-emerald-100 text-emerald-600',
            label: 'text-emerald-700',
            value: 'text-emerald-800'
          }}
        />
        <SummaryTile
          icon={ArrowUpRight}
          label="Total Pengeluaran"
          value={formatCurrency(expense)}
          tone={{
            wrap: 'border-red-100 bg-red-50/60',
            icon: 'bg-red-100 text-red-600',
            label: 'text-red-700',
            value: 'text-red-800'
          }}
        />
        <SummaryTile
          icon={Scale}
          label="Saldo"
          value={formatCurrency(balance)}
          tone={{
            wrap: 'border-brand-100 bg-brand-50/60',
            icon: 'bg-brand-100 text-brand-600',
            label: 'text-brand-700',
            value: 'text-brand-800'
          }}
        />
      </div>

      {/* Tabel transaksi */}
      <Card>
        <CardHeader
          title="Transaksi Proyek"
          action={
            isAdmin && (
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => setShowAIModal(true)}>
                  <Sparkles className="h-4 w-4 text-violet-500" />
                  Input AI
                </Button>
                <Button size="sm" onClick={() => setShowTransactionModal(true)}>
                  <Plus className="h-4 w-4" />
                  Transaksi Manual
                </Button>
              </div>
            )
          }
        />
        <TransactionTable
          transactions={transactions}
          onEdit={isAdmin ? handleEditTransaction : null}
          onDelete={isAdmin ? handleDeleteTransaction : null}
          showProject={false}
        />
      </Card>
        </>
      )}

      {showTransactionModal && (
        <TransactionModal
          isOpen={showTransactionModal}
          onClose={handleModalClose}
          onSuccess={handleModalSuccess}
          transaction={editingTransaction}
          projectId={project.id}
          projects={[project]}
          currentUser={currentUser}
        />
      )}

      {showAIModal && (
        <AITransactionModal
          isOpen={showAIModal}
          onClose={handleModalClose}
          onSuccess={handleModalSuccess}
          projects={[project]}
          currentUser={currentUser}
        />
      )}

      {showInvoiceModal && (
        <InvoiceModal
          isOpen={showInvoiceModal}
          onClose={() => setShowInvoiceModal(false)}
          project={project}
        />
      )}
    </div>
  );
};

export default ProjectDetail;
