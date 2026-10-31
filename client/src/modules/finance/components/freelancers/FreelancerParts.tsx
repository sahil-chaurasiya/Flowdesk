import { useState } from 'react';
import { QueryClient } from '@tanstack/react-query';
import { Star } from 'lucide-react';
import { formatCurrency } from '../../lib/utils';

// ---------------------------------------------------------------------------
// Shared constants / helpers for the Freelancers pages
// ---------------------------------------------------------------------------
export const ROLE_SUGGESTIONS = [
  'Photographer', 'Videographer', 'Video Editor', 'Graphic Designer', 'Content Writer',
  'Voice-over Artist', 'Model', 'Influencer', 'Web Developer', 'Social Media Manager', 'Other',
];
export const JOB_STATUSES = ['Planned', 'In Progress', 'Completed', 'Cancelled'] as const;
export const RATE_TYPES = ['Fixed', 'Hourly', 'Daily', 'Per Unit'] as const;
export const PAYMENT_METHODS = ['Bank Transfer', 'UPI', 'Cash', 'Cheque', 'Online'];
export const PAYMENT_TYPES = ['Advance', 'Part Payment', 'Final Payment'];

export const todayStr = () => new Date().toISOString().split('T')[0];
const dateOnly = (d?: string | null) => (d ? d.split('T')[0] : '');
export const idOf = (v: any): string => (v && typeof v === 'object' ? v._id : v) || '';
export const errMsg = (err: any) => err?.response?.data?.message || err?.message || 'Something went wrong';

// Anything that changes freelancer data also changes the Dashboard / Accounting
// / Reports numbers, so refresh all of them together.
export const invalidateFreelancerData = (qc: QueryClient) => {
  ['freelancers', 'freelancer', 'freelancer-jobs', 'freelancer-summary', 'dashboard', 'accounting', 'accounting-all', 'report']
    .forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
};

// Human-readable description of how a job's fee is calculated.
export const rateBasis = (job: any) => {
  if (job.rateType === 'Hourly') return `${formatCurrency(job.rate)}/hr × ${job.quantity} hrs`;
  if (job.rateType === 'Daily') return `${formatCurrency(job.rate)}/day × ${job.quantity} days`;
  if (job.rateType === 'Per Unit') return `${formatCurrency(job.rate)}/${(job.unitLabel || 'unit').replace(/s$/, '')} × ${job.quantity}`;
  return 'Fixed fee';
};

const JOB_STATUS_STYLES: Record<string, string> = {
  Planned: 'bg-gray-100 text-gray-600',
  'In Progress': 'bg-blue-100 text-blue-700',
  Completed: 'bg-emerald-100 text-emerald-700',
  Cancelled: 'bg-red-50 text-red-500',
};
const PAY_STATUS_STYLES: Record<string, string> = {
  Unpaid: 'bg-red-100 text-red-700',
  Partial: 'bg-amber-100 text-amber-700',
  Paid: 'bg-emerald-100 text-emerald-700',
  Overpaid: 'bg-purple-100 text-purple-700',
  Closed: 'bg-gray-100 text-gray-500',
};
export const JobStatusBadge = ({ status }: { status: string }) => (
  <span className={`text-xs font-medium px-2 py-1 rounded-full whitespace-nowrap ${JOB_STATUS_STYLES[status] || 'bg-gray-100 text-gray-600'}`}>{status}</span>
);
export const PayStatusBadge = ({ status }: { status: string }) => (
  <span className={`text-xs font-medium px-2 py-1 rounded-full whitespace-nowrap ${PAY_STATUS_STYLES[status] || 'bg-gray-100 text-gray-600'}`}>{status}</span>
);

export const Stars = ({ value, size = 'w-3.5 h-3.5' }: { value: number; size?: string }) => (
  <span className="inline-flex items-center gap-0.5">
    {[1, 2, 3, 4, 5].map((n) => (
      <Star key={n} className={`${size} ${n <= Math.round(value) ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`} />
    ))}
  </span>
);

const inputCls = 'mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary';
const labelCls = 'text-sm font-medium text-gray-700';

