import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Mail, Phone, Shield, Calendar, CheckCircle,
  Clock, AlertCircle, Users, Building2, BarChart2, Edit3, X, Save, Camera,
  FileText, Upload, Trash2, Download, File, Image as ImageIcon, ExternalLink,
  CalendarDays, ChevronLeft, ChevronRight, Search, Filter, Pencil, AlertTriangle,
  CheckCheck, Loader2, XCircle, Star
} from 'lucide-react';
import api from '../../lib/api';
import useAuthStore from '../../context/authStore';
import { Avatar, Card, CardHeader, CardContent, Spinner, EmptyState, Badge } from '../../components/shared/LoadingScreen';
import { Button, Modal, Input, Select, Textarea, useToast } from '../../components/ui/index';
import { formatDate, getTaskStatusColor, getPriorityColor, timeAgo, getStatusColor, PLAN_LABELS, PLAN_COLORS } from '../../lib/utils';

const ROLE_LABELS = {
  admin: 'Admin', manager: 'Project Manager',
  performance_marketer: 'Performance Marketer',
  social_media_manager: 'Social Media Manager',
  video_editor: 'Video Editor', graphic_designer: 'Graphic Designer',
  copywriter: 'Copywriter', client: 'Client',
};

const ROLE_COLORS = {
  admin: 'bg-red-100 text-red-700', manager: 'bg-purple-100 text-purple-700',
  performance_marketer: 'bg-blue-100 text-blue-700',
  social_media_manager: 'bg-pink-100 text-pink-700',
  video_editor: 'bg-orange-100 text-orange-700',
  graphic_designer: 'bg-indigo-100 text-indigo-700',
  copywriter: 'bg-teal-100 text-teal-700',
};

const CATEGORY_LABELS = {
  paid_ads: '📊 Paid Ads', social_media: '📱 Social Media',
  video_editing: '🎬 Video Editing', graphic_design: '🎨 Graphic Design',
  copywriting: '✍️ Copywriting', reporting: '📋 Reporting',
  strategy: '🧠 Strategy', client_request: '💬 Client Request', other: '📌 Other',
};

const DOC_TYPE_LABELS = {
  aadhaar: 'Aadhaar Card', pan: 'PAN Card', passport: 'Passport',
  driving_license: 'Driving License', other: 'Other',
};

