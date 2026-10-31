import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { emiApi } from '../services/api';
import { formatCurrency, formatDate, getStatusColor } from '../lib/utils';
import { Plus, ChevronDown, ChevronRight, Trash2, Pencil } from 'lucide-react';

const LoanModal = ({ initial, onSave, onClose }: any) => {
  const [form, setForm] = useState({
    name: initial?.name || '',
    originalAmount: initial?.originalAmount ?? '',
    monthlyEMI: initial?.monthlyEMI ?? '',
    startDate: initial?.startDate ? new Date(initial.startDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
  });
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));
  const isEdit = !!initial;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <h2 className="text-lg font-bold mb-4">{isEdit ? 'Edit Loan / EMI' : 'Add Loan / EMI'}</h2>
        <div className="space-y-3">
          <div><label className="text-sm font-medium text-gray-700">Loan Name *</label><input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Office Equipment Loan" /></div>
          <div><label className="text-sm font-medium text-gray-700">Original Amount (₹) *</label><input type="number" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" value={form.originalAmount} onChange={e => set('originalAmount', e.target.value)} /></div>
          <div><label className="text-sm font-medium text-gray-700">Monthly EMI (₹) *</label><input type="number" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" value={form.monthlyEMI} onChange={e => set('monthlyEMI', e.target.value)} /></div>
          <div><label className="text-sm font-medium text-gray-700">Start Date *</label><input type="date" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" value={form.startDate} onChange={e => set('startDate', e.target.value)} /></div>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 border rounded-lg py-2 text-sm font-medium hover:bg-gray-50">Cancel</button>
          <button onClick={() => onSave({ ...form, originalAmount: Number(form.originalAmount), monthlyEMI: Number(form.monthlyEMI) })} className="flex-1 bg-primary text-white rounded-lg py-2 text-sm font-medium hover:bg-primary/90">{isEdit ? 'Save Changes' : 'Save'}</button>
        </div>
      </div>
    </div>
  );
};

const PayEMIModal = ({ loan, onSave, onClose }: any) => {
  const [form, setForm] = useState({ amount: loan.monthlyEMI, paymentDate: new Date().toISOString().split('T')[0], remarks: '' });
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <h2 className="text-lg font-bold mb-1">Record EMI Payment</h2>
        <p className="text-sm text-gray-500 mb-4">{loan.name}</p>
        <div className="space-y-3">
          <div><label className="text-sm font-medium text-gray-700">Amount (₹) *</label><input type="number" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" value={form.amount} onChange={e => set('amount', e.target.value)} /></div>
          <div><label className="text-sm font-medium text-gray-700">Payment Date *</label><input type="date" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" value={form.paymentDate} onChange={e => set('paymentDate', e.target.value)} /></div>
          <div><label className="text-sm font-medium text-gray-700">Remarks</label><input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" value={form.remarks} onChange={e => set('remarks', e.target.value)} /></div>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 border rounded-lg py-2 text-sm font-medium hover:bg-gray-50">Cancel</button>
          <button onClick={() => onSave({ loanId: loan._id, ...form, amount: Number(form.amount) })} className="flex-1 bg-primary text-white rounded-lg py-2 text-sm font-medium hover:bg-primary/90">Record Payment</button>
        </div>
      </div>
    </div>
  );
};

