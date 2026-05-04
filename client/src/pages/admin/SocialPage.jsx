import React, { useEffect, useState, useCallback } from 'react';
import {
  Instagram, Facebook, Youtube, Linkedin, Twitter,
  Plus, BarChart3, Eye, Heart, MessageCircle,
  Share2, TrendingUp, Filter, Edit3,
  AlertCircle, ArrowUpRight, Trash2, Play, Building2, X
} from 'lucide-react';
import api from '../../lib/api';
import useAuthStore from '../../context/authStore';
import { timeAgo, formatDate } from '../../lib/utils';

// ── Constants ──────────────────────────────────────────────────
const PLATFORM_META = {
  instagram:       { label: 'Instagram',       icon: Instagram, color: 'from-pink-500 to-purple-600',   bg: 'bg-pink-50',    text: 'text-pink-600'    },
  facebook:        { label: 'Facebook',        icon: Facebook,  color: 'from-blue-600 to-blue-800',     bg: 'bg-blue-50',    text: 'text-blue-700'    },
  tiktok:          { label: 'TikTok',          icon: Play,      color: 'from-slate-800 to-slate-950',   bg: 'bg-slate-100',  text: 'text-slate-800'   },
  youtube:         { label: 'YouTube',         icon: Youtube,   color: 'from-red-500 to-red-700',       bg: 'bg-red-50',     text: 'text-red-600'     },
  linkedin:        { label: 'LinkedIn',        icon: Linkedin,  color: 'from-blue-700 to-blue-900',     bg: 'bg-blue-50',    text: 'text-blue-800'    },
  twitter:         { label: 'Twitter / X',     icon: Twitter,   color: 'from-slate-700 to-slate-900',   bg: 'bg-slate-50',   text: 'text-slate-700'   },
  google_business: { label: 'Google Business', icon: BarChart3, color: 'from-emerald-500 to-green-600', bg: 'bg-emerald-50', text: 'text-emerald-700' },
};

