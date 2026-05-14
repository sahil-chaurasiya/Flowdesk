import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Mail, Phone, Shield, Calendar, CheckCircle,
  Clock, AlertCircle, Users, Building2, BarChart2, Edit3, X, Save
} from 'lucide-react';
import api from '../../lib/api';
import useAuthStore from '../../context/authStore';
import { Avatar, Card, CardHeader, CardContent, Spinner, EmptyState, Badge } from '../../components/shared/LoadingScreen';
import { Button, Modal, Input, Select } from '../../components/ui/index';
import { formatDate, getTaskStatusColor, getPriorityColor, timeAgo, getStatusColor, PLAN_LABELS, PLAN_COLORS } from '../../lib/utils';

const ROLE_LABELS = {
  admin: 'Admin',
  manager: 'Project Manager',
  performance_marketer: 'Performance Marketer',
  social_media_manager: 'Social Media Manager',
  video_editor: 'Video Editor',
  graphic_designer: 'Graphic Designer',
  copywriter: 'Copywriter',
  client: 'Client',
};

const ROLE_COLORS = {
  admin: 'bg-red-100 text-red-700',
  manager: 'bg-purple-100 text-purple-700',
  performance_marketer: 'bg-blue-100 text-blue-700',
  social_media_manager: 'bg-pink-100 text-pink-700',
  video_editor: 'bg-orange-100 text-orange-700',
  graphic_designer: 'bg-indigo-100 text-indigo-700',
  copywriter: 'bg-teal-100 text-teal-700',
};

const CATEGORY_LABELS = {
  paid_ads: '📊 Paid Ads',
  social_media: '📱 Social Media',
  video_editing: '🎬 Video Editing',
  graphic_design: '🎨 Graphic Design',
  copywriting: '✍️ Copywriting',
  reporting: '📋 Reporting',
  strategy: '🧠 Strategy',
  client_request: '💬 Client Request',
  other: '📌 Other',
};

