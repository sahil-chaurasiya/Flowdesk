import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity, Search, RefreshCw, User, CheckSquare, Target,
  Building2, File, LogIn, LogOut, Settings, Calendar, X,
} from 'lucide-react';
import api from '../../lib/api';
import { timeAgo, formatDate } from '../../lib/utils';
import { Button } from '../../components/ui/index';
import { Spinner, EmptyState } from '../../components/shared/LoadingScreen';

// ─── Action Metadata ──────────────────────────────────────────────────────────
const ACTION_META = {
  'auth.login':            { icon: LogIn,       color: '#22c55e', label: 'Signed in' },
  'auth.logout':           { icon: LogOut,      color: '#94a3b8', label: 'Signed out' },
  'auth.password_changed': { icon: Settings,    color: '#f59e0b', label: 'Password changed' },
  'user.created':          { icon: User,        color: '#4f6ef0', label: 'User created' },
  'user.updated':          { icon: User,        color: '#4f6ef0', label: 'User updated' },
  'user.deactivated':      { icon: User,        color: '#ef4444', label: 'User deactivated' },
  'task.created':          { icon: CheckSquare, color: '#4f6ef0', label: 'Task created' },
  'task.updated':          { icon: CheckSquare, color: '#f59e0b', label: 'Task updated' },
  'task.status_changed':   { icon: CheckSquare, color: '#a855f7', label: 'Status changed' },
  'task.assigned':         { icon: CheckSquare, color: '#4f6ef0', label: 'Task assigned' },
  'task.deleted':          { icon: CheckSquare, color: '#ef4444', label: 'Task deleted' },
  'lead.uploaded':         { icon: Target,      color: '#22c55e', label: 'Leads uploaded' },
  'lead.status_changed':   { icon: Target,      color: '#f59e0b', label: 'Lead updated' },
  'lead.deleted':          { icon: Target,      color: '#ef4444', label: 'Lead deleted' },
  'client.created':        { icon: Building2,   color: '#4f6ef0', label: 'Client created' },
  'client.updated':        { icon: Building2,   color: '#f59e0b', label: 'Client updated' },
  'file.uploaded':         { icon: File,        color: '#22c55e', label: 'File uploaded' },
  'settings.updated':      { icon: Settings,    color: '#4f6ef0', label: 'Settings updated' },
};

function getActionMeta(action) {
  return ACTION_META[action] || { icon: Activity, color: '#a8a49e', label: action };
}

const ACTION_GROUPS = [
  { value: '',         label: 'All',      icon: Activity },
  { value: 'auth',     label: 'Auth',     icon: LogIn },
  { value: 'task',     label: 'Tasks',    icon: CheckSquare },
  { value: 'lead',     label: 'Leads',    icon: Target },
  { value: 'client',   label: 'Clients',  icon: Building2 },
  { value: 'file',     label: 'Files',    icon: File },
  { value: 'settings', label: 'Settings', icon: Settings },
];

// ─── Quick date-range presets ─────────────────────────────────────────────────
const DATE_PRESETS = [
  { label: 'Today',      getDates: () => { const d = new Date(); return { from: toDateStr(d), to: toDateStr(d) }; } },
  { label: 'Yesterday',  getDates: () => { const d = new Date(); d.setDate(d.getDate()-1); return { from: toDateStr(d), to: toDateStr(d) }; } },
  { label: 'Last 7 days',getDates: () => { const t = new Date(), f = new Date(); f.setDate(f.getDate()-6); return { from: toDateStr(f), to: toDateStr(t) }; } },
  { label: 'Last 30 days',getDates:() => { const t = new Date(), f = new Date(); f.setDate(f.getDate()-29); return { from: toDateStr(f), to: toDateStr(t) }; } },
  { label: 'This month', getDates: () => { const n = new Date(); return { from: toDateStr(new Date(n.getFullYear(), n.getMonth(), 1)), to: toDateStr(n) }; } },
];

function toDateStr(d) {
  return d.toISOString().slice(0, 10);
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, color }) {
  return (
    <div
      className="rounded-2xl p-4 flex flex-col gap-1"
      style={{ background: 'var(--fd-surface)', border: '1px solid var(--fd-border)' }}
    >
      <div className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--fd-ink-4)' }}>
        {label}
      </div>
      <div className="text-[26px] font-black tracking-tight leading-none" style={{ color: color || 'var(--fd-ink-1)' }}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
    </div>
  );
}

