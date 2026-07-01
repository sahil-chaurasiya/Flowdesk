import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Plus, AlertCircle, Clock, CheckCircle, Target, X, Calendar, Flag, Building2, FileText, ChevronRight, User, Tag, Trash2, Edit2, Play, ArrowRight, ChevronLeft, CalendarDays } from 'lucide-react';
import { startOfMonth, endOfMonth, addMonths, subMonths, format } from 'date-fns';
import api from '../../lib/api';
import useAuthStore from '../../context/authStore';
import { useToast } from '../../components/ui/index';
import { Button, Modal, Input, Textarea, Select } from '../../components/ui/index';
import { Spinner, EmptyState } from '../../components/shared/LoadingScreen';
import { formatDate } from '../../lib/utils';

const COLUMNS = [
  { id: 'today',       label: 'Today',        color: '#f59e0b', icon: AlertCircle },
  { id: 'pending',     label: 'Pending',      color: '#94a3b8', icon: AlertCircle },
  { id: 'in_progress', label: 'In Progress',  color: '#4f6ef0', icon: Clock },
  { id: 'review',      label: 'In Review',    color: '#a855f7', icon: Target },
  { id: 'completed',   label: 'Completed',    color: '#22c55e', icon: CheckCircle },
];

const PRIORITY_COLORS = {
  low: '#a8a49e', medium: '#4f6ef0', high: '#f59e0b', urgent: '#ef4444',
};

const CATEGORY_LABELS = {
  paid_ads: '📊 Paid Ads', social_media: '📱 Social Media', video_editing: '🎬 Video Editing',
  graphic_design: '🎨 Graphic Design', copywriting: '✍️ Copywriting', reporting: '📋 Reporting',
  strategy: '🧠 Strategy', client_request: '💬 Client Request', other: '📌 Other',
};

const ROLE_LABELS = {
  admin: 'Admin', manager: 'Project Manager',
  performance_marketer: 'Performance Marketer', social_media_manager: 'Social Media Manager',
  video_editor: 'Video Editor', graphic_designer: 'Graphic Designer', copywriter: 'Copywriter',
};

const STATUS_STYLE = {
  today:       { background: 'rgba(245,158,11,0.12)', color: '#f59e0b' },
  pending:     { background: 'var(--fd-surface-sunken)', color: 'var(--fd-ink-3)' },
  in_progress: { background: 'rgba(79,110,240,0.12)', color: '#4f6ef0' },
  review:      { background: 'rgba(168,85,247,0.12)', color: '#a855f7' },
  completed:   { background: 'rgba(34,197,94,0.12)', color: '#22c55e' },
  cancelled:   { background: 'rgba(239,68,68,0.12)', color: '#ef4444' },
};

// Converts URLs in text to clickable links
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

