import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, CheckSquare, BarChart3, MessageSquare, Target,
  TrendingUp, Clock, AlertCircle, ArrowRight, Plus,
  Play, Building2, ListChecks, Zap
} from 'lucide-react';
import api from '../../lib/api';
import useAuthStore from '../../context/authStore';
import { Card, CardHeader, CardContent, StatCard, Avatar, Spinner } from '../../components/shared/LoadingScreen';
import { Button } from '../../components/ui/index';
import { formatDate, getTaskStatusColor, getPriorityColor, timeAgo } from '../../lib/utils';

const ROLE_LABELS = {
  admin: 'Admin',
  manager: 'Project Manager',
  performance_marketer: 'Performance Marketer',
  social_media_manager: 'Social Media Manager',
  video_editor: 'Video Editor',
  graphic_designer: 'Graphic Designer',
  copywriter: 'Copywriter',
};

const CATEGORY_LABELS = {
  paid_ads: '📊 Paid Ads',
  social_media: '📱 Social Media',
  video_editing: '🎬 Video Editing',
  graphic_design: '🎨 Graphic Design',
  copywriting: '✍️ Copywriting',
  reporting: '📋 Reporting',
  strategy: '🧠 Strategy',
  client_request: '💬 Client Request',
  other: '📌 Other',
};

const ROLE_HERO = {
  performance_marketer: {
    greeting: 'Campaign Dashboard',
    icon: '📊',
    color: 'from-orange-500 to-red-500',
    tip: 'Check your active paid ads tasks — optimise early for better ROAS.',
  },
  social_media_manager: {
    greeting: 'Content Command Centre',
    icon: '📱',
    color: 'from-pink-500 to-purple-500',
    tip: 'Review upcoming posting deadlines and content calendar tasks.',
  },
  video_editor: {
    greeting: 'Edit Queue',
    icon: '🎬',
    color: 'from-blue-500 to-cyan-500',
    tip: 'Urgent edits are at the top. Check Files for raw footage.',
  },
  graphic_designer: {
    greeting: 'Design Studio',
    icon: '🎨',
    color: 'from-purple-500 to-indigo-500',
    tip: 'Check task descriptions for briefs before starting any designs.',
  },
  copywriter: {
    greeting: 'Writing Desk',
    icon: '✍️',
    color: 'from-emerald-500 to-teal-500',
    tip: 'Check the Files section for brand voice guides per client.',
  },
  manager: {
    greeting: 'Operations Hub',
    icon: '🗂️',
    color: 'from-brand-500 to-blue-600',
    tip: 'Assign pending tasks and review anything in Review status.',
  },
  admin: {
    greeting: 'Agency Overview',
    icon: '🏢',
    color: 'from-slate-700 to-slate-900',
    tip: 'Full agency health at a glance.',
  },
};

