import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  TrendingUp, FileText, MessageCircle, ClipboardList,
  ArrowRight, CheckCircle, Clock, Rss, Target, Users,
  Instagram, Heart, Eye, BarChart3
} from 'lucide-react';
import api from '../../lib/api';
import useAuthStore from '../../context/authStore';
import { StatCard, Card, CardHeader, CardContent, Avatar, Spinner } from '../../components/shared/LoadingScreen';
import { formatDate, getStatusColor, PLAN_LABELS, SERVICE_LABELS, formatCurrency, timeAgo } from '../../lib/utils';

const STATUS_COLORS = {
  new: 'bg-slate-100 text-slate-600',
  contacted: 'bg-blue-100 text-blue-700',
  qualified: 'bg-amber-100 text-amber-700',
  converted: 'bg-emerald-100 text-emerald-700',
  lost: 'bg-red-100 text-red-600',
};

const PLATFORM_ICONS = {
  instagram: '📸', facebook: '📘', tiktok: '🎵', youtube: '▶️',
  linkedin: '💼', twitter: '🐦', google_business: '📍'
};

function fmtNum(n) {
  if (!n) return '0';
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return String(n);
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
    const load = async () => {
      try {
        const [overviewRes, leadStatsRes, leadsRes, socialRes, postsRes] = await Promise.all([
          api.get(`/clients/${user.clientId}/overview`),
          api.get('/leads/stats').catch(() => ({ data: null })),
          api.get('/leads?limit=5').catch(() => ({ data: { leads: [] } })),
          api.get('/social/analytics?days=30').catch(() => ({ data: null })),
          api.get('/social/posts?status=published&limit=3').catch(() => ({ data: { posts: [] } })),
        ]);
        setOverview(overviewRes.data);
        setLeadStats(leadStatsRes.data);
        setRecentLeads(leadsRes.data.leads || []);
        setSocialAnalytics(socialRes.data?.analytics || null);
        setRecentPosts(postsRes.data.posts || []);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user?.clientId]);

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>;

  const client = overview?.client;
  const manager = client?.accountManager;

  const completedTasks = overview?.taskStats?.find(t => t._id === 'completed')?.count || 0;
  const pendingTasks = overview?.taskStats?.find(t => t._id === 'pending')?.count || 0;
  const inProgressTasks = overview?.taskStats?.find(t => t._id === 'in_progress')?.count || 0;
  const totalLeads = leadStats?.total || 0;
  const newLeads = leadStats?.byStatus?.find(s => s._id === 'new')?.count || 0;
  const socialTotals = socialAnalytics?.totals || {};

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Welcome back, {user?.name?.split(' ')[0]} 👋</h1>
          <p className="text-slate-500 text-sm mt-0.5">{client?.company} · {PLAN_LABELS[client?.plan] || client?.plan} Plan</p>
        </div>
        <span className={`px-3 py-1.5 rounded-full text-sm font-medium capitalize ${getStatusColor(client?.status)}`}>
          {client?.status}
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Active Services" value={client?.services?.length || 0} icon={TrendingUp} color="blue" />
        <StatCard title="Tasks In Progress" value={inProgressTasks} icon={Clock} color="orange" />
        <StatCard title="Completed Tasks" value={completedTasks} icon={CheckCircle} color="green" />
        <StatCard title="Total Leads" value={totalLeads} icon={Target} color="purple" subtitle={newLeads > 0 ? `${newLeads} new` : undefined} />
      </div>

      {/* Social Media Snapshot */}
      {socialTotals.totalPosts > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-800 text-sm flex items-center gap-2">
                <Instagram size={15} className="text-pink-500" /> Social Media (Last 30 Days)
              </h3>
              <Link to="/portal/social" className="text-brand-600 text-xs font-medium hover:underline flex items-center gap-1">
                View all <ArrowRight size={12} />
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              {[
                { label: 'Posts', val: fmtNum(socialTotals.totalPosts), icon: BarChart3 },
                { label: 'Reach', val: fmtNum(socialTotals.totalReach), icon: Eye },
                { label: 'Likes', val: fmtNum(socialTotals.totalLikes), icon: Heart },
                { label: 'Avg Engagement', val: socialTotals.avgEngagementRate ? socialTotals.avgEngagementRate.toFixed(1) + '%' : '—', icon: TrendingUp },
              ].map(({ label, val, icon: Icon }) => (
                <div key={label} className="bg-slate-50 rounded-lg p-3 text-center">
                  <div className="text-sm font-bold text-slate-800">{val}</div>
                  <div className="text-xs text-slate-500">{label}</div>
                </div>
              ))}
            </div>
            {recentPosts.length > 0 && (
              <div className="flex gap-3 overflow-x-auto pb-1">
                {recentPosts.map(post => (
                  <div key={post._id} className="flex-shrink-0 w-24">
                    <div className="h-20 rounded-lg bg-slate-200 overflow-hidden">
                      {post.mediaUrls?.[0] ? (
                        <img src={post.mediaUrls[0]} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-2xl">
                          {PLATFORM_ICONS[post.platform] || '📱'}
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-1 truncate">{post.platform}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Updates + Leads */}
        <div className="lg:col-span-2 space-y-5">
          {/* Recent Updates */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-slate-800 text-sm">Recent Updates</h3>
                <Link to="/portal/updates" className="text-brand-600 text-xs font-medium hover:underline flex items-center gap-1">
                  View all <ArrowRight size={12} />
                </Link>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {!overview?.recentUpdates?.length ? (
                <div className="py-8 text-center text-slate-400 text-sm">No updates yet</div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {overview.recentUpdates.map(u => (
                    <div key={u._id} className="flex gap-3 px-5 py-4">
                      <Avatar name={u.author?.name} size="sm" className="flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <div className="font-medium text-slate-800 text-sm">{u.title}</div>
                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{u.content}</p>
                        <div className="text-xs text-slate-400 mt-1">{timeAgo(u.createdAt)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Leads */}
          {recentLeads.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-slate-800 text-sm flex items-center gap-2">
                    <Target size={15} className="text-brand-600" /> Recent Leads
                  </h3>
                  <Link to="/portal/leads" className="text-brand-600 text-xs font-medium hover:underline flex items-center gap-1">
                    View all <ArrowRight size={12} />
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-slate-100">
                  {recentLeads.map(lead => (
                    <div key={lead._id} className="flex items-center justify-between px-5 py-3.5">
                      <div>
                        <div className="text-sm font-medium text-slate-800">{lead.name || lead.email || 'Anonymous Lead'}</div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          {lead.source && <span className="text-slate-500">{lead.source} · </span>}
                          {timeAgo(lead.leadDate || lead.createdAt)}
                        </div>
                      </div>
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${STATUS_COLORS[lead.status]}`}>
                        {lead.status?.charAt(0).toUpperCase() + lead.status?.slice(1)}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-5">
          {/* Account Manager */}
          {manager && (
            <Card>
              <CardHeader>
                <h3 className="font-semibold text-slate-800 text-sm">Your Account Team</h3>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3 mb-3">
                  <Avatar name={manager.name} size="md" />
                  <div>
                    <div className="font-medium text-slate-800 text-sm">{manager.name}</div>
                    <div className="text-xs text-slate-500">{manager.jobTitle || 'Project Manager'}</div>
                  </div>
                </div>
                <Link
                  to="/portal/chat"
                  className="flex items-center justify-center gap-2 w-full bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium py-2 rounded-lg transition-colors"
                >
                  <MessageCircle size={14} /> Message Team
                </Link>
              </CardContent>
            </Card>
          )}

          {/* Services */}
          {client?.services?.length > 0 && (
            <Card>
              <CardHeader>
                <h3 className="font-semibold text-slate-800 text-sm">Active Services</h3>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {client.services.map(s => (
                    <span key={s} className="bg-brand-50 text-brand-700 border border-brand-100 text-xs px-2.5 py-1 rounded-full font-medium">
                      {SERVICE_LABELS[s] || s}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Quick links */}
          <Card>
            <CardHeader>
              <h3 className="font-semibold text-slate-800 text-sm">Quick Access</h3>
            </CardHeader>
            <CardContent className="p-0">
              {[
                { to: '/portal/social', icon: Instagram, label: 'Social Media', color: 'text-pink-500' },
                { to: '/portal/leads', icon: Target, label: 'View All Leads', color: 'text-purple-600' },
                { to: '/portal/reports', icon: TrendingUp, label: 'Performance Reports', color: 'text-brand-600' },
                { to: '/portal/files', icon: FileText, label: 'Files & Assets', color: 'text-emerald-600' },
                { to: '/portal/requests', icon: ClipboardList, label: 'Submit a Request', color: 'text-orange-600' },
              ].map(link => (
                <Link
                  key={link.to}
                  to={link.to}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0"
                >
                  <link.icon size={16} className={link.color} />
                  <span className="text-sm text-slate-700">{link.label}</span>
                  <ArrowRight size={12} className="ml-auto text-slate-300" />
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}