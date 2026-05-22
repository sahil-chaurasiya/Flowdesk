import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Edit3, MessageSquare, Mail, Phone, Globe, Calendar,
  DollarSign, Plus, CheckCircle, CheckCircle2, Check, Clock, AlertCircle, AlertTriangle, Users, X, UserPlus,
  Instagram, Facebook, Youtube, Linkedin, Twitter, TrendingUp, Eye,
  Heart, MessageCircle, Share2, BarChart2, IndianRupee,
  ChevronLeft, ChevronRight, Star, MapPin, ThumbsUp, Trash2, Circle, Loader, XCircle,
  Target, Settings, Save, ChevronDown, Filter,
} from 'lucide-react';
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  startOfWeek, endOfWeek, isSameMonth, isSameDay, isToday,
  addMonths, subMonths, parseISO, startOfDay, endOfDay,
} from 'date-fns';
import api from '../../lib/api';
import useAuthStore from '../../context/authStore';
import { Button, Modal, Input, Textarea, Select, useToast } from '../../components/ui/index';
import { Avatar, Badge, Card, CardHeader, CardContent, Spinner, EmptyState } from '../../components/shared/LoadingScreen';
import {
  formatDate, getStatusColor, PLAN_LABELS, PLAN_COLORS, SERVICE_LABELS,
  formatCurrency, getTaskStatusColor, getPriorityColor, timeAgo
} from '../../lib/utils';

const updateTypes = ['general', 'milestone', 'report', 'alert', 'campaign_launch', 'optimization', 'meeting_notes'];

