import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import Spinner from '../../components/common/Spinner';

const fmt = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const STATUS_STYLES = {
  pending:  { bg: 'rgba(251,191,36,0.08)',  border: 'rgba(251,191,36,0.2)',  text: '#fbbf24' },
  approved: { bg: 'rgba(52,211,153,0.08)', border: 'rgba(52,211,153,0.2)', text: '#34d399' },
  rejected: { bg: 'rgba(248,113,113,0.08)',border: 'rgba(248,113,113,0.2)',text: '#f87171' },
};

const panelStyle = {
  background: 'var(--fd-card-bg)',
  
  border: '1px solid var(--fd-border)',
};

function RequestCard({ req, onApprove, onReject }) {
  const [approvalDays, setApprovalDays] = useState(req.daysRequested || 1);
  const [actioning, setActioning] = useState(false);
  const s = STATUS_STYLES[req.status] || STATUS_STYLES.pending;

  const handleApprove = async () => { setActioning(true); await onApprove(req._id, approvalDays); setActioning(false); };
  const handleReject  = async () => { setActioning(true); await onReject(req._id);                 setActioning(false); };

  return (
    <div className="rounded-2xl p-5 space-y-4 animate-fade-in" style={panelStyle}>
      {/* Employee info */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-black flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, var(--fd-accent), var(--fd-accent-hover))', fontFamily: 'Syne, sans-serif' }}>
            {req.userName?.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-display font-semibold text-white text-sm">{req.userName}</p>
            <p className="text-xs text-gray-600">{req.userEmail}</p>
          </div>
        </div>
        <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full uppercase tracking-wide"
          style={{ background: s.bg, border: `1px solid ${s.border}`, color: s.text }}>
          {req.status}
        </span>
      </div>

      {/* Location */}
      <div className="bg-white/[0.03] border border-white/[0.05] rounded-xl p-3">
        <p className="label mb-2">Requested Location</p>
        <div className="flex items-center gap-2">
          <svg className="w-3.5 h-3.5 text-attbrand-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="font-mono text-sm text-gray-200">{req.latitude?.toFixed(5)}, {req.longitude?.toFixed(5)}</span>
        </div>
        {req.accuracy && <p className="text-[10px] text-gray-700 mt-1 ml-5">Accuracy: ±{Math.round(req.accuracy)}m</p>}
        <a href={`https://www.google.com/maps?q=${req.latitude},${req.longitude}`} target="_blank" rel="noopener noreferrer"
          className="mt-2 inline-flex items-center gap-1.5 text-xs text-attbrand-500 hover:text-attbrand-400 transition-colors ml-5">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
          Open in Maps
        </a>
      </div>

      {/* Meta */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div><p className="text-[10px] text-gray-600 mb-0.5">Requested</p><p className="text-gray-300 font-medium">{fmt(req.createdAt)}</p></div>
        <div><p className="text-[10px] text-gray-600 mb-0.5">Days Requested</p><p className="font-display font-bold text-xl text-attbrand-500">{req.daysRequested}</p></div>
      </div>

      {req.comment && (
        <div className="bg-white/[0.02] border border-white/[0.04] rounded-xl p-3">
          <p className="label mb-1">Employee Comment</p>
          <p className="text-sm text-gray-400 italic">"{req.comment}"</p>
        </div>
      )}

      {/* Actions */}
      {req.status === 'pending' && (
        <div style={{ borderTop: '1px solid var(--fd-border)', paddingTop: '16px' }} className="space-y-3">
          <div>
            <p className="label mb-2">Approved Days (adjustable)</p>
            <div className="flex items-center gap-3">
              <button onClick={() => setApprovalDays(d => Math.max(1, d - 1))}
                className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-300 hover:text-attbrand-500 font-bold text-lg transition-all"
                style={{ background: 'var(--fd-border)', border: '1px solid var(--fd-border)' }}>−</button>
              <div className="flex-1 text-center">
                <span className="font-display font-bold text-2xl text-attbrand-500">{approvalDays}</span>
                <span className="text-gray-600 text-sm ml-2">{approvalDays === 1 ? 'day' : 'days'}</span>
              </div>
              <button onClick={() => setApprovalDays(d => Math.min(90, d + 1))}
                className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-300 hover:text-attbrand-500 font-bold text-lg transition-all"
                style={{ background: 'var(--fd-border)', border: '1px solid var(--fd-border)' }}>+</button>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={handleReject} disabled={actioning} className="btn-danger flex-1 py-2.5 text-sm flex items-center justify-center gap-2">
              {actioning ? <Spinner size="sm" /> : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>}
              Reject
            </button>
            <button onClick={handleApprove} disabled={actioning} className="btn-primary flex-1 py-2.5 text-sm flex items-center justify-center gap-2">
              {actioning ? <Spinner size="sm" className="text-black" /> : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
              Approve
            </button>
          </div>
        </div>
      )}

      {req.status === 'approved' && (
        <div style={{ borderTop: '1px solid var(--fd-border)', paddingTop: '12px' }} className="flex items-center justify-between text-sm">
          <span className="text-gray-600">Approved for <span className="text-emerald-400 font-bold">{req.daysApproved}</span> day{req.daysApproved !== 1 ? 's' : ''}</span>
          {req.approvedAt && <span className="text-gray-700 text-xs font-mono">{fmt(req.approvedAt)}</span>}
        </div>
      )}
    </div>
  );
}

export default function WFHRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState('pending');

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try { const { data } = await api.get(`/wfh/requests?status=${filter}`); setRequests(data.requests || []); }
    catch { toast.error('Failed to load WFH requests'); }
    finally { setLoading(false); }
  }, [filter]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const handleApprove = async (id, daysApproved) => {
    try { await api.put(`/wfh/requests/${id}/approve`, { daysApproved }); toast.success(`Approved for ${daysApproved} day${daysApproved !== 1 ? 's' : ''}!`); fetchRequests(); }
    catch (err) { toast.error(err.response?.data?.message || 'Failed to approve'); }
  };
  const handleReject = async (id) => {
    try { await api.put(`/wfh/requests/${id}/reject`); toast.success('Request rejected'); fetchRequests(); }
    catch (err) { toast.error(err.response?.data?.message || 'Failed to reject'); }
  };

  const filterTabs = [{ key: 'pending', label: 'Pending' }, { key: 'approved', label: 'Approved' }, { key: 'rejected', label: 'Rejected' }, { key: '', label: 'All' }];

  return (
    <div className="p-5 md:p-8 max-w-3xl mx-auto space-y-5 animate-fade-in">
      <div className="animate-slide-up">
        <h1 className="page-title">WFH Requests</h1>
        <p className="text-gray-600 text-sm mt-1">Review and approve work-from-home location requests.</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {filterTabs.map(({ key, label }) => (
          <button key={key} onClick={() => setFilter(key)}
            className="px-4 py-1.5 rounded-xl text-sm font-medium transition-all duration-200"
            style={filter === key
              ? { background: 'rgba(var(--fd-accent-rgb),0.12)', border: '1px solid rgba(var(--fd-accent-rgb),0.25)', color: 'var(--fd-accent)' }
              : { background: 'var(--fd-card-bg)', border: '1px solid var(--fd-border)', color: 'var(--fd-ink-4)' }}>
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Spinner size="lg" className="text-attbrand-500" /></div>
      ) : requests.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
          </div>
          <p className="text-gray-500 font-display font-medium">No {filter || ''} WFH requests</p>
          <p className="text-gray-700 text-xs mt-1">Requests appear when employees are outside the office</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map(req => <RequestCard key={req._id} req={req} onApprove={handleApprove} onReject={handleReject} />)}
        </div>
      )}
    </div>
  );
}
