import React, { useState, createContext, useContext } from 'react';
import { X, AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react';

function cn(...classes) { return classes.filter(Boolean).join(' '); }

// ─── Button ──────────────────────────────────────────────────────────────────
const BTN_VARIANTS = {
  primary: {
    base: 'bg-[#4f6ef0] text-white border-[#4060e0]',
    hover: 'hover:bg-[#3a56d4]',
    shadow: '0 1px 3px rgba(28,25,20,0.12), inset 0 1px 0 rgba(255,255,255,0.14)',
  },
  secondary: {
    base: 'bg-white text-[#44423d] border-[#e0ddd7]',
    hover: 'hover:bg-[#fafaf9] hover:border-[#c8c4bc]',
    shadow: '0 1px 2px rgba(28,25,20,0.06)',
  },
  ghost: {
    base: 'bg-transparent text-[#7a7770] border-transparent',
    hover: 'hover:bg-[#f5f4f1] hover:text-[#1a1916]',
    shadow: 'none',
  },
  danger: {
    base: 'bg-[#fef2f2] text-[#b91c1c] border-[#fecaca]',
    hover: 'hover:bg-[#fee2e2] hover:border-[#fca5a5]',
    shadow: 'none',
  },
  outline: {
    base: 'bg-white text-[#44423d] border-[#e0ddd7]',
    hover: 'hover:bg-[#f5f4f1]',
    shadow: 'none',
  },
};

const BTN_SIZES = {
  xs: 'px-2.5 py-1.5 text-[11px] rounded-md gap-1',
  sm: 'px-3 py-2 text-[12px] rounded-lg gap-1.5',
  md: 'px-4 py-[9px] text-[13px] rounded-lg gap-2',
  lg: 'px-5 py-3 text-[14px] rounded-lg gap-2',
};

export function Button({
  children, variant = 'primary', size = 'md',
  className, loading, disabled, style, ...props
}) {
  const v = BTN_VARIANTS[variant] || BTN_VARIANTS.primary;
  const s = BTN_SIZES[size] || BTN_SIZES.md;
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center font-semibold border transition-all duration-150',
        'disabled:opacity-50 disabled:cursor-not-allowed select-none whitespace-nowrap',
        v.base, v.hover, s, className
      )}
      style={{ boxShadow: v.shadow, fontFamily: "'Geist', system-ui, sans-serif", ...style }}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <div
          className="rounded-full animate-spin flex-shrink-0"
          style={{
            width: size === 'xs' ? 12 : 14,
            height: size === 'xs' ? 12 : 14,
            border: '2px solid',
            borderColor: variant === 'primary' ? 'rgba(255,255,255,0.3)' : '#e0ddd7',
            borderTopColor: variant === 'primary' ? '#ffffff' : '#4f6ef0',
          }}
        />
      )}
      {children}
    </button>
  );
}

// ─── Input ───────────────────────────────────────────────────────────────────
export function Input({ label, error, hint, className = '', containerClassName = '', ...props }) {
  return (
    <div className={cn('space-y-1.5', containerClassName)}>
      {label && (
        <label className="block text-[12px] font-medium" style={{ color: '#44423d' }}>
          {label}
        </label>
      )}
      <input
        className={cn('fd-input', className)}
        style={error ? { borderColor: '#fca5a5', boxShadow: '0 0 0 3px rgba(185,28,28,0.08)' } : {}}
        {...props}
      />
      {error && (
        <p className="flex items-center gap-1 text-[11px]" style={{ color: '#b91c1c' }}>
          <AlertCircle size={11} />
          {error}
        </p>
      )}
      {hint && !error && (
        <p className="text-[11px]" style={{ color: '#a8a49e' }}>{hint}</p>
      )}
    </div>
  );
}

// ─── Textarea ────────────────────────────────────────────────────────────────
export function Textarea({ label, error, rows = 4, className = '', ...props }) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label className="block text-[12px] font-medium" style={{ color: '#44423d' }}>{label}</label>
      )}
      <textarea
        rows={rows}
        className={cn('fd-input resize-none', className)}
        style={error ? { borderColor: '#fca5a5' } : {}}
        {...props}
      />
      {error && (
        <p className="flex items-center gap-1 text-[11px]" style={{ color: '#b91c1c' }}>
          <AlertCircle size={11} />{error}
        </p>
      )}
    </div>
  );
}

// ─── Select ──────────────────────────────────────────────────────────────────
export function Select({ label, error, className = '', children, ...props }) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label className="block text-[12px] font-medium" style={{ color: '#44423d' }}>{label}</label>
      )}
      <select
        className={cn('fd-input cursor-pointer', className)}
        style={{ backgroundImage: 'none', appearance: 'none' }}
        {...props}
      >
        {children}
      </select>
      {error && <p className="text-[11px]" style={{ color: '#b91c1c' }}>{error}</p>}
    </div>
  );
}

