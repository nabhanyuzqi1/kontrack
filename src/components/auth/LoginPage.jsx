import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Zap, LineChart } from 'lucide-react';
import { signInUser, signInWithGoogle } from '../../services/auth';
import Logo from '../brand/Logo';
import Button from '../ui/Button';

const errorMessages = {
  'auth/invalid-email': 'Email tidak valid',
  'auth/user-disabled': 'Akun telah dinonaktifkan',
  'auth/user-not-found': 'Email tidak terdaftar',
  'auth/wrong-password': 'Password salah',
  'auth/invalid-credential': 'Email atau password salah',
  'auth/too-many-requests': 'Terlalu banyak percobaan. Silakan coba lagi nanti'
};

const highlights = [
  { icon: Zap, text: 'Input transaksi otomatis dari screenshot dengan AI' },
  { icon: LineChart, text: 'Laporan keuangan & progres proyek real-time' },
  { icon: ShieldCheck, text: 'Data proyek aman, akses berbasis peran' }
];

const darkInput =
  'w-full rounded-lg border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50';

const LoginPage = ({ onUserLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleGoogle = async () => {
    setGoogleLoading(true);
    setError('');
    try {
      const user = await signInWithGoogle();
      onUserLogin(user);
      navigate(user.role === 'admin' ? '/' : '/projects');
    } catch (err) {
      if (err?.code === 'auth/popup-closed-by-user') {
        setError('');
      } else if (err?.code === 'auth/unauthorized-domain') {
        setError('Domain ini belum diizinkan di Firebase Authentication.');
      } else {
        setError(err?.message || 'Gagal masuk dengan Google. Coba lagi.');
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const user = await signInUser(email, password);
      onUserLogin(user);
      navigate(user.role === 'admin' ? '/' : '/projects');
    } catch (err) {
      setError(errorMessages[err.code] || 'Terjadi kesalahan saat masuk. Coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-navy-950">
      {/* Latar futuristik: mesh gradient + grid */}
      <div className="pointer-events-none absolute inset-0 bg-auth-mesh" />
      <div className="pointer-events-none absolute inset-0 bg-grid-glow" />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col lg:flex-row lg:items-center lg:gap-16 lg:px-8">
        {/* Panel branding */}
        <div className="flex flex-1 flex-col justify-center px-6 pb-8 pt-10 lg:px-0 lg:py-0">
          <Logo dark className="mb-8" />
          <h1 className="max-w-md font-display text-3xl font-bold leading-tight tracking-tight text-white sm:text-4xl">
            Kendalikan proyek dan keuangan <span className="text-gradient">dalam satu platform</span>
          </h1>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-slate-400">
            Kontrack membantu kontraktor memantau nilai proyek, pembayaran, dan arus kas — dari SPK
            pertama sampai serah terima.
          </p>
          <ul className="mt-8 hidden space-y-4 lg:block">
            {highlights.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-sm text-slate-300">
                <span className="rounded-lg bg-brand-600/20 p-2 text-brand-300 ring-1 ring-inset ring-brand-500/30">
                  <Icon className="h-4 w-4" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>

        {/* Kartu form login */}
        <div className="flex flex-1 items-center justify-center px-6 pb-12 lg:px-0 lg:pb-0">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.04] p-8 shadow-2xl backdrop-blur-xl">
            <h2 className="font-display text-xl font-semibold text-white">Masuk ke Kontrack</h2>
            <p className="mt-1 text-sm text-slate-400">
              Gunakan akun yang terdaftar di organisasi Anda
            </p>

            <form onSubmit={handleSubmit} className="mt-7 space-y-5">
              <div>
                <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-300">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={darkInput}
                  placeholder="nama@perusahaan.com"
                  autoComplete="email"
                  required
                  disabled={loading}
                />
              </div>

              <div>
                <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-300">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={darkInput}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                  disabled={loading}
                />
              </div>

              {error && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-300">
                  {error}
                </div>
              )}

              <Button type="submit" variant="gradient" size="lg" loading={loading} className="w-full">
                {loading ? 'Memproses…' : 'Masuk'}
              </Button>
            </form>

            {/* Pemisah + masuk dengan Google */}
            <div className="my-5 flex items-center gap-3">
              <span className="h-px flex-1 bg-white/10" />
              <span className="text-xs text-slate-500">atau</span>
              <span className="h-px flex-1 bg-white/10" />
            </div>

            <button
              type="button"
              onClick={handleGoogle}
              disabled={googleLoading || loading}
              className="flex w-full items-center justify-center gap-3 rounded-lg border border-white/10 bg-white/[0.06] px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-white/10 disabled:opacity-50"
            >
              <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.57c2.08-1.92 3.28-4.74 3.28-8.09Z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.76c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84Z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 1.19 14.97 0 12 0A11 11 0 0 0 2.18 7.05l3.66 2.84c.87-2.6 3.3-4.14 6.16-4.14Z"
                />
              </svg>
              {googleLoading ? 'Menghubungkan…' : 'Masuk dengan Google'}
            </button>

            <p className="mt-6 text-xs leading-relaxed text-slate-500">
              Belum punya akun? Hubungi administrator perusahaan Anda untuk diundang.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