const ROLE_LABELS = {
  admin: 'Admin',
  manager: 'Project Manager',
  performance_marketer: 'Performance Marketer',
  social_media_manager: 'Social Media Manager',
  video_editor: 'Video Editor',
  graphic_designer: 'Graphic Designer',
  copywriter: 'Copywriter',
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

// ─── Event colors (same palette as CalendarPage) ─────────────────────────────
const EVENT_COLORS = {
  task_deadline: { bg: '#ef4444', light: '#fef2f2', text: '#b91c1c' },
  meeting:       { bg: '#4f6ef0', light: '#eff0fe', text: '#3a56d4' },
  reminder:      { bg: '#f59e0b', light: '#fffbeb', text: '#92600a' },
  follow_up:     { bg: '#a855f7', light: '#faf5ff', text: '#7e22ce' },
  campaign:      { bg: '#22c55e', light: '#f0fdf4', text: '#15803d' },
  shoot:         { bg: '#ec4899', light: '#fdf2f8', text: '#be185d' },
  other:         { bg: '#94a3b8', light: '#f8fafc', text: '#475569' },
};
const TYPE_LABELS = {
  task_deadline: 'Task Deadline', meeting: 'Meeting', reminder: 'Reminder',
  follow_up: 'Follow Up', campaign: 'Campaign', shoot: 'Shoot', other: 'Other',
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
const EVENT_TYPES = Object.keys(EVENT_COLORS);
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const STATUS_CONFIG = {
  pending:     { label: 'Pending',     icon: Circle,       color: '#94a3b8', bg: '#f8fafc' },
  in_progress: { label: 'In Progress', icon: Loader,       color: '#f59e0b', bg: '#fffbeb' },
  done:        { label: 'Done',        icon: CheckCircle2, color: '#22c55e', bg: '#f0fdf4' },
  cancelled:   { label: 'Cancelled',   icon: XCircle,      color: '#ef4444', bg: '#fef2f2' },
};

// ─── Client-scoped mini calendar ─────────────────────────────────────────────
function ClientCalendarTab({ clientId, events, setEvents, month, setMonth }) {
  const toast = useToast ? useToast() : null;
  const [modal, setModal]   = useState(null); // { mode: 'new'|'view'|'edit', event?, date? }
  const [saving, setSaving] = useState(false);
  const [form, setForm]     = useState({});

  const now = new Date();

  const enrich = (ev) => ({
    ...ev,
    isOverdue: ev.status !== 'done' && ev.status !== 'cancelled' && new Date(ev.endDate) < now,
  });

  const monthStart = startOfMonth(month);
  const monthEnd   = endOfMonth(month);
  const calStart   = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd     = endOfWeek(monthEnd,     { weekStartsOn: 1 });
  const days       = eachDayOfInterval({ start: calStart, end: calEnd });

  const eventsOnDay = (day) => {
    const ds = startOfDay(day), de = endOfDay(day);
    return events.filter(ev => {
      const s = parseISO(ev.startDate);
      const e = ev.endDate ? parseISO(ev.endDate) : s;
      return s <= de && e >= ds;
    });
  };

  const openNew = (day) => {
    const base = new Date(day);
    base.setHours(9, 0, 0, 0);
    const end = new Date(base); end.setHours(10, 0, 0, 0);
    setForm({ title: '', type: 'meeting', shootSubtype: '', description: '', startDate: base.toISOString(), endDate: end.toISOString() });
    setModal({ mode: 'new', date: day });
  };

  const openView = (ev) => { setForm({ ...ev }); setModal({ mode: 'view', event: ev }); };

  const handleSave = async () => {
    if (!form.title?.trim()) return;
    setSaving(true);
    try {
      if (modal.mode === 'new') {
        const { data } = await api.post('/calendar', { ...form, client: clientId, status: form.status || 'pending' });
        setEvents(prev => [...prev, enrich(data.event)]);
      } else {
        const { data } = await api.put(`/calendar/${form._id}`, form);
        setEvents(prev => prev.map(e => e._id === form._id ? enrich(data.event) : e));
      }
      setModal(null);
    } catch (err) {
      if (toast) toast({ type: 'error', title: 'Failed to save' });
    } finally { setSaving(false); }
  };

  const handleStatusChange = async (evId, newStatus) => {
    try {
      const { data } = await api.put(`/calendar/${evId}`, { status: newStatus });
      const enriched = enrich(data.event);
      setEvents(prev => prev.map(e => e._id === evId ? enriched : e));
      if (modal?.event?._id === evId) setModal(m => ({ ...m, event: enriched }));
      if (toast) toast({ type: 'success', title: `Marked as ${STATUS_CONFIG[newStatus]?.label || newStatus}` });
    } catch {
      if (toast) toast({ type: 'error', title: 'Failed to update status' });
    }
  };

  const handleDelete = async (evId) => {
    try {
      await api.delete(`/calendar/${evId}`);
      setEvents(prev => prev.filter(e => e._id !== evId));
      setModal(null);
    } catch {}
  };

  return (
    <div className="space-y-4">
      {/* Month nav */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => setMonth(subMonths(month, 1))}
            className="p-1.5 rounded-lg hover:bg-[var(--fd-surface-sunken)] transition-colors"
            style={{ color: 'var(--fd-ink-3)' }}><ChevronLeft size={16} /></button>
          <span className="text-[14px] font-semibold" style={{ color: 'var(--fd-ink-1)' }}>
            {format(month, 'MMMM yyyy')}
          </span>
          <button onClick={() => setMonth(addMonths(month, 1))}
            className="p-1.5 rounded-lg hover:bg-[var(--fd-surface-sunken)] transition-colors"
            style={{ color: 'var(--fd-ink-3)' }}><ChevronRight size={16} /></button>
        </div>
        <Button size="sm" onClick={() => openNew(new Date())}>
          <Plus size={13} /> Add Event
        </Button>
      </div>

      {/* Grid */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--fd-border)' }}>
        <div className="grid grid-cols-7" style={{ borderBottom: '1px solid var(--fd-border)' }}>
          {DAY_LABELS.map((d, i) => (
            <div key={d} className="py-2 text-center text-[10px] font-bold uppercase tracking-wider"
              style={{ color: i >= 5 ? 'var(--fd-ink-5)' : 'var(--fd-ink-4)', borderRight: i < 6 ? '1px solid var(--fd-border-subtle)' : 'none' }}>
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day, i) => {
            const dayEvts = eventsOnDay(day);
            const inMonth = isSameMonth(day, month);
            const today   = isToday(day);
            return (
              <div key={i} onClick={() => openNew(day)}
                className="cursor-pointer hover:bg-[var(--fd-surface-sunken)] transition-colors group"
                style={{
                  minHeight: 80, borderRight: i % 7 < 6 ? '1px solid var(--fd-border-subtle)' : 'none',
                  borderBottom: '1px solid var(--fd-border-subtle)',
                  background: !inMonth ? 'var(--fd-surface-sunken)' : 'transparent',
                }}
              >
                <div className="p-1.5">
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[11px] font-semibold"
                    style={{ background: today ? '#4f6ef0' : 'transparent', color: today ? '#fff' : !inMonth ? 'var(--fd-ink-5)' : 'var(--fd-ink-2)' }}>
                    {format(day, 'd')}
                  </span>
                </div>
                <div className="px-1 pb-1 space-y-[2px]">
                  {dayEvts.slice(0, 2).map(ev => {
                    const c = EVENT_COLORS[ev.type] || EVENT_COLORS.other;
                    const overdue = ev.isOverdue;
                    return (
                      <button key={ev._id} onClick={e => { e.stopPropagation(); openView(ev); }}
                        className="w-full text-left text-[10px] font-semibold px-1.5 py-[2px] rounded truncate flex items-center gap-1"
                        style={{ background: overdue ? '#fef2f2' : c.light, color: overdue ? '#b91c1c' : c.text }}>
                        {overdue && <AlertTriangle size={7} style={{ flexShrink: 0 }} />}
                        <span className="truncate">{ev.title}</span>
                        {ev.status === 'done' && <CheckCircle2 size={8} style={{ color: '#22c55e', flexShrink: 0, marginLeft: 'auto' }} />}
                      </button>
                    );
                  })}
                  {dayEvts.length > 2 && (
                    <div className="text-[10px] px-1" style={{ color: 'var(--fd-ink-5)' }}>+{dayEvts.length - 2} more</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <Modal
          isOpen onClose={() => setModal(null)}
          title={modal.mode === 'view' ? form.title : modal.mode === 'new' ? 'New Event' : 'Edit Event'}
          size="sm"
          footer={
            <div className="flex items-center justify-between gap-2">
              {modal.mode === 'view' && (
                <Button variant="danger" size="sm" onClick={() => handleDelete(form._id)}>
                  <Trash2 size={12} /> Delete
                </Button>
              )}
              <div className="flex gap-2 ml-auto">
                {modal.mode === 'view' ? (
                  <>
                    <Button variant="secondary" size="sm" onClick={() => setModal(null)}>Close</Button>
                    <Button size="sm" onClick={() => setModal(m => ({ ...m, mode: 'edit' }))}><Edit3 size={12} /> Edit</Button>
                  </>
                ) : (
                  <>
                    <Button variant="secondary" size="sm" onClick={() => setModal(null)}>Cancel</Button>
                    <Button size="sm" loading={saving} onClick={handleSave}>Save</Button>
                  </>
                )}
              </div>
            </div>
          }
        >
          {modal.mode === 'view' ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-[12px]" style={{ color: 'var(--fd-ink-3)' }}>
                <Clock size={13} />
                {format(parseISO(form.startDate), 'EEE, MMM d · h:mm a')}
                {form.isOverdue && (
                  <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded ml-1"
                    style={{ background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca' }}>
                    <AlertTriangle size={8} /> OVERDUE
                  </span>
                )}
              </div>
              {/* Status */}
              <div className="flex items-center justify-between p-2.5 rounded-xl"
                style={{ background: 'var(--fd-surface-sunken)' }}>
                <span className="text-[12px] font-medium" style={{ color: 'var(--fd-ink-3)' }}>Status</span>
                <div className="relative">
                  {(() => {
                    const [statusOpen, setStatusOpen] = useState(false);
                    const cfg = STATUS_CONFIG[form.status] || STATUS_CONFIG.pending;
                    const Icon = cfg.icon;
                    return (
                      <div className="relative">
                        <button onClick={() => setStatusOpen(v => !v)}
                          className="flex items-center gap-1.5 text-[11px] font-semibold px-2 py-1 rounded-full"
                          style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}30` }}>
                          <Icon size={10} /> {cfg.label} <ChevronRight size={8} style={{ transform: statusOpen ? 'rotate(90deg)' : 'none' }} />
                        </button>
                        {statusOpen && (
                          <div className="absolute z-50 right-0 top-full mt-1 rounded-xl overflow-hidden shadow-lg"
                            style={{ background: 'var(--fd-surface)', border: '1px solid var(--fd-border)', minWidth: 140 }}>
                            {Object.entries(STATUS_CONFIG).map(([val, s]) => {
                              const I = s.icon;
                              return (
                                <button key={val} onClick={() => {
                                  handleStatusChange(form._id, val);
                                  setForm(f => ({ ...f, status: val }));
                                  setStatusOpen(false);
                                }}
                                  className="w-full flex items-center gap-2 px-3 py-2 hover:opacity-70 text-left"
                                  style={{ background: val === form.status ? s.bg : 'transparent' }}>
                                  <I size={12} style={{ color: s.color }} />
                                  <span className="text-[12px] font-medium" style={{ color: 'var(--fd-ink-1)' }}>{s.label}</span>
                                  {val === form.status && <Check size={10} className="ml-auto" style={{ color: s.color }} />}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
              {form.description && (
                <p className="text-[13px]" style={{ color: 'var(--fd-ink-2)' }}>{form.description}</p>
              )}
              <span className="inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full"
                style={{ background: (EVENT_COLORS[form.type] || EVENT_COLORS.other).light, color: (EVENT_COLORS[form.type] || EVENT_COLORS.other).text }}>
                {TYPE_LABELS[form.type] || form.type}
              </span>
              {form.type === 'shoot' && form.shootSubtype && (
                <span className="inline-block ml-1 text-[11px] font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: '#fdf2f8', color: '#be185d', border: '1px solid #fbcfe8' }}>
                  {SHOOT_SUBTYPE_ICONS[form.shootSubtype]} {SHOOT_SUBTYPE_LABELS[form.shootSubtype] || form.shootSubtype}
                </span>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-[12px]"
                style={{ background: 'var(--fd-surface-sunken)', color: 'var(--fd-ink-3)' }}>
                <Clock size={13} />
                {modal.date ? format(modal.date, 'EEEE, MMMM d') : form.startDate ? format(parseISO(form.startDate), 'EEEE, MMMM d') : ''}
              </div>
              <Input label="Title" value={form.title || ''} autoFocus
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Event title" />
              {/* Status */}
              <div className="space-y-1.5">
                <label className="block text-[12px] font-medium" style={{ color: 'var(--fd-ink-2)' }}>Status</label>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(STATUS_CONFIG).map(([val, s]) => {
                    const Icon = s.icon;
                    return (
                      <button key={val} onClick={() => setForm(f => ({ ...f, status: val }))}
                        className="flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full transition-all"
                        style={(form.status || 'pending') === val
                          ? { background: s.color, color: '#fff' }
                          : { background: s.bg, color: s.color, border: `1px solid ${s.color}40` }
                        }>
                        <Icon size={10} /> {s.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="block text-[12px] font-medium" style={{ color: 'var(--fd-ink-2)' }}>Type</label>
                <div className="flex flex-wrap gap-1.5">
                  {EVENT_TYPES.map(type => {
                    const c = EVENT_COLORS[type];
                    return (
                      <button key={type} onClick={() => setForm(f => ({ ...f, type }))}
                        className="text-[11px] font-semibold px-2.5 py-1 rounded-full transition-all"
                        style={form.type === type ? { background: c.bg, color: '#fff' } : { background: c.light, color: c.text }}>
                        {TYPE_LABELS[type]}
                      </button>
                    );
                  })}
                </div>
              </div>
              {form.type === 'shoot' && (
                <div className="space-y-1.5">
                  <label className="block text-[12px] font-medium" style={{ color: 'var(--fd-ink-2)' }}>Shoot Type</label>
                  <div className="flex flex-wrap gap-1.5">
                    {SHOOT_SUBTYPES.map(sub => (
                      <button key={sub.value} onClick={() => setForm(f => ({ ...f, shootSubtype: sub.value }))}
                        className="text-[11px] font-semibold px-2.5 py-1 rounded-full transition-all flex items-center gap-1"
                        style={form.shootSubtype === sub.value ? { background: '#ec4899', color: '#fff' } : { background: '#fdf2f8', color: '#be185d', border: '1px solid #fbcfe8' }}>
                        <span>{sub.icon}</span> {sub.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <label className="block text-[12px] font-medium mb-1.5" style={{ color: 'var(--fd-ink-2)' }}>Notes</label>
                <textarea className="fd-input resize-none" rows={2} value={form.description || ''}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional notes…" />
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

// ─── GMB Panel Tab ────────────────────────────────────────────────────────────
function GmbPanelTab({ clientId, client }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm]       = useState({});
  const [saving, setSaving]   = useState(false);
  const toast = useToast ? useToast() : null;

  useEffect(() => {
    setLoading(true);
    api.get(`/clients/${clientId}/gmb`)
      .then(r => { setData(r.data.gmb || {}); setForm(r.data.gmb || {}); })
      .catch(() => { setData({}); setForm({}); })
      .finally(() => setLoading(false));
  }, [clientId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put(`/clients/${clientId}/gmb`, form);
      setData(form);
      setEditing(false);
      if (toast) toast({ type: 'success', title: 'GMB data saved' });
    } catch {
      if (toast) toast({ type: 'error', title: 'Save failed' });
    } finally { setSaving(false); }
  };

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  if (loading) return <div className="flex justify-center py-16"><Spinner /></div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-[15px]" style={{ color: 'var(--fd-ink-1)' }}>Google Business Profile</h3>
          <p className="text-[12px] mt-0.5" style={{ color: 'var(--fd-ink-4)' }}>Track GMB metrics and listing details for {client?.company}</p>
        </div>
        {!editing
          ? <Button size="sm" variant="outline" onClick={() => setEditing(true)}><Edit3 size={13} /> Edit</Button>
          : (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => { setEditing(false); setForm(data); }}>Cancel</Button>
              <Button size="sm" loading={saving} onClick={handleSave}>Save</Button>
            </div>
          )
        }
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Reviews', key: 'totalReviews',   icon: Star,      color: '#f59e0b', bg: '#fffbeb' },
          { label: 'Avg Rating',    key: 'avgRating',      icon: ThumbsUp,  color: '#22c55e', bg: '#f0fdf4' },
          { label: 'Total Views',   key: 'totalViews',     icon: Eye,       color: '#4f6ef0', bg: '#eff0fe' },
          { label: 'Total Clicks',  key: 'totalClicks',    icon: TrendingUp,color: '#a855f7', bg: '#faf5ff' },
        ].map(({ label, key, icon: Icon, color, bg }) => (
          <div key={key} className="rounded-xl p-4 space-y-2" style={{ background: 'var(--fd-surface)', border: '1px solid var(--fd-border)' }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: bg }}>
              <Icon size={15} color={color} />
            </div>
            {editing ? (
              <input type="number" className="fd-input text-[13px] w-full" value={form[key] || ''}
                onChange={e => set(key, e.target.value)} placeholder="0" />
            ) : (
              <div className="text-[22px] font-bold tabular-nums" style={{ color: 'var(--fd-ink-1)' }}>
                {data[key] ?? '—'}
              </div>
            )}
            <div className="text-[11px] font-medium" style={{ color: 'var(--fd-ink-3)' }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Details */}
      <Card>
        <CardHeader><h3 className="font-semibold text-sm text-[var(--fd-ink-1)]">Listing Details</h3></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { label: 'Business Name',    key: 'businessName'  },
              { label: 'Category',         key: 'category'      },
              { label: 'Phone',            key: 'phone'         },
              { label: 'Website',          key: 'website'       },
              { label: 'Address',          key: 'address'       },
              { label: 'GMB Profile URL',  key: 'profileUrl'    },
              { label: 'New Reviews (Month)', key: 'newReviews' },
              { label: 'Calls (Month)',    key: 'calls'         },
              { label: 'Direction Requests', key: 'directions'  },
              { label: 'Messages (Month)', key: 'messages'      },
            ].map(({ label, key }) => (
              <div key={key}>
                <div className="text-[11px] font-medium mb-1" style={{ color: 'var(--fd-ink-4)' }}>{label}</div>
                {editing ? (
                  <input className="fd-input w-full text-[13px]" value={form[key] || ''}
                    onChange={e => set(key, e.target.value)} placeholder={label} />
                ) : (
                  <div className="text-[13px]" style={{ color: data[key] ? 'var(--fd-ink-1)' : 'var(--fd-ink-5)' }}>
                    {data[key] || '—'}
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardHeader><h3 className="font-semibold text-sm text-[var(--fd-ink-1)]">Notes &amp; Observations</h3></CardHeader>
        <CardContent>
          {editing ? (
            <textarea className="fd-input resize-none w-full" rows={4} value={form.notes || ''}
              onChange={e => set('notes', e.target.value)} placeholder="Any notes about GMB performance, issues, actions taken..." />
          ) : (
            <p className="text-[13px]" style={{ color: data.notes ? 'var(--fd-ink-2)' : 'var(--fd-ink-5)' }}>
              {data.notes || 'No notes added yet.'}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── TARGETS FIELD SCHEMA ─────────────────────────────────────────────────────
const TARGET_SECTIONS = [
  {
    id: 'instagram', label: '📸 Instagram', color: '#e1306c', bg: '#fff0f6',
    fields: [
      { key: 'instagramFollowers',   label: 'Followers',    unit: '' },
      { key: 'instagramReach',       label: 'Reach',        unit: '' },
      { key: 'instagramImpressions', label: 'Impressions',  unit: '' },
      { key: 'instagramEngagements', label: 'Engagements',  unit: '' },
      { key: 'instagramPosts',       label: 'Posts',        unit: '' },
      { key: 'instagramReels',       label: 'Reels',        unit: '' },
    ],
  },
  {
    id: 'facebook', label: '👤 Facebook', color: '#1877f2', bg: '#eff6ff',
    fields: [
      { key: 'facebookFollowers',    label: 'Followers',    unit: '' },
      { key: 'facebookReach',        label: 'Reach',        unit: '' },
      { key: 'facebookImpressions',  label: 'Impressions',  unit: '' },
      { key: 'facebookEngagements',  label: 'Engagements',  unit: '' },
      { key: 'facebookPosts',        label: 'Posts',        unit: '' },
    ],
  },
  {
    id: 'linkedin', label: '💼 LinkedIn', color: '#0a66c2', bg: '#eff6ff',
    fields: [
      { key: 'linkedinFollowers',    label: 'Followers',    unit: '' },
      { key: 'linkedinImpressions',  label: 'Impressions',  unit: '' },
      { key: 'linkedinEngagements',  label: 'Engagements',  unit: '' },
    ],
  },
  {
    id: 'youtube', label: '▶️ YouTube', color: '#ff0000', bg: '#fff5f5',
    fields: [
      { key: 'youtubeSubscribers',   label: 'Subscribers',  unit: '' },
      { key: 'youtubeViews',         label: 'Views',        unit: '' },
      { key: 'youtubeVideos',        label: 'Videos',       unit: '' },
    ],
  },
  {
    id: 'tiktok', label: '🎵 TikTok', color: '#010101', bg: '#f8f8f8',
    fields: [
      { key: 'tiktokFollowers',      label: 'Followers',    unit: '' },
      { key: 'tiktokViews',          label: 'Views',        unit: '' },
      { key: 'tiktokVideos',         label: 'Videos',       unit: '' },
    ],
  },
  {
    id: 'ads', label: '📊 Paid Ads', color: '#7c3aed', bg: '#faf5ff',
    fields: [
      { key: 'adSpend',              label: 'Ad Spend',     unit: '₹' },
      { key: 'adRevenue',            label: 'Revenue',      unit: '₹' },
      { key: 'roas',                 label: 'ROAS',         unit: 'x' },
      { key: 'cpc',                  label: 'CPC',          unit: '₹' },
      { key: 'ctr',                  label: 'CTR',          unit: '%' },
      { key: 'impressions',          label: 'Impressions',  unit: '' },
      { key: 'clicks',               label: 'Clicks',       unit: '' },
    ],
  },
  {
    id: 'leads', label: '🎯 Lead Generation', color: '#059669', bg: '#f0fdf4',
    fields: [
      { key: 'totalLeads',           label: 'Total Leads',       unit: '' },
      { key: 'qualifiedLeads',       label: 'Qualified Leads',   unit: '' },
      { key: 'costPerLead',          label: 'Cost Per Lead',     unit: '₹' },
      { key: 'conversionRate',       label: 'Conversion Rate',   unit: '%' },
    ],
  },
  {
    id: 'seo', label: '🔍 SEO / Website', color: '#d97706', bg: '#fffbeb',
    fields: [
      { key: 'organicTraffic',       label: 'Organic Traffic',   unit: '' },
      { key: 'websiteSessions',      label: 'Website Sessions',  unit: '' },
      { key: 'keywordRankings',      label: 'Keyword Rankings',  unit: '' },
      { key: 'backlinks',            label: 'Backlinks',         unit: '' },
    ],
  },
  {
    id: 'gmb', label: '🗺️ GMB', color: '#16a34a', bg: '#f0fdf4',
    fields: [
      { key: 'gmbViews',             label: 'Views',             unit: '' },
      { key: 'gmbClicks',            label: 'Clicks',            unit: '' },
      { key: 'gmbCalls',             label: 'Calls',             unit: '' },
      { key: 'gmbReviews',           label: 'Reviews',           unit: '' },
    ],
  },
  {
    id: 'content', label: '✍️ Content & Email', color: '#0891b2', bg: '#ecfeff',
    fields: [
      { key: 'blogPosts',            label: 'Blog Posts',        unit: '' },
      { key: 'emailsSent',           label: 'Emails Sent',       unit: '' },
      { key: 'emailOpenRate',        label: 'Email Open Rate',   unit: '%' },
    ],
  },
];

const ALL_FIELD_KEYS = TARGET_SECTIONS.flatMap(s => s.fields.map(f => f.key));

// ── MonthPicker ───────────────────────────────────────────────────────────────
function MonthPicker({ value, onChange, label }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  const parsed = value ? new Date(value + '-01') : new Date();
  const [navYear, setNavYear] = React.useState(parsed.getFullYear());

  React.useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  const select = (m) => {
    const mm = String(m + 1).padStart(2, '0');
    onChange(`${navYear}-${mm}`);
    setOpen(false);
  };

  const selectedYear = value ? parseInt(value.split('-')[0]) : null;
  const selectedMonth = value ? parseInt(value.split('-')[1]) - 1 : null;

  const displayLabel = value
    ? new Date(value + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
    : label || 'Select Month';

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl text-[13px] font-medium transition-colors"
        style={{ background: 'var(--fd-surface)', border: '1px solid var(--fd-border-strong)', color: 'var(--fd-ink-1)' }}
      >
        <Calendar size={14} style={{ color: 'var(--fd-ink-3)' }} />
        {displayLabel}
        <ChevronDown size={12} style={{ color: 'var(--fd-ink-4)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </button>

      {open && (
        <div className="absolute z-50 top-full mt-2 rounded-2xl shadow-xl overflow-hidden"
          style={{ background: 'var(--fd-surface)', border: '1px solid var(--fd-border)', minWidth: 240 }}>
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--fd-border-subtle)' }}>
            <button onClick={() => setNavYear(y => y - 1)} className="p-1 rounded-lg hover:bg-[var(--fd-surface-sunken)] transition-colors" style={{ color: 'var(--fd-ink-3)' }}>
              <ChevronLeft size={14} />
            </button>
            <span className="font-bold text-[13px]" style={{ color: 'var(--fd-ink-1)' }}>{navYear}</span>
            <button onClick={() => setNavYear(y => y + 1)} className="p-1 rounded-lg hover:bg-[var(--fd-surface-sunken)] transition-colors" style={{ color: 'var(--fd-ink-3)' }}>
              <ChevronRight size={14} />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-1 p-3">
            {MONTHS.map((m, i) => {
              const isSelected = navYear === selectedYear && i === selectedMonth;
              const now = new Date();
              const isCurrent = navYear === now.getFullYear() && i === now.getMonth();
              return (
                <button key={m} onClick={() => select(i)}
                  className="py-2 rounded-xl text-[12px] font-semibold transition-all"
                  style={isSelected
                    ? { background: '#4f6ef0', color: '#fff' }
                    : isCurrent
                    ? { background: 'var(--fd-surface-sunken)', color: '#4f6ef0', border: '1px solid #c7d2fe' }
                    : { color: 'var(--fd-ink-2)', background: 'transparent' }
                  }>
                  {m}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── ClientTargetsTab ──────────────────────────────────────────────────────────
function ClientTargetsTab({ clientId, isAdmin }) {
  const toast = useToast ? useToast() : null;
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const [month, setMonth] = React.useState(currentMonth);
  const [target, setTarget] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [editing, setEditing] = React.useState(false);
  const [form, setForm] = React.useState({});
  const [saving, setSaving] = React.useState(false);
  const [showFieldConfig, setShowFieldConfig] = React.useState(false);
  const [visibleFields, setVisibleFields] = React.useState([]);

  const fetchTarget = React.useCallback(async (m) => {
    setLoading(true);
    try {
      const { data } = await api.get(`/targets?client=${clientId}&month=${m}`);
      setTarget(data.target);
      setForm(data.target);
      setVisibleFields(data.target.visibleFields && data.target.visibleFields.length ? data.target.visibleFields : ALL_FIELD_KEYS);
    } catch {
      setTarget({ client: clientId, month: m, visibleFields: [], customFields: [] });
      setVisibleFields(ALL_FIELD_KEYS);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  React.useEffect(() => { fetchTarget(month); }, [month, fetchTarget]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = { ...form, client: clientId, month, visibleFields };
      const { data } = await api.put('/targets', payload);
      setTarget(data.target);
      setForm(data.target);
      setEditing(false);
      if (toast) toast({ type: 'success', title: 'Targets saved!' });
    } catch {
      if (toast) toast({ type: 'error', title: 'Failed to save targets' });
    } finally { setSaving(false); }
  };

  const handleCancel = () => {
    setForm(target);
    setVisibleFields(target && target.visibleFields && target.visibleFields.length ? target.visibleFields : ALL_FIELD_KEYS);
    setEditing(false);
    setShowFieldConfig(false);
  };

  const toggleField = (key) => {
    setVisibleFields(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const toggleSection = (sectionFields) => {
    const keys = sectionFields.map(f => f.key);
    const allVisible = keys.every(k => visibleFields.includes(k));
    if (allVisible) {
      setVisibleFields(prev => prev.filter(k => !keys.includes(k)));
    } else {
      setVisibleFields(prev => [...new Set([...prev, ...keys])]);
    }
  };

  const fv = (key) => form[key] != null ? form[key] : (target && target[key] != null ? target[key] : '');
  const sv = (key, val) => setForm(p => ({ ...p, [key]: val === '' ? null : Number(val) }));

  const formatVal = (val, unit) => {
    if (val === null || val === undefined || val === '') return '—';
    const n = Number(val);
    if (isNaN(n)) return '—';
    const formatted = n >= 1000000
      ? (n / 1000000).toFixed(1) + 'M'
      : n >= 1000
      ? (n / 1000).toFixed(1) + 'K'
      : n.toLocaleString();
    return unit === '₹' ? `₹${formatted}` : unit === '%' ? `${n}%` : unit === 'x' ? `${n}x` : formatted;
  };

  const displayedSections = TARGET_SECTIONS.map(s => ({
    ...s,
    fields: s.fields.filter(f => visibleFields.includes(f.key)),
  })).filter(s => s.fields.length > 0);

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-[#4f6ef0] border-t-transparent animate-spin" />
        <span className="text-[13px]" style={{ color: 'var(--fd-ink-4)' }}>Loading targets…</span>
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Header row */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <MonthPicker value={month} onChange={setMonth} label="Select Month" />
          <div className="text-[12px] px-3 py-1.5 rounded-xl font-medium"
            style={{ background: 'var(--fd-surface-sunken)', color: 'var(--fd-ink-3)' }}>
            {target && target._id ? 'Targets set ✓' : 'No targets yet'}
          </div>
        </div>

        {isAdmin && (
          <div className="flex items-center gap-2">
            {editing ? (
              <>
                <button onClick={() => setShowFieldConfig(v => !v)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-semibold transition-colors"
                  style={{ background: showFieldConfig ? '#4f6ef0' : 'var(--fd-surface)', color: showFieldConfig ? '#fff' : 'var(--fd-ink-2)', border: '1px solid var(--fd-border-strong)' }}>
                  <Settings size={13} /> Configure Fields
                </button>
                <button onClick={handleCancel}
                  className="px-3 py-2 rounded-xl text-[12px] font-semibold transition-colors"
                  style={{ background: 'var(--fd-surface)', color: 'var(--fd-ink-2)', border: '1px solid var(--fd-border-strong)' }}>
                  Cancel
                </button>
                <button onClick={handleSave} disabled={saving}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-semibold transition-colors"
                  style={{ background: '#4f6ef0', color: '#fff', opacity: saving ? 0.7 : 1 }}>
                  {saving ? <div className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" /> : <Save size={13} />}
                  Save Targets
                </button>
              </>
            ) : (
              <button onClick={() => setEditing(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-semibold transition-colors"
                style={{ background: '#4f6ef0', color: '#fff' }}>
                <Edit3 size={13} /> Set Targets
              </button>
            )}
          </div>
        )}
      </div>

      {/* Field config panel */}
      {isAdmin && editing && showFieldConfig && (
        <div className="rounded-2xl p-4 space-y-4" style={{ background: 'var(--fd-surface)', border: '1px solid var(--fd-border)' }}>
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-[13px]" style={{ color: 'var(--fd-ink-1)' }}>Configure Visible Fields</h3>
            <div className="flex gap-2">
              <button onClick={() => setVisibleFields(ALL_FIELD_KEYS)} className="text-[11px] px-2.5 py-1 rounded-lg font-medium" style={{ background: '#dcfce7', color: '#15803d' }}>Show All</button>
              <button onClick={() => setVisibleFields([])} className="text-[11px] px-2.5 py-1 rounded-lg font-medium" style={{ background: '#fee2e2', color: '#b91c1c' }}>Hide All</button>
            </div>
          </div>
          <p className="text-[11px]" style={{ color: 'var(--fd-ink-4)' }}>Choose which target metrics are shown for this client.</p>
          <div className="space-y-3">
            {TARGET_SECTIONS.map(section => {
              const allChecked = section.fields.every(f => visibleFields.includes(f.key));
              const someChecked = section.fields.some(f => visibleFields.includes(f.key));
              return (
                <div key={section.id} className="rounded-xl p-3 space-y-2" style={{ background: section.bg, border: `1px solid ${section.color}20` }}>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={allChecked}
                      onChange={() => toggleSection(section.fields)}
                      className="rounded" style={{ accentColor: section.color }} />
                    <span className="font-bold text-[12px]" style={{ color: section.color }}>{section.label}</span>
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 ml-5">
                    {section.fields.map(f => (
                      <label key={f.key} className="flex items-center gap-1.5 cursor-pointer">
                        <input type="checkbox" checked={visibleFields.includes(f.key)}
                          onChange={() => toggleField(f.key)}
                          className="rounded" style={{ accentColor: section.color }} />
                        <span className="text-[11px]" style={{ color: 'var(--fd-ink-2)' }}>{f.label}{f.unit ? ` (${f.unit})` : ''}</span>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Targets display */}
      {displayedSections.length === 0 ? (
        <div className="text-center py-16 rounded-2xl" style={{ background: 'var(--fd-surface)', border: '1px dashed var(--fd-border-strong)' }}>
          <Target size={36} className="mx-auto mb-3" style={{ color: 'var(--fd-border)' }} />
          <p className="font-semibold text-[14px]" style={{ color: 'var(--fd-ink-3)' }}>No visible fields configured</p>
          {isAdmin && <p className="text-[12px] mt-1" style={{ color: 'var(--fd-ink-5)' }}>Click "Set Targets" → "Configure Fields" to enable metrics.</p>}
        </div>
      ) : (
        <div className="space-y-4">
          {displayedSections.map(section => (
            <div key={section.id} className="rounded-2xl overflow-hidden"
              style={{ border: `1px solid ${section.color}25`, background: 'var(--fd-surface)' }}>
              <div className="px-4 py-3 flex items-center gap-2"
                style={{ background: section.bg, borderBottom: `1px solid ${section.color}20` }}>
                <span className="font-bold text-[13px]" style={{ color: section.color }}>{section.label}</span>
                <span className="ml-auto text-[11px] font-medium px-2 py-0.5 rounded-full"
                  style={{ background: `${section.color}15`, color: section.color }}>
                  {section.fields.length} metric{section.fields.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"
                style={{ borderColor: `${section.color}12` }}>
                {section.fields.map((f) => (
                  <div key={f.key} className="p-3 sm:p-4 space-y-1"
                    style={{ borderRight: '1px solid var(--fd-border-subtle)', borderBottom: '1px solid var(--fd-border-subtle)' }}>
                    <div className="text-[10px] font-semibold uppercase tracking-wider"
                      style={{ color: 'var(--fd-ink-4)' }}>{f.label}</div>
                    {editing ? (
                      <div className="flex items-center gap-1">
                        {f.unit && f.unit !== '' && (
                          <span className="text-[11px] font-medium flex-shrink-0" style={{ color: 'var(--fd-ink-4)' }}>{f.unit}</span>
                        )}
                        <input
                          type="number"
                          className="fd-input text-[14px] font-bold w-full"
                          style={{ paddingTop: '4px', paddingBottom: '4px' }}
                          value={fv(f.key)}
                          onChange={e => sv(f.key, e.target.value)}
                          placeholder="—"
                        />
                      </div>
                    ) : (
                      <div className="text-[18px] sm:text-[20px] font-black tabular-nums"
                        style={{ color: fv(f.key) !== '' ? section.color : 'var(--fd-ink-5)' }}>
                        {formatVal(fv(f.key), f.unit)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--fd-border)', background: 'var(--fd-surface)' }}>
            <div className="px-4 py-3" style={{ background: 'var(--fd-surface-sunken)', borderBottom: '1px solid var(--fd-border-subtle)' }}>
              <span className="font-bold text-[13px]" style={{ color: 'var(--fd-ink-2)' }}>📝 Notes</span>
            </div>
            <div className="p-4">
              {editing ? (
                <textarea className="fd-input resize-none w-full text-[13px]" rows={3}
                  value={form.notes || ''} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                  placeholder="Add notes about targets for this month…" />
              ) : (
                <p className="text-[13px]" style={{ color: form.notes ? 'var(--fd-ink-2)' : 'var(--fd-ink-5)' }}>
                  {form.notes || 'No notes for this month.'}
                </p>
              )}
            </div>
          </div>

          {target && target.updatedBy && (
            <p className="text-[11px] text-right" style={{ color: 'var(--fd-ink-5)' }}>
              Last updated by {target.updatedBy.name || 'Admin'} · {target.updatedAt ? new Date(target.updatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
            </p>
          )}
        </div>
      )}
    </div>
  );
}


// ─── Board Widget ─────────────────────────────────────────────────────────────

// ── RichEditor: a Word-like contentEditable document editor ──────────────────
const TOOLBAR_FONTS = [
  { label: 'Sans Serif', value: 'ui-sans-serif, system-ui, sans-serif' },
  { label: 'Serif',      value: 'Georgia, "Times New Roman", serif' },
  { label: 'Monospace',  value: 'ui-monospace, "Courier New", monospace' },
];
const TOOLBAR_SIZES = ['8','9','10','11','12','14','16','18','20','22','24','26','28','36','48','72'];

function RichToolbar({ editorRef }) {
  const [bold, setBold] = React.useState(false);
  const [italic, setItalic] = React.useState(false);
  const [underline, setUnderline] = React.useState(false);
  const [align, setAlign] = React.useState('left');
  const [fontSize, setFontSize] = React.useState('14');
  const [fontName, setFontName] = React.useState(TOOLBAR_FONTS[0].value);
  const [textColor, setTextColor] = React.useState('#000000');
  const [bgColor, setBgColor]   = React.useState('#ffff00');

  const syncState = () => {
    setBold(document.queryCommandState('bold'));
    setItalic(document.queryCommandState('italic'));
    setUnderline(document.queryCommandState('underline'));
    if (document.queryCommandState('justifyCenter')) setAlign('center');
    else if (document.queryCommandState('justifyRight')) setAlign('right');
    else if (document.queryCommandState('justifyFull')) setAlign('justify');
    else setAlign('left');
  };

  React.useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    el.addEventListener('keyup', syncState);
    el.addEventListener('mouseup', syncState);
    el.addEventListener('selectionchange', syncState);
    return () => {
      el.removeEventListener('keyup', syncState);
      el.removeEventListener('mouseup', syncState);
      el.removeEventListener('selectionchange', syncState);
    };
  }, [editorRef]);

  const cmd = (command, value = null) => {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    syncState();
  };

  const insertTable = (rows = 3, cols = 3) => {
    editorRef.current?.focus();
    const id = `tbl-${Date.now()}`;
    let html = `<table id="${id}" style="border-collapse:collapse;width:100%;margin:8px 0;table-layout:fixed" data-fd-table="1"><colgroup>`;
    for (let c = 0; c < cols; c++) html += `<col style="width:${(100/cols).toFixed(2)}%">`;
    html += '</colgroup><tbody>';
    for (let r = 0; r < rows; r++) {
      html += '<tr>';
      for (let c = 0; c < cols; c++) {
        if (r === 0) {
          html += `<th style="border:1px solid #d1d5db;padding:6px 10px;background:#f3f4f6;font-weight:700;font-size:13px;text-align:left;position:relative">Header ${c+1}</th>`;
        } else {
          html += `<td style="border:1px solid #d1d5db;padding:6px 10px;font-size:13px;position:relative">&nbsp;</td>`;
        }
      }
      html += '</tr>';
    }
    html += '</tbody></table><p><br></p>';
    document.execCommand('insertHTML', false, html);
  };

  const sep = (
    <div style={{ width: 1, height: 18, background: 'var(--fd-border-strong)', margin: '0 3px', flexShrink: 0 }} />
  );

  const TB = ({ active, onClick, title, children, danger }) => (
    <button
      onMouseDown={e => { e.preventDefault(); onClick(); }}
      title={title}
      className="flex items-center justify-center rounded transition-all"
      style={{
        width: 26, height: 26, flexShrink: 0,
        background: active ? '#4f6ef0' : danger ? 'transparent' : 'transparent',
        color: active ? '#fff' : danger ? '#dc2626' : 'var(--fd-ink-2)',
        fontSize: 12, fontWeight: 600,
        border: active ? 'none' : 'none',
      }}>
      {children}
    </button>
  );

  return (
    <div className="flex items-center flex-wrap gap-0.5 px-2 py-1.5 border-b select-none"
      style={{ borderColor: 'var(--fd-border)', background: 'var(--fd-surface)', minHeight: 40 }}>

      {/* Heading */}
      <select
        onMouseDown={e => e.stopPropagation()}
        onChange={e => { editorRef.current?.focus(); document.execCommand('formatBlock', false, e.target.value); }}
        defaultValue="p"
        className="text-[11px] h-[26px] px-1 rounded font-medium cursor-pointer"
        style={{ background: 'var(--fd-surface-sunken)', color: 'var(--fd-ink-2)', border: '1px solid var(--fd-border)', outline: 'none', marginRight: 2 }}>
        <option value="p">Normal</option>
        <option value="h1">Heading 1</option>
        <option value="h2">Heading 2</option>
        <option value="h3">Heading 3</option>
        <option value="h4">Heading 4</option>
        <option value="pre">Code</option>
      </select>

      {/* Font family */}
      <select
        onMouseDown={e => e.stopPropagation()}
        value={fontName}
        onChange={e => { setFontName(e.target.value); cmd('fontName', e.target.value); }}
        className="text-[11px] h-[26px] px-1 rounded cursor-pointer"
        style={{ background: 'var(--fd-surface-sunken)', color: 'var(--fd-ink-2)', border: '1px solid var(--fd-border)', outline: 'none', marginRight: 2, maxWidth: 90 }}>
        {TOOLBAR_FONTS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
      </select>

      {/* Font size */}
      <select
        onMouseDown={e => e.stopPropagation()}
        value={fontSize}
        onChange={e => { setFontSize(e.target.value); cmd('fontSize', 3); /* we'll use inline style instead */
          // execCommand fontSize only takes 1-7. Use insertHTML workaround via style
          const sel = window.getSelection();
          if (sel && sel.rangeCount) {
            const range = sel.getRangeAt(0);
            if (!range.collapsed) {
              const span = document.createElement('span');
              span.style.fontSize = e.target.value + 'pt';
              range.surroundContents(span);
            }
          }
        }}
        className="text-[11px] h-[26px] px-1 rounded cursor-pointer"
        style={{ background: 'var(--fd-surface-sunken)', color: 'var(--fd-ink-2)', border: '1px solid var(--fd-border)', outline: 'none', marginRight: 4, width: 46 }}>
        {TOOLBAR_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
      </select>

      {sep}

      <TB active={bold} onClick={() => cmd('bold')} title="Bold (Ctrl+B)"><span style={{ fontWeight: 700, fontFamily: 'Georgia,serif', fontSize: 13 }}>B</span></TB>
      <TB active={italic} onClick={() => cmd('italic')} title="Italic (Ctrl+I)"><span style={{ fontStyle: 'italic', fontFamily: 'Georgia,serif', fontSize: 13 }}>I</span></TB>
      <TB active={underline} onClick={() => cmd('underline')} title="Underline (Ctrl+U)"><span style={{ textDecoration: 'underline', fontSize: 12 }}>U</span></TB>
      <TB active={false} onClick={() => cmd('strikeThrough')} title="Strikethrough"><span style={{ textDecoration: 'line-through', fontSize: 12 }}>S</span></TB>

      {sep}

      {/* Text color */}
      <label title="Text color" className="flex items-center justify-center rounded cursor-pointer transition-all"
        style={{ width: 26, height: 26, position: 'relative' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: textColor, textShadow: '0 0 1px rgba(0,0,0,0.3)' }}>A</span>
        <div style={{ position: 'absolute', bottom: 2, left: 4, right: 4, height: 3, borderRadius: 2, background: textColor }} />
        <input type="color" value={textColor} onChange={e => { setTextColor(e.target.value); cmd('foreColor', e.target.value); }}
          style={{ position: 'absolute', opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }} />
      </label>

      {/* Highlight */}
      <label title="Highlight color" className="flex items-center justify-center rounded cursor-pointer transition-all"
        style={{ width: 26, height: 26, position: 'relative' }}>
        <span style={{ fontSize: 11, background: bgColor, padding: '1px 3px', borderRadius: 2, color: '#111', fontWeight: 700 }}>ab</span>
        <input type="color" value={bgColor} onChange={e => { setBgColor(e.target.value); cmd('hiliteColor', e.target.value); }}
          style={{ position: 'absolute', opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }} />
      </label>

      {sep}

      {/* Align */}
      <TB active={align==='left'}    onClick={() => cmd('justifyLeft')}    title="Align left">
        <svg width="13" height="13" viewBox="0 0 12 12" fill="currentColor"><rect x="0" y="1" width="12" height="1.5" rx="0.75"/><rect x="0" y="4" width="8" height="1.5" rx="0.75"/><rect x="0" y="7" width="12" height="1.5" rx="0.75"/><rect x="0" y="10" width="8" height="1.5" rx="0.75"/></svg>
      </TB>
      <TB active={align==='center'}  onClick={() => cmd('justifyCenter')}  title="Center">
        <svg width="13" height="13" viewBox="0 0 12 12" fill="currentColor"><rect x="0" y="1" width="12" height="1.5" rx="0.75"/><rect x="2" y="4" width="8" height="1.5" rx="0.75"/><rect x="0" y="7" width="12" height="1.5" rx="0.75"/><rect x="2" y="10" width="8" height="1.5" rx="0.75"/></svg>
      </TB>
      <TB active={align==='right'}   onClick={() => cmd('justifyRight')}   title="Align right">
        <svg width="13" height="13" viewBox="0 0 12 12" fill="currentColor"><rect x="0" y="1" width="12" height="1.5" rx="0.75"/><rect x="4" y="4" width="8" height="1.5" rx="0.75"/><rect x="0" y="7" width="12" height="1.5" rx="0.75"/><rect x="4" y="10" width="8" height="1.5" rx="0.75"/></svg>
      </TB>
      <TB active={align==='justify'} onClick={() => cmd('justifyFull')}    title="Justify">
        <svg width="13" height="13" viewBox="0 0 12 12" fill="currentColor"><rect x="0" y="1" width="12" height="1.5" rx="0.75"/><rect x="0" y="4" width="12" height="1.5" rx="0.75"/><rect x="0" y="7" width="12" height="1.5" rx="0.75"/><rect x="0" y="10" width="9" height="1.5" rx="0.75"/></svg>
      </TB>

      {sep}

      {/* Lists */}
      <TB active={false} onClick={() => cmd('insertUnorderedList')} title="Bullet list">
        <svg width="13" height="13" viewBox="0 0 12 12" fill="currentColor"><circle cx="1.5" cy="2.5" r="1.2"/><rect x="4" y="1.8" width="8" height="1.4" rx="0.7"/><circle cx="1.5" cy="6" r="1.2"/><rect x="4" y="5.3" width="8" height="1.4" rx="0.7"/><circle cx="1.5" cy="9.5" r="1.2"/><rect x="4" y="8.8" width="8" height="1.4" rx="0.7"/></svg>
      </TB>
      <TB active={false} onClick={() => cmd('insertOrderedList')} title="Numbered list">
        <svg width="13" height="13" viewBox="0 0 12 12" fill="currentColor"><text x="0" y="4" style={{fontSize:'4px',fontWeight:'bold'}}>1.</text><rect x="4" y="1.8" width="8" height="1.4" rx="0.7"/><text x="0" y="7.5" style={{fontSize:'4px',fontWeight:'bold'}}>2.</text><rect x="4" y="5.3" width="8" height="1.4" rx="0.7"/><text x="0" y="11" style={{fontSize:'4px',fontWeight:'bold'}}>3.</text><rect x="4" y="8.8" width="8" height="1.4" rx="0.7"/></svg>
      </TB>

      {sep}

      {/* Indent */}
      <TB active={false} onClick={() => cmd('indent')}   title="Indent"><svg width="13" height="13" viewBox="0 0 12 12" fill="currentColor"><rect x="0" y="1" width="12" height="1.4" rx="0.7"/><rect x="3" y="4" width="9" height="1.4" rx="0.7"/><rect x="3" y="7" width="9" height="1.4" rx="0.7"/><rect x="0" y="10" width="12" height="1.4" rx="0.7"/><path d="M0 4.5 L2.5 6 L0 7.5Z"/></svg></TB>
      <TB active={false} onClick={() => cmd('outdent')}  title="Outdent"><svg width="13" height="13" viewBox="0 0 12 12" fill="currentColor"><rect x="0" y="1" width="12" height="1.4" rx="0.7"/><rect x="3" y="4" width="9" height="1.4" rx="0.7"/><rect x="3" y="7" width="9" height="1.4" rx="0.7"/><rect x="0" y="10" width="12" height="1.4" rx="0.7"/><path d="M2.5 4.5 L0 6 L2.5 7.5Z"/></svg></TB>

      {sep}

      {/* Table insert with grid picker */}
      {(() => {
        const [showPicker, setShowPicker] = React.useState(false);
        const [hover, setHover] = React.useState({ r: 0, c: 0 });
        const pickerRef = React.useRef(null);
        React.useEffect(() => {
          if (!showPicker) return;
          const close = (e) => { if (pickerRef.current && !pickerRef.current.contains(e.target)) setShowPicker(false); };
          window.addEventListener('mousedown', close);
          return () => window.removeEventListener('mousedown', close);
        }, [showPicker]);
        return (
          <div style={{ position: 'relative', flexShrink: 0 }} ref={pickerRef}>
            <button
              onMouseDown={e => { e.preventDefault(); setShowPicker(v => !v); }}
              title="Insert table"
              className="flex items-center gap-1 px-2 h-[26px] rounded text-[11px] font-semibold transition-all"
              style={{ background: showPicker ? '#4f6ef0' : 'var(--fd-surface-sunken)', border: '1px solid var(--fd-border)', color: showPicker ? '#fff' : 'var(--fd-ink-2)', flexShrink: 0 }}>
              <svg width="11" height="11" viewBox="0 0 12 12" fill="currentColor">
                <rect x="0" y="0" width="12" height="12" rx="1" fill="none" stroke="currentColor" strokeWidth="1.2"/>
                <line x1="4" y1="0" x2="4" y2="12" stroke="currentColor" strokeWidth="1"/>
                <line x1="8" y1="0" x2="8" y2="12" stroke="currentColor" strokeWidth="1"/>
                <line x1="0" y1="4" x2="12" y2="4" stroke="currentColor" strokeWidth="1"/>
                <line x1="0" y1="8" x2="12" y2="8" stroke="currentColor" strokeWidth="1"/>
              </svg>
              Table
            </button>
            {showPicker && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, zIndex: 9999, marginTop: 4,
                background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10,
                boxShadow: '0 8px 24px rgba(0,0,0,0.14)', padding: 10,
              }}>
                <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 6, fontWeight: 600 }}>
                  {hover.r > 0 && hover.c > 0 ? `${hover.r} × ${hover.c} table` : 'Select table size'}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 18px)', gap: 2 }}>
                  {Array.from({ length: 64 }, (_, i) => {
                    const r = Math.floor(i / 8) + 1;
                    const c = (i % 8) + 1;
                    const active = r <= hover.r && c <= hover.c;
                    return (
                      <div
                        key={i}
                        onMouseEnter={() => setHover({ r, c })}
                        onMouseDown={e => {
                          e.preventDefault();
                          insertTable(r, c);
                          setShowPicker(false);
                          setHover({ r: 0, c: 0 });
                        }}
                        style={{
                          width: 18, height: 18, borderRadius: 2,
                          border: `1.5px solid ${active ? '#4f6ef0' : '#e5e7eb'}`,
                          background: active ? '#eff0fe' : '#f9fafb',
                          cursor: 'pointer',
                          transition: 'all 0.05s',
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {sep}

      {/* Undo / Redo */}
      <TB active={false} onClick={() => cmd('undo')} title="Undo (Ctrl+Z)">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>
      </TB>
      <TB active={false} onClick={() => cmd('redo')} title="Redo (Ctrl+Y)">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13"/></svg>
      </TB>

      {sep}

      {/* Clear formatting */}
      <TB active={false} onClick={() => cmd('removeFormat')} title="Clear formatting" danger>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/><line x1="18" y1="18" x2="22" y2="22"/></svg>
      </TB>
    </div>
  );
}

// ── Table context menu helpers ─────────────────────────────────────────────
function getTableFromCell(cell) {
  let el = cell;
  while (el && el.tagName !== 'TABLE') el = el.parentElement;
  return el;
}
function getCellCoords(cell) {
  const row = cell.parentElement;
  const tbody = row.parentElement;
  const rows = Array.from(tbody.querySelectorAll('tr'));
  const ri = rows.indexOf(row);
  const cells = Array.from(row.querySelectorAll('td,th'));
  const ci = cells.indexOf(cell);
  return { ri, ci, rows, cells };
}

function TableContextMenu({ menu, onClose, editorRef }) {
  if (!menu) return null;
  const { x, y, cell } = menu;

  const action = (fn) => { fn(); onClose(); };

  const addRowBelow = () => action(() => {
    const table = getTableFromCell(cell);
    const { ri, rows, cells } = getCellCoords(cell);
    const colCount = rows[0].querySelectorAll('td,th').length;
    const tr = document.createElement('tr');
    for (let i = 0; i < colCount; i++) {
      const td = document.createElement('td');
      td.style.cssText = 'border:1px solid #d1d5db;padding:6px 10px;font-size:13px;position:relative';
      td.innerHTML = '&nbsp;';
      tr.appendChild(td);
    }
    const refRow = rows[ri];
    refRow.parentElement.insertBefore(tr, refRow.nextSibling);
  });

  const addRowAbove = () => action(() => {
    const table = getTableFromCell(cell);
    const { ri, rows } = getCellCoords(cell);
    const colCount = rows[0].querySelectorAll('td,th').length;
    const tr = document.createElement('tr');
    for (let i = 0; i < colCount; i++) {
      const td = document.createElement('td');
      td.style.cssText = 'border:1px solid #d1d5db;padding:6px 10px;font-size:13px;position:relative';
      td.innerHTML = '&nbsp;';
      tr.appendChild(td);
    }
    rows[ri].parentElement.insertBefore(tr, rows[ri]);
  });

  const addColRight = () => action(() => {
    const table = getTableFromCell(cell);
    const { ri, ci, rows } = getCellCoords(cell);
    const colgroup = table.querySelector('colgroup');
    if (colgroup) {
      const col = document.createElement('col');
      const cols = colgroup.querySelectorAll('col');
      const pct = (100 / (cols.length + 1)).toFixed(2) + '%';
      cols.forEach(c => c.style.width = pct);
      col.style.width = pct;
      colgroup.insertBefore(col, cols[ci]?.nextSibling || null);
    }
    rows.forEach((row, rIdx) => {
      const rowCells = Array.from(row.querySelectorAll('td,th'));
      const refCell = rowCells[ci];
      const newCell = document.createElement(rIdx === 0 ? 'th' : 'td');
      newCell.style.cssText = rIdx === 0
        ? 'border:1px solid #d1d5db;padding:6px 10px;background:#f3f4f6;font-weight:700;font-size:13px;text-align:left;position:relative'
        : 'border:1px solid #d1d5db;padding:6px 10px;font-size:13px;position:relative';
      newCell.innerHTML = rIdx === 0 ? 'Header' : '&nbsp;';
      if (refCell) refCell.parentElement.insertBefore(newCell, refCell.nextSibling);
      else row.appendChild(newCell);
    });
  });

  const addColLeft = () => action(() => {
    const table = getTableFromCell(cell);
    const { ci, rows } = getCellCoords(cell);
    const colgroup = table.querySelector('colgroup');
    if (colgroup) {
      const col = document.createElement('col');
      const cols = colgroup.querySelectorAll('col');
      const pct = (100 / (cols.length + 1)).toFixed(2) + '%';
      cols.forEach(c => c.style.width = pct);
      col.style.width = pct;
      colgroup.insertBefore(col, cols[ci] || null);
    }
    rows.forEach((row, rIdx) => {
      const rowCells = Array.from(row.querySelectorAll('td,th'));
      const refCell = rowCells[ci];
      const newCell = document.createElement(rIdx === 0 ? 'th' : 'td');
      newCell.style.cssText = rIdx === 0
        ? 'border:1px solid #d1d5db;padding:6px 10px;background:#f3f4f6;font-weight:700;font-size:13px;text-align:left;position:relative'
        : 'border:1px solid #d1d5db;padding:6px 10px;font-size:13px;position:relative';
      newCell.innerHTML = rIdx === 0 ? 'Header' : '&nbsp;';
      if (refCell) row.insertBefore(newCell, refCell);
      else row.appendChild(newCell);
    });
  });

  const deleteRow = () => action(() => {
    const { ri, rows } = getCellCoords(cell);
    if (rows.length > 1) rows[ri].remove();
  });

  const deleteCol = () => action(() => {
    const table = getTableFromCell(cell);
    const { ci, rows } = getCellCoords(cell);
    const colgroup = table.querySelector('colgroup');
    if (colgroup) {
      const cols = colgroup.querySelectorAll('col');
      if (cols.length > 1) cols[ci]?.remove();
      const remaining = colgroup.querySelectorAll('col');
      const pct = (100 / remaining.length).toFixed(2) + '%';
      remaining.forEach(c => c.style.width = pct);
    }
    rows.forEach(row => {
      const rowCells = Array.from(row.querySelectorAll('td,th'));
      if (rowCells.length > 1) rowCells[ci]?.remove();
    });
  });

  const deleteTable = () => action(() => {
    const table = getTableFromCell(cell);
    table?.remove();
  });

  const menuItems = [
    { label: '↑ Insert row above', fn: addRowAbove, icon: '⬆' },
    { label: '↓ Insert row below', fn: addRowBelow, icon: '⬇' },
    { label: '← Insert column left', fn: addColLeft, icon: '⬅' },
    { label: '→ Insert column right', fn: addColRight, icon: '➡' },
    null, // separator
    { label: 'Delete row', fn: deleteRow, danger: true },
    { label: 'Delete column', fn: deleteCol, danger: true },
    { label: 'Delete table', fn: deleteTable, danger: true },
  ];

  return (
    <div
      style={{
        position: 'fixed', left: x, top: y, zIndex: 99999,
        background: '#fff', border: '1px solid #e5e7eb',
        borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.16)',
        minWidth: 200, overflow: 'hidden',
      }}
      onMouseDown={e => e.stopPropagation()}
    >
      <div style={{ padding: '4px 0' }}>
        {menuItems.map((item, i) =>
          item === null ? (
            <div key={i} style={{ height: 1, background: '#f3f4f6', margin: '3px 0' }} />
          ) : (
            <button
              key={i}
              onClick={() => item.fn()}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '7px 14px', fontSize: 13, cursor: 'pointer',
                background: 'transparent', border: 'none',
                color: item.danger ? '#dc2626' : '#111',
                fontWeight: item.danger ? 500 : 400,
              }}
              onMouseEnter={e => e.currentTarget.style.background = item.danger ? '#fef2f2' : '#f3f4f6'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              {item.label}
            </button>
          )
        )}
      </div>
    </div>
  );
}

// ── Add-Row/Col ghost buttons that appear at table edges ──────────────────────
function TableAddButtons({ editorRef, tableContextTrigger }) {
  // We attach real DOM listeners to the editor for hover detection on table edges
  // This component just renders a portal-like overlay div
  return null; // Handled via CSS/DOM manipulation in BoardEditorModal
}

function BoardEditorModal({ board, onClose, onSave }) {
  const editorRef  = React.useRef(null);
  const [saving, setSaving] = React.useState(false);
  const [title, setTitle]   = React.useState(board.title || 'Untitled Board');
  const initialized = React.useRef(false);
  const [ctxMenu, setCtxMenu] = React.useState(null); // { x, y, cell }
  const resizeState = React.useRef(null); // { col, table, startX, startWidths }

  // Load saved HTML into the editor on first mount
  React.useEffect(() => {
    if (editorRef.current && !initialized.current) {
      initialized.current = true;
      editorRef.current.innerHTML = board.html || '<p><br></p>';
    }
  }, [board.html]);

  const handleSave = async () => {
    // Clean up any resize handles before saving
    setSaving(true);
    const html = editorRef.current?.innerHTML || '';
    await onSave({ html, title });
    setSaving(false);
  };

  // Close on Escape
  React.useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') { setCtxMenu(null); onClose(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Right-click on table cell → context menu
  React.useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const onCtx = (e) => {
      const cell = e.target.closest('td,th');
      if (!cell) return;
      e.preventDefault();
      // Keep caret in cell
      setCtxMenu({ x: e.clientX, y: e.clientY, cell });
    };
    editor.addEventListener('contextmenu', onCtx);
    return () => editor.removeEventListener('contextmenu', onCtx);
  }, []);

  // Column resize via mousedown on cell right border
  React.useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const onMouseMove = (e) => {
      // Show resize cursor when near right edge of a cell
      const cell = e.target.closest('td,th');
      if (!cell) { editor.style.cursor = ''; return; }
      const rect = cell.getBoundingClientRect();
      const nearRight = e.clientX > rect.right - 6;
      editor.style.cursor = nearRight ? 'col-resize' : '';
    };

    const onMouseDown = (e) => {
      const cell = e.target.closest('td,th');
      if (!cell) return;
      const rect = cell.getBoundingClientRect();
      if (e.clientX <= rect.right - 6) return; // not near right edge
      e.preventDefault();
      e.stopPropagation();

      const table = getTableFromCell(cell);
      const colgroup = table.querySelector('colgroup');
      if (!colgroup) return;

      const { ci } = getCellCoords(cell);
      const cols = Array.from(colgroup.querySelectorAll('col'));
      const tableRect = table.getBoundingClientRect();
      const tableWidth = tableRect.width;

      // Convert % widths to px for dragging
      const widthsPx = cols.map(col => {
        const pct = parseFloat(col.style.width) / 100;
        return pct * tableWidth;
      });

      resizeState.current = { ci, cols, widthsPx, startX: e.clientX, tableWidth };

      const onMove = (ev) => {
        const rs = resizeState.current;
        if (!rs) return;
        const dx = ev.clientX - rs.startX;
        const newWidths = [...rs.widthsPx];
        const minWidth = 30;

        if (rs.ci < rs.cols.length - 1) {
          // Resize between ci and ci+1
          const total = newWidths[rs.ci] + newWidths[rs.ci + 1];
          newWidths[rs.ci] = Math.max(minWidth, Math.min(total - minWidth, rs.widthsPx[rs.ci] + dx));
          newWidths[rs.ci + 1] = total - newWidths[rs.ci];
        } else {
          // Last column — just expand/shrink it
          newWidths[rs.ci] = Math.max(minWidth, rs.widthsPx[rs.ci] + dx);
        }

        const totalPx = newWidths.reduce((a, b) => a + b, 0);
        rs.cols.forEach((col, i) => {
          col.style.width = ((newWidths[i] / totalPx) * 100).toFixed(2) + '%';
        });
      };

      const onUp = () => {
        resizeState.current = null;
        editor.style.cursor = '';
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };

      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    };

    editor.addEventListener('mousemove', onMouseMove);
    editor.addEventListener('mousedown', onMouseDown);
    return () => {
      editor.removeEventListener('mousemove', onMouseMove);
      editor.removeEventListener('mousedown', onMouseDown);
    };
  }, []);

  // Click-outside to close context menu
  React.useEffect(() => {
    if (!ctxMenu) return;
    const close = () => setCtxMenu(null);
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [ctxMenu]);

  // Tab key: navigate between table cells (Tab = next, Shift+Tab = prev)
  React.useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const onKeyDown = (e) => {
      if (e.key !== 'Tab') return;
      const selNode = window.getSelection()?.anchorNode;
      const td = selNode?.nodeType === 1 ? selNode.closest('td,th') : selNode?.parentElement?.closest('td,th');
      if (!td) return;
      e.preventDefault();
      const table = getTableFromCell(td);
      const allCells = Array.from(table.querySelectorAll('td,th'));
      const idx = allCells.indexOf(td);
      const nextIdx = e.shiftKey ? idx - 1 : idx + 1;
      if (nextIdx >= 0 && nextIdx < allCells.length) {
        const nextCell = allCells[nextIdx];
        nextCell.focus();
        const range = document.createRange();
        range.selectNodeContents(nextCell);
        range.collapse(false);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      } else if (!e.shiftKey && nextIdx >= allCells.length) {
        const rows = Array.from(table.querySelectorAll('tr'));
        const lastRow = rows[rows.length - 1];
        const colCount = lastRow.querySelectorAll('td,th').length;
        const tr = document.createElement('tr');
        for (let i = 0; i < colCount; i++) {
          const newTd = document.createElement('td');
          newTd.style.cssText = 'border:1px solid #d1d5db;padding:6px 10px;font-size:13px;position:relative';
          newTd.innerHTML = '&nbsp;';
          tr.appendChild(newTd);
        }
        lastRow.parentElement.appendChild(tr);
        const firstNew = tr.querySelector('td');
        if (firstNew) {
          firstNew.focus();
          const range = document.createRange();
          range.selectNodeContents(firstNew);
          range.collapse(false);
          const sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(range);
        }
      }
    };
    editor.addEventListener('keydown', onKeyDown);
    return () => editor.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>

      {/* Word-like document shell */}
      <div className="flex flex-col rounded-2xl shadow-2xl overflow-hidden"
        style={{ width: 'min(92vw, 960px)', height: '90vh', background: 'var(--fd-surface)', border: '1px solid var(--fd-border)' }}>

        {/* Title bar */}
        <div className="flex items-center gap-3 px-4 py-2.5 border-b flex-shrink-0"
          style={{ borderColor: 'var(--fd-border)', background: 'var(--fd-surface)' }}>
          <div className="flex-1 flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4f6ef0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="flex-1 bg-transparent text-[14px] font-semibold outline-none border-none"
              style={{ color: 'var(--fd-ink-1)', minWidth: 0 }}
              placeholder="Document title"
            />
          </div>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-[13px] font-semibold transition-all"
            style={{ background: '#4f6ef0', color: '#fff', opacity: saving ? 0.7 : 1, flexShrink: 0 }}>
            {saving
              ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <Save size={13} />}
            Save
          </button>
          <button onMouseDown={onClose}
            className="p-1.5 rounded-xl transition-colors"
            style={{ color: 'var(--fd-ink-3)' }}
            onMouseEnter={e => e.currentTarget.style.background='var(--fd-surface-sunken)'}
            onMouseLeave={e => e.currentTarget.style.background='transparent'}>
            <X size={16} />
          </button>
        </div>

        {/* Toolbar */}
        <RichToolbar editorRef={editorRef} />

        {/* Table editing hint */}
        <div style={{ background: '#fffbeb', borderBottom: '1px solid #fde68a', padding: '4px 14px', fontSize: 11, color: '#92600a', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <span><strong>Table tips:</strong> Right-click any cell to add/delete rows &amp; columns · Drag column borders to resize</span>
        </div>

        {/* Page-like document area */}
        <div className="flex-1 overflow-y-auto py-8 px-6"
          style={{ background: '#f0f0f0' }}>
          {/* The "paper" */}
          <div
            style={{
              maxWidth: 760,
              margin: '0 auto',
              background: '#ffffff',
              minHeight: 'calc(100% - 32px)',
              boxShadow: '0 1px 3px rgba(0,0,0,0.12), 0 4px 24px rgba(0,0,0,0.08)',
              borderRadius: 2,
              padding: '48px 64px',
              color: '#111',
            }}>
            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              spellCheck
              className="outline-none fd-rich-editor"
              style={{
                minHeight: 480,
                fontSize: 14,
                lineHeight: 1.8,
                color: '#111',
                fontFamily: 'ui-sans-serif, system-ui, sans-serif',
                caretColor: '#4f6ef0',
              }}
              onInput={() => {/* content tracked via innerHTML on save */}}
            />
          </div>
        </div>
      </div>

      {/* Context menu */}
      {ctxMenu && (
        <TableContextMenu
          menu={ctxMenu}
          onClose={() => setCtxMenu(null)}
          editorRef={editorRef}
        />
      )}

      {/* Rich text styles scoped to editor */}
      <style>{`
        .fd-rich-editor h1 { font-size: 2em; font-weight: 700; margin: 0.67em 0; line-height: 1.2; }
        .fd-rich-editor h2 { font-size: 1.5em; font-weight: 700; margin: 0.75em 0; line-height: 1.3; }
        .fd-rich-editor h3 { font-size: 1.17em; font-weight: 700; margin: 0.83em 0; }
        .fd-rich-editor h4 { font-size: 1em; font-weight: 700; margin: 1em 0; }
        .fd-rich-editor p  { margin: 0.5em 0; }
        .fd-rich-editor ul { list-style: disc; padding-left: 1.5em; margin: 0.5em 0; }
        .fd-rich-editor ol { list-style: decimal; padding-left: 1.5em; margin: 0.5em 0; }
        .fd-rich-editor li { margin: 0.25em 0; }
        .fd-rich-editor pre { font-family: ui-monospace, monospace; background: #f3f4f6; padding: 10px 14px; border-radius: 6px; font-size: 12.5px; overflow-x: auto; }
        .fd-rich-editor blockquote { border-left: 3px solid #c7d2fe; margin: 8px 0; padding-left: 14px; color: #6b7280; font-style: italic; }
        .fd-rich-editor table { border-collapse: collapse; width: 100%; margin: 10px 0; table-layout: fixed; }
        .fd-rich-editor th { border: 1px solid #d1d5db; padding: 7px 10px; background: #f9fafb; font-weight: 700; font-size: 13px; text-align: left; position: relative; }
        .fd-rich-editor td { border: 1px solid #d1d5db; padding: 7px 10px; font-size: 13px; position: relative; }
        .fd-rich-editor td:focus, .fd-rich-editor th:focus { outline: 2px solid #4f6ef0; outline-offset: -2px; background: #eff0fe !important; }
        .fd-rich-editor td:hover, .fd-rich-editor th:hover { background: rgba(79,110,240,0.04); }
        .fd-rich-editor tr:last-child td::after {
          content: '+';
          position: absolute;
          bottom: -14px;
          left: 50%;
          transform: translateX(-50%);
          width: 18px; height: 14px;
          background: #4f6ef0;
          color: #fff;
          font-size: 11px;
          line-height: 14px;
          text-align: center;
          border-radius: 3px;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.15s;
          z-index: 10;
        }
        .fd-rich-editor table:hover tr:last-child td:first-child::after { opacity: 1; }
        .fd-rich-editor tr td:last-child::before {
          content: '+';
          position: absolute;
          right: -14px;
          top: 50%;
          transform: translateY(-50%);
          width: 14px; height: 18px;
          background: #4f6ef0;
          color: #fff;
          font-size: 11px;
          line-height: 18px;
          text-align: center;
          border-radius: 3px;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.15s;
          z-index: 10;
        }
        .fd-rich-editor table:hover tr td:last-child::before { opacity: 1; }
        .fd-rich-editor:empty:before { content: 'Start typing your document…'; color: #9ca3af; pointer-events: none; }
      `}</style>
    </div>
  );
}

// ── Simple HTML sanitizer (no dependencies) ──────────────────────────────────
function sanitizeHtml(dirty) {
  if (!dirty) return '';
  // Remove scripts and dangerous attributes
  const clean = dirty
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/ on\w+="[^"]*"/g, '')
    .replace(/ on\w+='[^']*'/g, '');
  return clean;
}

// ── NEW Draggable Boards Section ─────────────────────────────────────────────
function ClientBoardsSection({ clientId }) {
  const [boards, setBoards] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [openBoard, setOpenBoard] = React.useState(null);
  const [showCreate, setShowCreate] = React.useState(false);
  const [newName, setNewName] = React.useState('');
  const dragIndex = React.useRef(null);
  const toast = useToast ? useToast() : null;
  const storageKey = `fd-boards-v2-${clientId}`;

  React.useEffect(() => {
    try { setBoards(JSON.parse(localStorage.getItem(storageKey) || '[]')); } catch { setBoards([]); }
    setLoading(false);
  }, [storageKey]);

  const persist = (b) => {
    setBoards(b);
    try { localStorage.setItem(storageKey, JSON.stringify(b)); } catch {}
  };

  const createBoard = () => {
    const name = newName.trim() || 'Untitled Document';
    const nb = { id: `bd-${Date.now()}`, title: name, html: '', updatedAt: new Date().toISOString() };
    const next = [...boards, nb];
    persist(next);
    setNewName(''); setShowCreate(false);
    setOpenBoard(nb);
  };

  const saveBoard = ({ html, title }) => {
    const next = boards.map(b => b.id === openBoard?.id
      ? { ...b, html, title, updatedAt: new Date().toISOString() } : b);
    persist(next);
    setOpenBoard(prev => prev ? { ...prev, html, title } : null);
    if (toast) toast({ type: 'success', title: 'Saved' });
  };

  const deleteBoard = (e, id) => {
    e.stopPropagation();
    const next = boards.filter(b => b.id !== id);
    persist(next);
    if (openBoard?.id === id) setOpenBoard(null);
  };

  const handleDragStart = (e, index) => {
    dragIndex.current = index;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', '');
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, toIndex) => {
    e.preventDefault();
    const fromIndex = dragIndex.current;
    if (fromIndex == null || fromIndex === toIndex) return;
    const reordered = [...boards];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);
    persist(reordered);
    dragIndex.current = null;
  };

  if (loading) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm" style={{ color: 'var(--fd-ink-1)' }}>📄 Documents</h3>
        <Button size="xs" variant="secondary" onClick={() => setShowCreate(v => !v)}>
          <Plus size={12} />{showCreate ? 'Cancel' : 'New Document'}
        </Button>
      </div>

      {showCreate && (
        <div className="flex gap-2">
          <input
            autoFocus
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') createBoard(); if (e.key === 'Escape') setShowCreate(false); }}
            placeholder="Document name…"
            className="fd-input flex-1 text-[13px]"
          />
          <button onClick={createBoard} className="px-3 py-1.5 rounded-xl text-[12px] font-semibold"
            style={{ background: '#4f6ef0', color: '#fff' }}>
            Create
          </button>
        </div>
      )}

      {boards.length === 0 && !showCreate ? (
        <div className="text-center py-10 rounded-2xl" style={{ background: 'var(--fd-surface)', border: '1px dashed var(--fd-border-strong)' }}>
          <div className="text-3xl mb-2">📄</div>
          <div className="text-[13px] font-medium" style={{ color: 'var(--fd-ink-3)' }}>No documents yet</div>
          <div className="text-[11px] mt-1" style={{ color: 'var(--fd-ink-5)' }}>Create a document to add rich text notes, tables and more</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {boards.map((board, index) => (
            <div
              key={board.id}
              onClick={() => setOpenBoard(board)}
              className="group relative rounded-xl border overflow-hidden transition-shadow hover:shadow-md cursor-pointer"
              style={{ background: '#ffffff', borderColor: 'var(--fd-border)' }}
            >
              {/* Drag handle */}
              <div
                draggable="true"
                onDragStart={e => handleDragStart(e, index)}
                onDragOver={handleDragOver}
                onDrop={e => handleDrop(e, index)}
                className="absolute top-2 left-2 p-1 rounded cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity z-10"
                style={{ background: 'rgba(0,0,0,0.05)' }}
                title="Drag to reorder"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ color: 'var(--fd-ink-3)' }}>
                  <circle cx="5" cy="5" r="2"/><circle cx="12" cy="5" r="2"/><circle cx="19" cy="5" r="2"/>
                  <circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/>
                  <circle cx="5" cy="19" r="2"/><circle cx="12" cy="19" r="2"/><circle cx="19" cy="19" r="2"/>
                </svg>
              </div>

              <button
                onClick={e => deleteBoard(e, board.id)}
                className="absolute top-2 right-2 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity z-10"
                style={{ background: '#fee2e2', color: '#ef4444' }}
                title="Delete document"
              >
                <Trash2 size={12} />
              </button>

              <div className="p-4 pt-8">
                <div className="font-semibold text-[14px] mb-2 truncate" style={{ color: 'var(--fd-ink-1)' }}>
                  {board.title}
                </div>
                <div
                  className="text-[13px] leading-relaxed prose-like"
                  style={{ color: '#111', overflow: 'visible' }}
                  dangerouslySetInnerHTML={{
                    __html: sanitizeHtml(board.html) || '<p style="color:#9ca3af;font-style:italic;">Empty document</p>'
                  }}
                />
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-[11px]" style={{ color: 'var(--fd-ink-5)' }}>
                    {board.updatedAt ? new Date(board.updatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
                  </span>
                  <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: '#f3f4f6', color: '#6b7280' }}>
                    {board.html?.length > 100 ? `${Math.ceil(board.html.length / 500)} sections` : 'Short doc'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {openBoard && (
        <BoardEditorModal
          board={openBoard}
          onClose={() => setOpenBoard(null)}
          onSave={saveBoard}
        />
      )}

      <style>{`
        .prose-like h1 { font-size: 1.5em; font-weight: 700; margin: 0.5em 0; }
        .prose-like h2 { font-size: 1.2em; font-weight: 700; margin: 0.4em 0; }
        .prose-like h3 { font-size: 1.1em; font-weight: 600; margin: 0.3em 0; }
        .prose-like p  { margin: 0.3em 0; }
        .prose-like ul { padding-left: 1.2em; margin: 0.3em 0; }
        .prose-like ol { padding-left: 1.2em; margin: 0.3em 0; }
        .prose-like table { border-collapse: collapse; width: 100%; margin: 0.5em 0; }
        .prose-like th { border: 1px solid #d1d5db; padding: 4px 6px; background: #f9fafb; font-size: 12px; }
        .prose-like td { border: 1px solid #d1d5db; padding: 4px 6px; font-size: 12px; }
      `}</style>
    </div>
  );
}

export default function ClientDetailPage() {
  const { id } = useParams();
  const { user } = useAuthStore();
  const isManager = ['admin', 'manager'].includes(user?.role);
  const isAdmin = user?.role === 'admin';
  const logoInputRef = useRef(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const [overview, setOverview] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState([]);
  const [updates, setUpdates] = useState([]);
  const [files, setFiles] = useState([]);
  const [reports, setReports] = useState([]);
  const [allTeamMembers, setAllTeamMembers] = useState([]);
  const [socialAccounts, setSocialAccounts] = useState([]);
  const [socialAnalytics, setSocialAnalytics] = useState(null);
  const [socialPosts, setSocialPosts] = useState([]);
  const [socialDays, setSocialDays] = useState(30);
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [calendarMonth, setCalendarMonth] = useState(new Date());

  const nowGlobal = new Date();
  const defaultFilterMonth = `${nowGlobal.getFullYear()}-${String(nowGlobal.getMonth() + 1).padStart(2, '0')}`;
  const [filterMonth, setFilterMonth] = useState('all');

  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingTeam, setSavingTeam] = useState(false);

  const [updateForm, setUpdateForm] = useState({ title: '', content: '', type: 'general' });
  const [taskForm, setTaskForm] = useState({
    title: '', description: '', priority: 'medium', deadline: '',
    assignedTo: '', category: 'other', isClientVisible: true
  });
  const [editForm, setEditForm] = useState({});
  const [addMemberId, setAddMemberId] = useState('');

  useEffect(() => {
    api.get('/users?limit=100').then(r => {
      const team = (r.data.users || []).filter(u => u.role !== 'client');
      setAllTeamMembers(team);
    }).catch(() => {});
  }, []);

  useEffect(() => { loadData(); }, [id]);

  useEffect(() => {
    if (activeTab === 'social' && id) {
      api.get(`/social/analytics?client=${id}&days=${socialDays}`)
        .then(r => setSocialAnalytics(r.data.analytics || null))
        .catch(() => {});
    }
  }, [socialDays, activeTab]);

  useEffect(() => {
    if (activeTab === 'calendar' && id) {
      const from = startOfWeek(startOfMonth(calendarMonth), { weekStartsOn: 1 }).toISOString();
      const to   = endOfWeek(endOfMonth(calendarMonth),   { weekStartsOn: 1 }).toISOString();
      api.get(`/calendar?from=${from}&to=${to}&client=${id}`)
        .then(r => setCalendarEvents(r.data.events || []))
        .catch(() => {});
    }
  }, [activeTab, calendarMonth, id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [ovRes, taskRes, updRes, fileRes, repRes, socialAccRes, socialAnaRes, socialPostRes] = await Promise.all([
        api.get(`/clients/${id}/overview`),
        api.get(`/tasks?client=${id}&limit=50`),
        api.get(`/updates?client=${id}&limit=20`),
        api.get(`/files?client=${id}&limit=20`),
        api.get(`/reports?client=${id}&limit=10`),
        api.get(`/social/accounts?client=${id}`),
        api.get(`/social/analytics?client=${id}&days=${socialDays}`),
        api.get(`/social/posts?client=${id}&limit=10`),
      ]);
      setOverview(ovRes.data);
      setTasks(taskRes.data.tasks || []);
      setUpdates(updRes.data.updates || []);
      setFiles(fileRes.data.files || []);
      setReports(repRes.data.reports || []);
      setSocialAccounts(socialAccRes.data.accounts || []);
      setSocialAnalytics(socialAnaRes.data.analytics || null);
      setSocialPosts(socialPostRes.data.posts || []);
    } finally { setLoading(false); }
  };

  const handleAddUpdate = async () => {
    if (!updateForm.title.trim() || !updateForm.content.trim()) return;
    setSaving(true);
    try {
      await api.post('/updates', { ...updateForm, client: id });
      setShowUpdateModal(false);
      setUpdateForm({ title: '', content: '', type: 'general' });
      loadData();
    } finally { setSaving(false); }
  };

  const handleAddTask = async () => {
    if (!taskForm.title.trim()) return;
    setSaving(true);
    try {
      await api.post('/tasks', { ...taskForm, client: id });
      setShowTaskModal(false);
      setTaskForm({ title: '', description: '', priority: 'medium', deadline: '', assignedTo: '', category: 'other', isClientVisible: true });
      loadData();
    } finally { setSaving(false); }
  };

  const handleSaveEdit = async () => {
    setSaving(true);
    try {
      await api.put(`/clients/${id}`, editForm);
      setShowEditModal(false);
      loadData();
    } finally { setSaving(false); }
  };

  const handleAddTeamMember = async () => {
    if (!addMemberId) return;
    setSavingTeam(true);
    try {
      const currentIds = (overview?.client?.teamMembers || []).map(m => m._id || m);
      if (currentIds.map(String).includes(String(addMemberId))) {
        setShowAddMemberModal(false);
        return;
      }
      await api.put(`/clients/${id}`, { teamMembers: [...currentIds, addMemberId] });
      setShowAddMemberModal(false);
      setAddMemberId('');
      loadData();
    } finally { setSavingTeam(false); }
  };

  const handleRemoveTeamMember = async (memberId) => {
    setSavingTeam(true);
    try {
      const currentIds = (overview?.client?.teamMembers || []).map(m => m._id || m);
      const newIds = currentIds.filter(mid => String(mid) !== String(memberId));
      await api.put(`/clients/${id}`, { teamMembers: newIds });
      loadData();
    } finally { setSavingTeam(false); }
  };

  const handleSetAccountManager = async (managerId) => {
    if (!managerId) return;
    setSavingTeam(true);
    try {
      await api.put(`/clients/${id}`, { accountManager: managerId });
      loadData();
    } finally { setSavingTeam(false); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>;
  const client = overview?.client;
  if (!client) return <div className="text-[var(--fd-ink-3)] text-center py-16">Client not found</div>;

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    try {
      const fd = new FormData();
      fd.append('logo', file);
      const { data } = await api.post(`/clients/${id}/logo`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setOverview(prev => ({ ...prev, client: { ...prev.client, logo: data.logo } }));
    } catch (err) {
      console.error('Logo upload failed', err);
    } finally {
      setUploadingLogo(false);
      e.target.value = '';
    }
  };

  const handleLogoRemove = async () => {
    try {
      await api.put(`/clients/${id}`, { logo: null });
      setOverview(prev => ({ ...prev, client: { ...prev.client, logo: null } }));
    } catch (err) {
      console.error('Logo remove failed', err);
    }
  };

  const assignedMemberIds = new Set([
    ...(client.teamMembers || []).map(m => String(m._id || m)),
    client.accountManager ? String(client.accountManager._id || client.accountManager) : null,
  ].filter(Boolean));

  const availableToAdd = allTeamMembers.filter(m => !assignedMemberIds.has(String(m._id)));
  const eligibleManagers = allTeamMembers.filter(m => ['admin', 'manager'].includes(m.role));

  const teamCount = (client.teamMembers?.length || 0) + (client.accountManager ? 1 : 0);

  const tabs = [
    { id: 'overview',  label: 'Overview' },
    { id: 'calendar',  label: 'Calendar' },
    { id: 'social',    label: `Social (${socialAccounts.length})` },
    { id: 'tasks',     label: `Tasks (${tasks.length})` },
    ...(isManager ? [{ id: 'team', label: `Team (${teamCount})` }] : []),
    { id: 'updates',   label: `Updates (${updates.length})` },
    { id: 'reports',   label: `Reports (${reports.length})` },
    { id: 'files',     label: `Files (${files.length})` },
    { id: 'gmb',       label: 'GMB Panel' },
  ];

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header — stacks on mobile */}
      <div className="flex items-start gap-3">
        <Link to="/admin/clients" className="mt-1 p-1.5 text-[var(--fd-ink-4)] hover:text-[var(--fd-ink-2)] hover:bg-[var(--fd-surface-sunken)] rounded-lg transition-colors flex-shrink-0">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-3 flex-wrap">
            {isManager ? (
              <div className="relative flex-shrink-0 group">
                <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                <div
                  className="relative cursor-pointer"
                  onClick={() => logoInputRef.current?.click()}
                  title="Upload company logo"
                >
                  <Avatar name={client.company} src={client.logo} size="md" className="flex-shrink-0" />
                  <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity pointer-events-none">
                    {uploadingLogo ? (
                      <svg className="animate-spin" width="13" height="13" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="3" strokeDasharray="30 70" />
                      </svg>
                    ) : (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>
                      </svg>
                    )}
                  </div>
                </div>
                {client.logo && (
                  <button
                    type="button"
                    onClick={handleLogoRemove}
                    title="Remove logo"
                    className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
                    style={{ background: '#ef4444', border: '1.5px solid var(--fd-canvas)' }}
                  >
                    <svg width="7" height="7" viewBox="0 0 10 10" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
                      <line x1="2" y1="2" x2="8" y2="8"/><line x1="8" y1="2" x2="2" y2="8"/>
                    </svg>
                  </button>
                )}
              </div>
            ) : (
              <Avatar name={client.company} src={client.logo} size="md" className="flex-shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <h1 className="text-lg sm:text-xl font-bold text-[var(--fd-ink-1)] truncate">{client.company}</h1>
              <p className="text-[var(--fd-ink-3)] text-sm">{client.name} · {client.industry}</p>
            </div>
            <div className="flex flex-wrap gap-1.5 items-center">
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${getStatusColor(client.status)}`}>{client.status}</span>
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${PLAN_COLORS[client.plan]}`}>{PLAN_LABELS[client.plan]}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            <Link to={`/admin/messages/${id}`}>
              <Button variant="outline" size="sm"><MessageSquare size={14} />Chat</Button>
            </Link>
            {isManager && (
              <Button variant="outline" size="sm" onClick={() => {
                setEditForm({
                  name: client.name, company: client.company, email: client.email,
                  phone: client.phone || '', website: client.website || '',
                  industry: client.industry || '', status: client.status,
                  plan: client.plan, monthlyBudget: client.monthlyBudget, notes: client.notes || '',
                });
                setShowEditModal(true);
              }}><Edit3 size={14} />Edit</Button>
            )}
            <Button size="sm" onClick={() => setShowUpdateModal(true)}><Plus size={14} />Update</Button>
          </div>
        </div>
      </div>

      {/* Tabs — horizontally scrollable */}
      <div className="flex gap-1 border-b border-[var(--fd-border)] overflow-x-auto scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`px-3 sm:px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap flex-shrink-0 ${activeTab === t.id ? 'border-brand-600 text-brand-600' : 'border-transparent text-[var(--fd-ink-3)] hover:text-[var(--fd-ink-2)]'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* OVERVIEW */}
      {activeTab === 'overview' && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2 space-y-5">
              <Card>
                <CardHeader><h3 className="font-semibold text-[var(--fd-ink-1)] text-sm">Client Information</h3></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center gap-2 text-[var(--fd-ink-2)] min-w-0"><Mail size={14} className="text-[var(--fd-ink-4)] flex-shrink-0" /><span className="truncate">{client.email}</span></div>
                    <div className="flex items-center gap-2 text-[var(--fd-ink-2)]"><Phone size={14} className="text-[var(--fd-ink-4)] flex-shrink-0" />{client.phone || '—'}</div>
                    <div className="flex items-center gap-2 text-[var(--fd-ink-2)] min-w-0"><Globe size={14} className="text-[var(--fd-ink-4)] flex-shrink-0" /><span className="truncate">{client.website || '—'}</span></div>
                    <div className="flex items-center gap-2 text-[var(--fd-ink-2)]"><Calendar size={14} className="text-[var(--fd-ink-4)] flex-shrink-0" />Started {formatDate(client.startDate)}</div>
                    {user?.role === 'admin' && (
                      <div className="flex items-center gap-2 text-[var(--fd-ink-2)]"><IndianRupee size={14} className="text-[var(--fd-ink-4)] flex-shrink-0" />{formatCurrency(client.monthlyBudget)}/mo</div>
                    )}
                  </div>
                  {client.services?.length > 0 && (
                    <div className="mt-4">
                      <div className="text-xs font-medium text-[var(--fd-ink-3)] mb-2 uppercase tracking-wide">Services</div>
                      <div className="flex flex-wrap gap-1.5">
                        {client.services.map(s => <span key={s} className="px-2.5 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-xs font-medium">{SERVICE_LABELS[s] || s}</span>)}
                      </div>
                    </div>
                  )}
                  {client.notes && <div className="mt-4 p-3 bg-[var(--fd-surface-raised)] rounded-lg text-sm text-[var(--fd-ink-2)]">{client.notes}</div>}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-[var(--fd-ink-1)] text-sm">Recent Updates</h3>
                    <Button size="xs" variant="secondary" onClick={() => setShowUpdateModal(true)}><Plus size={12} />Add Update</Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {!overview?.recentUpdates?.length ? (
                    <p className="text-[var(--fd-ink-4)] text-sm text-center py-4">No updates yet</p>
                  ) : overview.recentUpdates.map(u => (
                    <div key={u._id} className="flex gap-3">
                      <Avatar name={u.author?.name} size="sm" className="flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="text-sm font-medium text-[var(--fd-ink-1)]">{u.title}</div>
                        <div className="text-xs text-[var(--fd-ink-3)] mt-0.5">{u.author?.name} · {timeAgo(u.createdAt)}</div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              <Card>
                <CardHeader><h3 className="font-semibold text-[var(--fd-ink-1)] text-sm">Account Manager</h3></CardHeader>
                <CardContent>
                  {client.accountManager ? (
                    <div className="flex items-center gap-3">
                      <Avatar name={client.accountManager.name} size="md" />
                      <div>
                        <div className="font-medium text-[var(--fd-ink-1)] text-sm">{client.accountManager.name}</div>
                        <div className="text-xs text-[var(--fd-ink-3)]">{client.accountManager.jobTitle}</div>
                        <div className="text-xs text-[var(--fd-ink-4)]">{client.accountManager.email}</div>
                      </div>
                    </div>
                  ) : <p className="text-[var(--fd-ink-4)] text-sm">Not assigned</p>}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-[var(--fd-ink-1)] text-sm">Team</h3>
                    {isManager && <button onClick={() => setActiveTab('team')} className="text-xs text-brand-600 hover:underline">Manage</button>}
                  </div>
                </CardHeader>
                <CardContent>
                  {!client.teamMembers?.length ? (
                    <p className="text-[var(--fd-ink-4)] text-sm">No team members assigned</p>
                  ) : (
                    <div className="space-y-2">
                      {client.teamMembers.map(m => (
                        <div key={m._id} className="flex items-center gap-2">
                          <Avatar name={m.name} size="sm" />
                          <div className="min-w-0">
                            <div className="text-xs font-medium text-[var(--fd-ink-2)] truncate">{m.name}</div>
                            <div className="text-xs text-[var(--fd-ink-4)]">{ROLE_LABELS[m.role] || m.role}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-[var(--fd-ink-1)] text-sm">Task Overview</h3>
                    {isManager && <Button size="xs" variant="secondary" onClick={() => setShowTaskModal(true)}><Plus size={12} />Task</Button>}
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {overview?.taskStats?.map(ts => (
                    <div key={ts._id} className="flex items-center justify-between">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${getTaskStatusColor(ts._id)}`}>{ts._id?.replace('_', ' ')}</span>
                      <span className="font-bold text-[var(--fd-ink-2)]">{ts.count}</span>
                    </div>
                  ))}
                  {!overview?.taskStats?.length && <p className="text-[var(--fd-ink-4)] text-sm text-center py-2">No tasks yet</p>}
                </CardContent>
              </Card>

              {overview?.latestReport && (
                <Card>
                  <CardHeader><h3 className="font-semibold text-[var(--fd-ink-1)] text-sm">Latest Report</h3></CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div className="font-medium text-[var(--fd-ink-2)]">{overview.latestReport.title}</div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-2 text-center">
                          <div className="text-xs text-[var(--fd-ink-3)]">ROAS</div>
                          <div className="font-bold text-emerald-700 dark:text-emerald-400">{overview.latestReport.metrics?.roas?.toFixed(1)}x</div>
                        </div>
                        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2 text-center">
                          <div className="text-xs text-[var(--fd-ink-3)]">Leads</div>
                          <div className="font-bold text-blue-700 dark:text-blue-400">{overview.latestReport.metrics?.leads}</div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          {/* BOARDS SECTION – full width at bottom of overview */}
          <div className="mt-6">
            <ClientBoardsSection clientId={id} />
          </div>
        </>
      )}

      {/* TASKS */}
      {activeTab === 'tasks' && (() => {
        const filteredTasks = filterMonth === 'all' ? tasks : tasks.filter(t => {
          const d = t.deadline || t.createdAt;
          if (!d) return false;
          const date = new Date(d);
          return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}` === filterMonth;
        });
        return (
        <div className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <MonthPicker value={filterMonth === 'all' ? null : filterMonth} onChange={v => setFilterMonth(v)} label="All Months" />
              {filterMonth !== 'all' && (
                <button onClick={() => setFilterMonth('all')} className="text-[11px] px-2 py-1 rounded-lg font-medium" style={{ background: 'var(--fd-surface-sunken)', color: 'var(--fd-ink-3)' }}>
                  Clear filter ×
                </button>
              )}
            </div>
            {isManager && <Button size="sm" onClick={() => setShowTaskModal(true)}><Plus size={14} />Add Task</Button>}
          </div>
          {filteredTasks.length === 0 ? (
            <EmptyState icon={CheckCircle} title="No tasks yet" description={filterMonth === 'all' ? "Create the first task for this client." : "No tasks match this month."}
              action={isManager ? <Button onClick={() => setShowTaskModal(true)}><Plus size={14} />Add Task</Button> : null} />
          ) : (
            <Card>
              <div className="divide-y divide-[var(--fd-border)]">
                {filteredTasks.map(t => (
                  <div key={t._id} className="px-4 sm:px-5 py-3.5">
                    <div className="font-medium text-[var(--fd-ink-1)] text-sm">{t.title}</div>
                    {t.description && <div className="text-xs text-[var(--fd-ink-3)] mt-0.5 truncate">{t.description}</div>}
                    <div className="flex flex-wrap items-center gap-2 mt-1.5">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${getTaskStatusColor(t.status)}`}>{t.status?.replace('_', ' ')}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${getPriorityColor(t.priority)}`}>{t.priority}</span>
                      {t.category && t.category !== 'other' && <span className="text-xs text-[var(--fd-ink-3)]">{CATEGORY_LABELS[t.category]}</span>}
                      {t.assignedTo && <span className="text-xs text-[var(--fd-ink-4)]">→ {t.assignedTo.name}</span>}
                      {t.deadline && <span className="text-xs text-[var(--fd-ink-4)] flex items-center gap-1"><Clock size={11} />{formatDate(t.deadline)}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
        );
      })()}

      {/* UPDATES */}
      {activeTab === 'updates' && (() => {
        const filteredUpdates = filterMonth === 'all' ? updates : updates.filter(u => {
          const d = u.createdAt;
          if (!d) return false;
          const date = new Date(d);
          return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}` === filterMonth;
        });
        return (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <MonthPicker value={filterMonth === 'all' ? null : filterMonth} onChange={v => setFilterMonth(v)} label="All Months" />
              {filterMonth !== 'all' && (
                <button onClick={() => setFilterMonth('all')} className="text-[11px] px-2 py-1 rounded-lg font-medium" style={{ background: 'var(--fd-surface-sunken)', color: 'var(--fd-ink-3)' }}>
                  Clear filter ×
                </button>
              )}
            </div>
            <Button size="sm" onClick={() => setShowUpdateModal(true)}><Plus size={14} />Post Update</Button>
          </div>
          {filteredUpdates.length === 0 ? <EmptyState icon={AlertCircle} title="No updates yet" description={filterMonth === 'all' ? "Post the first update for this client." : "No updates match this month."} /> : (
            <div className="space-y-4">
              {filteredUpdates.map(u => (
                <Card key={u._id} className={u.isPinned ? 'border-brand-200 bg-blue-50/30 dark:bg-blue-900/10' : ''}>
                  <CardContent>
                    <div className="flex items-start gap-3">
                      <Avatar name={u.author?.name} size="sm" className="flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-[var(--fd-ink-1)] text-sm">{u.title}</span>
                          {u.isPinned && <span className="px-2 py-0.5 bg-brand-100 text-brand-700 rounded-full text-xs">📌 Pinned</span>}
                          <span className="px-2 py-0.5 bg-[var(--fd-surface-sunken)] text-[var(--fd-ink-2)] rounded-full text-xs capitalize">{u.type?.replace('_', ' ')}</span>
                        </div>
                        <div className="text-xs text-[var(--fd-ink-3)] mt-0.5">{u.author?.name} · {timeAgo(u.createdAt)}</div>
                        <p className="text-sm text-[var(--fd-ink-2)] mt-2 whitespace-pre-line">{u.content}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
        );
      })()}

      {/* SOCIAL */}
      {activeTab === 'social' && (() => {
        const PLATFORM_ICONS = {
          instagram: <Instagram size={16} className="text-pink-500" />,
          facebook: <Facebook size={16} className="text-blue-600" />,
          youtube: <Youtube size={16} className="text-red-500" />,
          linkedin: <Linkedin size={16} className="text-blue-700" />,
          twitter: <Twitter size={16} className="text-sky-500" />,
          tiktok: <span className="text-xs font-bold text-[var(--fd-ink-1)]">TT</span>,
          google_business: <span className="text-xs font-bold text-emerald-600">G</span>,
        };
        const PLATFORM_BG = {
          instagram: 'bg-pink-50 dark:bg-pink-900/20 border-pink-100 dark:border-pink-800/30',
          facebook: 'bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800/30',
          youtube: 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800/30',
          linkedin: 'bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800/30',
          twitter: 'bg-sky-50 dark:bg-sky-900/20 border-sky-100 dark:border-sky-800/30',
          tiktok: 'bg-[var(--fd-surface-raised)] border-[var(--fd-border)]',
          google_business: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800/30',
        };
        const totals = socialAnalytics?.totals || {};
        const byPlatform = socialAnalytics?.byPlatform || [];
        const topPosts = socialAnalytics?.topPosts || [];

        return (
          <div className="space-y-5">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h3 className="font-semibold text-[var(--fd-ink-1)]">Social Media Analytics</h3>
              <div className="flex gap-1">
                {[7, 30, 90].map(d => (
                  <button key={d} onClick={() => setSocialDays(d)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${socialDays === d ? 'bg-brand-600 text-white' : 'bg-[var(--fd-surface)] border border-[var(--fd-border-strong)] text-[var(--fd-ink-2)] hover:bg-[var(--fd-surface-raised)]'}`}>
                    {d}d
                  </button>
                ))}
              </div>
            </div>
            <Card>
              <CardHeader><h3 className="font-semibold text-[var(--fd-ink-1)] text-sm">Connected Accounts</h3></CardHeader>
              <CardContent>
                {socialAccounts.length === 0 ? (
                  <p className="text-[var(--fd-ink-4)] text-sm text-center py-4">No social accounts connected yet</p>
                ) : (
                  <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {socialAccounts.map(acc => (
                      <div key={acc._id} className={`flex items-center gap-2.5 p-3 rounded-xl border ${PLATFORM_BG[acc.platform] || 'bg-[var(--fd-surface-raised)] border-[var(--fd-border)]'}`}>
                        <div className="w-7 h-7 flex items-center justify-center flex-shrink-0">
                          {PLATFORM_ICONS[acc.platform] || <Globe size={16} />}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-[var(--fd-ink-1)] truncate">{acc.accountName}</div>
                          <div className="text-xs text-[var(--fd-ink-3)] capitalize">{acc.platform.replace('_', ' ')}</div>
                          {acc.followers > 0 && <div className="text-xs text-[var(--fd-ink-4)]">{acc.followers.toLocaleString()} followers</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            {totals.totalPosts > 0 ? (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: 'Total Posts', value: totals.totalPosts || 0, icon: <BarChart2 size={16} className="text-brand-500" />, bg: 'bg-[var(--fd-surface-raised)]' },
                    { label: 'Total Reach', value: (totals.totalReach || 0).toLocaleString(), icon: <Eye size={16} className="text-emerald-500" />, bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
                    { label: 'Total Likes', value: (totals.totalLikes || 0).toLocaleString(), icon: <Heart size={16} className="text-pink-500" />, bg: 'bg-pink-50 dark:bg-pink-900/20' },
                    { label: 'Avg Engagement', value: `${(totals.avgEngagementRate || 0).toFixed(2)}%`, icon: <TrendingUp size={16} className="text-amber-500" />, bg: 'bg-amber-50 dark:bg-amber-900/20' },
                  ].map(m => (
                    <Card key={m.label} className={m.bg}>
                      <CardContent className="pt-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs text-[var(--fd-ink-3)] font-medium">{m.label}</span>
                          {m.icon}
                        </div>
                        <div className="text-xl sm:text-2xl font-bold text-[var(--fd-ink-1)]">{m.value}</div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                {byPlatform.length > 0 && (
                  <Card>
                    <CardHeader><h3 className="font-semibold text-[var(--fd-ink-1)] text-sm">Performance by Platform</h3></CardHeader>
                    <CardContent>
                      <div className="divide-y divide-[var(--fd-border)]">
                        {byPlatform.map(p => (
                          <div key={p._id} className="py-3">
                            <div className="flex items-center gap-3 mb-2">
                              <div className="w-7 h-7 flex items-center justify-center flex-shrink-0">
                                {PLATFORM_ICONS[p._id] || <Globe size={16} />}
                              </div>
                              <div>
                                <div className="text-sm font-medium text-[var(--fd-ink-1)] capitalize">{p._id?.replace('_', ' ')}</div>
                                <div className="text-xs text-[var(--fd-ink-3)]">{p.posts} posts</div>
                              </div>
                            </div>
                            <div className="grid grid-cols-4 gap-2 text-center text-xs ml-10">
                              <div className="bg-[var(--fd-surface-raised)] rounded-lg p-2">
                                <div className="text-[var(--fd-ink-4)]">Reach</div>
                                <div className="font-semibold text-[var(--fd-ink-2)]">{(p.totalReach || 0).toLocaleString()}</div>
                              </div>
                              <div className="bg-[var(--fd-surface-raised)] rounded-lg p-2">
                                <div className="text-[var(--fd-ink-4)]">Likes</div>
                                <div className="font-semibold text-[var(--fd-ink-2)]">{(p.totalLikes || 0).toLocaleString()}</div>
                              </div>
                              <div className="bg-[var(--fd-surface-raised)] rounded-lg p-2">
                                <div className="text-[var(--fd-ink-4)]">Comments</div>
                                <div className="font-semibold text-[var(--fd-ink-2)]">{(p.totalComments || 0).toLocaleString()}</div>
                              </div>
                              <div className="bg-[var(--fd-surface-raised)] rounded-lg p-2">
                                <div className="text-[var(--fd-ink-4)]">Eng.</div>
                                <div className="font-semibold text-emerald-600">{(p.avgEngagementRate || 0).toFixed(2)}%</div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
                {topPosts.length > 0 && (
                  <Card>
                    <CardHeader><h3 className="font-semibold text-[var(--fd-ink-1)] text-sm">Top Performing Posts</h3></CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {topPosts.map(post => (
                          <div key={post._id} className="flex items-start gap-3 p-3 bg-[var(--fd-surface-raised)] rounded-xl">
                            <div className="w-7 h-7 flex items-center justify-center flex-shrink-0 mt-0.5">
                              {PLATFORM_ICONS[post.platform] || <Globe size={16} />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2 mb-1">
                                <span className="text-xs font-medium text-[var(--fd-ink-2)] capitalize">{post.platform?.replace('_', ' ')}</span>
                                <span className="px-2 py-0.5 bg-[var(--fd-surface)] border border-[var(--fd-border)] rounded-full text-xs text-[var(--fd-ink-3)] capitalize">{post.contentType}</span>
                                {post.publishedAt && <span className="text-xs text-[var(--fd-ink-4)]">{timeAgo(post.publishedAt)}</span>}
                              </div>
                              {post.caption && <p className="text-xs text-[var(--fd-ink-2)] line-clamp-2">{post.caption}</p>}
                              <div className="flex flex-wrap items-center gap-2 mt-2">
                                <span className="flex items-center gap-1 text-xs text-[var(--fd-ink-3)]"><Heart size={11} className="text-pink-400" />{(post.metrics?.likes || 0).toLocaleString()}</span>
                                <span className="flex items-center gap-1 text-xs text-[var(--fd-ink-3)]"><MessageCircle size={11} className="text-blue-400" />{(post.metrics?.comments || 0).toLocaleString()}</span>
                                <span className="flex items-center gap-1 text-xs text-[var(--fd-ink-3)]"><Share2 size={11} className="text-emerald-400" />{(post.metrics?.shares || 0).toLocaleString()}</span>
                                <span className="flex items-center gap-1 text-xs text-[var(--fd-ink-3)]"><Eye size={11} className="text-amber-400" />{(post.metrics?.reach || 0).toLocaleString()}</span>
                                {post.metrics?.engagementRate > 0 && (
                                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">
                                    {post.metrics.engagementRate.toFixed(2)}% eng.
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            ) : (
              <Card>
                <CardContent className="text-center py-12">
                  <BarChart2 size={40} className="mx-auto text-[var(--fd-border)] mb-3" />
                  <p className="text-[var(--fd-ink-3)] font-medium">No published posts in the last {socialDays} days</p>
                  <p className="text-[var(--fd-ink-4)] text-sm mt-1">Analytics will appear here once posts are published.</p>
                </CardContent>
              </Card>
            )}
            {socialPosts.length > 0 && (
              <Card>
                <CardHeader><h3 className="font-semibold text-[var(--fd-ink-1)] text-sm">Recent Posts</h3></CardHeader>
                <CardContent>
                  <div className="divide-y divide-[var(--fd-border)]">
                    {socialPosts.map(post => (
                      <div key={post._id} className="flex items-center gap-3 py-3">
                        <div className="w-7 h-7 flex items-center justify-center flex-shrink-0">
                          {PLATFORM_ICONS[post.platform] || <Globe size={16} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-[var(--fd-ink-2)] truncate">{post.caption || '(no caption)'}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-[var(--fd-ink-4)] capitalize">{post.contentType}</span>
                            {post.assignedTo?.name && <><span className="text-[var(--fd-ink-5)]">·</span><span className="text-xs text-[var(--fd-ink-4)]">by {post.assignedTo.name}</span></>}
                          </div>
                        </div>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium capitalize flex-shrink-0 ${
                          post.status === 'published' ? 'bg-emerald-100 text-emerald-700'
                          : post.status === 'scheduled' ? 'bg-blue-100 text-blue-700'
                          : post.status === 'draft' ? 'bg-[var(--fd-surface-sunken)] text-[var(--fd-ink-2)]'
                          : 'bg-red-100 text-red-600'
                        }`}>{post.status}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        );
      })()}

      {/* FILES */}
      {activeTab === 'files' && (
        <div className="space-y-4">
          {files.length === 0 ? <EmptyState icon={AlertCircle} title="No files yet" description="Upload files for this client." /> : (
            <Card>
              <div className="divide-y divide-[var(--fd-border)]">
                {files.map(f => (
                  <div key={f._id} className="flex items-center gap-3 px-4 sm:px-5 py-3.5">
                    <div className="text-2xl flex-shrink-0">{f.mimeType?.includes('pdf') ? '📄' : f.mimeType?.includes('image') ? '🖼️' : f.mimeType?.includes('zip') ? '📦' : '📎'}</div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-[var(--fd-ink-1)] text-sm truncate">{f.name}</div>
                      <div className="text-xs text-[var(--fd-ink-3)]">{f.uploadedBy?.name} · {timeAgo(f.createdAt)}</div>
                    </div>
                    <a href={f.url} target="_blank" rel="noopener noreferrer" className="text-brand-600 text-xs font-medium hover:underline flex-shrink-0">Download</a>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* REPORTS */}
      {activeTab === 'reports' && (
        <div className="space-y-4">
          {reports.length === 0 ? <EmptyState icon={AlertCircle} title="No reports yet" description="Create the first performance report." /> : (
            <div className="grid gap-4">
              {reports.map(r => (
                <Card key={r._id}>
                  <CardContent>
                    <div className="flex items-start justify-between flex-wrap gap-2 mb-3">
                      <div>
                        <div className="font-semibold text-[var(--fd-ink-1)]">{r.title}</div>
                        <div className="text-xs text-[var(--fd-ink-3)]">{formatDate(r.startDate)} — {formatDate(r.endDate)}</div>
                      </div>
                      <span className="px-2.5 py-0.5 bg-[var(--fd-surface-sunken)] text-[var(--fd-ink-2)] rounded-full text-xs capitalize">{r.period}</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {[
                        { label: 'Ad Spend', value: formatCurrency(r.metrics?.adSpend), color: 'bg-[var(--fd-surface-raised)]' },
                        { label: 'Revenue', value: formatCurrency(r.metrics?.revenue), color: 'bg-emerald-50 dark:bg-emerald-900/20' },
                        { label: 'ROAS', value: `${r.metrics?.roas?.toFixed(1)}x`, color: 'bg-blue-50 dark:bg-blue-900/20' },
                        { label: 'Leads', value: r.metrics?.leads, color: 'bg-purple-50 dark:bg-purple-900/20' },
                      ].map(m => (
                        <div key={m.label} className={`${m.color} rounded-lg p-3 text-center`}>
                          <div className="text-xs text-[var(--fd-ink-3)]">{m.label}</div>
                          <div className="font-bold text-[var(--fd-ink-1)] mt-0.5">{m.value}</div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TEAM MANAGEMENT */}
      {activeTab === 'team' && isManager && (
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <h3 className="font-semibold text-[var(--fd-ink-1)] text-sm">Account Manager</h3>
              <p className="text-xs text-[var(--fd-ink-4)] mt-0.5">Primary point of contact responsible for this client</p>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                {client.accountManager ? (
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Avatar name={client.accountManager.name} size="md" />
                    <div className="min-w-0">
                      <div className="font-medium text-[var(--fd-ink-1)] text-sm">{client.accountManager.name}</div>
                      <div className="text-xs text-[var(--fd-ink-3)]">{client.accountManager.jobTitle || ROLE_LABELS[client.accountManager.role]}</div>
                      <div className="text-xs text-[var(--fd-ink-4)]">{client.accountManager.email}</div>
                    </div>
                  </div>
                ) : (
                  <p className="text-[var(--fd-ink-4)] text-sm flex-1">No account manager assigned</p>
                )}
                <div className="w-full sm:w-auto sm:min-w-[220px]">
                  <Select value={client.accountManager?._id || ''} onChange={e => handleSetAccountManager(e.target.value)} disabled={savingTeam}>
                    <option value="">— Change Account Manager —</option>
                    {eligibleManagers.map(m => (
                      <option key={m._id} value={m._id}>{m.name} ({ROLE_LABELS[m.role] || m.role})</option>
                    ))}
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h3 className="font-semibold text-[var(--fd-ink-1)] text-sm">Team Members</h3>
                  <p className="text-xs text-[var(--fd-ink-4)] mt-0.5">People working on this client's account</p>
                </div>
                <Button size="sm" onClick={() => { setAddMemberId(''); setShowAddMemberModal(true); }}>
                  <UserPlus size={14} />Add Member
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {!client.teamMembers?.length ? (
                <div className="text-center py-8">
                  <Users size={32} className="mx-auto text-[var(--fd-border)] mb-2" />
                  <p className="text-[var(--fd-ink-4)] text-sm">No team members assigned yet</p>
                </div>
              ) : (
                <div className="divide-y divide-[var(--fd-border)]">
                  {client.teamMembers.map(m => (
                    <div key={m._id} className="flex items-center gap-3 py-3">
                      <Avatar name={m.name} size="md" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-[var(--fd-ink-1)] text-sm">{m.name}</div>
                        <div className="text-xs text-[var(--fd-ink-3)]">{m.jobTitle || ROLE_LABELS[m.role] || m.role}</div>
                        {m.email && <div className="text-xs text-[var(--fd-ink-4)] truncate">{m.email}</div>}
                      </div>
                      <span className="hidden sm:inline-flex px-2.5 py-1 bg-[var(--fd-surface-sunken)] text-[var(--fd-ink-2)] rounded-full text-xs font-medium flex-shrink-0">
                        {ROLE_LABELS[m.role] || m.role}
                      </span>
                      <button onClick={() => handleRemoveTeamMember(m._id)} disabled={savingTeam}
                        className="p-1.5 text-[var(--fd-ink-4)] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-40 flex-shrink-0">
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/30 rounded-xl p-4 text-sm text-amber-700 dark:text-amber-300">
            <strong>Access Note:</strong> Assigned team members will only see this client's tasks, social posts, and files. Removing a member immediately revokes their access.
          </div>
        </div>
      )}

      {/* CALENDAR TAB */}
      {activeTab === 'calendar' && (
        <ClientCalendarTab
          clientId={id}
          events={calendarEvents}
          setEvents={setCalendarEvents}
          month={calendarMonth}
          setMonth={setCalendarMonth}
        />
      )}

      {/* GMB PANEL TAB */}
      {activeTab === 'gmb' && (
        <GmbPanelTab clientId={id} client={client} />
      )}

      {/* Modals */}
      <Modal isOpen={showAddMemberModal} onClose={() => setShowAddMemberModal(false)} title="Add Team Member"
        footer={<div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setShowAddMemberModal(false)}>Cancel</Button><Button loading={savingTeam} onClick={handleAddTeamMember} disabled={!addMemberId}>Add to Client</Button></div>}
      >
        <div className="space-y-4">
          <p className="text-sm text-[var(--fd-ink-2)]">Assign a team member to <strong>{client.company}</strong>.</p>
          <Select label="Team Member" value={addMemberId} onChange={e => setAddMemberId(e.target.value)}>
            <option value="">— Select a team member —</option>
            {availableToAdd.map(m => (
              <option key={m._id} value={m._id}>{m.name} — {m.jobTitle || ROLE_LABELS[m.role] || m.role}</option>
            ))}
          </Select>
          {availableToAdd.length === 0 && <p className="text-xs text-[var(--fd-ink-4)] text-center">All team members are already assigned.</p>}
        </div>
      </Modal>

      <Modal isOpen={showUpdateModal} onClose={() => setShowUpdateModal(false)} title="Post Update"
        footer={<div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setShowUpdateModal(false)}>Cancel</Button><Button loading={saving} onClick={handleAddUpdate}>Post Update</Button></div>}
      >
        <div className="space-y-4">
          <Input label="Title" value={updateForm.title} onChange={e => setUpdateForm(p => ({ ...p, title: e.target.value }))} placeholder="Update title..." />
          <Select label="Type" value={updateForm.type} onChange={e => setUpdateForm(p => ({ ...p, type: e.target.value }))}>
            {updateTypes.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>)}
          </Select>
          <Textarea label="Content" value={updateForm.content} onChange={e => setUpdateForm(p => ({ ...p, content: e.target.value }))} placeholder="Write your update..." rows={5} />
        </div>
      </Modal>

      <Modal isOpen={showTaskModal} onClose={() => setShowTaskModal(false)} title="Add Task"
        footer={<div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setShowTaskModal(false)}>Cancel</Button><Button loading={saving} onClick={handleAddTask}>Create Task</Button></div>}
      >
        <div className="space-y-4">
          <Input label="Title" value={taskForm.title} onChange={e => setTaskForm(p => ({ ...p, title: e.target.value }))} required />
          <Textarea label="Description" value={taskForm.description} onChange={e => setTaskForm(p => ({ ...p, description: e.target.value }))} rows={3} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select label="Category" value={taskForm.category} onChange={e => setTaskForm(p => ({ ...p, category: e.target.value }))}>
              {Object.entries(CATEGORY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
            <Select label="Priority" value={taskForm.priority} onChange={e => setTaskForm(p => ({ ...p, priority: e.target.value }))}>
              {['low', 'medium', 'high', 'urgent'].map(v => <option key={v} value={v}>{v.charAt(0).toUpperCase() + v.slice(1)}</option>)}
            </Select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="Deadline" type="date" value={taskForm.deadline} onChange={e => setTaskForm(p => ({ ...p, deadline: e.target.value }))} />
            <Select label="Assign To" value={taskForm.assignedTo} onChange={e => setTaskForm(p => ({ ...p, assignedTo: e.target.value }))}>
              <option value="">Unassigned</option>
              {client.teamMembers?.length > 0 && (
                <optgroup label="This Client's Team">
                  {client.accountManager && <option value={client.accountManager._id}>{client.accountManager.name} (AM)</option>}
                  {client.teamMembers.map(m => <option key={m._id} value={m._id}>{m.name}</option>)}
                </optgroup>
              )}
              <optgroup label="All Team Members">
                {allTeamMembers.filter(m => {
                  const inClientTeam = client.teamMembers?.some(tm => String(tm._id) === String(m._id));
                  const isAM = String(client.accountManager?._id) === String(m._id);
                  return !inClientTeam && !isAM;
                }).map(m => <option key={m._id} value={m._id}>{m.name}</option>)}
              </optgroup>
            </Select>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={taskForm.isClientVisible} onChange={e => setTaskForm(p => ({ ...p, isClientVisible: e.target.checked }))} className="rounded" />
            <span className="text-sm text-[var(--fd-ink-2)]">Visible to client</span>
          </label>
        </div>
      </Modal>

      {isManager && (
        <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Edit Client"
          footer={<div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setShowEditModal(false)}>Cancel</Button><Button loading={saving} onClick={handleSaveEdit}>Save Changes</Button></div>}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input label="Contact Name" value={editForm.name || ''} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))} />
              <Input label="Company" value={editForm.company || ''} onChange={e => setEditForm(p => ({ ...p, company: e.target.value }))} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input label="Email" type="email" value={editForm.email || ''} onChange={e => setEditForm(p => ({ ...p, email: e.target.value }))} />
              <Input label="Phone" value={editForm.phone || ''} onChange={e => setEditForm(p => ({ ...p, phone: e.target.value }))} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input label="Website" value={editForm.website || ''} onChange={e => setEditForm(p => ({ ...p, website: e.target.value }))} />
              <Input label="Industry" value={editForm.industry || ''} onChange={e => setEditForm(p => ({ ...p, industry: e.target.value }))} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Select label="Status" value={editForm.status || ''} onChange={e => setEditForm(p => ({ ...p, status: e.target.value }))}>
                {['active', 'inactive', 'onboarding', 'paused', 'churned'].map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </Select>
              <Select label="Plan" value={editForm.plan || ''} onChange={e => setEditForm(p => ({ ...p, plan: e.target.value }))}>
                {[['3_month','3 Month'],['6_month','6 Month'],['1_year','1 Year']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </Select>
            </div>
            {user?.role === 'admin' && (
              <Input label="Monthly Budget" type="number" value={editForm.monthlyBudget || ''} onChange={e => setEditForm(p => ({ ...p, monthlyBudget: e.target.value }))} />
            )}
            <Textarea label="Notes" value={editForm.notes || ''} onChange={e => setEditForm(p => ({ ...p, notes: e.target.value }))} rows={3} />
          </div>
        </Modal>
      )}
    </div>
  );
}