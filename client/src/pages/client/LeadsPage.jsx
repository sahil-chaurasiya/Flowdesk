import React, { useEffect, useState, useCallback } from 'react';
import {
  Target, TrendingUp, Users, ChevronDown, ChevronUp,
  Filter, CheckCircle2, Clock, XCircle, Phone, Mail,
  MapPin, Building2, Pencil, Save, X, AlertCircle,
} from 'lucide-react';
import api from '../../lib/api';
import useAuthStore from '../../context/authStore';
import { PageHeader, EmptyState, Card, Spinner, StatCard } from '../../components/shared/LoadingScreen';
import { Select } from '../../components/ui/index';
import { formatDate, timeAgo } from '../../lib/utils';

// ── Client-side status config ─────────────────────────────────────────────────
const CLIENT_STATUSES = [
  { value: 'new',            label: 'New',           color: 'bg-zinc-100 text-zinc-600',        icon: '🟡' },
  { value: 'contacted',      label: 'Contacted',     color: 'bg-blue-100 text-blue-700',         icon: '📞' },
  { value: 'qualified',      label: 'Qualified',     color: 'bg-amber-100 text-amber-700',       icon: '⭐' },
  { value: 'converted',      label: 'Converted',     color: 'bg-emerald-100 text-emerald-700',   icon: '✅' },
  { value: 'not_interested', label: 'Not Interested', color: 'bg-purple-100 text-purple-600',    icon: '🚫' },
  { value: 'invalid',        label: 'Invalid',       color: 'bg-red-100 text-red-600',           icon: '❌' },
];

const STATUS_MAP = Object.fromEntries(CLIENT_STATUSES.map(s => [s.value, s]));