const ModalShell = ({ title, children, onClose, onSave, saving, error, saveLabel = 'Save' }: any) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto p-6">
      <h2 className="text-lg font-bold mb-4">{title}</h2>
      <div className="space-y-3">{children}</div>
      {error && <p className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
      <div className="flex gap-3 mt-5">
        <button onClick={onClose} className="flex-1 border rounded-lg py-2 text-sm font-medium hover:bg-gray-50">Cancel</button>
        <button onClick={onSave} disabled={saving} className="flex-1 bg-primary text-white rounded-lg py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-60">{saving ? 'Saving…' : saveLabel}</button>
      </div>
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// Add / edit a freelancer (the person)
// ---------------------------------------------------------------------------
export const FreelancerModal = ({ initial, onSave, onClose, saving, error }: any) => {
  const [form, setForm] = useState<any>(initial || { name: '', role: '', phone: '', email: '', city: '', upiId: '', bankDetails: '', notes: '', isActive: true });
  const [localErr, setLocalErr] = useState('');
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));
  const submit = () => {
    if (!form.name?.trim()) return setLocalErr('Name is required');
    setLocalErr('');
    onSave({ ...form, name: form.name.trim() });
  };
  return (
    <ModalShell title={initial ? 'Edit Freelancer' : 'Add Freelancer'} onClose={onClose} onSave={submit} saving={saving} error={localErr || error}>
      <div><label className={labelCls}>Name *</label><input className={inputCls} value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Rohit Verma" /></div>
      <div>
        <label className={labelCls}>Role / Skill</label>
        <input className={inputCls} list="freelancer-roles" value={form.role} onChange={(e) => set('role', e.target.value)} placeholder="Photographer, Video Editor…" />
        <datalist id="freelancer-roles">{ROLE_SUGGESTIONS.map((r) => <option key={r} value={r} />)}</datalist>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className={labelCls}>Phone</label><input className={inputCls} value={form.phone} onChange={(e) => set('phone', e.target.value)} /></div>
        <div><label className={labelCls}>City</label><input className={inputCls} value={form.city} onChange={(e) => set('city', e.target.value)} /></div>
      </div>
      <div><label className={labelCls}>Email</label><input type="email" className={inputCls} value={form.email} onChange={(e) => set('email', e.target.value)} /></div>
      <div className="grid grid-cols-1 gap-3">
        <div><label className={labelCls}>UPI ID</label><input className={inputCls} value={form.upiId} onChange={(e) => set('upiId', e.target.value)} placeholder="name@upi" /></div>
        <div><label className={labelCls}>Bank details</label><textarea rows={2} className={inputCls} value={form.bankDetails} onChange={(e) => set('bankDetails', e.target.value)} placeholder="Account holder, account no., IFSC…" /></div>
      </div>
      <div><label className={labelCls}>Notes</label><textarea rows={2} className={inputCls} value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Equipment, availability, style, anything worth remembering" /></div>
      {initial && (
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={form.isActive !== false} onChange={(e) => set('isActive', e.target.checked)} />
          Currently working with us <span className="text-xs text-gray-400">(untick to archive — history is kept)</span>
        </label>
      )}
    </ModalShell>
  );
};

