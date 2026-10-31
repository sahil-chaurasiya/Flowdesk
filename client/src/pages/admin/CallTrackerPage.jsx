import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Phone, PhoneCall, PhoneOff, PhoneMissed, PhoneIncoming,
  TrendingUp, Calendar, Clock, Plus, X, ChevronDown,
  CheckCircle2, AlertCircle, RotateCcw, MessageSquare,
  Target, Zap, BarChart2, Users, Filter, Search,
  ArrowUpRight, Trash2, Edit3, ChevronLeft, ChevronRight,
} from 'lucide-react';
import api from '../../lib/api';
import useAuthStore from '../../context/authStore';
import { getInitials } from '../../lib/utils';

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtDuration = (secs) => {
  if (!secs) return '—';
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
};

const fmtDate = (d) =>
  new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true });

const OUTCOME_META = {
  no_answer:          { label: 'No Answer',          color: '#94a3b8', bg: 'rgba(148,163,184,0.12)', icon: PhoneMissed },
  not_interested:     { label: 'Not Interested',      color: '#f87171', bg: 'rgba(248,113,113,0.12)', icon: PhoneOff },
  callback_requested: { label: 'Callback Requested',  color: '#fb923c', bg: 'rgba(251,146,60,0.12)',  icon: RotateCcw },
  interested:         { label: 'Interested',           color: '#34d399', bg: 'rgba(52,211,153,0.12)',  icon: PhoneIncoming },
  converted_to_lead:  { label: 'Converted to Lead',   color: '#818cf8', bg: 'rgba(129,140,248,0.12)', icon: CheckCircle2 },
  wrong_number:       { label: 'Wrong Number',         color: '#94a3b8', bg: 'rgba(148,163,184,0.1)',  icon: AlertCircle },
  voicemail:          { label: 'Voicemail',            color: '#60a5fa', bg: 'rgba(96,165,250,0.12)',  icon: MessageSquare },
};

const CALL_TYPE_META = {
  cold_call:   { label: 'Cold Call',   color: '#f472b6' },
  follow_up:   { label: 'Follow-up',   color: '#fb923c' },
  discovery:   { label: 'Discovery',   color: '#34d399' },
  whatsapp:    { label: 'WhatsApp',    color: '#4ade80' },
  other:       { label: 'Other',       color: '#94a3b8' },
};

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, color = '#4f6ef0', onClick }) {
  return (
    <div
      onClick={onClick}
      className="rounded-xl p-4 flex flex-col gap-2"
      style={{
        background: 'var(--fd-surface)',
        border: '1px solid var(--fd-border)',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'box-shadow 0.15s',
      }}
      onMouseEnter={e => onClick && (e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)')}
      onMouseLeave={e => onClick && (e.currentTarget.style.boxShadow = 'none')}
    >
      <div className="flex items-center justify-between">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: `${color}18` }}
        >
          <Icon size={16} style={{ color }} />
        </div>
        <span className="text-[11px]" style={{ color: 'var(--fd-ink-5)' }}>{label}</span>
      </div>
      <div className="text-[26px] font-bold leading-none" style={{ color: 'var(--fd-ink-1)' }}>
        {value}
      </div>
      {sub && <div className="text-[11px]" style={{ color: 'var(--fd-ink-4)' }}>{sub}</div>}
    </div>
  );
}

