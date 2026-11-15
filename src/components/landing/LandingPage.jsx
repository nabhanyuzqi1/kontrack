import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowDownToLine, ArrowRight, ArrowUpRight, BarChart3, Building2,
  Check, ChevronDown, CircleHelp, FileCheck2, FileText, FolderKanban,
  Landmark, Menu, Moon, ShieldCheck, Sun, Wallet, X
} from 'lucide-react';
import Logo from '../brand/Logo';
import '../../styles/public.css';

const projects = [
  { name: 'Rehabilitasi Jalan Poros Kasongan', client: 'Dinas PUPR Katingan', value: 'Rp 4,85 M', paid: 'Rp 2,18 M', pct: 45, due: '20 Des 2026', color: 'bg-teal-500' },
  { name: 'Gedung Serbaguna Baun Bango', client: 'Pemdes Baun Bango', value: 'Rp 1,27 M', paid: 'Rp 1,18 M', pct: 93, due: '30 Jun 2026', color: 'bg-amber-500' },
  { name: 'Drainase Tumbang Samba', client: 'Dinas PUPR Katingan', value: 'Rp 780 jt', paid: 'Rp 780 jt', pct: 100, due: '28 Mei 2026', color: 'bg-emerald-500' }
];

const features = [
  { icon: Wallet, title: 'Jeda kas terlihat lebih awal', body: 'Hubungkan biaya lapangan dengan termin dan invoice. Ketahui nilai yang sudah ditagih, belum cair, dan biaya yang masih harus ditutup.' },
  { icon: FolderKanban, title: 'Setiap proyek punya satu arsip', body: 'SPK, PK, BAHK, WPHO, invoice, dan faktur pajak ditautkan ke proyek yang sama. Kurangi pencarian berkas lintas folder.' },
  { icon: Landmark, title: 'Retensi dan pajak terpantau', body: 'Pantau tanggal BA terakhir, masa retensi, status setor PPN, billing, dan NTPN dalam alur kerja yang bisa ditindaklanjuti.' }
];

// Item marquee metrik. Diharfdik agar marquee bisa bergeser mulus (awal = akhir).
const marqueeItems = [
  'Rp 13,32 M nilai kontrak terpantau',
  '6 proyek aktif',
  '3 termin belum cair',
  'Rp 487 jt retensi berjalan',
  'PPN 12% DPP Nilai Lain',
  'Faktur pajak CoreTax siap ekspor',
  '2 jatuh tempo termin bulan ini',
  'Arsip SPK & PK per proyek'
];

