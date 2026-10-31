import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Terminal, GitBranch, Rocket, Code2, ListChecks, FolderKanban,
  AlertTriangle, CheckCircle2, Circle, CircleDot, Diamond, X,
  Flame, Boxes, Pin, Sparkles, ChevronRight, ArrowUpRight, Plus,
  Minus, Square, Github, LayoutDashboard, Globe, Copy, Check,
  Wifi, WifiOff, RefreshCw,
} from 'lucide-react';
import {
  eachDayOfInterval, startOfDay, endOfDay, subDays, format as fmtDate,
  differenceInCalendarDays, isBefore,
} from 'date-fns';
import api from '../../lib/api';
import useAuthStore from '../../context/authStore';
import { Spinner, EmptyState } from '../../components/shared/LoadingScreen';
import { timeAgo, formatDate } from '../../lib/utils';

// ── Design tokens ────────────────────────────────────────────────────────────
// A GitHub/IDE-inspired palette — the actual visual language developers live
// in daily (dark terminal chrome, contribution graph, log-level severities).
// Used deliberately in dark "console" zones only; task/project data stays on
// the app's normal light surfaces for readability & consistency.
const DEV = {
  bg:      '#0d1117',
  panel:   '#161b22',
  panel2:  '#1c2128',
  border:  '#30363d',
  text:    '#e6edf3',
  dim:     '#8b949e',
  blue:    '#58a6ff',
  green:   '#3fb950',
  purple:  '#bc8cff',
  orange:  '#d29922',
  red:     '#f85149',
  pink:    '#db61a2',
};

const HEAT_LEVELS = ['#161b22', '#0e4429', '#006d32', '#26a641', '#39d353'];

const MONO = "'JetBrains Mono', 'Fira Code', 'Ubuntu Mono', 'DejaVu Sans Mono', ui-monospace, Consolas, monospace";

const TASK_GLYPH = {
  today:       { icon: Circle,    color: DEV.orange, label: 'To Do' },
  pending:     { icon: Circle,    color: DEV.dim,    label: 'To Do' },
  in_progress: { icon: CircleDot, color: DEV.blue,   label: 'In Progress' },
  review:      { icon: Diamond,   color: DEV.purple, label: 'Review' },
  completed:   { icon: CheckCircle2, color: DEV.green, label: 'Done' },
  cancelled:   { icon: X,         color: DEV.red,    label: 'Cancelled' },
};

// Priority recast as log severity — this is genuinely how developers triage,
// not decoration for its own sake.
const LOG_LEVEL = {
  urgent: { tag: 'ERROR', color: DEV.red },
  high:   { tag: 'WARN',  color: DEV.orange },
  medium: { tag: 'INFO',  color: DEV.blue },
  low:    { tag: 'DEBUG', color: DEV.dim },
};

