import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  Target, Upload, RefreshCw, Trash2,
  ChevronDown, ChevronUp, Users, TrendingUp,
  AlertTriangle, Clock, ShieldAlert, CheckCircle2, Filter,
} from 'lucide-react';
import api from '../../lib/api';
import { PageHeader, EmptyState, Card, Spinner, StatCard } from '../../components/shared/LoadingScreen';
import { Button, Select, Input, Modal } from '../../components/ui/index';
import { formatDate, timeAgo } from '../../lib/utils';

// ── Styles for CLIENT status (read-only on admin side) ────────────────────────
const CLIENT_STATUS_STYLE_LIGHT = {
  new:            { background: '#f4f4f5', color: '#71717a' },
  contacted:      { background: '#eff6ff', color: '#2563eb' },
  qualified:      { background: '#fefce8', color: '#92600a' },
  converted:      { background: '#f0fdf4', color: '#15803d' },
  not_interested: { background: '#fdf4ff', color: '#9333ea' },
  invalid:        { background: '#fef2f2', color: '#dc2626' },
};

const CLIENT_STATUS_STYLE_DARK = {
  new:            { background: 'rgba(113,113,122,0.15)', color: '#a1a1aa' },
  contacted:      { background: 'rgba(37,99,235,0.18)',   color: '#60a5fa' },
  qualified:      { background: 'rgba(146,96,10,0.18)',   color: '#fbbf24' },
  converted:      { background: 'rgba(21,128,61,0.18)',   color: '#4ade80' },
  not_interested: { background: 'rgba(147,51,234,0.18)',  color: '#c084fc' },
  invalid:        { background: 'rgba(220,38,38,0.18)',   color: '#f87171' },
};

const CLIENT_STATUS_LABELS = {
  new:            'New',
  contacted:      'Contacted',
  qualified:      'Qualified',
  converted:      'Converted',
  not_interested: 'Not Interested',
  invalid:        'Invalid ⚑',
};

function getClientStatusStyle(status) {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  return (isDark ? CLIENT_STATUS_STYLE_DARK : CLIENT_STATUS_STYLE_LIGHT)[status]
    || CLIENT_STATUS_STYLE_LIGHT.new;
}

