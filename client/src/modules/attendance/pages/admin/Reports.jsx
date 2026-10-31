import { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend,
} from 'recharts';
import api from '../../services/api';
import toast from 'react-hot-toast';
import Spinner from '../../components/common/Spinner';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[var(--fd-card-bg)] border border-white/[0.06] rounded-xl p-3 shadow-card text-xs">
      <p className="text-gray-300 font-semibold mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>{p.name}: {p.value}</p>
      ))}
    </div>
  );
};

export default function AdminReports() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear]   = useState(now.getFullYear());
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/reports/monthly', { params: { month, year } });
      setReport(data.report);
    } catch {
      toast.error('Failed to load report');
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  const fmtH = (h) => { if (!h) return '0h'; return `${Math.floor(h)}h ${Math.round((h % 1) * 60)}m`; };

  const dailyData = (report?.dailyStats || []).map(d => ({
    date: d.date.slice(5),
    Present: d.present,
    Late: d.late,
  }));

  const empData = (report?.employees || []).map(e => ({
    name: e.user?.name?.split(' ')[0] || 'N/A',
    Present: e.present,
    Late: e.late,
    Hours: parseFloat(e.totalWorkHours.toFixed(1)),
  })).slice(0, 10);

  // BUG FIX: Use working days from API response, not hardcoded 26
  // Count Mon-Sat in selected month
  const workingDaysInMonth = (() => {
    const lastDay = new Date(year, month, 0).getDate();
    let count = 0;
    for (let d = 1; d <= lastDay; d++) {
      const day = new Date(year, month - 1, d).getDay();
      if (day !== 0) count++;
    }
    return count;
  })();

  return (
    <div className="p-5 md:p-8 max-w-5xl mx-auto space-y-6 animate-fade-in">
      <h1 className="page-title">Monthly Reports</h1>

      <div className="flex gap-3">
        <select className="input flex-1" value={month} onChange={e => setMonth(Number(e.target.value))}>
          {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
        <select className="input w-28" value={year} onChange={e => setYear(Number(e.target.value))}>
          {[2024, 2025, 2026].map(y => <option key={y}>{y}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : !report ? null : (
        <>
          {/* Summary KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Total Records',  value: (report.employees || []).reduce((a, e) => a + e.present + e.late, 0), color: 'text-attbrand-500' },
              { label: 'Total Present',  value: (report.employees || []).reduce((a, e) => a + e.present, 0), color: 'text-emerald-400' },
              { label: 'Total Late',     value: (report.employees || []).reduce((a, e) => a + e.late, 0), color: 'text-amber-400' },
              { label: 'Avg Hours/Day',  value: fmtH((report.employees || []).reduce((a, e) => a + e.totalWorkHours, 0) / Math.max(1, (report.employees || []).reduce((a, e) => a + e.present + e.late, 0))), color: 'text-attbrand-600' },
            ].map(({ label, value, color }) => (
              <div key={label} className="stat-card">
                <p className="text-xs text-gray-400">{label}</p>
                <p className={`text-2xl font-display font-bold ${color}`}>{value}</p>
              </div>
            ))}
          </div>

          {/* Daily trend chart */}
          {dailyData.length > 0 && (
            <div className="rounded-2xl p-5">
              <p className="section-title mb-5">Daily Attendance Trend</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={dailyData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--fd-border)" />
                  <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Present" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Late" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Employee work hours chart */}
          {empData.length > 0 && (
            <div className="rounded-2xl p-5">
              <p className="section-title mb-5">Employee Work Hours (Top 10)</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={empData} layout="vertical" margin={{ top: 0, right: 10, left: 20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--fd-border)" horizontal={false} />
                  <XAxis type="number" tick={{ fill: '#64748b', fontSize: 11 }} />
                  <YAxis dataKey="name" type="category" tick={{ fill: '#94a3b8', fontSize: 12 }} width={70} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="Hours" fill="#6366f1" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Employee breakdown table */}
          <div className="rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-white/[0.05]">
              <p className="section-title">Employee Breakdown — {MONTHS[month - 1]} {year}</p>
              <p className="text-xs text-gray-500 mt-0.5">Working days this month: {workingDaysInMonth} (Mon–Sat)</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.05] bg-white/[0.02]">
                    {['Employee', 'Department', 'Present', 'Late', 'Total Work Hours', 'Attendance %'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {(report.employees || []).length === 0 && (
                    <tr><td colSpan={6} className="text-center py-10 text-gray-400">No data</td></tr>
                  )}
                  {(report.employees || []).map((e, i) => {
                    const total = e.present + e.late;
                    // BUG FIX: Use calculated working days, not hardcoded 26
                    const pct = total > 0 ? Math.round((total / Math.max(1, workingDaysInMonth)) * 100) : 0;
                    return (
                      <tr key={i} className="hover:bg-white/[0.03] transition-colors">
                        <td className="px-4 py-3 font-medium text-gray-200">{e.user?.name || '—'}</td>
                        <td className="px-4 py-3 text-gray-400 text-xs">{e.user?.department || '—'}</td>
                        <td className="px-4 py-3 text-emerald-400 font-semibold">{e.present}</td>
                        <td className="px-4 py-3 text-amber-400 font-semibold">{e.late}</td>
                        <td className="px-4 py-3 text-attbrand-500 font-mono text-xs">{fmtH(e.totalWorkHours)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-surface-border rounded-full h-1.5 min-w-12">
                              <div className="bg-attbrand-500 h-1.5 rounded-full" style={{ width: `${Math.min(pct, 100)}%` }} />
                            </div>
                            <span className="text-xs text-gray-400 font-mono w-8">{pct}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
