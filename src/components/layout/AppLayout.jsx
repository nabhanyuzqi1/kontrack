// src/components/layout/AppLayout.jsx
// Shell aplikasi: header kaca dua tingkat (utilitas + navigasi modul), drawer
// geser untuk ponsel, dan rail bawah.
//
// Menyelaraskan dengan spesifikasi "floating enterprise container": tidak ada rail
// sidebar vertikal. Logika yang dipertahankan apa adanya: gating peran admin,
// sign-out, daftar modul, dan penutupan drawer saat berpindah halaman.
import React, { useState, useEffect, useRef } from 'react';
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
  Plus,
  MoreHorizontal,
  Search,
  Bell,
  Sun,
  Moon,
  HelpCircle
} from 'lucide-react';
import ErrorBoundary from '../ui/ErrorBoundary';
import { signOutUser } from '../../services/auth';
import { LogoMark } from '../brand/Logo';
import { useColorMode } from '../../hooks/useColorMode';
import { getCompanySettings } from '../../services/settings';

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

// Navigasi bawah ponsel — 4 tujuan utama + tombol "Lainnya".
const bottomNavItems = (isAdmin) => [
  ...(isAdmin
    ? [{ to: '/', label: 'Beranda', icon: LayoutDashboard, end: true }]
    : [{ to: '/projects', label: 'Proyek', icon: FolderKanban }]),
  ...(isAdmin ? [{ to: '/projects', label: 'Proyek', icon: FolderKanban }] : []),
  ...(isAdmin ? [{ to: '/invoices', label: 'Invoice', icon: ReceiptText }] : []),
  { to: '/reports', label: 'Laporan', icon: BarChart3 }
];

const IconButton = ({ label, onClick, children, badge = false, className = '' }) => (
  <button
    onClick={onClick}
    title={label}
    aria-label={label}
    className={`relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full glass-3 text-slate-500 glass-hover hover:text-slate-800 ${className}`}
  >
    {children}
    {badge && (
      <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-gold ring-2 ring-[var(--glass-primary)]" />
    )}
  </button>
);

