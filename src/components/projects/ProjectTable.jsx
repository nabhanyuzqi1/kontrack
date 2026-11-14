// src/components/projects/ProjectTable.jsx
// Tampilan tabel proyek: baris rapat ala ERP — informasi dipadatkan per baris,
// angka rata kanan dengan tabular numerals, status dan tenggat mudah discan
// vertikal. Ini default daftar proyek; grid kartu tetap tersedia lewat toggle.
import React from 'react';
import { Link } from 'react-router-dom';
import { Link2, PenLine, Trash2, AlertCircle } from 'lucide-react';
import {
  formatCurrency,
  calculateProjectProgress,
  calculateDaysLeft
} from '../../utils/formatters';
import { StatusBadge } from '../ui/Badge';

const shortDate = (d) =>
  new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: '2-digit' });

const ProjectTable = ({ project, onEdit, onDelete, currentUser }) => {
  const progress = calculateProjectProgress(project);
  const daysLeft = calculateDaysLeft(project.endDate);
  const value = Number(project.value) || 0;
  const paid = Number(project.paidAmount) || 0;
  const isAdmin = currentUser && currentUser.role === 'admin';
  const isOngoing = project.status === 'ongoing';

  const stop = (e) => {
    e.stopPropagation();
    e.preventDefault();
  };

  const copyProjectLink = (e) => {
    stop(e);
    navigator.clipboard
      .writeText(`${window.location.origin}/projects/${project.id}`)
      .then(() => alert('Link proyek berhasil disalin!'))
      .catch((err) => console.error('Failed to copy', err));
  };

  return (
    <tr className="group cursor-pointer border-b border-slate-200/60 transition-colors last:border-0 hover:bg-slate-100/50 dark:border-white/5 dark:hover:bg-white/[0.04]">
      {/* Proyek + mitra */}
      <td className="max-w-[260px] px-3 py-2.5 sm:px-4">
        <Link to={`/projects/${project.id}`} className="block">
          <p className="truncate text-sm font-semibold text-slate-900 group-hover:text-brand-700">
            {project.name}
          </p>
          <p className="truncate text-xs text-slate-400">{project.partner}</p>
        </Link>
      </td>

      {/* No. SPK */}
      <td className="hidden tnum whitespace-nowrap px-3 py-2.5 text-xs text-slate-500 lg:table-cell">
        {project.contractNumber || '—'}
      </td>

      {/* Nilai kontrak */}
      <td className="tnum whitespace-nowrap px-3 py-2.5 text-right text-sm font-semibold text-slate-900">
        {formatCurrency(value)}
      </td>

      {/* Terbayar + progress */}
      <td className="hidden px-3 py-2.5 md:table-cell">
        <div className="min-w-[110px]">
          <div className="flex items-baseline justify-between gap-2 text-xs">
            <span className="tnum text-slate-500">{formatCurrency(paid)}</span>
            <span className="tnum font-semibold text-slate-700">{progress}%</span>
          </div>
          <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-slate-200/70">
            <div
              className="h-full rounded-full bg-brand-gradient transition-all duration-500"
              style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }}
            />
          </div>
        </div>
      </td>

      {/* Tenggat */}
      <td className="hidden whitespace-nowrap px-3 py-2.5 text-xs sm:table-cell">
        <span className="text-slate-500">{shortDate(project.endDate)}</span>
        {isOngoing && daysLeft < 30 && (
          <span
            className={`ml-1.5 inline-flex items-center gap-0.5 font-medium ${
              daysLeft < 0 ? 'text-red-600' : 'text-amber-600'
            }`}
          >
            {daysLeft < 0 && <AlertCircle className="h-3 w-3" />}
            {daysLeft < 0 ? `${Math.abs(daysLeft)}h lewat` : `${daysLeft}h`}
          </span>
        )}
      </td>

      {/* Status */}
      <td className="px-3 py-2.5">
        <StatusBadge status={project.status} />
      </td>

      {/* Aksi */}
      <td className="whitespace-nowrap px-3 py-2.5 text-right">
        <div className="flex items-center justify-end gap-0.5">
          <button
            onClick={copyProjectLink}
            title="Salin link proyek"
            className="rounded-lg p-1.5 text-slate-400 opacity-100 transition-colors hover:bg-slate-100 hover:text-brand-700 md:opacity-0 md:group-hover:opacity-100"
          >
            <Link2 className="h-4 w-4" />
          </button>
          {isAdmin && onEdit && (
            <button
              onClick={(e) => {
                stop(e);
                onEdit(project);
              }}
              title="Edit proyek"
              className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 md:opacity-0 md:group-hover:opacity-100"
            >
              <PenLine className="h-4 w-4" />
            </button>
          )}
          {isAdmin && onDelete && (
            <button
              onClick={(e) => {
                stop(e);
                onDelete(project);
              }}
              title="Hapus proyek"
              className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-500/10 hover:text-red-500 md:opacity-0 md:group-hover:opacity-100"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
};

const ProjectTableList = ({ projects, onEdit, onDelete, currentUser }) => (
  <div className="overflow-hidden rounded-[10px] ring-1 ring-inset ring-slate-200/70 dark:ring-white/10">
    <table className="w-full">
      <thead>
        <tr className="border-b border-slate-200/70 bg-slate-100/60 text-left text-[11px] uppercase tracking-wide text-slate-400 dark:border-white/10 dark:bg-white/[0.03]">
          <th className="px-3 py-2 font-medium sm:px-4">Proyek</th>
          <th className="hidden px-3 py-2 font-medium lg:table-cell">No. SPK</th>
          <th className="px-3 py-2 text-right font-medium">Nilai</th>
          <th className="hidden px-3 py-2 font-medium md:table-cell">Terbayar</th>
          <th className="hidden px-3 py-2 font-medium sm:table-cell">Tenggat</th>
          <th className="px-3 py-2 font-medium">Status</th>
          <th className="px-3 py-2" />
        </tr>
      </thead>
      <tbody>
        {projects.map((p) => (
          <ProjectTable
            key={p.id}
            project={p}
            onEdit={onEdit}
            onDelete={onDelete}
            currentUser={currentUser}
          />
        ))}
      </tbody>
    </table>
  </div>
);

export default ProjectTableList;
