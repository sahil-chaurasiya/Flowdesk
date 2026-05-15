import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Building2, CheckSquare, Target, Users, X, Loader2 } from 'lucide-react';
import api from '../../lib/api';

const TYPE_META = {
  client: { icon: Building2,   color: '#4f6ef0', label: 'Clients',  path: (r) => `/admin/clients/${r._id}` },
  task:   { icon: CheckSquare, color: '#f59e0b', label: 'Tasks',    path: ()  => `/admin/tasks` },
  lead:   { icon: Target,      color: '#22c55e', label: 'Leads',    path: ()  => `/admin/leads` },
  user:   { icon: Users,       color: '#a855f7', label: 'Team',     path: (r) => `/admin/team/${r._id}` },
};

// Render order for groups
const GROUP_ORDER = ['client', 'task', 'lead', 'user'];

const STATUS_LABELS = {
  pending: 'Pending', in_progress: 'In Progress', review: 'Review',
  completed: 'Completed', cancelled: 'Cancelled',
  new: 'New', contacted: 'Contacted', qualified: 'Qualified',
  converted: 'Converted', lost: 'Lost',
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

// Primary display label per type — fixes client showing contact name instead of company
function getItemLabel(item) {
  if (item._type === 'client') return item.company || item.name;
  if (item._type === 'task')   return item.title;
  if (item._type === 'lead')   return item.name || item.email;
  if (item._type === 'user')   return item.name;
  return item.name || item.title || item.company || item.email;
}

function getItemSub(item) {
  if (item._type === 'task')   return [item.client?.company, STATUS_LABELS[item.status]].filter(Boolean).join(' · ');
  if (item._type === 'client') return [item.industry, item.status ? STATUS_LABELS[item.status] || item.status : null].filter(Boolean).join(' · ');
  if (item._type === 'user')   return item.role?.replace(/_/g, ' ');
  if (item._type === 'lead')   return [item.client?.company, STATUS_LABELS[item.status]].filter(Boolean).join(' · ');
  return '';
}

export default function GlobalSearch({ isOpen, onClose }) {
  const [query, setQuery]     = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(0);
  const inputRef    = useRef(null);
  const listRef     = useRef(null);
  const navigate    = useNavigate();
  const debounced   = useDebounce(query, 220);

  // Focus + reset on open
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setResults(null);
      setSelected(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Fetch
  useEffect(() => {
    if (!debounced || debounced.length < 2) { setResults(null); return; }
    setLoading(true);
    api.get(`/search?q=${encodeURIComponent(debounced)}`)
      .then(r => setResults(r.data.results))
      .catch(() => setResults(null))
      .finally(() => setLoading(false));
  }, [debounced]);

  // Build flat list in the same order groups are rendered — critical for correct keyboard highlight
  const flat = results
    ? GROUP_ORDER.flatMap(type => {
        const key = type === 'user' ? 'users' : type === 'client' ? 'clients' : type + 's';
        return (results[key] || []).map(r => ({ ...r, _type: type }));
      })
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
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelected(s => {
          const next = Math.min(s + 1, flat.length - 1);
          scrollItemIntoView(next);
          return next;
        });
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelected(s => {
          const prev = Math.max(s - 1, 0);
          scrollItemIntoView(prev);
          return prev;
        });
      }
      if (e.key === 'Enter' && flat[selected]) navigateTo(flat[selected]);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, flat, selected, navigateTo, onClose]);

  // Scroll selected item into view within the results list
  function scrollItemIntoView(idx) {
    if (!listRef.current) return;
    const items = listRef.current.querySelectorAll('[data-result-item]');
    items[idx]?.scrollIntoView({ block: 'nearest' });
  }

  if (!isOpen) return null;

  const hasResults = flat.length > 0;
  const showResults = results !== null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center px-4"
      style={{ paddingTop: 'clamp(48px, 10vh, 120px)' }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 backdrop-blur-sm"
        style={{ background: 'rgba(0,0,0,0.45)' }}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="relative w-full max-w-[560px] rounded-2xl overflow-hidden animate-scale-in"
        tabIndex={-1}
        style={{
          background: 'var(--fd-modal-bg)',
          border: '1px solid var(--fd-modal-border)',
          boxShadow: '0 32px 80px -8px rgba(0,0,0,0.35), 0 8px 32px rgba(0,0,0,0.15)',
          outline: 'none',
        }}
      >
        {/* ── Input row ───────────────────────────────────────────── */}
        <div
          className="flex items-center gap-3 px-4"
          style={{ borderBottom: results !== null ? '1px solid var(--fd-border)' : 'none' }}
        >
          <div className="flex-shrink-0 w-4 flex items-center justify-center">
            {loading
              ? <Loader2 size={15} className="animate-spin" style={{ color: 'var(--fd-ink-4)' }} />
              : <Search size={15} style={{ color: 'var(--fd-ink-4)' }} />
            }
          </div>

          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setSelected(0); }}
            placeholder="Search clients, tasks, leads, team…"
            className="flex-1 py-[14px] bg-transparent outline-none text-[14px]"
            style={{
              color: 'var(--fd-ink-1)',
              caretColor: 'var(--fd-sidebar-link-active)',
              boxShadow: 'none',
            }}
            autoComplete="off"
            spellCheck={false}
          />

          {query ? (
            <button
              onClick={() => { setQuery(''); setResults(null); inputRef.current?.focus(); }}
              className="flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center transition-colors"
              style={{ color: 'var(--fd-ink-4)', background: 'var(--fd-surface-sunken)' }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--fd-ink-1)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--fd-ink-4)'}
            >
              <X size={12} />
            </button>
          ) : (
            <kbd
              className="flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded font-mono leading-none"
              style={{
                background: 'var(--fd-surface-sunken)',
                color: 'var(--fd-ink-4)',
                border: '1px solid var(--fd-border)',
              }}
            >
              ESC
            </kbd>
          )}
        </div>

        {/* ── Results ─────────────────────────────────────────────── */}
        {showResults && (
          <div ref={listRef} className="overflow-y-auto" style={{ maxHeight: 400 }}>
            {!hasResults ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2">
                <Search size={20} style={{ color: 'var(--fd-ink-5)' }} />
                <p className="text-[13px]" style={{ color: 'var(--fd-ink-3)' }}>
                  No results for <span style={{ color: 'var(--fd-ink-1)' }}>"{query}"</span>
                </p>
              </div>
            ) : (
              <div className="py-1.5">
                {GROUP_ORDER.map(type => {
                  const key = type === 'user' ? 'users' : type === 'client' ? 'clients' : type + 's';
                  const group = (results[key] || []).map(r => ({ ...r, _type: type }));
                  if (!group.length) return null;
                  const meta = TYPE_META[type];
                  const Icon = meta.icon;

                  return (
                    <div key={type}>
                      {/* Group label */}
                      <div
                        className="px-3 pt-3 pb-1 text-[10.5px] font-semibold uppercase tracking-wider"
                        style={{ color: 'var(--fd-ink-5)' }}
                      >
                        {meta.label}
                      </div>

                      {group.map(item => {
                        const idx = flat.findIndex(f => f._id === item._id && f._type === item._type);
                        const isActive = idx === selected;
                        const sub = getItemSub(item);

                        return (
                          <button
                            key={item._id}
                            data-result-item
                            className="w-full flex items-center gap-3 px-3 py-2 text-left transition-none"
                            style={{
                              background: isActive ? 'var(--fd-sidebar-active)' : 'transparent',
                              borderRadius: 0,
                            }}
                            onMouseEnter={() => setSelected(idx)}
                            onClick={() => navigateTo(item)}
                          >
                            {/* Icon badge */}
                            <div
                              className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                              style={{ background: `${meta.color}1a` }}
                            >
                              <Icon size={13} style={{ color: meta.color }} />
                            </div>

                            {/* Label + sub */}
                            <div className="flex-1 min-w-0">
                              <div
                                className="text-[13px] font-medium truncate leading-snug"
                                style={{ color: 'var(--fd-ink-1)' }}
                              >
                                {getItemLabel(item)}
                              </div>
                              {sub && (
                                <div
                                  className="text-[11px] truncate leading-snug mt-0.5 capitalize"
                                  style={{ color: 'var(--fd-ink-4)' }}
                                >
                                  {sub}
                                </div>
                              )}
                            </div>

                            {/* Status pill */}
                            {item.status && (
                              <span
                                className="text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0 capitalize"
                                style={{
                                  background: `${STATUS_COLORS[item.status] || '#aaa'}1a`,
                                  color: STATUS_COLORS[item.status] || 'var(--fd-ink-3)',
                                }}
                              >
                                {STATUS_LABELS[item.status] || item.status}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Empty / hint state ──────────────────────────────────── */}
        {!showResults && !loading && (
          <div className="px-4 pt-5 pb-4">
            <p className="text-[11.5px] mb-3" style={{ color: 'var(--fd-ink-4)' }}>
              Quick jump
            </p>
            <div className="flex flex-wrap gap-1.5">
              {[
                { label: 'Clients', type: 'client', color: '#4f6ef0' },
                { label: 'Tasks',   type: 'task',   color: '#f59e0b' },
                { label: 'Leads',   type: 'lead',   color: '#22c55e' },
                { label: 'Team',    type: 'user',   color: '#a855f7' },
              ].map(({ label, type, color }) => {
                const Icon = TYPE_META[type].icon;
                return (
                  <button
                    key={type}
                    onClick={() => { navigate(`/admin/${type === 'user' ? 'team' : type + 's'}`); onClose(); }}
                    className="flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-lg transition-colors"
                    style={{
                      background: `${color}12`,
                      color: color,
                      border: `1px solid ${color}28`,
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = `${color}22`}
                    onMouseLeave={e => e.currentTarget.style.background = `${color}12`}
                  >
                    <Icon size={11} />
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Footer ──────────────────────────────────────────────── */}
        <div
          className="flex items-center gap-4 px-4 py-2"
          style={{ borderTop: '1px solid var(--fd-border)' }}
        >
          {[
            { keys: ['↑', '↓'], label: 'navigate' },
            { keys: ['↵'],      label: 'open' },
            { keys: ['esc'],    label: 'close' },
          ].map(({ keys, label }) => (
            <span
              key={label}
              className="flex items-center gap-1 text-[11px]"
              style={{ color: 'var(--fd-ink-4)' }}
            >
              {keys.map(k => (
                <kbd
                  key={k}
                  className="font-mono text-[10px] px-1 py-px rounded"
                  style={{
                    background: 'var(--fd-surface-sunken)',
                    border: '1px solid var(--fd-border)',
                    color: 'var(--fd-ink-3)',
                    lineHeight: 1.6,
                  }}
                >
                  {k}
                </kbd>
              ))}
              <span>{label}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}