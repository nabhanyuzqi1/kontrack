import React from 'react';
import { Loader2 } from 'lucide-react';

export const Spinner = ({ className = 'h-5 w-5' }) => (
  <Loader2 className={`animate-spin text-brand-600 ${className}`} />
);

// Loader satu halaman penuh (dipakai saat data awal dimuat)
export const PageLoader = ({ label = 'Memuat data…' }) => (
  <div className="flex h-64 flex-col items-center justify-center gap-3">
    <Spinner className="h-8 w-8" />
    <p className="text-sm text-slate-400">{label}</p>
  </div>
);

export default Spinner;
