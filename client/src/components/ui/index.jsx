import React, { useState, createContext, useContext } from 'react';
import { cn } from '../../lib/utils';
import { X, AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react';

// Button
export function Button({ children, variant = 'primary', size = 'md', className, loading, disabled, ...props }) {
  const variants = {
    primary: 'bg-brand-600 text-white hover:bg-brand-700 disabled:bg-brand-300',
    secondary: 'bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-50',
    ghost: 'text-slate-600 hover:bg-slate-100 disabled:opacity-50',
    danger: 'bg-red-600 text-white hover:bg-red-700 disabled:opacity-50',
    outline: 'border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50',
  };
  const sizes = {
    xs: 'px-2.5 py-1.5 text-xs rounded-md',
    sm: 'px-3 py-2 text-sm rounded-lg',
    md: 'px-4 py-2.5 text-sm rounded-lg',
    lg: 'px-5 py-3 text-base rounded-lg',
  };
  return (
    <button
      className={cn('inline-flex items-center justify-center gap-2 font-medium transition-colors disabled:cursor-not-allowed', variants[variant], sizes[size], className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />}
      {children}
    </button>
  );
}

// Input
export function Input({ label, error, className, containerClassName, ...props }) {
  return (
    <div className={cn('space-y-1', containerClassName)}>
      {label && <label className="block text-sm font-medium text-slate-700">{label}</label>}
      <input
        className={cn(
          'w-full px-3 py-2.5 border rounded-lg text-sm transition-colors outline-none',
          error
            ? 'border-red-300 bg-red-50 focus:border-red-500 focus:ring-2 focus:ring-red-100'
            : 'border-slate-300 bg-white focus:border-brand-500 focus:ring-2 focus:ring-brand-100',
          className
        )}
        {...props}
      />
      {error && <p className="text-xs text-red-600 flex items-center gap-1"><AlertCircle size={12} />{error}</p>}
    </div>
  );
}

// Textarea
export function Textarea({ label, error, className, rows = 4, ...props }) {
  return (
    <div className="space-y-1">
      {label && <label className="block text-sm font-medium text-slate-700">{label}</label>}
      <textarea
        rows={rows}
        className={cn(
          'w-full px-3 py-2.5 border rounded-lg text-sm transition-colors outline-none resize-none',
          error
            ? 'border-red-300 focus:border-red-500 focus:ring-2 focus:ring-red-100'
            : 'border-slate-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-100',
          className
        )}
        {...props}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

// Select
export function Select({ label, error, className, children, ...props }) {
  return (
    <div className="space-y-1">
      {label && <label className="block text-sm font-medium text-slate-700">{label}</label>}
      <select
        className={cn(
          'w-full px-3 py-2.5 border rounded-lg text-sm transition-colors outline-none bg-white',
          error
            ? 'border-red-300 focus:border-red-500'
            : 'border-slate-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-100',
          className
        )}
        {...props}
      >
        {children}
      </select>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

// Modal
export function Modal({ isOpen, onClose, title, children, size = 'md', footer }) {
  if (!isOpen) return null;
  const sizes = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className={cn('relative bg-white rounded-xl shadow-2xl w-full max-h-[90vh] flex flex-col animate-fade-in', sizes[size])}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-xl">{footer}</div>}
      </div>
    </div>
  );
}

// Toast Context
const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const toast = ({ title, message, type = 'info', duration = 4000 }) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, title, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration);
  };

  const icons = {
    success: <CheckCircle size={18} className="text-emerald-500" />,
    error: <AlertCircle size={18} className="text-red-500" />,
    warning: <AlertTriangle size={18} className="text-amber-500" />,
    info: <Info size={18} className="text-blue-500" />,
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] space-y-2">
        {toasts.map(t => (
          <div key={t.id} className="flex items-start gap-3 bg-white border border-slate-200 rounded-xl shadow-lg px-4 py-3 min-w-[280px] max-w-sm animate-fade-in">
            {icons[t.type]}
            <div className="flex-1 min-w-0">
              {t.title && <div className="text-sm font-semibold text-slate-800">{t.title}</div>}
              {t.message && <div className="text-xs text-slate-500 mt-0.5">{t.message}</div>}
            </div>
            <button onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))} className="text-slate-300 hover:text-slate-500 flex-shrink-0">
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
};

// Confirm Dialog
export function ConfirmDialog({ isOpen, onClose, onConfirm, title, message, confirmLabel = 'Confirm', confirmVariant = 'danger' }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant={confirmVariant} onClick={() => { onConfirm(); onClose(); }}>{confirmLabel}</Button>
        </div>
      }
    >
      <p className="text-slate-600 text-sm">{message}</p>
    </Modal>
  );
}

// Search Input
export function SearchInput({ value, onChange, placeholder = 'Search...', className }) {
  return (
    <div className={cn('relative', className)}>
      <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
      </svg>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm w-full focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
      />
    </div>
  );
}

// Tabs
export function Tabs({ tabs, active, onChange, className }) {
  return (
    <div className={cn('flex border-b border-slate-200', className)}>
      {tabs.map(tab => (
        <button
          key={tab.value}
          onClick={() => onChange(tab.value)}
          className={cn(
            'px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
            active === tab.value
              ? 'border-brand-600 text-brand-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          )}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span className={cn('ml-2 px-1.5 py-0.5 rounded-full text-xs', active === tab.value ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-500')}>
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
