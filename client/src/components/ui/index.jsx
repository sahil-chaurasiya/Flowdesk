import React, { useState, createContext, useContext } from 'react';
import ReactDOM from 'react-dom';
import { X, AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react';

function cn(...classes) { return classes.filter(Boolean).join(' '); }

// ─── Button ──────────────────────────────────────────────────────────────────
const BTN_VARIANTS = {
  primary: {
    style: {
      background: 'var(--fd-accent)',
      color: '#ffffff',
      border: '1px solid #4060e0',
      boxShadow: '0 1px 3px rgba(0,0,0,0.14), inset 0 1px 0 rgba(255,255,255,0.14)',
    },
    hoverStyle: {
      background: 'var(--fd-accent-hover)',
    },
  },
  secondary: {
    style: {
      background: 'var(--fd-btn-secondary-bg)',
      color: 'var(--fd-btn-secondary-text)',
      border: '1px solid var(--fd-btn-secondary-border)',
      boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
    },
    hoverStyle: {
      background: 'var(--fd-btn-secondary-hover)',
    },
  },
  ghost: {
    style: {
      background: 'transparent',
      color: 'var(--fd-btn-ghost-text)',
      border: '1px solid transparent',
      boxShadow: 'none',
    },
    hoverStyle: {
      background: 'var(--fd-btn-ghost-hover-bg)',
      color: 'var(--fd-btn-ghost-hover-text)',
    },
  },
  danger: {
    style: {
      background: 'var(--fd-danger-bg, #fef2f2)',
      color: 'var(--fd-danger-text, #b91c1c)',
      border: '1px solid var(--fd-danger-border, #fecaca)',
      boxShadow: 'none',
    },
    hoverStyle: {
      background: 'var(--fd-danger-hover-bg, #fee2e2)',
    },
  },
  outline: {
    style: {
      background: 'var(--fd-btn-secondary-bg)',
      color: 'var(--fd-btn-secondary-text)',
      border: '1px solid var(--fd-btn-secondary-border)',
      boxShadow: 'none',
    },
    hoverStyle: {
      background: 'var(--fd-btn-ghost-hover-bg)',
    },
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
  const [hovered, setHovered] = useState(false);
  const v = BTN_VARIANTS[variant] || BTN_VARIANTS.primary;
  const s = BTN_SIZES[size] || BTN_SIZES.md;
  const combinedStyle = {
    fontFamily: "'Geist', system-ui, sans-serif",
    ...v.style,
    ...(hovered && !disabled && !loading ? v.hoverStyle : {}),
    ...style,
  };

  return (
    <button
      className={cn(
        'inline-flex items-center justify-center font-semibold transition-all duration-150',
        'disabled:opacity-50 disabled:cursor-not-allowed select-none whitespace-nowrap',
        s, className
      )}
      style={combinedStyle}
      disabled={disabled || loading}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      {...props}
    >
      {loading && (
        <div
          className="rounded-full animate-spin flex-shrink-0"
          style={{
            width: size === 'xs' ? 12 : 14,
            height: size === 'xs' ? 12 : 14,
            border: '2px solid',
            borderColor: variant === 'primary' ? 'rgba(255,255,255,0.3)' : 'var(--fd-border)',
            borderTopColor: variant === 'primary' ? '#ffffff' : 'var(--fd-accent)',
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
        <label className="block text-[12px] font-medium" style={{ color: 'var(--fd-ink-2)' }}>
          {label}
        </label>
      )}
      <input
        className={cn('fd-input', className)}
        style={error ? { borderColor: '#fca5a5', boxShadow: '0 0 0 3px rgba(185,28,28,0.08)' } : {}}
        {...props}
      />
      {error && (
        <p className="flex items-center gap-1 text-[11px]" style={{ color: '#ef4444' }}>
          <AlertCircle size={11} />
          {error}
        </p>
      )}
      {hint && !error && (
        <p className="text-[11px]" style={{ color: 'var(--fd-ink-4)' }}>{hint}</p>
      )}
    </div>
  );
}

// ─── Textarea ────────────────────────────────────────────────────────────────
export function Textarea({ label, error, hint, className = '', containerClassName = '', ...props }) {
  return (
    <div className={cn('space-y-1.5', containerClassName)}>
      {label && (
        <label className="block text-[12px] font-medium" style={{ color: 'var(--fd-ink-2)' }}>
          {label}
        </label>
      )}
      <textarea
        className={cn('fd-input resize-none', className)}
        style={error ? { borderColor: '#fca5a5', boxShadow: '0 0 0 3px rgba(185,28,28,0.08)' } : {}}
        {...props}
      />
      {error && (
        <p className="flex items-center gap-1 text-[11px]" style={{ color: '#ef4444' }}>
          <AlertCircle size={11} />
          {error}
        </p>
      )}
      {hint && !error && (
        <p className="text-[11px]" style={{ color: 'var(--fd-ink-4)' }}>{hint}</p>
      )}
    </div>
  );
}

// ─── Select ──────────────────────────────────────────────────────────────────
export function Select({ label, error, className = '', children, ...props }) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label className="block text-[12px] font-medium" style={{ color: 'var(--fd-ink-2)' }}>{label}</label>
      )}
      <select
        className={cn('fd-input cursor-pointer', className)}
        style={{ backgroundImage: 'none', appearance: 'none' }}
        {...props}
      >
        {children}
      </select>
      {error && <p className="text-[11px]" style={{ color: '#ef4444' }}>{error}</p>}
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

  const modal = (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      {/* Backdrop */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.35)',
          backdropFilter: 'blur(4px)',
        }}
        onClick={onClose}
      />
      {/* Panel */}
      <div
        className={cn(
          'relative w-full flex flex-col rounded-2xl animate-scale-in',
          sizes[size]
        )}
        style={{
          maxHeight: '90vh',
          background: 'var(--fd-modal-bg)',
          border: '1px solid var(--fd-modal-border)',
          boxShadow: '0 20px 60px -8px rgba(0,0,0,0.25), 0 4px 16px -2px rgba(0,0,0,0.12)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0"
          style={{ borderColor: 'var(--fd-modal-border)' }}
        >
          <h2 className="text-[15px] font-semibold" style={{ color: 'var(--fd-ink-1)' }}>{title}</h2>
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
            style={{ borderColor: 'var(--fd-modal-border)', background: 'var(--fd-modal-footer-bg)' }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );

  return ReactDOM.createPortal(modal, document.body);
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
    success: { border: 'rgba(52,211,153,0.4)',  icon: <CheckCircle size={15} color="#34d399" />,  bar: '#34d399' },
    error:   { border: 'rgba(248,113,113,0.4)', icon: <AlertCircle size={15} color="#f87171" />,  bar: '#f87171' },
    warning: { border: 'rgba(251,191,36,0.4)',  icon: <AlertTriangle size={15} color="#fbbf24" />, bar: '#fbbf24' },
    info:    { border: 'rgba(129,140,248,0.4)', icon: <Info size={15} color="#818cf8" />,          bar: 'var(--fd-accent)' },
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
                background: 'var(--fd-toast-bg)',
                border: `1px solid ${ts.border}`,
                boxShadow: '0 8px 30px rgba(0,0,0,0.25), 0 2px 8px rgba(0,0,0,0.12)',
                borderLeft: `3px solid ${ts.bar}`,
                color: 'var(--fd-ink-1)',
              }}
            >
              <div className="flex-shrink-0 mt-0.5">{ts.icon}</div>
              <div className="flex-1 min-w-0">
                {t.title && (
                  <div className="text-[13px] font-semibold leading-none" style={{ color: 'var(--fd-ink-1)' }}>
                    {t.title}
                  </div>
                )}
                {t.message && (
                  <div className="text-[12px] mt-1 leading-snug" style={{ color: 'var(--fd-ink-3)' }}>
                    {t.message}
                  </div>
                )}
              </div>
              <button
                onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}
                className="flex-shrink-0 p-0.5 transition-colors"
                style={{ color: 'var(--fd-ink-5)' }}
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
      style={{ background: 'var(--fd-tabs-bg)', border: '1px solid var(--fd-tabs-border)' }}
    >
      {tabs.map(tab => (
        <button
          key={tab.value}
          onClick={() => onChange(tab.value)}
          className="px-3 py-1.5 rounded-md text-[12px] font-medium transition-all duration-120"
          style={
            activeTab === tab.value
              ? {
                  background: 'var(--fd-tab-active-bg)',
                  color: 'var(--fd-tab-active-text)',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                }
              : { color: 'var(--fd-tab-text)' }
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
      style={{ color: 'var(--fd-ink-4)' }}
    >
      {children}
    </span>
  );
}