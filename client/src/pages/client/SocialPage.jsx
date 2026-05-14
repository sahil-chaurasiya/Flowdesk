import React, { useEffect, useState } from 'react';
import {
  Instagram, Facebook, Youtube, Linkedin, Twitter,
  BarChart3, Heart, MessageCircle, Share2, Eye,
  TrendingUp, Play, ArrowUpRight, Calendar
} from 'lucide-react';
import api from '../../lib/api';
import useAuthStore from '../../context/authStore';
import { timeAgo, formatDate } from '../../lib/utils';

const PLATFORM_META = {
  instagram:      { label: 'Instagram',        icon: Instagram,  color: 'from-pink-500 to-purple-600',  bg: 'bg-pink-50',    text: 'text-pink-600' },
  facebook:       { label: 'Facebook',         icon: Facebook,   color: 'from-blue-600 to-blue-800',    bg: 'bg-blue-50',    text: 'text-blue-700' },
  tiktok:         { label: 'TikTok',           icon: Play,       color: 'from-slate-800 to-slate-950',  bg: 'bg-[var(--fd-surface-sunken)]',  text: 'text-[var(--fd-ink-1)]' },
  youtube:        { label: 'YouTube',          icon: Youtube,    color: 'from-red-500 to-red-700',      bg: 'bg-red-50',     text: 'text-red-600' },
  linkedin:       { label: 'LinkedIn',         icon: Linkedin,   color: 'from-blue-700 to-blue-900',    bg: 'bg-blue-50',    text: 'text-blue-800' },
  twitter:        { label: 'Twitter / X',      icon: Twitter,    color: 'from-slate-700 to-slate-900',  bg: 'bg-[var(--fd-surface-raised)]',   text: 'text-[var(--fd-ink-2)]' },
  google_business:{ label: 'Google Business',  icon: BarChart3,  color: 'from-emerald-500 to-green-600',bg: 'bg-emerald-50', text: 'text-emerald-700' },
};

function fmtNum(n) {
  if (!n) return '0';
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return String(n);
}

function PostCard({ post }) {
  const pm = PLATFORM_META[post.platform] || {};
  const PIcon = pm.icon || BarChart3;
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-[var(--fd-surface)] border border-[var(--fd-border)] rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all">
      {/* Media */}
      <div className="relative h-48 bg-[var(--fd-surface-sunken)]">
        {post.mediaUrls?.[0] ? (
          <img src={post.mediaUrls[0]} alt="social post" className="w-full h-full object-cover" />
        ) : post.thumbnail ? (
          <img src={post.thumbnail} alt="thumbnail" className="w-full h-full object-cover" />
        ) : (
          <div className={`w-full h-full flex items-center justify-center bg-gradient-to-br ${pm.color}`}>
            <PIcon size={36} className="text-white/50" />
          </div>
        )}
        <div className={`absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${pm.bg} ${pm.text} shadow`}>
          <PIcon size={10} />{pm.label}
        </div>
        <div className="absolute top-3 right-3 bg-black/40 text-white text-xs px-2 py-0.5 rounded-full capitalize">
          {post.contentType}
        </div>
      </div>

      {/* Body */}
      <div className="p-4">
        {post.caption && (
          <div>
            <p className={`text-sm text-[var(--fd-ink-2)] ${expanded ? '' : 'line-clamp-2'}`}>{post.caption}</p>
            {post.caption.length > 100 && (
              <button onClick={() => setExpanded(!expanded)} className="text-xs text-brand-600 mt-1">
                {expanded ? 'Show less' : 'Read more'}
              </button>
            )}
          </div>
        )}

        <p className="text-xs text-[var(--fd-ink-4)] mt-2 flex items-center gap-1">
          <Calendar size={10} />
          {post.publishedAt ? `Published ${timeAgo(post.publishedAt)}` : `Scheduled ${formatDate(post.scheduledAt)}`}
        </p>

        {/* Metrics */}
        {post.status === 'published' && (
          <div className="mt-3 pt-3 border-t border-[var(--fd-border-subtle)] grid grid-cols-4 gap-1 text-center">
            {[
              { icon: Heart, val: post.metrics?.likes, label: 'Likes', color: 'text-pink-500' },
              { icon: MessageCircle, val: post.metrics?.comments, label: 'Comments', color: 'text-blue-500' },
              { icon: Share2, val: post.metrics?.shares, label: 'Shares', color: 'text-green-500' },
              { icon: Eye, val: post.metrics?.views, label: 'Views', color: 'text-purple-500' },
            ].map(({ icon: Icon, val, label, color }) => (
              <div key={label}>
                <Icon size={12} className={`mx-auto ${color} mb-0.5`} />
                <div className="text-xs font-bold text-[var(--fd-ink-2)]">{fmtNum(val)}</div>
                <div className="text-[10px] text-[var(--fd-ink-4)]">{label}</div>
              </div>
            ))}
          </div>
        )}

        {post.metrics?.engagementRate > 0 && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
            <TrendingUp size={11} />
            {post.metrics.engagementRate.toFixed(1)}% engagement rate
          </div>
        )}
      </div>
    </div>
  );
}

