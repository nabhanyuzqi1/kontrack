import React from 'react';

export const Label = ({ children, required = false, htmlFor }) => (
  <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-slate-700">
    {children}
    {required && <span className="ml-0.5 text-red-500">*</span>}
  </label>
);

const baseInput =
  'w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500/60 focus:border-brand-500 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400';

const borderFor = (error) => (error ? 'border-red-400' : 'border-slate-200 hover:border-slate-300');

export const Input = ({ error, className = '', ...props }) => (
  <input className={`${baseInput} ${borderFor(error)} ${className}`} {...props} />
);

export const Select = ({ error, className = '', children, ...props }) => (
  <select className={`${baseInput} ${borderFor(error)} ${className}`} {...props}>
    {children}
  </select>
);

export const Textarea = ({ error, className = '', ...props }) => (
  <textarea className={`${baseInput} ${borderFor(error)} ${className}`} {...props} />
);

export const FieldError = ({ children }) =>
  children ? <p className="mt-1 text-xs text-red-600">{children}</p> : null;

// Pembungkus praktis: label + kontrol + pesan error
export const Field = ({ label, required, error, children }) => (
  <div>
    {label && <Label required={required}>{label}</Label>}
    {children}
    <FieldError>{error}</FieldError>
  </div>
);

export default Field;
