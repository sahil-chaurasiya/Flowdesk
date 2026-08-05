import React, { useState, useEffect, useCallback } from 'react';
import {
  ChevronLeft, ChevronRight, Clock, AlignLeft,
  AlertTriangle, Check, Building2, Calendar,
  CheckCircle2, Circle, Loader, XCircle, CalendarClock,
} from 'lucide-react';
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  startOfWeek, endOfWeek, isSameMonth, isSameDay, isToday,
  addMonths, subMonths, parseISO,
} from 'date-fns';
import api from '../../lib/api';
import { Spinner } from '../../components/shared/LoadingScreen';

// ─── Constants ────────────────────────────────────────────────────────────────
const EVENT_COLORS = {
  task_deadline: { bg: '#ef4444', light: '#fef2f2', text: '#b91c1c', border: '#fecaca' },
  meeting:       { bg: '#4f6ef0', light: '#eff0fe', text: '#3a56d4', border: '#c7cdfb' },
  reminder:      { bg: '#f59e0b', light: '#fffbeb', text: '#92600a', border: '#fde68a' },
  follow_up:     { bg: '#a855f7', light: '#faf5ff', text: '#7e22ce', border: '#e9d5ff' },
  campaign:      { bg: '#22c55e', light: '#f0fdf4', text: '#15803d', border: '#bbf7d0' },
  shoot:         { bg: '#ec4899', light: '#fdf2f8', text: '#be185d', border: '#fbcfe8' },
  other:         { bg: '#94a3b8', light: '#f8fafc', text: '#475569', border: '#e2e8f0' },
};

const TYPE_LABELS = {
  task_deadline: 'Task Deadline',
  meeting:       'Meeting',
  reminder:      'Reminder',
  follow_up:     'Follow Up',
  campaign:      'Campaign',
  shoot:         'Shoot',
  other:         'Other',
};

const SHOOT_SUBTYPES = {
  photo_shoot:   { label: 'Photo Shoot',    icon: '📷' },
  video_shoot:   { label: 'Video Shoot',    icon: '🎬' },
  reel_shoot:    { label: 'Reel Shoot',     icon: '📱' },
  product_shoot: { label: 'Product Shoot',  icon: '📦' },
  event_shoot:   { label: 'Event Shoot',    icon: '🎉' },
  interview:     { label: 'Interview',      icon: '🎙️' },
  bts:           { label: 'BTS',            icon: '🎥' },
  other_shoot:   { label: 'Other Shoot',    icon: '🎞️' },
};

const STATUS_CONFIG = {
  scheduled:   { label: 'Scheduled',   icon: CalendarClock, color: '#6366f1', bg: '#eef2ff' },
  pending:     { label: 'Pending',     icon: Circle,       color: '#94a3b8', bg: '#f8fafc' },
  in_progress: { label: 'In Progress', icon: Loader,       color: '#f59e0b', bg: '#fffbeb' },
  done:        { label: 'Done',        icon: CheckCircle2, color: '#22c55e', bg: '#f0fdf4' },
  cancelled:   { label: 'Cancelled',   icon: XCircle,      color: '#ef4444', bg: '#fef2f2' },
};

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// ─── Overdue badge ────────────────────────────────────────────────────────────
function OverdueBadge() {
  return (
    <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1 py-[1px] rounded"
      style={{ background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca' }}>
      <AlertTriangle size={7} /> OVERDUE
    </span>
  );
}

// ─── Event chip on calendar grid ──────────────────────────────────────────────
function EventChip({ event, onClick }) {
  const color = EVENT_COLORS[event.type] || EVENT_COLORS.other;
  return (
    <button
      onClick={e => { e.stopPropagation(); onClick(event); }}
      className="w-full text-left text-[10px] font-semibold px-1.5 py-[2px] flex items-center gap-1 overflow-hidden mt-[2px] rounded transition-opacity hover:opacity-80"
      style={{
        background: event.isOverdue ? '#fef2f2' : color.light,
        color:      event.isOverdue ? '#b91c1c' : color.text,
        border:     `1px solid ${event.isOverdue ? '#fecaca' : color.border}`,
      }}
      title={event.title}
    >
      {event.isOverdue
        ? <AlertTriangle size={8} className="flex-shrink-0" style={{ color: '#ef4444' }} />
        : <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color.bg }} />
      }
      <span className="truncate">{event.title}</span>
      {event.status === 'done' && <Check size={8} className="flex-shrink-0 ml-auto" style={{ color: '#22c55e' }} />}
    </button>
  );
}

