import React from 'react';
import { getStatusLabel } from '../../utils/formatters';

const tones = {
  slate: 'bg-slate-100 text-slate-600 ring-slate-200',
  blue: 'bg-brand-50 text-brand-700 ring-brand-200',
  amber: 'bg-amber-50 text-amber-700 ring-amber-200',
  emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  red: 'bg-red-50 text-red-700 ring-red-200',
  violet: 'bg-violet-50 text-violet-700 ring-violet-200',
  cyan: 'bg-cyan-50 text-cyan-700 ring-cyan-200'
};

export const Badge = ({ tone = 'slate', className = '', children }) => (
  <span
    className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${tones[tone]} ${className}`}
  >
    {children}
  </span>
);

const statusTone = {
  'akan-datang': 'slate',
  ongoing: 'blue',
  retensi: 'amber',
  selesai: 'emerald'
};

export const StatusBadge = ({ status, className = '' }) => (
  <Badge tone={statusTone[status] || 'slate'} className={className}>
    {status === 'ongoing' && (
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-500 opacity-60" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand-600" />
      </span>
    )}
    {getStatusLabel(status)}
  </Badge>
);

export default Badge;