const STATUS_META = {
  draft:     { label: 'Draft',     color: 'bg-slate-100 text-slate-600',     dot: 'bg-slate-400'   },
  scheduled: { label: 'Scheduled', color: 'bg-amber-100 text-amber-700',     dot: 'bg-amber-400'   },
  published: { label: 'Published', color: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  failed:    { label: 'Failed',    color: 'bg-red-100 text-red-600',         dot: 'bg-red-500'     },
  archived:  { label: 'Archived',  color: 'bg-slate-100 text-slate-400',     dot: 'bg-slate-300'   },
};

const CLIENT_COLORS = [
  'bg-violet-100 text-violet-700',
  'bg-cyan-100 text-cyan-700',
  'bg-rose-100 text-rose-700',
  'bg-amber-100 text-amber-700',
  'bg-teal-100 text-teal-700',
  'bg-indigo-100 text-indigo-700',
];

const CONTENT_TYPES = ['post', 'reel', 'story', 'video', 'carousel', 'short'];
const PLATFORMS     = Object.keys(PLATFORM_META);

function fmtNum(n) {
  if (!n) return '—';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}

// Stable colour per client id
const clientColorCache = {};
let colorIdx = 0;
function clientColor(id) {
  if (!id) return CLIENT_COLORS[0];
  if (!clientColorCache[id]) {
    clientColorCache[id] = CLIENT_COLORS[colorIdx % CLIENT_COLORS.length];
    colorIdx++;
  }
  return clientColorCache[id];
}

// ── Post Card ──────────────────────────────────────────────────
function PostCard({ post, onEdit, onDelete, canEdit }) {
  const pm    = PLATFORM_META[post.platform] || {};
  const sm    = STATUS_META[post.status]     || {};
  const PIcon = pm.icon || BarChart3;

  const clientId   = post.client?._id || post.client;
  const clientName = post.client?.company || post.client?.name || null;
  const chipColor  = clientColor(String(clientId));

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden hover:shadow-md transition-all group flex flex-col">
      {/* Media block */}
      <div className="relative h-40 bg-gradient-to-br from-slate-100 to-slate-200 overflow-hidden flex-shrink-0">
        {post.mediaUrls?.[0] ? (
          <img src={post.mediaUrls[0]} alt="preview" className="w-full h-full object-cover" />
        ) : post.thumbnail ? (
          <img src={post.thumbnail} alt="thumbnail" className="w-full h-full object-cover" />
        ) : (
          <div className={`w-full h-full flex items-center justify-center bg-gradient-to-br ${pm.color}`}>
            <PIcon size={32} className="text-white/60" />
          </div>
        )}
        <div className={`absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold shadow-sm ${pm.bg} ${pm.text}`}>
          <PIcon size={10} />
          {pm.label}
        </div>
        <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-0.5 rounded-full capitalize">
          {post.contentType}
        </div>
        {canEdit && (
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <button
              onClick={() => onEdit(post)}
              className="bg-white text-slate-800 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-slate-100 flex items-center gap-1"
            >
              <Edit3 size={11} /> Edit
            </button>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="p-3 flex flex-col flex-1">
        {/* Client chip + status */}
        <div className="flex items-center justify-between gap-1 mb-2">
          {clientName ? (
            <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full truncate max-w-[58%] ${chipColor}`}>
              <Building2 size={9} className="flex-shrink-0" />
              <span className="truncate">{clientName}</span>
            </span>
          ) : (
            <span className="text-[10px] text-slate-300 italic">No client</span>
          )}
          <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${sm.color}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${sm.dot}`} />
            {sm.label}
          </span>
        </div>

        {/* Caption */}
        {post.caption && (
          <p className="text-xs text-slate-600 line-clamp-2 mb-2 flex-1">{post.caption}</p>
        )}

        {/* Date */}
        <p className="text-[11px] text-slate-400 mb-2">
          {post.publishedAt
            ? `Published ${timeAgo(post.publishedAt)}`
            : post.scheduledAt
            ? `Scheduled ${formatDate(post.scheduledAt)}`
            : `Created ${timeAgo(post.createdAt)}`}
        </p>

        {/* Metrics */}
        {post.status === 'published' && (
          <div className="grid grid-cols-4 gap-1 pt-2 border-t border-slate-100">
            {[
              { icon: Heart,         val: post.metrics?.likes    },
              { icon: MessageCircle, val: post.metrics?.comments },
              { icon: Share2,        val: post.metrics?.shares   },
              { icon: Eye,           val: post.metrics?.views    },
            ].map(({ icon: Icon, val }, i) => (
              <div key={i} className="text-center">
                <Icon size={10} className="mx-auto text-slate-400 mb-0.5" />
                <div className="text-[11px] font-semibold text-slate-700">{fmtNum(val)}</div>
              </div>
            ))}
          </div>
        )}

        {/* Delete */}
        {canEdit && (
          <div className="flex justify-end mt-2">
            <button
              onClick={() => onDelete(post._id)}
              className="text-slate-300 hover:text-red-400 transition-colors"
              title="Delete post"
            >
              <Trash2 size={12} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Post Modal ─────────────────────────────────────────────────
function PostModal({ post, clients, onClose, onSave }) {
  const isEdit = !!post?._id;

  const [form, setForm] = useState(() => {
    if (isEdit) {
      return {
        ...post,
        client:      post.client?._id || post.client || '',
        socialAccount: post.socialAccount?._id || post.socialAccount || '',
        scheduledAt: post.scheduledAt ? post.scheduledAt.slice(0, 16) : '',
        hashtags:    Array.isArray(post.hashtags) ? post.hashtags.join(' ') : (post.hashtags || ''),
      };
    }
    return {
      client: '', socialAccount: '', platform: 'instagram',
      contentType: 'post', status: 'draft',
      caption: '', mediaUrls: [], hashtags: '', notes: '',
      isClientVisible: true, scheduledAt: '',
    };
  });

  const [accounts,    setAccounts]    = useState([]);
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState('');
  const [metricsMode, setMetricsMode] = useState(false);

  // Reload accounts when client or platform changes
  useEffect(() => {
    if (!form.client) { setAccounts([]); return; }
    api.get(`/social/accounts?clientId=${form.client}`)
      .then(r => setAccounts(r.data.accounts || []))
      .catch(() => setAccounts([]));
  }, [form.client]);

  const handle       = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const handleMetric = (k, v) => setForm(f => ({ ...f, metrics: { ...f.metrics, [k]: Number(v) } }));

  const submit = async () => {
    if (!form.client)   { setError('Please select a client.'); return; }
    if (!form.platform) { setError('Please select a platform.'); return; }
    setError('');
    setSaving(true);
    try {
      const payload = {
        ...form,
        hashtags:    typeof form.hashtags === 'string'
          ? form.hashtags.split(/\s+/).filter(Boolean)
          : form.hashtags,
        scheduledAt: form.scheduledAt || undefined,
        socialAccount: form.socialAccount || undefined,
      };
      isEdit
        ? await api.put(`/social/posts/${post._id}`, payload)
        : await api.post('/social/posts', payload);
      onSave();
    } catch (e) {
      setError(e?.response?.data?.message || 'Failed to save post.');
    } finally {
      setSaving(false);
    }
  };

  const platformAccounts = accounts.filter(a => a.platform === form.platform);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 sticky top-0 bg-white z-10">
          <h2 className="font-bold text-slate-800 text-base">
            {isEdit ? 'Edit Post' : 'New Social Post'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Error banner */}
          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2">
              <AlertCircle size={14} className="flex-shrink-0" />
              {error}
            </div>
          )}

          {/* ── Client — always shown ── */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Client <span className="text-red-500">*</span>
            </label>
            <select
              className="input w-full"
              value={form.client}
              onChange={e => {
                handle('client', e.target.value);
                handle('socialAccount', '');
              }}
            >
              <option value="">Select a client…</option>
              {clients.map(c => (
                <option key={c._id} value={c._id}>{c.company}</option>
              ))}
            </select>
          </div>

          {/* ── Platform + Content Type ── */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Platform</label>
              <select
                className="input w-full"
                value={form.platform}
                onChange={e => { handle('platform', e.target.value); handle('socialAccount', ''); }}
              >
                {PLATFORMS.map(p => (
                  <option key={p} value={p}>{PLATFORM_META[p].label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Content Type</label>
              <select
                className="input w-full"
                value={form.contentType}
                onChange={e => handle('contentType', e.target.value)}
              >
                {CONTENT_TYPES.map(t => (
                  <option key={t} value={t} className="capitalize">{t}</option>
                ))}
              </select>
            </div>
          </div>

          {/* ── Social Account (appears once client + platform chosen) ── */}
          {form.client && platformAccounts.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Social Account
                <span className="text-slate-400 font-normal ml-1">(optional)</span>
              </label>
              <select
                className="input w-full"
                value={form.socialAccount || ''}
                onChange={e => handle('socialAccount', e.target.value)}
              >
                <option value="">Select account…</option>
                {platformAccounts.map(a => (
                  <option key={a._id} value={a._id}>
                    {a.accountName}{a.followers ? ` · ${fmtNum(a.followers)} followers` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* ── Caption ── */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Caption</label>
            <textarea
              className="input w-full h-24 resize-none"
              value={form.caption}
              onChange={e => handle('caption', e.target.value)}
              placeholder="Write your caption…"
            />
          </div>

          {/* ── Hashtags ── */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Hashtags
              <span className="text-slate-400 font-normal ml-1">(space-separated)</span>
            </label>
            <input
              className="input w-full text-xs"
              value={form.hashtags}
              onChange={e => handle('hashtags', e.target.value)}
              placeholder="#skincare #summer #bloom"
            />
          </div>

          {/* ── Media URLs ── */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Media URLs
              <span className="text-slate-400 font-normal ml-1">(one per line)</span>
            </label>
            <textarea
              className="input w-full h-16 resize-none text-xs font-mono"
              value={Array.isArray(form.mediaUrls) ? form.mediaUrls.join('\n') : ''}
              onChange={e => handle('mediaUrls', e.target.value.split('\n').filter(Boolean))}
              placeholder="https://…"
            />
          </div>

          {/* ── Status + DateTime ── */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
              <select
                className="input w-full"
                value={form.status}
                onChange={e => handle('status', e.target.value)}
              >
                {Object.entries(STATUS_META).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {form.status === 'published' ? 'Published At' : 'Scheduled At'}
              </label>
              <input
                type="datetime-local"
                className="input w-full text-xs"
                value={form.scheduledAt || ''}
                onChange={e => handle('scheduledAt', e.target.value)}
              />
            </div>
          </div>

          {/* ── Internal Notes ── */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Internal Notes
              <span className="text-slate-400 font-normal ml-1">(not visible to client)</span>
            </label>
            <textarea
              className="input w-full h-16 resize-none text-xs"
              value={form.notes || ''}
              onChange={e => handle('notes', e.target.value)}
              placeholder="e.g. Pending approval — coordinate with product team on launch date."
            />
          </div>

          {/* ── Metrics (edit only) ── */}
          {isEdit && (
            <div className="border border-slate-100 rounded-xl overflow-hidden">
              <button
                onClick={() => setMetricsMode(!metricsMode)}
                className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                <span className="flex items-center gap-1.5"><BarChart3 size={13} /> Update Metrics</span>
                <span className="text-slate-400 text-[10px]">{metricsMode ? '▲ hide' : '▼ expand'}</span>
              </button>
              {metricsMode && (
                <div className="p-4 border-t border-slate-100 grid grid-cols-4 gap-3">
                  {['likes', 'comments', 'shares', 'saves', 'views', 'reach', 'impressions', 'clicks'].map(k => (
                    <div key={k}>
                      <label className="block text-[10px] text-slate-500 mb-0.5 capitalize">{k}</label>
                      <input
                        type="number"
                        className="input w-full text-xs"
                        min={0}
                        value={form.metrics?.[k] || ''}
                        onChange={e => handleMetric(k, e.target.value)}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Client visibility toggle ── */}
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <div className="relative flex-shrink-0">
              <input
                type="checkbox"
                className="sr-only"
                checked={!!form.isClientVisible}
                onChange={e => handle('isClientVisible', e.target.checked)}
              />
              <div className={`w-9 h-5 rounded-full transition-colors ${form.isClientVisible ? 'bg-brand-600' : 'bg-slate-200'}`} />
              <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.isClientVisible ? 'translate-x-4' : ''}`} />
            </div>
            <span className="text-xs text-slate-600">Visible to client in their portal</span>
          </label>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-5 border-t border-slate-100 sticky bottom-0 bg-white">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={submit} disabled={saving} className="btn-primary flex-1">
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Post'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Analytics Summary ──────────────────────────────────────────
function AnalyticsSummary({ analytics }) {
  if (!analytics) return null;
  const t = analytics.totals || {};
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {[
        { label: 'Total Posts',    val: fmtNum(t.totalPosts),      icon: BarChart3,    color: 'blue'   },
        { label: 'Total Reach',    val: fmtNum(t.totalReach),      icon: TrendingUp,   color: 'green'  },
        { label: 'Total Likes',    val: fmtNum(t.totalLikes),      icon: Heart,        color: 'pink'   },
        { label: 'Avg Engagement', val: t.avgEngagementRate ? t.avgEngagementRate.toFixed(1) + '%' : '—', icon: ArrowUpRight, color: 'purple' },
      ].map(({ label, val, icon: Icon, color }) => (
        <div key={label} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-500 font-medium">{label}</span>
            <Icon size={14} className={`text-${color}-500`} />
          </div>
          <div className="text-2xl font-bold text-slate-800">{val}</div>
        </div>
      ))}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────
export default function SocialPage() {
  const { user } = useAuthStore();
  const canEdit = ['admin', 'manager', 'social_media_manager'].includes(user?.role);

  const [posts,     setPosts]     = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [clients,   setClients]   = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [modal,     setModal]     = useState(null);
  const [tab,       setTab]       = useState('posts');
  const [filters,   setFilters]   = useState({ clientId: '', platform: '', status: '', contentType: '' });

  // Load clients once on mount
  useEffect(() => {
    api.get('/clients?limit=100')
      .then(r => setClients(r.data.clients || []))
      .catch(() => {});
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filters.clientId)    params.set('clientId',    filters.clientId);
      if (filters.platform)    params.set('platform',    filters.platform);
      if (filters.status)      params.set('status',      filters.status);
      if (filters.contentType) params.set('contentType', filters.contentType);
      params.set('limit', '60');

      const postsRes = await api.get(`/social/posts?${params}`);
      setPosts(postsRes.data.posts || []);

      // Analytics — failure is non-fatal
      try {
        const aParams = new URLSearchParams({ days: '30' });
        if (filters.clientId) aParams.set('clientId', filters.clientId);
        const aRes = await api.get(`/social/analytics?${aParams}`);
        setAnalytics(aRes.data.analytics);
      } catch {
        setAnalytics(null);
      }
    } catch (e) {
      setError(e?.response?.data?.message || 'Failed to load posts. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this post?')) return;
    try {
      await api.delete(`/social/posts/${id}`);
      loadData();
    } catch (e) {
      alert(e?.response?.data?.message || 'Failed to delete.');
    }
  };

  const setFilter   = (key, val) => setFilters(f => ({ ...f, [key]: val }));
  const clearFilters = () => setFilters({ clientId: '', platform: '', status: '', contentType: '' });
  const hasFilters  = Object.values(filters).some(Boolean);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Social Media</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Manage content across all clients · track performance · schedule posts
          </p>
        </div>
        {canEdit && (
          <button onClick={() => setModal('new')} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> New Post
          </button>
        )}
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
        {[
          { key: 'posts',     label: 'Posts',     icon: BarChart3  },
          { key: 'analytics', label: 'Analytics', icon: TrendingUp },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-all
              ${tab === key ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Icon size={14} />{label}
          </button>
        ))}
      </div>

      {/* ── Filters bar ── */}
      <div className="flex flex-wrap gap-2 items-center bg-white border border-slate-200 rounded-xl px-4 py-3">
        <Filter size={14} className="text-slate-400 flex-shrink-0" />

        {/* Client filter — prominent, always first */}
        <select
          className="input text-xs py-1.5 min-w-[160px]"
          value={filters.clientId}
          onChange={e => setFilter('clientId', e.target.value)}
        >
          <option value="">All Clients</option>
          {clients.map(c => (
            <option key={c._id} value={c._id}>{c.company}</option>
          ))}
        </select>

        <select
          className="input text-xs py-1.5"
          value={filters.platform}
          onChange={e => setFilter('platform', e.target.value)}
        >
          <option value="">All Platforms</option>
          {PLATFORMS.map(p => <option key={p} value={p}>{PLATFORM_META[p].label}</option>)}
        </select>

        <select
          className="input text-xs py-1.5"
          value={filters.status}
          onChange={e => setFilter('status', e.target.value)}
        >
          <option value="">All Statuses</option>
          {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>

        <select
          className="input text-xs py-1.5"
          value={filters.contentType}
          onChange={e => setFilter('contentType', e.target.value)}
        >
          <option value="">All Types</option>
          {CONTENT_TYPES.map(t => <option key={t} value={t} className="capitalize">{t}</option>)}
        </select>

        {hasFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-red-500 transition-colors"
          >
            <X size={12} /> Clear
          </button>
        )}

        <span className="ml-auto text-xs text-slate-400 font-medium">
          {loading ? '…' : `${posts.length} post${posts.length !== 1 ? 's' : ''}`}
        </span>
      </div>

      {/* ── Active filter chips ── */}
      {hasFilters && (
        <div className="flex flex-wrap gap-2">
          {filters.clientId && (
            <span className="inline-flex items-center gap-1.5 bg-violet-100 text-violet-700 text-xs font-medium px-2.5 py-1 rounded-full">
              <Building2 size={10} />
              {clients.find(c => c._id === filters.clientId)?.company || 'Client'}
              <button onClick={() => setFilter('clientId', '')} className="ml-0.5 hover:opacity-70"><X size={10} /></button>
            </span>
          )}
          {filters.platform && (
            <span className="inline-flex items-center gap-1.5 bg-blue-100 text-blue-700 text-xs font-medium px-2.5 py-1 rounded-full">
              {PLATFORM_META[filters.platform]?.label}
              <button onClick={() => setFilter('platform', '')} className="ml-0.5 hover:opacity-70"><X size={10} /></button>
            </span>
          )}
          {filters.status && (
            <span className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-700 text-xs font-medium px-2.5 py-1 rounded-full">
              {STATUS_META[filters.status]?.label}
              <button onClick={() => setFilter('status', '')} className="ml-0.5 hover:opacity-70"><X size={10} /></button>
            </span>
          )}
          {filters.contentType && (
            <span className="inline-flex items-center gap-1.5 bg-amber-100 text-amber-700 text-xs font-medium px-2.5 py-1 rounded-full capitalize">
              {filters.contentType}
              <button onClick={() => setFilter('contentType', '')} className="ml-0.5 hover:opacity-70"><X size={10} /></button>
            </span>
          )}
        </div>
      )}

      {/* ── Analytics Tab ── */}
      {tab === 'analytics' && (
        <div className="space-y-6">
          <AnalyticsSummary analytics={analytics} />

          {analytics?.byPlatform?.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <h3 className="font-semibold text-slate-800 mb-4 text-sm">Performance by Platform</h3>
              <div className="space-y-3">
                {analytics.byPlatform.map(p => {
                  const pm = PLATFORM_META[p._id] || {};
                  const PIcon = pm.icon || BarChart3;
                  return (
                    <div key={p._id} className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${pm.bg} flex-shrink-0`}>
                        <PIcon size={14} className={pm.text} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium text-slate-700">{pm.label}</span>
                          <span className="text-slate-500 text-xs">{p.posts} posts · {p.avgEngagementRate?.toFixed(1)}% eng.</span>
                        </div>
                        <div className="flex gap-4 text-xs text-slate-500 mt-0.5">
                          <span>❤️ {fmtNum(p.totalLikes)}</span>
                          <span>💬 {fmtNum(p.totalComments)}</span>
                          <span>👁 {fmtNum(p.totalReach)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {analytics?.topPosts?.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <h3 className="font-semibold text-slate-800 mb-4 text-sm">Top Performing Posts</h3>
              <div className="space-y-3">
                {analytics.topPosts.map(p => {
                  const pm  = PLATFORM_META[p.platform] || {};
                  const PIcon = pm.icon || BarChart3;
                  const cid = String(p.client?._id || p.client || '');
                  return (
                    <div key={p._id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${pm.bg} flex-shrink-0`}>
                        <PIcon size={14} className={pm.text} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-slate-700 truncate">{p.caption || `${p.contentType} post`}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {p.client?.company && (
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${clientColor(cid)}`}>
                              {p.client.company}
                            </span>
                          )}
                          <span className="text-xs text-slate-400">{timeAgo(p.publishedAt)}</span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-sm font-bold text-emerald-600">{p.metrics?.engagementRate?.toFixed(1)}%</div>
                        <div className="text-xs text-slate-400">engagement</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {!analytics && (
            <div className="text-center py-12 text-slate-400">
              <TrendingUp size={36} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">No analytics data for this period.</p>
            </div>
          )}
        </div>
      )}

      {/* ── Posts Grid ── */}
      {tab === 'posts' && (
        <>
          {loading ? (
            <div className="flex justify-center py-20">
              <div className="w-8 h-8 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
            </div>
          ) : error ? (
            <div className="text-center py-16">
              <div className="bg-red-50 border border-red-200 rounded-xl p-6 max-w-md mx-auto">
                <AlertCircle size={32} className="mx-auto mb-3 text-red-400" />
                <p className="font-medium text-red-700">Failed to load posts</p>
                <p className="text-sm text-red-500 mt-1">{error}</p>
                <button onClick={loadData} className="mt-4 btn-primary text-sm px-4 py-2">Try Again</button>
              </div>
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-20 text-slate-400">
              <BarChart3 size={40} className="mx-auto mb-3 opacity-30" />
              <p className="font-medium text-slate-500">No posts found</p>
              <p className="text-sm mt-1">
                {hasFilters ? 'Try adjusting your filters.' : 'Create your first social post above.'}
              </p>
              {hasFilters && (
                <button onClick={clearFilters} className="mt-3 text-xs text-brand-600 hover:underline">
                  Clear all filters
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {posts.map(post => (
                <PostCard
                  key={post._id}
                  post={post}
                  onEdit={setModal}
                  onDelete={handleDelete}
                  canEdit={canEdit}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Modal ── */}
      {modal && (
        <PostModal
          post={modal === 'new' ? null : modal}
          clients={clients}
          onClose={() => setModal(null)}
          onSave={() => { setModal(null); loadData(); }}
        />
      )}
    </div>
  );
}