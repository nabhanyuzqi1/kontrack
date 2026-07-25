import React from 'react';
import { Card } from './Card';

const EmptyState = ({ icon: Icon, title, description, action, className = '' }) => (
  <Card className={`flex flex-col items-center justify-center px-6 py-14 text-center ${className}`}>
    {Icon && (
      <div className="mb-4 rounded-2xl bg-slate-50 p-4 text-slate-300">
        <Icon className="h-8 w-8" />
      </div>
    )}
    <h3 className="font-display text-base font-semibold text-slate-700">{title}</h3>
    {description && <p className="mt-1 max-w-sm text-sm text-slate-400">{description}</p>}
    {action && <div className="mt-5">{action}</div>}
  </Card>
);

export default EmptyState;
