import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { accountingApi } from '../services/api';
import { formatCurrency, getCurrentMonthYear, MONTHS } from '../lib/utils';
import { Save, TrendingUp, TrendingDown } from 'lucide-react';

export default function AccountingPage() {
  const qc = useQueryClient();
  const { month, year } = getCurrentMonthYear();
  const [selMonth, setSelMonth] = useState(month);
  const [selYear, setSelYear] = useState(year);
  const [openingBalance, setOpeningBalance] = useState('');
  const [reservedAmount, setReservedAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [saved, setSaved] = useState(false);

  const { data: summary, isLoading } = useQuery({
    queryKey: ['accounting', selMonth, selYear],
    queryFn: () => accountingApi.getMonth(selMonth, selYear).then(r => {
      const d = r.data;
      setOpeningBalance(String(d.openingBalance || 0));
      setReservedAmount(String(d.reservedAmount || 0));
      setNotes(d.notes || '');
      return d;
    }),
  });

  const { data: allRecords = [] } = useQuery({
    queryKey: ['accounting-all'],
    queryFn: () => accountingApi.getAll().then(r => r.data),
  });

  const upsertMut = useMutation({
    mutationFn: (d: any) => accountingApi.upsert(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['accounting'] }); qc.invalidateQueries({ queryKey: ['accounting-all'] }); setSaved(true); setTimeout(() => setSaved(false), 2000); },
  });

  const years = Array.from({ length: 3 }, (_, i) => year - i);

  // Live recalculation
  const ob = Number(openingBalance) || 0;
  const ra = Number(reservedAmount) || 0;
  const income = summary?.monthlyIncome || 0;
  const salExp = summary?.salaryExpenses || 0;
  const offExp = summary?.officeExpenses || 0;
  const emiExp = summary?.emiExpenses || 0;
  const flExp = summary?.freelancerExpenses || 0;
  const totalExp = salExp + offExp + emiExp + flExp;
  const closing = ob + income - totalExp - ra;

  const handleSave = () => {
    upsertMut.mutate({ month: selMonth, year: selYear, openingBalance: ob, reservedAmount: ra, notes });
  };

  const Row = ({ label, value, color = '' }: any) => (
    <div className={`flex justify-between items-center py-3 border-b last:border-0 ${color}`}>
      <span className="text-sm text-gray-600">{label}</span>
      <span className={`font-semibold ${color}`}>{formatCurrency(value)}</span>
    </div>
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Monthly Accounting</h1>
        <p className="text-gray-500 text-sm mt-1">P&L summary by month</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <select className="border rounded-lg px-3 py-2 text-sm" value={selMonth} onChange={e => { setSelMonth(Number(e.target.value)); }}>
          {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
        </select>
        <select className="border rounded-lg px-3 py-2 text-sm" value={selYear} onChange={e => setSelYear(Number(e.target.value))}>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        {/* Input Panel */}
        <div className="bg-white rounded-xl border p-5 space-y-4">
          <h3 className="font-semibold text-gray-900">Manual Inputs</h3>
          <div>
            <label className="text-sm font-medium text-gray-700">Opening Balance (₹)</label>
            <input type="number" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" value={openingBalance} onChange={e => setOpeningBalance(e.target.value)} placeholder="0" />
            <p className="text-xs text-gray-400 mt-1">Cash/bank balance at start of month</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Reserved Amount (₹)</label>
            <input type="number" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" value={reservedAmount} onChange={e => setReservedAmount(e.target.value)} placeholder="0" />
            <p className="text-xs text-gray-400 mt-1">Amount set aside / not counted as profit</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Notes</label>
            <textarea className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any notes for this month..." />
          </div>
          <button onClick={handleSave} className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition ${saved ? 'bg-emerald-500 text-white' : 'bg-primary text-white hover:bg-primary/90'}`}>
            <Save className="w-4 h-4" /> {saved ? 'Saved!' : 'Save'}
          </button>
        </div>

        {/* Summary Panel */}
        <div className="bg-white rounded-xl border p-5">
          <h3 className="font-semibold text-gray-900 mb-4">P&L Summary — {MONTHS[selMonth - 1]} {selYear}</h3>
          {isLoading ? <div className="text-gray-400 text-sm text-center py-8">Loading...</div> : (
            <div>
              <div className="bg-blue-50 rounded-lg p-3 mb-4">
                <div className="flex items-center gap-2 mb-1"><TrendingUp className="w-4 h-4 text-blue-500" /><span className="text-sm font-medium text-blue-700">Income</span></div>
                <p className="text-xl font-bold text-blue-700">{formatCurrency(income)}</p>
                <p className="text-xs text-blue-400 mt-0.5">From client payments</p>
              </div>

              <Row label="Opening Balance" value={ob} />
              <Row label="+ Monthly Income" value={income} color="text-emerald-600" />
              <Row label="− Salary Expenses" value={salExp} color="text-red-500" />
              <Row label="− Office Expenses" value={offExp} color="text-red-500" />
              <Row label="− EMI Payments" value={emiExp} color="text-red-500" />
              <Row label="− Freelancer Payments" value={flExp} color="text-red-500" />
              <Row label="− Reserved Amount" value={ra} color="text-amber-600" />

              <div className={`flex justify-between items-center pt-3 mt-2 border-t-2 ${closing >= 0 ? 'border-emerald-300' : 'border-red-300'}`}>
                <span className="font-bold text-gray-900">Closing Balance</span>
                <span className={`text-xl font-bold ${closing >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{formatCurrency(closing)}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Historical Records */}
      {allRecords.length > 0 && (
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="px-5 py-4 border-b"><h3 className="font-semibold">Historical Summary</h3></div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>{['Month', 'Opening', 'Income', 'Expenses', 'Reserved', 'Closing', 'P&L'].map(h => <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y">
                {allRecords.map((rec: any) => (
                  <tr key={`${rec.month}-${rec.year}`} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{MONTHS[rec.month - 1]} {rec.year}</td>
                    <td className="px-4 py-3">{formatCurrency(rec.openingBalance)}</td>
                    <td className="px-4 py-3 text-emerald-600">{formatCurrency(rec.monthlyIncome)}</td>
                    <td className="px-4 py-3 text-red-500">{formatCurrency(rec.totalExpenses)}</td>
                    <td className="px-4 py-3 text-amber-600">{formatCurrency(rec.reservedAmount)}</td>
                    <td className="px-4 py-3 font-semibold">{formatCurrency(rec.closingBalance)}</td>
                    <td className="px-4 py-3">
                      <span className={`flex items-center gap-1 text-xs font-medium ${rec.monthlyIncome - rec.totalExpenses >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                        {rec.monthlyIncome - rec.totalExpenses >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {formatCurrency(rec.monthlyIncome - rec.totalExpenses)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}