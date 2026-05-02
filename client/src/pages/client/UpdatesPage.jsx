import React, { useEffect, useState } from 'react';
import { Rss, FolderOpen, BarChart3, ClipboardList, Plus, Download } from 'lucide-react';
import api from '../../lib/api';
import useAuthStore from '../../context/authStore';
import { PageHeader, EmptyState, Avatar, Card, CardContent, Spinner } from '../../components/shared/LoadingScreen';
import { Button, Modal, Input, Textarea, Select } from '../../components/ui/index';
import { timeAgo, formatDate, formatCurrency, formatFileSize, getFileIcon } from '../../lib/utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// ────── Updates ──────
export function ClientUpdatesPage() {
  const [updates, setUpdates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { api.get('/updates?limit=50').then(r => { setUpdates(r.data.updates); setLoading(false); }); }, []);

  const typeLabels = { general: '📋 General', milestone: '🏆 Milestone', report: '📊 Report', alert: '⚠️ Alert', campaign_launch: '🚀 Launch', optimization: '⚙️ Optimization', meeting_notes: '📝 Notes' };
  const typeColor = { general: 'bg-slate-100 text-slate-600', milestone: 'bg-emerald-100 text-emerald-700', report: 'bg-blue-100 text-blue-700', alert: 'bg-red-100 text-red-700', campaign_launch: 'bg-purple-100 text-purple-700', optimization: 'bg-orange-100 text-orange-700', meeting_notes: 'bg-amber-100 text-amber-700' };

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader title="Updates" subtitle="Chronological updates from your team" />
      {loading ? <div className="flex justify-center py-16"><Spinner /></div> : updates.length === 0 ? <EmptyState icon={Rss} title="No updates yet" description="Your team will post updates about your campaigns here." /> : (
        <div className="relative">
          <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-slate-200" />
          <div className="space-y-5 ml-14">
            {updates.map((u, i) => (
              <div key={u._id} className="relative">
                <div className="absolute -left-9 top-3 w-4 h-4 rounded-full bg-white border-2 border-brand-500 z-10" />
                <Card className={u.isPinned ? 'border-brand-200 ring-1 ring-brand-100' : ''}>
                  <CardContent>
                    <div className="flex items-start gap-3">
                      <Avatar name={u.author?.name} size="sm" className="flex-shrink-0" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          {u.isPinned && <span className="text-xs">📌</span>}
                          <span className="font-semibold text-slate-800">{u.title}</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${typeColor[u.type] || 'bg-slate-100 text-slate-600'}`}>{typeLabels[u.type] || u.type}</span>
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">{u.author?.name} · {u.author?.jobTitle} · {timeAgo(u.createdAt)}</div>
                        <p className="text-sm text-slate-700 mt-2 whitespace-pre-line leading-relaxed">{u.content}</p>
                        {u.metrics && Object.values(u.metrics).some(v => v) && (
                          <div className="mt-3 grid grid-cols-3 gap-2">
                            {[['Impressions', u.metrics.impressions], ['Clicks', u.metrics.clicks], ['ROAS', u.metrics.roas ? `${u.metrics.roas}x` : null]].filter(m => m[1]).map(([label, value]) => (
                              <div key={label} className="bg-slate-50 rounded-lg p-2 text-center">
                                <div className="text-xs text-slate-400">{label}</div>
                                <div className="font-bold text-slate-700 text-sm">{typeof value === 'number' ? value.toLocaleString() : value}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ────── Files ──────
export function ClientFilesPage() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  useEffect(() => { api.get('/files').then(r => { setFiles(r.data.files); setLoading(false); }); }, []);
  const categories = ['report', 'creative', 'contract', 'invoice', 'presentation', 'media', 'other'];
  const filtered = filter ? files.filter(f => f.category === filter) : files;

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader title="Files" subtitle="Files shared by your team" />
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setFilter('')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${!filter ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-50'}`}>All ({files.length})</button>
        {categories.map(c => {
          const count = files.filter(f => f.category === c).length;
          if (!count) return null;
          return <button key={c} onClick={() => setFilter(c)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === c ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-50'}`}>{c.charAt(0).toUpperCase()+c.slice(1)} ({count})</button>;
        })}
      </div>
      {loading ? <div className="flex justify-center py-16"><Spinner /></div> : filtered.length === 0 ? <EmptyState icon={FolderOpen} title="No files yet" description="Files shared by your team will appear here." /> : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(f => (
            <Card key={f._id} className="hover:shadow-md transition-shadow">
              <CardContent>
                <div className="text-4xl mb-3">{getFileIcon(f.mimeType)}</div>
                <div className="font-medium text-slate-800 text-sm truncate mb-1">{f.name}</div>
                {f.description && <p className="text-xs text-slate-400 mb-2 line-clamp-2">{f.description}</p>}
                <div className="flex items-center justify-between text-xs text-slate-400 mb-3">
                  <span>{formatFileSize(f.size)}</span>
                  <span>{timeAgo(f.createdAt)}</span>
                </div>
                <a href={f.url} target="_blank" rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium py-2 rounded-lg transition-colors">
                  <Download size={14} />Download
                </a>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ────── Reports ──────
export function ClientReportsPage() {
  const { user } = useAuthStore();
  const [reports, setReports] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.clientId) return;
    Promise.all([
      api.get('/reports'),
      api.get(`/reports/client/${user.clientId}/summary`)
    ]).then(([r, s]) => {
      setReports(r.data.reports);
      setSummary(s.data);
      setLoading(false);
    });
  }, [user?.clientId]);

  if (loading) return <div className="flex justify-center py-16"><Spinner /></div>;

  const chartData = reports.slice().reverse().map(r => ({
    name: formatDate(r.startDate, 'MMM yy'),
    Spend: r.metrics?.adSpend || 0,
    Revenue: r.metrics?.revenue || 0,
    ROAS: r.metrics?.roas || 0,
    Leads: r.metrics?.leads || 0,
  }));

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Reports" subtitle="Your campaign performance history" />

      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total Ad Spend', value: formatCurrency(summary.totals.totalSpend), bg: 'bg-slate-50' },
            { label: 'Total Revenue', value: formatCurrency(summary.totals.totalRevenue), bg: 'bg-emerald-50' },
            { label: 'Average ROAS', value: `${summary.totals.avgROAS}x`, bg: 'bg-blue-50' },
            { label: 'Total Leads', value: summary.totals.totalLeads?.toLocaleString(), bg: 'bg-purple-50' },
          ].map(m => (
            <div key={m.label} className={`${m.bg} rounded-xl p-4 text-center`}>
              <div className="text-xs text-slate-500 mb-1">{m.label}</div>
              <div className="text-2xl font-bold text-slate-800">{m.value}</div>
            </div>
          ))}
        </div>
      )}

      {chartData.length > 1 && (
        <Card>
          <CardContent>
            <h3 className="font-semibold text-slate-800 mb-4">Spend vs Revenue (Last 12 months)</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={(v, n) => [formatCurrency(v), n]} />
                <Bar dataKey="Spend" fill="#94a3b8" radius={[4,4,0,0]} />
                <Bar dataKey="Revenue" fill="#3b82f6" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {reports.map(r => (
          <Card key={r._id}>
            <CardContent>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-slate-800">{r.title}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">{formatDate(r.startDate)} — {formatDate(r.endDate)}</p>
                </div>
                <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full text-xs capitalize">{r.period}</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {[
                  { label: 'Ad Spend', value: formatCurrency(r.metrics?.adSpend) },
                  { label: 'Revenue', value: formatCurrency(r.metrics?.revenue) },
                  { label: 'ROAS', value: `${r.metrics?.roas?.toFixed(1) || '—'}x` },
                  { label: 'Leads', value: r.metrics?.leads },
                  { label: 'Conversions', value: r.metrics?.conversions },
                  { label: 'Impressions', value: r.metrics?.impressions?.toLocaleString() },
                ].map(m => (
                  <div key={m.label} className="bg-slate-50 rounded-lg p-2.5 text-center">
                    <div className="text-xs text-slate-400">{m.label}</div>
                    <div className="font-bold text-slate-800 text-sm mt-0.5">{m.value || '—'}</div>
                  </div>
                ))}
              </div>
              {(r.highlights?.length > 0 || r.recommendations?.length > 0) && (
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {r.highlights?.length > 0 && (
                    <div>
                      <div className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">Highlights</div>
                      <ul className="space-y-1">{r.highlights.map((h, i) => <li key={i} className="text-xs text-slate-600 flex items-start gap-1.5"><span className="text-emerald-500 mt-0.5">✓</span>{h}</li>)}</ul>
                    </div>
                  )}
                  {r.recommendations?.length > 0 && (
                    <div>
                      <div className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">Recommendations</div>
                      <ul className="space-y-1">{r.recommendations.map((rec, i) => <li key={i} className="text-xs text-slate-600 flex items-start gap-1.5"><span className="text-brand-500 mt-0.5">→</span>{rec}</li>)}</ul>
                    </div>
                  )}
                </div>
              )}
              {r.notes && <p className="mt-3 text-xs text-slate-500 bg-slate-50 rounded-lg p-3">{r.notes}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      {reports.length === 0 && <EmptyState icon={BarChart3} title="No reports yet" description="Performance reports will be published here by your account manager." />}
    </div>
  );
}

// ────── Requests ──────
export function ClientRequestsPage() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', priority: 'medium' });

  const load = () => { setLoading(true); api.get('/tasks?isClientRequest=true&limit=50').then(r => { setTasks(r.data.tasks); setLoading(false); }); };
  useEffect(() => { load(); }, []);

  const handleSubmit = async () => {
    if (!form.title) return;
    setSaving(true);
    try { await api.post('/tasks', { ...form, isClientRequest: true }); setShowModal(false); setForm({ title: '', description: '', priority: 'medium' }); load(); } finally { setSaving(false); }
  };

  const statusMap = { pending: { label: 'Submitted', color: 'bg-slate-100 text-slate-600' }, in_progress: { label: 'In Progress', color: 'bg-blue-100 text-blue-700' }, review: { label: 'In Review', color: 'bg-purple-100 text-purple-700' }, completed: { label: 'Completed', color: 'bg-emerald-100 text-emerald-700' }, cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-600' } };

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader title="Requests" subtitle="Submit requests to your team" actions={<Button onClick={() => setShowModal(true)}><Plus size={16} />New Request</Button>} />
      {loading ? <div className="flex justify-center py-16"><Spinner /></div> : tasks.length === 0 ? (
        <EmptyState icon={ClipboardList} title="No requests yet" description="Submit a request to your team and track its status here."
          action={<Button onClick={() => setShowModal(true)}><Plus size={14} />Submit Request</Button>} />
      ) : (
        <div className="space-y-3">
          {tasks.map(t => {
            const s = statusMap[t.status] || statusMap.pending;
            return (
              <Card key={t._id}>
                <CardContent>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-slate-800">{t.title}</span>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${s.color}`}>{s.label}</span>
                      </div>
                      {t.description && <p className="text-sm text-slate-500 mt-1">{t.description}</p>}
                      <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                        <span>Submitted {timeAgo(t.createdAt)}</span>
                        {t.assignedTo && <span>→ Assigned to {t.assignedTo.name}</span>}
                        {t.completedAt && <span>✓ Completed {timeAgo(t.completedAt)}</span>}
                      </div>
                      {t.comments?.length > 0 && (
                        <div className="mt-3 space-y-2">
                          {t.comments.slice(-2).map((c, i) => (
                            <div key={i} className="flex gap-2 bg-slate-50 rounded-lg p-2.5">
                              <div className="w-6 h-6 bg-brand-100 text-brand-600 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">{c.user?.name?.charAt(0)}</div>
                              <div>
                                <div className="text-xs font-medium text-slate-700">{c.user?.name}</div>
                                <div className="text-xs text-slate-500">{c.text}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex-shrink-0">
                      <div className={`w-3 h-3 rounded-full ${t.status === 'completed' ? 'bg-emerald-400' : t.status === 'in_progress' ? 'bg-blue-400' : t.status === 'cancelled' ? 'bg-red-400' : 'bg-slate-300'}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Submit a Request" size="md"
        footer={<div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button><Button loading={saving} onClick={handleSubmit} disabled={!form.title}>Submit Request</Button></div>}>
        <div className="space-y-4">
          <Input label="Request Title *" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="What do you need?" />
          <Textarea label="Description" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Provide details about your request..." rows={4} />
          <Select label="Priority" value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value }))}>
            <option value="low">Low — When you get a chance</option>
            <option value="medium">Medium — Standard timeline</option>
            <option value="high">High — Needs attention soon</option>
            <option value="urgent">Urgent — ASAP</option>
          </Select>
        </div>
      </Modal>
    </div>
  );
}

export default ClientUpdatesPage;
