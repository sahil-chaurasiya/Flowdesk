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

const fmtDate    = (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const fmtCreated = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const countWorkingDays = (startStr, endStr) => {
  if (!startStr || !endStr) return 0;
  const start = new Date(startStr + 'T00:00:00');
  const end   = new Date(endStr   + 'T00:00:00');
  if (start > end) return 0;
  let count = 0;
  const cur = new Date(start);
  while (cur <= end) {
    if (cur.getDay() !== 0) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
};

function LeaveCard({ leave, onCancel }) {
  const type = LEAVE_TYPES.find(t => t.value === leave.leaveType);
  const s = STATUS_STYLES[leave.status] || STATUS_STYLES.pending;

  return (
    <div
      className="rounded-2xl p-5 space-y-3 animate-fade-in"
      style={{
        background: 'var(--fd-card-bg)',
        
        border: '1px solid var(--fd-border)',
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          {type && (
            <span
              className="text-xs font-semibold px-2.5 py-1 rounded-full"
              style={{ background: `${type.accent}12`, color: type.accent, border: `1px solid ${type.accent}25` }}
            >
              {type.label}
            </span>
          )}
          <span
            className="text-[11px] font-semibold px-2.5 py-1 rounded-full uppercase tracking-wide"
            style={{ background: s.bg, color: s.text, border: `1px solid ${s.border}` }}
          >
            {leave.status}
          </span>
        </div>
        <span className="text-[11px] text-gray-600 flex-shrink-0 font-mono">{fmtCreated(leave.createdAt)}</span>
      </div>

      <div className="flex items-center gap-4 text-sm">
        <div>
          <p className="text-[10px] text-gray-600 mb-0.5 uppercase tracking-wide">From</p>
          <p className="text-gray-200 font-medium text-sm">{fmtDate(leave.startDate)}</p>
        </div>
        <svg className="w-3.5 h-3.5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
        </svg>
        <div>
          <p className="text-[10px] text-gray-600 mb-0.5 uppercase tracking-wide">To</p>
          <p className="text-gray-200 font-medium text-sm">{fmtDate(leave.endDate)}</p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-[10px] text-gray-600 mb-0.5 uppercase tracking-wide">Days</p>
          <p className="font-display font-bold text-2xl text-attbrand-500">{leave.totalDays}</p>
        </div>
      </div>

      <div className="bg-white/[0.03] border border-white/[0.05] rounded-xl p-3">
        <p className="label mb-1">Reason</p>
        <p className="text-sm text-gray-400">{leave.reason}</p>
      </div>

      {leave.adminNote && (
        <div className="bg-white/[0.02] border border-white/[0.04] rounded-xl p-3">
          <p className="label mb-1">Admin Note</p>
          <p className="text-sm text-gray-400 italic">"{leave.adminNote}"</p>
        </div>
      )}

      {leave.status === 'pending' && (
        <button onClick={() => onCancel(leave._id)} className="btn-danger w-full text-sm py-2.5">
          Cancel Request
        </button>
      )}
    </div>
  );
}

export default function LeavePage() {
  const [leaves, setLeaves]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [filter, setFilter]         = useState('');
  const [totalApproved, setTotalApproved] = useState(0);
  const [showForm, setShowForm]     = useState(false);

  const [leaveType, setLeaveType]   = useState('sick');
  const [startDate, setStartDate]   = useState('');
  const [endDate, setEndDate]       = useState('');
  const [reason, setReason]         = useState('');

  const previewDays = countWorkingDays(startDate, endDate);
  const curYear = new Date().getFullYear();

  const fetchLeaves = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/leave/my-leaves?year=${curYear}${filter ? `&status=${filter}` : ''}`);
      setLeaves(data.leaves || []);
      setTotalApproved(data.totalApprovedDays || 0);
    } catch { toast.error('Failed to load leave history'); }
    finally { setLoading(false); }
  }, [filter, curYear]);

  useEffect(() => { fetchLeaves(); }, [fetchLeaves]);

  const handleSubmit = async () => {
    if (!startDate || !endDate || !reason.trim()) { toast.error('Please fill in all fields'); return; }
    if (previewDays === 0) { toast.error('Selected range has no working days'); return; }
    setSubmitting(true);
    try {
      await api.post('/leave/request', { leaveType, startDate, endDate, reason });
      toast.success('Leave request submitted!');
      setShowForm(false);
      setStartDate(''); setEndDate(''); setReason(''); setLeaveType('sick');
      fetchLeaves();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to submit request'); }
    finally { setSubmitting(false); }
  };

  const handleCancel = async (id) => {
    if (!window.confirm('Cancel this leave request?')) return;
    try { await api.delete(`/leave/${id}`); toast.success('Request cancelled'); fetchLeaves(); }
    catch (err) { toast.error(err.response?.data?.message || 'Failed to cancel'); }
  };

  const filterTabs = [
    { key: '',         label: 'All' },
    { key: 'pending',  label: 'Pending' },
    { key: 'approved', label: 'Approved' },
    { key: 'rejected', label: 'Rejected' },
  ];

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 animate-slide-up">
        <div>
          <h1 className="page-title">Leave Requests</h1>
          <p className="text-gray-600 text-sm mt-1">
            {curYear} · <span className="text-emerald-400 font-medium">{totalApproved} day{totalApproved !== 1 ? 's' : ''}</span> approved
          </p>
        </div>
        <button
          onClick={() => setShowForm(f => !f)}
          className="btn-primary text-sm px-4 py-2.5 flex items-center gap-2 flex-shrink-0"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          New Request
        </button>
      </div>

      {/* New request form */}
      {showForm && (
        <div
          className="rounded-2xl p-5 space-y-5 animate-slide-up relative overflow-hidden"
          style={{
            background: 'var(--fd-card-bg)',
            
            border: '1px solid rgba(var(--fd-accent-rgb),0.15)',
          }}
        >
          <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-attbrand-500/20 to-transparent" />
          <h2 className="font-display font-bold text-white text-base">Apply for Leave</h2>

          {/* Leave type grid */}
          <div>
            <p className="label mb-2.5">Leave Type</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {LEAVE_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setLeaveType(t.value)}
                  className="px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 text-left"
                  style={leaveType === t.value ? {
                    background: `${t.accent}10`,
                    border: `1px solid ${t.accent}35`,
                    color: t.accent,
                  } : {
                    background: 'var(--fd-border)',
                    border: '1px solid rgba(255,255,255,0.07)',
                    color: 'var(--fd-ink-3)',
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Date range */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label block mb-1.5">From</label>
              <input type="date" value={startDate} min={today} onChange={e => setStartDate(e.target.value)} className="input" />
            </div>
            <div>
              <label className="label block mb-1.5">To</label>
              <input type="date" value={endDate} min={startDate || today} onChange={e => setEndDate(e.target.value)} className="input" />
            </div>
          </div>

          {/* Day preview */}
          {startDate && endDate && (
            <div
              className="rounded-xl p-3 text-sm font-semibold text-center transition-all font-display"
              style={previewDays > 0 ? {
                background: 'rgba(var(--fd-accent-rgb),0.06)',
                border: '1px solid rgba(var(--fd-accent-rgb),0.2)',
                color: 'var(--fd-accent)',
              } : {
                background: 'rgba(248,113,113,0.06)',
                border: '1px solid rgba(248,113,113,0.2)',
                color: '#f87171',
              }}
            >
              {previewDays > 0
                ? `${previewDays} working day${previewDays !== 1 ? 's' : ''} (Mon–Sat)`
                : 'No working days in this range'}
            </div>
          )}

          {/* Reason */}
          <div>
            <label className="label block mb-1.5">Reason</label>
            <textarea rows={3} value={reason} onChange={e => setReason(e.target.value)} placeholder="Brief reason for leave…" className="input" />
          </div>

          <div className="flex gap-3">
            <button onClick={() => setShowForm(false)} className="btn-secondary flex-1 py-2.5 text-sm">Cancel</button>
            <button onClick={handleSubmit} disabled={submitting || previewDays === 0} className="btn-primary flex-1 py-2.5 text-sm flex items-center justify-center gap-2">
              {submitting ? <Spinner size="sm" className="text-black" /> : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              )}
              Submit
            </button>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {filterTabs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className="px-4 py-1.5 rounded-xl text-sm font-medium transition-all duration-200"
            style={filter === key ? {
              background: 'rgba(var(--fd-accent-rgb),0.12)',
              border: '1px solid rgba(var(--fd-accent-rgb),0.25)',
              color: 'var(--fd-accent)',
              boxShadow: '0 0 16px rgba(var(--fd-accent-rgb),0.1)',
            } : {
              background: 'var(--fd-card-bg)',
              border: '1px solid var(--fd-border)',
              color: 'var(--fd-ink-4)',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Leave list */}
      {loading ? (
        <div className="flex justify-center py-12"><Spinner size="lg" className="text-attbrand-500" /></div>
      ) : leaves.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-gray-500 font-medium font-display">No {filter || ''} leave requests</p>
          <p className="text-gray-700 text-xs mt-1">Tap "New Request" to apply</p>
        </div>
      ) : (
        <div className="space-y-3">
          {leaves.map(l => <LeaveCard key={l._id} leave={l} onCancel={handleCancel} />)}
        </div>
      )}
    </div>
  );
}
