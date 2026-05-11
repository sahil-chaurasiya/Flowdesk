import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Target, Upload, RefreshCw, Trash2, ChevronDown, ChevronUp, Users, TrendingUp } from 'lucide-react';
import api from '../../lib/api';
import { PageHeader, EmptyState, Card, Spinner, StatCard, Avatar } from '../../components/shared/LoadingScreen';
import { Button, Select, Input, Modal } from '../../components/ui/index';
import { formatDate, timeAgo } from '../../lib/utils';

const STATUS_COLORS = {
  new: 'bg-slate-100 text-slate-600',
  contacted: 'bg-blue-100 text-blue-700',
  qualified: 'bg-amber-100 text-amber-700',
  converted: 'bg-emerald-100 text-emerald-700',
  lost: 'bg-red-100 text-red-600',
};

export default function LeadsAdminPage() {
  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState('');
  const [batches, setBatches] = useState([]);
  const [leads, setLeads] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [expandedBatch, setExpandedBatch] = useState(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadForm, setUploadForm] = useState({ batchLabel: '', source: '', campaign: '' });
  const [uploadFile, setUploadFile] = useState(null);
  const fileRef = useRef();

  useEffect(() => {
    api.get('/clients?limit=100').then(r => {
      const cs = r.data.clients || [];
      setClients(cs);
      if (cs.length > 0) setSelectedClient(cs[0]._id);
    });
  }, []);

  const loadBatchesAndStats = useCallback(async () => {
    if (!selectedClient) return;
    setLoading(true);
    try {
      const [batchRes, statsRes] = await Promise.all([
        api.get(`/leads/batches?clientId=${selectedClient}`),
        api.get(`/leads/stats?clientId=${selectedClient}`),
      ]);
      setBatches(batchRes.data.batches || []);
      setStats(statsRes.data);
    } finally { setLoading(false); }
  }, [selectedClient]);

  useEffect(() => { loadBatchesAndStats(); }, [loadBatchesAndStats]);

  const loadBatchLeads = async (batchId) => {
    if (expandedBatch === batchId) { setExpandedBatch(null); setLeads([]); return; }
    setExpandedBatch(batchId);
    const { data } = await api.get(`/leads?clientId=${selectedClient}&batchId=${batchId}&limit=200`);
    setLeads(data.leads || []);
  };

  const handleUpload = async () => {
    if (!uploadFile || !selectedClient) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', uploadFile);
      fd.append('clientId', selectedClient);
      fd.append('batchLabel', uploadForm.batchLabel || '');
      fd.append('source', uploadForm.source || '');
      fd.append('campaign', uploadForm.campaign || '');
      await api.post('/leads/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setShowUploadModal(false);
      setUploadFile(null);
      setUploadForm({ batchLabel: '', source: '', campaign: '' });
      loadBatchesAndStats();
    } catch (err) {
      alert(err.response?.data?.message || 'Upload failed');
    } finally { setUploading(false); }
  };

  const deleteBatch = async (batchId) => {
    if (!confirm('Delete all leads in this batch?')) return;
    await api.delete(`/leads/batch/${batchId}`);
    loadBatchesAndStats();
    if (expandedBatch === batchId) { setExpandedBatch(null); setLeads([]); }
  };

  const updateLeadStatus = async (leadId, status) => {
    await api.put(`/leads/${leadId}`, { status });
    setLeads(prev => prev.map(l => l._id === leadId ? { ...l, status } : l));
  };

  const totalLeads = stats?.total || 0;
  const converted = stats?.byStatus?.find(s => s._id === 'converted')?.count || 0;
  const qualified = stats?.byStatus?.find(s => s._id === 'qualified')?.count || 0;
  const newLeads = stats?.byStatus?.find(s => s._id === 'new')?.count || 0;

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        title="Leads"
        subtitle="Upload and manage lead batches for your clients"
        actions={
          <Button onClick={() => setShowUploadModal(true)}>
            <Upload size={16} /> Upload Leads
          </Button>
        }
      />

      {/* Client selector */}
      <div className="flex gap-2 items-center flex-wrap">
        <Select value={selectedClient} onChange={e => setSelectedClient(e.target.value)} className="flex-1 min-w-[180px] max-w-xs">
          {clients.map(c => <option key={c._id} value={c._id}>{c.company}</option>)}
        </Select>
        <Button variant="ghost" onClick={loadBatchesAndStats}><RefreshCw size={15} /></Button>
      </div>

      {/* Stats — 2 cols mobile, 4 on lg */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatCard title="Total Leads" value={totalLeads} icon={Users} color="blue" subtitle="All time" />
          <StatCard title="New Leads" value={newLeads} icon={Target} color="orange" subtitle="Uncontacted" />
          <StatCard title="Qualified" value={qualified} icon={TrendingUp} color="purple" subtitle="Sales ready" />
          <StatCard title="Converted" value={converted} icon={TrendingUp} color="green" subtitle="Won" />
        </div>
      )}

      {/* Top sources */}
      {stats?.bySource?.length > 0 && (
        <Card className="p-4">
          <div className="text-sm font-semibold text-slate-700 mb-3">Leads by Source</div>
          <div className="flex flex-wrap gap-2">
            {stats.bySource.map(s => (
              <div key={s._id} className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-full text-xs">
                <span className="font-medium text-slate-700">{s._id || 'Unknown'}</span>
                <span className="bg-brand-100 text-brand-700 px-1.5 rounded-full font-bold">{s.count}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Batches */}
      {loading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : batches.length === 0 ? (
        <EmptyState
          icon={Target}
          title="No leads uploaded yet"
          description="Upload an Excel or CSV file with your leads."
          action={<Button onClick={() => setShowUploadModal(true)}><Upload size={14} /> Upload Leads</Button>}
        />
      ) : (
        <div className="space-y-3">
          {batches.map(batch => (
            <Card key={batch._id} className="overflow-hidden">
              <div
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 transition-colors"
                onClick={() => loadBatchLeads(batch._id)}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 bg-brand-100 rounded-lg flex items-center justify-center text-brand-600 flex-shrink-0">
                    <Target size={18} />
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-800 truncate">{batch.batchLabel || 'Unnamed batch'}</div>
                    <div className="text-xs text-slate-400 mt-0.5 truncate">
                      {batch.count} leads · {timeAgo(batch.createdAt)}
                      {batch.uploader && ` · ${batch.uploader.name}`}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                  <button
                    onClick={e => { e.stopPropagation(); deleteBatch(batch._id); }}
                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 size={15} />
                  </button>
                  {expandedBatch === batch._id ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                </div>
              </div>

              {/* Leads — table on md+, cards on mobile */}
              {expandedBatch === batch._id && (
                <div className="border-t border-slate-100">
                  {/* Desktop table */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          {['Name', 'Email', 'Phone', 'Company', 'Source', 'Campaign', 'Status', 'Date'].map(h => (
                            <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {leads.map(lead => (
                          <tr key={lead._id} className="hover:bg-slate-50">
                            <td className="px-4 py-2.5 font-medium text-slate-800 text-xs">{lead.name || '—'}</td>
                            <td className="px-4 py-2.5 text-slate-600 text-xs">{lead.email || '—'}</td>
                            <td className="px-4 py-2.5 text-slate-600 text-xs">{lead.phone || '—'}</td>
                            <td className="px-4 py-2.5 text-slate-600 text-xs">{lead.company || '—'}</td>
                            <td className="px-4 py-2.5 text-xs">
                              {lead.source && <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{lead.source}</span>}
                            </td>
                            <td className="px-4 py-2.5 text-slate-500 text-xs max-w-xs truncate">{lead.campaign || '—'}</td>
                            <td className="px-4 py-2.5">
                              <select
                                value={lead.status}
                                onChange={e => updateLeadStatus(lead._id, e.target.value)}
                                className={`text-xs px-2 py-0.5 rounded-full border-0 cursor-pointer font-medium ${STATUS_COLORS[lead.status]}`}
                              >
                                {['new', 'contacted', 'qualified', 'converted', 'lost'].map(s => (
                                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                                ))}
                              </select>
                            </td>
                            <td className="px-4 py-2.5 text-slate-400 text-xs">{formatDate(lead.leadDate || lead.createdAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile lead cards */}
                  <div className="md:hidden divide-y divide-slate-100">
                    {leads.map(lead => (
                      <div key={lead._id} className="p-4 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <div className="font-medium text-slate-800 text-sm">{lead.name || 'Anonymous'}</div>
                            <div className="text-xs text-slate-500 mt-0.5">{lead.email || lead.phone || '—'}</div>
                          </div>
                          <select
                            value={lead.status}
                            onChange={e => updateLeadStatus(lead._id, e.target.value)}
                            className={`text-xs px-2 py-1 rounded-full border-0 cursor-pointer font-medium flex-shrink-0 ${STATUS_COLORS[lead.status]}`}
                          >
                            {['new', 'contacted', 'qualified', 'converted', 'lost'].map(s => (
                              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                            ))}
                          </select>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap text-xs text-slate-500">
                          {lead.company && <span>{lead.company}</span>}
                          {lead.source && <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{lead.source}</span>}
                          <span className="text-slate-400">{formatDate(lead.leadDate || lead.createdAt)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Upload Modal */}
      <Modal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        title="Upload Leads"
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowUploadModal(false)}>Cancel</Button>
            <Button loading={uploading} onClick={handleUpload} disabled={!uploadFile}>
              <Upload size={14} /> Upload
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-700">
            <strong>Supported columns:</strong> name, email, phone, company, location, source, campaign, notes, date
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">File *</label>
            <div
              onClick={() => fileRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${uploadFile ? 'border-brand-300 bg-brand-50' : 'border-slate-200 hover:border-slate-300'}`}
            >
              <Upload size={22} className="mx-auto mb-2 text-slate-400" />
              <div className="text-sm text-slate-600 font-medium">
                {uploadFile ? uploadFile.name : 'Click to select Excel or CSV'}
              </div>
              <div className="text-xs text-slate-400 mt-1">.xlsx, .xls, .csv — max 10 MB</div>
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => setUploadFile(e.target.files?.[0] || null)} />
            </div>
          </div>

          <Input
            label="Batch Label"
            placeholder="e.g. Meta Leads — July Week 1"
            value={uploadForm.batchLabel}
            onChange={e => setUploadForm(p => ({ ...p, batchLabel: e.target.value }))}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Default Source"
              placeholder="e.g. Meta Ads"
              value={uploadForm.source}
              onChange={e => setUploadForm(p => ({ ...p, source: e.target.value }))}
            />
            <Input
              label="Default Campaign"
              placeholder="e.g. Q3 Lead Gen"
              value={uploadForm.campaign}
              onChange={e => setUploadForm(p => ({ ...p, campaign: e.target.value }))}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}