// src/components/projects/ProjectCard.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, Link2, PenLine, Trash2 } from 'lucide-react';
import {
  formatCurrency,
  calculateProjectProgress,
  calculateDaysLeft
} from '../../utils/formatters';
import { Card } from '../ui/Card';
import { StatusBadge } from '../ui/Badge';
import ProgressBar from '../ui/ProgressBar';

const ProjectCard = ({ project, onEdit, onDelete, currentUser }) => {
  const progress = calculateProjectProgress(project);
  const daysLeft = calculateDaysLeft(project.endDate);
  const isAdmin = currentUser && currentUser.role === 'admin';

  const copyProjectLink = (e) => {
    e.stopPropagation();
    e.preventDefault();
    const link = `${window.location.origin}/projects/${project.id}`;
    navigator.clipboard
      .writeText(link)
      .then(() => alert('Link proyek berhasil disalin!'))
      .catch((err) => console.error('Failed to copy:', err));
  };

  const handleEdit = (e) => {
    e.stopPropagation();
    e.preventDefault();
    onEdit?.(project);
  };

  const handleDelete = (e) => {
    e.stopPropagation();
    e.preventDefault();
    onDelete?.(project);
  };

  const dateRange = `${new Date(project.startDate).toLocaleDateString('id-ID')} – ${new Date(
    project.endDate
  ).toLocaleDateString('id-ID')}`;

  return (
    <Link to={`/projects/${project.id}`} className="block h-full">
      <Card hover className="flex h-full flex-col p-4">
        <div className="mb-2 flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 font-display text-sm font-semibold leading-snug text-slate-900 sm:text-[15px]">
            {project.name}
          </h3>
          <StatusBadge status={project.status} className="shrink-0" />
        </div>

        <p className="truncate text-sm font-medium text-slate-600">{project.partner}</p>
        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-400">
          <CalendarDays className="h-3.5 w-3.5 shrink-0" />
          {dateRange}
        </p>

        {/* Nilai proyek sebagai angka utama */}
        <div className="mt-3">
          <p className="text-xs text-slate-400">Nilai Proyek</p>
          <p className="font-display text-lg font-bold tracking-tight text-slate-900">
            {formatCurrency(project.value)}
          </p>
          <div className="mt-1 flex items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
            <span>
              Terbayar{' '}
              <span className="font-semibold text-emerald-600">
                {formatCurrency(project.paidAmount || 0)}
              </span>
            </span>
            <span className="text-slate-300">·</span>
            <span>Pajak {project.taxRate}%</span>
          </div>
        </div>

        <div className="mt-auto pt-3">
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="text-slate-500">Progress</span>
            <span className="font-semibold text-slate-700">{progress}%</span>
          </div>
          <ProgressBar value={progress} />
          {project.status === 'ongoing' && daysLeft > 0 && (
            <p className="mt-1.5 text-xs text-slate-400">Sisa {daysLeft} hari</p>
          )}
          {project.status === 'ongoing' && daysLeft === 0 && (
            <p className="mt-1.5 text-xs font-semibold text-red-600">Deadline hari ini!</p>
          )}
          {project.status === 'ongoing' && daysLeft < 0 && (
            <p className="mt-1.5 text-xs font-semibold text-red-600">
              Terlambat {Math.abs(daysLeft)} hari
            </p>
          )}

          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5">
            <button
              onClick={copyProjectLink}
              title="Salin link proyek"
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-brand-600 transition-colors hover:bg-brand-50"
            >
              <Link2 className="h-3.5 w-3.5" />
              Salin Link
            </button>

            {isAdmin && (
              <div className="flex gap-1">
                {onEdit && (
                  <button
                    onClick={handleEdit}
                    title="Edit proyek"
                    className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                  >
                    <PenLine className="h-4 w-4" />
                  </button>
                )}
                {onDelete && (
                  <button
                    onClick={handleDelete}
                    title="Hapus proyek"
                    className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </Card>
    </Link>
  );
};

export default ProjectCard;
