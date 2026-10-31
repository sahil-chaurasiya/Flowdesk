import React, { useEffect, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import {
  TrendingUp, FileText, ClipboardList,
  ChevronRight, Eye, Heart, Instagram, Target, BarChart3,
  Users, Zap, ArrowUpRight, ArrowDownRight, Rss,
  ThumbsUp, Share2, Bookmark, Globe, Star, Activity,
  TrendingDown, Radio, Award, Flame, MousePointer,
  Bell, CalendarClock, Phone, Calendar, ChevronDown,
  Briefcase, Mail,
  Video, PenTool, Search, MousePointerClick,
} from 'lucide-react';
import api from '../../lib/api';
import useAuthStore from '../../context/authStore';
import {
  StatCard, Card, CardHeader, CardContent,
  Avatar, Spinner,
} from '../../components/shared/LoadingScreen';
import { formatDate, timeAgo, SERVICE_LABELS, PLAN_LABELS } from '../../lib/utils';

// ─── Color tokens — now use CSS variables so dark mode works ──────────────────
function getTokens() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  return {
    surface: isDark ? '#1e2025' : '#ffffff',
    border: isDark ? '#2a2d36' : '#eeece8',
    borderLight: isDark ? '#252830' : '#f2f0ec',
    ink: isDark ? '#edeae4' : '#1a1916',
    inkMid: isDark ? '#c4c0b8' : '#44423d',
    inkMute: isDark ? '#8a8680' : '#7a7770',
    inkFaint: isDark ? '#5e5b55' : '#a8a49e',
    inkGhost: isDark ? '#3d3b36' : '#ccc9c2',
    blue: isDark ? '#7896f3' : '#3a56d4',
    blueSoft: isDark ? 'rgba(79,110,240,0.2)' : '#eff0fe',
    green: isDark ? '#4ade80' : '#2a7d4f',
    greenSoft: isDark ? 'rgba(42,125,79,0.18)' : '#edf7f1',
    amber: isDark ? '#fbbf24' : '#92600a',
    amberSoft: isDark ? 'rgba(146,96,10,0.18)' : '#fef7ea',
    purple: isDark ? '#c084fc' : '#7e22ce',
    purpleSoft: isDark ? 'rgba(126,34,206,0.18)' : '#fdf2ff',
    red: isDark ? '#f87171' : '#b91c1c',
    redSoft: isDark ? 'rgba(185,28,28,0.18)' : '#fff0f0',
    teal: isDark ? '#38bdf8' : '#0e7490',
    tealSoft: isDark ? 'rgba(14,116,163,0.18)' : '#ecfeff',
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtNum(n) {
  if (!n) return '0';
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return String(n);
}

function pct(a, b) {
  if (!b) return '0%';
  return ((a / b) * 100).toFixed(1) + '%';
}

const PLATFORM_COLOR = {
  instagram: '#E1306C',
  facebook: '#1877F2',
  tiktok: '#010101',
  youtube: '#FF0000',
  linkedin: '#0A66C2',
  twitter: '#1DA1F2',
};

const PLATFORM_ICON = {
  instagram: '📸', facebook: '📘', tiktok: '🎵',
  youtube: '▶️', linkedin: '💼', twitter: '🐦',
};

const STATUS_ORDER = ['new', 'contacted', 'qualified', 'converted', 'lost'];

// ─── Month filter options ──────────────────────────────────────────────────────
const MONTH_OPTIONS = [
  { label: 'Last 30 days', value: 'last30', days: 30 },
  { label: 'This Month', value: 'thisMonth', days: null },
  { label: 'Last Month', value: 'lastMonth', days: null },
  { label: 'Last 3 Months', value: 'last3months', days: 90 },
  { label: 'Last 6 Months', value: 'last6months', days: 180 },
  { label: 'This Year', value: 'thisYear', days: null },
];

function getDateRange(filterValue) {
  const now = new Date();
  let startDate, endDate, days;

  switch (filterValue) {
    case 'last30':
      days = 30;
      endDate = now;
      startDate = new Date(now - 30 * 24 * 60 * 60 * 1000);
      break;
    case 'thisMonth':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = now;
      days = Math.ceil((now - startDate) / (24 * 60 * 60 * 1000));
      break;
    case 'lastMonth':
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      endDate = new Date(now.getFullYear(), now.getMonth(), 0);
      days = Math.ceil((endDate - startDate) / (24 * 60 * 60 * 1000));
      break;
    case 'last3months':
      days = 90;
      endDate = now;
      startDate = new Date(now - 90 * 24 * 60 * 60 * 1000);
      break;
    case 'last6months':
      days = 180;
      endDate = now;
      startDate = new Date(now - 180 * 24 * 60 * 60 * 1000);
      break;
    case 'thisYear':
      startDate = new Date(now.getFullYear(), 0, 1);
      endDate = now;
      days = Math.ceil((now - startDate) / (24 * 60 * 60 * 1000));
      break;
    default:
      days = 30;
      endDate = now;
      startDate = new Date(now - 30 * 24 * 60 * 60 * 1000);
  }

  return { startDate, endDate, days };
}

// ─── Mini components ──────────────────────────────────────────────────────────
function SectionHeader({ title, icon: Icon, linkTo, subtitle }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <div className="flex items-center gap-2">
          {Icon && <Icon size={13} className="text-[var(--fd-ink-4)]" strokeWidth={1.7} />}
          <span className="text-[13.5px] font-semibold text-[var(--fd-ink-1)]">{title}</span>
        </div>
        {subtitle && <p className="text-[11px] mt-0.5 ml-5 text-[var(--fd-ink-4)]">{subtitle}</p>}
      </div>
      {linkTo && (
        <Link
          to={linkTo}
          className="flex items-center gap-1 text-[12px] font-medium flex-shrink-0 text-[var(--fd-sidebar-link-active)]"
        >
          View all <ChevronRight size={12} />
        </Link>
      )}
    </div>
  );
}

// ─── Month Filter Dropdown ─────────────────────────────────────────────────────
function MonthFilter({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const C = getTokens();
  const selected = MONTH_OPTIONS.find(o => o.value === value) || MONTH_OPTIONS[0];

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-[12px] font-semibold border transition-all hover:opacity-80"
        style={{
          background: C.blueSoft,
          color: C.blue,
          borderColor: `${C.blue}40`,
        }}
      >
        <Calendar size={13} />
        {selected.label}
        <ChevronDown size={12} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </button>
      {open && (
        <div
          className="absolute right-0 top-full mt-1.5 z-50 rounded-2xl shadow-xl overflow-hidden min-w-[175px]"
          style={{
            background: 'var(--fd-surface)',
            border: '1px solid var(--fd-border)',
          }}
        >
          {MONTH_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className="w-full text-left flex items-center gap-2 px-4 py-2.5 text-[12.5px] transition-colors hover:bg-[var(--fd-surface-raised)]"
              style={{
                fontWeight: opt.value === value ? 700 : 400,
                color: opt.value === value ? C.blue : 'var(--fd-ink-2)',
                background: opt.value === value ? C.blueSoft : 'transparent',
              }}
            >
              {opt.value === value && <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: C.blue }} />}
              {opt.value !== value && <span className="w-1.5 h-1.5 flex-shrink-0" />}
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Sparkline (pure SVG, no deps) ───────────────────────────────────────────
function Sparkline({ data = [], color, height = 36, width = 100 }) {
  if (!data.length) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 6) - 3;
    return `${x},${y}`;
  });
  const line = `M ${pts.join(' L ')}`;
  const fill = `${line} L ${width},${height} L 0,${height} Z`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} fill="none">
      <defs>
        <linearGradient id={`sg-${color?.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fill} fill={`url(#sg-${color?.replace('#','')})`} />
      <path d={line} stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Horizontal bar ───────────────────────────────────────────────────────────
function HBar({ value, max, color, height = 6 }) {
  const p = max ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="rounded-full overflow-hidden bg-[var(--fd-border)]" style={{ height }}>
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${p}%`, background: color }}
      />
    </div>
  );
}

// ─── Donut chart ─────────────────────────────────────────────────────────────
function DonutChart({ segments = [], size = 80, thickness = 12 }) {
  const r = (size - thickness) / 2;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  const total = segments.reduce((a, s) => a + s.value, 0) || 1;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {segments.map((seg, i) => {
        const dash = (seg.value / total) * circ;
        const gap = circ - dash;
        const el = (
          <circle
            key={i}
            cx={size / 2} cy={size / 2} r={r}
            fill="none"
            stroke={seg.color}
            strokeWidth={thickness}
            strokeDasharray={`${dash} ${gap}`}
            strokeDashoffset={-offset}
            strokeLinecap="butt"
            style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }}
          />
        );
        offset += dash;
        return el;
      })}
    </svg>
  );
}

// ─── Delta badge ─────────────────────────────────────────────────────────────
function Delta({ value, suffix = '%' }) {
  const up = value >= 0;
  const C = getTokens();
  return (
    <span
      className="inline-flex items-center gap-0.5 text-[10.5px] font-semibold px-1.5 py-0.5 rounded-full"
      style={{ background: up ? C.greenSoft : C.redSoft, color: up ? C.green : C.red }}
    >
      {up ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
      {Math.abs(value)}{suffix}
    </span>
  );
}

// ─── Big stat card ────────────────────────────────────────────────────────────
function BigStatCard({ title, value, icon: Icon, color, bg, delta, subtitle, sparkData, linkTo }) {
  const inner = (
    <>
      <div className="flex items-start justify-between">
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: bg }}
        >
          <Icon size={15} color={color} strokeWidth={1.8} />
        </div>
        {delta !== undefined && <Delta value={delta} />}
      </div>
      <div>
        <div className="text-[22px] font-bold tabular-nums leading-none text-[var(--fd-ink-1)]">
          {value}
        </div>
        <div className="text-[11.5px] mt-1 font-medium text-[var(--fd-ink-3)]">{title}</div>
        {subtitle && <div className="text-[11px] mt-0.5 text-[var(--fd-ink-4)]">{subtitle}</div>}
      </div>
      {sparkData && (
        <div className="mt-auto pt-1">
          <Sparkline data={sparkData} color={color} width={120} height={30} />
        </div>
      )}
    </>
  );

  if (linkTo) {
    return (
      <Link
        to={linkTo}
        className="fd-card rounded-2xl p-4 flex flex-col gap-2 block transition-transform hover:scale-[1.02] hover:shadow-md"
        style={{ textDecoration: 'none' }}
      >
        {inner}
      </Link>
    );
  }

  return (
    <div className="fd-card rounded-2xl p-4 flex flex-col gap-2">
      {inner}
    </div>
  );
}

function mockSpark(seed, count = 10) {
  let v = 30 + (seed % 40);
  return Array.from({ length: count }, () => {
    v = Math.max(0, v + (Math.random() - 0.45) * 15);
    return Math.round(v);
  });
}

// ─── Follow-Ups Today Widget ──────────────────────────────────────────────────
function FollowUpsToday({ leads }) {
  const C = getTokens();
  if (!leads || leads.length === 0) return null;

  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);

  return (
    <div
      className="fd-card rounded-2xl overflow-hidden"
      style={{ border: `1px solid ${C.amber}50` }}
    >
      <div
        className="px-5 py-3.5 flex items-center justify-between"
        style={{ background: C.amberSoft, borderBottom: `1px solid ${C.amber}30` }}
      >
        <div className="flex items-center gap-2">
          <Bell size={14} color={C.amber} strokeWidth={1.8} />
          <span className="text-[13px] font-semibold" style={{ color: C.amber }}>
            Follow-Ups Due Today
          </span>
          <span
            className="text-[10.5px] font-bold px-1.5 py-0.5 rounded-full"
            style={{ background: '#25d366', color: '#fff' }}
          >
            {leads.length}
          </span>
        </div>
        <Link
          to="/portal/leads"
          className="flex items-center gap-1 text-[11.5px] font-medium"
          style={{ color: C.amber }}
        >
          View all <ChevronRight size={12} />
        </Link>
      </div>

      <div className="divide-y divide-[var(--fd-border-subtle)]">
        {leads.slice(0, 5).map(lead => {
          const fuDate = new Date(lead.clientFollowUpDate);
          const isOverdue = fuDate < todayStart;
          return (
            <div
              key={lead._id}
              className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-[var(--fd-table-row-hover)]"
            >
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: isOverdue ? C.redSoft : C.amberSoft }}
              >
                <CalendarClock size={14} color={isOverdue ? C.red : C.amber} strokeWidth={1.8} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[12.5px] font-semibold truncate text-[var(--fd-ink-1)]">
                  {lead.name || lead.email || lead.phone || 'Unknown Lead'}
                </div>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {lead.clientFollowUpNote && (
                    <span className="text-[11px] truncate text-[var(--fd-ink-4)]">
                      {lead.clientFollowUpNote}
                    </span>
                  )}
                  {!lead.clientFollowUpNote && lead.phone && (
                    <span className="flex items-center gap-1 text-[11px] text-[var(--fd-ink-4)]">
                      <Phone size={9} /> {lead.phone}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex-shrink-0 text-right">
                <span
                  className="text-[10.5px] font-semibold px-2 py-0.5 rounded-full"
                  style={
                    isOverdue
                      ? { background: C.redSoft, color: C.red }
                      : { background: C.amberSoft, color: C.amber }
                  }
                >
                  {isOverdue ? '⚠ Overdue' : '🔔 Today'}
                </span>
                {lead.source && (
                  <div className="text-[10px] mt-1 text-[var(--fd-ink-5)]">{lead.source}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {leads.length > 5 && (
        <div
          className="px-5 py-2.5 text-center text-[11.5px] font-medium"
          style={{ background: 'var(--fd-surface-raised)', color: 'var(--fd-ink-4)' }}
        >
          +{leads.length - 5} more follow-ups due
        </div>
      )}
    </div>
  );
}

// ─── Upcoming Events Strip ────────────────────────────────────────────────────
const EVENT_COLORS = {
  task_deadline: { bg: '#ef4444', light: '#fef2f2', text: '#b91c1c' },
  meeting:       { bg: '#4f6ef0', light: '#eff0fe', text: '#3a56d4' },
  reminder:      { bg: '#f59e0b', light: '#fffbeb', text: '#92600a' },
  follow_up:     { bg: '#a855f7', light: '#faf5ff', text: '#7e22ce' },
  campaign:      { bg: '#22c55e', light: '#f0fdf4', text: '#15803d' },
  shoot:         { bg: '#ec4899', light: '#fdf2f8', text: '#be185d' },
  other:         { bg: '#94a3b8', light: '#f8fafc', text: '#475569' },
};

const TYPE_ICONS = {
  task_deadline: '⏰', meeting: '🤝', reminder: '🔔',
  follow_up: '📞', campaign: '🚀', shoot: '📸', other: '📌',
};

function UpcomingEventsStrip({ events }) {
  const scrollRef = useRef(null);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Get next 14 days
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    return d;
  });

  const eventsForDay = (day) =>
    events.filter(ev => {
      const s = new Date(ev.startDate); s.setHours(0,0,0,0);
      const e = new Date(ev.endDate);   e.setHours(23,59,59,999);
      return day >= s && day <= e;
    });

  const DAY_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  const totalUpcoming = events.length;
  const nextEvent = events.find(ev => new Date(ev.startDate) >= today);

  if (events.length === 0) return null;

  return (
    <div className="fd-card rounded-2xl overflow-hidden" style={{ padding: 0 }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: 'var(--fd-accent-light, #eff0fe)' }}>
            <CalendarClock size={14} style={{ color: 'var(--fd-accent, #4f6ef0)' }} />
          </div>
          <div>
            <span className="text-[13px] font-bold" style={{ color: 'var(--fd-ink-1)' }}>Upcoming</span>
            <span className="text-[11px] ml-1.5 font-medium px-1.5 py-0.5 rounded-full"
              style={{ background: 'var(--fd-accent-light, #eff0fe)', color: 'var(--fd-accent, #4f6ef0)' }}>
              {totalUpcoming} event{totalUpcoming !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
        <Link to="/portal/calendar"
          className="text-[11px] font-semibold flex items-center gap-0.5 transition-opacity hover:opacity-70"
          style={{ color: 'var(--fd-accent, #4f6ef0)' }}>
          View all <ChevronRight size={12} />
        </Link>
      </div>

      {/* 14-day scroll strip */}
      <div
        ref={scrollRef}
        className="flex gap-2 overflow-x-auto px-4 pb-4"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {days.map((day, i) => {
          const dayEvts = eventsForDay(day);
          const isToday = i === 0;
          const isWeekend = day.getDay() === 0 || day.getDay() === 6;
          const hasEvents = dayEvts.length > 0;

          return (
            <div key={i} className="flex-shrink-0 flex flex-col items-center gap-1.5"
              style={{ minWidth: 52 }}>
              {/* Day label */}
              <div
                className="text-[9px] font-bold uppercase tracking-wider"
                style={{ color: isToday ? 'var(--fd-accent, #4f6ef0)' : isWeekend ? 'var(--fd-ink-4)' : 'var(--fd-ink-4)' }}
              >
                {isToday ? 'TODAY' : DAY_SHORT[day.getDay()]}
              </div>

              {/* Date bubble */}
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center text-[13px] font-bold transition-all"
                style={{
                  background: isToday
                    ? 'var(--fd-accent, #4f6ef0)'
                    : hasEvents
                    ? 'var(--fd-surface-sunken)'
                    : 'transparent',
                  color: isToday ? '#fff' : hasEvents ? 'var(--fd-ink-1)' : 'var(--fd-ink-4)',
                  border: hasEvents && !isToday ? '1.5px dashed var(--fd-border)' : 'none',
                  boxShadow: isToday ? '0 2px 8px rgba(79,110,240,0.35)' : 'none',
                }}
              >
                {format(day, 'd')}
              </div>

              {/* Event dots / pills */}
              <div className="flex flex-col items-center gap-1 w-full">
                {dayEvts.slice(0, 2).map((ev, j) => {
                  const c = EVENT_COLORS[ev.type] || EVENT_COLORS.other;
                  return (
                    <div key={j}
                      className="w-full rounded-md px-1 py-0.5 text-center text-[8px] font-bold truncate"
                      style={{ background: c.light, color: c.text }}
                      title={ev.title}
                    >
                      {TYPE_ICONS[ev.type]} {ev.title.length > 6 ? ev.title.slice(0,6)+'…' : ev.title}
                    </div>
                  );
                })}
                {dayEvts.length > 2 && (
                  <div className="text-[8px] font-bold" style={{ color: 'var(--fd-ink-4)' }}>
                    +{dayEvts.length - 2}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Next event spotlight */}
      {nextEvent && (() => {
        const c = EVENT_COLORS[nextEvent.type] || EVENT_COLORS.other;
        const daysUntil = Math.ceil((new Date(nextEvent.startDate) - today) / 86400000);
        return (
          <div className="mx-4 mb-4 rounded-xl px-3 py-2.5 flex items-center gap-3"
            style={{ background: c.light, border: `1px solid ${c.bg}30` }}>
            <span className="text-[18px]">{TYPE_ICONS[nextEvent.type]}</span>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-bold truncate" style={{ color: c.text }}>{nextEvent.title}</p>
              <p className="text-[10px]" style={{ color: c.text, opacity: 0.75 }}>
                {format(new Date(nextEvent.startDate), 'EEE, MMM d · h:mm a')}
              </p>
            </div>
            <span className="text-[10px] font-bold px-2 py-1 rounded-full flex-shrink-0"
              style={{ background: c.bg, color: '#fff' }}>
              {daysUntil === 0 ? 'Today' : daysUntil === 1 ? 'Tomorrow' : `In ${daysUntil}d`}
            </span>
          </div>
        );
      })()}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
export default function ClientDashboard() {
  const { user } = useAuthStore();
  const [overview, setOverview] = useState(null);
  const [leadStats, setLeadStats] = useState(null);
  const [recentLeads, setRecentLeads] = useState([]);
  const [followUpLeads, setFollowUpLeads] = useState([]);
  const [socialAnalytics, setSocialAnalytics] = useState(null);
  const [recentPosts, setRecentPosts] = useState([]);
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [monthFilter, setMonthFilter] = useState('last30');
  const [filterLoading, setFilterLoading] = useState(false);
  const [showServicesModal, setShowServicesModal] = useState(false);

  const fetchData = useCallback((filter = 'last30') => {
    if (!user?.clientId) return;
    // clientId may be a plain string or an ObjectId object — extract safely
    const clientId = typeof user.clientId === 'object' ? (user.clientId._id || user.clientId) : user.clientId;
    const { days } = getDateRange(filter);
    const socialDays = days || 30;

    setFilterLoading(true);
    const now = new Date();
    const calFrom = now.toISOString();
    const calTo   = new Date(now.getFullYear(), now.getMonth() + 2, 0).toISOString();
    Promise.all([
      api.get(`/clients/${clientId}/overview`).catch(() => ({ data: null })),
      api.get('/leads/stats').catch(() => ({ data: null })),
      api.get('/leads?limit=8').catch(() => ({ data: { leads: [] } })),
      api.get('/leads/follow-ups-today').catch(() => ({ data: { leads: [] } })),
      api.get(`/social/analytics?days=${socialDays}`).catch(() => ({ data: null })),
      api.get(`/social/posts?status=published&limit=4`).catch(() => ({ data: { posts: [] } })),
      api.get('/calendar/client-portal', { params: { from: calFrom, to: calTo } }).catch(() => ({ data: { events: [] } })),
    ]).then(([ov, ls, l, fu, sa, p, cal]) => {
      setOverview(ov.data);
      setLeadStats(ls.data);
      setRecentLeads(l.data?.leads || []);
      setFollowUpLeads(fu.data?.leads || []);
      setSocialAnalytics(sa.data?.analytics || null);
      setRecentPosts(p.data?.posts || []);
      setCalendarEvents(cal.data?.events || []);
    }).finally(() => {
      setLoading(false);
      setFilterLoading(false);
    });
  }, [user?.clientId]);

  useEffect(() => {
    fetchData(monthFilter);
  }, [user?.clientId]);

  const handleFilterChange = (newFilter) => {
    setMonthFilter(newFilter);
    fetchData(newFilter);
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>;

  // Get dynamic color tokens
  const C = getTokens();

  const client = overview?.client;
  const manager = client?.accountManager;
  const totals = socialAnalytics?.totals || {};
  const byPlatform = socialAnalytics?.byPlatform || [];

  const byStatus = leadStats?.byClientStatus || leadStats?.byStatus || [];
  const totalLeads = leadStats?.total || 0;
  const qualifiedLeads = byStatus.find(s => s._id === 'qualified')?.count || 0;
  const convertedLeads = byStatus.find(s => s._id === 'converted')?.count || 0;
  const newLeads = byStatus.find(s => s._id === 'new')?.count || 0;
  const conversionRate = totalLeads ? ((convertedLeads / totalLeads) * 100).toFixed(1) : 0;

  const STATUS_STYLE = {
    new:       { background: 'var(--fd-surface-sunken)', color: 'var(--fd-ink-3)' },
    contacted: { background: C.blueSoft, color: C.blue },
    qualified: { background: C.amberSoft, color: C.amber },
    converted: { background: C.greenSoft, color: C.green },
    lost:      { background: C.redSoft, color: C.red },
  };

  const funnelSegments = STATUS_ORDER.map(s => ({
    label: s,
    value: byStatus.find(x => x._id === s)?.count || 0,
    color: { new: C.inkGhost, contacted: C.blue, qualified: '#f59e0b', converted: C.green, lost: C.red }[s],
  })).filter(s => s.value > 0);

  const topPlatform = byPlatform.reduce((best, p) => (!best || p.reach > best.reach) ? p : best, null);
  const maxReach = byPlatform.reduce((m, p) => Math.max(m, p.reach || 0), 1);
  const maxLikes = byPlatform.reduce((m, p) => Math.max(m, p.likes || 0), 1);

  const engRate = totals.avgEngagementRate || 0;
  const engColor = engRate >= 5 ? C.green : engRate >= 2 ? C.amber : C.red;

  const selectedMonthLabel = MONTH_OPTIONS.find(o => o.value === monthFilter)?.label || 'Last 30 days';

  return (
    <div className="space-y-5 animate-fade-in" style={{ opacity: filterLoading ? 0.7 : 1, transition: 'opacity 0.2s' }}>

      {/* ─── HEADER ─────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold tracking-[-0.02em] leading-none mb-1.5 text-[var(--fd-ink-1)]">
            Welcome back, {user?.name?.split(' ')[0]} 👋
          </h1>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[13px] text-[var(--fd-ink-3)]">{client?.company}</span>
            {client?.plan && (
              <>
                <span style={{ color: C.inkGhost }}>·</span>
                <span className="text-[11.5px] font-semibold px-2 py-0.5 rounded-full" style={{ background: C.blueSoft, color: C.blue }}>
                  {(PLAN_LABELS || {})[client.plan] || client.plan} Plan
                </span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <MonthFilter value={monthFilter} onChange={handleFilterChange} />
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11.5px] font-semibold capitalize"
            style={client?.status === 'active'
              ? { background: C.greenSoft, color: C.green, border: `1px solid ${C.green}40` }
              : { background: 'var(--fd-surface-sunken)', color: 'var(--fd-ink-3)', border: '1px solid var(--fd-border)' }
            }
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: client?.status === 'active' ? C.green : C.inkFaint }} />
            {client?.status || 'active'}
          </div>
        </div>
      </div>

      {/* ─── CONTRACT EXPIRY BANNER ──────────────────────────────────────── */}
      {client?.contractEndDate && (() => {
        const days = Math.ceil((new Date(client.contractEndDate) - Date.now()) / 86400000);
        if (days > 30) return null; // only show when expiring soon or expired
        const isExpired  = days < 0;
        const isCritical = days >= 0 && days <= 7;
        const bg     = isExpired  ? 'rgba(239,68,68,0.08)'   : isCritical ? 'rgba(245,158,11,0.08)' : 'rgba(79,110,240,0.07)';
        const border = isExpired  ? 'rgba(239,68,68,0.25)'   : isCritical ? 'rgba(245,158,11,0.25)' : 'rgba(79,110,240,0.2)';
        const color  = isExpired  ? '#ef4444'                 : isCritical ? '#f59e0b'               : '#4f6ef0';
        const icon   = isExpired  ? '❌'                       : isCritical ? '🚨'                   : '⚠️';
        const msg    = isExpired
          ? `Your contract expired ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} ago. Please renew to avoid service interruption.`
          : days === 0
            ? 'Your contract expires today! Please submit payment to renew.'
            : `Your contract expires in ${days} day${days === 1 ? '' : 's'}. Submit payment to avoid interruption.`;
        return (
          <Link
            to="/portal/payment"
            className="flex items-center gap-3 px-4 py-3 rounded-xl transition-opacity hover:opacity-80"
            style={{ background: bg, border: `1px solid ${border}` }}
          >
            <span className="text-[18px] flex-shrink-0">{icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold" style={{ color }}>{msg}</p>
              <p className="text-[11.5px] mt-0.5" style={{ color }}>
                {isExpired ? 'Contract expired' : 'Contract expiring'} · Click to go to Payments
              </p>
            </div>
            <ChevronRight size={16} style={{ color, flexShrink: 0 }} />
          </Link>
        );
      })()}

      {/* ─── ACCOUNT MANAGER + QUICK ACTIONS ROW ────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">

        {/* Account Manager */}
        {manager && (
          <div className="fd-card rounded-2xl p-4 flex flex-col gap-3">
            <p className="text-[10.5px] font-semibold uppercase tracking-wider text-[var(--fd-ink-4)]">
              Your Account Manager
            </p>
            <div className="flex items-center gap-3">
              <Avatar name={manager.name} size="md" />
              <div>
                <div className="text-[13.5px] font-semibold text-[var(--fd-ink-1)]">{manager.name}</div>
                <div className="text-[11.5px] text-[var(--fd-ink-4)]">Project Manager</div>
              </div>
            </div>
            {(() => {
              const waLink = client?.whatsappGroup
                ? client.whatsappGroup
                : client?.whatsappPhone
                  ? `https://wa.me/${client.whatsappPhone.replace(/\D/g,'')}`
                  : null;
              return waLink ? (
                <a
                  href={waLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-[12.5px] font-semibold transition-all hover:opacity-90 mt-auto"
                  style={{ background: '#25d366', color: '#fff' }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  Open WhatsApp
                </a>
              ) : null;
            })()}
          </div>
        )}

        {/* Quick Actions — spans remaining columns */}
        <div className={`fd-card rounded-2xl p-4 ${manager ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
          <p className="text-[10.5px] font-semibold uppercase tracking-wider mb-3 text-[var(--fd-ink-4)]">
            Quick Actions
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
            {[
              { to: '/portal/leads',    icon: Target,        label: 'View Leads',       desc: 'Your lead pipeline',   color: C.blue,    bg: C.blueSoft },
              { to: '/portal/social',   icon: Instagram,     label: 'Social Media',     desc: 'Posts & analytics',    color: '#e1306c', bg: 'rgba(225,48,108,0.1)' },
              { to: '/portal/requests', icon: ClipboardList, label: 'Submit Request',   desc: 'New task or revision', color: C.purple,  bg: C.purpleSoft },
              { to: '/portal/files',    icon: FileText,      label: 'View Files',       desc: 'Deliverables & assets',color: C.teal,    bg: C.tealSoft },
              { to: '/portal/reports',  icon: BarChart3,     label: 'Reports',          desc: 'Performance data',     color: C.amber,   bg: C.amberSoft },
            ].map(({ to, icon: Icon, label, desc, color, bg }) => (
              <Link
                key={to}
                to={to}
                className="flex items-center gap-3 p-2.5 rounded-xl transition-colors hover:bg-[var(--fd-surface-raised)]"
              >
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: bg }}>
                  <Icon size={13} strokeWidth={1.7} style={{ color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[12.5px] font-medium text-[var(--fd-ink-2)]">{label}</div>
                  <div className="text-[11px] text-[var(--fd-ink-4)]">{desc}</div>
                </div>
                <ChevronRight size={12} className="text-[var(--fd-ink-5)]" />
              </Link>
            ))}
            {/* Services — opens modal */}
            <button
              onClick={() => setShowServicesModal(true)}
              className="flex items-center gap-3 p-2.5 rounded-xl transition-colors hover:bg-[var(--fd-surface-raised)] text-left w-full"
            >
              <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: C.greenSoft }}>
                <Briefcase size={13} strokeWidth={1.7} style={{ color: C.green }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[12.5px] font-medium text-[var(--fd-ink-2)]">Services</div>
                <div className="text-[11px] text-[var(--fd-ink-4)]">Active & available</div>
              </div>
              <ChevronRight size={12} className="text-[var(--fd-ink-5)]" />
            </button>
          </div>
        </div>
      </div>

      {/* ─── TOP KPI CARDS ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <BigStatCard
          title="Total Leads"
          value={fmtNum(totalLeads)}
          icon={Target}
          color={C.blue}
          bg={C.blueSoft}
          delta={12}
          subtitle={`${newLeads} new this month`}
          sparkData={mockSpark(totalLeads || 42)}
          linkTo="/portal/leads"
        />
        <BigStatCard
          title="Qualified Leads"
          value={fmtNum(qualifiedLeads)}
          icon={Star}
          color="#f59e0b"
          bg={C.amberSoft}
          delta={8}
          subtitle={`${pct(qualifiedLeads, totalLeads)} of pipeline`}
          sparkData={mockSpark(qualifiedLeads || 22)}
          linkTo="/portal/leads?status=qualified"
        />
        <BigStatCard
          title="Conversions"
          value={fmtNum(convertedLeads)}
          icon={Award}
          color={C.green}
          bg={C.greenSoft}
          delta={Number(conversionRate)}
          subtitle={`${conversionRate}% close rate`}
          sparkData={mockSpark(convertedLeads || 11)}
          linkTo="/portal/leads?status=converted"
        />
        <BigStatCard
          title="Total Reach"
          value={fmtNum(totals.totalReach || 0)}
          icon={Globe}
          color={C.purple}
          bg={C.purpleSoft}
          delta={5}
          subtitle="Across all platforms"
          sparkData={mockSpark((totals.totalReach || 0) % 80 + 10)}
          linkTo="/portal/social"
        />
      </div>

      {/* ─── UPCOMING EVENTS STRIP ───────────────────────────────────────── */}
      <UpcomingEventsStrip events={calendarEvents} />

      {/* ─── FOLLOW-UPS DUE TODAY ────────────────────────────────────────── */}
      {followUpLeads.length > 0 && (
        <FollowUpsToday leads={followUpLeads} />
      )}

      {/* ─── ROW 2: LEAD FUNNEL + SOCIAL OVERVIEW ────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Lead Funnel */}
        <div className="fd-card rounded-2xl p-5 flex flex-col gap-4">
          <SectionHeader title="Lead Pipeline" icon={Target} linkTo="/portal/leads" subtitle="Current funnel breakdown" />

          <div className="flex items-center gap-5">
            <div className="relative flex-shrink-0">
              <DonutChart segments={funnelSegments.length ? funnelSegments : [{ value: 1, color: C.border }]} size={96} thickness={13} />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-[17px] font-bold text-[var(--fd-ink-1)]">{fmtNum(totalLeads)}</span>
                <span className="text-[9px] font-medium uppercase tracking-wider text-[var(--fd-ink-4)]">leads</span>
              </div>
            </div>

            <div className="flex-1 space-y-2.5">
              {STATUS_ORDER.map(s => {
                const count = byStatus.find(x => x._id === s)?.count || 0;
                const color = { new: C.inkGhost, contacted: C.blue, qualified: '#f59e0b', converted: C.green, lost: C.red }[s];
                return (
                  <div key={s}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                        <span className="text-[11.5px] capitalize font-medium text-[var(--fd-ink-2)]">{s}</span>
                      </div>
                      <span className="text-[11.5px] tabular-nums font-semibold text-[var(--fd-ink-1)]">{count}</span>
                    </div>
                    <HBar value={count} max={totalLeads || 1} color={color} />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Conversion highlight */}
          <div
            className="flex items-center justify-between rounded-xl px-4 py-3"
            style={{ background: C.greenSoft, border: `1px solid ${C.green}40` }}
          >
            <div className="flex items-center gap-2">
              <Flame size={14} color={C.green} />
              <span className="text-[12px] font-semibold" style={{ color: C.green }}>Close Rate</span>
            </div>
            <span className="text-[16px] font-bold tabular-nums" style={{ color: C.green }}>{conversionRate}%</span>
          </div>
        </div>

        {/* Social Overview */}
        <div className="fd-card rounded-2xl p-5 flex flex-col gap-4">
          <SectionHeader title="Social Media Overview" icon={Activity} linkTo="/portal/social" subtitle={selectedMonthLabel} />

          <div className="grid grid-cols-2 gap-2.5">
            {[
              { label: 'Posts', val: fmtNum(totals.totalPosts || 0), icon: Radio, color: C.blue, bg: C.blueSoft },
              { label: 'Impressions', val: fmtNum(totals.totalReach || 0), icon: Eye, color: C.purple, bg: C.purpleSoft },
              { label: 'Likes', val: fmtNum(totals.totalLikes || 0), icon: Heart, color: '#e11d48', bg: 'rgba(225,29,72,0.1)' },
              {
                label: 'Engagement',
                val: engRate ? engRate.toFixed(1) + '%' : '—',
                icon: Zap,
                color: engColor,
                bg: engColor === C.green ? C.greenSoft : engColor === C.amber ? C.amberSoft : C.redSoft,
              },
            ].map(({ label, val, icon: Icon, color, bg }) => (
              <div key={label} className="rounded-xl p-3 flex items-center gap-3 bg-[var(--fd-surface-raised)] border border-[var(--fd-border)]">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: bg }}>
                  <Icon size={13} color={color} strokeWidth={1.8} />
                </div>
                <div>
                  <div className="text-[15px] font-bold tabular-nums leading-none text-[var(--fd-ink-1)]">{val}</div>
                  <div className="text-[10.5px] mt-0.5 text-[var(--fd-ink-4)]">{label}</div>
                </div>
              </div>
            ))}
          </div>

          {byPlatform.length > 0 ? (
            <div className="space-y-2">
              <p className="text-[10.5px] uppercase tracking-wider font-semibold text-[var(--fd-ink-4)]">By Platform</p>
              {byPlatform.slice(0, 4).map(p => (
                <div key={p.platform} className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center text-[12px] flex-shrink-0 bg-[var(--fd-surface-sunken)]">
                    {PLATFORM_ICON[p.platform] || '📱'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between mb-1">
                      <span className="text-[11.5px] capitalize font-medium text-[var(--fd-ink-2)]">{p.platform}</span>
                      <span className="text-[10.5px] tabular-nums text-[var(--fd-ink-4)]">{fmtNum(p.reach || 0)} reach</span>
                    </div>
                    <HBar value={p.reach || 0} max={maxReach} color={PLATFORM_COLOR[p.platform] || C.blue} height={5} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center py-4">
              <div className="text-center">
                <Instagram size={22} className="mx-auto mb-2 text-[var(--fd-ink-5)]" strokeWidth={1.3} />
                <p className="text-[12px] text-[var(--fd-ink-4)]">No social data yet</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── ROW 3: ENGAGEMENT BARS + RECENT POSTS ───────────────────────── */}
      {byPlatform.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          <div className="lg:col-span-2 fd-card rounded-2xl p-5">
            <SectionHeader title="Engagement by Platform" icon={BarChart3} subtitle="Likes, shares & interactions" />
            <div className="mt-4 space-y-4">
              {byPlatform.slice(0, 5).map(p => {
                const er = p.engagementRate || 0;
                const erColor = er >= 5 ? C.green : er >= 2 ? C.amber : C.inkFaint;
                return (
                  <div key={p.platform}>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[13px] flex-shrink-0 bg-[var(--fd-surface-sunken)]">
                        {PLATFORM_ICON[p.platform] || '📱'}
                      </div>
                      <span className="text-[12.5px] capitalize font-semibold flex-1 text-[var(--fd-ink-2)]">{p.platform}</span>
                      <span className="text-[11px] font-bold tabular-nums" style={{ color: erColor }}>{er.toFixed(1)}% eng.</span>
                    </div>
                    <div className="flex gap-2 items-center">
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-[10px] text-[var(--fd-ink-4)]">Likes</span>
                          <span className="text-[10px] tabular-nums text-[var(--fd-ink-4)]">{fmtNum(p.likes || 0)}</span>
                        </div>
                        <HBar value={p.likes || 0} max={maxLikes} color={PLATFORM_COLOR[p.platform] || C.blue} height={7} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-[10px] text-[var(--fd-ink-4)]">Posts</span>
                          <span className="text-[10px] tabular-nums text-[var(--fd-ink-4)]">{p.posts || 0}</span>
                        </div>
                        <HBar value={p.posts || 0} max={byPlatform.reduce((m, x) => Math.max(m, x.posts || 0), 1)} color="#a78bfa" height={7} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="fd-card rounded-2xl p-5 flex flex-col gap-3">
            <SectionHeader title="Recent Posts" icon={Instagram} linkTo="/portal/social" />
            {recentPosts.length > 0 ? recentPosts.map(post => (
              <div
                key={post._id}
                className="flex gap-3 p-2.5 rounded-xl bg-[var(--fd-surface-raised)] border border-[var(--fd-border)]"
              >
                <div className="w-12 h-12 rounded-lg overflow-hidden flex items-center justify-center flex-shrink-0 bg-[var(--fd-surface-sunken)]">
                  {post.mediaUrls?.[0] ? (
                    <img src={post.mediaUrls[0]} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xl">{PLATFORM_ICON[post.platform] || '📱'}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span
                      className="text-[9.5px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                      style={{ background: C.blueSoft, color: C.blue }}
                    >{post.platform}</span>
                  </div>
                  <p className="text-[11.5px] line-clamp-2 leading-relaxed text-[var(--fd-ink-2)]">
                    {post.content || 'Published post'}
                  </p>
                  <div className="flex items-center gap-3 mt-1.5">
                    {post.analytics?.likes != null && (
                      <span className="flex items-center gap-0.5 text-[10px] text-[var(--fd-ink-4)]">
                        <Heart size={9} /> {fmtNum(post.analytics.likes)}
                      </span>
                    )}
                    {post.analytics?.reach != null && (
                      <span className="flex items-center gap-0.5 text-[10px] text-[var(--fd-ink-4)]">
                        <Eye size={9} /> {fmtNum(post.analytics.reach)}
                      </span>
                    )}
                    <span className="text-[10px] ml-auto text-[var(--fd-ink-5)]">
                      {post.publishedAt ? timeAgo(post.publishedAt) : ''}
                    </span>
                  </div>
                </div>
              </div>
            )) : (
              <div className="flex-1 flex items-center justify-center py-8">
                <div className="text-center">
                  <Radio size={20} className="mx-auto mb-2 text-[var(--fd-ink-5)]" strokeWidth={1.3} />
                  <p className="text-[12px] text-[var(--fd-ink-4)]">No posts published yet</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── ROW 4: LEADS TABLE + RIGHT SIDEBAR ─────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Recent Leads */}
        <div className="lg:col-span-2 fd-card rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--fd-border-subtle)]">
            <SectionHeader title="Recent Leads" icon={Users} linkTo="/portal/leads" subtitle={`${totalLeads} leads in pipeline`} />
          </div>
          {recentLeads.length > 0 ? (
            <div>
              <div className="grid grid-cols-[1fr_100px_80px] gap-2 px-5 py-2 bg-[var(--fd-surface-raised)] border-b border-[var(--fd-border-subtle)]">
                {['Name / Source', 'Status', 'Added'].map(h => (
                  <span key={h} className="text-[10.5px] font-semibold uppercase tracking-wider text-[var(--fd-ink-4)]">{h}</span>
                ))}
              </div>
              {recentLeads.map((lead) => (
                <div
                  key={lead._id}
                  className="grid grid-cols-[1fr_100px_80px] gap-2 items-center px-5 py-3 border-b last:border-0 transition-colors hover:bg-[var(--fd-table-row-hover)]"
                  style={{ borderColor: 'var(--fd-border-subtle)' }}
                >
                  <div className="min-w-0">
                    <div className="text-[12.5px] font-semibold truncate text-[var(--fd-ink-1)]">
                      {lead.name || lead.email || 'Anonymous Lead'}
                    </div>
                    {lead.source && (
                      <div className="text-[11px] mt-0.5 flex items-center gap-1 text-[var(--fd-ink-4)]">
                        <MousePointer size={9} /> {lead.source}
                      </div>
                    )}
                  </div>
                  <span
                    className="text-[10.5px] font-semibold px-2 py-0.5 rounded-full capitalize w-fit"
                    style={STATUS_STYLE[lead.status] || STATUS_STYLE.new}
                  >
                    {lead.status}
                  </span>
                  <span className="text-[11px] text-[var(--fd-ink-4)]">
                    {timeAgo(lead.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center">
              <Target size={24} className="mx-auto mb-2 text-[var(--fd-ink-5)]" strokeWidth={1.3} />
              <p className="text-[13px] text-[var(--fd-ink-4)]">No leads yet</p>
            </div>
          )}
        </div>

        {/* Right sidebar — Active Services only (AM + QA moved to top) */}
        <div className="space-y-4">


        </div>
      </div>

      {/* ─── ROW 5: RECENT UPDATES ───────────────────────────────────────── */}
      <div className="fd-card rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--fd-border-subtle)]">
          <SectionHeader title="Recent Updates" icon={Rss} linkTo="/portal/updates" />
        </div>
        <div className="divide-y divide-[var(--fd-border-subtle)]">
          {!overview?.recentUpdates?.length ? (
            <div className="py-10 text-center">
              <Rss size={22} className="mx-auto mb-2 text-[var(--fd-ink-5)]" strokeWidth={1.3} />
              <p className="text-[13px] text-[var(--fd-ink-4)]">No updates yet</p>
            </div>
          ) : (
            overview.recentUpdates.map(u => (
              <div
                key={u._id}
                className="flex gap-3.5 px-5 py-4 transition-colors hover:bg-[var(--fd-table-row-hover)]"
              >
                <Avatar name={u.author?.name} size="sm" className="flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold text-[var(--fd-ink-1)]">{u.title}</div>
                  <p className="text-[12.5px] mt-0.5 line-clamp-2 leading-relaxed text-[var(--fd-ink-3)]">
                    {u.content}
                  </p>
                  <div className="text-[11px] mt-1.5 font-mono text-[var(--fd-ink-5)]">
                    {timeAgo(u.createdAt)}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ─── SERVICES MODAL ─────────────────────────────────────────────── */}
      {showServicesModal && (() => {
        const ALL_SERVICES = Object.keys(SERVICE_LABELS || {});
        const activeServices = client?.services || [];
        const upsellServices = ALL_SERVICES.filter(s => !activeServices.includes(s));
        const SERVICE_ICONS_MAP = {
          seo: Search, ppc: MousePointerClick, social_media: Instagram,
          content_marketing: PenTool, email_marketing: Mail, web_design: Globe,
          analytics: BarChart3, branding: Award, video_production: Video,
          influencer_marketing: Users,
        };
        return createPortal(
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
            onClick={() => setShowServicesModal(false)}
          >
            <div
              className="w-full max-w-md rounded-2xl overflow-hidden shadow-2xl"
              style={{ background: 'var(--fd-surface)', border: '1px solid var(--fd-border)', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 flex-shrink-0" style={{ borderBottom: '1px solid var(--fd-border)' }}>
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: C.greenSoft }}>
                    <Briefcase size={15} style={{ color: C.green }} strokeWidth={1.8} />
                  </div>
                  <div>
                    <div className="text-[14px] font-bold text-[var(--fd-ink-1)]">Your Services</div>
                    <div className="text-[11px] text-[var(--fd-ink-4)]">{activeServices.length} active · {upsellServices.length} available to add</div>
                  </div>
                </div>
                <button
                  onClick={() => setShowServicesModal(false)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-[var(--fd-surface-raised)]"
                  style={{ color: 'var(--fd-ink-4)' }}
                >
                  ✕
                </button>
              </div>

              <div className="overflow-y-auto flex-1">
                {/* Active */}
                {activeServices.length > 0 && (
                  <div className="p-4">
                    <p className="text-[10.5px] font-bold uppercase tracking-wider mb-3" style={{ color: C.green }}>
                      ✓ Active Services
                    </p>
                    <div className="space-y-2">
                      {activeServices.map(s => {
                        const Icon = SERVICE_ICONS_MAP[s] || Briefcase;
                        return (
                          <div key={s} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: C.greenSoft, border: `1px solid ${C.green}25` }}>
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,255,255,0.5)' }}>
                              <Icon size={14} style={{ color: C.green }} strokeWidth={1.8} />
                            </div>
                            <span className="text-[13px] font-semibold flex-1" style={{ color: C.green }}>
                              {(SERVICE_LABELS || {})[s] || s}
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: C.green, color: '#fff' }}>Active</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Available */}
                {upsellServices.length > 0 && (
                  <div className="px-4 pb-4">
                    <div className="pt-3 mb-3" style={{ borderTop: activeServices.length > 0 ? '1px solid var(--fd-border)' : 'none' }}>
                      <p className="text-[10.5px] font-bold uppercase tracking-wider" style={{ color: 'var(--fd-ink-4)' }}>
                        Available Services
                      </p>
                      <p className="text-[11px] mt-0.5 text-[var(--fd-ink-4)]">Contact us to add any of these to your plan</p>
                    </div>
                    <div className="space-y-2">
                      {upsellServices.map(s => {
                        const Icon = SERVICE_ICONS_MAP[s] || Briefcase;
                        return (
                          <div key={s} className="flex items-center gap-3 p-3 rounded-xl transition-colors hover:bg-[var(--fd-surface-raised)]" style={{ background: 'var(--fd-surface-sunken)', border: '1px solid var(--fd-border)' }}>
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-[var(--fd-surface)]">
                              <Icon size={14} className="text-[var(--fd-ink-4)]" strokeWidth={1.8} />
                            </div>
                            <span className="text-[13px] font-medium flex-1 text-[var(--fd-ink-2)]">
                              {(SERVICE_LABELS || {})[s] || s}
                            </span>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-[var(--fd-ink-4)]" style={{ background: 'var(--fd-border)' }}>Add +</span>
                          </div>
                        );
                      })}
                    </div>
                    <a
                      href="https://wa.me/919752523894?text=Hi%2C%20I%27m%20interested%20in%20adding%20more%20services%20to%20my%20plan"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 w-full mt-4 py-2.5 rounded-xl text-[12.5px] font-semibold transition-all hover:opacity-90"
                      style={{ background: C.amber, color: '#fff' }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" style={{marginRight:4}}><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg> Chat on WhatsApp
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>,
          document.body
        );
      })()}

    </div>
  );
}