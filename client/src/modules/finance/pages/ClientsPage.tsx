import { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { clientsApi, paymentsApi } from '../services/api';
import { Client, Payment } from '../types';
import { formatCurrency, formatDate, getCurrentMonthYear, MONTHS } from '../lib/utils';
import { Link } from 'react-router-dom';
import {
  Plus, Search, Pencil, Trash2, Eye, LayoutGrid, Table2,
  GripVertical, X, CreditCard, ChevronDown, IndianRupee, TrendingUp, AlertCircle, ArrowRight,
  Pause, Play, CheckCircle2, RotateCcw
} from 'lucide-react';

// Backend computes client status as 'Unpaid' | 'Partial' | 'Paid' | 'Upcoming' | 'Paused' | 'NotStarted' | 'Completed'.
// We display 'Unpaid' as "Pending" everywhere in the UI, but filter/compare using the real value.
const STATUS_OPTIONS = [
  { label: 'All', value: 'All' },
  { label: 'Pending', value: 'Unpaid' },
  { label: 'Partial', value: 'Partial' },
  { label: 'Paid', value: 'Paid' },
  { label: 'Upcoming', value: 'Upcoming' },
  { label: 'Covered', value: 'Covered' },
  { label: 'Paused', value: 'Paused' },
  { label: 'Completed', value: 'Completed' },
];
const WORK_STATUS_OPTIONS = ['', 'On Time', 'Delayed'];

// Small badge marking a freelance / fixed-fee client.
const FixedBadge = ({ months }: { months?: number }) => (
  <span className="inline-flex items-center text-[10px] font-medium text-violet-600 bg-violet-50 border border-violet-200 rounded px-1.5 py-0.5 whitespace-nowrap">
    Fixed{months ? ` · ${months} mo` : ''}
  </span>
);

// "Month 2 of 6 · ends 09 Dec 2026" for a fixed-fee client in the selected month.
const cycleText = (c: any) => {
  if (!c?.cycle) return '';
  const { position, total } = c.cycle;
  const ends = c.serviceEndDate ? formatDate(c.serviceEndDate) : '';
  if (position > total) return ends ? `Service ended ${ends}` : 'Service ended';
  return `Month ${position} of ${total}${ends ? ` · ends ${ends}` : ''}`;
};

// Start date + n months − 1 day (day clamped for shorter months) — last day of service.
const serviceEndFor = (startStr: string, months: number) => {
  const [y, m, d] = startStr.split('T')[0].split('-').map(Number);
  if (!y || !m || !d || !months) return null;
  const t = new Date(y, m - 1 + months, 1);
  const dim = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate();
  const end = new Date(t.getFullYear(), t.getMonth(), Math.min(d, dim));
  end.setDate(end.getDate() - 1);
  return end;
};

// ─── Client Form Modal ────────────────────────────────────────────────────────
const ClientForm = ({ initial, onSave, onClose }: { initial?: any; onSave: (f: any) => void; onClose: () => void }) => {
  const [form, setForm] = useState(
    initial
      ? { ...initial, billingType: initial.billingType || 'monthly', durationMonths: initial.durationMonths || '' }
      : { name: '', startDate: '', contractValue: '', notes: '', accountManager: '', workStatus: '', billingType: 'monthly', durationMonths: '' }
  );
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));
  const isFixed = form.billingType === 'fixed';
  const dur = Number(form.durationMonths);
  const fee = Number(form.contractValue);
  const serviceEnd = isFixed && form.startDate && dur > 0 ? serviceEndFor(form.startDate, dur) : null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-bold mb-4">{initial ? 'Edit Client' : 'Add Client'}</h2>
        <div className="space-y-3">
          <div><label className="text-sm font-medium text-gray-700">Client Name *</label><input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Company name" /></div>
          <div>
            <label className="text-sm font-medium text-gray-700">Billing Type *</label>
            <div className="mt-1 grid grid-cols-2 gap-1 bg-gray-100 rounded-lg p-1">
              <button type="button" onClick={() => set('billingType', 'monthly')} className={`py-2 rounded-md text-sm font-medium transition ${!isFixed ? 'bg-white shadow-sm text-primary' : 'text-gray-500 hover:text-gray-700'}`}>Monthly Retainer</button>
              <button type="button" onClick={() => set('billingType', 'fixed')} className={`py-2 rounded-md text-sm font-medium transition ${isFixed ? 'bg-white shadow-sm text-primary' : 'text-gray-500 hover:text-gray-700'}`}>Fixed Fee (one-time)</button>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              {isFixed
                ? 'Freelance / project client — pays one total amount that covers a set number of months.'
                : 'Pays the same amount every month for as long as the contract runs.'}
            </p>
          </div>
          <div><label className="text-sm font-medium text-gray-700">Start Date *</label><input type="date" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" value={form.startDate?.split('T')[0] || ''} onChange={e => set('startDate', e.target.value)} /></div>
          <div><label className="text-sm font-medium text-gray-700">{isFixed ? 'Total Project Fee (₹) *' : 'Monthly Contract Value (₹) *'}</label><input type="number" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" value={form.contractValue} onChange={e => set('contractValue', e.target.value)} placeholder={isFixed ? 'e.g. 60000' : 'e.g. 15000'} /></div>
          {isFixed && (
            <div>
              <label className="text-sm font-medium text-gray-700">Service Duration (months) *</label>
              <input type="number" min={1} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" value={form.durationMonths} onChange={e => set('durationMonths', e.target.value)} placeholder="e.g. 6" />
              <div className="flex gap-1.5 mt-2 flex-wrap">
                {[1, 2, 3, 4, 6, 12].map(n => (
                  <button key={n} type="button" onClick={() => set('durationMonths', n)} className={`px-2.5 py-1 rounded-md text-xs font-medium border transition ${dur === n ? 'bg-primary text-white border-primary' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>{n} mo</button>
                ))}
              </div>
              {fee > 0 && dur > 0 && (
                <div className="mt-2 bg-violet-50 border border-violet-100 rounded-lg px-3 py-2 text-xs text-violet-700 space-y-0.5">
                  <div>≈ <span className="font-semibold">{formatCurrency(Math.round(fee / dur))}</span> per month · billed once, can be paid in instalments</div>
                  {serviceEnd && <div>Service runs until <span className="font-semibold">{formatDate(serviceEnd)}</span></div>}
                </div>
              )}
            </div>
          )}
          <div><label className="text-sm font-medium text-gray-700">Account Manager</label><input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" value={form.accountManager} onChange={e => set('accountManager', e.target.value)} placeholder="Manager name" /></div>
          <div><label className="text-sm font-medium text-gray-700">Notes</label><textarea className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" rows={3} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Service details..." /></div>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 border rounded-lg py-2 text-sm font-medium hover:bg-gray-50">Cancel</button>
          <button onClick={() => onSave(form)} className="flex-1 bg-primary text-white rounded-lg py-2 text-sm font-medium hover:bg-primary/90">Save</button>
        </div>
      </div>
    </div>
  );
};

// ─── Mark Complete Modal ───────────────────────────────────────────────────────
const CompleteClientModal = ({ client, onSave, onClose }: { client: Client; onSave: (endDate: string) => void; onClose: () => void }) => {
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <h2 className="text-lg font-bold mb-2">Mark {client.name} as Complete</h2>
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
  client, month, year, onSave, onReset, onClose,
}: {
  client: Client; month: number; year: number;
  onSave: (value: number) => void; onReset: () => void; onClose: () => void;
}) => {
  const current = (client as any).monthContractValue ?? client.contractValue;
  const isOverridden = current !== client.contractValue;
  const [value, setValue] = useState(String(current));
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <h2 className="text-lg font-bold mb-1">{client.name} — {MONTHS[month - 1]} {year}</h2>
        <p className="text-sm text-gray-500 mb-4">
          Change the contract value for just this one month. Every other month keeps using the normal {formatCurrency(client.contractValue)}.
        </p>
        <label className="text-sm font-medium text-gray-700">Contract Value for {MONTHS[month - 1]} (₹) *</label>
        <input
          type="number"
          className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          value={value}
          onChange={e => setValue(e.target.value)}
        />
        {isOverridden && <p className="text-xs text-gray-400 mt-1">Normal monthly value: {formatCurrency(client.contractValue)}</p>}
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

// ─── Monthly Payment Modal ────────────────────────────────────────────────────
const MonthlyPaymentModal = ({
  client, month, year, existingPayment, onSave, onClose
}: {
  client: Client; month: number; year: number;
  existingPayment?: Payment | null;
  onSave: (data: any) => void; onClose: () => void;
}) => {
  const [form, setForm] = useState({
    amount: existingPayment?.amount ?? '',
    paymentDate: existingPayment?.paymentDate
      ? existingPayment.paymentDate.split('T')[0]
      : new Date().toISOString().split('T')[0],
    paymentMethod: existingPayment?.paymentMethod ?? 'Bank Transfer',
    remarks: existingPayment?.remarks ?? '',
  });
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));
  // Use this month's actual owed amount (respects any one-off override for
  // month/year), not the client's flat default.
  const cv = client.monthContractValue ?? client.contractValue;
  // Fixed-fee clients: the first month shows the full fee, later months show what's still owed.
  const contractLabel = client.billingType !== 'fixed'
    ? 'Monthly contract'
    : (cv === client.contractValue ? 'Fixed project fee' : 'Balance outstanding');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold">{existingPayment ? 'Edit Payment' : 'Record Payment'}</h2>
            <p className="text-sm text-gray-500">{client.name} — {MONTHS[month - 1]} {year}</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X className="w-4 h-4" /></button>
        </div>
        <div className="bg-gray-50 rounded-lg p-3 mb-4 text-sm">
          <span className="text-gray-500">{contractLabel}: </span>
          <span className="font-semibold">{formatCurrency(cv)}</span>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium text-gray-700">Amount Paid (₹) *</label>
            <input type="number" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" value={form.amount} onChange={e => set('amount', e.target.value)} placeholder={String(cv)} />
            {Number(form.amount) < cv && Number(form.amount) > 0 && (
              <p className="text-xs text-amber-600 mt-1">Partial — ₹{(cv - Number(form.amount)).toLocaleString('en-IN')} remaining</p>
            )}
          </div>
          <div><label className="text-sm font-medium text-gray-700">Payment Date *</label><input type="date" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" value={form.paymentDate} onChange={e => set('paymentDate', e.target.value)} /></div>
          <div>
            <label className="text-sm font-medium text-gray-700">Method</label>
            <select className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" value={form.paymentMethod} onChange={e => set('paymentMethod', e.target.value)}>
              {['Bank Transfer', 'Cash', 'UPI', 'Cheque', 'Online'].map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div><label className="text-sm font-medium text-gray-700">Remarks</label><input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" value={form.remarks} onChange={e => set('remarks', e.target.value)} placeholder="Optional note" /></div>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 border rounded-lg py-2 text-sm font-medium hover:bg-gray-50">Cancel</button>
          <button
            onClick={() => onSave({ clientId: client._id, month, year, amount: Number(form.amount), paymentDate: form.paymentDate, paymentMethod: form.paymentMethod, remarks: form.remarks })}
            className="flex-1 bg-primary text-white rounded-lg py-2 text-sm font-medium hover:bg-primary/90"
          >Save Payment</button>
        </div>
      </div>
    </div>
  );
};

// ─── Month Status Dropdown ────────────────────────────────────────────────────
const STATUS_CFG = {
  Unpaid:     { dot: 'bg-red-400',     text: 'text-red-500',     bg: 'bg-red-50',     border: 'border-red-200',     label: 'Pending'     },
  Partial:    { dot: 'bg-amber-400',   text: 'text-amber-600',   bg: 'bg-amber-50',   border: 'border-amber-200',   label: 'Partial'     },
  Paid:       { dot: 'bg-emerald-400', text: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', label: 'Paid'        },
  NotStarted: { dot: 'bg-gray-300',    text: 'text-gray-400',    bg: 'bg-gray-50',    border: 'border-gray-200',    label: 'Not Started' },
  Upcoming:   { dot: 'bg-blue-300',    text: 'text-blue-500',    bg: 'bg-blue-50',    border: 'border-blue-200',    label: 'Not Due Yet' },
  Paused:     { dot: 'bg-gray-400',    text: 'text-gray-500',    bg: 'bg-gray-100',   border: 'border-gray-300',    label: 'Paused'      },
  Completed:  { dot: 'bg-slate-400',   text: 'text-slate-500',   bg: 'bg-slate-100',  border: 'border-slate-300',   label: 'Completed'   },
  Covered:    { dot: 'bg-teal-400',    text: 'text-teal-600',    bg: 'bg-teal-50',    border: 'border-teal-200',    label: 'Covered'     },
};

// The statuses where there's genuinely no month to record a payment against:
// "contract hasn't started yet" and "contract has ended" (nothing owed for
// either). "Not Due Yet" and "Paused" still need to be clickable — someone
// can always pay early, or catch up while paused.
const NON_EDITABLE_STATUSES = new Set(['NotStarted', 'Completed']);

const MonthStatusDropdown = ({ status, onSelect }: { status: string; onSelect: (s: string) => void }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const cfg = STATUS_CFG[status as keyof typeof STATUS_CFG] ?? STATUS_CFG.Unpaid;

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  // Contract hadn't started yet — no month exists to record anything against,
  // so just show a plain badge. Every other status stays clickable.
  if (NON_EDITABLE_STATUSES.has(status)) {
    return (
      <span className={`inline-flex items-center gap-1.5 pl-2 pr-2 py-1 rounded-md border text-xs font-medium ${cfg.bg} ${cfg.border} ${cfg.text}`}>
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
        {cfg.label}
      </span>
    );
  }

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => setOpen(o => !o)}
        className={`inline-flex items-center gap-1.5 pl-2 pr-2 py-1 rounded-md border text-xs font-medium transition-colors hover:brightness-95 ${cfg.bg} ${cfg.border} ${cfg.text}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
        {cfg.label}
        <ChevronDown className={`w-3 h-3 opacity-60 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-40 top-full mt-1 left-0 bg-white rounded-lg shadow-lg border border-gray-100 py-1 min-w-[110px]">
          {(['Unpaid', 'Partial', 'Paid'] as const).map(opt => {
            const c = STATUS_CFG[opt];
            const isActive = opt === status;
            return (
              <button
                key={opt}
                onClick={() => { setOpen(false); if (!isActive) onSelect(opt); }}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs font-medium transition-colors ${isActive ? 'opacity-40 cursor-default' : 'hover:bg-gray-50'}`}
              >
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${c.dot}`} />
                <span className={c.text}>{c.label}</span>
                {isActive && <span className="ml-auto text-gray-300">✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ─── Draggable Hook ───────────────────────────────────────────────────────────
function useDragOrder<T extends { _id: string }>(items: T[], onReorder?: (orderedIds: string[]) => void) {
  const [order, setOrder] = useState<string[]>([]);
  const dragId = useRef<string | null>(null);
  const dragOverId = useRef<string | null>(null);

  const orderedItems = (() => {
    if (order.length === 0) return items;
    const map = new Map(items.map(i => [i._id, i]));
    const result: T[] = [];
    order.forEach(id => { const it = map.get(id); if (it) result.push(it); });
    items.forEach(it => { if (!order.includes(it._id)) result.push(it); });
    return result;
  })();

  const syncOrder = useCallback((newItems: T[]) => {
    setOrder(prev => {
      if (prev.length === 0) return prev;
      const existing = new Set(newItems.map(i => i._id));
      const filtered = prev.filter(id => existing.has(id));
      newItems.forEach(i => { if (!filtered.includes(i._id)) filtered.push(i._id); });
      return filtered;
    });
  }, []);

  const onDragStart = (id: string) => { dragId.current = id; };
  const onDragOver = (e: React.DragEvent, id: string) => { e.preventDefault(); dragOverId.current = id; };
  const onDrop = () => {
    if (!dragId.current || !dragOverId.current || dragId.current === dragOverId.current) return;
    const base = order.length > 0 ? order : orderedItems.map(i => i._id);
    const next = [...base];
    const fromIdx = next.indexOf(dragId.current);
    const toIdx = next.indexOf(dragOverId.current);
    dragId.current = null;
    dragOverId.current = null;
    if (fromIdx === -1 || toIdx === -1) return;
    next.splice(fromIdx, 1);
    next.splice(toIdx, 0, base[fromIdx]);
    setOrder(next);
    onReorder?.(next);
  };

  return { orderedItems, syncOrder, onDragStart, onDragOver, onDrop };
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ClientsPage() {
  const qc = useQueryClient();
  const now = getCurrentMonthYear();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [selMonth, setSelMonth] = useState(now.month);
  const [selYear, setSelYear] = useState(now.year);
  const [view, setView] = useState<'grid' | 'table'>('table');
  const [clientModal, setClientModal] = useState<null | 'add' | Client>(null);
  const [payModal, setPayModal] = useState<null | { client: Client; existingPayment: Payment | null }>(null);
  const [completeModal, setCompleteModal] = useState<null | Client>(null);
  const [valueModal, setValueModal] = useState<null | Client>(null);

  const { data: rawClients = [], isLoading } = useQuery<Client[]>({
    queryKey: ['clients', search, statusFilter, selMonth, selYear],
    queryFn: () => clientsApi.getAll({
      search,
      status: statusFilter !== 'All' ? statusFilter : undefined,
      month: selMonth,
      year: selYear,
    }).then(r => r.data),
  });

  // Persist the dropped order to the backend so it survives a refresh.
  // The clients list itself is already returned sorted by that saved order
  // (see backend getClients), so no extra client-side sorting is needed —
  // this mutation is what makes the drag actually "stick".
  const reorderClients = useMutation({
    mutationFn: (order: string[]) => clientsApi.reorder(order),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clients'] }),
  });

  const { orderedItems: clients, syncOrder, onDragStart, onDragOver, onDrop } = useDragOrder(
    rawClients,
    (orderedIds) => reorderClients.mutate(orderedIds)
  );
  useState(() => { syncOrder(rawClients); });

  const createClient = useMutation({ mutationFn: (d: any) => clientsApi.create(d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['clients'] }); setClientModal(null); } });
  const updateClient = useMutation({ mutationFn: ({ id, data }: any) => clientsApi.update(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['clients'] }); setClientModal(null); } });
  const deleteClient = useMutation({ mutationFn: (id: string) => clientsApi.delete(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['clients'] }) });
  const pauseClient = useMutation({ mutationFn: (id: string) => clientsApi.pause(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['clients'] }) });
  const resumeClient = useMutation({ mutationFn: (id: string) => clientsApi.resume(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['clients'] }) });
  const completeClient = useMutation({ mutationFn: ({ id, endDate }: { id: string; endDate: string }) => clientsApi.complete(id, endDate), onSuccess: () => { qc.invalidateQueries({ queryKey: ['clients'] }); setCompleteModal(null); } });
  const reactivateClient = useMutation({ mutationFn: (id: string) => clientsApi.reactivate(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['clients'] }) });
  const setMonthValue = useMutation({
    mutationFn: ({ id, value }: { id: string; value: number | null }) => clientsApi.setMonthValue(id, selMonth, selYear, value),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['clients'] }); setValueModal(null); },
  });
  const createPayment = useMutation({ mutationFn: (d: any) => paymentsApi.create(d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['clients'] }); setPayModal(null); } });
  const updatePayment = useMutation({ mutationFn: ({ id, d }: any) => paymentsApi.update(id, d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['clients'] }); setPayModal(null); } });

  const handleSaveClient = (form: any) => {
    const isFixed = form.billingType === 'fixed';
    if (isFixed && !(Number(form.durationMonths) >= 1)) {
      alert('Enter how many months the fixed fee covers (at least 1).');
      return;
    }
    const data = { ...form, contractValue: Number(form.contractValue), billingType: form.billingType || 'monthly', durationMonths: isFixed ? Number(form.durationMonths) : 0 };
    if (clientModal && typeof clientModal === 'object') updateClient.mutate({ id: (clientModal as Client)._id, data });
    else createClient.mutate(data);
  };

  const handleSavePayment = (data: any) => {
    const existing = payModal?.existingPayment;
    if (existing) updatePayment.mutate({ id: existing._id, d: data });
    else createPayment.mutate(data);
  };

  const handleMonthStatusSelect = (client: Client, newStatus: string) => {
    const payment = (client as any).selPayment ?? null;
    if (newStatus === 'Paid' || newStatus === 'Partial') {
      setPayModal({ client, existingPayment: payment });
    }
  };

  const handleWorkStatusChange = (client: Client, newStatus: string) => {
    updateClient.mutate({ id: client._id, data: { workStatus: newStatus } });
  };

  const handleTogglePause = (client: any) => {
    if (client.isActive === false) {
      resumeClient.mutate(client._id);
    } else if (confirm(`Pause ${client.name}? Their monthly dues will stop accruing from today until you resume them. Everything billed so far stays exactly as it is.`)) {
      pauseClient.mutate(client._id);
    }
  };

  const handleSaveComplete = (endDate: string) => {
    if (completeModal) completeClient.mutate({ id: completeModal._id, endDate });
  };

  const handleReactivate = (client: any) => {
    if (confirm(`Reactivate ${client.name}? They'll go back to being tracked and billed normally.`)) {
      reactivateClient.mutate(client._id);
    }
  };

  const handleSaveMonthValue = (client: Client, value: number) => {
    setMonthValue.mutate({ id: client._id, value });
  };

  const handleResetMonthValue = (client: Client) => {
    setMonthValue.mutate({ id: client._id, value: null });
  };

  const years = Array.from({ length: 4 }, (_, i) => now.year - i);

  const kpis = rawClients.reduce((acc: any, c: any) => {
    const start = c.startDate ? new Date(c.startDate) : null;
    const startedBySelMonth = !start || start.getFullYear() < selYear ||
      (start.getFullYear() === selYear && start.getMonth() + 1 <= selMonth);
    if (startedBySelMonth) {
      const monthValue = c.monthContractValue ?? c.contractValue ?? 0;
      // Paused or Completed clients have no obligation for this month, so
      // they shouldn't count toward this month's Total Revenue, Collected,
      // or Pending at all.
      if (c.status !== 'Paused' && c.status !== 'Completed') {
        const paid = c.selPaid || 0;
        acc.totalContractValue += monthValue;
        acc.totalCollected += paid;
        // Deliberately NOT using c.selRemaining here — the backend zeroes
        // that out for "Upcoming" (not-yet-due) clients, since it's meant
        // to drive the per-row "overdue" badge, not this total. Money that's
        // owed but simply isn't due yet is still pending, not collected —
        // otherwise it silently falls out of Revenue = Collected + Pending.
        acc.totalPending += Math.max(0, monthValue - paid);
      }
    }
    return acc;
  }, { totalContractValue: 0, totalCollected: 0, totalPending: 0 });

  // ── Card View ───────────────────────────────────────────────────────────────
  const CardView = () => (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {clients.map((client: any) => {
        const mStatus   = client.status;
        const paid      = client.selPaid ?? 0;
        const monthValue = client.monthContractValue ?? client.contractValue;
        const remaining = client.selRemaining ?? monthValue;
        const payment   = client.selPayment ?? null;
        const totalReceived = client.receivedAmount ?? 0;
        const pct = client.totalDue > 0 ? Math.min(100, (totalReceived / client.totalDue) * 100) : 0;
        return (
          <div
            key={client._id}
            draggable
            onDragStart={() => onDragStart(client._id)}
            onDragOver={e => onDragOver(e, client._id)}
            onDrop={onDrop}
            className={`bg-white rounded-xl border p-5 hover:shadow-md transition cursor-grab active:cursor-grabbing select-none ${client.isActive === false || client.endDate ? 'opacity-60' : ''}`}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-start gap-2">
                <GripVertical className="w-4 h-4 text-gray-300 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-semibold text-gray-900">{client.name}</h3>
                    {client.billingType === 'fixed' && <FixedBadge months={client.durationMonths} />}
                    {client.endDate ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-500 bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5"><CheckCircle2 className="w-2.5 h-2.5" /> Completed</span>
                    ) : client.isActive === false && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-gray-500 bg-gray-100 border border-gray-200 rounded px-1.5 py-0.5"><Pause className="w-2.5 h-2.5" /> Paused</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">Since {formatDate(client.startDate)}</p>
                  {client.billingType === 'fixed' && cycleText(client) && <p className="text-xs text-violet-500 mt-0.5">{cycleText(client)}</p>}
                  {client.accountManager && <p className="text-xs text-gray-500 mt-0.5">👤 {client.accountManager}</p>}
                </div>
              </div>
              <MonthStatusDropdown status={mStatus} onSelect={s => handleMonthStatusSelect(client, s)} />
            </div>

            <div className="space-y-1.5 mb-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500">{client.billingType === 'fixed' ? 'Fixed fee' : 'Monthly'} {client.billingType !== 'fixed' && monthValue !== client.contractValue && <span className="text-amber-500 font-medium">(custom)</span>}</span>
                <span className="flex items-center gap-1.5">
                  <span className="font-medium">{formatCurrency(client.billingType === 'fixed' ? client.contractValue : monthValue)}</span>
                  {client.billingType === 'fixed' && <span className="text-xs text-gray-400">· one-time</span>}
                  {!client.endDate && client.billingType !== 'fixed' && (
                    <button onClick={() => setValueModal(client)} title="Set this month's contract value" className="p-0.5 rounded hover:bg-gray-100 text-gray-400 hover:text-primary"><IndianRupee className="w-3 h-3" /></button>
                  )}
                </span>
              </div>
              <div className="flex justify-between text-sm"><span className="text-gray-500">All-time Received</span><span className="font-medium text-emerald-600">{formatCurrency(totalReceived)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-500">Outstanding</span><span className="font-medium text-red-500">{formatCurrency(client.pendingAmount ?? 0)}</span></div>
            </div>

            <div className="w-full bg-gray-100 rounded-full h-1.5 mb-3">
              <div className="bg-primary h-1.5 rounded-full" style={{ width: `${pct}%` }} />
            </div>

            {/* Work Status */}
            <div className="mb-3">
              <label className="text-xs text-gray-400 font-medium block mb-1">Work Status</label>
              <select
                className="w-full text-xs border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary bg-white"
                value={client.workStatus || ''}
                onChange={e => handleWorkStatusChange(client, e.target.value)}
              >
                {WORK_STATUS_OPTIONS.map(o => <option key={o} value={o}>{o || '— Select —'}</option>)}
              </select>
            </div>

            <div className="border rounded-lg p-3 mb-3 bg-gray-50">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-gray-600">{MONTHS[selMonth - 1]} {selYear}</span>
                {mStatus === 'Paid' && <span className="text-xs text-emerald-600 font-medium">✓ {formatCurrency(paid)}</span>}
                {mStatus === 'Partial' && <span className="text-xs text-amber-600 font-medium">⚡ {formatCurrency(paid)} / {formatCurrency(monthValue)}</span>}
                {mStatus === 'Unpaid' && <span className="text-xs text-red-500 font-medium">✗ Unpaid</span>}
                {mStatus === 'NotStarted' && <span className="text-xs text-gray-400 font-medium">Contract not started yet</span>}
                {mStatus === 'Upcoming' && <span className="text-xs text-blue-500 font-medium">Due {client.dueDate ? formatDate(client.dueDate) : 'later this month'}</span>}
                {mStatus === 'Paused' && <span className="text-xs text-gray-500 font-medium">⏸ Paused — not billed</span>}
                {mStatus === 'Covered' && <span className="text-xs text-teal-600 font-medium">✓ Covered by project fee</span>}
              </div>
              {mStatus === 'Partial' && <p className="text-xs text-gray-400">Remaining: {formatCurrency(remaining)}</p>}
              {payment && <p className="text-xs text-gray-400 mt-0.5">Paid on {formatDate(payment.paymentDate)} · {payment.paymentMethod}</p>}
              {!NON_EDITABLE_STATUSES.has(mStatus) && (
                <button
                  onClick={() => setPayModal({ client, existingPayment: payment })}
                  className="mt-2 w-full text-xs border border-primary/30 text-primary rounded-lg py-1.5 hover:bg-primary/5 font-medium"
                >
                  {payment ? '✎ Edit Payment' : '+ Record Payment'}
                </button>
              )}
            </div>

            <div className="flex gap-2">
              <Link to={`/admin/finance/clients/${client._id}`} className="flex-1 flex items-center justify-center gap-1 border rounded-lg py-1.5 text-xs font-medium hover:bg-gray-50"><Eye className="w-3 h-3" /> View</Link>
              <button onClick={() => setClientModal(client)} className="flex-1 flex items-center justify-center gap-1 border rounded-lg py-1.5 text-xs font-medium hover:bg-gray-50"><Pencil className="w-3 h-3" /> Edit</button>
              {client.endDate ? (
                <button
                  onClick={() => handleReactivate(client)}
                  title="Reactivate client"
                  className="flex items-center justify-center px-3 border border-emerald-200 text-emerald-600 rounded-lg py-1.5 text-xs hover:bg-emerald-50"
                ><RotateCcw className="w-3 h-3" /></button>
              ) : (
                <>
                  {client.billingType !== 'fixed' && (
                    <button
                      onClick={() => handleTogglePause(client)}
                      title={client.isActive === false ? 'Resume client' : 'Pause client'}
                      className={`flex items-center justify-center px-3 border rounded-lg py-1.5 text-xs ${client.isActive === false ? 'border-emerald-200 text-emerald-600 hover:bg-emerald-50' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}
                    >{client.isActive === false ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}</button>
                  )}
                  <button
                    onClick={() => setCompleteModal(client)}
                    title="Mark contract complete"
                    className="flex items-center justify-center px-3 border border-slate-200 text-slate-500 rounded-lg py-1.5 text-xs hover:bg-slate-50"
                  ><CheckCircle2 className="w-3 h-3" /></button>
                </>
              )}
              <button onClick={() => { if (confirm('Delete this client?')) deleteClient.mutate(client._id); }} className="flex items-center justify-center px-3 border border-red-200 text-red-500 rounded-lg py-1.5 text-xs hover:bg-red-50"><Trash2 className="w-3 h-3" /></button>
            </div>
          </div>
        );
      })}
    </div>
  );

  // ── Table View ──────────────────────────────────────────────────────────────
  const TableView = () => (
    <div className="bg-white rounded-xl border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="w-8 px-3 py-3" />
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Client</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Since</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Contract</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">All-time Received</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">{MONTHS[selMonth - 1]} {selYear} — Paid</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">{MONTHS[selMonth - 1]} — Remaining</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Month Status</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Account Manager</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Work Status</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Paid On</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {clients.map((client: any) => {
              const mStatus   = client.status;
              const paid      = client.selPaid ?? 0;
              const monthValue = client.monthContractValue ?? client.contractValue;
              const remaining = client.selRemaining ?? monthValue;
              const payment   = client.selPayment ?? null;
              return (
                <tr
                  key={client._id}
                  draggable
                  onDragStart={() => onDragStart(client._id)}
                  onDragOver={e => onDragOver(e, client._id)}
                  onDrop={onDrop}
                  className={`hover:bg-gray-50 cursor-grab active:cursor-grabbing ${client.isActive === false || client.endDate ? 'opacity-60' : ''}`}
                >
                  <td className="px-3 py-3 text-gray-300"><GripVertical className="w-4 h-4" /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <div className="font-medium text-gray-900">{client.name}</div>
                      {client.billingType === 'fixed' && <FixedBadge months={client.durationMonths} />}
                      {client.endDate ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-500 bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5"><CheckCircle2 className="w-2.5 h-2.5" /> Completed</span>
                      ) : client.isActive === false && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-gray-500 bg-gray-100 border border-gray-200 rounded px-1.5 py-0.5"><Pause className="w-2.5 h-2.5" /> Paused</span>
                      )}
                    </div>
                    {client.billingType === 'fixed' && cycleText(client) && <div className="text-xs text-violet-500 whitespace-nowrap">{cycleText(client)}</div>}
                    {client.notes && <div className="text-xs text-gray-400 truncate max-w-[160px]">{client.notes}</div>}
                  </td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatDate(client.startDate)}</td>
                  <td className="px-4 py-3 font-medium whitespace-nowrap">
                    {client.billingType === 'fixed' ? (
                      <div>
                        <div>{formatCurrency(client.contractValue)}</div>
                        <div className="text-[10px] text-gray-400 font-normal">one-time · {client.durationMonths} mo</div>
                      </div>
                    ) : (
                      <span className="flex items-center gap-1.5">
                        {formatCurrency(monthValue)}
                        {monthValue !== client.contractValue && <span className="text-[10px] text-amber-500 font-semibold">custom</span>}
                        {!client.endDate && (
                          <button onClick={() => setValueModal(client)} title="Set this month's contract value" className="p-0.5 rounded hover:bg-gray-100 text-gray-400 hover:text-primary"><IndianRupee className="w-3 h-3" /></button>
                        )}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-medium text-emerald-600 whitespace-nowrap">{formatCurrency(client.receivedAmount ?? 0)}</td>
                  <td className="px-4 py-3 font-semibold whitespace-nowrap">
                    {paid > 0 ? <span className="text-emerald-600">{formatCurrency(paid)}</span> : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {mStatus === 'Paid'
                      ? <span className="text-xs text-emerald-500 font-medium">✓ Settled</span>
                      : mStatus === 'Partial'
                        ? <span className="text-amber-600 font-semibold">{formatCurrency(remaining)}</span>
                        : mStatus === 'NotStarted'
                          ? <span className="text-gray-300">—</span>
                          : mStatus === 'Upcoming'
                            ? <span className="text-xs text-blue-500 font-medium">Due {client.dueDate ? formatDate(client.dueDate) : 'later'}</span>
                            : mStatus === 'Paused'
                              ? <span className="text-xs text-gray-400 font-medium">⏸ Paused</span>
                              : mStatus === 'Completed'
                                ? <span className="text-xs text-slate-400 font-medium">✓ Completed</span>
                                : mStatus === 'Covered'
                                  ? <span className="text-xs text-teal-500 font-medium">✓ Covered</span>
                                  : <span className="text-red-500 font-semibold">{formatCurrency(monthValue)}</span>}
                  </td>

                  {/* Month Status — compact interactive dropdown */}
                  <td className="px-4 py-3">
                    <MonthStatusDropdown status={mStatus} onSelect={s => handleMonthStatusSelect(client, s)} />
                  </td>

                  {/* Account Manager */}
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                    {client.accountManager || <span className="text-gray-300">—</span>}
                  </td>

                  {/* Work Status */}
                  <td className="px-4 py-3">
                    <select
                      className="text-xs border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary bg-white min-w-[100px]"
                      value={client.workStatus || ''}
                      onChange={e => handleWorkStatusChange(client, e.target.value)}
                    >
                      {WORK_STATUS_OPTIONS.map(o => <option key={o} value={o}>{o || '— Select —'}</option>)}
                    </select>
                  </td>

                  <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                    {payment ? (
                      <div>
                        <div>{formatDate(payment.paymentDate)}</div>
                        <div className="text-gray-300">{payment.paymentMethod}</div>
                      </div>
                    ) : '—'}
                  </td>

                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      {!NON_EDITABLE_STATUSES.has(mStatus) && (
                        <button
                          onClick={() => setPayModal({ client, existingPayment: payment })}
                          title={payment ? 'Edit Payment' : 'Record Payment'}
                          className="p-1.5 rounded hover:bg-primary/10 text-primary"
                        ><CreditCard className="w-3.5 h-3.5" /></button>
                      )}
                      <Link to={`/admin/finance/clients/${client._id}`} className="p-1.5 rounded hover:bg-gray-100 text-gray-500"><Eye className="w-3.5 h-3.5" /></Link>
                      <button onClick={() => setClientModal(client)} className="p-1.5 rounded hover:bg-gray-100 text-gray-500"><Pencil className="w-3.5 h-3.5" /></button>
                      {client.endDate ? (
                        <button
                          onClick={() => handleReactivate(client)}
                          title="Reactivate client"
                          className="p-1.5 rounded hover:bg-emerald-50 text-emerald-500"
                        ><RotateCcw className="w-3.5 h-3.5" /></button>
                      ) : (
                        <>
                          {client.billingType !== 'fixed' && (
                            <button
                              onClick={() => handleTogglePause(client)}
                              title={client.isActive === false ? 'Resume client' : 'Pause client'}
                              className={`p-1.5 rounded hover:bg-gray-100 ${client.isActive === false ? 'text-emerald-500' : 'text-gray-500'}`}
                            >{client.isActive === false ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}</button>
                          )}
                          <button
                            onClick={() => setCompleteModal(client)}
                            title="Mark contract complete"
                            className="p-1.5 rounded hover:bg-slate-100 text-slate-500"
                          ><CheckCircle2 className="w-3.5 h-3.5" /></button>
                        </>
                      )}
                      <button onClick={() => { if (confirm('Delete this client?')) deleteClient.mutate(client._id); }} className="p-1.5 rounded hover:bg-red-50 text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
          <p className="text-gray-500 text-sm mt-1">{clients.length} total clients</p>
        </div>
        <button onClick={() => setClientModal('add')} className="flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90">
          <Plus className="w-4 h-4" /> Add Client
        </button>
      </div>

      {/* Collection KPIs for selected month */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <Link to="/admin/finance/clients" className="bg-white rounded-xl border p-5 flex items-start gap-4 group hover:shadow-md hover:border-gray-300 transition-all duration-150">
          <div className="w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0 bg-indigo-500 group-hover:scale-105 transition-transform duration-150">
            <IndianRupee className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Total Revenue</p>
            <p className="text-xl font-bold text-gray-900 truncate">{formatCurrency(kpis.totalContractValue)}</p>
            <p className="text-xs text-gray-400 mt-0.5">{MONTHS[selMonth - 1]} {selYear} contract value</p>
          </div>
        </Link>
        <Link to="/admin/finance/payments" className="bg-white rounded-xl border p-5 flex items-start gap-4 group hover:shadow-md hover:border-gray-300 transition-all duration-150">
          <div className="w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0 bg-emerald-500 group-hover:scale-105 transition-transform duration-150">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Collected</p>
            <p className="text-xl font-bold text-gray-900 truncate">{formatCurrency(kpis.totalCollected)}</p>
            <p className="text-xs text-gray-400 mt-0.5">Received this month</p>
          </div>
        </Link>
        <div className="bg-white rounded-xl border p-5 flex items-start gap-4">
          <div className="w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0 bg-amber-500">
            <AlertCircle className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Pending</p>
            <p className="text-xl font-bold text-gray-900 truncate">{formatCurrency(kpis.totalPending)}</p>
            <p className="text-xs text-gray-400 mt-0.5">To be collected</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="w-full pl-9 pr-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" placeholder="Search clients..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex items-center gap-2 bg-white border rounded-lg px-3 py-1.5">
          <span className="text-xs text-gray-400 font-medium uppercase">Month</span>
          <select className="text-sm border-0 outline-none bg-transparent" value={selMonth} onChange={e => setSelMonth(Number(e.target.value))}>
            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
          <select className="text-sm border-0 outline-none bg-transparent" value={selYear} onChange={e => setSelYear(Number(e.target.value))}>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div className="flex gap-1.5">
          {STATUS_OPTIONS.map(s => (
            <button key={s.value} onClick={() => setStatusFilter(s.value)} className={`px-3 py-2 rounded-lg text-sm font-medium border transition ${statusFilter === s.value ? 'bg-primary text-white border-primary' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>{s.label}</button>
          ))}
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          <button onClick={() => setView('table')} className={`p-2 rounded-md transition ${view === 'table' ? 'bg-white shadow-sm text-primary' : 'text-gray-400 hover:text-gray-600'}`}><Table2 className="w-4 h-4" /></button>
          <button onClick={() => setView('grid')} className={`p-2 rounded-md transition ${view === 'grid' ? 'bg-white shadow-sm text-primary' : 'text-gray-400 hover:text-gray-600'}`}><LayoutGrid className="w-4 h-4" /></button>
        </div>
      </div>

      <p className="text-xs text-gray-400 flex items-center gap-1.5">
        <GripVertical className="w-3.5 h-3.5" /> Drag rows/cards to reorder — order is shared across both views
      </p>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => <div key={i} className="h-36 bg-gray-200 rounded-xl animate-pulse" />)}
        </div>
      ) : clients.length === 0 ? (
        <div className="text-center py-16 text-gray-400">No clients found</div>
      ) : view === 'table' ? <TableView /> : <CardView />}

      {clientModal && (
        <ClientForm
          initial={typeof clientModal === 'object' ? clientModal : undefined}
          onSave={handleSaveClient}
          onClose={() => setClientModal(null)}
        />
      )}
      {completeModal && (
        <CompleteClientModal
          client={completeModal}
          onSave={handleSaveComplete}
          onClose={() => setCompleteModal(null)}
        />
      )}
      {valueModal && (
        <MonthValueModal
          client={valueModal}
          month={selMonth}
          year={selYear}
          onSave={(value) => handleSaveMonthValue(valueModal, value)}
          onReset={() => handleResetMonthValue(valueModal)}
          onClose={() => setValueModal(null)}
        />
      )}
      {payModal && (
        <MonthlyPaymentModal
          client={payModal.client}
          month={selMonth}
          year={selYear}
          existingPayment={payModal.existingPayment}
          onSave={handleSavePayment}
          onClose={() => setPayModal(null)}
        />
      )}
    </div>
  );
}