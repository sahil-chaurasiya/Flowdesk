import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Code2, Plus, X, Trash2, Pencil, ChevronRight, ChevronLeft, ListChecks,
  Clock, AlertCircle, Calendar,
} from 'lucide-react';
import api from '../../lib/api';
import useAuthStore from '../../context/authStore';
import { PageHeader, EmptyState, Card, Spinner, Avatar } from '../../components/shared/LoadingScreen';
import { Button, Modal, Input, Textarea, Select, useToast } from '../../components/ui/index';
import { formatDate } from '../../lib/utils';

const PROJECT_STATUS = {
  planning:    { label: 'Planning',    color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' },
  in_progress: { label: 'In Progress', color: '#4f6ef0', bg: 'rgba(79,110,240,0.12)' },
  on_hold:     { label: 'On Hold',     color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  review:      { label: 'In Review',   color: '#a855f7', bg: 'rgba(168,85,247,0.12)' },
  completed:   { label: 'Completed',   color: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
  cancelled:   { label: 'Cancelled',   color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
};

const TASK_STATUS = {
  today:       { label: 'Today',       color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  pending:     { label: 'Pending',     color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' },
  in_progress: { label: 'In Progress', color: '#4f6ef0', bg: 'rgba(79,110,240,0.1)' },
  review:      { label: 'In Review',   color: '#a855f7', bg: 'rgba(168,85,247,0.1)' },
  completed:   { label: 'Completed',   color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
  cancelled:   { label: 'Cancelled',   color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
};

const PRIORITY_COLORS = { low: '#a8a49e', medium: '#4f6ef0', high: '#f59e0b', urgent: '#ef4444' };

// ── Status progress bar ──────────────────────────────────────────────────────
function ProjectProgressBar({ stats }) {
  const total = stats?.total || 0;
  const segments = total
    ? [
        { key: 'completed',  value: stats.completed,  color: '#22c55e' },
        { key: 'review',     value: stats.review,     color: '#a855f7' },
        { key: 'inProgress', value: stats.inProgress, color: '#4f6ef0' },
        { key: 'pending',    value: stats.pending,    color: '#94a3b8' },
        { key: 'cancelled',  value: stats.cancelled,  color: '#ef4444' },
      ]
    : [];

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] font-semibold" style={{ color: 'var(--fd-ink-4)' }}>
          {total} task{total === 1 ? '' : 's'}
        </span>
        <span className="text-[11px] font-bold" style={{ color: '#22c55e' }}>
          {stats?.progress || 0}% done
        </span>
      </div>
      <div
        className="w-full h-2 rounded-full overflow-hidden flex"
        style={{ background: 'var(--fd-surface-sunken)', border: '1px solid var(--fd-border)' }}
      >
        {segments.map(s => (
          s.value > 0 && (
            <div
              key={s.key}
              style={{ width: `${(s.value / total) * 100}%`, background: s.color, height: '100%' }}
            />
          )
        ))}
      </div>
    </div>
  );
}

// ── Project form modal ───────────────────────────────────────────────────────
function ProjectModal({ isOpen, onClose, onSaved, editing }) {
  const toast = useToast();
  const [form, setForm] = useState({ name: '', description: '', status: 'planning', priority: 'medium', deadline: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editing) {
      setForm({
        name: editing.name || '',
        description: editing.description || '',
        status: editing.status || 'planning',
        priority: editing.priority || 'medium',
        deadline: editing.deadline ? editing.deadline.split('T')[0] : '',
      });
    } else {
      setForm({ name: '', description: '', status: 'planning', priority: 'medium', deadline: '' });
    }
  }, [editing, isOpen]);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast({ type: 'error', title: 'Project name is required' });
    setSaving(true);
    try {
      if (editing) {
        const { data } = await api.put(`/website-work/projects/${editing._id}`, form);
        onSaved(data.project, false);
      } else {
        const { data } = await api.post('/website-work/projects', form);
        onSaved(data.project, true);
      }
      onClose();
    } catch (err) {
      toast({ type: 'error', title: 'Failed to save project', message: err.response?.data?.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={editing ? 'Edit Project' : 'New Website Project'} size="md">
      <form onSubmit={submit} className="space-y-4">
        <Input
          label="Project name"
          value={form.name}
          onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
          placeholder="e.g. Client X — Website Redesign"
          autoFocus
        />
        <Textarea
          label="Description"
          rows={3}
          value={form.description}
          onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
          placeholder="What's this project about?"
        />
        <div className="grid grid-cols-2 gap-3">
          <Select label="Status" value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}>
            {Object.entries(PROJECT_STATUS).map(([v, s]) => <option key={v} value={v}>{s.label}</option>)}
          </Select>
          <Select label="Priority" value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value }))}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </Select>
        </div>
        <Input
          type="date"
          label="Deadline (optional)"
          value={form.deadline}
          onChange={e => setForm(p => ({ ...p, deadline: e.target.value }))}
        />
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={saving}>{editing ? 'Save Changes' : 'Create Project'}</Button>
        </div>
      </form>
    </Modal>
  );
}

// ── Task form modal ──────────────────────────────────────────────────────────
function TaskModal({ isOpen, onClose, onSaved, editing, project, members }) {
  const toast = useToast();
  const [form, setForm] = useState({ title: '', description: '', assignedTo: '', priority: 'medium', status: 'pending', deadline: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editing) {
      setForm({
        title: editing.title || '',
        description: editing.description || '',
        assignedTo: editing.assignedTo?._id || '',
        priority: editing.priority || 'medium',
        status: editing.status || 'pending',
        deadline: editing.deadline ? editing.deadline.split('T')[0] : '',
      });
    } else {
      setForm({ title: '', description: '', assignedTo: '', priority: 'medium', status: 'pending', deadline: '' });
    }
  }, [editing, isOpen]);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return toast({ type: 'error', title: 'Task title is required' });
    setSaving(true);
    try {
      if (editing) {
        const { data } = await api.put(`/website-work/tasks/${editing._id}`, form);
        onSaved(data.task, false);
      } else {
        const { data } = await api.post('/website-work/tasks', { ...form, websiteProject: project._id });
        onSaved(data.task, true);
      }
      onClose();
    } catch (err) {
      toast({ type: 'error', title: 'Failed to save task', message: err.response?.data?.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={editing ? 'Edit Task' : `New Task — ${project?.name || ''}`} size="md">
      <form onSubmit={submit} className="space-y-4">
        <Input
          label="Task title"
          value={form.title}
          onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
          placeholder="e.g. Build the pricing page"
          autoFocus
        />
        <Textarea
          label="Description"
          rows={3}
          value={form.description}
          onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
          placeholder="Details, links, requirements…"
        />
        <Select
          label="Assign to"
          value={form.assignedTo}
          onChange={e => setForm(p => ({ ...p, assignedTo: e.target.value }))}
        >
          <option value="">Unassigned</option>
          {members.map(m => (
            <option key={m._id} value={m._id}>{m.name} — {m.role === 'developer' ? 'Developer' : (m.jobTitle || m.role)}</option>
          ))}
        </Select>
        <div className="grid grid-cols-2 gap-3">
          <Select label="Status" value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}>
            {Object.entries(TASK_STATUS).map(([v, s]) => <option key={v} value={v}>{s.label}</option>)}
          </Select>
          <Select label="Priority" value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value }))}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </Select>
        </div>
        <Input
          type="date"
          label="Deadline (optional)"
          value={form.deadline}
          onChange={e => setForm(p => ({ ...p, deadline: e.target.value }))}
        />
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={saving}>{editing ? 'Save Changes' : 'Create Task'}</Button>
        </div>
      </form>
    </Modal>
  );
}

