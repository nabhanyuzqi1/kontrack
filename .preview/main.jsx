import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import AppLayout from '../src/components/layout/AppLayout.jsx';
import ProjectList from '../src/components/projects/ProjectList.jsx';
import Reports from '../src/components/reports/Reports.jsx';
import Dashboard from '../src/components/dashboard/Dashboard.jsx';
import ClientsPage from '../src/components/clients/ClientsPage.jsx';
import InvoicesPage from '../src/components/invoices/InvoicesPage.jsx';
import TaxInvoicesPage from '../src/components/invoices/TaxInvoicesPage.jsx';
import SettingsPage from '../src/components/settings/SettingsPage.jsx';
import '../src/styles/globals.css';

// Pratinjau seluruh halaman supaya audit kontras/overlap mencakup aplikasi
// sebenarnya, bukan cuma halaman yang kebetulan sudah ada di sini.
const PAGES = [
  { key: 'projects', label: 'Proyek', el: <ProjectList /> },
  { key: 'reports', label: 'Laporan', el: <Reports /> },
  { key: 'dashboard', label: 'Dashboard', el: <Dashboard /> },
  { key: 'clients', label: 'Klien', el: <ClientsPage /> },
  { key: 'invoices', label: 'Invoice', el: <InvoicesPage /> },
  { key: 'tax', label: 'Faktur Pajak', el: <TaxInvoicesPage /> },
  { key: 'settings', label: 'Pengaturan', el: <SettingsPage /> }
];

const user = { role: 'admin', email: 'demo@kontrack.id', name: 'Nabhan Yuzqi' };

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
        {React.cloneElement(active.el, { currentUser: user })}
      </AppLayout>
    </MemoryRouter>
  );
};

createRoot(document.getElementById('root')).render(<Harness />);
