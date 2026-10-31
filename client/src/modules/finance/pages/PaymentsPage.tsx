import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { paymentsApi, clientsApi, servicesApi } from '../services/api';
import { formatCurrency, formatDate, MONTHS, getCurrentMonthYear } from '../lib/utils';
import {
  Plus, Trash2, Pencil, TrendingUp, Wallet, AlertCircle, Calendar,
  Users, UserPlus, Search, X, Sparkles, Phone, Tag, BadgeCheck,
} from 'lucide-react';

const STATUS_STYLES: Record<string, string> = {
  Paid: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  Partial: 'bg-amber-100 text-amber-700 border-amber-200',
  Pending: 'bg-red-100 text-red-700 border-red-200',
};

const oneTimeStatus = (p: any) => {
  const total = Number(p.totalAmount) || Number(p.amount) || 0;
  const paid = Number(p.amount) || 0;
  if (paid >= total && total > 0) return 'Paid';
  if (paid > 0) return 'Partial';
  return 'Pending';
};

// ---------------------------------------------------------------------------
// Add / Edit Collection modal — supports both recurring clients and
// one-off "walk-in" clients who only ever take a single service.
// ---------------------------------------------------------------------------
const CollectionModal = ({ clients, services, initial, onSave, onClose, saving }: any) => {
  const editing = !!initial?._id;
  const [mode, setMode] = useState<'existing' | 'oneTime'>(
    editing ? (initial.isOneTime ? 'oneTime' : 'existing') : 'existing'
  );
  const [form, setForm] = useState<any>(
    initial || {
      clientId: clients[0]?._id || '',
      customClientName: '',
      customClientPhone: '',
      purpose: '',
      totalAmount: '',
      amount: '',
      paymentDate: new Date().toISOString().split('T')[0],
      paymentMethod: 'Bank Transfer',
      remarks: '',
    }
  );
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const handleSubmit = () => {
    const payload: any = {
      ...form,
      isOneTime: mode === 'oneTime',
      amount: Number(form.amount) || 0,
    };
    if (mode === 'oneTime') {
      payload.totalAmount = form.totalAmount ? Number(form.totalAmount) : Number(form.amount) || 0;
      delete payload.clientId;
    } else {
      delete payload.customClientName;
      delete payload.customClientPhone;
      delete payload.totalAmount;
    }
    onSave(payload);
  };

  const valid =
    mode === 'existing'
      ? !!form.clientId && Number(form.amount) > 0
      : !!form.customClientName?.trim() && Number(form.amount) > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100">
        <div className="px-6 pt-6 pb-4 bg-gradient-to-br from-primary/5 via-white to-emerald-50/60 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <Sparkles className="w-4.5 h-4.5 text-primary" />
              </div>
              <h2 className="text-lg font-bold text-slate-900">{editing ? 'Edit Collection' : 'Record Collection'}</h2>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
              <X className="w-4.5 h-4.5" />
            </button>
          </div>

          {!editing && (
            <div className="mt-4 grid grid-cols-2 gap-2 bg-slate-100/80 p-1 rounded-xl">
              <button
                onClick={() => setMode('existing')}
                className={`flex items-center justify-center gap-1.5 text-sm font-medium py-2 rounded-lg transition-all ${
                  mode === 'existing' ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Users className="w-3.5 h-3.5" /> Recurring Client
              </button>
              <button
                onClick={() => setMode('oneTime')}
                className={`flex items-center justify-center gap-1.5 text-sm font-medium py-2 rounded-lg transition-all ${
                  mode === 'oneTime' ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" /> One-Time Client
              </button>
            </div>
          )}
        </div>

        <div className="px-6 py-5 space-y-3.5 max-h-[65vh] overflow-y-auto">
          {mode === 'existing' ? (
            <div>
              <label className="text-sm font-medium text-slate-700">Client *</label>
              <select
                className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                value={form.clientId}
                onChange={(e) => set('clientId', e.target.value)}
              >
                {clients.map((c: any) => (
                  <option key={c._id} value={c._id}>{c.name}</option>
                ))}
              </select>
            </div>
          ) : (
            <>
              <div className="rounded-lg bg-blue-50 border border-blue-100 px-3 py-2 text-xs text-blue-700 flex items-start gap-2">
                <UserPlus className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                For people who took just one service and never became a regular client — they're tracked here without cluttering your client list.
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-slate-700">Name *</label>
                  <input
                    className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    value={form.customClientName}
                    onChange={(e) => set('customClientName', e.target.value)}
                    placeholder="Walk-in client name"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Phone</label>
                  <input
                    className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    value={form.customClientPhone}
                    onChange={(e) => set('customClientPhone', e.target.value)}
                    placeholder="Optional"
                  />
                </div>
              </div>
            </>
          )}

          <div>
            <label className="text-sm font-medium text-slate-700">Purpose / Service</label>
            <input
              list="service-suggestions"
              className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              value={form.purpose}
              onChange={(e) => set('purpose', e.target.value)}
              placeholder="e.g. GST Filing, ITR, Consultation"
            />
            <datalist id="service-suggestions">
              {services.map((s: any) => <option key={s._id} value={s.name} />)}
            </datalist>
          </div>

          {mode === 'oneTime' && (
            <div>
              <label className="text-sm font-medium text-slate-700">Total Job Value (₹)</label>
              <input
                type="number"
                className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                value={form.totalAmount}
                onChange={(e) => set('totalAmount', e.target.value)}
                placeholder="Leave blank if fully paid now"
              />
              <p className="text-xs text-slate-400 mt-1">If the agreed amount is more than what's being paid now, the rest will show as pending for this client.</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-slate-700">{mode === 'oneTime' ? 'Amount Paid Now (₹) *' : 'Amount (₹) *'}</label>
              <input
                type="number"
                className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                value={form.amount}
                onChange={(e) => set('amount', e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Date *</label>
              <input
                type="date"
                className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                value={form.paymentDate?.split('T')[0] || ''}
                onChange={(e) => set('paymentDate', e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">Method</label>
            <select
              className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              value={form.paymentMethod}
              onChange={(e) => set('paymentMethod', e.target.value)}
            >
              {['Bank Transfer', 'Cash', 'UPI', 'Cheque', 'Online'].map((m) => <option key={m}>{m}</option>)}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">Remarks</label>
            <input
              className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              value={form.remarks}
              onChange={(e) => set('remarks', e.target.value)}
            />
          </div>
        </div>

        <div className="flex gap-3 px-6 py-4 bg-slate-50 border-t border-slate-100">
          <button onClick={onClose} className="flex-1 border rounded-lg py-2.5 text-sm font-medium hover:bg-white bg-white">Cancel</button>
          <button
            disabled={!valid || saving}
            onClick={handleSubmit}
            className="flex-1 bg-primary text-white rounded-lg py-2.5 text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving…' : 'Save Collection'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default function PaymentsPage() {
  const qc = useQueryClient();
  const [modal, setModal] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'existing' | 'oneTime'>('all');
  const now = getCurrentMonthYear();
  const [selMonth, setSelMonth] = useState(now.month);
  const [selYear, setSelYear] = useState(now.year);
  const years = Array.from({ length: 4 }, (_, i) => now.year - i);

  const { data: payments = [], isLoading } = useQuery({
    queryKey: ['payments', selMonth, selYear],
    queryFn: () => paymentsApi.getAll({ month: selMonth, year: selYear }).then((r) => r.data),
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients-all'],
    queryFn: () => clientsApi.getAll().then((r) => r.data),
  });

  const { data: monthClients = [] } = useQuery({
    queryKey: ['clients-month', selMonth, selYear],
    queryFn: () => clientsApi.getAll({ month: selMonth, year: selYear }).then((r) => r.data),
  });

  const { data: services = [] } = useQuery({
    queryKey: ['services-all'],
    queryFn: () => servicesApi.getAll().then((r) => r.data),
  });

  const createMut = useMutation({
    mutationFn: (d: any) => paymentsApi.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['payments'] }); qc.invalidateQueries({ queryKey: ['clients-month'] }); setModal(null); },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, d }: any) => paymentsApi.update(id, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['payments'] }); qc.invalidateQueries({ queryKey: ['clients-month'] }); setModal(null); },
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => paymentsApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['payments'] }); qc.invalidateQueries({ queryKey: ['clients-month'] }); },
  });

  const handleSave = (form: any) => {
    if (modal?._id) updateMut.mutate({ id: modal._id, d: form });
    else createMut.mutate(form);
  };

  const oneTimePayments = useMemo(() => payments.filter((p: any) => p.isOneTime), [payments]);
  const existingPayments = useMemo(() => payments.filter((p: any) => !p.isOneTime), [payments]);

  const recurringKpis = monthClients.reduce(
    (acc: any, c: any) => {
      acc.collected += c.selPaid || 0;
      acc.pending += c.selRemaining ?? Math.max(0, (c.contractValue || 0) - (c.selPaid || 0));
      return acc;
    },
    { collected: 0, pending: 0 }
  );

  const oneTimeKpis = oneTimePayments.reduce(
    (acc: any, p: any) => {
      const total = Number(p.totalAmount) || Number(p.amount) || 0;
      acc.collected += Number(p.amount) || 0;
      acc.pending += Math.max(0, total - (Number(p.amount) || 0));
      return acc;
    },
    { collected: 0, pending: 0 }
  );

  const totalCollected = recurringKpis.collected + oneTimeKpis.collected;
  const totalPending = recurringKpis.pending + oneTimeKpis.pending;
  const uniqueOneTimeClients = new Set(oneTimePayments.map((p: any) => (p.customClientName || '').trim().toLowerCase())).size;

  const filteredRows = useMemo(() => {
    let rows = payments;
    if (typeFilter === 'existing') rows = existingPayments;
    if (typeFilter === 'oneTime') rows = oneTimePayments;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter((p: any) => {
        const name = p.isOneTime ? p.customClientName : (typeof p.clientId === 'object' ? p.clientId?.name : '');
        return (name || '').toLowerCase().includes(q) || (p.purpose || '').toLowerCase().includes(q);
      });
    }
    return rows;
  }, [payments, existingPayments, oneTimePayments, typeFilter, search]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Collections</h1>
          <p className="text-gray-500 text-sm mt-1">
            {MONTHS[selMonth - 1]} {selYear} collected:{' '}
            <span className="font-semibold text-emerald-600">{formatCurrency(totalCollected)}</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white border rounded-lg px-3 py-1.5">
            <Calendar className="w-3.5 h-3.5 text-gray-400" />
            <select className="text-sm border-0 outline-none bg-transparent" value={selMonth} onChange={(e) => setSelMonth(Number(e.target.value))}>
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
            <select className="text-sm border-0 outline-none bg-transparent" value={selYear} onChange={(e) => setSelYear(Number(e.target.value))}>
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <button
            onClick={() => setModal({})}
            className="flex items-center gap-2 bg-gradient-to-r from-primary to-primary/80 text-white px-4 py-2.5 rounded-lg text-sm font-medium shadow-sm hover:shadow-md hover:brightness-105 transition-all"
          >
            <Plus className="w-4 h-4" /> Add Collection
          </button>
        </div>
      </div>

      {/* Collection KPIs for selected month */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border p-5 flex items-start gap-4">
          <div className="w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0 bg-emerald-500">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Collected</p>
            <p className="text-xl font-bold text-gray-900 truncate">{formatCurrency(totalCollected)}</p>
            <p className="text-xs text-gray-400 mt-0.5">Received in {MONTHS[selMonth - 1]} {selYear}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border p-5 flex items-start gap-4">
          <div className="w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0 bg-amber-500">
            <AlertCircle className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Pending</p>
            <p className="text-xl font-bold text-gray-900 truncate">{formatCurrency(totalPending)}</p>
            <p className="text-xs text-gray-400 mt-0.5">Recurring + one-time dues</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border p-5 flex items-start gap-4">
          <div className="w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0 bg-violet-500">
            <UserPlus className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">One-Time Clients</p>
            <p className="text-xl font-bold text-gray-900 truncate">{uniqueOneTimeClients}</p>
            <p className="text-xs text-gray-400 mt-0.5">{formatCurrency(oneTimeKpis.collected)} collected from them</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border p-5 flex items-start gap-4">
          <div className="w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0 bg-blue-500">
            <Wallet className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Collections Recorded</p>
            <p className="text-xl font-bold text-gray-900 truncate">{payments.length}</p>
            <p className="text-xs text-gray-400 mt-0.5">In {MONTHS[selMonth - 1]} {selYear}</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 bg-slate-100/80 p-1 rounded-xl">
          {[
            { key: 'all', label: 'All' },
            { key: 'existing', label: 'Recurring' },
            { key: 'oneTime', label: 'One-Time' },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTypeFilter(t.key as any)}
              className={`px-3.5 py-1.5 text-sm font-medium rounded-lg transition-all ${
                typeFilter === t.key ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 bg-white border rounded-lg px-3 py-2 w-full sm:w-72">
          <Search className="w-3.5 h-3.5 text-gray-400" />
          <input
            className="text-sm border-0 outline-none bg-transparent w-full"
            placeholder="Search by name or purpose…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading...</div>
        ) : filteredRows.length === 0 ? (
          <div className="p-10 text-center text-gray-400">
            <Wallet className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            No collections found for {MONTHS[selMonth - 1]} {selYear}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  {['Client', 'Type', 'Purpose', 'Amount', 'Status', 'Date', 'Method', 'Remarks', ''].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredRows.map((p: any) => {
                  const name = p.isOneTime ? p.customClientName : (typeof p.clientId === 'object' ? p.clientId?.name : p.clientId);
                  const status = p.isOneTime ? oneTimeStatus(p) : null;
                  const total = Number(p.totalAmount) || Number(p.amount) || 0;
                  return (
                    <tr key={p._id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">
                        <div className="flex items-center gap-2">
                          {name}
                          {p.isOneTime && p.customClientPhone && (
                            <span className="text-xs text-gray-400 flex items-center gap-0.5"><Phone className="w-3 h-3" />{p.customClientPhone}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {p.isOneTime ? (
                          <span className="inline-flex items-center gap-1 bg-violet-50 text-violet-600 border border-violet-200 px-2 py-0.5 rounded-full text-xs font-medium">
                            <UserPlus className="w-3 h-3" /> One-Time
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-600 border border-blue-200 px-2 py-0.5 rounded-full text-xs font-medium">
                            <Users className="w-3 h-3" /> Recurring
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {p.purpose ? (
                          <span className="inline-flex items-center gap-1"><Tag className="w-3 h-3 text-gray-300" />{p.purpose}</span>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-semibold text-emerald-600">{formatCurrency(p.amount)}</span>
                        {p.isOneTime && total > p.amount && (
                          <span className="text-xs text-gray-400 ml-1">/ {formatCurrency(total)}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {p.isOneTime ? (
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_STYLES[status as string]}`}>
                            {status === 'Paid' && <BadgeCheck className="w-3 h-3 inline mr-0.5 -mt-0.5" />}
                            {status}
                          </span>
                        ) : (
                          <span className="text-gray-300 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500">{formatDate(p.paymentDate)}</td>
                      <td className="px-4 py-3"><span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs">{p.paymentMethod}</span></td>
                      <td className="px-4 py-3 text-gray-400">{p.remarks}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button onClick={() => setModal(p)} className="p-1.5 hover:bg-gray-100 rounded"><Pencil className="w-3.5 h-3.5 text-gray-500" /></button>
                          <button onClick={() => { if (confirm('Delete this collection?')) deleteMut.mutate(p._id); }} className="p-1.5 hover:bg-red-50 rounded"><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal !== null && (
        <CollectionModal
          clients={clients}
          services={services}
          initial={modal._id ? modal : undefined}
          onSave={handleSave}
          onClose={() => setModal(null)}
          saving={createMut.isPending || updateMut.isPending}
        />
      )}
    </div>
  );
}