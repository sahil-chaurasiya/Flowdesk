import React from 'react';
import { Link } from 'react-router-dom';

// ─── Utility ─────────────────────────────────────────────────────────────────
function cn(...classes) { return classes.filter(Boolean).join(' '); }

// ─── Loading Screen ──────────────────────────────────────────────────────────
export function LoadingScreen() {
  return (
    <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: 'var(--fd-canvas)' }}>
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
              className="w-1 h-1 rounded-full animate-bounce"
              style={{ background: 'var(--fd-ink-5)', animationDelay: `${delay}s`, animationDuration: '1s' }}
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
      style={{ borderColor: 'var(--fd-border-strong)', borderTopColor: '#4f6ef0' }}
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

// Dark mode palette variants
const AVATAR_PALETTES_DARK = [
  { bg: 'rgba(79,110,240,0.2)',  color: '#7896f3' },
  { bg: 'rgba(42,125,79,0.2)',   color: '#4ade80' },
  { bg: 'rgba(146,96,10,0.2)',   color: '#fbbf24' },
  { bg: 'rgba(126,34,206,0.2)',  color: '#c084fc' },
  { bg: 'rgba(185,28,28,0.2)',   color: '#f87171' },
  { bg: 'rgba(3,105,161,0.2)',   color: '#38bdf8' },
  { bg: 'rgba(21,128,61,0.2)',   color: '#4ade80' },
  { bg: 'rgba(180,83,9,0.2)',    color: '#fb923c' },
];

export function Avatar({ name, src, size = 'md', className }) {
  // Support numeric size (px) as well as named sizes
  const isNumeric = typeof size === 'number';
  const namedSizes = {
    xs:  { container: 'w-5 h-5 text-[8px]' },
    sm:  { container: 'w-7 h-7 text-[10px]' },
    md:  { container: 'w-9 h-9 text-[12px]' },
    lg:  { container: 'w-11 h-11 text-[14px]' },
    xl:  { container: 'w-14 h-14 text-[18px]' },
  };
  const container = isNumeric ? '' : (namedSizes[size]?.container || namedSizes.md.container);
  const inlineStyle = isNumeric ? { width: size, height: size, fontSize: Math.round(size * 0.35) } : {};

  const initials = name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';
  const idx = (name?.charCodeAt(0) || 0) % AVATAR_PALETTES.length;
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const palette = isDark ? AVATAR_PALETTES_DARK[idx] : AVATAR_PALETTES[idx];

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={cn('rounded-full object-cover flex-shrink-0', container, className)}
        style={inlineStyle}
        onError={e => { e.target.style.display = 'none'; }}
      />
    );
  }

  return (
    <div
      className={cn('rounded-full flex items-center justify-center font-semibold flex-shrink-0', container, className)}
      style={{ background: palette.bg, color: palette.color, ...inlineStyle }}
    >
      {initials}
    </div>
  );
}

// ─── Stat Card ───────────────────────────────────────────────────────────────
const STAT_PALETTES = {
  blue:   { icon: '#4f6ef0', iconBg: '#eff0fe', iconBgDark: 'rgba(79,110,240,0.15)' },
  green:  { icon: '#2a7d4f', iconBg: '#edf7f1', iconBgDark: 'rgba(42,125,79,0.15)' },
  orange: { icon: '#92600a', iconBg: '#fef7ea', iconBgDark: 'rgba(146,96,10,0.15)' },
  purple: { icon: '#7e22ce', iconBg: '#fdf2ff', iconBgDark: 'rgba(126,34,206,0.15)' },
  red:    { icon: '#b91c1c', iconBg: '#fef2f2', iconBgDark: 'rgba(185,28,28,0.15)' },
};

