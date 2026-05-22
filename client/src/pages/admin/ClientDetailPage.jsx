import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Edit3, MessageSquare, Mail, Phone, Globe, Calendar,
  DollarSign, Plus, CheckCircle, Clock, AlertCircle, Users, X, UserPlus,
  Instagram, Facebook, Youtube, Linkedin, Twitter, TrendingUp, Eye,
  Heart, MessageCircle, Share2, BarChart2, IndianRupee,
  ChevronLeft, ChevronRight, Star, MapPin, ThumbsUp, Trash2,
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

// ─── Client-scoped mini calendar ─────────────────────────────────────────────
function ClientCalendarTab({ clientId, events, setEvents, month, setMonth }) {
  const toast = useToast ? useToast() : null;
  const [modal, setModal]   = useState(null); // { mode: 'new'|'view'|'edit', event?, date? }
  const [saving, setSaving] = useState(false);
  const [form, setForm]     = useState({});

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
        const { data } = await api.post('/calendar', { ...form, clientId });
        setEvents(prev => [...prev, data.event]);
      } else {
        const { data } = await api.put(`/calendar/${form._id}`, form);
        setEvents(prev => prev.map(e => e._id === form._id ? data.event : e));
      }
      setModal(null);
    } catch (err) {
      if (toast) toast({ type: 'error', title: 'Failed to save' });
    } finally { setSaving(false); }
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
                    return (
                      <button key={ev._id} onClick={e => { e.stopPropagation(); openView(ev); }}
                        className="w-full text-left text-[10px] font-semibold px-1.5 py-[2px] rounded truncate"
                        style={{ background: c.light, color: c.text }}>
                        {ev.title}
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

export default function ClientDetailPage() {
  const { id } = useParams();
  const { user } = useAuthStore();
  const isManager = ['admin', 'manager'].includes(user?.role);

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
      api.get(`/social/analytics?clientId=${id}&days=${socialDays}`)
        .then(r => setSocialAnalytics(r.data.analytics || null))
        .catch(() => {});
    }
  }, [socialDays, activeTab]);

  useEffect(() => {
    if (activeTab === 'calendar' && id) {
      const from = startOfWeek(startOfMonth(calendarMonth), { weekStartsOn: 1 }).toISOString();
      const to   = endOfWeek(endOfMonth(calendarMonth),   { weekStartsOn: 1 }).toISOString();
      api.get(`/calendar?from=${from}&to=${to}&clientId=${id}`)
        .then(r => setCalendarEvents(r.data.events || []))
        .catch(() => {});
    }
  }, [activeTab, calendarMonth, id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [ovRes, taskRes, updRes, fileRes, repRes, socialAccRes, socialAnaRes, socialPostRes] = await Promise.all([
        api.get(`/clients/${id}/overview`),
        api.get(`/tasks?clientId=${id}&limit=50`),
        api.get(`/updates?clientId=${id}&limit=20`),
        api.get(`/files?clientId=${id}&limit=20`),
        api.get(`/reports?clientId=${id}&limit=10`),
        api.get(`/social/accounts?clientId=${id}`),
        api.get(`/social/analytics?clientId=${id}&days=${socialDays}`),
        api.get(`/social/posts?clientId=${id}&limit=10`),
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
          {/* Top row: avatar + name + status badges */}
          <div className="flex items-start gap-3 flex-wrap">
            <Avatar name={client.company} size="md" className="flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <h1 className="text-lg sm:text-xl font-bold text-[var(--fd-ink-1)] truncate">{client.company}</h1>
              <p className="text-[var(--fd-ink-3)] text-sm">{client.name} · {client.industry}</p>
            </div>
            <div className="flex flex-wrap gap-1.5 items-center">
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${getStatusColor(client.status)}`}>{client.status}</span>
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${PLAN_COLORS[client.plan]}`}>{PLAN_LABELS[client.plan]}</span>
            </div>
          </div>
          {/* Action buttons row */}
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
                  <div className="flex items-center gap-2 text-[var(--fd-ink-2)]"><IndianRupee size={14} className="text-[var(--fd-ink-4)] flex-shrink-0" />{formatCurrency(client.monthlyBudget)}/mo</div>
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
      )}

      {/* TASKS */}
      {activeTab === 'tasks' && (
        <div className="space-y-3">
          {isManager && <div className="flex justify-end"><Button size="sm" onClick={() => setShowTaskModal(true)}><Plus size={14} />Add Task</Button></div>}
          {tasks.length === 0 ? (
            <EmptyState icon={CheckCircle} title="No tasks yet" description="Create the first task for this client."
              action={isManager ? <Button onClick={() => setShowTaskModal(true)}><Plus size={14} />Add Task</Button> : null} />
          ) : (
            <Card>
              <div className="divide-y divide-[var(--fd-border)]">
                {tasks.map(t => (
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
      )}

      {/* UPDATES */}
      {activeTab === 'updates' && (
        <div className="space-y-4">
          <div className="flex justify-end"><Button size="sm" onClick={() => setShowUpdateModal(true)}><Plus size={14} />Post Update</Button></div>
          {updates.length === 0 ? <EmptyState icon={AlertCircle} title="No updates yet" description="Post the first update for this client." /> : (
            <div className="space-y-4">
              {updates.map(u => (
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
      )}

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
            {/* Days filter */}
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

            {/* Connected Accounts */}
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

            {/* Analytics Summary */}
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

                {/* By Platform — scrollable on mobile */}
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

                {/* Top Performing Posts */}
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

            {/* Recent Posts List */}
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
                {Object.entries(PLAN_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </Select>
            </div>
            <Input label="Monthly Budget" type="number" value={editForm.monthlyBudget || ''} onChange={e => setEditForm(p => ({ ...p, monthlyBudget: e.target.value }))} />
            <Textarea label="Notes" value={editForm.notes || ''} onChange={e => setEditForm(p => ({ ...p, notes: e.target.value }))} rows={3} />
          </div>
        </Modal>
      )}
    </div>
  );
}