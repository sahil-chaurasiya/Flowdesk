import React, { useEffect, useState, useCallback } from 'react';
import { CheckSquare, Plus, Clock, Search } from 'lucide-react';
import api from '../../lib/api';
import useAuthStore from '../../context/authStore';
import { PageHeader, EmptyState, Avatar, Card, CardHeader, CardContent, Spinner } from '../../components/shared/LoadingScreen';
import { Button, Select, Modal, Input, Textarea } from '../../components/ui/index';
import { formatDate, timeAgo } from '../../lib/utils';

const CATEGORY_LABELS = {
  paid_ads: 'Paid Ads', social_media: 'Social Media', video_editing: 'Video Editing',
  graphic_design: 'Graphic Design', copywriting: 'Copywriting', reporting: 'Reporting',
  strategy: 'Strategy', client_request: 'Client Request', other: 'Other',
};

const ROLE_LABELS = {
  admin: 'Admin', manager: 'Project Manager',
  performance_marketer: 'Performance Marketer', social_media_manager: 'Social Media Manager',
  video_editor: 'Video Editor', graphic_designer: 'Graphic Designer', copywriter: 'Copywriter',
};

const CATEGORY_ROLE_HINT = {
  paid_ads: 'performance_marketer', social_media: 'social_media_manager',
  video_editing: 'video_editor', graphic_design: 'graphic_designer',
  copywriting: 'copywriter',
};

const PRIORITY_STYLE = {
  low:    { background: 'var(--fd-surface-sunken)', color: 'var(--fd-ink-3)' },
  medium: { background: 'var(--fd-sidebar-active)', color: 'var(--fd-sidebar-link-active)' },
  high:   { background: 'rgba(146,96,10,0.12)', color: '#f59e0b' },
  urgent: { background: 'rgba(185,28,28,0.12)', color: '#ef4444' },
};

const STATUS_STYLE = {
  pending:     { background: 'var(--fd-surface-sunken)', color: 'var(--fd-ink-3)' },
  in_progress: { background: 'var(--fd-sidebar-active)', color: 'var(--fd-sidebar-link-active)' },
  review:      { background: 'rgba(126,34,206,0.12)', color: '#a855f7' },
  completed:   { background: 'rgba(42,125,79,0.12)', color: '#22c55e' },
  cancelled:   { background: 'rgba(185,28,28,0.12)', color: '#ef4444' },
};

const STATUSES = ['pending', 'in_progress', 'review', 'completed', 'cancelled'];