export function StatCard({ title, value, subtitle, icon: Icon, trend, color = 'blue', linkTo }) {
  const p = STAT_PALETTES[color] || STAT_PALETTES.blue;
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const iconColor = isDark ? p.icon.replace('#', '#') : p.icon;
  const iconBg = isDark ? p.iconBgDark : p.iconBg;

  const inner = (
    <>
      <div className="flex items-start justify-between mb-4">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: iconBg }}
        >
          <Icon size={17} color={iconColor} strokeWidth={1.8} />
        </div>
        {trend !== undefined && (
          <span
            className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
            style={
              trend >= 0
                ? { background: isDark ? 'rgba(42,125,79,0.2)' : '#edf7f1', color: isDark ? '#4ade80' : '#2a7d4f' }
                : { background: isDark ? 'rgba(185,28,28,0.2)' : '#fef2f2', color: isDark ? '#f87171' : '#b91c1c' }
            }
          >
            {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
          </span>
        )}
      </div>
      <div
        className="text-[28px] font-bold leading-none tabular-nums tracking-tight"
        style={{ color: 'var(--fd-ink-1)' }}
      >
        {value}
      </div>
      <div className="text-[13px] font-medium mt-1.5" style={{ color: 'var(--fd-ink-2)' }}>{title}</div>
      {subtitle && <div className="text-[11.5px] mt-0.5" style={{ color: 'var(--fd-ink-4)' }}>{subtitle}</div>}
    </>
  );

  if (linkTo) {
    return (
      <Link
        to={linkTo}
        className="stat-card animate-fade-in block transition-transform hover:scale-[1.02] hover:shadow-md cursor-pointer"
        style={{ textDecoration: 'none' }}
      >
        {inner}
      </Link>
    );
  }

  return (
    <div className="stat-card animate-fade-in">
      {inner}
    </div>
  );
}

// ─── Empty State ─────────────────────────────────────────────────────────────
export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5"
        style={{ background: 'var(--fd-surface-sunken)', border: '1px solid var(--fd-border)' }}
      >
        <Icon size={22} strokeWidth={1.4} style={{ color: 'var(--fd-ink-4)' }} />
      </div>
      <h3 className="text-[15px] font-semibold mb-1.5" style={{ color: 'var(--fd-ink-1)' }}>{title}</h3>
      {description && (
        <p className="text-[13px] max-w-xs leading-relaxed" style={{ color: 'var(--fd-ink-3)' }}>{description}</p>
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
          style={{ color: 'var(--fd-ink-1)' }}
        >
          {title}
        </h1>
        {subtitle && (
          <p className="text-[13px] mt-1" style={{ color: 'var(--fd-ink-3)' }}>{subtitle}</p>
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
      style={{ borderColor: 'var(--fd-border)' }}
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
const BADGE_STYLES_LIGHT = {
  default: { background: '#f5f4f1', color: '#44423d', border: '1px solid #e8e5e0' },
  blue:    { background: '#eff0fe', color: '#3a56d4', border: '1px solid #c5d4fb' },
  green:   { background: '#edf7f1', color: '#2a7d4f', border: '1px solid #b8e2c9' },
  yellow:  { background: '#fef7ea', color: '#92600a', border: '1px solid #f5d78e' },
  red:     { background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca' },
  purple:  { background: '#fdf2ff', color: '#7e22ce', border: '1px solid #e9d5ff' },
};

const BADGE_STYLES_DARK = {
  default: { background: 'rgba(138,134,128,0.15)', color: '#c4c0b8', border: '1px solid rgba(138,134,128,0.25)' },
  blue:    { background: 'rgba(79,110,240,0.18)',  color: '#7896f3', border: '1px solid rgba(79,110,240,0.3)' },
  green:   { background: 'rgba(42,125,79,0.18)',   color: '#4ade80', border: '1px solid rgba(42,125,79,0.3)' },
  yellow:  { background: 'rgba(146,96,10,0.18)',   color: '#fbbf24', border: '1px solid rgba(146,96,10,0.3)' },
  red:     { background: 'rgba(185,28,28,0.18)',   color: '#f87171', border: '1px solid rgba(185,28,28,0.3)' },
  purple:  { background: 'rgba(126,34,206,0.18)',  color: '#c084fc', border: '1px solid rgba(126,34,206,0.3)' },
};

export function Badge({ children, variant = 'default', className = '' }) {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const styles = isDark ? BADGE_STYLES_DARK : BADGE_STYLES_LIGHT;
  const s = styles[variant] || styles.default;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium ${className}`}
      style={s}
    >
      {children}
    </span>
  );
}