const LandingPage = () => {
  const [mode, setMode] = useState(() => {
    try { return localStorage.getItem('kontrack-public-mode') || 'light'; } catch { return 'light'; }
  });
  const [menuOpen, setMenuOpen] = useState(false);
  const dark = mode === 'dark';
  const rootRef = useRef(null);

  const toggleMode = () => setMode((current) => {
    const next = current === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('kontrack-public-mode', next); } catch {}
    return next;
  });

  // Reveal saat scroll. prefers-reduced-motion: elemen langsung tampil tanpa animasi.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const nodes = root.querySelectorAll('[data-reveal]');
    if (reduced || !('IntersectionObserver' in window)) {
      nodes.forEach((n) => n.classList.add('is-visible'));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    nodes.forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, []);

  // Sorotan kursor: posisi relatif ditulis sebagai CSS var per panel kaca.
  // Abaikan pada perangkat sentuh / reduced motion (CSS sudah menonaktifkan).
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const onMove = (e) => {
      root.querySelectorAll('.pub-glass').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (e.clientY < r.top - 80 || e.clientY > r.bottom + 80) return;
        el.style.setProperty('--mx', `${e.clientX - r.left}px`);
        el.style.setProperty('--my', `${e.clientY - r.top}px`);
      });
    };
    root.addEventListener('mousemove', onMove);
    return () => root.removeEventListener('mousemove', onMove);
  }, []);

  const palette = dark
    ? { page: 'bg-[#0d141c] text-slate-100', header: 'border-white/10 bg-[#0d141c]/80', band: 'border-white/10 bg-[#111a22]', soft: 'bg-[#22313b]', heading: 'text-white', body: 'text-slate-300', muted: 'text-slate-400', grid: 'border-white/10', badge: 'text-teal-300' }
    : { page: 'bg-[#eef2f3] text-slate-800', header: 'border-slate-200 bg-[#eef2f3]/80', band: 'border-slate-200 bg-[#e8eef0]', soft: 'bg-slate-100', heading: 'text-slate-900', body: 'text-slate-600', muted: 'text-slate-500', grid: 'border-slate-200', badge: 'text-teal-800' };

  return (
    <div ref={rootRef} data-public-mode={mode} className={`pub-page relative min-h-screen overflow-x-clip ${palette.page}`}>
      {/* Blob dekoratif: warna solid + blur besar, memberi kedalaman kaca tanpa gradasi warna. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 -left-24 h-96 w-96 rounded-full bg-teal-600/20 blur-3xl" />
        <div className="absolute top-1/3 -right-32 h-[28rem] w-[28rem] rounded-full bg-sky-700/15 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-emerald-600/10 blur-3xl" />
      </div>

      <header className={`sticky top-0 z-30 border-b backdrop-blur-xl ${palette.header}`}>
        <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-8 lg:px-14">
          <Link to="/" aria-label="Kontrack, halaman utama"><Logo dark={dark} /></Link>
          <nav className="hidden items-center gap-7 text-sm font-medium md:flex">
            <a href="#solusi" className={`${palette.body} hover:text-teal-700`}>Solusi</a>
            <a href="#cara-kerja" className={`${palette.body} hover:text-teal-700`}>Alur kerja</a>
            <a href="#tampilan" className={`${palette.body} hover:text-teal-700`}>Tampilan</a>
            <Link to="/support" className={`${palette.body} hover:text-teal-700`}>Bantuan</Link>
          </nav>
          <div className="flex items-center gap-2">
            <button onClick={toggleMode} aria-label={dark ? 'Gunakan mode terang' : 'Gunakan mode gelap'} title={dark ? 'Mode terang' : 'Mode gelap'} className={`rounded-lg border p-2 ${palette.grid}`}>
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <Link to="/login" className={`hidden rounded-lg px-3 py-2 text-sm font-semibold sm:inline-flex ${palette.body}`}>Masuk</Link>
            <Link to="/login" className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800"><span className="hidden sm:inline">Mulai gunakan</span><span className="sm:hidden">Masuk</span><ArrowRight className="h-4 w-4" /></Link>
            <button onClick={() => setMenuOpen(!menuOpen)} className={`rounded-lg border p-2 md:hidden ${palette.grid}`} aria-label="Menu">
              {menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>
        {menuOpen && <nav className={`grid gap-1 border-t px-4 py-3 text-sm md:hidden ${palette.grid}`}><a href="#solusi" onClick={() => setMenuOpen(false)} className="py-2">Solusi</a><a href="#cara-kerja" onClick={() => setMenuOpen(false)} className="py-2">Alur kerja</a><Link to="/support" className="py-2">Bantuan</Link></nav>}
      </header>

      <main className="relative">
        {/* HERO full-bleed */}
        <section className="grid items-center gap-12 px-4 pb-16 pt-14 sm:px-8 md:pb-24 md:pt-20 lg:grid-cols-[0.9fr_1.1fr] lg:px-14">
          <div data-reveal className="pub-reveal">
            <p className={`mb-5 flex items-center gap-2 text-xs font-semibold uppercase ${palette.badge}`}><span className="h-px w-8 bg-teal-700" />Operasional kontraktor, satu alur kerja</p>
            <h1 className={`max-w-xl font-display text-4xl font-bold leading-tight sm:text-5xl ${palette.heading}`}>Jaga arus kas proyek tetap bergerak.</h1>
            <p className={`mt-5 max-w-xl text-base leading-7 ${palette.body}`}>Saat biaya sudah keluar tetapi termin belum cair, keputusan cepat bergantung pada informasi yang rapi. Kontrack menghubungkan progres proyek, transaksi, dokumen penagihan, dan pajak dalam satu workspace.</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link to="/login" className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-5 py-3 text-sm font-semibold text-white hover:bg-teal-800">Masuk ke workspace <ArrowRight className="h-4 w-4" /></Link>
              <a href="#tampilan" className={`inline-flex items-center gap-2 rounded-lg border px-5 py-3 text-sm font-semibold ${palette.grid}`}>Lihat contoh sistem <ChevronDown className="h-4 w-4" /></a>
            </div>
            <div className={`mt-8 flex flex-wrap gap-x-6 gap-y-2 border-t pt-5 text-xs ${palette.grid} ${palette.muted}`}>
              <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-teal-700" />Nilai &amp; pembayaran per proyek</span>
              <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-teal-700" />Arsip penagihan terhubung</span>
              <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-teal-700" />Reminder retensi</span>
            </div>
          </div>
          {/* UI simulasi, bukan tangkapan layar sistem produksi */}
          <div id="tampilan" data-reveal className="pub-reveal pub-glass overflow-hidden rounded-2xl shadow-[0_24px_70px_-36px_rgba(15,23,42,0.5)]">
            <div className={`flex items-center justify-between border-b px-4 py-3 ${palette.grid}`}>
              <div className="flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-md bg-teal-700 text-white"><Building2 className="h-4 w-4" /></span><div><p className={`text-xs font-semibold ${palette.heading}`}>Kontrack / Workspace</p><p className={`text-[10px] ${palette.muted}`}>PT Permata Energi Borneo</p></div></div>
              <span className="rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-800">SIMULASI</span>
            </div>
            <div className="grid grid-cols-3 divide-x divide-slate-200">
              {[
                ['Nilai kontrak', 'Rp 13,32 M', '6 proyek'],
                ['Belum tertagih', 'Rp 2,41 M', '3 termin'],
                ['Retensi berjalan', 'Rp 487 jt', '2 proyek']
              ].map(([label, value, note]) => <div key={label} className="min-w-0 p-3 sm:p-4"><p className={`truncate text-[10px] ${palette.muted}`}>{label}</p><p className={`mt-1 truncate font-display text-sm font-bold sm:text-base ${palette.heading}`}>{value}</p><p className={`mt-1 text-[10px] ${palette.muted}`}>{note}</p></div>)}
            </div>
            <div className="px-4 pb-4">
              <div className="mb-2 flex items-center justify-between"><div><p className={`text-xs font-semibold ${palette.heading}`}>Proyek aktif</p><p className={`text-[10px] ${palette.muted}`}>Ringkasan nilai, pembayaran, dan tenggat</p></div><span className={`inline-flex items-center gap-1 text-[10px] font-medium ${palette.muted}`}><BarChart3 className="h-3 w-3" />3 contoh</span></div>
              <div className={`overflow-hidden rounded-lg border ${palette.grid}`}>
                <div className={`grid grid-cols-[1.4fr_.7fr_.7fr] gap-2 border-b px-3 py-2 text-[9px] font-semibold uppercase ${palette.grid} ${palette.muted}`}><span>Nama proyek</span><span>Nilai</span><span>Progres</span></div>
                {projects.map((p) => <div key={p.name} className={`grid grid-cols-[1.4fr_.7fr_.7fr] items-center gap-2 border-b px-3 py-2 last:border-0 ${palette.grid}`}><div className="min-w-0"><p className={`truncate text-[10px] font-semibold ${palette.heading}`}>{p.name}</p><p className={`truncate text-[9px] ${palette.muted}`}>{p.client}</p></div><p className={`text-[10px] font-medium ${palette.body}`}>{p.value}</p><div><p className={`text-[10px] font-semibold ${palette.body}`}>{p.pct}%</p><div className={`mt-1 h-1 overflow-hidden rounded-full ${palette.soft}`}><div className={`h-full ${p.color}`} style={{ width: `${p.pct}%` }} /></div></div></div>)}
              </div>
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] text-amber-900"><FileCheck2 className="mt-0.5 h-3.5 w-3.5 shrink-0" /><span><strong>Retensi jatuh tempo:</strong> Gedung Serbaguna Baun Bango · 18 hari lagi</span></div>
            </div>
          </div>
        </section>

        {/* Marquee metrik */}
        <section aria-label="Metrik Kontrack" className={`border-y py-4 ${palette.band} ${palette.grid}`}>
          <div className="pub-marquee-mask relative overflow-hidden">
            <div className="pub-marquee flex w-max items-center gap-3">
              {[...marqueeItems, ...marqueeItems].map((item, i) => <span key={i} className={`inline-flex items-center gap-2 whitespace-nowrap text-xs font-medium ${palette.muted}`}><span className="h-1.5 w-1.5 rounded-full bg-teal-700" />{item}</span>)}
            </div>
          </div>
        </section>

        <section id="solusi" className={`border-b py-14 sm:py-16 ${palette.band} ${palette.grid}`}>
          <div className="px-4 sm:px-8 lg:px-14">
            <div className="grid gap-8 lg:grid-cols-[.75fr_1.25fr]">
              <div data-reveal className="pub-reveal"><p className={`text-xs font-semibold uppercase ${palette.badge}`}>Masalah lapangan, konteks kontraktor</p><h2 className={`mt-3 max-w-md font-display text-2xl font-bold leading-snug ${palette.heading}`}>Tagihan terlambat sering dimulai dari informasi yang terpencar.</h2><p className={`mt-3 max-w-md text-sm leading-6 ${palette.body}`}>Ketika berita acara, invoice, bukti pajak, dan biaya proyek tersimpan terpisah, tim sulit melihat apa yang menahan pembayaran.</p></div>
              <div className="grid gap-3 md:grid-cols-3">
                {features.map(({ icon: Icon, title, body }, i) => <article key={title} data-reveal className="pub-glass pub-reveal rounded-2xl p-5" style={{ transitionDelay: `${i * 80}ms` }}><Icon className="h-4 w-4 text-teal-700" /><h3 className={`mt-3 text-sm font-semibold ${palette.heading}`}>{title}</h3><p className={`mt-1.5 text-xs leading-5 ${palette.body}`}>{body}</p></article>)}
              </div>
            </div>
          </div>
        </section>

        <section id="cara-kerja" className="px-4 py-16 sm:px-8 lg:px-14">
          <div data-reveal className="pub-reveal flex flex-wrap items-end justify-between gap-4"><div><p className={`text-xs font-semibold uppercase ${palette.badge}`}>Alur kerja</p><h2 className={`mt-2 font-display text-2xl font-bold ${palette.heading}`}>Dokumen mengikuti proyek, bukan sebaliknya.</h2></div><Link to="/support" className="inline-flex items-center gap-1 text-sm font-semibold text-teal-800">Tanya tim Kontrack <ArrowRight className="h-4 w-4" /></Link></div>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              { n: '01', icon: FolderKanban, title: 'Daftarkan kontrak', text: 'Simpan nilai, jadwal, SPK, PK, mitra, dan pemilik pekerjaan pada data proyek.' },
              { n: '02', icon: FileText, title: 'Catat pekerjaan & biaya', text: 'Hubungkan transaksi, progres, BAHK, WPHO, dan berkas pendukung ke proyek terkait.' },
              { n: '03', icon: ArrowDownToLine, title: 'Tagih dan rekonsiliasi', text: 'Kelola invoice, lampiran, dokumen pajak, setoran, dan jadwal retensi dalam satu alur.' }
            ].map(({ n, icon: Icon, title, text }, i) => <article key={n} data-reveal className="pub-glass pub-reveal rounded-2xl p-5 sm:p-6" style={{ transitionDelay: `${i * 80}ms` }}><div className="flex items-center justify-between"><span className="font-display text-sm font-bold text-teal-800">{n}</span><Icon className="h-4 w-4 text-teal-700" /></div><h3 className={`mt-4 text-sm font-semibold ${palette.heading}`}>{title}</h3><p className={`mt-2 text-sm leading-6 ${palette.body}`}>{text}</p></article>)}
          </div>
        </section>

        <section className={`border-y py-14 ${palette.band} ${palette.grid}`}>
          <div className="grid items-center gap-8 px-4 sm:px-8 md:grid-cols-2 lg:px-14">
            <div data-reveal className="pub-reveal"><p className={`text-xs font-semibold uppercase ${palette.badge}`}>Dibuat untuk alur kerja nyata</p><h2 className={`mt-2 font-display text-2xl font-bold ${palette.heading}`}>Satu proyek. Satu gambaran keuangan. Jejak dokumen yang jelas.</h2><p className={`mt-3 text-sm leading-6 ${palette.body}`}>Pantau penerimaan dan pengeluaran berdasarkan kategori, cari transaksi, urutkan invoice, dan buka arsip penagihan tanpa menebak foldernya.</p><ul className={`mt-5 space-y-2 text-sm ${palette.body}`}>{['Nilai kontrak dibanding pembayaran diterima', 'Transaksi masuk dan keluar per kategori', 'Berkas penagihan terkait invoice dan proyek', 'Tenggat termin dan masa retensi'].map((x) => <li key={x} className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" />{x}</li>)}</ul></div>
            <div data-reveal className="pub-reveal pub-glass rounded-2xl p-5">
              <div className="flex items-center justify-between"><div><p className={`text-xs font-semibold ${palette.heading}`}>Posisi tagihan proyek</p><p className={`mt-1 text-[10px] ${palette.muted}`}>Ilustrasi pemantauan termin</p></div><span className={`rounded-md border p-1.5 ${palette.grid}`}><ArrowUpRight className="h-4 w-4 text-teal-700" /></span></div>
              <div className="mt-5 space-y-4">{[
                ['Kontrak', 100, 'Rp 1.200 jt', 'bg-slate-400'],
                ['Invoice diterbitkan', 72, 'Rp 864 jt', 'bg-teal-700'],
                ['Pembayaran diterima', 48, 'Rp 576 jt', 'bg-emerald-600']
              ].map(([label, pct, amount, color]) => <div key={label}><div className="mb-1.5 flex justify-between text-xs"><span className={palette.body}>{label}</span><span className={`font-semibold ${palette.heading}`}>{amount}</span></div><div className={`h-2 overflow-hidden rounded-sm ${palette.soft}`}><div className={`h-full ${color}`} style={{ width: `${pct}%` }} /></div></div>)}</div>
              <p className={`mt-5 border-t pt-3 text-[10px] leading-4 ${palette.muted} ${palette.grid}`}>Angka dan nama pada tampilan ini adalah simulasi, bukan data pelanggan.</p>
            </div>
          </div>
        </section>

        <section className="px-4 py-16 sm:px-8 lg:px-14">
          <div data-reveal className="pub-reveal pub-glass flex flex-col justify-between gap-6 rounded-2xl p-6 sm:flex-row sm:items-center sm:p-8"><div><div className="flex items-center gap-2 text-teal-800"><ShieldCheck className="h-4 w-4" /><p className="text-xs font-semibold uppercase">Data perusahaan tetap terkontrol</p></div><h2 className={`mt-3 max-w-2xl font-display text-2xl font-bold ${palette.heading}`}>Mulai dari visibilitas yang dibutuhkan tim Anda.</h2><p className={`mt-2 max-w-2xl text-sm leading-6 ${palette.body}`}>Masuk untuk mengelola proyek, pembayaran, invoice, dan kewajiban pajak dalam satu sistem.</p></div><Link to="/login" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-teal-700 px-5 py-3 text-sm font-semibold text-white hover:bg-teal-800">Buka Kontrack <ArrowRight className="h-4 w-4" /></Link></div>
        </section>
      </main>

      <footer className={`border-t py-8 ${palette.band} ${palette.grid}`}>
        <div className="grid gap-6 px-4 sm:px-8 md:grid-cols-[1fr_auto] md:items-center lg:px-14"><div><Logo dark={dark} /><p className={`mt-2 max-w-md text-xs leading-5 ${palette.muted}`}>Kontrack membantu kontraktor menghubungkan operasional proyek, arus kas, dokumen penagihan, dan pajak.</p></div><nav className="flex flex-wrap gap-x-5 gap-y-2 text-xs font-medium"><Link to="/terms" className={palette.body}>Syarat &amp; Ketentuan</Link><Link to="/privacy" className={palette.body}>Kebijakan Privasi</Link><Link to="/support" className={`inline-flex items-center gap-1 ${palette.body}`}><CircleHelp className="h-3.5 w-3.5" />Dukungan</Link></nav><p className={`text-[10px] md:col-span-2 ${palette.muted}`}>© {new Date().getFullYear()} Kontrack. Seluruh hak dilindungi.</p></div>
      </footer>
    </div>
  );
};

export default LandingPage;