const PROJECT_STATUS_META = {
  planning:    { label: 'Planning',    color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' },
  in_progress: { label: 'In Progress', color: '#4f6ef0', bg: 'rgba(79,110,240,0.12)' },
  on_hold:     { label: 'On Hold',     color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  review:      { label: 'In Review',   color: '#a855f7', bg: 'rgba(168,85,247,0.12)' },
  completed:   { label: 'Completed',   color: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
  cancelled:   { label: 'Cancelled',   color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
};

const CATEGORY_META = {
  office_project: { label: 'Internal', color: DEV.blue },
  client_project: { label: 'Client',   color: DEV.orange },
};

// Real uptime status for a project's liveUrl, from server/services/uptimeMonitor.js
// (pinged on a 5-minute sweep — see index.js — plus on-demand via the recheck
// button on the stack.env panel below).
const UPTIME_META = {
  up:      { label: 'UP',      color: DEV.green, icon: Wifi },
  down:    { label: 'DOWN',    color: DEV.red,   icon: WifiOff },
  unknown: { label: 'PENDING', color: DEV.dim,    icon: Wifi },
};

const MOTD = [
  'Ship it, then fix it. In that order (mostly).',
  "It's not a bug, it's an undocumented feature.",
  'Deploy on Friday? Bold. Check the queue first.',
  'One does not simply refactor without tests.',
  'Coffee.exe has stopped responding. Retrying...',
];

function shortHash(id = '') {
  return id.slice(-7);
}

function getGreetingWord() {
  const h = new Date().getHours();
  if (h < 5) return 'good_night';
  if (h < 12) return 'good_morning';
  if (h < 17) return 'good_afternoon';
  if (h < 21) return 'good_evening';
  return 'good_night';
}

// ── Signature element: contribution-style activity heatmap ────────────────────
const HEATMAP_WEEKS = 14;

// Pulled out of the component so both ActivityHeatmap (for the grid) and the
// dashboard root (for the currentStreak VarStat tile) can compute it off the
// same logic without duplicating the day-bucketing math.
function computeActivityStats(tasks, weeks = HEATMAP_WEEKS) {
  const totalDays = weeks * 7;
  const today = new Date();
  const start = subDays(today, totalDays - 1);
  const days = eachDayOfInterval({ start, end: today });

  const counts = days.map(day => {
    const ds = startOfDay(day), de = endOfDay(day);
    const c = tasks.filter(t => t.completedAt && new Date(t.completedAt) >= ds && new Date(t.completedAt) <= de).length;
    return { date: day, count: c };
  });

  // Pad the front so columns align Mon → Sun like a real contribution graph
  const firstDow = (days[0].getDay() + 6) % 7; // 0 = Monday
  const padded = [...Array(firstDow).fill(null), ...counts];
  while (padded.length % 7 !== 0) padded.push(null);

  const cols = [];
  for (let i = 0; i < padded.length; i += 7) cols.push(padded.slice(i, i + 7));

  const max = Math.max(...counts.map(c => c.count), 1);
  const total = counts.reduce((s, c) => s + c.count, 0);

  // Current streak: consecutive days (from today backwards) with activity
  let streak = 0;
  for (let i = counts.length - 1; i >= 0; i--) {
    if (counts[i].count > 0) streak++;
    else if (i === counts.length - 1) continue; // today might just not be done yet
    else break;
  }

  return { columns: cols, max, total, streak };
}

function ActivityHeatmap({ tasks }) {
  const { columns, max, total, streak } = useMemo(() => computeActivityStats(tasks), [tasks]);

  const level = (count) => {
    if (!count) return 0;
    const ratio = count / max;
    if (ratio > 0.75) return 4;
    if (ratio > 0.5)  return 3;
    if (ratio > 0.25) return 2;
    return 1;
  };

  return (
    <div>
      <div className="flex items-center gap-2" style={{ overflowX: 'auto' }}>
        {columns.map((col, ci) => (
          <div key={ci} className="flex flex-col gap-[3px]">
            {col.map((d, ri) => (
              <div
                key={ri}
                title={d ? `${fmtDate(d.date, 'MMM d, yyyy')} — ${d.count} shipped` : ''}
                className="w-[11px] h-[11px] rounded-[2px]"
                style={{ background: d ? HEAT_LEVELS[level(d.count)] : 'transparent' }}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between mt-3">
        <div className="flex items-center gap-1.5" style={{ fontFamily: MONO, fontSize: 10.5, color: DEV.dim }}>
          <span>less</span>
          {HEAT_LEVELS.map((c, i) => <div key={i} className="w-[10px] h-[10px] rounded-[2px]" style={{ background: c }} />)}
          <span>more</span>
        </div>
        <div className="flex items-center gap-3" style={{ fontFamily: MONO, fontSize: 11 }}>
          <span style={{ color: DEV.green }}>{total} shipped / 14wk</span>
          {streak > 1 && (
            <span className="flex items-center gap-1" style={{ color: DEV.orange }}>
              <Flame size={12} /> {streak}d streak
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Small building blocks ───────────────────────────────────────────────────

function CommentHeading({ text, count, linkTo, linkLabel = 'view all' }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div style={{ fontFamily: MONO, fontSize: 12.5 }} className="font-medium">
        <span style={{ color: 'var(--fd-ink-5)' }}>// </span>
        <span style={{ color: 'var(--fd-ink-2)' }}>{text}</span>
        {count !== undefined && <span style={{ color: 'var(--fd-ink-5)' }}> ({count})</span>}
      </div>
      {linkTo && (
        <Link
          to={linkTo}
          style={{ fontFamily: MONO, color: 'var(--fd-sidebar-link-active)' }}
          className="flex items-center gap-1 text-[11px] font-medium transition-opacity hover:opacity-70"
        >
          {linkLabel} <ArrowUpRight size={10} />
        </Link>
      )}
    </div>
  );
}

function Panel({ children, className = '' }) {
  return (
    <div
      className={`rounded-2xl p-5 ${className}`}
      style={{ background: 'var(--fd-card-bg)', border: '1px solid var(--fd-border)', boxShadow: '0 1px 8px rgba(0,0,0,0.04)' }}
    >
      {children}
    </div>
  );
}

function VarStat({ name, value, color, sub, linkTo }) {
  const inner = (
    <div
      className="rounded-xl px-4 py-3.5 transition-all duration-150 hover:-translate-y-0.5 h-full"
      style={{ background: DEV.panel, border: `1px solid ${DEV.border}` }}
    >
      <div style={{ fontFamily: MONO, fontSize: 12.5 }}>
        <span style={{ color: DEV.purple }}>const</span>{' '}
        <span style={{ color: DEV.text }}>{name}</span>{' '}
        <span style={{ color: DEV.dim }}>=</span>{' '}
        <span style={{ color, fontWeight: 800, fontSize: 15 }}>{value}</span>
      </div>
      {sub && <div style={{ fontFamily: MONO, fontSize: 10.5, color: DEV.dim }} className="mt-1.5">// {sub}</div>}
    </div>
  );
  return linkTo ? <Link to={linkTo} className="block h-full">{inner}</Link> : inner;
}

// One `KEY=value` row in the stack.env panel, with copy-to-clipboard on hover.
// `status` + `onRecheck` are optional — only passed in for PROD_URL rows,
// which are the ones actually monitored by server/services/uptimeMonitor.js.
function EnvLine({ envKey, url, icon: Icon, status, onRecheck, rechecking }) {
  const [copied, setCopied] = useState(false);

  const copy = async (e) => {
    e.preventDefault();
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard blocked — no-op */ }
  };

  const meta = status ? (UPTIME_META[status.status] || UPTIME_META.unknown) : null;
  const StatusIcon = meta?.icon;

  return (
    <div
      className="flex items-center gap-2 px-3 py-2 rounded-lg group"
      style={{ fontFamily: MONO, fontSize: 11.5, background: DEV.panel2, border: `1px solid ${DEV.border}` }}
    >
      <Icon size={12} style={{ color: DEV.dim, flexShrink: 0 }} />
      <span style={{ color: DEV.purple, flexShrink: 0 }}>{envKey}</span>
      <span style={{ color: DEV.dim, flexShrink: 0 }}>=</span>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="truncate hover:underline"
        style={{ color: DEV.blue }}
        title={url}
      >
        {url}
      </a>

      {meta && (
        <span
          className="ml-auto flex-shrink-0 flex items-center gap-1 px-1.5 py-[1px] rounded"
          style={{ background: `${meta.color}18`, color: meta.color, fontWeight: 700, fontSize: 10 }}
          title={
            status.lastCheckedAt
              ? `Checked ${timeAgo(status.lastCheckedAt)}${status.responseTimeMs != null ? ` · ${status.responseTimeMs}ms` : ''}${status.error ? ` · ${status.error}` : ''}`
              : 'Not checked yet'
          }
        >
          <StatusIcon size={10} /> {meta.label}
        </span>
      )}

      {onRecheck && (
        <button
          onClick={(e) => { e.preventDefault(); onRecheck(); }}
          className={`flex-shrink-0 p-1 rounded transition-opacity ${meta ? '' : 'opacity-0 group-hover:opacity-100'}`}
          style={{ color: DEV.dim }}
          title="Check now"
          disabled={rechecking}
        >
          <RefreshCw size={11} className={rechecking ? 'animate-spin' : ''} />
        </button>
      )}

      <button
        onClick={copy}
        className={`flex-shrink-0 p-1 rounded transition-opacity ${meta || onRecheck ? '' : 'ml-auto opacity-0 group-hover:opacity-100'}`}
        style={{ color: copied ? DEV.green : DEV.dim }}
        title="Copy"
      >
        {copied ? <Check size={12} /> : <Copy size={12} />}
      </button>
    </div>
  );
}

function TaskLine({ task, onStatusChange, updating }) {
  const glyph = TASK_GLYPH[task.status] || TASK_GLYPH.pending;
  const Icon = glyph.icon;
  const level = LOG_LEVEL[task.priority] || LOG_LEVEL.medium;
  const isOverdue = task.deadline && new Date(task.deadline) < new Date() && !['completed', 'cancelled'].includes(task.status);

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 border-b last:border-0 transition-colors hover:bg-[var(--fd-table-row-hover)]" style={{ borderColor: 'var(--fd-table-row-border)' }}>
      <Icon size={13} style={{ color: glyph.color, flexShrink: 0 }} />
      <span
        className="text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0"
        style={{ fontFamily: MONO, background: `${level.color}18`, color: level.color }}
      >
        {level.tag}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[12.5px] font-medium truncate" style={{ color: 'var(--fd-ink-1)' }}>{task.title}</span>
          {task.isWebsiteWork && (
            <span className="text-[9px] font-bold px-1 py-[1px] rounded flex-shrink-0" style={{ fontFamily: MONO, background: 'rgba(79,110,240,0.1)', color: '#4f6ef0' }}>
              web
            </span>
          )}
        </div>
        {(task.websiteProject?.name || task.client?.company || task.deadline) && (
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap" style={{ fontFamily: MONO, fontSize: 10.5, color: isOverdue ? DEV.red : 'var(--fd-ink-5)' }}>
            {task.websiteProject?.name && <span>{task.websiteProject.name}</span>}
            {task.client?.company && <span>{task.client.company}</span>}
            {task.deadline && <span>{isOverdue ? '⚠ overdue' : 'due'} {formatDate(task.deadline, 'MMM d')}</span>}
          </div>
        )}
      </div>

      {onStatusChange ? (
        <select
          className="text-[10px] font-bold px-2 py-1 rounded-md border-0 outline-none cursor-pointer flex-shrink-0"
          style={{ fontFamily: MONO, background: `${glyph.color}18`, color: glyph.color }}
          value={task.status}
          onChange={e => onStatusChange(task._id, e.target.value)}
          disabled={updating === task._id}
        >
          <option value="pending">todo</option>
          <option value="in_progress">in_progress</option>
          <option value="review">review</option>
        </select>
      ) : (
        <span className="text-[10px] font-bold flex-shrink-0" style={{ fontFamily: MONO, color: glyph.color }}>{glyph.label.toLowerCase().replace(' ', '_')}</span>
      )}
    </div>
  );
}

function LogLine({ level, timestamp, children }) {
  const meta = LOG_LEVEL[level] || LOG_LEVEL.medium;
  return (
    <div className="flex items-start gap-2.5 px-4 py-2 border-b last:border-0" style={{ borderColor: 'var(--fd-table-row-border)', fontFamily: MONO, fontSize: 11.5 }}>
      <span className="font-bold flex-shrink-0" style={{ color: meta.color }}>[{meta.tag}]</span>
      <span className="flex-shrink-0" style={{ color: 'var(--fd-ink-5)' }}>{timestamp}</span>
      <span className="min-w-0 truncate" style={{ color: 'var(--fd-ink-2)' }}>{children}</span>
    </div>
  );
}

// ── Root ─────────────────────────────────────────────────────────────────────
export default function DeveloperDashboard() {
  const { user } = useAuthStore();
  const motd = useMemo(() => MOTD[Math.floor(Math.random() * MOTD.length)], []);
  const greetKey = useMemo(() => getGreetingWord(), []);

  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [websiteTasks, setWebsiteTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(null);
  const [filter, setFilter] = useState('active');
  const [checkingUptimeId, setCheckingUptimeId] = useState(null);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      api.get('/tasks').catch(() => ({ data: { tasks: [] } })),
      api.get('/website-work/projects').catch(() => ({ data: { projects: [] } })),
      api.get('/website-work/tasks').catch(() => ({ data: { tasks: [] } })),
    ]).then(([taskRes, projectRes, websiteTaskRes]) => {
      if (!mounted) return;
      setTasks(taskRes.data.tasks || []);
      setProjects(projectRes.data.projects || []);
      setWebsiteTasks(websiteTaskRes.data.tasks || []);
    }).finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, []);

  const kpis = useMemo(() => {
    const todo       = tasks.filter(t => ['pending', 'today'].includes(t.status)).length;
    const inProgress = tasks.filter(t => t.status === 'in_progress').length;
    const review     = tasks.filter(t => t.status === 'review').length;
    const done        = tasks.filter(t => t.status === 'completed').length;
    const overdue    = tasks.filter(t => t.deadline && new Date(t.deadline) < new Date() && !['completed', 'cancelled'].includes(t.status)).length;
    const activeProjects = projects.filter(p => !['completed', 'cancelled'].includes(p.status)).length;
    return { todo, inProgress, review, done, overdue, activeProjects };
  }, [tasks, projects]);

  // Same math the heatmap uses — kept separate so the streak can live in the
  // VarStat row above the heatmap instead of only inside it.
  const { streak } = useMemo(() => computeActivityStats(tasks), [tasks]);

  // Projects that have at least one quick-reference link filled in (set from
  // the Website Work project form). Feeds the stack.env panel below.
  const projectsWithLinks = useMemo(
    () => projects.filter(p => p.repoUrl || p.adminUrl || p.liveUrl),
    [projects]
  );

  // Real uptime, populated server-side by services/uptimeMonitor.js (ping
  // sweep every 5 min — see index.js) — not the fake load-average joke below.
  const uptimeSummary = useMemo(() => {
    const monitored = projects.filter(p => p.liveUrl);
    const up = monitored.filter(p => p.uptime?.status === 'up').length;
    const down = monitored.filter(p => p.uptime?.status === 'down').length;
    const unknown = monitored.length - up - down;
    const mostRecentCheck = monitored
      .map(p => p.uptime?.lastCheckedAt)
      .filter(Boolean)
      .sort((a, b) => new Date(b) - new Date(a))[0] || null;
    const downProjects = monitored.filter(p => p.uptime?.status === 'down');
    return { monitored: monitored.length, up, down, unknown, mostRecentCheck, downProjects };
  }, [projects]);

  const recheckUptime = async (projectId) => {
    setCheckingUptimeId(projectId);
    try {
      const res = await api.patch(`/website-work/projects/${projectId}/check-uptime`);
      const uptime = res.data.uptime;
      setProjects(prev => prev.map(p => p._id === projectId ? { ...p, uptime } : p));
    } catch { /* silent — next scheduled sweep will pick it up anyway */ }
    finally { setCheckingUptimeId(null); }
  };

  // Fake-but-grounded `uptime` readout: real days/hours/minutes since the
  // account was created, with a "load average" derived from today's actual
  // workload instead of made-up numbers.
  const uptimeInfo = useMemo(() => {
    const created = user?.createdAt ? new Date(user.createdAt) : null;
    if (!created || isNaN(created)) return null;
    const ms = Date.now() - created.getTime();
    const days = Math.floor(ms / 86400000);
    const hours = Math.floor((ms % 86400000) / 3600000);
    const mins = Math.floor((ms % 3600000) / 60000);
    const load1 = ((kpis?.inProgress || 0) + (kpis?.review || 0) * 0.5).toFixed(2);
    const load5 = ((kpis?.todo || 0) * 0.4 + (kpis?.inProgress || 0) * 0.3).toFixed(2);
    const load15 = ((kpis?.done || 0) * 0.05).toFixed(2);
    return { days, hours, mins, load: `${load1}, ${load5}, ${load15}` };
  }, [user?.createdAt, kpis]);

  const { overdueList, upcomingList } = useMemo(() => {
    const now = new Date();
    const active = tasks.filter(t => t.deadline && !['completed', 'cancelled'].includes(t.status));
    const od = active.filter(t => new Date(t.deadline) < now).sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
    const up = active.filter(t => new Date(t.deadline) >= now).sort((a, b) => new Date(a.deadline) - new Date(b.deadline)).slice(0, 8);
    return { overdueList: od, upcomingList: up };
  }, [tasks]);

  const sortedProjects = useMemo(() => {
    return [...projects].sort((a, b) => {
      if (!!a.pinned !== !!b.pinned) return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
      return (a.taskStats?.progress ?? 0) - (b.taskStats?.progress ?? 0);
    });
  }, [projects]);

  const recentActivity = useMemo(() => {
    return [...websiteTasks].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)).slice(0, 8);
  }, [websiteTasks]);

  const filteredTasks = useMemo(() => {
    if (filter === 'active')    return tasks.filter(t => ['today', 'pending', 'in_progress'].includes(t.status));
    if (filter === 'review')    return tasks.filter(t => t.status === 'review');
    if (filter === 'completed') return tasks.filter(t => t.status === 'completed').slice(0, 15);
    return tasks;
  }, [tasks, filter]);

  const updateStatus = async (id, status) => {
    setUpdating(id);
    try {
      await api.put(`/tasks/${id}`, { status });
      setTasks(prev => prev.map(t => t._id === id ? { ...t, status } : t));
    } catch { /* silent, matches existing dashboard pattern */ }
    finally { setUpdating(null); }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-[60vh]"><Spinner size="lg" /></div>;
  }

  return (
    <div className="space-y-5 animate-fade-in">

      <style>{`
        @keyframes devdash-blink { 0%, 49% { opacity: 1; } 50%, 100% { opacity: 0; } }
        .devdash-cursor { display: inline-block; width: 7px; height: 15px; background: ${DEV.green}; margin-left: 2px; vertical-align: -2px; animation: devdash-blink 1s step-end infinite; }
        @media (prefers-reduced-motion: reduce) { .devdash-cursor { animation: none; opacity: 1; } }
      `}</style>

      {/* ── Terminal hero ── */}
      <div className="rounded-2xl overflow-hidden" style={{ background: DEV.bg, border: `1px solid ${DEV.border}` }}>
        {/* title bar — GTK/GNOME-style header, not macOS traffic lights:
            icon + process name on the left, flat window controls on the right */}
        <div className="flex items-center gap-2 px-3 py-2" style={{ background: DEV.panel, borderBottom: `1px solid ${DEV.border}` }}>
          <Terminal size={13} style={{ color: DEV.green, flexShrink: 0 }} />
          <span style={{ fontFamily: MONO, fontSize: 11.5, color: DEV.dim }}>
            {(user?.name || 'dev').toLowerCase().replace(/\s+/g, '')}@flowdesk — bash
          </span>
          <div className="flex-1" />
          {/* Build status badge — real signal (no overdue tasks), styled as CI */}
          <div
            className="flex items-center gap-1.5 px-2 py-0.5 rounded-full mr-2"
            style={{ background: DEV.panel2, border: `1px solid ${DEV.border}` }}
            title={kpis.overdue > 0 ? `${kpis.overdue} overdue task${kpis.overdue === 1 ? '' : 's'}` : 'Nothing overdue'}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: kpis.overdue > 0 ? DEV.red : DEV.green, boxShadow: `0 0 5px ${kpis.overdue > 0 ? DEV.red : DEV.green}` }}
            />
            <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: kpis.overdue > 0 ? DEV.red : DEV.green }}>
              build: {kpis.overdue > 0 ? 'failing' : 'passing'}
            </span>
          </div>
          <div className="flex items-center gap-0.5">
            <span className="w-6 h-6 rounded-[3px] flex items-center justify-center" style={{ color: DEV.dim }}>
              <Minus size={12} />
            </span>
            <span className="w-6 h-6 rounded-[3px] flex items-center justify-center" style={{ color: DEV.dim }}>
              <Square size={10} />
            </span>
            <span className="w-6 h-6 rounded-[3px] flex items-center justify-center" style={{ color: DEV.dim }}>
              <X size={13} />
            </span>
          </div>
        </div>

        {/* body */}
        <div className="px-5 py-4" style={{ fontFamily: MONO, fontSize: 12.5, lineHeight: 1.9 }}>
          <div><span style={{ color: DEV.green }}>➜</span> <span style={{ color: DEV.blue }}>~</span> <span style={{ color: DEV.text }}>whoami</span></div>
          <div style={{ color: DEV.dim }}>{user?.name} · Software Developer</div>

          <div className="mt-1"><span style={{ color: DEV.green }}>➜</span> <span style={{ color: DEV.blue }}>~</span> <span style={{ color: DEV.text }}>status --today</span></div>
          <div style={{ color: DEV.dim }}>
            <span style={{ color: DEV.orange }}>{kpis.todo} todo</span> · <span style={{ color: DEV.blue }}>{kpis.inProgress} in_progress</span> · <span style={{ color: DEV.purple }}>{kpis.review} review</span>
            {kpis.overdue > 0 && <> · <span style={{ color: DEV.red }}>{kpis.overdue} overdue</span></>}
          </div>

          {uptimeInfo && (
            <>
              <div className="mt-1"><span style={{ color: DEV.green }}>➜</span> <span style={{ color: DEV.blue }}>~</span> <span style={{ color: DEV.text }}>uptime</span></div>
              <div style={{ color: DEV.dim }}>
                up <span style={{ color: DEV.text }}>{uptimeInfo.days} days, {uptimeInfo.hours}:{String(uptimeInfo.mins).padStart(2, '0')}</span>, 1 user, load average: {uptimeInfo.load}
              </div>
            </>
          )}

          {uptimeSummary.monitored > 0 && (
            <>
              <div className="mt-1"><span style={{ color: DEV.green }}>➜</span> <span style={{ color: DEV.blue }}>~</span> <span style={{ color: DEV.text }}>services --status</span></div>
              <div style={{ color: DEV.dim }}>
                <span style={{ color: uptimeSummary.down > 0 ? DEV.red : DEV.green }}>{uptimeSummary.up}/{uptimeSummary.monitored} up</span>
                {uptimeSummary.down > 0 && <> · <span style={{ color: DEV.red }}>{uptimeSummary.down} down</span> ({uptimeSummary.downProjects.map(p => p.name).join(', ')})</>}
                {uptimeSummary.unknown > 0 && <> · <span style={{ color: DEV.dim }}>{uptimeSummary.unknown} pending</span></>}
                {uptimeSummary.mostRecentCheck && <> · checked {timeAgo(uptimeSummary.mostRecentCheck)}</>}
              </div>
            </>
          )}

          <div className="mt-1"><span style={{ color: DEV.green }}>➜</span> <span style={{ color: DEV.blue }}>~</span> <span style={{ color: DEV.text }}>echo $MOTD</span></div>
          <div style={{ color: DEV.text }}>"{motd}"<span className="devdash-cursor" /></div>

          {/* quick commands */}
          <div className="flex flex-wrap items-center gap-2 mt-4">
            {[
              { to: '/admin/kanban', label: './kanban', icon: FolderKanban },
              { to: '/admin/website-work', label: './website-work', icon: Code2 },
              { to: '/admin/my-tasks', label: './my-tasks', icon: ListChecks },
            ].map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors hover:bg-[#1c2128]"
                style={{ fontFamily: MONO, fontSize: 11.5, color: DEV.text, border: `1px solid ${DEV.border}`, background: DEV.panel2 }}
              >
                <Icon size={12} style={{ color: DEV.green }} /> {label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* ── Variable readout row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-7 gap-3">
        <VarStat name="todo"        value={kpis.todo}        color={DEV.orange} linkTo="/admin/kanban" />
        <VarStat name="inProgress"  value={kpis.inProgress}  color={DEV.blue}   linkTo="/admin/kanban" />
        <VarStat name="inReview"    value={kpis.review}      color={DEV.purple} linkTo="/admin/kanban" />
        <VarStat name="done"        value={kpis.done}        color={DEV.green}  linkTo="/admin/kanban" sub="all time" />
        <VarStat name="overdue"     value={kpis.overdue}     color={kpis.overdue ? DEV.red : DEV.dim} linkTo="/admin/kanban" />
        <VarStat name="liveRepos"   value={kpis.activeProjects} color={DEV.pink} linkTo="/admin/website-work" sub={`${projects.length} total`} />
        <VarStat name="currentStreak" value={streak > 0 ? `${streak}🔥` : 0} color={streak > 0 ? DEV.orange : DEV.dim} sub="days shipped in a row" />
      </div>

      {/* ── Heatmap + Deadlines log ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Panel className="lg:col-span-2">
          <CommentHeading text="activity.log — last 14 weeks" />
          <ActivityHeatmap tasks={tasks} />
        </Panel>

        <Panel className="p-0 overflow-hidden">
          <div className="px-5 pt-5"><CommentHeading text="deadlines.log" count={overdueList.length + upcomingList.length} linkTo="/admin/kanban" /></div>
          {overdueList.length === 0 && upcomingList.length === 0 ? (
            <div className="px-5 pb-5"><EmptyState icon={CheckCircle2} title="All clear" description="Nothing due soon." /></div>
          ) : (
            <div className="max-h-[260px] overflow-y-auto pb-2">
              {overdueList.map(t => (
                <LogLine key={t._id} level="urgent" timestamp={formatDate(t.deadline, 'MM-dd HH:mm')}>
                  "{t.title}" — overdue by {Math.abs(differenceInCalendarDays(new Date(t.deadline), new Date()))}d
                </LogLine>
              ))}
              {upcomingList.map(t => (
                <LogLine key={t._id} level={differenceInCalendarDays(new Date(t.deadline), new Date()) <= 1 ? 'high' : 'medium'} timestamp={formatDate(t.deadline, 'MM-dd HH:mm')}>
                  "{t.title}" — due in {differenceInCalendarDays(new Date(t.deadline), new Date())}d
                </LogLine>
              ))}
            </div>
          )}
        </Panel>
      </div>

      {/* ── stack.env — quick links pulled straight from Website Work projects ── */}
      {projectsWithLinks.length > 0 && (
        <Panel>
          <CommentHeading text="stack.env" count={projectsWithLinks.length} linkTo="/admin/website-work" />
          <div className="space-y-3">
            {projectsWithLinks.slice(0, 6).map(p => (
              <div key={p._id}>
                <div style={{ fontFamily: MONO, fontSize: 10.5, color: DEV.dim }} className="mb-1.5"># {p.name}</div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  {p.repoUrl && <EnvLine envKey="REPO_URL" url={p.repoUrl} icon={Github} />}
                  {p.adminUrl && <EnvLine envKey="ADMIN_URL" url={p.adminUrl} icon={LayoutDashboard} />}
                  {p.liveUrl && (
                    <EnvLine
                      envKey="PROD_URL"
                      url={p.liveUrl}
                      icon={Globe}
                      status={p.uptime}
                      onRecheck={() => recheckUptime(p._id)}
                      rechecking={checkingUptimeId === p._id}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* ── Website Work repos ── */}
      <Panel>
        <CommentHeading text="website_work.repos" count={projects.length} linkTo="/admin/website-work" />
        {sortedProjects.length === 0 ? (
          <EmptyState icon={Rocket} title="No repos yet" description="Create a project in Website Work to track it here." action={
            <Link to="/admin/website-work" className="btn-primary mt-2 inline-flex"><Plus size={14} /> New Project</Link>
          } />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {sortedProjects.slice(0, 6).map(p => {
              const stats = p.taskStats || {};
              const statusMeta = PROJECT_STATUS_META[p.status] || PROJECT_STATUS_META.planning;
              const cat = p.categories?.[0] ? CATEGORY_META[p.categories[0]] : null;
              return (
                <Link
                  key={p._id}
                  to="/admin/website-work"
                  className="rounded-xl p-4 transition-all duration-200 hover:-translate-y-0.5 group"
                  style={{ background: 'var(--fd-surface-sunken)', border: '1px solid var(--fd-border)' }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        {p.pinned && <Pin size={11} style={{ color: '#f59e0b' }} />}
                        <GitBranch size={12} style={{ color: 'var(--fd-ink-4)' }} />
                        <span className="text-[13px] font-bold truncate" style={{ color: 'var(--fd-ink-1)' }}>{p.name}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <span className="text-[10.5px] font-semibold px-1.5 py-0.5 rounded-md" style={{ background: statusMeta.bg, color: statusMeta.color }}>
                          {statusMeta.label}
                        </span>
                        {cat && (
                          <span className="flex items-center gap-1 text-[10.5px]" style={{ color: 'var(--fd-ink-4)' }}>
                            <span className="w-2 h-2 rounded-full" style={{ background: cat.color }} /> {cat.label}
                          </span>
                        )}
                        {p.liveUrl && (() => {
                          const liveMeta = UPTIME_META[p.uptime?.status || 'unknown'];
                          const LiveIcon = liveMeta.icon;
                          return (
                            <span
                              className="flex items-center gap-1 text-[10.5px] font-semibold"
                              style={{ color: liveMeta.color }}
                              title={p.uptime?.lastCheckedAt ? `Live URL checked ${timeAgo(p.uptime.lastCheckedAt)}` : 'Live URL not checked yet'}
                            >
                              <LiveIcon size={10} /> {liveMeta.label}
                            </span>
                          );
                        })()}
                      </div>
                    </div>
                    <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 800, color: statusMeta.color }}>{stats.progress || 0}%</span>
                  </div>

                  {/* build bar */}
                  <div className="h-1.5 rounded-full overflow-hidden mt-3 flex" style={{ background: 'var(--fd-border)' }}>
                    {(stats.total || 0) > 0 && (
                      <>
                        <div style={{ width: `${(stats.completed / stats.total) * 100}%`, background: '#22c55e' }} />
                        <div style={{ width: `${(stats.review / stats.total) * 100}%`, background: '#a855f7' }} />
                        <div style={{ width: `${(stats.inProgress / stats.total) * 100}%`, background: '#4f6ef0' }} />
                      </>
                    )}
                  </div>

                  <div className="flex items-center gap-3 mt-2.5 text-[11px]" style={{ color: 'var(--fd-ink-4)' }}>
                    <span>{stats.total || 0} tasks</span>
                    <span>·</span>
                    <span style={{ color: '#22c55e' }}>{stats.completed || 0} done</span>
                    {stats.review > 0 && <><span>·</span><span style={{ color: '#a855f7' }}>{stats.review} review</span></>}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </Panel>

      {/* ── Task queue + git log ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Panel className="p-0 overflow-hidden">
          <div className="px-5 pt-5 pb-1">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
              <div style={{ fontFamily: MONO, fontSize: 12.5 }}>
                <span style={{ color: 'var(--fd-ink-5)' }}>// </span>
                <span style={{ color: 'var(--fd-ink-2)' }}>tasks --status={filter}</span>
              </div>
              <div className="flex items-center gap-1 rounded-lg p-0.5" style={{ background: 'var(--fd-surface-sunken)' }}>
                {[['active', 'active'], ['review', 'review'], ['completed', 'done'], ['all', 'all']].map(([val, lbl]) => (
                  <button
                    key={val}
                    onClick={() => setFilter(val)}
                    className="px-2.5 py-1 rounded-md text-[10.5px] font-semibold transition-colors"
                    style={{
                      fontFamily: MONO,
                      ...(filter === val ? { background: 'var(--fd-card-bg)', color: 'var(--fd-ink-1)', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' } : { color: 'var(--fd-ink-4)' }),
                    }}
                  >
                    {lbl}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {filteredTasks.length === 0 ? (
            <div className="px-5 pb-5"><EmptyState icon={CheckCircle2} title="Nothing here" description="No tasks match this filter." /></div>
          ) : (
            <div className="max-h-[420px] overflow-y-auto">
              {filteredTasks.slice(0, 20).map(t => (
                <TaskLine key={t._id} task={t} onStatusChange={updateStatus} updating={updating} />
              ))}
            </div>
          )}
        </Panel>

        <Panel className="p-0 overflow-hidden">
          <div className="px-5 pt-5"><CommentHeading text="git log --website-work --oneline" linkTo="/admin/website-work" /></div>
          {recentActivity.length === 0 ? (
            <div className="px-5 pb-5"><EmptyState icon={Sparkles} title="Quiet in here" description="No recent Website Work updates." /></div>
          ) : (
            <div className="max-h-[420px] overflow-y-auto">
              {recentActivity.map(t => {
                const glyph = TASK_GLYPH[t.status] || TASK_GLYPH.pending;
                return (
                  <div key={t._id} className="flex items-center gap-3 px-5 py-2.5 border-b last:border-0" style={{ borderColor: 'var(--fd-table-row-border)' }}>
                    <span style={{ fontFamily: MONO, fontSize: 11, color: DEV.orange }} className="flex-shrink-0">{shortHash(t._id)}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] font-medium truncate" style={{ color: 'var(--fd-ink-1)' }}>{t.title}</div>
                      <div style={{ fontFamily: MONO, fontSize: 10.5, color: 'var(--fd-ink-4)' }} className="mt-0.5">
                        {t.websiteProject?.name || 'website-work'} · {t.assignedTo?.name || 'unassigned'} · {timeAgo(t.updatedAt)}
                      </div>
                    </div>
                    <span className="text-[10px] font-bold flex-shrink-0" style={{ fontFamily: MONO, color: glyph.color }}>{glyph.label.toLowerCase().replace(' ', '_')}</span>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}