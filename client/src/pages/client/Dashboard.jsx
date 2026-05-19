import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  TrendingUp, FileText, MessageCircle, ClipboardList,
  ChevronRight, Eye, Heart, Instagram, Target, BarChart3,
  Users, Zap, ArrowUpRight, ArrowDownRight, Rss,
  ThumbsUp, Share2, Bookmark, Globe, Star, Activity,
  TrendingDown, Radio, Award, Flame, MousePointer,
  Bell, CalendarClock, Phone,
} from 'lucide-react';
import api from '../../lib/api';
import useAuthStore from '../../context/authStore';
import {
  StatCard, Card, CardHeader, CardContent,
  Avatar, Spinner,
} from '../../components/shared/LoadingScreen';
import { formatDate, timeAgo, SERVICE_LABELS, PLAN_LABELS } from '../../lib/utils';

// ─── Color tokens — now use CSS variables so dark mode works ──────────────────
// These are used for inline SVG/canvas elements that can't use CSS classes directly.
// For everything else we use var(--fd-*) directly.
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
function BigStatCard({ title, value, icon: Icon, color, bg, delta, subtitle, sparkData }) {
  return (
    <div className="fd-card rounded-2xl p-4 flex flex-col gap-2">
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
            style={{ background: C.amber, color: '#fff' }}
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

// ═════════════════════════════════════════════════════════════════════════════
export default function ClientDashboard() {
  const { user } = useAuthStore();
  const [overview, setOverview] = useState(null);
  const [leadStats, setLeadStats] = useState(null);
  const [recentLeads, setRecentLeads] = useState([]);
  const [followUpLeads, setFollowUpLeads] = useState([]);
  const [socialAnalytics, setSocialAnalytics] = useState(null);
  const [recentPosts, setRecentPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.clientId) return;
    Promise.all([
      api.get(`/clients/${user.clientId}/overview`),
      api.get('/leads/stats').catch(() => ({ data: null })),
      api.get('/leads?limit=8').catch(() => ({ data: { leads: [] } })),
      api.get('/leads/follow-ups-today').catch(() => ({ data: { leads: [] } })),
      api.get('/social/analytics?days=30').catch(() => ({ data: null })),
      api.get('/social/posts?status=published&limit=4').catch(() => ({ data: { posts: [] } })),
    ]).then(([ov, ls, l, fu, sa, p]) => {
      setOverview(ov.data);
      setLeadStats(ls.data);
      setRecentLeads(l.data.leads || []);
      setFollowUpLeads(fu.data?.leads || []);
      setSocialAnalytics(sa.data?.analytics || null);
      setRecentPosts(p.data.posts || []);
    }).finally(() => setLoading(false));
  }, [user?.clientId]);

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

  return (
    <div className="space-y-5 animate-fade-in">

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
        <div
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11.5px] font-semibold capitalize flex-shrink-0"
          style={client?.status === 'active'
            ? { background: C.greenSoft, color: C.green, border: `1px solid ${C.green}40` }
            : { background: 'var(--fd-surface-sunken)', color: 'var(--fd-ink-3)', border: '1px solid var(--fd-border)' }
          }
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: client?.status === 'active' ? C.green : C.inkFaint }} />
          {client?.status || 'active'}
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
        />
      </div>

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
          <SectionHeader title="Social Media Overview" icon={Activity} linkTo="/portal/social" subtitle="Last 30 days" />

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

        {/* Right sidebar */}
        <div className="space-y-4">

          {/* Account Manager */}
          {manager && (
            <div className="fd-card rounded-2xl p-4">
              <p className="text-[10.5px] font-semibold uppercase tracking-wider mb-3 text-[var(--fd-ink-4)]">
                Your Account Manager
              </p>
              <div className="flex items-center gap-3 mb-4">
                <Avatar name={manager.name} size="md" />
                <div>
                  <div className="text-[13.5px] font-semibold text-[var(--fd-ink-1)]">{manager.name}</div>
                  <div className="text-[11.5px] text-[var(--fd-ink-4)]">Project Manager</div>
                </div>
              </div>
              <Link
                to="/portal/chat"
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-[12.5px] font-medium border transition-all hover:opacity-80"
                style={{ background: C.blueSoft, color: C.blue, borderColor: `${C.blue}40` }}
              >
                <MessageCircle size={13} />
                Send Message
              </Link>
            </div>
          )}

          {/* Quick Actions */}
          <div className="fd-card rounded-2xl p-4">
            <p className="text-[10.5px] font-semibold uppercase tracking-wider mb-3 text-[var(--fd-ink-4)]">
              Quick Actions
            </p>
            <div className="space-y-1">
              {[
                { to: '/portal/requests', icon: ClipboardList, label: 'Submit a Request', desc: 'New task or revision' },
                { to: '/portal/chat',     icon: MessageCircle, label: 'Open Chat',         desc: 'Message your team' },
                { to: '/portal/files',    icon: FileText,      label: 'View Files',         desc: 'Deliverables & assets' },
                { to: '/portal/reports',  icon: BarChart3,     label: 'Reports',             desc: 'Performance data' },
              ].map(({ to, icon: Icon, label, desc }) => (
                <Link
                  key={to}
                  to={to}
                  className="flex items-center gap-3 p-2.5 rounded-xl transition-colors hover:bg-[var(--fd-surface-raised)]"
                >
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 bg-[var(--fd-surface-sunken)]">
                    <Icon size={13} className="text-[var(--fd-ink-4)]" strokeWidth={1.7} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12.5px] font-medium text-[var(--fd-ink-2)]">{label}</div>
                    <div className="text-[11px] text-[var(--fd-ink-4)]">{desc}</div>
                  </div>
                  <ChevronRight size={12} className="text-[var(--fd-ink-5)]" />
                </Link>
              ))}
            </div>
          </div>

          {/* Active Services */}
          {client?.services?.length > 0 && (
            <div className="fd-card rounded-2xl p-4">
              <p className="text-[10.5px] font-semibold uppercase tracking-wider mb-3 text-[var(--fd-ink-4)]">
                Active Services
              </p>
              <div className="space-y-2">
                {client.services.map(s => (
                  <div key={s} className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: C.blue }} />
                    <span className="text-[12.5px] text-[var(--fd-ink-2)]">
                      {(SERVICE_LABELS || {})[s] || s}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
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

    </div>
  );
}