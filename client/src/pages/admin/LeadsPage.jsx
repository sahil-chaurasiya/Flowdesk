import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  Target, Upload, RefreshCw, Trash2,
  ChevronDown, ChevronUp, Users, TrendingUp,
} from 'lucide-react';
import api from '../../lib/api';
import { PageHeader, EmptyState, Card, Spinner, StatCard } from '../../components/shared/LoadingScreen';
import { Button, Select, Input, Modal } from '../../components/ui/index';
import { formatDate, timeAgo } from '../../lib/utils';

const STATUS_STYLE_LIGHT = {
  new:       { background: 'var(--fd-surface-sunken)', color: 'var(--fd-ink-3)' },
  contacted: { background: '#eff0fe', color: '#3a56d4' },
  qualified: { background: '#fef7ea', color: '#92600a' },
  converted: { background: '#edf7f1', color: '#2a7d4f' },
  lost:      { background: '#fef2f2', color: '#b91c1c' },
};

const STATUS_STYLE_DARK = {
  new:       { background: 'rgba(138,134,128,0.15)', color: '#8a8680' },
  contacted: { background: 'rgba(79,110,240,0.2)', color: '#7896f3' },
  qualified: { background: 'rgba(146,96,10,0.18)', color: '#fbbf24' },
  converted: { background: 'rgba(42,125,79,0.18)', color: '#4ade80' },
  lost:      { background: 'rgba(185,28,28,0.18)', color: '#f87171' },
};

