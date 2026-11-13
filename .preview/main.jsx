import React from 'react';
import { createRoot } from 'react-dom/client';
import Reports from '../src/components/reports/Reports.jsx';
import '../src/styles/globals.css';

createRoot(document.getElementById('root')).render(
  <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
    <Reports currentUser={{ role: 'admin', email: 'demo@kontrack.id' }} />
  </div>
);
