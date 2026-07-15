import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Building2, CheckSquare, Target, Users, X, Loader2,
  CalendarDays, FileText, MessageSquare, Megaphone, UserSearch, Code2,
} from 'lucide-react';
import api from '../../lib/api';
import useAuthStore from '../../context/authStore';

const TYPE_META = {
  client:       { icon: Building2,    color: 'var(--fd-accent)', label: 'Clients',        path: (r) => `/admin/clients/${r._id}` },
  task:         { icon: CheckSquare,  color: '#f59e0b', label: 'Tasks',          path: (r) => r.isWebsiteWork ? `/admin/website-work` : `/admin/tasks` },
  lead:         { icon: Target,       color: '#22c55e', label: 'Leads',          path: ()  => `/admin/leads` },
  user:         { icon: Users,        color: '#a855f7', label: 'Team',           path: (r) => `/admin/team/${r._id}` },
  internalLead: { icon: UserSearch,   color: '#f97316', label: 'Pipeline',       path: ()  => `/admin/internal-leads` },
  event:        { icon: CalendarDays, color: '#06b6d4', label: 'Calendar',       path: ()  => `/admin/calendar` },
  socialPost:   { icon: Megaphone,    color: '#ec4899', label: 'Social Posts',   path: ()  => `/admin/social` },
  file:         { icon: FileText,     color: '#64748b', label: 'Files',          path: ()  => `/admin/files` },
  message:      { icon: MessageSquare,color: '#10b981', label: 'Messages',       path: ()  => `/admin/messages` },
  websiteProject: { icon: Code2,      color: '#22d3ee', label: 'Website Work',   path: ()  => `/admin/website-work` },
};

// Render order for groups
const GROUP_ORDER = ['client', 'task', 'websiteProject', 'lead', 'user', 'internalLead', 'event', 'socialPost', 'file', 'message'];

// Map type → key in results object
const RESULT_KEY = {
  client:       'clients',
  task:         'tasks',
  lead:         'leads',
  user:         'users',
  internalLead: 'internalLeads',
  event:        'events',
  socialPost:   'socialPosts',
  file:         'files',
  message:      'messages',
  websiteProject: 'websiteProjects',
};

const STATUS_LABELS = {
  pending: 'Pending', in_progress: 'In Progress', review: 'Review',
  completed: 'Completed', cancelled: 'Cancelled',
  new: 'New', contacted: 'Contacted', qualified: 'Qualified',
  converted: 'Converted', lost: 'Lost',
  planning: 'Planning', on_hold: 'On Hold',
};

const STATUS_COLORS = {
  pending: '#f59e0b', in_progress: 'var(--fd-accent)', review: '#a855f7',
  completed: '#22c55e', cancelled: '#ef4444',
  new: 'var(--fd-accent)', contacted: '#f59e0b', qualified: '#22c55e',
  converted: '#22c55e', lost: '#ef4444',
  planning: '#94a3b8', on_hold: '#f59e0b',
};

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function getItemLabel(item) {
  switch (item._type) {
    case 'client':       return item.company || item.name;
    case 'task':         return item.title;
    case 'lead':         return item.name || item.email;
    case 'user':         return item.name;
    case 'internalLead': return item.name || item.company || item.email;
    case 'event':        return item.title;
    case 'socialPost':   return item.caption ? item.caption.slice(0, 60) + (item.caption.length > 60 ? '…' : '') : `${item.platform} post`;
    case 'file':         return item.originalName || item.name;
    case 'message':      return item.content ? item.content.slice(0, 60) + (item.content.length > 60 ? '…' : '') : 'Message';
    case 'websiteProject': return item.name;
    default:             return item.name || item.title || item.company || item.email || '';
  }
}

