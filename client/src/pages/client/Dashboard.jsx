import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  TrendingUp, FileText, MessageCircle, ClipboardList,
  CheckCircle, Clock, Rss, Target, BarChart3,
  ChevronRight, Eye, Heart, Instagram,
} from 'lucide-react';
import api from '../../lib/api';
import useAuthStore from '../../context/authStore';
import {
  StatCard, Card, CardHeader, CardContent,
  Avatar, Spinner,
} from '../../components/shared/LoadingScreen';
import { formatDate, timeAgo, SERVICE_LABELS, PLAN_LABELS } from '../../lib/utils';

const STATUS_STYLE = {
  new:       { background: '#f5f4f1', color: '#7a7770' },
  contacted: { background: '#eff0fe', color: '#3a56d4' },
  qualified: { background: '#fef7ea', color: '#92600a' },
  converted: { background: '#edf7f1', color: '#2a7d4f' },
  lost:      { background: '#fef2f2', color: '#b91c1c' },
};

const PLATFORM_ICON = {
  instagram: '📸', facebook: '📘', tiktok: '🎵',
  youtube: '▶️', linkedin: '💼', twitter: '🐦',
};

function fmtNum(n) {
  if (!n) return '0';
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return String(n);
}

function SectionHeader({ title, icon: Icon, linkTo }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        {Icon && <Icon size={13} color="#a8a49e" strokeWidth={1.7} />}
        <span className="text-[13.5px] font-semibold" style={{ color: '#1a1916' }}>{title}</span>
      </div>
      {linkTo && (
        <Link
          to={linkTo}
          className="flex items-center gap-1 text-[12px] font-medium transition-colors"
          style={{ color: '#4f6ef0' }}
        >
          View all <ChevronRight size={12} />
        </Link>
      )}
    </div>
  );
}

