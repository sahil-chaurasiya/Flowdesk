import React, { useEffect, useState, useCallback } from 'react';
import {
  Plus, Trash2, Send, Clock, CheckCircle2, AlertTriangle,
  RotateCcw, ChevronDown, Building2, Save, History, X,
  ClipboardList,
} from 'lucide-react';
import api from '../../lib/api';
import useAuthStore from '../../context/authStore';

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORY_OPTIONS = [
  { value: 'paid_ads',       label: '📊 Paid Ads' },
  { value: 'social_media',   label: '📱 Social Media' },
  { value: 'video_editing',  label: '🎬 Video Editing' },
  { value: 'graphic_design', label: '🎨 Graphic Design' },
  { value: 'copywriting',    label: '✍️ Copywriting' },
  { value: 'reporting',      label: '📋 Reporting' },
  { value: 'strategy',       label: '🧠 Strategy' },
  { value: 'meetings',       label: '🤝 Meetings' },
  { value: 'other',          label: '📌 Other' },
];

const STATUS_OPTIONS = [
  { value: 'completed',    label: '✅ Completed',    color: '#22c55e' },
  { value: 'in_progress',  label: '🔄 In Progress',  color: '#4f6ef0' },
  { value: 'carried_over', label: '⏩ Carried Over', color: '#f59e0b' },
];

