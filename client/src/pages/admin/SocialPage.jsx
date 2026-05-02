import React, { useEffect, useState, useCallback } from 'react';
import {
  Instagram, Facebook, Youtube, Linkedin, Twitter,
  Plus, BarChart3, Calendar, Eye, Heart, MessageCircle,
  Share2, TrendingUp, Filter, MoreHorizontal, Edit3,
  CheckCircle, Clock, AlertCircle, ArrowUpRight, Trash2,
  Bookmark, Play
} from 'lucide-react';
import api from '../../lib/api';
import useAuthStore from '../../context/authStore';
import { timeAgo, formatDate } from '../../lib/utils';

// ── Helpers ────────────────────────────────────────────────────
const PLATFORM_META = {
  instagram:      { label: 'Instagram',       icon: Instagram,  color: 'from-pink-500 to-purple-600',  bg: 'bg-pink-50',   text: 'text-pink-600' },
  facebook:       { label: 'Facebook',        icon: Facebook,   color: 'from-blue-600 to-blue-800',    bg: 'bg-blue-50',   text: 'text-blue-700' },
  tiktok:         { label: 'TikTok',          icon: Play,       color: 'from-slate-800 to-slate-950',  bg: 'bg-slate-100', text: 'text-slate-800' },
  youtube:        { label: 'YouTube',         icon: Youtube,    color: 'from-red-500 to-red-700',      bg: 'bg-red-50',    text: 'text-red-600'  },
  linkedin:       { label: 'LinkedIn',        icon: Linkedin,   color: 'from-blue-700 to-blue-900',    bg: 'bg-blue-50',   text: 'text-blue-800' },
  twitter:        { label: 'Twitter / X',     icon: Twitter,    color: 'from-slate-700 to-slate-900',  bg: 'bg-slate-50',  text: 'text-slate-700' },
  google_business:{ label: 'Google Business', icon: BarChart3,  color: 'from-emerald-500 to-green-600',bg: 'bg-emerald-50',text: 'text-emerald-700' },
};

