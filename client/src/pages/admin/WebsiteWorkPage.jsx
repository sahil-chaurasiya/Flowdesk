import React, { useEffect, useState, useCallback, useMemo } from 'react';
import ReactDOM from 'react-dom';
import {
  Code2, Plus, X, Trash2, Pencil, ChevronRight,
  AlertCircle, Calendar, Pin, GripVertical, Target, BarChart3,
  ChevronDown, ChevronUp, Loader2, Github, LayoutDashboard, Globe, ExternalLink,
  Terminal, Save,
} from 'lucide-react';
import api from '../../lib/api';
import useAuthStore from '../../context/authStore';
import { PageHeader, EmptyState, Card, Spinner, Avatar } from '../../components/shared/LoadingScreen';
import { Button, Modal, Input, Textarea, Select, useToast } from '../../components/ui/index';
import { formatDate, timeAgo } from '../../lib/utils';

// Terminal chrome — same dark "console" palette the Developer Dashboard uses
// for its dev-facing panels (contribution heatmap, stack.env, etc).
const TERM = {
  bg:     '#0d1117',
  header: '#161b22',
  border: '#30363d',
  text:   '#e6edf3',
  dim:    '#8b949e',
  green:  '#3fb950',
  amber:  '#d29922',
};
const MONO = "'JetBrains Mono', 'Fira Code', 'Ubuntu Mono', 'DejaVu Sans Mono', ui-monospace, Consolas, monospace";

