import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import Spinner from '../../components/common/Spinner';
import StatusBadge from '../../components/common/StatusBadge';
import HolidaysCard from '../../components/admin/HolidaysCard';

const fmt = (d) => d ? new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '—';
// Holiday/on-leave records never have a check-in, but they should never be
// shown or counted as "absent" either.
const isExemptStatus = (r) => r?.status === 'holiday' || r?.status === 'on_leave';
const displayStatus = (r) => (r?.checkInTime || isExemptStatus(r)) ? r.status : 'absent';

const panelStyle = {
  background: 'var(--fd-card-bg)',
  
  border: '1px solid var(--fd-border)',
};

function StatCard({ label, value, sub, accent, active, onClick }) {
  return (
    <div
      onClick={onClick}
      className="rounded-2xl p-5 flex flex-col gap-1.5 animate-fade-in relative overflow-hidden"
      style={{
        background: 'var(--fd-card-bg)',
        
        border: active ? `1px solid ${accent}50` : `1px solid ${accent}18`,
        boxShadow: active
          ? `0 1px 0 var(--fd-border) inset, 0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px ${accent}20`
          : `0 1px 0 var(--fd-border) inset, 0 8px 24px rgba(0,0,0,0.3)`,
        cursor: 'pointer',
        transition: 'border-color 0.15s, box-shadow 0.15s',
      }}
    >
      <div className="absolute top-0 left-0 right-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${accent}20, transparent)` }} />
      <p className="text-[10px] text-gray-600 uppercase tracking-[0.1em] font-medium">{label}</p>
      <p className="text-3xl font-display font-bold" style={{ color: accent }}>{value ?? '—'}</p>
      {sub && <p className="text-[10px] text-gray-700">{sub}</p>}
      <p className="text-[10px] mt-0.5" style={{ color: `${accent}70` }}>{active ? '▲ Hide' : '▼ View'}</p>
    </div>
  );
}

