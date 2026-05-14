import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2, CheckSquare, Clock, Users, Target,
  TrendingUp, AlertCircle, Play, ChevronRight, Plus,
  Rss, BarChart3, ListChecks,
} from 'lucide-react';
import api from '../../lib/api';
import useAuthStore from '../../context/authStore';
import {
  StatCard, Avatar, Card, CardHeader, CardContent, Spinner, EmptyState
} from '../../components/shared/LoadingScreen';
import { Button } from '../../components/ui/index';
import { formatDate, timeAgo } from '../../lib/utils';

const ROLE_LABELS = {
  admin: 'Admin', manager: 'Project Manager',
  performance_marketer: 'Performance Marketer',
  social_media_manager: 'Social Media Manager',
  video_editor: 'Video Editor', graphic_designer: 'Graphic Designer', copywriter: 'Copywriter',
};

const CATEGORY_LABELS = {
  paid_ads: 'Paid Ads', social_media: 'Social Media', video_editing: 'Video Editing',
  graphic_design: 'Graphic Design', copywriting: 'Copywriting', reporting: 'Reporting',
  strategy: 'Strategy', client_request: 'Client Request', other: 'Other',
};

const ROLE_HERO = {
  performance_marketer: { greeting: 'Campaign Overview',   emoji: '📊', tip: 'Check active paid ads tasks — optimise for ROAS early.' },
  social_media_manager: { greeting: 'Content Hub',         emoji: '📱', tip: 'Review upcoming deadlines and your content calendar.' },
  video_editor:         { greeting: 'Edit Queue',           emoji: '🎬', tip: 'Urgent edits are at the top. Check Files for raw footage.' },
  graphic_designer:     { greeting: 'Design Studio',        emoji: '🎨', tip: 'Check task descriptions for briefs before starting.' },
  copywriter:           { greeting: 'Writing Desk',         emoji: '✍️',  tip: 'See Files for brand voice guides per client.' },
  manager:              { greeting: 'Operations Overview',  emoji: '🗂️', tip: 'Assign pending tasks and review anything in Review.' },
  admin:                { greeting: 'Agency Dashboard',     emoji: '🏢', tip: 'Full agency health at a glance.' },
};

const PRIORITY_STYLES = {
  low:    { background: 'var(--fd-surface-sunken)', color: 'var(--fd-ink-3)' },
  medium: { background: 'var(--fd-sidebar-active)', color: 'var(--fd-sidebar-link-active)' },
  high:   { background: 'rgba(146,96,10,0.15)', color: '#f59e0b' },
  urgent: { background: 'rgba(185,28,28,0.15)', color: '#ef4444' },
};

const STATUS_STYLES = {
  pending:     { background: 'var(--fd-surface-sunken)', color: 'var(--fd-ink-3)' },
  in_progress: { background: 'var(--fd-sidebar-active)', color: 'var(--fd-sidebar-link-active)' },
  review:      { background: 'rgba(126,34,206,0.15)', color: '#a855f7' },
  completed:   { background: 'rgba(42,125,79,0.15)', color: '#22c55e' },
  cancelled:   { background: 'rgba(185,28,28,0.15)', color: '#ef4444' },
};

