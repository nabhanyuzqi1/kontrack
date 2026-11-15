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
  Terminal,
  LogOut,
  LogIn,
  X,
  Plus,
  MoreHorizontal,
  Search,
  Bell,
  Sun,
  Moon,
  HelpCircle,
  AlertTriangle,
  CalendarClock,
  Keyboard,
  BookOpen,
  ShieldCheck,
  CircleUser,
  Building2
} from 'lucide-react';
import ErrorBoundary from '../ui/ErrorBoundary';
import { signOutUser } from '../../services/auth';
import { LogoMark } from '../brand/Logo';
import { useColorMode } from '../../hooks/useColorMode';
import { getCompanySettings } from '../../services/settings';
import { getAllProjects } from '../../services/projects';
import { getAllInvoices, INVOICE_STATUS } from '../../services/invoices';
import { PROJECT_STATUS } from '../../utils/constants';
import NotificationCenter from './NotificationCenter';
import { monthlyTaxReport, taxDueDate, taxDueStatus } from '../../utils/reportCalc';
import { isDeveloper as isDeveloperUser } from '../../utils/access';

const navItems = (isAdmin, showDeveloper) => [
  ...(isAdmin ? [{ to: '/app', label: 'Dashboard', icon: LayoutDashboard, end: true }] : []),
  { to: '/app/projects', label: 'Proyek', icon: FolderKanban },
  ...(isAdmin
    ? [
        { to: '/app/invoices', label: 'Invoice', icon: ReceiptText },
        { to: '/app/tax-invoices', label: 'Pajak', icon: Landmark },
        { to: '/app/clients', label: 'Klien', icon: Users }
      ]
    : []),
  { to: '/app/reports', label: 'Laporan', icon: BarChart3 },
  ...(isAdmin ? [{ to: '/app/settings', label: 'Pengaturan', icon: Settings }] : []),
  // Hanya muncul untuk peran superadmin; rute-nya juga dijaga di App.jsx.
  ...(showDeveloper ? [{ to: '/app/developer', label: 'Developer', icon: Terminal }] : [])
];

// Navigasi bawah ponsel — 4 tujuan utama + tombol "Lainnya".
const bottomNavItems = (isAdmin) => [
  ...(isAdmin
    ? [{ to: '/app', label: 'Beranda', icon: LayoutDashboard, end: true }]
    : [{ to: '/app/projects', label: 'Proyek', icon: FolderKanban }]),
  ...(isAdmin ? [{ to: '/app/projects', label: 'Proyek', icon: FolderKanban }] : []),
  ...(isAdmin ? [{ to: '/app/invoices', label: 'Invoice', icon: ReceiptText }] : []),
  { to: '/app/reports', label: 'Laporan', icon: BarChart3 }
];

const IconButton = ({ label, onClick, children, badge = false, className = '' }) => (
  <button
    onClick={onClick}
    title={label}
    aria-label={label}
    className={`relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full glass-3 text-slate-500 ring-1 ring-inset ring-slate-900/[0.04] transition-colors glass-hover hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60 dark:text-slate-400 dark:ring-white/[0.06] dark:hover:text-slate-200 ${className}`}
  >
    {children}
    {badge && (
      <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-gold ring-2 ring-[var(--glass-primary)]" />
    )}
  </button>
);

// Panel melayang untuk menu header (notifikasi/bantuan/akun): menutup saat klik
// di luar atau Escape. Satu komponen dipakai bergantian agar tidak ada dua
// panel terbuka sekaligus.
const Popover = ({ open, onClose, children, align = 'right' }) => {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onDocClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div
      ref={ref}
      className={`absolute right-0 top-[calc(100%+8px)] z-50 w-80 max-w-[calc(100vw-24px)] animate-scale-in rounded-xl panel-solid ${align === 'right' ? '' : 'left-0'}`}
      role="menu"
    >
      {children}
    </div>
  );
};

// tone = pasangan kelas statis (Tailwind tidak membaca kelas dinamis template)
const TONE_CLS = {
  brand: 'bg-brand-500/10 text-brand-700 dark:text-brand-300',
  red: 'bg-red-500/10 text-red-600 dark:text-red-400',
  amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
};

