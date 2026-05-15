import React, { useState, useEffect, useCallback } from 'react';
import {
  ChevronLeft, ChevronRight, Plus, Check, Edit2, Trash2,
  Clock, AlignLeft, List,
} from 'lucide-react';
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  startOfWeek, endOfWeek, isSameMonth, isSameDay, isToday,
  addMonths, subMonths, parseISO, startOfDay, endOfDay,
} from 'date-fns';
import api from '../../lib/api';
import { useToast, Button, Input, Modal } from '../../components/ui/index';
import { Spinner } from '../../components/shared/LoadingScreen';

// ─── Constants ────────────────────────────────────────────────────────────────
const EVENT_COLORS = {
  task_deadline: { bg: '#ef4444', light: '#fef2f2', text: '#b91c1c', border: '#fecaca' },
  meeting:       { bg: '#4f6ef0', light: '#eff0fe', text: '#3a56d4', border: '#c7cdfb' },
  reminder:      { bg: '#f59e0b', light: '#fffbeb', text: '#92600a', border: '#fde68a' },
  follow_up:     { bg: '#a855f7', light: '#faf5ff', text: '#7e22ce', border: '#e9d5ff' },
  campaign:      { bg: '#22c55e', light: '#f0fdf4', text: '#15803d', border: '#bbf7d0' },
  other:         { bg: '#94a3b8', light: '#f8fafc', text: '#475569', border: '#e2e8f0' },
};

const TYPE_LABELS = {
  task_deadline: 'Task Deadline',
  meeting:       'Meeting',
  reminder:      'Reminder',
  follow_up:     'Follow Up',
  campaign:      'Campaign',
  other:         'Other',
};

const DAY_LABELS_LONG  = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_LABELS_SHORT = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function toDatetimeLocal(date) {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  return format(d, "yyyy-MM-dd'T'HH:mm");
}

// ─── Event Chip (desktop) ─────────────────────────────────────────────────────
function EventChip({ event, isStart, isEnd, onClick }) {
  const color = EVENT_COLORS[event.type] || EVENT_COLORS.other;
  return (
    <button
      onClick={e => { e.stopPropagation(); onClick(event); }}
      className="w-full text-left text-[10px] font-semibold px-1 py-[2px] flex items-center gap-1 overflow-hidden mt-[2px] transition-opacity hover:opacity-80"
      style={{
        background: color.light,
        color: color.text,
        borderTop:    `2px solid ${color.bg}`,
        borderBottom: `2px solid ${color.bg}`,
        borderLeft:   isStart ? `2px solid ${color.bg}` : 'none',
        borderRight:  isEnd   ? `2px solid ${color.bg}` : 'none',
        borderRadius: isStart && isEnd ? 4 : isStart ? '4px 0 0 4px' : isEnd ? '0 4px 4px 0' : 0,
        marginLeft:   isStart ? 0 : -1,
        marginRight:  isEnd   ? 0 : -1,
      }}
      title={event.title}
    >
      {isStart && (
        <>
          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color.bg }} />
          <span className="truncate">{event.title}</span>
        </>
      )}
    </button>
  );
}

