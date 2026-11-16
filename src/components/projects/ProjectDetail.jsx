// src/components/projects/ProjectDetail.jsx
// Detail proyek ala ERP: kartu info ringkas, tabel transaksi dengan
// rekap per kategori (sort + cari), panel arsip berkas proyek & invoice,
// serta reminder retensi dihitung dari BA terakhir.
import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import {
  ArrowLeft,
  Link2,
  FileDown,
  FileText,
  Sparkles,
  Plus,
  CalendarDays,
  FileSignature,
  FolderArchive,
  Timer,
  ExternalLink
} from 'lucide-react';
import { db } from '../../services/firebase';
import { getTransactionsByProject, deleteTransaction } from '../../services/transactions';
import { getAllInvoices, INVOICE_DOC_LABELS } from '../../services/invoices';
import TransactionModal from '../transactions/TransactionModal';
import AITransactionModal from '../transactions/AITransactionModal';
import TransactionTable from '../transactions/TransactionTable';
import InvoiceModal from '../invoices/InvoiceModal';
import { formatCurrency, formatDate, calculateProjectProgress, calculateDaysLeft } from '../../utils/formatters';
import { buildProjectWhatsAppMessage } from '../../utils/sharing';
import { generateProjectSummaryImage } from '../../utils/projectImage';
import { generateProjectPDF } from '../../utils/pdfGenerator';
import { getCompanySettings, mergeCompanyInfo } from '../../services/settings';
import Button from '../ui/Button';
import { Card, CardHeader } from '../ui/Card';
import { StatusBadge } from '../ui/Badge';
import ProgressBar from '../ui/ProgressBar';
import { SkeletonDetail } from '../ui/Skeleton';
import EmptyState from '../ui/EmptyState';
import { Input, Select } from '../ui/Field';
import FileViewer from '../ui/FileViewer';
import TransactionFilterBar from './TransactionFilterBar';
import ShareProjectModal from './ShareProjectModal';
import ProjectPlanningPanel from './ProjectPlanningPanel';
import ProjectUnitsPanel from './ProjectUnitsPanel';

// Masa retensi standar sejak BA terakhir, sebelum penagihan garansi retensi (bulan).
const RETENTION_MONTHS = 3;

const WhatsAppIcon = ({ className = 'h-4 w-4' }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
  </svg>
);

const MetaRow = ({ label, value, icon: Icon }) => (
  <div className="flex items-baseline justify-between gap-3 py-1.5">
    <span className="shrink-0 text-xs font-medium uppercase tracking-wide text-slate-400">{label}</span>
    <span className="flex min-w-0 items-center gap-1.5 truncate text-[13px] font-semibold text-slate-800">
      {Icon && <Icon className="h-3.5 w-3.5 shrink-0 text-slate-400" />}
      <span className="truncate">{value || '—'}</span>
    </span>
  </div>
);