export default function TasksPage() {
  const { user } = useAuthStore();
  const [tasks, setTasks] = useState([]);
  const [clients, setClients] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    title: '', description: '', client: '', assignedTo: '',
    priority: 'medium', status: 'pending', deadline: '',
    category: 'other', isClientVisible: false,
  });

  useEffect(() => {
    api.get('/clients?limit=100').then(r => setClients(r.data.clients || []));
    api.get('/users?limit=100').then(r => {
      setMembers((r.data.users || []).filter(u => u.role !== 'client'));
    });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: 100 });
      if (statusFilter) params.set('status', statusFilter);
      if (priorityFilter) params.set('priority', priorityFilter);
      const { data } = await api.get(`/tasks?${params}`);
      let filtered = data.tasks || [];
      if (search) {
        const q = search.toLowerCase();
        filtered = filtered.filter(t =>
          t.title.toLowerCase().includes(q) ||
          t.client?.company?.toLowerCase().includes(q) ||
          t.assignedTo?.name?.toLowerCase().includes(q)
        );
      }
      if (categoryFilter) filtered = filtered.filter(t => t.category === categoryFilter);
      setTasks(filtered);
    } finally { setLoading(false); }
  }, [statusFilter, priorityFilter, search, categoryFilter]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm({ title: '', description: '', client: '', assignedTo: '', priority: 'medium', status: 'pending', deadline: '', category: 'other', isClientVisible: false });
    setShowModal(true);
  };

  const openEdit = t => {
    setEditing(t);
    setForm({ ...t, client: t.client?._id, assignedTo: t.assignedTo?._id || '', deadline: t.deadline ? t.deadline.split('T')[0] : '' });
    setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editing) await api.put(`/tasks/${editing._id}`, form);
      else await api.post('/tasks', form);
      setShowModal(false);
      load();
    } finally { setSaving(false); }
  };

  const updateStatus = async (id, status) => {
    await api.put(`/tasks/${id}`, { status });
    setTasks(prev => prev.map(t => t._id === id ? { ...t, status } : t));
  };

  const handleCategoryChange = cat => {
    const hint = CATEGORY_ROLE_HINT[cat];
    const suggested = hint ? members.find(m => m.role === hint) : null;
    setForm(p => ({ ...p, category: cat, assignedTo: suggested ? suggested._id : p.assignedTo }));
  };

  const isManager = ['admin', 'manager'].includes(user?.role);

  const membersByRole = members.reduce((acc, m) => {
    const label = ROLE_LABELS[m.role] || m.role;
    if (!acc[label]) acc[label] = [];
    acc[label].push(m);
    return acc;
  }, {});

  const FILTER_TABS = [
    { label: 'All',         value: '' },
    { label: 'Pending',     value: 'pending' },
    { label: 'In Progress', value: 'in_progress' },
    { label: 'Review',      value: 'review' },
    { label: 'Completed',   value: 'completed' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title={isManager ? 'All Tasks' : 'My Tasks'}
        subtitle={`${tasks.length} task${tasks.length !== 1 ? 's' : ''}`}
        actions={<Button onClick={openCreate}><Plus size={14} />New Task</Button>}
      />

      {/* Filters */}
      <div className="flex flex-col gap-3">
        <div className="relative max-w-xs">
          <Search size={13} color="var(--fd-ink-4)" className="absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search tasks..."
            className="fd-input pl-9"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Status tabs */}
          <div className="flex items-center gap-1 overflow-x-auto">
            {FILTER_TABS.map(t => (
              <button
                key={t.value}
                onClick={() => setStatusFilter(t.value)}
                className="px-3 py-1.5 rounded-lg text-[12px] font-medium whitespace-nowrap transition-all border flex-shrink-0"
                style={statusFilter === t.value
                  ? { background: '#4f6ef0', color: 'var(--fd-surface)', borderColor: '#4060e0' }
                  : { background: 'var(--fd-surface)', color: 'var(--fd-ink-3)', borderColor: 'var(--fd-border-strong)' }
                }
              >
                {t.label}
              </button>
            ))}
          </div>
          <Select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)} className="min-w-[120px]">
            <option value="">All Priorities</option>
            {['low','medium','high','urgent'].map(p => (
              <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
            ))}
          </Select>
          <Select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="min-w-[140px]">
            <option value="">All Categories</option>
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : tasks.length === 0 ? (
        <EmptyState
          icon={CheckSquare}
          title="No tasks found"
          description="Create a task or adjust filters."
          action={<Button onClick={openCreate}><Plus size={14} />New Task</Button>}
        />
      ) : (
        <Card>
          {/* Desktop */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="fd-table">
              <thead>
                <tr>
                  {['Task', 'Client', 'Category', 'Assigned To', 'Priority', 'Status', 'Deadline', ''].map(h => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tasks.map(task => {
                  const isOverdue = task.deadline && new Date(task.deadline) < new Date() && task.status !== 'completed';
                  const ss = STATUS_STYLE[task.status] || STATUS_STYLE.pending;
                  return (
                    <tr
                      key={task._id}
                      style={isOverdue ? { background: 'var(--fd-surface-raised)' } : {}}
                    >
                      <td style={{ maxWidth: 200 }}>
                        <div className="font-medium text-[13px] truncate" style={{ color: 'var(--fd-ink-1)' }}>
                          {task.title}
                        </div>
                        <div className="text-[10.5px] mt-0.5 font-mono" style={{ color: 'var(--fd-ink-4)' }}>
                          {timeAgo(task.createdAt)}
                        </div>
                        {task.isClientRequest && (
                          <span
                            className="text-[10px] font-semibold px-1.5 py-0.5 rounded mt-1 inline-block"
                            style={{ background: 'rgba(146,96,10,0.12)', color: '#f59e0b' }}
                          >
                            Client Request
                          </span>
                        )}
                        {isOverdue && (
                          <span
                            className="text-[10px] font-semibold px-1.5 py-0.5 rounded mt-1 inline-block ml-1"
                            style={{ background: 'rgba(185,28,28,0.12)', color: '#ef4444' }}
                          >
                            Overdue
                          </span>
                        )}
                      </td>
                      <td className="text-[12.5px]" style={{ color: 'var(--fd-ink-2)' }}>
                        {task.client?.company || '—'}
                      </td>
                      <td className="text-[12.5px]" style={{ color: 'var(--fd-ink-3)' }}>
                        {CATEGORY_LABELS[task.category] || task.category}
                      </td>
                      <td>
                        {task.assignedTo ? (
                          <div className="flex items-center gap-2">
                            <Avatar name={task.assignedTo.name} size="xs" />
                            <div>
                              <div className="text-[12.5px] font-medium" style={{ color: 'var(--fd-ink-2)' }}>
                                {task.assignedTo.name}
                              </div>
                              <div className="text-[10.5px]" style={{ color: 'var(--fd-ink-4)' }}>
                                {ROLE_LABELS[task.assignedTo.role] || ''}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <span className="text-[12.5px] font-medium" style={{ color: '#ef4444' }}>Unassigned</span>
                        )}
                      </td>
                      <td>
                        <span
                          className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full capitalize"
                          style={PRIORITY_STYLE[task.priority] || PRIORITY_STYLE.low}
                        >
                          {task.priority}
                        </span>
                      </td>
                      <td>
                        {isManager ? (
                          <select
                            value={task.status}
                            onChange={e => updateStatus(task._id, e.target.value)}
                            className="text-[11.5px] px-2.5 py-1.5 rounded-lg border-0 cursor-pointer font-medium outline-none capitalize"
                            style={{ ...ss, fontFamily: "'Geist', system-ui" }}
                          >
                            {STATUSES.map(s => (
                              <option key={s} value={s} style={{ background: 'var(--fd-surface)', color: 'var(--fd-ink-1)' }}>
                                {s.replace('_', ' ')}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span
                            className="text-[11.5px] font-medium px-2.5 py-1.5 rounded-lg capitalize inline-block"
                            style={ss}
                          >
                            {task.status.replace('_', ' ')}
                          </span>
                        )}
                      </td>
                      <td>
                        {task.deadline ? (
                          <div className="flex items-center gap-1 text-[12px] font-mono" style={{ color: isOverdue ? '#b91c1c' : 'var(--fd-ink-3)' }}>
                            <Clock size={11} strokeWidth={1.7} />
                            {formatDate(task.deadline)}
                          </div>
                        ) : <span style={{ color: 'var(--fd-ink-5)' }}>—</span>}
                      </td>
                      <td>
                        <Button size="xs" variant="ghost" onClick={() => openEdit(task)}>Edit</Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile */}
          <div className="lg:hidden divide-y" style={{ borderColor: 'var(--fd-border-subtle)' }}>
            {tasks.map(task => {
              const ss = STATUS_STYLE[task.status] || STATUS_STYLE.pending;
              return (
                <div key={task._id} className="p-4 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-[13px]" style={{ color: 'var(--fd-ink-1)' }}>{task.title}</div>
                      <div className="text-[11.5px] mt-0.5" style={{ color: 'var(--fd-ink-4)' }}>
                        {task.client?.company} · {timeAgo(task.createdAt)}
                      </div>
                    </div>
                    <Button size="xs" variant="ghost" onClick={() => openEdit(task)}>Edit</Button>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className="text-[10.5px] font-semibold px-2 py-0.5 rounded-full capitalize"
                      style={PRIORITY_STYLE[task.priority] || PRIORITY_STYLE.low}
                    >
                      {task.priority}
                    </span>
                    {isManager ? (
                      <select
                        value={task.status}
                        onChange={e => updateStatus(task._id, e.target.value)}
                        className="text-[11px] px-2 py-0.5 rounded-lg border-0 font-medium capitalize outline-none"
                        style={{ ...ss, fontFamily: "'Geist', system-ui" }}
                      >
                        {STATUSES.map(s => (
                          <option key={s} value={s} style={{ background: 'var(--fd-surface)', color: 'var(--fd-ink-1)' }}>
                            {s.replace('_', ' ')}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded-lg capitalize" style={ss}>
                        {task.status.replace('_', ' ')}
                      </span>
                    )}
                    <span className="text-[11.5px]" style={{ color: 'var(--fd-ink-4)' }}>
                      {CATEGORY_LABELS[task.category]}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11.5px]" style={{ color: 'var(--fd-ink-4)' }}>
                    {task.assignedTo ? (
                      <div className="flex items-center gap-1.5">
                        <Avatar name={task.assignedTo.name} size="xs" />
                        <span>{task.assignedTo.name}</span>
                      </div>
                    ) : <span style={{ color: '#ef4444' }}>Unassigned</span>}
                    {task.deadline && (
                      <div className="flex items-center gap-1 font-mono">
                        <Clock size={10} />
                        {formatDate(task.deadline)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editing ? 'Edit Task' : 'New Task'}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button loading={saving} onClick={handleSave}>
              {editing ? 'Save Changes' : 'Create Task'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Input label="Title *" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} required />
          <Textarea label="Description" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={3} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select label="Client *" value={form.client} onChange={e => setForm(p => ({ ...p, client: e.target.value }))}>
              <option value="">Select client...</option>
              {clients.map(c => <option key={c._id} value={c._id}>{c.company}</option>)}
            </Select>
            <Select label="Category" value={form.category} onChange={e => handleCategoryChange(e.target.value)}>
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          </div>
          <div>
            <label className="block text-[12px] font-medium mb-1.5" style={{ color: 'var(--fd-ink-2)' }}>Assign To</label>
            <select value={form.assignedTo} onChange={e => setForm(p => ({ ...p, assignedTo: e.target.value }))} className="fd-input">
              <option value="">Unassigned</option>
              {Object.entries(membersByRole).map(([roleLabel, roleMembers]) => (
                <optgroup key={roleLabel} label={roleLabel}>
                  {roleMembers.map(m => <option key={m._id} value={m._id}>{m.name}</option>)}
                </optgroup>
              ))}
            </select>
            {form.category && CATEGORY_ROLE_HINT[form.category] && (
              <p className="text-[11px] mt-1" style={{ color: 'var(--fd-ink-4)' }}>
                Suggested: <span style={{ color: 'var(--fd-sidebar-link-active)', fontWeight: 500 }}>{ROLE_LABELS[CATEGORY_ROLE_HINT[form.category]]}</span>
              </p>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Select label="Priority" value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value }))}>
              {['low','medium','high','urgent'].map(v => (
                <option key={v} value={v}>{v.charAt(0).toUpperCase() + v.slice(1)}</option>
              ))}
            </Select>
            <Select label="Status" value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}>
              {STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
            </Select>
            <Input label="Deadline" type="date" value={form.deadline} onChange={e => setForm(p => ({ ...p, deadline: e.target.value }))} />
          </div>
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isClientVisible}
              onChange={e => setForm(p => ({ ...p, isClientVisible: e.target.checked }))}
              className="rounded"
              style={{ accentColor: '#4f6ef0' }}
            />
            <span className="text-[13px]" style={{ color: 'var(--fd-ink-2)' }}>Visible to client portal</span>
          </label>
        </div>
      </Modal>
    </div>
  );
}