export default function EMIPage() {
  const qc = useQueryClient();
  const [addLoan, setAddLoan] = useState(false);
  const [editLoan, setEditLoan] = useState<any>(null);
  const [payEMI, setPayEMI] = useState<any>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: loans = [], isLoading } = useQuery({
    queryKey: ['loans'],
    queryFn: () => emiApi.getLoans().then(r => r.data),
  });

  const { data: loanDetail } = useQuery({
    queryKey: ['loan', expanded],
    queryFn: () => emiApi.getLoan(expanded!).then(r => r.data),
    enabled: !!expanded,
  });

  const createLoan = useMutation({ mutationFn: (d: any) => emiApi.createLoan(d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['loans'] }); setAddLoan(false); } });
  const updateLoan = useMutation({
    mutationFn: ({ id, data }: any) => emiApi.updateLoan(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['loans'] }); qc.invalidateQueries({ queryKey: ['loan', expanded] }); setEditLoan(null); },
  });
  const deleteLoan = useMutation({
    mutationFn: (id: string) => emiApi.deleteLoan(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['loans'] }); setExpanded(null); },
  });
  const recordPayment = useMutation({
    mutationFn: (d: any) => emiApi.recordPayment(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['loans'] }); qc.invalidateQueries({ queryKey: ['loan', expanded] }); setPayEMI(null); },
  });
  const deletePayment = useMutation({
    mutationFn: (id: string) => emiApi.deletePayment(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['loans'] }); qc.invalidateQueries({ queryKey: ['loan', expanded] }); },
  });

  const totalEMI = loans.filter((l: any) => l.status === 'Active').reduce((s: number, l: any) => s + l.monthlyEMI, 0);
  const totalRemaining = loans.filter((l: any) => l.status === 'Active').reduce((s: number, l: any) => s + l.remainingAmount, 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">EMI Tracker</h1>
          <p className="text-gray-500 text-sm mt-1">Loan & EMI management</p>
        </div>
        <button onClick={() => setAddLoan(true)} className="flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90">
          <Plus className="w-4 h-4" /> Add Loan
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border p-5">
          <p className="text-xs text-gray-500 uppercase mb-1">Monthly EMI Burden</p>
          <p className="text-2xl font-bold text-orange-500">{formatCurrency(totalEMI)}</p>
        </div>
        <div className="bg-white rounded-xl border p-5">
          <p className="text-xs text-gray-500 uppercase mb-1">Total Remaining</p>
          <p className="text-2xl font-bold text-red-500">{formatCurrency(totalRemaining)}</p>
        </div>
      </div>

      {isLoading ? <div className="text-center py-8 text-gray-400">Loading...</div> : (
        <div className="space-y-3">
          {loans.map((loan: any) => {
            const paidPct = Math.min(100, ((loan.originalAmount - loan.remainingAmount) / loan.originalAmount) * 100);
            const isOpen = expanded === loan._id;
            return (
              <div key={loan._id} className="bg-white rounded-xl border overflow-hidden">
                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-gray-900">{loan.name}</h3>
                      <p className="text-xs text-gray-400 mt-0.5">Started {formatDate(loan.startDate)}</p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full border font-medium ${getStatusColor(loan.status)}`}>{loan.status}</span>
                  </div>
                  <div className="flex justify-end gap-2 -mt-2 mb-2">
                    <button onClick={() => setEditLoan(loan)} className="p-1.5 hover:bg-gray-100 rounded" title="Edit loan">
                      <Pencil className="w-3.5 h-3.5 text-gray-400" />
                    </button>
                    <button onClick={() => { if (confirm(`Delete "${loan.name}" and all its payment history? This cannot be undone.`)) deleteLoan.mutate(loan._id); }} className="p-1.5 hover:bg-red-50 rounded" title="Delete loan">
                      <Trash2 className="w-3.5 h-3.5 text-red-400" />
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-3 mb-3 text-sm">
                    <div><p className="text-gray-400 text-xs">Original</p><p className="font-semibold">{formatCurrency(loan.originalAmount)}</p></div>
                    <div><p className="text-gray-400 text-xs">Monthly EMI</p><p className="font-semibold text-orange-500">{formatCurrency(loan.monthlyEMI)}</p></div>
                    <div><p className="text-gray-400 text-xs">Remaining</p><p className="font-semibold text-red-500">{formatCurrency(loan.remainingAmount)}</p></div>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2 mb-4">
                    <div className="bg-emerald-500 h-2 rounded-full" style={{ width: `${paidPct}%` }} />
                  </div>
                  <div className="flex gap-2">
                    {loan.status === 'Active' && (
                      <button onClick={() => setPayEMI(loan)} className="flex-1 bg-orange-500 text-white rounded-lg py-2 text-xs font-medium hover:bg-orange-600">Pay EMI</button>
                    )}
                    <button onClick={() => setExpanded(isOpen ? null : loan._id)} className="flex items-center gap-1 border rounded-lg px-3 py-2 text-xs font-medium hover:bg-gray-50">
                      {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />} History
                    </button>
                  </div>
                </div>

                {isOpen && loanDetail && (
                  <div className="border-t bg-gray-50 p-4">
                    <h4 className="text-sm font-semibold mb-3">Payment History</h4>
                    {loanDetail.payments?.length === 0 ? (
                      <p className="text-xs text-gray-400 text-center py-4">No payments recorded</p>
                    ) : (
                      <div className="space-y-2">
                        {loanDetail.payments?.map((p: any) => (
                          <div key={p._id} className="flex items-center justify-between bg-white rounded-lg border px-3 py-2.5 text-sm">
                            <div>
                              <span className="font-semibold text-emerald-600">{formatCurrency(p.amount)}</span>
                              <span className="text-xs text-gray-400 ml-2">{formatDate(p.paymentDate)}</span>
                              {p.remarks && <span className="text-xs text-gray-400 ml-2">· {p.remarks}</span>}
                            </div>
                            <button onClick={() => { if (confirm('Delete payment?')) deletePayment.mutate(p._id); }} className="p-1 hover:bg-red-50 rounded">
                              <Trash2 className="w-3.5 h-3.5 text-red-400" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {addLoan && <LoanModal onSave={(d: any) => createLoan.mutate(d)} onClose={() => setAddLoan(false)} />}
      {editLoan && <LoanModal initial={editLoan} onSave={(d: any) => updateLoan.mutate({ id: editLoan._id, data: d })} onClose={() => setEditLoan(null)} />}
      {payEMI && <PayEMIModal loan={payEMI} onSave={(d: any) => recordPayment.mutate(d)} onClose={() => setPayEMI(null)} />}
    </div>
  );
}