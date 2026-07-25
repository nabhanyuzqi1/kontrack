import React from 'react';

// Mark "K" Kontrack — gradien brand, dipakai di sidebar, login, dan favicon
export const LogoMark = ({ className = 'h-9 w-9' }) => (
  <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
    <defs>
      <linearGradient id="kontrack-mark" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#3358f4" />
        <stop offset="1" stopColor="#06b6d4" />
      </linearGradient>
    </defs>
    <rect width="32" height="32" rx="8" fill="url(#kontrack-mark)" />
    <path
      d="M10 7v18M10 16l6.5-7.5M12.5 13.2 21 25"
      stroke="white"
      strokeWidth="3.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </svg>
);

const Logo = ({ dark = false, className = '' }) => (
  <div className={`flex items-center gap-2.5 ${className}`}>
    <LogoMark className="h-9 w-9 shrink-0" />
    <span
      className={`font-display text-xl font-bold tracking-tight ${
        dark ? 'text-white' : 'text-slate-900'
      }`}
    >
      Kontrack
    </span>
  </div>
);

export default Logo;
