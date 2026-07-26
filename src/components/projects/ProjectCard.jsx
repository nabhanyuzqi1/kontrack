// src/components/projects/ProjectCard.jsx
// Kartu proyek: satu angka utama (nilai kontrak), progres visual, dan status
// pembayaran. Detail lain sengaja diringkas agar tidak melelahkan dibaca.
import React from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, Link2, PenLine, Trash2, ArrowRight, AlertCircle } from 'lucide-react';
import {
  formatCurrency,
  calculateProjectProgress,
  calculateDaysLeft
} from '../../utils/formatters';
import { StatusBadge } from '../ui/Badge';

// Warna strip kiri sebagai penanda status — dikenali sekilas tanpa membaca.
const statusStripe = {
  'akan-datang': 'bg-slate-300',
  ongoing: 'bg-brand-gradient',
  retensi: 'bg-amber-400',
  selesai: 'bg-emerald-500'
};

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
      .writeText(`${window.location.origin}/projects/${project.id}`)
      .then(() => alert('Link proyek berhasil disalin!'))
      .catch((err) => console.error('Failed to copy:', err));
  };

  // Peringatan tenggat hanya muncul bila memang relevan
  const deadlineWarning =
    isOngoing && daysLeft < 0
      ? { text: `Terlambat ${Math.abs(daysLeft)} hari`, cls: 'text-red-600' }
      : isOngoing && daysLeft === 0
        ? { text: 'Tenggat hari ini', cls: 'text-red-600' }
        : isOngoing && daysLeft <= 30
          ? { text: `${daysLeft} hari lagi`, cls: 'text-amber-600' }
          : null;

  return (
    <Link to={`/projects/${project.id}`} className="group block h-full">
      <article className="relative flex h-full flex-col overflow-hidden rounded-xl border border-slate-200/70 bg-white shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-card-hover">
        {/* Strip status */}
        <span
          className={`absolute inset-y-0 left-0 w-1 ${statusStripe[project.status] || 'bg-slate-300'}`}
        />

        <div className="flex flex-1 flex-col p-4 pl-5">
          {/* Judul + status */}
          <div className="mb-2.5 flex items-start justify-between gap-2">
            <h3 className="line-clamp-2 font-display text-[15px] font-semibold leading-snug text-slate-900 transition-colors group-hover:text-brand-700">
              {project.name}
            </h3>
            <StatusBadge status={project.status} className="shrink-0" />
          </div>

          {/* Klien + periode */}
          <p className="truncate text-sm font-medium text-slate-600">{project.partner}</p>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-400">
            <CalendarDays className="h-3.5 w-3.5 shrink-0" />
            {shortDate(project.startDate)} – {shortDate(project.endDate)}
            {deadlineWarning && (
              <>
                <span className="text-slate-300">·</span>
                <span className={`inline-flex items-center gap-1 font-medium ${deadlineWarning.cls}`}>
                  {daysLeft <= 0 && <AlertCircle className="h-3 w-3" />}
                  {deadlineWarning.text}
                </span>
              </>
            )}
          </p>

          {/* Angka utama */}
          <div className="mt-4">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
              Nilai Kontrak
            </p>
            <p className="font-display text-xl font-bold tracking-tight text-slate-900">
              {formatCurrency(value)}
            </p>
          </div>

          {/* Progres pembayaran */}
          <div className="mt-3">
            <div className="mb-1.5 flex items-baseline justify-between">
              <span className="text-xs text-slate-500">
                Terbayar{' '}
                <span className="font-semibold text-emerald-600">{formatCurrency(paid)}</span>
              </span>
              <span className="tnum font-display text-sm font-bold text-slate-700">{progress}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-brand-gradient transition-all duration-500"
                style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }}
              />
            </div>
            <p className="mt-1.5 text-xs text-slate-400">
              {outstanding > 0 ? (
                <>
                  Sisa tagihan{' '}
                  <span className="font-medium text-slate-600">{formatCurrency(outstanding)}</span>
                </>
              ) : (
                <span className="font-medium text-emerald-600">Pembayaran lunas</span>
              )}
            </p>
          </div>

          {/* Aksi */}
          <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
            <span className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 opacity-0 transition-opacity group-hover:opacity-100">
              Lihat detail
              <ArrowRight className="h-3.5 w-3.5" />
            </span>

            <div className="flex items-center gap-0.5">
              <button
                onClick={copyProjectLink}
                title="Salin link proyek"
                className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-brand-600"
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
                  className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </article>
    </Link>
  );
};

export default ProjectCard;
