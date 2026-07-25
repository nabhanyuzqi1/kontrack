import React from 'react';

const ProgressBar = ({ value = 0, className = '', barClassName = '' }) => {
  const clamped = Math.min(Math.max(Number(value) || 0, 0), 100);
  return (
    <div className={`h-2 w-full overflow-hidden rounded-full bg-slate-100 ${className}`}>
      <div
        className={`h-full rounded-full bg-brand-gradient transition-all duration-500 ${barClassName}`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
};

export default ProgressBar;