const ProjectDetail = ({ currentUser }) => {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [txnRestricted, setTxnRestricted] = useState(false);
  const [viewerFile, setViewerFile] = useState(null);

  // Kontrol tabel transaksi
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('date');
  const [catFilter, setCatFilter] = useState('all');

  // Semua useMemo WAJIB di atas early return: kalau hook dipanggil setelah
  // `if (loading) return`, jumlah hook berubah antar render dan React
  // melempar error #310 (Rendered more hooks than during the previous render).
  const categories = useMemo(() => {
    const map = {};
    transactions.forEach((t) => {
      const k = t.category || 'Lainnya';
      if (!map[k]) map[k] = { category: k, income: 0, expense: 0, count: 0 };
      map[k][t.type === 'income' ? 'income' : 'expense'] += Number(t.amount) || 0;
      map[k].count++;
    });
    return Object.values(map).sort((a, b) => b.income + b.expense - (a.income + a.expense));
  }, [transactions]);

  const filteredTxns = useMemo(() => {
    let list = transactions;
    if (catFilter !== 'all') list = list.filter((t) => (t.category || 'Lainnya') === catFilter);
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(
        (t) =>
          (t.description || '').toLowerCase().includes(s) ||
          (t.category || '').toLowerCase().includes(s)
      );
    }
    const sorted = [...list];
    sorted.sort((a, b) => {
      if (sortBy === 'category') return (a.category || '').localeCompare(b.category || '');
      if (sortBy === 'amount') return (Number(b.amount) || 0) - (Number(a.amount) || 0);
      return String(b.date || '').localeCompare(String(a.date || '')); // default: terbaru
    });
    return sorted;
  }, [transactions, search, sortBy, catFilter]);

  // Reminder retensi: dihitung dari tanggal BA terakhir (sinkron dengan invoice).
  const retentionInfo = useMemo(() => {
    const lastBA = invoices
      .map((i) => i.issueDate)
      .filter(Boolean)
      .sort()
      .pop();
    if (!lastBA) return null;
    const baDate = new Date(lastBA);
    if (isNaN(baDate.getTime())) return null;
    const due = new Date(baDate);
    due.setMonth(due.getMonth() + RETENTION_MONTHS);
    const today = new Date();
    const diffDays = Math.ceil((due - today) / 86400000);
    return { baDate: lastBA, dueDate: due, diffDays };
  }, [invoices]);

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

        try {
          const transactionData = await getTransactionsByProject(id);
          setTransactions(transactionData);
          setTxnRestricted(false);
        } catch (txnErr) {
          console.warn('Transaksi tidak dapat diakses (butuh login):', txnErr?.code || txnErr);
          setTransactions([]);
          setTxnRestricted(true);
        }

        // Invoice proyek — untuk arsip berkas & reminder retensi.
        getAllInvoices()
          .then((all) => setInvoices(all.filter((i) => i.projectId === id || i.projectId === projectData.name)))
          .catch(() => setInvoices([]));
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
  const [shareData, setShareData] = useState(null);

  // Siapkan gambar + teks, lalu TAMPILKAN pratinjaunya. Tidak lagi mengunduh
  // diam-diam: pengguna melihat lebih dulu apa yang akan dikirim.
  const handleShareWhatsApp = async () => {
    if (!project || sharingWa) return;
    setSharingWa(true);
    try {
      const settings = await getCompanySettings().catch(() => null);
      const company = mergeCompanyInfo(settings);
      const image = await generateProjectSummaryImage(project, transactions, company).catch(() => null);
      setShareData({
        imageBlob: image || null,
        message: buildProjectWhatsAppMessage(project, transactions, company),
        imageName: `Proyek_${(project.name || 'kontrack').replace(/[^a-z0-9]/gi, '_')}.png`
      });
    } catch (err) {
      console.error('Gagal menyiapkan bagikan WhatsApp:', err);
      setShareData({ imageBlob: null, message: '', imageName: '' });
    } finally {
      setSharingWa(false);
    }
  };

  const copyProjectLink = () => {
    const link = `${window.location.origin}/app/projects/${project.id}`;
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

  if (loading) {
    return <SkeletonDetail />;
  }

  if (error || !project) {
    return (
      <EmptyState
        icon={FileText}
        title={error || 'Proyek tidak ditemukan'}
        action={
          <Link to="/app/projects">
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
  const paidAmount = project.paidAmount || 0;
  const isAdmin = currentUser && currentUser.role === 'admin';

  // --- Arsip berkas: dokumen proyek + dokumen tiap invoice ---
  const projectDocs = project.documents || {};
  const invoiceDocEntries = invoices.flatMap((inv) =>
    Object.entries(inv.documents || {}).map(([kind, d]) => ({
      label: `${INVOICE_DOC_LABELS[kind] || kind} · ${inv.invoiceNumber || ''}`,
      url: d.url,
      inv: inv.invoiceNumber
    }))
  );

  return (
    <div className="animate-fade-in">
      {currentUser && (
        <Link
          to="/app/projects"
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-brand-700"
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
          <Button variant="success" size="sm" onClick={handleShareWhatsApp} loading={sharingWa} title="Pratinjau lalu bagikan ringkasan proyek ke WhatsApp">
            {!sharingWa && <WhatsAppIcon />}
            {sharingWa ? 'Menyiapkan…' : 'Bagikan Ringkasan'}
          </Button>
          {currentUser && (
            <Button variant="secondary" size="sm" onClick={handleExportPDF}>
              <FileDown className="h-4 w-4" />
              Export PDF
            </Button>
          )}
          {isAdmin && (
            <Button variant="primary" size="sm" onClick={() => setShowInvoiceModal(true)}>
              <FileSignature className="h-4 w-4" />
              Invoice
            </Button>
          )}
        </div>
      </div>

      {/* Baris kartu: Informasi | Nilai & Pembayaran | Progress */}
      <div className="mb-5 grid grid-cols-1 gap-4 sm:mb-6 lg:grid-cols-3">
        <Card className="p-4 sm:p-5">
          <h3 className="mb-2 font-display text-xs font-semibold uppercase tracking-wide text-slate-400">
            Informasi Proyek
          </h3>
          <div className="divide-y divide-slate-100 dark:divide-white/5">
            <MetaRow label="Mulai" value={formatDate(project.startDate)} icon={CalendarDays} />
            <MetaRow label="Selesai" value={formatDate(project.endDate)} icon={CalendarDays} />
            <MetaRow label="No. SPK / Kontrak" value={project.contractNumber} />
            <MetaRow label="No. PK" value={project.pkNumber} />
            {project.description && (
              <div className="pt-2">
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">Deskripsi</p>
                <p className="text-[13px] leading-relaxed text-slate-600">{project.description}</p>
              </div>
            )}
          </div>
        </Card>

        <Card className="p-4 sm:p-5">
          <h3 className="mb-2 font-display text-xs font-semibold uppercase tracking-wide text-slate-400">
            Nilai &amp; Pembayaran
          </h3>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Nilai Kontrak</span>
            <span className="tnum font-display text-lg font-bold text-slate-900">
              {formatCurrency(project.value)}
            </span>
          </div>
          <div className="mt-1 flex items-baseline justify-between gap-3 text-[13px] text-slate-500">
            <span>Total + pajak ({project.taxRate}%)</span>
            <span className="tnum font-medium text-slate-700">{formatCurrency(totalValue)}</span>
          </div>
          <div className="mt-3 border-t border-slate-100 pt-3 dark:border-white/5">
            <ProgressBar value={project.value > 0 ? Math.min(100, (paidAmount / project.value) * 100) : 0} className="h-2" />
            {/* flex-wrap: nominal bisa membesar (miliaran), dan pada 390px dua
                kolom berbagi satu baris akan bertabrakan tanpa ini. */}
            <div className="mt-1.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-[13px]">
              <span className="text-emerald-600">
                Terbayar <span className="tnum font-semibold">{formatCurrency(paidAmount)}</span>
              </span>
              <span className={paidAmount >= project.value ? 'font-semibold text-emerald-600' : 'font-semibold text-red-600'}>
                {project.value - paidAmount <= 0 ? 'Lunas' : `Sisa ${formatCurrency(project.value - paidAmount)}`}
              </span>
            </div>
          </div>
        </Card>

        <Card className="p-4 sm:p-5">
          <h3 className="mb-2 font-display text-xs font-semibold uppercase tracking-wide text-slate-400">
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
              <span className="text-xs font-semibold text-red-600">Terlambat {Math.abs(daysLeft)} hari</span>
            )}
          </div>
          <ProgressBar value={progress} className="h-2.5" />
          <p className="mt-3 text-xs leading-relaxed text-slate-400">
            Progress dihitung dari pembayaran yang diterima terhadap nilai kontrak.
          </p>
        </Card>
      </div>

      {/* Reminder retensi */}
      {retentionInfo && (
        <div
          className={`mb-5 flex flex-wrap items-center gap-2 rounded-[10px] border px-4 py-3 text-sm ${
            retentionInfo.diffDays > 30
              ? 'border-slate-200 bg-slate-50/60 text-slate-600 dark:border-white/10 dark:bg-white/[0.03]'
              : retentionInfo.diffDays > 0
                ? 'border-amber-200 bg-amber-50/70 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300'
                : 'border-emerald-200 bg-emerald-50/70 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300'
          }`}
        >
          <Timer className="h-4 w-4 shrink-0" />
          {retentionInfo.diffDays > 0 ? (
            <span>
              Masa retensi berakhir <strong>{formatDate(retentionInfo.dueDate)}</strong> ({retentionInfo.diffDays} hari lagi)
              — penagihan garansi retensi bisa dilakukan setelah itu. BA terakhir: {formatDate(retentionInfo.baDate)}.
            </span>
          ) : (
            <span>
              Masa retensi sudah lewat sejak <strong>{formatDate(retentionInfo.dueDate)}</strong> — penagihan garansi retensi siap dilakukan.
            </span>
          )}
        </div>
      )}

      {/* Arsip berkas proyek & invoice */}
      {(Object.keys(projectDocs).length > 0 || invoiceDocEntries.length > 0) && (
        <Card className="mb-5 p-4 sm:p-5">
          <h3 className="mb-3 flex items-center gap-1.5 font-display text-xs font-semibold uppercase tracking-wide text-slate-400">
            <FolderArchive className="h-4 w-4" />
            Arsip Berkas
          </h3>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(projectDocs).map(([kind, d]) => (
              <button
                key={`p-${kind}`}
                type="button"
                onClick={() => setViewerFile({ url: d.url, name: d.name || `${INVOICE_DOC_LABELS[kind] || kind}.pdf` })}
                className="flex items-center justify-between gap-2 rounded-lg border border-slate-200/80 px-3 py-2 text-left text-[13px] transition-colors hover:border-brand-300 dark:border-white/10"
              >
                <span className="truncate">
                  <span className="font-medium text-slate-800">{INVOICE_DOC_LABELS[kind] || kind}</span>
                  <span className="ml-1.5 text-xs text-slate-400">· proyek</span>
                </span>
                <ExternalLink className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              </button>
            ))}
            {invoiceDocEntries.map((d, i) => (
              <button
                key={`i-${i}`}
                type="button"
                onClick={() => setViewerFile({ url: d.url, name: d.name || `${d.label}.pdf` })}
                className="flex items-center justify-between gap-2 rounded-lg border border-slate-200/80 px-3 py-2 text-left text-[13px] transition-colors hover:border-brand-300 dark:border-white/10"
              >
                <span className="truncate">
                  <span className="font-medium text-slate-800">{d.label}</span>
                </span>
                <ExternalLink className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              </button>
            ))}
          </div>
        </Card>
      )}

      {txnRestricted ? (
        <Card className="p-6 text-center">
          <p className="text-sm font-medium text-slate-600">Transaksi proyek hanya terlihat setelah login.</p>
          <p className="mt-1 text-xs text-slate-400">
            Anda melihat halaman ini melalui link berbagi — informasi proyek dan progres tetap tersedia di atas.
          </p>
        </Card>
      ) : (
        <>
      {/* Rekap per kategori */}
      {categories.length > 0 && (
        <Card className="mb-5 p-4 sm:p-5">
          <h3 className="mb-3 font-display text-xs font-semibold uppercase tracking-wide text-slate-400">
            Rekap per Kategori
          </h3>
          <div className="grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((c) => (
              <div key={c.category} className="flex items-baseline justify-between gap-3 border-b border-slate-100 pb-1.5 text-[13px] last:border-0 dark:border-white/5">
                <span className="truncate font-medium text-slate-700">
                  {c.category}
                  <span className="ml-1.5 text-[11px] text-slate-400">({c.count})</span>
                </span>
                <span className="tnum shrink-0 text-right">
                  {c.income > 0 && <span className="font-semibold text-emerald-600">+{formatCurrency(c.income)}</span>}
                  {c.expense > 0 && (
                    <span className={c.income > 0 ? 'ml-2 text-slate-500' : 'font-semibold text-red-600'}>
                      −{formatCurrency(c.expense)}
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Perencanaan: anggaran, termin, retensi, margin */}
      <div className="mb-5">
        <ProjectUnitsPanel project={project} />
        <ProjectPlanningPanel project={project} transactions={transactions} invoices={invoices} />
      </div>

      {/* Tabel transaksi: cari, urut, filter kategori */}
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
        <TransactionFilterBar
          search={search}
          onSearch={setSearch}
          category={catFilter}
          onCategory={setCatFilter}
          categories={categories.map((c) => c.category)}
          sortBy={sortBy}
          onSortBy={setSortBy}
          shown={filteredTxns.length}
          total={transactions.length}
        />
        <TransactionTable
          transactions={filteredTxns}
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

      {/* Penampil berkas: gambar & PDF dibuka di tempat, bukan diunduh dulu. */}
      <FileViewer file={viewerFile} onClose={() => setViewerFile(null)} />

      <ShareProjectModal
        open={Boolean(shareData)}
        onClose={() => setShareData(null)}
        project={project}
        message={shareData?.message || ''}
        imageBlob={shareData?.imageBlob || null}
        imageName={shareData?.imageName || 'ringkasan-proyek.png'}
      />
    </div>
  );
};

export default ProjectDetail;