// ---------------------------------------------------------------------------
// Add / edit a job — what was agreed, for which client, and how it went
// ---------------------------------------------------------------------------
export const JobModal = ({ freelancers, clients, initial, presetFreelancerId, onSave, onClose, saving, error }: any) => {
  const editing = !!initial?._id;
  const [form, setForm] = useState<any>(() => initial ? {
    freelancerId: idOf(initial.freelancerId),
    title: initial.title || '',
    description: initial.description || '',
    clientId: initial.clientId ? String(initial.clientId) : '',
    clientName: initial.clientId ? '' : (initial.clientName || ''),
    startDate: dateOnly(initial.startDate),
    dueDate: dateOnly(initial.dueDate),
    completedDate: dateOnly(initial.completedDate),
    rateType: initial.rateType || 'Fixed',
    rate: String(initial.rate ?? ''),
    quantity: String(initial.quantity ?? 1),
    unitLabel: initial.unitLabel || '',
    extraCharges: initial.extraCharges ? String(initial.extraCharges) : '',
    extraChargesNote: initial.extraChargesNote || '',
    status: initial.status || 'In Progress',
    workStatus: initial.workStatus || '',
    rating: initial.rating || 0,
    feedback: initial.feedback || '',
  } : {
    freelancerId: presetFreelancerId || freelancers[0]?._id || '',
    title: '', description: '', clientId: '', clientName: '',
    startDate: todayStr(), dueDate: '', completedDate: '',
    rateType: 'Fixed', rate: '', quantity: '1', unitLabel: '',
    extraCharges: '', extraChargesNote: '',
    status: 'In Progress', workStatus: '', rating: 0, feedback: '',
  });
  const [localErr, setLocalErr] = useState('');
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const fixed = form.rateType === 'Fixed';
  const qtyLabel = form.rateType === 'Hourly' ? 'Hours' : form.rateType === 'Daily' ? 'Days' : (form.unitLabel || 'Units');
  const agreed = fixed ? Number(form.rate) || 0 : (Number(form.rate) || 0) * (Number(form.quantity) || 0);
  const total = agreed + (Number(form.extraCharges) || 0);

  const submit = () => {
    if (!form.freelancerId) return setLocalErr('Pick a freelancer');
    if (!form.title.trim()) return setLocalErr('Job title is required');
    if (form.rate === '' || Number(form.rate) < 0) return setLocalErr('Enter the rate / fee');
    setLocalErr('');
    onSave({
      freelancerId: form.freelancerId,
      title: form.title.trim(),
      description: form.description,
      clientId: form.clientId || null,
      clientName: form.clientId ? '' : form.clientName,
      startDate: form.startDate || null,
      dueDate: form.dueDate || null,
      completedDate: form.status === 'Completed' ? (form.completedDate || null) : null,
      rateType: form.rateType,
      rate: Number(form.rate) || 0,
      quantity: fixed ? 1 : Number(form.quantity) || 0,
      unitLabel: form.rateType === 'Per Unit' ? form.unitLabel : '',
      extraCharges: Number(form.extraCharges) || 0,
      extraChargesNote: form.extraChargesNote,
      status: form.status,
      workStatus: form.workStatus,
      rating: form.rating,
      feedback: form.feedback,
    });
  };

  return (
    <ModalShell title={editing ? 'Edit Job' : 'Add Job'} onClose={onClose} onSave={submit} saving={saving} error={localErr || error}>
      <div>
        <label className={labelCls}>Freelancer *</label>
        <select className={inputCls} value={form.freelancerId} disabled={editing} onChange={(e) => set('freelancerId', e.target.value)}>
          {freelancers.length === 0 && <option value="">Add a freelancer first</option>}
          {freelancers.map((f: any) => <option key={f._id} value={f._id}>{f.name}{f.role ? ` — ${f.role}` : ''}</option>)}
        </select>
      </div>
      <div><label className={labelCls}>Job title *</label><input className={inputCls} value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Product shoot for TechCorp" /></div>
      <div><label className={labelCls}>Scope / deliverables</label><textarea rows={2} className={inputCls} value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="What exactly was agreed — 40 edited photos, 2 reels, full-day shoot…" /></div>

      <div>
        <label className={labelCls}>For client</label>
        <select className={inputCls} value={form.clientId} onChange={(e) => set('clientId', e.target.value)}>
          <option value="">— Not linked to a client record —</option>
          {(clients || []).map((c: any) => <option key={c._id} value={c._id}>{c.name}</option>)}
        </select>
        {!form.clientId && <input className={inputCls} value={form.clientName} onChange={(e) => set('clientName', e.target.value)} placeholder="Client / project name (optional)" />}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div><label className={labelCls}>Start date</label><input type="date" className={inputCls} value={form.startDate} onChange={(e) => set('startDate', e.target.value)} /></div>
        <div><label className={labelCls}>Due date</label><input type="date" className={inputCls} value={form.dueDate} onChange={(e) => set('dueDate', e.target.value)} /></div>
      </div>

      <div className="bg-gray-50 border rounded-xl p-3 space-y-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Payment terms</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Charged</label>
            <select className={inputCls} value={form.rateType} onChange={(e) => set('rateType', e.target.value)}>
              <option value="Fixed">Fixed fee for the job</option>
              <option value="Hourly">Per hour</option>
              <option value="Daily">Per day</option>
              <option value="Per Unit">Per piece / unit</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>{fixed ? 'Total fee (₹) *' : 'Rate (₹) *'}</label>
            <input type="number" min="0" className={inputCls} value={form.rate} onChange={(e) => set('rate', e.target.value)} />
          </div>
        </div>
        {!fixed && (
          <div className="grid grid-cols-2 gap-3">
            {form.rateType === 'Per Unit' && (
              <div><label className={labelCls}>Unit is</label><input className={inputCls} value={form.unitLabel} onChange={(e) => set('unitLabel', e.target.value)} placeholder="photos, reels, articles…" /></div>
            )}
            <div className={form.rateType === 'Per Unit' ? '' : 'col-span-2'}>
              <label className={labelCls}>{qtyLabel}</label>
              <input type="number" min="0" step="any" className={inputCls} value={form.quantity} onChange={(e) => set('quantity', e.target.value)} />
              <p className="text-[11px] text-gray-400 mt-1">Change this to the actual amount once the work is done.</p>
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div><label className={labelCls}>Extra charges (₹)</label><input type="number" min="0" className={inputCls} value={form.extraCharges} onChange={(e) => set('extraCharges', e.target.value)} placeholder="Travel, equipment, bonus" /></div>
          <div><label className={labelCls}>Extra charges for</label><input className={inputCls} value={form.extraChargesNote} onChange={(e) => set('extraChargesNote', e.target.value)} placeholder="e.g. Outstation travel" /></div>
        </div>
        <div className="flex items-center justify-between pt-2 border-t">
          <span className="text-sm text-gray-600">Total payable</span>
          <span className="text-lg font-bold">{formatCurrency(total)}</span>
        </div>
      </div>

      <div>
        <label className={labelCls}>Job status</label>
        <select className={inputCls} value={form.status} onChange={(e) => set('status', e.target.value)}>
          {JOB_STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
        {form.status === 'Cancelled' && <p className="text-[11px] text-gray-400 mt-1">A cancelled job owes nothing more. Anything already paid stays in your expenses.</p>}
      </div>

      {form.status === 'Completed' && (
        <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-3 space-y-3">
          <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">How did it go?</p>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>Completed on</label><input type="date" className={inputCls} value={form.completedDate} onChange={(e) => set('completedDate', e.target.value)} /></div>
            <div>
              <label className={labelCls}>Delivery</label>
              <select className={inputCls} value={form.workStatus} onChange={(e) => set('workStatus', e.target.value)}>
                <option value="">Not set</option><option>On Time</option><option>Delayed</option>
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls}>Quality rating</label>
            <div className="flex items-center gap-1 mt-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" onClick={() => set('rating', form.rating === n ? 0 : n)} className="p-0.5" aria-label={`${n} star`}>
                  <Star className={`w-6 h-6 ${n <= form.rating ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`} />
                </button>
              ))}
              {form.rating > 0 && <span className="text-xs text-gray-400 ml-2">{form.rating}/5</span>}
            </div>
          </div>
          <div><label className={labelCls}>Feedback</label><textarea rows={2} className={inputCls} value={form.feedback} onChange={(e) => set('feedback', e.target.value)} placeholder="Quality, communication, would we hire again?" /></div>
        </div>
      )}
    </ModalShell>
  );
};

