import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import AppLayout from '../src/components/layout/AppLayout.jsx';
import ProjectList from '../src/components/projects/ProjectList.jsx';
import Reports from '../src/components/reports/Reports.jsx';
import Dashboard from '../src/components/dashboard/Dashboard.jsx';
import ClientsPage from '../src/components/clients/ClientsPage.jsx';
import InvoicesPage from '../src/components/invoices/InvoicesPage.jsx';
import TaxInvoicesPage from '../src/components/invoices/TaxInvoicesPage.jsx';
import SettingsPage from '../src/components/settings/SettingsPage.jsx';
import DeveloperPage from '../src/components/developer/DeveloperPage.jsx';
import ProjectDetail from '../src/components/projects/ProjectDetail.jsx';
import AITransactionModal from '../src/components/transactions/AITransactionModal.jsx';
import { projects } from './mock/data.js';
import '../src/styles/globals.css';

// Membuka AITransactionModal dengan data proyek sungguhan dari mock.
const AIHarness = () => (
  <AITransactionModal
    isOpen
    onClose={() => {}}
    onSuccess={() => {}}
    projects={projects}
    currentUser={{ uid: 'u1', email: 'demo@kontrack.id' }}
  />
);

// Pratinjau seluruh halaman supaya audit kontras/overlap mencakup aplikasi
// sebenarnya, bukan cuma halaman yang kebetulan sudah ada di sini.
const PAGES = [
  { key: 'projects', label: 'Proyek', el: <ProjectList /> },
  { key: 'project-detail', label: 'Detail Proyek', el: null },
  { key: 'reports', label: 'Laporan', el: <Reports /> },
  { key: 'dashboard', label: 'Dashboard', el: <Dashboard /> },
  { key: 'clients', label: 'Klien', el: <ClientsPage /> },
  { key: 'invoices', label: 'Invoice', el: <InvoicesPage /> },
  { key: 'tax', label: 'Faktur Pajak', el: <TaxInvoicesPage /> },
  { key: 'settings', label: 'Pengaturan', el: <SettingsPage /> },
  { key: 'developer', label: 'Developer', el: <DeveloperPage /> },
  // Modal butuh state terbuka; dibungkus komponen kecil di bawah.
  { key: 'ai-input', label: 'Input AI', el: <AIHarness /> }
];

const user = { role: 'admin', email: 'demo@kontrack.id', name: 'Nabhan Yuzqi' };
const developerUser = { role: 'superadmin', email: 'dev@kontrack.id', name: 'Developer Platform' };

// MemoryRouter dengan initialEntries '/projects': perilaku yang bergantung pada
// path (mis. pencarian yang hanya menyaring di halaman Proyek) tidak bisa
// diverifikasi kalau harness berada di '/'.
const Harness = () => {
  const [page, setPage] = useState('projects');
  const active = PAGES.find((p) => p.key === page);

  return (
    <MemoryRouter initialEntries={['/projects']}>
      <AppLayout currentUser={user}>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="rounded-full glass-3 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Pratinjau
          </span>
          {PAGES.map((p) => (
            <button
              key={p.key}
              data-preview-nav={p.key}
              onClick={() => setPage(p.key)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                page === p.key
                  ? 'bg-brand-600 text-white'
                  : 'glass-3 text-slate-600 hover:text-slate-900'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        {/* ProjectDetail membaca id dari useParams, bukan prop: harus dirender
            lewat Route agar jalur detail proyek (dan hook-nya) benar-benar diuji. */}
        {active.key === 'project-detail' ? (
          <Routes location={{ pathname: '/projects/p1' }}>
            <Route path="/projects/:id" element={<ProjectDetail currentUser={user} />} />
            <Route path="*" element={<ProjectDetail currentUser={user} />} />
          </Routes>
        ) : (
          React.cloneElement(active.el, {
            currentUser: active.key === 'developer' ? developerUser : user
          })
        )}
      </AppLayout>
    </MemoryRouter>
  );
};

createRoot(document.getElementById('root')).render(<Harness />);
