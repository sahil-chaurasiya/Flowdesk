import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import ReactDOM from 'react-dom';
import {
  ListChecks, Clock, CheckCircle, AlertCircle, Play,
  X, Calendar, User, Tag, Flag, Building2, FileText, ChevronRight,
  ArrowRight, ChevronDown, ChevronLeft, UserCheck, Send, Zap, RotateCcw, MessageSquarePlus,
  CalendarDays, SlidersHorizontal,
} from 'lucide-react';
import { startOfMonth, endOfMonth, addMonths, subMonths, format } from 'date-fns';
import api from '../../lib/api';
import useAuthStore from '../../context/authStore';
import { PageHeader, EmptyState, Card, Spinner, StatCard } from '../../components/shared/LoadingScreen';
import { Button, Select } from '../../components/ui/index';
import { formatDate, getTaskStatusColor, getPriorityColor, timeAgo } from '../../lib/utils';


// Whether the most recently logged revision on a task was raised by a
// PM/admin directly, rather than self-reported by the assignee.
function isLatestRevisionByPM(task) {
  const latest = task.revisions?.[task.revisions.length - 1];
  return !!latest && ['admin', 'manager'].includes(latest.requestedBy?.role);
}

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
  website_dev: '🖥️ Website Dev',
  other: '📌 Other',
};

