import React, { useEffect, useState, useCallback } from 'react';
import {
  CheckCircle, XCircle, Eye, Clock, RefreshCw,
  IndianRupee, Calendar, FileImage, ChevronDown, ChevronUp,
} from 'lucide-react';
import api from '../../lib/api';
import { Button, Modal, Input, Textarea, Select, useToast } from '../../components/ui/index';
import { Badge, Spinner, EmptyState, Avatar } from '../../components/shared/LoadingScreen';
import { formatDate, formatCurrency } from '../../lib/utils';

const DURATION_LABELS = { '3_months': '3 Months', '6_months': '6 Months', '1_year': '1 Year' };
const STATUS_CONFIG = {
  pending:  { label: 'Pending Verification', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  verified: { label: 'Verified',             color: '#22c55e', bg: 'rgba(34,197,94,0.1)'  },
  rejected: { label: 'Rejected',             color: '#ef4444', bg: 'rgba(239,68,68,0.1)'  },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  return (
    <span
      className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
      style={{ background: cfg.bg, color: cfg.color }}
    >
      {cfg.label}
    </span>
  );
}

function PaymentRow({ payment, onAction }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="rounded-xl mb-3 overflow-hidden"
      style={{ background: 'var(--fd-surface)', border: '1px solid var(--fd-border)' }}
    >
      <div
        className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-[var(--fd-table-row-hover)] transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[13.5px] font-semibold" style={{ color: 'var(--fd-ink-1)' }}>
              {payment.client?.company || payment.client?.name}
            </span>
            <StatusBadge status={payment.status} />
          </div>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <span className="text-[12px] flex items-center gap-1" style={{ color: 'var(--fd-ink-3)' }}>
              <IndianRupee size={11} /> {formatCurrency(payment.amount)}
            </span>
            <span className="text-[12px] flex items-center gap-1" style={{ color: 'var(--fd-ink-3)' }}>
              <Calendar size={11} /> {formatDate(payment.paymentDate)}
            </span>
            {payment.transactionReference && (
              <span className="text-[12px]" style={{ color: 'var(--fd-ink-4)' }}>
                Ref: {payment.transactionReference}
              </span>
            )}
            <span className="text-[11px]" style={{ color: 'var(--fd-ink-4)' }}>
              Submitted {formatDate(payment.createdAt)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {payment.status === 'pending' && (
            <>
              <Button
                size="sm"
                variant="ghost"
                onClick={e => { e.stopPropagation(); onAction('approve', payment); }}
                style={{ color: '#22c55e', borderColor: 'rgba(34,197,94,0.3)' }}
              >
                <CheckCircle size={13} className="mr-1" /> Approve
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={e => { e.stopPropagation(); onAction('reject', payment); }}
                style={{ color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }}
              >
                <XCircle size={13} className="mr-1" /> Reject
              </Button>
            </>
          )}
          {expanded
            ? <ChevronUp size={15} style={{ color: 'var(--fd-ink-4)' }} />
            : <ChevronDown size={15} style={{ color: 'var(--fd-ink-4)' }} />}
        </div>
      </div>

      {expanded && (
        <div
          className="px-5 pb-4 pt-2 grid grid-cols-1 md:grid-cols-2 gap-4"
          style={{ borderTop: '1px solid var(--fd-border)' }}
        >
          <div>
            <p className="text-[11px] uppercase tracking-wide mb-2" style={{ color: 'var(--fd-ink-4)' }}>Details</p>
            <div className="space-y-1.5">
              <InfoRow label="Client"       value={payment.client?.company} />
              <InfoRow label="Submitted by" value={payment.submittedBy?.name} />
              <InfoRow label="Amount"       value={formatCurrency(payment.amount)} />
              <InfoRow label="Payment Date" value={formatDate(payment.paymentDate)} />
              {payment.transactionReference && <InfoRow label="Ref #"  value={payment.transactionReference} />}
              {payment.notes                 && <InfoRow label="Notes" value={payment.notes} />}
              {payment.status === 'rejected' && payment.rejectionReason && (
                <InfoRow label="Rejection Reason" value={payment.rejectionReason} danger />
              )}
              {payment.status === 'verified' && (
                <>
                  <InfoRow label="Verified by"  value={payment.verifiedBy?.name} />
                  <InfoRow label="Verified at"  value={formatDate(payment.verifiedAt)} />
                  <InfoRow label="Extension"    value={DURATION_LABELS[payment.extensionDuration]} />
                  <InfoRow label="New End Date" value={formatDate(payment.newContractEndDate)} />
                </>
              )}
            </div>
          </div>
          {payment.screenshotUrl && (
            <div>
              <p className="text-[11px] uppercase tracking-wide mb-2" style={{ color: 'var(--fd-ink-4)' }}>
                Payment Screenshot
              </p>
              <a href={payment.screenshotUrl} target="_blank" rel="noreferrer">
                <img
                  src={payment.screenshotUrl}
                  alt="Payment proof"
                  className="rounded-lg w-full max-w-xs object-cover"
                  style={{ border: '1px solid var(--fd-border)' }}
                />
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value, danger }) {
  return (
    <div className="flex gap-2">
      <span className="text-[12px] w-28 flex-shrink-0" style={{ color: 'var(--fd-ink-4)' }}>{label}</span>
      <span className="text-[12px] font-medium" style={{ color: danger ? '#ef4444' : 'var(--fd-ink-1)' }}>
        {value || '—'}
      </span>
    </div>
  );
}

export default function PaymentVerificationsPage() {
  const toast = useToast();
  const [payments, setPayments]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [statusFilter, setFilter]   = useState('pending');
  const [actionModal, setModal]     = useState(null); // { type: 'approve'|'reject', payment }
  const [rejReason, setRejReason]   = useState('');
  const [extDuration, setExtDur]    = useState('');
  const [useExisting, setUseExist]  = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/payments/verifications', {
        params: { status: statusFilter || undefined },
      });
      setPayments(data.payments || []);
    } catch {
      toast({ title: 'Failed to load verifications', type: 'error' });
    } finally { setLoading(false); }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const openApprove = (payment) => {
    const existing = payment.client?.planDuration || '3_months';
    setExtDur(existing);
    setUseExist(true);
    setModal({ type: 'approve', payment });
  };

  const openReject = (payment) => {
    setRejReason('');
    setModal({ type: 'reject', payment });
  };

  const handleAction = (type, payment) => {
    if (type === 'approve') openApprove(payment);
    else openReject(payment);
  };

  const submitApprove = async () => {
    const dur = useExisting ? actionModal.payment.client?.planDuration : extDuration;
    if (!dur) return toast({ title: 'Please select a duration', type: 'error' });
    setSubmitting(true);
    try {
      await api.put(`/payments/verifications/${actionModal.payment._id}/approve`, {
        extensionDuration: dur,
      });
      toast({ title: 'Payment approved & contract extended!', type: 'success' });
      setModal(null);
      load();
    } catch (e) {
      toast({ title: e.response?.data?.message || 'Failed to approve', type: 'error' });
    } finally { setSubmitting(false); }
  };

  const submitReject = async () => {
    if (!rejReason.trim()) return toast({ title: 'Please enter a rejection reason', type: 'error' });
    setSubmitting(true);
    try {
      await api.put(`/payments/verifications/${actionModal.payment._id}/reject`, {
        rejectionReason: rejReason,
      });
      toast({ title: 'Payment rejected', type: 'success' });
      setModal(null);
      load();
    } catch (e) {
      toast({ title: e.response?.data?.message || 'Failed to reject', type: 'error' });
    } finally { setSubmitting(false); }
  };

  const payment        = actionModal?.payment;
  const currentEndDate = payment?.client?.contractEndDate;
  const previewBase    = (currentEndDate && new Date(currentEndDate) > new Date())
    ? new Date(currentEndDate) : new Date();
  const durToAdd   = useExisting
    ? (payment?.client?.planDuration || '3_months')
    : (extDuration || '3_months');
  const previewEnd = addDuration(previewBase, durToAdd);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-bold" style={{ color: 'var(--fd-ink-1)' }}>
            Payment Verifications
          </h1>
          <p className="text-[13px] mt-0.5" style={{ color: 'var(--fd-ink-3)' }}>
            Review and approve client payment submissions
          </p>
        </div>
        <button onClick={load} className="btn-ghost p-2 rounded-lg" title="Refresh">
          <RefreshCw size={15} />
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-5">
        {[
          { value: 'pending',  label: 'Pending'  },
          { value: 'verified', label: 'Verified' },
          { value: 'rejected', label: 'Rejected' },
          { value: '',         label: 'All'      },
        ].map(tab => (
          <button
            key={tab.value}
            onClick={() => setFilter(tab.value)}
            className="px-3 py-1.5 rounded-lg text-[12.5px] font-medium transition-colors"
            style={{
              background: statusFilter === tab.value ? 'var(--fd-sidebar-active)' : 'var(--fd-surface)',
              color: statusFilter === tab.value ? 'var(--fd-sidebar-link-active)' : 'var(--fd-ink-3)',
              border: '1px solid var(--fd-border)',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : payments.length === 0 ? (
        <EmptyState
          icon={Clock}
          title="No payments found"
          description={statusFilter === 'pending'
            ? 'No pending verifications at the moment.'
            : 'No payments match this filter.'}
        />
      ) : (
        <div>
          {payments.map(p => (
            <PaymentRow key={p._id} payment={p} onAction={handleAction} />
          ))}
        </div>
      )}

      {/* Approve Modal */}
      <Modal
        isOpen={actionModal?.type === 'approve'}
        title="Approve Payment & Extend Contract"
        onClose={() => setModal(null)}
        size="md"
      >
        <div className="space-y-4">
          <div
            className="rounded-lg p-3"
            style={{ background: 'var(--fd-surface-sunken)', border: '1px solid var(--fd-border)' }}
          >
            <p className="text-[12px]" style={{ color: 'var(--fd-ink-3)' }}>Client</p>
            <p className="text-[14px] font-semibold" style={{ color: 'var(--fd-ink-1)' }}>
              {payment?.client?.company}
            </p>
            <p className="text-[12px] mt-1" style={{ color: 'var(--fd-ink-3)' }}>
              Amount: <strong>{formatCurrency(payment?.amount)}</strong> &nbsp;·&nbsp;
              Current plan: <strong>{DURATION_LABELS[payment?.client?.planDuration] || '—'}</strong>
            </p>
            {currentEndDate && (
              <p className="text-[12px] mt-0.5" style={{ color: 'var(--fd-ink-3)' }}>
                Current end date: <strong>{formatDate(currentEndDate)}</strong>
              </p>
            )}
          </div>

          <div>
            <p className="text-[13px] font-medium mb-2" style={{ color: 'var(--fd-ink-1)' }}>
              Contract Extension Duration
            </p>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" checked={useExisting} onChange={() => setUseExist(true)} />
                <span className="text-[13px]" style={{ color: 'var(--fd-ink-1)' }}>
                  Use current plan duration ({DURATION_LABELS[payment?.client?.planDuration] || '3 Months'})
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" checked={!useExisting} onChange={() => setUseExist(false)} />
                <span className="text-[13px]" style={{ color: 'var(--fd-ink-1)' }}>Select different duration</span>
              </label>
            </div>
            {!useExisting && (
              <div className="mt-3">
                <Select
                  value={extDuration}
                  onChange={e => setExtDur(e.target.value)}
                  options={[
                    { value: '3_months', label: '3 Months' },
                    { value: '6_months', label: '6 Months' },
                    { value: '1_year',   label: '1 Year'   },
                  ]}
                  placeholder="Select duration"
                />
              </div>
            )}
          </div>

          {/* Preview new end date */}
          <div
            className="rounded-lg p-3"
            style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}
          >
            <p className="text-[12px] font-medium mb-1" style={{ color: '#16a34a' }}>
              New Contract End Date
            </p>
            <p className="text-[16px] font-bold" style={{ color: '#16a34a' }}>
              {formatDate(previewEnd)}
            </p>
            <p className="text-[11px] mt-0.5" style={{ color: '#15803d' }}>
              Extended by {DURATION_LABELS[durToAdd]} from{' '}
              {currentEndDate && new Date(currentEndDate) > new Date() ? 'current end date' : 'today'}
            </p>
          </div>

          <div className="flex gap-2 justify-end pt-1">
            <Button variant="ghost" onClick={() => setModal(null)}>Cancel</Button>
            <Button
              onClick={submitApprove}
              disabled={submitting}
              style={{ background: '#22c55e', color: '#fff' }}
            >
              {submitting ? 'Approving…' : 'Approve & Extend Contract'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Reject Modal */}
      <Modal
        isOpen={actionModal?.type === 'reject'}
        title="Reject Payment"
        onClose={() => setModal(null)}
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-[13px]" style={{ color: 'var(--fd-ink-2)' }}>
            Rejecting payment from <strong>{payment?.client?.company}</strong> for{' '}
            <strong>{formatCurrency(payment?.amount)}</strong>. The client will be notified.
          </p>
          <Textarea
            label="Rejection Reason *"
            value={rejReason}
            onChange={e => setRejReason(e.target.value)}
            placeholder="Enter reason for rejection…"
            rows={3}
          />
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={() => setModal(null)}>Cancel</Button>
            <Button
              onClick={submitReject}
              disabled={submitting}
              style={{ background: '#ef4444', color: '#fff' }}
            >
              {submitting ? 'Rejecting…' : 'Reject Payment'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// Helper: compute new end date for preview
function addDuration(base, duration) {
  const d = new Date(base);
  if (duration === '3_months')     d.setMonth(d.getMonth() + 3);
  else if (duration === '6_months') d.setMonth(d.getMonth() + 6);
  else if (duration === '1_year')   d.setFullYear(d.getFullYear() + 1);
  return d;
}