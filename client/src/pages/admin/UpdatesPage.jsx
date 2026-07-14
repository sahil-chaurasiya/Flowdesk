import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Rss, Plus, BarChart3, Upload, Trash2, Building2, X, Filter } from 'lucide-react';
import api from '../../lib/api';
import { PageHeader, EmptyState, Avatar, Card, CardContent, Spinner } from '../../components/shared/LoadingScreen';
import { ReportCard, ReportUploadModal } from '../../components/shared/ReportViews';
import { Button, Modal, Input, Textarea, Select } from '../../components/ui/index';
import { timeAgo, formatDate, formatCurrency, formatFileSize, getFileIcon } from '../../lib/utils';

// ── Shared client filter bar ──────────────────────────────────────────────────
function ClientFilterBar({ clients, value, onChange, placeholder = 'All Clients' }) {
  if (!clients || clients.length === 0) return null;
  return (
    <div className="relative inline-flex items-center">
      <Building2
        size={13}
        className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
        style={{ color: 'var(--fd-ink-4)' }}
      />
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="appearance-none text-[12px] font-medium pl-7 pr-7 py-1.5 rounded-lg cursor-pointer"
        style={{
          background: value ? 'var(--fd-accent-tint)' : 'var(--fd-surface)',
          border: `1px solid ${value ? 'var(--fd-accent)' : 'var(--fd-border)'}`,
          color: value ? 'var(--fd-accent-hover)' : 'var(--fd-ink-3)',
        }}
      >
        <option value="">{placeholder}</option>
        {clients.map(c => (
          <option key={c._id} value={c._id}>{c.company || c.name}</option>
        ))}
      </select>
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded"
          style={{ color: 'var(--fd-accent-hover)' }}
        >
          <X size={10} />
        </button>
      )}
    </div>
  );
}