// ── Task Detail Drawer ────────────────────────────────────────────────────────
function TaskDrawer({ task, onClose, onStatusChange, updating, onDelete, onEdit, isManager }) {
  if (!task) return null;
  const isOverdue = task.deadline && new Date(task.deadline) < new Date() && task.status !== 'completed';
  const ss = STATUS_STYLE[task.status] || STATUS_STYLE.pending;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]" onClick={onClose} />
      <div
        className="fixed right-0 top-0 bottom-0 z-50 flex flex-col shadow-2xl"
        style={{ width: 'min(420px, 100vw)', background: 'var(--fd-surface)', borderLeft: '1px solid var(--fd-border)' }}
      >
        <div className="flex items-start gap-3 px-5 py-4 border-b flex-shrink-0" style={{ borderColor: 'var(--fd-border)' }}>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize" style={ss}>
                {(COLUMNS.find(c => c.id === task.status)?.label) || task.status.replace('_', ' ')}
              </span>
              {task.isPersonal && (
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(168,85,247,0.12)', color: '#a855f7' }}>
                  🔒 Personal
                </span>
              )}
              {isOverdue && <span className="text-[11px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">⚠ Overdue</span>}
            </div>
            <h2 className="text-[16px] font-bold leading-snug" style={{ color: 'var(--fd-ink-1)' }}>{task.title}</h2>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {isManager && (
              <>
                <button onClick={() => onEdit(task)} className="p-1.5 rounded-lg hover:bg-[var(--fd-surface-sunken)] transition-colors" style={{ color: 'var(--fd-ink-4)' }} title="Edit task">
                  <Edit2 size={15} />
                </button>
                <button onClick={() => onDelete(task._id)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors" style={{ color: '#ef4444' }} title="Delete task">
                  <Trash2 size={15} />
                </button>
              </>
            )}
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--fd-surface-sunken)] transition-colors" style={{ color: 'var(--fd-ink-4)' }}>
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {task.description && (
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <FileText size={12} style={{ color: 'var(--fd-ink-4)' }} />
                <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--fd-ink-4)' }}>Description</span>
              </div>
              <p className="text-[13px] leading-relaxed" style={{ color: 'var(--fd-ink-2)' }}>{linkifyText(task.description)}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {task.client?.company && (
              <div className="rounded-xl p-3" style={{ background: 'var(--fd-surface-sunken)', border: '1px solid var(--fd-border)' }}>
                <div className="flex items-center gap-1.5 mb-1"><Building2 size={11} style={{ color: 'var(--fd-ink-4)' }} /><span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--fd-ink-4)' }}>Client</span></div>
                <div className="text-[13px] font-semibold" style={{ color: 'var(--fd-ink-1)' }}>{task.client.company}</div>
              </div>
            )}
            {task.assignedTo && (
              <div className="rounded-xl p-3" style={{ background: 'var(--fd-surface-sunken)', border: '1px solid var(--fd-border)' }}>
                <div className="flex items-center gap-1.5 mb-1"><User size={11} style={{ color: 'var(--fd-ink-4)' }} /><span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--fd-ink-4)' }}>Assigned To</span></div>
                <div className="text-[13px] font-semibold" style={{ color: 'var(--fd-ink-1)' }}>{task.assignedTo.name}</div>
                <div className="text-[11px] mt-0.5" style={{ color: 'var(--fd-ink-4)' }}>{ROLE_LABELS[task.assignedTo.role] || task.assignedTo.role}</div>
              </div>
            )}
            {task.createdBy && (
              <div className="rounded-xl p-3" style={{ background: 'var(--fd-surface-sunken)', border: '1px solid var(--fd-border)' }}>
                <div className="flex items-center gap-1.5 mb-1"><User size={11} style={{ color: 'var(--fd-ink-4)' }} /><span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--fd-ink-4)' }}>Created By</span></div>
                <div className="text-[13px] font-semibold" style={{ color: 'var(--fd-ink-1)' }}>{task.createdBy.name}</div>
              </div>
            )}
            <div className="rounded-xl p-3" style={{ background: 'var(--fd-surface-sunken)', border: '1px solid var(--fd-border)' }}>
              <div className="flex items-center gap-1.5 mb-1"><Flag size={11} style={{ color: PRIORITY_COLORS[task.priority] }} /><span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--fd-ink-4)' }}>Priority</span></div>
              <div className="text-[13px] font-semibold capitalize" style={{ color: PRIORITY_COLORS[task.priority] }}>{task.priority}</div>
            </div>
            {task.deadline && (
              <div className="rounded-xl p-3" style={{ background: isOverdue ? 'rgba(239,68,68,0.06)' : 'var(--fd-surface-sunken)', border: `1px solid ${isOverdue ? 'rgba(239,68,68,0.2)' : 'var(--fd-border)'}` }}>
                <div className="flex items-center gap-1.5 mb-1"><Calendar size={11} style={{ color: isOverdue ? '#ef4444' : 'var(--fd-ink-4)' }} /><span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--fd-ink-4)' }}>Deadline</span></div>
                <div className="text-[13px] font-semibold" style={{ color: isOverdue ? '#ef4444' : 'var(--fd-ink-1)' }}>{formatDate(task.deadline)}</div>
              </div>
            )}
            {task.category && (
              <div className="rounded-xl p-3" style={{ background: 'var(--fd-surface-sunken)', border: '1px solid var(--fd-border)' }}>
                <div className="flex items-center gap-1.5 mb-1"><Tag size={11} style={{ color: 'var(--fd-ink-4)' }} /><span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--fd-ink-4)' }}>Category</span></div>
                <div className="text-[13px] font-semibold" style={{ color: 'var(--fd-ink-1)' }}>{CATEGORY_LABELS[task.category] || task.category}</div>
              </div>
            )}
          </div>

          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide mb-2.5" style={{ color: 'var(--fd-ink-4)' }}>Move to</div>
            <div className="flex flex-col gap-1.5">
              {COLUMNS.filter(c => c.id !== task.status).map(col => {
                const Icon = col.icon;
                return (
                  <button
                    key={col.id}
                    onClick={() => onStatusChange(task._id, col.id)}
                    disabled={updating === task._id}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all hover:scale-[1.01]"
                    style={{ background: `${col.color}10`, border: `1px solid ${col.color}30`, opacity: updating === task._id ? 0.6 : 1 }}
                  >
                    <Icon size={14} style={{ color: col.color }} />
                    <span className="text-[13px] font-medium" style={{ color: col.color }}>{col.label}</span>
                    <ChevronRight size={12} style={{ color: col.color, marginLeft: 'auto' }} />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Task Card ─────────────────────────────────────────────────────────────────
function TaskCard({ task, onDragStart, onClick }) {
  const isOverdue = task.deadline && new Date(task.deadline) < new Date() && task.status !== 'completed';
  return (
    <div
      draggable
      onDragStart={e => { e.stopPropagation(); onDragStart(e, task); }}
      onClick={() => onClick(task)}
      className="rounded-xl p-3.5 cursor-pointer transition-all select-none hover:shadow-md hover:scale-[1.01]"
      style={{ background: 'var(--fd-surface)', border: '1px solid var(--fd-border)', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
    >
      <div className="flex items-start gap-2">
        <div className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5" style={{ background: PRIORITY_COLORS[task.priority] || '#aaa' }} />
        <div className="flex-1 min-w-0">
          <div className="text-[12.5px] font-medium leading-snug" style={{ color: 'var(--fd-ink-1)' }}>{task.title}</div>
          {task.isPersonal && <div className="text-[10.5px] mt-0.5 font-medium" style={{ color: '#a855f7' }}>🔒 Personal</div>}
          {task.client?.company && <div className="text-[11px] mt-0.5" style={{ color: 'var(--fd-ink-4)' }}>{task.client.company}</div>}
          {task.description && <div className="text-[11px] mt-1 line-clamp-2 leading-relaxed" style={{ color: 'var(--fd-ink-4)' }}>{task.description}</div>}
        </div>
      </div>
      <div className="mt-2.5 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {task.assignedTo && (
            <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0" style={{ background: 'var(--fd-sidebar-active)', color: 'var(--fd-sidebar-link-active)' }} title={task.assignedTo.name}>
              {task.assignedTo.name?.charAt(0)?.toUpperCase()}
            </div>
          )}
          {task.deadline && (
            <span className="text-[10.5px] font-medium" style={{ color: isOverdue ? '#ef4444' : 'var(--fd-ink-5)' }}>
              {isOverdue ? '⚠ ' : ''}{formatDate(task.deadline)}
            </span>
          )}
        </div>
        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ background: `${PRIORITY_COLORS[task.priority]}18`, color: PRIORITY_COLORS[task.priority] }}>
          {task.priority}
        </span>
      </div>

    </div>
  );
}

// ── Column ────────────────────────────────────────────────────────────────────
function Column({ column, tasks, onDrop, onDragOver, onDragStart, updating, onCardClick, onAddTask }) {
  const Icon = column.icon;
  return (
    <div
      className="flex flex-col rounded-xl overflow-hidden flex-shrink-0 w-64"
      style={{ background: 'var(--fd-surface-sunken)', border: '1px solid var(--fd-border)', minHeight: 400 }}
      onDrop={e => onDrop(e, column.id)}
      onDragOver={onDragOver}
    >
      <div className="flex items-center gap-2 px-3.5 py-3 border-b flex-shrink-0" style={{ borderColor: 'var(--fd-border)' }}>
        <div className="w-5 h-5 rounded flex items-center justify-center" style={{ background: `${column.color}18` }}>
          <Icon size={11} style={{ color: column.color }} />
        </div>
        <span className="text-[12.5px] font-semibold flex-1" style={{ color: 'var(--fd-ink-1)' }}>{column.label}</span>
        {tasks.length > 0 && (
          <span className="text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center" style={{ background: `${column.color}20`, color: column.color }}>
            {tasks.length}
          </span>
        )}
        {updating === column.id && <Spinner size="xs" />}
        <button onClick={() => onAddTask(column.id)} className="w-6 h-6 rounded flex items-center justify-center transition-colors hover:opacity-80" style={{ background: `${column.color}18`, color: column.color }} title={`Add task to ${column.label}`}>
          <Plus size={12} />
        </button>
      </div>

      <div className="flex-1 p-2.5 space-y-2 overflow-y-auto">
        {tasks.length === 0 && (
          <div className="text-[11.5px] text-center py-8 rounded-lg border-2 border-dashed" style={{ color: 'var(--fd-ink-5)', borderColor: 'var(--fd-border)' }}>
            Drop tasks here
          </div>
        )}
        {tasks.map(task => <TaskCard key={task._id} task={task} onDragStart={onDragStart} onClick={onCardClick} />)}
      </div>

      <button
        onClick={() => onAddTask(column.id)}
        className="flex items-center gap-2 px-3.5 py-2.5 border-t text-[12px] font-medium transition-colors hover:opacity-80 flex-shrink-0"
        style={{ borderColor: 'var(--fd-border)', color: 'var(--fd-ink-4)', background: 'transparent' }}
      >
        <Plus size={13} /> Add task
      </button>

    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function KanbanPage() {
  const { user } = useAuthStore();
  const toast = useToast();
  const isAdmin = user?.role === 'admin';

  const [tasks, setTasks]             = useState([]);
  const [loading, setLoading]         = useState(true);
  const [updating, setUpdating]       = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving]           = useState(false);
  const [memberTaskCounts, setMemberTaskCounts] = useState({});

  // Filter state
  const [filterClient, setFilterClient]     = useState('');
  const [filterMember, setFilterMember]     = useState('');
  const [filterPM, setFilterPM]             = useState('');   // admin only

  // Monthly scoping - defaults to the current month, toggle to see everything
  const [monthCursor, setMonthCursor] = useState(function () { return new Date(); });
  const [showAllTime, setShowAllTime] = useState(false);

  // Dropdown data
  const [clients, setClients]   = useState([]);
  const [members, setMembers]   = useState([]);   // team members only
  const [managers, setManagers] = useState([]);   // PMs — admin only

  // Add task form
  const [form, setForm] = useState({
    title: '', description: '', client: '', assignedTo: '',
    priority: 'medium', status: 'pending', deadline: '',
    category: 'other', isClientVisible: false, isPersonal: false,
  });

  const dragTask = useRef(null);

  // Load dropdown data
  useEffect(() => {
    api.get('/clients?limit=100').then(r => setClients(r.data.clients || []));
    api.get('/users?limit=100').then(r => {
      const all = r.data.users || [];
      setMembers(all.filter(u => !['admin', 'manager', 'client'].includes(u.role)));
      setManagers(all.filter(u => ['admin', 'manager'].includes(u.role)));
    });
    // Fetch active task counts per member
    Promise.all([
      api.get('/tasks?status=pending&limit=500'),
      api.get('/tasks?status=today&limit=500'),
      api.get('/tasks?status=in_progress&limit=500'),
    ]).then(([p, t, ip]) => {
      const allActive = [
        ...(p.data.tasks || []),
        ...(t.data.tasks || []),
        ...(ip.data.tasks || []),
      ];
      const counts = {};
      allActive.forEach(task => {
        const id = task.assignedTo?._id;
        if (id) counts[id] = (counts[id] || 0) + 1;
      });
      setMemberTaskCounts(counts);
    }).catch(() => {});
  }, []);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterClient) params.set('client', filterClient);
      if (filterMember) params.set('assignedTo', filterMember);
      if (!showAllTime) {
        params.set('dateFrom', startOfMonth(monthCursor).toISOString());
        params.set('dateTo', endOfMonth(monthCursor).toISOString());
      }
      // PM filter: we filter client-side since backend scopes by accountManager on Client model
      const { data } = await api.get(`/tasks?${params}`);
      let result = data.tasks || [];

      // Admin filtering by PM: keep tasks whose createdBy matches selected PM
      if (isAdmin && filterPM) {
        result = result.filter(t => t.createdBy?._id === filterPM || String(t.createdBy?._id) === filterPM);
      }

      setTasks(result);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [filterClient, filterMember, filterPM, isAdmin, showAllTime, monthCursor]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const onDragStart = (e, task) => { dragTask.current = task; e.dataTransfer.effectAllowed = 'move'; };
  const onDragOver  = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; };

  const onDrop = async (e, newStatus) => {
    e.preventDefault();
    const task = dragTask.current;
    if (!task || task.status === newStatus) return;
    setTasks(prev => prev.map(t => t._id === task._id ? { ...t, status: newStatus } : t));
    if (selectedTask?._id === task._id) setSelectedTask(prev => ({ ...prev, status: newStatus }));
    setUpdating(newStatus);
    try {
      await api.put(`/tasks/${task._id}`, { status: newStatus });
      toast({ type: 'success', title: 'Task moved', message: `"${task.title}" → ${newStatus.replace('_', ' ')}` });
    } catch (err) {
      setTasks(prev => prev.map(t => t._id === task._id ? { ...t, status: task.status } : t));
      if (selectedTask?._id === task._id) setSelectedTask(prev => ({ ...prev, status: task.status }));
      toast({ type: 'error', title: 'Failed to move task', message: err?.response?.data?.message });
    } finally { setUpdating(null); dragTask.current = null; }
  };

  const handleStatusFromDrawer = async (id, newStatus) => {
    const task = tasks.find(t => t._id === id);
    if (!task) return;
    setTasks(prev => prev.map(t => t._id === id ? { ...t, status: newStatus } : t));
    setSelectedTask(prev => prev?._id === id ? { ...prev, status: newStatus } : prev);
    setUpdating(id);
    try {
      await api.put(`/tasks/${id}`, { status: newStatus });
      toast({ type: 'success', title: 'Status updated' });
    } catch {
      setTasks(prev => prev.map(t => t._id === id ? { ...t, status: task.status } : t));
      setSelectedTask(prev => prev?._id === id ? { ...prev, status: task.status } : prev);
      toast({ type: 'error', title: 'Update failed' });
    } finally { setUpdating(null); }
  };

  const openAddTask = (defaultStatus) => {
    setForm({ title: '', description: '', client: filterClient || '', assignedTo: filterMember || '', priority: 'medium', status: defaultStatus, deadline: '', category: 'other', isClientVisible: false, isPersonal: false });
    setShowAddModal(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) { toast({ type: 'error', title: 'Title is required' }); return; }
    if (!form.isPersonal && !form.client) { toast({ type: 'error', title: 'Pick a client (or mark it as a personal task)' }); return; }
    setSaving(true);
    try {
      const payload = { ...form };
      if (payload.isPersonal) delete payload.client;
      await api.post('/tasks', payload);
      setShowAddModal(false);
      fetchTasks();
      toast({ type: 'success', title: 'Task created' });
    } catch (err) {
      toast({ type: 'error', title: 'Failed to create task', message: err?.response?.data?.message });
    } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this task? This cannot be undone.')) return;
    try {
      await api.delete(`/tasks/${id}`);
      setTasks(prev => prev.filter(t => t._id !== id));
      setSelectedTask(null);
      toast({ type: 'success', title: 'Task deleted' });
    } catch (err) {
      toast({ type: 'error', title: 'Failed to delete task', message: err?.response?.data?.message });
    }
  };

  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [editSaving, setEditSaving] = useState(false);

  const openEdit = (task) => {
    setEditForm({
      title: task.title,
      description: task.description || '',
      client: task.client?._id || '',
      assignedTo: task.assignedTo?._id || '',
      priority: task.priority,
      status: task.status,
      deadline: task.deadline ? task.deadline.split('T')[0] : '',
      category: task.category || 'other',
      isClientVisible: task.isClientVisible || false,
      isPersonal: task.isPersonal || false,
    });
    setShowEditModal(true);
  };

  const handleEditSave = async () => {
    if (!editForm.title.trim()) { toast({ type: 'error', title: 'Title is required' }); return; }
    setEditSaving(true);
    try {
      const payload = { ...editForm };
      if (payload.isPersonal) delete payload.client;
      const { data } = await api.put(`/tasks/${selectedTask._id}`, payload);
      setTasks(prev => prev.map(t => t._id === selectedTask._id ? data.task : t));
      setSelectedTask(data.task);
      setShowEditModal(false);
      toast({ type: 'success', title: 'Task updated' });
    } catch (err) {
      toast({ type: 'error', title: 'Failed to update task', message: err?.response?.data?.message });
    } finally { setEditSaving(false); }
  };

  const isManager = ['admin', 'manager'].includes(user?.role);

  const byStatus = (status) => tasks.filter(t => t.status === status);

  const membersByRole = [...members, ...managers].reduce((acc, m) => {
    const label = ROLE_LABELS[m.role] || m.role;
    if (!acc[label]) acc[label] = [];
    acc[label].push(m);
    return acc;
  }, {});

  const activeFilters = [filterClient, filterMember, filterPM].filter(Boolean).length + (showAllTime ? 1 : 0);

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[22px] font-bold tracking-[-0.02em]" style={{ color: 'var(--fd-ink-1)' }}>Kanban Board</h1>
          <p className="text-[13px] mt-1" style={{ color: 'var(--fd-ink-4)' }}>Drag & drop to move tasks · Click any card for details</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => openAddTask('pending')}>
            <Plus size={14} /> Add Task
          </Button>
          <Button variant="secondary" size="sm" onClick={fetchTasks}>Refresh</Button>
        </div>
      </div>

      {/* Month navigator */}
      <div
        className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 flex-wrap"
        style={{ background: 'var(--fd-surface)', border: '1px solid var(--fd-border)' }}
      >
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setMonthCursor(prev => subMonths(prev, 1))}
            disabled={showAllTime}
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-[var(--fd-surface-sunken)] disabled:opacity-30"
            style={{ color: 'var(--fd-ink-3)' }}
          >
            <ChevronLeft size={15} />
          </button>
          <span className="flex items-center gap-1.5 text-[13px] font-semibold min-w-[110px] justify-center" style={{ color: 'var(--fd-ink-1)' }}>
            <CalendarDays size={13} style={{ color: 'var(--fd-ink-4)' }} />
            {showAllTime ? 'All Time' : format(monthCursor, 'MMMM yyyy')}
          </span>
          <button
            onClick={() => setMonthCursor(prev => addMonths(prev, 1))}
            disabled={showAllTime}
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-[var(--fd-surface-sunken)] disabled:opacity-30"
            style={{ color: 'var(--fd-ink-3)' }}
          >
            <ChevronRight size={15} />
          </button>
          {!showAllTime && (
            <button
              onClick={() => setMonthCursor(new Date())}
              className="text-[11px] font-medium px-2 py-1 rounded-lg transition-colors hover:bg-[var(--fd-surface-sunken)]"
              style={{ color: 'var(--fd-ink-4)' }}
            >
              Today
            </button>
          )}
        </div>
        <button
          onClick={() => setShowAllTime(v => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all"
          style={{
            background: showAllTime ? 'rgba(79,110,240,0.12)' : 'var(--fd-surface-sunken)',
            color: showAllTime ? '#4f6ef0' : 'var(--fd-ink-3)',
            border: `1px solid ${showAllTime ? 'rgba(79,110,240,0.3)' : 'var(--fd-border)'}`,
          }}
        >
          {showAllTime ? '✓ Showing All Time' : 'Show All Time'}
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2.5 items-end">
        {/* Client filter — admin + manager */}
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--fd-ink-4)' }}>Client</label>
          <select
            value={filterClient}
            onChange={e => setFilterClient(e.target.value)}
            className="fd-input text-[12.5px]"
            style={{ minWidth: 160 }}
          >
            <option value="">All Clients</option>
            {clients.map(c => <option key={c._id} value={c._id}>{c.company}</option>)}
          </select>
        </div>

        {/* Team member filter — admin + manager */}
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--fd-ink-4)' }}>Team Member</label>
          <select
            value={filterMember}
            onChange={e => setFilterMember(e.target.value)}
            className="fd-input text-[12.5px]"
            style={{ minWidth: 170 }}
          >
            <option value="">All Members</option>
            {members.map(m => <option key={m._id} value={m._id}>{m.name} · {ROLE_LABELS[m.role] || m.role}</option>)}
          </select>
        </div>

        {/* PM filter — admin only */}
        {isAdmin && (
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--fd-ink-4)' }}>Manager / Admin</label>
            <select
              value={filterPM}
              onChange={e => setFilterPM(e.target.value)}
              className="fd-input text-[12.5px]"
              style={{ minWidth: 170 }}
            >
              <option value="">All Managers</option>
              {managers.map(m => <option key={m._id} value={m._id}>{m.name}</option>)}
            </select>
          </div>
        )}

        {activeFilters > 0 && (
          <button
            onClick={() => { setFilterClient(''); setFilterMember(''); setFilterPM(''); setShowAllTime(false); setMonthCursor(new Date()); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors hover:opacity-80"
            style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', alignSelf: 'flex-end' }}
          >
            <X size={12} /> Clear filters ({activeFilters})
          </button>
        )}
      </div>

      {/* Board */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {COLUMNS.map(col => (
          <Column
            key={col.id}
            column={col}
            tasks={byStatus(col.id)}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragStart={onDragStart}
            updating={updating}
            onCardClick={setSelectedTask}
            onAddTask={openAddTask}
          />
        ))}
      </div>

      {tasks.length === 0 && !loading && (
        <EmptyState icon={CheckCircle} title="No tasks found" description={activeFilters ? 'Try clearing the filters above.' : "Click 'Add Task' to create your first task."} />
      )}

      {/* Detail drawer */}
      {selectedTask && (
        <TaskDrawer
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onStatusChange={handleStatusFromDrawer}
          updating={updating}
          onDelete={handleDelete}
          onEdit={openEdit}
          isManager={isManager}
        />
      )}

      {/* Add task modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="New Task"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowAddModal(false)}>Cancel</Button>
            <Button loading={saving} onClick={handleSave}>Create Task</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Input label="Title *" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="What needs to be done?" autoFocus />
          <Textarea label="Description" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={3} placeholder="Add details, context, or notes…" />

          {isAdmin && (
            <label className="flex items-center gap-2.5 cursor-pointer p-2.5 rounded-lg" style={{ background: 'var(--fd-surface-sunken)', border: '1px solid var(--fd-border)' }}>
              <input
                type="checkbox"
                checked={form.isPersonal}
                onChange={e => setForm(p => ({ ...p, isPersonal: e.target.checked, client: e.target.checked ? '' : p.client, assignedTo: e.target.checked ? user._id : p.assignedTo }))}
                className="rounded"
                style={{ accentColor: '#4f6ef0' }}
              />
              <span className="text-[13px]" style={{ color: 'var(--fd-ink-2)' }}>
                🔒 Personal task — only visible to me, no client needed
              </span>
            </label>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Select label="Client" value={form.client} disabled={form.isPersonal} onChange={e => setForm(p => ({ ...p, client: e.target.value }))}>
              <option value="">{form.isPersonal ? 'Not applicable' : 'Select client…'}</option>
              {clients.map(c => <option key={c._id} value={c._id}>{c.company}</option>)}
            </Select>
            <Select label="Category" value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          </div>
          <div>
            <label className="block text-[12px] font-medium mb-1.5" style={{ color: 'var(--fd-ink-2)' }}>Assign To</label>
            <select value={form.assignedTo} onChange={e => setForm(p => ({ ...p, assignedTo: e.target.value }))} className="fd-input">
              <option value="">Unassigned</option>
              {Object.entries(membersByRole).map(([roleLabel, roleMembers]) => (
                <optgroup key={roleLabel} label={roleLabel}>
                  {roleMembers.map(m => {
                    const c = memberTaskCounts[m._id] || 0;
                    return <option key={m._id} value={m._id}>{m.name}{c > 0 ? ` (${c} active)` : ''}</option>;
                  })}
                </optgroup>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Select label="Priority" value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value }))}>
              {['low','medium','high','urgent'].map(v => <option key={v} value={v}>{v.charAt(0).toUpperCase()+v.slice(1)}</option>)}
            </Select>
            <Select label="Status" value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}>
              {COLUMNS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </Select>
            <Input label="Deadline" type="date" value={form.deadline} onChange={e => setForm(p => ({ ...p, deadline: e.target.value }))} />
          </div>
          {!form.isPersonal && (
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input type="checkbox" checked={form.isClientVisible} onChange={e => setForm(p => ({ ...p, isClientVisible: e.target.checked }))} className="rounded" style={{ accentColor: '#4f6ef0' }} />
              <span className="text-[13px]" style={{ color: 'var(--fd-ink-2)' }}>Visible to client portal</span>
            </label>
          )}
        </div>
      </Modal>
      {/* Edit task modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Edit Task"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowEditModal(false)}>Cancel</Button>
            <Button loading={editSaving} onClick={handleEditSave}>Save Changes</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Input label="Title *" value={editForm.title || ''} onChange={e => setEditForm(p => ({ ...p, title: e.target.value }))} />
          <Textarea label="Description" value={editForm.description || ''} onChange={e => setEditForm(p => ({ ...p, description: e.target.value }))} rows={3} />

          {isAdmin && (
            <label className="flex items-center gap-2.5 cursor-pointer p-2.5 rounded-lg" style={{ background: 'var(--fd-surface-sunken)', border: '1px solid var(--fd-border)' }}>
              <input
                type="checkbox"
                checked={editForm.isPersonal || false}
                onChange={e => setEditForm(p => ({ ...p, isPersonal: e.target.checked, client: e.target.checked ? '' : p.client }))}
                className="rounded"
                style={{ accentColor: '#4f6ef0' }}
              />
              <span className="text-[13px]" style={{ color: 'var(--fd-ink-2)' }}>
                🔒 Personal task — only visible to me, no client needed
              </span>
            </label>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Select label="Client" value={editForm.client || ''} disabled={editForm.isPersonal} onChange={e => setEditForm(p => ({ ...p, client: e.target.value }))}>
              <option value="">{editForm.isPersonal ? 'Not applicable' : 'Select client…'}</option>
              {clients.map(c => <option key={c._id} value={c._id}>{c.company}</option>)}
            </Select>
            <Select label="Category" value={editForm.category || 'other'} onChange={e => setEditForm(p => ({ ...p, category: e.target.value }))}>
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          </div>
          <div>
            <label className="block text-[12px] font-medium mb-1.5" style={{ color: 'var(--fd-ink-2)' }}>Assign To</label>
            <select value={editForm.assignedTo || ''} onChange={e => setEditForm(p => ({ ...p, assignedTo: e.target.value }))} className="fd-input">
              <option value="">Unassigned</option>
              {Object.entries(membersByRole).map(([roleLabel, roleMembers]) => (
                <optgroup key={roleLabel} label={roleLabel}>
                  {roleMembers.map(m => {
                    const c = memberTaskCounts[m._id] || 0;
                    return <option key={m._id} value={m._id}>{m.name}{c > 0 ? ` (${c} active)` : ''}</option>;
                  })}
                </optgroup>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Select label="Priority" value={editForm.priority || 'medium'} onChange={e => setEditForm(p => ({ ...p, priority: e.target.value }))}>
              {['low','medium','high','urgent'].map(v => <option key={v} value={v}>{v.charAt(0).toUpperCase()+v.slice(1)}</option>)}
            </Select>
            <Select label="Status" value={editForm.status || 'pending'} onChange={e => setEditForm(p => ({ ...p, status: e.target.value }))}>
              {COLUMNS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </Select>
            <Input label="Deadline" type="date" value={editForm.deadline || ''} onChange={e => setEditForm(p => ({ ...p, deadline: e.target.value }))} />
          </div>
          {!editForm.isPersonal && (
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input type="checkbox" checked={editForm.isClientVisible || false} onChange={e => setEditForm(p => ({ ...p, isClientVisible: e.target.checked }))} className="rounded" style={{ accentColor: '#4f6ef0' }} />
              <span className="text-[13px]" style={{ color: 'var(--fd-ink-2)' }}>Visible to client portal</span>
            </label>
          )}
        </div>
      </Modal>
    </div>
  );
}