export default function AdminDashboard() {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState(null); // 'present' | 'late' | 'absent' | 'total'
  const [filterRecords, setFilterRecords] = useState([]);
  const [filterLoading, setFilterLoading] = useState(false);

  const fetchDashboard = useCallback(async () => {
    try {
      const { data } = await api.get('/admin/dashboard');
      setDashboard(data.dashboard);
    } catch { toast.error('Failed to load dashboard'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchDashboard();
    const t = setInterval(fetchDashboard, 60000);
    return () => clearInterval(t);
  }, [fetchDashboard]);

  const handleKpiClick = async (filter) => {
    // toggle off
    if (activeFilter === filter) {
      setActiveFilter(null);
      setFilterRecords([]);
      return;
    }
    setActiveFilter(filter);
    setFilterLoading(true);
    try {
      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];

      if (filter === 'absent') {
        // Absent = active employees who have NO record today
        const [attendRes, empRes] = await Promise.all([
          api.get('/admin/attendance', { params: { date: todayStr, limit: 200 } }),
          api.get('/admin/employees', { params: { isActive: true, limit: 200 } }),
        ]);
        const checkedInIds = new Set((attendRes.data.records || []).filter(r => r.checkInTime).map(r => r.userId?._id || r.userId));
        const absent = (empRes.data.employees || []).filter(e => !checkedInIds.has(e._id));
        // Shape to match record format for display
        setFilterRecords(absent.map(e => ({ _id: e._id, userId: e, checkInTime: null, checkOutTime: null, status: 'absent' })));
      } else {
        const { data } = await api.get('/admin/attendance', { params: { date: todayStr, limit: 200 } });
        const all = data.records || [];
        if (filter === 'present') {
          setFilterRecords(all.filter(r => r.checkInTime && r.status === 'present'));
        } else if (filter === 'late') {
          setFilterRecords(all.filter(r => r.checkInTime && r.status === 'late'));
        } else {
          setFilterRecords(all);
        }
      }
    } catch { toast.error('Failed to load records'); }
    finally { setFilterLoading(false); }
  };

  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  if (loading) return (
    <div className="flex justify-center items-center h-64">
      <Spinner size="lg" className="text-attbrand-500" />
    </div>
  );

  const attendancePct = dashboard?.totalEmployees > 0
    ? Math.round((dashboard.checkedIn / dashboard.totalEmployees) * 100) : 0;

  const filterLabel = {
    present: { text: 'Present', color: '#34d399' },
    late:    { text: 'Late',    color: '#fbbf24' },
    absent:  { text: 'Absent',  color: '#f87171' },
    total:   { text: 'All Employees', color: 'var(--fd-accent)' },
  };

  return (
    <div className="p-5 md:p-8 max-w-5xl mx-auto space-y-5 animate-fade-in">
      {/* Header */}
      <div className="animate-slide-up">
        <h1 className="page-title">Dashboard</h1>
        <p className="text-gray-600 text-sm mt-1 font-mono">{today}</p>
      </div>

      {/* Holidays */}
      <HolidaysCard onChange={fetchDashboard} />

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 stagger">
        <StatCard label="Total Employees" value={dashboard?.totalEmployees} accent="var(--fd-accent)" active={activeFilter === 'total'}   onClick={() => handleKpiClick('total')}   />
        <StatCard label="Present Today"   value={dashboard?.present}        accent="#34d399" active={activeFilter === 'present'} onClick={() => handleKpiClick('present')} />
        <StatCard label="Late Today"      value={dashboard?.late}           accent="#fbbf24" active={activeFilter === 'late'}    onClick={() => handleKpiClick('late')}    />
        <StatCard label="Absent Today"    value={dashboard?.absent}         accent="#f87171" active={activeFilter === 'absent'}  onClick={() => handleKpiClick('absent')}  />
      </div>

      {/* Inline filter panel */}
      {activeFilter && (
        <div className="rounded-2xl overflow-hidden animate-fade-in" style={panelStyle}>
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--fd-border)' }}>
            <p className="section-title" style={{ color: filterLabel[activeFilter].color }}>
              {filterLabel[activeFilter].text}
              {!filterLoading && <span className="ml-2 text-gray-600 text-xs font-normal">({filterRecords.length})</span>}
            </p>
            <button onClick={() => { setActiveFilter(null); setFilterRecords([]); }} className="text-gray-600 hover:text-gray-300 transition-colors text-xs">✕ Close</button>
          </div>

          {filterLoading ? (
            <div className="flex justify-center py-8"><Spinner size="md" className="text-attbrand-500" /></div>
          ) : filterRecords.length === 0 ? (
            <p className="text-center text-gray-600 py-8 text-sm">No records found</p>
          ) : (
            <div>
              {filterRecords.map((r, i) => (
                <div
                  key={r._id}
                  className="flex items-center justify-between px-5 py-3 hover:bg-white/[0.02] transition-colors"
                  style={i < filterRecords.length - 1 ? { borderBottom: '1px solid var(--fd-border)' } : {}}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-black flex-shrink-0"
                      style={{ background: 'linear-gradient(135deg, var(--fd-accent), var(--fd-accent-hover))' }}
                    >
                      {r.userId?.name?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-200">{r.userId?.name || '—'}</p>
                      <p className="text-[11px] text-gray-600">{r.userId?.department || r.userId?.email || ''}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {r.checkInTime && (
                      <div className="text-right hidden sm:block">
                        <p className="text-xs text-emerald-400 font-mono">{fmt(r.checkInTime)}</p>
                        {r.checkOutTime && <p className="text-xs text-amber-400 font-mono">{fmt(r.checkOutTime)}</p>}
                      </div>
                    )}
                    <StatusBadge status={displayStatus(r)} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Attendance rate bar */}
      <div
        className="rounded-2xl p-5 relative overflow-hidden animate-fade-in"
        style={{
          background: 'var(--fd-card-bg)',
          
          border: '1px solid var(--fd-border)',
        }}
      >
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/8 to-transparent" />
        <div className="flex items-center justify-between mb-4">
          <p className="section-title">Today's Attendance Rate</p>
          <span className="font-display font-bold text-2xl text-gradient">{attendancePct}%</span>
        </div>
        {/* Progress bar */}
        <div className="relative w-full h-2 rounded-full overflow-hidden" style={{ background: 'var(--fd-border)' }}>
          <div
            className="absolute left-0 top-0 h-full rounded-full transition-all duration-1000"
            style={{
              width: `${attendancePct}%`,
              background: 'linear-gradient(90deg, var(--fd-accent), var(--fd-accent-hover))',
              boxShadow: '0 0 8px rgba(var(--fd-accent-rgb),0.4)',
            }}
          />
        </div>
        <div className="flex justify-between mt-2 text-[11px] text-gray-600">
          <span>{dashboard?.checkedIn ?? 0} checked in</span>
          <span>{dashboard?.totalEmployees ?? 0} total</span>
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid md:grid-cols-3 gap-4">
        {/* Live feed - 2 cols */}
        <div
          className="md:col-span-2 rounded-2xl p-5 relative overflow-hidden"
          style={{
            background: 'var(--fd-card-bg)',
            
            border: '1px solid var(--fd-border)',
          }}
        >
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/6 to-transparent" />
          <div className="flex items-center gap-2 mb-4">
            <span className="glow-dot" />
            <p className="section-title">Live Check-in Feed</p>
          </div>

          {!dashboard?.liveFeed?.length ? (
            <div className="text-center py-10">
              <div className="w-10 h-10 rounded-xl bg-white/[0.03] border border-white/[0.05] flex items-center justify-center mx-auto mb-3">
                <svg className="w-5 h-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-gray-600 text-sm">No check-ins yet today</p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {dashboard.liveFeed.map((item, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between py-3 transition-colors"
                  style={{ borderBottom: i < dashboard.liveFeed.length - 1 ? '1px solid var(--fd-border)' : 'none' }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-black flex-shrink-0"
                      style={{ background: 'linear-gradient(135deg, var(--fd-accent), var(--fd-accent-hover))', fontFamily: 'Syne, sans-serif' }}
                    >
                      {item.name?.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-200">{item.name}</p>
                      <p className="text-[11px] text-gray-600">{item.email}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <StatusBadge status={item.status} />
                    <p className="text-[10px] text-gray-600 mt-1 font-mono">{fmt(item.checkInTime)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Avg work hours */}
        <div
          className="rounded-2xl p-5 flex flex-col justify-between relative overflow-hidden"
          style={{
            background: 'var(--fd-card-bg)',
            
            border: '1px solid var(--fd-border)',
          }}
        >
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/6 to-transparent" />
          <div>
            <p className="label mb-3">Avg Work Hours</p>
            <p className="font-display font-bold text-5xl text-white leading-none">{dashboard?.avgWorkHours || 0}</p>
            <p className="text-gray-600 text-sm mt-1">hours today</p>
          </div>
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center mt-4"
            style={{ background: 'rgba(var(--fd-accent-rgb),0.08)', border: '1px solid rgba(var(--fd-accent-rgb),0.15)' }}
          >
            <svg className="w-6 h-6 text-attbrand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}