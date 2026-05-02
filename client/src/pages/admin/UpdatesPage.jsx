import React, { useEffect, useState } from 'react';
import { Rss, Plus, BarChart3, Upload, Trash2 } from 'lucide-react';
import api from '../../lib/api';
import { PageHeader, EmptyState, Avatar, Card, CardContent, Spinner } from '../../components/shared/LoadingScreen';
import { Button, Modal, Input, Textarea, Select } from '../../components/ui/index';
import { timeAgo, formatDate, formatCurrency, formatFileSize, getFileIcon } from '../../lib/utils';

// ────── Updates Page ──────
export function UpdatesPage() {
  const [updates, setUpdates] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: '', content: '', type: 'general', client: '', isPinned: false });

  const load = () => { setLoading(true); api.get('/updates?limit=50').then(r => { setUpdates(r.data.updates); setLoading(false); }); };
  useEffect(() => { load(); api.get('/clients?limit=100').then(r => setClients(r.data.clients)); }, []);

  const handleCreate = async () => {
    setSaving(true);
    try { await api.post('/updates', form); setShowModal(false); load(); } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    await api.delete(`/updates/${id}`);
    setUpdates(prev => prev.filter(u => u._id !== id));
  };

  const typeColors = { general: 'bg-slate-100 text-slate-600', milestone: 'bg-emerald-100 text-emerald-700', report: 'bg-blue-100 text-blue-700', alert: 'bg-red-100 text-red-700', campaign_launch: 'bg-purple-100 text-purple-700', optimization: 'bg-orange-100 text-orange-700', meeting_notes: 'bg-amber-100 text-amber-700' };

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader title="Updates" subtitle="All client updates" actions={<Button onClick={() => setShowModal(true)}><Plus size={16} />Post Update</Button>} />
      {loading ? <div className="flex justify-center py-16"><Spinner /></div> : updates.length === 0 ? <EmptyState icon={Rss} title="No updates yet" description="Post the first update for a client." /> : (
        <div className="space-y-4">
          {updates.map(u => (
            <Card key={u._id}>
              <CardContent>
                <div className="flex items-start gap-3">
                  <Avatar name={u.author?.name} size="sm" className="flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-800">{u.title}</span>
                      {u.isPinned && <span className="text-xs">📌</span>}
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${typeColors[u.type] || 'bg-slate-100 text-slate-600'}`}>{u.type?.replace('_', ' ')}</span>
                      {u.client && <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full text-xs">{u.client.company}</span>}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">{u.author?.name} · {timeAgo(u.createdAt)}</div>
                    <p className="text-sm text-slate-600 mt-2 whitespace-pre-line line-clamp-3">{u.content}</p>
                  </div>
                  <button onClick={() => handleDelete(u._id)} className="text-slate-300 hover:text-red-500 transition-colors p-1"><Trash2 size={15} /></button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Post Update" size="md"
        footer={<div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button><Button loading={saving} onClick={handleCreate}>Post</Button></div>}>
        <div className="space-y-4">
          <Select label="Client *" value={form.client} onChange={e => setForm(p => ({ ...p, client: e.target.value }))}>
            <option value="">Select client...</option>
            {clients.map(c => <option key={c._id} value={c._id}>{c.company}</option>)}
          </Select>
          <Input label="Title *" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
          <Select label="Type" value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}>
            {['general','milestone','report','alert','campaign_launch','optimization','meeting_notes'].map(t => <option key={t} value={t}>{t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>)}
          </Select>
          <Textarea label="Content *" value={form.content} onChange={e => setForm(p => ({ ...p, content: e.target.value }))} rows={5} />
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.isPinned} onChange={e => setForm(p => ({ ...p, isPinned: e.target.checked }))} className="rounded" />
            <span className="text-sm text-slate-700">Pin this update</span>
          </label>
        </div>
      </Modal>
    </div>
  );
}

// ────── Reports Page ──────
export function ReportsAdminPage() {
  const [reports, setReports] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: '', client: '', period: 'monthly', startDate: '', endDate: '', metrics: { adSpend: '', revenue: '', leads: '', conversions: '', impressions: '', clicks: '' }, notes: '' });

  const load = () => { setLoading(true); api.get('/reports?limit=50').then(r => { setReports(r.data.reports); setLoading(false); }); };
  useEffect(() => { load(); api.get('/clients?limit=100').then(r => setClients(r.data.clients)); }, []);

  const handleCreate = async () => {
    setSaving(true);
    try { await api.post('/reports', form); setShowModal(false); load(); } finally { setSaving(false); }
  };

  const setMetric = (k, v) => setForm(p => ({ ...p, metrics: { ...p.metrics, [k]: v } }));

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader title="Reports" subtitle="Performance reports across all clients" actions={<Button onClick={() => setShowModal(true)}><Plus size={16} />New Report</Button>} />
      {loading ? <div className="flex justify-center py-16"><Spinner /></div> : reports.length === 0 ? <EmptyState icon={BarChart3} title="No reports yet" /> : (
        <div className="grid gap-4">
          {reports.map(r => (
            <Card key={r._id}>
              <CardContent>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="font-semibold text-slate-800">{r.title}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{r.client?.company} · {formatDate(r.startDate)} – {formatDate(r.endDate)}</div>
                  </div>
                  <span className="px-2.5 py-0.5 bg-slate-100 text-slate-600 rounded-full text-xs capitalize">{r.period}</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                  {[
                    { l: 'Ad Spend', v: formatCurrency(r.metrics?.adSpend) },
                    { l: 'Revenue', v: formatCurrency(r.metrics?.revenue) },
                    { l: 'ROAS', v: `${r.metrics?.roas?.toFixed(1)}x` },
                    { l: 'Leads', v: r.metrics?.leads },
                    { l: 'Conversions', v: r.metrics?.conversions },
                    { l: 'Clicks', v: r.metrics?.clicks?.toLocaleString() },
                  ].map(m => (
                    <div key={m.l} className="bg-slate-50 rounded-lg p-2 text-center">
                      <div className="text-xs text-slate-400">{m.l}</div>
                      <div className="font-bold text-slate-800 text-sm mt-0.5">{m.v || '—'}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Create Report" size="lg"
        footer={<div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button><Button loading={saving} onClick={handleCreate}>Create</Button></div>}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Report Title *" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
            <Select label="Client *" value={form.client} onChange={e => setForm(p => ({ ...p, client: e.target.value }))}>
              <option value="">Select client...</option>
              {clients.map(c => <option key={c._id} value={c._id}>{c.company}</option>)}
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Select label="Period" value={form.period} onChange={e => setForm(p => ({ ...p, period: e.target.value }))}>
              {['daily','weekly','monthly','quarterly','annual','custom'].map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase()+p.slice(1)}</option>)}
            </Select>
            <Input label="Start Date *" type="date" value={form.startDate} onChange={e => setForm(p => ({ ...p, startDate: e.target.value }))} />
            <Input label="End Date *" type="date" value={form.endDate} onChange={e => setForm(p => ({ ...p, endDate: e.target.value }))} />
          </div>
          <div className="p-4 bg-slate-50 rounded-lg">
            <div className="text-sm font-semibold text-slate-700 mb-3">Metrics</div>
            <div className="grid grid-cols-3 gap-3">
              <Input label="Ad Spend ($)" type="number" value={form.metrics.adSpend} onChange={e => setMetric('adSpend', e.target.value)} />
              <Input label="Revenue ($)" type="number" value={form.metrics.revenue} onChange={e => setMetric('revenue', e.target.value)} />
              <Input label="Leads" type="number" value={form.metrics.leads} onChange={e => setMetric('leads', e.target.value)} />
              <Input label="Conversions" type="number" value={form.metrics.conversions} onChange={e => setMetric('conversions', e.target.value)} />
              <Input label="Impressions" type="number" value={form.metrics.impressions} onChange={e => setMetric('impressions', e.target.value)} />
              <Input label="Clicks" type="number" value={form.metrics.clicks} onChange={e => setMetric('clicks', e.target.value)} />
            </div>
          </div>
          <Textarea label="Notes" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={3} />
        </div>
      </Modal>
    </div>
  );
}

// ────── Files Page ──────
export function FilesAdminPage() {
  const [files, setFiles] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadForm, setUploadForm] = useState({ clientId: '', category: 'other', description: '', isPublic: true });
  const [selectedFile, setSelectedFile] = useState(null);

  const load = () => { setLoading(true); api.get('/files?limit=50').then(r => { setFiles(r.data.files); setLoading(false); }); };
  useEffect(() => { load(); api.get('/clients?limit=100').then(r => setClients(r.data.clients)); }, []);

  const handleUpload = async () => {
    if (!selectedFile || !uploadForm.clientId) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', selectedFile);
      Object.entries(uploadForm).forEach(([k, v]) => fd.append(k, v));
      await api.post('/files/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setShowModal(false);
      setSelectedFile(null);
      load();
    } finally { setUploading(false); }
  };

  const handleDelete = async (id) => {
    await api.delete(`/files/${id}`);
    setFiles(prev => prev.filter(f => f._id !== id));
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader title="Files" subtitle="All uploaded files" actions={<Button onClick={() => setShowModal(true)}><Plus size={16} />Upload File</Button>} />
      {loading ? <div className="flex justify-center py-16"><Spinner /></div> : files.length === 0 ? <EmptyState icon={Upload} title="No files yet" /> : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>{['File', 'Client', 'Category', 'Size', 'Uploaded By', 'Date', 'Actions'].map(h => <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {files.map(f => (
                  <tr key={f._id} className="hover:bg-slate-50">
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{getFileIcon(f.mimeType)}</span>
                        <div>
                          <div className="font-medium text-slate-800 truncate max-w-xs">{f.name}</div>
                          {!f.isPublic && <span className="text-xs text-slate-400">Private</span>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-slate-600">{f.client?.company || '—'}</td>
                    <td className="px-4 py-3.5"><span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs capitalize">{f.category}</span></td>
                    <td className="px-4 py-3.5 text-slate-500">{formatFileSize(f.size)}</td>
                    <td className="px-4 py-3.5 text-slate-600">{f.uploadedBy?.name || '—'}</td>
                    <td className="px-4 py-3.5 text-slate-500 text-xs">{formatDate(f.createdAt)}</td>
                    <td className="px-4 py-3.5">
                      <div className="flex gap-1">
                        <a href={f.url} target="_blank" rel="noopener noreferrer" className="text-brand-600 text-xs font-medium hover:underline px-2">Download</a>
                        <button onClick={() => handleDelete(f._id)} className="text-red-400 hover:text-red-600 p-1"><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Upload File" size="md"
        footer={<div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button><Button loading={uploading} onClick={handleUpload} disabled={!selectedFile || !uploadForm.clientId}>Upload</Button></div>}>
        <div className="space-y-4">
          <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center cursor-pointer hover:border-brand-400 transition-colors" onClick={() => document.getElementById('fileInput').click()}>
            <input id="fileInput" type="file" className="hidden" onChange={e => setSelectedFile(e.target.files[0])} />
            {selectedFile ? <div className="text-sm font-medium text-slate-700">{selectedFile.name} ({formatFileSize(selectedFile.size)})</div> : <div><Upload size={24} className="mx-auto text-slate-400 mb-2" /><div className="text-sm text-slate-500">Click to select file (max 50MB)</div></div>}
          </div>
          <Select label="Client *" value={uploadForm.clientId} onChange={e => setUploadForm(p => ({ ...p, clientId: e.target.value }))}>
            <option value="">Select client...</option>
            {clients.map(c => <option key={c._id} value={c._id}>{c.company}</option>)}
          </Select>
          <Select label="Category" value={uploadForm.category} onChange={e => setUploadForm(p => ({ ...p, category: e.target.value }))}>
            {['report','creative','contract','invoice','presentation','media','other'].map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase()+c.slice(1)}</option>)}
          </Select>
          <Textarea label="Description" value={uploadForm.description} onChange={e => setUploadForm(p => ({ ...p, description: e.target.value }))} rows={2} />
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={uploadForm.isPublic} onChange={e => setUploadForm(p => ({ ...p, isPublic: e.target.checked }))} className="rounded" />
            <span className="text-sm text-slate-700">Visible to client</span>
          </label>
        </div>
      </Modal>
    </div>
  );
}

export default UpdatesPage;
