import React, { useEffect, useState } from 'react';
import {
  Camera, Video, Clapperboard, Package, CalendarDays, Megaphone,
  Scissors, Palette, PenLine, Briefcase, Star, Save, Check,
} from 'lucide-react';
import api from '../../lib/api';
import { Button, Modal, Input, Select, useToast } from '../ui/index';

// ─── Project types ───────────────────────────────────────────────────────────
export const PROJECT_TYPES = [
  { value: 'photo_shoot',       label: 'Photo shoot',       icon: Camera },
  { value: 'video_shoot',       label: 'Video shoot',       icon: Video },
  { value: 'reel_shoot',        label: 'Reel shoot',        icon: Clapperboard },
  { value: 'product_shoot',     label: 'Product shoot',     icon: Package },
  { value: 'event_shoot',       label: 'Event coverage',    icon: CalendarDays },
  { value: 'influencer_collab', label: 'Influencer collab', icon: Megaphone },
  { value: 'editing',           label: 'Editing',           icon: Scissors },
  { value: 'design',            label: 'Design',            icon: Palette },
  { value: 'content_writing',   label: 'Content writing',   icon: PenLine },
  { value: 'other',             label: 'Other',             icon: Briefcase },
];
export const typeMeta = (t) => PROJECT_TYPES.find(p => p.value === t) || PROJECT_TYPES[PROJECT_TYPES.length - 1];

// ─── Review tags ─────────────────────────────────────────────────────────────
export const REVIEW_TAGS = [
  { value: 'punctual',        label: 'Punctual',          good: true },
  { value: 'great_quality',   label: 'Great quality',     good: true },
  { value: 'creative',        label: 'Creative',          good: true },
  { value: 'professional',    label: 'Professional',      good: true },
  { value: 'easy_to_work',    label: 'Easy to work with', good: true },
  { value: 'fast_delivery',   label: 'Fast delivery',     good: true },
  { value: 'late',            label: 'Was late',          good: false },
  { value: 'needed_revisions',label: 'Needed revisions',  good: false },
  { value: 'hard_to_reach',   label: 'Hard to reach',     good: false },
  { value: 'over_budget',     label: 'Went over budget',  good: false },
];
export const tagMeta = (t) => REVIEW_TAGS.find(x => x.value === t) || { value: t, label: t, good: true };

// ─── Field helpers (mirrors ContactsPage) ────────────────────────────────────
export const FIELD_COLORS = {
  videographer:        { bg: '#eff0fe', color: '#3a56d4' },
  photographer:        { bg: '#fdf2ff', color: '#7e22ce' },
  graphic_designer:    { bg: '#fef7ea', color: '#92600a' },
  copywriter:          { bg: '#edf7f1', color: '#2a7d4f' },
  web_developer:       { bg: '#f0f9ff', color: '#0369a1' },
  video_editor:        { bg: '#fff0f0', color: '#b91c1c' },
  animator:            { bg: '#f0fdf4', color: '#15803d' },
  influencer:          { bg: '#fffbeb', color: '#b45309' },
  content_writer:      { bg: '#fdf2ff', color: '#7e22ce' },
  paid_ads_specialist: { bg: '#eff0fe', color: '#3a56d4' },
  seo_specialist:      { bg: '#edf7f1', color: '#2a7d4f' },
  other:               { bg: '#f5f5f5', color: '#555' },
};
export const fieldLabel = (f) =>
  f?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || '—';

export const RATE_LABELS = {
  per_project: 'per project', per_hour: 'per hour', per_day: 'per day', monthly: 'monthly', other: '',
};

export function formatFollowers(n) {
  if (!n) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return n.toLocaleString();
}

// ─── Money / phone / date helpers ────────────────────────────────────────────
export const money = (amount, currency = 'INR') =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: currency || 'INR', maximumFractionDigits: 0 })
    .format(amount || 0);

// wa.me needs country code + digits only. Bare 10-digit numbers are treated as Indian.
export function whatsappLink(phone) {
  if (!phone) return null;
  let d = String(phone).replace(/\D/g, '');
  if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  if (d.length === 10) d = `91${d}`;
  return d.length >= 10 ? `https://wa.me/${d}` : null;
}

// ISO → value for <input type="datetime-local"> (in the browser's local time)
export function toLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const dateParts = (iso) => {
  const d = new Date(iso);
  return { day: d.getDate(), month: MONTHS[d.getMonth()], year: d.getFullYear() };
};
export const fmtDate = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
};
export const fmtTime = (iso) =>
  new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
// "Sat, 14 Mar 2026 · 4:30 PM"
export const fmtDateTime = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  const wd = d.toLocaleDateString('en-IN', { weekday: 'short' });
  return `${wd}, ${fmtDate(iso)} · ${fmtTime(iso)}`;
};

