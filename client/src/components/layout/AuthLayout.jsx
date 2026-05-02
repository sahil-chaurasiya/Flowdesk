import React from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import useAuthStore from '../../context/authStore';

export default function AuthLayout() {
  const { isAuthenticated, user, isLoading } = useAuthStore();

  if (isLoading) return null;
  if (isAuthenticated) {
    return <Navigate to={user?.role === 'client' ? '/portal/dashboard' : '/admin/dashboard'} replace />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-900/5 rounded-full blur-3xl" />
      </div>
      <div className="relative w-full max-w-md animate-fade-in">
        <Outlet />
      </div>
    </div>
  );
}
