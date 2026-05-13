import React from 'react';

// ─── Utility ─────────────────────────────────────────────────────────────────
function cn(...classes) { return classes.filter(Boolean).join(' '); }

// ─── Loading Screen ──────────────────────────────────────────────────────────
export function LoadingScreen() {
  return (
    <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: '#f7f6f3' }}>
      <div className="flex flex-col items-center gap-5">
        <div className="relative">
          {/* Soft pulse ring */}
          <div
            className="absolute inset-[-6px] rounded-2xl animate-ping opacity-20"
            style={{ background: '#4f6ef0', animationDuration: '1.8s' }}
          />
          <div
            className="relative w-12 h-12 rounded-xl flex items-center justify-center bg-[#4f6ef0]"
            style={{ boxShadow: '0 4px 16px rgba(79,110,240,0.3)' }}
          >
            <svg width="18" height="18" viewBox="0 0 14 14" fill="none">
              <path d="M2.5 11L7 3L11.5 11" stroke="white" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M4.5 8H9.5" stroke="white" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {[0, 0.18, 0.36].map((delay, i) => (
            <span
              key={i}
              className="w-1 h-1 rounded-full bg-[#ccc9c2] animate-bounce"
              style={{ animationDelay: `${delay}s`, animationDuration: '1s' }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
export default LoadingScreen;

// ─── Spinner ─────────────────────────────────────────────────────────────────
export function Spinner({ size = 'md', className }) {
  const sizes = {
    sm: 'w-3.5 h-3.5 border',
    md: 'w-5 h-5 border-2',
    lg: 'w-6 h-6 border-2',
  };
  return (
    <div
      className={cn(
        'rounded-full animate-spin',
        sizes[size],
        className
      )}
      style={{ borderColor: '#e0ddd7', borderTopColor: '#4f6ef0' }}
    />
  );
}

// ─── Avatar ──────────────────────────────────────────────────────────────────
const AVATAR_PALETTES = [
  { bg: '#eff0fe', color: '#3a56d4' },
  { bg: '#edf7f1', color: '#2a7d4f' },
  { bg: '#fef7ea', color: '#92600a' },
  { bg: '#fdf2ff', color: '#7e22ce' },
  { bg: '#fff0f0', color: '#b91c1c' },
  { bg: '#f0f9ff', color: '#0369a1' },
  { bg: '#f0fdf4', color: '#15803d' },
  { bg: '#fffbeb', color: '#b45309' },
];

export function Avatar({ name, src, size = 'md', className }) {
  const sizes = {
    xs:  { container: 'w-5 h-5 text-[8px]',   ring: '' },
    sm:  { container: 'w-7 h-7 text-[10px]',  ring: '' },
    md:  { container: 'w-9 h-9 text-[12px]',  ring: '' },
    lg:  { container: 'w-11 h-11 text-[14px]', ring: 'ring-2 ring-white' },
    xl:  { container: 'w-14 h-14 text-[18px]', ring: 'ring-2 ring-white' },
  };
  const { container } = sizes[size] || sizes.md;
  const initials = name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';
  const palette = AVATAR_PALETTES[(name?.charCodeAt(0) || 0) % AVATAR_PALETTES.length];

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={cn('rounded-full object-cover flex-shrink-0', container, className)}
      />
    );
  }

  return (
    <div
      className={cn('rounded-full flex items-center justify-center font-semibold flex-shrink-0', container, className)}
      style={{ background: palette.bg, color: palette.color }}
    >
      {initials}
    </div>
  );
}

// ─── Stat Card ───────────────────────────────────────────────────────────────
const STAT_PALETTES = {
  blue:   { icon: '#4f6ef0', iconBg: '#eff0fe', dot: '#4f6ef0' },
  green:  { icon: '#2a7d4f', iconBg: '#edf7f1', dot: '#2a7d4f' },
  orange: { icon: '#92600a', iconBg: '#fef7ea', dot: '#e9830a' },
  purple: { icon: '#7e22ce', iconBg: '#fdf2ff', dot: '#7e22ce' },
  red:    { icon: '#b91c1c', iconBg: '#fef2f2', dot: '#b91c1c' },
};