function TaskRow({ task, onStatusChange, updating }) {
  const isOverdue = task.deadline && new Date(task.deadline) < new Date() && task.status !== 'completed';
  const pStyle = PRIORITY_STYLES[task.priority] || PRIORITY_STYLES.low;

  return (
    <div
      className="flex items-center gap-4 px-5 py-3.5 border-b transition-colors last:border-0 hover:bg-[var(--fd-table-row-hover)]"
      style={{
        borderColor: 'var(--fd-table-row-border)',
        background: isOverdue ? 'rgba(185,28,28,0.04)' : 'transparent',
      }}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[13px] font-medium truncate" style={{ color: 'var(--fd-ink-1)' }}>
            {task.title}
          </span>
          {isOverdue && (
            <span
              className="text-[10px] font-semibold px-1.5 py-0.5 rounded flex-shrink-0"
              style={{ background: 'rgba(185,28,28,0.15)', color: '#ef4444' }}
            >
              Overdue
            </span>
          )}
        </div>
        <div className="text-[11.5px] mt-0.5 flex items-center gap-1.5 flex-wrap" style={{ color: 'var(--fd-ink-4)' }}>
          <span className="font-medium" style={{ color: 'var(--fd-ink-3)' }}>{task.client?.company}</span>
          <span>·</span>
          <span>{CATEGORY_LABELS[task.category] || task.category}</span>
          {task.deadline && (
            <>
              <span>·</span>
              <span style={isOverdue ? { color: '#ef4444', fontWeight: 500 } : {}}>
                Due {formatDate(task.deadline)}
              </span>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {task.assignedTo ? (
          <div className="flex items-center gap-1.5">
            <Avatar name={task.assignedTo.name} size="xs" />
            <span className="text-[11.5px] hidden sm:block" style={{ color: 'var(--fd-ink-3)' }}>
              {task.assignedTo.name?.split(' ')[0]}
            </span>
          </div>
        ) : (
          <span className="text-[11.5px] font-medium" style={{ color: '#ef4444' }}>Unassigned</span>
        )}

        <span
          className="text-[10.5px] font-medium px-2 py-0.5 rounded-full"
          style={pStyle}
        >
          {task.priority}
        </span>

        {onStatusChange && task.status === 'pending' && (
          <button
            onClick={() => onStatusChange(task._id, 'in_progress')}
            disabled={updating === task._id}
            className="btn-primary text-[11px] px-2.5 py-1.5"
          >
            Start
          </button>
        )}
        {onStatusChange && task.status === 'in_progress' && (
          <button
            onClick={() => onStatusChange(task._id, 'review')}
            disabled={updating === task._id}
            className="text-[11px] px-2.5 py-1.5 rounded-lg font-medium transition-all"
            style={{
              background: 'rgba(126,34,206,0.15)', color: '#a855f7',
              border: '1px solid rgba(126,34,206,0.25)',
            }}
          >
            Submit
          </button>
        )}
      </div>
    </div>
  );
}

function SectionHeading({ title, count, linkTo, linkLabel = 'View all' }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="text-[13.5px] font-semibold" style={{ color: 'var(--fd-ink-1)' }}>{title}</span>
        {count !== undefined && count > 0 && (
          <span
            className="text-[10.5px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center"
            style={{ background: 'var(--fd-sidebar-active)', color: 'var(--fd-sidebar-link-active)' }}
          >
            {count}
          </span>
        )}
      </div>
      {linkTo && (
        <Link
          to={linkTo}
          className="flex items-center gap-1 text-[12px] font-medium transition-colors"
          style={{ color: 'var(--fd-sidebar-link-active)' }}
        >
          {linkLabel} <ChevronRight size={12} />
        </Link>
      )}
    </div>
  );
}

// ── Manager / Admin Dashboard ─────────────────────────────────────────────────
function ManagerDashboard() {
  const [stats, setStats] = useState(null);
  const [tasks, setTasks] = useState([]);
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
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard title="Active Clients" value={stats?.activeClients ?? 0} icon={Building2} color="blue" />
        <StatCard title="Open Tasks" value={stats?.openTasks ?? 0} icon={CheckSquare} color="orange" subtitle="Pending + In Progress" />
        <StatCard title="In Review" value={stats?.reviewTasks ?? 0} icon={Clock} color="purple" subtitle="Awaiting approval" />
        <StatCard title="Team Members" value={stats?.teamCount ?? 0} icon={Users} color="green" />
      </div>

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
                      <div className="text-[12.5px] font-medium truncate" style={{ color: 'var(--fd-ink-1)' }}>
                        {client.company}
                      </div>
                      <div className="text-[11px] truncate" style={{ color: 'var(--fd-ink-4)' }}>
                        {client.industry}
                      </div>
                    </div>
                    <ChevronRight size={13} style={{ color: 'var(--fd-ink-5)' }} />
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ── Team Member Dashboard ─────────────────────────────────────────────────────
function TeamMemberDashboard({ user }) {
  const [tasks, setTasks] = useState([]);
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

  const hero = ROLE_HERO[user?.role] || ROLE_HERO.manager;
  const pending = tasks.filter(t => t.status === 'pending');
  const inProgress = tasks.filter(t => t.status === 'in_progress');
  const review = tasks.filter(t => t.status === 'review');
  const completed = tasks.filter(t => t.status === 'completed');
  const active = [...inProgress, ...pending];

  if (loading) return <div className="flex items-center justify-center h-60"><Spinner size="lg" /></div>;

  return (
    <div className="space-y-6">
      {/* Role banner */}
      <div
        className="relative rounded-2xl px-6 py-5 overflow-hidden fd-card"
      >
        {/* Faint watermark */}
        <div
          className="absolute right-6 top-1/2 -translate-y-1/2 text-[72px] opacity-[0.05] pointer-events-none select-none"
          aria-hidden
        >
          {hero.emoji}
        </div>
        <div className="relative z-10">
          <div className="text-[22px] mb-1" aria-hidden>{hero.emoji}</div>
          <h2 className="text-[17px] font-bold tracking-[-0.01em]" style={{ color: 'var(--fd-ink-1)' }}>
            {hero.greeting}
          </h2>
          <p className="text-[13px] mt-1 max-w-md" style={{ color: 'var(--fd-ink-3)' }}>{hero.tip}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard title="To Do" value={pending.length} icon={AlertCircle} color="orange" />
        <StatCard title="In Progress" value={inProgress.length} icon={Play} color="blue" />
        <StatCard title="In Review" value={review.length} icon={Clock} color="purple" />
        <StatCard title="Completed" value={completed.length} icon={CheckSquare} color="green" />
      </div>

      {/* Active tasks */}
      <Card>
        <CardHeader>
          <SectionHeading title="Your Active Tasks" count={active.length} linkTo="/admin/my-tasks" />
        </CardHeader>
        <CardContent className="p-0">
          {active.length === 0 ? (
            <EmptyState
              icon={CheckSquare}
              title="All caught up"
              description="No active tasks assigned to you right now."
            />
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

// ── Root export ───────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const { user } = useAuthStore();
  const isManagerOrAdmin = ['admin', 'manager'].includes(user?.role);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1
            className="text-[22px] font-bold tracking-[-0.02em] leading-none mb-1.5"
            style={{ color: 'var(--fd-ink-1)' }}
          >
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

      {isManagerOrAdmin
        ? <ManagerDashboard />
        : <TeamMemberDashboard user={user} />
      }
    </div>
  );
}