// ─── View Modal ───────────────────────────────────────────────────────────────
function EventViewModal({ event, onClose, onEdit, onDelete }) {
  const [deleting, setDeleting] = useState(false);
  const color = EVENT_COLORS[event.type] || EVENT_COLORS.other;

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
          <Button variant="danger" size="sm" onClick={del} loading={deleting}>
            <Trash2 size={12} /> Delete
          </Button>
          <div className="flex gap-2 ml-auto">
            <Button variant="secondary" size="sm" onClick={onClose}>Close</Button>
            <Button size="sm" onClick={onEdit}><Edit2 size={12} /> Edit</Button>
          </div>
        </div>
      }
    >
      <div className="flex items-start gap-3 mb-5">
        <div
          className="w-3 h-3 rounded-full mt-1 flex-shrink-0"
          style={{ background: color.bg, boxShadow: `0 0 0 3px ${color.light}` }}
        />
        <div>
          <h3 className="text-[17px] font-bold leading-tight" style={{ color: 'var(--fd-ink-1)' }}>
            {event.title}
          </h3>
          <span
            className="inline-block mt-1 text-[11px] font-semibold px-2 py-0.5 rounded-full"
            style={{ background: color.light, color: color.text }}
          >
            {TYPE_LABELS[event.type] || event.type}
          </span>
        </div>
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
        {event.description && (
          <div className="flex items-start gap-2.5 p-3 rounded-xl" style={{ background: 'var(--fd-surface-sunken)' }}>
            <AlignLeft size={13} style={{ color: 'var(--fd-ink-4)', marginTop: 1 }} />
            <p className="text-[12.5px] leading-relaxed" style={{ color: 'var(--fd-ink-2)' }}>
              {event.description}
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}

// ─── Edit / Create Modal ──────────────────────────────────────────────────────
function EventEditModal({ event, defaultDate, onClose, onSave, onDelete }) {
  const isNew = !event?._id;

  const buildDefaults = () => {
    if (!isNew && event) {
      return {
        title:       event.title || '',
        type:        event.type || 'meeting',
        startDate:   event.startDate ? toDatetimeLocal(parseISO(event.startDate)) : '',
        endDate:     event.endDate   ? toDatetimeLocal(parseISO(event.endDate))   : '',
        description: event.description || '',
      };
    }
    const base = defaultDate ? new Date(defaultDate) : new Date();
    base.setHours(9, 0, 0, 0);
    const end = new Date(base);
    end.setHours(10, 0, 0, 0);
    return { title: '', type: 'meeting', startDate: toDatetimeLocal(base), endDate: toDatetimeLocal(end), description: '' };
  };

  const [form, setForm] = useState(buildDefaults);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.title?.trim()) return;
    setSaving(true);
    try { await onSave({ ...event, ...form }, isNew); onClose(); }
    finally { setSaving(false); }
  };

  const del = async () => {
    if (!event?._id) return;
    setSaving(true);
    try { await onDelete(event._id); onClose(); }
    finally { setSaving(false); }
  };

  return (
    <Modal
      isOpen onClose={onClose} title={isNew ? 'New Event' : 'Edit Event'} size="sm"
      footer={
        <div className="flex items-center justify-between gap-2">
          {!isNew && (
            <Button variant="danger" size="sm" onClick={del} loading={saving}>
              <Trash2 size={12} /> Delete
            </Button>
          )}
          <div className="flex gap-2 ml-auto">
            <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" onClick={save} loading={saving}>
              <Check size={12} /> {isNew ? 'Create' : 'Save'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <Input
          label="Title" value={form.title} autoFocus
          onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          placeholder="Event title"
        />
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
        {/* Stack vertically on mobile */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input label="Start" type="datetime-local" value={form.startDate}
            onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
          <Input label="End" type="datetime-local" value={form.endDate}
            onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
        </div>
        <div className="space-y-1.5">
          <label className="block text-[12px] font-medium" style={{ color: 'var(--fd-ink-2)' }}>Notes</label>
          <textarea
            className="fd-input resize-none" rows={2}
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            placeholder="Optional notes…"
          />
        </div>
      </div>
    </Modal>
  );
}

// ─── Mobile Day Bottom Sheet ──────────────────────────────────────────────────
function DaySheet({ day, events, onClose, onViewEvent, onNewEvent }) {
  const dayEvents = events.filter(ev => {
    const evStart = parseISO(ev.startDate);
    const evEnd   = ev.endDate ? parseISO(ev.endDate) : evStart;
    return evStart <= endOfDay(day) && evEnd >= startOfDay(day);
  });

  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative rounded-t-3xl pt-3 pb-8 px-5 overflow-y-auto"
        style={{ background: 'var(--fd-surface)', boxShadow: '0 -8px 40px rgba(0,0,0,0.15)', maxHeight: '75vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
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
            <button
              onClick={() => onNewEvent(day)}
              className="mt-3 text-[13px] font-semibold"
              style={{ color: '#4f6ef0' }}
            >
              + Add an event
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {dayEvents.map(ev => {
              const color = EVENT_COLORS[ev.type] || EVENT_COLORS.other;
              return (
                <button
                  key={ev._id}
                  onClick={() => onViewEvent(ev)}
                  className="w-full text-left flex items-start gap-3 p-3.5 rounded-2xl active:opacity-60 transition-opacity"
                  style={{ background: 'var(--fd-surface-sunken)' }}
                >
                  <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ background: color.bg, minHeight: 40 }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-semibold truncate" style={{ color: 'var(--fd-ink-1)' }}>
                      {ev.title}
                    </p>
                    <p className="text-[12px] mt-0.5" style={{ color: 'var(--fd-ink-4)' }}>
                      {format(parseISO(ev.startDate), 'h:mm a')}
                      {ev.endDate && ev.endDate !== ev.startDate &&
                        ` – ${format(parseISO(ev.endDate), 'h:mm a')}`}
                    </p>
                  </div>
                  <span
                    className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 self-center"
                    style={{ background: color.light, color: color.text }}
                  >
                    {TYPE_LABELS[ev.type] || ev.type}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function CalendarPage() {
  const toast = useToast();
  const [current, setCurrent]   = useState(new Date());
  const [events, setEvents]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [modal, setModal]       = useState(null);
  const [sheetDay, setSheetDay] = useState(null);   // mobile day sheet
  const [showSidebar, setShowSidebar] = useState(true);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const from = startOfWeek(startOfMonth(current), { weekStartsOn: 1 }).toISOString();
      const to   = endOfWeek(endOfMonth(current),   { weekStartsOn: 1 }).toISOString();
      const { data } = await api.get(`/calendar?from=${from}&to=${to}`);
      setEvents(data.events || []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [current]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

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

  // Grid
  const monthStart = startOfMonth(current);
  const monthEnd   = endOfMonth(current);
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

  const todayEvents = events
    .filter(ev => isSameDay(parseISO(ev.startDate), new Date()))
    .sort((a, b) => new Date(a.startDate) - new Date(b.startDate));

  const upcomingEvents = events
    .filter(ev => { const d = parseISO(ev.startDate); return d > new Date() && d <= endOfMonth(current); })
    .sort((a, b) => new Date(a.startDate) - new Date(b.startDate))
    .slice(0, 5);

  return (
    <div className="animate-fade-in">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-4 sm:mb-6 gap-2 sm:gap-3">
        <div className="min-w-0">
          <h1
            className="text-[18px] sm:text-[22px] font-bold tracking-[-0.02em]"
            style={{ color: 'var(--fd-ink-1)' }}
          >
            Calendar
          </h1>
          <p className="text-[11px] sm:text-[13px] mt-0.5" style={{ color: 'var(--fd-ink-4)' }}>
            {format(current, 'MMMM yyyy')} · {events.length} event{events.length !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
          {/* Today — hidden on xs */}
          <button
            onClick={() => setCurrent(new Date())}
            className="hidden sm:block text-[12px] font-semibold px-3 py-1.5 rounded-lg"
            style={{ background: 'var(--fd-surface)', border: '1px solid var(--fd-border)', color: 'var(--fd-ink-3)' }}
          >
            Today
          </button>

          {/* Month nav */}
          <div className="flex items-center rounded-lg overflow-hidden" style={{ border: '1px solid var(--fd-border)' }}>
            <button
              className="p-1.5 sm:p-2 hover:bg-[var(--fd-surface-sunken)] transition-colors"
              style={{ background: 'var(--fd-surface)', color: 'var(--fd-ink-3)', borderRight: '1px solid var(--fd-border)' }}
              onClick={() => setCurrent(subMonths(current, 1))}
            >
              <ChevronLeft size={14} />
            </button>
            <span
              className="px-2 sm:px-3 text-[12px] sm:text-[13px] font-semibold whitespace-nowrap"
              style={{ background: 'var(--fd-surface)', color: 'var(--fd-ink-1)' }}
            >
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

          {/* Add event */}
          <Button size="sm" onClick={() => setModal({ mode: 'new', defaultDate: new Date() })}>
            <Plus size={13} />
            <span className="hidden sm:inline ml-1">Add Event</span>
          </Button>

          {/* Sidebar toggle — lg only */}
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
                  const inMonth   = isSameMonth(day, current);
                  const today     = isToday(day);
                  const isWeekend = i % 7 >= 5;

                  return (
                    <div
                      key={i}
                      className="cursor-pointer transition-colors group relative select-none"
                      style={{
                        borderRight:  i % 7 < 6 ? '1px solid var(--fd-border-subtle)' : 'none',
                        borderBottom: '1px solid var(--fd-border-subtle)',
                        background:   !inMonth ? 'var(--fd-surface-sunken)' : isWeekend ? 'rgba(0,0,0,0.005)' : 'transparent',
                        // Fluid height: compact on mobile, tall on desktop
                        minHeight: 'clamp(48px, 12vw, 108px)',
                      }}
                      onClick={() => {
                        if (window.innerWidth < 640) {
                          setSheetDay(day);
                        } else {
                          setModal({ mode: 'new', defaultDate: day });
                        }
                      }}
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
                        {/* Desktop hover + button */}
                        <button
                          onClick={e => { e.stopPropagation(); setModal({ mode: 'new', defaultDate: day }); }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity hidden sm:flex items-center justify-center w-5 h-5 rounded"
                          style={{ color: 'var(--fd-ink-4)', background: 'var(--fd-surface-sunken)' }}
                        >
                          <Plus size={10} />
                        </button>
                      </div>

                      {/* Mobile: colored dots only */}
                      <div className="sm:hidden px-1 pb-1 flex flex-wrap gap-[3px]">
                        {dayEvts.slice(0, 3).map(ev => {
                          const c = EVENT_COLORS[ev.type] || EVENT_COLORS.other;
                          return (
                            <span
                              key={ev._id}
                              className="inline-block w-[5px] h-[5px] rounded-full flex-shrink-0"
                              style={{ background: c.bg }}
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
          </div>
        </div>

        {/* Sidebar — desktop only, toggleable */}
        {showSidebar && (
          <div className="hidden lg:flex flex-col gap-4 w-[220px] flex-shrink-0">
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
                    return (
                      <button key={ev._id} onClick={() => setModal({ mode: 'view', event: ev })}
                        className="w-full text-left flex items-start gap-2 hover:opacity-80 transition-opacity">
                        <div className="w-0.5 self-stretch rounded-full flex-shrink-0 mt-0.5" style={{ background: c.bg }} />
                        <div className="min-w-0">
                          <p className="text-[12px] font-medium truncate" style={{ color: 'var(--fd-ink-2)' }}>{ev.title}</p>
                          <p className="text-[11px]" style={{ color: 'var(--fd-ink-4)' }}>{format(parseISO(ev.startDate), 'h:mm a')}</p>
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

      {/* Mobile today strip (below grid) */}
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
                  style={{ background: 'var(--fd-surface-sunken)' }}
                >
                  <div className="w-1 self-stretch rounded-full" style={{ background: c.bg, minHeight: 32 }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold truncate" style={{ color: 'var(--fd-ink-1)' }}>{ev.title}</p>
                    <p className="text-[11px]" style={{ color: 'var(--fd-ink-4)' }}>{format(parseISO(ev.startDate), 'h:mm a')}</p>
                  </div>
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ background: c.light, color: c.text }}>
                    {TYPE_LABELS[ev.type]}
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
          events={events}
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
        />
      )}
      {(modal?.mode === 'edit' || modal?.mode === 'new') && (
        <EventEditModal
          event={modal.mode === 'edit' ? modal.event : null}
          defaultDate={modal.defaultDate}
          onClose={() => setModal(null)}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}