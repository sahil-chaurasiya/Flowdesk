import React, { useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import {
  ChevronLeft, ChevronRight, Plus, Check, Edit2, Trash2,
  Clock, AlignLeft, List, Filter, X, AlertTriangle, User,
  CheckCircle2, Circle, Loader, XCircle, Building2, Star, Sparkles, Lock,
} from 'lucide-react';
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  startOfWeek, endOfWeek, isSameMonth, isSameDay, isToday,
  addMonths, subMonths, parseISO, startOfDay, endOfDay, isPast,
} from 'date-fns';
import api from '../../lib/api';
import { useToast, Button, Input, Modal } from '../../components/ui/index';
import { Spinner } from '../../components/shared/LoadingScreen';
import useAuthStore from '../../context/authStore';
import { linkifyText } from '../../lib/utils';

// ─── Constants ────────────────────────────────────────────────────────────────
const EVENT_COLORS = {
  task_deadline: { bg: '#ef4444', light: '#fef2f2', text: '#b91c1c', border: '#fecaca' },
  meeting:       { bg: '#4f6ef0', light: '#eff0fe', text: '#3a56d4', border: '#c7cdfb' },
  reminder:      { bg: '#f59e0b', light: '#fffbeb', text: '#92600a', border: '#fde68a' },
  follow_up:     { bg: '#a855f7', light: '#faf5ff', text: '#7e22ce', border: '#e9d5ff' },
  campaign:      { bg: '#22c55e', light: '#f0fdf4', text: '#15803d', border: '#bbf7d0' },
  shoot:         { bg: '#ec4899', light: '#fdf2f8', text: '#be185d', border: '#fbcfe8' },
  reel:          { bg: '#06b6d4', light: '#ecfeff', text: '#0e7490', border: '#a5f3fc' },
  static_post:   { bg: '#8b5cf6', light: '#f5f3ff', text: '#6d28d9', border: '#ddd6fe' },
  carousel:      { bg: '#f97316', light: '#fff7ed', text: '#c2410c', border: '#fed7aa' },
  story:         { bg: '#e11d48', light: '#fff1f2', text: '#9f1239', border: '#fecdd3' },
  other:         { bg: '#94a3b8', light: '#f8fafc', text: '#475569', border: '#e2e8f0' },
};

const TYPE_LABELS = {
  task_deadline: 'Task Deadline',
  meeting:       'Meeting',
  reminder:      'Reminder',
  follow_up:     'Follow Up',
  campaign:      'Campaign',
  shoot:         'Shoot',
  reel:          'Reel',
  static_post:   'Static Post',
  carousel:      'Carousel',
  story:         'Story',
  other:         'Other',
};

const SHOOT_SUBTYPES = [
  { value: 'photo_shoot',   label: 'Photo Shoot',    icon: '📷' },
  { value: 'video_shoot',   label: 'Video Shoot',    icon: '🎬' },
  { value: 'reel_shoot',    label: 'Reel Shoot',     icon: '📱' },
  { value: 'product_shoot', label: 'Product Shoot',  icon: '📦' },
  { value: 'event_shoot',   label: 'Event Shoot',    icon: '🎉' },
  { value: 'interview',     label: 'Interview',      icon: '🎙️' },
  { value: 'bts',           label: 'BTS / Behind the Scenes', icon: '🎥' },
  { value: 'other_shoot',   label: 'Other Shoot',    icon: '🎞️' },
];

const SHOOT_SUBTYPE_LABELS = Object.fromEntries(SHOOT_SUBTYPES.map(s => [s.value, s.label]));
const SHOOT_SUBTYPE_ICONS  = Object.fromEntries(SHOOT_SUBTYPES.map(s => [s.value, s.icon]));

const STATUS_CONFIG = {
  pending:     { label: 'Pending',     icon: Circle,       color: '#94a3b8', bg: '#f8fafc' },
  in_progress: { label: 'In Progress', icon: Loader,       color: '#f59e0b', bg: '#fffbeb' },
  done:        { label: 'Done',        icon: CheckCircle2, color: '#22c55e', bg: '#f0fdf4' },
  cancelled:   { label: 'Cancelled',   icon: XCircle,      color: '#ef4444', bg: '#fef2f2' },
};

const DAY_LABELS_LONG  = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_LABELS_SHORT = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