const STATUS_META = {
  draft:     { label: 'Draft',     color: 'bg-slate-100 text-slate-600',   dot: 'bg-slate-400' },
  scheduled: { label: 'Scheduled', color: 'bg-amber-100 text-amber-700',   dot: 'bg-amber-400' },
  published: { label: 'Published', color: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  failed:    { label: 'Failed',    color: 'bg-red-100 text-red-600',       dot: 'bg-red-500'  },
  archived:  { label: 'Archived',  color: 'bg-slate-100 text-slate-400',   dot: 'bg-slate-300' },
};

const CONTENT_TYPES = ['post','reel','story','video','carousel','short'];
const PLATFORMS     = Object.keys(PLATFORM_META);

function fmtNum(n) {
  if (!n) return '—';
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return String(n);
}

// ── Post Card ──────────────────────────────────────────────────
function PostCard({ post, onEdit, onDelete, canEdit }) {
  const pm = PLATFORM_META[post.platform] || {};
  const sm = STATUS_META[post.status] || {};
  const PIcon = pm.icon || BarChart3;

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden hover:shadow-md transition-all group">
      {/* Media preview */}
      <div className="relative h-40 bg-gradient-to-br from-slate-100 to-slate-200 overflow-hidden">
        {post.mediaUrls?.[0] ? (
          <img src={post.mediaUrls[0]} alt="preview" className="w-full h-full object-cover" />
        ) : post.thumbnail ? (
          <img src={post.thumbnail} alt="thumbnail" className="w-full h-full object-cover" />
        ) : (
          <div className={`w-full h-full flex items-center justify-center bg-gradient-to-br ${pm.color}`}>
            <PIcon size={32} className="text-white/60" />
          </div>
        )}
        {/* Platform badge */}
        <div className={`absolute top-2 left-2 flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-semibold ${pm.bg} ${pm.text} shadow-sm`}>
          <PIcon size={10} />
          {pm.label}
        </div>
        {/* Content type */}
        <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-0.5 rounded-full capitalize">
          {post.contentType}
        </div>
        {canEdit && (
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <button onClick={() => onEdit(post)} className="bg-white text-slate-800 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-slate-100">
              <Edit3 size={12} className="inline mr-1" />Edit
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-3">
        {/* Status */}
        <div className="flex items-center justify-between mb-2">
          <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${sm.color}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${sm.dot}`} />
            {sm.label}
          </span>
          {canEdit && (
            <button onClick={() => onDelete(post._id)} className="text-slate-300 hover:text-red-400 transition-colors">
              <Trash2 size={13} />
            </button>
          )}
        </div>

        {/* Caption */}
        {post.caption && (
          <p className="text-xs text-slate-600 line-clamp-2 mb-2">{post.caption}</p>
        )}

        {/* Date */}
        <p className="text-xs text-slate-400 mb-3">
          {post.publishedAt ? `Published ${timeAgo(post.publishedAt)}` :
           post.scheduledAt ? `Scheduled ${formatDate(post.scheduledAt)}` :
           `Created ${timeAgo(post.createdAt)}`}
        </p>

        {/* Metrics */}
        {post.status === 'published' && (
          <div className="grid grid-cols-4 gap-1 pt-2 border-t border-slate-100">
            {[
              { icon: Heart, val: post.metrics?.likes, label: 'Likes' },
              { icon: MessageCircle, val: post.metrics?.comments, label: 'Comments' },
              { icon: Share2, val: post.metrics?.shares, label: 'Shares' },
              { icon: Eye, val: post.metrics?.views, label: 'Views' },
            ].map(({ icon: Icon, val, label }) => (
              <div key={label} className="text-center">
                <Icon size={11} className="mx-auto text-slate-400 mb-0.5" />
                <div className="text-xs font-semibold text-slate-700">{fmtNum(val)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Post Modal ──────────────────────────────────────────────────
function PostModal({ post, clients, onClose, onSave }) {
  const { user } = useAuthStore();
  const [form, setForm] = useState(post ? { ...post } : {
    platform: 'instagram', contentType: 'post', status: 'draft',
    caption: '', mediaUrls: [], hashtags: [], notes: '',
    isClientVisible: true, client: '', scheduledAt: ''
  });
  const [saving, setSaving] = useState(false);
  const [metricsMode, setMetricsMode] = useState(false);

  const handle = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const handleMetric = (k, v) => setForm(f => ({ ...f, metrics: { ...f.metrics, [k]: Number(v) } }));

  const submit = async () => {
    setSaving(true);
    try {
      const payload = {
        ...form,
        hashtags: typeof form.hashtags === 'string'
          ? form.hashtags.split(' ').filter(Boolean)
          : form.hashtags,
      };
      if (post?._id) {
        await api.put(`/social/posts/${post._id}`, payload);
      } else {
        await api.post('/social/posts', payload);
      }
      onSave();
    } catch (e) {
      alert(e?.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h2 className="font-bold text-slate-800">{post?._id ? 'Edit Post' : 'New Post'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
        </div>

        <div className="p-5 space-y-4">
          {!post?._id && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Client *</label>
              <select className="input w-full" value={form.client} onChange={e => handle('client', e.target.value)}>
                <option value="">Select client…</option>
                {clients.map(c => <option key={c._id} value={c._id}>{c.company}</option>)}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Platform</label>
              <select className="input w-full" value={form.platform} onChange={e => handle('platform', e.target.value)}>
                {PLATFORMS.map(p => <option key={p} value={p}>{PLATFORM_META[p].label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Content Type</label>
              <select className="input w-full" value={form.contentType} onChange={e => handle('contentType', e.target.value)}>
                {CONTENT_TYPES.map(t => <option key={t} value={t} className="capitalize">{t}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Caption</label>
            <textarea className="input w-full h-24 resize-none" value={form.caption} onChange={e => handle('caption', e.target.value)} placeholder="Write caption…" />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Media URLs (one per line)</label>
            <textarea className="input w-full h-16 resize-none text-xs font-mono"
              value={Array.isArray(form.mediaUrls) ? form.mediaUrls.join('\n') : ''}
              onChange={e => handle('mediaUrls', e.target.value.split('\n').filter(Boolean))}
              placeholder="https://..." />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
              <select className="input w-full" value={form.status} onChange={e => handle('status', e.target.value)}>
                {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Scheduled / Published At</label>
              <input type="datetime-local" className="input w-full text-xs"
                value={form.scheduledAt ? form.scheduledAt.slice(0, 16) : ''}
                onChange={e => handle('scheduledAt', e.target.value)} />
            </div>
          </div>

          {/* Metrics (only when editing published post) */}
          {post?._id && (
            <div>
              <button onClick={() => setMetricsMode(!metricsMode)} className="text-xs text-brand-600 font-medium flex items-center gap-1">
                <BarChart3 size={12} /> {metricsMode ? 'Hide' : 'Update'} Metrics
              </button>
              {metricsMode && (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {['likes','comments','shares','saves','views','reach','impressions','clicks'].map(k => (
                    <div key={k}>
                      <label className="block text-xs text-slate-500 mb-0.5 capitalize">{k}</label>
                      <input type="number" className="input w-full text-xs" min={0}
                        value={form.metrics?.[k] || ''}
                        onChange={e => handleMetric(k, e.target.value)} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-2">
            <input type="checkbox" id="cv" checked={!!form.isClientVisible}
              onChange={e => handle('isClientVisible', e.target.checked)} />
            <label htmlFor="cv" className="text-xs text-slate-600">Visible to client</label>
          </div>
        </div>

        <div className="flex gap-3 p-5 border-t border-slate-100">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={submit} disabled={saving} className="btn-primary flex-1">
            {saving ? 'Saving…' : (post?._id ? 'Save Changes' : 'Create Post')}
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
        { label: 'Total Posts',   val: fmtNum(t.totalPosts),      icon: BarChart3,     color: 'blue'   },
        { label: 'Total Reach',   val: fmtNum(t.totalReach),      icon: TrendingUp,    color: 'green'  },
        { label: 'Total Likes',   val: fmtNum(t.totalLikes),      icon: Heart,         color: 'pink'   },
        { label: 'Avg Engagement',val: t.avgEngagementRate ? t.avgEngagementRate.toFixed(1) + '%' : '—', icon: ArrowUpRight, color: 'purple' },
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
  const canEdit = ['admin','manager','social_media_manager'].includes(user?.role);

  const [posts, setPosts] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // null | 'new' | post object
  const [tab, setTab] = useState('posts');  // posts | analytics
  const [filters, setFilters] = useState({ clientId: '', platform: '', status: '', contentType: '' });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.clientId) params.set('clientId', filters.clientId);
      if (filters.platform) params.set('platform', filters.platform);
      if (filters.status)   params.set('status', filters.status);
      if (filters.contentType) params.set('contentType', filters.contentType);
      params.set('limit', '40');

      const [postsRes, analyticsRes] = await Promise.all([
        api.get(`/social/posts?${params}`),
        api.get(`/social/analytics?${params}&days=30`),
      ]);
      setPosts(postsRes.data.posts || []);
      setAnalytics(analyticsRes.data.analytics);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (canEdit) {
      api.get('/clients?limit=100').then(r => setClients(r.data.clients || []));
    }
  }, [canEdit]);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this post?')) return;
    await api.delete(`/social/posts/${id}`);
    loadData();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Social Media</h1>
          <p className="text-slate-500 text-sm mt-0.5">Manage content, track performance, and review scheduled posts</p>
        </div>
        {canEdit && (
          <button onClick={() => setModal('new')} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> New Post
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
        {[
          { key: 'posts', label: 'Posts', icon: BarChart3 },
          { key: 'analytics', label: 'Analytics', icon: TrendingUp },
        ].map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-all ${tab === key ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>
            <Icon size={14} />{label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <Filter size={14} className="text-slate-400" />
        {canEdit && (
          <select className="input text-xs py-1.5" value={filters.clientId}
            onChange={e => setFilters(f => ({ ...f, clientId: e.target.value }))}>
            <option value="">All Clients</option>
            {clients.map(c => <option key={c._id} value={c._id}>{c.company}</option>)}
          </select>
        )}
        <select className="input text-xs py-1.5" value={filters.platform}
          onChange={e => setFilters(f => ({ ...f, platform: e.target.value }))}>
          <option value="">All Platforms</option>
          {PLATFORMS.map(p => <option key={p} value={p}>{PLATFORM_META[p].label}</option>)}
        </select>
        <select className="input text-xs py-1.5" value={filters.status}
          onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}>
          <option value="">All Status</option>
          {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select className="input text-xs py-1.5" value={filters.contentType}
          onChange={e => setFilters(f => ({ ...f, contentType: e.target.value }))}>
          <option value="">All Types</option>
          {CONTENT_TYPES.map(t => <option key={t} value={t} className="capitalize">{t}</option>)}
        </select>
      </div>

      {/* Analytics Tab */}
      {tab === 'analytics' && (
        <div className="space-y-6">
          <AnalyticsSummary analytics={analytics} />

          {/* By Platform */}
          {analytics?.byPlatform?.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <h3 className="font-semibold text-slate-800 mb-4 text-sm">Performance by Platform</h3>
              <div className="space-y-3">
                {analytics.byPlatform.map(p => {
                  const pm = PLATFORM_META[p._id] || {};
                  const PIcon = pm.icon || BarChart3;
                  return (
                    <div key={p._id} className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${pm.bg}`}>
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

          {/* Top Posts */}
          {analytics?.topPosts?.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <h3 className="font-semibold text-slate-800 mb-4 text-sm">Top Performing Posts</h3>
              <div className="space-y-3">
                {analytics.topPosts.map(p => {
                  const pm = PLATFORM_META[p.platform] || {};
                  const PIcon = pm.icon || BarChart3;
                  return (
                    <div key={p._id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${pm.bg} flex-shrink-0`}>
                        <PIcon size={14} className={pm.text} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-slate-700 truncate">{p.caption || `${p.contentType} post`}</p>
                        <p className="text-xs text-slate-400">{p.client?.company} · {timeAgo(p.publishedAt)}</p>
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
        </div>
      )}

      {/* Posts Grid */}
      {tab === 'posts' && (
        <>
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="w-8 h-8 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <BarChart3 size={40} className="mx-auto mb-3 opacity-30" />
              <p className="font-medium">No posts found</p>
              {canEdit && <p className="text-sm mt-1">Create your first social post above</p>}
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {posts.map(post => (
                <PostCard key={post._id} post={post} onEdit={setModal} onDelete={handleDelete} canEdit={canEdit} />
              ))}
            </div>
          )}
        </>
      )}

      {/* Modal */}
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