const ATT_STATUS = {
  present:  { label: 'Present',  dot: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-700', cal: 'bg-emerald-500' },
  late:     { label: 'Late',     dot: 'bg-amber-400',   badge: 'bg-amber-100 text-amber-700',    cal: 'bg-amber-400'   },
  absent:   { label: 'Absent',   dot: 'bg-red-400',     badge: 'bg-red-100 text-red-600',        cal: 'bg-red-400'     },
  on_leave: { label: 'On Leave', dot: 'bg-blue-400',    badge: 'bg-blue-100 text-blue-700',      cal: 'bg-blue-400'    },
};

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const SHORT_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

const STATUSES = ['today', 'pending', 'in_progress', 'review', 'completed', 'cancelled'];
const STATUS_LABELS = {
  today: 'Today', pending: 'Pending', in_progress: 'In Progress',
  review: 'Review', completed: 'Completed', cancelled: 'Cancelled',
};
const STATUS_STYLE = {
  today:       { background: 'rgba(245,158,11,0.12)', color: '#f59e0b' },
  pending:     { background: 'var(--fd-surface-sunken)', color: 'var(--fd-ink-3)' },
  in_progress: { background: 'var(--fd-sidebar-active)', color: 'var(--fd-sidebar-link-active)' },
  review:      { background: 'rgba(126,34,206,0.12)', color: '#a855f7' },
  completed:   { background: 'rgba(42,125,79,0.12)', color: '#22c55e' },
  cancelled:   { background: 'rgba(185,28,28,0.12)', color: '#ef4444' },
};
const PRIORITY_STYLE = {
  low:    { background: 'var(--fd-surface-sunken)', color: 'var(--fd-ink-3)' },
  medium: { background: 'var(--fd-sidebar-active)', color: 'var(--fd-sidebar-link-active)' },
  high:   { background: 'rgba(146,96,10,0.12)', color: '#f59e0b' },
  urgent: { background: 'rgba(185,28,28,0.12)', color: '#ef4444' },
};

function DocIcon({ fileType, className = '' }) {
  if (fileType === 'image') return <ImageIcon size={16} className={className} />;
  if (fileType === 'pdf') return <FileText size={16} className={className} />;
  return <File size={16} className={className} />;
}

function fmtTime(dt) {
  if (!dt) return '—';
  return new Date(dt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

// ─── Calendar View ────────────────────────────────────────────────────────────
const ATT_STYLE = {
  present:  { bg: 'bg-emerald-500', ring: 'ring-emerald-300', text: 'text-white', glow: 'shadow-emerald-200' },
  late:     { bg: 'bg-amber-400',   ring: 'ring-amber-200',   text: 'text-white', glow: 'shadow-amber-200'   },
  absent:   { bg: 'bg-red-400',     ring: 'ring-red-200',     text: 'text-white', glow: 'shadow-red-200'     },
  on_leave: { bg: 'bg-blue-400',    ring: 'ring-blue-200',    text: 'text-white', glow: 'shadow-blue-200'    },
  wfh:      { bg: 'bg-violet-400',  ring: 'ring-violet-200',  text: 'text-white', glow: 'shadow-violet-200'  },
};

function AttCalendar({ records }) {
  const [hoveredKey, setHoveredKey] = useState(null);

  const byDate = {};
  records.forEach(r => { byDate[r.date] = r; });

  const sample = records[0];
  if (!sample) return null;
  const [yr, mo] = sample.date.split('-').map(Number);

  const firstDay = new Date(yr, mo - 1, 1).getDay();
  const daysInMonth = new Date(yr, mo, 0).getDate();
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${yr}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    cells.push({ day: d, key, record: byDate[key] || null });
  }

  const hoveredRecord = hoveredKey ? byDate[hoveredKey] : null;
  const hoveredSt = hoveredRecord?.status;
  const hoveredStyle = ATT_STYLE[hoveredSt];

  return (
    <div className="select-none">
      <div className="grid grid-cols-7 mb-2">
        {['S','M','T','W','T','F','S'].map((d, i) => (
          <div key={i} className="text-center text-[9px] font-bold text-[var(--fd-ink-4)] uppercase tracking-widest py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-[3px]">
        {cells.map((cell, i) => {
          if (!cell) return <div key={`e-${i}`} style={{height:'34px'}} />;
          const st = cell.record?.status;
          const sty = ATT_STYLE[st];
          const isToday = cell.key === today;
          const isHovered = hoveredKey === cell.key;
          return (
            <div
              key={cell.key}
              onMouseEnter={() => setHoveredKey(cell.key)}
              onMouseLeave={() => setHoveredKey(null)}
              style={{height:'34px'}}
              className={[
                'relative rounded-md flex flex-col items-center justify-center cursor-default transition-all duration-150',
                sty
                  ? `${sty.bg} ${sty.text} shadow-sm ${isHovered ? 'scale-110 shadow-md z-10 ring-2 ' + sty.ring : ''}`
                  : `bg-[var(--fd-surface-raised)] text-[var(--fd-ink-4)] ${isHovered ? 'scale-105 z-10' : ''}`,
                isToday && !sty ? 'ring-2 ring-brand-400 ring-offset-1 text-brand-600 font-bold' : '',
                isToday && sty ? 'ring-2 ring-offset-1 ring-white/60' : '',
              ].join(' ')}
            >
              <span className="text-[10px] font-semibold leading-none">{cell.day}</span>
              {cell.record?.workHours > 0 && (
                <span className="text-[7px] font-medium opacity-75 leading-none mt-[2px]">{cell.record.workHours}h</span>
              )}
            </div>
          );
        })}
      </div>
      <div className={`mt-3 rounded-xl px-3 py-2.5 transition-all duration-200 min-h-[38px] flex items-center gap-3
        ${hoveredRecord
          ? `${hoveredStyle?.bg || 'bg-[var(--fd-surface-raised)]'} bg-opacity-10 border border-opacity-20 ${hoveredStyle ? 'border-current' : 'border-[var(--fd-border)]'}`
          : 'bg-[var(--fd-surface-raised)] border border-[var(--fd-border)]'
        }`}>
        {hoveredRecord ? (
          <>
            <span className={`w-2 h-2 rounded-full shrink-0 ${hoveredStyle?.bg || 'bg-[var(--fd-ink-4)]'}`} />
            <span className="text-xs font-semibold text-[var(--fd-ink-1)]">{hoveredKey}</span>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ATT_STATUS[hoveredSt]?.badge || 'bg-[var(--fd-surface)] text-[var(--fd-ink-3)]'}`}>
              {ATT_STATUS[hoveredSt]?.label || hoveredRecord.status}
            </span>
            {hoveredRecord.checkInTime && (
              <span className="text-xs text-[var(--fd-ink-3)] ml-auto">
                {fmtTime(hoveredRecord.checkInTime)}
                {hoveredRecord.checkOutTime ? ` → ${fmtTime(hoveredRecord.checkOutTime)}` : ''}
                {hoveredRecord.workHours > 0 ? ` · ${hoveredRecord.workHours}h` : ''}
              </span>
            )}
          </>
        ) : hoveredKey ? (
          <>
            <span className="w-2 h-2 rounded-full bg-[var(--fd-ink-4)] shrink-0" />
            <span className="text-xs font-semibold text-[var(--fd-ink-1)]">{hoveredKey}</span>
            <span className="text-xs text-[var(--fd-ink-4)]">No record</span>
          </>
        ) : (
          <span className="text-[11px] text-[var(--fd-ink-4)] w-full text-center">Hover a day to see details</span>
        )}
      </div>
      <div className="flex items-center gap-3 mt-3 flex-wrap">
        {Object.entries(ATT_STATUS).map(([k, cfg]) => (
          <div key={k} className="flex items-center gap-1 text-[10px] text-[var(--fd-ink-4)] font-medium">
            <span className={`w-2 h-2 rounded-sm inline-block ${ATT_STYLE[k]?.bg || 'bg-[var(--fd-ink-4)]'}`} />
            {cfg.label}
          </div>
        ))}
        <div className="flex items-center gap-1 text-[10px] text-[var(--fd-ink-4)] font-medium">
          <span className="w-2 h-2 rounded-sm inline-block bg-[var(--fd-surface-raised)] border border-[var(--fd-border)]" />
          No data
        </div>
      </div>
    </div>
  );
}

// ─── Attendance Tab ────────────────────────────────────────────────────────────
function AttendanceTab({ memberId }) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [view, setView] = useState('calendar');

  const fetchAttendance = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/users/${memberId}/attendance?month=${month}&year=${year}`);
      setData(res.data);
    } catch (e) {
      setError(e?.response?.data?.message || 'Failed to load attendance data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAttendance(); }, [memberId, month, year]);

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    const nowM = now.getMonth() + 1;
    const nowY = now.getFullYear();
    if (year > nowY || (year === nowY && month >= nowM)) return;
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };
  const isAtPresent = year === now.getFullYear() && month === now.getMonth() + 1;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-1">
          <button onClick={prevMonth} className="p-1.5 rounded-lg text-[var(--fd-ink-3)] hover:bg-[var(--fd-surface-raised)] transition-colors">
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-semibold text-[var(--fd-ink-1)] min-w-[120px] text-center">
            {MONTHS[month - 1]} {year}
          </span>
          <button onClick={nextMonth} disabled={isAtPresent}
            className="p-1.5 rounded-lg text-[var(--fd-ink-3)] hover:bg-[var(--fd-surface-raised)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
            <ChevronRight size={16} />
          </button>
        </div>
        <div className="flex items-center gap-1 bg-[var(--fd-surface-raised)] rounded-lg p-1">
          {[['calendar', '📅 Calendar'], ['table', '📋 Table']].map(([v, label]) => (
            <button key={v} onClick={() => setView(v)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                view === v
                  ? 'bg-[var(--fd-surface)] text-[var(--fd-ink-1)] shadow-sm'
                  : 'text-[var(--fd-ink-3)] hover:text-[var(--fd-ink-2)]'
              }`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading && <div className="flex items-center justify-center py-16"><Spinner size="lg" /></div>}
      {!loading && error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <AlertCircle size={16} className="shrink-0" />{error}
        </div>
      )}
      {!loading && !error && data && !data.found && (
        <EmptyState icon={CalendarDays} title="No attendance account linked"
          description="No attendance app account was found matching this member's email." />
      )}
      {!loading && !error && data?.found && (
        <>
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'Present', value: data.summary.present,              color: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
              { label: 'Late',    value: data.summary.late,                 color: 'bg-amber-50 border-amber-200 text-amber-700'       },
              { label: 'Absent',  value: data.summary.absent,               color: 'bg-red-50 border-red-200 text-red-600'             },
              { label: 'Hrs',     value: `${data.summary.totalWorkHours}h`, color: 'bg-[var(--fd-surface-raised)] border-[var(--fd-border)] text-[var(--fd-ink-2)]' },
            ].map(s => (
              <div key={s.label} className={`border rounded-xl p-3 text-center ${s.color}`}>
                <div className="text-lg font-bold">{s.value}</div>
                <div className="text-[10px] font-semibold mt-0.5 uppercase tracking-wide opacity-80">{s.label}</div>
              </div>
            ))}
          </div>
          {view === 'calendar' && (
            <Card>
              <CardContent className="pt-4">
                {data.records.length === 0
                  ? <p className="text-center text-[var(--fd-ink-4)] text-sm py-6">No records for {SHORT_MONTHS[month-1]} {year}</p>
                  : <AttCalendar records={data.records} />
                }
              </CardContent>
            </Card>
          )}
          {view === 'table' && (
            data.records.length === 0
              ? <EmptyState icon={CalendarDays} title="No records" description={`No attendance for ${SHORT_MONTHS[month-1]} ${year}.`} />
              : (
                <Card>
                  <CardHeader>
                    <h3 className="font-semibold text-[var(--fd-ink-1)] text-sm">
                      Daily Records
                      <span className="ml-2 text-xs text-[var(--fd-ink-4)] font-normal">({data.records.length} entries)</span>
                    </h3>
                  </CardHeader>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[var(--fd-border)] bg-[var(--fd-surface-raised)]">
                          {['Date','Status','Check In','Check Out','Work Hrs'].map(h => (
                            <th key={h} className="text-left px-5 py-2.5 text-xs font-semibold text-[var(--fd-ink-3)] uppercase tracking-wide whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--fd-border)]">
                        {data.records.map(r => {
                          const cfg = ATT_STATUS[r.status];
                          return (
                            <tr key={r._id} className="hover:bg-[var(--fd-surface-raised)] transition-colors">
                              <td className="px-5 py-3 text-[var(--fd-ink-2)] font-medium whitespace-nowrap">{r.date}</td>
                              <td className="px-5 py-3">
                                {cfg
                                  ? <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.badge}`}>
                                      <span className={`w-1.5 h-1.5 rounded-full inline-block ${cfg.dot}`} />
                                      {cfg.label}
                                    </span>
                                  : <span className="text-[var(--fd-ink-4)] text-xs">{r.status}</span>
                                }
                              </td>
                              <td className="px-5 py-3 text-[var(--fd-ink-3)] text-xs whitespace-nowrap">{fmtTime(r.checkInTime)}</td>
                              <td className="px-5 py-3 text-[var(--fd-ink-3)] text-xs whitespace-nowrap">
                                {fmtTime(r.checkOutTime)}
                                {r.autoCheckout && <span className="ml-1 text-[10px] text-[var(--fd-ink-4)] italic">(auto)</span>}
                              </td>
                              <td className="px-5 py-3 text-[var(--fd-ink-3)] text-xs">
                                {r.workHours > 0 ? `${r.workHours}h` : '—'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )
          )}
        </>
      )}
    </div>
  );
}

// ─── Tasks Tab with filters + edit/delete ─────────────────────────────────────
function TasksTab({ memberId, isAdmin, allClients, allMembers, onTasksChange }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [search, setSearch] = useState('');

  // Edit/delete state
  const [editingTask, setEditingTask] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const toast = useToast();

  const loadTasks = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ assignedTo: memberId, limit: 200 });
      if (statusFilter) params.set('status', statusFilter);
      const res = await api.get(`/tasks?${params}`);
      let list = res.data.tasks || [];
      // Date filter (client-side on deadline)
      if (dateFrom) list = list.filter(t => t.deadline && t.deadline >= dateFrom);
      if (dateTo)   list = list.filter(t => t.deadline && t.deadline.slice(0,10) <= dateTo);
      if (search) {
        const q = search.toLowerCase();
        list = list.filter(t =>
          t.title.toLowerCase().includes(q) ||
          t.client?.company?.toLowerCase().includes(q)
        );
      }
      setTasks(list);
      onTasksChange?.(list);
    } finally { setLoading(false); }
  };

  useEffect(() => { loadTasks(); }, [memberId, statusFilter, dateFrom, dateTo, search]);

  const openEdit = (t) => {
    setEditingTask(t);
    setEditForm({
      title: t.title,
      description: t.description || '',
      client: t.client?._id || '',
      assignedTo: t.assignedTo?._id || memberId,
      priority: t.priority,
      status: t.status,
      deadline: t.deadline ? t.deadline.slice(0, 10) : '',
      category: t.category || 'other',
      isClientVisible: t.isClientVisible || false,
    });
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    setSaving(true);
    try {
      await api.put(`/tasks/${editingTask._id}`, editForm);
      setShowEditModal(false);
      toast({ type: 'success', title: 'Task updated', message: 'Changes saved.' });
      loadTasks();
    } catch (err) {
      toast({ type: 'error', title: 'Save failed', message: err?.response?.data?.message || 'Could not save.' });
    } finally { setSaving(false); }
  };

  const handleDelete = async (taskId) => {
    if (!window.confirm('Delete this task permanently? This cannot be undone.')) return;
    setDeletingId(taskId);
    try {
      await api.delete(`/tasks/${taskId}`);
      toast({ type: 'success', title: 'Task deleted' });
      loadTasks();
    } catch (err) {
      toast({ type: 'error', title: 'Delete failed', message: err?.response?.data?.message || 'Could not delete.' });
    } finally { setDeletingId(null); }
  };

  const updateStatus = async (taskId, status) => {
    try {
      await api.put(`/tasks/${taskId}`, { status });
      setTasks(prev => prev.map(t => t._id === taskId ? { ...t, status } : t));
    } catch (err) {
      toast({ type: 'error', title: 'Update failed', message: 'Could not change status.' });
    }
  };

  const STATUS_TABS = [
    { label: 'All', value: '' },
    { label: 'Today', value: 'today' },
    { label: 'Pending', value: 'pending' },
    { label: 'In Progress', value: 'in_progress' },
    { label: 'Review', value: 'review' },
    { label: 'Completed', value: 'completed' },
    { label: 'Cancelled', value: 'cancelled' },
  ];

  return (
    <div className="space-y-4">
      {/* Filters Row */}
      <div className="flex flex-col gap-3">
        {/* Search */}
        <div className="relative max-w-xs">
          <Search size={13} color="var(--fd-ink-4)" className="absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search tasks..."
            className="fd-input pl-9"
          />
        </div>

        {/* Status tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          {STATUS_TABS.map(t => (
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

        {/* Date range filter */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-[var(--fd-ink-4)] font-medium">Deadline range:</span>
          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            className="fd-input text-xs"
            style={{ width: 140 }}
            title="From date"
          />
          <span className="text-xs text-[var(--fd-ink-4)]">→</span>
          <input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            className="fd-input text-xs"
            style={{ width: 140 }}
            title="To date"
          />
          {(dateFrom || dateTo) && (
            <button
              onClick={() => { setDateFrom(''); setDateTo(''); }}
              className="text-xs text-[var(--fd-ink-4)] hover:text-red-500 transition-colors px-2 py-1 rounded-lg hover:bg-red-50"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : tasks.length === 0 ? (
        <EmptyState icon={CheckCircle} title="No tasks found" description="No tasks match the current filters." />
      ) : (
        <Card>
          {/* Desktop */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="fd-table">
              <thead>
                <tr>
                  {['Task', 'Client', 'Category', 'Priority', 'Status', 'Deadline', 'Actions'].map(h => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tasks.map(task => {
                  const isOverdue = task.deadline && new Date(task.deadline) < new Date() && !['completed','cancelled'].includes(task.status);
                  const ss = STATUS_STYLE[task.status] || STATUS_STYLE.pending;
                  return (
                    <tr key={task._id} style={isOverdue ? { background: 'rgba(185,28,28,0.04)' } : {}}>
                      <td style={{ maxWidth: 220 }}>
                        <div className="font-medium text-[13px] truncate" style={{ color: 'var(--fd-ink-1)' }}>{task.title}</div>
                        {task.description && <div className="text-[11px] text-[var(--fd-ink-4)] truncate mt-0.5 max-w-[180px]">{task.description}</div>}
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {task.isClientRequest && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: 'rgba(146,96,10,0.12)', color: '#f59e0b' }}>Client Request</span>
                          )}
                          {isOverdue && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: 'rgba(185,28,28,0.12)', color: '#ef4444' }}>⚠ Overdue</span>
                          )}
                        </div>
                      </td>
                      <td className="text-[12.5px]" style={{ color: 'var(--fd-ink-2)' }}>{task.client?.company || '—'}</td>
                      <td className="text-[12px]" style={{ color: 'var(--fd-ink-3)' }}>{CATEGORY_LABELS[task.category] || task.category}</td>
                      <td>
                        <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full capitalize" style={PRIORITY_STYLE[task.priority] || PRIORITY_STYLE.low}>
                          {task.priority}
                        </span>
                      </td>
                      <td>
                        {isAdmin ? (
                          <select
                            value={task.status}
                            onChange={e => updateStatus(task._id, e.target.value)}
                            className="text-[11.5px] px-2.5 py-1.5 rounded-lg border-0 cursor-pointer font-medium outline-none capitalize"
                            style={{ ...ss, fontFamily: "'Geist', system-ui" }}
                          >
                            {STATUSES.map(s => (
                              <option key={s} value={s} style={{ background: 'var(--fd-surface)', color: 'var(--fd-ink-1)' }}>
                                {STATUS_LABELS[s] || s.replace('_',' ')}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-[11.5px] font-medium px-2.5 py-1.5 rounded-lg capitalize inline-block" style={ss}>
                            {STATUS_LABELS[task.status] || task.status.replace('_',' ')}
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
                        {isAdmin && (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => openEdit(task)}
                              className="p-1.5 rounded-lg hover:bg-[var(--fd-surface-raised)] text-[var(--fd-ink-3)] hover:text-brand-600 transition-colors"
                              title="Edit task"
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              onClick={() => handleDelete(task._id)}
                              disabled={deletingId === task._id}
                              className="p-1.5 rounded-lg hover:bg-red-50 text-[var(--fd-ink-4)] hover:text-red-600 transition-colors"
                              title="Delete task"
                            >
                              {deletingId === task._id
                                ? <div className="w-3 h-3 border border-red-400 border-t-transparent rounded-full animate-spin" />
                                : <Trash2 size={13} />}
                            </button>
                          </div>
                        )}
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
              const isOverdue = task.deadline && new Date(task.deadline) < new Date() && !['completed','cancelled'].includes(task.status);
              const ss = STATUS_STYLE[task.status] || STATUS_STYLE.pending;
              return (
                <div key={task._id} className="p-4 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-[13px]" style={{ color: 'var(--fd-ink-1)' }}>{task.title}</div>
                      <div className="text-[11.5px] mt-0.5" style={{ color: 'var(--fd-ink-4)' }}>
                        {task.client?.company} {isOverdue && '· ⚠ Overdue'}
                      </div>
                    </div>
                    {isAdmin && (
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(task)} className="p-1.5 rounded-lg hover:bg-[var(--fd-surface-raised)] text-[var(--fd-ink-3)] transition-colors"><Pencil size={13} /></button>
                        <button onClick={() => handleDelete(task._id)} disabled={deletingId === task._id} className="p-1.5 rounded-lg hover:bg-red-50 text-[var(--fd-ink-4)] hover:text-red-600 transition-colors">
                          {deletingId === task._id ? <div className="w-3 h-3 border border-red-400 border-t-transparent rounded-full animate-spin" /> : <Trash2 size={13} />}
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10.5px] font-semibold px-2 py-0.5 rounded-full capitalize" style={PRIORITY_STYLE[task.priority] || PRIORITY_STYLE.low}>{task.priority}</span>
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-lg capitalize inline-block" style={ss}>{STATUS_LABELS[task.status] || task.status.replace('_',' ')}</span>
                    {task.deadline && (
                      <span className="text-[11px] font-mono flex items-center gap-1" style={{ color: isOverdue ? '#b91c1c' : 'var(--fd-ink-4)' }}>
                        <Clock size={10} />{formatDate(task.deadline)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Edit Task Modal */}
      {isAdmin && (
        <Modal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          title="Edit Task"
          footer={
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setShowEditModal(false)}>Cancel</Button>
              <Button loading={saving} onClick={handleSaveEdit}>Save Changes</Button>
            </div>
          }
        >
          <div className="space-y-4">
            <Input label="Title *" value={editForm.title || ''} onChange={e => setEditForm(p => ({ ...p, title: e.target.value }))} />
            <div className="space-y-1">
              <label className="block text-[12px] font-medium" style={{ color: 'var(--fd-ink-2)' }}>Description</label>
              <textarea
                value={editForm.description || ''}
                onChange={e => setEditForm(p => ({ ...p, description: e.target.value }))}
                rows={3}
                className="fd-input w-full resize-none"
                placeholder="Optional description..."
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Select label="Client *" value={editForm.client || ''} onChange={e => setEditForm(p => ({ ...p, client: e.target.value }))}>
                <option value="">Select client...</option>
                {allClients.map(c => <option key={c._id} value={c._id}>{c.company}</option>)}
              </Select>
              <Select label="Category" value={editForm.category || 'other'} onChange={e => setEditForm(p => ({ ...p, category: e.target.value }))}>
                {Object.entries({
                  paid_ads: 'Paid Ads', social_media: 'Social Media', video_editing: 'Video Editing',
                  graphic_design: 'Graphic Design', copywriting: 'Copywriting', reporting: 'Reporting',
                  strategy: 'Strategy', client_request: 'Client Request', other: 'Other',
                }).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Select label="Priority" value={editForm.priority || 'medium'} onChange={e => setEditForm(p => ({ ...p, priority: e.target.value }))}>
                {['low','medium','high','urgent'].map(v => <option key={v} value={v}>{v.charAt(0).toUpperCase()+v.slice(1)}</option>)}
              </Select>
              <Select label="Status" value={editForm.status || 'pending'} onChange={e => setEditForm(p => ({ ...p, status: e.target.value }))}>
                {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s] || s.replace('_',' ')}</option>)}
              </Select>
              <Input label="Deadline" type="date" value={editForm.deadline || ''} onChange={e => setEditForm(p => ({ ...p, deadline: e.target.value }))} />
            </div>
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={!!editForm.isClientVisible}
                onChange={e => setEditForm(p => ({ ...p, isClientVisible: e.target.checked }))}
                className="rounded"
                style={{ accentColor: '#4f6ef0' }}
              />
              <span className="text-[13px]" style={{ color: 'var(--fd-ink-2)' }}>Visible to client portal</span>
            </label>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Clients Tab with pending task breakdown ───────────────────────────────────
function ClientsTab({ assignedClients, memberId, isAdmin }) {
  const [clientTaskData, setClientTaskData] = useState({}); // clientId → { pending, in_progress, today, review, overdue }
  const [loadingTasks, setLoadingTasks] = useState(false);

  useEffect(() => {
    if (!assignedClients.length) return;
    setLoadingTasks(true);
    // Fetch pending/active tasks for all assigned clients at once
    Promise.all(
      assignedClients.map(c =>
        api.get(`/tasks?client=${c._id}&assignedTo=${memberId}&limit=200`)
          .then(res => ({ clientId: c._id, tasks: res.data.tasks || [] }))
          .catch(() => ({ clientId: c._id, tasks: [] }))
      )
    ).then(results => {
      const data = {};
      results.forEach(({ clientId, tasks }) => {
        const now = new Date();
        data[clientId] = {
          total:       tasks.length,
          today:       tasks.filter(t => t.status === 'today').length,
          pending:     tasks.filter(t => t.status === 'pending').length,
          in_progress: tasks.filter(t => t.status === 'in_progress').length,
          review:      tasks.filter(t => t.status === 'review').length,
          completed:   tasks.filter(t => t.status === 'completed').length,
          overdue:     tasks.filter(t => t.deadline && new Date(t.deadline) < now && !['completed','cancelled'].includes(t.status)).length,
        };
      });
      setClientTaskData(data);
    }).finally(() => setLoadingTasks(false));
  }, [assignedClients, memberId]);

  // Summary totals across all clients
  const totalPending     = Object.values(clientTaskData).reduce((s, d) => s + d.pending, 0);
  const totalInProgress  = Object.values(clientTaskData).reduce((s, d) => s + d.in_progress, 0);
  const totalToday       = Object.values(clientTaskData).reduce((s, d) => s + d.today, 0);
  const totalReview      = Object.values(clientTaskData).reduce((s, d) => s + d.review, 0);
  const totalOverdue     = Object.values(clientTaskData).reduce((s, d) => s + d.overdue, 0);
  const totalActive      = totalPending + totalInProgress + totalToday + totalReview;

  if (assignedClients.length === 0) {
    return <EmptyState icon={Building2} title="No clients assigned" description="This member isn't assigned to any clients yet." />;
  }

  return (
    <div className="space-y-5">
      {/* Boss-friendly summary banner */}
      {!loadingTasks && Object.keys(clientTaskData).length > 0 && (
        <div className="rounded-2xl border p-5" style={{ background: 'var(--fd-surface-raised)', borderColor: 'var(--fd-border)' }}>
          <div className="flex items-center gap-2 mb-4">
            <BarChart2 size={16} style={{ color: 'var(--fd-sidebar-link-active)' }} />
            <h3 className="font-bold text-sm" style={{ color: 'var(--fd-ink-1)' }}>Quick Overview — What's Pending</h3>
            <span className="text-[10.5px] px-2 py-0.5 rounded-full font-medium" style={{ background: 'var(--fd-surface-sunken)', color: 'var(--fd-ink-4)' }}>
              across {assignedClients.length} client{assignedClients.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { label: '🔴 Overdue',     count: totalOverdue,    bg: 'bg-red-50',     border: 'border-red-200',     text: 'text-red-700',      subtext: 'Past deadline, not done', urgent: true },
              { label: '📌 Pending',     count: totalPending,    bg: 'bg-amber-50',   border: 'border-amber-200',   text: 'text-amber-700',    subtext: 'Assigned, not started' },
              { label: '⚡ Today',       count: totalToday,      bg: 'bg-orange-50',  border: 'border-orange-200',  text: 'text-orange-700',   subtext: 'Due today' },
              { label: '🔵 In Progress', count: totalInProgress, bg: 'bg-blue-50',    border: 'border-blue-200',    text: 'text-blue-700',     subtext: 'Being worked on' },
              { label: '🟣 In Review',   count: totalReview,     bg: 'bg-purple-50',  border: 'border-purple-200',  text: 'text-purple-700',   subtext: 'Awaiting approval' },
            ].map(item => (
              <div
                key={item.label}
                className={`border rounded-xl p-3 text-center ${item.bg} ${item.border} ${item.urgent && item.count > 0 ? 'ring-2 ring-red-300 ring-offset-1' : ''}`}
              >
                <div className={`text-2xl font-black ${item.text}`}>{item.count}</div>
                <div className={`text-[11px] font-bold mt-0.5 ${item.text}`}>{item.label}</div>
                <div className="text-[9.5px] text-[var(--fd-ink-4)] mt-0.5 leading-tight">{item.subtext}</div>
              </div>
            ))}
          </div>
          {totalOverdue > 0 && (
            <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-red-100 border border-red-200">
              <AlertTriangle size={14} className="text-red-600 shrink-0" />
              <span className="text-xs font-semibold text-red-700">
                {totalOverdue} task{totalOverdue !== 1 ? 's are' : ' is'} overdue — needs immediate attention!
              </span>
            </div>
          )}
          {totalActive === 0 && totalOverdue === 0 && (
            <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200">
              <CheckCheck size={14} className="text-emerald-600 shrink-0" />
              <span className="text-xs font-semibold text-emerald-700">All clear! No pending or overdue tasks.</span>
            </div>
          )}
        </div>
      )}

      {/* Per-client cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {assignedClients.map(c => {
          const d = clientTaskData[c._id] || {};
          const isOverdueClient = d.overdue > 0;
          return (
            <div key={c._id} className="block">
              <div
                className={`rounded-xl border p-4 transition-all hover:shadow-md ${isOverdueClient ? 'border-red-300 ring-1 ring-red-200' : 'border-[var(--fd-border)]'}`}
                style={{ background: 'var(--fd-surface)' }}
              >
                {/* Client header */}
                <div className="flex items-center gap-3 mb-3">
                  <Avatar name={c.company} size="md" />
                  <div className="min-w-0 flex-1">
                    <Link to={`/admin/clients/${c._id}`} className="font-semibold text-[var(--fd-ink-1)] hover:text-brand-600 transition-colors truncate block text-sm">
                      {c.company}
                    </Link>
                    <div className="text-xs text-[var(--fd-ink-4)]">{c.name}</div>
                  </div>
                  <Link to={`/admin/clients/${c._id}`} className="text-[var(--fd-ink-4)] hover:text-brand-600 transition-colors">
                    <ExternalLink size={13} />
                  </Link>
                </div>

                {/* Status + plan badges */}
                <div className="flex items-center gap-1.5 flex-wrap mb-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${getStatusColor(c.status)}`}>{c.status}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PLAN_COLORS[c.plan] || 'bg-[var(--fd-surface-sunken)] text-[var(--fd-ink-2)]'}`}>
                    {PLAN_LABELS[c.plan] || c.plan}
                  </span>
                  {String(c.accountManager?._id || c.accountManager) === String(memberId) && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700 flex items-center gap-1">
                      <Star size={9} />AM
                    </span>
                  )}
                </div>

                {/* Task counts — the boss wants this */}
                {loadingTasks ? (
                  <div className="flex items-center gap-2 py-2">
                    <div className="w-3 h-3 border border-[var(--fd-ink-4)] border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs text-[var(--fd-ink-4)]">Loading tasks…</span>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {d.overdue > 0 && (
                      <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-red-50 border border-red-200">
                        <span className="text-xs font-semibold text-red-700 flex items-center gap-1.5">
                          <AlertTriangle size={11} />⚠ Overdue
                        </span>
                        <span className="text-xs font-black text-red-700 bg-red-200 px-2 py-0.5 rounded-full">{d.overdue}</span>
                      </div>
                    )}
                    {[
                      { key: 'today',       label: '⚡ Due Today',    bg: 'bg-orange-50', border: 'border-orange-100', text: 'text-orange-700', count: d.today },
                      { key: 'pending',     label: '📌 Pending',      bg: 'bg-amber-50',  border: 'border-amber-100',  text: 'text-amber-700',  count: d.pending },
                      { key: 'in_progress', label: '🔵 In Progress',  bg: 'bg-blue-50',   border: 'border-blue-100',   text: 'text-blue-700',   count: d.in_progress },
                      { key: 'review',      label: '🟣 In Review',    bg: 'bg-purple-50', border: 'border-purple-100', text: 'text-purple-700', count: d.review },
                      { key: 'completed',   label: '✅ Completed',    bg: 'bg-emerald-50',border: 'border-emerald-100',text: 'text-emerald-700',count: d.completed },
                    ].filter(item => item.count > 0).map(item => (
                      <div key={item.key} className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg ${item.bg} border ${item.border}`}>
                        <span className={`text-xs font-medium ${item.text}`}>{item.label}</span>
                        <span className={`text-xs font-bold ${item.text} px-2 py-0.5 rounded-full`} style={{ background: 'rgba(0,0,0,0.06)' }}>{item.count}</span>
                      </div>
                    ))}
                    {d.total === 0 && (
                      <div className="px-2.5 py-2 text-center text-xs text-[var(--fd-ink-4)]">No tasks assigned for this client</div>
                    )}
                    <div className="pt-1 border-t border-[var(--fd-border-subtle)] flex justify-between items-center">
                      <span className="text-[11px] text-[var(--fd-ink-4)]">Total tasks</span>
                      <span className="text-[11px] font-bold text-[var(--fd-ink-2)]">{d.total || 0}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
// ─────────────────────────────────────────────────────────────────────────────

export default function TeamMemberDetailPage() {
  const { id } = useParams();
  const { user: currentUser } = useAuthStore();
  const isAdmin = currentUser?.role === 'admin';
  const isAdminOrManager = ['admin', 'manager'].includes(currentUser?.role);

  const [member, setMember] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [assignedClients, setAssignedClients] = useState([]);
  const [allClients, setAllClients] = useState([]);
  const [allMembers, setAllMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  const [showEditModal, setShowEditModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef(null);
  const toast = useToast();

  const [showDocModal, setShowDocModal] = useState(false);
  const [docForm, setDocForm] = useState({ name: '', type: 'other' });
  const [docFile, setDocFile] = useState(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [deletingDocId, setDeletingDocId] = useState(null);
  const docInputRef = useRef(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [userRes, taskRes, clientsRes, allMembersRes] = await Promise.all([
        api.get(`/users/${id}`),
        api.get(`/tasks?assignedTo=${id}&limit=50`),
        api.get(`/clients?limit=100`),
        api.get(`/users?limit=100`),
      ]);
      const userData = userRes.data.user;
      setMember(userData);
      setTasks(taskRes.data.tasks || []);
      const allC = clientsRes.data.clients || [];
      setAllClients(allC);
      setAllMembers((allMembersRes.data.users || []).filter(u => u.role !== 'client'));
      setAssignedClients(allC.filter(c =>
        String(c.accountManager?._id || c.accountManager) === String(id) ||
        (c.teamMembers || []).some(m => String(m._id || m) === String(id))
      ));
      setEditForm({
        name: userData.name, email: userData.email,
        phone: userData.phone || '', alternativePhone: userData.alternativePhone || '',
        jobTitle: userData.jobTitle || '', department: userData.department || '',
        role: userData.role, isActive: userData.isActive,
      });
    } finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, [id]);

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const fd = new FormData();
      fd.append('avatar', file);
      await api.post(`/auth/avatar/${id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      await loadData();
      toast({ type: 'success', title: 'Photo updated', message: 'Profile photo saved.' });
    } catch (err) {
      toast({ type: 'error', title: 'Upload failed', message: err?.response?.data?.message || 'Could not upload photo.' });
    } finally { setUploadingAvatar(false); e.target.value = ''; }
  };

  const handleSaveEdit = async () => {
    setSaving(true);
    try {
      await api.put(`/users/${id}`, editForm);
      setShowEditModal(false);
      loadData();
      toast({ type: 'success', title: 'Saved', message: 'Team member details updated.' });
    } catch (err) {
      toast({ type: 'error', title: 'Save failed', message: err?.response?.data?.message || 'Could not save changes.' });
    } finally { setSaving(false); }
  };

  const handleDocUpload = async () => {
    if (!docFile) return toast({ type: 'error', title: 'No file', message: 'Please select a file.' });
    if (!docForm.name.trim()) return toast({ type: 'error', title: 'Missing name', message: 'Please enter a document name.' });
    setUploadingDoc(true);
    try {
      const fd = new FormData();
      fd.append('document', docFile);
      fd.append('name', docForm.name.trim());
      fd.append('type', docForm.type);
      await api.post(`/users/${id}/documents`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setShowDocModal(false);
      setDocForm({ name: '', type: 'other' });
      setDocFile(null);
      await loadData();
      toast({ type: 'success', title: 'Document uploaded', message: 'Document saved.' });
    } catch (err) {
      toast({ type: 'error', title: 'Upload failed', message: err?.response?.data?.message || 'Could not upload.' });
    } finally { setUploadingDoc(false); }
  };

  const handleDeleteDoc = async (docId) => {
    if (!window.confirm('Delete this document? This cannot be undone.')) return;
    setDeletingDocId(docId);
    try {
      await api.delete(`/users/${id}/documents/${docId}`);
      await loadData();
      toast({ type: 'success', title: 'Deleted', message: 'Document removed.' });
    } catch (err) {
      toast({ type: 'error', title: 'Delete failed', message: err?.response?.data?.message || 'Could not delete.' });
    } finally { setDeletingDocId(null); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>;
  if (!member) return <div className="text-[var(--fd-ink-3)] text-center py-16">Team member not found</div>;

  const pendingTasks    = tasks.filter(t => t.status === 'pending').length;
  const inProgressTasks = tasks.filter(t => t.status === 'in_progress').length;
  const completedTasks  = tasks.filter(t => t.status === 'completed').length;
  const documents       = member.documents || [];
  const showAttendanceTab = member.role !== 'client';

  const tabs = [
    { id: 'overview',   label: 'Overview' },
    { id: 'tasks',      label: `Tasks (${tasks.length})` },
    { id: 'clients',    label: `Clients (${assignedClients.length})` },
    { id: 'documents',  label: `Documents (${documents.length})` },
    ...(showAttendanceTab ? [{ id: 'attendance', label: 'Attendance' }] : []),
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link to="/admin/team" className="mt-1 p-1.5 text-[var(--fd-ink-4)] hover:text-[var(--fd-ink-2)] hover:bg-[var(--fd-surface-sunken)] rounded-lg transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative group" style={{ cursor: isAdmin ? 'pointer' : 'default' }}
              onClick={() => isAdmin && avatarInputRef.current?.click()}>
              <Avatar name={member.name} src={member.avatar} size="lg" />
              {isAdmin && (
                <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  {uploadingAvatar
                    ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    : <Camera size={14} color="white" />}
                </div>
              )}
              {isAdmin && <input ref={avatarInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={handleAvatarUpload} />}
            </div>
            <div>
              <h1 className="text-xl font-bold text-[var(--fd-ink-1)]">{member.name}</h1>
              <p className="text-[var(--fd-ink-3)] text-sm">{member.jobTitle || '—'} {member.department ? `· ${member.department}` : ''}</p>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${ROLE_COLORS[member.role] || 'bg-[var(--fd-surface-sunken)] text-[var(--fd-ink-2)]'}`}>
              {ROLE_LABELS[member.role] || member.role}
            </span>
            {!member.isActive && (
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-[var(--fd-surface-sunken)] text-[var(--fd-ink-3)]">Inactive</span>
            )}
          </div>
        </div>
        {isAdmin && (
          <Button variant="outline" size="sm" onClick={() => setShowEditModal(true)}>
            <Edit3 size={14} />Edit
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[var(--fd-border)] overflow-x-auto">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${activeTab === t.id ? 'border-brand-600 text-brand-600' : 'border-transparent text-[var(--fd-ink-3)] hover:text-[var(--fd-ink-2)]'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-5">
            <Card>
              <CardHeader><h3 className="font-semibold text-[var(--fd-ink-1)] text-sm">Contact Information</h3></CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2 text-[var(--fd-ink-2)]"><Mail size={14} className="text-[var(--fd-ink-4)]" />{member.email}</div>
                  <div className="flex items-center gap-2 text-[var(--fd-ink-2)]"><Phone size={14} className="text-[var(--fd-ink-4)]" /><span>{member.phone || '—'}</span></div>
                  {member.alternativePhone && (
                    <div className="flex items-center gap-2 text-[var(--fd-ink-2)]">
                      <Phone size={14} className="text-[var(--fd-ink-4)]" />
                      <span className="text-xs text-[var(--fd-ink-4)] mr-1">Alt:</span>{member.alternativePhone}
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-[var(--fd-ink-2)]"><Shield size={14} className="text-[var(--fd-ink-4)]" />{member.department || '—'}</div>
                  <div className="flex items-center gap-2 text-[var(--fd-ink-2)]"><Calendar size={14} className="text-[var(--fd-ink-4)]" />Joined {formatDate(member.createdAt)}</div>
                  {member.lastLogin && <div className="flex items-center gap-2 text-[var(--fd-ink-2)]"><Clock size={14} className="text-[var(--fd-ink-4)]" />Last login {timeAgo(member.lastLogin)}</div>}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><h3 className="font-semibold text-[var(--fd-ink-1)] text-sm">Recent Tasks</h3></CardHeader>
              <CardContent className="space-y-2">
                {tasks.slice(0, 5).length === 0
                  ? <p className="text-[var(--fd-ink-4)] text-sm text-center py-4">No tasks assigned</p>
                  : tasks.slice(0, 5).map(t => (
                    <div key={t._id} className="flex items-center gap-3 p-2.5 bg-[var(--fd-surface-raised)] rounded-lg">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-[var(--fd-ink-1)] truncate">{t.title}</div>
                        <div className="text-xs text-[var(--fd-ink-3)] mt-0.5">{t.client?.company || '—'}</div>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${getTaskStatusColor(t.status)}`}>{t.status?.replace('_', ' ')}</span>
                    </div>
                  ))}
                {tasks.length > 5 && <button onClick={() => setActiveTab('tasks')} className="text-xs text-brand-600 hover:underline w-full text-center pt-1">View all {tasks.length} tasks →</button>}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader><h3 className="font-semibold text-[var(--fd-ink-1)] text-sm">Task Stats</h3></CardHeader>
              <CardContent className="space-y-3">
                {[
                  { label: 'Pending',     count: pendingTasks,    color: 'bg-amber-100 text-amber-700'    },
                  { label: 'In Progress', count: inProgressTasks, color: 'bg-blue-100 text-blue-700'      },
                  { label: 'Completed',   count: completedTasks,  color: 'bg-emerald-100 text-emerald-700' },
                ].map(s => (
                  <div key={s.label} className="flex items-center justify-between">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${s.color}`}>{s.label}</span>
                    <span className="font-bold text-[var(--fd-ink-2)] text-sm">{s.count}</span>
                  </div>
                ))}
                <div className="border-t border-[var(--fd-border-subtle)] pt-2 flex items-center justify-between">
                  <span className="text-xs text-[var(--fd-ink-3)] font-medium">Total</span>
                  <span className="font-bold text-[var(--fd-ink-1)]">{tasks.length}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><h3 className="font-semibold text-[var(--fd-ink-1)] text-sm">Assigned Clients</h3></CardHeader>
              <CardContent>
                {assignedClients.length === 0
                  ? <p className="text-[var(--fd-ink-4)] text-sm">No clients assigned</p>
                  : (
                    <div className="space-y-2">
                      {assignedClients.slice(0, 5).map(c => (
                        <Link key={c._id} to={`/admin/clients/${c._id}`} className="flex items-center gap-2 p-2 hover:bg-[var(--fd-surface-raised)] rounded-lg transition-colors group">
                          <Avatar name={c.company} size="sm" />
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-medium text-[var(--fd-ink-2)] truncate group-hover:text-brand-600">{c.company}</div>
                            <div className="text-xs text-[var(--fd-ink-4)] capitalize">{c.status}</div>
                          </div>
                        </Link>
                      ))}
                      {assignedClients.length > 5 && <button onClick={() => setActiveTab('clients')} className="text-xs text-brand-600 hover:underline w-full text-center pt-1">+{assignedClients.length - 5} more</button>}
                    </div>
                  )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-[var(--fd-ink-1)] text-sm">Documents</h3>
                  {isAdmin && <button onClick={() => setActiveTab('documents')} className="text-xs text-brand-600 hover:underline">View all</button>}
                </div>
              </CardHeader>
              <CardContent>
                {documents.length === 0
                  ? <p className="text-[var(--fd-ink-4)] text-sm">No documents uploaded</p>
                  : (
                    <div className="space-y-1.5">
                      {documents.slice(0, 4).map(doc => (
                        <div key={doc._id} className="flex items-center gap-2 text-sm">
                          <DocIcon fileType={doc.fileType} className="text-[var(--fd-ink-4)] shrink-0" />
                          <span className="text-[var(--fd-ink-2)] truncate flex-1">{doc.name}</span>
                          <span className="text-xs text-[var(--fd-ink-4)] shrink-0">{DOC_TYPE_LABELS[doc.type] || doc.type}</span>
                        </div>
                      ))}
                      {documents.length > 4 && <p className="text-xs text-[var(--fd-ink-4)] pt-1">+{documents.length - 4} more</p>}
                    </div>
                  )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* TASKS — now with filters + edit/delete */}
      {activeTab === 'tasks' && (
        <TasksTab
          memberId={id}
          isAdmin={isAdmin}
          allClients={allClients}
          allMembers={allMembers}
          onTasksChange={setTasks}
        />
      )}

      {/* CLIENTS — now with pending task breakdown */}
      {activeTab === 'clients' && (
        <ClientsTab
          assignedClients={assignedClients}
          memberId={id}
          isAdmin={isAdmin}
        />
      )}

      {/* DOCUMENTS */}
      {activeTab === 'documents' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-[var(--fd-ink-3)]">
              {documents.length === 0 ? 'No documents uploaded yet.' : `${documents.length} document${documents.length !== 1 ? 's' : ''} on file.`}
            </p>
            {isAdmin && <Button size="sm" onClick={() => setShowDocModal(true)}><Upload size={14} /> Upload Document</Button>}
          </div>
          {documents.length === 0
            ? <EmptyState icon={FileText} title="No documents" description="Upload Aadhaar, PAN card, or other identity documents." />
            : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {documents.map(doc => (
                  <Card key={doc._id} className="group">
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-9 h-9 rounded-lg bg-[var(--fd-surface-sunken)] flex items-center justify-center shrink-0">
                            <DocIcon fileType={doc.fileType} className="text-[var(--fd-ink-3)]" />
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium text-[var(--fd-ink-1)] text-sm truncate">{doc.name}</div>
                            <div className="text-xs text-[var(--fd-ink-4)]">{DOC_TYPE_LABELS[doc.type] || doc.type}</div>
                          </div>
                        </div>
                        {isAdmin && (
                          <button onClick={() => handleDeleteDoc(doc._id)} disabled={deletingDocId === doc._id}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg" title="Delete document">
                            {deletingDocId === doc._id
                              ? <div className="w-3.5 h-3.5 border border-red-400 border-t-transparent rounded-full animate-spin" />
                              : <Trash2 size={13} />}
                          </button>
                        )}
                      </div>
                      <div className="text-xs text-[var(--fd-ink-4)] mb-3">Uploaded {formatDate(doc.uploadedAt)}</div>
                      <a href={doc.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-brand-600 hover:underline font-medium">
                        <ExternalLink size={11} />
                        {doc.fileType === 'image' ? 'View Image' : doc.fileType === 'pdf' ? 'Open PDF' : 'Open File'}
                      </a>
                    </div>
                  </Card>
                ))}
              </div>
            )}
        </div>
      )}

      {/* ATTENDANCE */}
      {activeTab === 'attendance' && <AttendanceTab memberId={id} />}

      {/* Edit Member Modal */}
      {isAdmin && (
        <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Edit Team Member"
          footer={<div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setShowEditModal(false)}>Cancel</Button><Button loading={saving} onClick={handleSaveEdit}>Save Changes</Button></div>}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Input label="Full Name" value={editForm.name || ''} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))} />
              <Input label="Email" type="email" value={editForm.email || ''} onChange={e => setEditForm(p => ({ ...p, email: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Phone" value={editForm.phone || ''} onChange={e => setEditForm(p => ({ ...p, phone: e.target.value }))} />
              <Input label="Alternative Phone" value={editForm.alternativePhone || ''} onChange={e => setEditForm(p => ({ ...p, alternativePhone: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Job Title" value={editForm.jobTitle || ''} onChange={e => setEditForm(p => ({ ...p, jobTitle: e.target.value }))} />
              <Input label="Department" value={editForm.department || ''} onChange={e => setEditForm(p => ({ ...p, department: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Select label="Role" value={editForm.role || ''} onChange={e => setEditForm(p => ({ ...p, role: e.target.value }))}>
                {Object.entries(ROLE_LABELS).filter(([k]) => k !== 'client').map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </Select>
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={!!editForm.isActive} onChange={e => setEditForm(p => ({ ...p, isActive: e.target.checked }))} className="rounded" />
                  <span className="text-sm text-[var(--fd-ink-2)]">Active</span>
                </label>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Upload Document Modal */}
      {isAdmin && (
        <Modal isOpen={showDocModal} onClose={() => { setShowDocModal(false); setDocFile(null); setDocForm({ name: '', type: 'other' }); }} title="Upload Document"
          footer={<div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => { setShowDocModal(false); setDocFile(null); setDocForm({ name: '', type: 'other' }); }}>Cancel</Button><Button loading={uploadingDoc} onClick={handleDocUpload} disabled={!docFile}><Upload size={14} /> Upload</Button></div>}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Input label="Document Name" placeholder="e.g. Aadhaar Card" value={docForm.name} onChange={e => setDocForm(p => ({ ...p, name: e.target.value }))} />
              <Select label="Document Type" value={docForm.type} onChange={e => setDocForm(p => ({ ...p, type: e.target.value }))}>
                {Object.entries(DOC_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--fd-ink-2)] mb-1.5">File</label>
              <div onClick={() => docInputRef.current?.click()}
                className="border-2 border-dashed border-[var(--fd-border)] rounded-xl p-6 text-center cursor-pointer hover:border-brand-400 hover:bg-brand-50/30 transition-colors">
                {docFile ? (
                  <div className="flex items-center justify-center gap-2 text-[var(--fd-ink-2)]">
                    <FileText size={18} />
                    <span className="text-sm font-medium truncate max-w-xs">{docFile.name}</span>
                    <button onClick={e => { e.stopPropagation(); setDocFile(null); }} className="ml-1 text-[var(--fd-ink-4)] hover:text-red-500"><X size={14} /></button>
                  </div>
                ) : (
                  <div>
                    <Upload size={24} className="mx-auto text-[var(--fd-ink-4)] mb-2" />
                    <p className="text-sm text-[var(--fd-ink-3)]">Click to browse or drop a file here</p>
                    <p className="text-xs text-[var(--fd-ink-4)] mt-1">PDF, JPG, PNG, DOCX — up to 50 MB</p>
                  </div>
                )}
              </div>
              <input ref={docInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.doc,.docx" className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) { setDocFile(f); if (!docForm.name) setDocForm(p => ({ ...p, name: f.name.replace(/\.[^.]+$/, '') })); }
                  e.target.value = '';
                }} />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}