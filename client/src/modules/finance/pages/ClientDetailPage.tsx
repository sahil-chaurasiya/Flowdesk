import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { clientsApi, paymentsApi, invoicesApi, companySettingsApi } from '../services/api';
import { generateInvoicePdf, defaultCompany } from '../lib/invoicePdf';
import { CompanySettings } from '../types';
import { formatCurrency, formatDate, getStatusColor, MONTHS } from '../lib/utils';
import { ArrowLeft, Plus, Trash2, Pencil, X, CheckCircle2, AlertCircle, Clock, ChevronDown, ChevronUp, PauseCircle, PlayCircle, RotateCcw, IndianRupee, Download, Loader2 } from 'lucide-react';

// ─── Monthly Payment Modal ────────────────────────────────────────────────────
const MonthPaymentModal = ({
  clientId, contractValue, month, year, existing, onSave, onClose, valueLabel = 'Monthly', fixed = false, alreadyPaid = 0,
}: {
  clientId: string; contractValue: number; month: number; year: number;
  // Sum of the OTHER payments already recorded for this month (excludes the one being edited).
  alreadyPaid?: number;
  existing?: any; onSave: (d: any) => void; onClose: () => void;
  // Fixed-fee clients: "Project fee" / "Balance" instead of "Monthly".
  valueLabel?: string; fixed?: boolean;
}) => {
  const [form, setForm] = useState({
    amount: existing?.amount ?? (alreadyPaid > 0 && contractValue - alreadyPaid > 0 ? contractValue - alreadyPaid : ''),
    paymentDate: existing?.paymentDate
      ? existing.paymentDate.split('T')[0]
      : `${year}-${String(month).padStart(2, '0')}-01`,
    paymentMethod: existing?.paymentMethod ?? 'Bank Transfer',
    remarks: existing?.remarks ?? '',
  });
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));
  const amt = Number(form.amount);
  const balance = Math.max(0, contractValue - alreadyPaid);
  const isPartial = amt > 0 && alreadyPaid + amt < contractValue;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-start justify-between mb-1">
          <h2 className="text-lg font-bold">{existing ? 'Edit Payment' : alreadyPaid > 0 ? 'Add Payment' : 'Record Payment'}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <p className="text-sm text-gray-400 mb-4">{MONTHS[month - 1]} {year} · {valueLabel}: {formatCurrency(contractValue)}{alreadyPaid > 0 && ` · Already paid: ${formatCurrency(alreadyPaid)} · Remaining: ${formatCurrency(balance)}`}</p>

        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium text-gray-700">Amount Paid (₹) *</label>
            <input
              type="number"
              className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              value={form.amount}
              onChange={e => set('amount', e.target.value)}
              placeholder={String(balance || contractValue)}
            />
            {isPartial && (
              <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Partial — {formatCurrency(contractValue - alreadyPaid - amt)} still remaining
              </p>
            )}
            {alreadyPaid + amt >= contractValue && amt > 0 && (
              <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> {fixed ? 'Fully settled' : 'Full month paid'}
              </p>
            )}
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Payment Date *</label>
            <input
              type="date"
              className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              value={form.paymentDate}
              onChange={e => set('paymentDate', e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Method</label>
            <select className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" value={form.paymentMethod} onChange={e => set('paymentMethod', e.target.value)}>
              {['Bank Transfer', 'Cash', 'UPI', 'Cheque', 'Online'].map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Remarks</label>
            <input
              className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              value={form.remarks}
              onChange={e => set('remarks', e.target.value)}
              placeholder="e.g. Advance, partial, late fee..."
            />
          </div>
        </div>

        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 border rounded-lg py-2 text-sm font-medium hover:bg-gray-50">Cancel</button>
          <button
            onClick={() => onSave({
              clientId, month, year,
              amount: amt,
              paymentDate: form.paymentDate,
              paymentMethod: form.paymentMethod,
              remarks: form.remarks,
            })}
            disabled={!amt}
            className="flex-1 bg-primary text-white rounded-lg py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-40"
          >Save</button>
        </div>
      </div>
    </div>
  );
};

// ─── Mark Complete Modal ───────────────────────────────────────────────────────
const CompleteClientModal = ({ name, onSave, onClose }: { name: string; onSave: (endDate: string) => void; onClose: () => void }) => {
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <h2 className="text-lg font-bold mb-2">Mark {name} as Complete</h2>
        <p className="text-sm text-gray-500 mb-4">
          They'll stop being tracked and billed from the month after this date. Everything billed up to and including that month stays exactly as it is. If they come back later, add them as a new client.
        </p>
        <label className="text-sm font-medium text-gray-700">Contract End Date *</label>
        <input
          type="date"
          className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          value={endDate}
          onChange={e => setEndDate(e.target.value)}
        />
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 border rounded-lg py-2 text-sm font-medium hover:bg-gray-50">Cancel</button>
          <button onClick={() => onSave(endDate)} className="flex-1 bg-red-500 text-white rounded-lg py-2 text-sm font-medium hover:bg-red-600">Mark Complete</button>
        </div>
      </div>
    </div>
  );
};