export function StatCard({ title, value, subtitle, icon: Icon, trend, color = 'blue' }) {
  const p = STAT_PALETTES[color] || STAT_PALETTES.blue;
  return (
    <div className="stat-card animate-fade-in">
      <div className="flex items-start justify-between mb-4">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: p.iconBg }}
        >
          <Icon size={17} color={p.icon} strokeWidth={1.8} />
        </div>
        {trend !== undefined && (
          <span
            className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
            style={
              trend >= 0
                ? { background: '#edf7f1', color: '#2a7d4f' }
                : { background: '#fef2f2', color: '#b91c1c' }
            }
          >
            {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
          </span>
        )}
      </div>
      <div
        className="text-[28px] font-bold leading-none tabular-nums tracking-tight"
        style={{ color: '#1a1916' }}
      >
        {value}
      </div>
      <div className="text-[13px] font-medium mt-1.5" style={{ color: '#44423d' }}>{title}</div>
      {subtitle && <div className="text-[11.5px] mt-0.5" style={{ color: '#a8a49e' }}>{subtitle}</div>}
    </div>
  );
}

// ─── Empty State ─────────────────────────────────────────────────────────────
export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5"
        style={{ background: '#f5f4f1', border: '1px solid #e8e5e0' }}
      >
        <Icon size={22} color="#a8a49e" strokeWidth={1.4} />
      </div>
      <h3 className="text-[15px] font-semibold mb-1.5" style={{ color: '#1a1916' }}>{title}</h3>
      {description && (
        <p className="text-[13px] max-w-xs leading-relaxed" style={{ color: '#7a7770' }}>{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

// ─── Page Header ─────────────────────────────────────────────────────────────
export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="page-header flex items-start justify-between gap-4">
      <div>
        <h1
          className="text-[22px] font-bold leading-tight tracking-[-0.02em]"
          style={{ color: '#1a1916' }}
        >
          {title}
        </h1>
        {subtitle && (
          <p className="text-[13px] mt-1" style={{ color: '#7a7770' }}>{subtitle}</p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>
      )}
    </div>
  );
}

// ─── Card primitives ─────────────────────────────────────────────────────────
export function Card({ children, className = '', style, ...props }) {
  return (
    <div className={`fd-card ${className}`} style={style} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({ children, className = '' }) {
  return (
    <div
      className={`px-5 py-4 border-b ${className}`}
      style={{ borderColor: '#eeece8' }}
    >
      {children}
    </div>
  );
}

export function CardContent({ children, className = '' }) {
  return <div className={`p-5 ${className}`}>{children}</div>;
}

// ─── Skeleton ────────────────────────────────────────────────────────────────
export function Skeleton({ className = '', style }) {
  return <div className={`shimmer ${className}`} style={style} />;
}

// ─── Badge ───────────────────────────────────────────────────────────────────
const BADGE_STYLES = {
  default: { background: '#f5f4f1', color: '#44423d', border: '1px solid #e8e5e0' },
  blue:    { background: '#eff0fe', color: '#3a56d4', border: '1px solid #c5d4fb' },
  green:   { background: '#edf7f1', color: '#2a7d4f', border: '1px solid #b8e2c9' },
  yellow:  { background: '#fef7ea', color: '#92600a', border: '1px solid #f5d78e' },
  red:     { background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca' },
  purple:  { background: '#fdf2ff', color: '#7e22ce', border: '1px solid #e9d5ff' },
};

export function Badge({ children, variant = 'default', className = '' }) {
  const s = BADGE_STYLES[variant] || BADGE_STYLES.default;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium ${className}`}
      style={s}
    >
      {children}
    </span>
  );
}
