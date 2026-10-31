import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPE_LABEL = {
  missing_checkin:   'Missing Check-In',
  missing_checkout:  'Missing Check-Out',
  both:              'Fix Both In & Out',
  absent_correction: 'Absent → Present',
};

const STATUS_STYLES = {
  pending:  'bg-yellow-500/15 text-yellow-400 border border-yellow-500/30',
  approved: 'bg-green-500/15 text-green-400 border border-green-500/30',
  rejected: 'bg-red-500/15 text-red-400 border border-red-500/30',
};

const fmt = (d) =>
  d ? new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

const fmtDate = (d) =>
  d ? new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : '—';

// ─── Review Modal ─────────────────────────────────────────────────────────────

function ReviewModal({ request, onClose, onDone }) {
  const [adminNote, setAdminNote] = useState('');
  const [loading, setLoading]    = useState(false);
  const [error, setError]        = useState('');

  const handle = async (action) => {
    setLoading(true); setError('');
    try {
      await api.put(`/regularization/requests/${request._id}/${action}`, { adminNote });
      onDone();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || `Failed to ${action}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-4">
      <div className="bg-[var(--fd-card-bg)] border border-white/[0.06] rounded-2xl w-full max-w-md p-6 space-y-5 shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-base font-semibold text-white">Review Request</h2>
            <p className="text-xs text-gray-500 mt-0.5">{request.userName} · {fmtDate(request.date)}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-xl leading-none">✕</button>
        </div>

        {/* Request details */}
        <div className="bg-surface rounded-2xl p-4 space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Type</span>
            <span className="text-gray-200 font-medium">{TYPE_LABEL[request.requestType] || request.requestType}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Employee</span>
            <span className="text-gray-200">{request.userName}</span>
          </div>
          {request.requestedCheckIn && (
            <div className="flex justify-between">
              <span className="text-gray-500">Req. Check-In</span>
              <span className="text-green-400">{fmt(request.requestedCheckIn)}</span>
            </div>
          )}
          {request.requestedCheckOut && (
            <div className="flex justify-between">
              <span className="text-gray-500">Req. Check-Out</span>
              <span className="text-red-400">{fmt(request.requestedCheckOut)}</span>
            </div>
          )}
          <div className="border-t border-white/[0.05] pt-3">
            <p className="text-gray-500 text-xs mb-1">Reason</p>
            <p className="text-gray-300">{request.reason}</p>
          </div>
          {request.snapshotBefore && (
            <div className="border-t border-white/[0.05] pt-3">
              <p className="text-gray-500 text-xs mb-2">Current Record (Before)</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="text-gray-600">Status</p>
                  <p className="text-gray-400 font-medium capitalize">{request.snapshotBefore.status || '—'}</p>
                </div>
                <div>
                  <p className="text-gray-600">Work Hours</p>
                  <p className="text-gray-400 font-medium">{request.snapshotBefore.workHours ?? '—'}h</p>
                </div>
                <div>
                  <p className="text-gray-600">Check-In</p>
                  <p className="text-gray-400">{fmt(request.snapshotBefore.checkInTime)}</p>
                </div>
                <div>
                  <p className="text-gray-600">Check-Out</p>
                  <p className="text-gray-400">{fmt(request.snapshotBefore.checkOutTime)}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Admin note */}
        <div>
          <label className="block text-xs text-gray-400 mb-1.5">Admin Note <span className="text-gray-600">(optional)</span></label>
          <textarea
            rows={2}
            value={adminNote}
            onChange={e => setAdminNote(e.target.value)}
            placeholder="Add a comment for the employee…"
            className="input w-full resize-none text-sm"
          />
        </div>

        {error && <p className="text-red-400 text-xs">{error}</p>}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={() => handle('reject')}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl border border-red-500/40 text-red-400 hover:bg-red-500/10 text-sm font-medium transition-all disabled:opacity-50"
          >
            Reject
          </button>
          <button
            onClick={() => handle('approve')}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-attbrand-500 hover:bg-attbrand-600 text-white text-sm font-medium transition-all disabled:opacity-50"
          >
            {loading ? 'Processing…' : 'Approve & Apply'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Delete Confirmation Modal ────────────────────────────────────────────────

function DeleteModal({ request, onClose, onDone }) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const handleDelete = async () => {
    setLoading(true); setError('');
    try {
      await api.delete(`/regularization/requests/${request._id}`);
      onDone(request._id);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-4">
      <div className="bg-[var(--fd-card-bg)] border border-white/[0.06] rounded-2xl w-full max-w-sm p-6 space-y-4 shadow-2xl">
        <div className="flex items-start justify-between">
          <h2 className="text-base font-semibold text-white">Delete Request?</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-xl leading-none">✕</button>
        </div>

        <div className="bg-surface rounded-xl p-3 text-sm space-y-1">
          <p className="text-gray-300 font-medium">{request.userName}</p>
          <p className="text-gray-500">{fmtDate(request.date)} · {TYPE_LABEL[request.requestType] || request.requestType}</p>
          <span className={`inline-block text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full mt-1 ${STATUS_STYLES[request.status]}`}>
            {request.status}
          </span>
        </div>

        <p className="text-xs text-gray-500">This permanently removes the request record. The attendance record itself is <span className="text-gray-300">not</span> affected.</p>

        {error && <p className="text-red-400 text-xs">{error}</p>}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl border border-surface-border text-gray-400 hover:text-gray-200 text-sm font-medium transition-all disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-400 text-sm font-medium transition-all disabled:opacity-50"
          >
            {loading ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Request Row ──────────────────────────────────────────────────────────────

function RequestRow({ req, onReview, onDelete }) {
  return (
    <div className="bg-[var(--fd-card-bg)] border border-white/[0.06] rounded-2xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-gray-200 truncate">{req.userName}</p>
            <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${STATUS_STYLES[req.status]}`}>
              {req.status}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">{req.userEmail}</p>
        </div>
        <div className="flex items-start gap-2 flex-shrink-0">
          <div className="text-right">
            <p className="text-xs text-gray-300 font-medium">{fmtDate(req.date)}</p>
            <p className="text-[11px] text-gray-500 mt-0.5">{TYPE_LABEL[req.requestType] || req.requestType}</p>
          </div>
          {/* Delete button — always visible to admin */}
          <button
            onClick={() => onDelete(req)}
            title="Delete request"
            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200 flex-shrink-0"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-3 flex-wrap">
        {req.requestedCheckIn  && <span className="text-xs text-green-400 bg-green-500/10 rounded-lg px-2 py-1">In: {fmt(req.requestedCheckIn)}</span>}
        {req.requestedCheckOut && <span className="text-xs text-red-400   bg-red-500/10   rounded-lg px-2 py-1">Out: {fmt(req.requestedCheckOut)}</span>}
      </div>

      <p className="text-xs text-gray-500 mt-2 line-clamp-1">{req.reason}</p>

      {req.status === 'pending' && (
        <button
          onClick={() => onReview(req)}
          className="mt-3 w-full text-xs font-medium text-attbrand-400 border border-attbrand-500/30 hover:bg-attbrand-500/10 rounded-xl py-2 transition-all duration-200"
        >
          Review Request →
        </button>
      )}

      {req.status !== 'pending' && req.adminNote && (
        <p className="mt-2 text-xs text-gray-600 italic">Note: {req.adminNote}</p>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminRegularizationRequests() {
  const [requests, setRequests]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [filterStatus, setFilter]   = useState('pending');
  const [reviewing, setReviewing]   = useState(null);
  const [deleting, setDeleting]     = useState(null);
  const [error, setError]           = useState('');

  const fetchRequests = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const params = filterStatus !== 'all' ? { status: filterStatus } : {};
      const { data } = await api.get('/regularization/requests', { params });
      setRequests(data.requests || []);
    } catch {
      setError('Failed to load requests');
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  // Remove deleted request from local state immediately (no refetch needed)
  const handleDeleted = (deletedId) => {
    setRequests(prev => prev.filter(r => r._id !== deletedId));
  };

  const pendingCount = requests.filter(r => r.status === 'pending').length;

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-display font-bold text-white flex items-center gap-2">
            Regularization Requests
            {pendingCount > 0 && filterStatus !== 'pending' && (
              <span className="text-xs bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 rounded-full px-2 py-0.5">
                {pendingCount} pending
              </span>
            )}
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">Review employee attendance correction requests</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-2xl px-4 py-3">{error}</div>
      )}

      {/* Filter bar */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {['pending', 'approved', 'rejected', 'all'].map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full border transition-all duration-200 capitalize
              ${filterStatus === s
                ? 'bg-attbrand-500/20 border-attbrand-500/50 text-attbrand-400'
                : 'border-surface-border text-gray-500 hover:text-gray-300'}`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center text-gray-500 py-16 text-sm">Loading…</div>
      ) : requests.length === 0 ? (
        <div className="text-center py-20 space-y-2">
          <div className="text-5xl">✅</div>
          <p className="text-gray-400 font-medium">No {filterStatus !== 'all' ? filterStatus : ''} requests</p>
          <p className="text-gray-600 text-sm">All caught up!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map(r => (
            <RequestRow key={r._id} req={r} onReview={setReviewing} onDelete={setDeleting} />
          ))}
        </div>
      )}

      {/* Review modal */}
      {reviewing && (
        <ReviewModal
          request={reviewing}
          onClose={() => setReviewing(null)}
          onDone={fetchRequests}
        />
      )}

      {/* Delete confirmation modal */}
      {deleting && (
        <DeleteModal
          request={deleting}
          onClose={() => setDeleting(null)}
          onDone={handleDeleted}
        />
      )}
    </div>
  );
}