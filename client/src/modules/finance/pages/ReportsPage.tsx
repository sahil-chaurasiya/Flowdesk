import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { reportsApi } from '../services/api';
import { formatCurrency, formatDate } from '../lib/utils';
import { FileText, Download } from 'lucide-react';

const REPORT_TYPES = [
  { value: 'revenue', label: 'Revenue Report', desc: 'All client payments in period' },
  { value: 'expense', label: 'Expense Report', desc: 'All office expenses in period' },
  { value: 'profit', label: 'Profit Report', desc: 'P&L summary for period' },
  { value: 'collection', label: 'Collection Report', desc: 'Collection status per client' },
  { value: 'freelancer', label: 'Freelancer Report', desc: 'All freelancer payments in period' },
];

export default function ReportsPage() {
  const today = new Date().toISOString().split('T')[0];
  const firstDay = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

  const [reportType, setReportType] = useState('revenue');
  const [startDate, setStartDate] = useState(firstDay);
  const [endDate, setEndDate] = useState(today);
  const [generate, setGenerate] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['report', reportType, startDate, endDate, generate],
    queryFn: () => reportsApi.get({ type: reportType, startDate, endDate }).then(r => r.data),
    enabled: generate,
  });

  const handleGenerate = () => setGenerate(true);

  const exportCSV = () => {
    if (!data) return;
    let rows: string[] = [];
    if (reportType === 'revenue' && data.payments) {
      rows = ['Client,Amount,Date,Method,Remarks', ...data.payments.map((p: any) => `"${typeof p.clientId === 'object' ? p.clientId.name : p.clientId}",${p.amount},${formatDate(p.paymentDate)},${p.paymentMethod},"${p.remarks}"`)];
    } else if (reportType === 'expense' && data.expenses) {
      rows = ['Title,Category,Amount,Date,Remarks', ...data.expenses.map((e: any) => `"${e.title}",${e.category},${e.amount},${formatDate(e.expenseDate)},"${e.remarks}"`)];
    } else if (reportType === 'profit') {
      rows = ['Metric,Amount', `Income,${data.income}`, `Office Expenses,${data.expenseTotal}`, `Salary,${data.salaryTotal}`, `EMI,${data.emiTotal}`, `Freelancers,${data.freelancerTotal || 0}`, `Net Profit,${data.profit}`];
    } else if (reportType === 'freelancer' && data.freelancerPayments) {
      rows = ['Freelancer,Job,Type,Method,Amount,Date,Reference', ...data.freelancerPayments.map((p: any) => `"${p.freelancerId?.name || ''}","${p.jobId?.title || ''}",${p.paymentType},${p.paymentMethod},${p.amount},${formatDate(p.paymentDate)},"${p.reference || ''}"`)];
    } else if (reportType === 'collection' && data.collection) {
      rows = ['Client,Contract Value,Collected', ...data.collection.map((c: any) => `"${c.clientName}",${c.contractValue},${c.collected}`)];
    }
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${reportType}-report.csv`; a.click();
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        <p className="text-gray-500 text-sm mt-1">Generate financial reports for any period</p>
      </div>

      {/* Report type selection */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {REPORT_TYPES.map(rt => (
          <button key={rt.value} onClick={() => { setReportType(rt.value); setGenerate(false); }} className={`text-left p-4 rounded-xl border transition ${reportType === rt.value ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'bg-white hover:border-gray-300'}`}>
            <FileText className={`w-5 h-5 mb-2 ${reportType === rt.value ? 'text-primary' : 'text-gray-400'}`} />
            <p className="text-sm font-semibold">{rt.label}</p>
            <p className="text-xs text-gray-400 mt-0.5">{rt.desc}</p>
          </button>
        ))}
      </div>

      {/* Date range */}
      <div className="bg-white rounded-xl border p-5">
        <h3 className="font-semibold mb-4">Date Range</h3>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="text-sm text-gray-500 mb-1 block">From</label>
            <input type="date" className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" value={startDate} onChange={e => { setStartDate(e.target.value); setGenerate(false); }} />
          </div>
          <div>
            <label className="text-sm text-gray-500 mb-1 block">To</label>
            <input type="date" className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" value={endDate} onChange={e => { setEndDate(e.target.value); setGenerate(false); }} />
          </div>
          <button onClick={handleGenerate} className="bg-primary text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-primary/90">Generate Report</button>
          {data && <button onClick={exportCSV} className="flex items-center gap-2 border border-gray-300 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50"><Download className="w-4 h-4" /> Export CSV</button>}
        </div>
      </div>

      {/* Report Output */}
      {generate && (
        <div className="bg-white rounded-xl border overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center text-gray-400">Generating report...</div>
          ) : !data ? (
            <div className="p-8 text-center text-gray-400">No data found</div>
          ) : (
            <div className="p-5">
              <div className="flex items-center justify-between mb-5 pb-4 border-b">
                <div>
                  <h3 className="font-bold text-lg">{REPORT_TYPES.find(r => r.value === reportType)?.label}</h3>
                  <p className="text-sm text-gray-400">{formatDate(startDate)} — {formatDate(endDate)}</p>
                </div>
              </div>

              {/* Revenue */}
              {reportType === 'revenue' && data.payments && (
                <div>
                  <div className="mb-4 p-4 bg-emerald-50 rounded-lg">
                    <p className="text-sm text-emerald-600">Total Revenue</p>
                    <p className="text-2xl font-bold text-emerald-700">{formatCurrency(data.total)}</p>
                  </div>
                  <table className="w-full text-sm">
                    <thead><tr className="border-b">{['Client', 'Amount', 'Date', 'Method'].map(h => <th key={h} className="text-left py-2 px-3 text-xs text-gray-500 uppercase">{h}</th>)}</tr></thead>
                    <tbody>{data.payments.map((p: any) => <tr key={p._id} className="border-b hover:bg-gray-50"><td className="py-2.5 px-3 font-medium">{typeof p.clientId === 'object' ? p.clientId.name : p.clientId}</td><td className="py-2.5 px-3 text-emerald-600 font-medium">{formatCurrency(p.amount)}</td><td className="py-2.5 px-3 text-gray-400">{formatDate(p.paymentDate)}</td><td className="py-2.5 px-3"><span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded">{p.paymentMethod}</span></td></tr>)}</tbody>
                  </table>
                </div>
              )}

              {/* Expense */}
              {reportType === 'expense' && data.expenses && (
                <div>
                  <div className="mb-4 p-4 bg-red-50 rounded-lg">
                    <p className="text-sm text-red-600">Total Expenses</p>
                    <p className="text-2xl font-bold text-red-700">{formatCurrency(data.total)}</p>
                  </div>
                  <table className="w-full text-sm">
                    <thead><tr className="border-b">{['Title', 'Category', 'Amount', 'Date'].map(h => <th key={h} className="text-left py-2 px-3 text-xs text-gray-500 uppercase">{h}</th>)}</tr></thead>
                    <tbody>{data.expenses.map((e: any) => <tr key={e._id} className="border-b hover:bg-gray-50"><td className="py-2.5 px-3 font-medium">{e.title}</td><td className="py-2.5 px-3"><span className="bg-indigo-50 text-indigo-600 text-xs px-2 py-0.5 rounded">{e.category}</span></td><td className="py-2.5 px-3 text-red-500 font-medium">{formatCurrency(e.amount)}</td><td className="py-2.5 px-3 text-gray-400">{formatDate(e.expenseDate)}</td></tr>)}</tbody>
                  </table>
                </div>
              )}

              {/* Profit */}
              {reportType === 'profit' && (
                <div className="space-y-3 max-w-md">
                  {[
                    { label: 'Total Revenue', value: data.income, color: 'text-emerald-600' },
                    { label: 'Office Expenses', value: -data.expenseTotal, color: 'text-red-500' },
                    { label: 'Salary Expenses', value: -data.salaryTotal, color: 'text-red-500' },
                    { label: 'EMI Payments', value: -data.emiTotal, color: 'text-red-500' },
                    { label: 'Freelancer Payments', value: -(data.freelancerTotal || 0), color: 'text-red-500' },
                  ].map(row => (
                    <div key={row.label} className="flex justify-between py-3 border-b text-sm">
                      <span className="text-gray-600">{row.label}</span>
                      <span className={`font-semibold ${row.color}`}>{formatCurrency(Math.abs(row.value))}</span>
                    </div>
                  ))}
                  <div className={`flex justify-between pt-3 border-t-2 ${data.profit >= 0 ? 'border-emerald-400' : 'border-red-400'}`}>
                    <span className="font-bold text-lg">Net Profit</span>
                    <span className={`font-bold text-2xl ${data.profit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{formatCurrency(data.profit)}</span>
                  </div>
                </div>
              )}

              {/* Freelancer */}
              {reportType === 'freelancer' && data.freelancerPayments && (
                <div>
                  <div className="mb-4 p-4 bg-red-50 rounded-lg">
                    <p className="text-sm text-red-600">Total Paid to Freelancers</p>
                    <p className="text-2xl font-bold text-red-700">{formatCurrency(data.total)}</p>
                  </div>
                  <table className="w-full text-sm">
                    <thead><tr className="border-b">{['Freelancer', 'Job', 'Type', 'Amount', 'Date', 'Method'].map(h => <th key={h} className="text-left py-2 px-3 text-xs text-gray-500 uppercase">{h}</th>)}</tr></thead>
                    <tbody>{data.freelancerPayments.map((p: any) => <tr key={p._id} className="border-b hover:bg-gray-50"><td className="py-2.5 px-3 font-medium">{p.freelancerId?.name || 'Unknown'}</td><td className="py-2.5 px-3 text-gray-600">{p.jobId?.title || '—'}</td><td className="py-2.5 px-3"><span className="bg-indigo-50 text-indigo-600 text-xs px-2 py-0.5 rounded">{p.paymentType}</span></td><td className="py-2.5 px-3 text-red-500 font-medium">{formatCurrency(p.amount)}</td><td className="py-2.5 px-3 text-gray-400">{formatDate(p.paymentDate)}</td><td className="py-2.5 px-3"><span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded">{p.paymentMethod}</span></td></tr>)}</tbody>
                  </table>
                </div>
              )}

              {/* Collection */}
              {reportType === 'collection' && data.collection && (
                <table className="w-full text-sm">
                  <thead><tr className="border-b">{['Client', 'Contract Value', 'Collected', 'Pending', 'Status'].map(h => <th key={h} className="text-left py-2 px-3 text-xs text-gray-500 uppercase">{h}</th>)}</tr></thead>
                  <tbody>
                    {data.collection.map((c: any) => {
                      const pending = c.contractValue - c.collected;
                      const status = c.collected >= c.contractValue ? 'Paid' : c.collected > 0 ? 'Partial' : 'Pending';
                      return (
                        <tr key={c.clientName} className="border-b hover:bg-gray-50">
                          <td className="py-2.5 px-3 font-medium">{c.clientName}</td>
                          <td className="py-2.5 px-3">{formatCurrency(c.contractValue)}</td>
                          <td className="py-2.5 px-3 text-emerald-600 font-medium">{formatCurrency(c.collected)}</td>
                          <td className="py-2.5 px-3 text-red-500">{formatCurrency(Math.max(0, pending))}</td>
                          <td className="py-2.5 px-3"><span className={`text-xs px-2 py-1 rounded-full font-medium ${status === 'Paid' ? 'bg-emerald-100 text-emerald-700' : status === 'Partial' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>{status}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}