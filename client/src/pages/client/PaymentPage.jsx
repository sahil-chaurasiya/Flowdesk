import React, { useEffect, useState } from 'react';
import {
  IndianRupee, Calendar, Clock, CheckCircle2, XCircle,
  Upload, AlertTriangle, RefreshCw, Copy, QrCode,
} from 'lucide-react';
import api from '../../lib/api';
import { Button, Modal, Input, Textarea, useToast } from '../../components/ui/index';
import { Spinner, EmptyState } from '../../components/shared/LoadingScreen';
import { formatDate, formatCurrency } from '../../lib/utils';

const DURATION_LABELS = { '3_months': '3 Months', '6_months': '6 Months', '1_year': '1 Year' };

function ContractStatusBadge({ client }) {
  if (!client?.contractEndDate) return null;
  const days = Math.ceil((new Date(client.contractEndDate) - Date.now()) / 86400000);
  let color = '#22c55e', bg = 'rgba(34,197,94,0.1)', label = 'Active';
  if (days < 0)   { color = '#ef4444'; bg = 'rgba(239,68,68,0.1)';  label = 'Expired'; }
  else if (days <= 3)  { color = '#ef4444'; bg = 'rgba(239,68,68,0.1)';  label = `Critical — ${days}d left`; }
  else if (days <= 7)  { color = '#f59e0b'; bg = 'rgba(245,158,11,0.1)'; label = `Expiring — ${days}d left`; }
  else if (days <= 14) { color = '#f59e0b'; bg = 'rgba(245,158,11,0.1)'; label = `${days} days left`; }
  else if (days <= 30) { color = '#4f6ef0'; bg = 'rgba(79,110,240,0.1)'; label = `${days} days left`; }
  else                 { label = 'Active'; }
  return (
    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
      style={{ background: bg, color }}>
      {label}
    </span>
  );
}

