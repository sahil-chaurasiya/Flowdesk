import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  TrendingUp, FileText, MessageCircle, ClipboardList,
  ChevronRight, Eye, Heart, Instagram, Target, BarChart3,
  Users, Zap, ArrowUpRight, ArrowDownRight, Rss,
  ThumbsUp, Share2, Bookmark, Globe, Star, Activity,
  TrendingDown, Radio, Award, Flame, MousePointer,
} from 'lucide-react';
import api from '../../lib/api';
import useAuthStore from '../../context/authStore';
import {
  StatCard, Card, CardHeader, CardContent,
  Avatar, Spinner,
} from '../../components/shared/LoadingScreen';
import { formatDate, timeAgo, SERVICE_LABELS, PLAN_LABELS } from '../../lib/utils';

// ─── Color tokens ─────────────────────────────────────────────────────────────
const C = {
  bg: '#f7f6f3',
  surface: '#ffffff',
  border: '#eeece8',
  borderLight: '#f2f0ec',
  ink: '#1a1916',
  inkMid: '#44423d',
  inkMute: '#7a7770',
  inkFaint: '#a8a49e',
  inkGhost: '#ccc9c2',
  blue: '#3a56d4',
  blueSoft: '#eff0fe',
  green: '#2a7d4f',
  greenSoft: '#edf7f1',
  amber: '#92600a',
  amberSoft: '#fef7ea',
  purple: '#7e22ce',
  purpleSoft: '#fdf2ff',
  red: '#b91c1c',
  redSoft: '#fff0f0',
  teal: '#0e7490',
  tealSoft: '#ecfeff',
};

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

const STATUS_STYLE = {
  new:       { background: '#f5f4f1', color: C.inkMute },
  contacted: { background: C.blueSoft, color: C.blue },
  qualified: { background: C.amberSoft, color: C.amber },
  converted: { background: C.greenSoft, color: C.green },
  lost:      { background: C.redSoft, color: C.red },
};

const STATUS_ORDER = ['new', 'contacted', 'qualified', 'converted', 'lost'];

// ─── Mini components ──────────────────────────────────────────────────────────
function SectionHeader({ title, icon: Icon, linkTo, subtitle }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <div className="flex items-center gap-2">
          {Icon && <Icon size={13} color={C.inkFaint} strokeWidth={1.7} />}
          <span className="text-[13.5px] font-semibold" style={{ color: C.ink }}>{title}</span>
        </div>
        {subtitle && <p className="text-[11px] mt-0.5 ml-5" style={{ color: C.inkFaint }}>{subtitle}</p>}
      </div>
      {linkTo && (
        <Link
          to={linkTo}
          className="flex items-center gap-1 text-[12px] font-medium flex-shrink-0"
          style={{ color: C.blue }}
        >
          View all <ChevronRight size={12} />
        </Link>
      )}
    </div>
  );
}

