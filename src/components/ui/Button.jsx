import React from 'react';
import { Loader2 } from 'lucide-react';

const variants = {
  primary:
    'bg-brand-600 text-white hover:bg-brand-700 shadow-sm hover:shadow-glow focus-visible:ring-brand-500',
  gradient:
    'bg-brand-gradient text-white hover:opacity-95 shadow-sm hover:shadow-glow focus-visible:ring-brand-500',
  secondary:
    'glass-3 text-slate-700 hover:border-slate-300 hover:bg-slate-100 focus-visible:ring-slate-400',
  ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-slate-400',
  danger: 'bg-red-600 dark:bg-[#dc2626] text-white hover:bg-red-700 dark:hover:bg-[#b91c1c] shadow-sm focus-visible:ring-red-500',
  'danger-ghost': 'text-red-600 dark:text-red-400 hover:bg-red-500/10 focus-visible:ring-red-500',
  success: 'bg-emerald-600 dark:bg-[#059669] text-white hover:bg-emerald-700 dark:hover:bg-[#047857] shadow-sm focus-visible:ring-emerald-500'
};

const sizes = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-11 px-5 text-sm gap-2'
};

const Button = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  className = '',
  children,
  ...props
}) => (
  <button
    disabled={disabled || loading}
    className={`inline-flex select-none items-center justify-center whitespace-nowrap rounded-lg font-medium transition-all duration-150 disabled:pointer-events-none disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${className}`}
    {...props}
  >
    {loading && <Loader2 className="h-4 w-4 animate-spin" />}
    {children}
  </button>
);

export default Button;
