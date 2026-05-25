import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2, CheckSquare, Clock, Users, Target,
  TrendingUp, AlertCircle, Play, ChevronRight, Plus,
  ArrowUpRight, Zap, BarChart2, Activity, Bell, Phone, Flame,
  Camera, ChevronLeft, CalendarDays,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, FunnelChart, Funnel, LabelList,
} from 'recharts';
import api from '../../lib/api';
import useAuthStore from '../../context/authStore';
import {
  StatCard, Avatar, Card, CardHeader, CardContent, Spinner, EmptyState,
} from '../../components/shared/LoadingScreen';
import { Button } from '../../components/ui/index';
import { formatDate, timeAgo } from '../../lib/utils';
import {
  format as fmtDate, startOfMonth, endOfMonth, eachDayOfInterval,
  startOfWeek, endOfWeek, isSameMonth, isSameDay, isToday,
  addMonths, subMonths, parseISO, startOfDay, endOfDay, isBefore, isAfter,
} from 'date-fns';
import PerformanceMarketerDashboard from './PerformanceMarketerDashboard';

const ROLE_LABELS = {
  admin: 'Admin', manager: 'Project Manager',
  performance_marketer: 'Performance Marketer',
  social_media_manager: 'Social Media Manager',
  video_editor: 'Video Editor', graphic_designer: 'Graphic Designer',
  copywriter: 'Copywriter',
};

const ROLE_HERO = {
  performance_marketer: { greeting: 'Campaign Overview',  emoji: '📊', tip: 'Check active paid ads tasks — optimise for ROAS early.' },
  social_media_manager: { greeting: 'Content Hub',        emoji: '📱', tip: 'Review upcoming deadlines and your content calendar.' },
  video_editor:         { greeting: 'Edit Queue',          emoji: '🎬', tip: 'Urgent edits are at the top. Check Files for raw footage.' },
  graphic_designer:     { greeting: 'Design Studio',       emoji: '🎨', tip: 'Check task descriptions for briefs before starting.' },
  copywriter:           { greeting: 'Writing Desk',        emoji: '✍️',  tip: 'See Files for brand voice guides per client.' },
  manager:              { greeting: 'Operations Overview', emoji: '🗂️', tip: 'Assign pending tasks and review anything in Review.' },
  admin:                { greeting: 'Agency Dashboard',    emoji: '🏢', tip: 'Full agency health at a glance.' },
};

const PRIORITY_STYLES = {
  low:    { background: 'var(--fd-surface-sunken)', color: 'var(--fd-ink-3)' },
  medium: { background: 'var(--fd-sidebar-active)', color: 'var(--fd-sidebar-link-active)' },
  high:   { background: 'rgba(146,96,10,0.15)',     color: '#f59e0b' },
  urgent: { background: 'rgba(185,28,28,0.15)',     color: '#ef4444' },
};

const STATUS_STYLES = {
  pending:     { background: 'var(--fd-surface-sunken)', color: 'var(--fd-ink-3)' },
  in_progress: { background: 'var(--fd-sidebar-active)', color: 'var(--fd-sidebar-link-active)' },
  review:      { background: 'rgba(126,34,206,0.15)',    color: '#a855f7' },
  completed:   { background: 'rgba(42,125,79,0.15)',     color: '#22c55e' },
  cancelled:   { background: 'rgba(185,28,28,0.15)',     color: '#ef4444' },
};

const FUNNEL_COLORS = {
  new: '#4f6ef0', contacted: '#f59e0b', qualified: '#a855f7',
  converted: '#22c55e', lost: '#ef4444',
};

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionHeading({ title, count, linkTo }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <h3 className="text-[13.5px] font-semibold" style={{ color: 'var(--fd-ink-1)' }}>{title}</h3>
        {count !== undefined && (
          <span
            className="text-[10.5px] font-semibold px-1.5 py-0.5 rounded-full"
            style={{ background: 'var(--fd-surface-sunken)', color: 'var(--fd-ink-4)' }}
          >
            {count}
          </span>
        )}
      </div>
      {linkTo && (
        <Link
          to={linkTo}
          className="flex items-center gap-1 text-[11.5px] font-medium transition-opacity hover:opacity-70"
          style={{ color: 'var(--fd-sidebar-link-active)' }}
        >
          View all <ArrowUpRight size={11} />
        </Link>
      )}
    </div>
  );
}

function TaskRow({ task, onStatusChange, updating }) {
  const isOverdue = task.deadline && new Date(task.deadline) < new Date() && task.status !== 'completed';
  const pStyle = PRIORITY_STYLES[task.priority] || PRIORITY_STYLES.low;
  const sStyle = STATUS_STYLES[task.status]   || STATUS_STYLES.pending;

  return (
    <div
      className="flex items-center gap-4 px-5 py-3.5 border-b transition-colors last:border-0 hover:bg-[var(--fd-table-row-hover)]"
      style={{ borderColor: 'var(--fd-table-row-border)' }}
    >
      <div className="flex-1 min-w-0">
        <div className="text-[12.5px] font-medium truncate" style={{ color: 'var(--fd-ink-1)' }}>{task.title}</div>
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap" style={{ color: 'var(--fd-ink-4)', fontSize: 11 }}>
          {task.client?.company && <span>{task.client.company}</span>}
          {task.deadline && (
            <span style={{ color: isOverdue ? '#ef4444' : 'var(--fd-ink-5)' }}>
              {isOverdue ? '⚠ Overdue · ' : '· '}{formatDate(task.deadline)}
            </span>
          )}
        </div>
      </div>

      <span className="text-[10.5px] font-medium px-2 py-0.5 rounded-full flex-shrink-0" style={pStyle}>
        {task.priority}
      </span>

      {onStatusChange ? (
        <select
          className="text-[10.5px] font-medium px-2 py-0.5 rounded-full border-0 outline-none cursor-pointer flex-shrink-0"
          style={sStyle}
          value={task.status}
          onChange={e => onStatusChange(task._id, e.target.value)}
          disabled={updating === task._id}
        >
          <option value="pending">To Do</option>
          <option value="in_progress">In Progress</option>
          <option value="review">Review</option>
          <option value="completed">Completed</option>
        </select>
      ) : (
        <span className="text-[10.5px] font-medium px-2 py-0.5 rounded-full flex-shrink-0" style={sStyle}>
          {task.status?.replace('_', ' ')}
        </span>
      )}
    </div>
  );
}

