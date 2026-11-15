// src/App.jsx
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { onAuthStateChange } from './services/auth';
import AppLayout from './components/layout/AppLayout';
import LoginPage from './components/auth/LoginPage';
import LandingPage from './components/landing/LandingPage';
import PublicInfoPage from './components/legal/PublicInfoPage';
import Dashboard from './components/dashboard/Dashboard';
import ProjectList from './components/projects/ProjectList';
import ProjectDetail from './components/projects/ProjectDetail';
import Reports from './components/reports/Reports';
import SettingsPage from './components/settings/SettingsPage';
import InvoicesPage from './components/invoices/InvoicesPage';
import TaxInvoicesPage from './components/invoices/TaxInvoicesPage';
import ClientsPage from './components/clients/ClientsPage';
import { LogoMark } from './components/brand/Logo';
import { applyTheme, getCachedTheme } from './utils/themes';
import { getCompanySettings, getThemeFromSettings } from './services/settings';
import { resolveMode, applyMode } from './utils/colorMode';
import './styles/globals.css';

// Mode dipasang lebih dulu: tema butuh tahu mode mana yang aktif.
const initialMode = resolveMode();
applyMode(initialMode);
// Tema dari cache lokal terpasang sebelum render pertama (hindari flash warna default)
applyTheme(getCachedTheme(), initialMode);

const SplashScreen = () => (
  <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-navy-950">
    <LogoMark className="h-12 w-12 animate-pulse" />
    <p className="text-sm text-slate-500">Memuat Kontrack…</p>
  </div>
);

// Aplikasi wajib login. Pengecualian sadar satu-satunya: /projects/:id tetap bisa
// diakses via link langsung untuk fitur share ke mitra (WhatsApp/Salin Link) —
// akan diganti share-token saat multi-tenant (Fase 2).
const RequireAuth = ({ user, children }) => {
  if (!user) return <Navigate to="/login" replace />;
  return children;
};

// Tujuan selalu berasal dari path lokal; query dan hash tautan lama dipertahankan.
const LegacyRedirect = () => {
  const { pathname, search, hash } = useLocation();
  return <Navigate to={`/app${pathname}${search}${hash}`} replace />;
};

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Jaring pengaman: bila SDK auth tak pernah emit (jaringan mati), jangan
    // biarkan pengguna terjebak di splash screen selamanya.
    const failSafe = setTimeout(() => setLoading(false), 10000);

    const unsubscribe = onAuthStateChange((user) => {
      clearTimeout(failSafe);
      setCurrentUser(user);
      setLoading(false);
    });

    // Sinkronkan tema tersimpan dari Firestore (menimpa cache bila berbeda)
    getCompanySettings().then((settings) => {
      if (settings) applyTheme(getThemeFromSettings(settings), resolveMode());
    });

    return () => {
      clearTimeout(failSafe);
      unsubscribe();
    };
  }, []);

  if (loading) {
    return <SplashScreen />;
  }

  const isAdmin = currentUser?.role === 'admin';
  const home = isAdmin ? '/app' : '/app/projects';
  // Halaman admin: tamu ke login, anggota dikembalikan ke daftar proyek mereka.
  const adminOnly = (page) => (currentUser
    ? isAdmin ? page : <Navigate to="/app/projects" replace />
    : <Navigate to="/login" replace />);

  return (
    <Router>
      <Routes>
        {/* Akar selalu landing, termasuk untuk pengguna yang sudah masuk */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/welcome" element={<Navigate to="/" replace />} />
        <Route path="/privacy" element={<PublicInfoPage page="privacy" />} />
        <Route path="/terms" element={<PublicInfoPage page="terms" />} />
        <Route path="/support" element={<PublicInfoPage page="support" />} />
        <Route
          path="/login"
          element={
            loading ? <SplashScreen /> : currentUser
              ? <Navigate to={home} replace />
              : <LoginPage onUserLogin={setCurrentUser} />
          }
        />

        {/* URL lama: dialihkan utuh ke /app agar tautan dan bookmark tetap hidup */}
        {['projects', 'reports', 'invoices', 'tax-invoices', 'clients', 'settings'].map((p) => (
          <Route key={p} path={`/${p}/*`} element={<LegacyRedirect />} />
        ))}

        {/* Shell aplikasi */}
        <Route
          path="/app/*"
          element={loading ? <SplashScreen /> : (
            <AppLayout currentUser={currentUser}>
              <Routes>
                <Route
                  index
                  element={
                    <RequireAuth user={currentUser}>
                      {isAdmin ? <Dashboard currentUser={currentUser} /> : <Navigate to="/app/projects" replace />}
                    </RequireAuth>
                  }
                />
                <Route
                  path="projects"
                  element={<RequireAuth user={currentUser}><ProjectList currentUser={currentUser} /></RequireAuth>}
                />
                {/* Terbuka lewat tautan langsung — jalur share ke mitra (ganti share-token di Fase 2) */}
                <Route path="projects/:id" element={<ProjectDetail currentUser={currentUser} />} />
                <Route
                  path="reports"
                  element={<RequireAuth user={currentUser}><Reports currentUser={currentUser} /></RequireAuth>}
                />
                <Route path="invoices" element={adminOnly(<InvoicesPage />)} />
                <Route path="tax-invoices" element={adminOnly(<TaxInvoicesPage />)} />
                <Route path="clients" element={adminOnly(<ClientsPage />)} />
                <Route path="settings" element={adminOnly(<SettingsPage currentUser={currentUser} />)} />
                <Route path="*" element={<Navigate to={currentUser ? home : '/login'} replace />} />
              </Routes>
            </AppLayout>
          )}
        />

        {/* Path tak dikenal dikembalikan ke landing, bukan ke halaman kosong */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