// ── Inline lead editor row ────────────────────────────────────────────────────
function LeadRow({ lead: initialLead, onUpdated }) {
  const [lead, setLead]       = useState(initialLead);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState({ clientStatus: lead.clientStatus, clientNotes: lead.clientNotes || '' });
  const [saving, setSaving]   = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const { data } = await api.patch(`/leads/${lead._id}/client-update`, draft);
      setLead(data.lead);
      onUpdated?.(data.lead);
      setEditing(false);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to save');
    } finally { setSaving(false); }
  };

  const cancel = () => {
    setDraft({ clientStatus: lead.clientStatus, clientNotes: lead.clientNotes || '' });
    setEditing(false);
  };

  const statusCfg = STATUS_MAP[lead.clientStatus] || STATUS_MAP.new;

  return (
    <>
      {/* Main row */}
      <tr className="hover:bg-[var(--fd-surface-raised)] transition-colors group">
        <td className="px-4 py-3 font-medium text-[12.5px] text-[var(--fd-ink-1)]">
          {lead.name || '—'}
        </td>
        <td className="px-4 py-3 text-[12px] text-[var(--fd-ink-2)]">
          {lead.email
            ? <a href={`mailto:${lead.email}`} className="hover:underline flex items-center gap-1">
                <Mail size={11} className="opacity-60" />{lead.email}
              </a>
            : '—'}
        </td>
        <td className="px-4 py-3 text-[12px] text-[var(--fd-ink-2)]">
          {lead.phone
            ? <a href={`tel:${lead.phone}`} className="hover:underline flex items-center gap-1">
                <Phone size={11} className="opacity-60" />{lead.phone}
              </a>
            : '—'}
        </td>
        <td className="px-4 py-3 text-[12px] text-[var(--fd-ink-3)]">
          <div className="flex items-center gap-1">
            {lead.company && <><Building2 size={11} className="opacity-50" />{lead.company}</>}
            {!lead.company && '—'}
          </div>
          {lead.location && (
            <div className="flex items-center gap-1 mt-0.5 text-[11px] text-[var(--fd-ink-4)]">
              <MapPin size={9} className="opacity-60" />{lead.location}
            </div>
          )}
        </td>
        <td className="px-4 py-3 text-xs">
          {lead.source
            ? <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">{lead.source}</span>
            : '—'}
        </td>
        <td className="px-4 py-3">
          <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-semibold ${statusCfg.color}`}>
            {statusCfg.icon} {statusCfg.label}
          </span>
        </td>
        <td className="px-4 py-3 text-[var(--fd-ink-4)] text-[11.5px]">
          {formatDate(lead.leadDate || lead.createdAt)}
        </td>
        <td className="px-4 py-3">
          <button
            onClick={() => setEditing(true)}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-[var(--fd-surface-sunken)] text-[var(--fd-ink-4)]"
          >
            <Pencil size={12} />
          </button>
        </td>
      </tr>

      {/* Expanded edit row */}
      {editing && (
        <tr>
          <td colSpan={8} className="px-4 py-3 bg-[var(--fd-surface-raised)] border-t border-b border-[var(--fd-border)]">
            <div className="flex items-start gap-4 flex-wrap">
              <div className="flex-1 min-w-[160px]">
                <label className="block text-[11px] font-medium text-[var(--fd-ink-3)] mb-1">Update Status</label>
                <select
                  value={draft.clientStatus}
                  onChange={e => setDraft(p => ({ ...p, clientStatus: e.target.value }))}
                  className="w-full text-[12px] px-3 py-1.5 rounded-lg border border-[var(--fd-border)] bg-[var(--fd-surface)] text-[var(--fd-ink-1)] outline-none focus:border-[var(--fd-sidebar-link-active)]"
                >
                  {CLIENT_STATUSES.map(s => (
                    <option key={s.value} value={s.value}>{s.icon} {s.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex-[3] min-w-[220px]">
                <label className="block text-[11px] font-medium text-[var(--fd-ink-3)] mb-1">Notes (optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Called twice, no answer. Will retry Friday."
                  value={draft.clientNotes}
                  onChange={e => setDraft(p => ({ ...p, clientNotes: e.target.value }))}
                  className="w-full text-[12px] px-3 py-1.5 rounded-lg border border-[var(--fd-border)] bg-[var(--fd-surface)] text-[var(--fd-ink-1)] outline-none focus:border-[var(--fd-sidebar-link-active)]"
                  maxLength={500}
                />
              </div>
              <div className="flex items-end gap-2 pb-0.5">
                <button
                  onClick={save}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium text-white transition-colors"
                  style={{ background: 'var(--fd-sidebar-link-active)', opacity: saving ? 0.7 : 1 }}
                >
                  <Save size={12} />{saving ? 'Saving…' : 'Save'}
                </button>
                <button
                  onClick={cancel}
                  className="p-1.5 rounded-lg text-[var(--fd-ink-4)] hover:bg-[var(--fd-surface-sunken)]"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
            {draft.clientStatus === 'invalid' && (
              <div className="mt-2 flex items-start gap-2 text-[11.5px] text-amber-700">
                <AlertCircle size={13} className="mt-0.5 flex-shrink-0" />
                <span>Marking a lead as <strong>Invalid</strong> means you believe the contact details are incorrect or unreachable. Our team may review this.</span>
              </div>
            )}
          </td>
        </tr>
      )}

      {/* Notes display row (when not editing) */}
      {!editing && lead.clientNotes && (
        <tr className="border-b-0">
          <td colSpan={8} className="px-4 pb-2 pt-0">
            <div className="text-[11px] italic text-[var(--fd-ink-4)] flex items-start gap-1.5 border-l-2 pl-2" style={{ borderColor: 'var(--fd-border-strong)' }}>
              <span className="text-[10px] mt-0.5">💬</span>
              {lead.clientNotes}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ── Mobile lead card ──────────────────────────────────────────────────────────
function LeadCard({ lead: initialLead, onUpdated }) {
  const [lead, setLead]       = useState(initialLead);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState({ clientStatus: lead.clientStatus, clientNotes: lead.clientNotes || '' });
  const [saving, setSaving]   = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const { data } = await api.patch(`/leads/${lead._id}/client-update`, draft);
      setLead(data.lead);
      onUpdated?.(data.lead);
      setEditing(false);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to save');
    } finally { setSaving(false); }
  };

  const statusCfg = STATUS_MAP[lead.clientStatus] || STATUS_MAP.new;

  return (
    <div className="p-4 space-y-2 border-b border-[var(--fd-border-subtle)]">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-semibold text-[13px] text-[var(--fd-ink-1)]">
            {lead.name || 'Anonymous'}
          </div>
          {lead.email && (
            <a href={`mailto:${lead.email}`} className="text-[11.5px] text-[var(--fd-ink-3)] hover:underline block mt-0.5">
              {lead.email}
            </a>
          )}
          {lead.phone && (
            <a href={`tel:${lead.phone}`} className="text-[11.5px] text-[var(--fd-ink-3)] hover:underline block">
              {lead.phone}
            </a>
          )}
        </div>
        <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold flex-shrink-0 ${statusCfg.color}`}>
          {statusCfg.icon} {statusCfg.label}
        </span>
      </div>

      {(lead.company || lead.location || lead.source) && (
        <div className="flex flex-wrap items-center gap-2 text-[11.5px] text-[var(--fd-ink-4)]">
          {lead.company && <span className="flex items-center gap-1"><Building2 size={10} />{lead.company}</span>}
          {lead.location && <span className="flex items-center gap-1"><MapPin size={10} />{lead.location}</span>}
          {lead.source && (
            <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10.5px] font-medium">{lead.source}</span>
          )}
        </div>
      )}

      {lead.clientNotes && !editing && (
        <div className="text-[11px] italic text-[var(--fd-ink-4)] border-l-2 pl-2" style={{ borderColor: 'var(--fd-border-strong)' }}>
          "{lead.clientNotes}"
        </div>
      )}

      {!editing ? (
        <button
          onClick={() => setEditing(true)}
          className="text-[11.5px] flex items-center gap-1 text-[var(--fd-ink-3)] hover:text-[var(--fd-sidebar-link-active)] transition-colors"
        >
          <Pencil size={11} />Update status
        </button>
      ) : (
        <div className="space-y-2 pt-1">
          <select
            value={draft.clientStatus}
            onChange={e => setDraft(p => ({ ...p, clientStatus: e.target.value }))}
            className="w-full text-[12px] px-3 py-2 rounded-lg border border-[var(--fd-border)] bg-[var(--fd-surface)] text-[var(--fd-ink-1)] outline-none"
          >
            {CLIENT_STATUSES.map(s => (
              <option key={s.value} value={s.value}>{s.icon} {s.label}</option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Notes (optional)"
            value={draft.clientNotes}
            onChange={e => setDraft(p => ({ ...p, clientNotes: e.target.value }))}
            className="w-full text-[12px] px-3 py-2 rounded-lg border border-[var(--fd-border)] bg-[var(--fd-surface)] text-[var(--fd-ink-1)] outline-none"
            maxLength={500}
          />
          <div className="flex items-center gap-2">
            <button
              onClick={save}
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[12px] font-medium text-white"
              style={{ background: 'var(--fd-sidebar-link-active)', opacity: saving ? 0.7 : 1 }}
            >
              <Save size={12} />{saving ? 'Saving…' : 'Save'}
            </button>
            <button
              onClick={() => { setDraft({ clientStatus: lead.clientStatus, clientNotes: lead.clientNotes || '' }); setEditing(false); }}
              className="p-1.5 rounded-lg text-[var(--fd-ink-4)] bg-[var(--fd-surface-raised)]"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ClientLeadsPage() {
  const { user } = useAuthStore();
  const [batches, setBatches]               = useState([]);
  const [leads, setLeads]                   = useState([]);
  const [stats, setStats]                   = useState(null);
  const [loading, setLoading]               = useState(true);
  const [expandedBatch, setExpandedBatch]   = useState(null);
  const [statusFilter, setStatusFilter]     = useState('');

  const load = useCallback(async () => {
    if (!user?.clientId) return;
    setLoading(true);
    try {
      const [batchRes, statsRes] = await Promise.all([
        api.get('/leads/batches'),
        api.get('/leads/stats'),
      ]);
      setBatches(batchRes.data.batches || []);
      setStats(statsRes.data);
    } finally { setLoading(false); }
  }, [user?.clientId]);

  useEffect(() => { load(); }, [load]);

  const loadBatchLeads = async (batchId) => {
    if (expandedBatch === batchId) { setExpandedBatch(null); setLeads([]); return; }
    setExpandedBatch(batchId);
    const params = new URLSearchParams({ batchId, limit: 200 });
    if (statusFilter) params.set('clientStatus', statusFilter);
    const { data } = await api.get(`/leads?${params}`);
    setLeads(data.leads || []);
  };

  const handleLeadUpdated = (updatedLead) => {
    setLeads(prev => prev.map(l => l._id === updatedLead._id ? updatedLead : l));
  };

  const totalLeads  = stats?.total || 0;
  const converted   = stats?.byClientStatus?.find(s => s._id === 'converted')?.count || 0;
  const newLeads    = stats?.byClientStatus?.find(s => s._id === 'new')?.count || 0;
  const contacted   = (stats?.byClientStatus?.find(s => s._id === 'contacted')?.count || 0)
                    + (stats?.byClientStatus?.find(s => s._id === 'qualified')?.count || 0);
  const convRate    = totalLeads > 0 ? ((converted / totalLeads) * 100).toFixed(1) : '0';

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-[var(--fd-ink-1)]">🎯 Your Leads</h1>
        <p className="text-[var(--fd-ink-3)] text-sm mt-0.5">
          Leads generated from your campaigns. Update each lead's status as you work through them.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Leads" value={totalLeads}       icon={Users}        color="blue"   subtitle="All batches" />
        <StatCard title="Unworked"    value={newLeads}         icon={Clock}        color="orange" subtitle="Not yet contacted" />
        <StatCard title="In Progress" value={contacted}        icon={Target}       color="purple" subtitle="Contacted / Qualified" />
        <StatCard title="Converted"   value={`${convRate}%`}   icon={TrendingUp}   color="green"  subtitle={`${converted} won`} />
      </div>

      {/* Status breakdown bar */}
      {totalLeads > 0 && (
        <Card className="px-5 py-4">
          <div className="text-[12px] font-semibold text-[var(--fd-ink-2)] mb-3">Your Progress</div>
          <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
            {CLIENT_STATUSES.filter(s => s.value !== 'new').map(s => {
              const count = stats?.byClientStatus?.find(b => b._id === s.value)?.count || 0;
              const pct   = totalLeads > 0 ? (count / totalLeads) * 100 : 0;
              if (!pct) return null;
              const colors = {
                contacted:      '#3b82f6',
                qualified:      '#f59e0b',
                converted:      '#22c55e',
                not_interested: '#a855f7',
                invalid:        '#ef4444',
              };
              return (
                <div
                  key={s.value}
                  title={`${s.label}: ${count} (${pct.toFixed(0)}%)`}
                  style={{ width: `${pct}%`, background: colors[s.value] || '#ccc', minWidth: pct > 0 ? '4px' : 0 }}
                />
              );
            })}
            {/* Remainder = new */}
            {(() => {
              const worked = stats?.byClientStatus?.filter(s => s._id !== 'new').reduce((a, s) => a + s.count, 0) || 0;
              const newPct = totalLeads > 0 ? ((totalLeads - worked) / totalLeads) * 100 : 100;
              return newPct > 0 ? (
                <div
                  title={`New: ${totalLeads - worked} (${newPct.toFixed(0)}%)`}
                  style={{ width: `${newPct}%`, background: 'var(--fd-border)', minWidth: '4px' }}
                />
              ) : null;
            })()}
          </div>
          <div className="flex flex-wrap gap-3 mt-2">
            {CLIENT_STATUSES.map(s => {
              const count = s.value === 'new' ? newLeads : (stats?.byClientStatus?.find(b => b._id === s.value)?.count || 0);
              if (!count) return null;
              return (
                <div key={s.value} className="flex items-center gap-1.5 text-[11px] text-[var(--fd-ink-3)]">
                  <span>{s.icon}</span>
                  <span>{s.label}</span>
                  <span className="font-semibold text-[var(--fd-ink-1)]">{count}</span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Sources breakdown */}
      {stats?.bySource?.length > 0 && (
        <Card className="p-4">
          <div className="text-sm font-semibold text-[var(--fd-ink-1)] mb-3">Leads by Source</div>
          <div className="flex flex-wrap gap-2">
            {stats.bySource.map(s => (
              <div key={s._id} className="flex items-center gap-2 bg-[var(--fd-surface-raised)] border border-[var(--fd-border)] px-3 py-2 rounded-xl text-xs">
                <span className="font-semibold text-[var(--fd-ink-2)]">{s._id || 'Unknown'}</span>
                <span className="bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full font-bold">{s.count}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Filter */}
      <div className="flex items-center gap-3">
        <Filter size={15} className="text-[var(--fd-ink-4)]" />
        <Select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="w-48">
          <option value="">All Statuses</option>
          {CLIENT_STATUSES.map(s => <option key={s.value} value={s.value}>{s.icon} {s.label}</option>)}
        </Select>
      </div>

      {/* Batches */}
      {loading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : batches.length === 0 ? (
        <EmptyState
          icon={Target}
          title="No leads yet"
          description="Your team will upload leads generated from your campaigns here. Check back after your next campaign goes live."
        />
      ) : (
        <div className="space-y-3">
          {batches.map(batch => {
            const contactedInBatch = (batch.contactedCount || 0);
            const pctContacted     = batch.count > 0 ? Math.round((contactedInBatch / batch.count) * 100) : 0;

            return (
              <Card key={batch._id} className="overflow-hidden">
                {/* Batch header */}
                <div
                  className="flex items-center justify-between p-5 cursor-pointer hover:bg-[var(--fd-surface-raised)] transition-colors"
                  onClick={() => loadBatchLeads(batch._id)}
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-10 h-10 bg-gradient-to-br from-brand-500 to-blue-600 rounded-xl flex items-center justify-center text-white shadow-sm shadow-brand-300 flex-shrink-0">
                      <Target size={18} />
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-[var(--fd-ink-1)]">{batch.batchLabel || 'Lead Upload'}</div>
                      <div className="text-xs text-[var(--fd-ink-4)] mt-0.5 flex flex-wrap items-center gap-2">
                        <span className="font-medium text-brand-600">{batch.count} leads</span>
                        <span>·</span>
                        <span>Uploaded {timeAgo(batch.createdAt)}</span>
                        {batch.sources?.filter(Boolean).length > 0 && (
                          <>
                            <span>·</span>
                            <span className="text-[var(--fd-ink-3)]">{batch.sources.filter(Boolean).join(', ')}</span>
                          </>
                        )}
                      </div>
                      {/* Mini progress bar per batch */}
                      {pctContacted > 0 && (
                        <div className="mt-1.5 flex items-center gap-2">
                          <div className="w-24 h-1.5 rounded-full bg-[var(--fd-border)] overflow-hidden">
                            <div className="h-full rounded-full bg-brand-500" style={{ width: `${pctContacted}%` }} />
                          </div>
                          <span className="text-[10.5px] text-[var(--fd-ink-4)]">{pctContacted}% worked</span>
                          {batch.convertedCount > 0 && (
                            <span className="text-[10.5px] text-emerald-600 font-medium">✓ {batch.convertedCount} converted</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                    {expandedBatch === batch._id
                      ? <ChevronUp size={16} className="text-[var(--fd-ink-4)]" />
                      : <ChevronDown size={16} className="text-[var(--fd-ink-4)]" />
                    }
                  </div>
                </div>

                {/* Leads table */}
                {expandedBatch === batch._id && (
                  <div className="border-t border-[var(--fd-border-subtle)]">
                    {leads.length === 0 ? (
                      <div className="py-8 text-center text-[var(--fd-ink-4)] text-sm">Loading leads...</div>
                    ) : (
                      <>
                        {/* Desktop table */}
                        <div className="hidden md:block overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-[var(--fd-surface-raised)]">
                              <tr>
                                {['Name','Email / Phone','Company / Location','Source','Status','Date',''].map(h => (
                                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-[var(--fd-ink-3)] uppercase tracking-wide">{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--fd-border)]">
                              {leads.map(lead => (
                                <LeadRow key={lead._id} lead={lead} onUpdated={handleLeadUpdated} />
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {/* Mobile cards */}
                        <div className="md:hidden">
                          {leads.map(lead => (
                            <LeadCard key={lead._id} lead={lead} onUpdated={handleLeadUpdated} />
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}