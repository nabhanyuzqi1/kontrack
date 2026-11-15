// src/components/landing/LandingPage.jsx
// Landing page publik ala situs ERP SaaS modern: nav tetap, hero + CTA,
// deret fitur, alur kerja, dan CTA akhir. Semua elemen memakai token warna
// yang di-remap (navy-* untuk latar gelap) supaya konsisten light/dark.
import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  FileSignature,
  FolderKanban,
  Landmark,
  ShieldCheck,
  Wallet,
  Zap
} from 'lucide-react';
import Logo from '../brand/Logo';

const FEATURES = [
  {
    icon: FolderKanban,
    title: 'Manajemen Proyek',
    desc: 'Pantau SPK, PK, termin, retensi, dan progres pembayaran tiap proyek konstruksi dalam satu layar.'
  },
  {
    icon: FileSignature,
    title: 'Invoice & Penagihan',
    desc: 'Buat invoice dari WPHO/BAHK, tandai revisi bernomor, kirim email penagihan lengkap dengan lampiran.'
  },
  {
    icon: Landmark,
    title: 'Kepatuhan Pajak',
    desc: 'Alur faktur pajak sampai NTPN, PPN DPP Nilai Lain (PMK 131/2024), dan ekspor XML CoreTax siap unggah.'
  },
  {
    icon: Wallet,
    title: 'Keuangan Real-time',
    desc: 'Arus kas, piutang termin, dana retensi tertahan, dan laba per proyek — terhitung otomatis.'
  },
  {
    icon: Zap,
    title: 'Input AI',
    desc: 'Unggah foto atau scan dokumen; AI mengekstrak nilai transaksi dan nomor dokumen untuk Anda.'
  },
  {
    icon: ShieldCheck,
    title: 'Akses Berbasis Peran',
    desc: 'Admin penuh kendali, staf terbatas, mitra hanya melihat proyek mereka melalui link berbagi.'
  }
];

const STEPS = [
  { n: '01', title: 'Daftarkan proyek', desc: 'Kontrak, SPK, PK, dan nilai termin masuk sekali.' },
  { n: '02', title: 'Catat & kumpulkan berkas', desc: 'Transaksi, WPHO, dan BAHK terarsip digital otomatis.' },
  { n: '03', title: 'Tagih & laporkan', desc: 'Email penagihan lengkap, faktur pajak, laporan PDF instan.' }
];

const LandingPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-navy-950 text-slate-200">
      {/* Nav */}
      <header className="sticky top-0 z-20 border-b border-white/10 bg-navy-950/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Logo dark />
          <nav className="flex items-center gap-3">
            <button
              onClick={() => navigate('/login')}
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:text-white"
            >
              Masuk
            </button>
            <button
              onClick={() => navigate('/login')}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-500"
            >
              Coba Sekarang
            </button>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pb-20 pt-20 text-center">
        <p className="mb-4 inline-block rounded-full border border-brand-500/30 bg-brand-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand-300">
          ERP untuk kontraktor Indonesia
        </p>
        <h1 className="mx-auto max-w-3xl font-display text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl">
          Dari SPK sampai termin, <span className="text-gradient">tanpa kehilangan kendali</span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-slate-400">
          Kontrack menyatukan proyek, keuangan, penagihan, dan pajak konstruksi — dirancang
          untuk mengatasi jeda arus kas yang paling sering menyakitkan kontraktor.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={() => navigate('/login')}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-500"
          >
            Mulai Gratis
            <ArrowRight className="h-4 w-4" />
          </button>
          <button
            onClick={() => navigate('/login')}
            className="rounded-lg border border-white/15 px-6 py-3 text-sm font-medium text-slate-200 transition-colors hover:bg-white/5"
          >
            Lihat Demo
          </button>
        </div>
      </section>

      {/* Fitur */}
      <section className="border-t border-white/5 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-center font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Semua yang dibutuhkan tim konstruksi
          </h2>
          <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition-colors hover:border-brand-500/40"
              >
                <span className="inline-block rounded-xl bg-brand-600/20 p-3 text-brand-300 ring-1 ring-inset ring-brand-500/30">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 font-display text-base font-semibold text-white">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Alur kerja */}
      <section className="border-t border-white/5 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-center font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Mulai jadi teratur dalam tiga langkah
          </h2>
          <div className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} className="text-center sm:text-left">
                <p className="font-display text-3xl font-bold text-brand-500/60">{s.n}</p>
                <h3 className="mt-2 font-display text-base font-semibold text-white">{s.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-400">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA akhir */}
      <section className="border-t border-white/5 py-20">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <BarChart3 className="mx-auto h-8 w-8 text-brand-400" />
          <h2 className="mt-4 font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Berhenti menggulir spreadsheet, mulai menagih tepat waktu
          </h2>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {['Arus kas jelas', 'Retensi terpantau', 'Pajak tertangani', 'Laporan sekali klik'].map((t) => (
              <span key={t} className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                {t}
              </span>
            ))}
          </div>
          <button
            onClick={() => navigate('/login')}
            className="mt-8 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-8 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-500"
          >
            Masuk ke Kontrack
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </section>

      <footer className="border-t border-white/5 py-8 text-center text-xs text-slate-500">
        Kontrack — manajemen proyek &amp; keuangan kontraktor
      </footer>
    </div>
  );
};

export default LandingPage;
