// src/components/dashboard/Dashboard.jsx
import React, { useState, useEffect } from 'react';
import { FolderKanban, Wallet, CircleCheckBig, TrendingUp, Plus, Sparkles, PenLine } from 'lucide-react';
import ProjectModal from '../projects/ProjectModal';
import TransactionModal from '../transactions/TransactionModal';
import AITransactionModal from '../transactions/AITransactionModal';
import CashflowChart from './CashflowChart';
import AIInsightCard from '../ai/AIInsightCard';
import { getAllInvoices } from '../../services/invoices';
import { getAllProjects } from '../../services/projects';
import { getAllTransactions } from '../../services/transactions';
import ProjectReminders from './ProjectReminders';
import RecentProjects from './RecentProjects';
import RecentTransactions from './RecentTransactions';
import PageHeader from '../ui/PageHeader';
import StatCard from '../ui/StatCard';
import { SkeletonListPage } from '../ui/Skeleton';
import { formatCurrency } from '../../utils/formatters';

const QuickAction = ({ icon: Icon, title, description, onClick, tone }) => (
  <button
    onClick={onClick}
    className="group flex items-center gap-4 rounded-xl border border-slate-200/70 bg-white p-4 text-left shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-card-hover"
  >
    <div className={`rounded-xl p-3 transition-colors ${tone}`}>
      <Icon className="h-5 w-5" />
    </div>
    <div className="min-w-0">
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      <p className="mt-0.5 truncate text-xs text-slate-400">{description}</p>
    </div>
  </button>
);

const Dashboard = ({ currentUser }) => {
  const [projects, setProjects] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [allTransactions, setAllTransactions] = useState([]); // grafik arus kas & analisis AI
  const [allProjects, setAllProjects] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [stats, setStats] = useState({
    totalProjects: 0,
    ongoingProjects: 0,
    totalValue: 0,
    totalPaid: 0,
    totalExpense: 0,
    totalProfit: 0
  });

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      // Sebelumnya halaman ini memanggil getDocs mentah lima kali secara
      // BERURUTAN, tanpa cache dan tanpa batas waktu. Dua di antaranya (5 proyek
      // terbaru, 10 transaksi terbaru) hanya potongan dari koleksi yang toh
      // diambil seluruhnya di query berikutnya — jadi murni query mubazir.
      //
      // Kini: tiga service ber-cache, paralel, masing-masing dijaga batas waktu
      // di services/cache.js. Daftar "terbaru" cukup diiris dari data yang sama.
      const [projectList, transactionList, invoiceList] = await Promise.all([
        getAllProjects(),
        getAllTransactions(),
        getAllInvoices().catch(() => [])
      ]);

      setAllProjects(projectList);
      setAllTransactions(transactionList);
      setInvoices(invoiceList);

      const byNewest = (field) => (a, b) =>
        String(b?.[field] || '').localeCompare(String(a?.[field] || ''));

      setProjects([...projectList].sort(byNewest('createdAt')).slice(0, 5));
      setTransactions([...transactionList].sort(byNewest('date')).slice(0, 10));

      const totalValue = projectList.reduce((sum, p) => sum + (p.value || 0), 0);
      const totalPaid = projectList.reduce((sum, p) => sum + (p.paidAmount || 0), 0);
      const totalIncome = transactionList
        .filter((t) => t.type === 'income')
        .reduce((sum, t) => sum + (t.amount || 0), 0);
      const totalExpense = transactionList
        .filter((t) => t.type === 'expense')
        .reduce((sum, t) => sum + (t.amount || 0), 0);

      setStats({
        totalProjects: projectList.length,
        ongoingProjects: projectList.filter((p) => p.status === 'ongoing').length,
        totalValue,
        totalPaid,
        totalExpense,
        totalProfit: totalIncome - totalExpense
      });
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <SkeletonListPage variant="cards" stats={4} />;
  }

  const paidPct = stats.totalValue > 0 ? Math.round((stats.totalPaid / stats.totalValue) * 100) : 0;
  const marginPct = stats.totalPaid > 0 ? Math.round((stats.totalProfit / stats.totalPaid) * 100) : 0;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Dashboard"
        subtitle={`Selamat datang kembali, ${currentUser.name || currentUser.email}`}
      />

      {/* Kartu statistik */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:mb-8 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        <StatCard
          icon={FolderKanban}
          tone="brand"
          label="Total Proyek"
          value={stats.totalProjects}
          sub={`${stats.ongoingProjects} sedang berjalan`}
          subTone="text-brand-600"
        />
        <StatCard
          icon={Wallet}
          tone="cyan"
          label="Total Nilai Proyek"
          value={formatCurrency(stats.totalValue)}
          sub="Nilai kontrak keseluruhan"
        />
        <StatCard
          icon={CircleCheckBig}
          tone="emerald"
          label="Total Terbayar"
          value={formatCurrency(stats.totalPaid)}
          sub={`${paidPct}% dari total nilai`}
          subTone="text-emerald-600"
        />
        <StatCard
          icon={TrendingUp}
          tone="violet"
          label="Keuntungan"
          value={formatCurrency(stats.totalProfit)}
          sub={`Margin ${marginPct}%`}
          subTone={stats.totalProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}
        />
      </div>

      {/* Aksi cepat */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:mb-8 sm:gap-4 md:grid-cols-3">
        <QuickAction
          icon={Plus}
          tone="bg-brand-50 text-brand-600 group-hover:bg-brand-600 group-hover:text-white"
          title="Proyek Baru"
          description="Tambah proyek atau kontrak baru"
          onClick={() => setShowProjectModal(true)}
        />
        <QuickAction
          icon={Sparkles}
          tone="bg-violet-50 text-violet-600 group-hover:bg-violet-600 group-hover:text-white"
          title="Input dengan AI"
          description="Upload screenshot bukti transaksi"
          onClick={() => setShowAIModal(true)}
        />
        <QuickAction
          icon={PenLine}
          tone="bg-cyan-50 text-cyan-600 group-hover:bg-cyan-600 group-hover:text-white"
          title="Input Manual"
          description="Catat transaksi secara manual"
          onClick={() => setShowTransactionModal(true)}
        />
      </div>

      {/* Yang perlu ditindaklanjuti lebih dulu, baru gambaran & riwayat */}
      <ProjectReminders projects={projects} />

      <AIInsightCard
        projects={allProjects}
        transactions={allTransactions}
        invoices={invoices}
        period="keseluruhan"
        className="mb-6"
      />

      <CashflowChart transactions={allTransactions} />
      <RecentProjects projects={projects} />
      <RecentTransactions transactions={transactions} />

      {showProjectModal && (
        <ProjectModal
          isOpen={showProjectModal}
          onClose={() => setShowProjectModal(false)}
          onSuccess={() => {
            setShowProjectModal(false);
            loadDashboardData();
          }}
          currentUser={currentUser}
        />
      )}

      {showTransactionModal && (
        <TransactionModal
          isOpen={showTransactionModal}
          onClose={() => setShowTransactionModal(false)}
          onSuccess={() => {
            setShowTransactionModal(false);
            loadDashboardData();
          }}
          projects={projects}
          currentUser={currentUser}
        />
      )}

      {showAIModal && (
        <AITransactionModal
          isOpen={showAIModal}
          onClose={() => setShowAIModal(false)}
          onSuccess={() => {
            setShowAIModal(false);
            loadDashboardData();
          }}
          projects={projects}
          currentUser={currentUser}
        />
      )}
    </div>
  );
};

export default Dashboard;
