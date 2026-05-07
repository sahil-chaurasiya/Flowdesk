import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Edit3, MessageSquare, Mail, Phone, Globe, Calendar,
  DollarSign, Plus, CheckCircle, Clock, AlertCircle, Users, X, UserPlus
} from 'lucide-react';
import api from '../../lib/api';
import useAuthStore from '../../context/authStore';
import { Button, Modal, Input, Textarea, Select } from '../../components/ui/index';
import { Avatar, Badge, Card, CardHeader, CardContent, Spinner, EmptyState } from '../../components/shared/LoadingScreen';
import {
  formatDate, getStatusColor, PLAN_LABELS, PLAN_COLORS, SERVICE_LABELS,
  formatCurrency, getTaskStatusColor, getPriorityColor, timeAgo
} from '../../lib/utils';

const updateTypes = ['general', 'milestone', 'report', 'alert', 'campaign_launch', 'optimization', 'meeting_notes'];

const ROLE_LABELS = {
  admin: 'Admin',
  manager: 'Project Manager',
  performance_marketer: 'Performance Marketer',
  social_media_manager: 'Social Media Manager',
  video_editor: 'Video Editor',
  graphic_designer: 'Graphic Designer',
  copywriter: 'Copywriter',
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

export default function ClientDetailPage() {
  const { id } = useParams();
  const { user } = useAuthStore();
  const isManager = ['admin', 'manager'].includes(user?.role);

  const [overview, setOverview] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState([]);
  const [updates, setUpdates] = useState([]);
  const [files, setFiles] = useState([]);
  const [reports, setReports] = useState([]);
  const [allTeamMembers, setAllTeamMembers] = useState([]);

  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingTeam, setSavingTeam] = useState(false);

  const [updateForm, setUpdateForm] = useState({ title: '', content: '', type: 'general' });
  const [taskForm, setTaskForm] = useState({
    title: '', description: '', priority: 'medium', deadline: '',
    assignedTo: '', category: 'other', isClientVisible: true
  });
  const [editForm, setEditForm] = useState({});
  const [addMemberId, setAddMemberId] = useState('');

  useEffect(() => {
    api.get('/users?limit=100').then(r => {
      const team = (r.data.users || []).filter(u => u.role !== 'client');
      setAllTeamMembers(team);
    }).catch(() => {});
  }, []);

  useEffect(() => { loadData(); }, [id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [ovRes, taskRes, updRes, fileRes, repRes] = await Promise.all([
        api.get(`/clients/${id}/overview`),
        api.get(`/tasks?clientId=${id}&limit=50`),
        api.get(`/updates?clientId=${id}&limit=20`),
        api.get(`/files?clientId=${id}&limit=20`),
        api.get(`/reports?clientId=${id}&limit=10`),
      ]);
      setOverview(ovRes.data);
      setTasks(taskRes.data.tasks || []);
      setUpdates(updRes.data.updates || []);
      setFiles(fileRes.data.files || []);
      setReports(repRes.data.reports || []);
    } finally { setLoading(false); }
  };

  const handleAddUpdate = async () => {
    if (!updateForm.title.trim() || !updateForm.content.trim()) return;
    setSaving(true);
    try {
      await api.post('/updates', { ...updateForm, client: id });
      setShowUpdateModal(false);
      setUpdateForm({ title: '', content: '', type: 'general' });
      loadData();
    } finally { setSaving(false); }
  };

  const handleAddTask = async () => {
    if (!taskForm.title.trim()) return;
    setSaving(true);
    try {
      await api.post('/tasks', { ...taskForm, client: id });
      setShowTaskModal(false);
      setTaskForm({ title: '', description: '', priority: 'medium', deadline: '', assignedTo: '', category: 'other', isClientVisible: true });
      loadData();
    } finally { setSaving(false); }
  };

  const handleSaveEdit = async () => {
    setSaving(true);
    try {
      await api.put(`/clients/${id}`, editForm);
      setShowEditModal(false);
      loadData();
    } finally { setSaving(false); }
  };

  const handleAddTeamMember = async () => {
    if (!addMemberId) return;
    setSavingTeam(true);
    try {
      const currentIds = (overview?.client?.teamMembers || []).map(m => m._id || m);
      if (currentIds.map(String).includes(String(addMemberId))) {
        setShowAddMemberModal(false);
        return;
      }
      await api.put(`/clients/${id}`, { teamMembers: [...currentIds, addMemberId] });
      setShowAddMemberModal(false);
      setAddMemberId('');
      loadData();
    } finally { setSavingTeam(false); }
  };

  const handleRemoveTeamMember = async (memberId) => {
    setSavingTeam(true);
    try {
      const currentIds = (overview?.client?.teamMembers || []).map(m => m._id || m);
      const newIds = currentIds.filter(mid => String(mid) !== String(memberId));
      await api.put(`/clients/${id}`, { teamMembers: newIds });
      loadData();
    } finally { setSavingTeam(false); }
  };

  const handleSetAccountManager = async (managerId) => {
    if (!managerId) return;
    setSavingTeam(true);
    try {
      await api.put(`/clients/${id}`, { accountManager: managerId });
      loadData();
    } finally { setSavingTeam(false); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>;
  const client = overview?.client;
  if (!client) return <div className="text-slate-500 text-center py-16">Client not found</div>;

  const assignedMemberIds = new Set([
    ...(client.teamMembers || []).map(m => String(m._id || m)),
    client.accountManager ? String(client.accountManager._id || client.accountManager) : null,
  ].filter(Boolean));

  const availableToAdd = allTeamMembers.filter(m => !assignedMemberIds.has(String(m._id)));
  const eligibleManagers = allTeamMembers.filter(m => ['admin', 'manager'].includes(m.role));

  const teamCount = (client.teamMembers?.length || 0) + (client.accountManager ? 1 : 0);

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'tasks', label: `Tasks (${tasks.length})` },
    { id: 'updates', label: `Updates (${updates.length})` },
    { id: 'files', label: `Files (${files.length})` },
    { id: 'reports', label: `Reports (${reports.length})` },
    ...(isManager ? [{ id: 'team', label: `Team (${teamCount})` }] : []),
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link to="/admin/clients" className="mt-1 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <Avatar name={client.company} size="md" />
            <div>
              <h1 className="text-xl font-bold text-slate-800">{client.company}</h1>
              <p className="text-slate-500 text-sm">{client.name} · {client.industry}</p>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${getStatusColor(client.status)}`}>{client.status}</span>
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${PLAN_COLORS[client.plan]}`}>{PLAN_LABELS[client.plan]}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Link to={`/admin/messages/${id}`}>
            <Button variant="outline" size="sm"><MessageSquare size={14} />Chat</Button>
          </Link>
          {isManager && (
            <Button variant="outline" size="sm" onClick={() => {
              setEditForm({
                name: client.name, company: client.company, email: client.email,
                phone: client.phone || '', website: client.website || '',
                industry: client.industry || '', status: client.status,
                plan: client.plan, monthlyBudget: client.monthlyBudget, notes: client.notes || '',
              });
              setShowEditModal(true);
            }}><Edit3 size={14} />Edit</Button>
          )}
          <Button size="sm" onClick={() => setShowUpdateModal(true)}><Plus size={14} />Update</Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200 overflow-x-auto">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${activeTab === t.id ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-5">
            <Card>
              <CardHeader><h3 className="font-semibold text-slate-800 text-sm">Client Information</h3></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2 text-slate-600"><Mail size={14} className="text-slate-400" />{client.email}</div>
                  <div className="flex items-center gap-2 text-slate-600"><Phone size={14} className="text-slate-400" />{client.phone || '—'}</div>
                  <div className="flex items-center gap-2 text-slate-600"><Globe size={14} className="text-slate-400" />{client.website || '—'}</div>
                  <div className="flex items-center gap-2 text-slate-600"><Calendar size={14} className="text-slate-400" />Started {formatDate(client.startDate)}</div>
                  <div className="flex items-center gap-2 text-slate-600"><DollarSign size={14} className="text-slate-400" />{formatCurrency(client.monthlyBudget)}/mo</div>
                </div>
                {client.services?.length > 0 && (
                  <div className="mt-4">
                    <div className="text-xs font-medium text-slate-500 mb-2 uppercase tracking-wide">Services</div>
                    <div className="flex flex-wrap gap-1.5">
                      {client.services.map(s => <span key={s} className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">{SERVICE_LABELS[s] || s}</span>)}
                    </div>
                  </div>
                )}
                {client.notes && <div className="mt-4 p-3 bg-slate-50 rounded-lg text-sm text-slate-600">{client.notes}</div>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-slate-800 text-sm">Recent Updates</h3>
                  <Button size="xs" variant="secondary" onClick={() => setShowUpdateModal(true)}><Plus size={12} />Add Update</Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {!overview?.recentUpdates?.length ? (
                  <p className="text-slate-400 text-sm text-center py-4">No updates yet</p>
                ) : overview.recentUpdates.map(u => (
                  <div key={u._id} className="flex gap-3">
                    <Avatar name={u.author?.name} size="sm" className="flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="text-sm font-medium text-slate-800">{u.title}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{u.author?.name} · {timeAgo(u.createdAt)}</div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader><h3 className="font-semibold text-slate-800 text-sm">Account Manager</h3></CardHeader>
              <CardContent>
                {client.accountManager ? (
                  <div className="flex items-center gap-3">
                    <Avatar name={client.accountManager.name} size="md" />
                    <div>
                      <div className="font-medium text-slate-800 text-sm">{client.accountManager.name}</div>
                      <div className="text-xs text-slate-500">{client.accountManager.jobTitle}</div>
                      <div className="text-xs text-slate-400">{client.accountManager.email}</div>
                    </div>
                  </div>
                ) : <p className="text-slate-400 text-sm">Not assigned</p>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-slate-800 text-sm">Team</h3>
                  {isManager && <button onClick={() => setActiveTab('team')} className="text-xs text-brand-600 hover:underline">Manage</button>}
                </div>
              </CardHeader>
              <CardContent>
                {!client.teamMembers?.length ? (
                  <p className="text-slate-400 text-sm">No team members assigned</p>
                ) : (
                  <div className="space-y-2">
                    {client.teamMembers.map(m => (
                      <div key={m._id} className="flex items-center gap-2">
                        <Avatar name={m.name} size="sm" />
                        <div className="min-w-0">
                          <div className="text-xs font-medium text-slate-700 truncate">{m.name}</div>
                          <div className="text-xs text-slate-400">{ROLE_LABELS[m.role] || m.role}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-slate-800 text-sm">Task Overview</h3>
                  {isManager && <Button size="xs" variant="secondary" onClick={() => setShowTaskModal(true)}><Plus size={12} />Task</Button>}
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {overview?.taskStats?.map(ts => (
                  <div key={ts._id} className="flex items-center justify-between">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${getTaskStatusColor(ts._id)}`}>{ts._id?.replace('_', ' ')}</span>
                    <span className="font-bold text-slate-700">{ts.count}</span>
                  </div>
                ))}
                {!overview?.taskStats?.length && <p className="text-slate-400 text-sm text-center py-2">No tasks yet</p>}
              </CardContent>
            </Card>

            {overview?.latestReport && (
              <Card>
                <CardHeader><h3 className="font-semibold text-slate-800 text-sm">Latest Report</h3></CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="font-medium text-slate-700">{overview.latestReport.title}</div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-emerald-50 rounded-lg p-2 text-center">
                        <div className="text-xs text-slate-500">ROAS</div>
                        <div className="font-bold text-emerald-700">{overview.latestReport.metrics?.roas?.toFixed(1)}x</div>
                      </div>
                      <div className="bg-blue-50 rounded-lg p-2 text-center">
                        <div className="text-xs text-slate-500">Leads</div>
                        <div className="font-bold text-blue-700">{overview.latestReport.metrics?.leads}</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* TASKS */}
      {activeTab === 'tasks' && (
        <div className="space-y-3">
          {isManager && <div className="flex justify-end"><Button size="sm" onClick={() => setShowTaskModal(true)}><Plus size={14} />Add Task</Button></div>}
          {tasks.length === 0 ? (
            <EmptyState icon={CheckCircle} title="No tasks yet" description="Create the first task for this client."
              action={isManager ? <Button onClick={() => setShowTaskModal(true)}><Plus size={14} />Add Task</Button> : null} />
          ) : (
            <Card>
              <div className="divide-y divide-slate-100">
                {tasks.map(t => (
                  <div key={t._id} className="flex items-center gap-4 px-5 py-3.5">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-slate-800 text-sm">{t.title}</div>
                      {t.description && <div className="text-xs text-slate-500 mt-0.5 truncate">{t.description}</div>}
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${getTaskStatusColor(t.status)}`}>{t.status?.replace('_', ' ')}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${getPriorityColor(t.priority)}`}>{t.priority}</span>
                        {t.category && t.category !== 'other' && <span className="text-xs text-slate-500">{CATEGORY_LABELS[t.category]}</span>}
                        {t.assignedTo && <span className="text-xs text-slate-400">→ {t.assignedTo.name}</span>}
                        {t.deadline && <span className="text-xs text-slate-400 flex items-center gap-1"><Clock size={11} />{formatDate(t.deadline)}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* UPDATES */}
      {activeTab === 'updates' && (
        <div className="space-y-4">
          <div className="flex justify-end"><Button size="sm" onClick={() => setShowUpdateModal(true)}><Plus size={14} />Post Update</Button></div>
          {updates.length === 0 ? <EmptyState icon={AlertCircle} title="No updates yet" description="Post the first update for this client." /> : (
            <div className="space-y-4">
              {updates.map(u => (
                <Card key={u._id} className={u.isPinned ? 'border-brand-200 bg-blue-50/30' : ''}>
                  <CardContent>
                    <div className="flex items-start gap-3">
                      <Avatar name={u.author?.name} size="sm" className="flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-slate-800 text-sm">{u.title}</span>
                          {u.isPinned && <span className="px-2 py-0.5 bg-brand-100 text-brand-700 rounded-full text-xs">📌 Pinned</span>}
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full text-xs capitalize">{u.type?.replace('_', ' ')}</span>
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">{u.author?.name} · {timeAgo(u.createdAt)}</div>
                        <p className="text-sm text-slate-700 mt-2 whitespace-pre-line">{u.content}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* FILES */}
      {activeTab === 'files' && (
        <div className="space-y-4">
          {files.length === 0 ? <EmptyState icon={AlertCircle} title="No files yet" description="Upload files for this client." /> : (
            <Card>
              <div className="divide-y divide-slate-100">
                {files.map(f => (
                  <div key={f._id} className="flex items-center gap-4 px-5 py-3.5">
                    <div className="text-2xl">{f.mimeType?.includes('pdf') ? '📄' : f.mimeType?.includes('image') ? '🖼️' : f.mimeType?.includes('zip') ? '📦' : '📎'}</div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-slate-800 text-sm truncate">{f.name}</div>
                      <div className="text-xs text-slate-500">{f.uploadedBy?.name} · {timeAgo(f.createdAt)}</div>
                    </div>
                    <a href={f.url} target="_blank" rel="noopener noreferrer" className="text-brand-600 text-xs font-medium hover:underline">Download</a>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* REPORTS */}
      {activeTab === 'reports' && (
        <div className="space-y-4">
          {reports.length === 0 ? <EmptyState icon={AlertCircle} title="No reports yet" description="Create the first performance report." /> : (
            <div className="grid gap-4">
              {reports.map(r => (
                <Card key={r._id}>
                  <CardContent>
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="font-semibold text-slate-800">{r.title}</div>
                        <div className="text-xs text-slate-500">{formatDate(r.startDate)} — {formatDate(r.endDate)}</div>
                      </div>
                      <span className="px-2.5 py-0.5 bg-slate-100 text-slate-600 rounded-full text-xs capitalize">{r.period}</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[
                        { label: 'Ad Spend', value: formatCurrency(r.metrics?.adSpend), color: 'bg-slate-50' },
                        { label: 'Revenue', value: formatCurrency(r.metrics?.revenue), color: 'bg-emerald-50' },
                        { label: 'ROAS', value: `${r.metrics?.roas?.toFixed(1)}x`, color: 'bg-blue-50' },
                        { label: 'Leads', value: r.metrics?.leads, color: 'bg-purple-50' },
                      ].map(m => (
                        <div key={m.label} className={`${m.color} rounded-lg p-3 text-center`}>
                          <div className="text-xs text-slate-500">{m.label}</div>
                          <div className="font-bold text-slate-800 mt-0.5">{m.value}</div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TEAM MANAGEMENT (admin/manager only) */}
      {activeTab === 'team' && isManager && (
        <div className="space-y-5">
          {/* Account Manager */}
          <Card>
            <CardHeader>
              <h3 className="font-semibold text-slate-800 text-sm">Account Manager</h3>
              <p className="text-xs text-slate-400 mt-0.5">Primary point of contact responsible for this client</p>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 flex-wrap">
                {client.accountManager ? (
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Avatar name={client.accountManager.name} size="md" />
                    <div className="min-w-0">
                      <div className="font-medium text-slate-800 text-sm">{client.accountManager.name}</div>
                      <div className="text-xs text-slate-500">{client.accountManager.jobTitle || ROLE_LABELS[client.accountManager.role]}</div>
                      <div className="text-xs text-slate-400">{client.accountManager.email}</div>
                    </div>
                  </div>
                ) : (
                  <p className="text-slate-400 text-sm flex-1">No account manager assigned</p>
                )}
                <div className="flex-shrink-0 min-w-[220px]">
                  <Select value={client.accountManager?._id || ''} onChange={e => handleSetAccountManager(e.target.value)} disabled={savingTeam}>
                    <option value="">— Change Account Manager —</option>
                    {eligibleManagers.map(m => (
                      <option key={m._id} value={m._id}>{m.name} ({ROLE_LABELS[m.role] || m.role})</option>
                    ))}
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Team Members */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-slate-800 text-sm">Team Members</h3>
                  <p className="text-xs text-slate-400 mt-0.5">People working on this client's account — they can access client tasks, social posts, and files</p>
                </div>
                <Button size="sm" onClick={() => { setAddMemberId(''); setShowAddMemberModal(true); }}>
                  <UserPlus size={14} />Add Member
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {!client.teamMembers?.length ? (
                <div className="text-center py-8">
                  <Users size={32} className="mx-auto text-slate-200 mb-2" />
                  <p className="text-slate-400 text-sm">No team members assigned yet</p>
                  <p className="text-slate-300 text-xs mt-1">Add team members so they can access this client's data</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {client.teamMembers.map(m => (
                    <div key={m._id} className="flex items-center gap-3 py-3">
                      <Avatar name={m.name} size="md" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-slate-800 text-sm">{m.name}</div>
                        <div className="text-xs text-slate-500">{m.jobTitle || ROLE_LABELS[m.role] || m.role}</div>
                        {m.email && <div className="text-xs text-slate-400">{m.email}</div>}
                      </div>
                      <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-medium">
                        {ROLE_LABELS[m.role] || m.role}
                      </span>
                      <button onClick={() => handleRemoveTeamMember(m._id)} disabled={savingTeam}
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40"
                        title="Remove from client">
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-sm text-amber-700">
            <strong>Access Note:</strong> Assigned team members will only see this client's tasks, social posts, and files. Removing a member immediately revokes their access to this client's data.
          </div>
        </div>
      )}

      {/* Add Team Member Modal */}
      <Modal isOpen={showAddMemberModal} onClose={() => setShowAddMemberModal(false)} title="Add Team Member"
        footer={<div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setShowAddMemberModal(false)}>Cancel</Button><Button loading={savingTeam} onClick={handleAddTeamMember} disabled={!addMemberId}>Add to Client</Button></div>}
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">Assign a team member to <strong>{client.company}</strong>. They will gain access to this client's tasks, social posts, and files.</p>
          <Select label="Team Member" value={addMemberId} onChange={e => setAddMemberId(e.target.value)}>
            <option value="">— Select a team member —</option>
            {availableToAdd.map(m => (
              <option key={m._id} value={m._id}>{m.name} — {m.jobTitle || ROLE_LABELS[m.role] || m.role}</option>
            ))}
          </Select>
          {availableToAdd.length === 0 && <p className="text-xs text-slate-400 text-center">All team members are already assigned to this client.</p>}
        </div>
      </Modal>

      {/* Post Update Modal */}
      <Modal isOpen={showUpdateModal} onClose={() => setShowUpdateModal(false)} title="Post Update"
        footer={<div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setShowUpdateModal(false)}>Cancel</Button><Button loading={saving} onClick={handleAddUpdate}>Post Update</Button></div>}
      >
        <div className="space-y-4">
          <Input label="Title" value={updateForm.title} onChange={e => setUpdateForm(p => ({ ...p, title: e.target.value }))} placeholder="Update title..." />
          <Select label="Type" value={updateForm.type} onChange={e => setUpdateForm(p => ({ ...p, type: e.target.value }))}>
            {updateTypes.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>)}
          </Select>
          <Textarea label="Content" value={updateForm.content} onChange={e => setUpdateForm(p => ({ ...p, content: e.target.value }))} placeholder="Write your update..." rows={5} />
        </div>
      </Modal>

      {/* Add Task Modal */}
      <Modal isOpen={showTaskModal} onClose={() => setShowTaskModal(false)} title="Add Task"
        footer={<div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setShowTaskModal(false)}>Cancel</Button><Button loading={saving} onClick={handleAddTask}>Create Task</Button></div>}
      >
        <div className="space-y-4">
          <Input label="Title" value={taskForm.title} onChange={e => setTaskForm(p => ({ ...p, title: e.target.value }))} required />
          <Textarea label="Description" value={taskForm.description} onChange={e => setTaskForm(p => ({ ...p, description: e.target.value }))} rows={3} />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Category" value={taskForm.category} onChange={e => setTaskForm(p => ({ ...p, category: e.target.value }))}>
              {Object.entries(CATEGORY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
            <Select label="Priority" value={taskForm.priority} onChange={e => setTaskForm(p => ({ ...p, priority: e.target.value }))}>
              {['low', 'medium', 'high', 'urgent'].map(v => <option key={v} value={v}>{v.charAt(0).toUpperCase() + v.slice(1)}</option>)}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Deadline" type="date" value={taskForm.deadline} onChange={e => setTaskForm(p => ({ ...p, deadline: e.target.value }))} />
            <Select label="Assign To" value={taskForm.assignedTo} onChange={e => setTaskForm(p => ({ ...p, assignedTo: e.target.value }))}>
              <option value="">Unassigned</option>
              {client.teamMembers?.length > 0 && (
                <optgroup label="This Client's Team">
                  {client.accountManager && <option value={client.accountManager._id}>{client.accountManager.name} (Account Manager)</option>}
                  {client.teamMembers.map(m => <option key={m._id} value={m._id}>{m.name} ({ROLE_LABELS[m.role] || m.role})</option>)}
                </optgroup>
              )}
              <optgroup label="All Team Members">
                {allTeamMembers.filter(m => {
                  const inClientTeam = client.teamMembers?.some(tm => String(tm._id) === String(m._id));
                  const isAM = String(client.accountManager?._id) === String(m._id);
                  return !inClientTeam && !isAM;
                }).map(m => <option key={m._id} value={m._id}>{m.name} ({ROLE_LABELS[m.role] || m.role})</option>)}
              </optgroup>
            </Select>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={taskForm.isClientVisible} onChange={e => setTaskForm(p => ({ ...p, isClientVisible: e.target.checked }))} className="rounded" />
            <span className="text-sm text-slate-700">Visible to client</span>
          </label>
        </div>
      </Modal>

      {/* Edit Client Modal */}
      {isManager && (
        <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Edit Client"
          footer={<div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setShowEditModal(false)}>Cancel</Button><Button loading={saving} onClick={handleSaveEdit}>Save Changes</Button></div>}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Input label="Contact Name" value={editForm.name || ''} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))} />
              <Input label="Company" value={editForm.company || ''} onChange={e => setEditForm(p => ({ ...p, company: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Email" type="email" value={editForm.email || ''} onChange={e => setEditForm(p => ({ ...p, email: e.target.value }))} />
              <Input label="Phone" value={editForm.phone || ''} onChange={e => setEditForm(p => ({ ...p, phone: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Website" value={editForm.website || ''} onChange={e => setEditForm(p => ({ ...p, website: e.target.value }))} />
              <Input label="Industry" value={editForm.industry || ''} onChange={e => setEditForm(p => ({ ...p, industry: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Select label="Status" value={editForm.status || ''} onChange={e => setEditForm(p => ({ ...p, status: e.target.value }))}>
                {['active', 'inactive', 'onboarding', 'paused', 'churned'].map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </Select>
              <Select label="Plan" value={editForm.plan || ''} onChange={e => setEditForm(p => ({ ...p, plan: e.target.value }))}>
                {Object.entries(PLAN_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </Select>
            </div>
            <Input label="Monthly Budget ($)" type="number" value={editForm.monthlyBudget || ''} onChange={e => setEditForm(p => ({ ...p, monthlyBudget: e.target.value }))} />
            <Textarea label="Notes" value={editForm.notes || ''} onChange={e => setEditForm(p => ({ ...p, notes: e.target.value }))} rows={3} />
          </div>
        </Modal>
      )}
    </div>
  );
}