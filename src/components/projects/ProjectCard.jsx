// src/components/projects/ProjectCard.jsx
// Kartu proyek untuk grid. Desain datar satu tingkat: hierarki lewat
// tipografi + garis tipis, tanpa panel kotak-dalam-kotak. Angka utama
// (nilai kontrak) diberi bobot terbesar; angka pendukung sejajar di
// bawahnya supaya mudah dibandingkan antar-kartu.
import React from 'react';
import { Link } from 'react-router-dom';
import { Link2, PenLine, Trash2, AlertCircle, ChevronRight } from 'lucide-react';
import {
  formatCurrency,
  calculateProjectProgress,
  calculateDaysLeft
} from '../../utils/formatters';
import { StatusBadge } from '../ui/Badge';

const shortDate = (d) =>
  new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: '2-digit' });

const ProjectCard = ({ project, onEdit, onDelete, currentUser }) => {
  const progress = calculateProjectProgress(project);
  const daysLeft = calculateDaysLeft(project.endDate);
  const isAdmin = currentUser && currentUser.role === 'admin';

  const value = Number(project.value) || 0;
  const paid = Number(project.paidAmount) || 0;
  const outstanding = Math.max(value - paid, 0);
  const isOngoing = project.status === 'ongoing';

  const stop = (e) => {
    e.stopPropagation();
    e.preventDefault();
  };

  const copyProjectLink = (e) => {
    stop(e);
    navigator.clipboard
      .writeText(`${window.location.origin}/app/projects/${project.id}`)
      .then(() => alert('Link proyek berhasil disalin!'))
      .catch((err) => console.error('Failed to copy:', err));
  };

  return (
    <Link to={`/app/projects/${project.id}`} className="group block h-full">
      <article className="flex h-full flex-col glass-2 glass-hover p-5 hover:border-brand-300">
        {/* Kepala: judul + status */}
        <div className="flex items-start justify-between gap-3">
          <h3 className="line-clamp-2 font-display text-[15px] font-bold leading-snug text-slate-900 transition-colors group-hover:text-brand-700 dark:group-hover:text-brand-300">
            {project.name}
          </h3>
          <StatusBadge status={project.status} className="shrink-0" />
        </div>

        {/* Nilai kontrak — angka utama kartu */}
        <p className="tnum mt-3 font-display text-xl font-bold tracking-tight text-slate-900">
          {formatCurrency(value)}
        </p>
        <p className="mt-0.5 truncate text-xs text-slate-400">{project.partner}</p>

        {/* Progress pembayaran */}
        <div className="mt-3">
          <div className="flex items-baseline justify-between gap-2 text-xs">
            <span className="text-slate-500">
              Terbayar{' '}
              <span className="tnum font-semibold text-slate-700">{formatCurrency(paid)}</span>
            </span>
            <span className="tnum font-display text-sm font-bold text-slate-700">{progress}%</span>
          </div>
          <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-slate-200/60 dark:bg-white/10">
            <div
              className="h-full rounded-full bg-brand-gradient transition-all duration-500"
              style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }}
            />
          </div>
          <p className="mt-1.5 text-xs text-slate-500">
            {outstanding > 0 ? (
              <>
                Sisa tagihan{' '}
                <span className="tnum font-medium text-slate-700">{formatCurrency(outstanding)}</span>
              </>
            ) : (
              <span className="font-medium text-emerald-600 dark:text-emerald-400">
                Pembayaran lunas
              </span>
            )}
          </p>
        </div>

        {/* Kaki: tenggat + aksi */}
        <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-200/70 pt-3 dark:border-white/10">
          <span className="flex min-w-0 items-center gap-1.5 text-xs text-slate-400">
            {isOngoing && daysLeft <= 30 && (
              <AlertCircle
                className={`h-3.5 w-3.5 shrink-0 ${daysLeft < 0 ? 'text-red-500' : 'text-amber-500'}`}
              />
            )}
            <span className="tnum truncate">
              {shortDate(project.startDate)} – {shortDate(project.endDate)}
            </span>
          </span>

          <div className="flex shrink-0 items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={copyProjectLink}
              title="Salin link proyek"
              className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-brand-700"
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
                className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
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
                className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-500/10 hover:text-red-500"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
            <ChevronRight className="h-4 w-4 text-slate-300 transition-transform group-hover:translate-x-0.5 dark:text-slate-600" />
          </div>
        </div>
      </article>
    </Link>
  );
};

export default ProjectCard;