const PROJECT_STATUS = {
  planning:    { label: 'Planning',    color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' },
  in_progress: { label: 'In Progress', color: 'var(--fd-accent)', bg: 'rgba(var(--fd-accent-rgb),0.12)' },
  on_hold:     { label: 'On Hold',     color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  review:      { label: 'In Review',   color: '#a855f7', bg: 'rgba(168,85,247,0.12)' },
  completed:   { label: 'Completed',   color: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
  cancelled:   { label: 'Cancelled',   color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
};

const TASK_STATUS = {
  today:       { label: 'Today',       color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  pending:     { label: 'Pending',     color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' },
  in_progress: { label: 'In Progress', color: 'var(--fd-accent)', bg: 'rgba(var(--fd-accent-rgb),0.1)' },
  review:      { label: 'In Review',   color: '#a855f7', bg: 'rgba(168,85,247,0.1)' },
  completed:   { label: 'Completed',   color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
  cancelled:   { label: 'Cancelled',   color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
};

const PRIORITY_COLORS = { low: '#a8a49e', medium: 'var(--fd-accent)', high: '#f59e0b', urgent: '#ef4444' };

const PROJECT_CATEGORIES = {
  office_project:  { label: 'Office Project',  icon: '🏢', color: 'var(--fd-accent)', bg: 'rgba(var(--fd-accent-rgb),0.12)' },
  client_project:  { label: 'Client Project',  icon: '💼', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
};

// ── Radial progress ring ──────────────────────────────────────────────────────
function ProgressRing({ value = 0, color = 'var(--fd-accent)', size = 72 }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (value / 100) * circ;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--fd-surface-sunken)" strokeWidth={5} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={5}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.6s ease' }}
      />
      <text
        x={size / 2} y={size / 2} textAnchor="middle" dominantBaseline="central"
        transform={`rotate(90, ${size / 2}, ${size / 2})`}
        fill="var(--fd-ink-1)" fontSize={size * 0.2} fontWeight={700}
      >
        {value}%
      </text>
    </svg>
  );
}

// ── Status progress bar ──────────────────────────────────────────────────────
function ProjectProgressBar({ stats }) {
  const total = stats?.total || 0;
  const segments = total
    ? [
        { key: 'completed',  value: stats.completed,  color: '#22c55e' },
        { key: 'review',     value: stats.review,     color: '#a855f7' },
        { key: 'inProgress', value: stats.inProgress, color: 'var(--fd-accent)' },
        { key: 'pending',    value: stats.pending,    color: '#94a3b8' },
        { key: 'cancelled',  value: stats.cancelled,  color: '#ef4444' },
      ]
    : [];

  // Mount at 0% and grow to the real width right after paint, so the bar
  // visibly fills in — same entrance as the Noori project cards.
  const [filled, setFilled] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setFilled(true), 60);
    return () => clearTimeout(t);
  }, []);

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
        className="w-full h-2 rounded-full overflow-hidden flex gap-[1px]"
        style={{ background: 'var(--fd-surface-sunken)' }}
      >
        {segments.map((s, i) => (
          s.value > 0 && (
            <div
              key={s.key}
              style={{
                width: filled ? `${(s.value / total) * 100}%` : '0%',
                background: s.color,
                height: '100%',
                boxShadow: `0 0 6px ${s.color}77`,
                transition: `width 0.9s cubic-bezier(0.22, 1, 0.36, 1) ${i * 0.08}s`,
              }}
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
  const [form, setForm] = useState({ name: '', description: '', status: 'planning', priority: 'medium', deadline: '', categories: [], repoUrl: '', adminUrl: '', liveUrl: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editing) {
      setForm({
        name: editing.name || '',
        description: editing.description || '',
        status: editing.status || 'planning',
        priority: editing.priority || 'medium',
        deadline: editing.deadline ? editing.deadline.split('T')[0] : '',
        categories: editing.categories || [],
        repoUrl: editing.repoUrl || '',
        adminUrl: editing.adminUrl || '',
        liveUrl: editing.liveUrl || '',
      });
    } else {
      setForm({ name: '', description: '', status: 'planning', priority: 'medium', deadline: '', categories: [], repoUrl: '', adminUrl: '', liveUrl: '' });
    }
  }, [editing, isOpen]);

  const toggleCategory = (value) => {
    setForm(p => ({
      ...p,
      categories: p.categories.includes(value)
        ? p.categories.filter(c => c !== value)
        : [...p.categories, value],
    }));
  };

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
        <div>
          <label className="block text-[12px] font-medium mb-1.5" style={{ color: 'var(--fd-ink-2)' }}>
            Category <span style={{ color: 'var(--fd-ink-5)', fontWeight: 400 }}>(pick one or more)</span>
          </label>
          <div className="flex gap-2 flex-wrap">
            {Object.entries(PROJECT_CATEGORIES).map(([value, cat]) => {
              const selected = form.categories.includes(value);
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => toggleCategory(value)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium border transition-all hover:scale-[1.03] active:scale-[0.97]"
                  style={selected
                    ? { background: cat.bg, color: cat.color, borderColor: cat.color }
                    : { background: 'transparent', color: 'var(--fd-ink-4)', borderColor: 'var(--fd-border)' }}
                >
                  <span>{cat.icon}</span>{cat.label}
                </button>
              );
            })}
          </div>
        </div>
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

        {/* Quick-reference links — optional, but power the Website Work
            drawer's link buttons and the Developer Dashboard's stack.env panel. */}
        <div className="space-y-3 pt-1 border-t" style={{ borderColor: 'var(--fd-border)' }}>
          <p className="text-[11px] font-semibold uppercase tracking-wider pt-3" style={{ color: 'var(--fd-ink-5)' }}>
            Links <span style={{ color: 'var(--fd-ink-5)', fontWeight: 400, textTransform: 'none' }}>(optional)</span>
          </p>
          <Input
            label="Repo URL"
            value={form.repoUrl}
            onChange={e => setForm(p => ({ ...p, repoUrl: e.target.value }))}
            placeholder="https://github.com/you/repo"
          />
          <Input
            label="Admin URL"
            value={form.adminUrl}
            onChange={e => setForm(p => ({ ...p, adminUrl: e.target.value }))}
            placeholder="https://admin.example.com"
          />
          <Input
            label="Live URL"
            value={form.liveUrl}
            onChange={e => setForm(p => ({ ...p, liveUrl: e.target.value }))}
            placeholder="https://example.com"
          />
        </div>

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

// ── Project detail drawer ────────────────────────────────────────────────────
// ── Scratchpad ────────────────────────────────────────────────────────────
// Freeform markdown notes panel — known issues / tech debt / TODOs for a
// project. Styled like a terminal text editor rather than a form field,
// matching the console aesthetic devs already get on the Developer Dashboard.
// Saves independently of the rest of the project (its own PUT call), so
// jotting a note never risks clobbering other project fields.
function ScratchpadPanel({ project, canEdit, onSaved }) {
  const toast = useToast();
  const [draft, setDraft] = useState(project.notes || '');
  const [saving, setSaving] = useState(false);
  const [focused, setFocused] = useState(false);

  // Re-sync the draft if a different project is swapped into this same
  // drawer instance, or if notes changed elsewhere (e.g. onProjectChanged
  // refresh after another save).
  useEffect(() => { setDraft(project.notes || ''); }, [project._id, project.notes]);

  const dirty = draft !== (project.notes || '');

  const save = async () => {
    if (!dirty || saving) return;
    setSaving(true);
    try {
      const { data } = await api.put(`/website-work/projects/${project._id}`, { notes: draft });
      onSaved(data.project);
      toast({ type: 'success', title: 'Notes saved' });
    } catch (err) {
      toast({ type: 'error', title: 'Failed to save notes', message: err.response?.data?.message });
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      save();
    }
  };

  const lineCount = Math.max(draft.split('\n').length, 1);

  return (
    <section>
      <p className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--fd-ink-5)' }}>
        Scratchpad
      </p>
      <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${TERM.border}`, background: TERM.bg }}>
        {/* Title bar */}
        <div className="flex items-center gap-2 px-3 py-2" style={{ background: TERM.header, borderBottom: `1px solid ${TERM.border}` }}>
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#ff5f56' }} />
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#ffbd2e' }} />
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#27c93f' }} />
          <span className="flex items-center gap-1.5 ml-2 min-w-0" style={{ fontFamily: MONO, fontSize: 11, color: TERM.dim }}>
            <Terminal size={11} className="flex-shrink-0" />
            <span className="truncate">notes.md{dirty ? ' •' : ''}</span>
          </span>
          <span className="ml-auto flex items-center gap-2 flex-shrink-0" style={{ fontFamily: MONO, fontSize: 10.5, color: TERM.dim }}>
            {project.notesUpdatedAt && !dirty && <span>edited {timeAgo(project.notesUpdatedAt)}</span>}
            {canEdit && (
              <button
                onClick={save}
                disabled={!dirty || saving}
                className="flex items-center gap-1 px-2 py-0.5 rounded-md font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ color: dirty ? TERM.green : TERM.dim, background: dirty ? 'rgba(63,185,80,0.12)' : 'transparent' }}
                title="Save notes (Ctrl+S)"
              >
                {saving ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
                :wq
              </button>
            )}
          </span>
        </div>

        {/* Body */}
        {canEdit ? (
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setFocused(true)}
            onBlur={() => { setFocused(false); save(); }}
            placeholder={'# known issues\n\n# tech debt\n\n# todo\n'}
            rows={8}
            className="w-full px-3 py-2.5 resize-y outline-none bg-transparent"
            style={{ fontFamily: MONO, fontSize: 12.5, lineHeight: 1.6, color: TERM.text, caretColor: TERM.green }}
          />
        ) : draft ? (
          <pre className="w-full px-3 py-2.5 whitespace-pre-wrap break-words" style={{ fontFamily: MONO, fontSize: 12.5, lineHeight: 1.6, color: TERM.text }}>
            {draft}
          </pre>
        ) : (
          <p className="px-3 py-2.5 italic" style={{ fontFamily: MONO, fontSize: 12, color: TERM.dim }}>
            -- no notes yet --
          </p>
        )}

        {/* Status bar */}
        <div
          className="flex items-center justify-between px-3 py-1"
          style={{ background: TERM.header, borderTop: `1px solid ${TERM.border}`, fontFamily: MONO, fontSize: 10, color: TERM.dim }}
        >
          <span style={{ color: canEdit && focused ? TERM.amber : TERM.dim }}>
            {canEdit ? (focused ? '-- INSERT --' : dirty ? '-- unsaved --' : '-- NORMAL --') : '-- READ ONLY --'}
          </span>
          <span>{lineCount} ln, {draft.length} ch</span>
        </div>
      </div>
    </section>
  );
}

function ProjectDrawer({ project, members, onClose, onProjectChanged, onEdit, onDelete, user }) {
  const toast = useToast();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tasksExpanded, setTasksExpanded] = useState(true);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [deleteTaskTarget, setDeleteTaskTarget] = useState(null);

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

  const canManageProject = user?.role === 'admin' || String(project.createdBy?._id || project.createdBy) === String(user?._id);

  const handleTaskSaved = (task, isNew) => {
    setTasks(prev => isNew ? [task, ...prev] : prev.map(t => t._id === task._id ? task : t));
    onProjectChanged();
  };

  const quickStatusChange = async (task, status) => {
    try {
      const { data } = await api.put(`/website-work/tasks/${task._id}`, { status });
      setTasks(prev => prev.map(t => t._id === task._id ? data.task : t));
      onProjectChanged();
    } catch {
      toast({ type: 'error', title: 'Could not update status' });
    }
  };

  const confirmDeleteTask = async () => {
    try {
      await api.delete(`/website-work/tasks/${deleteTaskTarget._id}`);
      setTasks(prev => prev.filter(t => t._id !== deleteTaskTarget._id));
      onProjectChanged();
      toast({ type: 'success', title: 'Task deleted' });
    } catch {
      toast({ type: 'error', title: 'Failed to delete task' });
    } finally {
      setDeleteTaskTarget(null);
    }
  };

  const handleEditProject = () => {
    onClose();
    setTimeout(() => onEdit(project), 100);
  };

  const handleDeleteProject = () => {
    onClose();
    onDelete(project);
  };

  const sm = PROJECT_STATUS[project.status] || PROJECT_STATUS.planning;
  const done = tasks.filter(t => t.status === 'completed').length;
  const stats = project.taskStats || {};

  return ReactDOM.createPortal(
    <>
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] animate-fade-in" onClick={onClose} />
      <div
        className="fixed right-0 top-0 bottom-0 z-50 flex flex-col shadow-2xl animate-slide-in-right"
        style={{ width: 'min(480px, 100vw)', background: 'var(--fd-surface)', borderLeft: '1px solid var(--fd-border)' }}
      >
        {/* Header */}
        <div className="flex items-start gap-3 px-5 py-4 border-b flex-shrink-0" style={{ borderColor: 'var(--fd-border)' }}>
          <div className="h-3 w-3 rounded-full mt-1.5 flex-shrink-0" style={{ background: sm.color }} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{ background: sm.bg, color: sm.color }}>
                {sm.label}
              </span>
              {project.pinned && (
                <span className="inline-flex items-center gap-1 text-[10.5px] font-bold uppercase tracking-wider" style={{ color: '#f59e0b' }}>
                  <Pin size={10} fill="#f59e0b" /> Pinned
                </span>
              )}
            </div>
            <h2 className="text-[17px] font-bold leading-snug break-words" style={{ color: 'var(--fd-ink-1)' }}>{project.name}</h2>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {canManageProject && (
              <>
                <button onClick={handleEditProject} className="p-1.5 rounded-lg hover:bg-[var(--fd-surface-sunken)] transition-colors" title="Edit project">
                  <Pencil size={15} style={{ color: 'var(--fd-ink-4)' }} />
                </button>
                <button onClick={handleDeleteProject} className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors" title="Delete project">
                  <Trash2 size={15} style={{ color: '#ef4444' }} />
                </button>
              </>
            )}
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--fd-surface-sunken)] transition-colors" title="Close">
              <X size={16} style={{ color: 'var(--fd-ink-4)' }} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl p-3 flex flex-col items-center justify-center gap-1" style={{ background: 'var(--fd-surface-sunken)', border: '1px solid var(--fd-border)' }}>
              <ProgressRing value={stats.progress || 0} color={sm.color} size={64} />
              <p className="text-[10.5px]" style={{ color: 'var(--fd-ink-5)' }}>progress</p>
            </div>
            <div className="rounded-xl p-3 flex flex-col justify-center" style={{ background: 'var(--fd-surface-sunken)', border: '1px solid var(--fd-border)' }}>
              <p className="text-xl font-bold" style={{ color: 'var(--fd-ink-1)' }}>
                {stats.completed || 0}<span className="text-[13px] font-normal" style={{ color: 'var(--fd-ink-5)' }}>/{stats.total || 0}</span>
              </p>
              <p className="text-[10.5px] mt-0.5 flex items-center gap-1" style={{ color: 'var(--fd-ink-5)' }}>
                <Target size={10} /> Completed
              </p>
            </div>
            <div className="rounded-xl p-3 flex flex-col justify-center" style={{ background: 'var(--fd-surface-sunken)', border: '1px solid var(--fd-border)' }}>
              <p className="text-xl font-bold" style={{ color: 'var(--fd-ink-1)' }}>{stats.total || 0}</p>
              <p className="text-[10.5px] mt-0.5 flex items-center gap-1" style={{ color: 'var(--fd-ink-5)' }}>
                <BarChart3 size={10} /> Total tasks
              </p>
            </div>
          </div>

          {/* Categories */}
          {project.categories?.length > 0 && (
            <section>
              <p className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--fd-ink-5)' }}>Category</p>
              <div className="flex gap-2 flex-wrap">
                {project.categories.map(cat => {
                  const meta = PROJECT_CATEGORIES[cat];
                  if (!meta) return null;
                  return (
                    <span key={cat} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11.5px] font-semibold" style={{ background: meta.bg, color: meta.color }}>
                      {meta.icon} {meta.label}
                    </span>
                  );
                })}
              </div>
            </section>
          )}

          {/* Description */}
          {project.description && (
            <section>
              <p className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--fd-ink-5)' }}>Description</p>
              <p className="text-[13px] leading-relaxed" style={{ color: 'var(--fd-ink-2)', whiteSpace: 'pre-wrap' }}>{project.description}</p>
            </section>
          )}

          {/* Priority + deadline */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl p-3" style={{ background: 'var(--fd-surface-sunken)', border: '1px solid var(--fd-border)' }}>
              <div className="flex items-center gap-1.5 mb-1"><AlertCircle size={11} style={{ color: 'var(--fd-ink-4)' }} /><span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--fd-ink-4)' }}>Priority</span></div>
              <div className="text-[13px] font-semibold capitalize" style={{ color: PRIORITY_COLORS[project.priority] }}>{project.priority}</div>
            </div>
            {project.deadline && (
              <div className="rounded-xl p-3" style={{ background: 'var(--fd-surface-sunken)', border: '1px solid var(--fd-border)' }}>
                <div className="flex items-center gap-1.5 mb-1"><Calendar size={11} style={{ color: 'var(--fd-ink-4)' }} /><span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--fd-ink-4)' }}>Deadline</span></div>
                <div className="text-[13px] font-semibold" style={{ color: 'var(--fd-ink-1)' }}>{formatDate(project.deadline)}</div>
              </div>
            )}
          </div>

          {/* Quick links */}
          {(project.repoUrl || project.adminUrl || project.liveUrl) && (
            <section>
              <p className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--fd-ink-5)' }}>Links</p>
              <div className="flex flex-col gap-1.5">
                {[
                  { url: project.repoUrl, label: 'Repository', icon: Github },
                  { url: project.adminUrl, label: 'Admin panel', icon: LayoutDashboard },
                  { url: project.liveUrl, label: 'Live site', icon: Globe },
                ].filter(l => l.url).map(l => (
                  <a
                    key={l.label}
                    href={l.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-2 rounded-xl text-[12.5px] font-medium transition-colors hover:bg-[var(--fd-surface-sunken)] group"
                    style={{ border: '1px solid var(--fd-border)', color: 'var(--fd-ink-2)' }}
                  >
                    <l.icon size={14} style={{ color: 'var(--fd-ink-4)' }} />
                    <span className="flex-1 truncate">{l.label}</span>
                    <ExternalLink size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--fd-ink-5)' }} />
                  </a>
                ))}
              </div>
            </section>
          )}

          {/* Scratchpad */}
          <ScratchpadPanel project={project} canEdit={canManageProject} onSaved={() => onProjectChanged()} />

          {/* Linked tasks */}
          <section>
            <button onClick={() => setTasksExpanded(e => !e)} className="w-full flex items-center justify-between mb-3 group">
              <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--fd-ink-5)' }}>
                Tasks {tasks.length > 0 && <span className="font-normal normal-case tracking-normal">({done}/{tasks.length} done)</span>}
              </p>
              {tasksExpanded ? <ChevronUp size={14} style={{ color: 'var(--fd-ink-5)' }} /> : <ChevronDown size={14} style={{ color: 'var(--fd-ink-5)' }} />}
            </button>

            {tasksExpanded && (
              loading ? (
                <div className="flex items-center gap-2 text-[12px] py-4 justify-center" style={{ color: 'var(--fd-ink-5)' }}>
                  <Loader2 size={13} className="animate-spin" /> Loading tasks…
                </div>
              ) : tasks.length === 0 ? (
                <p className="text-[12.5px] italic py-2" style={{ color: 'var(--fd-ink-5)' }}>No tasks linked to this project yet.</p>
              ) : (
                <div className="space-y-2">
                  {tasks.map(task => {
                    const ts = TASK_STATUS[task.status] || TASK_STATUS.pending;
                    const isOverdue = task.deadline && new Date(task.deadline) < new Date() && task.status !== 'completed';
                    return (
                      <div
                        key={task._id}
                        className="rounded-xl p-3 w-full"
                        style={{ background: 'var(--fd-surface-sunken)', border: `1px solid ${isOverdue ? 'rgba(239,68,68,0.3)' : 'var(--fd-border)'}` }}
                      >
                        <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                          <span className="font-semibold text-[13px] break-words" style={{ color: 'var(--fd-ink-1)' }}>{task.title}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 mb-2">
                          <span className="px-2 py-0.5 rounded-full text-[10.5px] font-semibold" style={{ background: ts.bg, color: ts.color }}>
                            {ts.label}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium capitalize" style={{ background: `${PRIORITY_COLORS[task.priority]}15`, color: PRIORITY_COLORS[task.priority] }}>
                            {task.priority}
                          </span>
                          {isOverdue && <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">⚠ Overdue</span>}
                        </div>
                        {task.description && (
                          <p className="text-[12px] mb-2 line-clamp-2" style={{ color: 'var(--fd-ink-4)' }}>{task.description}</p>
                        )}
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] mb-2" style={{ color: 'var(--fd-ink-4)' }}>
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
                              <Calendar size={10} /> {formatDate(task.deadline)}
                            </span>
                          )}
                          <span>By {task.createdBy?.name || '—'}</span>
                        </div>

                        {canManageTask(task) && (
                          <div className="flex items-center gap-2 flex-wrap pt-2" style={{ borderTop: '1px solid var(--fd-border)' }} onClick={e => e.stopPropagation()}>
                            <Select
                              value={task.status}
                              onChange={e => quickStatusChange(task, e.target.value)}
                              className="!w-auto text-[11.5px] py-1 flex-shrink-0"
                            >
                              {Object.entries(TASK_STATUS).map(([v, s]) => <option key={v} value={v}>{s.label}</option>)}
                            </Select>
                            <button
                              onClick={() => { setEditingTask(task); setTaskModalOpen(true); }}
                              className="p-1.5 rounded-lg hover:bg-[var(--fd-surface)] transition-colors ml-auto"
                              title="Edit task"
                            >
                              <Pencil size={13} style={{ color: 'var(--fd-ink-4)' }} />
                            </button>
                            <button
                              onClick={() => setDeleteTaskTarget(task)}
                              className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
                              title="Delete task"
                            >
                              <Trash2 size={13} style={{ color: '#ef4444' }} />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )
            )}
          </section>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t flex-shrink-0" style={{ borderColor: 'var(--fd-border)' }}>
          <Button className="w-full" onClick={() => { setEditingTask(null); setTaskModalOpen(true); }}>
            <Plus size={14} /> New Task
          </Button>
        </div>
      </div>

      <TaskModal
        isOpen={taskModalOpen}
        onClose={() => setTaskModalOpen(false)}
        onSaved={handleTaskSaved}
        editing={editingTask}
        project={project}
        members={members}
      />

      <Modal isOpen={!!deleteTaskTarget} onClose={() => setDeleteTaskTarget(null)} title="Delete Task" size="sm">
        <p className="text-[13px] mb-4" style={{ color: 'var(--fd-ink-3)' }}>
          Delete <strong>{deleteTaskTarget?.title}</strong>? This can&apos;t be undone.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setDeleteTaskTarget(null)}>Cancel</Button>
          <Button variant="danger" onClick={confirmDeleteTask}>Delete</Button>
        </div>
      </Modal>
    </>,
    document.body
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
// ── Project card ──────────────────────────────────────────────────────────────
function ProjectCard({ project, user, onView, onEdit, onDelete, onPin, dragging, style }) {
  const sm = PROJECT_STATUS[project.status] || PROJECT_STATUS.planning;
  const canManage = user?.role === 'admin' || String(project.createdBy?._id || project.createdBy) === String(user?._id);

  return (
    <div
      className={`group relative rounded-[20px] p-5 cursor-pointer transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-2xl ${dragging ? 'opacity-40 scale-95' : ''}`}
      style={{
        background: 'var(--fd-surface)',
        border: `1px solid ${project.pinned ? 'rgba(245,158,11,0.4)' : 'var(--fd-border)'}`,
        ...style,
      }}
      onClick={() => onView(project)}
    >
      {/* Header row — status + category on the left, actions on the right */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold" style={{ background: sm.bg, color: sm.color }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: sm.color }} />
            {sm.label}
          </span>
          {project.categories?.map(cat => {
            const meta = PROJECT_CATEGORIES[cat];
            if (!meta) return null;
            return (
              <span key={cat} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold" style={{ background: meta.bg, color: meta.color }}>
                {meta.icon} {meta.label}
              </span>
            );
          })}
        </div>
        <div className="flex items-center gap-0.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
          <button
            onClick={() => onPin(project)}
            className={`p-1.5 rounded-lg transition-all ${project.pinned ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} hover:scale-110`}
            style={{ color: project.pinned ? '#f59e0b' : 'var(--fd-ink-5)' }}
            title={project.pinned ? 'Unpin project' : 'Pin to top'}
          >
            <Pin size={13} fill={project.pinned ? '#f59e0b' : 'none'} />
          </button>
          {canManage && (
            <>
              <button
                onClick={() => onEdit(project)}
                className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-[var(--fd-surface-sunken)] transition-all"
                title="Edit project"
              >
                <Pencil size={13} style={{ color: 'var(--fd-ink-4)' }} />
              </button>
              <button
                onClick={() => onDelete(project)}
                className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-500/10 transition-all"
                title="Delete project"
              >
                <Trash2 size={13} style={{ color: '#ef4444' }} />
              </button>
            </>
          )}
        </div>
      </div>

      <h3 className="font-bold text-[16px] leading-snug mb-1 truncate" style={{ color: 'var(--fd-ink-1)' }}>{project.name}</h3>

      {(project.repoUrl || project.adminUrl || project.liveUrl) && (
        <div className="flex items-center gap-1.5 mb-2.5" onClick={e => e.stopPropagation()}>
          {[
            { url: project.repoUrl, label: 'Repository', icon: Github },
            { url: project.adminUrl, label: 'Admin panel', icon: LayoutDashboard },
            { url: project.liveUrl, label: 'Live site', icon: Globe },
          ].filter(l => l.url).map(l => (
            <a
              key={l.label}
              href={l.url}
              target="_blank"
              rel="noopener noreferrer"
              title={l.label}
              className="p-1.5 rounded-lg transition-colors hover:bg-[var(--fd-surface-sunken)]"
              style={{ border: '1px solid var(--fd-border)', color: 'var(--fd-ink-4)' }}
            >
              <l.icon size={12.5} />
            </a>
          ))}
        </div>
      )}

      {project.description && (
        <p className="text-[12.5px] leading-relaxed mb-4 line-clamp-2" style={{ color: 'var(--fd-ink-4)' }}>{project.description}</p>
      )}

      <div className={project.description ? '' : 'mt-1'}>
        <ProjectProgressBar stats={project.taskStats} />
      </div>

      <div className="flex items-center justify-between mt-4 pt-3.5" style={{ borderTop: '1px solid var(--fd-border)' }}>
        <div className="flex items-center gap-1.5 min-w-0">
          {project.createdBy?.name && (
            <>
              <Avatar name={project.createdBy.name} size="xs" />
              <span className="text-[11px] truncate" style={{ color: 'var(--fd-ink-5)' }}>{project.createdBy.name}</span>
            </>
          )}
        </div>
        <span
          className="flex items-center gap-1 text-[11.5px] font-semibold flex-shrink-0 px-2.5 py-1 rounded-full transition-all group-hover:gap-1.5"
          style={{ color: 'var(--fd-accent)', background: 'rgba(var(--fd-accent-rgb),0.08)' }}
        >
          View tasks <ChevronRight size={12} />
        </span>
      </div>
    </div>
  );
}

// ── Pinned section — drag & drop to reorder ─────────────────────────────────
function PinnedSection({ pinned, user, onView, onEdit, onDelete, onPin, onReorder }) {
  const [draggingIdx, setDraggingIdx] = useState(null);
  const [overIdx, setOverIdx] = useState(null);

  if (pinned.length === 0) return null;

  const handleDragStart = (e, idx) => {
    setDraggingIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
  };
  const handleDragOver = (e, idx) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (overIdx !== idx) setOverIdx(idx);
  };
  const handleDrop = (e, toIdx) => {
    e.preventDefault();
    const fromIdx = draggingIdx;
    setDraggingIdx(null);
    setOverIdx(null);
    if (fromIdx === null || fromIdx === toIdx) return;
    const reordered = [...pinned];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    onReorder(reordered.map(p => p._id));
  };
  const handleDragEnd = () => { setDraggingIdx(null); setOverIdx(null); };

  return (
    <div className="animate-fade-up">
      <div className="flex items-center gap-2 mb-3">
        <Pin size={13} style={{ color: '#f59e0b' }} fill="#f59e0b" />
        <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: '#f59e0b' }}>Pinned</p>
        {pinned.length > 1 && (
          <p className="text-[11px] ml-auto flex items-center gap-1" style={{ color: 'var(--fd-ink-5)' }}>
            <GripVertical size={11} /> drag to reorder
          </p>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {pinned.map((p, idx) => (
          <div
            key={p._id}
            draggable
            onDragStart={e => handleDragStart(e, idx)}
            onDragOver={e => handleDragOver(e, idx)}
            onDrop={e => handleDrop(e, idx)}
            onDragEnd={handleDragEnd}
            className={`transition-all rounded-[20px] ${overIdx === idx && draggingIdx !== idx ? 'ring-2 ring-amber-400/50' : ''}`}
          >
            <ProjectCard
              project={p}
              user={user}
              onView={onView}
              onEdit={onEdit}
              onDelete={onDelete}
              onPin={onPin}
              dragging={draggingIdx === idx}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function WebsiteWorkPage() {
  const { user } = useAuthStore();
  const toast = useToast();
  const [projects, setProjects] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewingProject, setViewingProject] = useState(null);
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [activeCategory, setActiveCategory] = useState(null);

  const loadProjects = useCallback(async () => {
    try {
      const { data } = await api.get('/website-work/projects');
      setProjects(data.projects || []);
      setViewingProject(prev => {
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
      if (viewingProject?._id === deleteTarget._id) setViewingProject(null);
      toast({ type: 'success', title: 'Project deleted' });
    } catch {
      toast({ type: 'error', title: 'Failed to delete project' });
    } finally {
      setDeleteTarget(null);
    }
  };

  const handlePin = useCallback(async (project) => {
    try {
      const { data } = await api.patch(`/website-work/projects/${project._id}/pin`);
      setProjects(prev => {
        const updated = prev.map(p => p._id === project._id ? { ...p, ...data.project } : p);
        return updated.sort((a, b) => {
          if (a.pinned && !b.pinned) return -1;
          if (!a.pinned && b.pinned) return 1;
          if (a.pinned && b.pinned) return a.pinOrder - b.pinOrder;
          return new Date(b.createdAt) - new Date(a.createdAt);
        });
      });
    } catch {
      toast({ type: 'error', title: 'Failed to update pin' });
    }
  }, [toast]);

  const handleReorder = useCallback(async (orderedIds) => {
    setProjects(prev => {
      const orderMap = {};
      orderedIds.forEach((id, idx) => { orderMap[id] = idx; });
      return [...prev].sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        if (a.pinned && b.pinned) return (orderMap[a._id] ?? 99) - (orderMap[b._id] ?? 99);
        return new Date(b.createdAt) - new Date(a.createdAt);
      });
    });
    try {
      await api.patch('/website-work/projects/reorder-pins', { orderedIds });
    } catch {
      toast({ type: 'error', title: 'Failed to save new order' });
      loadProjects();
    }
  }, [toast, loadProjects]);

  const overallStats = useMemo(() => {
    const total = projects.reduce((s, p) => s + (p.taskStats?.total || 0), 0);
    const completed = projects.reduce((s, p) => s + (p.taskStats?.completed || 0), 0);
    const active = projects.filter(p => !['completed', 'cancelled'].includes(p.status)).length;
    return { total, completed, active, projects: projects.length };
  }, [projects]);

  const filteredProjects = activeCategory
    ? projects.filter(p => p.categories?.includes(activeCategory))
    : projects;
  const pinnedProjects = filteredProjects.filter(p => p.pinned);
  const restProjects = filteredProjects.filter(p => !p.pinned);

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
          <div className="text-2xl font-bold" style={{ color: 'var(--fd-accent)' }}>{overallStats.active}</div>
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

      {/* Category filter tabs */}
      {projects.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setActiveCategory(null)}
            className="px-3 py-1.5 rounded-full text-[12px] font-medium border transition-all hover:scale-[1.03] active:scale-[0.97]"
            style={activeCategory === null
              ? { background: 'var(--fd-surface-sunken)', color: 'var(--fd-ink-1)', borderColor: 'var(--fd-ink-4)' }
              : { background: 'transparent', color: 'var(--fd-ink-4)', borderColor: 'var(--fd-border)' }}
          >
            All
          </button>
          {Object.entries(PROJECT_CATEGORIES).map(([value, cat]) => (
            <button
              key={value}
              onClick={() => setActiveCategory(prev => prev === value ? null : value)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium border transition-all hover:scale-[1.03] active:scale-[0.97]"
              style={activeCategory === value
                ? { background: cat.bg, color: cat.color, borderColor: cat.color }
                : { background: 'transparent', color: 'var(--fd-ink-4)', borderColor: 'var(--fd-border)' }}
            >
              {cat.icon} {cat.label}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : filteredProjects.length === 0 ? (
        <EmptyState
          icon={Code2}
          title={activeCategory ? 'No projects in this category yet' : 'No website projects yet'}
          description="Create a project to start assigning and tracking website work between developers and the team."
          action={<Button onClick={() => { setEditingProject(null); setProjectModalOpen(true); }}><Plus size={14} /> New Project</Button>}
        />
      ) : (
        <div className="space-y-6">
          {pinnedProjects.length > 0 && (
            <PinnedSection
              pinned={pinnedProjects}
              user={user}
              onView={setViewingProject}
              onEdit={p => { setEditingProject(p); setProjectModalOpen(true); }}
              onDelete={setDeleteTarget}
              onPin={handlePin}
              onReorder={handleReorder}
            />
          )}

          {restProjects.length > 0 && (
            <div>
              {pinnedProjects.length > 0 && (
                <p className="text-[11px] font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--fd-ink-5)' }}>Other Projects</p>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {restProjects.map((project, idx) => (
                  <ProjectCard
                    key={project._id}
                    project={project}
                    user={user}
                    onView={setViewingProject}
                    onEdit={p => { setEditingProject(p); setProjectModalOpen(true); }}
                    onDelete={setDeleteTarget}
                    onPin={handlePin}
                    style={{ animation: `fade-up 0.3s ease-out both`, animationDelay: `${Math.min(idx * 40, 240)}ms` }}
                  />
                ))}
              </div>
            </div>
          )}
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

      {viewingProject && (
        <ProjectDrawer
          project={viewingProject}
          members={members}
          onClose={() => setViewingProject(null)}
          onProjectChanged={loadProjects}
          onEdit={p => { setEditingProject(p); setProjectModalOpen(true); }}
          onDelete={p => setDeleteTarget(p)}
          user={user}
        />
      )}
    </div>
  );
}