// src/App.jsx
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChange } from './services/auth';
import AppLayout from './components/layout/AppLayout';
import LoginPage from './components/auth/LoginPage';
import Dashboard from './components/dashboard/Dashboard';
import ProjectList from './components/projects/ProjectList';
import ProjectDetail from './components/projects/ProjectDetail';
import Reports from './components/reports/Reports';
import SettingsPage from './components/settings/SettingsPage';
import InvoicesPage from './components/invoices/InvoicesPage';
import ClientsPage from './components/clients/ClientsPage';
import { LogoMark } from './components/brand/Logo';
import { applyTheme, getCachedTheme } from './utils/themes';
import { getCompanySettings, getThemeFromSettings } from './services/settings';
import './styles/globals.css';

// Tema dari cache lokal terpasang sebelum render pertama (hindari flash warna default)
applyTheme(getCachedTheme());

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
      if (settings) applyTheme(getThemeFromSettings(settings));
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

  return (
    <Router>
      <Routes>
        {/* Halaman login berdiri sendiri (dark, tanpa shell aplikasi) */}
        <Route
          path="/login"
          element={
            currentUser ? (
              <Navigate to={isAdmin ? '/' : '/projects'} replace />
            ) : (
              <LoginPage onUserLogin={setCurrentUser} />
            )
          }
        />

        {/* Semua halaman lain memakai shell sidebar */}
        <Route
          path="*"
          element={
            <AppLayout currentUser={currentUser}>
              <Routes>
                <Route
                  path="/"
                  element={
                    <RequireAuth user={currentUser}>
                      {isAdmin ? (
                        <Dashboard currentUser={currentUser} />
                      ) : (
                        <Navigate to="/projects" replace />
                      )}
                    </RequireAuth>
                  }
                />
                <Route
                  path="/projects"
                  element={
                    <RequireAuth user={currentUser}>
                      <ProjectList currentUser={currentUser} />
                    </RequireAuth>
                  }
                />
                {/* Terbuka via link langsung — jalur share ke mitra */}
                <Route path="/projects/:id" element={<ProjectDetail currentUser={currentUser} />} />
                <Route
                  path="/reports"
                  element={
                    <RequireAuth user={currentUser}>
                      <Reports currentUser={currentUser} />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/invoices"
                  element={isAdmin ? <InvoicesPage /> : <Navigate to="/login" replace />}
                />
                <Route
                  path="/clients"
                  element={isAdmin ? <ClientsPage /> : <Navigate to="/login" replace />}
                />
                <Route
                  path="/settings"
                  element={isAdmin ? <SettingsPage /> : <Navigate to="/login" replace />}
                />
                <Route
                  path="*"
                  element={<Navigate to={currentUser ? (isAdmin ? '/' : '/projects') : '/login'} replace />}
                />
              </Routes>
            </AppLayout>
          }
        />
      </Routes>
    </Router>
  );
}

export default App;
