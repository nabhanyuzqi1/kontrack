// src/components/ui/ErrorBoundary.jsx
// Menangkap galat render agar pengguna tidak melihat halaman kosong.
import React from 'react';
import { TriangleAlert, RotateCw } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Galat render:', error, info?.componentStack);
  }

  componentDidUpdate(prevProps) {
    // Reset saat pindah halaman agar galat satu halaman tidak menetap
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
        <div className="mb-4 rounded-2xl bg-red-50 p-4 text-red-500">
          <TriangleAlert className="h-8 w-8" />
        </div>
        <h2 className="font-display text-lg font-semibold text-slate-800">
          Halaman ini gagal ditampilkan
        </h2>
        <p className="mt-1 max-w-md text-sm text-slate-500">
          Terjadi kesalahan saat memuat bagian ini. Data Anda aman — coba muat ulang.
        </p>
        <p className="mt-2 max-w-md break-words rounded-lg bg-slate-50 px-3 py-2 font-mono text-xs text-slate-400">
          {this.state.error?.message || String(this.state.error)}
        </p>
        <button
          onClick={() => window.location.reload()}
          className="mt-5 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-700"
        >
          <RotateCw className="h-4 w-4" />
          Muat Ulang
        </button>
      </div>
    );
  }
}

export default ErrorBoundary;
