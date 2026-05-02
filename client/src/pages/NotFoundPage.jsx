import React from 'react';
import { Link } from 'react-router-dom';
import useAuthStore from '../context/authStore';

export default function NotFoundPage() {
  const { user } = useAuthStore();
  const home = user?.role === 'client' ? '/portal/dashboard' : '/admin/dashboard';

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center">
        <div className="text-8xl font-black text-slate-200 mb-4">404</div>
        <h1 className="text-2xl font-bold text-slate-700 mb-2">Page not found</h1>
        <p className="text-slate-400 mb-8">The page you're looking for doesn't exist.</p>
        <Link to={home} className="bg-brand-600 hover:bg-brand-700 text-white font-medium px-6 py-3 rounded-xl transition-colors">
          Go Home
        </Link>
      </div>
    </div>
  );
}
