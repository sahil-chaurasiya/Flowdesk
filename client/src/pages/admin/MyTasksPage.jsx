import React, { useEffect, useState, useCallback } from 'react';
import {
  ListChecks, Clock, CheckCircle, AlertCircle, Play,
  X, Calendar, User, Tag, Flag, Building2, FileText, ChevronRight, ArrowRight,
} from 'lucide-react';
import api from '../../lib/api';
import useAuthStore from '../../context/authStore';
import { PageHeader, EmptyState, Card, Spinner, StatCard } from '../../components/shared/LoadingScreen';
import { Button, Select } from '../../components/ui/index';
import { formatDate, getTaskStatusColor, getPriorityColor, timeAgo } from '../../lib/utils';


// Converts URLs in text to clickable anchor elements
function linkifyText(text) {
  if (!text) return null;
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  return parts.map((part, i) =>
    urlRegex.test(part)
      ? <a key={i} href={part} target="_blank" rel="noopener noreferrer" style={{ color: '#4f6ef0', textDecoration: 'underline', wordBreak: 'break-all' }}>{part}</a>
      : part
  );
}

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
  social_media_manager: { greeting: 'Your Content Queue', icon: '📱', tip: "Don't forget to check upcoming content deadlines and client calendar tasks." },
  video_editor: { greeting: 'Your Edit Queue', icon: '🎬', tip: 'Urgent edits are highlighted. Check the Files section for raw footage.' },
  graphic_designer: { greeting: 'Your Design Queue', icon: '🎨', tip: 'Check the brief in each task description before starting. Ask PM if anything is unclear.' },
  copywriter: { greeting: 'Your Writing Queue', icon: '✍️', tip: "Reference the client's brand voice in the Files section for any copy tasks." },
};

const PRIORITY_COLORS = {
  low: '#a8a49e', medium: '#4f6ef0', high: '#f59e0b', urgent: '#ef4444',
};

