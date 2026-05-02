import React, { useEffect, useState, useCallback } from 'react';
import { ListChecks, Clock, CheckCircle, AlertCircle, Play } from 'lucide-react';
import api from '../../lib/api';
import useAuthStore from '../../context/authStore';
import { PageHeader, EmptyState, Card, Spinner, Badge, StatCard } from '../../components/shared/LoadingScreen';
import { Button, Select } from '../../components/ui/index';
import { formatDate, getTaskStatusColor, getPriorityColor, timeAgo } from '../../lib/utils';

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

const ROLE_WELCOME = {
  performance_marketer: { greeting: 'Your Campaigns', icon: '📊', tip: 'Focus on tasks with deadlines approaching — check your paid ads tasks first.' },
  social_media_manager: { greeting: 'Your Content Queue', icon: '📱', tip: 'Don\'t forget to check upcoming content deadlines and client calendar tasks.' },
  video_editor: { greeting: 'Your Edit Queue', icon: '🎬', tip: 'Urgent edits are highlighted. Check the Files section for raw footage.' },
  graphic_designer: { greeting: 'Your Design Queue', icon: '🎨', tip: 'Check the brief in each task description before starting. Ask PM if anything is unclear.' },
  copywriter: { greeting: 'Your Writing Queue', icon: '✍️', tip: 'Reference the client\'s brand voice in the Files section for any copy tasks.' },
};

export default function MyTasksPage() {
  const { user } = useAuthStore();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [updating, setUpdating] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: 100 });
      if (statusFilter) params.set('status', statusFilter);
      const { data } = await api.get(`/tasks?${params}`);
      // team_member endpoint already filters by assignedTo on backend
      setTasks(data.tasks || []);
    } finally { setLoading(false); }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const updateStatus = async (id, status) => {
    setUpdating(id);
    try {
      await api.put(`/tasks/${id}`, { status });
      setTasks(prev => prev.map(t => t._id === id ? { ...t, status } : t));
    } finally { setUpdating(null); }
  };

  const welcome = ROLE_WELCOME[user?.role] || { greeting: 'Your Tasks', icon: '📋', tip: '' };

  const pending = tasks.filter(t => t.status === 'pending').length;
  const inProgress = tasks.filter(t => t.status === 'in_progress').length;
  const review = tasks.filter(t => t.status === 'review').length;
  const completed = tasks.filter(t => t.status === 'completed').length;

  const statuses = ['pending', 'in_progress', 'review', 'completed', 'cancelled'];

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-slate-800">
          {welcome.icon} {welcome.greeting}
        </h1>
        <p className="text-slate-500 text-sm mt-0.5">{welcome.tip}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="To Do" value={pending} icon={AlertCircle} color="orange" subtitle="Pending" />
        <StatCard title="In Progress" value={inProgress} icon={Play} color="blue" subtitle="Active" />
        <StatCard title="In Review" value={review} icon={Clock} color="purple" subtitle="Awaiting approval" />
        <StatCard title="Completed" value={completed} icon={CheckCircle} color="green" subtitle="Done" />
      </div>

      {/* Filter */}
      <div className="flex gap-3">
        <Select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="w-44">
          <option value="">All Statuses</option>
          {statuses.map(s => <option key={s} value={s}>{s.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>)}
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : tasks.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title="No tasks assigned"
          description="Your project manager will assign tasks to you here. Check back soon!"
        />
      ) : (
        <div className="space-y-3">
          {tasks.map(task => {
            const isOverdue = task.deadline && new Date(task.deadline) < new Date() && task.status !== 'completed';
            return (
              <Card key={task._id} className={`p-5 transition-all hover:shadow-md ${isOverdue ? 'border-red-200' : ''}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-semibold text-slate-900">{task.title}</span>
                      {task.isClientRequest && (
                        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Client Request</span>
                      )}
                      {isOverdue && (
                        <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">⚠ Overdue</span>
                      )}
                    </div>
                    <p className="text-sm text-slate-500 line-clamp-2 mb-3">{task.description || 'No description provided.'}</p>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                      <span className="font-medium text-slate-700">{task.client?.company}</span>
                      <span>{CATEGORY_LABELS[task.category] || task.category}</span>
                      <span className={`px-2 py-0.5 rounded-full font-medium ${getPriorityColor(task.priority)}`}>{task.priority}</span>
                      {task.deadline && (
                        <span className={`flex items-center gap-1 ${isOverdue ? 'text-red-500 font-semibold' : ''}`}>
                          <Clock size={11} /> Due {formatDate(task.deadline)}
                        </span>
                      )}
                      <span className="text-slate-400">{timeAgo(task.createdAt)}</span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getTaskStatusColor(task.status)}`}>
                      {task.status.replace('_', ' ')}
                    </span>
                    {/* Status update buttons */}
                    <div className="flex gap-1.5">
                      {task.status === 'pending' && (
                        <Button size="xs" onClick={() => updateStatus(task._id, 'in_progress')} loading={updating === task._id}>
                          Start
                        </Button>
                      )}
                      {task.status === 'in_progress' && (
                        <Button size="xs" variant="secondary" onClick={() => updateStatus(task._id, 'review')} loading={updating === task._id}>
                          Send for Review
                        </Button>
                      )}
                      {task.status === 'review' && (
                        <span className="text-xs text-slate-400 italic">Awaiting PM review</span>
                      )}
                      {task.status === 'completed' && (
                        <span className="text-xs text-emerald-600 font-medium">✓ Done</span>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
