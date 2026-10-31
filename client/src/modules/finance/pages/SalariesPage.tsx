import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { employeesApi, salariesApi } from '../services/api';
import { formatCurrency, formatDate, getCurrentMonthYear, MONTHS } from '../lib/utils';
import { Plus, CheckCircle, Clock, Pencil, Trash2, Undo2 } from 'lucide-react';

const todayStr = () => new Date().toISOString().split('T')[0];

const EmployeeModal = ({ initial, onSave, onClose }: any) => {
  const [form, setForm] = useState(initial || { name: '', email: '', joiningDate: '', monthlySalary: '', leavingDate: '' });
  const [salaryEffectiveFrom, setSalaryEffectiveFrom] = useState(todayStr());
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));
  const isEditing = !!initial;
  const salaryChanged = isEditing && Number(form.monthlySalary) !== Number(initial.monthlySalary);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <h2 className="text-lg font-bold mb-4">{initial ? 'Edit Employee' : 'Add Employee'}</h2>
        <div className="space-y-3">
          <div><label className="text-sm font-medium text-gray-700">Name *</label><input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" value={form.name} onChange={e => set('name', e.target.value)} /></div>
          <div><label className="text-sm font-medium text-gray-700">Email</label><input type="email" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" placeholder="Must match their attendance app login email" value={form.email || ''} onChange={e => set('email', e.target.value)} /></div>
          <div><label className="text-sm font-medium text-gray-700">Joining Date *</label><input type="date" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" value={form.joiningDate?.split('T')[0] || ''} onChange={e => set('joiningDate', e.target.value)} /></div>
          <div><label className="text-sm font-medium text-gray-700">Monthly Salary (₹) *</label><input type="number" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" value={form.monthlySalary} onChange={e => set('monthlySalary', e.target.value)} /></div>
          {salaryChanged && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <label className="text-sm font-medium text-amber-800">Salary change effective from</label>
              <input type="date" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" value={salaryEffectiveFrom} onChange={e => setSalaryEffectiveFrom(e.target.value)} />
              <p className="text-[11px] text-amber-700 mt-1">Past months keep the old salary — this hike only applies from the date above onward.</p>
            </div>
          )}
          {isEditing && (
            <div>
              <label className="text-sm font-medium text-gray-700">Leaving Date</label>
              <input type="date" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" value={form.leavingDate?.split('T')[0] || ''} onChange={e => set('leavingDate', e.target.value)} />
              <p className="text-[11px] text-gray-400 mt-1">Only fill this in once they've actually left. Their salary for that month is prorated to the days worked, and they stop appearing from the following month onward. Clear this field to undo.</p>
            </div>
          )}
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 border rounded-lg py-2 text-sm font-medium hover:bg-gray-50">Cancel</button>
          <button onClick={() => onSave({ ...form, monthlySalary: Number(form.monthlySalary), ...(salaryChanged ? { salaryEffectiveFrom } : {}) })} className="flex-1 bg-primary text-white rounded-lg py-2 text-sm font-medium hover:bg-primary/90">Save</button>
        </div>
      </div>
    </div>
  );
};