const STATUS_META = {
  today:       { label: 'Today',       color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  pending:     { label: 'Pending',     color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' },
  in_progress: { label: 'In Progress', color: '#4f6ef0', bg: 'rgba(79,110,240,0.1)' },
  review:      { label: 'In Review',   color: '#a855f7', bg: 'rgba(168,85,247,0.1)' },
  completed:   { label: 'Completed',   color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
  cancelled:   { label: 'Cancelled',   color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
};

// ── Task Detail Modal ─────────────────────────────────────────────────────────
function TaskDetailModal({ task, onClose, onStatusUpdate, updating }) {
  if (!task) return null;
  const isOverdue = task.deadline && new Date(task.deadline) < new Date() && task.status !== 'completed';
  const sm = STATUS_META[task.status] || STATUS_META.pending;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[3px]"
        onClick={onClose}
      />

      {/* Modal panel */}
      <div
        className="relative w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl overflow-hidden flex flex-col animate-fade-in"
        style={{
          background: 'var(--fd-surface)',
          border: '1px solid var(--fd-border)',
          boxShadow: '0 25px 60px rgba(0,0,0,0.2)',
          maxHeight: '90vh',
        }}
      >
        {/* Top accent bar */}
        <div className="h-1 w-full flex-shrink-0" style={{ background: sm.color }} />

        {/* Header */}
        <div className="px-5 pt-4 pb-3 border-b flex-shrink-0" style={{ borderColor: 'var(--fd-border)' }}>
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <span
                  className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full"
                  style={{ background: sm.bg, color: sm.color }}
                >
                  {sm.label}
                </span>
                {isOverdue && (
                  <span className="text-[11px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">⚠ Overdue</span>
                )}
                {task.isClientRequest && (
                  <span className="text-[11px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Client Request</span>
                )}
              </div>
              <h2 className="text-[17px] font-bold leading-snug" style={{ color: 'var(--fd-ink-1)' }}>
                {task.title}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[var(--fd-surface-sunken)] transition-colors"
              style={{ color: 'var(--fd-ink-4)' }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Description */}
          {task.description ? (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <FileText size={13} style={{ color: 'var(--fd-ink-4)' }} />
                <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--fd-ink-4)' }}>
                  Description
                </span>
              </div>
              <p className="text-[13.5px] leading-relaxed" style={{ color: 'var(--fd-ink-2)' }}>
                {linkifyText(task.description)}
              </p>
            </div>
          ) : (
            <p className="text-[13px] italic" style={{ color: 'var(--fd-ink-5)' }}>No description provided.</p>
          )}

          {/* Info grid */}
          <div className="grid grid-cols-2 gap-2.5">
            {task.client?.company && (
              <InfoTile icon={Building2} label="Client" value={task.client.company} />
            )}
            {task.category && (
              <InfoTile icon={Tag} label="Category" value={CATEGORY_LABELS[task.category] || task.category} />
            )}
            <InfoTile
              icon={Flag}
              label="Priority"
              value={task.priority?.charAt(0).toUpperCase() + task.priority?.slice(1)}
              valueColor={PRIORITY_COLORS[task.priority]}
            />
            {task.deadline && (
              <InfoTile
                icon={Calendar}
                label="Deadline"
                value={formatDate(task.deadline)}
                valueColor={isOverdue ? '#ef4444' : undefined}
                accent={isOverdue}
              />
            )}
          </div>

          {/* Action zone */}
          {(task.status === 'today' || task.status === 'pending' || task.status === 'in_progress') && (
            <div
              className="rounded-xl p-4"
              style={{ background: 'var(--fd-surface-sunken)', border: '1px solid var(--fd-border)' }}
            >
              <div className="text-[12px] font-semibold mb-3" style={{ color: 'var(--fd-ink-3)' }}>
                Update Status
              </div>
              {(task.status === 'today' || task.status === 'pending') && (
                <button
                  onClick={() => onStatusUpdate(task._id, 'in_progress')}
                  disabled={updating === task._id}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-[13.5px] font-semibold transition-all hover:scale-[1.01] active:scale-[0.99]"
                  style={{
                    background: 'linear-gradient(135deg, #4f6ef0, #6366f1)',
                    color: '#fff',
                    boxShadow: '0 2px 8px rgba(79,110,240,0.35)',
                    opacity: updating === task._id ? 0.7 : 1,
                  }}
                >
                  {updating === task._id ? (
                    <Spinner size="xs" />
                  ) : (
                    <>
                      <Play size={14} /> Start Working
                    </>
                  )}
                </button>
              )}
              {task.status === 'in_progress' && (
                <button
                  onClick={() => onStatusUpdate(task._id, 'review')}
                  disabled={updating === task._id}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-[13.5px] font-semibold transition-all hover:scale-[1.01] active:scale-[0.99]"
                  style={{
                    background: 'linear-gradient(135deg, #a855f7, #9333ea)',
                    color: '#fff',
                    boxShadow: '0 2px 8px rgba(168,85,247,0.35)',
                    opacity: updating === task._id ? 0.7 : 1,
                  }}
                >
                  {updating === task._id ? (
                    <Spinner size="xs" />
                  ) : (
                    <>
                      <ArrowRight size={14} /> Send for Review
                    </>
                  )}
                </button>
              )}
            </div>
          )}

          {task.status === 'review' && (
            <div
              className="rounded-xl px-4 py-3 flex items-center gap-3"
              style={{ background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.2)' }}
            >
              <Clock size={15} style={{ color: '#a855f7', flexShrink: 0 }} />
              <div>
                <div className="text-[13px] font-semibold" style={{ color: '#a855f7' }}>Awaiting Review</div>
                <div className="text-[12px] mt-0.5" style={{ color: 'var(--fd-ink-4)' }}>Your PM will review and approve this task.</div>
              </div>
            </div>
          )}

          {task.status === 'completed' && (
            <div
              className="rounded-xl px-4 py-3 flex items-center gap-3"
              style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}
            >
              <CheckCircle size={15} style={{ color: '#22c55e', flexShrink: 0 }} />
              <div>
                <div className="text-[13px] font-semibold" style={{ color: '#22c55e' }}>Task Completed</div>
                <div className="text-[12px] mt-0.5" style={{ color: 'var(--fd-ink-4)' }}>Great work! This task has been marked as done.</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoTile({ icon: Icon, label, value, valueColor, accent }) {
  return (
    <div
      className="rounded-xl p-3"
      style={{
        background: accent ? 'rgba(239,68,68,0.05)' : 'var(--fd-surface-sunken)',
        border: `1px solid ${accent ? 'rgba(239,68,68,0.2)' : 'var(--fd-border)'}`,
      }}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <Icon size={11} style={{ color: 'var(--fd-ink-5)' }} />
        <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--fd-ink-5)' }}>{label}</span>
      </div>
      <div className="text-[12.5px] font-semibold" style={{ color: valueColor || 'var(--fd-ink-1)' }}>
        {value}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function MyTasksPage() {
  const { user } = useAuthStore();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [updating, setUpdating] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: 100 });
      if (statusFilter) params.set('status', statusFilter);
      const { data } = await api.get(`/tasks?${params}`);
      setTasks(data.tasks || []);
    } finally { setLoading(false); }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const updateStatus = async (id, status) => {
    setUpdating(id);
    try {
      await api.put(`/tasks/${id}`, { status });
      setTasks(prev => prev.map(t => t._id === id ? { ...t, status } : t));
      // Update drawer task too
      setSelectedTask(prev => prev?._id === id ? { ...prev, status } : prev);
    } finally { setUpdating(null); }
  };

  const openTaskDetail = (task) => {
    // Use fresh data from tasks state
    const fresh = tasks.find(t => t._id === task._id) || task;
    setSelectedTask(fresh);
  };

  // Keep selectedTask in sync with tasks state
  useEffect(() => {
    if (selectedTask) {
      const fresh = tasks.find(t => t._id === selectedTask._id);
      if (fresh && fresh.status !== selectedTask.status) {
        setSelectedTask(fresh);
      }
    }
  }, [tasks]);

  const welcome = ROLE_WELCOME[user?.role] || { greeting: 'Your Tasks', icon: '📋', tip: '' };

  const today     = tasks.filter(t => t.status === 'today').length;
  const pending = tasks.filter(t => t.status === 'pending').length;
  const inProgress = tasks.filter(t => t.status === 'in_progress').length;
  const review = tasks.filter(t => t.status === 'review').length;
  const completed = tasks.filter(t => t.status === 'completed').length;

  const statuses = ['today', 'pending', 'in_progress', 'review', 'completed', 'cancelled'];

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-[var(--fd-ink-1)]">
          {welcome.icon} {welcome.greeting}
        </h1>
        {welcome.tip && <p className="text-[var(--fd-ink-3)] text-sm mt-0.5 leading-relaxed">{welcome.tip}</p>}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard title="Today"       value={today}      icon={AlertCircle} color="orange" subtitle="Due today" />
        <StatCard title="In Progress" value={inProgress} icon={Play}        color="blue"   subtitle="Active" />
        <StatCard title="In Review"   value={review}     icon={Clock}       color="purple" subtitle="Awaiting approval" />
        <StatCard title="Completed"   value={completed}  icon={CheckCircle} color="green"  subtitle="Done" />
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <Select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="w-44">
          <option value="">All Statuses</option>
          {statuses.map(s => (
            <option key={s} value={s}>{STATUS_META[s]?.label || s}</option>
          ))}
        </Select>
        <span className="text-[12px]" style={{ color: 'var(--fd-ink-4)' }}>
          Click any task card to view details & update status
        </span>
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
        <div className="space-y-2.5">
          {tasks.map(task => {
            const isOverdue = task.deadline && new Date(task.deadline) < new Date() && task.status !== 'completed';
            const sm = STATUS_META[task.status] || STATUS_META.pending;
            return (
              <div
                key={task._id}
                onClick={() => openTaskDetail(task)}
                className="rounded-xl p-4 sm:p-5 transition-all hover:shadow-md hover:scale-[1.002] cursor-pointer active:scale-[0.998]"
                style={{
                  background: 'var(--fd-surface)',
                  border: `1px solid ${isOverdue ? 'rgba(239,68,68,0.3)' : 'var(--fd-border)'}`,
                  boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
                }}
              >
                {/* Title row */}
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="font-semibold text-[14px]" style={{ color: 'var(--fd-ink-1)' }}>
                        {task.title}
                      </span>
                      {task.isClientRequest && (
                        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Client Request</span>
                      )}
                      {isOverdue && (
                        <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">⚠ Overdue</span>
                      )}
                    </div>
                  </div>
                  <span
                    className="px-2.5 py-1 rounded-full text-[11px] font-semibold flex-shrink-0"
                    style={{ background: sm.bg, color: sm.color }}
                  >
                    {sm.label}
                  </span>
                </div>

                <p className="text-sm line-clamp-2 mb-3" style={{ color: 'var(--fd-ink-4)' }}>
                  {linkifyText(task.description) || 'No description provided.'}
                </p>

                {/* Meta */}
                <div className="flex flex-wrap items-center gap-2 text-xs mb-3" style={{ color: 'var(--fd-ink-4)' }}>
                  {task.client?.company && (
                    <span className="font-medium" style={{ color: 'var(--fd-ink-2)' }}>{task.client.company}</span>
                  )}
                  <span>{CATEGORY_LABELS[task.category] || task.category}</span>
                  <span
                    className="px-2 py-0.5 rounded-full font-medium capitalize"
                    style={{ background: `${PRIORITY_COLORS[task.priority]}15`, color: PRIORITY_COLORS[task.priority] }}
                  >
                    {task.priority}
                  </span>
                  {task.deadline && (
                    <span className={`flex items-center gap-1 ${isOverdue ? 'text-red-500 font-semibold' : ''}`}>
                      <Clock size={11} /> Due {formatDate(task.deadline)}
                    </span>
                  )}
                </div>

                {/* Quick action buttons — still functional inline, but also open modal */}
                <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                  {(task.status === 'today' || task.status === 'pending') && (
                    <button
                      onClick={(e) => { e.stopPropagation(); updateStatus(task._id, 'in_progress'); }}
                      disabled={updating === task._id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all hover:scale-[1.02]"
                      style={{ background: 'linear-gradient(135deg, #4f6ef0, #6366f1)', color: '#fff', opacity: updating === task._id ? 0.7 : 1 }}
                    >
                      {updating === task._id ? <Spinner size="xs" /> : <><Play size={11} /> Start</>}
                    </button>
                  )}
                  {task.status === 'in_progress' && (
                    <button
                      onClick={(e) => { e.stopPropagation(); updateStatus(task._id, 'review'); }}
                      disabled={updating === task._id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all hover:scale-[1.02]"
                      style={{ background: 'linear-gradient(135deg, #a855f7, #9333ea)', color: '#fff', opacity: updating === task._id ? 0.7 : 1 }}
                    >
                      {updating === task._id ? <Spinner size="xs" /> : <><ArrowRight size={11} /> Send for Review</>}
                    </button>
                  )}
                  {task.status === 'review' && (
                    <span className="text-xs italic flex items-center gap-1" style={{ color: '#a855f7' }}>
                      <Clock size={11} /> Awaiting PM review
                    </span>
                  )}
                  {task.status === 'completed' && (
                    <span className="text-xs font-medium flex items-center gap-1" style={{ color: '#22c55e' }}>
                      <CheckCircle size={11} /> Done
                    </span>
                  )}
                  <span className="ml-auto text-[11px] flex items-center gap-1" style={{ color: 'var(--fd-ink-5)' }}>
                    View details <ChevronRight size={11} />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Task Detail Modal */}
      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onStatusUpdate={updateStatus}
          updating={updating}
        />
      )}
    </div>
  );
}