// ── Dispute modal ─────────────────────────────────────────────────────────────
function DisputeModal({ lead, onClose, onSave }) {
  const [note, setNote] = useState(lead?.disputeNote || '');
  const [saving, setSaving] = useState(false);

  const save = async (flag) => {
    setSaving(true);
    try {
      await api.patch(`/leads/${lead._id}/dispute`, { disputeFlag: flag, disputeNote: note });
      onSave(lead._id, flag, note);
      onClose();
    } finally { setSaving(false); }
  };

  return (
    <Modal
      isOpen={!!lead}
      onClose={onClose}
      title={`${lead?.disputeFlag ? 'Update' : 'Flag'} Disputed Lead`}
      size="sm"
      footer={
        <div className="flex justify-between gap-2">
          {lead?.disputeFlag && (
            <Button variant="secondary" loading={saving} onClick={() => save(false)}>
              Clear Flag
            </Button>
          )}
          <div className="flex gap-2 ml-auto">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button loading={saving} onClick={() => save(true)}>
              <ShieldAlert size={13} /> Flag Dispute
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div
          className="px-4 py-3 rounded-lg text-[12px] leading-relaxed"
          style={{ background: 'var(--fd-sidebar-active)', border: '1px solid var(--fd-border-strong)', color: 'var(--fd-sidebar-link-active)' }}
        >
          The client marked this lead as <strong>Invalid</strong>. Flag it if you believe the lead was valid and the client mishandled it.
        </div>
        <div>
          <div className="text-[12px] font-medium mb-1 text-[var(--fd-ink-2)]">Lead</div>
          <div className="text-[13px] text-[var(--fd-ink-1)] font-semibold">{lead?.name || lead?.email || '—'}</div>
          {lead?.phone && <div className="text-[12px] text-[var(--fd-ink-3)]">{lead.phone}</div>}
        </div>
        <Input
          label="Internal Note (optional)"
          placeholder="e.g. Lead was verified — client never contacted them"
          value={note}
          onChange={e => setNote(e.target.value)}
        />
      </div>
    </Modal>
  );
}

export default function LeadsAdminPage() {
  const [clients, setClients]               = useState([]);
  const [selectedClient, setSelectedClient] = useState('');
  const [batches, setBatches]               = useState([]);
  const [leads, setLeads]                   = useState([]);
  const [stats, setStats]                   = useState(null);
  const [loading, setLoading]               = useState(false);
  const [uploading, setUploading]           = useState(false);
  const [expandedBatch, setExpandedBatch]   = useState(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadForm, setUploadForm]         = useState({ batchLabel: '', source: '', campaign: '' });
  const [uploadFile, setUploadFile]         = useState(null);
  const [clientStatusFilter, setClientStatusFilter] = useState('');
  const [disputeLead, setDisputeLead]       = useState(null); // lead being disputed
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
    const params = new URLSearchParams({ clientId: selectedClient, batchId, limit: 500 });
    if (clientStatusFilter) params.set('clientStatus', clientStatusFilter);
    const { data } = await api.get(`/leads?${params}`);
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

  const handleDisputeSaved = (leadId, flag, note) => {
    setLeads(prev => prev.map(l => l._id === leadId ? { ...l, disputeFlag: flag, disputeNote: note } : l));
    setBatches(prev => prev.map(b => ({
      ...b,
      disputeFlagged: expandedBatch === b._id
        ? leads.filter(l => l._id === leadId ? flag : l.disputeFlag).length
        : b.disputeFlagged,
    })));
  };

  const totalLeads    = stats?.total || 0;
  const converted     = stats?.byClientStatus?.find(s => s._id === 'converted')?.count || 0;
  const invalid       = stats?.invalidLeads || 0;
  const untouched     = stats?.byClientStatus?.find(s => s._id === 'new')?.count || 0;
  const avgRespHours  = stats?.responseTimeStats?.avgResponseHours;

  // Abuse signal: if >30% of leads are marked invalid by client
  const invalidRate   = stats?.invalidRate || 0;
  const highInvalidAlert = invalidRate > 30;

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

      {/* ── Abuse / quality alert ─────────────────────────────────────────────── */}
      {highInvalidAlert && (
        <div
          className="flex items-start gap-3 px-4 py-3 rounded-xl text-[13px]"
          style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.25)', color: '#dc2626' }}
        >
          <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
          <div>
            <span className="font-semibold">High invalid rate detected — {invalidRate}%</span>
            <span className="opacity-80"> of leads marked invalid by this client. Review disputed leads before accepting any quality complaints.</span>
          </div>
        </div>
      )}

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatCard title="Total Leads"    value={totalLeads}  icon={Users}        color="blue"   subtitle="All batches" />
          <StatCard title="Converted"      value={converted}   icon={TrendingUp}   color="green"  subtitle={`${stats.conversionRate}% rate`} />
          <StatCard title="Untouched"      value={untouched}   icon={Clock}        color="orange" subtitle="Client hasn't acted" />
          <StatCard title="Invalid Claims" value={invalid}     icon={AlertTriangle} color="red"   subtitle={`${invalidRate}% of total`} />
        </div>
      )}

      {/* Response time insight */}
      {avgRespHours != null && (
        <Card className="px-5 py-3.5 flex items-center gap-3">
          <Clock size={15} style={{ color: 'var(--fd-ink-4)' }} />
          <span className="text-[12.5px] text-[var(--fd-ink-2)]">
            Avg. client response time:{' '}
            <strong className="text-[var(--fd-ink-1)]">
              {avgRespHours < 1
                ? `${Math.round(avgRespHours * 60)} min`
                : `${avgRespHours.toFixed(1)} hrs`}
            </strong>{' '}
            after receiving a lead
            {avgRespHours > 72 && (
              <span className="ml-2 text-amber-600 font-medium">⚠ Very slow — this may explain poor conversion, not lead quality</span>
            )}
          </span>
        </Card>
      )}

      {/* Source breakdown */}
      {stats?.bySource?.length > 0 && (
        <Card>
          <div className="px-5 py-3.5 border-b border-[var(--fd-border)] bg-[var(--fd-surface-raised)]">
            <span className="text-[13px] font-semibold text-[var(--fd-ink-1)]">Leads by Source</span>
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

      {/* Filter bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <Filter size={14} style={{ color: 'var(--fd-ink-4)' }} />
        <Select
          value={clientStatusFilter}
          onChange={e => setClientStatusFilter(e.target.value)}
          className="w-48 text-[12.5px]"
        >
          <option value="">All Client Statuses</option>
          {Object.entries(CLIENT_STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </Select>
      </div>

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
          {batches.map(batch => {
            const batchInvalidPct = batch.count > 0
              ? Math.round((batch.invalidCount / batch.count) * 100) : 0;
            const batchUntouchedPct = batch.count > 0
              ? Math.round((batch.untouchedCount / batch.count) * 100) : 0;

            return (
              <Card key={batch._id} className="overflow-hidden">
                {/* Batch header */}
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
                      <div className="flex items-center gap-2 flex-wrap mt-0.5">
                        <span className="text-[11.5px] text-[var(--fd-ink-4)]">
                          <span className="font-medium text-[var(--fd-ink-3)]">{batch.count} leads</span>
                          {' · '}{timeAgo(batch.createdAt)}
                          {batch.uploader?.name && ` · ${batch.uploader.name}`}
                        </span>
                        {/* Per-batch signals */}
                        {batch.convertedCount > 0 && (
                          <span className="text-[10.5px] px-2 py-0.5 rounded-full font-medium bg-emerald-50 text-emerald-700">
                            ✓ {batch.convertedCount} converted
                          </span>
                        )}
                        {batchUntouchedPct >= 60 && (
                          <span className="text-[10.5px] px-2 py-0.5 rounded-full font-medium bg-amber-50 text-amber-700">
                            ⏳ {batchUntouchedPct}% untouched
                          </span>
                        )}
                        {batchInvalidPct > 25 && (
                          <span className="text-[10.5px] px-2 py-0.5 rounded-full font-medium bg-red-50 text-red-600">
                            ⚑ {batchInvalidPct}% invalid claims
                          </span>
                        )}
                        {batch.disputeFlagged > 0 && (
                          <span className="text-[10.5px] px-2 py-0.5 rounded-full font-medium bg-orange-50 text-orange-600">
                            🚩 {batch.disputeFlagged} disputed
                          </span>
                        )}
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
                            {['Name','Email','Phone','Company','Source','Campaign','Client Status','Dispute','Date'].map(h => (
                              <th key={h}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {leads.map(lead => (
                            <tr key={lead._id} className={lead.disputeFlag ? 'bg-orange-50/40' : ''}>
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
                              <td className="text-[12px] max-w-[110px] truncate text-[var(--fd-ink-3)]">
                                {lead.campaign || '—'}
                              </td>
                              {/* Client status — read-only for admin */}
                              <td>
                                <div className="flex items-center gap-1.5">
                                  <span
                                    className="text-[11px] px-2.5 py-0.5 rounded-full font-semibold"
                                    style={getClientStatusStyle(lead.clientStatus)}
                                  >
                                    {CLIENT_STATUS_LABELS[lead.clientStatus] || lead.clientStatus}
                                  </span>
                                  {lead.clientNotes && (
                                    <span
                                      title={lead.clientNotes}
                                      className="text-[10px] cursor-help"
                                      style={{ color: 'var(--fd-ink-4)' }}
                                    >
                                      💬
                                    </span>
                                  )}
                                </div>
                              </td>
                              {/* Dispute column */}
                              <td>
                                {lead.clientStatus === 'invalid' ? (
                                  <button
                                    onClick={() => setDisputeLead(lead)}
                                    className={`flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-lg font-medium transition-colors ${
                                      lead.disputeFlag
                                        ? 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                                        : 'bg-[var(--fd-surface-raised)] text-[var(--fd-ink-3)] hover:bg-[var(--fd-surface-sunken)]'
                                    }`}
                                  >
                                    <ShieldAlert size={11} />
                                    {lead.disputeFlag ? 'Flagged' : 'Review'}
                                  </button>
                                ) : (
                                  <span style={{ color: 'var(--fd-ink-5)' }}>—</span>
                                )}
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
                        <div key={lead._id} className={`p-4 space-y-2 ${lead.disputeFlag ? 'bg-orange-50/30' : ''}`}>
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <div className="font-semibold text-[13px] text-[var(--fd-ink-1)]">
                                {lead.name || 'Anonymous'}
                              </div>
                              <div className="text-[11.5px] mt-0.5 text-[var(--fd-ink-3)]">
                                {lead.email || lead.phone || '—'}
                              </div>
                            </div>
                            <span
                              className="text-[11px] px-2.5 py-0.5 rounded-full font-semibold flex-shrink-0"
                              style={getClientStatusStyle(lead.clientStatus)}
                            >
                              {CLIENT_STATUS_LABELS[lead.clientStatus] || lead.clientStatus}
                            </span>
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
                            {lead.clientStatus === 'invalid' && (
                              <button
                                onClick={() => setDisputeLead(lead)}
                                className="ml-auto text-[11px] px-2 py-0.5 rounded bg-red-50 text-red-600 font-medium"
                              >
                                <ShieldAlert size={10} className="inline mr-1" />Review
                              </button>
                            )}
                          </div>
                          {lead.clientNotes && (
                            <div className="text-[11px] italic text-[var(--fd-ink-4)] border-l-2 pl-2" style={{ borderColor: 'var(--fd-border-strong)' }}>
                              "{lead.clientNotes}"
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
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
          <div
            className="px-4 py-3 rounded-lg text-[12px] leading-relaxed"
            style={{ background: 'var(--fd-sidebar-active)', border: '1px solid var(--fd-border-strong)', color: 'var(--fd-sidebar-link-active)' }}
          >
            <strong>Accepted columns:</strong> name, email, phone, company, location, source, campaign, notes, date
          </div>

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
              <div className="text-[11.5px] mt-1 text-[var(--fd-ink-4)]">.xlsx, .xls, .csv — max 10 MB</div>
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

      {/* Dispute modal */}
      {disputeLead && (
        <DisputeModal
          lead={disputeLead}
          onClose={() => setDisputeLead(null)}
          onSave={handleDisputeSaved}
        />
      )}
    </div>
  );
}