// Baris navigasi modul: satu rail horizontal, bisa digeser di layar sempit.
// Penanda pudar di tepi kanan menunjukkan masih ada menu lanjutan — tanpa itu,
// "Pengaturan" tampak hilang di lebar tablet.
const ModuleStrip = ({ isAdmin, onNavigate }) => (
  <div className="relative">
    <nav className="no-scrollbar flex items-center gap-1 overflow-x-auto px-2 pb-1">
      {navItems(isAdmin).map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={`${to}-${label}`}
          to={to}
          end={end}
          onClick={onNavigate}
          className={({ isActive }) =>
            `relative inline-flex shrink-0 items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors ${
              isActive
                ? 'bg-brand-500/10 text-brand-700 dark:text-brand-300'
                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <Icon className="h-4 w-4 shrink-0" />
              <span className="whitespace-nowrap">{label}</span>
              {isActive && (
                <span className="absolute inset-x-2 -bottom-1 h-0.5 rounded-full bg-brand-600" />
              )}
            </>
          )}
        </NavLink>
      ))}
    </nav>
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-[var(--glass-primary)] to-transparent"
    />
  </div>
);

// Kapsul profil entitas: nama perusahaan + NPWP (bila ada di Pengaturan).
// `showText` dipaksa true di dalam drawer: di sana ruangnya cukup, dan kapsul
// tanpa nama hanya menampilkan satu huruf tanpa arti.
const EntityCapsule = ({ company, user, showText = false, className = '' }) => {
  const name = company?.companyName || company?.name || user?.email || 'Kontrack';
  const npwp = company?.npwp;
  const initial = String(name).charAt(0).toUpperCase();

  return (
    <div className={`flex items-center gap-2.5 rounded-full glass-3 py-1 pl-1 pr-3 ${className}`}>
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-gradient font-display text-xs font-bold text-white">
        {initial}
      </div>
      <div className={`min-w-0 leading-tight ${showText ? 'block' : 'hidden sm:block'}`}>
        {npwp && (
          <p className="tnum truncate text-[10px] uppercase tracking-wide text-slate-400">
            NPWP {npwp}
          </p>
        )}
        <p className="truncate text-xs font-semibold text-slate-800">{name}</p>
      </div>
    </div>
  );
};

const UserSection = ({ currentUser, onSignOut, onNavigate }) => {
  if (!currentUser) {
    return (
      <Link
        to="/login"
        onClick={onNavigate}
        className="flex items-center justify-center gap-2 rounded-lg glass-3 px-3 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:text-brand-700"
      >
        <LogIn className="h-4 w-4" />
        Masuk
      </Link>
    );
  }

  const initial = (currentUser.name || currentUser.email || '?').charAt(0).toUpperCase();

  return (
    <div className="rounded-xl glass-3 p-3">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-gradient font-display text-sm font-bold text-white">
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-slate-800">
            {currentUser.name || currentUser.email}
          </p>
          <p className="text-xs text-slate-500">
            {currentUser.role === 'admin' ? 'Administrator' : 'Anggota'}
          </p>
        </div>
        <button
          onClick={onSignOut}
          title="Keluar"
          className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-500/10 hover:text-red-500"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

const AppLayout = ({ currentUser, children }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [company, setCompany] = useState(null);
  const searchRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const isAdmin = currentUser?.role === 'admin';
  const { mode, toggle } = useColorMode();

  // Identitas entitas untuk kapsul header — dibaca dari Pengaturan, bukan dikarang.
  useEffect(() => {
    let alive = true;
    getCompanySettings()
      .then((s) => alive && setCompany(s))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  // Tutup drawer saat berpindah halaman
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // Kunci gulir latar selama drawer terbuka
  useEffect(() => {
    if (!mobileOpen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  const handleSignOut = async () => {
    try {
      await signOutUser();
      navigate('/projects');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const focusSearch = () => {
    setSearchOpen(true);
    // Fokus setelah elemen benar-benar terpasang
    requestAnimationFrame(() => searchRef.current?.focus());
  };

  // Pencarian global: saat sudah di halaman Proyek, saring secara langsung dengan
  // memperbarui ?q=. Dari halaman lain, Enter dulu yang berpindah ke Proyek —
  // mengetik di sini tidak boleh membuang pengguna dari halaman yang sedang dibaca.
  const onSearchChange = (value) => {
    if (location.pathname !== '/projects') return;
    const next = new URLSearchParams(location.search);
    if (value.trim()) next.set('q', value);
    else next.delete('q');
    navigate(`/projects?${next.toString()}`, { replace: true });
  };

  const submitSearch = (value) => {
    const q = value.trim();
    if (!q) return;
    navigate(`/projects?q=${encodeURIComponent(q)}`);
    setSearchOpen(false);
  };

  return (
    <div className="min-h-screen">
      {/* ===== Header kaca dua tingkat ===== */}
      <header className="sticky top-0 z-40 px-3 pt-3 sm:px-4 sm:pt-4">
        <div className="mx-auto max-w-[1400px] overflow-hidden rounded-[18px] glass-1">
          {/* Tingkat 1 — baris utilitas */}
          <div className="flex h-[60px] items-center gap-2 px-3 sm:gap-3 sm:px-5">
            <Link
              to={isAdmin ? '/' : '/projects'}
              className="flex shrink-0 items-center gap-2"
              aria-label="Kontrack"
            >
              <LogoMark className="h-7 w-7" />
              <span className="hidden font-display text-sm font-bold uppercase tracking-[0.14em] text-slate-800 sm:inline">
                Kontrack
              </span>
            </Link>

            {/* Pencarian: tersembunyi di ponsel sampai ikonnya ditekan */}
            <div
              className={`relative min-w-0 flex-1 ${searchOpen ? 'block' : 'hidden'} sm:block`}
            >
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                ref={searchRef}
                type="search"
                placeholder="Cari proyek, mitra, atau no. SPK…"
                onChange={(e) => onSearchChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submitSearch(e.currentTarget.value);
                }}
                className="field-surface h-9 w-full rounded-full pl-9 pr-3 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/60 sm:max-w-[380px]"
              />
            </div>

            <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
              <IconButton label="Cari" onClick={focusSearch} className="sm:hidden">
                <Search className="h-4 w-4" />
              </IconButton>
              <IconButton
                label={mode === 'dark' ? 'Mode terang' : 'Mode gelap'}
                onClick={toggle}
              >
                {mode === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </IconButton>
              {/* Lonceng notifikasi: saat ini hanya penanda visual. Belum ada
                  sumber notifikasi di dalam aplikasi — jangan diklaim berfungsi
                  sebelum ada pengirimnya (lihat ROADMAP). */}
              <IconButton label="Notifikasi" badge className="hidden lg:inline-flex">
                <Bell className="h-4 w-4" />
              </IconButton>
              <IconButton label="Bantuan" className="hidden lg:inline-flex">
                <HelpCircle className="h-4 w-4" />
              </IconButton>
              <Link to="/settings" aria-label="Pengaturan entitas" className="shrink-0">
                <EntityCapsule company={company} user={currentUser} />
              </Link>
              <button
                onClick={() => setMobileOpen(true)}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full glass-3 text-slate-600 sm:hidden"
                aria-label="Buka menu"
              >
                <Menu className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Tingkat 2 — rail navigasi modul (tablet ke atas) */}
          <div className="hidden border-t border-slate-200/70 sm:block">
            <ModuleStrip isAdmin={isAdmin} />
          </div>
        </div>
      </header>

      {/* ===== Drawer geser ponsel ===== */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 sm:hidden">
          <div
            className="absolute inset-0 animate-fade-in bg-scrim/45 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-y-0 right-0 flex w-[86%] max-w-xs flex-col gap-4 overflow-y-auto glass-1 rounded-none p-4 animate-slide-up">
            <div className="flex items-center justify-between">
              <Link to={isAdmin ? '/' : '/projects'} className="flex items-center gap-2">
                <LogoMark className="h-7 w-7" />
                <span className="font-display text-sm font-bold uppercase tracking-[0.14em] text-slate-800">
                  Kontrack
                </span>
              </Link>
              <button
                onClick={() => setMobileOpen(false)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                aria-label="Tutup menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <EntityCapsule company={company} user={currentUser} showText className="w-full" />

            <nav className="flex flex-col gap-0.5">
              {navItems(isAdmin).map(({ to, label, icon: Icon, end }) => (
                <NavLink
                  key={`m-${to}-${label}`}
                  to={to}
                  end={end}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-brand-500/10 text-brand-700 dark:text-brand-300'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`
                  }
                >
                  <Icon className="h-[18px] w-[18px]" />
                  {label}
                </NavLink>
              ))}
            </nav>

            <div className="mt-auto space-y-3">
              {isAdmin && (
                <Link
                  to="/projects"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-3 py-2.5 text-sm font-medium text-white"
                >
                  <Plus className="h-4 w-4" />
                  Tambah Proyek
                </Link>
              )}
              <UserSection
                currentUser={currentUser}
                onSignOut={handleSignOut}
                onNavigate={() => setMobileOpen(false)}
              />
            </div>
          </div>
        </div>
      )}

      {/* ===== Konten utama ===== */}
      <main className="mx-auto max-w-[1400px] px-3 pb-24 pt-4 sm:px-4 sm:pb-8 sm:pt-5">
        <ErrorBoundary resetKey={location.pathname}>{children}</ErrorBoundary>
      </main>

      {/* ===== Rail bawah ponsel ===== */}
      {currentUser && (
        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/70 bg-[var(--glass-elevated)] pb-[env(safe-area-inset-bottom)] backdrop-blur-xl sm:hidden">
          <div className="flex items-stretch justify-around">
            {bottomNavItems(isAdmin).map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={`b-${to}-${label}`}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium transition-colors ${
                    isActive ? 'text-brand-700 dark:text-brand-300' : 'text-slate-400'
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