export default function ClientSocialPage() {
  const { user } = useAuthStore();
  const [posts, setPosts] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [platform, setPlatform] = useState('');
  const [tab, setTab] = useState('feed');

  useEffect(() => {
    const load = async () => {
      try {
        const params = new URLSearchParams({ limit: '30', status: 'published' });
        if (platform) params.set('platform', platform);
        const postsRes = await api.get(`/social/posts?${params}`);
        setPosts(postsRes.data.posts || []);
        try {
          const analyticsRes = await api.get('/social/analytics?days=30');
          setAnalytics(analyticsRes.data.analytics);
        } catch {
          setAnalytics(null);
        }
      } catch (e) {
        console.error('Social posts load error:', e?.response?.data?.message || e.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [platform]);

  const totals = analytics?.totals || {};
  const platforms = [...new Set(posts.map(p => p.platform))];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-[var(--fd-ink-1)]">Social Media</h1>
        <p className="text-[var(--fd-ink-3)] text-sm mt-0.5">Your published content and performance overview</p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Posts Published', val: fmtNum(totals.totalPosts), icon: BarChart3, color: 'blue' },
          { label: 'Total Reach',     val: fmtNum(totals.totalReach), icon: TrendingUp, color: 'green' },
          { label: 'Total Likes',     val: fmtNum(totals.totalLikes), icon: Heart, color: 'pink' },
          { label: 'Avg Engagement',  val: totals.avgEngagementRate ? totals.avgEngagementRate.toFixed(1) + '%' : '—', icon: ArrowUpRight, color: 'purple' },
        ].map(({ label, val, icon: Icon, color }) => (
          <div key={label} className="bg-[var(--fd-surface)] border border-[var(--fd-border)] rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-[var(--fd-ink-3)]">{label}</span>
              <Icon size={13} className={`text-${color}-500`} />
            </div>
            <div className="text-2xl font-bold text-[var(--fd-ink-1)]">{val}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[var(--fd-surface-sunken)] rounded-lg p-1 w-fit">
        {[{ key: 'feed', label: 'Content Feed' }, { key: 'breakdown', label: 'Platform Breakdown' }].map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${tab === key ? 'bg-[var(--fd-surface)] shadow-sm text-[var(--fd-ink-1)]' : 'text-[var(--fd-ink-3)] hover:text-[var(--fd-ink-2)]'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'feed' && (
        <>
          {/* Platform filter */}
          {platforms.length > 1 && (
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => setPlatform('')}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${platform === '' ? 'bg-[var(--fd-ink-1)] text-[var(--fd-canvas)] border-[var(--fd-ink-1)]' : 'border-[var(--fd-border)] text-[var(--fd-ink-2)] hover:border-[var(--fd-border-strong)]'}`}>
                All Platforms
              </button>
              {platforms.map(p => {
                const pm = PLATFORM_META[p] || {};
                const PIcon = pm.icon || BarChart3;
                return (
                  <button key={p} onClick={() => setPlatform(p)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${platform === p ? `${pm.bg} ${pm.text} border-current` : 'border-[var(--fd-border)] text-[var(--fd-ink-2)] hover:border-[var(--fd-border-strong)]'}`}>
                    <PIcon size={10} />{pm.label}
                  </button>
                );
              })}
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-16">
              <div className="w-8 h-8 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-16 text-[var(--fd-ink-4)]">
              <BarChart3 size={40} className="mx-auto mb-3 opacity-30" />
              <p className="font-medium">No published content yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {posts.map(post => <PostCard key={post._id} post={post} />)}
            </div>
          )}
        </>
      )}

      {tab === 'breakdown' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {(analytics?.byPlatform || []).map(p => {
            const pm = PLATFORM_META[p._id] || {};
            const PIcon = pm.icon || BarChart3;
            return (
              <div key={p._id} className="bg-[var(--fd-surface)] border border-[var(--fd-border)] rounded-xl p-5 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${pm.bg}`}>
                    <PIcon size={18} className={pm.text} />
                  </div>
                  <div>
                    <div className="font-semibold text-[var(--fd-ink-1)]">{pm.label}</div>
                    <div className="text-xs text-[var(--fd-ink-3)]">{p.posts} posts this month</div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Likes', val: p.totalLikes },
                    { label: 'Comments', val: p.totalComments },
                    { label: 'Shares', val: p.totalShares },
                    { label: 'Views', val: p.totalViews },
                    { label: 'Reach', val: p.totalReach },
                    { label: 'Engagement', val: p.avgEngagementRate ? p.avgEngagementRate.toFixed(1) + '%' : '—' },
                  ].map(({ label, val }) => (
                    <div key={label} className="bg-[var(--fd-surface-raised)] rounded-lg p-2 text-center">
                      <div className="text-sm font-bold text-[var(--fd-ink-1)]">{fmtNum(val)}</div>
                      <div className="text-xs text-[var(--fd-ink-3)]">{label}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}