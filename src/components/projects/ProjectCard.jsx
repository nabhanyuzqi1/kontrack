// src/components/projects/ProjectCard.jsx
// Kartu proyek: struktur tiga bagian — kepala (judul + status), isi (mitra,
// periode, panel angka), kaki (referensi SPK + aksi).
//
// Penanda status TIDAK lagi memakai strip warna tebal di sisi kiri: perubahan
// status dibawa oleh pil status di kepala dan warna pada panel angka, supaya
// kartu tidak terbaca seperti templat admin.
import React from 'react';
import { Link } from 'react-router-dom';
import {
  CalendarDays,
  Link2,
  PenLine,
  Trash2,
  ArrowRight,
  AlertCircle,
  FileText
} from 'lucide-react';
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
      .writeText(`${window.location.origin}/projects/${project.id}`)
      .then(() => alert('Link proyek berhasil disalin!'))
      .catch((err) => console.error('Failed to copy:', err));
  };

  // Peringatan tenggat hanya muncul bila memang relevan
  const deadlineWarning =
    isOngoing && daysLeft < 0
      ? { text: `Terlambat ${Math.abs(daysLeft)} hari`, cls: 'text-red-600 dark:text-red-400' }
      : isOngoing && daysLeft === 0
        ? { text: 'Tenggat hari ini', cls: 'text-red-600 dark:text-red-400' }
        : isOngoing && daysLeft <= 30
          ? { text: `${daysLeft} hari lagi`, cls: 'text-amber-600 dark:text-amber-400' }
          : null;

  return (
    <Link to={`/projects/${project.id}`} className="group block h-full">
      <article className="flex h-full flex-col glass-2 glass-hover p-5 hover:border-brand-300">
        {/* Kepala: judul + status */}
        <div className="mb-3 flex items-start justify-between gap-3">
          <h3 className="line-clamp-2 font-display text-[15px] font-bold leading-snug text-slate-900 transition-colors group-hover:text-brand-700 dark:group-hover:text-brand-300">
            {project.name}
          </h3>
          <StatusBadge status={project.status} className="shrink-0" />
        </div>

        {/* Mitra + periode */}
        <p className="truncate text-sm font-medium text-slate-600">{project.partner}</p>
        <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-slate-400">
          <CalendarDays className="h-3.5 w-3.5 shrink-0" />
          <span className="tnum">
            {shortDate(project.startDate)} – {shortDate(project.endDate)}
          </span>
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

        {/* Panel angka: satu blok utuh supaya nominal tidak tersebar dan mudah
            dibandingkan antar-kartu */}
        <div className="mt-4 rounded-[10px] glass-3 p-3.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Nilai Kontrak
          </p>
          <p className="tnum font-display text-lg font-bold tracking-tight text-slate-900">
            {formatCurrency(value)}
          </p>

          <div className="mt-2.5 flex items-baseline justify-between gap-2 text-xs">
            <span className="text-slate-500">
              Terbayar{' '}
              <span className="tnum font-semibold text-emerald-600 dark:text-emerald-400">
                {formatCurrency(paid)}
              </span>
            </span>
            <span className="tnum font-display text-sm font-bold text-slate-700">{progress}%</span>
          </div>

          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200/60">
            <div
              className="h-full rounded-full bg-brand-gradient transition-all duration-500"
              style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }}
            />
          </div>

          <p className="mt-2 text-xs text-slate-500">
            {outstanding > 0 ? (
              <>
                Sisa tagihan{' '}
                <span className="tnum font-medium text-slate-700">
                  {formatCurrency(outstanding)}
                </span>
              </>
            ) : (
              <span className="font-medium text-emerald-600 dark:text-emerald-400">
                Pembayaran lunas
              </span>
            )}
          </p>
        </div>

        {/* Kaki: referensi SPK + aksi */}
        <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-200/70 pt-3">
          {project.contractNumber ? (
            <span className="tnum inline-flex min-w-0 items-center gap-1.5 truncate rounded-full glass-3 px-2.5 py-1 text-[11px] text-slate-500">
              <FileText className="h-3 w-3 shrink-0" />
              <span className="truncate">{project.contractNumber}</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 opacity-0 transition-opacity group-hover:opacity-100 dark:text-brand-300">
              Lihat detail
              <ArrowRight className="h-3.5 w-3.5" />
            </span>
          )}

          <div className="flex shrink-0 items-center gap-0.5">
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
          </div>
        </div>
      </article>
    </Link>
  );
};

export default ProjectCard;