// ─── Modal ───────────────────────────────────────────────────────────────────
export function Modal({ isOpen, onClose, title, children, size = 'md', footer }) {
  if (!isOpen) return null;

  const sizes = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 backdrop-blur-sm"
        style={{ background: 'rgba(26,25,22,0.25)' }}
        onClick={onClose}
      />
      {/* Panel */}
      <div
        className={cn(
          'relative w-full max-h-[90vh] flex flex-col rounded-2xl animate-scale-in',
          sizes[size]
        )}
        style={{
          background: '#ffffff',
          border: '1px solid #e8e5e0',
          boxShadow: '0 20px 60px -8px rgba(28,25,20,0.14), 0 4px 16px -2px rgba(28,25,20,0.08)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0"
          style={{ borderColor: '#eeece8' }}
        >
          <h2 className="text-[15px] font-semibold" style={{ color: '#1a1916' }}>{title}</h2>
          <button onClick={onClose} className="btn-ghost p-1.5 ml-2">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>

        {/* Footer */}
        {footer && (
          <div
            className="px-6 py-4 border-t flex-shrink-0"
            style={{ borderColor: '#eeece8', background: '#fafaf9' }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Toast ───────────────────────────────────────────────────────────────────
const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const toast = ({ title, message, type = 'info', duration = 4000 }) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, title, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration);
  };

  const TOAST_STYLES = {
    success: { border: '#b8e2c9', icon: <CheckCircle size={15} color="#2a7d4f" />, bar: '#2a7d4f' },
    error:   { border: '#fecaca', icon: <AlertCircle size={15} color="#b91c1c" />, bar: '#b91c1c' },
    warning: { border: '#f5d78e', icon: <AlertTriangle size={15} color="#92600a" />, bar: '#e9830a' },
    info:    { border: '#c5d4fb', icon: <Info size={15} color="#3a56d4" />, bar: '#4f6ef0' },
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="fixed bottom-5 right-5 z-[100] space-y-2 pointer-events-none">
        {toasts.map(t => {
          const ts = TOAST_STYLES[t.type] || TOAST_STYLES.info;
          return (
            <div
              key={t.id}
              className="flex items-start gap-3 rounded-xl px-4 py-3.5 min-w-[280px] max-w-sm animate-fade-in pointer-events-auto"
              style={{
                background: '#ffffff',
                border: `1px solid ${ts.border}`,
                boxShadow: '0 8px 30px rgba(28,25,20,0.10), 0 2px 8px rgba(28,25,20,0.06)',
                borderLeft: `3px solid ${ts.bar}`,
              }}
            >
              <div className="flex-shrink-0 mt-0.5">{ts.icon}</div>
              <div className="flex-1 min-w-0">
                {t.title && (
                  <div className="text-[13px] font-semibold leading-none" style={{ color: '#1a1916' }}>
                    {t.title}
                  </div>
                )}
                {t.message && (
                  <div className="text-[12px] mt-1 leading-snug" style={{ color: '#7a7770' }}>
                    {t.message}
                  </div>
                )}
              </div>
              <button
                onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}
                className="flex-shrink-0 p-0.5 transition-colors"
                style={{ color: '#ccc9c2' }}
              >
                <X size={13} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

// ─── Tabs ────────────────────────────────────────────────────────────────────
export function Tabs({ tabs, activeTab, onChange }) {
  return (
    <div
      className="flex items-center gap-0.5 p-1 rounded-lg"
      style={{ background: '#f5f4f1', border: '1px solid #e8e5e0' }}
    >
      {tabs.map(tab => (
        <button
          key={tab.value}
          onClick={() => onChange(tab.value)}
          className="px-3 py-1.5 rounded-md text-[12px] font-medium transition-all duration-120"
          style={
            activeTab === tab.value
              ? { background: '#ffffff', color: '#1a1916', boxShadow: '0 1px 3px rgba(28,25,20,0.08)' }
              : { color: '#7a7770' }
          }
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

// ─── Table wrappers ──────────────────────────────────────────────────────────
export function Table({ children, className = '' }) {
  return (
    <div className={cn('w-full overflow-x-auto', className)}>
      <table className="fd-table w-full">{children}</table>
    </div>
  );
}

// ─── Divider ─────────────────────────────────────────────────────────────────
export function Divider({ className = '' }) {
  return <hr className={cn('fd-divider', className)} />;
}

// ─── Label ───────────────────────────────────────────────────────────────────
export function Label({ children, className = '' }) {
  return (
    <span
      className={cn('text-[10.5px] font-semibold uppercase tracking-wider', className)}
      style={{ color: '#a8a49e' }}
    >
      {children}
    </span>
  );
}
