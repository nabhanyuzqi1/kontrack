import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import AppLayout from '../src/components/layout/AppLayout.jsx';
import ProjectList from '../src/components/projects/ProjectList.jsx';
import Reports from '../src/components/reports/Reports.jsx';
import Dashboard from '../src/components/dashboard/Dashboard.jsx';
import '../src/styles/globals.css';

// Pratinjau beberapa halaman sekaligus supaya shell, kartu, dan laporan bisa
// diperiksa dalam satu sesi tanpa login.
const PAGES = [
  { key: 'projects', label: 'Proyek', el: <ProjectList /> },
  { key: 'reports', label: 'Laporan', el: <Reports /> },
  { key: 'dashboard', label: 'Dashboard', el: <Dashboard /> }
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

