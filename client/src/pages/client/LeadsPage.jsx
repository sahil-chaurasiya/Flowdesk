import React, { useEffect, useState, useCallback } from 'react';
import { Target, TrendingUp, Users, ChevronDown, ChevronUp, Filter } from 'lucide-react';
import api from '../../lib/api';
import useAuthStore from '../../context/authStore';
import { PageHeader, EmptyState, Card, Spinner, StatCard } from '../../components/shared/LoadingScreen';
import { Select } from '../../components/ui/index';
import { formatDate, timeAgo } from '../../lib/utils';

const STATUS_COLORS = {
  new: 'bg-[var(--fd-surface-sunken)] text-[var(--fd-ink-2)]',
  contacted: 'bg-blue-100 text-blue-700',
  qualified: 'bg-amber-100 text-amber-700',
  converted: 'bg-emerald-100 text-emerald-700',
  lost: 'bg-red-100 text-red-600',
};

const STATUS_LABELS = {
  new: 'New',
  contacted: 'Contacted',
  qualified: 'Qualified',
  converted: 'Converted',
  lost: 'Lost',
};

export default function ClientLeadsPage() {
  const { user } = useAuthStore();
  const [batches, setBatches] = useState([]);
  const [leads, setLeads] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedBatch, setExpandedBatch] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');

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
    } finally {
      setLoading(false);
    }
  }, [user?.clientId]);

  useEffect(() => { load(); }, [load]);

  const loadBatchLeads = async (batchId) => {
    if (expandedBatch === batchId) { setExpandedBatch(null); setLeads([]); return; }
    setExpandedBatch(batchId);
    const params = new URLSearchParams({ batchId, limit: 200 });
    if (statusFilter) params.set('status', statusFilter);
    const { data } = await api.get(`/leads?${params}`);
    setLeads(data.leads || []);
  };

  const totalLeads = stats?.total || 0;
  const converted = stats?.byStatus?.find(s => s._id === 'converted')?.count || 0;
  const qualified = stats?.byStatus?.find(s => s._id === 'qualified')?.count || 0;
  const newLeads = stats?.byStatus?.find(s => s._id === 'new')?.count || 0;
  const convRate = totalLeads > 0 ? ((converted / totalLeads) * 100).toFixed(1) : '0';

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-[var(--fd-ink-1)]">🎯 Your Leads</h1>
        <p className="text-[var(--fd-ink-3)] text-sm mt-0.5">All leads generated from your campaigns, uploaded by your team.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Leads" value={totalLeads} icon={Users} color="blue" subtitle="All time" />
        <StatCard title="New" value={newLeads} icon={Target} color="orange" subtitle="Uncontacted" />
        <StatCard title="Qualified" value={qualified} icon={TrendingUp} color="purple" subtitle="Sales ready" />
        <StatCard title="Converted" value={`${convRate}%`} icon={TrendingUp} color="green" subtitle="Conversion rate" />
      </div>

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

      {/* Status filter */}
      <div className="flex items-center gap-3">
        <Filter size={15} className="text-[var(--fd-ink-4)]" />
        <Select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="w-44">
          <option value="">All Statuses</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
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
          {batches.map(batch => (
            <Card key={batch._id} className="overflow-hidden">
              {/* Batch header */}
              <div
                className="flex items-center justify-between p-5 cursor-pointer hover:bg-[var(--fd-surface-raised)] transition-colors"
                onClick={() => loadBatchLeads(batch._id)}
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-gradient-to-br from-brand-500 to-blue-600 rounded-xl flex items-center justify-center text-white shadow-sm shadow-brand-300">
                    <Target size={18} />
                  </div>
                  <div>
                    <div className="font-semibold text-[var(--fd-ink-1)]">{batch.batchLabel || 'Lead Upload'}</div>
                    <div className="text-xs text-[var(--fd-ink-4)] mt-0.5 flex items-center gap-2">
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
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {/* Mini status breakdown */}
                  <div className="hidden md:flex items-center gap-1.5 text-xs">
                    {expandedBatch !== batch._id && leads.length === 0 && null}
                  </div>
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
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-[var(--fd-surface-raised)]">
                          <tr>
                            {['Name', 'Email', 'Phone', 'Company', 'Location', 'Source', 'Status', 'Date'].map(h => (
                              <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-[var(--fd-ink-3)] uppercase tracking-wide">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {leads.map(lead => (
                            <tr key={lead._id} className="hover:bg-[var(--fd-surface-raised)] transition-colors">
                              <td className="px-4 py-3 font-medium text-[var(--fd-ink-1)] text-xs">{lead.name || '—'}</td>
                              <td className="px-4 py-3 text-[var(--fd-ink-2)] text-xs">{lead.email || '—'}</td>
                              <td className="px-4 py-3 text-[var(--fd-ink-2)] text-xs">{lead.phone || '—'}</td>
                              <td className="px-4 py-3 text-[var(--fd-ink-2)] text-xs">{lead.company || '—'}</td>
                              <td className="px-4 py-3 text-[var(--fd-ink-3)] text-xs">{lead.location || '—'}</td>
                              <td className="px-4 py-3 text-xs">
                                {lead.source
                                  ? <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">{lead.source}</span>
                                  : '—'}
                              </td>
                              <td className="px-4 py-3">
                                <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${STATUS_COLORS[lead.status]}`}>
                                  {STATUS_LABELS[lead.status] || lead.status}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-[var(--fd-ink-4)] text-xs">{formatDate(lead.leadDate || lead.createdAt)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
