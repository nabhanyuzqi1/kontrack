// src/components/dashboard/RecentProjects.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, FolderKanban } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';
import { Card, CardHeader } from '../ui/Card';
import { StatusBadge } from '../ui/Badge';

const RecentProjects = ({ projects }) => (
  <Card className="mb-8">
    <CardHeader
      title="Proyek Terbaru"
      action={
        <Link
          to="/projects"
          className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 transition-colors hover:text-brand-700"
        >
          Lihat Semua
          <ArrowRight className="h-4 w-4" />
        </Link>
      }
    />
    <div className="p-3">
      {projects.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-slate-400">
          <FolderKanban className="h-8 w-8 text-slate-300" />
          <p className="text-sm">Belum ada proyek</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-50">
          {projects.map((project) => (
            <Link
              key={project.id}
              to={`/projects/${project.id}`}
              className="flex items-center justify-between gap-4 rounded-lg px-3 py-3.5 transition-colors hover:bg-slate-50"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-800">{project.name}</p>
                <p className="mt-0.5 truncate text-xs text-slate-500">{project.partner}</p>
                <p className="mt-1 text-xs font-medium text-slate-600">
                  {formatCurrency(project.value)}
                </p>
              </div>
              <StatusBadge status={project.status} className="shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </div>
  </Card>
);

export default RecentProjects;
