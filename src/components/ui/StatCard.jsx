import React from 'react';
import Card from './Card';

const iconTones = {
  brand: 'bg-brand-50 text-brand-600',
  cyan: 'bg-cyan-50 text-cyan-600',
  emerald: 'bg-emerald-50 text-emerald-600',
  amber: 'bg-amber-50 text-amber-600',
  violet: 'bg-violet-50 text-violet-600',
  red: 'bg-red-50 text-red-600'
};

const StatCard = ({ icon: Icon, tone = 'brand', label, value, sub, subTone = 'text-slate-400' }) => (
  <Card className="p-4 sm:p-5">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-500 sm:text-sm">{label}</p>
        <p className="mt-1 truncate font-display text-xl font-bold tracking-tight text-slate-900 sm:mt-1.5 sm:text-2xl">
          {value}
        </p>
        {sub && <p className={`mt-1 text-xs ${subTone}`}>{sub}</p>}
      </div>
      {Icon && (
        <div className={`shrink-0 rounded-lg p-2 sm:rounded-xl sm:p-2.5 ${iconTones[tone]}`}>
          <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
        </div>
      )}
    </div>
  </Card>
);

export default StatCard;
