import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';

const REQUEST_TYPES = [
  { value: 'missing_checkin',   label: 'Missing Check-In',            needsIn: true,  needsOut: false },
  { value: 'missing_checkout',  label: 'Missing Check-Out',           needsIn: false, needsOut: true  },
  { value: 'both',              label: 'Fix Both In & Out',           needsIn: true,  needsOut: true  },
  { value: 'absent_correction', label: 'Marked Absent (Was Present)', needsIn: true,  needsOut: true  },
];

const STATUS_STYLES = {
  pending:  { bg: 'rgba(251,191,36,0.08)',  border: 'rgba(251,191,36,0.2)',  text: '#fbbf24' },
  approved: { bg: 'rgba(52,211,153,0.08)', border: 'rgba(52,211,153,0.2)', text: '#34d399' },
  rejected: { bg: 'rgba(248,113,113,0.08)',border: 'rgba(248,113,113,0.2)',text: '#f87171' },
};

const fmt = (dateStr) =>
  dateStr ? new Date(dateStr).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

const fmtDate = (d) =>
  d ? new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const TYPE_LABEL = Object.fromEntries(REQUEST_TYPES.map(t => [t.value, t.label]));

function RequestCard({ req, onCancel }) {
  const [cancelling, setCancelling] = useState(false);
  const s = STATUS_STYLES[req.status] || STATUS_STYLES.pending;

  const handleCancel = async () => {
    if (!confirm('Cancel this request?')) return;
    setCancelling(true);
    try { await onCancel(req._id); } finally { setCancelling(false); }
  };

  return (
    <div
      className="rounded-2xl p-4 space-y-3 animate-fade-in"
      style={{
        background: 'var(--fd-card-bg)',
        
        border: '1px solid var(--fd-border)',
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-display font-semibold text-gray-200">{fmtDate(req.date)}</p>
          <p className="text-xs text-gray-600 mt-0.5">{TYPE_LABEL[req.requestType] || req.requestType}</p>
        </div>
        <span
          className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full flex-shrink-0"
          style={{ background: s.bg, border: `1px solid ${s.border}`, color: s.text }}
        >
          {req.status}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        {req.requestedCheckIn && (
          <div className="bg-white/[0.03] border border-white/[0.05] rounded-xl p-2.5">
            <p className="text-gray-600 mb-0.5 text-[10px] uppercase tracking-wide">Requested In</p>
            <p className="text-gray-200 font-medium font-mono text-[11px]">{fmt(req.requestedCheckIn)}</p>
          </div>
        )}
        {req.requestedCheckOut && (
          <div className="bg-white/[0.03] border border-white/[0.05] rounded-xl p-2.5">
            <p className="text-gray-600 mb-0.5 text-[10px] uppercase tracking-wide">Requested Out</p>
            <p className="text-gray-200 font-medium font-mono text-[11px]">{fmt(req.requestedCheckOut)}</p>
          </div>
        )}
      </div>

      <div className="bg-white/[0.03] border border-white/[0.05] rounded-xl p-2.5">
        <p className="text-gray-600 mb-0.5 text-[10px] uppercase tracking-wide">Reason</p>
        <p className="text-gray-300 text-xs">{req.reason}</p>
      </div>

      {req.adminNote && (
        <div className="bg-white/[0.02] border border-white/[0.04] rounded-xl p-2.5">
          <p className="text-gray-600 mb-0.5 text-[10px] uppercase tracking-wide">Admin Note</p>
          <p className="text-gray-400 text-xs italic">{req.adminNote}</p>
        </div>
      )}

      {req.status === 'pending' && (
        <button
          onClick={handleCancel}
          disabled={cancelling}
          className="w-full text-xs font-medium py-2 rounded-xl transition-all duration-200 disabled:opacity-50"
          style={{
            color: '#f87171',
            border: '1px solid rgba(248,113,113,0.2)',
            background: 'rgba(248,113,113,0.05)',
          }}
        >
          {cancelling ? 'Cancelling…' : 'Cancel Request'}
        </button>
      )}
    </div>
  );
}

export default function EmployeeRegularization() {
  const [requests, setRequests]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [showForm, setShowForm]     = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState('');
  const [success, setSuccess]       = useState('');
  const [filterStatus, setFilter]   = useState('all');

  const [form, setForm] = useState({
    date: '', requestType: '', checkInTime: '', checkOutTime: '', reason: '',
  });

  const selectedType = REQUEST_TYPES.find(t => t.value === form.requestType);

  const fetchRequests = useCallback(async () => {
    try {
      const { data } = await api.get('/regularization/my-requests');
      setRequests(data.requests || []);
    } catch { setError('Failed to load requests'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const handleSubmit = async () => {
    setError('');
    if (!form.date || !form.requestType || !form.reason.trim()) {
      setError('Date, request type and reason are required');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/regularization/request', {
        date: form.date, requestType: form.requestType,
        checkInTime: form.checkInTime || undefined,
        checkOutTime: form.checkOutTime || undefined,
        reason: form.reason.trim(),
      });
      setSuccess('Request submitted! Admin will review it soon.');
      setShowForm(false);
      setForm({ date: '', requestType: '', checkInTime: '', checkOutTime: '', reason: '' });
      fetchRequests();
    } catch (err) { setError(err.response?.data?.message || 'Failed to submit request'); }
    finally { setSubmitting(false); }
  };

  const handleCancel = async (id) => {
    await api.delete(`/regularization/${id}`);
    fetchRequests();
  };

  const filtered = filterStatus === 'all' ? requests : requests.filter(r => r.status === filterStatus);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between animate-slide-up">
        <div>
          <h1 className="page-title">Regularization</h1>
          <p className="text-xs text-gray-600 mt-0.5">Fix incorrect or missing attendance</p>
        </div>
        <button
          onClick={() => { setShowForm(v => !v); setError(''); }}
          className="btn-primary text-sm px-4 py-2"
        >
          {showForm ? 'Cancel' : '+ New'}
        </button>
      </div>

      {/* Flash messages */}
      {success && (
        <div
          className="rounded-xl px-4 py-3 flex items-center justify-between animate-slide-up"
          style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)', color: '#34d399' }}
        >
          <span className="text-sm">{success}</span>
          <button onClick={() => setSuccess('')} className="ml-3 opacity-60 hover:opacity-100">✕</button>
        </div>
      )}
      {error && (
        <div
          className="rounded-xl px-4 py-3 flex items-center justify-between animate-slide-up"
          style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', color: '#f87171' }}
        >
          <span className="text-sm">{error}</span>
          <button onClick={() => setError('')} className="ml-3 opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div
          className="rounded-2xl p-5 space-y-4 animate-slide-up relative overflow-hidden"
          style={{
            background: 'var(--fd-card-bg)',
            
            border: '1px solid rgba(var(--fd-accent-rgb),0.12)',
          }}
        >
          <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-attbrand-500/15 to-transparent" />
          <h2 className="font-display font-semibold text-white text-sm">New Regularization Request</h2>

          {/* Date */}
          <div>
            <label className="label block mb-1.5">Date to Correct</label>
            <input type="date" max={today} value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="input" />
          </div>

          {/* Request type */}
          <div>
            <label className="label block mb-2">What needs fixing?</label>
            <div className="grid grid-cols-1 gap-1.5">
              {REQUEST_TYPES.map(t => (
                <button
                  key={t.value}
                  onClick={() => setForm(f => ({ ...f, requestType: t.value, checkInTime: '', checkOutTime: '' }))}
                  className="text-left text-sm px-3.5 py-2.5 rounded-xl transition-all duration-200"
                  style={form.requestType === t.value ? {
                    background: 'rgba(var(--fd-accent-rgb),0.08)',
                    border: '1px solid rgba(var(--fd-accent-rgb),0.25)',
                    color: 'var(--fd-accent)',
                  } : {
                    background: 'var(--fd-border)',
                    border: '1px solid var(--fd-border)',
                    color: 'var(--fd-ink-4)',
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {selectedType?.needsIn && (
            <div>
              <label className="label block mb-1.5">
                {form.requestType === 'both' ? 'Check-In Time' : 'Correct Check-In Time'}
              </label>
              <input type="time" value={form.checkInTime} onChange={e => setForm(f => ({ ...f, checkInTime: e.target.value }))} className="input" />
            </div>
          )}

          {selectedType?.needsOut && (
            <div>
              <label className="label block mb-1.5">
                {form.requestType === 'both' ? 'Check-Out Time' : 'Correct Check-Out Time'}
              </label>
              <input type="time" value={form.checkOutTime} onChange={e => setForm(f => ({ ...f, checkOutTime: e.target.value }))} className="input" />
            </div>
          )}

          {/* Reason */}
          <div>
            <label className="label block mb-1.5">
              Reason <span className="text-gray-700 normal-case tracking-normal">— be specific</span>
            </label>
            <textarea
              rows={3}
              placeholder="e.g. Forgot to check out before leaving for an emergency meeting…"
              value={form.reason}
              onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
              className="input"
              maxLength={500}
            />
            <p className="text-right text-[10px] text-gray-700 mt-1 font-mono">{form.reason.length}/500</p>
          </div>

          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="btn-primary w-full py-3 text-sm flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {submitting ? (
              <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5"/><path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v2.5a5.5 5.5 0 00-5.5 5.5H4z"/></svg> Submitting…</>
            ) : 'Submit Request'}
          </button>
        </div>
      )}

      {/* Filter chips */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {['all', 'pending', 'approved', 'rejected'].map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className="flex-shrink-0 text-xs px-3.5 py-1.5 rounded-full capitalize transition-all duration-200"
            style={filterStatus === s ? {
              background: 'rgba(var(--fd-accent-rgb),0.1)',
              border: '1px solid rgba(var(--fd-accent-rgb),0.25)',
              color: 'var(--fd-accent)',
            } : {
              background: 'var(--fd-card-bg)',
              border: '1px solid var(--fd-border)',
              color: 'var(--fd-ink-4)',
            }}
          >
            {s}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center text-gray-600 py-12 text-sm">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 space-y-2">
          <div className="text-3xl">📋</div>
          <p className="text-gray-600 text-sm">No requests found</p>
          {filterStatus !== 'all' && (
            <button onClick={() => setFilter('all')} className="text-attbrand-500 text-xs hover:underline">Show all</button>
          )}
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map(r => <RequestCard key={r._id} req={r} onCancel={handleCancel} />)}
        </div>
      )}
    </div>
  );
}