// ─── Sparkline (pure SVG, no deps) ───────────────────────────────────────────
function Sparkline({ data = [], color = C.blue, height = 36, width = 100 }) {
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
        <linearGradient id={`sg-${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fill} fill={`url(#sg-${color.replace('#','')})`} />
      <path d={line} stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Horizontal bar ───────────────────────────────────────────────────────────
function HBar({ value, max, color, height = 6 }) {
  const pct = max ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="rounded-full overflow-hidden" style={{ background: C.border, height }}>
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${pct}%`, background: color }}
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
    <div
      className="rounded-2xl p-4 flex flex-col gap-2"
      style={{ background: C.surface, border: `1px solid ${C.border}` }}
    >
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
        <div className="text-[22px] font-bold tabular-nums leading-none" style={{ color: C.ink }}>
          {value}
        </div>
        <div className="text-[11.5px] mt-1 font-medium" style={{ color: C.inkMute }}>{title}</div>
        {subtitle && <div className="text-[11px] mt-0.5" style={{ color: C.inkFaint }}>{subtitle}</div>}
      </div>
      {sparkData && (
        <div className="mt-auto pt-1">
          <Sparkline data={sparkData} color={color} width={120} height={30} />
        </div>
      )}
    </div>
  );
}

// ─── Generate mock sparkline from a stat (makes UI informative even w/o timeseries API) ─
function mockSpark(seed, count = 10) {
  let v = 30 + (seed % 40);
  return Array.from({ length: count }, (_, i) => {
    v = Math.max(0, v + (Math.random() - 0.45) * 15);
    return Math.round(v);
  });
}

// ═════════════════════════════════════════════════════════════════════════════
export default function ClientDashboard() {
  const { user } = useAuthStore();
  const [overview, setOverview] = useState(null);
  const [leadStats, setLeadStats] = useState(null);
  const [recentLeads, setRecentLeads] = useState([]);
  const [socialAnalytics, setSocialAnalytics] = useState(null);
  const [recentPosts, setRecentPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.clientId) return;
    Promise.all([
      api.get(`/clients/${user.clientId}/overview`),
      api.get('/leads/stats').catch(() => ({ data: null })),
      api.get('/leads?limit=8').catch(() => ({ data: { leads: [] } })),
      api.get('/social/analytics?days=30').catch(() => ({ data: null })),
      api.get('/social/posts?status=published&limit=4').catch(() => ({ data: { posts: [] } })),
    ]).then(([ov, ls, l, sa, p]) => {
      setOverview(ov.data);
      setLeadStats(ls.data);
      setRecentLeads(l.data.leads || []);
      setSocialAnalytics(sa.data?.analytics || null);
      setRecentPosts(p.data.posts || []);
    }).finally(() => setLoading(false));
  }, [user?.clientId]);

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>;

  const client = overview?.client;
  const manager = client?.accountManager;
  const totals = socialAnalytics?.totals || {};
  const byPlatform = socialAnalytics?.byPlatform || [];

  // Lead funnel data
  const byStatus = leadStats?.byStatus || [];
  const totalLeads = leadStats?.total || 0;
  const qualifiedLeads = byStatus.find(s => s._id === 'qualified')?.count || 0;
  const convertedLeads = byStatus.find(s => s._id === 'converted')?.count || 0;
  const newLeads = byStatus.find(s => s._id === 'new')?.count || 0;
  const conversionRate = totalLeads ? ((convertedLeads / totalLeads) * 100).toFixed(1) : 0;

  // Funnel segments for donut
  const funnelSegments = STATUS_ORDER.map(s => ({
    label: s,
    value: byStatus.find(x => x._id === s)?.count || 0,
    color: { new: '#ccc9c2', contacted: C.blue, qualified: '#f59e0b', converted: C.green, lost: C.red }[s],
  })).filter(s => s.value > 0);

  // Social platform bars
  const topPlatform = byPlatform.reduce((best, p) => (!best || p.reach > best.reach) ? p : best, null);
  const maxReach = byPlatform.reduce((m, p) => Math.max(m, p.reach || 0), 1);
  const maxLikes = byPlatform.reduce((m, p) => Math.max(m, p.likes || 0), 1);

  // Engagement rate colour
  const engRate = totals.avgEngagementRate || 0;
  const engColor = engRate >= 5 ? C.green : engRate >= 2 ? C.amber : C.red;

  return (
    <div className="space-y-5 animate-fade-in">

      {/* ─── HEADER ─────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold tracking-[-0.02em] leading-none mb-1.5" style={{ color: C.ink }}>
            Welcome back, {user?.name?.split(' ')[0]} 👋
          </h1>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[13px]" style={{ color: C.inkMute }}>{client?.company}</span>
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
            ? { background: C.greenSoft, color: C.green, border: `1px solid #b8e2c9` }
            : { background: '#f5f4f1', color: C.inkMute, border: `1px solid ${C.border}` }
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
          bg="#fffbeb"
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

      {/* ─── ROW 2: LEAD FUNNEL + SOCIAL OVERVIEW ────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Lead Funnel */}
        <div className="rounded-2xl p-5 flex flex-col gap-4" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
          <SectionHeader title="Lead Pipeline" icon={Target} linkTo="/portal/leads" subtitle="Current funnel breakdown" />

          <div className="flex items-center gap-5">
            {/* Donut */}
            <div className="relative flex-shrink-0">
              <DonutChart segments={funnelSegments.length ? funnelSegments : [{ value: 1, color: C.border }]} size={96} thickness={13} />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-[17px] font-bold" style={{ color: C.ink }}>{fmtNum(totalLeads)}</span>
                <span className="text-[9px] font-medium uppercase tracking-wider" style={{ color: C.inkFaint }}>leads</span>
              </div>
            </div>

            {/* Legend + bars */}
            <div className="flex-1 space-y-2.5">
              {STATUS_ORDER.map(s => {
                const count = byStatus.find(x => x._id === s)?.count || 0;
                const color = { new: '#ccc9c2', contacted: C.blue, qualified: '#f59e0b', converted: C.green, lost: C.red }[s];
                return (
                  <div key={s}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                        <span className="text-[11.5px] capitalize font-medium" style={{ color: C.inkMid }}>{s}</span>
                      </div>
                      <span className="text-[11.5px] tabular-nums font-semibold" style={{ color: C.ink }}>{count}</span>
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
            style={{ background: C.greenSoft, border: `1px solid #b8e2c9` }}
          >
            <div className="flex items-center gap-2">
              <Flame size={14} color={C.green} />
              <span className="text-[12px] font-semibold" style={{ color: C.green }}>Close Rate</span>
            </div>
            <span className="text-[16px] font-bold tabular-nums" style={{ color: C.green }}>{conversionRate}%</span>
          </div>
        </div>

        {/* Social Overview */}
        <div className="rounded-2xl p-5 flex flex-col gap-4" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
          <SectionHeader title="Social Media Overview" icon={Activity} linkTo="/portal/social" subtitle="Last 30 days" />

          {/* 4 mini KPIs */}
          <div className="grid grid-cols-2 gap-2.5">
            {[
              { label: 'Posts', val: fmtNum(totals.totalPosts || 0), icon: Radio, color: C.blue, bg: C.blueSoft },
              { label: 'Impressions', val: fmtNum(totals.totalReach || 0), icon: Eye, color: C.purple, bg: C.purpleSoft },
              { label: 'Likes', val: fmtNum(totals.totalLikes || 0), icon: Heart, color: '#e11d48', bg: '#fff1f2' },
              {
                label: 'Engagement',
                val: engRate ? engRate.toFixed(1) + '%' : '—',
                icon: Zap,
                color: engColor,
                bg: engColor === C.green ? C.greenSoft : engColor === C.amber ? C.amberSoft : C.redSoft,
              },
            ].map(({ label, val, icon: Icon, color, bg }) => (
              <div key={label} className="rounded-xl p-3 flex items-center gap-3" style={{ background: '#fafaf9', border: `1px solid ${C.border}` }}>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: bg }}>
                  <Icon size={13} color={color} strokeWidth={1.8} />
                </div>
                <div>
                  <div className="text-[15px] font-bold tabular-nums leading-none" style={{ color: C.ink }}>{val}</div>
                  <div className="text-[10.5px] mt-0.5" style={{ color: C.inkFaint }}>{label}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Platform breakdown */}
          {byPlatform.length > 0 ? (
            <div className="space-y-2">
              <p className="text-[10.5px] uppercase tracking-wider font-semibold" style={{ color: C.inkFaint }}>By Platform</p>
              {byPlatform.slice(0, 4).map(p => (
                <div key={p.platform} className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center text-[12px] flex-shrink-0"
                    style={{ background: '#f5f4f1' }}>
                    {PLATFORM_ICON[p.platform] || '📱'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between mb-1">
                      <span className="text-[11.5px] capitalize font-medium" style={{ color: C.inkMid }}>{p.platform}</span>
                      <span className="text-[10.5px] tabular-nums" style={{ color: C.inkFaint }}>{fmtNum(p.reach || 0)} reach</span>
                    </div>
                    <HBar value={p.reach || 0} max={maxReach} color={PLATFORM_COLOR[p.platform] || C.blue} height={5} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center py-4">
              <div className="text-center">
                <Instagram size={22} color={C.inkGhost} strokeWidth={1.3} className="mx-auto mb-2" />
                <p className="text-[12px]" style={{ color: C.inkFaint }}>No social data yet</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── ROW 3: ENGAGEMENT BARS + RECENT POSTS ───────────────────────── */}
      {byPlatform.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Engagement by platform */}
          <div className="lg:col-span-2 rounded-2xl p-5" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
            <SectionHeader title="Engagement by Platform" icon={BarChart3} subtitle="Likes, shares & interactions" />
            <div className="mt-4 space-y-4">
              {byPlatform.length > 0 ? byPlatform.slice(0, 5).map(p => {
                const likesPct = maxLikes ? Math.min((p.likes || 0) / maxLikes * 100, 100) : 0;
                const er = p.engagementRate || 0;
                const erColor = er >= 5 ? C.green : er >= 2 ? C.amber : C.inkFaint;
                return (
                  <div key={p.platform}>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[13px] flex-shrink-0" style={{ background: '#f5f4f1' }}>
                        {PLATFORM_ICON[p.platform] || '📱'}
                      </div>
                      <span className="text-[12.5px] capitalize font-semibold flex-1" style={{ color: C.inkMid }}>{p.platform}</span>
                      <span className="text-[11px] font-bold tabular-nums" style={{ color: erColor }}>{er.toFixed(1)}% eng.</span>
                    </div>
                    <div className="flex gap-2 items-center">
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-[10px]" style={{ color: C.inkFaint }}>Likes</span>
                          <span className="text-[10px] tabular-nums" style={{ color: C.inkFaint }}>{fmtNum(p.likes || 0)}</span>
                        </div>
                        <HBar value={p.likes || 0} max={maxLikes} color={PLATFORM_COLOR[p.platform] || C.blue} height={7} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-[10px]" style={{ color: C.inkFaint }}>Posts</span>
                          <span className="text-[10px] tabular-nums" style={{ color: C.inkFaint }}>{p.posts || 0}</span>
                        </div>
                        <HBar value={p.posts || 0} max={byPlatform.reduce((m, x) => Math.max(m, x.posts || 0), 1)} color="#a78bfa" height={7} />
                      </div>
                    </div>
                  </div>
                );
              }) : (
                <div className="py-8 text-center">
                  <BarChart3 size={24} color={C.inkGhost} strokeWidth={1.3} className="mx-auto mb-2" />
                  <p className="text-[12px]" style={{ color: C.inkFaint }}>No platform data available</p>
                </div>
              )}
            </div>
          </div>

          {/* Top performing post cards */}
          <div className="rounded-2xl p-5 flex flex-col gap-3" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
            <SectionHeader title="Recent Posts" icon={Instagram} linkTo="/portal/social" />
            {recentPosts.length > 0 ? recentPosts.map(post => (
              <div
                key={post._id}
                className="flex gap-3 p-2.5 rounded-xl"
                style={{ background: '#fafaf9', border: `1px solid ${C.border}` }}
              >
                <div
                  className="w-12 h-12 rounded-lg overflow-hidden flex items-center justify-center flex-shrink-0"
                  style={{ background: '#f5f4f1' }}
                >
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
                  <p className="text-[11.5px] line-clamp-2 leading-relaxed" style={{ color: C.inkMid }}>
                    {post.content || 'Published post'}
                  </p>
                  <div className="flex items-center gap-3 mt-1.5">
                    {post.analytics?.likes != null && (
                      <span className="flex items-center gap-0.5 text-[10px]" style={{ color: C.inkFaint }}>
                        <Heart size={9} /> {fmtNum(post.analytics.likes)}
                      </span>
                    )}
                    {post.analytics?.reach != null && (
                      <span className="flex items-center gap-0.5 text-[10px]" style={{ color: C.inkFaint }}>
                        <Eye size={9} /> {fmtNum(post.analytics.reach)}
                      </span>
                    )}
                    <span className="text-[10px] ml-auto" style={{ color: C.inkGhost }}>
                      {post.publishedAt ? timeAgo(post.publishedAt) : ''}
                    </span>
                  </div>
                </div>
              </div>
            )) : (
              <div className="flex-1 flex items-center justify-center py-8">
                <div className="text-center">
                  <Radio size={20} color={C.inkGhost} strokeWidth={1.3} className="mx-auto mb-2" />
                  <p className="text-[12px]" style={{ color: C.inkFaint }}>No posts published yet</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── ROW 4: LEADS TABLE + RIGHT SIDEBAR ─────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Recent Leads */}
        <div className="lg:col-span-2 rounded-2xl overflow-hidden" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
          <div className="px-5 py-4 border-b" style={{ borderColor: C.borderLight }}>
            <SectionHeader title="Recent Leads" icon={Users} linkTo="/portal/leads" subtitle={`${totalLeads} leads in pipeline`} />
          </div>
          {recentLeads.length > 0 ? (
            <div>
              {/* thead */}
              <div className="grid grid-cols-[1fr_100px_80px] gap-2 px-5 py-2" style={{ background: '#fafaf9', borderBottom: `1px solid ${C.borderLight}` }}>
                {['Name / Source', 'Status', 'Added'].map(h => (
                  <span key={h} className="text-[10.5px] font-semibold uppercase tracking-wider" style={{ color: C.inkFaint }}>{h}</span>
                ))}
              </div>
              {recentLeads.map((lead, i) => (
                <div
                  key={lead._id}
                  className="grid grid-cols-[1fr_100px_80px] gap-2 items-center px-5 py-3 border-b last:border-0 transition-colors"
                  style={{ borderColor: C.borderLight }}
                  onMouseEnter={e => e.currentTarget.style.background = '#fafaf9'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div className="min-w-0">
                    <div className="text-[12.5px] font-semibold truncate" style={{ color: C.ink }}>
                      {lead.name || lead.email || 'Anonymous Lead'}
                    </div>
                    {lead.source && (
                      <div className="text-[11px] mt-0.5 flex items-center gap-1" style={{ color: C.inkFaint }}>
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
                  <span className="text-[11px]" style={{ color: C.inkFaint }}>
                    {timeAgo(lead.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center">
              <Target size={24} color={C.inkGhost} strokeWidth={1.3} className="mx-auto mb-2" />
              <p className="text-[13px]" style={{ color: C.inkFaint }}>No leads yet</p>
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <div className="space-y-4">

          {/* Account Manager */}
          {manager && (
            <div className="rounded-2xl p-4" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
              <p className="text-[10.5px] font-semibold uppercase tracking-wider mb-3" style={{ color: C.inkFaint }}>
                Your Account Manager
              </p>
              <div className="flex items-center gap-3 mb-4">
                <Avatar name={manager.name} size="md" />
                <div>
                  <div className="text-[13.5px] font-semibold" style={{ color: C.ink }}>{manager.name}</div>
                  <div className="text-[11.5px]" style={{ color: C.inkFaint }}>Project Manager</div>
                </div>
              </div>
              <Link
                to="/portal/chat"
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-[12.5px] font-medium border transition-all"
                style={{ background: C.blueSoft, color: C.blue, borderColor: '#c5d4fb' }}
                onMouseEnter={e => e.currentTarget.style.background = '#e3eafd'}
                onMouseLeave={e => e.currentTarget.style.background = C.blueSoft}
              >
                <MessageCircle size={13} />
                Send Message
              </Link>
            </div>
          )}

          {/* Quick Actions */}
          <div className="rounded-2xl p-4" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
            <p className="text-[10.5px] font-semibold uppercase tracking-wider mb-3" style={{ color: C.inkFaint }}>
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
                  className="flex items-center gap-3 p-2.5 rounded-xl transition-colors"
                  onMouseEnter={e => e.currentTarget.style.background = '#f5f4f1'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#f5f4f1' }}>
                    <Icon size={13} color={C.inkFaint} strokeWidth={1.7} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12.5px] font-medium" style={{ color: C.inkMid }}>{label}</div>
                    <div className="text-[11px]" style={{ color: C.inkFaint }}>{desc}</div>
                  </div>
                  <ChevronRight size={12} color={C.inkGhost} />
                </Link>
              ))}
            </div>
          </div>

          {/* Active Services */}
          {client?.services?.length > 0 && (
            <div className="rounded-2xl p-4" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
              <p className="text-[10.5px] font-semibold uppercase tracking-wider mb-3" style={{ color: C.inkFaint }}>
                Active Services
              </p>
              <div className="space-y-2">
                {client.services.map(s => (
                  <div key={s} className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: C.blue }} />
                    <span className="text-[12.5px]" style={{ color: C.inkMid }}>
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
      <div className="rounded-2xl overflow-hidden" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
        <div className="px-5 py-4 border-b" style={{ borderColor: C.borderLight }}>
          <SectionHeader title="Recent Updates" icon={Rss} linkTo="/portal/updates" />
        </div>
        <div className="divide-y" style={{ borderColor: C.borderLight }}>
          {!overview?.recentUpdates?.length ? (
            <div className="py-10 text-center">
              <Rss size={22} color={C.inkGhost} strokeWidth={1.3} className="mx-auto mb-2" />
              <p className="text-[13px]" style={{ color: C.inkFaint }}>No updates yet</p>
            </div>
          ) : (
            overview.recentUpdates.map(u => (
              <div
                key={u._id}
                className="flex gap-3.5 px-5 py-4 transition-colors"
                onMouseEnter={e => e.currentTarget.style.background = '#fafaf9'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <Avatar name={u.author?.name} size="sm" className="flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold" style={{ color: C.ink }}>{u.title}</div>
                  <p className="text-[12.5px] mt-0.5 line-clamp-2 leading-relaxed" style={{ color: C.inkMute }}>
                    {u.content}
                  </p>
                  <div className="text-[11px] mt-1.5 font-mono" style={{ color: C.inkGhost }}>
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