export default function TeamMemberDetailPage() {
  const { id } = useParams();
  const { user: currentUser } = useAuthStore();
  const isAdmin = currentUser?.role === 'admin';

  const [member, setMember] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [assignedClients, setAssignedClients] = useState([]);
  const [socialPosts, setSocialPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  const [showEditModal, setShowEditModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({});

  const loadData = async () => {
    setLoading(true);
    try {
      const [userRes, taskRes, clientsRes, socialRes] = await Promise.all([
        api.get(`/users/${id}`),
        api.get(`/tasks?assignedTo=${id}&limit=50`),
        api.get(`/clients?limit=100`),
        api.get(`/social/posts?assignedTo=${id}&limit=20`),
      ]);

      const userData = userRes.data.user;
      setMember(userData);
      setTasks(taskRes.data.tasks || []);

      // Filter clients where this user is accountManager or in teamMembers
      const allClients = clientsRes.data.clients || [];
      const myClients = allClients.filter(c =>
        String(c.accountManager?._id || c.accountManager) === String(id) ||
        (c.teamMembers || []).some(m => String(m._id || m) === String(id))
      );
      setAssignedClients(myClients);
      setSocialPosts(socialRes.data.posts || []);

      setEditForm({
        name: userData.name,
        email: userData.email,
        phone: userData.phone || '',
        jobTitle: userData.jobTitle || '',
        department: userData.department || '',
        role: userData.role,
        isActive: userData.isActive,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [id]);

  const handleSaveEdit = async () => {
    setSaving(true);
    try {
      await api.put(`/users/${id}`, editForm);
      setShowEditModal(false);
      loadData();
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>;
  if (!member) return <div className="text-[var(--fd-ink-3)] text-center py-16">Team member not found</div>;

  const pendingTasks = tasks.filter(t => t.status === 'pending').length;
  const inProgressTasks = tasks.filter(t => t.status === 'in_progress').length;
  const completedTasks = tasks.filter(t => t.status === 'completed').length;

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'tasks', label: `Tasks (${tasks.length})` },
    { id: 'clients', label: `Clients (${assignedClients.length})` },
    { id: 'social', label: `Social Posts (${socialPosts.length})` },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link to="/admin/team" className="mt-1 p-1.5 text-[var(--fd-ink-4)] hover:text-[var(--fd-ink-2)] hover:bg-[var(--fd-surface-sunken)] rounded-lg transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <Avatar name={member.name} size="lg" />
            <div>
              <h1 className="text-xl font-bold text-[var(--fd-ink-1)]">{member.name}</h1>
              <p className="text-[var(--fd-ink-3)] text-sm">{member.jobTitle || '—'} {member.department ? `· ${member.department}` : ''}</p>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${ROLE_COLORS[member.role] || 'bg-[var(--fd-surface-sunken)] text-[var(--fd-ink-2)]'}`}>
              {ROLE_LABELS[member.role] || member.role}
            </span>
            {!member.isActive && (
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-[var(--fd-surface-sunken)] text-[var(--fd-ink-3)]">Inactive</span>
            )}
          </div>
        </div>
        {isAdmin && (
          <Button variant="outline" size="sm" onClick={() => setShowEditModal(true)}>
            <Edit3 size={14} />Edit
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[var(--fd-border)] overflow-x-auto">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${activeTab === t.id ? 'border-brand-600 text-brand-600' : 'border-transparent text-[var(--fd-ink-3)] hover:text-[var(--fd-ink-2)]'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-5">
            {/* Contact Info */}
            <Card>
              <CardHeader><h3 className="font-semibold text-[var(--fd-ink-1)] text-sm">Contact Information</h3></CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2 text-[var(--fd-ink-2)]"><Mail size={14} className="text-[var(--fd-ink-4)]" />{member.email}</div>
                  <div className="flex items-center gap-2 text-[var(--fd-ink-2)]"><Phone size={14} className="text-[var(--fd-ink-4)]" />{member.phone || '—'}</div>
                  <div className="flex items-center gap-2 text-[var(--fd-ink-2)]"><Shield size={14} className="text-[var(--fd-ink-4)]" />{member.department || '—'}</div>
                  <div className="flex items-center gap-2 text-[var(--fd-ink-2)]"><Calendar size={14} className="text-[var(--fd-ink-4)]" />Joined {formatDate(member.createdAt)}</div>
                  {member.lastLogin && (
                    <div className="flex items-center gap-2 text-[var(--fd-ink-2)]"><Clock size={14} className="text-[var(--fd-ink-4)]" />Last login {timeAgo(member.lastLogin)}</div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Recent Tasks */}
            <Card>
              <CardHeader><h3 className="font-semibold text-[var(--fd-ink-1)] text-sm">Recent Tasks</h3></CardHeader>
              <CardContent className="space-y-2">
                {tasks.slice(0, 5).length === 0 ? (
                  <p className="text-[var(--fd-ink-4)] text-sm text-center py-4">No tasks assigned</p>
                ) : tasks.slice(0, 5).map(t => (
                  <div key={t._id} className="flex items-center gap-3 p-2.5 bg-[var(--fd-surface-raised)] rounded-lg">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-[var(--fd-ink-1)] truncate">{t.title}</div>
                      <div className="text-xs text-[var(--fd-ink-3)] mt-0.5">{t.client?.company || '—'}</div>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${getTaskStatusColor(t.status)}`}>
                      {t.status?.replace('_', ' ')}
                    </span>
                  </div>
                ))}
                {tasks.length > 5 && (
                  <button onClick={() => setActiveTab('tasks')} className="text-xs text-brand-600 hover:underline w-full text-center pt-1">
                    View all {tasks.length} tasks →
                  </button>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right sidebar stats */}
          <div className="space-y-4">
            <Card>
              <CardHeader><h3 className="font-semibold text-[var(--fd-ink-1)] text-sm">Task Stats</h3></CardHeader>
              <CardContent className="space-y-3">
                {[
                  { label: 'Pending', count: pendingTasks, color: 'bg-amber-100 text-amber-700' },
                  { label: 'In Progress', count: inProgressTasks, color: 'bg-blue-100 text-blue-700' },
                  { label: 'Completed', count: completedTasks, color: 'bg-emerald-100 text-emerald-700' },
                ].map(s => (
                  <div key={s.label} className="flex items-center justify-between">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${s.color}`}>{s.label}</span>
                    <span className="font-bold text-[var(--fd-ink-2)] text-sm">{s.count}</span>
                  </div>
                ))}
                <div className="border-t border-[var(--fd-border-subtle)] pt-2 flex items-center justify-between">
                  <span className="text-xs text-[var(--fd-ink-3)] font-medium">Total</span>
                  <span className="font-bold text-[var(--fd-ink-1)]">{tasks.length}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><h3 className="font-semibold text-[var(--fd-ink-1)] text-sm">Assigned Clients</h3></CardHeader>
              <CardContent>
                {assignedClients.length === 0 ? (
                  <p className="text-[var(--fd-ink-4)] text-sm">No clients assigned</p>
                ) : (
                  <div className="space-y-2">
                    {assignedClients.slice(0, 5).map(c => (
                      <Link key={c._id} to={`/admin/clients/${c._id}`}
                        className="flex items-center gap-2 p-2 hover:bg-[var(--fd-surface-raised)] rounded-lg transition-colors group">
                        <Avatar name={c.company} size="sm" />
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-medium text-[var(--fd-ink-2)] truncate group-hover:text-brand-600">{c.company}</div>
                          <div className="text-xs text-[var(--fd-ink-4)] capitalize">{c.status}</div>
                        </div>
                      </Link>
                    ))}
                    {assignedClients.length > 5 && (
                      <button onClick={() => setActiveTab('clients')} className="text-xs text-brand-600 hover:underline w-full text-center pt-1">
                        +{assignedClients.length - 5} more
                      </button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* TASKS */}
      {activeTab === 'tasks' && (
        <div className="space-y-3">
          {tasks.length === 0 ? (
            <EmptyState icon={CheckCircle} title="No tasks assigned" description="This team member has no tasks yet." />
          ) : (
            <Card>
              <div className="divide-y divide-slate-100">
                {tasks.map(t => (
                  <div key={t._id} className="flex items-center gap-4 px-5 py-3.5">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-[var(--fd-ink-1)] text-sm">{t.title}</div>
                      {t.description && <div className="text-xs text-[var(--fd-ink-3)] mt-0.5 truncate">{t.description}</div>}
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${getTaskStatusColor(t.status)}`}>
                          {t.status?.replace('_', ' ')}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${getPriorityColor(t.priority)}`}>
                          {t.priority}
                        </span>
                        {t.category && t.category !== 'other' && (
                          <span className="text-xs text-[var(--fd-ink-3)]">{CATEGORY_LABELS[t.category]}</span>
                        )}
                        {t.client && (
                          <Link to={`/admin/clients/${t.client._id || t.client}`}
                            className="text-xs text-brand-600 hover:underline">
                            {t.client.company || '—'}
                          </Link>
                        )}
                        {t.deadline && (
                          <span className="text-xs text-[var(--fd-ink-4)] flex items-center gap-1">
                            <Clock size={11} />{formatDate(t.deadline)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* CLIENTS */}
      {activeTab === 'clients' && (
        <div className="space-y-3">
          {assignedClients.length === 0 ? (
            <EmptyState icon={Building2} title="No clients assigned" description="This member isn't assigned to any clients yet." />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {assignedClients.map(c => (
                <Link key={c._id} to={`/admin/clients/${c._id}`}>
                  <Card className="hover:shadow-md hover:border-brand-200 transition-all cursor-pointer">
                    <div className="p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <Avatar name={c.company} size="md" />
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-[var(--fd-ink-1)] truncate">{c.company}</div>
                          <div className="text-xs text-[var(--fd-ink-4)]">{c.name}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${getStatusColor(c.status)}`}>
                          {c.status}
                        </span>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${PLAN_COLORS[c.plan] || 'bg-[var(--fd-surface-sunken)] text-[var(--fd-ink-2)]'}`}>
                          {PLAN_LABELS[c.plan] || c.plan}
                        </span>
                        {String(c.accountManager?._id || c.accountManager) === String(id) && (
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                            Account Manager
                          </span>
                        )}
                      </div>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SOCIAL POSTS */}
      {activeTab === 'social' && (
        <div className="space-y-3">
          {socialPosts.length === 0 ? (
            <EmptyState icon={BarChart2} title="No social posts" description="No social posts assigned to this member." />
          ) : (
            <Card>
              <div className="divide-y divide-slate-100">
                {socialPosts.map(post => (
                  <div key={post._id} className="flex items-start gap-4 px-5 py-3.5">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-xs font-semibold text-[var(--fd-ink-2)] capitalize">{post.platform?.replace('_', ' ')}</span>
                        <span className="px-2 py-0.5 bg-[var(--fd-surface-sunken)] text-[var(--fd-ink-2)] rounded-full text-xs capitalize">{post.contentType}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                          post.status === 'published' ? 'bg-emerald-100 text-emerald-700'
                          : post.status === 'scheduled' ? 'bg-blue-100 text-blue-700'
                          : post.status === 'draft' ? 'bg-[var(--fd-surface-sunken)] text-[var(--fd-ink-2)]'
                          : 'bg-red-100 text-red-600'
                        }`}>{post.status}</span>
                        {post.client && (
                          <Link to={`/admin/clients/${post.client._id}`} className="text-xs text-brand-600 hover:underline">
                            {post.client.company}
                          </Link>
                        )}
                      </div>
                      {post.caption && <p className="text-sm text-[var(--fd-ink-2)] line-clamp-2">{post.caption}</p>}
                      {post.publishedAt && (
                        <div className="text-xs text-[var(--fd-ink-4)] mt-1">Published {timeAgo(post.publishedAt)}</div>
                      )}
                      {post.scheduledAt && post.status === 'scheduled' && (
                        <div className="text-xs text-[var(--fd-ink-4)] mt-1">Scheduled for {formatDate(post.scheduledAt)}</div>
                      )}
                      {post.status === 'published' && post.metrics && (
                        <div className="flex items-center gap-3 mt-2 text-xs text-[var(--fd-ink-3)]">
                          <span>❤️ {(post.metrics.likes || 0).toLocaleString()}</span>
                          <span>💬 {(post.metrics.comments || 0).toLocaleString()}</span>
                          <span>↗️ {(post.metrics.shares || 0).toLocaleString()}</span>
                          <span>👁️ {(post.metrics.reach || 0).toLocaleString()}</span>
                          {post.metrics.engagementRate > 0 && (
                            <span className="text-emerald-600 font-medium">{post.metrics.engagementRate.toFixed(2)}% eng.</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Edit Modal */}
      {isAdmin && (
        <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Edit Team Member"
          footer={
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setShowEditModal(false)}>Cancel</Button>
              <Button loading={saving} onClick={handleSaveEdit}>Save Changes</Button>
            </div>
          }>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Input label="Full Name" value={editForm.name || ''} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))} />
              <Input label="Email" type="email" value={editForm.email || ''} onChange={e => setEditForm(p => ({ ...p, email: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Phone" value={editForm.phone || ''} onChange={e => setEditForm(p => ({ ...p, phone: e.target.value }))} />
              <Input label="Job Title" value={editForm.jobTitle || ''} onChange={e => setEditForm(p => ({ ...p, jobTitle: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Department" value={editForm.department || ''} onChange={e => setEditForm(p => ({ ...p, department: e.target.value }))} />
              <Select label="Role" value={editForm.role || ''} onChange={e => setEditForm(p => ({ ...p, role: e.target.value }))}>
                {Object.entries(ROLE_LABELS).filter(([k]) => k !== 'client').map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </Select>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={!!editForm.isActive}
                onChange={e => setEditForm(p => ({ ...p, isActive: e.target.checked }))}
                className="rounded" />
              <span className="text-sm text-[var(--fd-ink-2)]">Active</span>
            </label>
          </div>
        </Modal>
      )}
    </div>
  );
}