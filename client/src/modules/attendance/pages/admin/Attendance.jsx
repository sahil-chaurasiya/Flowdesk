import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import Spinner from '../../components/common/Spinner';
import StatusBadge from '../../components/common/StatusBadge';
import { enablePushNotifications, notifyNewCheckIn, notifyLowAttendance } from '../../services/notifications';

const fmt  = (d) => d ? new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '—';
const fmtH = (h) => { if (!h) return '—'; const hrs = Math.floor(h); const min = Math.round((h - hrs) * 60); return `${hrs}h ${min}m`; };
// Holiday/on-leave records never have a check-in, but they should never be
// shown or counted as "absent" either.
const isExemptStatus = (r) => r?.status === 'holiday' || r?.status === 'on_leave';
const displayStatus = (r) => (r?.checkInTime || isExemptStatus(r)) ? r.status : 'absent';
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function groupByDate(records) {
  const map = {};
  if (!Array.isArray(records)) return [];
  for (const r of records) { if (!map[r.date]) map[r.date] = []; map[r.date].push(r); }
  return Object.entries(map).sort((a, b) => b[0].localeCompare(a[0]));
}

const panelStyle = {
  background: 'var(--fd-card-bg)',
  
  border: '1px solid var(--fd-border)',
};

export default function AdminAttendance() {
  const now = new Date();
  const [month, setMonth]     = useState(now.getMonth() + 1);
  const [year, setYear]       = useState(now.getFullYear());
  const [records, setRecords] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [loading, setLoading] = useState(false);
  const [total, setTotal]     = useState(0);
  const [view, setView]       = useState('list');
  const [expandedDate, setExpandedDate] = useState(null);
  const [prevCheckedIn, setPrevCheckedIn] = useState(null);
  const [fetchError, setFetchError] = useState(false);
  const [fetchErrorDetail, setFetchErrorDetail] = useState(null);

  useEffect(() => {
    api.get('/users')
      .then(({ data }) => setEmployees(Array.isArray(data?.users) ? data.users : []))
      .catch(() => setEmployees([]));
    enablePushNotifications();
  }, []);

  const fetchRecords = useCallback(async (isRetry = false) => {
    setLoading(true);
    try {
      const params = { month, year, limit: 200 };
      if (selectedEmployee) params.userId = selectedEmployee;
      // 30s timeout: free-tier hosts (e.g. Render) can take 15-40s to wake up
      // from a cold start, and the default 15s client timeout was killing
      // that first request before the backend even had a chance to respond.
      const { data } = await api.get('/admin/attendance', { params, timeout: 30000 });
      // Guard against a malformed/unexpected response shape (e.g. an HTML
      // error page or a differently-shaped payload from the deployed API)
      // so the page never crashes on a bad fetch — it just shows "no records".
      const safeRecords = Array.isArray(data?.records) ? data.records : [];
      setRecords(safeRecords);
      setTotal(typeof data?.total === 'number' ? data.total : safeRecords.length);
      setFetchError(false);
      setFetchErrorDetail(null);
      const isCurrentMonth = month === now.getMonth() + 1 && year === now.getFullYear();
      if (isCurrentMonth && prevCheckedIn !== null) {
        const todayStr = now.toISOString().split('T')[0];
        const todayChecked = safeRecords.filter(r => r.date === todayStr && r.checkInTime);
        if (todayChecked.length > prevCheckedIn) {
          const newest = todayChecked[todayChecked.length - 1];
          notifyNewCheckIn(newest?.userId?.name || 'Someone', newest?.status);
        }
        const totalEmp = employees.length || 1;
        const pct = Math.round((todayChecked.length / totalEmp) * 100);
        if (pct < 50 && prevCheckedIn === 0) notifyLowAttendance(pct);
        setPrevCheckedIn(todayChecked.length);
      } else if (prevCheckedIn === null) {
        const todayStr = now.toISOString().split('T')[0];
        const todayCount = safeRecords.filter(r => r.date === todayStr && r.checkInTime).length;
        setPrevCheckedIn(todayCount);
      }
    } catch (err) {
      // First failure on a fresh load gets one automatic retry (covers a
      // transient blip) before we bother the user with an error state.
      if (!isRetry) {
        setLoading(false);
        return fetchRecords(true);
      }
      const status = err?.response?.status;
      const serverMsg = err?.response?.data?.message || (typeof err?.response?.data === 'string' ? err.response.data.slice(0, 200) : null);
      setFetchErrorDetail({
        status: status ?? 'no response',
        message: serverMsg || err?.message || 'Unknown error',
      });
      setFetchError(true);
      toast.error('Failed to load attendance records');
      // Don't wipe existing good data (e.g. from the periodic 60s refresh)
      // just because one refresh attempt failed transiently.
    } finally { setLoading(false); }
  }, [month, year, selectedEmployee, employees, prevCheckedIn]);

  useEffect(() => { fetchRecords(); }, [month, year, selectedEmployee]);
  useEffect(() => { const t = setInterval(fetchRecords, 60000); return () => clearInterval(t); }, [fetchRecords]);

  const handleExport = async () => {
    try {
      const res = await api.get('/admin/attendance/export', { params: { month, year }, responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url; a.download = `attendance-${year}-${month}.xlsx`; a.click();
      URL.revokeObjectURL(url);
      toast.success('Excel exported!');
    } catch { toast.error('Export failed'); }
  };

  const present   = records.filter(r => r.status === 'present').length;
  const late      = records.filter(r => r.status === 'late').length;
  const dayGroups = groupByDate(records);

  return (
    <div className="p-5 md:p-8 max-w-5xl mx-auto space-y-5 animate-fade-in">
      <div className="flex items-start justify-between flex-wrap gap-3 animate-slide-up">
        <h1 className="page-title">Attendance Records</h1>
        <button onClick={handleExport} className="btn-secondary py-2 px-4 text-sm flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Export Excel
        </button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <select className="input" value={month} onChange={e => setMonth(Number(e.target.value))}>
          {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
        <select className="input" value={year} onChange={e => setYear(Number(e.target.value))}>
          {[2024, 2025, 2026].map(y => <option key={y}>{y}</option>)}
        </select>
        <select className="input col-span-2 md:col-span-1" value={selectedEmployee} onChange={e => setSelectedEmployee(e.target.value)}>
          <option value="">All Employees</option>
          {employees.map(e => <option key={e._id} value={e._id}>{e.name}</option>)}
        </select>
      </div>

      {/* View toggle */}
      <div className="flex items-center gap-1 p-1 rounded-xl w-fit" style={{ background: 'var(--fd-card-bg)', border: '1px solid var(--fd-border)' }}>
        {[{ key: 'list', label: '📋 All Records' }, { key: 'daywise', label: '📅 Day-wise' }].map(({ key, label }) => (
          <button key={key} onClick={() => setView(key)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${view === key ? 'bg-attbrand-500/15 text-attbrand-500' : 'text-gray-600 hover:text-gray-300'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3 stagger">
        {[
          { val: present, label: 'Present', color: '#34d399' },
          { val: late,    label: 'Late',    color: '#fbbf24' },
          { val: total,   label: 'Total',   color: 'var(--fd-accent)' },
        ].map(({ val, label, color }) => (
          <div key={label} className="rounded-2xl p-4 text-center animate-fade-in" style={panelStyle}>
            <p className="text-2xl font-display font-bold" style={{ color }}>{val}</p>
            <p className="text-xs text-gray-600 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Spinner size="lg" className="text-attbrand-500" /></div>
      ) : fetchError && records.length === 0 ? (
        <div className="card p-10 text-center space-y-3">
          <p className="text-gray-400">Couldn't load attendance records.</p>
          {fetchErrorDetail && (
            <p className="text-xs font-mono text-red-400 break-words">
              Status: {String(fetchErrorDetail.status)} — {fetchErrorDetail.message}
            </p>
          )}
          <button onClick={() => fetchRecords()} className="btn-secondary py-2 px-4 text-sm">
            Retry
          </button>
        </div>
      ) : view === 'daywise' ? (
        <div className="space-y-2">
          {dayGroups.length === 0 && <div className="card p-10 text-center text-gray-600">No records for this period</div>}
          {dayGroups.map(([date, dayRecords]) => {
            const dayPresent = dayRecords.filter(r => r.status === 'present').length;
            const dayLate    = dayRecords.filter(r => r.status === 'late').length;
            const isExpanded = expandedDate === date;
            const dayLabel = new Date(date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });
            const isSunday = new Date(date + 'T00:00:00').getDay() === 0;
            return (
              <div key={date} className="rounded-2xl overflow-hidden" style={panelStyle}>
                <button
                  className="w-full p-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
                  onClick={() => setExpandedDate(isExpanded ? null : date)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-display font-bold flex-shrink-0"
                      style={isSunday
                        ? { background: 'rgba(var(--fd-accent-rgb),0.1)', color: 'var(--fd-accent)' }
                        : { background: 'var(--fd-border)', color: '#d1d5db' }}>
                      {new Date(date + 'T00:00:00').getDate()}
                    </div>
                    <div className="text-left">
                      <p className="font-display font-semibold text-gray-200 text-sm">{dayLabel}</p>
                      {isSunday && <p className="text-xs text-attbrand-500">☀️ Sunday</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex gap-2 text-xs">
                      <span className="text-emerald-400 font-semibold">{dayPresent}P</span>
                      <span className="text-amber-400 font-semibold">{dayLate}L</span>
                      <span className="text-gray-600">{dayRecords.length} total</span>
                    </div>
                    <svg className={`w-4 h-4 text-gray-600 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>
                {isExpanded && (
                  <div style={{ borderTop: '1px solid var(--fd-border)' }}>
                    {dayRecords.map((r, i) => (
                      <div key={r._id} className="px-4 py-3 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
                        style={i < dayRecords.length - 1 ? { borderBottom: '1px solid var(--fd-border)' } : {}}>
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-black flex-shrink-0"
                            style={{ background: 'linear-gradient(135deg, var(--fd-accent), var(--fd-accent-hover))' }}>
                            {r.userId?.name?.charAt(0)?.toUpperCase() || '?'}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-200">{r.userId?.name || '—'}</p>
                            <p className="text-xs text-gray-600">{r.userId?.department || ''}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right hidden sm:block">
                            <p className="text-xs text-emerald-400 font-mono">{fmt(r.checkInTime)}</p>
                            <p className="text-xs text-amber-400 font-mono">{fmt(r.checkOutTime)}</p>
                          </div>
                          <div className="text-right hidden sm:block">
                            <p className="text-xs text-attbrand-500 font-mono">{fmtH(r.workHours)}</p>
                          </div>
                          <StatusBadge status={displayStatus(r)} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block rounded-2xl overflow-hidden" style={panelStyle}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--fd-border)' }}>
                  {['Employee','Date','Status','Check In','Check Out','Work Hours'].map(h => (
                    <th key={h} className="text-left px-4 py-3.5 text-[10px] font-semibold text-gray-600 uppercase tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {records.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-10 text-gray-600">No records found</td></tr>
                )}
                {records.map((r, i) => (
                  <tr key={r._id} className="hover:bg-white/[0.02] transition-colors"
                    style={i < records.length - 1 ? { borderBottom: '1px solid var(--fd-border)' } : {}}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-200">{r.userId?.name || '—'}</p>
                      <p className="text-xs text-gray-600">{r.userId?.department || ''}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-500 font-mono text-xs">
                      {new Date(r.date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={displayStatus(r)} /></td>
                    <td className="px-4 py-3 font-mono text-xs text-emerald-400">{fmt(r.checkInTime)}</td>
                    <td className="px-4 py-3 font-mono text-xs text-amber-400">{fmt(r.checkOutTime)}</td>
                    <td className="px-4 py-3 font-mono text-xs text-attbrand-500">{fmtH(r.workHours)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-2">
            {records.length === 0 && <div className="card p-10 text-center text-gray-600">No records found</div>}
            {records.map(r => (
              <div key={r._id} className="rounded-xl p-4 space-y-3" style={panelStyle}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-display font-semibold text-white text-sm">{r.userId?.name || '—'}</p>
                    <p className="text-xs text-gray-600 font-mono">
                      {new Date(r.date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                  <StatusBadge status={displayStatus(r)} />
                </div>
                {r.checkInTime && (
                  <div className="grid grid-cols-3 gap-2 text-center bg-white/[0.03] border border-white/[0.04] rounded-xl p-2.5">
                    <div><p className="text-[9px] text-gray-700">IN</p><p className="font-mono text-xs text-emerald-400">{fmt(r.checkInTime)}</p></div>
                    <div style={{ borderLeft: '1px solid var(--fd-border)', borderRight: '1px solid var(--fd-border)' }}>
                      <p className="text-[9px] text-gray-700">OUT</p><p className="font-mono text-xs text-amber-400">{fmt(r.checkOutTime)}</p>
                    </div>
                    <div><p className="text-[9px] text-gray-700">HRS</p><p className="font-mono text-xs text-attbrand-500">{fmtH(r.workHours)}</p></div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}