export default function ClientDashboard() {
  const { user } = useAuthStore();
  const [overview, setOverview] = useState(null);
  const [leadStats, setLeadStats] = useState(null);
  const [recentLeads, setRecentLeads] = useState([]);
  const [socialAnalytics, setSocialAnalytics] = useState(null);
  const [recentPosts, setRecentPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.clientId) return;
    Promise.all([
      api.get(`/clients/${user.clientId}/overview`),
      api.get('/leads/stats').catch(() => ({ data: null })),
      api.get('/leads?limit=5').catch(() => ({ data: { leads: [] } })),
      api.get('/social/analytics?days=30').catch(() => ({ data: null })),
      api.get('/social/posts?status=published&limit=3').catch(() => ({ data: { posts: [] } })),
    ]).then(([ov, ls, l, sa, p]) => {
      setOverview(ov.data);
      setLeadStats(ls.data);
      setRecentLeads(l.data.leads || []);
      setSocialAnalytics(sa.data?.analytics || null);
      setRecentPosts(p.data.posts || []);
    }).finally(() => setLoading(false));
  }, [user?.clientId]);

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>;

  const client = overview?.client;
  const manager = client?.accountManager;
  const completedTasks = overview?.taskStats?.find(t => t._id === 'completed')?.count || 0;
  const inProgressTasks = overview?.taskStats?.find(t => t._id === 'in_progress')?.count || 0;
  const totalLeads = leadStats?.total || 0;
  const newLeads = leadStats?.byStatus?.find(s => s._id === 'new')?.count || 0;
  const totals = socialAnalytics?.totals || {};

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1
            className="text-[22px] font-bold tracking-[-0.02em] leading-none mb-1.5"
            style={{ color: '#1a1916' }}
          >
            Welcome back, {user?.name?.split(' ')[0]}
          </h1>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[13px]" style={{ color: '#7a7770' }}>{client?.company}</span>
            {client?.plan && (
              <>
                <span style={{ color: '#ccc9c2' }}>·</span>
                <span
                  className="text-[11.5px] font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: '#eff0fe', color: '#3a56d4' }}
                >
                  {(PLAN_LABELS || {})[client.plan] || client.plan} Plan
                </span>
              </>
            )}
          </div>
        </div>
        <div
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11.5px] font-semibold capitalize flex-shrink-0"
          style={client?.status === 'active'
            ? { background: '#edf7f1', color: '#2a7d4f', border: '1px solid #b8e2c9' }
            : { background: '#f5f4f1', color: '#7a7770', border: '1px solid #e8e5e0' }
          }
        >
          <span
            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
            style={{ background: client?.status === 'active' ? '#2a7d4f' : '#a8a49e' }}
          />
          {client?.status}
        </div>
      </div>

      {/* ── Stats ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard title="Services Active"   value={client?.services?.length || 0}  icon={TrendingUp}  color="blue" />
        <StatCard title="In Progress"       value={inProgressTasks}                 icon={Clock}       color="orange" />
        <StatCard title="Completed"         value={completedTasks}                  icon={CheckCircle} color="green" />
        <StatCard title="Total Leads"       value={totalLeads}                      icon={Target}      color="purple" subtitle={newLeads > 0 ? `${newLeads} new` : undefined} />
      </div>

      {/* ── Social snapshot ────────────────────────────────────────────── */}
      {totals.totalPosts > 0 && (
        <Card>
          <CardHeader>
            <SectionHeader title="Social Media" icon={Instagram} linkTo="/portal/social" />
            <p className="text-[11.5px] mt-0.5" style={{ color: '#a8a49e' }}>Last 30 days</p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
              {[
                { label: 'Posts',       val: fmtNum(totals.totalPosts),        icon: BarChart3, color: '#4f6ef0' },
                { label: 'Reach',       val: fmtNum(totals.totalReach),        icon: Eye,       color: '#7e22ce' },
                { label: 'Likes',       val: fmtNum(totals.totalLikes),        icon: Heart,     color: '#9d174d' },
                {
                  label: 'Engagement',
                  val: totals.avgEngagementRate ? totals.avgEngagementRate.toFixed(1) + '%' : '—',
                  icon: TrendingUp, color: '#2a7d4f',
                },
              ].map(({ label, val, icon: Icon, color }) => (
                <div
                  key={label}
                  className="p-4 rounded-xl text-center"
                  style={{ background: '#fafaf9', border: '1px solid #eeece8' }}
                >
                  <Icon size={14} color={color} className="mx-auto mb-2" strokeWidth={1.7} />
                  <div className="text-[17px] font-bold tabular-nums" style={{ color: '#1a1916' }}>{val}</div>
                  <div className="text-[11px] mt-0.5" style={{ color: '#a8a49e' }}>{label}</div>
                </div>
              ))}
            </div>
            {recentPosts.length > 0 && (
              <div className="flex gap-2.5 overflow-x-auto pb-1">
                {recentPosts.map(post => (
                  <div key={post._id} className="flex-shrink-0 w-[80px]">
                    <div
                      className="h-[64px] rounded-lg overflow-hidden flex items-center justify-center"
                      style={{ background: '#f5f4f1', border: '1px solid #e8e5e0' }}
                    >
                      {post.mediaUrls?.[0] ? (
                        <img src={post.mediaUrls[0]} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xl">{PLATFORM_ICON[post.platform] || '📱'}</span>
                      )}
                    </div>
                    <p className="text-[10px] mt-1.5 truncate capitalize" style={{ color: '#a8a49e' }}>
                      {post.platform}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* ── Left column ─────────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-5">

          {/* Recent updates */}
          <Card>
            <CardHeader>
              <SectionHeader title="Recent Updates" icon={Rss} linkTo="/portal/updates" />
            </CardHeader>
            <CardContent className="p-0">
              {!overview?.recentUpdates?.length ? (
                <div className="py-10 text-center">
                  <Rss size={22} color="#ccc9c2" strokeWidth={1.3} className="mx-auto mb-2" />
                  <p className="text-[13px]" style={{ color: '#a8a49e' }}>No updates yet</p>
                </div>
              ) : (
                overview.recentUpdates.map(u => (
                  <div
                    key={u._id}
                    className="flex gap-3.5 px-5 py-4 border-b last:border-0 transition-colors"
                    style={{ borderColor: '#f2f0ec' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#fafaf9'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <Avatar name={u.author?.name} size="sm" className="flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-semibold" style={{ color: '#1a1916' }}>
                        {u.title}
                      </div>
                      <p
                        className="text-[12.5px] mt-0.5 line-clamp-2 leading-relaxed"
                        style={{ color: '#7a7770' }}
                      >
                        {u.content}
                      </p>
                      <div className="text-[11px] mt-1.5 font-mono" style={{ color: '#ccc9c2' }}>
                        {timeAgo(u.createdAt)}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Recent leads */}
          {recentLeads.length > 0 && (
            <Card>
              <CardHeader>
                <SectionHeader title="Recent Leads" icon={Target} linkTo="/portal/leads" />
              </CardHeader>
              <CardContent className="p-0">
                {recentLeads.map(lead => (
                  <div
                    key={lead._id}
                    className="flex items-center justify-between px-5 py-3.5 border-b last:border-0"
                    style={{ borderColor: '#f2f0ec' }}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-medium truncate" style={{ color: '#1a1916' }}>
                        {lead.name || lead.email || 'Anonymous Lead'}
                      </div>
                      <div className="text-[11.5px] mt-0.5" style={{ color: '#a8a49e' }}>
                        {lead.source && `${lead.source} · `}{timeAgo(lead.createdAt)}
                      </div>
                    </div>
                    <span
                      className="text-[10.5px] font-semibold px-2.5 py-0.5 rounded-full capitalize ml-3 flex-shrink-0"
                      style={STATUS_STYLE[lead.status] || STATUS_STYLE.new}
                    >
                      {lead.status}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* ── Right column ─────────────────────────────────────────────── */}
        <div className="space-y-4">

          {/* Account manager */}
          {manager && (
            <Card>
              <CardContent className="p-4">
                <p className="text-[10.5px] font-semibold uppercase tracking-wider mb-3" style={{ color: '#a8a49e' }}>
                  Your Account Manager
                </p>
                <div className="flex items-center gap-3 mb-4">
                  <Avatar name={manager.name} size="md" />
                  <div>
                    <div className="text-[13.5px] font-semibold" style={{ color: '#1a1916' }}>{manager.name}</div>
                    <div className="text-[11.5px]" style={{ color: '#a8a49e' }}>Project Manager</div>
                  </div>
                </div>
                <Link
                  to="/portal/chat"
                  className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg text-[12.5px] font-medium transition-all border"
                  style={{
                    background: '#eff0fe', color: '#3a56d4', borderColor: '#c5d4fb',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#e3eafd'}
                  onMouseLeave={e => e.currentTarget.style.background = '#eff0fe'}
                >
                  <MessageCircle size={13} />
                  Send Message
                </Link>
              </CardContent>
            </Card>
          )}

          {/* Quick actions */}
          <Card>
            <CardContent className="p-4">
              <p className="text-[10.5px] font-semibold uppercase tracking-wider mb-3" style={{ color: '#a8a49e' }}>
                Quick Actions
              </p>
              <div className="space-y-1">
                {[
                  { to: '/portal/requests', icon: ClipboardList, label: 'Submit a Request', desc: 'New task or revision' },
                  { to: '/portal/chat',     icon: MessageCircle, label: 'Open Chat',         desc: 'Message your team' },
                  { to: '/portal/files',    icon: FileText,      label: 'View Files',         desc: 'Deliverables & assets' },
                  { to: '/portal/reports',  icon: BarChart3,     label: 'Reports',             desc: 'Performance data' },
                ].map(({ to, icon: Icon, label, desc }) => (
                  <Link
                    key={to}
                    to={to}
                    className="flex items-center gap-3 p-2.5 rounded-lg transition-colors group"
                    onMouseEnter={e => e.currentTarget.style.background = '#f5f4f1'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-all"
                      style={{ background: '#f5f4f1' }}
                    >
                      <Icon size={13} color="#a8a49e" strokeWidth={1.7} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[12.5px] font-medium" style={{ color: '#44423d' }}>{label}</div>
                      <div className="text-[11px]" style={{ color: '#a8a49e' }}>{desc}</div>
                    </div>
                    <ChevronRight size={12} color="#ccc9c2" className="flex-shrink-0" />
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Active services */}
          {client?.services?.length > 0 && (
            <Card>
              <CardContent className="p-4">
                <p className="text-[10.5px] font-semibold uppercase tracking-wider mb-3" style={{ color: '#a8a49e' }}>
                  Active Services
                </p>
                <div className="space-y-2">
                  {client.services.map(s => (
                    <div key={s} className="flex items-center gap-2">
                      <span
                        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{ background: '#4f6ef0' }}
                      />
                      <span className="text-[12.5px]" style={{ color: '#44423d' }}>
                        {(SERVICE_LABELS || {})[s] || s}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