// ─── Log Row ──────────────────────────────────────────────────────────────────
function LogRow({ log, isLast }) {
  const meta = getActionMeta(log.action);
  const Icon = meta.icon;
  const name = log.actor?.name || log.actorName || 'System';
  const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="flex gap-4 group">
      {/* Timeline spine */}
      <div className="flex flex-col items-center flex-shrink-0" style={{ width: 32 }}>
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ring-4 ring-[var(--fd-canvas)] z-10"
          style={{ background: `${meta.color}18`, border: `1.5px solid ${meta.color}30` }}
        >
          <Icon size={13} style={{ color: meta.color }} />
        </div>
        {!isLast && (
          <div className="w-px flex-1 mt-1" style={{ background: 'var(--fd-border-subtle)', minHeight: 20 }} />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pb-5">
        <div
          className="rounded-xl px-4 py-3 transition-colors group-hover:border-[var(--fd-border-strong)]"
          style={{ background: 'var(--fd-surface)', border: '1px solid var(--fd-border)' }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5 flex-wrap min-w-0">
              {/* Actor avatar */}
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-[9px] font-black"
                style={{ background: `${meta.color}20`, color: meta.color }}
              >
                {initials}
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[13px] font-semibold" style={{ color: 'var(--fd-ink-1)' }}>
                    {name}
                  </span>
                  <span
                    className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full"
                    style={{ background: `${meta.color}12`, color: meta.color }}
                  >
                    <Icon size={9} />
                    {meta.label}
                  </span>
                  {log.entity?.name && (
                    <span
                      className="text-[11px] px-2 py-0.5 rounded-full font-medium truncate max-w-[180px]"
                      style={{ background: 'var(--fd-surface-sunken)', color: 'var(--fd-ink-3)' }}
                    >
                      {log.entity.name}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap" style={{ fontSize: 11, color: 'var(--fd-ink-4)' }}>
                  {log.actorRole && <span>{log.actorRole.replace(/_/g, ' ')}</span>}
                  {log.ip && (
                    <>
                      <span>·</span>
                      <span className="font-mono text-[10.5px]">{log.ip}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <time className="text-[11px] flex-shrink-0 font-medium" style={{ color: 'var(--fd-ink-5)' }}>
              {timeAgo(log.createdAt)}
            </time>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ActivityPage() {
  const [logs, setLogs]         = useState([]);
  const [total, setTotal]       = useState(0);
  const [page, setPage]         = useState(1);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [filter, setFilter]     = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo]     = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const LIMIT = 40;

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: LIMIT });
      if (search)   params.append('search', search);
      if (filter)   params.append('action', filter);
      if (dateFrom) params.append('from', new Date(dateFrom).toISOString());
      if (dateTo) {
        // Include the full end day (set to end of day)
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        params.append('to', end.toISOString());
      }
      const { data } = await api.get(`/activity?${params}`);
      setLogs(data.logs || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error(err);
    } finally { setLoading(false); }
  }, [page, search, filter, dateFrom, dateTo]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const applyPreset = (preset) => {
    const { from, to } = preset.getDates();
    setDateFrom(from);
    setDateTo(to);
    setPage(1);
    setShowDatePicker(false);
  };

  const clearDates = () => {
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };

  const hasDateFilter = dateFrom || dateTo;

  // Format active date range label
  const dateLabelParts = [];
  if (dateFrom) dateLabelParts.push(formatDate(dateFrom));
  if (dateTo && dateTo !== dateFrom) dateLabelParts.push(formatDate(dateTo));
  const dateLabel = dateLabelParts.join(' – ');

  // Compute quick stats from current page
  const authCount   = logs.filter(l => l.action?.startsWith('auth')).length;
  const taskCount   = logs.filter(l => l.action?.startsWith('task')).length;
  const leadCount   = logs.filter(l => l.action?.startsWith('lead')).length;

  const totalPages = Math.ceil(total / LIMIT);
  const start = (page - 1) * LIMIT + 1;
  const end   = Math.min(page * LIMIT, total);

  return (
    <div className="animate-fade-in space-y-6">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold tracking-[-0.02em]" style={{ color: 'var(--fd-ink-1)' }}>
            Activity Log
          </h1>
          <p className="text-[13px] mt-0.5" style={{ color: 'var(--fd-ink-4)' }}>
            Audit trail for all team actions
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={fetchLogs} disabled={loading}>
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Refresh
        </Button>
      </div>

      {/* ── Stats strip ── */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard label="Total events" value={total}     color="#4f6ef0" />
        <StatCard label="Auth events"  value={authCount} color="#22c55e" />
        <StatCard label="Task events"  value={taskCount} color="#a855f7" />
        <StatCard label="Lead events"  value={leadCount} color="#f59e0b" />
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--fd-ink-4)' }} />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by name, action…"
            className="fd-input pl-9 w-full text-[13px]"
          />
        </div>

        {/* Date filter */}
        <div className="relative">
          <button
            onClick={() => setShowDatePicker(v => !v)}
            className="inline-flex items-center gap-2 text-[12px] font-medium px-3 py-1.5 rounded-lg transition-all"
            style={{
              background: hasDateFilter ? '#eff0fe' : 'var(--fd-surface)',
              border: `1px solid ${hasDateFilter ? '#4f6ef0' : 'var(--fd-border)'}`,
              color: hasDateFilter ? '#3a56d4' : 'var(--fd-ink-3)',
            }}
          >
            <Calendar size={13} />
            {hasDateFilter ? dateLabel : 'Date Range'}
            {hasDateFilter && (
              <span
                onClick={e => { e.stopPropagation(); clearDates(); }}
                className="ml-1 rounded p-0.5 hover:opacity-70"
              >
                <X size={10} />
              </span>
            )}
          </button>

          {showDatePicker && (
            <div
              className="absolute z-30 top-full mt-1 left-0 rounded-2xl shadow-xl overflow-hidden"
              style={{ background: 'var(--fd-surface)', border: '1px solid var(--fd-border)', minWidth: 280 }}
            >
              {/* Quick presets */}
              <div className="p-3 border-b" style={{ borderColor: 'var(--fd-border)' }}>
                <p className="text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--fd-ink-4)' }}>Quick Select</p>
                <div className="flex flex-wrap gap-1.5">
                  {DATE_PRESETS.map(preset => (
                    <button
                      key={preset.label}
                      onClick={() => applyPreset(preset)}
                      className="text-[11px] font-semibold px-2.5 py-1 rounded-full transition-all"
                      style={{ background: 'var(--fd-surface-sunken)', color: 'var(--fd-ink-2)', border: '1px solid var(--fd-border)' }}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom range */}
              <div className="p-3 space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--fd-ink-4)' }}>Custom Range</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-medium mb-1" style={{ color: 'var(--fd-ink-3)' }}>From</label>
                    <input
                      type="date"
                      value={dateFrom}
                      max={dateTo || undefined}
                      onChange={e => { setDateFrom(e.target.value); setPage(1); }}
                      className="fd-input text-[12px] w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium mb-1" style={{ color: 'var(--fd-ink-3)' }}>To</label>
                    <input
                      type="date"
                      value={dateTo}
                      min={dateFrom || undefined}
                      onChange={e => { setDateTo(e.target.value); setPage(1); }}
                      className="fd-input text-[12px] w-full"
                    />
                  </div>
                </div>
                <div className="flex justify-between pt-1">
                  <button
                    onClick={clearDates}
                    className="text-[11px] font-medium px-2 py-1 rounded-lg"
                    style={{ color: 'var(--fd-ink-4)' }}
                  >
                    Clear
                  </button>
                  <button
                    onClick={() => setShowDatePicker(false)}
                    className="text-[11px] font-semibold px-3 py-1 rounded-lg"
                    style={{ background: '#4f6ef0', color: '#fff' }}
                  >
                    Apply
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Category pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {ACTION_GROUPS.map(g => {
            const GIcon = g.icon;
            const active = filter === g.value;
            return (
              <button
                key={g.value}
                onClick={() => { setFilter(g.value); setPage(1); }}
                className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold px-3 py-1.5 rounded-full transition-all"
                style={
                  active
                    ? { background: '#4f6ef0', color: '#fff', boxShadow: '0 2px 8px rgba(79,110,240,0.3)' }
                    : { background: 'var(--fd-surface)', border: '1px solid var(--fd-border)', color: 'var(--fd-ink-3)' }
                }
              >
                <GIcon size={11} />
                {g.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Active date range indicator */}
      {hasDateFilter && (
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-[12px] font-medium"
          style={{ background: '#eff0fe', border: '1px solid #c7cdfb', color: '#3a56d4' }}
        >
          <Calendar size={13} />
          Showing activity: <strong>{dateLabel}</strong>
          <button onClick={clearDates} className="ml-auto p-0.5 rounded hover:opacity-70">
            <X size={12} />
          </button>
        </div>
      )}

      {/* ── Timeline ── */}
      <div>
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Spinner size="lg" />
          </div>
        ) : logs.length === 0 ? (
          <div className="rounded-2xl" style={{ background: 'var(--fd-surface)', border: '1px solid var(--fd-border)' }}>
            <EmptyState icon={Activity} title="No activity found" description="Try adjusting your filters or date range." />
          </div>
        ) : (
          <div className="pl-0">
            {logs.map((log, i) => (
              <LogRow key={log._id} log={log} isLast={i === logs.length - 1} />
            ))}
          </div>
        )}
      </div>

      {/* ── Pagination ── */}
      {!loading && total > LIMIT && (
        <div
          className="flex items-center justify-between px-4 py-3 rounded-xl"
          style={{ background: 'var(--fd-surface)', border: '1px solid var(--fd-border)' }}
        >
          <span className="text-[12px] font-medium" style={{ color: 'var(--fd-ink-4)' }}>
            Showing {start}–{end} of {total.toLocaleString()} events
          </span>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
              Previous
            </Button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                const p = Math.max(1, Math.min(page - 2, totalPages - 4)) + i;
                return (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className="w-8 h-8 rounded-lg text-[12px] font-semibold transition-all"
                    style={
                      p === page
                        ? { background: '#4f6ef0', color: '#fff' }
                        : { background: 'var(--fd-surface-sunken)', color: 'var(--fd-ink-3)' }
                    }
                  >
                    {p}
                  </button>
                );
              })}
            </div>
            <Button variant="secondary" size="sm" disabled={page * LIMIT >= total} onClick={() => setPage(p => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}