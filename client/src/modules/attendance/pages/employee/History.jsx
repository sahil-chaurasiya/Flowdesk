import { useState, useEffect } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import StatusBadge from '../../components/common/StatusBadge';
import Spinner from '../../components/common/Spinner';
import { notifySundayHoliday } from '../../services/notifications';

const fmt = (d) => d ? new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }) : '—';
const fmtH = (h) => { if (!h) return '—'; const hrs = Math.floor(h); const min = Math.round((h - hrs) * 60); return `${hrs}h ${min}m`; };

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DATA_START = new Date('2026-04-01T00:00:00+05:30');

const countWorkingDays = (month, year) => {
  // Only fully elapsed days count — today is never counted as absent while the
  // day is still in progress.
  const nowIST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  nowIST.setDate(nowIST.getDate() - 1);
  nowIST.setHours(23, 59, 59, 999);
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd   = new Date(year, month, 0);
  const effectiveStart = monthStart < DATA_START ? DATA_START : monthStart;
  const effectiveEnd   = monthEnd < nowIST ? monthEnd : nowIST;
  if (effectiveStart > effectiveEnd) return 0;
  let count = 0;
  const cur = new Date(effectiveStart);
  cur.setHours(0, 0, 0, 0);
  while (cur <= effectiveEnd) {
    if (cur.getDay() !== 0) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
};

const isFullyAttended = (record) => record && record.checkInTime && record.checkOutTime;
// Holiday/on-leave days never have a check-in/out, but they must never be
// treated or displayed as absent.
const isExemptStatus = (record) => record && (record.status === 'holiday' || record.status === 'on_leave');

function buildCalendarGrid(month, year, records) {
  const nowIST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  nowIST.setHours(23, 59, 59, 999);
  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const byDate = {};
  for (const r of records) byDate[r.date] = r;
  const days = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month - 1, d);
    const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const isSunday = date.getDay() === 0;
    const isPast = date <= nowIST;
    const isToday = date.toDateString() === nowIST.toDateString();
    const isBeforeStart = date < DATA_START;
    const record = byDate[dateStr] || null;
    let status = null;
    if (isBeforeStart)                                             status = 'na';
    else if (isExemptStatus(record))                               status = record.status;
    else if (isSunday && isPast)                                   status = 'sunday';
    else if (isFullyAttended(record))                              status = record.status;
    else if (record?.checkInTime && !record?.checkOutTime && !isToday) status = 'absent';
    else if (isPast && !isToday && !isSunday)                     status = 'absent';
    else if (isToday && !isFullyAttended(record))                  status = 'today';
    days.push({ d, dateStr, date, isSunday, isPast, isToday, isBeforeStart, record, status });
  }
  return days;
}

function getDayStyle(status, isToday) {
  const base = 'flex flex-col items-center justify-center aspect-square rounded-xl transition-all duration-150';
  if (status === 'na')      return `${base} opacity-20 cursor-default`;
  if (status === 'sunday')  return `${base} bg-attbrand-500/[0.07] border border-attbrand-500/20 text-attbrand-500`;
  if (status === 'present') return `${base} bg-emerald-500/[0.1] border border-emerald-500/25 text-emerald-300`;
  if (status === 'late')    return `${base} bg-amber-500/[0.1] border border-amber-500/25 text-amber-300`;
  if (status === 'absent')  return `${base} bg-red-500/[0.1] border border-red-500/25 text-red-400`;
  if (status === 'holiday') return `${base} bg-indigo-500/[0.1] border border-indigo-500/25 text-indigo-300`;
  if (status === 'on_leave') return `${base} bg-sky-500/[0.1] border border-sky-500/25 text-sky-300`;
  if (status === 'today')   return `${base} bg-attbrand-500/[0.08] border border-attbrand-500/30 text-attbrand-400`;
  return `${base} text-gray-600`;
}