const PopoverItem = ({ icon: Icon, title, desc, tone = 'brand', onClick }) => (
  <button
    onClick={onClick}
    role="menuitem"
    className="flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-slate-100/70 dark:hover:bg-white/[0.06]"
  >
    {Icon && (
      <span className={`mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${TONE_CLS[tone] || TONE_CLS.brand}`}>
        <Icon className="h-4 w-4" />
      </span>
    )}
    <span className="min-w-0">
      <span className="block truncate text-sm font-medium text-slate-800 dark:text-slate-700">{title}</span>
      {desc && <span className="mt-0.5 block text-xs leading-relaxed text-slate-500 dark:text-slate-400">{desc}</span>}
    </span>
  </button>
);

// Baris navigasi modul. Dulu memakai overflow-x-auto sehingga rail ini bisa
// digeser sendiri dan ikut bergeser saat roda mouse dipakai di atas header.
// Kini: tanpa scroll (menu diringkas agar muat), dan klik pada rail yang
// meluap dialihkan ke drawer ponsel lewat tombol menu.
const ModuleStrip = ({ isAdmin, showDeveloper, onNavigate }) => (
  <div className="relative">
    <nav className="flex items-center gap-1 overflow-hidden px-2 pb-1">
      {navItems(isAdmin, showDeveloper).map(({ to, label, icon: Icon, end }) => (
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
                <span className="absolute inset-x-1.5 -bottom-1.5 h-[2px] rounded-full bg-brand-600" />
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
const EntityCapsule = ({ company, user, showText = false, className = '', onClick }) => {
  const name = company?.companyName || company?.name || user?.email || 'Kontrack';
  const npwp = company?.npwp;
  const initial = String(name).charAt(0).toUpperCase();
  const Comp = onClick ? 'button' : 'div';

  return (
    <Comp
      onClick={onClick}
      type={onClick ? 'button' : undefined}
      title={onClick ? 'Profil perusahaan' : undefined}
      className={`flex max-w-[150px] items-center gap-2.5 rounded-full glass-3 py-1 pl-1 pr-3 ring-1 ring-inset ring-slate-900/[0.04] transition-colors sm:max-w-[260px] dark:ring-white/[0.06] ${onClick ? 'glass-hover text-left' : ''} ${className}`}
    >
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-gradient font-display text-xs font-bold text-white">
        {initial}
      </div>
      <div className={`min-w-0 leading-tight ${showText ? 'block' : 'hidden sm:block'}`}>
        {npwp && (
          <p className="tnum truncate text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
            NPWP {npwp}
          </p>
        )}
        <p className="truncate text-xs font-semibold text-slate-800 dark:text-slate-700">{name}</p>
      </div>
    </Comp>
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
  // Header pejal saat halaman digulir — kaca transparan membuat teks nav
  // bertabrakan dengan konten di belakangnya.
  const [scrolled, setScrolled] = useState(false);
  const [company, setCompany] = useState(null);
  const [openMenu, setOpenMenu] = useState(null); // 'notif' | 'help' | 'entity'
  const [notifications, setNotifications] = useState(null);
  const searchRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const isAdmin = currentUser?.role === 'admin';
  const developer = isDeveloperUser(currentUser);
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

  // Notifikasi dihitung dari data nyata saat panel pertama kali dibuka — bukan
  // sekadar lonceng hiasan. Sumber: tenggat proyek (terlambat/mendekati) dan
  // faktur yang masih menunggu pembayaran/penyetoran PPN.
  const loadNotifications = async () => {
    try {
      const [projects, invoices] = await Promise.all([
        getAllProjects().catch(() => []),
        isAdmin ? getAllInvoices().catch(() => []) : Promise.resolve([])
      ]);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const items = [];

      projects
        .filter((p) => p.status === PROJECT_STATUS.ONGOING)
        .forEach((p) => {
          const end = p.endDate ? new Date(p.endDate) : null;
          if (!end || Number.isNaN(end.getTime())) return;
          end.setHours(0, 0, 0, 0);
          const days = Math.round((end - today) / 86400000);
          if (days < 0) {
            items.push({
              id: `late-${p.id}`,
              kind: 'project',
              priority: 1,
              icon: AlertTriangle,
              tone: 'red',
              title: p.name,
              desc: `Terlambat ${Math.abs(days)} hari dari tenggat`,
              to: `/app/projects/${p.id}`
            });
          } else if (days <= 14) {
            items.push({
              id: `soon-${p.id}`,
              kind: 'project',
              priority: 3,
              icon: CalendarClock,
              tone: 'amber',
              title: p.name,
              desc: days === 0 ? 'Tenggat hari ini' : `Tenggat dalam ${days} hari`,
              to: `/app/projects/${p.id}`
            });
          }
        });

      if (isAdmin) {
        invoices
          .filter((inv) => inv.status === INVOICE_STATUS.SENT)
          .forEach((inv) => {
            // Umur tagihan menentukan prioritas: makin lama menunggu, makin naik.
            const issued = inv.issueDate ? new Date(inv.issueDate) : null;
            const ageDays =
              issued && !Number.isNaN(issued.getTime())
                ? Math.round((today - new Date(issued.getFullYear(), issued.getMonth(), issued.getDate())) / 86400000)
                : 0;
            items.push({
              id: `inv-${inv.id}`,
              kind: 'invoice',
              priority: ageDays > 30 ? 1 : 2,
              invoice: inv,
              icon: ReceiptText,
              tone: ageDays > 30 ? 'amber' : 'brand',
              title: inv.clientName || inv.recipient || 'Invoice',
              desc:
                ageDays > 30
                  ? `${inv.invoiceNumber || inv.number || 'Invoice'} menunggu ${ageDays} hari. Kirim pengingat.`
                  : `Invoice ${inv.invoiceNumber || inv.number || ''} menunggu pembayaran`,
              to: '/app/invoices'
            });
          });
        invoices
          .filter(
            (inv) =>
              inv.status === INVOICE_STATUS.PAID &&
              !inv.taxPaidAt &&
              (Number(inv.pajak11) || Number(inv.totals?.ppn) || 0) > 0
          )
          .forEach((inv) => {
            items.push({
              id: `tax-${inv.id}`,
              kind: 'tax',
              priority: 1,
              icon: Landmark,
              tone: 'emerald',
              title: 'PPN belum disetor',
              desc: `Invoice ${inv.invoiceNumber || inv.number || ''} sudah dibayar, PPN belum ditandai disetor`,
              to: '/app/tax-invoices'
            });
          });

        // Tenggat lapor/setor PPN bulan berjalan: satu pengingat per periode,
        // dihitung dari rumus pajak yang sama dengan halaman Laporan.
        try {
          const year = new Date().getFullYear();
          const rows = monthlyTaxReport(invoices, year);
          const thisMonth = new Date().getMonth();
          const active = rows
            .filter((r) => r.invoiceCount > 0 && r.month - 1 <= thisMonth)
            .pop();
          if (active) {
            const selisih = (active.ppnTerhutang || 0) - (active.ppnDisetor || 0);
            const status = taxDueStatus(active.year || year, active.month - 1, selisih);
            if (selisih > 0) {
              items.push({
                id: `ppn-due-${year}-${active.month}`,
                kind: 'tax',
                priority: status.state === 'telat' ? 1 : 2,
                icon: Landmark,
                tone: status.state === 'telat' ? 'red' : 'amber',
                title: `PPN ${active.label} ${year} belum disetor`,
                desc: `Kurang setor Rp${Math.round(selisih).toLocaleString('id-ID')}. ${status.label}.`,
                to: '/app/reports'
              });
            }
          }
        } catch (err) {
          console.warn('Reminder PPN dilewati:', err);
        }
      }

      setNotifications(items);
    } catch (error) {
      console.error('Gagal memuat notifikasi:', error);
      setNotifications([]);
    }
  };

  const toggleMenu = (menu) => {
    setOpenMenu((prev) => {
      if (prev !== menu && menu === 'notif') {
        setNotifications(null);
        loadNotifications();
      }
      return prev === menu ? null : menu;
    });
  };

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
      navigate('/app/projects');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  useEffect(() => {
    // setState per event scroll membuat React re-render puluhan kali per detik
    // (terasa bergetar). Cukup satu pemeriksaan per frame, dan hanya berubah
    // saat melewati ambang.
    let frame = 0;
    const check = () => {
      frame = 0;
      setScrolled((prev) => {
        const next = window.scrollY > 8;
        return prev === next ? prev : next;
      });
    };
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(check);
    };
    check();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  const focusSearch = () => {
    setSearchOpen(true);
    // Fokus setelah elemen benar-benar terpasang
    requestAnimationFrame(() => searchRef.current?.focus());
  };

  // Pencarian global: saat sudah di halaman Proyek, saring secara langsung dengan
  // memperbarui ?q=. Dari halaman lain, Enter dulu yang berpindah ke Proyek —
  // mengetik di sini tidak boleh membuang pengguna dari halaman yang sedang dibaca.
  const onSearchChange = (value) => {
    if (location.pathname !== '/app/projects') return;
    const next = new URLSearchParams(location.search);
    if (value.trim()) next.set('q', value);
    else next.delete('q');
    navigate(`/app/projects?${next.toString()}`, { replace: true });
  };

  const submitSearch = (value) => {
    const q = value.trim();
    if (!q) return;
    navigate(`/app/projects?q=${encodeURIComponent(q)}`);
    setSearchOpen(false);
  };

  return (
    <div className="min-h-screen">
      {/* ===== Header kaca dua tingkat =====
          Sticky tanpa padding atas: padding di elemen sticky meninggalkan celah
          kosong yang membuat konten terlihat menembus header saat digulir.
          Jarak ke tepi layar dibuat dengan padding DI DALAM container. */}
      <header className="sticky top-0 z-40 px-3 sm:px-4">
        {/* overflow-hidden sengaja TIDAK dipakai di container header: panel
            notifikasi/bantuan/akun menjorok keluar dari kotak, dan overflow
            akan memotongnya. Sudut bawah dipotong per-tingkat di baris nav. */}
        <div
          className={`mx-auto mt-3 max-w-[1400px] rounded-[18px] border transition-[background-color,box-shadow,border-color] duration-300 ease-out sm:mt-4 ${
            scrolled
              ? 'header-solid border-slate-200/70 shadow-[0_6px_24px_-12px_rgba(15,23,42,0.35)] dark:border-white/10'
              : 'glass-1 border-transparent'
          }`}
        >
          {/* Tingkat 1 — baris utilitas */}
          <div className="flex h-[52px] items-center gap-2 px-3 sm:gap-3 sm:px-5">
            <Link
              to={isAdmin ? '/app' : '/app/projects'}
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
                className="field-surface h-8 w-full rounded-lg pl-9 pr-3 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/60 sm:max-w-[360px]"
              />
            </div>

            <div className="ml-auto flex min-w-0 shrink-0 items-center gap-1.5 sm:gap-2">
              <IconButton label="Cari" onClick={focusSearch} className="sm:hidden">
                <Search className="h-4 w-4" />
              </IconButton>
              <IconButton
                label={mode === 'dark' ? 'Mode terang' : 'Mode gelap'}
                onClick={toggle}
              >
                {mode === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </IconButton>

              {/* Notifikasi: dihitung dari data nyata (tenggat proyek, invoice,
                  setoran PPN) setiap kali panel dibuka. */}
              <div className="relative hidden lg:block">
                <IconButton
                  label="Notifikasi"
                  badge={Boolean(notifications?.length)}
                  onClick={() => toggleMenu('notif')}
                >
                <Bell className="h-4 w-4" />
              </IconButton>
              <Popover open={openMenu === 'notif'} onClose={() => setOpenMenu(null)}>
                  <NotificationCenter
                    items={notifications || []}
                    loading={notifications === null}
                    isAdmin={isAdmin}
                    company={company}
                    onNavigate={(to) => {
                      setOpenMenu(null);
                      navigate(to);
                    }}
                  />
                </Popover>
              </div>

              <div className="relative hidden lg:block">
                <IconButton label="Bantuan" onClick={() => toggleMenu('help')}>
                  <HelpCircle className="h-4 w-4" />
                </IconButton>
                <Popover open={openMenu === 'help'} onClose={() => setOpenMenu(null)}>
                  <div className="border-b border-slate-200/70 px-4 py-3 dark:border-white/10">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-700">Bantuan</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Panduan singkat tiap modul</p>
                  </div>
                  <div className="p-1.5">
                    <PopoverItem
                      icon={BookOpen}
                      title="Proyek"
                      desc="Catat RAB, SPK, dan progres pembayaran. Klik kartu proyek untuk detail termin."
                      onClick={() => {
                        setOpenMenu(null);
                        navigate('/app/projects');
                      }}
                    />
                    <PopoverItem
                      icon={ReceiptText}
                      title="Invoice & Faktur Pajak"
                      desc="Terbitkan invoice, tandai pembayaran, lalu kelola faktur dan setoran PPN di CoreTax."
                      onClick={() => {
                        setOpenMenu(null);
                        navigate('/app/invoices');
                      }}
                    />
                    <PopoverItem
                      icon={BarChart3}
                      title="Laporan"
                      desc="Posisi kontrak, arus kas per periode, laporan pajak bulanan, dan analisis tahunan."
                      onClick={() => {
                        setOpenMenu(null);
                        navigate('/app/reports');
                      }}
                    />
                    <PopoverItem
                      icon={ShieldCheck}
                      title="Data & Keamanan"
                      desc="Identitas perusahaan dan pengaturan hanya bisa diubah oleh admin."
                      onClick={() => {
                        setOpenMenu(null);
                        navigate('/app/settings');
                      }}
                    />
                  </div>
                </Popover>
              </div>

              {/* Kapsul entitas — di ponsel ini juga jalan masuk ke menu lengkap
                  (lewat rail bawah "Lainnya") dan tindakan keluar. Tidak ada
                  tombol hamburger terpisah: satu jalan masuk cukup. */}
              <div className="relative min-w-0 shrink">
                <EntityCapsule
                  company={company}
                  user={currentUser}
                  onClick={currentUser ? () => toggleMenu('entity') : undefined}
                />
                <Popover open={openMenu === 'entity'} onClose={() => setOpenMenu(null)}>
                  <div className="border-b border-slate-200/70 px-4 py-3 dark:border-white/10">
                    <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-700">
                      {company?.companyName || company?.name || currentUser?.email || 'Kontrack'}
                    </p>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                      {currentUser?.email}
                      {currentUser?.role === 'admin' ? ' · Administrator' : ''}
                    </p>
                  </div>
                  <div className="p-1.5">
                    <PopoverItem
                      icon={Building2}
                      title="Pengaturan perusahaan"
                      desc="Identitas, tema, dan pengguna"
                      onClick={() => {
                        setOpenMenu(null);
                        navigate('/app/settings');
                      }}
                    />
                    <PopoverItem
                      icon={mode === 'dark' ? Sun : Moon}
                      title={mode === 'dark' ? 'Mode terang' : 'Mode gelap'}
                      desc="Preferensi tersimpan di perangkat ini"
                      onClick={() => {
                        toggle();
                        setOpenMenu(null);
                      }}
                    />
                    {currentUser && (
                      <PopoverItem
                        icon={LogOut}
                        title="Keluar"
                        desc="Akhiri sesi di perangkat ini"
                        tone="red"
                        onClick={() => {
                          setOpenMenu(null);
                          handleSignOut();
                        }}
                      />
                    )}
                  </div>
                </Popover>
              </div>
            </div>
          </div>

          {/* Tingkat 2 — rail navigasi modul (tablet ke atas) */}
          <div className="hidden overflow-hidden rounded-b-[18px] border-t border-slate-200/70 sm:block">
            <ModuleStrip isAdmin={isAdmin} showDeveloper={developer} />
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
              <Link to={isAdmin ? '/app' : '/app/projects'} className="flex items-center gap-2">
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
              {navItems(isAdmin, developer).map(({ to, label, icon: Icon, end }) => (
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
                  to="/app/projects"
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
      {/* key per rute: konten diremount saat pindah halaman sehingga animasi
          page-in diputar ulang; ErrorBoundary ikut direset per rute. */}
      <main key={location.pathname} className="page-enter mx-auto max-w-[1400px] px-3 pb-24 pt-4 sm:px-4 sm:pb-8 sm:pt-5">
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