// ── Project detail (task list) ───────────────────────────────────────────────
function ProjectDetail({ project, members, onBack, onProjectChanged, user }) {
  const toast = useToast();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/website-work/tasks?project=${project._id}`);
      setTasks(data.tasks || []);
    } finally {
      setLoading(false);
    }
  }, [project._id]);

  useEffect(() => { load(); }, [load]);

  // Admins can manage any task. Developers can only edit/delete tasks they
  // created or are assigned to — not another developer's task.
  const canManageTask = (task) => {
    if (user?.role === 'admin') return true;
    if (user?.role === 'developer') {
      const uid = String(user._id);
      return String(task.createdBy?._id || task.createdBy) === uid ||
        String(task.assignedTo?._id || task.assignedTo) === uid;
    }
    return false;
  };

  const handleTaskSaved = (task, isNew) => {
    setTasks(prev => isNew ? [task, ...prev] : prev.map(t => t._id === task._id ? task : t));
    onProjectChanged();
  };

  const quickStatusChange = async (task, status) => {
    try {
      const { data } = await api.put(`/website-work/tasks/${task._id}`, { status });
      setTasks(prev => prev.map(t => t._id === task._id ? data.task : t));
      onProjectChanged();
    } catch (err) {
      toast({ type: 'error', title: 'Could not update status' });
    }
  };

  const confirmDelete = async () => {
    try {
      await api.delete(`/website-work/tasks/${deleteTarget._id}`);
      setTasks(prev => prev.filter(t => t._id !== deleteTarget._id));
      onProjectChanged();
      toast({ type: 'success', title: 'Task deleted' });
    } catch {
      toast({ type: 'error', title: 'Failed to delete task' });
    } finally {
      setDeleteTarget(null);
    }
  };

  const sm = PROJECT_STATUS[project.status] || PROJECT_STATUS.planning;

  return (
    <div className="space-y-5 animate-fade-in">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-[12.5px] font-medium hover:opacity-70 transition-opacity"
        style={{ color: 'var(--fd-ink-3)' }}
      >
        <ChevronLeft size={14} /> All Projects
      </button>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold" style={{ background: sm.bg, color: sm.color }}>
              {sm.label}
            </span>
          </div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--fd-ink-1)' }}>{project.name}</h1>
          {project.description && (
            <p className="text-sm mt-1 max-w-2xl" style={{ color: 'var(--fd-ink-3)' }}>{project.description}</p>
          )}
        </div>
        <Button onClick={() => { setEditingTask(null); setTaskModalOpen(true); }}>
          <Plus size={14} /> New Task
        </Button>
      </div>

      <Card className="p-4">
        <ProjectProgressBar stats={project.taskStats} />
      </Card>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : tasks.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title="No tasks yet"
          description="Add the first task for this project and assign it to a developer or any team member."
          action={<Button onClick={() => { setEditingTask(null); setTaskModalOpen(true); }}><Plus size={14} /> New Task</Button>}
        />
      ) : (
        <div className="space-y-2.5">
          {tasks.map(task => {
            const ts = TASK_STATUS[task.status] || TASK_STATUS.pending;
            const isOverdue = task.deadline && new Date(task.deadline) < new Date() && task.status !== 'completed';
            return (
              <div
                key={task._id}
                className="rounded-xl p-4 flex items-start gap-3 flex-wrap sm:flex-nowrap"
                style={{ background: 'var(--fd-surface)', border: `1px solid ${isOverdue ? 'rgba(239,68,68,0.3)' : 'var(--fd-border)'}` }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="font-semibold text-[14px]" style={{ color: 'var(--fd-ink-1)' }}>{task.title}</span>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{ background: ts.bg, color: ts.color }}>
                      {ts.label}
                    </span>
                    <span
                      className="px-2 py-0.5 rounded-full text-[10.5px] font-medium capitalize"
                      style={{ background: `${PRIORITY_COLORS[task.priority]}15`, color: PRIORITY_COLORS[task.priority] }}
                    >
                      {task.priority}
                    </span>
                    {isOverdue && <span className="text-[11px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">⚠ Overdue</span>}
                  </div>
                  {task.description && (
                    <p className="text-[12.5px] mb-2 line-clamp-2" style={{ color: 'var(--fd-ink-4)' }}>{task.description}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-3 text-[12px]" style={{ color: 'var(--fd-ink-4)' }}>
                    {task.assignedTo ? (
                      <span className="flex items-center gap-1.5">
                        <Avatar name={task.assignedTo.name} size="xs" />
                        {task.assignedTo.name}
                      </span>
                    ) : (
                      <span className="italic">Unassigned</span>
                    )}
                    {task.deadline && (
                      <span className="flex items-center gap-1">
                        <Calendar size={11} /> {formatDate(task.deadline)}
                      </span>
                    )}
                    <span>By {task.createdBy?.name || '—'}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0" onClick={e => e.stopPropagation()}>
                  {canManageTask(task) ? (
                    <>
                      <Select
                        value={task.status}
                        onChange={e => quickStatusChange(task, e.target.value)}
                        className="!w-auto text-[12px] py-1.5"
                      >
                        {Object.entries(TASK_STATUS).map(([v, s]) => <option key={v} value={v}>{s.label}</option>)}
                      </Select>
                      <button
                        onClick={() => { setEditingTask(task); setTaskModalOpen(true); }}
                        className="p-2 rounded-lg hover:bg-[var(--fd-surface-sunken)] transition-colors"
                        title="Edit task"
                      >
                        <Pencil size={14} style={{ color: 'var(--fd-ink-4)' }} />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(task)}
                        className="p-2 rounded-lg hover:bg-[var(--fd-surface-sunken)] transition-colors"
                        title="Delete task"
                      >
                        <Trash2 size={14} style={{ color: '#ef4444' }} />
                      </button>
                    </>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{ background: ts.bg, color: ts.color }}>
                      {ts.label}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <TaskModal
        isOpen={taskModalOpen}
        onClose={() => setTaskModalOpen(false)}
        onSaved={handleTaskSaved}
        editing={editingTask}
        project={project}
        members={members}
      />

      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Task" size="sm">
        <p className="text-[13px] mb-4" style={{ color: 'var(--fd-ink-3)' }}>
          Delete <strong>{deleteTarget?.title}</strong>? This can&apos;t be undone.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button variant="danger" onClick={confirmDelete}>Delete</Button>
        </div>
      </Modal>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function WebsiteWorkPage() {
  const { user } = useAuthStore();
  const toast = useToast();
  const [projects, setProjects] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeProject, setActiveProject] = useState(null);
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const loadProjects = useCallback(async () => {
    try {
      const { data } = await api.get('/website-work/projects');
      setProjects(data.projects || []);
      setActiveProject(prev => {
        if (!prev) return prev;
        return data.projects?.find(p => p._id === prev._id) || null;
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProjects();
    api.get('/users?limit=200').then(r => {
      const all = r.data.users || [];
      setMembers(all.filter(u => u._id !== user?._id));
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadProjects]);

  const handleProjectSaved = (project, isNew) => {
    setProjects(prev => isNew ? [project, ...prev] : prev.map(p => p._id === project._id ? { ...p, ...project } : p));
  };

  const confirmDeleteProject = async () => {
    try {
      await api.delete(`/website-work/projects/${deleteTarget._id}`);
      setProjects(prev => prev.filter(p => p._id !== deleteTarget._id));
      if (activeProject?._id === deleteTarget._id) setActiveProject(null);
      toast({ type: 'success', title: 'Project deleted' });
    } catch {
      toast({ type: 'error', title: 'Failed to delete project' });
    } finally {
      setDeleteTarget(null);
    }
  };

  const overallStats = useMemo(() => {
    const total = projects.reduce((s, p) => s + (p.taskStats?.total || 0), 0);
    const completed = projects.reduce((s, p) => s + (p.taskStats?.completed || 0), 0);
    const active = projects.filter(p => !['completed', 'cancelled'].includes(p.status)).length;
    return { total, completed, active, projects: projects.length };
  }, [projects]);

  if (activeProject) {
    return (
      <ProjectDetail
        project={activeProject}
        members={members}
        onBack={() => setActiveProject(null)}
        onProjectChanged={loadProjects}
        user={user}
      />
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        title="🖥️ Website Work"
        subtitle="Admin & developer only — projects, changes, and tasks that developers assign to each other and to the team."
        actions={
          <Button onClick={() => { setEditingProject(null); setProjectModalOpen(true); }}>
            <Plus size={14} /> New Project
          </Button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--fd-ink-4)' }}>Projects</div>
          <div className="text-2xl font-bold" style={{ color: 'var(--fd-ink-1)' }}>{overallStats.projects}</div>
        </Card>
        <Card className="p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--fd-ink-4)' }}>Active</div>
          <div className="text-2xl font-bold" style={{ color: '#4f6ef0' }}>{overallStats.active}</div>
        </Card>
        <Card className="p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--fd-ink-4)' }}>Total Tasks</div>
          <div className="text-2xl font-bold" style={{ color: 'var(--fd-ink-1)' }}>{overallStats.total}</div>
        </Card>
        <Card className="p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--fd-ink-4)' }}>Completed</div>
          <div className="text-2xl font-bold" style={{ color: '#22c55e' }}>{overallStats.completed}</div>
        </Card>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : projects.length === 0 ? (
        <EmptyState
          icon={Code2}
          title="No website projects yet"
          description="Create a project to start assigning and tracking website work between developers and the team."
          action={<Button onClick={() => { setEditingProject(null); setProjectModalOpen(true); }}><Plus size={14} /> New Project</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {projects.map(project => {
            const sm = PROJECT_STATUS[project.status] || PROJECT_STATUS.planning;
            return (
              <div
                key={project._id}
                className="rounded-xl p-4 cursor-pointer transition-all hover:shadow-md hover:scale-[1.01]"
                style={{ background: 'var(--fd-surface)', border: '1px solid var(--fd-border)' }}
                onClick={() => setActiveProject(project)}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold" style={{ background: sm.bg, color: sm.color }}>
                    {sm.label}
                  </span>
                  <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                    {(user?.role === 'admin' || String(project.createdBy?._id || project.createdBy) === String(user?._id)) && (
                      <>
                        <button
                          onClick={() => { setEditingProject(project); setProjectModalOpen(true); }}
                          className="p-1.5 rounded-lg hover:bg-[var(--fd-surface-sunken)] transition-colors"
                          title="Edit project"
                        >
                          <Pencil size={13} style={{ color: 'var(--fd-ink-4)' }} />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(project)}
                          className="p-1.5 rounded-lg hover:bg-[var(--fd-surface-sunken)] transition-colors"
                          title="Delete project"
                        >
                          <Trash2 size={13} style={{ color: '#ef4444' }} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <h3 className="font-bold text-[15px] mb-1" style={{ color: 'var(--fd-ink-1)' }}>{project.name}</h3>
                {project.description && (
                  <p className="text-[12.5px] mb-3 line-clamp-2" style={{ color: 'var(--fd-ink-4)' }}>{project.description}</p>
                )}
                <ProjectProgressBar stats={project.taskStats} />
                <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: '1px solid var(--fd-border)' }}>
                  <span className="text-[11px]" style={{ color: 'var(--fd-ink-5)' }}>
                    {project.createdBy?.name ? `Started by ${project.createdBy.name}` : ''}
                  </span>
                  <span className="flex items-center gap-1 text-[11.5px] font-medium" style={{ color: '#4f6ef0' }}>
                    View tasks <ChevronRight size={12} />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ProjectModal
        isOpen={projectModalOpen}
        onClose={() => setProjectModalOpen(false)}
        onSaved={handleProjectSaved}
        editing={editingProject}
      />

      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Project" size="sm">
        <p className="text-[13px] mb-4" style={{ color: 'var(--fd-ink-3)' }}>
          Delete <strong>{deleteTarget?.name}</strong> and all of its tasks? This can&apos;t be undone.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button variant="danger" onClick={confirmDeleteProject}>Delete Project</Button>
        </div>
      </Modal>
    </div>
  );
}