const ROLE_WELCOME = {
  performance_marketer: { greeting: 'Your Campaigns', icon: '📊', tip: 'Focus on tasks with deadlines approaching — check your paid ads tasks first.' },
  social_media_manager: { greeting: 'Your Content Queue', icon: '📱', tip: "Don't forget to check upcoming content deadlines and client calendar tasks." },
  video_editor: { greeting: 'Your Edit Queue', icon: '🎬', tip: 'Urgent edits are highlighted. Check the Files section for raw footage.' },
  graphic_designer: { greeting: 'Your Design Queue', icon: '🎨', tip: 'Check the brief in each task description before starting. Ask PM if anything is unclear.' },
  copywriter: { greeting: 'Your Writing Queue', icon: '✍️', tip: "Reference the client's brand voice in the Files section for any copy tasks." },
  developer: { greeting: 'Your Dev Queue', icon: '🖥️', tip: 'Check the Website Work section for full project context on any task here.' },
  manager: { greeting: 'Your Tasks', icon: '📋', tip: 'Tasks assigned directly to you — separate from the client tasks you manage.' },
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

// ── Status Action Button with Confirm Dropdown ────────────────────────────────
// Prevents accidental clicks: first click opens a dropdown with confirm + cancel
function StatusActionButton({ task, onStatusUpdate, updating, size = 'md' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const isUpdating = updating === task._id;
  const canStart = task.status === 'today' || task.status === 'pending';
  const canReview = task.status === 'in_progress';

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  if (!canStart && !canReview) return null;

  const action = canStart
    ? { label: 'Start Working', icon: Play, nextStatus: 'in_progress', color: '#4f6ef0', gradient: 'linear-gradient(135deg,#4f6ef0,#6366f1)', shadow: 'rgba(79,110,240,0.3)', confirmMsg: 'Begin this task?', confirmIcon: Zap }
    : { label: 'Send for Review', icon: Send, nextStatus: 'review', color: '#a855f7', gradient: 'linear-gradient(135deg,#a855f7,#9333ea)', shadow: 'rgba(168,85,247,0.3)', confirmMsg: 'Done? Send to PM for review?', confirmIcon: CheckCircle };

  const ActionIcon = action.icon;
  const ConfirmIcon = action.confirmIcon;

  const px = size === 'lg' ? 'px-4 py-3' : 'px-3 py-1.5';
  const textSize = size === 'lg' ? 'text-[13.5px]' : 'text-[12px]';

  return (
    <div ref={ref} className="relative" style={{ display: 'inline-block' }}>
      {/* Trigger button */}
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
        disabled={isUpdating}
        className={`flex items-center gap-1.5 ${px} rounded-xl ${textSize} font-semibold transition-all hover:scale-[1.02] active:scale-[0.98] select-none`}
        style={{
          background: action.gradient,
          color: '#fff',
          boxShadow: open ? `0 4px 16px ${action.shadow}` : `0 2px 8px ${action.shadow}`,
          opacity: isUpdating ? 0.7 : 1,
        }}
      >
        {isUpdating ? (
          <Spinner size="xs" />
        ) : (
          <>
            <ActionIcon size={size === 'lg' ? 14 : 11} />
            {action.label}
            <ChevronDown size={size === 'lg' ? 13 : 10} style={{ opacity: 0.7, marginLeft: 2, transition: 'transform 0.18s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }} />
          </>
        )}
      </button>

      {/* Confirmation dropdown */}
      {open && (
        <div
          className="absolute z-50 animate-fade-in"
          style={{
            bottom: 'calc(100% + 8px)',
            left: 0,
            minWidth: 220,
            background: 'var(--fd-surface)',
            border: `1.5px solid ${action.color}33`,
            borderRadius: 14,
            boxShadow: `0 8px 32px rgba(0,0,0,0.18), 0 2px 8px ${action.shadow}`,
            overflow: 'hidden',
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div
            className="px-4 py-3 flex items-center gap-2.5"
            style={{ background: `${action.color}12`, borderBottom: `1px solid ${action.color}22` }}
          >
            <ConfirmIcon size={14} style={{ color: action.color, flexShrink: 0 }} />
            <span className="text-[12.5px] font-semibold" style={{ color: 'var(--fd-ink-1)' }}>
              {action.confirmMsg}
            </span>
          </div>

          {/* Buttons */}
          <div className="p-3 flex gap-2">
            <button
              onClick={() => { setOpen(false); onStatusUpdate(task._id, action.nextStatus); }}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[12.5px] font-bold transition-all hover:scale-[1.02] active:scale-[0.98]"
              style={{
                background: action.gradient,
                color: '#fff',
                boxShadow: `0 2px 8px ${action.shadow}`,
              }}
            >
              <ActionIcon size={12} /> Yes, {action.label.split(' ')[0]}
            </button>
            <button
              onClick={() => setOpen(false)}
              className="flex items-center justify-center px-3 py-2.5 rounded-xl text-[12.5px] font-semibold transition-all hover:scale-[1.02]"
              style={{ background: 'var(--fd-surface-sunken)', color: 'var(--fd-ink-3)', border: '1px solid var(--fd-border)' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Assigned By Badge ─────────────────────────────────────────────────────────
function AssignedByBadge({ createdBy, isClientRequest, style }) {
  if (!createdBy && !isClientRequest) return null;
  const name = isClientRequest ? 'Client Request' : (createdBy?.name || 'Unknown');
  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full"
      style={{
        background: isClientRequest ? 'rgba(245,158,11,0.1)' : 'rgba(79,110,240,0.08)',
        color: isClientRequest ? '#92400e' : 'var(--fd-ink-3)',
        border: `1px solid ${isClientRequest ? 'rgba(245,158,11,0.25)' : 'rgba(79,110,240,0.15)'}`,
        ...style,
      }}
    >
      <UserCheck size={9} style={{ flexShrink: 0 }} />
      {name}
    </span>
  );
}

// ── Revision Badge ────────────────────────────────────────────────────────────
// Shows the "changes requested" counter wherever a task is rendered.
// When the most recent revision was logged by a PM/admin (rather than
// self-reported by the assignee), it's rendered in a distinct indigo tone
// with a "PM" chip so it doesn't blend in with self-reported revisions.
function RevisionBadge({ count, size = 'sm', onClick, pmFlagged = false }) {
  if (!count) return null;
  const isLg = size === 'lg';
  const palette = pmFlagged
    ? { bg: 'rgba(79,110,240,0.12)', color: '#4f6ef0', border: 'rgba(79,110,240,0.3)' }
    : { bg: 'rgba(245,158,11,0.12)', color: '#b45309', border: 'rgba(245,158,11,0.3)' };
  return (
    <span
      onClick={onClick}
      className={`inline-flex items-center gap-1 font-semibold rounded-full ${isLg ? 'text-[12px] px-2.5 py-1' : 'text-[11px] px-2 py-0.5'} ${onClick ? 'cursor-pointer hover:scale-[1.04]' : ''} transition-transform`}
      style={{
        background: palette.bg,
        color: palette.color,
        border: `1px solid ${palette.border}`,
      }}
      title={pmFlagged
        ? `Your project manager requested changes — sent back ${count} time${count > 1 ? 's' : ''}`
        : `This task has been sent back for changes ${count} time${count > 1 ? 's' : ''}`}
    >
      <RotateCcw size={isLg ? 11 : 9} />
      {count} revision{count > 1 ? 's' : ''}
      {pmFlagged && (
        <span
          className="text-[9px] font-bold px-1 py-0 rounded-full uppercase tracking-wide"
          style={{ background: 'rgba(79,110,240,0.18)' }}
        >
          PM
        </span>
      )}
    </span>
  );
}

// ── Log Revision Button ───────────────────────────────────────────────────────
// Lets the team member self-report that the PM asked for changes. This is a
// manual, deliberate action (not automated) — they add a short note about
// what needs to change, and the task's revision counter goes up by one.
function LogRevisionButton({ task, onLogged, size = 'md' }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const submit = async () => {
    setSaving(true);
    try {
      const { data } = await api.post(`/tasks/${task._id}/revisions`, { note });
      onLogged(data.task);
      setNote('');
      setOpen(false);
    } finally { setSaving(false); }
  };

  const px = size === 'lg' ? 'px-4 py-3' : 'px-3 py-1.5';
  const textSize = size === 'lg' ? 'text-[13.5px]' : 'text-[12px]';

  return (
    <div ref={ref} className="relative" style={{ display: 'inline-block' }}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
        className={`flex items-center gap-1.5 ${px} rounded-xl ${textSize} font-semibold transition-all hover:scale-[1.02] active:scale-[0.98] select-none`}
        style={{
          background: 'rgba(245,158,11,0.1)',
          color: '#b45309',
          border: '1px solid rgba(245,158,11,0.3)',
        }}
      >
        <MessageSquarePlus size={size === 'lg' ? 14 : 11} />
        PM Asked for Changes
      </button>

      {open && (
        <div
          className="absolute z-50 animate-fade-in"
          style={{
            bottom: 'calc(100% + 8px)',
            left: 0,
            minWidth: 260,
            background: 'var(--fd-surface)',
            border: '1.5px solid rgba(245,158,11,0.3)',
            borderRadius: 14,
            boxShadow: '0 8px 32px rgba(0,0,0,0.18), 0 2px 8px rgba(245,158,11,0.2)',
            overflow: 'hidden',
          }}
          onClick={e => e.stopPropagation()}
        >
          <div className="px-4 py-3" style={{ background: 'rgba(245,158,11,0.1)', borderBottom: '1px solid rgba(245,158,11,0.2)' }}>
            <div className="flex items-center gap-2 text-[12.5px] font-semibold" style={{ color: 'var(--fd-ink-1)' }}>
              <RotateCcw size={13} style={{ color: '#b45309' }} />
              Log a change request
            </div>
            <p className="text-[11px] mt-1" style={{ color: 'var(--fd-ink-4)' }}>
              This bumps the revision counter so it's clear changes were requested.
            </p>
          </div>
          <div className="p-3 space-y-2">
            <textarea
              autoFocus
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="What did the PM ask you to change? (optional)"
              rows={3}
              className="w-full rounded-lg p-2 text-[12.5px] resize-none outline-none"
              style={{ background: 'var(--fd-surface-sunken)', border: '1px solid var(--fd-border)', color: 'var(--fd-ink-1)' }}
            />
            <div className="flex gap-2">
              <button
                onClick={submit}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[12.5px] font-bold transition-all hover:scale-[1.02] active:scale-[0.98]"
                style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)', color: '#fff', opacity: saving ? 0.7 : 1 }}
              >
                {saving ? <Spinner size="xs" /> : <><RotateCcw size={12} /> Confirm</>}
              </button>
              <button
                onClick={() => setOpen(false)}
                className="flex items-center justify-center px-3 py-2.5 rounded-xl text-[12.5px] font-semibold transition-all hover:scale-[1.02]"
                style={{ background: 'var(--fd-surface-sunken)', color: 'var(--fd-ink-3)', border: '1px solid var(--fd-border)' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
function TaskDetailModal({ task, onClose, onStatusUpdate, updating, onRevisionLogged }) {
  if (!task) return null;
  const isOverdue = task.deadline && new Date(task.deadline) < new Date() && task.status !== 'completed';
  const sm = STATUS_META[task.status] || STATUS_META.pending;

  return ReactDOM.createPortal(
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
              </div>
              <h2 className="text-[17px] font-bold leading-snug" style={{ color: 'var(--fd-ink-1)' }}>
                {task.title}
              </h2>
              {/* Assigned by — prominent in modal */}
              <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                <AssignedByBadge createdBy={task.createdBy} isClientRequest={task.isClientRequest} />
                <RevisionBadge count={task.revisionCount} pmFlagged={isLatestRevisionByPM(task)} />
              </div>
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
            {!task.client?.company && task.clientDeleted && (
              <InfoTile icon={Building2} label="Client" value={`${task.deletedClientName || 'Unknown'} (Deleted)`} />
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
            {/* Assigned By tile */}
            <InfoTile
              icon={UserCheck}
              label="Assigned By"
              value={task.isClientRequest ? 'Client Request' : (task.createdBy?.name || '—')}
              valueColor={task.isClientRequest ? '#92400e' : undefined}
            />
          </div>

          {/* Action zone */}
          {(task.status === 'today' || task.status === 'pending' || task.status === 'in_progress') && (
            <div
              className="rounded-xl p-4"
              style={{ background: 'var(--fd-surface-sunken)', border: '1px solid var(--fd-border)' }}
            >
              <div className="text-[12px] font-semibold mb-3 flex items-center gap-1.5" style={{ color: 'var(--fd-ink-3)' }}>
                Update Status
                <span className="text-[10px] font-normal px-1.5 py-0.5 rounded-md" style={{ background: 'var(--fd-border)', color: 'var(--fd-ink-4)' }}>
                  tap arrow to confirm
                </span>
              </div>
              <StatusActionButton task={task} onStatusUpdate={onStatusUpdate} updating={updating} size="lg" />
            </div>
          )}

          {/* Revision logging — only once work has actually started (in_progress),
              is sitting in review, or has already been marked completed.
              Not shown on today/pending (nothing's been worked on yet) or cancelled. */}
          {(task.status === 'in_progress' || task.status === 'review' || task.status === 'completed') && (
            <div className="flex">
              <LogRevisionButton task={task} onLogged={onRevisionLogged} size="md" />
            </div>
          )}

          {/* Revision history */}
          {task.revisions?.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <RotateCcw size={13} style={{ color: 'var(--fd-ink-4)' }} />
                <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--fd-ink-4)' }}>
                  Change History ({task.revisions.length})
                </span>
              </div>
              <div className="space-y-2">
                {[...task.revisions].reverse().map((rev, i) => {
                  // A revision logged by an admin/manager was raised by the PM
                  // directly (e.g. from the Kanban board) rather than
                  // self-reported by the assignee — flag it distinctly so
                  // it doesn't blend in with the team member's own entries.
                  const loggedByPM = ['admin', 'manager'].includes(rev.requestedBy?.role);
                  return (
                    <div
                      key={rev._id || i}
                      className="rounded-lg p-2.5"
                      style={loggedByPM
                        ? { background: 'rgba(79,110,240,0.07)', border: '1px solid rgba(79,110,240,0.25)' }
                        : { background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.18)' }}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="flex items-center gap-1.5 min-w-0">
                          <span className="text-[11.5px] font-semibold truncate" style={{ color: loggedByPM ? '#4f6ef0' : '#b45309' }}>
                            {rev.requestedBy?.name || 'Team member'}
                          </span>
                          {loggedByPM && (
                            <span
                              className="text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide flex-shrink-0"
                              style={{ background: 'rgba(79,110,240,0.15)', color: '#4f6ef0' }}
                            >
                              PM
                            </span>
                          )}
                        </span>
                        <span className="text-[10.5px] flex-shrink-0" style={{ color: 'var(--fd-ink-5)' }}>
                          {timeAgo(rev.createdAt)}
                        </span>
                      </div>
                      <p className="text-[10.5px] font-medium mb-1" style={{ color: loggedByPM ? '#4f6ef0' : '#b45309' }}>
                        {loggedByPM ? 'Change requested by project manager' : 'Self-reported change'}
                      </p>
                      {rev.note ? (
                        <p className="text-[12px]" style={{ color: 'var(--fd-ink-2)' }}>{rev.note}</p>
                      ) : (
                        <p className="text-[12px] italic" style={{ color: 'var(--fd-ink-5)' }}>No note added.</p>
                      )}
                    </div>
                  );
                })}
              </div>
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
    </div>,
    document.body
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
  const [clientFilter, setClientFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [assignedByFilter, setAssignedByFilter] = useState('');
  const [updating, setUpdating] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);

  // Monthly scoping - defaults to the current month so we only pull this
  // month's tasks. Flip to "All time" to see everything.
  const [monthCursor, setMonthCursor] = useState(function () { return new Date(); });
  const [showAllTime, setShowAllTime] = useState(false);

  // Dropdown option sources - fetched once, independent of the month filter
  const [clientOptions, setClientOptions] = useState([]);
  const [assignerOptions, setAssignerOptions] = useState([]);

  useEffect(function () {
    api.get('/clients?limit=200').then(function (r) { setClientOptions(r.data.clients || []); }).catch(function () {});
    api.get('/users?limit=200').then(function (r) {
      var all = r.data.users || [];
      setAssignerOptions(all.filter(function (u) { return u._id !== (user && user._id); }));
    }).catch(function () {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: 100 });
      if (statusFilter) params.set('status', statusFilter);
      if (clientFilter) params.set('client', clientFilter);
      if (priorityFilter) params.set('priority', priorityFilter);
      if (assignedByFilter) params.set('createdBy', assignedByFilter);
      if (!showAllTime) {
        params.set('dateFrom', startOfMonth(monthCursor).toISOString());
        params.set('dateTo', endOfMonth(monthCursor).toISOString());
      }
      const { data } = await api.get('/tasks/mine?' + params.toString());
      setTasks(data.tasks || []);
    } finally { setLoading(false); }
  }, [statusFilter, clientFilter, priorityFilter, assignedByFilter, showAllTime, monthCursor]);

  useEffect(() => { load(); }, [load]);

  const activeFilterCount = [statusFilter, clientFilter, priorityFilter, assignedByFilter].filter(Boolean).length + (showAllTime ? 1 : 0);
  const clearFilters = () => {
    setStatusFilter(''); setClientFilter(''); setPriorityFilter(''); setAssignedByFilter('');
    setShowAllTime(false); setMonthCursor(new Date());
  };

  const updateStatus = async (id, status) => {
    setUpdating(id);
    try {
      await api.put(`/tasks/${id}`, { status });
      setTasks(prev => prev.map(t => t._id === id ? { ...t, status } : t));
      setSelectedTask(prev => prev?._id === id ? { ...prev, status } : prev);
    } finally { setUpdating(null); }
  };

  // Called after a team member logs a "PM asked for changes" revision.
  // The API returns the fully updated task (with new revisionCount/revisions).
  const handleRevisionLogged = (updatedTask) => {
    setTasks(prev => prev.map(t => t._id === updatedTask._id ? updatedTask : t));
    setSelectedTask(prev => prev?._id === updatedTask._id ? updatedTask : prev);
  };

  const openTaskDetail = (task) => {
    const fresh = tasks.find(t => t._id === task._id) || task;
    setSelectedTask(fresh);
  };

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
  const inProgress = tasks.filter(t => t.status === 'in_progress').length;
  const review = tasks.filter(t => t.status === 'review').length;
  const completed = tasks.filter(t => t.status === 'completed').length;
  // KPI: how many times tasks have been sent back for changes in total
  const totalRevisions = tasks.reduce((sum, t) => sum + (t.revisionCount || 0), 0);

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
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        <StatCard title="Today"       value={today}      icon={AlertCircle} color="orange" subtitle="Due today" />
        <StatCard title="In Progress" value={inProgress} icon={Play}        color="blue"   subtitle="Active" />
        <StatCard title="In Review"   value={review}     icon={Clock}       color="purple" subtitle="Awaiting approval" />
        <StatCard title="Completed"   value={completed}  icon={CheckCircle} color="green"  subtitle="Done" />
        <StatCard title="Revisions"   value={totalRevisions} icon={RotateCcw} color="orange" subtitle="Changes requested" />
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
      <div className="flex items-center gap-2.5 flex-wrap">
        <SlidersHorizontal size={13} style={{ color: 'var(--fd-ink-5)' }} />
        <Select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="w-40">
          <option value="">All Statuses</option>
          {statuses.map(s => (
            <option key={s} value={s}>{STATUS_META[s]?.label || s}</option>
          ))}
        </Select>
        <Select value={clientFilter} onChange={e => setClientFilter(e.target.value)} className="w-44">
          <option value="">All Clients</option>
          {clientOptions.map(c => (
            <option key={c._id} value={c._id}>{c.company}</option>
          ))}
        </Select>
        <Select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)} className="w-36">
          <option value="">All Urgency</option>
          <option value="urgent">Urgent</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </Select>
        <Select value={assignedByFilter} onChange={e => setAssignedByFilter(e.target.value)} className="w-44">
          <option value="">Assigned By: Anyone</option>
          {assignerOptions.map(u => (
            <option key={u._id} value={u._id}>{u.name}</option>
          ))}
        </Select>
        {activeFilterCount > 0 && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors hover:opacity-80"
            style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}
          >
            <X size={12} /> Clear filters ({activeFilterCount})
          </button>
        )}
        <span className="text-[12px] ml-auto" style={{ color: 'var(--fd-ink-4)' }}>
          Click any task to view details &amp; update status
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
                <div className="flex items-start justify-between gap-3 mb-1.5">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="font-semibold text-[14px]" style={{ color: 'var(--fd-ink-1)' }}>
                        {task.title}
                      </span>
                      {isOverdue && (
                        <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">⚠ Overdue</span>
                      )}
                      <RevisionBadge count={task.revisionCount} pmFlagged={isLatestRevisionByPM(task)} />
                    </div>
                    {/* Assigned by — visible on card */}
                    <AssignedByBadge createdBy={task.createdBy} isClientRequest={task.isClientRequest} />
                  </div>
                  <span
                    className="px-2.5 py-1 rounded-full text-[11px] font-semibold flex-shrink-0"
                    style={{ background: sm.bg, color: sm.color }}
                  >
                    {sm.label}
                  </span>
                </div>

                <p className="text-sm line-clamp-2 mb-3 mt-2" style={{ color: 'var(--fd-ink-4)' }}>
                  {linkifyText(task.description) || 'No description provided.'}
                </p>

                {/* Meta */}
                <div className="flex flex-wrap items-center gap-2 text-xs mb-3" style={{ color: 'var(--fd-ink-4)' }}>
                  {task.client?.company && (
                    <span className="font-medium" style={{ color: 'var(--fd-ink-2)' }}>{task.client.company}</span>
                  )}
                  {!task.client?.company && task.clientDeleted && (
                    <span className="font-medium" style={{ color: 'var(--fd-ink-2)' }}>{task.deletedClientName || 'Unknown'} (Deleted)</span>
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

                {/* Action area */}
                <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                  <StatusActionButton task={task} onStatusUpdate={updateStatus} updating={updating} size="sm" />

                  {(task.status === 'in_progress' || task.status === 'review' || task.status === 'completed') && (
                    <LogRevisionButton task={task} onLogged={handleRevisionLogged} size="sm" />
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
          onRevisionLogged={handleRevisionLogged}
        />
      )}
    </div>
  );
}