import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Building2, CheckSquare, Target, Users, X, ArrowRight, Loader2 } from 'lucide-react';
import api from '../../lib/api';

const TYPE_META = {
  client: { icon: Building2, color: '#4f6ef0', label: 'Client',  path: (r) => `/admin/clients/${r._id}` },
  task:   { icon: CheckSquare, color: '#f59e0b', label: 'Task',  path: (r) => `/admin/tasks` },
  lead:   { icon: Target, color: '#22c55e', label: 'Lead',       path: (r) => `/admin/leads` },
  user:   { icon: Users, color: '#a855f7', label: 'Team',        path: (r) => `/admin/team/${r._id}` },
};

const STATUS_COLORS = {
  pending: '#f59e0b', in_progress: '#4f6ef0', review: '#a855f7',
  completed: '#22c55e', cancelled: '#ef4444',
  new: '#4f6ef0', contacted: '#f59e0b', qualified: '#22c55e',
  converted: '#22c55e', lost: '#ef4444',
};

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function GlobalSearch({ isOpen, onClose }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(0);
  const inputRef = useRef(null);
  const navigate = useNavigate();
  const debounced = useDebounce(query, 220);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setResults(null);
      setSelected(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Search
  useEffect(() => {
    if (!debounced || debounced.length < 2) { setResults(null); return; }
    setLoading(true);
    api.get(`/search?q=${encodeURIComponent(debounced)}`)
      .then(r => setResults(r.data.results))
      .catch(() => setResults(null))
      .finally(() => setLoading(false));
  }, [debounced]);

  // Flatten results for keyboard nav
  const flat = results
    ? [
        ...results.users.map(r  => ({ ...r, _type: 'user' })),
        ...results.clients.map(r => ({ ...r, _type: 'client' })),
        ...results.tasks.map(r  => ({ ...r, _type: 'task' })),
        ...results.leads.map(r  => ({ ...r, _type: 'lead' })),
      ]
    : [];

  const navigateTo = useCallback((item) => {
    const meta = TYPE_META[item._type];
    if (meta) navigate(meta.path(item));
    onClose();
  }, [navigate, onClose]);

  // Keyboard nav
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, flat.length - 1)); }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)); }
      if (e.key === 'Enter' && flat[selected]) { navigateTo(flat[selected]); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, flat, selected, navigateTo, onClose]);

  if (!isOpen) return null;

  const hasResults = flat.length > 0;

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[12vh] px-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 backdrop-blur-sm"
        style={{ background: 'rgba(0,0,0,0.4)' }}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="relative w-full max-w-xl rounded-2xl overflow-hidden animate-scale-in"
        style={{
          background: 'var(--fd-modal-bg)',
          border: '1px solid var(--fd-modal-border)',
          boxShadow: '0 24px 80px -8px rgba(0,0,0,0.3), 0 8px 24px rgba(0,0,0,0.12)',
        }}
      >
        {/* Input row */}
        <div
          className="flex items-center gap-3 px-4"
          style={{ borderBottom: '1px solid var(--fd-border)' }}
        >
          {loading
            ? <Loader2 size={16} className="animate-spin flex-shrink-0" style={{ color: 'var(--fd-ink-4)' }} />
            : <Search size={16} className="flex-shrink-0" style={{ color: 'var(--fd-ink-4)' }} />
          }
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setSelected(0); }}
            placeholder="Search tasks, clients, leads, team…"
            className="flex-1 py-4 bg-transparent outline-none text-[14px]"
            style={{ color: 'var(--fd-ink-1)' }}
            autoComplete="off"
          />
          {query && (
            <button onClick={() => { setQuery(''); setResults(null); }} className="btn-ghost p-1">
              <X size={13} />
            </button>
          )}
          <kbd
            className="text-[10px] px-1.5 py-0.5 rounded font-mono flex-shrink-0"
            style={{
              background: 'var(--fd-surface-sunken)',
              color: 'var(--fd-ink-4)',
              border: '1px solid var(--fd-border)',
            }}
          >
            ESC
          </kbd>
        </div>

        {/* Results */}
        {results && (
          <div className="max-h-[420px] overflow-y-auto py-2">
            {!hasResults && (
              <div className="py-12 text-center text-[13px]" style={{ color: 'var(--fd-ink-4)' }}>
                No results for &ldquo;{query}&rdquo;
              </div>
            )}

            {/* Group by type */}
            {(['user', 'client', 'task', 'lead']).map(type => {
              const group = flat.filter(r => r._type === type);
              if (!group.length) return null;
              const meta = TYPE_META[type];
              const Icon = meta.icon;
              const groupLabel = { user: 'Team', client: 'Clients', task: 'Tasks', lead: 'Leads' }[type];

              return (
                <div key={type} className="mb-1">
                  <div
                    className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-widest"
                    style={{ color: 'var(--fd-ink-4)' }}
                  >
                    {groupLabel}
                  </div>
                  {group.map(item => {
                    const idx = flat.indexOf(item);
                    const isActive = idx === selected;

                    return (
                      <button
                        key={item._id}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors"
                        style={{
                          background: isActive ? 'var(--fd-sidebar-active)' : 'transparent',
                        }}
                        onMouseEnter={() => setSelected(idx)}
                        onClick={() => navigateTo(item)}
                      >
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ background: `${meta.color}18` }}
                        >
                          <Icon size={13} style={{ color: meta.color }} />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] font-medium truncate" style={{ color: 'var(--fd-ink-1)' }}>
                            {item.name || item.title || item.company || item.email}
                          </div>
                          <div className="text-[11px] truncate" style={{ color: 'var(--fd-ink-4)' }}>
                            {item._type === 'task'   && `${item.client?.company || ''} · ${item.status}`}
                            {item._type === 'client' && item.industry}
                            {item._type === 'user'   && item.role?.replace(/_/g, ' ')}
                            {item._type === 'lead'   && `${item.client?.company || ''} · ${item.status}`}
                          </div>
                        </div>

                        {item.status && (
                          <span
                            className="text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0"
                            style={{
                              background: `${STATUS_COLORS[item.status] || '#aaa'}18`,
                              color: STATUS_COLORS[item.status] || 'var(--fd-ink-3)',
                            }}
                          >
                            {item.status}
                          </span>
                        )}

                        <ArrowRight size={11} style={{ color: 'var(--fd-ink-5)', flexShrink: 0 }} />
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}

        {/* Empty / hint state */}
        {!results && !loading && (
          <div className="py-8 px-4">
            <div className="flex flex-wrap gap-2">
              {['clients', 'tasks', 'leads', 'team'].map(hint => (
                <button
                  key={hint}
                  onClick={() => setQuery(hint)}
                  className="text-[12px] px-3 py-1.5 rounded-lg transition-colors"
                  style={{
                    background: 'var(--fd-surface-sunken)',
                    color: 'var(--fd-ink-3)',
                    border: '1px solid var(--fd-border)',
                  }}
                >
                  Search {hint}
                </button>
              ))}
            </div>
            <p className="mt-3 text-[11.5px]" style={{ color: 'var(--fd-ink-5)' }}>
              Tip: press <kbd className="font-mono">⌘K</kbd> anytime to open search
            </p>
          </div>
        )}

        {/* Footer */}
        <div
          className="px-4 py-2.5 flex items-center gap-4 text-[11px]"
          style={{ borderTop: '1px solid var(--fd-border)', color: 'var(--fd-ink-5)' }}
        >
          <span><kbd className="font-mono">↑↓</kbd> navigate</span>
          <span><kbd className="font-mono">↵</kbd> open</span>
          <span><kbd className="font-mono">esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}
