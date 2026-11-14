import React from 'react';

export const Card = ({ className = '', hover = false, children, ...props }) => (
  <div
    className={`glass-2 ${hover ? 'glass-hover hover:shadow-card-hover' : ''} ${className}`}
    {...props}
  >
    {children}
  </div>
);

export const CardHeader = ({ title, action, className = '' }) => (
  <div
    className={`flex items-center justify-between border-b border-slate-200/70 px-5 py-4 ${className}`}
  >
    <h3 className="font-display text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
    {action}
  </div>
);

export const CardBody = ({ className = '', children }) => (
  <div className={`p-5 ${className}`}>{children}</div>
);

export default Card;
