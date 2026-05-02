import React from 'react';
import { cn } from '../../lib/utils';

// Loading Screen
export function LoadingScreen() {
  return (
    <div className="fixed inset-0 bg-white flex items-center justify-center z-50">
      <div className="text-center">
        <div className="w-12 h-12 bg-brand-600 rounded-xl flex items-center justify-center mx-auto mb-3 animate-pulse">
          <span className="text-white font-bold">TF</span>
        </div>
        <div className="text-slate-500 text-sm">Loading...</div>
      </div>
    </div>
  );
}
export default LoadingScreen;

// Spinner
export function Spinner({ size = 'md', className }) {
  const sizes = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-8 h-8' };
  return (
    <div className={cn('border-2 border-slate-200 border-t-brand-600 rounded-full animate-spin', sizes[size], className)} />
  );
}

// Badge
export function Badge({ children, className, variant = 'default' }) {
  const variants = {
    default: 'bg-slate-100 text-slate-700',
    primary: 'bg-blue-100 text-blue-700',
    success: 'bg-emerald-100 text-emerald-700',
    warning: 'bg-amber-100 text-amber-700',
    danger: 'bg-red-100 text-red-700',
    purple: 'bg-purple-100 text-purple-700',
  };
  return (
    <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium', variants[variant], className)}>
      {children}
    </span>
  );
}

// Stat Card
export function StatCard({ title, value, subtitle, icon: Icon, trend, trendLabel, color = 'blue' }) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-emerald-50 text-emerald-600',
    orange: 'bg-orange-50 text-orange-600',
    purple: 'bg-purple-50 text-purple-600',
    red: 'bg-red-50 text-red-600',
  };
  return (
    <div className="stat-card animate-fade-in">
      <div className="flex items-start justify-between mb-3">
        <div className={cn('p-2 rounded-lg', colors[color])}>
          <Icon size={20} />
        </div>
        {trend !== undefined && (
          <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', trend >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600')}>
            {trend >= 0 ? '+' : ''}{trend}% {trendLabel}
          </span>
        )}
      </div>
      <div className="text-2xl font-bold text-slate-800">{value}</div>
      <div className="text-sm font-medium text-slate-600 mt-0.5">{title}</div>
      {subtitle && <div className="text-xs text-slate-400 mt-1">{subtitle}</div>}
    </div>
  );
}

// Empty State
export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-14 h-14 bg-slate-100 rounded-xl flex items-center justify-center mb-4">
        <Icon size={24} className="text-slate-400" />
      </div>
      <h3 className="text-slate-700 font-semibold mb-1">{title}</h3>
      {description && <p className="text-slate-400 text-sm max-w-xs">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// Page Header
export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="page-header flex items-start justify-between">
      <div>
        <h1 className="text-xl font-bold text-slate-800">{title}</h1>
        {subtitle && <p className="text-slate-500 text-sm mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

// Avatar
export function Avatar({ name, src, size = 'md', className }) {
  const sizes = { xs: 'w-6 h-6 text-xs', sm: 'w-8 h-8 text-xs', md: 'w-10 h-10 text-sm', lg: 'w-12 h-12 text-base', xl: 'w-16 h-16 text-lg' };
  const initials = name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';

  if (src) {
    return <img src={src} alt={name} className={cn('rounded-full object-cover bg-slate-200', sizes[size], className)} />;
  }

  const colors = ['bg-blue-500', 'bg-purple-500', 'bg-emerald-500', 'bg-orange-500', 'bg-pink-500', 'bg-indigo-500'];
  const color = colors[(name?.charCodeAt(0) || 0) % colors.length];

  return (
    <div className={cn('rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0', sizes[size], color, className)}>
      {initials}
    </div>
  );
}

// Card
export function Card({ children, className, ...props }) {
  return (
    <div className={cn('bg-white rounded-xl border border-slate-200 shadow-sm', className)} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({ children, className }) {
  return <div className={cn('px-5 py-4 border-b border-slate-100', className)}>{children}</div>;
}

export function CardContent({ children, className }) {
  return <div className={cn('p-5', className)}>{children}</div>;
}
