import React from 'react';

// Header standar halaman: judul + subjudul + tombol aksi di kanan
const PageHeader = ({ title, subtitle, actions, className = '' }) => (
  <div
    className={`mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-center sm:justify-between sm:gap-4 ${className}`}
  >
    <div>
      <h1 className="font-display text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
        {title}
      </h1>
      {subtitle && <p className="mt-0.5 text-sm text-slate-500 sm:mt-1">{subtitle}</p>}
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
  </div>
);

export default PageHeader;