const STATUS_META = {
  completed:    { label: 'Completed',    color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
  in_progress:  { label: 'In Progress',  color: '#4f6ef0', bg: 'rgba(79,110,240,0.1)' },
  carried_over: { label: 'Carried Over', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
};

function todayLabel() {
  return new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function blankEntry() {
  return { description: '', client: '', hoursSpent: '', category: 'other', status: 'completed' };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function EntryRow({ entry, index, clients, onChange, onRemove, readOnly }) {
  return (
    <div
      className="rounded-xl p-4 mb-3 relative"
      style={{ background: 'var(--fd-surface)', border: '1px solid var(--fd-border)' }}
    >
      {!readOnly && (
        <button
          onClick={() => onRemove(index)}
          className="absolute top-3 right-3 p-1 rounded-lg hover:bg-red-500/10 transition-colors"
          title="Remove entry"
        >
          <X size={13} style={{ color: 'var(--fd-ink-4)' }} />
        </button>
      )}

      {/* Status badge (carried over highlight) */}
      {entry.status === 'carried_over' && (
        <div
          className="inline-flex items-center gap-1 text-[10px] font-semibold rounded px-2 py-0.5 mb-2"
          style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b' }}
        >
          <RotateCcw size={9} /> Carried over from yesterday
        </div>
      )}

      {/* Description */}
      <textarea
        value={entry.description}
        onChange={e => onChange(index, 'description', e.target.value)}
        readOnly={readOnly}
        placeholder="What did you work on? Be specific — e.g. 'Edited 3 Reels for client X, uploaded to Drive'"
        rows={2}
        className="w-full text-[13px] resize-none outline-none bg-transparent"
        style={{ color: 'var(--fd-ink-1)', '::placeholder': { color: 'var(--fd-ink-5)' } }}
      />

      {/* Row 2: meta fields */}
      <div className="flex flex-wrap gap-2 mt-3">
        {/* Category */}
        <div className="relative">
          <select
            value={entry.category}
            onChange={e => onChange(index, 'category', e.target.value)}
            disabled={readOnly}
            className="text-[11px] rounded-lg pl-2 pr-6 py-1 outline-none appearance-none cursor-pointer"
            style={{ background: 'var(--fd-canvas)', border: '1px solid var(--fd-border)', color: 'var(--fd-ink-2)' }}
          >
            {CATEGORY_OPTIONS.map(c => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
          <ChevronDown size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--fd-ink-4)' }} />
        </div>

        {/* Status */}
        <div className="relative">
          <select
            value={entry.status}
            onChange={e => onChange(index, 'status', e.target.value)}
            disabled={readOnly}
            className="text-[11px] rounded-lg pl-2 pr-6 py-1 outline-none appearance-none cursor-pointer"
            style={{ background: 'var(--fd-canvas)', border: '1px solid var(--fd-border)', color: STATUS_META[entry.status]?.color || 'var(--fd-ink-2)' }}
          >
            {STATUS_OPTIONS.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <ChevronDown size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--fd-ink-4)' }} />
        </div>

        {/* Client */}
        <div className="relative">
          <select
            value={entry.client || ''}
            onChange={e => onChange(index, 'client', e.target.value)}
            disabled={readOnly}
            className="text-[11px] rounded-lg pl-2 pr-6 py-1 outline-none appearance-none cursor-pointer"
            style={{ background: 'var(--fd-canvas)', border: '1px solid var(--fd-border)', color: 'var(--fd-ink-2)' }}
          >
            <option value="">No client</option>
            {clients.map(c => (
              <option key={c._id} value={c._id}>{c.name}</option>
            ))}
          </select>
          <ChevronDown size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--fd-ink-4)' }} />
        </div>

        {/* Hours */}
        <input
          type="number"
          min="0"
          max="24"
          step="0.5"
          value={entry.hoursSpent}
          onChange={e => onChange(index, 'hoursSpent', e.target.value)}
          readOnly={readOnly}
          placeholder="hrs"
          className="text-[11px] rounded-lg px-2 py-1 outline-none w-16 text-center"
          style={{ background: 'var(--fd-canvas)', border: '1px solid var(--fd-border)', color: 'var(--fd-ink-2)' }}
        />
      </div>
    </div>
  );
}

function HistoryModal({ onClose, userId }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    api.get('/daily-logs/my/history?limit=14')
      .then(r => setLogs(r.data.logs || []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[3px]" onClick={onClose} />
      <div
        className="relative w-full max-w-xl rounded-2xl flex flex-col overflow-hidden"
        style={{ background: 'var(--fd-surface)', border: '1px solid var(--fd-border)', maxHeight: '80vh' }}
      >
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--fd-border)' }}>
          <div className="text-[14px] font-semibold" style={{ color: 'var(--fd-ink-1)' }}>Past Logs</div>
          <button onClick={onClose} className="btn-ghost p-1.5 rounded-lg"><X size={14} /></button>
        </div>
        <div className="overflow-y-auto flex-1 p-4">
          {loading && (
            <div className="flex items-center justify-center py-10">
              <div className="w-5 h-5 border-2 border-[#4f6ef0] border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {!loading && logs.length === 0 && (
            <div className="text-center py-10 text-[13px]" style={{ color: 'var(--fd-ink-4)' }}>No past logs yet.</div>
          )}
          {logs.map(log => {
            const isOpen = expanded === log._id;
            const totalHours = log.entries.reduce((s, e) => s + (parseFloat(e.hoursSpent) || 0), 0);
            return (
              <div
                key={log._id}
                className="mb-2 rounded-xl overflow-hidden"
                style={{ border: '1px solid var(--fd-border)' }}
              >
                <button
                  onClick={() => setExpanded(isOpen ? null : log._id)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-[var(--fd-canvas)] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="text-[12px] font-medium" style={{ color: 'var(--fd-ink-1)' }}>
                      {new Date(log.date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                    </div>
                    <div className="text-[11px]" style={{ color: 'var(--fd-ink-4)' }}>{log.entries.length} task{log.entries.length !== 1 ? 's' : ''}</div>
                    {totalHours > 0 && <div className="text-[11px]" style={{ color: 'var(--fd-ink-4)' }}>{totalHours}h</div>}
                  </div>
                  <div className="flex items-center gap-2">
                    {log.isSubmitted
                      ? <span className="text-[10px] font-semibold px-2 py-0.5 rounded" style={{ background: 'rgba(34,197,94,0.12)', color: '#22c55e' }}>Submitted</span>
                      : <span className="text-[10px] font-semibold px-2 py-0.5 rounded" style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b' }}>Draft</span>
                    }
                    <ChevronDown size={12} style={{ color: 'var(--fd-ink-4)', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
                  </div>
                </button>
                {isOpen && (
                  <div className="px-4 pb-4" style={{ background: 'var(--fd-canvas)' }}>
                    {log.entries.map((e, i) => (
                      <div key={i} className="py-2" style={{ borderTop: i === 0 ? '1px solid var(--fd-border)' : 'none' }}>
                        <div className="text-[12px]" style={{ color: 'var(--fd-ink-1)' }}>{e.description}</div>
                        <div className="flex gap-2 mt-1 flex-wrap">
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded"
                            style={{ background: STATUS_META[e.status]?.bg, color: STATUS_META[e.status]?.color }}
                          >
                            {STATUS_META[e.status]?.label}
                          </span>
                          {e.client?.name && <span className="text-[10px]" style={{ color: 'var(--fd-ink-4)' }}>{e.client.name}</span>}
                          {e.hoursSpent && <span className="text-[10px]" style={{ color: 'var(--fd-ink-4)' }}>{e.hoursSpent}h</span>}
                        </div>
                      </div>
                    ))}
                    {log.blockers && (
                      <div className="mt-3 p-3 rounded-lg" style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.15)' }}>
                        <div className="text-[10px] font-semibold mb-1" style={{ color: '#ef4444' }}>Blocker</div>
                        <div className="text-[12px]" style={{ color: 'var(--fd-ink-2)' }}>{log.blockers}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function MyDayPage() {
  const { user } = useAuthStore();
  const [log, setLog] = useState(null);
  const [entries, setEntries] = useState([]);
  const [blockers, setBlockers] = useState('');
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [error, setError] = useState('');

  const isSubmitted = log?.isSubmitted || false;

  const load = useCallback(async () => {
    try {
      const [logRes, clientRes] = await Promise.all([
        api.get('/daily-logs/my/today'),
        api.get('/clients?limit=200&fields=name'),
      ]);
      const l = logRes.data.log;
      setLog(l);
      setEntries(l.entries?.length ? l.entries.map(e => ({
        ...e,
        client: e.client?._id || e.client || '',
        hoursSpent: e.hoursSpent ?? '',
      })) : [blankEntry()]);
      setBlockers(l.blockers || '');
      setClients(clientRes.data.clients || []);
    } catch {
      setError('Failed to load your daily log.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleEntryChange = (idx, field, value) => {
    setEntries(prev => prev.map((e, i) => i === idx ? { ...e, [field]: value } : e));
    setSaved(false);
  };

  const addEntry = () => {
    setEntries(prev => [...prev, blankEntry()]);
    setSaved(false);
  };

  const removeEntry = (idx) => {
    setEntries(prev => prev.filter((_, i) => i !== idx));
    setSaved(false);
  };

  const handleSave = async () => {
    const valid = entries.filter(e => e.description.trim());
    if (valid.length === 0) { setError('Add at least one entry.'); return; }
    setError('');
    setSaving(true);
    try {
      const payload = {
        entries: valid.map(e => ({
          description: e.description.trim(),
          client: e.client || null,
          hoursSpent: e.hoursSpent ? parseFloat(e.hoursSpent) : null,
          category: e.category,
          status: e.status,
        })),
        blockers: blockers.trim(),
      };
      const res = await api.put('/daily-logs/my/today', payload);
      setLog(res.data.log);
      setSaved(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    await handleSave();
    setSubmitting(true);
    try {
      const valid = entries.filter(e => e.description.trim());
      const res = await api.post('/daily-logs/my/today/submit', {
        entries: valid.map(e => ({
          description: e.description.trim(),
          client: e.client || null,
          hoursSpent: e.hoursSpent ? parseFloat(e.hoursSpent) : null,
          category: e.category,
          status: e.status,
        })),
        blockers: blockers.trim(),
      });
      setLog(res.data.log);
    } catch (err) {
      setError(err.response?.data?.message || 'Submit failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const totalHours = entries.reduce((s, e) => s + (parseFloat(e.hoursSpent) || 0), 0);
  const completedCount = entries.filter(e => e.status === 'completed').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-[#4f6ef0] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ClipboardList size={18} style={{ color: '#4f6ef0' }} />
            <h1 className="text-[18px] font-bold" style={{ color: 'var(--fd-ink-1)' }}>My Day</h1>
          </div>
          <p className="text-[12px]" style={{ color: 'var(--fd-ink-4)' }}>{todayLabel()}</p>
        </div>
        <button
          onClick={() => setShowHistory(true)}
          className="flex items-center gap-1.5 text-[12px] btn-ghost px-3 py-1.5 rounded-lg"
          style={{ color: 'var(--fd-ink-3)' }}
        >
          <History size={13} /> Past Logs
        </button>
      </div>

      {/* Submitted banner */}
      {isSubmitted && (
        <div
          className="flex items-center gap-3 p-4 rounded-xl mb-5"
          style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}
        >
          <CheckCircle2 size={18} style={{ color: '#22c55e', flexShrink: 0 }} />
          <div>
            <div className="text-[13px] font-semibold" style={{ color: '#22c55e' }}>Day submitted!</div>
            <div className="text-[11px]" style={{ color: 'var(--fd-ink-4)' }}>
              Submitted at {log?.submittedAt ? new Date(log.submittedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}. Your manager can see this.
            </div>
          </div>
        </div>
      )}

      {/* Stats strip */}
      {entries.length > 0 && (
        <div className="flex gap-3 mb-5">
          <div className="flex-1 rounded-xl px-4 py-3 text-center" style={{ background: 'var(--fd-surface)', border: '1px solid var(--fd-border)' }}>
            <div className="text-[18px] font-bold" style={{ color: 'var(--fd-ink-1)' }}>{entries.filter(e => e.description.trim()).length}</div>
            <div className="text-[10px]" style={{ color: 'var(--fd-ink-4)' }}>Tasks logged</div>
          </div>
          <div className="flex-1 rounded-xl px-4 py-3 text-center" style={{ background: 'var(--fd-surface)', border: '1px solid var(--fd-border)' }}>
            <div className="text-[18px] font-bold" style={{ color: '#22c55e' }}>{completedCount}</div>
            <div className="text-[10px]" style={{ color: 'var(--fd-ink-4)' }}>Completed</div>
          </div>
          {totalHours > 0 && (
            <div className="flex-1 rounded-xl px-4 py-3 text-center" style={{ background: 'var(--fd-surface)', border: '1px solid var(--fd-border)' }}>
              <div className="text-[18px] font-bold" style={{ color: '#4f6ef0' }}>{totalHours}h</div>
              <div className="text-[10px]" style={{ color: 'var(--fd-ink-4)' }}>Hours logged</div>
            </div>
          )}
        </div>
      )}

      {/* Entries */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-[13px] font-semibold" style={{ color: 'var(--fd-ink-2)' }}>What did you work on today?</div>
        </div>

        {entries.map((entry, i) => (
          <EntryRow
            key={i}
            entry={entry}
            index={i}
            clients={clients}
            onChange={handleEntryChange}
            onRemove={removeEntry}
            readOnly={isSubmitted}
          />
        ))}

        {!isSubmitted && (
          <button
            onClick={addEntry}
            className="w-full py-2.5 rounded-xl text-[12px] font-medium flex items-center justify-center gap-2 transition-colors"
            style={{
              background: 'var(--fd-surface)',
              border: '1px dashed var(--fd-border)',
              color: 'var(--fd-ink-4)',
            }}
          >
            <Plus size={13} /> Add another task
          </button>
        )}
      </div>

      {/* Blockers */}
      <div
        className="rounded-xl p-4 mb-5"
        style={{ background: 'var(--fd-surface)', border: '1px solid var(--fd-border)' }}
      >
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle size={13} style={{ color: '#f59e0b' }} />
          <div className="text-[12px] font-semibold" style={{ color: 'var(--fd-ink-2)' }}>Blockers</div>
          <span className="text-[10px]" style={{ color: 'var(--fd-ink-5)' }}>optional</span>
        </div>
        <textarea
          value={blockers}
          onChange={e => { setBlockers(e.target.value); setSaved(false); }}
          readOnly={isSubmitted}
          placeholder="Anything stopping you? e.g. 'Waiting for client assets for the Reel project'"
          rows={2}
          className="w-full text-[12px] resize-none outline-none bg-transparent"
          style={{ color: 'var(--fd-ink-1)' }}
        />
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 text-[12px] text-red-500 px-1">{error}</div>
      )}

      {/* Actions */}
      {!isSubmitted && (
        <div className="flex gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-medium transition-colors"
            style={{
              background: 'var(--fd-surface)',
              border: '1px solid var(--fd-border)',
              color: saved ? '#22c55e' : 'var(--fd-ink-2)',
            }}
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-[#4f6ef0] border-t-transparent rounded-full animate-spin" />
            ) : (
              <Save size={14} />
            )}
            {saved ? 'Saved' : 'Save draft'}
          </button>

          <button
            onClick={handleSubmit}
            disabled={submitting || saving}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-semibold text-white transition-opacity"
            style={{ background: '#4f6ef0', opacity: submitting ? 0.7 : 1 }}
          >
            {submitting ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Send size={14} />
            )}
            Submit day
          </button>
        </div>
      )}

      {/* History modal */}
      {showHistory && <HistoryModal onClose={() => setShowHistory(false)} />}
    </div>
  );
}
