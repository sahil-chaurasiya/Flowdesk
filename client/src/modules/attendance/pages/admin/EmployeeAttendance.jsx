import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import toast from 'react-hot-toast';
import Spinner from '../../components/common/Spinner';
import StatusBadge from '../../components/common/StatusBadge';

const fmt   = (d) => d ? new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }) : '—';
const fmtH  = (h) => { if (!h) return '—'; const hrs = Math.floor(h); const min = Math.round((h - hrs) * 60); return `${hrs}h ${min}m`; };
// Holiday/on-leave records never have a check-in, but they must never be
// treated or displayed as absent.
const isExemptStatus = (record) => record && (record.status === 'holiday' || record.status === 'on_leave');

const MONTHS     = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAY_NAMES  = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const DATA_START = new Date('2026-04-01T00:00:00+05:30');

const getValidYears = () => {
  const cur = new Date().getFullYear();
  const years = [];
  for (let y = 2026; y <= cur; y++) years.push(y);
  return years;
};

const countWorkingDays = (month, year) => {
  const nowIST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  nowIST.setHours(23, 59, 59, 999);
  const effectiveStart = new Date(Math.max(new Date(year, month - 1, 1), DATA_START));
  const effectiveEnd   = new Date(Math.min(new Date(year, month, 0), nowIST));
  if (effectiveStart > effectiveEnd) return 0;
  let count = 0;
  const cur = new Date(effectiveStart);
  cur.setHours(0, 0, 0, 0);
  while (cur <= effectiveEnd) { if (cur.getDay() !== 0) count++; cur.setDate(cur.getDate() + 1); }
  return count;
};

function buildCalendarGrid(month, year, records) {
  const nowIST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  nowIST.setHours(23, 59, 59, 999);
  const firstDay    = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const byDate      = {};
  for (const r of records) byDate[r.date] = r;

  const days = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const date    = new Date(year, month - 1, d);
    const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const isSunday      = date.getDay() === 0;
    const isPast        = date <= nowIST;
    const isToday       = date.toDateString() === nowIST.toDateString();
    const isBeforeStart = date < DATA_START;
    const record        = byDate[dateStr] || null;

    let status = null;
    if (isBeforeStart)                       status = 'na';
    else if (isExemptStatus(record))         status = record.status;
    else if (isSunday && isPast)             status = 'sunday';
    else if (record?.checkInTime)            status = record.status;
    else if (isPast && !isToday && !isSunday) status = 'absent';
    else if (isToday && !record?.checkInTime) status = 'today';

    days.push({ d, dateStr, date, isSunday, isPast, isToday, isBeforeStart, record, status });
  }
  return days;
}

const DAY_STYLE = {
  present: 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300',
  late:    'bg-amber-500/15  border border-amber-500/30  text-amber-300',
  absent:  'bg-red-500/10    border border-red-500/20    text-red-400',
  holiday: 'bg-indigo-500/15 border border-indigo-500/30 text-indigo-300',
  on_leave:'bg-sky-500/15    border border-sky-500/30    text-sky-300',
  sunday:  'bg-attbrand-600/15  border border-attbrand-600/30  text-attbrand-400',
  today:   'bg-attbrand-500/15  border border-attbrand-500/40  text-attbrand-300 ring-1 ring-attbrand-500/50',
  na:      'text-gray-700 opacity-30',
};
const DAY_DOT = {
  present: 'bg-emerald-400',
  late:    'bg-amber-400',
  absent:  'bg-red-400',
  holiday: 'bg-indigo-400',
  on_leave:'bg-sky-400',
  sunday:  'bg-attbrand-400',
};