function PaymentStatusBadge({ status }) {
  const cfg = {
    pending:  { label: 'Pending Verification', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
    verified: { label: 'Verified',             color: '#22c55e', bg: 'rgba(34,197,94,0.1)'  },
    rejected: { label: 'Rejected',             color: '#ef4444', bg: 'rgba(239,68,68,0.1)'  },
  }[status] || {};
  return (
    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
      style={{ background: cfg.bg, color: cfg.color }}>
      {cfg.label}
    </span>
  );
}

export default function PaymentPage() {
  const { showToast } = useToast();
  const [data, setData]          = useState(null);
  const [loading, setLoading]    = useState(true);
  const [showForm, setShowForm]  = useState(false);
  const [submitting, setSub]     = useState(false);
  const [copied, setCopied]      = useState('');

  // Form state
  const [amount, setAmount]       = useState('');
  const [payDate, setPayDate]     = useState(new Date().toISOString().split('T')[0]);
  const [ref, setRef]             = useState('');
  const [notes, setNotes]         = useState('');
  const [file, setFile]           = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data: d } = await api.get('/payments/my-payments');
      setData(d);
    } catch { showToast('Failed to load payment data', 'error'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const copyToClipboard = (text, key) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(''), 2000);
    });
  };

  const handleSubmit = async () => {
    if (!amount || !payDate) return showToast('Amount and payment date are required', 'error');
    setSub(true);
    try {
      const fd = new FormData();
      fd.append('amount', amount);
      fd.append('paymentDate', payDate);
      if (ref)   fd.append('transactionReference', ref);
      if (notes) fd.append('notes', notes);
      if (file)  fd.append('screenshot', file);

      await api.post('/payments/submit', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      showToast('Payment submitted for verification!', 'success');
      setShowForm(false);
      setAmount(''); setPayDate(new Date().toISOString().split('T')[0]); setRef(''); setNotes(''); setFile(null);
      load();
    } catch (e) {
      showToast(e.response?.data?.message || 'Submission failed', 'error');
    } finally { setSub(false); }
  };

  if (loading) return <div className="flex justify-center py-16"><Spinner /></div>;

  const { client, payments, settings, renewalHistory } = data || {};
  const hasPending = payments?.some(p => p.status === 'pending');
  const days = client?.contractEndDate
    ? Math.ceil((new Date(client.contractEndDate) - Date.now()) / 86400000)
    : null;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-bold" style={{ color: 'var(--fd-ink-1)' }}>Contract & Payment</h1>
          <p className="text-[13px] mt-0.5" style={{ color: 'var(--fd-ink-3)' }}>
            Manage your plan and submit payment proofs
          </p>
        </div>
        <button onClick={load} className="btn-ghost p-2 rounded-lg" title="Refresh">
          <RefreshCw size={15} />
        </button>
      </div>

      {/* Contract Info Card */}
      {client && (
        <div className="rounded-xl p-5 space-y-3"
          style={{ background: 'var(--fd-surface)', border: '1px solid var(--fd-border)' }}>
          <div className="flex items-center justify-between">
            <h2 className="text-[14px] font-semibold" style={{ color: 'var(--fd-ink-1)' }}>
              Contract Information
            </h2>
            <ContractStatusBadge client={client} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Plan Duration', value: DURATION_LABELS[client.planDuration] || '—' },
              { label: 'Start Date',   value: formatDate(client.startDate) },
              { label: 'End Date',     value: formatDate(client.contractEndDate) },
              { label: 'Days Remaining', value: days !== null ? (days < 0 ? 'Expired' : `${days} days`) : '—' },
            ].map(({ label, value }) => (
              <div key={label}
                className="rounded-lg p-3"
                style={{ background: 'var(--fd-surface-sunken)', border: '1px solid var(--fd-border)' }}>
                <p className="text-[10.5px] uppercase tracking-wide" style={{ color: 'var(--fd-ink-4)' }}>
                  {label}
                </p>
                <p className="text-[14px] font-semibold mt-0.5" style={{ color: 'var(--fd-ink-1)' }}>
                  {value}
                </p>
              </div>
            ))}
          </div>

          {/* Expiry warning banner */}
          {days !== null && days <= 30 && (
            <div className="rounded-lg p-3 flex items-start gap-2"
              style={{
                background: days < 0 ? 'rgba(239,68,68,0.08)' : days <= 7 ? 'rgba(245,158,11,0.08)' : 'rgba(79,110,240,0.08)',
                border: `1px solid ${days < 0 ? 'rgba(239,68,68,0.2)' : days <= 7 ? 'rgba(245,158,11,0.2)' : 'rgba(79,110,240,0.2)'}`,
              }}>
              <AlertTriangle size={14} className="flex-shrink-0 mt-0.5"
                style={{ color: days < 0 ? '#ef4444' : days <= 7 ? '#f59e0b' : '#4f6ef0' }} />
              <p className="text-[12.5px]"
                style={{ color: days < 0 ? '#ef4444' : days <= 7 ? '#92600a' : '#3a56d4' }}>
                {days < 0
                  ? `Your contract expired ${Math.abs(days)} days ago. Please submit payment to renew.`
                  : `Your contract expires in ${days} day${days === 1 ? '' : 's'}. Submit payment to avoid interruption.`}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Payment instructions */}
      {(settings?.upiId || settings?.accountNumber) && (
        <div className="rounded-xl p-5 space-y-4"
          style={{ background: 'var(--fd-surface)', border: '1px solid var(--fd-border)' }}>
          <h2 className="text-[14px] font-semibold" style={{ color: 'var(--fd-ink-1)' }}>
            Payment Instructions
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              {settings.upiId && (
                <CopyRow label="UPI ID" value={settings.upiId}
                  onCopy={() => copyToClipboard(settings.upiId, 'upi')}
                  copied={copied === 'upi'} />
              )}
              {settings.bankAccountName && (
                <CopyRow label="Account Name" value={settings.bankAccountName}
                  onCopy={() => copyToClipboard(settings.bankAccountName, 'name')}
                  copied={copied === 'name'} />
              )}
              {settings.accountNumber && (
                <CopyRow label="Account Number" value={settings.accountNumber}
                  onCopy={() => copyToClipboard(settings.accountNumber, 'acc')}
                  copied={copied === 'acc'} />
              )}
              {settings.ifscCode && (
                <CopyRow label="IFSC Code" value={settings.ifscCode}
                  onCopy={() => copyToClipboard(settings.ifscCode, 'ifsc')}
                  copied={copied === 'ifsc'} />
              )}
            </div>
            {settings.qrImageUrl && (
              <div className="flex flex-col items-center justify-center">
                <p className="text-[11px] uppercase tracking-wide mb-2"
                  style={{ color: 'var(--fd-ink-4)' }}>Scan to Pay</p>
                <img src={settings.qrImageUrl} alt="Payment QR"
                  className="w-36 h-36 rounded-lg object-contain"
                  style={{ border: '1px solid var(--fd-border)' }} />
              </div>
            )}
          </div>

          {!hasPending && (
            <Button
              onClick={() => setShowForm(true)}
              style={{ background: '#4f6ef0', color: '#fff' }}
            >
              <IndianRupee size={14} className="mr-1.5" />
              I Have Paid — Submit Proof
            </Button>
          )}
          {hasPending && (
            <p className="text-[12.5px] px-3 py-2 rounded-lg"
              style={{ background: 'rgba(245,158,11,0.08)', color: '#92600a', border: '1px solid rgba(245,158,11,0.2)' }}>
              You have a pending payment verification. Please wait for admin approval before submitting again.
            </p>
          )}
        </div>
      )}

      {/* Payment History */}
      {payments?.length > 0 && (
        <div className="rounded-xl p-5"
          style={{ background: 'var(--fd-surface)', border: '1px solid var(--fd-border)' }}>
          <h2 className="text-[14px] font-semibold mb-4" style={{ color: 'var(--fd-ink-1)' }}>
            Payment Submissions
          </h2>
          <div className="space-y-2">
            {payments.map(p => (
              <div key={p._id}
                className="flex items-center justify-between px-4 py-3 rounded-lg"
                style={{ background: 'var(--fd-surface-sunken)', border: '1px solid var(--fd-border)' }}>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-medium" style={{ color: 'var(--fd-ink-1)' }}>
                      {formatCurrency(p.amount)}
                    </span>
                    <PaymentStatusBadge status={p.status} />
                  </div>
                  <p className="text-[11.5px] mt-0.5" style={{ color: 'var(--fd-ink-4)' }}>
                    Submitted {formatDate(p.createdAt)}
                    {p.transactionReference && ` · Ref: ${p.transactionReference}`}
                  </p>
                  {p.status === 'rejected' && p.rejectionReason && (
                    <p className="text-[11.5px] mt-0.5" style={{ color: '#ef4444' }}>
                      Rejected: {p.rejectionReason}
                    </p>
                  )}
                  {p.status === 'verified' && p.newContractEndDate && (
                    <p className="text-[11.5px] mt-0.5" style={{ color: '#16a34a' }}>
                      Contract extended to {formatDate(p.newContractEndDate)}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Renewal History */}
      {renewalHistory?.length > 0 && (
        <div className="rounded-xl p-5"
          style={{ background: 'var(--fd-surface)', border: '1px solid var(--fd-border)' }}>
          <h2 className="text-[14px] font-semibold mb-4" style={{ color: 'var(--fd-ink-1)' }}>
            Renewal History
          </h2>
          <div className="space-y-2">
            {renewalHistory.map(r => (
              <div key={r._id}
                className="px-4 py-3 rounded-lg"
                style={{ background: 'var(--fd-surface-sunken)', border: '1px solid var(--fd-border)' }}>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={13} style={{ color: '#22c55e' }} />
                  <span className="text-[13px] font-medium" style={{ color: 'var(--fd-ink-1)' }}>
                    Extended by {DURATION_LABELS[r.duration]}
                  </span>
                </div>
                <p className="text-[11.5px] mt-0.5 ml-5" style={{ color: 'var(--fd-ink-4)' }}>
                  {formatDate(r.previousEndDate)} → {formatDate(r.newEndDate)}
                  {r.approvedBy && ` · Approved by ${r.approvedBy.name}`}
                  {' · '}{formatDate(r.approvedAt)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Submit Payment Modal */}
      <Modal isOpen={showForm} title="Submit Payment Proof" onClose={() => setShowForm(false)} size="md">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Amount (₹) *"
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="e.g. 15000"
              />
              <Input
                label="Payment Date *"
                type="date"
                value={payDate}
                onChange={e => setPayDate(e.target.value)}
              />
            </div>
            <Input
              label="Transaction Reference (optional)"
              value={ref}
              onChange={e => setRef(e.target.value)}
              placeholder="UPI / bank reference number"
            />
            <div>
              <label className="block text-[12px] font-medium mb-1"
                style={{ color: 'var(--fd-ink-2)' }}>
                Payment Screenshot (optional)
              </label>
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={e => setFile(e.target.files[0])}
                className="text-[12px]"
                style={{ color: 'var(--fd-ink-2)' }}
              />
            </div>
            <Textarea
              label="Notes (optional)"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Any additional information…"
              rows={2}
            />
            <div className="flex gap-2 justify-end pt-1">
              <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button
                onClick={handleSubmit}
                disabled={submitting}
                style={{ background: '#4f6ef0', color: '#fff' }}
              >
                {submitting ? 'Submitting…' : 'Submit for Verification'}
              </Button>
            </div>
          </div>
        </Modal>
    </div>
  );
}

function CopyRow({ label, value, onCopy, copied }) {
  return (
    <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg"
      style={{ background: 'var(--fd-surface-sunken)', border: '1px solid var(--fd-border)' }}>
      <div>
        <p className="text-[10.5px] uppercase tracking-wide" style={{ color: 'var(--fd-ink-4)' }}>{label}</p>
        <p className="text-[13px] font-medium" style={{ color: 'var(--fd-ink-1)' }}>{value}</p>
      </div>
      <button onClick={onCopy} className="btn-ghost p-1.5 rounded" title="Copy">
        {copied
          ? <CheckCircle2 size={13} style={{ color: '#22c55e' }} />
          : <Copy size={13} style={{ color: 'var(--fd-ink-4)' }} />}
      </button>
    </div>
  );
}