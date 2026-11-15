// src/components/legal/PublicInfoPage.jsx
// Halaman publik (privasi, syarat, bantuan) tanpa shell aplikasi: bisa dibuka
// dari landing maupun penyedia OAuth. Isi sengaja memakai token navy/gelap yang
// sama dengan landing supaya tidak perlu kredensial untuk dibaca.
import React from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, ScrollText, LifeBuoy } from 'lucide-react';
import Logo from '../brand/Logo';

const PAGES = {
  privacy: {
    icon: ShieldCheck,
    title: 'Kebijakan Privasi',
    updated: '15 November 2026',
    intro:
      'Kontrack mengelola data proyek, keuangan, dan dokumen pajak milik organisasi pengguna. Kebijakan ini menjelaskan data apa yang disimpan dan bagaimana aksesnya dibatasi.',
    sections: [
      {
        heading: 'Data yang diproses',
        items: [
          'Data akun: nama, email, dan peran (administrator atau anggota).',
          'Data operasional: proyek, mitra, invoice, transaksi, dokumen pajak, dan lampiran yang diunggah.',
          'Data teknis: log pemakaian fitur AI dan penghitung kuota harian per pengguna.'
        ]
      },
      {
        heading: 'Akses dan pembatasan peran',
        items: [
          'Modul keuangan, invoice, pajak, klien, dan pengaturan hanya dapat dibuka administrator.',
          'Aturan akses ditegakkan di server melalui Firestore Rules dan Cloud Functions.'
        ]
      },
      {
        heading: 'Penyimpanan dan lokasi',
        items: [
          'Data disimpan di Google Cloud region asia-southeast2 (Jakarta) melalui Firebase.',
          'Berkas lampiran disimpan di Cloud Storage pada proyek yang sama.'
        ]
      },
      {
        heading: 'Layanan pihak ketiga',
        items: [
          'Google Firebase untuk autentikasi, basis data, dan penyimpanan.',
          'Google Gemini (Vertex AI) hanya menerima data yang Anda kirim untuk dianalisis saat fitur AI dipicu.'
        ]
      }
    ]
  },
  terms: {
    icon: ScrollText,
    title: 'Syarat Layanan',
    updated: '15 November 2026',
    intro:
      'Dengan menggunakan Kontrack, organisasi Anda menyetujui ketentuan berikut.',
    sections: [
      {
        heading: 'Akun dan tanggung jawab pengguna',
        items: [
          'Kredensial akun bersifat pribadi dan tidak boleh dibagikan.',
          'Administrator bertanggung jawab atas peran pengguna yang ditambahkan ke organisasinya.',
          'Data yang dimasukkan harus benar dan berhak diproses oleh organisasi Anda.'
        ]
      },
      {
        heading: 'Kewajiban perpajakan',
        items: [
          'Dokumen pajak dan ekspor CoreTax yang dihasilkan Kontrack adalah alat bantu; kebenaran pelaporan tetap tanggung jawab wajib pajak.',
          'Nilai PPN mengikuti PMK 131/2024 (DPP Nilai Lain) dan wajib diperiksa terhadap dokumen resmi.'
        ]
      },
      {
        heading: 'Ketersediaan layanan',
        items: [
          'Layanan dapat dihentikan sementara untuk pemeliharaan dengan pemberitahuan sebelumnya bila memungkinkan.',
          'Fitur AI memiliki kuota harian per pengguna dan dapat dinonaktifkan tanpa mengubah data Anda.'
        ]
      }
    ]
  },
  support: {
    icon: LifeBuoy,
    title: 'Bantuan',
    updated: '15 November 2026',
    intro:
      'Kendala masuk, data tidak muncul, atau pertanyaan lain: hubungi administrator organisasi Anda lebih dulu, lalu tim Kontrack.',
    sections: [
      {
        heading: 'Sebelum menghubungi',
        items: [
          'Muat ulang halaman dan pastikan koneksi jaringan stabil.',
          'Untuk masalah login Google, pastikan akun memakai email organisasi yang terdaftar.',
          'Sertakan alamat halaman (misalnya /app/projects) dan waktu kejadian saat melapor.'
        ]
      },
      {
        heading: 'Kontak',
        items: [
          'Hubungi administrator organisasi Anda melalui menu Pengaturan di dalam aplikasi.',
          'Admin dapat meneruskan laporan ke pengelola Kontrack beserta alamat halaman dan waktu kejadian.',
          'Jam respons: Senin sampai Jumat, 08.00–17.00 WIB.'
        ]
      }
    ]
  }
};

const PublicInfoPage = ({ page }) => {
  const content = PAGES[page];
  if (!content) return <Navigate to="/" replace />;
  const Icon = content.icon;

  return (
    <div className="min-h-screen bg-navy-950 text-slate-300">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-navy-950/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-2" aria-label="Beranda Kontrack">
            <Logo dark />
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Beranda
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 pb-24 pt-14">
        <span className="inline-flex rounded-xl bg-brand-600/20 p-3 text-brand-300 ring-1 ring-inset ring-brand-500/30">
          <Icon className="h-5 w-5" />
        </span>
        <h1 className="mt-4 font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
          {content.title}
        </h1>
        <p className="mt-2 text-xs uppercase tracking-wide text-slate-500">
          Diperbarui {content.updated}
        </p>
        <p className="mt-6 max-w-2xl text-sm leading-relaxed text-slate-400">{content.intro}</p>

        <div className="mt-10 space-y-8">
          {content.sections.map((section) => (
            <section key={section.heading}>
              <h2 className="font-display text-base font-semibold text-white">{section.heading}</h2>
              <ul className="mt-3 space-y-2 text-sm leading-relaxed text-slate-400">
                {section.items.map((item) => (
                  <li key={item} className="flex gap-2.5">
                    <span aria-hidden="true" className="mt-2 h-1 w-1 shrink-0 rounded-full bg-brand-500" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <div className="mt-12 flex flex-wrap gap-3 border-t border-white/10 pt-6 text-sm">
          <Link to="/login" className="rounded-lg bg-brand-600 px-4 py-2 font-semibold text-white transition-colors hover:bg-brand-500">
            Masuk ke Kontrack
          </Link>
          {page !== 'support' ? (
            <Link
              to="/support"
              className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-4 py-2 font-medium text-slate-200 transition-colors hover:bg-white/5"
            >
              <LifeBuoy className="h-4 w-4" />
              Bantuan
            </Link>
          ) : (
            <Link
              to="/privacy"
              className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-4 py-2 font-medium text-slate-200 transition-colors hover:bg-white/5"
            >
              <ShieldCheck className="h-4 w-4" />
              Kebijakan Privasi
            </Link>
          )}
        </div>
      </main>

      <footer className="border-t border-white/5 py-8 text-center text-xs text-slate-500">
        Kontrack — manajemen proyek &amp; keuangan kontraktor
      </footer>
    </div>
  );
};

export default PublicInfoPage;
