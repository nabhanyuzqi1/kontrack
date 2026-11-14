import React from 'react';
import { getStatusLabel } from '../../utils/formatters';

const tones = {
  slate: 'bg-slate-100 text-slate-600 ring-slate-200',
  blue: 'bg-brand-500/10 text-brand-700 ring-brand-200',
  amber: 'bg-amber-500/10 text-amber-700 ring-amber-500/30',
  emerald: 'bg-emerald-500/10 text-emerald-700 ring-emerald-500/30',
  red: 'bg-red-500/10 text-red-700 ring-red-500/30',
  violet: 'bg-violet-500/10 text-violet-700 ring-violet-500/30',
  cyan: 'bg-cyan-500/10 text-cyan-700 ring-cyan-500/30',
  gold: 'bg-gold-soft text-gold-deep ring-[var(--gold-border)]'
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
  retensi: 'gold',
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
