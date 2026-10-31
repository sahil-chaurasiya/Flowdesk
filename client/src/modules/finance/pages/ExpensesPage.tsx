import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { expensesApi } from '../services/api';
import { formatCurrency, formatDate, getCurrentMonthYear, MONTHS } from '../lib/utils';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const CATEGORIES = ['Rent', 'Internet', 'Electricity', 'Software', 'Marketing', 'Travel', 'Miscellaneous'];
const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#6b7280'];

const ExpenseModal = ({ initial, onSave, onClose }: any) => {
  const [form, setForm] = useState(initial || { title: '', category: 'Rent', amount: '', expenseDate: new Date().toISOString().split('T')[0], remarks: '' });
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <h2 className="text-lg font-bold mb-4">{initial ? 'Edit Expense' : 'Add Expense'}</h2>
        <div className="space-y-3">
          <div><label className="text-sm font-medium text-gray-700">Title *</label><input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" value={form.title} onChange={e => set('title', e.target.value)} placeholder="Office Rent" /></div>
          <div>
            <label className="text-sm font-medium text-gray-700">Category *</label>
            <select className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" value={form.category} onChange={e => set('category', e.target.value)}>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div><label className="text-sm font-medium text-gray-700">Amount (₹) *</label><input type="number" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" value={form.amount} onChange={e => set('amount', e.target.value)} /></div>
          <div><label className="text-sm font-medium text-gray-700">Date *</label><input type="date" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" value={form.expenseDate?.split('T')[0] || ''} onChange={e => set('expenseDate', e.target.value)} /></div>
          <div><label className="text-sm font-medium text-gray-700">Remarks</label><input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" value={form.remarks} onChange={e => set('remarks', e.target.value)} /></div>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 border rounded-lg py-2 text-sm font-medium hover:bg-gray-50">Cancel</button>
          <button onClick={() => onSave({ ...form, amount: Number(form.amount) })} className="flex-1 bg-primary text-white rounded-lg py-2 text-sm font-medium hover:bg-primary/90">Save</button>
        </div>
      </div>
    </div>
  );
};

export default function ExpensesPage() {
  const qc = useQueryClient();
  const { month, year } = getCurrentMonthYear();
  const [selMonth, setSelMonth] = useState(month);
  const [selYear, setSelYear] = useState(year);
  const [catFilter, setCatFilter] = useState('All');
  const [modal, setModal] = useState<any>(null);

  const { data: summary } = useQuery({
    queryKey: ['expense-summary', selMonth, selYear],
    queryFn: () => expensesApi.getMonthlySummary(selMonth, selYear).then(r => r.data),
  });

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ['expenses', selMonth, selYear, catFilter],
    queryFn: () => expensesApi.getAll({ month: selMonth, year: selYear, category: catFilter !== 'All' ? catFilter : undefined }).then(r => r.data),
  });

  const createMut = useMutation({ mutationFn: (d: any) => expensesApi.create(d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['expenses'] }); qc.invalidateQueries({ queryKey: ['expense-summary'] }); setModal(null); } });
  const updateMut = useMutation({ mutationFn: ({ id, d }: any) => expensesApi.update(id, d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['expenses'] }); qc.invalidateQueries({ queryKey: ['expense-summary'] }); setModal(null); } });
  const deleteMut = useMutation({ mutationFn: (id: string) => expensesApi.delete(id), onSuccess: () => { qc.invalidateQueries({ queryKey: ['expenses'] }); qc.invalidateQueries({ queryKey: ['expense-summary'] }); } });

  const handleSave = (form: any) => modal?._id ? updateMut.mutate({ id: modal._id, d: form }) : createMut.mutate(form);

  const pieData = summary ? Object.entries(summary.byCategory || {}).map(([name, value]) => ({ name, value })) : [];
  const years = Array.from({ length: 3 }, (_, i) => year - i);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Expenses</h1>
          <p className="text-gray-500 text-sm mt-1">Track all office expenses</p>
        </div>
        <button onClick={() => setModal({})} className="flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90">
          <Plus className="w-4 h-4" /> Add Expense
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <select className="border rounded-lg px-3 py-2 text-sm" value={selMonth} onChange={e => setSelMonth(Number(e.target.value))}>
          {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
        </select>
        <select className="border rounded-lg px-3 py-2 text-sm" value={selYear} onChange={e => setSelYear(Number(e.target.value))}>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select className="border rounded-lg px-3 py-2 text-sm" value={catFilter} onChange={e => setCatFilter(e.target.value)}>
          <option>All</option>
          {CATEGORIES.map(c => <option key={c}>{c}</option>)}
        </select>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-xl border p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Expenses — {MONTHS[selMonth - 1]} {selYear}</p>
              <p className="text-2xl font-bold text-red-500">{formatCurrency(summary?.total || 0)}</p>
            </div>
          </div>

          <div className="bg-white rounded-xl border overflow-hidden">
            {isLoading ? <div className="p-8 text-center text-gray-400">Loading...</div> : expenses.length === 0 ? (
              <div className="p-8 text-center text-gray-400">No expenses for this period</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>{['Title', 'Category', 'Amount', 'Date', 'Remarks', ''].map(h => <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y">
                  {expenses.map((e: any) => (
                    <tr key={e._id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{e.title}</td>
                      <td className="px-4 py-3"><span className="bg-indigo-50 text-indigo-600 text-xs px-2 py-0.5 rounded">{e.category}</span></td>
                      <td className="px-4 py-3 font-semibold text-red-500">{formatCurrency(e.amount)}</td>
                      <td className="px-4 py-3 text-gray-400">{formatDate(e.expenseDate)}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{e.remarks}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button onClick={() => setModal(e)} className="p-1.5 hover:bg-gray-100 rounded"><Pencil className="w-3.5 h-3.5 text-gray-500" /></button>
                          <button onClick={() => { if (confirm('Delete?')) deleteMut.mutate(e._id); }} className="p-1.5 hover:bg-red-50 rounded"><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {pieData.length > 0 && (
          <div className="bg-white rounded-xl border p-5">
            <h3 className="font-semibold mb-4">By Category</h3>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                  {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: any) => formatCurrency(v)} />
                <Legend iconType="circle" iconSize={8} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2 mt-2">
              {Object.entries(summary?.byCategory || {}).map(([cat, amt]: any, i) => (
                <div key={cat} className="flex justify-between text-sm">
                  <span className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: COLORS[i % COLORS.length] }} />{cat}</span>
                  <span className="font-medium">{formatCurrency(amt)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {modal !== null && (
        <ExpenseModal initial={modal._id ? modal : undefined} onSave={handleSave} onClose={() => setModal(null)} />
      )}
    </div>
  );
}