// ─── Overdue badge ────────────────────────────────────────────────────────────
function OverdueBadge() {
  return (
    <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1 py-[1px] rounded"
      style={{ background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca' }}>
      <AlertTriangle size={7} /> OVERDUE
    </span>
  );
}

// ─── Status Toggle ────────────────────────────────────────────────────────────
function StatusToggle({ status, onChange, compact = false, isReady = true }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  const Icon = cfg.icon;
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={e => { e.stopPropagation(); setOpen(v => !v); }}
        className={`flex items-center gap-1 font-semibold rounded-full transition-all ${compact ? 'text-[10px] px-1.5 py-0.5' : 'text-[12px] px-2.5 py-1'}`}
        style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}30` }}
      >
        <Icon size={compact ? 8 : 11} />
        {!compact && <span>{cfg.label}</span>}
        {!compact && <ChevronRight size={9} style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }} />}
      </button>
      {open && (
        <div
          className="absolute z-50 top-full mt-1 left-0 rounded-xl overflow-hidden shadow-lg"
          style={{ background: 'var(--fd-surface)', border: '1px solid var(--fd-border)', minWidth: 140 }}
          onClick={e => e.stopPropagation()}
        >
          {Object.entries(STATUS_CONFIG).map(([val, s]) => {
            const I = s.icon;
            const isDoneLocked = val === 'done' && !isReady;
            return (
              <button key={val}
                onClick={() => { if (isDoneLocked) return; onChange(val); setOpen(false); }}
                disabled={isDoneLocked}
                title={isDoneLocked ? 'Mark this event as Ready first' : undefined}
                className="w-full flex items-center gap-2 px-3 py-2 transition-opacity text-left"
                style={{
                  background: val === status ? s.bg : 'transparent',
                  opacity: isDoneLocked ? 0.4 : 1,
                  cursor: isDoneLocked ? 'not-allowed' : 'pointer',
                }}
                onMouseEnter={e => { if (!isDoneLocked) e.currentTarget.style.opacity = '0.7'; }}
                onMouseLeave={e => { if (!isDoneLocked) e.currentTarget.style.opacity = '1'; }}
              >
                <I size={12} style={{ color: s.color }} />
                <span className="text-[12px] font-medium" style={{ color: 'var(--fd-ink-1)' }}>{s.label}</span>
                {isDoneLocked && <Lock size={9} className="ml-auto" style={{ color: 'var(--fd-ink-4)' }} />}
                {val === status && !isDoneLocked && <Check size={10} className="ml-auto" style={{ color: s.color }} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Ready Switch ─────────────────────────────────────────────────────────────
function ReadySwitch({ isReady, onChange }) {
  return (
    <button
      type="button"
      onClick={e => { e.stopPropagation(); onChange(!isReady); }}
      className="relative inline-flex items-center transition-colors"
      style={{
        width: 40, height: 22, borderRadius: 999,
        background: isReady ? '#22c55e' : 'var(--fd-border)',
        flexShrink: 0,
      }}
      role="switch"
      aria-checked={isReady}
      title={isReady ? 'Ready — click to mark Not Ready' : 'Not Ready — click to mark Ready'}
    >
      <span
        className="absolute rounded-full bg-white shadow transition-transform"
        style={{
          width: 18, height: 18, top: 2, left: 2,
          transform: isReady ? 'translateX(18px)' : 'translateX(0)',
        }}
      />
    </button>
  );
}


// ─── Event Chip (desktop) ─────────────────────────────────────────────────────
function EventChip({ event, isStart, isEnd, onClick }) {
  const color = EVENT_COLORS[event.type] || EVENT_COLORS.other;
  const overdue = event.isOverdue;

  return (
    <button
      onClick={e => { e.stopPropagation(); onClick(event); }}
      className="w-full text-left text-[10px] font-semibold px-1 py-[2px] flex items-center gap-1 overflow-hidden mt-[2px] transition-opacity hover:opacity-80"
      style={{
        background: overdue ? '#fef2f2' : color.light,
        color:      overdue ? '#b91c1c' : color.text,
        borderTop:    `2px solid ${overdue ? '#ef4444' : color.bg}`,
        borderBottom: `2px solid ${overdue ? '#ef4444' : color.bg}`,
        borderLeft:   isStart ? `2px solid ${overdue ? '#ef4444' : color.bg}` : 'none',
        borderRight:  isEnd   ? `2px solid ${overdue ? '#ef4444' : color.bg}` : 'none',
        borderRadius: isStart && isEnd ? 4 : isStart ? '4px 0 0 4px' : isEnd ? '0 4px 4px 0' : 0,
        marginLeft:   isStart ? 0 : -1,
        marginRight:  isEnd   ? 0 : -1,
      }}
      title={event.title}
    >
      {isStart && (
        <>
          {overdue
            ? <AlertTriangle size={8} className="flex-shrink-0" style={{ color: '#ef4444' }} />
            : <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color.bg }} />
          }
          <span className="truncate">{event.title}</span>
          {event.status === 'done' ? (
            <span className="flex-shrink-0 ml-auto w-3 h-3 rounded-full flex items-center justify-center" style={{ background: '#22c55e' }}>
              <Check size={7} style={{ color: '#fff', strokeWidth: 3 }} />
            </span>
          ) : event.isReady && (
            <span className="flex-shrink-0 ml-auto text-[8px] font-bold px-1.5 py-[1px] rounded-full leading-[12px]"
              style={{ background: '#22c55e', color: '#fff' }}>
              Ready
            </span>
          )}
        </>
      )}
    </button>
  );
}

// ─── View Modal ───────────────────────────────────────────────────────────────
function EventViewModal({ event, onClose, onEdit, onDelete, onStatusChange, onReadyChange, canAct }) {
  const [deleting, setDeleting] = useState(false);
  const color = EVENT_COLORS[event.type] || EVENT_COLORS.other;
  const isReady = !!event.isReady;

  const del = async () => {
    setDeleting(true);
    try { await onDelete(event._id); onClose(); }
    finally { setDeleting(false); }
  };

  return (
    <Modal
      isOpen onClose={onClose} title="" size="sm"
      footer={
        <div className="flex items-center justify-between gap-2">
          {canAct && (
            <Button variant="danger" size="sm" onClick={del} loading={deleting}>
              <Trash2 size={12} /> Delete
            </Button>
          )}
          <div className="flex gap-2 ml-auto">
            <Button variant="secondary" size="sm" onClick={onClose}>Close</Button>
            {canAct && <Button size="sm" onClick={onEdit}><Edit2 size={12} /> Edit</Button>}
          </div>
        </div>
      }
    >
      <div className="flex items-start gap-3 mb-4">
        <div
          className="w-3 h-3 rounded-full mt-1 flex-shrink-0"
          style={{ background: color.bg, boxShadow: `0 0 0 3px ${color.light}` }}
        />
        <div className="flex-1 min-w-0">
          <h3 className="text-[17px] font-bold leading-tight" style={{ color: 'var(--fd-ink-1)' }}>
            {event.title}
          </h3>
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
            <span
              className="inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full"
              style={{ background: color.light, color: color.text }}
            >
              {TYPE_LABELS[event.type] || event.type}
            </span>
            {event.type === 'shoot' && event.shootSubtype && (
              <span className="inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full"
                style={{ background: '#fdf2f8', color: '#be185d', border: '1px solid #fbcfe8' }}>
                {SHOOT_SUBTYPE_ICONS[event.shootSubtype]} {SHOOT_SUBTYPE_LABELS[event.shootSubtype] || event.shootSubtype}
              </span>
            )}
            {event.isOverdue && <OverdueBadge />}
          </div>
        </div>
      </div>

      {/* Ready toggle */}
      {canAct && (
        <div className="flex items-center justify-between p-3 rounded-xl mb-3"
          style={{ background: 'var(--fd-surface-sunken)' }}>
          <div>
            <span className="text-[12px] font-medium" style={{ color: 'var(--fd-ink-3)' }}>Ready</span>
            <div className="text-[10.5px]" style={{ color: 'var(--fd-ink-4)' }}>
              {isReady ? 'Can be marked Done' : 'Switch on before marking Done'}
            </div>
          </div>
          <ReadySwitch isReady={isReady} onChange={val => onReadyChange(event._id, val)} />
        </div>
      )}

      {/* Status */}
      <div className="flex items-center justify-between p-3 rounded-xl mb-3"
        style={{ background: 'var(--fd-surface-sunken)' }}>
        <span className="text-[12px] font-medium" style={{ color: 'var(--fd-ink-3)' }}>Status</span>
        <StatusToggle status={event.status || 'pending'} isReady={isReady} onChange={val => onStatusChange(event._id, val)} />
      </div>

      <div className="space-y-3">
        <div className="flex items-start gap-2.5 p-3 rounded-xl" style={{ background: 'var(--fd-surface-sunken)' }}>
          <Clock size={13} style={{ color: 'var(--fd-ink-4)', marginTop: 1 }} />
          <div className="space-y-0.5">
            <div className="text-[12px] font-medium" style={{ color: 'var(--fd-ink-2)' }}>
              {format(parseISO(event.startDate), 'EEE, MMM d · h:mm a')}
            </div>
            {event.endDate && event.endDate !== event.startDate && (
              <div className="text-[12px]" style={{ color: 'var(--fd-ink-4)' }}>
                → {format(parseISO(event.endDate), 'EEE, MMM d · h:mm a')}
              </div>
            )}
          </div>
        </div>

        {event.client && (
          <div className="flex items-center gap-2.5 p-3 rounded-xl" style={{ background: 'var(--fd-surface-sunken)' }}>
            <Building2 size={13} style={{ color: 'var(--fd-ink-4)' }} />
            <span className="text-[12px] font-medium" style={{ color: 'var(--fd-ink-2)' }}>
              {event.client.company || event.client.name || 'Client'}
            </span>
            {event.visibleToClient && (
              <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                style={{ background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0' }}>
                <Check size={8} strokeWidth={3} /> Visible to Client
              </span>
            )}
          </div>
        )}

        {event.description && (
          <div className="flex items-start gap-2.5 p-3 rounded-xl min-w-0" style={{ background: 'var(--fd-surface-sunken)' }}>
            <AlignLeft size={13} style={{ color: 'var(--fd-ink-4)', marginTop: 1, flexShrink: 0 }} />
            <p className="text-[12.5px] leading-relaxed whitespace-pre-wrap break-words min-w-0" style={{ color: 'var(--fd-ink-2)' }}>
              {linkifyText(event.description)}
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}

// ─── Edit / Create Modal ──────────────────────────────────────────────────────
function EventEditModal({ event, defaultDate, onClose, onSave, onDelete, clients, prefillClientId, canAct }) {
  const isNew = !event?._id;

  const buildDefaults = () => {
    if (!isNew && event) {
      return {
        title:        event.title || '',
        type:         event.type || 'meeting',
        shootSubtype: event.shootSubtype || '',
        startDate:    event.startDate || '',
        endDate:      event.endDate   || '',
        description:  event.description || '',
        visibility:   event.visibility || 'all',
        visibleTo:    (event.visibleTo || []).map(u => (typeof u === 'object' ? u._id : u)),
        client:       event.client ? (typeof event.client === 'object' ? event.client._id : event.client) : '',
        status:       event.status || 'pending',
        isReady:      event.isReady || false,
        visibleToClient: event.visibleToClient || false,
      };
    }
    const base = defaultDate ? new Date(defaultDate) : new Date();
    base.setHours(9, 0, 0, 0);
    const end = new Date(base);
    end.setHours(10, 0, 0, 0);
    return {
      title: '', type: 'meeting', shootSubtype: '',
      startDate: base.toISOString(),
      endDate:   end.toISOString(),
      description: '', visibility: 'all', visibleTo: [],
      client: prefillClientId || '',
      status: 'pending',
      isReady: false,
      visibleToClient: false,
    };
  };

  const [form, setForm] = useState(buildDefaults);
  const [saving, setSaving] = useState(false);
  const [teamMembers, setTeamMembers] = useState([]);

  useEffect(() => {
    api.get('/users?role=team').then(({ data }) => {
      setTeamMembers(data.users || []);
    }).catch(() => {});
  }, []);

  const toggleVisibleTo = (userId) => {
    setForm(f => {
      const already = f.visibleTo.includes(userId);
      return { ...f, visibleTo: already ? f.visibleTo.filter(id => id !== userId) : [...f.visibleTo, userId] };
    });
  };

  const save = async () => {
    if (!form.title?.trim()) return;
    if (form.visibility === 'specific' && form.visibleTo.length === 0) return;
    setSaving(true);

    // Build a clean payload — only scalar/ID fields from form, never spread the
    // populated event object (which has nested objects like client:{_id,company}).
    const payload = {
      title:        form.title,
      type:         form.type,
      shootSubtype: form.shootSubtype || null,
      startDate:    form.startDate,
      endDate:      form.endDate,
      description:  form.description,
      visibility:   form.visibility,
      visibleTo:    form.visibleTo,
      status:       form.status,
      visibleToClient: form.visibleToClient,
    };

    // client: only include if set, and always send the bare ID string
    if (form.client) {
      payload.client = typeof form.client === 'object' ? form.client._id : form.client;
    }

    // For edits, attach the document _id so handleSave can route to PUT
    if (!isNew && event?._id) {
      payload._id = event._id;
    }

    try { await onSave(payload, isNew); onClose(); }
    finally { setSaving(false); }
  };

  const del = async () => {
    if (!event?._id) return;
    setSaving(true);
    try { await onDelete(event._id); onClose(); }
    finally { setSaving(false); }
  };

  const VISIBILITY_OPTIONS = [
    { value: 'all',      label: 'Everyone',        desc: 'All team members can see this' },
    { value: 'specific', label: 'Specific people', desc: 'Choose who can see this' },
    { value: 'private',  label: 'Only me',         desc: 'Private — only you can see this' },
  ];

  const displayDate = defaultDate
    ? format(new Date(defaultDate), 'EEEE, MMMM d')
    : event?.startDate ? format(parseISO(event.startDate), 'EEEE, MMMM d') : '';

  return (
    <Modal
      isOpen onClose={onClose} title={isNew ? 'New Event' : 'Edit Event'} size="sm"
      footer={
        <div className="flex items-center justify-between gap-2">
          {!isNew && canAct && (
            <Button variant="danger" size="sm" onClick={del} loading={saving}>
              <Trash2 size={12} /> Delete
            </Button>
          )}
          <div className="flex gap-2 ml-auto">
            <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" onClick={save} loading={saving}
              disabled={form.visibility === 'specific' && form.visibleTo.length === 0}>
              <Check size={12} /> {isNew ? 'Create' : 'Save'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {displayDate && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-[12px] font-medium"
            style={{ background: 'var(--fd-surface-sunken)', color: 'var(--fd-ink-3)' }}>
            <Clock size={13} style={{ color: 'var(--fd-ink-4)' }} />
            {displayDate}
          </div>
        )}

        <Input
          label="Title" value={form.title} autoFocus
          onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          placeholder="Event title"
        />

        {/* Client selector — shown when not pre-filled from client detail page */}
        {!prefillClientId && clients && clients.length > 0 && (
          <div className="space-y-1.5">
            <label className="block text-[12px] font-medium" style={{ color: 'var(--fd-ink-2)' }}>
              Client <span className="text-[11px] font-normal" style={{ color: 'var(--fd-ink-4)' }}>(optional)</span>
            </label>
            <div className="relative">
              <Building2 size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--fd-ink-4)' }} />
              <select
                className="fd-input pl-8 appearance-none"
                value={form.client || ''}
                onChange={e => setForm(f => ({ ...f, client: e.target.value, visibleToClient: e.target.value ? f.visibleToClient : false }))}
                style={{ paddingLeft: 30 }}
              >
                <option value="">— No client —</option>
                {clients.map(c => (
                  <option key={c._id} value={c._id}>{c.company || c.name}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Visible to Client checkbox — only shown when a client is linked */}
        {(form.client || prefillClientId) && (
          <button
            type="button"
            onClick={() => setForm(f => ({ ...f, visibleToClient: !f.visibleToClient }))}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all"
            style={{
              background: form.visibleToClient ? '#f0fdf4' : 'var(--fd-surface-sunken)',
              border: `1.5px solid ${form.visibleToClient ? '#22c55e' : 'var(--fd-border)'}`,
            }}
          >
            <span
              className="w-4 h-4 rounded flex-shrink-0 flex items-center justify-center"
              style={{
                background: form.visibleToClient ? '#22c55e' : 'var(--fd-surface)',
                border: `1.5px solid ${form.visibleToClient ? '#22c55e' : 'var(--fd-border)'}`,
              }}
            >
              {form.visibleToClient && <Check size={10} color="#fff" strokeWidth={3} />}
            </span>
            <div>
              <p className="text-[12px] font-semibold" style={{ color: form.visibleToClient ? '#15803d' : 'var(--fd-ink-1)' }}>
                Visible to Client
              </p>
              <p className="text-[11px]" style={{ color: form.visibleToClient ? '#166534' : 'var(--fd-ink-4)' }}>
                Show this event on the client's portal calendar
              </p>
            </div>
          </button>
        )}

        {/* Ready toggle */}
        <div className="flex items-center justify-between p-3 rounded-xl"
          style={{ background: 'var(--fd-surface-sunken)' }}>
          <div>
            <span className="text-[12px] font-medium" style={{ color: 'var(--fd-ink-2)' }}>Ready</span>
            <div className="text-[10.5px]" style={{ color: 'var(--fd-ink-4)' }}>
              {form.isReady ? 'Can be marked Done' : 'Switch on before marking Done'}
            </div>
          </div>
          <ReadySwitch
            isReady={!!form.isReady}
            onChange={val => setForm(f => ({ ...f, isReady: val, status: (!val && f.status === 'done') ? 'pending' : f.status }))}
          />
        </div>

        {/* Status */}
        <div className="space-y-1.5">
          <label className="block text-[12px] font-medium" style={{ color: 'var(--fd-ink-2)' }}>Status</label>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(STATUS_CONFIG).map(([val, s]) => {
              const Icon = s.icon;
              const isDoneLocked = val === 'done' && !form.isReady;
              return (
                <button key={val}
                  onClick={() => { if (isDoneLocked) return; setForm(f => ({ ...f, status: val })); }}
                  disabled={isDoneLocked}
                  title={isDoneLocked ? 'Mark this event as Ready first' : undefined}
                  className="flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full transition-all"
                  style={form.status === val
                    ? { background: s.color, color: '#fff' }
                    : { background: s.bg, color: s.color, border: `1px solid ${s.color}40`, opacity: isDoneLocked ? 0.45 : 1, cursor: isDoneLocked ? 'not-allowed' : 'pointer' }
                  }
                >
                  <Icon size={10} /> {s.label}
                  {isDoneLocked && <Lock size={9} />}
                </button>
              );
            })}
          </div>
        </div>


        {/* Type */}
        <div className="space-y-1.5">
          <label className="block text-[12px] font-medium" style={{ color: 'var(--fd-ink-2)' }}>Type</label>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(EVENT_COLORS).map(([type, color]) => (
              <button
                key={type}
                onClick={() => setForm(f => ({ ...f, type }))}
                className="text-[11px] font-semibold px-2.5 py-1 rounded-full transition-all"
                style={
                  form.type === type
                    ? { background: color.bg, color: '#fff' }
                    : { background: color.light, color: color.text, border: `1px solid ${color.border}` }
                }
              >
                {TYPE_LABELS[type]}
              </button>
            ))}
          </div>
        </div>

        {form.type === 'shoot' && (
          <div className="space-y-1.5">
            <label className="block text-[12px] font-medium" style={{ color: 'var(--fd-ink-2)' }}>Shoot Type</label>
            <div className="flex flex-wrap gap-1.5">
              {SHOOT_SUBTYPES.map(sub => (
                <button
                  key={sub.value}
                  onClick={() => setForm(f => ({ ...f, shootSubtype: sub.value }))}
                  className="text-[11px] font-semibold px-2.5 py-1 rounded-full transition-all flex items-center gap-1"
                  style={
                    form.shootSubtype === sub.value
                      ? { background: '#ec4899', color: '#fff' }
                      : { background: '#fdf2f8', color: '#be185d', border: '1px solid #fbcfe8' }
                  }
                >
                  <span>{sub.icon}</span> {sub.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <label className="block text-[12px] font-medium" style={{ color: 'var(--fd-ink-2)' }}>Notes</label>
          <textarea
            className="fd-input resize-none" rows={2}
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            placeholder="Optional notes…"
          />
        </div>

        {/* Visibility */}
        <div className="space-y-2">
          <label className="block text-[12px] font-medium" style={{ color: 'var(--fd-ink-2)' }}>Visibility</label>
          <div className="grid grid-cols-1 gap-1.5">
            {VISIBILITY_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setForm(f => ({ ...f, visibility: opt.value, visibleTo: opt.value !== 'specific' ? [] : f.visibleTo }))}
                className="flex items-start gap-2.5 p-2.5 rounded-xl text-left transition-all"
                style={{
                  background: form.visibility === opt.value ? 'var(--fd-accent-light, #eff0fe)' : 'var(--fd-surface-sunken)',
                  border: `1.5px solid ${form.visibility === opt.value ? 'var(--fd-accent, #4f6ef0)' : 'transparent'}`,
                }}
              >
                <span
                  className="w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 mt-0.5"
                  style={{
                    borderColor: form.visibility === opt.value ? 'var(--fd-accent, #4f6ef0)' : 'var(--fd-ink-4)',
                    background:  form.visibility === opt.value ? 'var(--fd-accent, #4f6ef0)' : 'transparent',
                  }}
                />
                <div>
                  <p className="text-[12px] font-semibold" style={{ color: form.visibility === opt.value ? '#1a1a2e' : 'var(--fd-ink-1)' }}>{opt.label}</p>
                  <p className="text-[11px]" style={{ color: form.visibility === opt.value ? '#3a3a5c' : 'var(--fd-ink-4)' }}>{opt.desc}</p>
                </div>
              </button>
            ))}
          </div>

          {form.visibility === 'specific' && (
            <div className="mt-1 space-y-1">
              <p className="text-[11px] font-medium" style={{ color: 'var(--fd-ink-3)' }}>
                Select people ({form.visibleTo.length} selected)
              </p>
              <div className="max-h-36 overflow-y-auto rounded-xl divide-y" style={{ border: '1px solid var(--fd-border)' }}>
                {teamMembers.length === 0 && (
                  <p className="text-[11px] p-3" style={{ color: 'var(--fd-ink-4)' }}>Loading team…</p>
                )}
                {teamMembers.map(member => {
                  const selected = form.visibleTo.includes(member._id);
                  return (
                    <button
                      key={member._id}
                      onClick={() => toggleVisibleTo(member._id)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors hover:opacity-80"
                      style={{ background: selected ? 'var(--fd-accent-light, #eff0fe)' : 'transparent' }}
                    >
                      <span
                        className="w-3.5 h-3.5 rounded flex-shrink-0 flex items-center justify-center"
                        style={{ background: selected ? 'var(--fd-accent, #4f6ef0)' : 'var(--fd-surface-sunken)', border: `1.5px solid ${selected ? 'var(--fd-accent, #4f6ef0)' : 'var(--fd-border)'}` }}
                      >
                        {selected && <Check size={8} color="#fff" />}
                      </span>
                      <span className="text-[12px] font-medium" style={{ color: selected ? '#1a1a2e' : 'var(--fd-ink-1)' }}>{member.name}</span>
                      <span className="text-[11px] ml-auto" style={{ color: selected ? '#3a3a5c' : 'var(--fd-ink-4)' }}>{member.jobTitle || member.role}</span>
                    </button>
                  );
                })}
              </div>
              {form.visibility === 'specific' && form.visibleTo.length === 0 && (
                <p className="text-[11px]" style={{ color: '#ef4444' }}>Please select at least one person.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

// ─── Quick emoji picker options ───────────────────────────────────────────────
const QUICK_EMOJIS = ['🎉','🪔','🌙','🌸','💐','🎊','🎁','🏖️','❤️','🙏','⭐','🎂','🥳','🎆','🌟','🕌','⛪','🛕'];

// ─── Manage Important Days Modal ──────────────────────────────────────────────
function ManageImportantDaysModal({ onClose, onDaysChanged }) {
  const toast = useToast();
  const [days, setDays]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm]       = useState(null); // null = list view, object = add/edit form
  const [saving, setSaving]   = useState(false);
  const [deleting, setDeleting] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/important-days');
      setDays(data.days || []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => setForm({ name: '', date: format(new Date(), 'yyyy-MM-dd'), emoji: '🎉', notes: '' });
  const openEdit = (d) => setForm({ _id: d._id, name: d.name, date: format(parseISO(d.date), 'yyyy-MM-dd'), emoji: d.emoji || '🎉', notes: d.notes || '' });

  const save = async () => {
    if (!form.name?.trim() || !form.date) return;
    setSaving(true);
    try {
      if (form._id) {
        await api.put(`/important-days/${form._id}`, form);
        toast({ type: 'success', title: 'Day updated' });
      } else {
        await api.post('/important-days', form);
        toast({ type: 'success', title: 'Important day added' });
      }
      await load();
      onDaysChanged();
      setForm(null);
    } catch (err) {
      toast({ type: 'error', title: 'Failed to save', message: err?.response?.data?.message });
    } finally { setSaving(false); }
  };

  const del = async (id) => {
    setDeleting(id);
    try {
      await api.delete(`/important-days/${id}`);
      toast({ type: 'success', title: 'Removed' });
      await load();
      onDaysChanged();
    } catch {
      toast({ type: 'error', title: 'Failed to delete' });
    } finally { setDeleting(null); }
  };

  // Group days by month for display
  const grouped = days.reduce((acc, d) => {
    const key = format(parseISO(d.date), 'MMMM yyyy');
    if (!acc[key]) acc[key] = [];
    acc[key].push(d);
    return acc;
  }, {});

  return (
    <Modal
      isOpen onClose={onClose}
      title={form ? (form._id ? 'Edit Important Day' : 'Add Important Day') : 'Important Days'}
      size="sm"
      footer={
        form ? (
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" size="sm" onClick={() => setForm(null)}>Back</Button>
            <Button size="sm" onClick={save} loading={saving}
              disabled={!form.name?.trim() || !form.date}>
              <Check size={12} /> {form._id ? 'Save' : 'Add'}
            </Button>
          </div>
        ) : (
          <div className="flex justify-end">
            <Button size="sm" onClick={openAdd}><Plus size={12} /> Add Day</Button>
          </div>
        )
      }
    >
      {form ? (
        /* ── Add / Edit form ── */
        <div className="space-y-4">
          {/* Emoji picker */}
          <div className="space-y-1.5">
            <label className="block text-[12px] font-medium" style={{ color: 'var(--fd-ink-2)' }}>Emoji</label>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_EMOJIS.map(e => (
                <button key={e}
                  onClick={() => setForm(f => ({ ...f, emoji: e }))}
                  className="w-8 h-8 rounded-lg text-lg flex items-center justify-center transition-all"
                  style={{
                    background: form.emoji === e ? 'var(--fd-accent-light, #eff0fe)' : 'var(--fd-surface-sunken)',
                    border: `1.5px solid ${form.emoji === e ? 'var(--fd-accent, #4f6ef0)' : 'transparent'}`,
                    transform: form.emoji === e ? 'scale(1.15)' : 'scale(1)',
                  }}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          <Input
            label="Name"
            value={form.name}
            autoFocus
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="e.g. Diwali, Eid, Father's Day"
          />

          <div className="space-y-1.5">
            <label className="block text-[12px] font-medium" style={{ color: 'var(--fd-ink-2)' }}>Date</label>
            <input
              type="date"
              className="fd-input"
              value={form.date}
              onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-[12px] font-medium" style={{ color: 'var(--fd-ink-2)' }}>
              Notes <span className="text-[11px] font-normal" style={{ color: 'var(--fd-ink-4)' }}>(optional)</span>
            </label>
            <textarea
              className="fd-input resize-none" rows={2}
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Any notes about this day…"
            />
          </div>
        </div>
      ) : (
        /* ── List view ── */
        loading ? (
          <div className="flex items-center justify-center py-10"><Spinner /></div>
        ) : days.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-[28px] mb-2">🗓️</p>
            <p className="text-[13px] font-medium" style={{ color: 'var(--fd-ink-3)' }}>No important days yet</p>
            <p className="text-[12px] mt-1" style={{ color: 'var(--fd-ink-5)' }}>Add festivals, holidays &amp; special dates so the whole team sees them on the calendar.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(grouped).map(([month, mDays]) => (
              <div key={month}>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--fd-ink-4)' }}>{month}</p>
                <div className="space-y-1">
                  {mDays.map(d => (
                    <div key={d._id}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl group"
                      style={{ background: 'var(--fd-surface-sunken)', border: '1px solid var(--fd-border)' }}
                    >
                      <span className="text-[20px] flex-shrink-0">{d.emoji || '🎉'}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-semibold truncate" style={{ color: 'var(--fd-ink-1)' }}>{d.name}</p>
                        <p className="text-[11px]" style={{ color: 'var(--fd-ink-4)' }}>{format(parseISO(d.date), 'EEE, MMM d yyyy')}</p>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEdit(d)}
                          className="p-1.5 rounded-lg hover:opacity-70 transition-opacity"
                          style={{ color: 'var(--fd-ink-4)', background: 'var(--fd-surface)' }}>
                          <Edit2 size={11} />
                        </button>
                        <button onClick={() => del(d._id)} disabled={deleting === d._id}
                          className="p-1.5 rounded-lg hover:opacity-70 transition-opacity"
                          style={{ color: '#ef4444', background: '#fef2f2' }}>
                          {deleting === d._id ? <Loader size={11} className="animate-spin" /> : <Trash2 size={11} />}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </Modal>
  );
}

// ─── Filter Bar ───────────────────────────────────────────────────────────────
function FilterBar({ clients, filters, onChange, overdueCount }) {
  const hasActive = filters.client || filters.type || filters.status;

  return (
    <div className="flex flex-wrap items-center gap-2 mb-3">
      {/* Client filter */}
      {clients.length > 0 && (
        <div className="relative">
          <Building2 size={12} className="absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--fd-ink-4)' }} />
          <select
            className="text-[12px] font-medium pl-6 pr-6 py-1.5 rounded-lg appearance-none cursor-pointer"
            style={{
              background: filters.client ? '#eff0fe' : 'var(--fd-surface)',
              border: `1px solid ${filters.client ? '#4f6ef0' : 'var(--fd-border)'}`,
              color: filters.client ? '#3a56d4' : 'var(--fd-ink-3)',
            }}
            value={filters.client || ''}
            onChange={e => onChange({ ...filters, client: e.target.value })}
          >
            <option value="">All Clients</option>
            {clients.map(c => (
              <option key={c._id} value={c._id}>{c.company || c.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Type filter */}
      <div className="relative">
        <select
          className="text-[12px] font-medium px-3 py-1.5 rounded-lg appearance-none cursor-pointer"
          style={{
            background: filters.type ? (EVENT_COLORS[filters.type]?.light || '#eff0fe') : 'var(--fd-surface)',
            border: `1px solid ${filters.type ? (EVENT_COLORS[filters.type]?.bg || '#4f6ef0') : 'var(--fd-border)'}`,
            color: filters.type ? (EVENT_COLORS[filters.type]?.text || '#3a56d4') : 'var(--fd-ink-3)',
          }}
          value={filters.type || ''}
          onChange={e => onChange({ ...filters, type: e.target.value })}
        >
          <option value="">All Types</option>
          {Object.entries(TYPE_LABELS).map(([val, label]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </select>
      </div>

      {/* Status filter */}
      <div className="relative">
        <select
          className="text-[12px] font-medium px-3 py-1.5 rounded-lg appearance-none cursor-pointer"
          style={{
            background: filters.status ? (STATUS_CONFIG[filters.status]?.bg || '#f8fafc') : 'var(--fd-surface)',
            border: `1px solid ${filters.status ? (STATUS_CONFIG[filters.status]?.color || '#94a3b8') : 'var(--fd-border)'}`,
            color: filters.status ? (STATUS_CONFIG[filters.status]?.color || '#475569') : 'var(--fd-ink-3)',
          }}
          value={filters.status || ''}
          onChange={e => onChange({ ...filters, status: e.target.value })}
        >
          <option value="">All Statuses</option>
          {Object.entries(STATUS_CONFIG).map(([val, s]) => (
            <option key={val} value={val}>{s.label}</option>
          ))}
        </select>
      </div>

      {/* Overdue quick-filter */}
      {overdueCount > 0 && (
        <button
          onClick={() => onChange(filters.overdueOnly ? { ...filters, overdueOnly: false } : { ...filters, overdueOnly: true })}
          className="flex items-center gap-1.5 text-[12px] font-semibold px-2.5 py-1.5 rounded-lg transition-all"
          style={{
            background: filters.overdueOnly ? '#fef2f2' : 'var(--fd-surface)',
            border: `1px solid ${filters.overdueOnly ? '#ef4444' : '#fecaca'}`,
            color: '#b91c1c',
          }}
        >
          <AlertTriangle size={11} />
          Overdue ({overdueCount})
        </button>
      )}

      {/* Clear filters */}
      {hasActive && (
        <button
          onClick={() => onChange({ client: '', type: '', status: '', overdueOnly: false })}
          className="flex items-center gap-1 text-[11px] font-medium px-2 py-1.5 rounded-lg transition-all hover:opacity-70"
          style={{ background: 'var(--fd-surface-sunken)', color: 'var(--fd-ink-4)', border: '1px solid var(--fd-border)' }}
        >
          <X size={10} /> Clear
        </button>
      )}
    </div>
  );
}

// ─── Mobile Day Bottom Sheet ──────────────────────────────────────────────────
function DaySheet({ day, events, onClose, onViewEvent, onNewEvent }) {
  const dayEvents = events.filter(ev => {
    const evStart = parseISO(ev.startDate);
    const evEnd   = ev.endDate ? parseISO(ev.endDate) : evStart;
    return evStart <= endOfDay(day) && evEnd >= startOfDay(day);
  });

  const sheet = (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative w-full sm:w-[420px] sm:max-w-[90vw] rounded-t-3xl sm:rounded-3xl pt-3 pb-6 px-5 overflow-y-auto"
        style={{ background: 'var(--fd-surface)', boxShadow: '0 -8px 40px rgba(0,0,0,0.15)', maxHeight: '70vh' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="w-10 h-1 rounded-full mx-auto mb-4" style={{ background: 'var(--fd-border-strong)' }} />
        <div className="flex items-start justify-between mb-5">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--fd-ink-4)' }}>
              {format(day, 'EEEE')}
            </p>
            <h2 className="text-[24px] font-black leading-none mt-0.5" style={{ color: 'var(--fd-ink-1)' }}>
              {format(day, 'MMMM d')}
            </h2>
          </div>
          <button
            onClick={() => onNewEvent(day)}
            className="flex items-center gap-1.5 text-[13px] font-semibold px-3 py-2 rounded-xl"
            style={{ background: '#4f6ef0', color: '#fff' }}
          >
            <Plus size={14} /> Add
          </button>
        </div>

        {dayEvents.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-[14px]" style={{ color: 'var(--fd-ink-4)' }}>No events this day</p>
            <button onClick={() => onNewEvent(day)} className="mt-3 text-[13px] font-semibold" style={{ color: '#4f6ef0' }}>
              + Add an event
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {dayEvents.map(ev => {
              const color = EVENT_COLORS[ev.type] || EVENT_COLORS.other;
              const overdue = ev.isOverdue;
              return (
                <button
                  key={ev._id}
                  onClick={() => onViewEvent(ev)}
                  className="w-full text-left flex items-start gap-3 p-3.5 rounded-2xl active:opacity-60 transition-opacity"
                  style={{ background: overdue ? '#fef2f2' : 'var(--fd-surface-sunken)' }}
                >
                  <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ background: overdue ? '#ef4444' : color.bg, minHeight: 40 }} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="text-[14px] font-semibold truncate" style={{ color: 'var(--fd-ink-1)' }}>
                        {ev.title}
                      </p>
                      {overdue && <AlertTriangle size={12} style={{ color: '#ef4444', flexShrink: 0 }} />}
                    </div>
                    <p className="text-[12px] mt-0.5" style={{ color: 'var(--fd-ink-4)' }}>
                      {format(parseISO(ev.startDate), 'h:mm a')}
                      {ev.endDate && ev.endDate !== ev.startDate &&
                        ` – ${format(parseISO(ev.endDate), 'h:mm a')}`}
                    </p>
                    {ev.client && (
                      <p className="text-[11px] mt-0.5 flex items-center gap-1" style={{ color: 'var(--fd-ink-4)' }}>
                        <Building2 size={9} /> {ev.client.company || ev.client.name}
                      </p>
                    )}
                  </div>
                  <span
                    className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 self-center"
                    style={{ background: color.light, color: color.text }}
                  >
                    {ev.type === 'shoot' && ev.shootSubtype
                      ? (SHOOT_SUBTYPE_ICONS[ev.shootSubtype] + ' ' + (SHOOT_SUBTYPE_LABELS[ev.shootSubtype] || TYPE_LABELS[ev.type]))
                      : (TYPE_LABELS[ev.type] || ev.type)}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  return ReactDOM.createPortal(sheet, document.body);
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function CalendarPage() {
  const toast = useToast();
  const { user } = useAuthStore();
  const [current, setCurrent]   = useState(new Date());
  const [events, setEvents]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [modal, setModal]       = useState(null);
  const [sheetDay, setSheetDay] = useState(null);
  const [showSidebar, setShowSidebar] = useState(true);
  const [clients, setClients]   = useState([]);
  const [filters, setFilters]   = useState({ client: '', type: '', status: '', overdueOnly: false });
  const [importantDays, setImportantDays] = useState([]);
  const [showManageDays, setShowManageDays] = useState(false);

  const canManageDays = user?.role === 'admin' || user?.role === 'manager';

  // Fetch important days whenever month changes
  const fetchImportantDays = useCallback(async () => {
    const from = startOfWeek(startOfMonth(current), { weekStartsOn: 1 }).toISOString();
    const to   = endOfWeek(endOfMonth(current),   { weekStartsOn: 1 }).toISOString();
    try {
      const { data } = await api.get(`/important-days?from=${from}&to=${to}`);
      setImportantDays(data.days || []);
    } catch { /* silent */ }
  }, [current]);

  useEffect(() => { fetchImportantDays(); }, [fetchImportantDays]);

  // Fetch clients scoped to current user's role
  useEffect(() => {
    api.get('/calendar/clients')
      .then(({ data }) => setClients(data.clients || []))
      .catch(() => {});
  }, []);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const from = startOfWeek(startOfMonth(current), { weekStartsOn: 1 }).toISOString();
      const to   = endOfWeek(endOfMonth(current),   { weekStartsOn: 1 }).toISOString();
      const params = new URLSearchParams({ from, to });
      if (filters.client) params.set('client', filters.client);
      if (filters.type)   params.set('type',   filters.type);
      if (filters.status) params.set('status', filters.status);
      const { data } = await api.get(`/calendar?${params.toString()}`);
      setEvents(data.events || []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [current, filters.client, filters.type, filters.status]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  // Overdue count (client-side, across loaded events)
  const overdueCount = events.filter(ev => ev.isOverdue).length;

  // Client-side overdue filter (only for overdueOnly toggle since it's a UI filter)
  const displayedEvents = filters.overdueOnly
    ? events.filter(ev => ev.isOverdue)
    : events;

  const handleSave = async (form, isNew) => {
    try {
      if (isNew) {
        const { data } = await api.post('/calendar', form);
        setEvents(prev => [...prev, data.event]);
        toast({ type: 'success', title: 'Event created' });
      } else {
        const { data } = await api.put(`/calendar/${form._id}`, form);
        setEvents(prev => prev.map(e => e._id === form._id ? data.event : e));
        toast({ type: 'success', title: 'Event updated' });
      }
    } catch (err) {
      toast({ type: 'error', title: 'Failed to save event', message: err?.response?.data?.message });
      throw err;
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/calendar/${id}`);
      setEvents(prev => prev.filter(e => e._id !== id));
      toast({ type: 'success', title: 'Event deleted' });
    } catch {
      toast({ type: 'error', title: 'Failed to delete event' });
    }
  };

  const handleStatusChange = async (id, newStatus) => {
    try {
      const { data } = await api.put(`/calendar/${id}`, { status: newStatus });
      setEvents(prev => prev.map(e => e._id === id ? data.event : e));
      // Update modal if open
      setModal(m => m?.event?._id === id ? { ...m, event: data.event } : m);
      toast({ type: 'success', title: `Marked as ${STATUS_CONFIG[newStatus]?.label || newStatus}` });
    } catch (err) {
      toast({ type: 'error', title: 'Failed to update status', message: err?.response?.data?.message });
    }
  };

  const handleReadyChange = async (id, isReady) => {
    try {
      const { data } = await api.put(`/calendar/${id}`, { isReady });
      setEvents(prev => prev.map(e => e._id === id ? data.event : e));
      setModal(m => m?.event?._id === id ? { ...m, event: data.event } : m);
      toast({ type: 'success', title: isReady ? 'Marked as Ready' : 'Marked as Not Ready' });
    } catch (err) {
      toast({ type: 'error', title: 'Failed to update', message: err?.response?.data?.message });
    }
  };


  // Grid
  const monthStart = startOfMonth(current);
  const monthEnd   = endOfMonth(current);
  const calStart   = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd     = endOfWeek(monthEnd,     { weekStartsOn: 1 });
  const days       = eachDayOfInterval({ start: calStart, end: calEnd });

  const eventsOnDay = (day) => {
    const ds = startOfDay(day), de = endOfDay(day);
    return displayedEvents.filter(ev => {
      const s = parseISO(ev.startDate);
      const e = ev.endDate ? parseISO(ev.endDate) : s;
      return s <= de && e >= ds;
    });
  };

  const importantDaysOnDay = (day) =>
    importantDays.filter(d => isSameDay(parseISO(d.date), day));

  const todayEvents = displayedEvents
    .filter(ev => isSameDay(parseISO(ev.startDate), new Date()))
    .sort((a, b) => new Date(a.startDate) - new Date(b.startDate));

  const upcomingEvents = displayedEvents
    .filter(ev => { const d = parseISO(ev.startDate); return d > new Date() && d <= endOfMonth(current); })
    .sort((a, b) => new Date(a.startDate) - new Date(b.startDate))
    .slice(0, 5);

  const overdueEvents = displayedEvents
    .filter(ev => ev.isOverdue)
    .sort((a, b) => new Date(a.endDate) - new Date(b.endDate))
    .slice(0, 5);

  return (
    <div className="animate-fade-in">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-3 sm:mb-5 gap-2 sm:gap-3">
        <div className="min-w-0">
          <h1 className="text-[18px] sm:text-[22px] font-bold tracking-[-0.02em]" style={{ color: 'var(--fd-ink-1)' }}>
            Calendar
          </h1>
          <p className="text-[11px] sm:text-[13px] mt-0.5" style={{ color: 'var(--fd-ink-4)' }}>
            {format(current, 'MMMM yyyy')} · {displayedEvents.length} event{displayedEvents.length !== 1 ? 's' : ''}
            {overdueCount > 0 && !filters.overdueOnly && (
              <span className="ml-2 inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                style={{ background: '#fef2f2', color: '#b91c1c' }}>
                <AlertTriangle size={9} /> {overdueCount} overdue
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
          <button
            onClick={() => setCurrent(new Date())}
            className="hidden sm:block text-[12px] font-semibold px-3 py-1.5 rounded-lg"
            style={{ background: 'var(--fd-surface)', border: '1px solid var(--fd-border)', color: 'var(--fd-ink-3)' }}
          >
            Today
          </button>

          <div className="flex items-center rounded-lg overflow-hidden" style={{ border: '1px solid var(--fd-border)' }}>
            <button
              className="p-1.5 sm:p-2 hover:bg-[var(--fd-surface-sunken)] transition-colors"
              style={{ background: 'var(--fd-surface)', color: 'var(--fd-ink-3)', borderRight: '1px solid var(--fd-border)' }}
              onClick={() => setCurrent(subMonths(current, 1))}
            >
              <ChevronLeft size={14} />
            </button>
            <span className="px-2 sm:px-3 text-[12px] sm:text-[13px] font-semibold whitespace-nowrap"
              style={{ background: 'var(--fd-surface)', color: 'var(--fd-ink-1)' }}>
              <span className="sm:hidden">{format(current, 'MMM yy')}</span>
              <span className="hidden sm:inline">{format(current, 'MMMM yyyy')}</span>
            </span>
            <button
              className="p-1.5 sm:p-2 hover:bg-[var(--fd-surface-sunken)] transition-colors"
              style={{ background: 'var(--fd-surface)', color: 'var(--fd-ink-3)', borderLeft: '1px solid var(--fd-border)' }}
              onClick={() => setCurrent(addMonths(current, 1))}
            >
              <ChevronRight size={14} />
            </button>
          </div>

          <Button size="sm" onClick={() => setModal({ mode: 'new', defaultDate: new Date() })}>
            <Plus size={13} />
            <span className="hidden sm:inline ml-1">Add Event</span>
          </Button>

          {canManageDays && (
            <button
              onClick={() => setShowManageDays(true)}
              className="hidden sm:flex items-center gap-1.5 text-[12px] font-semibold px-2.5 py-1.5 rounded-lg transition-all"
              style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e' }}
              title="Manage Important Days"
            >
              <Star size={12} style={{ fill: '#f59e0b', color: '#f59e0b' }} />
              <span className="hidden lg:inline">Important Days</span>
            </button>
          )}

          <button
            onClick={() => setShowSidebar(v => !v)}
            className="hidden lg:flex items-center justify-center w-8 h-8 rounded-lg transition-colors"
            style={{
              background: showSidebar ? 'var(--fd-sidebar-active)' : 'var(--fd-surface)',
              border: '1px solid var(--fd-border)',
              color: showSidebar ? 'var(--fd-sidebar-link-active)' : 'var(--fd-ink-4)',
            }}
          >
            <List size={14} />
          </button>
        </div>
      </div>

      {/* ── Filter Bar ── */}
      <FilterBar
        clients={clients}
        filters={filters}
        onChange={setFilters}
        overdueCount={overdueCount}
      />


      {/* ── Content KPIs ── */}
      {(() => {
        const contentTypes = ['reel', 'static_post', 'carousel', 'story', 'other'];
        const contentEvents = displayedEvents.filter(ev => contentTypes.includes(ev.type) && ev.status === 'done');
        const kpis = [
          { label: 'Total Content', count: contentEvents.length, color: '#4f6ef0', bg: '#eef2ff', icon: '📦' },
          { label: 'Posts',         count: contentEvents.filter(ev => ev.type === 'static_post' || ev.type === 'carousel').length, color: '#8b5cf6', bg: '#f5f3ff', icon: '🖼️' },
          { label: 'Reels',         count: contentEvents.filter(ev => ev.type === 'reel').length,        color: '#06b6d4', bg: '#ecfeff', icon: '🎬' },
          { label: 'Stories',       count: contentEvents.filter(ev => ev.type === 'story').length,       color: '#e11d48', bg: '#fff1f2', icon: '📖' },
          { label: 'Extra Designs', count: contentEvents.filter(ev => ev.type === 'other').length,       color: '#94a3b8', bg: '#f8fafc', icon: '✨' },
          { label: 'Overdue',       count: overdueCount,                                                  color: '#ef4444', bg: '#fef2f2', icon: '⚠️' },
        ];
        return (
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 sm:gap-3 mb-3 sm:mb-5">
            {kpis.map(k => (
              <div key={k.label} className="rounded-xl px-3 py-2.5 flex items-center gap-2.5" style={{ background: k.bg, border: `1px solid ${k.color}22` }}>
                <span className="text-base leading-none flex-shrink-0">{k.icon}</span>
                <div className="min-w-0">
                  <p className="text-[18px] sm:text-[22px] font-bold leading-none tracking-tight" style={{ color: k.color }}>{k.count}</p>
                  <p className="text-[10px] sm:text-[11px] font-medium mt-0.5 truncate" style={{ color: k.color + 'aa' }}>{k.label}</p>
                </div>
              </div>
            ))}
          </div>
        );
      })()}

      {/* ── Body ── */}
      <div className="flex gap-5">
        {/* Calendar grid */}
        <div className="flex-1 min-w-0">
          <div
            className="rounded-xl sm:rounded-2xl overflow-hidden"
            style={{ background: 'var(--fd-surface)', border: '1px solid var(--fd-border)', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
          >
            {/* Day headers */}
            <div className="grid grid-cols-7" style={{ borderBottom: '1px solid var(--fd-border)' }}>
              {DAY_LABELS_LONG.map((d, i) => (
                <div
                  key={d}
                  className="py-2 sm:py-3 text-center font-bold uppercase tracking-wider select-none"
                  style={{
                    fontSize: 10,
                    color: i >= 5 ? 'var(--fd-ink-5)' : 'var(--fd-ink-4)',
                    borderRight: i < 6 ? '1px solid var(--fd-border-subtle)' : 'none',
                  }}
                >
                  <span className="sm:hidden">{DAY_LABELS_SHORT[i]}</span>
                  <span className="hidden sm:inline">{d}</span>
                </div>
              ))}
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-16 sm:py-24">
                <Spinner size="lg" />
              </div>
            ) : (
              <div className="grid grid-cols-7">
                {days.map((day, i) => {
                  const dayEvts   = eventsOnDay(day);
                  const dayImpDays = importantDaysOnDay(day);
                  const inMonth   = isSameMonth(day, current);
                  const today     = isToday(day);
                  const isWeekend = i % 7 >= 5;
                  const hasOverdue = dayEvts.some(ev => ev.isOverdue);

                  return (
                    <div
                      key={i}
                      className="cursor-pointer transition-colors group relative select-none"
                      style={{
                        borderRight:  i % 7 < 6 ? '1px solid var(--fd-border-subtle)' : 'none',
                        borderBottom: '1px solid var(--fd-border-subtle)',
                        background:   dayImpDays.length > 0 && inMonth
                          ? 'linear-gradient(180deg, #fffbeb 0%, transparent 28px)'
                          : !inMonth ? 'var(--fd-surface-sunken)' : isWeekend ? 'rgba(0,0,0,0.005)' : 'transparent',
                        minHeight: 'clamp(48px, 12vw, 108px)',
                      }}
                      onClick={() => setSheetDay(day)}
                    >
                      {/* Date number */}
                      <div className="flex items-start justify-between p-1 sm:p-2 mb-0.5">
                        <span
                          className="font-semibold flex items-center justify-center rounded-full flex-shrink-0 transition-all"
                          style={{
                            fontSize: 11,
                            width:      today ? 20 : 'auto',
                            height:     today ? 20 : 'auto',
                            minWidth:   today ? 20 : 0,
                            padding:    today ? 0 : '0 2px',
                            background: today ? '#4f6ef0' : 'transparent',
                            color: today ? '#fff' : !inMonth ? 'var(--fd-ink-5)' : 'var(--fd-ink-2)',
                          }}
                        >
                          {format(day, 'd')}
                        </span>
                        <div className="flex items-center gap-0.5">
                          {hasOverdue && (
                            <span className="text-[8px]" title="Has overdue events">⚠️</span>
                          )}
                          <button
                            onClick={e => { e.stopPropagation(); setModal({ mode: 'new', defaultDate: day }); }}
                            className="hidden sm:flex items-center justify-center w-5 h-5 rounded-full transition-transform hover:scale-110 shadow-sm"
                            style={{ color: '#fff', background: '#4f6ef0' }}
                            title="Add event"
                          >
                            <Plus size={11} strokeWidth={2.5} />
                          </button>
                        </div>
                      </div>

                      {/* Important day banners — shown when this day has festival/holiday markers */}
                      {dayImpDays.length > 0 && (
                        <div className="hidden sm:block px-1 mb-0.5 space-y-[2px]">
                          {dayImpDays.map(d => (
                            <div key={d._id}
                              className="w-full text-[9px] font-bold px-1 py-[1px] rounded flex items-center gap-0.5 truncate"
                              style={{ background: '#fef9c3', color: '#713f12', border: '1px solid #fde68a' }}
                              title={d.name}
                            >
                              <span className="flex-shrink-0" style={{ fontSize: 9 }}>{d.emoji}</span>
                              <span className="truncate">{d.name}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Mobile: star dot for important days */}
                      {dayImpDays.length > 0 && (
                        <div className="sm:hidden px-1 pb-0.5 flex items-center gap-0.5">
                          {dayImpDays.slice(0, 1).map(d => (
                            <span key={d._id} className="text-[8px]" title={d.name}>{d.emoji}</span>
                          ))}
                          {dayImpDays.length > 1 && (
                            <span className="text-[7px]" style={{ color: '#b45309' }}>+{dayImpDays.length - 1}</span>
                          )}
                        </div>
                      )}

                      {/* Mobile: colored dots only */}
                      <div className="sm:hidden px-1 pb-1 flex flex-wrap gap-[3px]">
                        {dayEvts.slice(0, 3).map(ev => {
                          const c = EVENT_COLORS[ev.type] || EVENT_COLORS.other;
                          return (
                            <span
                              key={ev._id}
                              className="inline-block w-[5px] h-[5px] rounded-full flex-shrink-0"
                              style={{ background: ev.isOverdue ? '#ef4444' : c.bg }}
                            />
                          );
                        })}
                        {dayEvts.length > 3 && (
                          <span style={{ fontSize: 8, color: 'var(--fd-ink-5)', lineHeight: '5px' }}>
                            +{dayEvts.length - 3}
                          </span>
                        )}
                      </div>

                      {/* Desktop: event chips */}
                      <div className="hidden sm:block px-1 pb-1">
                        {dayEvts.slice(0, 3).map(ev => {
                          const evStart = parseISO(ev.startDate);
                          const evEnd   = ev.endDate ? parseISO(ev.endDate) : evStart;
                          return (
                            <EventChip
                              key={ev._id}
                              event={ev}
                              isStart={isSameDay(evStart, day)}
                              isEnd={isSameDay(evEnd, day)}
                              onClick={ev => setModal({ mode: 'view', event: ev })}
                            />
                          );
                        })}
                        {dayEvts.length > 3 && (
                          <div className="text-[10px] font-medium pl-1" style={{ color: 'var(--fd-ink-5)' }}>
                            +{dayEvts.length - 3} more
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-3 px-1">
            {Object.entries(EVENT_COLORS).map(([type, color]) => (
              <div key={type} className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color.bg }} />
                <span className="text-[10px] sm:text-[11px] font-medium" style={{ color: 'var(--fd-ink-4)' }}>
                  {TYPE_LABELS[type]}
                </span>
              </div>
            ))}
            <div className="flex items-center gap-1">
              <AlertTriangle size={8} style={{ color: '#ef4444' }} />
              <span className="text-[10px] sm:text-[11px] font-medium" style={{ color: 'var(--fd-ink-4)' }}>Overdue</span>
            </div>
          </div>
        </div>

        {/* Sidebar — desktop only, toggleable */}
        {showSidebar && (
          <div className="hidden lg:flex flex-col gap-4 w-[220px] flex-shrink-0">
            {/* Important Days this month */}
            {importantDays.length > 0 && (
              <div className="rounded-2xl p-4" style={{ background: '#fffbeb', border: '1px solid #fde68a' }}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-1.5">
                    <Star size={12} style={{ color: '#f59e0b', fill: '#f59e0b' }} />
                    <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: '#92400e' }}>Important Days</span>
                  </div>
                  {canManageDays && (
                    <button onClick={() => setShowManageDays(true)}
                      className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md hover:opacity-70 transition-opacity"
                      style={{ color: '#92400e', background: '#fef9c3', border: '1px solid #fde68a' }}>
                      Manage
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  {importantDays.map(d => (
                    <div key={d._id} className="flex items-start gap-2">
                      <span className="text-[16px] flex-shrink-0 leading-tight">{d.emoji}</span>
                      <div className="min-w-0">
                        <p className="text-[12px] font-semibold truncate" style={{ color: '#78350f' }}>{d.name}</p>
                        <p className="text-[11px]" style={{ color: '#92400e' }}>{format(parseISO(d.date), 'EEE, MMM d')}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* If no important days yet and user can manage — show a compact prompt */}
            {importantDays.length === 0 && canManageDays && (
              <button onClick={() => setShowManageDays(true)}
                className="rounded-2xl p-3 text-left flex items-center gap-2 hover:opacity-80 transition-opacity"
                style={{ background: '#fffbeb', border: '1px dashed #fde68a' }}>
                <Star size={12} style={{ color: '#f59e0b', fill: '#f59e0b', flexShrink: 0 }} />
                <span className="text-[11px] font-medium" style={{ color: '#92400e' }}>Add festivals &amp; holidays</span>
              </button>
            )}

            {/* Overdue — only shown when there are overdue events */}
            {overdueEvents.length > 0 && (
              <div className="rounded-2xl p-4" style={{ background: '#fef2f2', border: '1px solid #fecaca' }}>
                <div className="flex items-center gap-1.5 mb-3">
                  <AlertTriangle size={12} style={{ color: '#ef4444' }} />
                  <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: '#b91c1c' }}>Overdue</span>
                </div>
                <div className="space-y-2">
                  {overdueEvents.map(ev => {
                    const c = EVENT_COLORS[ev.type] || EVENT_COLORS.other;
                    return (
                      <button key={ev._id} onClick={() => setModal({ mode: 'view', event: ev })}
                        className="w-full text-left flex items-start gap-2 hover:opacity-80 transition-opacity">
                        <div className="w-0.5 self-stretch rounded-full flex-shrink-0 mt-0.5" style={{ background: '#ef4444' }} />
                        <div className="min-w-0">
                          <p className="text-[12px] font-medium truncate" style={{ color: '#7f1d1d' }}>{ev.title}</p>
                          <p className="text-[11px]" style={{ color: '#b91c1c' }}>
                            Due {format(parseISO(ev.endDate), 'MMM d')}
                          </p>
                          {ev.client && (
                            <p className="text-[10px]" style={{ color: '#b91c1c', opacity: 0.7 }}>
                              {ev.client.company || ev.client.name}
                            </p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Today */}
            <div className="rounded-2xl p-4" style={{ background: 'var(--fd-surface)', border: '1px solid var(--fd-border)' }}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--fd-ink-4)' }}>Today</span>
                <span className="text-[11px] font-semibold" style={{ color: 'var(--fd-ink-3)' }}>{format(new Date(), 'MMM d')}</span>
              </div>
              {todayEvents.length === 0 ? (
                <p className="text-[12px]" style={{ color: 'var(--fd-ink-5)' }}>No events today</p>
              ) : (
                <div className="space-y-2">
                  {todayEvents.map(ev => {
                    const c = EVENT_COLORS[ev.type] || EVENT_COLORS.other;
                    const statusCfg = STATUS_CONFIG[ev.status] || STATUS_CONFIG.pending;
                    return (
                      <button key={ev._id} onClick={() => setModal({ mode: 'view', event: ev })}
                        className="w-full text-left flex items-start gap-2 hover:opacity-80 transition-opacity">
                        <div className="w-0.5 self-stretch rounded-full flex-shrink-0 mt-0.5" style={{ background: c.bg }} />
                        <div className="min-w-0 flex-1">
                          <p className="text-[12px] font-medium truncate" style={{ color: 'var(--fd-ink-2)' }}>{ev.title}</p>
                          <div className="flex items-center gap-1 mt-0.5">
                            <p className="text-[11px]" style={{ color: 'var(--fd-ink-4)' }}>{format(parseISO(ev.startDate), 'h:mm a')}</p>
                            <span className="text-[9px] font-semibold px-1 py-[1px] rounded" style={{ background: statusCfg.bg, color: statusCfg.color }}>
                              {statusCfg.label}
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Upcoming */}
            <div className="rounded-2xl p-4" style={{ background: 'var(--fd-surface)', border: '1px solid var(--fd-border)' }}>
              <div className="mb-3">
                <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--fd-ink-4)' }}>Upcoming</span>
              </div>
              {upcomingEvents.length === 0 ? (
                <p className="text-[12px]" style={{ color: 'var(--fd-ink-5)' }}>Nothing scheduled</p>
              ) : (
                <div className="space-y-3">
                  {upcomingEvents.map(ev => {
                    const c = EVENT_COLORS[ev.type] || EVENT_COLORS.other;
                    return (
                      <button key={ev._id} onClick={() => setModal({ mode: 'view', event: ev })}
                        className="w-full text-left flex items-start gap-2 hover:opacity-80 transition-opacity">
                        <div className="w-7 h-7 rounded-lg flex-shrink-0 flex flex-col items-center justify-center" style={{ background: c.light }}>
                          <span className="text-[9px] font-bold uppercase leading-none" style={{ color: c.text }}>{format(parseISO(ev.startDate), 'MMM')}</span>
                          <span className="text-[13px] font-black leading-none" style={{ color: c.bg }}>{format(parseISO(ev.startDate), 'd')}</span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-[12px] font-medium truncate" style={{ color: 'var(--fd-ink-2)' }}>{ev.title}</p>
                          <p className="text-[11px]" style={{ color: 'var(--fd-ink-4)' }}>{format(parseISO(ev.startDate), 'h:mm a')}</p>
                          {ev.client && (
                            <p className="text-[10px]" style={{ color: 'var(--fd-ink-5)' }}>
                              {ev.client.company || ev.client.name}
                            </p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Mobile today strip */}
      {todayEvents.length > 0 && (
        <div className="lg:hidden mt-4 rounded-xl overflow-hidden" style={{ background: 'var(--fd-surface)', border: '1px solid var(--fd-border)' }}>
          <div className="px-4 pt-3 pb-1">
            <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--fd-ink-4)' }}>
              Today · {format(new Date(), 'MMM d')}
            </span>
          </div>
          <div className="px-3 pb-3 space-y-1.5 mt-2">
            {todayEvents.map(ev => {
              const c = EVENT_COLORS[ev.type] || EVENT_COLORS.other;
              return (
                <button
                  key={ev._id}
                  onClick={() => setModal({ mode: 'view', event: ev })}
                  className="w-full text-left flex items-center gap-3 p-2.5 rounded-xl active:opacity-60 transition-opacity"
                  style={{ background: ev.isOverdue ? '#fef2f2' : 'var(--fd-surface-sunken)' }}
                >
                  <div className="w-1 self-stretch rounded-full" style={{ background: ev.isOverdue ? '#ef4444' : c.bg, minHeight: 32 }} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="text-[13px] font-semibold truncate" style={{ color: 'var(--fd-ink-1)' }}>{ev.title}</p>
                      {ev.isOverdue && <AlertTriangle size={11} style={{ color: '#ef4444', flexShrink: 0 }} />}
                    </div>
                    <p className="text-[11px]" style={{ color: 'var(--fd-ink-4)' }}>{format(parseISO(ev.startDate), 'h:mm a')}</p>
                  </div>
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ background: c.light, color: c.text }}>
                    {ev.type === 'shoot' && ev.shootSubtype
                      ? (SHOOT_SUBTYPE_ICONS[ev.shootSubtype] + ' ' + (SHOOT_SUBTYPE_LABELS[ev.shootSubtype] || TYPE_LABELS[ev.type]))
                      : TYPE_LABELS[ev.type]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Mobile day bottom sheet */}
      {sheetDay && (
        <DaySheet
          day={sheetDay}
          events={displayedEvents}
          onClose={() => setSheetDay(null)}
          onViewEvent={ev => { setSheetDay(null); setModal({ mode: 'view', event: ev }); }}
          onNewEvent={day => { setSheetDay(null); setModal({ mode: 'new', defaultDate: day }); }}
        />
      )}

      {/* Modals */}
      {modal?.mode === 'view' && (
        <EventViewModal
          event={modal.event}
          onClose={() => setModal(null)}
          onEdit={() => setModal({ mode: 'edit', event: modal.event })}
          onDelete={handleDelete}
          onStatusChange={handleStatusChange}
          onReadyChange={handleReadyChange}
          canAct={user?.role === 'admin' || String(modal.event?.createdBy?._id || modal.event?.createdBy) === String(user?._id)}
        />
      )}
      {(modal?.mode === 'edit' || modal?.mode === 'new') && (
        <EventEditModal
          event={modal.mode === 'edit' ? modal.event : null}
          defaultDate={modal.defaultDate}
          onClose={() => setModal(null)}
          onSave={handleSave}
          onDelete={handleDelete}
          clients={clients}
          prefillClientId={null} // null = show client selector
          canAct={user?.role === 'admin' || String(modal.event?.createdBy?._id || modal.event?.createdBy) === String(user?._id)}
        />
      )}

      {showManageDays && (
        <ManageImportantDaysModal
          onClose={() => setShowManageDays(false)}
          onDaysChanged={fetchImportantDays}
        />
      )}
    </div>
  );
}