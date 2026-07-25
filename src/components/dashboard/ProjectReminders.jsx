// src/components/dashboard/ProjectReminders.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import { AlarmClock, TriangleAlert } from 'lucide-react';
import { calculateDaysLeft } from '../../utils/formatters';
import { PROJECT_STATUS, DEADLINE_WARNING_DAYS } from '../../utils/constants';

const ReminderRow = ({ project, badge, badgeClass }) => (
  <Link
    to={`/projects/${project.id}`}
    className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-white/60"
  >
    <div className="min-w-0">
      <p className="truncate text-sm font-medium text-slate-800">{project.name}</p>
      <p className="truncate text-xs text-slate-500">{project.partner}</p>
    </div>
    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${badgeClass}`}>
      {badge}
    </span>
  </Link>
);

const ProjectReminders = ({ projects }) => {
  const ongoingProjects = projects.filter((p) => p.status === PROJECT_STATUS.ONGOING);

  const upcomingDeadlines = ongoingProjects
    .filter((p) => {
      const daysLeft = calculateDaysLeft(p.endDate);
      return daysLeft > 0 && daysLeft <= DEADLINE_WARNING_DAYS;
    })
    .sort((a, b) => new Date(a.endDate) - new Date(b.endDate));

  const overdueProjects = ongoingProjects.filter((p) => calculateDaysLeft(p.endDate) < 0);

  if (upcomingDeadlines.length === 0 && overdueProjects.length === 0) {
    return null;
  }

  return (
    <div className="mb-8 space-y-4">
      {overdueProjects.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50/70 p-4">
          <div className="mb-2 flex items-center gap-2">
            <TriangleAlert className="h-4 w-4 text-red-600" />
            <h3 className="font-display text-sm font-semibold text-red-800">Proyek Terlambat</h3>
          </div>
          <div className="space-y-1">
            {overdueProjects.map((project) => (
              <ReminderRow
                key={project.id}
                project={project}
                badge={`Terlambat ${Math.abs(calculateDaysLeft(project.endDate))} hari`}
                badgeClass="bg-red-100 text-red-700"
              />
            ))}
          </div>
        </div>
      )}

      {upcomingDeadlines.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4">
          <div className="mb-2 flex items-center gap-2">
            <AlarmClock className="h-4 w-4 text-amber-600" />
            <h3 className="font-display text-sm font-semibold text-amber-800">
              Deadline Mendekati
            </h3>
          </div>
          <div className="space-y-1">
            {upcomingDeadlines.map((project) => {
              const daysLeft = calculateDaysLeft(project.endDate);
              return (
                <ReminderRow
                  key={project.id}
                  project={project}
                  badge={`${daysLeft} hari lagi`}
                  badgeClass={daysLeft <= 7 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectReminders;
