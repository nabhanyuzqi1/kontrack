// src/components/ui/Skeleton.jsx
// Skeleton loader dengan kilau (shimmer) — memberi gambaran bentuk konten
// yang sedang dimuat, bukan sekadar spinner kosong.

import React from 'react';
import { Card } from './Card';

// Blok dasar. Kilau memakai overlay bergerak; otomatis diam bila pengguna
// memilih "kurangi gerak" (diatur global di globals.css).
export const Skeleton = ({ className = '' }) => (
  <div className={`relative overflow-hidden rounded-md bg-slate-200/70 ${className}`}>
    <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/60 to-transparent" />
  </div>
);

// Kartu statistik (Dashboard, Invoice, Laporan)
export const SkeletonStats = ({ count = 4 }) => (
  <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
    {Array.from({ length: count }).map((_, i) => (
      <Card key={i} className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="mt-2.5 h-7 w-32" />
            <Skeleton className="mt-2 h-3 w-20" />
          </div>
          <Skeleton className="h-10 w-10 rounded-lg" />
        </div>
      </Card>
    ))}
  </div>
);

// Kartu proyek / klien
export const SkeletonCards = ({ count = 6, className = '' }) => (
  <div className={`grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 ${className}`}>
    {Array.from({ length: count }).map((_, i) => (
      <Card key={i} className="p-4">
        <div className="mb-3 flex items-start justify-between gap-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <Skeleton className="h-3.5 w-32" />
        <Skeleton className="mt-2 h-3 w-40" />
        <Skeleton className="mt-4 h-3 w-20" />
        <Skeleton className="mt-1.5 h-6 w-36" />
        <Skeleton className="mt-4 h-2 w-full rounded-full" />
      </Card>
    ))}
  </div>
);

// Baris tabel
export const SkeletonTable = ({ rows = 5, cols = 5 }) => (
  <div className="divide-y divide-slate-100">
    {Array.from({ length: rows }).map((_, r) => (
      <div key={r} className="flex items-center gap-4 px-5 py-3.5">
        {Array.from({ length: cols }).map((_, c) => (
          <Skeleton
            key={c}
            className={`h-3.5 ${c === 0 ? 'w-28' : c === cols - 1 ? 'ml-auto w-24' : 'w-20'}`}
          />
        ))}
      </div>
    ))}
  </div>
);

// Halaman daftar lengkap: judul + filter + isi
export const SkeletonListPage = ({ variant = 'cards', stats = 0 }) => (
  <div className="animate-fade-in">
    <div className="mb-5 sm:mb-6">
      <Skeleton className="h-7 w-40" />
      <Skeleton className="mt-2 h-4 w-56" />
    </div>
    {stats > 0 && <SkeletonStats count={stats} />}
    <Skeleton className="mb-4 h-11 w-full rounded-lg sm:mb-6" />
    {variant === 'cards' ? (
      <SkeletonCards />
    ) : (
      <Card>
        <SkeletonTable />
      </Card>
    )}
  </div>
);

// Halaman detail proyek
export const SkeletonDetail = () => (
  <div className="animate-fade-in">
    <Skeleton className="mb-4 h-4 w-28" />
    <Skeleton className="h-7 w-64" />
    <Skeleton className="mt-2 h-4 w-40" />
    <div className="mt-4 flex gap-2">
      <Skeleton className="h-8 w-28 rounded-lg" />
      <Skeleton className="h-8 w-28 rounded-lg" />
    </div>
    <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i} className="p-4 sm:p-5">
          <Skeleton className="h-3 w-32" />
          {Array.from({ length: 4 }).map((_, j) => (
            <div key={j} className="mt-3 flex justify-between">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-3.5 w-28" />
            </div>
          ))}
        </Card>
      ))}
    </div>
  </div>
);

export default Skeleton;