export default function SalariesPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'summary' | 'employees'>('summary');
  const { month, year } = getCurrentMonthYear();
  const [selMonth, setSelMonth] = useState(month);
  const [selYear, setSelYear] = useState(year);
  const [empModal, setEmpModal] = useState<any>(null);

  const { data: summary, isLoading } = useQuery({
    queryKey: ['salary-summary', selMonth, selYear],
    queryFn: () => salariesApi.getMonthlySummary(selMonth, selYear).then(r => r.data),
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: () => employeesApi.getAll().then(r => r.data),
  });

  const createEmp = useMutation({ mutationFn: (d: any) => employeesApi.create(d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['employees'] }); setEmpModal(null); } });
  const updateEmp = useMutation({ mutationFn: ({ id, d }: any) => employeesApi.update(id, d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['employees'] }); setEmpModal(null); } });
  const deleteEmp = useMutation({ mutationFn: (id: string) => employeesApi.delete(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['employees'] }) });
  const markPaid = useMutation({
    mutationFn: ({ emp, rec }: any) => {
      // Use the salary that applied for this specific month (not whatever
      // the employee's current salary happens to be), so a later hike
      // doesn't change what an already-paid month shows as paid.
      const amount = emp.monthlySalaryForMonth ?? emp.employee.monthlySalary;
      if (rec) return salariesApi.update(rec._id, { status: 'Paid', amountPaid: amount, paidDate: new Date() });
      return salariesApi.create({ employeeId: emp.employee._id, month: selMonth, year: selYear, amountPaid: amount, paidDate: new Date(), status: 'Paid' });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['salary-summary'] }),
  });
  const revertPaid = useMutation({
    mutationFn: (recId: string) => salariesApi.revert(recId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['salary-summary'] }),
  });

  const years = Array.from({ length: 3 }, (_, i) => year - i);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Salaries</h1>
          <p className="text-gray-500 text-sm mt-1">Manage employee salaries</p>
        </div>
        <button onClick={() => setEmpModal({})} className="flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90">
          <Plus className="w-4 h-4" /> Add Employee
        </button>
      </div>

      <div className="flex gap-2 border-b">
        {(['summary', 'employees'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2.5 text-sm font-medium capitalize border-b-2 transition ${tab === t ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{t === 'summary' ? 'Monthly Summary' : 'Employee Register'}</button>
        ))}
      </div>

      {tab === 'summary' && (
        <div className="space-y-5">
          <div className="flex gap-3">
            <select className="border rounded-lg px-3 py-2 text-sm" value={selMonth} onChange={e => setSelMonth(Number(e.target.value))}>
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
            <select className="border rounded-lg px-3 py-2 text-sm" value={selYear} onChange={e => setSelYear(Number(e.target.value))}>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <p className="text-xs text-gray-400">Absent days = same as your attendance app's own count (no full check-in + check-out, including approved leave days) · first absent day/month forgiven, every day beyond that is deducted</p>

          {summary && (
            <>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-white rounded-xl border p-4"><p className="text-xs text-gray-500 mb-1">Total Due</p><p className="text-xl font-bold">{formatCurrency(summary.totalDue)}</p></div>
                <div className="bg-white rounded-xl border p-4"><p className="text-xs text-gray-500 mb-1">Paid</p><p className="text-xl font-bold text-emerald-600">{formatCurrency(summary.totalPaid)}</p></div>
                <div className="bg-white rounded-xl border p-4"><p className="text-xs text-gray-500 mb-1">Pending</p><p className="text-xl font-bold text-red-500">{formatCurrency(summary.totalPending)}</p></div>
              </div>

              <div className="bg-white rounded-xl border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      {['Employee', 'Actual Salary', 'Absent Days', 'Calculated Salary', 'Status', 'Amount Paid', 'Action'].map(h => <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">{h}</th>)}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {summary.summary?.map((row: any) => {
                      const actualSalary = row.monthlySalaryForMonth ?? row.employee.monthlySalary;
                      const hasDeduction = row.attendanceSynced && row.calculatedSalary < actualSalary;
                      const leftThisMonth = row.employee.leavingDate && (() => {
                        const d = new Date(row.employee.leavingDate);
                        return d.getFullYear() === selYear && d.getMonth() + 1 === selMonth;
                      })();
                      return (
                        <tr key={row.employee._id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium">
                            {row.employee.name}
                            {leftThisMonth && (
                              <span className="block text-[11px] font-normal text-amber-600">Left {formatDate(row.employee.leavingDate)} — salary prorated</span>
                            )}
                          </td>
                          <td className="px-4 py-3">{formatCurrency(actualSalary)}</td>
                          <td className="px-4 py-3">
                            {row.attendanceSynced ? (
                              <span className={`font-medium ${hasDeduction ? 'text-amber-600' : 'text-gray-700'}`}>
                                {row.leavesTaken} {row.leavesTaken === 1 ? 'day' : 'days'}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400">{row.attendanceNote || 'Not synced'}</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`font-semibold ${hasDeduction ? 'text-red-600' : 'text-gray-900'}`}>{formatCurrency(row.calculatedSalary)}</span>
                            {hasDeduction && (
                              <p className="text-[11px] text-red-400">-{formatCurrency(actualSalary - row.calculatedSalary)}</p>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`flex items-center gap-1 text-xs font-medium w-fit px-2 py-1 rounded-full ${row.status === 'Paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                              {row.status === 'Paid' ? <CheckCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />} {row.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-medium">{row.amountPaid > 0 ? formatCurrency(row.amountPaid) : '-'}</td>
                          <td className="px-4 py-3">
                            {row.status === 'Pending' ? (
                              <button onClick={() => markPaid.mutate({ emp: row, rec: row.salaryRecord })} className="text-xs bg-emerald-500 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-600">Mark Paid</button>
                            ) : (
                              <button onClick={() => { if (confirm('Revert this back to Pending?')) revertPaid.mutate(row.salaryRecord._id); }} className="flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-200">
                                <Undo2 className="w-3 h-3" /> Undo
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'employees' && (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['Name', 'Email', 'Joining Date', 'Monthly Salary', 'Status', ''].map(h => <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y">
              {employees.map((emp: any) => (
                <tr key={emp._id} className={`hover:bg-gray-50 ${emp.leavingDate ? 'opacity-60' : ''}`}>
                  <td className="px-4 py-3 font-medium">{emp.name}</td>
                  <td className="px-4 py-3 text-gray-500">{emp.email || <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-3 text-gray-500">{formatDate(emp.joiningDate)}</td>
                  <td className="px-4 py-3 font-semibold">{formatCurrency(emp.monthlySalary)}</td>
                  <td className="px-4 py-3">
                    {emp.leavingDate ? (
                      <span className="text-xs font-medium w-fit px-2 py-1 rounded-full bg-gray-100 text-gray-600">Left {formatDate(emp.leavingDate)}</span>
                    ) : (
                      <span className="text-xs font-medium w-fit px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">Active</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => setEmpModal(emp)} className="p-1.5 hover:bg-gray-100 rounded"><Pencil className="w-3.5 h-3.5 text-gray-500" /></button>
                      <button onClick={() => { if (confirm('Delete employee?')) deleteEmp.mutate(emp._id); }} className="p-1.5 hover:bg-red-50 rounded"><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {empModal !== null && (
        <EmployeeModal
          initial={empModal._id ? empModal : undefined}
          onSave={(form: any) => empModal._id ? updateEmp.mutate({ id: empModal._id, d: form }) : createEmp.mutate(form)}
          onClose={() => setEmpModal(null)}
        />
      )}
    </div>
  );
}