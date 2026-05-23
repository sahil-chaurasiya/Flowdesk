import React, { useState, useEffect } from 'react';
import {
  Calendar, Clock, RefreshCw, ChevronDown, CheckCircle2, AlertTriangle,
} from 'lucide-react';
import api from '../../lib/api';
import { Button, Select, useToast } from '../../components/ui/index';
import { formatDate } from '../../lib/utils';
import useAuthStore from '../../context/authStore';

const DURATION_OPTIONS = [
  { value: '3_months', label: '3 Months' },
  { value: '6_months', label: '6 Months' },
  { value: '1_year',   label: '1 Year'   },
];
const DURATION_LABELS = { '3_months': '3 Months', '6_months': '6 Months', '1_year': '1 Year' };

function StatusBadge({ status, days }) {
  if (days === null) return null;
  let label = 'Active', color = '#22c55e', bg = 'rgba(34,197,94,0.1)';
  if (days < 0)   { label = 'Expired';        color = '#ef4444'; bg = 'rgba(239,68,68,0.1)'; }
  else if (days <= 3)  { label = 'Critical';  color = '#ef4444'; bg = 'rgba(239,68,68,0.1)'; }
  else if (days <= 7)  { label = 'Expiring';  color = '#f59e0b'; bg = 'rgba(245,158,11,0.1)'; }
  else if (days <= 14) { label = 'Expiring';  color = '#f59e0b'; bg = 'rgba(245,158,11,0.1)'; }
  else if (days <= 30) { label = 'Expiring Soon'; color = '#4f6ef0'; bg = 'rgba(79,110,240,0.1)'; }
  return (
    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
      style={{ background: bg, color }}>
      {label}
    </span>
  );
}