function DayDetailModal({ day, onClose }) {
  if (!day) return null;
  const { d, dateStr, isSunday, isBeforeStart, record, status } = day;
  const dateLabel = new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const noCheckout = record?.checkInTime && !record?.checkOutTime;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="w-full sm:max-w-sm animate-slide-up overflow-y-auto"
        style={{
          background: 'var(--fd-card-bg)',
          
          border: '1px solid var(--fd-border)',
          borderRadius: '24px 24px 0 0',
          padding: '24px',
          paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 24px)',
          maxHeight: '85dvh',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div className="w-10 h-1 rounded-full bg-white/10 mx-auto mb-5" />
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-white font-display font-bold text-lg leading-tight">{dateLabel}</p>
            {isSunday && <p className="text-attbrand-500 text-xs mt-0.5">☀️ Sunday Holiday</p>}
          </div>
          <button onClick={onClose} className="text-gray-600 hover:text-white p-1.5 rounded-xl hover:bg-white/[0.05] transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {isBeforeStart ? (
          <p className="text-gray-600 text-sm text-center py-4">No data before app launch (Apr 2026)</p>
        ) : isSunday ? (
          <div className="bg-attbrand-500/[0.07] border border-attbrand-500/20 rounded-xl p-4 text-center">
            <p className="text-2xl mb-2">🌟</p>
            <p className="text-attbrand-500 font-semibold font-display">Sunday Rest Day</p>
            <p className="text-gray-600 text-xs mt-1">Automatically marked as present</p>
          </div>
        ) : status === 'holiday' ? (
          <div className="bg-indigo-500/[0.07] border border-indigo-500/20 rounded-xl p-4 text-center">
            <p className="text-2xl mb-2">🎉</p>
            <p className="text-indigo-300 font-semibold font-display">{record?.holidayName || 'Holiday'}</p>
            <p className="text-gray-600 text-xs mt-1">Automatically marked as present</p>
          </div>
        ) : status === 'on_leave' ? (
          <div className="bg-sky-500/[0.07] border border-sky-500/20 rounded-xl p-4 text-center">
            <p className="text-2xl mb-2">🏖️</p>
            <p className="text-sky-300 font-semibold font-display">On Leave</p>
            <p className="text-gray-600 text-xs mt-1">Approved leave — not counted as absent</p>
          </div>
        ) : status === 'absent' ? (
          <div className="bg-red-500/[0.07] border border-red-500/20 rounded-xl p-4 text-center">
            <p className="text-2xl mb-2">😔</p>
            <p className="text-red-400 font-semibold font-display">Absent</p>
            {noCheckout ? (
              <>
                <p className="text-gray-600 text-xs mt-1">Checked in but did not check out</p>
                <div className="mt-3 bg-white/[0.03] rounded-lg p-3">
                  <p className="text-[10px] text-gray-600 mb-0.5 uppercase tracking-wider">Check In (recorded)</p>
                  <p className="font-mono text-sm font-medium text-emerald-400">{fmt(record.checkInTime)}</p>
                </div>
                <p className="text-red-400 text-xs mt-2">⚠️ No checkout = Marked Absent</p>
              </>
            ) : (
              <p className="text-gray-600 text-xs mt-1">No check-in recorded</p>
            )}
          </div>
        ) : isFullyAttended(record) ? (
          <div className="space-y-3">
            <StatusBadge status={record.status} />
            <div className="grid grid-cols-3 gap-3 text-center bg-white/[0.03] border border-white/[0.05] rounded-xl p-4">
              <div>
                <p className="text-[10px] text-gray-600 mb-1 uppercase tracking-wider">In</p>
                <p className="font-mono text-sm font-medium text-emerald-400">{fmt(record.checkInTime)}</p>
              </div>
              <div style={{ borderLeft: '1px solid var(--fd-border)', borderRight: '1px solid var(--fd-border)' }}>
                <p className="text-[10px] text-gray-600 mb-1 uppercase tracking-wider">Out</p>
                <p className="font-mono text-sm font-medium text-amber-400">{fmt(record.checkOutTime)}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-600 mb-1 uppercase tracking-wider">Hours</p>
                <p className="font-mono text-sm font-medium text-attbrand-500">{fmtH(record.workHours)}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-6">
            <p className="text-gray-600 text-sm">No record for this day</p>
          </div>
        )}

        <button onClick={onClose} className="mt-4 w-full py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] text-gray-400 text-sm font-medium hover:bg-white/[0.07] transition-colors">
          Close
        </button>
      </div>
    </div>
  );
}

