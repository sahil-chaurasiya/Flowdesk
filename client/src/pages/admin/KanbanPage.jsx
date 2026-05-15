import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Plus, GripVertical, AlertCircle, Clock, CheckCircle, X, Target } from 'lucide-react';
import api from '../../lib/api';
import { useToast } from '../../components/ui/index';
import { Button, Modal } from '../../components/ui/index';
import { Spinner, EmptyState } from '../../components/shared/LoadingScreen';
import { formatDate } from '../../lib/utils';

const COLUMNS = [
  { id: 'pending',     label: 'To Do',       color: '#f59e0b', icon: AlertCircle },
  { id: 'in_progress', label: 'In Progress',  color: '#4f6ef0', icon: Clock },
  { id: 'review',      label: 'In Review',    color: '#a855f7', icon: Target },
  { id: 'completed',   label: 'Completed',    color: '#22c55e', icon: CheckCircle },
];

const PRIORITY_COLORS = {
  low: '#a8a49e', medium: '#4f6ef0', high: '#f59e0b', urgent: '#ef4444',
};

function TaskCard({ task, onDragStart }) {
  const isOverdue = task.deadline && new Date(task.deadline) < new Date() && task.status !== 'completed';

  return (
    <div
      draggable
      onDragStart={e => onDragStart(e, task)}
      className="rounded-xl p-3.5 cursor-grab active:cursor-grabbing transition-all select-none group"
      style={{
        background: 'var(--fd-surface)',
        border: '1px solid var(--fd-border)',
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      }}
    >
      {/* Priority dot + title */}
      <div className="flex items-start gap-2">
        <div
          className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5"
          style={{ background: PRIORITY_COLORS[task.priority] || '#aaa' }}
        />
        <div className="flex-1 min-w-0">
          <div className="text-[12.5px] font-medium leading-snug" style={{ color: 'var(--fd-ink-1)' }}>
            {task.title}
          </div>
          {task.client?.company && (
            <div className="text-[11px] mt-0.5" style={{ color: 'var(--fd-ink-4)' }}>
              {task.client.company}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-2.5 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {task.assignedTo && (
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0"
              style={{ background: 'var(--fd-sidebar-active)', color: 'var(--fd-sidebar-link-active)' }}
              title={task.assignedTo.name}
            >
              {task.assignedTo.name?.charAt(0)?.toUpperCase()}
            </div>
          )}
          {task.deadline && (
            <span
              className="text-[10.5px] font-medium"
              style={{ color: isOverdue ? '#ef4444' : 'var(--fd-ink-5)' }}
            >
              {isOverdue ? '⚠ ' : ''}{formatDate(task.deadline)}
            </span>
          )}
        </div>
        <span
          className="text-[10px] font-medium px-1.5 py-0.5 rounded"
          style={{ background: `${PRIORITY_COLORS[task.priority]}18`, color: PRIORITY_COLORS[task.priority] }}
        >
          {task.priority}
        </span>
      </div>
    </div>
  );
}

function Column({ column, tasks, onDrop, onDragOver, onDragStart, updating }) {
  const Icon = column.icon;
  const count = tasks.length;

  return (
    <div
      className="flex flex-col rounded-xl overflow-hidden flex-shrink-0 w-64"
      style={{
        background: 'var(--fd-surface-sunken)',
        border: '1px solid var(--fd-border)',
        minHeight: 400,
      }}
      onDrop={e => onDrop(e, column.id)}
      onDragOver={onDragOver}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3.5 py-3 border-b flex-shrink-0"
        style={{ borderColor: 'var(--fd-border)' }}
      >
        <div
          className="w-5 h-5 rounded flex items-center justify-center"
          style={{ background: `${column.color}18` }}
        >
          <Icon size={11} style={{ color: column.color }} />
        </div>
        <span className="text-[12.5px] font-semibold flex-1" style={{ color: 'var(--fd-ink-1)' }}>
          {column.label}
        </span>
        {count > 0 && (
          <span
            className="text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center"
            style={{ background: `${column.color}20`, color: column.color }}
          >
            {count}
          </span>
        )}
        {updating === column.id && <Spinner size="xs" />}
      </div>

      {/* Cards */}
      <div className="flex-1 p-2.5 space-y-2 overflow-y-auto">
        {tasks.length === 0 && (
          <div
            className="text-[11.5px] text-center py-8 rounded-lg border-2 border-dashed"
            style={{ color: 'var(--fd-ink-5)', borderColor: 'var(--fd-border)' }}
          >
            Drop tasks here
          </div>
        )}
        {tasks.map(task => (
          <TaskCard key={task._id} task={task} onDragStart={onDragStart} />
        ))}
      </div>
    </div>
  );
}

export default function KanbanPage() {
  const toast = useToast();
  const [tasks, setTasks]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [updating, setUpdating] = useState(null);
  const [filter, setFilter]     = useState('');
  const dragTask = useRef(null);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/tasks?limit=200');
      setTasks(data.tasks || []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const onDragStart = (e, task) => {
    dragTask.current = task;
    e.dataTransfer.effectAllowed = 'move';
  };

  const onDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const onDrop = async (e, newStatus) => {
    e.preventDefault();
    const task = dragTask.current;
    if (!task || task.status === newStatus) return;

    // Optimistic update
    setTasks(prev => prev.map(t => t._id === task._id ? { ...t, status: newStatus } : t));
    setUpdating(newStatus);

    try {
      await api.put(`/tasks/${task._id}`, { status: newStatus });
      toast({ type: 'success', title: 'Task moved', message: `"${task.title}" → ${newStatus.replace('_', ' ')}` });
    } catch (err) {
      // Rollback
      setTasks(prev => prev.map(t => t._id === task._id ? { ...t, status: task.status } : t));
      toast({ type: 'error', title: 'Failed to move task', message: err?.response?.data?.message });
    } finally {
      setUpdating(null);
      dragTask.current = null;
    }
  };

  const filtered = filter
    ? tasks.filter(t => t.client?.company?.toLowerCase().includes(filter.toLowerCase()) || t.title.toLowerCase().includes(filter.toLowerCase()))
    : tasks;

  const byStatus = (status) => filtered.filter(t => t.status === status);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold tracking-[-0.02em]" style={{ color: 'var(--fd-ink-1)' }}>
            Kanban Board
          </h1>
          <p className="text-[13px] mt-1" style={{ color: 'var(--fd-ink-4)' }}>
            Drag and drop tasks to update their status
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Filter tasks…"
            className="fd-input text-[12.5px] w-44"
          />
          <Button variant="secondary" size="sm" onClick={fetchTasks}>
            Refresh
          </Button>
        </div>
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
          />
        ))}
      </div>

      {tasks.length === 0 && (
        <EmptyState
          icon={CheckCircle}
          title="No tasks yet"
          description="Create tasks from the Tasks page to see them here."
        />
      )}
    </div>
  );
}
