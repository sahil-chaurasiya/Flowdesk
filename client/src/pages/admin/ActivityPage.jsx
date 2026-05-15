import React, { useState, useEffect, useCallback } from 'react';
import { Activity, Search, Filter, RefreshCw, User, CheckSquare, Target, Building2, File, LogIn, LogOut, Settings } from 'lucide-react';
import api from '../../lib/api';
import { timeAgo } from '../../lib/utils';
import { Button, Input } from '../../components/ui/index';
import { Spinner, EmptyState } from '../../components/shared/LoadingScreen';

const ACTION_META = {
  'auth.login':           { icon: LogIn,      color: '#22c55e', label: 'Login' },
  'auth.logout':          { icon: LogOut,     color: '#ef4444', label: 'Logout' },
  'auth.password_changed':{ icon: Settings,   color: '#f59e0b', label: 'Password Changed' },
  'user.created':         { icon: User,       color: '#4f6ef0', label: 'User Created' },
  'user.updated':         { icon: User,       color: '#4f6ef0', label: 'User Updated' },
  'user.deactivated':     { icon: User,       color: '#ef4444', label: 'User Deactivated' },
  'task.created':         { icon: CheckSquare,color: '#4f6ef0', label: 'Task Created' },
  'task.updated':         { icon: CheckSquare,color: '#f59e0b', label: 'Task Updated' },
  'task.status_changed':  { icon: CheckSquare,color: '#a855f7', label: 'Task Status Changed' },
  'task.assigned':        { icon: CheckSquare,color: '#4f6ef0', label: 'Task Assigned' },
  'task.deleted':         { icon: CheckSquare,color: '#ef4444', label: 'Task Deleted' },
  'lead.uploaded':        { icon: Target,     color: '#22c55e', label: 'Leads Uploaded' },
  'lead.status_changed':  { icon: Target,     color: '#f59e0b', label: 'Lead Updated' },
  'lead.deleted':         { icon: Target,     color: '#ef4444', label: 'Lead Deleted' },
  'client.created':       { icon: Building2,  color: '#4f6ef0', label: 'Client Created' },
  'client.updated':       { icon: Building2,  color: '#f59e0b', label: 'Client Updated' },
  'file.uploaded':        { icon: File,       color: '#22c55e', label: 'File Uploaded' },
  'settings.updated':     { icon: Settings,   color: '#4f6ef0', label: 'Settings Updated' },
};

function getActionMeta(action) {
  return ACTION_META[action] || { icon: Activity, color: '#a8a49e', label: action };
}

function LogRow({ log }) {
  const meta  = getActionMeta(log.action);
  const Icon  = meta.icon;

  return (
    <div
      className="flex items-start gap-3 px-5 py-3.5 border-b last:border-0 hover:bg-[var(--fd-table-row-hover)] transition-colors"
      style={{ borderColor: 'var(--fd-table-row-border)' }}
    >
      {/* Icon */}
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{ background: `${meta.color}18` }}
      >
        <Icon size={13} style={{ color: meta.color }} />
      </div>

      {/* Main */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[13px] font-medium" style={{ color: 'var(--fd-ink-1)' }}>
            {meta.label}
          </span>
          {log.entity?.name && (
            <span
              className="text-[11px] px-1.5 py-0.5 rounded truncate max-w-[200px]"
              style={{ background: 'var(--fd-surface-sunken)', color: 'var(--fd-ink-3)' }}
            >
              {log.entity.name}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 mt-0.5 flex-wrap" style={{ color: 'var(--fd-ink-4)', fontSize: 11 }}>
          <span className="font-medium" style={{ color: 'var(--fd-ink-3)' }}>
            {log.actor?.name || log.actorName || 'System'}
          </span>
          <span>·</span>
          <span>{log.actorRole?.replace(/_/g, ' ')}</span>
          {log.ip && (
            <>
              <span>·</span>
              <span className="font-mono">{log.ip}</span>
            </>
          )}
        </div>
      </div>

      {/* Time */}
      <div className="text-[11px] flex-shrink-0 mt-0.5" style={{ color: 'var(--fd-ink-5)' }}>
        {timeAgo(log.createdAt)}
      </div>
    </div>
  );
}

export default function ActivityPage() {
  const [logs, setLogs]       = useState([]);
  const [total, setTotal]     = useState(0);
  const [page, setPage]       = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [filter, setFilter]   = useState('');

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 40 });
      if (search) params.append('search', search);
      if (filter) params.append('action', filter);

      const { data } = await api.get(`/activity?${params}`);
      setLogs(data.logs || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error(err);
    } finally { setLoading(false); }
  }, [page, search, filter]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const ACTION_GROUPS = [
    { value: '',     label: 'All activity' },
    { value: 'auth', label: 'Auth' },
    { value: 'task', label: 'Tasks' },
    { value: 'lead', label: 'Leads' },
    { value: 'client', label: 'Clients' },
    { value: 'file', label: 'Files' },
    { value: 'settings', label: 'Settings' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold tracking-[-0.02em]" style={{ color: 'var(--fd-ink-1)' }}>
            Activity Log
          </h1>
          <p className="text-[13px] mt-1" style={{ color: 'var(--fd-ink-4)' }}>
            {total.toLocaleString()} total events · audit trail for all team actions
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={fetchLogs}>
          <RefreshCw size={13} />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--fd-ink-4)' }} />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by name, action…"
            className="fd-input pl-9 w-full text-[13px]"
          />
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {ACTION_GROUPS.map(g => (
            <button
              key={g.value}
              onClick={() => { setFilter(g.value); setPage(1); }}
              className="text-[11.5px] font-medium px-3 py-1.5 rounded-lg transition-all"
              style={
                filter === g.value
                  ? { background: 'var(--fd-sidebar-active)', color: 'var(--fd-sidebar-link-active)' }
                  : { background: 'var(--fd-surface)', border: '1px solid var(--fd-border)', color: 'var(--fd-ink-3)' }
              }
            >
              {g.label}
            </button>
          ))}
        </div>
      </div>

      {/* Log list */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ background: 'var(--fd-surface)', border: '1px solid var(--fd-border)' }}
      >
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner size="lg" />
          </div>
        ) : logs.length === 0 ? (
          <EmptyState icon={Activity} title="No activity found" description="Try adjusting your filters or search query." />
        ) : (
          logs.map(log => <LogRow key={log._id} log={log} />)
        )}
      </div>

      {/* Pagination */}
      {!loading && total > 40 && (
        <div className="flex items-center justify-between text-[12px]" style={{ color: 'var(--fd-ink-4)' }}>
          <span>Showing {Math.min((page - 1) * 40 + 1, total)}–{Math.min(page * 40, total)} of {total}</span>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
              Previous
            </Button>
            <Button variant="secondary" size="sm" disabled={page * 40 >= total} onClick={() => setPage(p => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
