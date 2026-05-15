import React, { useState, useEffect, useCallback } from 'react';
import {
  ChevronLeft, ChevronRight, Plus, Calendar as CalIcon,
  Clock, Building2, X, Check,
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek,
  endOfWeek, isSameMonth, isSameDay, isToday, addMonths, subMonths, parseISO } from 'date-fns';
import api from '../../lib/api';
import { useToast, Button, Input, Modal } from '../../components/ui/index';
import { Spinner } from '../../components/shared/LoadingScreen';

const EVENT_COLORS = {
  task_deadline: '#ef4444',
  meeting:       '#4f6ef0',
  reminder:      '#f59e0b',
  follow_up:     '#a855f7',
  campaign:      '#22c55e',
  other:         '#a8a49e',
};

function EventDot({ event, onClick }) {
  const color = EVENT_COLORS[event.type] || '#a8a49e';
  return (
    <button
      onClick={e => { e.stopPropagation(); onClick(event); }}
      className="w-full text-left text-[10px] font-medium px-1 py-0.5 rounded truncate block mt-0.5"
      style={{ background: `${color}18`, color }}
      title={event.title}
    >
      {event.title}
    </button>
  );
}

function EventModal({ event, onClose, onSave, onDelete }) {
  const [form, setForm] = useState(event || {
    title: '', type: 'meeting',
    startDate: new Date().toISOString().slice(0, 16),
    endDate:   new Date().toISOString().slice(0, 16),
    description: '',
  });
  const [saving, setSaving] = useState(false);
  const isNew = !event?._id;

  const save = async () => {
    if (!form.title?.trim()) return;
    setSaving(true);
    try {
      await onSave(form, isNew);
      onClose();
    } finally { setSaving(false); }
  };

  const del = async () => {
    if (!event?._id) return;
    setSaving(true);
    try { await onDelete(event._id); onClose(); }
    finally { setSaving(false); }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={isNew ? 'New Event' : 'Edit Event'}
      size="sm"
      footer={
        <div className="flex items-center justify-between gap-2">
          {!isNew && (
            <Button variant="danger" size="sm" onClick={del} loading={saving}>
              Delete
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
      <div className="space-y-3">
        <Input
          label="Title"
          value={form.title || ''}
          onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          placeholder="Event title"
        />
        <div className="space-y-1.5">
          <label className="block text-[12px] font-medium" style={{ color: 'var(--fd-ink-2)' }}>Type</label>
          <select
            className="fd-input cursor-pointer"
            value={form.type || 'meeting'}
            onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
          >
            {Object.keys(EVENT_COLORS).map(t => (
              <option key={t} value={t}>{t.replace('_', ' ')}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Start"
            type="datetime-local"
            value={form.startDate ? form.startDate.slice(0, 16) : ''}
            onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
          />
          <Input
            label="End"
            type="datetime-local"
            value={form.endDate ? form.endDate.slice(0, 16) : ''}
            onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <label className="block text-[12px] font-medium" style={{ color: 'var(--fd-ink-2)' }}>Notes</label>
          <textarea
            className="fd-input resize-none"
            rows={2}
            value={form.description || ''}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            placeholder="Optional notes…"
          />
        </div>
      </div>
    </Modal>
  );
}

export default function CalendarPage() {
  const toast = useToast();
  const [current, setCurrent] = useState(new Date());
  const [events, setEvents]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal]     = useState(null); // null | { event | null, defaultDate? }

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const from = startOfMonth(current).toISOString();
      const to   = endOfMonth(current).toISOString();
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

  // Calendar grid
  const monthStart  = startOfMonth(current);
  const monthEnd    = endOfMonth(current);
  const calStart    = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd      = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days        = eachDayOfInterval({ start: calStart, end: calEnd });
  const DAY_LABELS  = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const eventsOnDay = (day) => events.filter(ev => {
    const d = parseISO(ev.startDate);
    return isSameDay(d, day);
  });

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-bold tracking-[-0.02em]" style={{ color: 'var(--fd-ink-1)' }}>
            Calendar
          </h1>
          <p className="text-[13px] mt-0.5" style={{ color: 'var(--fd-ink-4)' }}>
            Schedule, deadlines, and reminders
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-ghost p-1.5" onClick={() => setCurrent(subMonths(current, 1))}>
            <ChevronLeft size={16} />
          </button>
          <span className="text-[14px] font-semibold min-w-[130px] text-center" style={{ color: 'var(--fd-ink-1)' }}>
            {format(current, 'MMMM yyyy')}
          </span>
          <button className="btn-ghost p-1.5" onClick={() => setCurrent(addMonths(current, 1))}>
            <ChevronRight size={16} />
          </button>
          <Button size="sm" onClick={() => setModal({ event: null })}>
            <Plus size={13} /> Add event
          </Button>
        </div>
      </div>

      {/* Grid */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ background: 'var(--fd-surface)', border: '1px solid var(--fd-border)' }}
      >
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b" style={{ borderColor: 'var(--fd-border)' }}>
          {DAY_LABELS.map(d => (
            <div
              key={d}
              className="py-2.5 text-center text-[11px] font-semibold uppercase tracking-wider"
              style={{ color: 'var(--fd-ink-4)' }}
            >
              {d}
            </div>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Spinner size="lg" />
          </div>
        ) : (
          <div className="grid grid-cols-7">
            {days.map((day, i) => {
              const dayEvents = eventsOnDay(day);
              const inMonth   = isSameMonth(day, current);
              const today     = isToday(day);

              return (
                <div
                  key={i}
                  onClick={() => setModal({ event: null, defaultDate: day.toISOString() })}
                  className="min-h-[96px] p-2 border-r border-b cursor-pointer transition-colors hover:bg-[var(--fd-table-row-hover)]"
                  style={{
                    borderColor: 'var(--fd-border-subtle)',
                    background: !inMonth ? 'var(--fd-surface-sunken)' : 'transparent',
                  }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`text-[12px] font-medium w-6 h-6 flex items-center justify-center rounded-full ${today ? 'text-white' : ''}`}
                      style={{
                        background: today ? '#4f6ef0' : 'transparent',
                        color: today ? '#fff' : inMonth ? 'var(--fd-ink-2)' : 'var(--fd-ink-5)',
                      }}
                    >
                      {format(day, 'd')}
                    </span>
                  </div>
                  {dayEvents.slice(0, 3).map(ev => (
                    <EventDot
                      key={ev._id}
                      event={ev}
                      onClick={e => { setModal({ event: e }); }}
                    />
                  ))}
                  {dayEvents.length > 3 && (
                    <span className="text-[10px]" style={{ color: 'var(--fd-ink-5)' }}>
                      +{dayEvents.length - 3} more
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {Object.entries(EVENT_COLORS).map(([type, color]) => (
          <div key={type} className="flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--fd-ink-3)' }}>
            <div className="w-2 h-2 rounded-full" style={{ background: color }} />
            {type.replace('_', ' ')}
          </div>
        ))}
      </div>

      {/* Modal */}
      {modal !== null && (
        <EventModal
          event={modal.event}
          onClose={() => setModal(null)}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}