// ────── Updates Page ──────────────────────────────────────────────────────────
export function UpdatesPage() {
  const [updates, setUpdates] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filterClient, setFilterClient] = useState('');
  const [filterType, setFilterType] = useState('');
  const [form, setForm] = useState({ title: '', content: '', type: 'general', client: '', isPinned: false });

  const UPDATE_TYPES = ['general', 'milestone', 'report', 'alert', 'campaign_launch', 'optimization', 'meeting_notes'];

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ limit: 50 });
    if (filterClient) params.set('clientId', filterClient);
    if (filterType)   params.set('type', filterType);
    api.get(`/updates?${params}`).then(r => {
      setUpdates(r.data.updates || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [filterClient, filterType]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { api.get('/clients?limit=100').then(r => setClients(r.data.clients || [])); }, []);

  const handleCreate = async () => {
    setSaving(true);
    try { await api.post('/updates', form); setShowModal(false); load(); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    await api.delete(`/updates/${id}`);
    setUpdates(prev => prev.filter(u => u._id !== id));
  };

  const typeColors = {
    general: 'bg-[var(--fd-surface-sunken)] text-[var(--fd-ink-2)]',
    milestone: 'bg-emerald-100 text-emerald-700',
    report: 'bg-blue-100 text-blue-700',
    alert: 'bg-red-100 text-red-700',
    campaign_launch: 'bg-purple-100 text-purple-700',
    optimization: 'bg-orange-100 text-orange-700',
    meeting_notes: 'bg-amber-100 text-amber-700',
  };

  const hasFilters = filterClient || filterType;

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        title="Updates"
        subtitle="All client updates"
        actions={<Button onClick={() => setShowModal(true)}><Plus size={16} />Post Update</Button>}
      />

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <ClientFilterBar clients={clients} value={filterClient} onChange={v => setFilterClient(v)} />

        {/* Type filter */}
        <div className="relative inline-flex items-center">
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            className="appearance-none text-[12px] font-medium px-3 py-1.5 rounded-lg cursor-pointer"
            style={{
              background: filterType ? 'var(--fd-accent-tint)' : 'var(--fd-surface)',
              border: `1px solid ${filterType ? 'var(--fd-accent)' : 'var(--fd-border)'}`,
              color: filterType ? 'var(--fd-accent-hover)' : 'var(--fd-ink-3)',
            }}
          >
            <option value="">All Types</option>
            {UPDATE_TYPES.map(t => (
              <option key={t} value={t}>{t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>
            ))}
          </select>
          {filterType && (
            <button onClick={() => setFilterType('')} className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded" style={{ color: 'var(--fd-accent-hover)' }}>
              <X size={10} />
            </button>
          )}
        </div>

        {hasFilters && (
          <button
            onClick={() => { setFilterClient(''); setFilterType(''); }}
            className="flex items-center gap-1 text-[11px] font-medium px-2 py-1.5 rounded-lg transition-all hover:opacity-70"
            style={{ background: 'var(--fd-surface-sunken)', color: 'var(--fd-ink-4)', border: '1px solid var(--fd-border)' }}
          >
            <X size={10} /> Clear
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : updates.length === 0 ? (
        <EmptyState
          icon={Rss}
          title="No updates found"
          description={hasFilters ? 'Try adjusting your filters.' : 'Post the first update for a client.'}
        />
      ) : (
        <div className="space-y-4">
          {updates.map(u => (
            <Card key={u._id}>
              <CardContent>
                <div className="flex items-start gap-3">
                  <Avatar name={u.author?.name} size="sm" className="flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-[var(--fd-ink-1)]">{u.title}</span>
                          {u.isPinned && <span className="text-xs">📌</span>}
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${typeColors[u.type] || 'bg-[var(--fd-surface-sunken)] text-[var(--fd-ink-2)]'}`}>
                            {u.type?.replace(/_/g, ' ')}
                          </span>
                          {u.client && (
                            <span className="px-2 py-0.5 bg-[var(--fd-surface-sunken)] text-[var(--fd-ink-2)] rounded-full text-xs flex items-center gap-1">
                              <Building2 size={9} />{u.client.company || u.client.name}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-[var(--fd-ink-4)] mt-0.5">{u.author?.name} · {timeAgo(u.createdAt)}</div>
                        <p className="text-sm text-[var(--fd-ink-2)] mt-2 whitespace-pre-line line-clamp-3">{u.content}</p>
                      </div>
                      <button
                        onClick={() => handleDelete(u._id)}
                        className="text-[var(--fd-ink-5)] hover:text-red-500 transition-colors p-1 flex-shrink-0"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Modal
        isOpen={showModal} onClose={() => setShowModal(false)} title="Post Update" size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button loading={saving} onClick={handleCreate}>Post</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Select label="Client *" value={form.client} onChange={e => setForm(p => ({ ...p, client: e.target.value }))}>
            <option value="">Select client...</option>
            {clients.map(c => <option key={c._id} value={c._id}>{c.company}</option>)}
          </Select>
          <Input label="Title *" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
          <Select label="Type" value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}>
            {UPDATE_TYPES.map(t => (
              <option key={t} value={t}>{t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>
            ))}
          </Select>
          <Textarea label="Content *" value={form.content} onChange={e => setForm(p => ({ ...p, content: e.target.value }))} rows={5} />
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.isPinned} onChange={e => setForm(p => ({ ...p, isPinned: e.target.checked }))} className="rounded" />
            <span className="text-sm text-[var(--fd-ink-2)]">Pin this update</span>
          </label>
        </div>
      </Modal>
    </div>
  );
}

// ────── Reports Page ──────────────────────────────────────────────────────────
export function ReportsAdminPage() {
  const [reports, setReports] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filterClient, setFilterClient] = useState('');
  const [filterPeriod, setFilterPeriod] = useState('');
  const [form, setForm] = useState({
    title: '', client: '', period: 'monthly', startDate: '', endDate: '',
    metrics: { adSpend: '', revenue: '', leads: '', conversions: '', impressions: '', clicks: '' },
    notes: '',
  });

  const PERIODS = ['daily', 'weekly', 'monthly', 'quarterly', 'annual', 'custom'];

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ limit: 50 });
    if (filterClient) params.set('clientId', filterClient);
    if (filterPeriod) params.set('period', filterPeriod);
    api.get(`/reports?${params}`).then(r => {
      setReports(r.data.reports || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [filterClient, filterPeriod]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { api.get('/clients?limit=100').then(r => setClients(r.data.clients || [])); }, []);

  const handleCreate = async () => {
    setSaving(true);
    try { await api.post('/reports', form); setShowModal(false); load(); }
    finally { setSaving(false); }
  };

  const setMetric = (k, v) => setForm(p => ({ ...p, metrics: { ...p.metrics, [k]: v } }));

  const hasFilters = filterClient || filterPeriod;

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        title="Reports"
        subtitle="Performance reports across all clients"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => setShowUploadModal(true)}><Upload size={16} />Upload Report</Button>
            <Button onClick={() => setShowModal(true)}><Plus size={16} />New Report</Button>
          </div>
        }
      />

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <ClientFilterBar clients={clients} value={filterClient} onChange={v => setFilterClient(v)} />

        {/* Period filter */}
        <div className="relative inline-flex items-center">
          <select
            value={filterPeriod}
            onChange={e => setFilterPeriod(e.target.value)}
            className="appearance-none text-[12px] font-medium px-3 py-1.5 rounded-lg cursor-pointer"
            style={{
              background: filterPeriod ? 'var(--fd-accent-tint)' : 'var(--fd-surface)',
              border: `1px solid ${filterPeriod ? 'var(--fd-accent)' : 'var(--fd-border)'}`,
              color: filterPeriod ? 'var(--fd-accent-hover)' : 'var(--fd-ink-3)',
            }}
          >
            <option value="">All Periods</option>
            {PERIODS.map(p => (
              <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
            ))}
          </select>
          {filterPeriod && (
            <button onClick={() => setFilterPeriod('')} className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded" style={{ color: 'var(--fd-accent-hover)' }}>
              <X size={10} />
            </button>
          )}
        </div>

        {hasFilters && (
          <button
            onClick={() => { setFilterClient(''); setFilterPeriod(''); }}
            className="flex items-center gap-1 text-[11px] font-medium px-2 py-1.5 rounded-lg transition-all hover:opacity-70"
            style={{ background: 'var(--fd-surface-sunken)', color: 'var(--fd-ink-4)', border: '1px solid var(--fd-border)' }}
          >
            <X size={10} /> Clear
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : reports.length === 0 ? (
        <EmptyState
          icon={BarChart3}
          title="No reports found"
          description={hasFilters ? 'Try adjusting your filters.' : 'No reports yet.'}
        />
      ) : (
        <div className="grid gap-4">
          {reports.map(r => (
            <ReportCard
              key={r._id}
              report={r}
              showClient
              onDelete={(deletedId) => setReports(prev => prev.filter(rep => rep._id !== deletedId))}
            />
          ))}
        </div>
      )}

      <Modal
        isOpen={showModal} onClose={() => setShowModal(false)} title="Create Report" size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button loading={saving} onClick={handleCreate}>Create</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="Report Title *" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
            <Select label="Client *" value={form.client} onChange={e => setForm(p => ({ ...p, client: e.target.value }))}>
              <option value="">Select client...</option>
              {clients.map(c => <option key={c._id} value={c._id}>{c.company}</option>)}
            </Select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Select label="Period" value={form.period} onChange={e => setForm(p => ({ ...p, period: e.target.value }))}>
              {PERIODS.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
            </Select>
            <Input label="Start Date *" type="date" value={form.startDate} onChange={e => setForm(p => ({ ...p, startDate: e.target.value }))} />
            <Input label="End Date *"   type="date" value={form.endDate}   onChange={e => setForm(p => ({ ...p, endDate: e.target.value }))} />
          </div>
          <div className="p-4 bg-[var(--fd-surface-raised)] rounded-lg">
            <div className="text-sm font-semibold text-[var(--fd-ink-2)] mb-3">Metrics</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Input label="Ad Spend ($)"  type="number" value={form.metrics.adSpend}      onChange={e => setMetric('adSpend', e.target.value)} />
              <Input label="Revenue ($)"   type="number" value={form.metrics.revenue}      onChange={e => setMetric('revenue', e.target.value)} />
              <Input label="Leads"         type="number" value={form.metrics.leads}        onChange={e => setMetric('leads', e.target.value)} />
              <Input label="Conversions"   type="number" value={form.metrics.conversions}  onChange={e => setMetric('conversions', e.target.value)} />
              <Input label="Impressions"   type="number" value={form.metrics.impressions}  onChange={e => setMetric('impressions', e.target.value)} />
              <Input label="Clicks"        type="number" value={form.metrics.clicks}       onChange={e => setMetric('clicks', e.target.value)} />
            </div>
          </div>
          <Textarea label="Notes" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={3} />
        </div>
      </Modal>

      <ReportUploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onUploaded={() => load()}
        clients={clients}
      />
    </div>
  );
}

// ────── Files Page ────────────────────────────────────────────────────────────
export function FilesAdminPage() {
  const [files, setFiles] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [filterClient, setFilterClient] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [uploadForm, setUploadForm] = useState({ clientId: '', category: 'other', description: '', isPublic: true });
  const [selectedFile, setSelectedFile] = useState(null);
  const [deleteFileId, setDeleteFileId] = useState(null);
  const [deletingFile, setDeletingFile] = useState(false);
  const [replacingId, setReplacingId] = useState(null); // file currently being re-uploaded (spinner state)
  const replaceInputRef = useRef(null);
  const replaceTargetId = useRef(null);

  const CATEGORIES = ['report', 'creative', 'contract', 'invoice', 'presentation', 'media', 'other'];

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ limit: 50 });
    if (filterClient)   params.set('clientId', filterClient);
    if (filterCategory) params.set('category', filterCategory);
    api.get(`/files?${params}`).then(r => {
      setFiles(r.data.files || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [filterClient, filterCategory]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { api.get('/clients?limit=100').then(r => setClients(r.data.clients || [])); }, []);

  const handleUpload = async () => {
    if (!selectedFile || !uploadForm.clientId) return;
    setUploading(true);
    setUploadError(null);
    try {
      const fd = new FormData();
      fd.append('file', selectedFile);
      Object.entries(uploadForm).forEach(([k, v]) => fd.append(k, v));
      await api.post('/files/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setShowModal(false);
      setSelectedFile(null);
      setUploadError(null);
      load();
    } catch (err) {
      const msg = err?.response?.data?.message || 'Upload failed. Check the file type and try again.';
      setUploadError(msg);
    } finally { setUploading(false); }
  };

  const handleDelete = (id) => {
    setDeleteFileId(id);
  };

  const confirmDelete = async () => {
    setDeletingFile(true);
    try {
      await api.delete(`/files/${deleteFileId}`);
      setFiles(prev => prev.filter(f => f._id !== deleteFileId));
      setDeleteFileId(null);
    } catch {
      // silently fail
    } finally { setDeletingFile(false); }
  };

  const hasFilters = filterClient || filterCategory;

  const triggerReplace = (fileId) => {
    replaceTargetId.current = fileId;
    replaceInputRef.current?.click();
  };

  const handleReplaceFileSelected = async (e) => {
    const picked = e.target.files?.[0];
    const targetId = replaceTargetId.current;
    e.target.value = ''; // allow re-selecting the same filename later
    if (!picked || !targetId) return;

    setReplacingId(targetId);
    try {
      const fd = new FormData();
      fd.append('file', picked);
      const res = await api.post(`/files/${targetId}/replace`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setFiles(prev => prev.map(f => f._id === targetId ? res.data.file : f));
    } catch (err) {
      alert(err?.response?.data?.message || 'Re-upload failed. Check the file type and try again.');
    } finally {
      setReplacingId(null);
      replaceTargetId.current = null;
    }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        title="Files"
        subtitle="All uploaded files"
        actions={<Button onClick={() => setShowModal(true)}><Plus size={16} />Upload File</Button>}
      />
      <input ref={replaceInputRef} type="file" className="hidden" onChange={handleReplaceFileSelected} />

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <ClientFilterBar clients={clients} value={filterClient} onChange={v => setFilterClient(v)} />

        {/* Category filter */}
        <div className="relative inline-flex items-center">
          <select
            value={filterCategory}
            onChange={e => setFilterCategory(e.target.value)}
            className="appearance-none text-[12px] font-medium px-3 py-1.5 rounded-lg cursor-pointer capitalize"
            style={{
              background: filterCategory ? 'var(--fd-accent-tint)' : 'var(--fd-surface)',
              border: `1px solid ${filterCategory ? 'var(--fd-accent)' : 'var(--fd-border)'}`,
              color: filterCategory ? 'var(--fd-accent-hover)' : 'var(--fd-ink-3)',
            }}
          >
            <option value="">All Categories</option>
            {CATEGORIES.map(c => (
              <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
            ))}
          </select>
          {filterCategory && (
            <button onClick={() => setFilterCategory('')} className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded" style={{ color: 'var(--fd-accent-hover)' }}>
              <X size={10} />
            </button>
          )}
        </div>

        {hasFilters && (
          <button
            onClick={() => { setFilterClient(''); setFilterCategory(''); }}
            className="flex items-center gap-1 text-[11px] font-medium px-2 py-1.5 rounded-lg transition-all hover:opacity-70"
            style={{ background: 'var(--fd-surface-sunken)', color: 'var(--fd-ink-4)', border: '1px solid var(--fd-border)' }}
          >
            <X size={10} /> Clear
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : files.length === 0 ? (
        <EmptyState
          icon={Upload}
          title="No files found"
          description={hasFilters ? 'Try adjusting your filters.' : 'No files uploaded yet.'}
        />
      ) : (
        <>
          {/* Desktop table */}
          <Card className="hidden sm:block">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[var(--fd-surface-raised)] border-b border-[var(--fd-border)]">
                  <tr>
                    {['File', 'Client', 'Category', 'Size', 'Uploaded By', 'Date', 'Actions'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-[var(--fd-ink-3)] uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--fd-border)]">
                  {files.map(f => (
                    <tr key={f._id} className="hover:bg-[var(--fd-surface-raised)]">
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{getFileIcon(f.mimeType)}</span>
                          <div>
                            <div className="font-medium text-[var(--fd-ink-1)] truncate max-w-xs">{f.name}</div>
                            {!f.isPublic && <span className="text-xs text-[var(--fd-ink-4)]">Private</span>}
                            {f.available === false && <span className="text-xs text-red-500 font-medium">File unavailable</span>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-[var(--fd-ink-2)]">{f.client?.company || f.client?.name || '—'}</td>
                      <td className="px-4 py-3.5">
                        <span className="px-2 py-0.5 bg-[var(--fd-surface-sunken)] text-[var(--fd-ink-2)] rounded text-xs capitalize">{f.category}</span>
                      </td>
                      <td className="px-4 py-3.5 text-[var(--fd-ink-3)]">{formatFileSize(f.size)}</td>
                      <td className="px-4 py-3.5 text-[var(--fd-ink-2)]">{f.uploadedBy?.name || '—'}</td>
                      <td className="px-4 py-3.5 text-[var(--fd-ink-3)] text-xs">{formatDate(f.createdAt)}</td>
                      <td className="px-4 py-3.5">
                        <div className="flex gap-1 items-center">
                          {f.available === false ? (
                            <button
                              onClick={() => triggerReplace(f._id)}
                              disabled={replacingId === f._id}
                              className="text-amber-600 text-xs font-medium hover:underline px-2 disabled:opacity-50"
                              title="This file's storage was lost (e.g. a server restart). Click to upload a replacement."
                            >
                              {replacingId === f._id ? 'Uploading…' : 'Re-upload'}
                            </button>
                          ) : (
                            <a href={f.url} target="_blank" rel="noopener noreferrer" className="text-brand-600 text-xs font-medium hover:underline px-2">Download</a>
                          )}
                          <button onClick={() => handleDelete(f._id)} className="text-red-400 hover:text-red-600 p-1"><Trash2 size={13} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Mobile cards */}
          <div className="sm:hidden space-y-3">
            {files.map(f => (
              <Card key={f._id}>
                <CardContent>
                  <div className="flex items-start gap-3">
                    <span className="text-2xl flex-shrink-0">{getFileIcon(f.mimeType)}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-[var(--fd-ink-1)] text-sm truncate">{f.name}</div>
                      <div className="flex flex-wrap gap-2 mt-1 text-xs text-[var(--fd-ink-3)]">
                        <span>{f.client?.company || f.client?.name || '—'}</span>
                        <span>·</span>
                        <span className="px-1.5 py-0.5 bg-[var(--fd-surface-sunken)] text-[var(--fd-ink-2)] rounded capitalize">{f.category}</span>
                        <span>·</span>
                        <span>{formatFileSize(f.size)}</span>
                      </div>
                      <div className="text-xs text-[var(--fd-ink-4)] mt-0.5">
                        {f.uploadedBy?.name} · {formatDate(f.createdAt)}
                        {f.available === false && <span className="text-red-500 font-medium"> · File unavailable</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {f.available === false ? (
                        <button
                          onClick={() => triggerReplace(f._id)}
                          disabled={replacingId === f._id}
                          className="text-amber-600 text-xs font-medium hover:underline disabled:opacity-50"
                          title="This file's storage was lost. Click to upload a replacement."
                        >
                          {replacingId === f._id ? 'Uploading…' : 'Re-upload'}
                        </button>
                      ) : (
                        <a href={f.url} target="_blank" rel="noopener noreferrer" className="text-brand-600 text-xs font-medium hover:underline">Download</a>
                      )}
                      <button onClick={() => handleDelete(f._id)} className="text-red-400 hover:text-red-600 p-1 ml-1"><Trash2 size={13} /></button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Delete File Confirm Modal */}
      <Modal
        isOpen={!!deleteFileId}
        onClose={() => setDeleteFileId(null)}
        title="Delete File"
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeleteFileId(null)}>Cancel</Button>
            <Button
              loading={deletingFile}
              onClick={confirmDelete}
              style={{ background: '#b91c1c', color: '#fff', borderColor: '#b91c1c' }}
            >
              <Trash2 size={13} /> Delete
            </Button>
          </div>
        }
      >
        <p className="text-sm" style={{ color: 'var(--fd-ink-2)' }}>
          Are you sure you want to delete this file? This cannot be undone.
        </p>
      </Modal>

      <Modal
        isOpen={showModal} onClose={() => setShowModal(false)} title="Upload File" size="md"
        footer={
          <div className="w-full space-y-2">
            {uploadError && (
              <p className="text-xs text-red-500 text-center">{uploadError}</p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => { setShowModal(false); setUploadError(null); }}>Cancel</Button>
              <Button loading={uploading} onClick={handleUpload} disabled={!selectedFile || !uploadForm.clientId}>Upload</Button>
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          <div
            className="border-2 border-dashed border-[var(--fd-border-strong)] rounded-lg p-6 text-center cursor-pointer hover:border-brand-400 transition-colors"
            onClick={() => document.getElementById('fileInput').click()}
          >
            <input id="fileInput" type="file" className="hidden" accept=".jpg,.jpeg,.png,.gif,.webp,.svg,.pdf,.zip,.rar,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.mp4,.mov,.avi,.mkv,.mp3,.wav,.txt,.csv,.json" onChange={e => setSelectedFile(e.target.files[0])} />
            {selectedFile ? (
              <div className="text-sm font-medium text-[var(--fd-ink-2)]">{selectedFile.name} ({formatFileSize(selectedFile.size)})</div>
            ) : (
              <div>
                <Upload size={24} className="mx-auto text-[var(--fd-ink-4)] mb-2" />
                <div className="text-sm text-[var(--fd-ink-3)]">Tap to select file (max 50MB)</div>
              </div>
            )}
          </div>
          <Select label="Client *" value={uploadForm.clientId} onChange={e => setUploadForm(p => ({ ...p, clientId: e.target.value }))}>
            <option value="">Select client...</option>
            {clients.map(c => <option key={c._id} value={c._id}>{c.company}</option>)}
          </Select>
          <Select label="Category" value={uploadForm.category} onChange={e => setUploadForm(p => ({ ...p, category: e.target.value }))}>
            {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
          </Select>
          <Textarea label="Description" value={uploadForm.description} onChange={e => setUploadForm(p => ({ ...p, description: e.target.value }))} rows={2} />
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={uploadForm.isPublic} onChange={e => setUploadForm(p => ({ ...p, isPublic: e.target.checked }))} className="rounded" />
            <span className="text-sm text-[var(--fd-ink-2)]">Visible to client</span>
          </label>
        </div>
      </Modal>
    </div>
  );
}

export default UpdatesPage;