const getValidYears = () => {
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let y = 2026; y <= currentYear; y++) years.push(y);
  return years;
};

export default function EmployeeHistory() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear]   = useState(now.getFullYear());
  const [records, setRecords] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [cl, setCl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedDay, setSelectedDay] = useState(null);
  const [view, setView] = useState('calendar');
  const [sundayNotified, setSundayNotified] = useState(false);

  const handleYearChange = (newYear) => {
    setYear(Number(newYear));
    if (Number(newYear) === 2026 && month < 4) setMonth(4);
  };

  const handleMonthChange = (newMonth) => {
    if (year === 2026 && Number(newMonth) < 4) return;
    setMonth(Number(newMonth));
  };

  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true);
      try {
        const lastDay = new Date(year, month, 0).getDate();
        const { data } = await api.get('/attendance/history', { params: { month, year, limit: lastDay } });
        setRecords(data.attendance);
      } catch { toast.error('Failed to load history'); }
      finally { setLoading(false); }
    };
    const fetchHolidays = async () => {
      try {
        const { data } = await api.get('/holidays', { params: { month, year } });
        setHolidays(data.holidays || []);
      } catch { /* non-critical, ignore */ }
    };
    const fetchCL = async () => {
      setCl(null);
      try {
        const { data } = await api.get('/attendance/cl', { params: { month, year } });
        setCl(data.cl || null);
      } catch { /* non-critical, falls back to plain absent count */ }
    };
    fetchHistory();
    fetchHolidays();
    fetchCL();
  }, [month, year]);

  useEffect(() => {
    const today = new Date();
    const isSundayToday = today.getDay() === 0;
    const isCurrentMonth = today.getMonth() + 1 === month && today.getFullYear() === year;
    if (isSundayToday && isCurrentMonth && !sundayNotified) {
      notifySundayHoliday();
      setSundayNotified(true);
    }
  }, [month, year, sundayNotified]);

  const calendarDays = buildCalendarGrid(month, year, records);
  const present = records.filter(r => isFullyAttended(r) && r.status === 'present').length;
  const late    = records.filter(r => isFullyAttended(r) && r.status === 'late').length;
  const withFullAttendance = present + late; // (display only; absent uses attendedBeforeToday below)
  const passedSundays = calendarDays.filter(d => d && d.isSunday && d.isPast && !d.isBeforeStart).length;
  // Declared holidays that have already occurred don't count as working days,
  // so they're never counted absent (future holidays aren't in the elapsed
  // working-day count yet, so they must not be subtracted from it either)
  const todayIsoIST = (() => {
    const ist = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    return ist.toISOString().split('T')[0];
  })();
  const holidayWorkingDays = holidays.filter(h => h.date < todayIsoIST && new Date(h.date + 'T00:00:00').getDay() !== 0).length;
  const workingDays = Math.max(0, countWorkingDays(month, year) - holidayWorkingDays);
  const attendedBeforeToday = records.filter(r => isFullyAttended(r) && (r.status === 'present' || r.status === 'late') && r.date < todayIsoIST).length;
  const rawAbsent = Math.max(0, workingDays - attendedBeforeToday);
  // 1 CL per month (unused CL carries forward). Absences are covered by CL
  // first; only the rest show up as absent.
  const clUsed = cl ? Math.min(cl.clUsed, rawAbsent) : 0;
  const absent = rawAbsent - clUsed;
  const validYears = getValidYears();

  return (
    <div className="min-h-full bg-surface px-4 pt-6 pb-8 max-w-md mx-auto space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between animate-slide-up">
        <h1 className="page-title">History</h1>
        <div
          className="flex items-center gap-1 p-1 rounded-xl"
          style={{ background: 'var(--fd-card-bg)', border: '1px solid var(--fd-border)' }}
        >
          {[{ key: 'calendar', label: '📅' }, { key: 'list', label: '📋' }].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setView(key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                view === key
                  ? 'bg-attbrand-500/15 text-attbrand-500'
                  : 'text-gray-600 hover:text-gray-300'
              }`}
            >
              {label} {key === 'calendar' ? 'Calendar' : 'List'}
            </button>
          ))}
        </div>
      </div>

      {/* Month/year selectors */}
      <div className="flex gap-2">
        <select value={month} onChange={e => handleMonthChange(e.target.value)} className="input flex-1">
          {MONTHS.map((m, i) => (
            <option key={i} value={i + 1} disabled={year === 2026 && i + 1 < 4}>{m}</option>
          ))}
        </select>
        <select value={year} onChange={e => handleYearChange(e.target.value)} className="input w-28">
          {validYears.map(y => <option key={y}>{y}</option>)}
        </select>
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-4 gap-2 stagger">
        {[
          { val: present, label: 'Present', color: '#34d399' },
          { val: late,    label: 'Late',    color: '#fbbf24' },
          { val: absent,  label: 'Absent',  color: '#f87171' },
          { val: passedSundays, label: 'Sundays', color: 'var(--fd-accent)' },
        ].map(({ val, label, color }) => (
          <div
            key={label}
            className="rounded-xl p-3 text-center animate-fade-in"
            style={{ background: 'var(--fd-card-bg)', border: `1px solid var(--fd-border)` }}
          >
            <p className="text-xl font-display font-bold" style={{ color }}>{val}</p>
            <p className="text-[9px] text-gray-600 mt-0.5 uppercase tracking-wide">{label}</p>
          </div>
        ))}
      </div>

      {/* Casual leave */}
      {cl && (
        <div className="grid grid-cols-2 gap-2">
          {[
            { val: clUsed, label: 'CL Used', color: '#60a5fa' },
            { val: cl.available - clUsed, label: 'CL Remaining', color: '#38bdf8' },
          ].map(({ val, label, color }) => (
            <div
              key={label}
              className="rounded-xl p-3 text-center animate-fade-in"
              style={{ background: 'var(--fd-card-bg)', border: '1px solid var(--fd-border)' }}
            >
              <p className="text-xl font-display font-bold" style={{ color }}>{val}</p>
              <p className="text-[9px] text-gray-600 mt-0.5 uppercase tracking-wide">{label}</p>
            </div>
          ))}
          {cl.carriedIn > 0 && (
            <p className="col-span-2 text-[10px] text-gray-600 text-center">
              {cl.carriedIn} CL carried forward from previous month{cl.carriedIn > 1 ? 's' : ''} + {cl.granted} new this month
            </p>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-10"><Spinner size="lg" className="text-attbrand-500" /></div>
      ) : view === 'calendar' ? (
        /* Calendar view */
        <div
          className="rounded-2xl p-4 space-y-3 animate-fade-in"
          style={{
            background: 'var(--fd-card-bg)',
            
            border: '1px solid var(--fd-border)',
          }}
        >
          <p className="text-sm font-display font-semibold text-gray-300 text-center">{MONTHS[month - 1]} {year}</p>

          {/* Day headers */}
          <div className="grid grid-cols-7 gap-1">
            {DAY_NAMES.map(d => (
              <div key={d} className={`text-center text-[9px] font-bold py-1 uppercase tracking-wide ${d === 'Sun' ? 'text-attbrand-500' : 'text-gray-700'}`}>
                {d}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((day, i) => {
              if (!day) return <div key={`empty-${i}`} />;
              const styleClass = getDayStyle(day.status, day.isToday);
              const isClickable = !day.isBeforeStart;

              return (
                <button
                  key={day.dateStr}
                  onClick={() => isClickable && setSelectedDay(day)}
                  className={`${styleClass} ${isClickable ? 'cursor-pointer hover:scale-105 active:scale-95' : 'cursor-default'} relative`}
                  style={day.isToday ? { boxShadow: '0 0 0 1.5px rgba(var(--fd-accent-rgb),0.4)' } : {}}
                >
                  <span className={`text-[11px] font-semibold leading-none ${day.isSunday && day.status === 'sunday' ? 'text-attbrand-500' : ''}`}>
                    {day.d}
                  </span>
                  {/* Status dot */}
                  {['present','late','absent','sunday','holiday','on_leave'].includes(day.status) && (
                    <span
                      className="w-1 h-1 rounded-full mt-0.5"
                      style={{
                        background: day.status === 'present' ? '#34d399' : day.status === 'late' ? '#fbbf24' : day.status === 'absent' ? '#f87171' : day.status === 'holiday' ? '#818cf8' : day.status === 'on_leave' ? '#38bdf8' : 'var(--fd-accent)'
                      }}
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 pt-2" style={{ borderTop: '1px solid var(--fd-border)' }}>
            {[
              { color: '#34d399', label: 'Present' },
              { color: '#fbbf24', label: 'Late' },
              { color: '#f87171', label: 'Absent' },
              { color: '#818cf8', label: 'Holiday' },
              { color: 'var(--fd-accent)', label: 'Sunday' },
            ].map(({ color, label }) => (
              <div key={label} className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
                <span className="text-[10px] text-gray-600">{label}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* List view */
        <div className="space-y-2.5">
          {records.length === 0 ? (
            <div className="card p-10 text-center">
              <p className="text-3xl mb-3">📋</p>
              <p className="text-gray-600">No records for {MONTHS[month - 1]} {year}</p>
            </div>
          ) : (
            records.map((r) => {
              const attended = isFullyAttended(r) || isExemptStatus(r);
              const noCheckout = r.checkInTime && !r.checkOutTime;
              return (
                <div
                  key={r._id}
                  className="rounded-xl p-4 animate-slide-up"
                  style={{
                    background: 'var(--fd-card-bg)',
                    
                    border: `1px solid ${!attended ? 'rgba(248,113,113,0.15)' : 'var(--fd-border)'}`,
                  }}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-semibold text-gray-200 text-sm font-display">
                        {new Date(r.date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                      </p>
                      {noCheckout && <p className="text-[11px] text-red-400 mt-0.5">⚠️ No checkout — marked absent</p>}
                    </div>
                    <StatusBadge status={attended ? r.status : 'absent'} />
                  </div>

                  {r.checkInTime && (
                    <div className="grid grid-cols-3 gap-2 text-center bg-white/[0.03] border border-white/[0.04] rounded-xl p-3">
                      <div>
                        <p className="text-[9px] text-gray-700 mb-1 uppercase tracking-wide">In</p>
                        <p className="font-mono text-xs font-medium text-emerald-400">{fmt(r.checkInTime)}</p>
                      </div>
                      <div style={{ borderLeft: '1px solid var(--fd-border)', borderRight: '1px solid var(--fd-border)' }}>
                        <p className="text-[9px] text-gray-700 mb-1 uppercase tracking-wide">Out</p>
                        <p className={`font-mono text-xs font-medium ${r.checkOutTime ? 'text-amber-400' : 'text-red-400'}`}>{fmt(r.checkOutTime)}</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-gray-700 mb-1 uppercase tracking-wide">Hours</p>
                        <p className="font-mono text-xs font-medium text-attbrand-500">{fmtH(r.workHours)}</p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {selectedDay && <DayDetailModal day={selectedDay} onClose={() => setSelectedDay(null)} />}
    </div>
  );
}