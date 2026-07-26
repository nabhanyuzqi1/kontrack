// src/components/dashboard/Dashboard.jsx
import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { FolderKanban, Wallet, CircleCheckBig, TrendingUp, Plus, Sparkles, PenLine } from 'lucide-react';
import { db } from '../../services/firebase';
import ProjectModal from '../projects/ProjectModal';
import TransactionModal from '../transactions/TransactionModal';
import AITransactionModal from '../transactions/AITransactionModal';
import CashflowChart from './CashflowChart';
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
  const [allTransactions, setAllTransactions] = useState([]); // untuk grafik arus kas
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
      const projectsQuery = query(collection(db, 'projects'), orderBy('createdAt', 'desc'), limit(5));
      const projectSnapshot = await getDocs(projectsQuery);
      const projectList = [];
      projectSnapshot.forEach((doc) => {
        projectList.push({ id: doc.id, ...doc.data() });
      });
      setProjects(projectList);

      const transQuery = query(collection(db, 'transactions'), orderBy('date', 'desc'), limit(10));
      const transSnapshot = await getDocs(transQuery);
      const transList = [];
      transSnapshot.forEach((doc) => {
        transList.push({ id: doc.id, ...doc.data() });
      });
      setTransactions(transList);

      await calculateStats();
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = async () => {
    try {
      const allProjectsSnapshot = await getDocs(collection(db, 'projects'));
      const allProjects = [];
      allProjectsSnapshot.forEach((doc) => {
        allProjects.push({ id: doc.id, ...doc.data() });
      });

      const allTransSnapshot = await getDocs(collection(db, 'transactions'));
      const allTrans = [];
      allTransSnapshot.forEach((doc) => {
        allTrans.push({ id: doc.id, ...doc.data() });
      });
      setAllTransactions(allTrans);

      const totalProjects = allProjects.length;
      const ongoingProjects = allProjects.filter((p) => p.status === 'ongoing').length;
      const totalValue = allProjects.reduce((sum, p) => sum + (p.value || 0), 0);
      const totalPaid = allProjects.reduce((sum, p) => sum + (p.paidAmount || 0), 0);

      const totalIncome = allTrans
        .filter((t) => t.type === 'income')
        .reduce((sum, t) => sum + (t.amount || 0), 0);

      const totalExpense = allTrans
        .filter((t) => t.type === 'expense')
        .reduce((sum, t) => sum + (t.amount || 0), 0);

      setStats({
        totalProjects,
        ongoingProjects,
        totalValue,
        totalPaid,
        totalExpense,
        totalProfit: totalIncome - totalExpense
      });
    } catch (error) {
      console.error('Error calculating stats:', error);
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
