import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2, CheckSquare, Clock, Users, Target,
  TrendingUp, AlertCircle, Play, ChevronRight, Plus,
  ArrowUpRight, Zap, BarChart2, Activity,
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
        <StatCard title="Active Clients" value={stats?.activeClients ?? 0} icon={Building2}    color="blue" />
        <StatCard title="Open Tasks"     value={stats?.openTasks    ?? 0} icon={CheckSquare}   color="orange" subtitle="Pending + In Progress" />
        <StatCard title="In Review"      value={stats?.reviewTasks  ?? 0} icon={Clock}         color="purple" subtitle="Awaiting approval" />
        <StatCard title="Team Members"   value={stats?.teamCount    ?? 0} icon={Users}         color="green" />
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
        <StatCard title="To Do"       value={pending.length}    icon={AlertCircle} color="orange" />
        <StatCard title="In Progress" value={inProgress.length} icon={Play}        color="blue" />
        <StatCard title="In Review"   value={review.length}     icon={Clock}       color="purple" />
        <StatCard title="Completed"   value={completed.length}  icon={CheckSquare} color="green" />
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

// ── Root ──────────────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const { user } = useAuthStore();
  const isManagerOrAdmin = ['admin', 'manager'].includes(user?.role);

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

      {isManagerOrAdmin ? <ManagerDashboard /> : <TeamMemberDashboard user={user} />}
    </div>
  );
}