function ManagerDashboard({ user }) {
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

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>;

  return (
    <div className="space-y-5">
      {/* Stats — 2 cols on mobile, 4 on lg */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard title="Active Clients" value={stats?.activeClients || 0} icon={Building2} color="blue" />
        <StatCard title="Open Tasks" value={stats?.openTasks || 0} icon={CheckSquare} color="orange" subtitle="Pending + In Progress" />
        <StatCard title="In Review" value={stats?.reviewTasks || 0} icon={Clock} color="purple" subtitle="Awaiting approval" />
        <StatCard title="Team Members" value={stats?.teamCount || 0} icon={Users} color="green" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Pending Tasks */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-slate-800 text-sm">Pending Tasks</h3>
                <Link to="/admin/tasks" className="text-brand-600 text-xs font-medium hover:underline flex items-center gap-1">
                  All tasks <ArrowRight size={12} />
                </Link>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {tasks.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-sm">No pending tasks 🎉</div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {tasks.map(task => (
                    <div key={task._id} className="flex items-start sm:items-center gap-3 px-4 sm:px-5 py-3.5">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-slate-800 text-sm truncate">{task.title}</div>
                        <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
                          <span>{task.client?.company}</span>
                          <span>·</span>
                          <span>{CATEGORY_LABELS[task.category]}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {task.assignedTo ? (
                          <div className="flex items-center gap-1.5">
                            <Avatar name={task.assignedTo.name} size="xs" />
                            <span className="text-xs text-slate-500 hidden sm:block">{task.assignedTo.name}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-red-500 font-medium">Unassigned</span>
                        )}
                        <span className={`text-xs px-2 py-0.5 rounded-full ${getPriorityColor(task.priority)}`}>{task.priority}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Clients */}
        <div>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-slate-800 text-sm">Active Clients</h3>
                <Link to="/admin/clients" className="text-brand-600 text-xs font-medium hover:underline flex items-center gap-1">
                  All <ArrowRight size={12} />
                </Link>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {clients.map(client => (
                <Link key={client._id} to={`/admin/clients/${client._id}`}
                  className="flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0">
                  <div className="w-8 h-8 bg-brand-100 rounded-lg flex items-center justify-center text-brand-700 text-xs font-bold flex-shrink-0">
                    {client.company?.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-slate-800 text-sm truncate">{client.company}</div>
                    <div className="text-xs text-slate-400 truncate">{client.industry}</div>
                  </div>
                  <ArrowRight size={12} className="text-slate-300 flex-shrink-0" />
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function TeamMemberDashboard({ user }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(null);

  useEffect(() => {
    api.get('/tasks?limit=20').then(r => {
      setTasks(r.data.tasks || []);
    }).finally(() => setLoading(false));
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

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>;

  return (
    <div className="space-y-5">
      {/* Hero banner */}
      <div className={`rounded-2xl bg-gradient-to-br ${hero.color} p-5 sm:p-6 text-white`}>
        <div className="text-3xl mb-1">{hero.icon}</div>
        <h2 className="text-lg sm:text-xl font-bold">{hero.greeting}</h2>
        <p className="text-white/70 text-sm mt-1">{hero.tip}</p>
      </div>

      {/* Task stats — 2 cols mobile, 4 cols lg */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard title="To Do" value={pending.length} icon={AlertCircle} color="orange" />
        <StatCard title="In Progress" value={inProgress.length} icon={Play} color="blue" />
        <StatCard title="In Review" value={review.length} icon={Clock} color="purple" />
        <StatCard title="Completed" value={completed.length} icon={CheckSquare} color="green" />
      </div>

      {/* Active tasks */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-800 text-sm">Your Active Tasks</h3>
            <Link to="/admin/my-tasks" className="text-brand-600 text-xs font-medium hover:underline flex items-center gap-1">
              All tasks <ArrowRight size={12} />
            </Link>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {[...inProgress, ...pending].length === 0 ? (
            <div className="py-10 text-center text-slate-400 text-sm">
              <CheckSquare size={28} className="mx-auto mb-2 text-slate-300" />
              No active tasks assigned yet
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {[...inProgress, ...pending].slice(0, 8).map(task => {
                const isOverdue = task.deadline && new Date(task.deadline) < new Date() && task.status !== 'completed';
                return (
                  <div key={task._id} className={`flex flex-col sm:flex-row sm:items-start gap-3 px-4 sm:px-5 py-4 ${isOverdue ? 'bg-red-50/40' : ''}`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-slate-800 text-sm">{task.title}</span>
                        {isOverdue && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">⚠ Overdue</span>}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-2 flex-wrap">
                        <span className="text-slate-600 font-medium">{task.client?.company}</span>
                        <span>·</span>
                        <span>{CATEGORY_LABELS[task.category]}</span>
                        {task.deadline && (
                          <>
                            <span>·</span>
                            <span className={isOverdue ? 'text-red-500 font-semibold' : ''}>
                              Due {formatDate(task.deadline)}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${getPriorityColor(task.priority)}`}>{task.priority}</span>
                      {task.status === 'pending' && (
                        <button
                          onClick={() => updateStatus(task._id, 'in_progress')}
                          disabled={updating === task._id}
                          className="text-xs bg-brand-600 hover:bg-brand-700 text-white px-3 py-1 rounded-lg transition-colors disabled:opacity-50"
                        >
                          Start
                        </button>
                      )}
                      {task.status === 'in_progress' && (
                        <button
                          onClick={() => updateStatus(task._id, 'review')}
                          disabled={updating === task._id}
                          className="text-xs bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap"
                        >
                          Send for Review
                        </button>
                      )}
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

export default function AdminDashboard() {
  const { user } = useAuthStore();
  const hero = ROLE_HERO[user?.role] || ROLE_HERO.admin;
  const isManagerOrAdmin = ['admin', 'manager'].includes(user?.role);

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-lg sm:text-xl font-bold text-slate-800">
          {hero.icon} {hero.greeting}
        </h1>
        <p className="text-slate-500 text-sm mt-0.5">
          {ROLE_LABELS[user?.role]} · {user?.name}
        </p>
      </div>

      {isManagerOrAdmin
        ? <ManagerDashboard user={user} />
        : <TeamMemberDashboard user={user} />
      }
    </div>
  );
}