export default function AdminEmployeeAttendance() {
  const { id }     = useParams();
  const navigate   = useNavigate();
  const now        = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));

  const [emp,     setEmp]     = useState(null);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [month,   setMonth]   = useState(now.getMonth() + 1);
  const [year,    setYear]    = useState(now.getFullYear());
  const [view,    setView]    = useState('list'); // 'list' | 'calendar'
  const [selDay,  setSelDay]  = useState(null);
  const [fetchError, setFetchError] = useState(false);

  const fetchAttendance = useCallback(async (isRetry = false) => {
    setLoading(true);
    try {
      // 30s timeout: free-tier hosts (e.g. Render) can take 15-40s to wake
      // up from a cold start, and the default 15s client timeout was
      // killing that first request before the backend could respond.
      const { data } = await api.get(`/admin/employees/${id}/attendance`, { params: { month, year }, timeout: 30000 });
      setEmp(data?.user || null);
      setRecords(Array.isArray(data?.records) ? data.records : []);
      setFetchError(false);
    } catch {
      if (!isRetry) { setLoading(false); return fetchAttendance(true); }
      toast.error('Failed to load attendance — server may be waking up, retrying may help');
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  }, [id, month, year]);

  useEffect(() => { fetchAttendance(); }, [fetchAttendance]);

  const handleMonthChange = (m) => { if (year === 2026 && Number(m) < 4) return; setMonth(Number(m)); };
  const handleYearChange  = (y) => { setYear(Number(y)); if (Number(y) === 2026 && month < 4) setMonth(4); };

  const workingDays   = countWorkingDays(month, year);
  const present       = records.filter(r => r.status === 'present').length;
  const late          = records.filter(r => r.status === 'late').length;
  const withCheckIn   = records.filter(r => r.checkInTime).length;
  const exemptCount   = records.filter(r => isExemptStatus(r)).length;
  const approvedLeaves = records.filter(r => r.status === 'on_leave').length;
  const absent        = Math.max(0, workingDays - withCheckIn - exemptCount);
  const pct           = workingDays > 0 ? Math.round(((present + late) / workingDays) * 100) : 0;
  const totalHours    = records.reduce((a, r) => a + (r.workHours || 0), 0);
  const calendarDays  = buildCalendarGrid(month, year, records);
  const passedSundays = calendarDays.filter(d => d && d.isSunday && d.isPast && !d.isBeforeStart).length;
  const validYears    = getValidYears();

  // Build full day list for the month for list view (including absent days)
  const buildDayList = () => {
    const nowIST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    nowIST.setHours(23, 59, 59, 999);
    const daysInMonth = new Date(year, month, 0).getDate();
    const byDate = {};
    for (const r of records) byDate[r.date] = r;
    const list = [];
    for (let d = daysInMonth; d >= 1; d--) {
      const date    = new Date(year, month - 1, d);
      const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const isSunday      = date.getDay() === 0;
      const isPast        = date <= nowIST;
      const isToday       = date.toDateString() === nowIST.toDateString();
      const isBeforeStart = date < DATA_START;
      if (!isPast || isBeforeStart) continue; // skip future & pre-launch
      const record = byDate[dateStr] || null;
      let status = null;
      if (isSunday)                 status = 'sunday';
      else if (isExemptStatus(record)) status = record.status;
      else if (record?.checkInTime) status = record.status;
      else                       status = 'absent';
      list.push({ d, dateStr, date, isSunday, isToday, record, status });
    }
    return list;
  };

  const dayList = buildDayList();

  return (
    <div className="p-5 md:p-8 max-w-4xl mx-auto space-y-6 animate-fade-in">

      {/* ── Back + Header ── */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/admin/attendance/manage/employees')} className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-all flex-shrink-0">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        {emp ? (
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-11 h-11 rounded-full bg-attbrand-500/20 border border-attbrand-500/30 flex items-center justify-center text-base font-bold text-attbrand-300 flex-shrink-0">
              {emp.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h1 className="page-title leading-tight truncate">{emp.name}</h1>
              <p className="text-xs text-gray-400 truncate">{emp.email}{emp.department ? ` · ${emp.department}` : ''}</p>
            </div>
            <span className={`ml-auto text-[10px] px-2 py-0.5 rounded-full font-semibold flex-shrink-0 ${emp.isActive ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
              {emp.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
        ) : (
          <div className="h-8 w-48 bg-surface-card animate-pulse rounded-lg" />
        )}
      </div>

      {/* ── Month/Year Selectors + View Toggle ── */}
      <div className="flex flex-wrap gap-3 items-center">
        <select value={month} onChange={e => handleMonthChange(e.target.value)} className="input flex-1 min-w-[140px]">
          {MONTHS.map((m, i) => (
            <option key={i} value={i + 1} disabled={year === 2026 && i + 1 < 4}>{m}</option>
          ))}
        </select>
        <select value={year} onChange={e => handleYearChange(e.target.value)} className="input w-28">
          {validYears.map(y => <option key={y}>{y}</option>)}
        </select>
        <div className="flex items-center gap-1 bg-[var(--fd-card-bg)] border border-white/[0.06] rounded-xl p-1 ml-auto">
          <button onClick={() => setView('list')} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${view === 'list' ? 'bg-attbrand-500/20 text-attbrand-500' : 'text-gray-400 hover:text-gray-200'}`}>
            📋 List
          </button>
          <button onClick={() => setView('calendar')} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${view === 'calendar' ? 'bg-attbrand-500/20 text-attbrand-500' : 'text-gray-400 hover:text-gray-200'}`}>
            📅 Calendar
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : fetchError && records.length === 0 ? (
        <div className="rounded-2xl p-10 text-center text-gray-400 space-y-3">
          <p>Couldn't reach the server — it may still be waking up.</p>
          <button onClick={() => fetchAttendance()} className="btn-secondary py-2 px-4 text-sm">
            Retry
          </button>
        </div>
      ) : (
        <>
          {/* ── Stats ── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-7 gap-3">
            {[
              { label: 'Present',  value: present,          cls: 'text-emerald-400' },
              { label: 'Late',     value: late,             cls: 'text-amber-400'   },
              { label: 'Absent',   value: absent,           cls: 'text-red-400'     },
              { label: 'Approved Leaves', value: approvedLeaves, cls: 'text-sky-400' },
              { label: 'Sundays',  value: passedSundays,    cls: 'text-attbrand-500'   },
              { label: 'Hrs Worked', value: fmtH(totalHours), cls: 'text-purple-400' },
              { label: 'Attend %', value: `${pct}%`,        cls: pct >= 90 ? 'text-emerald-400' : pct >= 75 ? 'text-amber-400' : 'text-red-400' },
            ].map(s => (
              <div key={s.label} className="rounded-2xl p-3 text-center">
                <p className={`text-xl font-bold font-display ${s.cls}`}>{s.value}</p>
                <p className="text-[10px] text-gray-500 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* ── Calendar View ── */}
          {view === 'calendar' && (
            <div className="rounded-2xl p-5 space-y-3">
              <p className="text-sm font-semibold text-gray-300 text-center">{MONTHS[month - 1]} {year}</p>
              <div className="grid grid-cols-7 gap-1">
                {DAY_NAMES.map(d => (
                  <div key={d} className={`text-center text-[10px] font-bold py-1 ${d === 'Sun' ? 'text-attbrand-500' : 'text-gray-500'}`}>{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((day, i) => {
                  if (!day) return <div key={`e-${i}`} />;
                  const cls = DAY_STYLE[day.status] || 'text-gray-600';
                  const dot = DAY_DOT[day.status];
                  return (
                    <button
                      key={day.dateStr}
                      onClick={() => !day.isBeforeStart && setSelDay(day)}
                      className={`relative aspect-square rounded-xl flex flex-col items-center justify-center transition-all
                        ${cls}
                        ${!day.isBeforeStart ? 'cursor-pointer hover:scale-105 active:scale-95' : 'cursor-default'}
                        ${day.isToday ? 'ring-2 ring-attbrand-500/60' : ''}
                      `}
                    >
                      <span className={`text-xs font-semibold ${day.isSunday ? 'text-attbrand-500' : ''}`}>{day.d}</span>
                      {dot && <span className={`w-1 h-1 rounded-full mt-0.5 ${dot}`} />}
                      {day.isToday && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-attbrand-400 rounded-full" />}
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1.5 pt-2 border-t border-white/[0.05]">
                {[['bg-emerald-400','Present'],['bg-amber-400','Late'],['bg-red-400','Absent'],['bg-indigo-400','Holiday'],['bg-attbrand-400','Sunday'],].map(([c,l]) => (
                  <div key={l} className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${c}`} /><span className="text-[10px] text-gray-400">{l}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── List View ── */}
          {view === 'list' && (
            <div className="space-y-3">
              {dayList.length === 0 && (
                <div className="rounded-2xl p-10 text-center text-gray-400">No records for {MONTHS[month - 1]} {year}</div>
              )}
              {dayList.map(({ d, dateStr, isSunday, isToday, record, status }) => (
                <div key={dateStr} className={`card p-4 animate-slide-up ${isToday ? 'border border-attbrand-500/30' : ''}`}>
                  <div className="flex items-start justify-between gap-3">
                    {/* Date */}
                    <div className="flex-shrink-0 w-14 text-center">
                      <p className="text-2xl font-bold font-display text-white leading-none">{d}</p>
                      <p className="text-[10px] text-gray-500 mt-0.5">
                        {new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short' })}
                      </p>
                      <p className="text-[10px] text-gray-600">
                        {MONTHS[month - 1].slice(0,3)} {year}
                      </p>
                    </div>

                    {/* Divider */}
                    <div className="w-px self-stretch bg-surface-border mx-1 flex-shrink-0" />

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      {isSunday ? (
                        <div className="flex items-center gap-2">
                          <span className="text-sm">🌟</span>
                          <span className="text-sm text-attbrand-400 font-medium">Sunday — Weekly Off</span>
                        </div>
                      ) : isExemptStatus(record) ? (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm">{record.status === 'holiday' ? '🎉' : '🏖️'}</span>
                          <StatusBadge status={record.status} />
                          {record.status === 'holiday' && record.holidayName && (
                            <span className="text-xs text-gray-400">{record.holidayName}</span>
                          )}
                        </div>
                      ) : record?.checkInTime ? (
                        <>
                          <div className="flex items-center gap-2 mb-3 flex-wrap">
                            <StatusBadge status={record.status} />
                            {record.autoCheckout && (
                              <span className="text-[10px] text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">Auto checkout</span>
                            )}
                            {isToday && (
                              <span className="text-[10px] text-attbrand-400 bg-attbrand-500/10 border border-attbrand-500/20 px-2 py-0.5 rounded-full">Today</span>
                            )}
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-center bg-white/[0.02] rounded-xl p-3">
                            <div>
                              <p className="text-[10px] text-gray-500 mb-1">CHECK IN</p>
                              <p className="font-mono text-sm font-bold text-emerald-400">{fmt(record.checkInTime)}</p>
                            </div>
                            <div className="border-x border-surface-border">
                              <p className="text-[10px] text-gray-500 mb-1">CHECK OUT</p>
                              <p className="font-mono text-sm font-bold text-amber-400">{fmt(record.checkOutTime)}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-gray-500 mb-1">HOURS</p>
                              <p className="font-mono text-sm font-bold text-purple-400">{fmtH(record.workHours)}</p>
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="badge-absent">● Absent</span>
                          {isToday && <span className="text-[10px] text-attbrand-400 bg-attbrand-500/10 border border-attbrand-500/20 px-2 py-0.5 rounded-full">Today</span>}
                          <span className="text-xs text-gray-600">No check-in recorded</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Calendar Day Detail Drawer ── */}
      {selDay && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center" onClick={() => setSelDay(null)}>
          <div className="bg-[var(--fd-card-bg)] border border-white/[0.06] rounded-t-2xl sm:rounded-2xl w-full sm:max-w-sm p-6 animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <p className="text-white font-bold text-base">
                {new Date(selDay.dateStr + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
              <button onClick={() => setSelDay(null)} className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/[0.03] transition-colors ml-2 flex-shrink-0">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {selDay.isSunday ? (
              <div className="bg-attbrand-600/10 border border-attbrand-600/20 rounded-xl p-4 text-center">
                <p className="text-3xl mb-2">🌟</p>
                <p className="text-attbrand-400 font-semibold">Sunday Rest Day</p>
                <p className="text-gray-400 text-xs mt-1">Automatically marked as present</p>
              </div>
            ) : selDay.status === 'holiday' ? (
              <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4 text-center">
                <p className="text-3xl mb-2">🎉</p>
                <p className="text-indigo-300 font-semibold">{selDay.record?.holidayName || 'Holiday'}</p>
                <p className="text-gray-400 text-xs mt-1">Automatically marked as present</p>
              </div>
            ) : selDay.status === 'on_leave' ? (
              <div className="bg-sky-500/10 border border-sky-500/20 rounded-xl p-4 text-center">
                <p className="text-3xl mb-2">🏖️</p>
                <p className="text-sky-300 font-semibold">On Leave</p>
                <p className="text-gray-400 text-xs mt-1">Approved leave — not counted as absent</p>
              </div>
            ) : selDay.status === 'absent' ? (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-center">
                <p className="text-3xl mb-2">😔</p>
                <p className="text-red-400 font-semibold">Absent</p>
                <p className="text-gray-400 text-xs mt-1">No check-in recorded</p>
              </div>
            ) : selDay.record?.checkInTime ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <StatusBadge status={selDay.record.status} />
                  {selDay.record.autoCheckout && <span className="text-xs text-gray-500 bg-gray-500/10 px-2 py-0.5 rounded-full">Auto checkout</span>}
                </div>
                <div className="grid grid-cols-3 gap-3 text-center bg-white/[0.02] rounded-xl p-4">
                  <div>
                    <p className="text-[10px] text-gray-500 mb-1">CHECK IN</p>
                    <p className="font-mono text-sm font-bold text-emerald-400">{fmt(selDay.record.checkInTime)}</p>
                  </div>
                  <div className="border-x border-surface-border">
                    <p className="text-[10px] text-gray-500 mb-1">CHECK OUT</p>
                    <p className="font-mono text-sm font-bold text-amber-400">{fmt(selDay.record.checkOutTime)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 mb-1">HOURS</p>
                    <p className="font-mono text-sm font-bold text-purple-400">{fmtH(selDay.record.workHours)}</p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-gray-400 text-sm text-center py-4">No record for this day</p>
            )}

            <button onClick={() => setSelDay(null)} className="mt-4 w-full py-2.5 rounded-xl bg-white/[0.04] text-gray-300 text-sm font-medium hover:bg-surface-border transition-colors">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}