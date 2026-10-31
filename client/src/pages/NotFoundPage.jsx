import React from 'react';
import { Link } from 'react-router-dom';
import useAuthStore from '../context/authStore';

export default function NotFoundPage() {
  const { user } = useAuthStore();
  const home = user?.role === 'client' ? '/portal/dashboard' : '/admin/dashboard';

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--fd-canvas)' }}>
      <div className="text-center">
        <div className="text-8xl font-black mb-4" style={{ color: 'var(--fd-border-strong)' }}>404</div>
        <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--fd-ink-1)' }}>Page not found</h1>
        <p className="mb-8" style={{ color: 'var(--fd-ink-4)' }}>The page you're looking for doesn't exist.</p>
        <Link to={home} className="btn-primary px-6 py-3 rounded-xl">
          Go Home
        </Link>
      </div>
    </div>
  );
}