import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import Spinner from '../../components/common/Spinner';

const LEAVE_TYPES = [
  { value: 'sick',    label: 'Sick Leave',    accent: '#f87171' },
  { value: 'casual',  label: 'Casual Leave',  accent: '#60a5fa' },
  { value: 'earned',  label: 'Earned Leave',  accent: '#34d399' },
  { value: 'unpaid',  label: 'Unpaid Leave',  accent: '#fbbf24' },
  { value: 'other',   label: 'Other',         accent: 'var(--fd-ink-3)' },
];

const STATUS_STYLES = {
  pending:  { bg: 'rgba(251,191,36,0.08)',  border: 'rgba(251,191,36,0.2)',  text: '#fbbf24' },
  approved: { bg: 'rgba(52,211,153,0.08)', border: 'rgba(52,211,153,0.2)', text: '#34d399' },
  rejected: { bg: 'rgba(248,113,113,0.08)',border: 'rgba(248,113,113,0.2)',text: '#f87171' },
};

const panelStyle = {
  background: 'var(--fd-card-bg)',
  
  border: '1px solid var(--fd-border)',
};

const fmtDate    = (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const fmtCreated = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

function LeaveRequestCard({ req, onApprove, onReject }) {
  const [adminNote, setAdminNote] = useState('');
  const [actioning, setActioning] = useState(false);
  const type = LEAVE_TYPES.find(t => t.value === req.leaveType);
  const s = STATUS_STYLES[req.status] || STATUS_STYLES.pending;

  const handleApprove = async () => { setActioning(true); await onApprove(req._id, adminNote); setActioning(false); };
  const handleReject  = async () => { setActioning(true); await onReject(req._id, adminNote);  setActioning(false); };

  return (
    <div className="rounded-2xl p-5 space-y-4 animate-fade-in" style={panelStyle}>
      {/* Employee + status */}
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
        <div className="flex flex-col items-end gap-1.5">
          <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full uppercase tracking-wide"
            style={{ background: s.bg, border: `1px solid ${s.border}`, color: s.text }}>
            {req.status}
          </span>
          {type && (
            <span className="text-[11px] font-medium px-2.5 py-1 rounded-full"
              style={{ background: `${type.accent}10`, color: type.accent, border: `1px solid ${type.accent}25` }}>
              {type.label}
            </span>
          )}
        </div>
      </div>

      {/* Date range */}
      <div className="bg-white/[0.03] border border-white/[0.05] rounded-xl p-3">
        <div className="flex items-center gap-3 text-sm">
          <div><p className="text-[10px] text-gray-600 mb-0.5 uppercase tracking-wide">From</p><p className="text-gray-200 font-medium">{fmtDate(req.startDate)}</p></div>
          <svg className="w-3.5 h-3.5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
          <div><p className="text-[10px] text-gray-600 mb-0.5 uppercase tracking-wide">To</p><p className="text-gray-200 font-medium">{fmtDate(req.endDate)}</p></div>
          <div className="ml-auto text-right">
            <p className="text-[10px] text-gray-600 mb-0.5 uppercase tracking-wide">Days</p>
            <p className="font-display font-bold text-2xl text-attbrand-500">{req.totalDays}</p>
          </div>
        </div>
      </div>

      {/* Reason */}
      <div className="bg-white/[0.02] border border-white/[0.04] rounded-xl p-3">
        <p className="label mb-1">Reason</p>
        <p className="text-sm text-gray-400">{req.reason}</p>
      </div>

      <div className="flex items-center justify-between text-[11px] text-gray-600">
        <span>Submitted {fmtCreated(req.createdAt)}</span>
        {req.approvedByName && <span>By <span className="text-gray-400">{req.approvedByName}</span></span>}
      </div>

      {/* Admin actions */}
      {req.status === 'pending' && (
        <div style={{ borderTop: '1px solid var(--fd-border)', paddingTop: '16px' }} className="space-y-3">
          <div>
            <label className="label block mb-1.5">Note to Employee (optional)</label>
            <input type="text" value={adminNote} onChange={e => setAdminNote(e.target.value)}
              placeholder="e.g. Approved, please handover tasks" className="input w-full text-sm" />
          </div>
          <div className="flex gap-3">
            <button onClick={handleReject} disabled={actioning} className="btn-danger flex-1 py-2.5 text-sm flex items-center justify-center gap-2">
              {actioning ? <Spinner size="sm" /> : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>}
              Reject
            </button>
            <button onClick={handleApprove} disabled={actioning} className="btn-primary flex-1 py-2.5 text-sm flex items-center justify-center gap-2">
              {actioning ? <Spinner size="sm" className="text-black" /> : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
              Approve ({req.totalDays}d)
            </button>
          </div>
        </div>
      )}

      {req.status !== 'pending' && req.adminNote && (
        <div className="bg-white/[0.02] border border-white/[0.04] rounded-xl p-3">
          <p className="label mb-1">Admin Note</p>
          <p className="text-sm text-gray-400 italic">"{req.adminNote}"</p>
        </div>
      )}
    </div>
  );
}

function SummaryBar({ requests }) {
  const pending  = requests.filter(r => r.status === 'pending').length;
  const approved = requests.filter(r => r.status === 'approved').reduce((s, r) => s + r.totalDays, 0);
  return (
    <div className="grid grid-cols-3 gap-3">
      {[
        { label: 'Pending',              value: pending,           color: '#fbbf24' },
        { label: 'Approved Days (shown)', value: approved,          color: '#34d399' },
        { label: 'Total Shown',          value: requests.length,   color: 'var(--fd-accent)' },
      ].map(({ label, value, color }) => (
        <div key={label} className="rounded-2xl p-4 text-center" style={{ background: 'var(--fd-card-bg)', border: '1px solid var(--fd-border)' }}>
          <p className="font-display font-bold text-2xl" style={{ color }}>{value}</p>
          <p className="text-[10px] text-gray-600 mt-0.5">{label}</p>
        </div>
      ))}
    </div>
  );
}

export default function AdminLeaveRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState('pending');

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/leave/requests${filter ? `?status=${filter}` : ''}`);
      setRequests(data.requests || []);
    } catch { toast.error('Failed to load leave requests'); }
    finally { setLoading(false); }
  }, [filter]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const handleApprove = async (id, adminNote) => {
    try { const { data } = await api.put(`/leave/requests/${id}/approve`, { adminNote }); toast.success(data.message || 'Leave approved'); fetchRequests(); }
    catch (err) { toast.error(err.response?.data?.message || 'Failed to approve'); }
  };
  const handleReject = async (id, adminNote) => {
    try { await api.put(`/leave/requests/${id}/reject`, { adminNote }); toast.success('Leave rejected'); fetchRequests(); }
    catch (err) { toast.error(err.response?.data?.message || 'Failed to reject'); }
  };

  const filterTabs = [{ key: 'pending', label: 'Pending' }, { key: 'approved', label: 'Approved' }, { key: 'rejected', label: 'Rejected' }, { key: '', label: 'All' }];

  return (
    <div className="p-5 md:p-8 max-w-3xl mx-auto space-y-5 animate-fade-in">
      <div className="animate-slide-up">
        <h1 className="page-title">Leave Requests</h1>
        <p className="text-gray-600 text-sm mt-1">Approve or reject employee leave applications.</p>
      </div>

      {!loading && <SummaryBar requests={requests} />}

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
            <svg className="w-6 h-6 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          </div>
          <p className="text-gray-500 font-display font-medium">No {filter || ''} leave requests</p>
          <p className="text-gray-700 text-xs mt-1">Employee leave applications will appear here</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map(req => <LeaveRequestCard key={req._id} req={req} onApprove={handleApprove} onReject={handleReject} />)}
        </div>
      )}
    </div>
  );
}