function getItemSub(item) {
  switch (item._type) {
    case 'task':
      return [
        item.isWebsiteWork ? (item.websiteProject?.name || 'Website Work') : item.client?.company,
        STATUS_LABELS[item.status],
      ].filter(Boolean).join(' · ');
    case 'client':
      return [item.industry, item.status ? STATUS_LABELS[item.status] || item.status : null].filter(Boolean).join(' · ');
    case 'user':
      return item.role?.replace(/_/g, ' ');
    case 'lead':
      return [item.client?.company, STATUS_LABELS[item.status]].filter(Boolean).join(' · ');
    case 'internalLead':
      return [item.company, item.stage, item.source?.replace(/_/g, ' ')].filter(Boolean).join(' · ');
    case 'event': {
      const d = item.startDate ? new Date(item.startDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : null;
      return [item.type?.replace(/_/g, ' '), d].filter(Boolean).join(' · ');
    }
    case 'socialPost':
      return [item.platform, item.contentType, item.client?.company].filter(Boolean).join(' · ');
    case 'file':
      return [item.category, item.client?.company].filter(Boolean).join(' · ');
    case 'message':
      return [item.sender?.name, item.conversation?.client?.company].filter(Boolean).join(' · ');
    case 'websiteProject':
      return [STATUS_LABELS[item.status] || item.status, item.categories?.includes('client_project') ? 'Client Project' : item.categories?.includes('office_project') ? 'Internal' : null].filter(Boolean).join(' · ');
    default:
      return '';
  }
}

export default function GlobalSearch({ isOpen, onClose }) {
  const { user } = useAuthStore();
  const [query, setQuery]     = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(0);
  const inputRef  = useRef(null);
  const listRef   = useRef(null);
  const navigate  = useNavigate();
  const debounced = useDebounce(query, 220);

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

  // Build flat list in GROUP_ORDER — critical for correct keyboard highlight
  const flat = results
    ? GROUP_ORDER.flatMap(type => {
        const key = RESULT_KEY[type];
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
        setSelected(s => { const n = Math.min(s + 1, flat.length - 1); scrollItemIntoView(n); return n; });
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelected(s => { const p = Math.max(s - 1, 0); scrollItemIntoView(p); return p; });
      }
      if (e.key === 'Enter' && flat[selected]) navigateTo(flat[selected]);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, flat, selected, navigateTo, onClose]);

  function scrollItemIntoView(idx) {
    if (!listRef.current) return;
    const items = listRef.current.querySelectorAll('[data-result-item]');
    items[idx]?.scrollIntoView({ block: 'nearest' });
  }

  if (!isOpen) return null;

  const hasResults = flat.length > 0;
  const showResults = results !== null;

  // Which quick-jump pills make sense for this role — mirrors the exact
  // same gating the backend search route applies, so a pill never promises
  // access the person doesn't actually have.
  const isManagerRole = ['admin', 'manager'].includes(user?.role);
  const canSeeWebsiteWork = ['admin', 'developer'].includes(user?.role);

  const quickJumps = [
    { label: 'Clients',      type: 'client',         nav: '/admin/clients',        color: 'var(--fd-accent)', show: isManagerRole },
    { label: 'Tasks',        type: 'task',           nav: '/admin/tasks',          color: '#f59e0b',          show: true },
    { label: 'Website Work', type: 'websiteProject', nav: '/admin/website-work',   color: '#22d3ee',          show: canSeeWebsiteWork },
    { label: 'Leads',        type: 'lead',           nav: '/admin/leads',          color: '#22c55e',          show: isManagerRole },
    { label: 'Team',         type: 'user',           nav: '/admin/team',           color: '#a855f7',          show: isManagerRole },
    { label: 'Pipeline',     type: 'internalLead',   nav: '/admin/internal-leads', color: '#f97316',          show: isManagerRole },
    { label: 'Calendar',     type: 'event',          nav: '/admin/calendar',       color: '#06b6d4',          show: true },
    { label: 'Social',       type: 'socialPost',     nav: '/admin/social',         color: '#ec4899',          show: isManagerRole },
    { label: 'Files',        type: 'file',           nav: '/admin/files',          color: '#64748b',          show: true },
    { label: 'Messages',     type: 'message',        nav: '/admin/messages',       color: '#10b981',          show: true },
  ].filter(q => q.show);

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
        className="relative w-full max-w-[580px] rounded-2xl overflow-hidden animate-scale-in"
        tabIndex={-1}
        style={{
          background: 'var(--fd-modal-bg)',
          border: '1px solid var(--fd-modal-border)',
          boxShadow: '0 32px 80px -8px rgba(0,0,0,0.35), 0 8px 32px rgba(0,0,0,0.15)',
          outline: 'none',
        }}
      >
        {/* ── Input row ─────────────────────────────────────────────── */}
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
            placeholder="Search everything — clients, tasks, files, messages…"
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

        {/* ── Results ───────────────────────────────────────────────── */}
        {showResults && (
          <div ref={listRef} className="overflow-y-auto" style={{ maxHeight: 420 }}>
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
                  const key = RESULT_KEY[type];
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

                            {/* Status pill — only for types that have meaningful status */}
                            {item.status && ['task', 'lead', 'client', 'websiteProject'].includes(item._type) && (
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

        {/* ── Empty / hint state ────────────────────────────────────── */}
        {!showResults && !loading && (
          <div className="px-4 pt-5 pb-4">
            <p className="text-[11.5px] mb-3" style={{ color: 'var(--fd-ink-4)' }}>
              Quick jump
            </p>
            <div className="flex flex-wrap gap-1.5">
              {quickJumps.map(({ label, type, nav, color }) => {
                const Icon = TYPE_META[type].icon;
                return (
                  <button
                    key={type}
                    onClick={() => { navigate(nav); onClose(); }}
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

        {/* ── Footer ────────────────────────────────────────────────── */}
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