// ─── Month Contract Value Modal ────────────────────────────────────────────────
const MonthValueModal = ({
  name, defaultValue, current, month, year, onSave, onReset, onClose,
}: {
  name: string; defaultValue: number; current: number; month: number; year: number;
  onSave: (value: number) => void; onReset: () => void; onClose: () => void;
}) => {
  const isOverridden = current !== defaultValue;
  const [value, setValue] = useState(String(current));
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <h2 className="text-lg font-bold mb-1">{name} — {MONTHS[month - 1]} {year}</h2>
        <p className="text-sm text-gray-500 mb-4">
          Change the contract value for just this one month. Every other month keeps using the normal {formatCurrency(defaultValue)}.
        </p>
        <label className="text-sm font-medium text-gray-700">Contract Value for {MONTHS[month - 1]} (₹) *</label>
        <input
          type="number"
          className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          value={value}
          onChange={e => setValue(e.target.value)}
        />
        {isOverridden && <p className="text-xs text-gray-400 mt-1">Normal monthly value: {formatCurrency(defaultValue)}</p>}
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 border rounded-lg py-2 text-sm font-medium hover:bg-gray-50">Cancel</button>
          {isOverridden && (
            <button onClick={onReset} className="flex-1 border border-amber-200 text-amber-600 rounded-lg py-2 text-sm font-medium hover:bg-amber-50">Reset to Default</button>
          )}
          <button onClick={() => onSave(Number(value))} className="flex-1 bg-primary text-white rounded-lg py-2 text-sm font-medium hover:bg-primary/90">Save</button>
        </div>
      </div>
    </div>
  );
};

