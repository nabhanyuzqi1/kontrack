import React, { useState } from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import { LayoutDashboard, FolderKanban, ReceiptText, Landmark, Users, BarChart3, Settings, LogOut, LogIn, Menu, X } from 'lucide-react';
import { signOutUser } from '../../services/auth';
import Logo, { LogoMark } from '../brand/Logo';

const navItems = (isAdmin) => [
  ...(isAdmin ? [{ to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true }] : []),
  { to: '/projects', label: 'Proyek', icon: FolderKanban },
  ...(isAdmin
    ? [
        { to: '/invoices', label: 'Invoice', icon: ReceiptText },
        { to: '/tax-invoices', label: 'Faktur Pajak', icon: Landmark },
        { to: '/clients', label: 'Klien', icon: Users }
      ]
    : []),
  { to: '/reports', label: 'Laporan', icon: BarChart3 },
  ...(isAdmin ? [{ to: '/settings', label: 'Pengaturan', icon: Settings }] : [])
];

const NavItem = ({ to, label, icon: Icon, end, onClick }) => (
  <NavLink
    to={to}
    end={end}
    onClick={onClick}
    className={({ isActive }) =>
      `group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
        isActive
          ? 'bg-brand-gradient text-white shadow-glow'
          : 'text-slate-400 hover:bg-white/5 hover:text-white'
      }`
    }
  >
    <Icon className="h-[18px] w-[18px] shrink-0" />
    {label}
  </NavLink>
);

const UserSection = ({ currentUser, onSignOut }) => {
  if (!currentUser) {
    return (
      <Link
        to="/login"
        className="flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm font-medium text-slate-200 transition-colors hover:border-brand-500/50 hover:bg-brand-600/20 hover:text-white"
      >
        <LogIn className="h-4 w-4" />
        Masuk
      </Link>
    );
  }

  const initial = (currentUser.name || currentUser.email || '?').charAt(0).toUpperCase();

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-gradient font-display text-sm font-bold text-white">
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-white">
            {currentUser.name || currentUser.email}
          </p>
          <p className="text-xs text-slate-400">
            {currentUser.role === 'admin' ? 'Administrator' : 'Anggota'}
          </p>
        </div>
        <button
          onClick={onSignOut}
          title="Keluar"
          className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-500/15 hover:text-red-400"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

const SidebarContent = ({ currentUser, onSignOut, onNavigate }) => {
  const isAdmin = currentUser?.role === 'admin';
  return (
    <div className="flex h-full flex-col">
      <div className="px-5 pb-6 pt-6">
        <Link to={isAdmin ? '/' : '/projects'} onClick={onNavigate}>
          <Logo dark />
        </Link>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {navItems(isAdmin).map((item) => (
          <NavItem key={item.to} {...item} onClick={onNavigate} />
        ))}
      </nav>

      <div className="px-3 pb-3">
        <div className="mb-3 rounded-xl bg-gradient-to-br from-brand-600/20 to-accent-500/10 p-3.5 ring-1 ring-inset ring-brand-500/20">
          <p className="font-display text-xs font-semibold text-brand-300">KONTRACK PLATFORM</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">
            Manajemen proyek & keuangan kontraktor dalam satu tempat.
          </p>
        </div>
        <UserSection currentUser={currentUser} onSignOut={onSignOut} />
      </div>
    </div>
  );
};

const AppLayout = ({ currentUser, children }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();

  const handleSignOut = async () => {
    try {
      await signOutUser();
      navigate('/projects');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Sidebar desktop */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 bg-navy-900 lg:block">
        <SidebarContent currentUser={currentUser} onSignOut={handleSignOut} />
      </aside>

      {/* Topbar mobile */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-white/10 bg-navy-900 px-4 lg:hidden">
        <Link to="/projects" className="flex items-center gap-2">
          <LogoMark className="h-7 w-7" />
          <span className="font-display text-lg font-bold text-white">Kontrack</span>
        </Link>
        <button
          onClick={() => setMobileOpen(true)}
          className="rounded-lg p-2 text-slate-300 hover:bg-white/10"
          aria-label="Buka menu"
        >
          <Menu className="h-5 w-5" />
        </button>
      </header>

      {/* Drawer mobile */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-navy-950/70 backdrop-blur-sm animate-fade-in"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-72 bg-navy-900 shadow-2xl animate-slide-up">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-4 rounded-lg p-2 text-slate-400 hover:bg-white/10"
              aria-label="Tutup menu"
            >
              <X className="h-5 w-5" />
            </button>
            <SidebarContent
              currentUser={currentUser}
              onSignOut={handleSignOut}
              onNavigate={() => setMobileOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Konten utama */}
      <main className="lg:pl-64">
        <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8">{children}</div>
      </main>
    </div>
  );
};

export default AppLayout;
