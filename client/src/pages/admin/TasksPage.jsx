import React, { useEffect, useState, useCallback } from 'react';
import { CheckSquare, Plus, Clock, User, Filter } from 'lucide-react';
import api from '../../lib/api';
import useAuthStore from '../../context/authStore';
import { PageHeader, EmptyState, Avatar, Card, Spinner } from '../../components/shared/LoadingScreen';
import { Button, SearchInput, Select, Modal, Input, Textarea } from '../../components/ui/index';
import { formatDate, getTaskStatusColor, getPriorityColor, timeAgo } from '../../lib/utils';

// Maps task category → suggested role to assign
const CATEGORY_ROLE_HINT = {
  paid_ads: 'performance_marketer',
  social_media: 'social_media_manager',
  video_editing: 'video_editor',
  graphic_design: 'graphic_designer',
  copywriting: 'copywriter',
  reporting: null,
  strategy: 'manager',
  client_request: 'manager',
  other: null,
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

const ROLE_LABELS = {
  admin: 'Admin',
  manager: 'Project Manager',
  performance_marketer: 'Performance Marketer',
  social_media_manager: 'Social Media Manager',
  video_editor: 'Video Editor',
  graphic_designer: 'Graphic Designer',
  copywriter: 'Copywriter',
};

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
    category: 'other', isClientVisible: false
  });

  useEffect(() => {
    // Load clients
    api.get('/clients?limit=100').then(r => setClients(r.data.clients || [])).catch(() => {});
    // Load all team members (all non-client roles)
    api.get('/users?limit=100').then(r => {
      const team = (r.data.users || []).filter(u => u.role !== 'client');
      setMembers(team);
    }).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: 100 });
      if (statusFilter) params.set('status', statusFilter);
      if (priorityFilter) params.set('priority', priorityFilter);
      const { data } = await api.get(`/tasks?${params}`);
      let filtered = data.tasks || [];
      if (search) filtered = filtered.filter(t =>
        t.title.toLowerCase().includes(search.toLowerCase()) ||
        t.client?.company?.toLowerCase().includes(search.toLowerCase()) ||
        t.assignedTo?.name?.toLowerCase().includes(search.toLowerCase())
      );
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

  const openEdit = (task) => {
    setEditing(task);
    setForm({
      ...task,
      client: task.client?._id,
      assignedTo: task.assignedTo?._id || '',
      deadline: task.deadline ? task.deadline.split('T')[0] : ''
    });
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

  // Auto-suggest member when category changes
  const handleCategoryChange = (cat) => {
    setForm(p => {
      const hint = CATEGORY_ROLE_HINT[cat];
      const suggested = hint ? members.find(m => m.role === hint) : null;
      return { ...p, category: cat, assignedTo: suggested ? suggested._id : p.assignedTo };
    });
  };

  const statuses = ['pending', 'in_progress', 'review', 'completed', 'cancelled'];

  // Group members by role for the select
  const membersByRole = members.reduce((acc, m) => {
    const label = ROLE_LABELS[m.role] || m.role;
    if (!acc[label]) acc[label] = [];
    acc[label].push(m);
    return acc;
  }, {});

  const isManager = ['admin', 'manager'].includes(user?.role);

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        title={isManager ? 'All Tasks' : 'Tasks'}
        subtitle={`${tasks.length} tasks`}
        actions={<Button onClick={openCreate}><Plus size={16} />New Task</Button>}
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Search tasks..." className="w-64" />
        <Select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="w-44">
          <option value="">All Statuses</option>
          {statuses.map(s => <option key={s} value={s}>{s.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>)}
        </Select>
        <Select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)} className="w-36">
          <option value="">All Priorities</option>
          {['low', 'medium', 'high', 'urgent'].map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
        </Select>
        <Select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="w-48">
          <option value="">All Categories</option>
          {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : tasks.length === 0 ? (
        <EmptyState icon={CheckSquare} title="No tasks found" description="Create a task to get started." action={<Button onClick={openCreate}><Plus size={14} />New Task</Button>} />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {['Task', 'Client', 'Category', 'Assigned To', 'Priority', 'Status', 'Deadline', 'Actions'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tasks.map(task => (
                  <tr key={task._id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3.5 max-w-xs">
                      <div className="font-medium text-slate-800 truncate">{task.title}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{timeAgo(task.createdAt)}</div>
                      {task.isClientRequest && (
                        <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded mt-1 inline-block">Client Request</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-slate-600 text-xs">{task.client?.company || '—'}</td>
                    <td className="px-4 py-3.5 text-xs text-slate-600">
                      {CATEGORY_LABELS[task.category] || task.category}
                    </td>
                    <td className="px-4 py-3.5">
                      {task.assignedTo ? (
                        <div className="flex items-center gap-2">
                          <Avatar name={task.assignedTo.name} size="xs" />
                          <div>
                            <div className="text-slate-700 text-xs font-medium">{task.assignedTo.name}</div>
                            <div className="text-slate-400 text-xs">{ROLE_LABELS[task.assignedTo.role] || task.assignedTo.jobTitle || ''}</div>
                          </div>
                        </div>
                      ) : <span className="text-slate-400 text-xs">Unassigned</span>}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${getPriorityColor(task.priority)}`}>{task.priority}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      {isManager ? (
                        <select value={task.status} onChange={e => updateStatus(task._id, e.target.value)}
                          className={`px-2.5 py-0.5 rounded-full text-xs font-medium capitalize border-0 cursor-pointer ${getTaskStatusColor(task.status)}`}>
                          {statuses.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                        </select>
                      ) : (
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${getTaskStatusColor(task.status)}`}>
                          {task.status.replace('_', ' ')}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-slate-500 text-xs">
                      {task.deadline ? (
                        <span className="flex items-center gap-1"><Clock size={11} />{formatDate(task.deadline)}</span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3.5">
                      <Button size="xs" variant="ghost" onClick={() => openEdit(task)}>Edit</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Create / Edit Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Task' : 'New Task'} size="md"
        footer={<div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
          <Button loading={saving} onClick={handleSave}>{editing ? 'Save Changes' : 'Create Task'}</Button>
        </div>}
      >
        <div className="space-y-4">
          <Input label="Title *" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} required />
          <Textarea label="Description" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={3} />
          
          <div className="grid grid-cols-2 gap-3">
            <Select label="Client *" value={form.client} onChange={e => setForm(p => ({ ...p, client: e.target.value }))}>
              <option value="">Select client...</option>
              {clients.map(c => <option key={c._id} value={c._id}>{c.company}</option>)}
            </Select>
            <Select label="Category" value={form.category} onChange={e => handleCategoryChange(e.target.value)}>
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          </div>

          {/* Assign To — grouped by role */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Assign To</label>
            <select
              value={form.assignedTo}
              onChange={e => setForm(p => ({ ...p, assignedTo: e.target.value }))}
              className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
            >
              <option value="">Unassigned</option>
              {Object.entries(membersByRole).map(([roleLabel, roleMembers]) => (
                <optgroup key={roleLabel} label={roleLabel}>
                  {roleMembers.map(m => (
                    <option key={m._id} value={m._id}>{m.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
            {form.category && CATEGORY_ROLE_HINT[form.category] && (
              <p className="text-xs text-slate-400 mt-1">
                💡 Suggested role for this task: <span className="text-brand-600 font-medium">{ROLE_LABELS[CATEGORY_ROLE_HINT[form.category]]}</span>
              </p>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Select label="Priority" value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value }))}>
              {['low', 'medium', 'high', 'urgent'].map(v => <option key={v} value={v}>{v.charAt(0).toUpperCase() + v.slice(1)}</option>)}
            </Select>
            <Select label="Status" value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}>
              {statuses.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
            </Select>
            <Input label="Deadline" type="date" value={form.deadline} onChange={e => setForm(p => ({ ...p, deadline: e.target.value }))} />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.isClientVisible} onChange={e => setForm(p => ({ ...p, isClientVisible: e.target.checked }))} className="rounded" />
            <span className="text-sm text-slate-700">Visible to client portal</span>
          </label>
        </div>
      </Modal>
    </div>
  );
}
