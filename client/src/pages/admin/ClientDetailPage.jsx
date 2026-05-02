import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Edit3, MessageSquare, Mail, Phone, Globe, Calendar, DollarSign, Plus, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import api from '../../lib/api';
import { Button, Modal, Input, Textarea, Select } from '../../components/ui/index';
import { Avatar, Badge, Card, CardHeader, CardContent, Spinner, EmptyState } from '../../components/shared/LoadingScreen';
import { formatDate, getStatusColor, PLAN_LABELS, PLAN_COLORS, SERVICE_LABELS, formatCurrency, getTaskStatusColor, getPriorityColor, timeAgo } from '../../lib/utils';

const updateTypes = ['general', 'milestone', 'report', 'alert', 'campaign_launch', 'optimization', 'meeting_notes'];

export default function ClientDetailPage() {
  const { id } = useParams();
  const [overview, setOverview] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState([]);
  const [updates, setUpdates] = useState([]);
  const [files, setFiles] = useState([]);
  const [reports, setReports] = useState([]);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [updateForm, setUpdateForm] = useState({ title: '', content: '', type: 'general' });
  const [taskForm, setTaskForm] = useState({ title: '', description: '', priority: 'medium', deadline: '', assignedTo: '', isClientVisible: true });
  const [teamMembers, setTeamMembers] = useState([]);

  useEffect(() => {
    loadData();
    api.get('/users?role=team_member').then(r => setTeamMembers(r.data.users));
    api.get('/users?role=manager').then(r => setTeamMembers(p => [...p, ...r.data.users]));
  }, [id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [ovRes, taskRes, updRes, fileRes, repRes] = await Promise.all([
        api.get(`/clients/${id}/overview`),
        api.get(`/tasks?clientId=${id}&limit=20`),
        api.get(`/updates?clientId=${id}&limit=20`),
        api.get(`/files?clientId=${id}&limit=20`),
        api.get(`/reports?clientId=${id}&limit=10`),
      ]);
      setOverview(ovRes.data);
      setTasks(taskRes.data.tasks);
      setUpdates(updRes.data.updates);
      setFiles(fileRes.data.files);
      setReports(repRes.data.reports);
    } finally { setLoading(false); }
  };

  const handleAddUpdate = async () => {
    setSaving(true);
    try {
      await api.post('/updates', { ...updateForm, client: id });
      setShowUpdateModal(false);
      setUpdateForm({ title: '', content: '', type: 'general' });
      loadData();
    } finally { setSaving(false); }
  };

  const handleAddTask = async () => {
    setSaving(true);
    try {
      await api.post('/tasks', { ...taskForm, client: id });
      setShowTaskModal(false);
      setTaskForm({ title: '', description: '', priority: 'medium', deadline: '', assignedTo: '', isClientVisible: true });
      loadData();
    } finally { setSaving(false); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>;
  const client = overview?.client;
  if (!client) return <div className="text-slate-500 text-center py-16">Client not found</div>;

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'tasks', label: `Tasks (${tasks.length})` },
    { id: 'updates', label: `Updates (${updates.length})` },
    { id: 'files', label: `Files (${files.length})` },
    { id: 'reports', label: `Reports (${reports.length})` },
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
          <Button size="sm" onClick={() => setShowUpdateModal(true)}><Plus size={14} />Update</Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${activeTab === t.id ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-5">
            {/* Info Card */}
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
                      {client.services.map(s => <span key={s} className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">{SERVICE_LABELS[s]}</span>)}
                    </div>
                  </div>
                )}
                {client.notes && (
                  <div className="mt-4 p-3 bg-slate-50 rounded-lg text-sm text-slate-600">{client.notes}</div>
                )}
              </CardContent>
            </Card>

            {/* Recent Updates */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-slate-800 text-sm">Recent Updates</h3>
                  <Button size="xs" variant="secondary" onClick={() => setShowUpdateModal(true)}><Plus size={12} />Add Update</Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {overview?.recentUpdates?.length === 0 ? (
                  <p className="text-slate-400 text-sm text-center py-4">No updates yet</p>
                ) : (
                  overview?.recentUpdates?.map(u => (
                    <div key={u._id} className="flex gap-3">
                      <Avatar name={u.author?.name} size="sm" className="flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="text-sm font-medium text-slate-800">{u.title}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{u.author?.name} · {timeAgo(u.createdAt)}</div>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          {/* Side Panel */}
          <div className="space-y-4">
            {/* Account Manager */}
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

            {/* Task Stats */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-slate-800 text-sm">Task Overview</h3>
                  <Button size="xs" variant="secondary" onClick={() => setShowTaskModal(true)}><Plus size={12} />Task</Button>
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

            {/* Latest Report */}
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

      {/* Tasks Tab */}
      {activeTab === 'tasks' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setShowTaskModal(true)}><Plus size={14} />Add Task</Button>
          </div>
          {tasks.length === 0 ? <EmptyState icon={CheckCircle} title="No tasks yet" description="Create the first task for this client." action={<Button onClick={() => setShowTaskModal(true)}><Plus size={14} />Add Task</Button>} /> : (
            <Card>
              <div className="divide-y divide-slate-100">
                {tasks.map(t => (
                  <div key={t._id} className="flex items-center gap-4 px-5 py-3.5">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-slate-800 text-sm">{t.title}</div>
                      {t.description && <div className="text-xs text-slate-500 mt-0.5 truncate">{t.description}</div>}
                      <div className="flex items-center gap-3 mt-1">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${getTaskStatusColor(t.status)}`}>{t.status?.replace('_', ' ')}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${getPriorityColor(t.priority)}`}>{t.priority}</span>
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

      {/* Updates Tab */}
      {activeTab === 'updates' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setShowUpdateModal(true)}><Plus size={14} />Post Update</Button>
          </div>
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

      {/* Files Tab */}
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

      {/* Reports Tab */}
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

      {/* Add Update Modal */}
      <Modal isOpen={showUpdateModal} onClose={() => setShowUpdateModal(false)} title="Post Update"
        footer={<div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setShowUpdateModal(false)}>Cancel</Button><Button loading={saving} onClick={handleAddUpdate}>Post Update</Button></div>}
      >
        <div className="space-y-4">
          <Input label="Title" value={updateForm.title} onChange={e => setUpdateForm(p => ({ ...p, title: e.target.value }))} placeholder="Update title..." />
          <Select label="Type" value={updateForm.type} onChange={e => setUpdateForm(p => ({ ...p, type: e.target.value }))}>
            {updateTypes.map(t => <option key={t} value={t}>{t.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>)}
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
            <Select label="Priority" value={taskForm.priority} onChange={e => setTaskForm(p => ({ ...p, priority: e.target.value }))}>
              {['low','medium','high','urgent'].map(v => <option key={v} value={v}>{v.charAt(0).toUpperCase()+v.slice(1)}</option>)}
            </Select>
            <Input label="Deadline" type="date" value={taskForm.deadline} onChange={e => setTaskForm(p => ({ ...p, deadline: e.target.value }))} />
          </div>
          <Select label="Assign To" value={taskForm.assignedTo} onChange={e => setTaskForm(p => ({ ...p, assignedTo: e.target.value }))}>
            <option value="">Unassigned</option>
            {teamMembers.map(m => <option key={m._id} value={m._id}>{m.name} ({m.jobTitle || m.role})</option>)}
          </Select>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={taskForm.isClientVisible} onChange={e => setTaskForm(p => ({ ...p, isClientVisible: e.target.checked }))} className="rounded" />
            <span className="text-sm text-slate-700">Visible to client</span>
          </label>
        </div>
      </Modal>
    </div>
  );
}