// ── Custom chart tooltip ──────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-xl px-3 py-2 text-[12px]"
      style={{
        background: 'var(--fd-surface)',
        border: '1px solid var(--fd-border)',
        boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
        color: 'var(--fd-ink-2)',
      }}
    >
      <div className="font-medium mb-1" style={{ color: 'var(--fd-ink-1)' }}>{label}</div>
      {payload.map(p => (
        <div key={p.name} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span>{p.name}: <strong>{p.value}</strong></span>
        </div>
      ))}
    </div>
  );
}

// ── Analytics Panel ───────────────────────────────────────────────────────────
function AnalyticsPanel() {
  const [taskAnalytics, setTaskAnalytics] = useState(null);
  const [leadAnalytics, setLeadAnalytics] = useState(null);
  const [loadingT, setLoadingT] = useState(true);
  const [loadingL, setLoadingL] = useState(true);

  useEffect(() => {
    api.get('/dashboard/analytics/tasks?days=14')
      .then(r => setTaskAnalytics(r.data))
      .catch(() => {})
      .finally(() => setLoadingT(false));

    api.get('/dashboard/analytics/leads')
      .then(r => setLeadAnalytics(r.data))
      .catch(() => {})
      .finally(() => setLoadingL(false));
  }, []);

  const trendData = taskAnalytics?.trend?.map(d => ({
    date:      d.date.slice(5), // MM-DD
    Created:   d.created,
    Completed: d.completed,
  })) || [];

  const funnelData = leadAnalytics?.funnel || [];
  const maxFunnelCount = Math.max(...funnelData.map(f => f.count), 1);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {/* Task trend */}
      <Card>
        <CardHeader>
          <SectionHeading title="Task Activity (14 days)" linkTo="/admin/tasks" />
        </CardHeader>
        <CardContent>
          {loadingT ? (
            <div className="h-44 flex items-center justify-center"><Spinner /></div>
          ) : trendData.length === 0 ? (
            <EmptyState icon={BarChart2} title="No data yet" description="Tasks will appear here once created." />
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={trendData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradCreated" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#4f6ef0" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#4f6ef0" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradCompleted" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#22c55e" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--fd-ink-5)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--fd-ink-5)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="Created"   stroke="#4f6ef0" strokeWidth={1.5} fill="url(#gradCreated)"   dot={false} />
                <Area type="monotone" dataKey="Completed" stroke="#22c55e" strokeWidth={1.5} fill="url(#gradCompleted)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Lead funnel */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <SectionHeading title="Lead Pipeline" linkTo="/admin/leads" />
            {leadAnalytics && (
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ background: 'rgba(34,197,94,0.12)', color: '#22c55e' }}>
                {leadAnalytics.conversionRate}% conversion
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loadingL ? (
            <div className="h-44 flex items-center justify-center"><Spinner /></div>
          ) : funnelData.length === 0 || funnelData.every(f => f.count === 0) ? (
            <EmptyState icon={Target} title="No lead data" description="Upload leads to see pipeline." />
          ) : (
            <div className="space-y-2">
              {funnelData.map((f, i) => {
                const pct = maxFunnelCount > 0 ? (f.count / maxFunnelCount) * 100 : 0;
                const color = FUNNEL_COLORS[f.stage] || '#aaa';
                return (
                  <div key={f.stage}>
                    <div className="flex items-center justify-between mb-1 text-[11px]">
                      <span className="capitalize font-medium" style={{ color: 'var(--fd-ink-2)' }}>{f.stage}</span>
                      <span style={{ color: 'var(--fd-ink-4)' }}>{f.count.toLocaleString()}</span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--fd-surface-sunken)' }}>
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, background: color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Productivity panel ────────────────────────────────────────────────────────
function ProductivityPanel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/dashboard/analytics/productivity')
      .then(r => setData(r.data.productivity))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-32"><Spinner /></div>;
  if (!data?.length) return null;

  return (
    <Card>
      <CardHeader>
        <SectionHeading title="Team Productivity (30 days)" linkTo="/admin/team" />
      </CardHeader>
      <CardContent className="p-0">
        {data.map(({ member, completed, overdue, inReview, completionRate }) => (
          <div
            key={member._id}
            className="flex items-center gap-4 px-5 py-3 border-b last:border-0"
            style={{ borderColor: 'var(--fd-table-row-border)' }}
          >
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
              style={{ background: 'var(--fd-sidebar-active)', color: 'var(--fd-sidebar-link-active)' }}
            >
              {member.name?.charAt(0)?.toUpperCase()}
            </div>

            <div className="flex-1 min-w-0">
              <div className="text-[12.5px] font-medium" style={{ color: 'var(--fd-ink-1)' }}>{member.name}</div>
              <div className="text-[11px] mt-0.5" style={{ color: 'var(--fd-ink-4)' }}>
                {member.jobTitle || member.role?.replace(/_/g, ' ')}
              </div>
            </div>

            <div className="hidden sm:flex items-center gap-4 text-[11px]" style={{ color: 'var(--fd-ink-4)' }}>
              <div className="text-center">
                <div className="font-semibold text-[13px]" style={{ color: '#22c55e' }}>{completed}</div>
                <div>done</div>
              </div>
              <div className="text-center">
                <div className="font-semibold text-[13px]" style={{ color: '#a855f7' }}>{inReview}</div>
                <div>review</div>
              </div>
              {overdue > 0 && (
                <div className="text-center">
                  <div className="font-semibold text-[13px]" style={{ color: '#ef4444' }}>{overdue}</div>
                  <div>overdue</div>
                </div>
              )}
            </div>

            {/* Completion bar */}
            <div className="w-20 hidden md:block">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px]" style={{ color: 'var(--fd-ink-5)' }}>{completionRate}%</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--fd-surface-sunken)' }}>
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${completionRate}%`,
                    background: completionRate >= 70 ? '#22c55e' : completionRate >= 40 ? '#f59e0b' : '#ef4444',
                    transition: 'width 0.6s ease',
                  }}
                />
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ── Manager Dashboard ─────────────────────────────────────────────────────────
function ManagerDashboard() {
  const [stats, setStats]     = useState({});
  const [tasks, setTasks]     = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/dashboard/stats').catch(() => ({ data: {} })),
      api.get('/tasks?status=pending&limit=6'),
      api.get('/clients?limit=5&status=active'),
    ]).then(([s, t, c]) => {
      setStats(s.data);
      setTasks(t.data.tasks || []);
      setClients(c.data.clients || []);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-60"><Spinner size="lg" /></div>;

  return (
    <div className="space-y-5">
      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard title="Active Clients" value={stats?.activeClients ?? 0} icon={Building2}    color="blue"   linkTo="/admin/clients?status=active" />
        <StatCard title="Open Tasks"     value={stats?.openTasks    ?? 0} icon={CheckSquare}   color="orange" subtitle="Pending + In Progress" linkTo="/admin/tasks?status=pending" />
        <StatCard title="In Review"      value={stats?.reviewTasks  ?? 0} icon={Clock}         color="purple" subtitle="Awaiting approval"     linkTo="/admin/tasks?status=in_review" />
        <StatCard title="Team Members"   value={stats?.teamCount    ?? 0} icon={Users}         color="green"  linkTo="/admin/team" />
      </div>

      {/* Analytics charts */}
      <AnalyticsPanel />

      {/* Tasks + Clients row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <SectionHeading title="Pending Tasks" count={tasks.length} linkTo="/admin/tasks" />
            </CardHeader>
            <CardContent className="p-0">
              {tasks.length === 0 ? (
                <EmptyState icon={CheckSquare} title="No pending tasks" description="All tasks are in progress or completed." />
              ) : (
                tasks.map(t => <TaskRow key={t._id} task={t} />)
              )}
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader>
              <SectionHeading title="Active Clients" linkTo="/admin/clients" />
            </CardHeader>
            <CardContent className="p-0">
              {clients.length === 0 ? (
                <div className="py-8 text-center text-[13px]" style={{ color: 'var(--fd-ink-4)' }}>No active clients</div>
              ) : (
                clients.map(client => (
                  <Link
                    key={client._id}
                    to={`/admin/clients/${client._id}`}
                    className="flex items-center gap-3 px-5 py-3.5 border-b last:border-0 group transition-colors hover:bg-[var(--fd-table-row-hover)]"
                    style={{ borderColor: 'var(--fd-table-row-border)' }}
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-bold flex-shrink-0"
                      style={{ background: 'var(--fd-sidebar-active)', color: 'var(--fd-sidebar-link-active)' }}
                    >
                      {client.company?.charAt(0)?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[12.5px] font-medium truncate" style={{ color: 'var(--fd-ink-1)' }}>{client.company}</div>
                      <div className="text-[11px] truncate" style={{ color: 'var(--fd-ink-4)' }}>{client.industry}</div>
                    </div>
                    <ChevronRight size={13} style={{ color: 'var(--fd-ink-5)' }} />
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Productivity */}
      <ProductivityPanel />
    </div>
  );
}

// ── Team Member Dashboard ─────────────────────────────────────────────────────
function TeamMemberDashboard({ user }) {
  const [tasks, setTasks]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(null);

  useEffect(() => {
    api.get('/tasks?limit=30').then(r => setTasks(r.data.tasks || [])).finally(() => setLoading(false));
  }, []);

  const updateStatus = async (id, status) => {
    setUpdating(id);
    try {
      await api.put(`/tasks/${id}`, { status });
      setTasks(prev => prev.map(t => t._id === id ? { ...t, status } : t));
    } finally { setUpdating(null); }
  };

  const hero      = ROLE_HERO[user?.role] || ROLE_HERO.manager;
  const pending   = tasks.filter(t => t.status === 'pending');
  const inProgress = tasks.filter(t => t.status === 'in_progress');
  const review    = tasks.filter(t => t.status === 'review');
  const completed = tasks.filter(t => t.status === 'completed');
  const active    = [...inProgress, ...pending];

  if (loading) return <div className="flex items-center justify-center h-60"><Spinner size="lg" /></div>;

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative rounded-2xl px-6 py-5 overflow-hidden fd-card">
        <div className="absolute right-6 top-1/2 -translate-y-1/2 text-[72px] opacity-[0.05] pointer-events-none select-none" aria-hidden>
          {hero.emoji}
        </div>
        <div className="relative z-10">
          <div className="text-[22px] mb-1" aria-hidden>{hero.emoji}</div>
          <h2 className="text-[17px] font-bold tracking-[-0.01em]" style={{ color: 'var(--fd-ink-1)' }}>{hero.greeting}</h2>
          <p className="text-[13px] mt-1 max-w-md" style={{ color: 'var(--fd-ink-3)' }}>{hero.tip}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard title="To Do"       value={pending.length}    icon={AlertCircle} color="orange" linkTo="/admin/my-tasks?status=pending" />
        <StatCard title="In Progress" value={inProgress.length} icon={Play}        color="blue"   linkTo="/admin/my-tasks?status=in_progress" />
        <StatCard title="In Review"   value={review.length}     icon={Clock}       color="purple" linkTo="/admin/my-tasks?status=in_review" />
        <StatCard title="Completed"   value={completed.length}  icon={CheckSquare} color="green"  linkTo="/admin/my-tasks?status=completed" />
      </div>

      {/* Active tasks */}
      <Card>
        <CardHeader>
          <SectionHeading title="Your Active Tasks" count={active.length} linkTo="/admin/my-tasks" />
        </CardHeader>
        <CardContent className="p-0">
          {active.length === 0 ? (
            <EmptyState icon={CheckSquare} title="All caught up" description="No active tasks assigned to you right now." />
          ) : (
            active.slice(0, 8).map(t => (
              <TaskRow key={t._id} task={t} onStatusChange={updateStatus} updating={updating} />
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Quality badge ─────────────────────────────────────────────────────────────
const QUALITY_CONFIG = {
  hot:  { label: 'Hot',  color: '#ef4444', bg: 'rgba(239,68,68,0.1)',  dot: '#ef4444' },
  warm: { label: 'Warm', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', dot: '#f59e0b' },
  cold: { label: 'Cold', color: '#60a5fa', bg: 'rgba(96,165,250,0.1)', dot: '#60a5fa' },
};

const STAGE_CONFIG = {
  new:               { label: 'New',        color: '#6366f1' },
  contacted:         { label: 'Contacted',  color: '#f59e0b' },
  meeting_scheduled: { label: 'Meeting',    color: '#a855f7' },
  proposal_sent:     { label: 'Proposal',   color: '#3b82f6' },
  negotiation:       { label: 'Negotiating',color: '#f97316' },
  won:               { label: 'Won',        color: '#22c55e' },
  lost:              { label: 'Lost',       color: '#ef4444' },
};


// ── Event type colours (mirrors CalendarPage) ─────────────────────────────────
const EVENT_TYPE_META = {
  task_deadline: { label: 'Task Deadline', icon: '✅', color: '#f59e0b' },
  meeting:       { label: 'Meeting',       icon: '🤝', color: '#6366f1' },
  reminder:      { label: 'Reminder',      icon: '🔔', color: '#06b6d4' },
  follow_up:     { label: 'Follow-up',     icon: '📞', color: '#8b5cf6' },
  campaign:      { label: 'Campaign',      icon: '📣', color: '#0ea5e9' },
  shoot:         { label: 'Shoot',         icon: '📷', color: '#ec4899' },
  other:         { label: 'Event',         icon: '📌', color: '#94a3b8' },
};

function CalendarWidget() {
  const [events,  setEvents]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [month,   setMonth]   = useState(new Date());
  const [selDay,  setSelDay]  = useState(null); // date clicked on mini-cal

  useEffect(() => {
    // Wide window: 1 month back → 5 months forward
    const from = subMonths(new Date(), 1).toISOString();
    const to   = addMonths(new Date(), 5).toISOString();
    api.get(`/calendar?from=${from}&to=${to}`)
      .then(r => setEvents(r.data.events || []))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, []);

  const now = new Date();

  // Enrich events with computed status
  const enriched = events.map(ev => {
    const start = parseISO(ev.startDate);
    let _status = ev.status || 'pending';
    if (_status !== 'done' && _status !== 'cancelled' && isBefore(start, startOfDay(now))) {
      _status = 'overdue';
    }
    return { ...ev, _start: start, _status };
  });

  // Calendar grid
  const mStart   = startOfMonth(month);
  const mEnd     = endOfMonth(month);
  const calStart = startOfWeek(mStart, { weekStartsOn: 1 });
  const calEnd   = endOfWeek(mEnd,   { weekStartsOn: 1 });
  const days     = eachDayOfInterval({ start: calStart, end: calEnd });

  const eventsOnDay = (day) => {
    const ds = startOfDay(day), de = endOfDay(day);
    return enriched.filter(ev => ev._start >= ds && ev._start <= de);
  };

  // Events to show in the list: selected day or upcoming (from today in current month)
  const listEvents = selDay
    ? eventsOnDay(selDay).sort((a, b) => a._start - b._start)
    : enriched
        .filter(ev => ev._start >= startOfDay(now) && ev._start <= endOfMonth(month))
        .sort((a, b) => a._start - b._start)
        .slice(0, 12);

  const listTitle = selDay
    ? fmtDate(selDay, 'EEEE, MMM d')
    : `Upcoming in ${fmtDate(month, 'MMMM')}`;

  // Count upcoming events this month
  const upcomingCount = enriched.filter(ev =>
    ev._start >= startOfDay(now) && ev._start <= endOfMonth(month)
  ).length;

  if (loading) return (
    <div className="rounded-2xl flex items-center justify-center py-12"
      style={{ background: 'var(--fd-card-bg)', border: '1px solid var(--fd-border)' }}>
      <Spinner />
    </div>
  );

  return (
    <div className="rounded-2xl overflow-hidden"
      style={{ background: 'var(--fd-card-bg)', border: '1px solid var(--fd-border)', boxShadow: '0 2px 16px rgba(0,0,0,0.05)' }}>

      {/* Header */}
      <div className="px-5 pt-5 pb-4" style={{ borderBottom: '1px solid var(--fd-border)' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.2)' }}>
              <CalendarDays size={16} style={{ color: '#6366f1' }} />
            </div>
            <div>
              <h3 className="text-[14px] font-bold tracking-[-0.01em]" style={{ color: 'var(--fd-ink-1)' }}>
                Calendar
              </h3>
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--fd-ink-4)' }}>
                {fmtDate(month, 'MMMM yyyy')} · {upcomingCount} upcoming event{upcomingCount !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => { setMonth(m => subMonths(m, 1)); setSelDay(null); }}
              className="p-1.5 rounded-lg transition-colors hover:bg-[var(--fd-surface-sunken)]"
              style={{ color: 'var(--fd-ink-3)' }}>
              <ChevronLeft size={14} />
            </button>
            <button onClick={() => { setMonth(new Date()); setSelDay(null); }}
              className="px-2 py-0.5 rounded-md text-[10.5px] font-semibold transition-colors hover:bg-[var(--fd-surface-sunken)]"
              style={{ color: 'var(--fd-ink-4)' }}>
              Today
            </button>
            <button onClick={() => { setMonth(m => addMonths(m, 1)); setSelDay(null); }}
              className="p-1.5 rounded-lg transition-colors hover:bg-[var(--fd-surface-sunken)]"
              style={{ color: 'var(--fd-ink-3)' }}>
              <ChevronRight size={14} />
            </button>
            <Link to="/admin/calendar"
              className="ml-2 flex items-center gap-1 text-[11.5px] font-semibold px-3 py-1.5 rounded-lg transition-all hover:opacity-80"
              style={{ background: 'var(--fd-sidebar-active)', color: 'var(--fd-sidebar-link-active)' }}>
              Full Calendar <ArrowUpRight size={11} />
            </Link>
          </div>
        </div>
      </div>

      {/* Two-column: mini-cal + list */}
      <div className="flex flex-col lg:flex-row">

        {/* Mini Calendar */}
        <div className="p-4 lg:w-[320px] flex-shrink-0" style={{ borderRight: '1px solid var(--fd-border)' }}>
          {/* Day headers */}
          <div className="grid grid-cols-7 mb-1">
            {['M','T','W','T','F','S','S'].map((d, i) => (
              <div key={i} className="text-center py-1 text-[9.5px] font-bold uppercase tracking-wider"
                style={{ color: i >= 5 ? 'var(--fd-ink-5)' : 'var(--fd-ink-4)' }}>{d}</div>
            ))}
          </div>
          {/* Day cells */}
          <div className="grid grid-cols-7 gap-[2px]">
            {days.map((day, idx) => {
              const dayEvs  = eventsOnDay(day);
              const inMo    = isSameMonth(day, month);
              const todayDay = isToday(day);
              const isSelected = selDay && isSameDay(day, selDay);
              const hasOverdue  = dayEvs.some(e => e._status === 'overdue');
              const hasPending  = dayEvs.some(e => e._status === 'pending' || e._status === 'in_progress');

              // pick accent dot colour
              const dotColor = hasOverdue ? '#ef4444' : hasPending ? '#6366f1' : dayEvs.length ? '#22c55e' : null;

              return (
                <button key={idx}
                  onClick={() => setSelDay(isSelected ? null : day)}
                  className="relative flex flex-col items-center justify-start pt-1 pb-1 rounded-lg transition-all"
                  style={{
                    minHeight: 36,
                    background: isSelected ? 'rgba(99,102,241,0.12)' : todayDay ? 'rgba(99,102,241,0.05)' : 'transparent',
                    border: isSelected ? '1.5px solid rgba(99,102,241,0.5)' : todayDay ? '1px solid rgba(99,102,241,0.2)' : '1px solid transparent',
                    opacity: inMo ? 1 : 0.3,
                    cursor: 'pointer',
                  }}>
                  <span className="text-[11px] font-semibold w-5 h-5 rounded-full flex items-center justify-center"
                    style={{
                      background: todayDay ? '#6366f1' : 'transparent',
                      color: todayDay ? '#fff' : 'var(--fd-ink-2)',
                    }}>
                    {fmtDate(day, 'd')}
                  </span>
                  {dotColor && dayEvs.length > 0 && (
                    <div className="flex gap-[2px] mt-[2px] flex-wrap justify-center">
                      {dayEvs.slice(0, 3).map((ev, si) => {
                        const meta = EVENT_TYPE_META[ev.type] || EVENT_TYPE_META.other;
                        const dotC = ev._status === 'overdue' ? '#ef4444'
                          : ev._status === 'done' ? '#22c55e' : meta.color;
                        return (
                          <div key={si} className="w-1.5 h-1.5 rounded-full" style={{ background: dotC }} title={ev.title} />
                        );
                      })}
                      {dayEvs.length > 3 && (
                        <span className="text-[8px] font-bold" style={{ color: 'var(--fd-ink-5)' }}>+{dayEvs.length - 3}</span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Event type legend */}
          <div className="mt-3 pt-3 flex flex-wrap gap-x-3 gap-y-1.5" style={{ borderTop: '1px solid var(--fd-border)' }}>
            {[
              { label: 'Overdue', color: '#ef4444' },
              { label: 'Pending', color: '#6366f1' },
              { label: 'Done',    color: '#22c55e' },
            ].map(({ label, color }) => (
              <div key={label} className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                <span className="text-[10.5px]" style={{ color: 'var(--fd-ink-4)' }}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Event List */}
        <div className="flex-1 overflow-hidden">
          {/* List header */}
          <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--fd-border)' }}>
            <span className="text-[12px] font-semibold" style={{ color: 'var(--fd-ink-2)' }}>{listTitle}</span>
            {selDay && (
              <button onClick={() => setSelDay(null)}
                className="text-[11px] px-2 py-0.5 rounded-md hover:bg-[var(--fd-surface-sunken)]"
                style={{ color: 'var(--fd-ink-4)' }}>
                Clear ×
              </button>
            )}
          </div>

          {listEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2">
              <CalendarDays size={22} style={{ color: 'var(--fd-ink-5)' }} />
              <p className="text-[13px] font-medium" style={{ color: 'var(--fd-ink-3)' }}>
                {selDay ? 'No events on this day' : `No upcoming events in ${fmtDate(month, 'MMMM')}`}
              </p>
              <Link to="/admin/calendar" className="text-[12px] font-medium mt-1"
                style={{ color: 'var(--fd-sidebar-link-active)' }}>
                Add an event →
              </Link>
            </div>
          ) : (
            <div className="divide-y overflow-y-auto" style={{ borderColor: 'var(--fd-border)', maxHeight: 340 }}>
              {listEvents.map(ev => {
                const meta = EVENT_TYPE_META[ev.type] || EVENT_TYPE_META.other;
                const dotC = ev._status === 'overdue' ? '#ef4444'
                  : ev._status === 'done' ? '#22c55e' : meta.color;
                const clientName = ev.client?.company || ev.client?.name || null;
                const assignees  = ev.assignedTo || [];

                return (
                  <Link key={ev._id} to="/admin/calendar"
                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--fd-table-row-hover)] group">
                    {/* Coloured left bar */}
                    <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ background: dotC, minHeight: 32 }} />

                    {/* Icon */}
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center text-[15px] flex-shrink-0"
                      style={{ background: meta.color + '15', border: `1px solid ${meta.color}25` }}>
                      {meta.icon}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[12.5px] font-semibold truncate" style={{ color: 'var(--fd-ink-1)' }}>
                          {ev.title}
                        </span>
                        {ev._status === 'overdue' && (
                          <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded-md"
                            style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
                            OVERDUE
                          </span>
                        )}
                        {ev._status === 'done' && (
                          <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded-md"
                            style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e' }}>
                            DONE
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap" style={{ color: 'var(--fd-ink-4)', fontSize: 11 }}>
                        <span style={{ color: meta.color, fontWeight: 500 }}>{meta.label}</span>
                        <span>·</span>
                        <span>{fmtDate(ev._start, ev.allDay ? 'EEE, MMM d' : 'EEE, MMM d · h:mm a')}</span>
                        {clientName && <><span>·</span><span className="font-medium" style={{ color: 'var(--fd-ink-3)' }}>{clientName}</span></>}
                      </div>
                      {/* Assigned avatars */}
                      {assignees.length > 0 && (
                        <div className="flex items-center gap-1 mt-1">
                          {assignees.slice(0, 4).map((u, i) => (
                            <div key={i}
                              className="w-4 h-4 rounded-full text-[8px] font-bold flex items-center justify-center text-white"
                              style={{ background: '#6366f1', marginLeft: i > 0 ? -4 : 0 }}
                              title={u.name}>
                              {u.name?.charAt(0)?.toUpperCase()}
                            </div>
                          ))}
                          {assignees.length > 4 && (
                            <span className="text-[9px] ml-1" style={{ color: 'var(--fd-ink-5)' }}>+{assignees.length - 4}</span>
                          )}
                        </div>
                      )}
                    </div>

                    <ChevronRight size={13} className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ color: 'var(--fd-ink-4)' }} />
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Shoot Schedule Widget ─────────────────────────────────────────────────────
const SHOOT_TYPE_META = {
  photo_shoot:   { label: 'Photo',    icon: '📷', color: '#ec4899' },
  video_shoot:   { label: 'Video',    icon: '🎬', color: '#8b5cf6' },
  reel_shoot:    { label: 'Reel',     icon: '📱', color: '#f97316' },
  product_shoot: { label: 'Product',  icon: '📦', color: '#0ea5e9' },
  event_shoot:   { label: 'Event',    icon: '🎉', color: '#10b981' },
  interview:     { label: 'Interview',icon: '🎙️', color: '#6366f1' },
  bts:           { label: 'BTS',      icon: '🎥', color: '#f59e0b' },
  other_shoot:   { label: 'Other',    icon: '🎞️', color: '#94a3b8' },
};

function ShootScheduleWidget() {
  const [shoots,  setShoots]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [month,   setMonth]   = useState(new Date());
  const [filter,  setFilter]  = useState('all'); // 'all' | 'pending' | 'done' | 'overdue'

  useEffect(() => {
    // Fetch shoots: 3 months back to 6 months forward so the calendar is well-populated
    const from = subMonths(new Date(), 3).toISOString();
    const to   = addMonths(new Date(), 6).toISOString();
    api.get(`/calendar?type=shoot&from=${from}&to=${to}`)
      .then(r => setShoots(r.data.events || r.data || []))
      .catch(() => setShoots([]))
      .finally(() => setLoading(false));
  }, []);

  const now = new Date();

  // Attach computed status to each shoot
  const withStatus = shoots.map(s => {
    const start = parseISO(s.startDate);
    let status = 'pending';
    if (s.status === 'done' || s.completed) {
      status = 'done';
    } else if (isBefore(start, startOfDay(now))) {
      status = 'overdue';
    }
    return { ...s, _status: status, _start: start };
  });

  // Shoots in current calendar month
  const mStart = startOfMonth(month);
  const mEnd   = endOfMonth(month);
  const monthShoots = withStatus.filter(s => s._start >= mStart && s._start <= mEnd);

  // Apply filter
  const filtered = filter === 'all' ? monthShoots : monthShoots.filter(s => s._status === filter);

  // Calendar grid
  const calStart = startOfWeek(mStart, { weekStartsOn: 1 });
  const calEnd   = endOfWeek(mEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: calStart, end: calEnd });

  const shootsOnDay = (day) => {
    const ds = startOfDay(day), de = endOfDay(day);
    return withStatus.filter(s => s._start >= ds && s._start <= de);
  };

  const statusConfig = {
    pending: { label: 'Pending', bg: 'rgba(245,158,11,0.1)', color: '#f59e0b', dot: '#f59e0b' },
    done:    { label: 'Done',    bg: 'rgba(34,197,94,0.1)',  color: '#22c55e', dot: '#22c55e' },
    overdue: { label: 'Overdue', bg: 'rgba(239,68,68,0.1)',  color: '#ef4444', dot: '#ef4444' },
  };

  const counts = {
    all:     monthShoots.length,
    pending: monthShoots.filter(s => s._status === 'pending').length,
    done:    monthShoots.filter(s => s._status === 'done').length,
    overdue: monthShoots.filter(s => s._status === 'overdue').length,
  };

  // Show loading spinner while fetching
  if (loading) return (
    <div className="rounded-2xl flex items-center justify-center py-12"
      style={{ background: 'var(--fd-card-bg)', border: '1px solid var(--fd-border)' }}>
      <Spinner />
    </div>
  );

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: 'var(--fd-card-bg)',
        border: '1px solid var(--fd-border)',
        boxShadow: '0 2px 16px rgba(0,0,0,0.05)',
      }}
    >
      {/* Header */}
      <div className="px-5 pt-5 pb-4" style={{ borderBottom: '1px solid var(--fd-border)' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(236,72,153,0.12)', border: '1px solid rgba(236,72,153,0.2)' }}
            >
              <Camera size={16} style={{ color: '#ec4899' }} />
            </div>
            <div>
              <h3 className="text-[14px] font-bold tracking-[-0.01em]" style={{ color: 'var(--fd-ink-1)' }}>
                Shoot Schedule
              </h3>
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--fd-ink-4)' }}>
                {fmtDate(month, 'MMMM yyyy')} · {counts.all} shoot{counts.all !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          {/* Month nav */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setMonth(m => subMonths(m, 1))}
              className="p-1.5 rounded-lg transition-colors hover:bg-[var(--fd-surface-sunken)]"
              style={{ color: 'var(--fd-ink-3)' }}
            >
              <ChevronLeft size={14} />
            </button>
            <button
              onClick={() => setMonth(new Date())}
              className="px-2 py-0.5 rounded-md text-[10.5px] font-semibold transition-colors hover:bg-[var(--fd-surface-sunken)]"
              style={{ color: 'var(--fd-ink-4)' }}
            >
              Today
            </button>
            <button
              onClick={() => setMonth(m => addMonths(m, 1))}
              className="p-1.5 rounded-lg transition-colors hover:bg-[var(--fd-surface-sunken)]"
              style={{ color: 'var(--fd-ink-3)' }}
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>

        {/* Status filter pills */}
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          {[['all', 'All', null], ['pending', 'Pending', '#f59e0b'], ['done', 'Done', '#22c55e'], ['overdue', 'Overdue', '#ef4444']].map(([val, lbl, clr]) => (
            <button
              key={val}
              onClick={() => setFilter(val)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all"
              style={
                filter === val
                  ? { background: clr ? clr + '22' : 'var(--fd-sidebar-active)', color: clr || 'var(--fd-sidebar-link-active)', border: `1.5px solid ${clr || 'var(--fd-accent, #4f6ef0)'}` }
                  : { background: 'var(--fd-surface-sunken)', color: 'var(--fd-ink-3)', border: '1.5px solid transparent' }
              }
            >
              {clr && <span className="w-1.5 h-1.5 rounded-full" style={{ background: clr }} />}
              {lbl}
              <span className="opacity-60">({counts[val]})</span>
            </button>
          ))}
          <Link
            to="/admin/calendar"
            className="ml-auto flex items-center gap-1 text-[11.5px] font-semibold px-3 py-1.5 rounded-lg transition-all hover:opacity-80"
            style={{ background: 'var(--fd-sidebar-active)', color: 'var(--fd-sidebar-link-active)' }}
          >
            Full Calendar <ArrowUpRight size={11} />
          </Link>
        </div>
      </div>

      {/* Two-column layout: mini calendar + list */}
      <div className="flex flex-col lg:flex-row">
        {/* ── Mini Calendar ── */}
        <div className="p-4 lg:w-[340px] flex-shrink-0" style={{ borderRight: '1px solid var(--fd-border)' }}>
          {/* Day labels */}
          <div className="grid grid-cols-7 mb-1">
            {['M','T','W','T','F','S','S'].map((d, i) => (
              <div key={i} className="text-center py-1 text-[9.5px] font-bold uppercase tracking-wider"
                style={{ color: i >= 5 ? 'var(--fd-ink-5)' : 'var(--fd-ink-4)' }}>{d}</div>
            ))}
          </div>
          {/* Day cells */}
          <div className="grid grid-cols-7 gap-[2px]">
            {days.map((day, idx) => {
              const dayShts = shootsOnDay(day);
              const inMo = isSameMonth(day, month);
              const todayDay = isToday(day);
              const hasOverdue = dayShts.some(s => s._status === 'overdue');
              const hasDone    = dayShts.some(s => s._status === 'done');
              const hasPending = dayShts.some(s => s._status === 'pending');
              const dotColor = hasOverdue ? '#ef4444' : hasPending ? '#ec4899' : hasDone ? '#22c55e' : null;

              return (
                <div
                  key={idx}
                  className="relative flex flex-col items-center justify-start pt-1 pb-1 rounded-lg transition-colors"
                  style={{
                    minHeight: 36,
                    background: todayDay ? 'rgba(236,72,153,0.08)' : 'transparent',
                    border: todayDay ? '1px solid rgba(236,72,153,0.25)' : '1px solid transparent',
                    opacity: inMo ? 1 : 0.3,
                  }}
                >
                  <span
                    className="text-[11px] font-semibold w-5 h-5 rounded-full flex items-center justify-center"
                    style={{
                      background: todayDay ? '#ec4899' : 'transparent',
                      color: todayDay ? '#fff' : 'var(--fd-ink-2)',
                    }}
                  >
                    {fmtDate(day, 'd')}
                  </span>
                  {dotColor && dayShts.length > 0 && (
                    <div className="flex gap-[2px] mt-[2px] flex-wrap justify-center">
                      {dayShts.slice(0, 3).map((s, si) => {
                        const sc = statusConfig[s._status];
                        return (
                          <Link
                            key={si}
                            to={s.client ? `/admin/clients/${typeof s.client === 'object' ? s.client._id : s.client}?tab=calendar` : '/admin/calendar'}
                            title={`${s.title}${s.client?.company ? ` · ${s.client.company}` : ''}`}
                            onClick={e => e.stopPropagation()}
                            className="w-1.5 h-1.5 rounded-full block hover:scale-150 transition-transform"
                            style={{ background: sc.dot }}
                          />
                        );
                      })}
                      {dayShts.length > 3 && (
                        <span className="text-[8px] font-bold" style={{ color: 'var(--fd-ink-5)' }}>+{dayShts.length - 3}</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-3 mt-3 pt-3" style={{ borderTop: '1px solid var(--fd-border)' }}>
            {Object.entries(statusConfig).map(([k, v]) => (
              <div key={k} className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ background: v.dot }} />
                <span className="text-[10.5px]" style={{ color: 'var(--fd-ink-4)' }}>{v.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Shoot List ── */}
        <div className="flex-1 overflow-hidden">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-10 gap-2">
              <Camera size={22} style={{ color: 'var(--fd-ink-5)' }} />
              <p className="text-[13px] font-medium" style={{ color: 'var(--fd-ink-3)' }}>
                No {filter !== 'all' ? filter : ''} shoots in {fmtDate(month, 'MMMM')}
              </p>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: 'var(--fd-border)' }}>
              {filtered
                .sort((a, b) => a._start - b._start)
                .map(shoot => {
                  const sc = statusConfig[shoot._status];
                  const meta = SHOOT_TYPE_META[shoot.shootSubtype] || SHOOT_TYPE_META.other_shoot;
                  const clientId = shoot.client
                    ? (typeof shoot.client === 'object' ? shoot.client._id : shoot.client)
                    : null;
                  const clientName = shoot.client?.company || shoot.client?.name || null;

                  return (
                    <Link
                      key={shoot._id}
                      to={clientId ? `/admin/clients/${clientId}?tab=calendar` : '/admin/calendar'}
                      className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--fd-table-row-hover)] group"
                    >
                      {/* Icon bubble */}
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center text-[16px] flex-shrink-0"
                        style={{ background: meta.color + '15', border: `1px solid ${meta.color}30` }}
                      >
                        {meta.icon}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[12.5px] font-semibold truncate" style={{ color: 'var(--fd-ink-1)' }}>
                            {shoot.title}
                          </span>
                          <span
                            className="text-[10px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-1"
                            style={{ background: sc.bg, color: sc.color }}
                          >
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: sc.dot }} />
                            {sc.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap" style={{ color: 'var(--fd-ink-4)', fontSize: 11 }}>
                          <span>{fmtDate(shoot._start, 'EEE, MMM d · h:mm a')}</span>
                          {clientName && (
                            <>
                              <span>·</span>
                              <span className="font-medium" style={{ color: 'var(--fd-ink-3)' }}>{clientName}</span>
                            </>
                          )}
                          {meta.label && (
                            <>
                              <span>·</span>
                              <span style={{ color: meta.color }}>{meta.label}</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Arrow */}
                      <ChevronRight
                        size={13}
                        className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ color: 'var(--fd-ink-4)' }}
                      />
                    </Link>
                  );
                })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Internal Leads Follow-Up Widget ──────────────────────────────────────────
function FollowUpsWidget() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/internal-leads/follow-ups-today')
      .then(r => setLeads(r.data.leads || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return null;
  if (!leads.length) return null;

  const now = new Date();
  const overdue = leads.filter(l => {
    const d = new Date(l.followUpDate);
    return d < now && d.toDateString() !== now.toDateString();
  });
  const todayLeads = leads.filter(l => {
    const d = new Date(l.followUpDate);
    return d.toDateString() === now.toDateString();
  });

  const avatarColors = [
    '#4f6ef0','#a855f7','#f97316','#22c55e','#ec4899','#06b6d4',
  ];
  const getAvatarColor = (name = '') => {
    const idx = (name.charCodeAt(0) || 0) % avatarColors.length;
    return avatarColors[idx];
  };

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: 'var(--fd-card-bg)',
        border: '1px solid var(--fd-border)',
        boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
      }}
    >
      {/* ── Header strip ── */}
      <div
        className="px-5 pt-4 pb-0"
        style={{ borderBottom: '1px solid var(--fd-border)' }}
      >
        <div className="flex items-center justify-between pb-4">
          {/* Left: icon + title + badge */}
          <div className="flex items-center gap-3">
            {/* Animated bell icon container */}
            <div
              className="relative w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.2)' }}
            >
              <Bell size={15} style={{ color: '#f59e0b' }} />
              {/* Pulse ring */}
              {leads.length > 0 && (
                <span
                  className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black text-white"
                  style={{ background: '#ef4444', lineHeight: 1 }}
                >
                  {leads.length}
                </span>
              )}
            </div>
            <div>
              <h3 className="text-[14px] font-bold tracking-[-0.01em]" style={{ color: 'var(--fd-ink-1)' }}>
                Follow-up Reminders
              </h3>
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--fd-ink-4)' }}>
                {overdue.length > 0
                  ? `${overdue.length} overdue · ${todayLeads.length} due today`
                  : `${todayLeads.length} due today`}
              </p>
            </div>
          </div>

          {/* Right: pill stats + link */}
          <div className="flex items-center gap-2">
            {overdue.length > 0 && (
              <span
                className="text-[10.5px] font-semibold px-2.5 py-1 rounded-full"
                style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}
              >
                {overdue.length} overdue
              </span>
            )}
            <Link
              to="/admin/internal-leads?followUpToday=true"
              className="flex items-center gap-1 text-[11.5px] font-semibold px-3 py-1.5 rounded-lg transition-all hover:opacity-80"
              style={{ background: 'var(--fd-sidebar-active)', color: 'var(--fd-sidebar-link-active)' }}
            >
              View all <ArrowUpRight size={11} />
            </Link>
          </div>
        </div>
      </div>

      {/* ── Lead cards grid ── */}
      <div className="p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {leads.slice(0, 6).map((lead, idx) => {
          const d = new Date(lead.followUpDate);
          const isOver = d < now && d.toDateString() !== now.toDateString();
          const quality = QUALITY_CONFIG[lead.quality] || QUALITY_CONFIG.warm;
          const stage = STAGE_CONFIG[lead.stage] || { label: lead.stage, color: '#6b7280' };
          const avatarBg = getAvatarColor(lead.name || lead.company);
          const initials = (lead.name || lead.company || '?').slice(0, 2).toUpperCase();

          return (
            <Link
              to={`/admin/internal-leads?lead=${lead._id}`}
              key={lead._id}
              className="group relative flex flex-col gap-2.5 p-3.5 rounded-xl transition-all duration-200"
              style={{
                background: isOver
                  ? 'rgba(239,68,68,0.04)'
                  : 'var(--fd-surface-sunken)',
                border: `1px solid ${isOver ? 'rgba(239,68,68,0.2)' : 'var(--fd-border)'}`,
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)';
                e.currentTarget.style.borderColor = isOver ? 'rgba(239,68,68,0.4)' : 'var(--fd-border-strong)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = '';
                e.currentTarget.style.boxShadow = '';
                e.currentTarget.style.borderColor = isOver ? 'rgba(239,68,68,0.2)' : 'var(--fd-border)';
              }}
            >
              {/* Top row: avatar + name + quality badge */}
              <div className="flex items-start gap-2.5">
                {/* Avatar */}
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-black text-[11px] flex-shrink-0"
                  style={{ background: avatarBg, letterSpacing: '0.03em' }}
                >
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[12.5px] font-semibold leading-tight truncate" style={{ color: 'var(--fd-ink-1)' }}>
                    {lead.name || 'Unknown'}
                  </div>
                  {lead.company && (
                    <div className="text-[11px] truncate mt-0.5" style={{ color: 'var(--fd-ink-4)' }}>
                      {lead.company}
                    </div>
                  )}
                </div>
                {/* Quality dot badge */}
                <div
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded-md flex-shrink-0"
                  style={{ background: quality.bg }}
                >
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: quality.dot }} />
                  <span className="text-[9.5px] font-bold uppercase tracking-wide" style={{ color: quality.color }}>
                    {quality.label}
                  </span>
                </div>
              </div>

              {/* Follow-up note */}
              {lead.followUpNote && (
                <p
                  className="text-[11.5px] leading-relaxed line-clamp-2"
                  style={{ color: 'var(--fd-ink-3)' }}
                >
                  {lead.followUpNote}
                </p>
              )}

              {/* Bottom row: stage + date + phone */}
              <div className="flex items-center gap-2 mt-auto pt-1" style={{ borderTop: '1px solid var(--fd-border)' }}>
                {/* Stage pill */}
                <div
                  className="flex items-center gap-1 px-2 py-0.5 rounded-md"
                  style={{ background: stage.color + '14' }}
                >
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: stage.color }} />
                  <span className="text-[10px] font-semibold" style={{ color: stage.color }}>
                    {stage.label}
                  </span>
                </div>

                {/* Spacer */}
                <div className="flex-1" />

                {/* Date / overdue */}
                <div className="flex items-center gap-1.5">
                  {isOver ? (
                    <span
                      className="text-[10.5px] font-bold px-2 py-0.5 rounded-md"
                      style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}
                    >
                      ⚠ Overdue
                    </span>
                  ) : (
                    <span className="text-[10.5px] font-semibold" style={{ color: '#f59e0b' }}>
                      {formatDate(lead.followUpDate)}
                    </span>
                  )}

                  {/* Phone quick-action */}
                  {lead.phone && (
                    <a
                      href={`tel:${lead.phone}`}
                      onClick={e => e.preventDefault()}
                      className="w-6 h-6 rounded-lg flex items-center justify-center transition-all hover:scale-110"
                      style={{ background: 'var(--fd-card-bg)', border: '1px solid var(--fd-border)' }}
                      title={lead.phone}
                    >
                      <Phone size={10} style={{ color: 'var(--fd-ink-3)' }} />
                    </a>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* ── Footer: budget total teaser ── */}
      {leads.length > 0 && (
        <div
          className="px-5 py-3 flex items-center justify-between"
          style={{ borderTop: '1px solid var(--fd-border)', background: 'var(--fd-surface-sunken)' }}
        >
          <span className="text-[11.5px]" style={{ color: 'var(--fd-ink-4)' }}>
            {leads.length} lead{leads.length > 1 ? 's' : ''} need attention today
          </span>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px]" style={{ color: 'var(--fd-ink-5)' }}>Combined deal value</span>
            <span className="text-[12.5px] font-bold" style={{ color: 'var(--fd-ink-1)' }}>
              ₹{leads.reduce((sum, l) => sum + (l.dealValue || 0), 0).toLocaleString('en-IN')}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const { user } = useAuthStore();
  const isManagerOrAdmin = ['admin', 'manager'].includes(user?.role);
  const showFollowUps    = ['admin', 'performance_marketer'].includes(user?.role);
  const isPM             = user?.role === 'performance_marketer';

  // Performance marketer gets their own focused dashboard
  if (isPM) return <PerformanceMarketerDashboard />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold tracking-[-0.02em] leading-none mb-1.5" style={{ color: 'var(--fd-ink-1)' }}>
            {ROLE_HERO[user?.role]?.greeting || 'Dashboard'}
          </h1>
          <div className="flex items-center gap-2 text-[13px]" style={{ color: 'var(--fd-ink-4)' }}>
            <span>{ROLE_LABELS[user?.role]}</span>
            <span>·</span>
            <span style={{ color: 'var(--fd-ink-3)' }}>{user?.name}</span>
          </div>
        </div>
        {isManagerOrAdmin && (
          <Link to="/admin/tasks" className="btn-primary hidden sm:inline-flex">
            <Plus size={14} />
            New Task
          </Link>
        )}
      </div>

{/* Follow-up reminders: admin + performance_marketer */}
{showFollowUps && <FollowUpsWidget />}

{/* Shoot schedule: admin & manager only (shoots-specific view) */}
{isManagerOrAdmin && <ShootScheduleWidget />}

{isManagerOrAdmin ? <ManagerDashboard /> : <TeamMemberDashboard user={user} />}
    </div>
  );
}