// ---------------------------------------------------------------------------
// Record (or edit) a payment made to a freelancer against a job
// ---------------------------------------------------------------------------
export const PaymentModal = ({ jobs, lockedJobId, initial, onSave, onClose, saving, error }: any) => {
  const editing = !!initial?._id;
  const firstId = lockedJobId || (jobs.find((j: any) => j.pending > 0)?._id) || jobs[0]?._id || '';
  const [jobId, setJobId] = useState<string>(editing ? idOf(initial.jobId) : firstId);
  const job = jobs.find((j: any) => j._id === jobId);

  // When editing, the balance "before this payment" is pending + this payment's amount.
  const balance = job ? (editing ? job.pending + (initial.amount || 0) : job.pending) : 0;
  const suggestType = (amt: number) => {
    if (!job) return 'Part Payment';
    if (amt >= balance && balance > 0) return 'Final Payment';
    if (job.paid === 0 && !editing) return 'Advance';
    return 'Part Payment';
  };

  const [amount, setAmount] = useState<string>(editing ? String(initial.amount) : job && job.pending > 0 ? String(job.pending) : '');
  const [date, setDate] = useState<string>(editing ? dateOnly(initial.paymentDate) : todayStr());
  const [method, setMethod] = useState<string>(editing ? initial.paymentMethod : 'Bank Transfer');
  const [type, setType] = useState<string>(editing ? initial.paymentType : suggestType(job ? job.pending : 0));
  const [typeTouched, setTypeTouched] = useState(editing);
  const [reference, setReference] = useState<string>(editing ? initial.reference || '' : '');
  const [remarks, setRemarks] = useState<string>(editing ? initial.remarks || '' : '');
  const [localErr, setLocalErr] = useState('');

  const changeJob = (id: string) => {
    setJobId(id);
    const j = jobs.find((x: any) => x._id === id);
    if (j && !editing) {
      setAmount(j.pending > 0 ? String(j.pending) : '');
      if (!typeTouched) setType(j.pending > 0 ? 'Final Payment' : 'Part Payment');
    }
  };
  const changeAmount = (v: string) => {
    setAmount(v);
    if (!typeTouched) setType(suggestType(Number(v) || 0));
  };

  const amt = Number(amount) || 0;
  const over = job && job.status !== 'Cancelled' && amt > balance ? amt - balance : 0;

  const submit = () => {
    if (!jobId) return setLocalErr('Pick a job');
    if (!(amt > 0)) return setLocalErr('Enter an amount greater than 0');
    if (!date) return setLocalErr('Pick a payment date');
    setLocalErr('');
    onSave({ jobId, amount: amt, paymentDate: date, paymentMethod: method, paymentType: type, reference, remarks });
  };

  return (
    <ModalShell title={editing ? 'Edit Payment' : 'Record Payment'} onClose={onClose} onSave={submit} saving={saving} error={localErr || error} saveLabel={editing ? 'Save' : 'Record Payment'}>
      <div>
        <label className={labelCls}>Job *</label>
        <select className={inputCls} value={jobId} disabled={editing || !!lockedJobId} onChange={(e) => changeJob(e.target.value)}>
          {jobs.length === 0 && <option value="">No jobs yet — add a job first</option>}
          {jobs.map((j: any) => (
            <option key={j._id} value={j._id}>{j.title} — {j.freelancerName}{j.pending > 0 ? ` (${formatCurrency(j.pending)} pending)` : ''}</option>
          ))}
        </select>
      </div>

      {job && (
        <div className="grid grid-cols-3 gap-2 text-center bg-gray-50 border rounded-xl p-3">
          <div><p className="text-[11px] text-gray-500">Payable</p><p className="text-sm font-bold">{formatCurrency(job.payable)}</p></div>
          <div><p className="text-[11px] text-gray-500">Paid so far</p><p className="text-sm font-bold text-emerald-600">{formatCurrency(job.paid)}</p></div>
          <div><p className="text-[11px] text-gray-500">Pending</p><p className="text-sm font-bold text-red-500">{formatCurrency(job.pending)}</p></div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div><label className={labelCls}>Amount (₹) *</label><input type="number" min="0" className={inputCls} value={amount} onChange={(e) => changeAmount(e.target.value)} /></div>
        <div><label className={labelCls}>Date *</label><input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} /></div>
      </div>
      {over > 0 && <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">This is {formatCurrency(over)} more than what's pending — the job will show as Overpaid. Raise the job's extra charges if this is a bonus.</p>}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Paid via</label>
          <select className={inputCls} value={method} onChange={(e) => setMethod(e.target.value)}>{PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}</select>
        </div>
        <div>
          <label className={labelCls}>Payment type</label>
          <select className={inputCls} value={type} onChange={(e) => { setType(e.target.value); setTypeTouched(true); }}>{PAYMENT_TYPES.map((t) => <option key={t}>{t}</option>)}</select>
        </div>
      </div>
      <div><label className={labelCls}>Reference / transaction ID</label><input className={inputCls} value={reference} onChange={(e) => setReference(e.target.value)} placeholder="UPI ref, cheque no. …" /></div>
      <div><label className={labelCls}>Remarks</label><input className={inputCls} value={remarks} onChange={(e) => setRemarks(e.target.value)} /></div>
    </ModalShell>
  );
};