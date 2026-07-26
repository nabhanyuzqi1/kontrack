import React, { useState, useEffect } from 'react';
import { NavLink, Link, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  FolderKanban,
  ReceiptText,
  Landmark,
  Users,
  BarChart3,
  Settings,
  LogOut,
  LogIn,
  Menu,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  MoreHorizontal
} from 'lucide-react';
import ErrorBoundary from '../ui/ErrorBoundary';
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

// Navigasi bawah untuk ponsel — 4 tujuan utama + tombol "Lainnya".
const bottomNavItems = (isAdmin) => [
  ...(isAdmin
    ? [{ to: '/', label: 'Beranda', icon: LayoutDashboard, end: true }]
    : [{ to: '/projects', label: 'Proyek', icon: FolderKanban }]),
  ...(isAdmin ? [{ to: '/projects', label: 'Proyek', icon: FolderKanban }] : []),
  ...(isAdmin ? [{ to: '/invoices', label: 'Invoice', icon: ReceiptText }] : []),
  { to: '/reports', label: 'Laporan', icon: BarChart3 }
];

const NavItem = ({ to, label, icon: Icon, end, onClick, collapsed }) => (
  <NavLink
    to={to}
    end={end}
    onClick={onClick}
    title={collapsed ? label : undefined}
    className={({ isActive }) =>
      `group flex items-center gap-3 rounded-lg py-2.5 text-sm font-medium transition-all duration-150 ${
        collapsed ? 'justify-center px-2' : 'px-3'
      } ${
        isActive
          ? 'bg-brand-gradient text-white shadow-glow'
          : 'text-slate-400 hover:bg-white/5 hover:text-white'
      }`
    }
  >
    <Icon className="h-[18px] w-[18px] shrink-0" />
    {!collapsed && label}
  </NavLink>
);

const UserSection = ({ currentUser, onSignOut, collapsed }) => {
  if (!currentUser) {
    return (
      <Link
        to="/login"
        className="flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm font-medium text-slate-200 transition-colors hover:border-brand-500/50 hover:bg-brand-600/20 hover:text-white"
      >
        <LogIn className="h-4 w-4" />
        {!collapsed && 'Masuk'}
      </Link>
    );
  }

  const initial = (currentUser.name || currentUser.email || '?').charAt(0).toUpperCase();

  if (collapsed) {
    return (
      <button
        onClick={onSignOut}
        title="Keluar"
        className="flex w-full items-center justify-center rounded-lg border border-white/10 bg-white/5 py-2.5 text-slate-300 transition-colors hover:bg-red-500/15 hover:text-red-400"
      >
        <LogOut className="h-4 w-4" />
      </button>
    );
  }

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

const SidebarContent = ({ currentUser, onSignOut, onNavigate, collapsed, onToggleCollapse }) => {
  const isAdmin = currentUser?.role === 'admin';
  return (
    <div className="flex h-full flex-col">
      <div className={`flex items-center justify-between pb-6 pt-6 ${collapsed ? 'px-3' : 'px-5'}`}>
        <Link to={isAdmin ? '/' : '/projects'} onClick={onNavigate}>
          {collapsed ? <LogoMark className="h-9 w-9" /> : <Logo dark />}
        </Link>
        {/* Tombol lipat hanya di desktop */}
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            title={collapsed ? 'Perlebar sidebar' : 'Persempit sidebar'}
            className="hidden rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-white/10 hover:text-white lg:block"
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
        )}
      </div>

      <nav className={`flex-1 space-y-1 ${collapsed ? 'px-2' : 'px-3'}`}>
        {navItems(isAdmin).map((item) => (
          <NavItem key={item.to} {...item} onClick={onNavigate} collapsed={collapsed} />
        ))}
      </nav>

      <div className={`pb-3 ${collapsed ? 'px-2' : 'px-3'}`}>
        {!collapsed && (
          <div className="mb-3 rounded-xl bg-gradient-to-br from-brand-600/20 to-accent-500/10 p-3.5 ring-1 ring-inset ring-brand-500/20">
            <p className="font-display text-xs font-semibold text-brand-300">KONTRACK</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">
              Manajemen proyek & keuangan kontraktor.
            </p>
          </div>
        )}
        <UserSection currentUser={currentUser} onSignOut={onSignOut} collapsed={collapsed} />
      </div>
    </div>
  );
};

const SIDEBAR_KEY = 'kontrack-sidebar-collapsed';

const AppLayout = ({ currentUser, children }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_KEY) === '1';
    } catch (e) {
      return false;
    }
  });
  const navigate = useNavigate();
  const location = useLocation();
  const isAdmin = currentUser?.role === 'admin';

  const toggleCollapse = () => {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(SIDEBAR_KEY, next ? '1' : '0');
      } catch (e) {
        /* private mode */
      }
      return next;
    });
  };

  // Tutup drawer saat berpindah halaman
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const handleSignOut = async () => {
    try {
      await signOutUser();
      navigate('/projects');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const sidebarW = collapsed ? 'lg:w-[76px]' : 'lg:w-64';
  const mainPad = collapsed ? 'lg:pl-[76px]' : 'lg:pl-64';

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Sidebar desktop */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 hidden bg-navy-900 transition-all duration-200 lg:block ${sidebarW}`}
      >
        <SidebarContent
          currentUser={currentUser}
          onSignOut={handleSignOut}
          collapsed={collapsed}
          onToggleCollapse={toggleCollapse}
        />
      </aside>

      {/* Topbar mobile */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-white/10 bg-navy-900 px-4 lg:hidden">
        <Link to={isAdmin ? '/' : '/projects'} className="flex items-center gap-2">
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
        <div className="fixed inset-0 z-50 lg:hidden">
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

      {/* Konten utama — beri ruang bawah untuk bottom nav di ponsel */}
      <main className={mainPad}>
        <div className="mx-auto max-w-7xl px-4 pb-24 pt-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8 lg:pb-8">
          <ErrorBoundary resetKey={location.pathname}>{children}</ErrorBoundary>
        </div>
      </main>

      {/* Navigasi bawah ala aplikasi native (hanya ponsel, hanya saat login) */}
      {currentUser && (
        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
          <div className="flex items-stretch justify-around">
            {bottomNavItems(isAdmin).map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium transition-colors ${
                    isActive ? 'text-brand-600' : 'text-slate-400'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon className={`h-5 w-5 ${isActive ? 'stroke-[2.5]' : ''}`} />
                    {label}
                  </>
                )}
              </NavLink>
            ))}
            <button
              onClick={() => setMobileOpen(true)}
              className="flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium text-slate-400"
            >
              <MoreHorizontal className="h-5 w-5" />
              Lainnya
            </button>
          </div>
        </nav>
      )}
    </div>
  );
};

export default AppLayout;