// Open (not yet completed/cancelled) but its date has already passed → nudge to update it
export function needsUpdate(p) {
  if (!p || !['upcoming', 'in_progress'].includes(p.status)) return false;
  const ref = new Date(p.endDate || p.startDate);
  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
  return ref < startOfToday;
}

export function relativeDay(iso) {
  const d = new Date(iso); d.setHours(0, 0, 0, 0);
  const t = new Date(); t.setHours(0, 0, 0, 0);
  const diff = Math.round((d - t) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  if (diff > 1) return `In ${diff} days`;
  return `${Math.abs(diff)} days ago`;
}

// ─── Small components ────────────────────────────────────────────────────────
const CHIP = {
  upcoming:    { bg: 'var(--fd-status-info-bg)',    color: 'var(--fd-status-info-text)',    label: 'Upcoming' },
  in_progress: { bg: 'var(--fd-accent-tint)',       color: 'var(--fd-accent-hover)',        label: 'In progress' },
  completed:   { bg: 'var(--fd-status-success-bg)', color: 'var(--fd-status-success-text)', label: 'Completed' },
  cancelled:   { bg: 'var(--fd-status-neutral-bg)', color: 'var(--fd-status-neutral-text)', label: 'Cancelled' },
  warning:     { bg: 'var(--fd-status-warning-bg)', color: 'var(--fd-status-warning-text)', label: '' },
  danger:      { bg: 'var(--fd-status-danger-bg)',  color: 'var(--fd-status-danger-text)',  label: '' },
  neutral:     { bg: 'var(--fd-status-neutral-bg)', color: 'var(--fd-status-neutral-text)', label: '' },
};

export function Chip({ kind = 'neutral', children, className = '' }) {
  const c = CHIP[kind] || CHIP.neutral;
  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${className}`}
      style={{ background: c.bg, color: c.color }}
    >
      {children ?? c.label}
    </span>
  );
}

export const StatusChip = ({ status }) => <Chip kind={status} />;

export function PayChip({ project }) {
  if (project.status === 'cancelled') return null;
  switch (project.paymentStatus) {
    case 'paid':    return <Chip kind="completed">Paid</Chip>;
    case 'partial': return <Chip kind="warning">Part paid</Chip>;
    case 'unpaid':  return <Chip kind="danger">Unpaid</Chip>;
    default:        return null;
  }
}

// Display-only or interactive 5-star control
export function Stars({ value = 0, size = 14, onChange }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={value ? `${value} out of 5` : 'Not rated'}>
      {[1, 2, 3, 4, 5].map(n => {
        const filled = n <= Math.round(value || 0);
        const star = (
          <Star
            size={size}
            strokeWidth={1.6}
            fill={filled ? '#f59e0b' : 'none'}
            style={{ color: filled ? '#f59e0b' : 'var(--fd-ink-5)' }}
          />
        );
        return onChange ? (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n === value ? 0 : n)}
            className="p-0.5 transition-transform hover:scale-110"
            aria-label={`${n} star${n > 1 ? 's' : ''}`}
          >
            {star}
          </button>
        ) : <span key={n}>{star}</span>;
      })}
    </span>
  );
}

// Segmented bar: paid portion filled, remainder = still owed
export function PaidBar({ paid, total, height = 8 }) {
  const pct = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;
  return (
    <div
      className="w-full rounded-full overflow-hidden"
      style={{ height, background: 'var(--fd-surface-sunken)', border: '1px solid var(--fd-border)' }}
      role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}
    >
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${pct}%`, background: pct >= 100 ? 'var(--fd-status-success-text)' : 'var(--fd-accent)' }}
      />
    </div>
  );
}

// ─── Project form (book a project / edit a project) ──────────────────────────
const EMPTY = {
  title: '', type: 'photo_shoot', description: '', deliverables: '',
  clientId: '', clientName: '', startDate: '', endDate: '', location: '',
  fee: '', addToCalendar: false,
};

function formFromProject(p, contact) {
  if (!p) {
    const defaultFee = contact?.rateType === 'per_project' && contact?.rateAmount ? String(contact.rateAmount) : '';
    return { ...EMPTY, fee: defaultFee };
  }
  return {
    title: p.title || '',
    type: p.type || 'other',
    description: p.description || '',
    deliverables: p.deliverables || '',
    clientId: p.client?._id || '',
    clientName: p.client ? '' : (p.clientName || ''),
    startDate: toLocalInput(p.startDate),
    endDate: toLocalInput(p.endDate),
    location: p.location || '',
    fee: p.fee ? String(p.fee) : '',
    addToCalendar: false,
  };
}