// ── Log Call Modal ─────────────────────────────────────────────────────────────
function LogCallModal({ onClose, onSaved, editLog = null }) {
  const [form, setForm] = useState({
    prospectName:    editLog?.prospectName    || '',
    prospectPhone:   editLog?.prospectPhone   || '',
    prospectCompany: editLog?.prospectCompany || '',
    prospectSource:  editLog?.prospectSource  || 'other',
    callDate:        editLog?.callDate
      ? new Date(editLog.callDate).toISOString().slice(0, 16)
      : new Date().toISOString().slice(0, 16),
    duration:        editLog?.duration        || 0,
    callType:        editLog?.callType        || 'cold_call',
    outcome:         editLog?.outcome         || '',
    notes:           editLog?.notes           || '',
    convertedToLead: editLog?.convertedToLead || false,
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.outcome) { setErr('Please select an outcome'); return; }
    setSaving(true); setErr('');
    try {
      const payload = { ...form, duration: Number(form.duration) };
      if (editLog) {
        await api.put(`/call-logs/${editLog._id}`, payload);
      } else {
        await api.post('/call-logs', payload);
      }
      onSaved();
      onClose();
    } catch (e) {
      setErr(e?.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl" style={{ background: 'var(--fd-surface)', border: '1px solid var(--fd-border)' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--fd-border)' }}>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(79,110,240,0.12)' }}>
              <Phone size={14} style={{ color: '#4f6ef0' }} />
            </div>
            <span className="font-semibold text-[14px]" style={{ color: 'var(--fd-ink-1)' }}>
              {editLog ? 'Edit Call Log' : 'Log a Call'}
            </span>
          </div>
          <button onClick={onClose} className="btn-ghost p-1.5 rounded-lg"><X size={15} /></button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Prospect info */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-medium mb-1 block" style={{ color: 'var(--fd-ink-4)' }}>Prospect Name</label>
              <input
                className="w-full rounded-lg px-3 py-2 text-[13px] outline-none"
                style={{ background: 'var(--fd-surface-sunken)', border: '1px solid var(--fd-border)', color: 'var(--fd-ink-1)' }}
                placeholder="John Doe"
                value={form.prospectName}
                onChange={e => set('prospectName', e.target.value)}
              />
            </div>
            <div>
              <label className="text-[11px] font-medium mb-1 block" style={{ color: 'var(--fd-ink-4)' }}>Phone Number</label>
              <input
                className="w-full rounded-lg px-3 py-2 text-[13px] outline-none"
                style={{ background: 'var(--fd-surface-sunken)', border: '1px solid var(--fd-border)', color: 'var(--fd-ink-1)' }}
                placeholder="+91 9876543210"
                value={form.prospectPhone}
                onChange={e => set('prospectPhone', e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-medium mb-1 block" style={{ color: 'var(--fd-ink-4)' }}>Company</label>
              <input
                className="w-full rounded-lg px-3 py-2 text-[13px] outline-none"
                style={{ background: 'var(--fd-surface-sunken)', border: '1px solid var(--fd-border)', color: 'var(--fd-ink-1)' }}
                placeholder="Acme Corp"
                value={form.prospectCompany}
                onChange={e => set('prospectCompany', e.target.value)}
              />
            </div>
            <div>
              <label className="text-[11px] font-medium mb-1 block" style={{ color: 'var(--fd-ink-4)' }}>Source</label>
              <select
                className="w-full rounded-lg px-3 py-2 text-[13px] outline-none"
                style={{ background: 'var(--fd-surface-sunken)', border: '1px solid var(--fd-border)', color: 'var(--fd-ink-1)' }}
                value={form.prospectSource}
                onChange={e => set('prospectSource', e.target.value)}
              >
                {['linkedin', 'facebook', 'instagram', 'cold_list', 'referral', 'website', 'other'].map(s => (
                  <option key={s} value={s}>{s.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Call meta */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[11px] font-medium mb-1 block" style={{ color: 'var(--fd-ink-4)' }}>Call Type</label>
              <select
                className="w-full rounded-lg px-3 py-2 text-[13px] outline-none"
                style={{ background: 'var(--fd-surface-sunken)', border: '1px solid var(--fd-border)', color: 'var(--fd-ink-1)' }}
                value={form.callType}
                onChange={e => set('callType', e.target.value)}
              >
                {Object.entries(CALL_TYPE_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-medium mb-1 block" style={{ color: 'var(--fd-ink-4)' }}>Duration (secs)</label>
              <input
                type="number" min="0"
                className="w-full rounded-lg px-3 py-2 text-[13px] outline-none"
                style={{ background: 'var(--fd-surface-sunken)', border: '1px solid var(--fd-border)', color: 'var(--fd-ink-1)' }}
                value={form.duration}
                onChange={e => set('duration', e.target.value)}
              />
            </div>
            <div>
              <label className="text-[11px] font-medium mb-1 block" style={{ color: 'var(--fd-ink-4)' }}>Date & Time</label>
              <input
                type="datetime-local"
                className="w-full rounded-lg px-3 py-2 text-[13px] outline-none"
                style={{ background: 'var(--fd-surface-sunken)', border: '1px solid var(--fd-border)', color: 'var(--fd-ink-1)' }}
                value={form.callDate}
                onChange={e => set('callDate', e.target.value)}
              />
            </div>
          </div>

          {/* Outcome */}
          <div>
            <label className="text-[11px] font-medium mb-2 block" style={{ color: 'var(--fd-ink-4)' }}>Outcome *</label>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(OUTCOME_META).map(([k, meta]) => {
                const Icon = meta.icon;
                const selected = form.outcome === k;
                return (
                  <button
                    key={k}
                    onClick={() => set('outcome', k)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] font-medium transition-all"
                    style={{
                      background: selected ? meta.bg : 'var(--fd-surface-sunken)',
                      border: `1px solid ${selected ? meta.color : 'var(--fd-border)'}`,
                      color: selected ? meta.color : 'var(--fd-ink-3)',
                    }}
                  >
                    <Icon size={13} />
                    {meta.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Converted flag */}
          <label className="flex items-center gap-3 cursor-pointer">
            <div
              onClick={() => set('convertedToLead', !form.convertedToLead)}
              className="w-10 h-5 rounded-full relative transition-all"
              style={{ background: form.convertedToLead ? '#4f6ef0' : 'var(--fd-border)' }}
            >
              <div
                className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all"
                style={{ left: form.convertedToLead ? '22px' : '2px' }}
              />
            </div>
            <span className="text-[12px] font-medium" style={{ color: 'var(--fd-ink-2)' }}>
              This call was converted to a lead
            </span>
          </label>

          {/* Notes */}
          <div>
            <label className="text-[11px] font-medium mb-1 block" style={{ color: 'var(--fd-ink-4)' }}>Notes</label>
            <textarea
              rows={3}
              className="w-full rounded-lg px-3 py-2 text-[13px] outline-none resize-none"
              style={{ background: 'var(--fd-surface-sunken)', border: '1px solid var(--fd-border)', color: 'var(--fd-ink-1)' }}
              placeholder="What did they say? Any objections? Next steps?"
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
            />
          </div>

          {err && (
            <div className="text-[12px] px-3 py-2 rounded-lg" style={{ background: 'rgba(248,113,113,0.1)', color: '#f87171', border: '1px solid rgba(248,113,113,0.2)' }}>
              {err}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4" style={{ borderTop: '1px solid var(--fd-border)' }}>
          <button onClick={onClose} className="btn-ghost px-4 py-2 text-[13px] rounded-lg">Cancel</button>
          <button
            onClick={submit}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-medium text-white transition-opacity"
            style={{ background: '#4f6ef0', opacity: saving ? 0.7 : 1 }}
          >
            {saving ? 'Saving…' : (editLog ? 'Save Changes' : 'Log Call')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Mini Bar Chart ────────────────────────────────────────────────────────────
function MiniBarChart({ data }) {
  if (!data?.length) return <div className="text-[12px]" style={{ color: 'var(--fd-ink-5)' }}>No data yet</div>;
  const max = Math.max(...data.map(d => d.total), 1);
  return (
    <div className="flex items-end gap-1 h-16">
      {data.map((d, i) => {
        const label = `${d._id.month}/${d._id.day}`;
        const pct = (d.total / max) * 100;
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1" title={`${label}: ${d.total} calls`}>
            <div className="w-full rounded-sm relative" style={{ height: '44px', background: 'var(--fd-surface-sunken)' }}>
              <div
                className="absolute bottom-0 left-0 right-0 rounded-sm transition-all"
                style={{ height: `${pct}%`, background: '#4f6ef0', opacity: 0.8 }}
              />
              {d.converted > 0 && (
                <div
                  className="absolute bottom-0 left-0 right-0 rounded-sm"
                  style={{ height: `${(d.converted / max) * 100}%`, background: '#818cf8' }}
                />
              )}
            </div>
            <span className="text-[9px]" style={{ color: 'var(--fd-ink-5)' }}>{label}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Outcome Donut ─────────────────────────────────────────────────────────────
function OutcomePills({ data }) {
  const total = data.reduce((s, d) => s + d.count, 0) || 1;
  return (
    <div className="flex flex-col gap-1.5">
      {data.slice(0, 6).map(d => {
        const meta = OUTCOME_META[d._id] || { label: d._id, color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' };
        const pct = Math.round((d.count / total) * 100);
        return (
          <div key={d._id} className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: meta.color }} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[11px] font-medium truncate" style={{ color: 'var(--fd-ink-2)' }}>{meta.label}</span>
                <span className="text-[11px]" style={{ color: 'var(--fd-ink-4)' }}>{d.count} ({pct}%)</span>
              </div>
              <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--fd-surface-sunken)' }}>
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: meta.color }} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function CallTrackerPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  const [stats, setStats]           = useState(null);
  const [logs, setLogs]             = useState([]);
  const [total, setTotal]           = useState(0);
  const [page, setPage]             = useState(1);
  const [loading, setLoading]       = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [showModal, setShowModal]   = useState(false);
  const [editLog, setEditLog]       = useState(null);
  const [search, setSearch]         = useState('');
  const [filterOutcome, setFilterOutcome] = useState('');
  const [filterType, setFilterType] = useState('');
  const [deleting, setDeleting]     = useState(null);

  const LIMIT = 20;

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const { data } = await api.get('/call-logs/stats');
      setStats(data);
    } catch (e) {
      console.error(e);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const loadLogs = useCallback(async (pg = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: pg, limit: LIMIT });
      if (filterOutcome) params.append('outcome', filterOutcome);
      if (filterType)    params.append('callType', filterType);
      const { data } = await api.get(`/call-logs?${params}`);
      setLogs(data.logs);
      setTotal(data.total);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [filterOutcome, filterType]);

  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => { setPage(1); loadLogs(1); }, [loadLogs]);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this call log?')) return;
    setDeleting(id);
    try {
      await api.delete(`/call-logs/${id}`);
      loadLogs(page);
      loadStats();
    } finally {
      setDeleting(null);
    }
  };

  const convRate = stats?.conversionRate?.total
    ? Math.round((stats.conversionRate.converted / stats.conversionRate.total) * 100)
    : 0;

  const filtered = search
    ? logs.filter(l =>
        [l.prospectName, l.prospectPhone, l.prospectCompany].some(v =>
          v?.toLowerCase().includes(search.toLowerCase())
        )
      )
    : logs;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-[20px] font-bold" style={{ color: 'var(--fd-ink-1)' }}>
            Call Tracker
          </h1>
          <p className="text-[13px] mt-0.5" style={{ color: 'var(--fd-ink-4)' }}>
            Log and monitor outbound prospecting calls
          </p>
        </div>
        <button
          onClick={() => { setEditLog(null); setShowModal(true); }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-medium text-white"
          style={{ background: '#4f6ef0' }}
        >
          <Plus size={15} />
          Log a Call
        </button>
      </div>

      {/* Stats Grid */}
      {statsLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-xl p-4 h-24 animate-pulse" style={{ background: 'var(--fd-surface)', border: '1px solid var(--fd-border)' }} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            icon={Phone}
            label="Calls Today"
            value={stats?.today?.total ?? 0}
            sub={`${fmtDuration(stats?.today?.totalDuration)} total talk time`}
            color="#4f6ef0"
          />
          <StatCard
            icon={PhoneCall}
            label="Connected Today"
            value={stats?.today?.connected ?? 0}
            sub={stats?.today?.total ? `${Math.round((stats.today.connected / stats.today.total) * 100)}% connect rate` : 'No calls yet'}
            color="#34d399"
          />
          <StatCard
            icon={Target}
            label="This Week"
            value={stats?.week?.total ?? 0}
            sub={`${stats?.week?.converted ?? 0} converted to leads`}
            color="#fb923c"
          />
          <StatCard
            icon={Zap}
            label="Conversion Rate"
            value={`${convRate}%`}
            sub={`${stats?.conversionRate?.converted ?? 0} of ${stats?.conversionRate?.total ?? 0} calls`}
            color="#818cf8"
          />
        </div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* 7-day bar chart */}
        <div className="lg:col-span-2 rounded-xl p-4" style={{ background: 'var(--fd-surface)', border: '1px solid var(--fd-border)' }}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-[13px] font-semibold" style={{ color: 'var(--fd-ink-1)' }}>Daily Calls — Last 7 Days</span>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full" style={{ background: '#4f6ef0' }} /><span className="text-[10px]" style={{ color: 'var(--fd-ink-4)' }}>Total</span></div>
              <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full" style={{ background: '#818cf8' }} /><span className="text-[10px]" style={{ color: 'var(--fd-ink-4)' }}>Converted</span></div>
            </div>
          </div>
          <MiniBarChart data={stats?.daily7 || []} />
        </div>

        {/* Outcome breakdown */}
        <div className="rounded-xl p-4" style={{ background: 'var(--fd-surface)', border: '1px solid var(--fd-border)' }}>
          <span className="text-[13px] font-semibold block mb-3" style={{ color: 'var(--fd-ink-1)' }}>Outcomes (30 days)</span>
          {stats?.outcomeBreakdown?.length
            ? <OutcomePills data={stats.outcomeBreakdown} />
            : <p className="text-[12px]" style={{ color: 'var(--fd-ink-5)' }}>No data yet</p>
          }
        </div>
      </div>

      {/* Admin leaderboard */}
      {isAdmin && stats?.pmLeaderboard?.length > 0 && (
        <div className="rounded-xl p-4" style={{ background: 'var(--fd-surface)', border: '1px solid var(--fd-border)' }}>
          <div className="flex items-center gap-2 mb-3">
            <Users size={14} style={{ color: '#4f6ef0' }} />
            <span className="text-[13px] font-semibold" style={{ color: 'var(--fd-ink-1)' }}>Team Leaderboard (All Time)</span>
          </div>
          <div className="flex flex-wrap gap-3">
            {stats.pmLeaderboard.map((pm, i) => (
              <div key={pm._id || i} className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'var(--fd-surface-sunken)', border: '1px solid var(--fd-border)' }}>
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 overflow-hidden" style={{ background: '#4f6ef0' }}>
                  {pm.avatar ? <img src={pm.avatar} alt="" className="w-full h-full object-cover" /> : getInitials(pm.name || '?')}
                </div>
                <div>
                  <div className="text-[12px] font-medium" style={{ color: 'var(--fd-ink-1)' }}>{pm.name || 'Unknown'}</div>
                  <div className="text-[10px]" style={{ color: 'var(--fd-ink-4)' }}>{pm.total} calls · {pm.converted} leads</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Call Log Table */}
      <div className="rounded-xl overflow-hidden" style={{ background: 'var(--fd-surface)', border: '1px solid var(--fd-border)' }}>

        {/* Table toolbar */}
        <div className="flex flex-wrap items-center gap-2 px-4 py-3" style={{ borderBottom: '1px solid var(--fd-border)' }}>
          <div className="flex-1 min-w-[160px] relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--fd-ink-4)' }} />
            <input
              className="w-full pl-8 pr-3 py-1.5 rounded-lg text-[12px] outline-none"
              style={{ background: 'var(--fd-surface-sunken)', border: '1px solid var(--fd-border)', color: 'var(--fd-ink-1)' }}
              placeholder="Search prospects…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select
            className="rounded-lg px-3 py-1.5 text-[12px] outline-none"
            style={{ background: 'var(--fd-surface-sunken)', border: '1px solid var(--fd-border)', color: 'var(--fd-ink-2)' }}
            value={filterOutcome}
            onChange={e => setFilterOutcome(e.target.value)}
          >
            <option value="">All Outcomes</option>
            {Object.entries(OUTCOME_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select
            className="rounded-lg px-3 py-1.5 text-[12px] outline-none"
            style={{ background: 'var(--fd-surface-sunken)', border: '1px solid var(--fd-border)', color: 'var(--fd-ink-2)' }}
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
          >
            <option value="">All Types</option>
            {Object.entries(CALL_TYPE_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <span className="text-[11px] ml-auto" style={{ color: 'var(--fd-ink-5)' }}>{total} total</span>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--fd-border)' }}>
                {['Prospect', 'Company', 'Type', 'Outcome', 'Duration', 'Date', isAdmin && 'By', ''].filter(Boolean).map(h => (
                  <th key={h} className="px-4 py-2.5 text-left font-semibold" style={{ color: 'var(--fd-ink-4)', background: 'var(--fd-surface-sunken)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--fd-border)' }}>
                    {[...Array(isAdmin ? 8 : 7)].map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-3 rounded animate-pulse" style={{ background: 'var(--fd-surface-sunken)', width: j === 0 ? '80%' : '60%' }} /></td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 8 : 7} className="text-center py-12">
                    <PhoneMissed size={24} className="mx-auto mb-2" style={{ color: 'var(--fd-ink-5)' }} />
                    <div style={{ color: 'var(--fd-ink-4)' }}>No call logs yet</div>
                  </td>
                </tr>
              ) : filtered.map(log => {
                const outMeta = OUTCOME_META[log.outcome] || { label: log.outcome, color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' };
                const typeMeta = CALL_TYPE_META[log.callType] || { label: log.callType, color: '#94a3b8' };
                return (
                  <tr
                    key={log._id}
                    style={{ borderBottom: '1px solid var(--fd-border)', transition: 'background 0.1s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--fd-surface-sunken)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium" style={{ color: 'var(--fd-ink-1)' }}>{log.prospectName || '—'}</div>
                      {log.prospectPhone && <div style={{ color: 'var(--fd-ink-4)' }}>{log.prospectPhone}</div>}
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--fd-ink-3)' }}>{log.prospectCompany || '—'}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-medium" style={{ background: `${typeMeta.color}18`, color: typeMeta.color }}>
                        {typeMeta.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-medium" style={{ background: outMeta.bg, color: outMeta.color }}>
                        {outMeta.label}
                      </span>
                      {log.convertedToLead && (
                        <span className="ml-1 text-[10px] font-medium" style={{ color: '#818cf8' }}>→ Lead</span>
                      )}
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--fd-ink-3)' }}>{fmtDuration(log.duration)}</td>
                    <td className="px-4 py-3 whitespace-nowrap" style={{ color: 'var(--fd-ink-3)' }}>{fmtDate(log.callDate)}</td>
                    {isAdmin && (
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <div className="w-5 h-5 rounded-full bg-[#4f6ef0] flex items-center justify-center text-white text-[9px] font-bold overflow-hidden">
                            {log.performedBy?.avatar
                              ? <img src={log.performedBy.avatar} alt="" className="w-full h-full object-cover" />
                              : getInitials(log.performedBy?.name || '?')}
                          </div>
                          <span style={{ color: 'var(--fd-ink-3)' }}>{log.performedBy?.name?.split(' ')[0] || '—'}</span>
                        </div>
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          className="btn-ghost p-1 rounded"
                          title="Edit"
                          onClick={() => { setEditLog(log); setShowModal(true); }}
                        >
                          <Edit3 size={13} style={{ color: 'var(--fd-ink-4)' }} />
                        </button>
                        <button
                          className="btn-ghost p-1 rounded"
                          title="Delete"
                          disabled={deleting === log._id}
                          onClick={() => handleDelete(log._id)}
                        >
                          <Trash2 size={13} style={{ color: deleting === log._id ? 'var(--fd-ink-5)' : '#f87171' }} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {total > LIMIT && (
          <div className="flex items-center justify-between px-4 py-3" style={{ borderTop: '1px solid var(--fd-border)' }}>
            <span className="text-[11px]" style={{ color: 'var(--fd-ink-4)' }}>
              {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, total)} of {total}
            </span>
            <div className="flex items-center gap-1">
              <button
                disabled={page <= 1}
                className="btn-ghost p-1.5 rounded disabled:opacity-40"
                onClick={() => { const p = page - 1; setPage(p); loadLogs(p); }}
              >
                <ChevronLeft size={14} />
              </button>
              <button
                disabled={page >= Math.ceil(total / LIMIT)}
                className="btn-ghost p-1.5 rounded disabled:opacity-40"
                onClick={() => { const p = page + 1; setPage(p); loadLogs(p); }}
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Log Modal */}
      {showModal && (
        <LogCallModal
          editLog={editLog}
          onClose={() => { setShowModal(false); setEditLog(null); }}
          onSaved={() => { loadLogs(page); loadStats(); }}
        />
      )}
    </div>
  );
}