export default function ContractInfoSection({ client, onUpdate }) {
  const { user } = useAuthStore();
  const { showToast } = useToast();
  const isAdmin = ['admin', 'manager'].includes(user?.role);

  const [editing, setEditing]       = useState(false);
  const [planDur, setPlanDur]       = useState(client?.planDuration || '3_months');
  const [startDate, setStartDate]   = useState(
    client?.startDate ? client.startDate.slice(0, 10) : ''
  );
  const [saving, setSaving]         = useState(false);
  const [history, setHistory]       = useState([]);
  const [showHistory, setShowHist]  = useState(false);
  const [histLoading, setHistLoad]  = useState(false);

  const days = client?.contractEndDate
    ? Math.ceil((new Date(client.contractEndDate) - Date.now()) / 86400000)
    : null;

  const loadHistory = async () => {
    if (!client?._id) return;
    setHistLoad(true);
    try {
      const { data } = await api.get(`/payments/clients/${client._id}/renewal-history`);
      setHistory(data.history || []);
    } catch { /* silent */ }
    finally { setHistLoad(false); }
  };

  const toggleHistory = () => {
    if (!showHistory && history.length === 0) loadHistory();
    setShowHist(h => !h);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data } = await api.put(`/payments/clients/${client._id}/contract`, {
        planDuration: planDur,
        startDate,
      });
      showToast('Contract updated', 'success');
      setEditing(false);
      onUpdate?.(data.client);
    } catch (e) {
      showToast(e.response?.data?.message || 'Failed to update contract', 'error');
    } finally { setSaving(false); }
  };

  const preview = () => {
    if (!startDate || !planDur) return null;
    const d = new Date(startDate);
    if (planDur === '3_months') d.setMonth(d.getMonth() + 3);
    else if (planDur === '6_months') d.setMonth(d.getMonth() + 6);
    else d.setFullYear(d.getFullYear() + 1);
    return d;
  };

  return (
    <div className="rounded-xl"
      style={{ background: 'var(--fd-surface)', border: '1px solid var(--fd-border)' }}>
      <div className="px-5 py-4 flex items-center justify-between"
        style={{ borderBottom: '1px solid var(--fd-border)' }}>
        <div className="flex items-center gap-2">
          <h3 className="text-[13.5px] font-semibold" style={{ color: 'var(--fd-ink-1)' }}>
            Contract Information
          </h3>
          <StatusBadge days={days} />
        </div>
        {isAdmin && !editing && (
          <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
            <RefreshCw size={12} className="mr-1" /> Edit
          </Button>
        )}
      </div>

      <div className="p-5 space-y-4">
        {editing ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[12px] font-medium mb-1"
                  style={{ color: 'var(--fd-ink-2)' }}>
                  Plan Duration
                </label>
                <Select
                  value={planDur}
                  onChange={e => setPlanDur(e.target.value)}
                  options={DURATION_OPTIONS}
                />
              </div>
              <div>
                <label className="block text-[12px] font-medium mb-1"
                  style={{ color: 'var(--fd-ink-2)' }}>
                  Start Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="input-base w-full"
                  style={{
                    background: 'var(--fd-input-bg)',
                    border: '1px solid var(--fd-input-border)',
                    borderRadius: 8,
                    color: 'var(--fd-ink-1)',
                    padding: '6px 10px',
                    fontSize: 13,
                  }}
                />
              </div>
            </div>
            {preview() && (
              <p className="text-[12px]" style={{ color: 'var(--fd-ink-3)' }}>
                Contract will end: <strong>{formatDate(preview())}</strong>
              </p>
            )}
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleSave}
                disabled={saving}
                style={{ background: '#4f6ef0', color: '#fff' }}
              >
                {saving ? 'Saving…' : 'Save Contract'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Plan Duration', value: DURATION_LABELS[client?.planDuration] || '—' },
              { label: 'Start Date',    value: formatDate(client?.startDate) },
              { label: 'End Date',      value: formatDate(client?.contractEndDate) },
              { label: 'Days Remaining', value: days !== null ? (days < 0 ? 'Expired' : `${days} days`) : '—' },
            ].map(({ label, value }) => (
              <div key={label}
                className="rounded-lg p-3"
                style={{ background: 'var(--fd-surface-sunken)', border: '1px solid var(--fd-border)' }}>
                <p className="text-[10.5px] uppercase tracking-wide"
                  style={{ color: 'var(--fd-ink-4)' }}>{label}</p>
                <p className="text-[14px] font-semibold mt-0.5"
                  style={{ color: 'var(--fd-ink-1)' }}>{value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Renewal History toggle */}
        <div>
          <button
            onClick={toggleHistory}
            className="flex items-center gap-1.5 text-[12px] font-medium transition-opacity hover:opacity-70"
            style={{ color: 'var(--fd-sidebar-link-active)' }}
          >
            <ChevronDown
              size={13}
              className={`transition-transform ${showHistory ? 'rotate-180' : ''}`}
            />
            Renewal History {history.length > 0 ? `(${history.length})` : ''}
          </button>

          {showHistory && (
            <div className="mt-3 space-y-2">
              {histLoading ? (
                <p className="text-[12px]" style={{ color: 'var(--fd-ink-4)' }}>Loading…</p>
              ) : history.length === 0 ? (
                <p className="text-[12px]" style={{ color: 'var(--fd-ink-4)' }}>No renewals yet.</p>
              ) : history.map(r => (
                <div key={r._id}
                  className="flex items-start gap-2 px-3 py-2.5 rounded-lg"
                  style={{ background: 'var(--fd-surface-sunken)', border: '1px solid var(--fd-border)' }}>
                  <CheckCircle2 size={13} className="flex-shrink-0 mt-0.5" style={{ color: '#22c55e' }} />
                  <div>
                    <p className="text-[12.5px] font-medium" style={{ color: 'var(--fd-ink-1)' }}>
                      Extended by {DURATION_LABELS[r.duration]}
                      {r.paymentVerification?.amount && ` · ₹${r.paymentVerification.amount.toLocaleString('en-IN')}`}
                    </p>
                    <p className="text-[11.5px]" style={{ color: 'var(--fd-ink-4)' }}>
                      {formatDate(r.previousEndDate)} → {formatDate(r.newEndDate)}
                      {r.approvedBy && ` · ${r.approvedBy.name}`}
                      {' · '}{formatDate(r.approvedAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}