export function ProjectFormModal({ isOpen, onClose, contact, initial, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState(() => formFromProject(initial, contact));
  const [clients, setClients] = useState([]);
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  // Reset whenever the modal is (re)opened
  useEffect(() => {
    if (isOpen) setForm(formFromProject(initial, contact));
  }, [isOpen, initial, contact]);

  useEffect(() => {
    if (!isOpen || clients.length) return;
    api.get('/calendar/clients')
      .then(({ data }) => setClients(data.clients || []))
      .catch(() => {});
  }, [isOpen, clients.length]);

  const editing = !!initial;
  const alreadyOnCalendar = !!initial?.calendarEvent;

  const submit = async () => {
    if (!form.title.trim()) return toast({ type: 'error', title: 'Give the project a title' });
    if (!form.startDate) return toast({ type: 'error', title: 'Pick a date and time' });
    if (form.endDate && new Date(form.endDate) < new Date(form.startDate)) {
      return toast({ type: 'error', title: 'End time is before the start time' });
    }

    const payload = {
      title: form.title.trim(),
      type: form.type,
      description: form.description,
      deliverables: form.deliverables,
      client: form.clientId || null,
      clientName: form.clientId ? '' : form.clientName,
      startDate: new Date(form.startDate).toISOString(),
      endDate: form.endDate ? new Date(form.endDate).toISOString() : null,
      location: form.location,
      fee: Number(form.fee) || 0,
      addToCalendar: form.addToCalendar,
    };

    setSaving(true);
    try {
      const { data } = editing
        ? await api.put(`/contacts/${contact._id}/projects/${initial._id}`, payload)
        : await api.post(`/contacts/${contact._id}/projects`, payload);
      toast({ type: 'success', title: editing ? 'Project updated' : 'Project booked' });
      onSaved?.(data.project);
      onClose();
    } catch (err) {
      toast({ type: 'error', title: 'Could not save project', message: err?.response?.data?.message });
    } finally { setSaving(false); }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      title={editing ? 'Edit project' : `Book ${contact?.name || 'contact'} for a project`}
    >
      <div className="space-y-4">
        <Input
          label="What is it? *"
          value={form.title}
          onChange={e => set('title', e.target.value)}
          placeholder="e.g. Diwali collection reel shoot"
          autoFocus
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Select label="Type of work" value={form.type} onChange={e => set('type', e.target.value)}>
            {PROJECT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </Select>
          <div className="space-y-1.5">
            <Select
              label="Which client is it for?"
              value={form.clientId}
              onChange={e => set('clientId', e.target.value)}
            >
              <option value="">Not a listed client / internal</option>
              {clients.map(c => <option key={c._id} value={c._id}>{c.company || c.name}</option>)}
            </Select>
            {!form.clientId && (
              <input
                className="fd-input"
                value={form.clientName}
                onChange={e => set('clientName', e.target.value)}
                placeholder="Client or brand name (optional)"
              />
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input label="Starts *" type="datetime-local" value={form.startDate} onChange={e => set('startDate', e.target.value)} />
          <Input label="Ends" type="datetime-local" value={form.endDate} onChange={e => set('endDate', e.target.value)} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input label="Location" value={form.location} onChange={e => set('location', e.target.value)} placeholder="Studio, venue, or online" />
          <Input
            label={`Agreed fee (${contact?.currency || 'INR'})`}
            type="number" min="0"
            value={form.fee}
            onChange={e => set('fee', e.target.value)}
            placeholder="0"
            hint={contact?.rateAmount ? 'Pre-filled from their usual rate when it is per project.' : undefined}
          />
        </div>

        <div>
          <label className="block text-[12px] font-medium mb-1.5" style={{ color: 'var(--fd-ink-2)' }}>Brief</label>
          <textarea
            className="fd-input resize-none" rows={3}
            value={form.description}
            onChange={e => set('description', e.target.value)}
            placeholder="What is this work for? Any references, instructions or timings they should know."
          />
        </div>

        <div>
          <label className="block text-[12px] font-medium mb-1.5" style={{ color: 'var(--fd-ink-2)' }}>Deliverables</label>
          <textarea
            className="fd-input resize-none" rows={2}
            value={form.deliverables}
            onChange={e => set('deliverables', e.target.value)}
            placeholder="e.g. 3 reels, 20 edited photos, raw footage by Friday"
          />
        </div>

        {alreadyOnCalendar ? (
          <div className="flex items-center gap-2 text-[12px]" style={{ color: 'var(--fd-status-success-text)' }}>
            <Check size={13} /> On the team calendar — date, title and status changes carry over automatically.
          </div>
        ) : (
          <label className="flex items-start gap-2 text-[13px] cursor-pointer" style={{ color: 'var(--fd-ink-2)' }}>
            <input
              type="checkbox"
              className="mt-0.5"
              checked={form.addToCalendar}
              onChange={e => set('addToCalendar', e.target.checked)}
              style={{ accentColor: 'var(--fd-accent)' }}
            />
            <span>
              Also put this on the team calendar
              <span className="block text-[11.5px]" style={{ color: 'var(--fd-ink-4)' }}>
                Shows up as a shoot or event for everyone, linked to the client.
              </span>
            </span>
          </label>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" loading={saving} onClick={submit}>
            <Save size={13} /> {editing ? 'Save changes' : 'Book project'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}