// ─── Status pill ──────────────────────────────────────────────────────────────
const StatusPill = ({ status }: { status: string }) => {
  const cfg: Record<string, { cls: string; icon: React.ReactNode; label: string }> = {
    Paid:       { cls: 'bg-emerald-100 text-emerald-700', icon: <CheckCircle2 className="w-3 h-3" />, label: 'Paid' },
    Partial:    { cls: 'bg-amber-100 text-amber-700',    icon: <AlertCircle className="w-3 h-3" />,   label: 'Partial' },
    Unpaid:     { cls: 'bg-red-100 text-red-500',        icon: <Clock className="w-3 h-3" />,          label: 'Unpaid' },
    NotStarted: { cls: 'bg-gray-100 text-gray-400',      icon: <Clock className="w-3 h-3" />,          label: 'Not Started' },
    Upcoming:   { cls: 'bg-blue-100 text-blue-600',      icon: <Clock className="w-3 h-3" />,          label: 'Not Due Yet' },
    Paused:     { cls: 'bg-gray-200 text-gray-600',      icon: <PauseCircle className="w-3 h-3" />,    label: 'Paused' },
    Completed:  { cls: 'bg-slate-200 text-slate-600',    icon: <CheckCircle2 className="w-3 h-3" />,   label: 'Completed' },
    Covered:    { cls: 'bg-teal-100 text-teal-700',      icon: <CheckCircle2 className="w-3 h-3" />,   label: 'Covered' },
  };
  const c = cfg[status] ?? cfg['Unpaid'];
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium ${c.cls}`}>
      {c.icon} {c.label}
    </span>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [payModal, setPayModal] = useState<{
    month: number; year: number; existing?: any;
  } | null>(null);
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
  const [completeModal, setCompleteModal] = useState(false);
  const [valueModal, setValueModal] = useState<{ month: number; year: number; current: number } | null>(null);
  // "year-month" of the invoice currently being generated (drives the spinner / disables the other buttons)
  const [invoicingKey, setInvoicingKey] = useState<string | null>(null);

  const { data: client, isLoading } = useQuery({
    queryKey: ['client', id],
    queryFn: () => clientsApi.getOne(id!).then(r => r.data),
  });

  const { data: companyData } = useQuery<CompanySettings>({
    queryKey: ['company-settings'],
    queryFn: async () => { const r = await companySettingsApi.get(); return r.data; },
  });

  const createPayment = useMutation({
    mutationFn: (data: any) => paymentsApi.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['client', id] }); qc.invalidateQueries({ queryKey: ['payments-month'] }); setPayModal(null); },
  });
  const updatePayment = useMutation({
    mutationFn: ({ pid, data }: any) => paymentsApi.update(pid, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['client', id] }); qc.invalidateQueries({ queryKey: ['payments-month'] }); setPayModal(null); },
  });
  const deletePayment = useMutation({
    mutationFn: (pid: string) => paymentsApi.delete(pid),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['client', id] }); qc.invalidateQueries({ queryKey: ['payments-month'] }); },
  });
  const pauseClient = useMutation({
    mutationFn: () => clientsApi.pause(id!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['client', id] }),
  });
  const resumeClient = useMutation({
    mutationFn: () => clientsApi.resume(id!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['client', id] }),
  });
  const completeClient = useMutation({
    mutationFn: (endDate: string) => clientsApi.complete(id!, endDate),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['client', id] }); setCompleteModal(false); },
  });
  const reactivateClient = useMutation({
    mutationFn: () => clientsApi.reactivate(id!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['client', id] }),
  });
  const setMonthValue = useMutation({
    mutationFn: ({ month, year, value }: { month: number; year: number; value: number | null }) => clientsApi.setMonthValue(id!, month, year, value),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['client', id] }); setValueModal(null); },
  });

  const handleSavePayment = (data: any) => {
    if (payModal?.existing) updatePayment.mutate({ pid: payModal.existing._id, data });
    else createPayment.mutate(data);
  };

  // One-click monthly invoice: same design as the Invoice page, single "Digital Marketing"
  // line at this month's contract value. The invoice number is issued once per client+month
  // by the backend, so re-downloading gives the same number.
  const downloadInvoice = async (row: any) => {
    if (invoicingKey || !client) return;
    setInvoicingKey(`${row.year}-${row.month}`);
    try {
      // Fixed-fee clients are invoiced once, for the whole project fee.
      const fixedClient = client.billingType === 'fixed';
      const invoiceAmount = fixedClient ? client.contractValue : row.contractValue;
      const { data } = await invoicesApi.getMonthlyNumber(id!, row.month, row.year, invoiceAmount);
      await generateInvoicePdf({
        company: companyData || defaultCompany,
        billToName: client.name,
        invoiceNumber: data.invoiceNumber,
        invoiceDate: row.dueDate || new Date(row.year, row.month - 1, 1),
        lineItems: [{ name: fixedClient ? `Digital Marketing (${client.durationMonths} months)` : 'Digital Marketing', price: invoiceAmount, quantity: 1 }],
      });
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Could not generate the invoice. Please check your connection and try again.');
    } finally {
      setInvoicingKey(null);
    }
  };

  const toggleMonth = (key: string) => {
    setExpandedMonths(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  if (isLoading) return (
    <div className="animate-pulse space-y-4">
      <div className="h-8 bg-gray-200 rounded w-48" />
      <div className="grid sm:grid-cols-4 gap-4">{[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-gray-200 rounded-xl" />)}</div>
      <div className="h-96 bg-gray-200 rounded-xl" />
    </div>
  );
  if (!client) return <div className="text-center py-16 text-gray-400">Client not found</div>;

  const monthLedger: any[] = client.monthLedger ?? [];
  const paidMonths   = monthLedger.filter(m => m.status === 'Paid').length;
  const partialMonths = monthLedger.filter(m => m.status === 'Partial').length;
  const unpaidMonths = monthLedger.filter(m => m.status === 'Unpaid').length;
  const pausedMonths = monthLedger.filter(m => m.status === 'Paused').length;
  const coveredMonths = monthLedger.filter(m => m.status === 'Covered').length;
  const totalMonths  = monthLedger.length;
  const isFixedClient = client.billingType === 'fixed';
  const modalRow = payModal ? monthLedger.find(r => r.month === payModal.month && r.year === payModal.year) : null;
  const totalDue     = client.totalDue ?? totalMonths * client.contractValue;
  const overallPct   = totalDue > 0 ? Math.min(100, (client.receivedAmount / totalDue) * 100) : 0;

  return (
    <div className="space-y-5">
      {/* Back + Title */}
      <div className="flex items-center gap-3">
        <Link to="/admin/finance/clients" className="p-2 rounded-lg border hover:bg-gray-50 flex-shrink-0">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 truncate">{client.name}</h1>
          <p className="text-sm text-gray-400">Client since {formatDate(client.startDate)}{isFixedClient && ` · Fixed fee for ${client.durationMonths} months${client.serviceEndDate ? ` (until ${formatDate(client.serviceEndDate)})` : ''}`}{client.notes && ` · ${client.notes}`}</p>
        </div>
        {client.endDate ? (
          <button
            onClick={() => { if (confirm(`Reactivate ${client.name}? They'll go back to being tracked and billed normally.`)) reactivateClient.mutate(); }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition border-emerald-200 text-emerald-600 hover:bg-emerald-50"
          >
            <RotateCcw className="w-4 h-4" /> Reactivate
          </button>
        ) : (
          <>
            {!isFixedClient && (
              <button
                onClick={() => {
                  if (client.isActive === false) resumeClient.mutate();
                  else if (confirm(`Pause ${client.name}? Their monthly dues will stop accruing from today until you resume them. Everything billed so far stays exactly as it is.`)) pauseClient.mutate();
                }}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition ${client.isActive === false ? 'border-emerald-200 text-emerald-600 hover:bg-emerald-50' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
              >
                {client.isActive === false ? <><PlayCircle className="w-4 h-4" /> Resume</> : <><PauseCircle className="w-4 h-4" /> Pause</>}
              </button>
            )}
            <button
              onClick={() => setCompleteModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              <CheckCircle2 className="w-4 h-4" /> Mark Complete
            </button>
          </>
        )}
        <StatusPill status={client.status} />
      </div>

      {client.endDate && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl px-5 py-3 flex items-center gap-2 text-sm text-slate-600">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          Contract completed on {formatDate(client.endDate)} — no longer tracked or billed from the following month onward. If they come back, add them as a new client.
        </div>
      )}

      {!client.endDate && client.isActive === false && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl px-5 py-3 flex items-center gap-2 text-sm text-gray-600">
          <PauseCircle className="w-4 h-4 flex-shrink-0" />
          Currently paused — no new monthly dues are accruing. Resume to start billing again.
        </div>
      )}

      {(client.pauseHistory?.length ?? 0) > 0 && (
        <div className="bg-white rounded-xl border p-5">
          <h3 className="font-semibold text-gray-900 mb-3">Pause History</h3>
          <div className="space-y-2">
            {client.pauseHistory.map((p: any, i: number) => (
              <div key={i} className="flex items-center gap-2 text-sm text-gray-600">
                <PauseCircle className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                <span>{formatDate(p.pausedAt)}</span>
                <span className="text-gray-300">→</span>
                <span>{p.resumedAt ? formatDate(p.resumedAt) : 'ongoing'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-gray-400 uppercase mb-1">{isFixedClient ? 'Project Fee' : 'Monthly Value'}</p>
          <p className="text-xl font-bold text-gray-900">{formatCurrency(client.contractValue)}</p>
          <p className="text-xs text-gray-400 mt-1">{isFixedClient ? `one-time · covers ${client.durationMonths} months` : 'per month'}</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-gray-400 uppercase mb-1">Total Received</p>
          <p className="text-xl font-bold text-emerald-600">{formatCurrency(client.receivedAmount)}</p>
          <p className="text-xs text-gray-400 mt-1">{isFixedClient ? `across ${client.payments?.length ?? 0} payment${(client.payments?.length ?? 0) === 1 ? '' : 's'}` : `across ${totalMonths} months`}</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-gray-400 uppercase mb-1">Total Due</p>
          <p className="text-xl font-bold text-gray-900">{formatCurrency(totalDue)}</p>
          <p className="text-xs text-gray-400 mt-1">{isFixedClient ? 'one-time project fee' : `across ${totalMonths} billable months`}</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-gray-400 uppercase mb-1">Outstanding</p>
          <p className="text-xl font-bold text-red-500">{formatCurrency(Math.max(0, totalDue - client.receivedAmount))}</p>
          <p className="text-xs text-gray-400 mt-1">pending collection</p>
        </div>
      </div>

      {/* Month summary pills + progress */}
      <div className="bg-white rounded-xl border p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900">Collection Overview</h3>
          <span className="text-sm font-medium text-gray-500">{overallPct.toFixed(1)}% collected</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2.5 mb-4">
          <div className="bg-primary h-2.5 rounded-full transition-all" style={{ width: `${overallPct}%` }} />
        </div>
        <div className="flex gap-4 flex-wrap text-sm">
          <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /><span className="text-gray-500">Paid</span><span className="font-semibold">{paidMonths}</span></div>
          <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" /><span className="text-gray-500">Partial</span><span className="font-semibold">{partialMonths}</span></div>
          <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block" /><span className="text-gray-500">Unpaid</span><span className="font-semibold">{unpaidMonths}</span></div>
          {coveredMonths > 0 && (
            <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-teal-400 inline-block" /><span className="text-gray-500">Covered</span><span className="font-semibold">{coveredMonths}</span></div>
          )}
          {pausedMonths > 0 && (
            <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-gray-400 inline-block" /><span className="text-gray-500">Paused</span><span className="font-semibold">{pausedMonths}</span></div>
          )}
          <div className="flex items-center gap-2 ml-auto"><span className="text-gray-400">Total months:</span><span className="font-semibold">{totalMonths}</span></div>
        </div>
      </div>

      {/* Month-by-month ledger */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="font-semibold text-gray-900">Monthly Payment Ledger</h3>
          <p className="text-xs text-gray-400">Click a month to expand · Click + to record</p>
        </div>

        {monthLedger.length === 0 ? (
          <p className="text-center text-gray-400 text-sm py-12">No months to show yet</p>
        ) : (
          <div className="divide-y">
            {monthLedger.map((row: any) => {
              const key = `${row.year}-${row.month}`;
              const isExpanded = expandedMonths.has(key);
              const isCurrentMonth = (() => {
                const now = new Date();
                return row.month === now.getMonth() + 1 && row.year === now.getFullYear();
              })();

              return (
                <div key={key} className={isCurrentMonth ? 'bg-indigo-50/40' : ''}>
                  {/* Month row */}
                  <div
                    className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 cursor-pointer select-none"
                    onClick={() => toggleMonth(key)}
                  >
                    {/* Month label */}
                    <div className="w-32 flex-shrink-0">
                      <span className="font-medium text-sm text-gray-900">{MONTHS[row.month - 1]} {row.year}</span>
                      {isCurrentMonth && <span className="ml-2 text-xs text-primary font-semibold">← Current</span>}
                      {isFixedClient && row.position != null && (
                        <div className="text-[10px] text-violet-500">{row.position > row.total ? 'After service period' : `Month ${row.position} of ${row.total}`}</div>
                      )}
                    </div>

                    {/* Status */}
                    <div className="w-24 flex-shrink-0"><StatusPill status={row.status} /></div>

                    {/* Paid */}
                    <div className="flex-1">
                      {row.totalPaid > 0 ? (
                        <span className="text-sm font-semibold text-emerald-600">{formatCurrency(row.totalPaid)}</span>
                      ) : (
                        <span className="text-sm text-gray-300">—</span>
                      )}
                      {row.status === 'Partial' && (
                        <span className="text-xs text-gray-400 ml-2">of {formatCurrency(row.contractValue)}</span>
                      )}
                    </div>

                    {/* This month's contract value + edit */}
                    <div className="w-32 flex-shrink-0 flex items-center justify-end gap-1 text-xs text-gray-400">
                      {isFixedClient ? (
                        row.isBillingMonth ? (
                          <><span className="text-violet-500 font-semibold">fee</span><span>{formatCurrency(row.contractValue)}</span></>
                        ) : row.contractValue > 0 ? (
                          <><span className="text-gray-400">balance</span><span>{formatCurrency(row.contractValue)}</span></>
                        ) : (
                          <span className="text-teal-500 font-medium">covered</span>
                        )
                      ) : (
                        <>
                          {row.contractValue !== client.contractValue && <span className="text-amber-500 font-semibold">custom</span>}
                          <span>{formatCurrency(row.contractValue)}</span>
                          <button
                            onClick={e => { e.stopPropagation(); setValueModal({ month: row.month, year: row.year, current: row.contractValue }); }}
                            title="Set contract value for this month"
                            className="p-0.5 rounded hover:bg-gray-100 text-gray-400 hover:text-primary"
                          ><IndianRupee className="w-3 h-3" /></button>
                        </>
                      )}
                    </div>

                    {/* Remaining */}
                    <div className="w-28 text-right flex-shrink-0">
                      {row.remaining > 0 && (
                        <span className="text-sm text-red-400 font-medium">{formatCurrency(row.remaining)} due</span>
                      )}
                    </div>

                    {/* Record payment button */}
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        setPayModal({ month: row.month, year: row.year });
                      }}
                      className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                        row.totalPaid > 0
                          ? 'border-gray-200 text-gray-500 hover:bg-gray-50'
                          : 'border-primary text-primary hover:bg-primary/5'
                      }`}
                    >
                      + Record
                    </button>

                    {/* Download this month's invoice */}
                    <button
                      onClick={e => { e.stopPropagation(); downloadInvoice(row); }}
                      disabled={row.status === 'Paused' || invoicingKey !== null || (isFixedClient && !row.isBillingMonth)}
                      title={row.status === 'Paused'
                        ? 'Client was paused this month — nothing to invoice'
                        : (isFixedClient && !row.isBillingMonth)
                          ? 'Fixed-fee clients are invoiced once, in their first month'
                          : `Download ${MONTHS[row.month - 1]} ${row.year} invoice`}
                      className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {invoicingKey === key
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <Download className="w-3.5 h-3.5" />}
                      Invoice
                    </button>

                    {/* Expand toggle */}
                    <div className="flex-shrink-0 text-gray-400">
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </div>

                  {/* Expanded: payment entries for this month */}
                  {isExpanded && (
                    <div className="px-5 pb-4 bg-gray-50 border-t">
                      {row.payments.length === 0 ? (
                        <div className="py-4 text-center text-sm text-gray-400">
                          No payments recorded for {MONTHS[row.month - 1]} {row.year}
                          <button
                            onClick={() => setPayModal({ month: row.month, year: row.year })}
                            className="ml-3 text-primary font-medium hover:underline"
                          >Record now →</button>
                        </div>
                      ) : (
                        <div className="space-y-2 pt-3">
                          {row.payments.map((p: any) => (
                            <div key={p._id} className="flex items-center gap-3 bg-white rounded-lg border px-4 py-3">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-semibold text-emerald-600">{formatCurrency(p.amount)}</span>
                                  <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{p.paymentMethod}</span>
                                  {p.remarks && <span className="text-xs text-gray-400">· {p.remarks}</span>}
                                </div>
                                <p className="text-xs text-gray-400 mt-0.5">Paid on {formatDate(p.paymentDate)}</p>
                              </div>
                              <div className="flex gap-1 flex-shrink-0">
                                <button
                                  onClick={() => setPayModal({ month: row.month, year: row.year, existing: p })}
                                  className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400"
                                ><Pencil className="w-3.5 h-3.5" /></button>
                                <button
                                  onClick={() => { if (confirm('Delete this payment?')) deletePayment.mutate(p._id); }}
                                  className="p-1.5 hover:bg-red-50 rounded-lg text-red-400"
                                ><Trash2 className="w-3.5 h-3.5" /></button>
                              </div>
                            </div>
                          ))}
                          {/* Add another payment for this month — each one is kept as its own history entry */}
                          <button
                            onClick={() => setPayModal({ month: row.month, year: row.year })}
                            className="w-full py-2 border border-dashed border-primary/40 rounded-lg text-xs text-primary hover:bg-primary/5 flex items-center justify-center gap-1"
                          >
                            <Plus className="w-3.5 h-3.5" /> {row.remaining > 0 ? `Add payment (${formatCurrency(row.remaining)} remaining)` : 'Add another payment'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Payment Modal */}
      {payModal && (
        <MonthPaymentModal
          clientId={id!}
          contractValue={isFixedClient ? (modalRow?.contractValue ?? client.contractValue) : client.contractValue}
          valueLabel={isFixedClient ? (modalRow?.isBillingMonth ? 'Project fee' : 'Balance') : 'Monthly'}
          fixed={isFixedClient}
          month={payModal.month}
          year={payModal.year}
          existing={payModal.existing}
          alreadyPaid={Math.max(0, (modalRow?.totalPaid ?? 0) - (payModal.existing?.amount ?? 0))}
          onSave={handleSavePayment}
          onClose={() => setPayModal(null)}
        />
      )}
      {completeModal && (
        <CompleteClientModal
          name={client.name}
          onSave={(endDate) => completeClient.mutate(endDate)}
          onClose={() => setCompleteModal(false)}
        />
      )}
      {valueModal && (
        <MonthValueModal
          name={client.name}
          defaultValue={client.contractValue}
          current={valueModal.current}
          month={valueModal.month}
          year={valueModal.year}
          onSave={(value) => setMonthValue.mutate({ month: valueModal.month, year: valueModal.year, value })}
          onReset={() => setMonthValue.mutate({ month: valueModal.month, year: valueModal.year, value: null })}
          onClose={() => setValueModal(null)}
        />
      )}
    </div>
  );
}