function getStatusStyle(status) {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  return (isDark ? STATUS_STYLE_DARK : STATUS_STYLE_LIGHT)[status] || STATUS_STYLE_LIGHT.new;
}

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
      if (cs.length) setSelectedClient(cs[0]._id);
    });
  }, []);

  const loadData = useCallback(async () => {
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

  useEffect(() => { loadData(); }, [loadData]);

  const loadBatchLeads = async (batchId) => {
    if (expandedBatch === batchId) { setExpandedBatch(null); setLeads([]); return; }
    setExpandedBatch(batchId);
    const { data } = await api.get(`/leads?clientId=${selectedClient}&batchId=${batchId}&limit=500`);
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
      loadData();
    } catch (err) {
      alert(err.response?.data?.message || 'Upload failed. Check file format.');
    } finally { setUploading(false); }
  };

  const deleteBatch = async (batchId) => {
    if (!confirm('Delete all leads in this batch? This cannot be undone.')) return;
    await api.delete(`/leads/batch/${batchId}`);
    loadData();
    if (expandedBatch === batchId) { setExpandedBatch(null); setLeads([]); }
  };

  const updateLeadStatus = async (leadId, status) => {
    await api.put(`/leads/${leadId}`, { status });
    setLeads(prev => prev.map(l => l._id === leadId ? { ...l, status } : l));
  };

  const totalLeads  = stats?.total || 0;
  const converted   = stats?.byStatus?.find(s => s._id === 'converted')?.count || 0;
  const qualified   = stats?.byStatus?.find(s => s._id === 'qualified')?.count || 0;
  const newLeads    = stats?.byStatus?.find(s => s._id === 'new')?.count || 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Leads"
        subtitle="Upload and manage lead batches per client"
        actions={
          <Button onClick={() => setShowUploadModal(true)}>
            <Upload size={14} />Upload Leads
          </Button>
        }
      />

      {/* Client selector */}
      <div className="flex items-center gap-2 flex-wrap">
        <Select
          value={selectedClient}
          onChange={e => setSelectedClient(e.target.value)}
          className="min-w-[200px] max-w-xs"
        >
          {clients.map(c => <option key={c._id} value={c._id}>{c.company}</option>)}
        </Select>
        <button onClick={loadData} className="btn-secondary p-2.5">
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatCard title="Total Leads"  value={totalLeads}  icon={Users}       color="blue"   subtitle="All batches" />
          <StatCard title="New"          value={newLeads}    icon={Target}      color="orange" subtitle="Uncontacted" />
          <StatCard title="Qualified"    value={qualified}   icon={TrendingUp}  color="purple" subtitle="Sales ready" />
          <StatCard title="Converted"    value={converted}   icon={TrendingUp}  color="green"  subtitle="Won" />
        </div>
      )}

      {/* Source breakdown */}
      {stats?.bySource?.length > 0 && (
        <Card>
          <div className="px-5 py-3.5 border-b border-[var(--fd-border)] bg-[var(--fd-surface-raised)]">
            <span className="text-[13px] font-semibold text-[var(--fd-ink-1)]">
              Leads by Source
            </span>
          </div>
          <div className="px-5 py-4 flex flex-wrap gap-2">
            {stats.bySource.map(s => (
              <div
                key={s._id}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12.5px]"
                style={{ background: 'var(--fd-surface-raised)', border: '1px solid var(--fd-border)' }}
              >
                <span className="font-medium text-[var(--fd-ink-2)]">{s._id || 'Unknown'}</span>
                <span
                  className="px-1.5 py-0.5 rounded text-[10.5px] font-bold"
                  style={{ background: 'var(--fd-sidebar-active)', color: 'var(--fd-sidebar-link-active)' }}
                >
                  {s.count}
                </span>
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
          description="Upload an Excel or CSV file to get started."
          action={
            <Button onClick={() => setShowUploadModal(true)}>
              <Upload size={14} />Upload Leads
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {batches.map(batch => (
            <Card key={batch._id} className="overflow-hidden">
              {/* Batch header row */}
              <div
                className="flex items-center justify-between px-5 py-4 cursor-pointer transition-colors hover:bg-[var(--fd-table-row-hover)]"
                onClick={() => loadBatchLeads(batch._id)}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: 'var(--fd-sidebar-active)' }}
                  >
                    <Target size={16} style={{ color: 'var(--fd-sidebar-link-active)' }} strokeWidth={1.7} />
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-[13.5px] truncate text-[var(--fd-ink-1)]">
                      {batch.batchLabel || 'Unnamed batch'}
                    </div>
                    <div className="text-[11.5px] mt-0.5 text-[var(--fd-ink-4)]">
                      <span className="font-medium text-[var(--fd-ink-3)]">{batch.count} leads</span>
                      {' · '}
                      {timeAgo(batch.createdAt)}
                      {batch.uploader?.name && ` · ${batch.uploader.name}`}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0 ml-3">
                  <button
                    onClick={e => { e.stopPropagation(); deleteBatch(batch._id); }}
                    className="p-1.5 rounded-lg transition-colors text-[var(--fd-ink-5)] hover:text-red-500 hover:bg-red-500/10"
                  >
                    <Trash2 size={14} />
                  </button>
                  {expandedBatch === batch._id
                    ? <ChevronUp size={15} style={{ color: 'var(--fd-ink-4)' }} />
                    : <ChevronDown size={15} style={{ color: 'var(--fd-ink-4)' }} />}
                </div>
              </div>

              {/* Leads table */}
              {expandedBatch === batch._id && (
                <div className="border-t border-[var(--fd-border)]">
                  {/* Desktop */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="fd-table">
                      <thead>
                        <tr>
                          {['Name','Email','Phone','Company','Source','Campaign','Status','Date'].map(h => (
                            <th key={h}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {leads.map(lead => (
                          <tr key={lead._id}>
                            <td className="font-medium text-[12.5px] text-[var(--fd-ink-1)]">
                              {lead.name || '—'}
                            </td>
                            <td className="text-[12px] font-mono text-[var(--fd-table-cell-text)]">
                              {lead.email || '—'}
                            </td>
                            <td className="text-[12px] text-[var(--fd-table-cell-text)]">{lead.phone || '—'}</td>
                            <td className="text-[12px] text-[var(--fd-table-cell-text)]">{lead.company || '—'}</td>
                            <td>
                              {lead.source ? (
                                <span
                                  className="px-2 py-0.5 rounded text-[10.5px] font-medium"
                                  style={{ background: 'var(--fd-surface-sunken)', color: 'var(--fd-ink-3)' }}
                                >
                                  {lead.source}
                                </span>
                              ) : <span style={{ color: 'var(--fd-ink-5)' }}>—</span>}
                            </td>
                            <td className="text-[12px] max-w-[120px] truncate text-[var(--fd-ink-3)]">
                              {lead.campaign || '—'}
                            </td>
                            <td>
                              <select
                                value={lead.status}
                                onChange={e => updateLeadStatus(lead._id, e.target.value)}
                                className="text-[11.5px] px-2.5 py-1 rounded-lg border-0 cursor-pointer font-semibold outline-none"
                                style={{
                                  ...getStatusStyle(lead.status),
                                  fontFamily: "'Geist', system-ui",
                                }}
                              >
                                {['new','contacted','qualified','converted','lost'].map(s => (
                                  <option key={s} value={s} style={{ background: 'var(--fd-surface)', color: 'var(--fd-ink-1)' }}>
                                    {s.charAt(0).toUpperCase() + s.slice(1)}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="text-[11.5px] font-mono text-[var(--fd-ink-4)]">
                              {formatDate(lead.leadDate || lead.createdAt)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile */}
                  <div className="md:hidden divide-y" style={{ borderColor: 'var(--fd-border-subtle)' }}>
                    {leads.map(lead => (
                      <div key={lead._id} className="p-4 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <div className="font-semibold text-[13px] text-[var(--fd-ink-1)]">
                              {lead.name || 'Anonymous'}
                            </div>
                            <div className="text-[11.5px] mt-0.5 text-[var(--fd-ink-3)]">
                              {lead.email || lead.phone || '—'}
                            </div>
                          </div>
                          <select
                            value={lead.status}
                            onChange={e => updateLeadStatus(lead._id, e.target.value)}
                            className="text-[11px] px-2 py-1 rounded-lg border-0 font-semibold outline-none flex-shrink-0"
                            style={{ ...getStatusStyle(lead.status), fontFamily: "'Geist', system-ui" }}
                          >
                            {['new','contacted','qualified','converted','lost'].map(s => (
                              <option key={s} value={s} style={{ background: 'var(--fd-surface)', color: 'var(--fd-ink-1)' }}>
                                {s.charAt(0).toUpperCase() + s.slice(1)}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="flex items-center gap-2 text-[11.5px] text-[var(--fd-ink-4)]">
                          {lead.company && <span>{lead.company}</span>}
                          {lead.source && (
                            <span
                              className="px-2 py-0.5 rounded text-[10.5px]"
                              style={{ background: 'var(--fd-surface-sunken)', color: 'var(--fd-ink-3)' }}
                            >
                              {lead.source}
                            </span>
                          )}
                          <span className="font-mono">{formatDate(lead.leadDate || lead.createdAt)}</span>
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
              <Upload size={14} />Upload
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {/* Info banner */}
          <div
            className="px-4 py-3 rounded-lg text-[12px] leading-relaxed"
            style={{ background: 'var(--fd-sidebar-active)', border: '1px solid var(--fd-border-strong)', color: 'var(--fd-sidebar-link-active)' }}
          >
            <strong>Accepted columns:</strong> name, email, phone, company, location, source, campaign, notes, date
          </div>

          {/* Drop zone */}
          <div>
            <label className="block text-[12px] font-medium mb-1.5 text-[var(--fd-ink-2)]">
              File <span className="text-red-500">*</span>
            </label>
            <div
              onClick={() => fileRef.current?.click()}
              className="rounded-xl p-8 text-center cursor-pointer transition-all"
              style={uploadFile
                ? { background: 'var(--fd-sidebar-active)', border: '2px dashed var(--fd-sidebar-link-active)' }
                : { background: 'var(--fd-surface-raised)', border: '2px dashed var(--fd-border-strong)' }
              }
            >
              <Upload
                size={22}
                className="mx-auto mb-3"
                style={{ color: uploadFile ? 'var(--fd-sidebar-link-active)' : 'var(--fd-ink-5)' }}
                strokeWidth={1.5}
              />
              <div className="text-[13px] font-medium" style={{ color: uploadFile ? 'var(--fd-sidebar-link-active)' : 'var(--fd-ink-2)' }}>
                {uploadFile ? uploadFile.name : 'Click to select file'}
              </div>
              <div className="text-[11.5px] mt-1 text-[var(--fd-ink-4)]">
                .xlsx, .xls, .csv — max 10 MB
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={e => setUploadFile(e.target.files?.[0] || null)}
              />
            </div>
          </div>

          <Input
            label="Batch Label"
            placeholder="e.g. Meta Leads — July Week 1"
            value={uploadForm.batchLabel}
            onChange={e => setUploadForm(p => ({ ...p, batchLabel: e.target.value }))}
          />
          <div className="grid grid-cols-2 gap-3">
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