// ─── Event Detail Modal ───────────────────────────────────────────────────────
function EventDetailModal({ event, onClose }) {
  const color = EVENT_COLORS[event.type] || EVENT_COLORS.other;
  const cfg = STATUS_CONFIG[event.status] || STATUS_CONFIG.pending;
  const StatusIcon = cfg.icon;
  const shoot = event.type === 'shoot' && event.shootSubtype ? SHOOT_SUBTYPES[event.shootSubtype] : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)' }}
      onClick={onClose}
    >
      <div
        className="w-full sm:w-[420px] sm:max-w-full rounded-t-2xl sm:rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: 'var(--fd-surface)', border: '1px solid var(--fd-border)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header strip */}
        <div className="h-1.5 w-full" style={{ background: color.bg }} />

        <div className="p-5">
          {/* Title row */}
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
                {shoot && (
                  <span className="inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: '#fdf2f8', color: '#be185d', border: '1px solid #fbcfe8' }}>
                    {shoot.icon} {shoot.label}
                  </span>
                )}
                {event.isOverdue && <OverdueBadge />}
              </div>
            </div>
          </div>

          {/* Status */}
          <div className="flex items-center justify-between p-3 rounded-xl mb-3"
            style={{ background: 'var(--fd-surface-sunken)' }}>
            <span className="text-[12px] font-medium" style={{ color: 'var(--fd-ink-3)' }}>Status</span>
            <span
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full"
              style={{ background: cfg.bg, color: cfg.color }}
            >
              <StatusIcon size={11} /> {cfg.label}
            </span>
          </div>

          <div className="space-y-2.5">
            {/* Dates */}
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

            {/* Description */}
            {event.description && (
              <div className="flex items-start gap-2.5 p-3 rounded-xl min-w-0" style={{ background: 'var(--fd-surface-sunken)' }}>
                <AlignLeft size={13} style={{ color: 'var(--fd-ink-4)', marginTop: 1, flexShrink: 0 }} />
                <p className="text-[12.5px] leading-relaxed whitespace-pre-wrap break-words min-w-0" style={{ color: 'var(--fd-ink-2)' }}>
                  {event.description}
                </p>
              </div>
            )}
          </div>

          <button
            onClick={onClose}
            className="mt-4 w-full py-2 rounded-xl text-[13px] font-semibold transition-opacity hover:opacity-80"
            style={{ background: 'var(--fd-surface-sunken)', color: 'var(--fd-ink-2)' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ClientCalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [activeDay, setActiveDay] = useState(null);

  const fetchEvents = useCallback(async (month) => {
    setLoading(true);
    try {
      const from = format(startOfMonth(month), "yyyy-MM-dd'T'00:00:00");
      const to   = format(endOfMonth(month),   "yyyy-MM-dd'T'23:59:59");
      const { data } = await api.get('/calendar/client-portal', { params: { from, to } });
      setEvents(data.events || []);
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchEvents(currentMonth); }, [currentMonth, fetchEvents]);

  // Build calendar grid (Mon-start weeks)
  const monthStart = startOfMonth(currentMonth);
  const monthEnd   = endOfMonth(currentMonth);
  const gridStart  = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd    = endOfWeek(monthEnd,   { weekStartsOn: 1 });
  const days       = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const eventsForDay = (day) =>
    events.filter(ev => {
      const s = parseISO(ev.startDate);
      const e = parseISO(ev.endDate);
      return day >= new Date(s.setHours(0,0,0,0)) && day <= new Date(e.setHours(23,59,59,999));
    });

  const activeDayEvents = activeDay ? eventsForDay(activeDay) : [];

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      {/* Page header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: 'var(--fd-accent-light, #eff0fe)' }}>
          <Calendar size={18} style={{ color: 'var(--fd-accent, #4f6ef0)' }} />
        </div>
        <div>
          <h1 className="text-[18px] font-bold" style={{ color: 'var(--fd-ink-1)' }}>Calendar</h1>
          <p className="text-[12px]" style={{ color: 'var(--fd-ink-4)' }}>Your scheduled events & milestones</p>
        </div>
      </div>

      {/* Month nav */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[16px] font-bold" style={{ color: 'var(--fd-ink-1)' }}>
          {format(currentMonth, 'MMMM yyyy')}
        </h2>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCurrentMonth(m => subMonths(m, 1))}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-opacity hover:opacity-70"
            style={{ background: 'var(--fd-surface-sunken)' }}
          >
            <ChevronLeft size={15} style={{ color: 'var(--fd-ink-2)' }} />
          </button>
          <button
            onClick={() => setCurrentMonth(new Date())}
            className="px-3 py-1 rounded-lg text-[11px] font-semibold transition-opacity hover:opacity-70"
            style={{ background: 'var(--fd-surface-sunken)', color: 'var(--fd-ink-3)' }}
          >
            Today
          </button>
          <button
            onClick={() => setCurrentMonth(m => addMonths(m, 1))}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-opacity hover:opacity-70"
            style={{ background: 'var(--fd-surface-sunken)' }}
          >
            <ChevronRight size={15} style={{ color: 'var(--fd-ink-2)' }} />
          </button>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--fd-border)' }}>
        {/* Day headers */}
        <div className="grid grid-cols-7">
          {DAY_LABELS.map(d => (
            <div key={d} className="py-2 text-center text-[11px] font-semibold"
              style={{ background: 'var(--fd-surface-sunken)', color: 'var(--fd-ink-4)' }}>
              {d}
            </div>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16" style={{ background: 'var(--fd-surface)' }}>
            <Spinner size={24} />
          </div>
        ) : (
          <div className="grid grid-cols-7">
            {days.map((day, i) => {
              const inMonth  = isSameMonth(day, currentMonth);
              const isToday_ = isToday(day);
              const isActive = activeDay && isSameDay(day, activeDay);
              const dayEvts  = eventsForDay(day);

              return (
                <div
                  key={i}
                  onClick={() => setActiveDay(isActive ? null : day)}
                  className="min-h-[80px] p-1.5 cursor-pointer transition-colors"
                  style={{
                    background: isActive
                      ? 'var(--fd-accent-light, #eff0fe)'
                      : isToday_
                      ? 'var(--fd-surface-sunken)'
                      : 'var(--fd-surface)',
                    borderTop: i >= 7 ? '1px solid var(--fd-border)' : 'none',
                    borderLeft: i % 7 !== 0 ? '1px solid var(--fd-border)' : 'none',
                    opacity: inMonth ? 1 : 0.4,
                  }}
                >
                  <div className="flex items-center justify-center mb-1">
                    <span
                      className={`text-[12px] font-semibold w-6 h-6 flex items-center justify-center rounded-full`}
                      style={{
                        background: isToday_ ? 'var(--fd-accent, #4f6ef0)' : 'transparent',
                        color: isToday_ ? '#fff' : 'var(--fd-ink-2)',
                      }}
                    >
                      {format(day, 'd')}
                    </span>
                  </div>
                  <div className="space-y-px">
                    {dayEvts.slice(0, 3).map(ev => (
                      <EventChip key={ev._id} event={ev} onClick={setSelected} />
                    ))}
                    {dayEvts.length > 3 && (
                      <p className="text-[9px] font-semibold px-1" style={{ color: 'var(--fd-ink-4)' }}>
                        +{dayEvts.length - 3} more
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Active day panel */}
      {activeDay && activeDayEvents.length > 0 && (
        <div className="mt-4 rounded-2xl overflow-hidden" style={{ border: '1px solid var(--fd-border)' }}>
          <div className="px-4 py-3" style={{ background: 'var(--fd-surface-sunken)' }}>
            <h3 className="text-[13px] font-semibold" style={{ color: 'var(--fd-ink-2)' }}>
              {format(activeDay, 'EEEE, MMMM d')}
            </h3>
          </div>
          <div className="divide-y" style={{ borderColor: 'var(--fd-border)' }}>
            {activeDayEvents.map(ev => {
              const color = EVENT_COLORS[ev.type] || EVENT_COLORS.other;
              const cfg = STATUS_CONFIG[ev.status] || STATUS_CONFIG.pending;
              const StatusIcon = cfg.icon;
              return (
                <button
                  key={ev._id}
                  onClick={() => setSelected(ev)}
                  className="w-full flex items-start gap-3 px-4 py-3 text-left transition-opacity hover:opacity-70"
                  style={{ background: 'var(--fd-surface)' }}
                >
                  <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ background: color.bg, minHeight: 32 }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-[13px] font-semibold truncate" style={{ color: 'var(--fd-ink-1)' }}>
                        {ev.title}
                      </p>
                      {ev.isOverdue && <OverdueBadge />}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px]" style={{ color: color.text }}>
                        {TYPE_LABELS[ev.type] || ev.type}
                      </span>
                      <span className="text-[11px]" style={{ color: 'var(--fd-ink-4)' }}>
                        {format(parseISO(ev.startDate), 'h:mm a')}
                      </span>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                    style={{ background: cfg.bg, color: cfg.color }}>
                    <StatusIcon size={9} /> {cfg.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {activeDay && activeDayEvents.length === 0 && (
        <div className="mt-4 rounded-2xl py-8 text-center" style={{ border: '1px solid var(--fd-border)' }}>
          <Calendar size={28} className="mx-auto mb-2" style={{ color: 'var(--fd-ink-4)' }} />
          <p className="text-[13px]" style={{ color: 'var(--fd-ink-4)' }}>No events on {format(activeDay, 'MMMM d')}</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && events.length === 0 && !activeDay && (
        <div className="mt-6 rounded-2xl py-12 text-center" style={{ border: '1px solid var(--fd-border)' }}>
          <Calendar size={32} className="mx-auto mb-3" style={{ color: 'var(--fd-ink-4)' }} />
          <p className="text-[14px] font-semibold" style={{ color: 'var(--fd-ink-2)' }}>No events this month</p>
          <p className="text-[12px] mt-1" style={{ color: 'var(--fd-ink-4)' }}>Your team hasn't shared any events for {format(currentMonth, 'MMMM')} yet.</p>
        </div>
      )}

      {/* Event detail modal */}
      {selected && (
        <EventDetailModal event={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}