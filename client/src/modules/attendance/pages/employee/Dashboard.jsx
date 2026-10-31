import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useGeolocation } from '../../hooks/useGeolocation';
import api from '../../services/api';
import toast from 'react-hot-toast';
import Spinner from '../../components/common/Spinner';
import StatusBadge from '../../components/common/StatusBadge';
import { enablePushNotifications, notifyCheckIn, notifyCheckOut, scheduleReminders } from '../../services/notifications';

const fmt = (d) => d ? new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }) : '--:--';
const fmtHours = (h) => { if (!h) return '0h 0m'; const hrs = Math.floor(h); const min = Math.round((h - hrs) * 60); return `${hrs}h ${min}m`; };

function LiveClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(t); }, []);
  return (
    <div className="text-center">
      <p className="font-mono text-[3.25rem] font-bold text-white tracking-tight leading-none"
        style={{ fontFamily: 'DM Mono, monospace', textShadow: '0 0 40px rgba(var(--fd-accent-rgb),0.08)' }}>
        {time.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' })}
      </p>
      <p className="text-gray-600 text-xs mt-2 tracking-wide">
        {time.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' })}
      </p>
    </div>
  );
}

function LiveWorkTimer({ checkInTime }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!checkInTime) return;
    const update = () => setElapsed(Date.now() - new Date(checkInTime).getTime());
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [checkInTime]);

  const h = Math.floor(elapsed / 3600000);
  const m = Math.floor((elapsed % 3600000) / 60000);
  const s = Math.floor((elapsed % 60000) / 1000);
  return (
    <span className="font-mono text-attbrand-500" style={{ fontFamily: 'DM Mono, monospace' }}>
      {String(h).padStart(2,'0')}:{String(m).padStart(2,'0')}:{String(s).padStart(2,'0')}
    </span>
  );
}

function WFHRequestModal({ position, onSubmit, onCancel, loading }) {
  const [comment, setComment] = useState('');
  const [days, setDays] = useState(1);
  const locationName = position ? `${position.latitude.toFixed(5)}, ${position.longitude.toFixed(5)}` : 'Fetching…';

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/80 backdrop-blur-md animate-fade-in">
      <div
        className="w-full max-w-md animate-slide-up"
        style={{
          background: 'var(--fd-card-bg)',
          
          border: '1px solid var(--fd-border)',
          borderRadius: '24px 24px 0 0',
          boxShadow: '0 -8px 64px rgba(0,0,0,0.7)',
          padding: '24px',
        }}
      >
        {/* Top drag handle */}
        <div className="w-10 h-1 rounded-full bg-white/10 mx-auto mb-5" />

        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-attbrand-500/10 border border-attbrand-500/20 flex items-center justify-center">
            <svg className="w-5 h-5 text-attbrand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          </div>
          <div>
            <h2 className="font-display font-bold text-white text-base">Work From Home Request</h2>
            <p className="text-xs text-gray-500">You're outside the office.</p>
          </div>
        </div>

        {/* Location */}
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3 mb-4">
          <p className="label mb-1.5">Your Current Location</p>
          <div className="flex items-center gap-2">
            <svg className="w-3.5 h-3.5 text-attbrand-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="font-mono text-xs text-gray-300">{locationName}</span>
          </div>
          {position?.accuracy && <p className="text-[10px] text-gray-700 mt-1">Accuracy: ±{Math.round(position.accuracy)}m</p>}
        </div>

        {/* Days selector */}
        <div className="mb-4">
          <label className="label block mb-2">Number of Days</label>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setDays(d => Math.max(1, d - 1))}
              className="w-10 h-10 rounded-xl border border-white/[0.08] bg-white/[0.03] flex items-center justify-center text-gray-300 hover:border-attbrand-500/40 hover:text-attbrand-500 transition-all font-bold text-lg"
            >−</button>
            <div className="flex-1 text-center">
              <span className="font-display font-bold text-3xl text-attbrand-500">{days}</span>
              <span className="text-gray-600 text-sm ml-2">{days === 1 ? 'day' : 'days'}</span>
            </div>
            <button
              type="button"
              onClick={() => setDays(d => Math.min(30, d + 1))}
              className="w-10 h-10 rounded-xl border border-white/[0.08] bg-white/[0.03] flex items-center justify-center text-gray-300 hover:border-attbrand-500/40 hover:text-attbrand-500 transition-all font-bold text-lg"
            >+</button>
          </div>
        </div>

        {/* Comment */}
        <div className="mb-5">
          <label className="label block mb-2">Comment (Optional)</label>
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="e.g. Working from home due to travel…"
            rows={2}
            className="input"
          />
        </div>

        <div className="flex gap-3">
          <button type="button" onClick={onCancel} className="btn-secondary flex-1" disabled={loading}>Cancel</button>
          <button
            type="button"
            onClick={() => onSubmit({ comment, days, latitude: position?.latitude, longitude: position?.longitude, accuracy: position?.accuracy })}
            disabled={loading || !position}
            className="btn-primary flex-1 flex items-center justify-center gap-2"
          >
            {loading ? <Spinner size="sm" className="text-black" /> : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            )}
            Send Request
          </button>
        </div>
      </div>
    </div>
  );
}

function WFHPendingBanner({ request }) {
  if (!request) return null;
  return (
    <div className="bg-amber-500/[0.07] border border-amber-500/20 rounded-xl p-3.5 flex items-start gap-3">
      <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
        <svg className="w-3.5 h-3.5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <div>
        <p className="text-sm font-semibold text-amber-400 font-display">WFH Request Pending</p>
        <p className="text-xs text-gray-600 mt-0.5">Waiting for admin approval.</p>
      </div>
    </div>
  );
}

function WFHApprovedBanner({ permission }) {
  if (!permission) return null;
  const remaining = permission.remainingDays ?? permission.daysAllowed;
  if (remaining <= 0) return null;
  return (
    <div className="bg-emerald-500/[0.07] border border-emerald-500/20 rounded-xl p-3.5 flex items-start gap-3">
      <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
        <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <div>
        <p className="text-sm font-semibold text-emerald-400 font-display">WFH Approved ✓</p>
        <p className="text-xs text-gray-600 mt-0.5">{remaining} day{remaining !== 1 ? 's' : ''} remaining</p>
      </div>
    </div>
  );
}

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const { getPosition, loading: geoLoading } = useGeolocation();
  const [attendance, setAttendance] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const [showWFHModal, setShowWFHModal] = useState(false);
  const [wfhPosition, setWFHPosition] = useState(null);
  const [wfhSubmitting, setWFHSubmitting] = useState(false);
  const [pendingWFHRequest, setPendingWFHRequest] = useState(null);
  const [activeWFHPermission, setActiveWFHPermission] = useState(null);

  const greet = () => {
    const h = parseInt(new Date().toLocaleString('en-IN', { hour: 'numeric', hour12: false, timeZone: 'Asia/Kolkata' }));
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const fetchData = useCallback(async () => {
    try {
      const [todayRes, statsRes] = await Promise.all([
        api.get('/attendance/today'),
        api.get('/attendance/stats'),
      ]);
      setAttendance(todayRes.data.attendance);
      setStats(statsRes.data.stats);
    } catch { toast.error('Failed to load attendance data'); }
    finally { setLoading(false); }
  }, []);

  const fetchWFHStatus = useCallback(async () => {
    try {
      const { data } = await api.get('/wfh/my-status');
      setPendingWFHRequest(data.pendingRequest || null);
      setActiveWFHPermission(data.activePermission || null);
    } catch {}
  }, []);

  useEffect(() => { fetchData(); fetchWFHStatus(); }, [fetchData, fetchWFHStatus]);

  const handleCheckIn = async () => {
    setActionLoading(true);
    try {
      const position = await getPosition();
      const { data } = await api.post('/attendance/checkin', { latitude: position.latitude, longitude: position.longitude });
      toast.success(data.message);
      enablePushNotifications();
      notifyCheckIn(data.attendance?.userId?.name || 'You', data.attendance?.status);
      await fetchData();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Check-in failed';
      if (msg.toLowerCase().includes('outside') || msg.toLowerCase().includes('location')) {
        try { const pos = await getPosition(); setWFHPosition(pos); } catch { setWFHPosition(null); }
        setShowWFHModal(true);
      } else {
        toast.error(msg);
      }
    } finally { setActionLoading(false); }
  };

  const handleCheckOut = async () => {
    setActionLoading(true);
    try {
      const position = await getPosition();
      const { data } = await api.post('/attendance/checkout', { latitude: position.latitude, longitude: position.longitude });
      toast.success(data.message);
      await fetchData();
    } catch (err) { toast.error(err.response?.data?.message || err.message || 'Check-out failed'); }
    finally { setActionLoading(false); }
  };

  const handleWFHSubmit = async ({ comment, days, latitude, longitude, accuracy }) => {
    setWFHSubmitting(true);
    try {
      await api.post('/wfh/request', { comment, daysRequested: days, latitude, longitude, accuracy });
      toast.success('WFH request sent to admin!');
      setShowWFHModal(false);
      await fetchWFHStatus();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to send WFH request'); }
    finally { setWFHSubmitting(false); }
  };

  const checkedIn  = !!attendance?.checkInTime;
  const checkedOut = !!attendance?.checkOutTime;
  const canCheckIn  = !checkedIn;
  const canCheckOut = checkedIn && !checkedOut;

  return (
    <div className="min-h-full bg-surface px-4 pt-6 pb-8 max-w-md mx-auto space-y-4 animate-fade-in">
      {showWFHModal && (
        <WFHRequestModal
          position={wfhPosition}
          onSubmit={handleWFHSubmit}
          onCancel={() => setShowWFHModal(false)}
          loading={wfhSubmitting}
        />
      )}

      {/* Greeting */}
      <div className="flex items-start justify-between animate-slide-up">
        <div>
          <p className="text-gray-600 text-sm">{greet()},</p>
          <h1 className="font-display font-bold text-2xl text-white mt-0.5">
            {user?.name?.split(' ')[0]}
            <span className="ml-2 text-xl">👋</span>
          </h1>
        </div>
        {attendance && <StatusBadge status={attendance.status} />}
      </div>

      {/* WFH banners */}
      {pendingWFHRequest && !activeWFHPermission && <WFHPendingBanner request={pendingWFHRequest} />}
      {activeWFHPermission && <WFHApprovedBanner permission={activeWFHPermission} />}

      {/* Clock card */}
      <div
        className="rounded-2xl p-6 text-center relative overflow-hidden animate-slide-up"
        style={{
          background: 'var(--fd-card-bg)',
          
          border: '1px solid var(--fd-border)',
          boxShadow: '0 1px 0 var(--fd-border) inset, 0 8px 32px rgba(0,0,0,0.4)',
          animationDelay: '0.05s',
        }}
      >
        {/* Ambient glow behind clock */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(var(--fd-accent-rgb),0.03) 0%, transparent 70%)' }}
        />
        <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-white/8 to-transparent" />

        <LiveClock />

        {checkedIn && !checkedOut && (
          <div className="mt-4 inline-flex items-center gap-2 bg-emerald-500/[0.08] border border-emerald-500/20 rounded-full px-4 py-1.5">
            <span className="glow-dot" />
            <span className="text-sm text-emerald-400 font-medium">Working · <LiveWorkTimer checkInTime={attendance.checkInTime} /></span>
          </div>
        )}
        {checkedOut && (
          <div className="mt-4 inline-flex items-center gap-2 bg-white/[0.04] border border-white/[0.06] rounded-full px-4 py-1.5">
            <span className="text-sm text-gray-400 font-medium">Done · {fmtHours(attendance.workHours)}</span>
          </div>
        )}
      </div>

      {/* Action buttons */}
      {loading ? (
        <div className="flex justify-center py-6"><Spinner size="lg" className="text-attbrand-500" /></div>
      ) : (
        <div className="space-y-3" style={{ animationDelay: '0.1s' }}>
          {canCheckIn && (
            <button
              onClick={handleCheckIn}
              disabled={actionLoading || geoLoading}
              className="w-full py-5 rounded-2xl text-black font-display font-bold text-xl
                         transition-all duration-300 active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed
                         flex items-center justify-center gap-3 relative overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, var(--fd-accent) 0%, var(--fd-accent-hover) 50%, var(--fd-accent) 100%)',
                backgroundSize: '200% auto',
                boxShadow: '0 0 0 1px rgba(var(--fd-accent-rgb),0.3), 0 8px 24px rgba(var(--fd-accent-rgb),0.25), 0 1px 0 rgba(255,255,255,0.2) inset',
              }}
            >
              {actionLoading || geoLoading ? (
                <><Spinner size="md" className="text-black" /> Getting location…</>
              ) : (
                <>
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                  </svg>
                  Check In
                </>
              )}
            </button>
          )}

          {canCheckOut && (
            <button
              onClick={handleCheckOut}
              disabled={actionLoading || geoLoading}
              className="w-full py-5 rounded-2xl text-white font-display font-bold text-xl
                         transition-all duration-300 active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed
                         flex items-center justify-center gap-3"
              style={{
                background: 'var(--fd-border)',
                border: '1px solid rgba(255,255,255,0.1)',
                boxShadow: '0 1px 0 var(--fd-border) inset',
              }}
            >
              {actionLoading || geoLoading ? (
                <><Spinner size="md" /> Getting location…</>
              ) : (
                <>
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Check Out
                </>
              )}
            </button>
          )}

          {checkedOut && (
            <div className="card p-5 text-center animate-scale-in">
              <div
                className="w-10 h-10 rounded-full bg-attbrand-500/10 border border-attbrand-500/20 flex items-center justify-center mx-auto mb-3"
                style={{ boxShadow: '0 0 16px rgba(var(--fd-accent-rgb),0.1)' }}
              >
                <svg className="w-5 h-5 text-attbrand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="font-display font-semibold text-white">Day Complete!</p>
              <p className="text-gray-600 text-xs mt-1">See you tomorrow 🎉</p>
            </div>
          )}
        </div>
      )}

      {/* Today's timing */}
      {attendance && (
        <div
          className="rounded-2xl p-4 animate-fade-in"
          style={{
            background: 'var(--fd-card-bg)',
            
            border: '1px solid var(--fd-border)',
          }}
        >
          <p className="label mb-3">Today's Timing</p>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-[10px] text-gray-700 mb-1.5">Check In</p>
              <p className="font-mono text-emerald-400 text-sm font-medium">{fmt(attendance.checkInTime)}</p>
            </div>
            <div style={{ borderLeft: '1px solid var(--fd-border)', borderRight: '1px solid var(--fd-border)' }}>
              <p className="text-[10px] text-gray-700 mb-1.5">Check Out</p>
              <p className="font-mono text-gray-500 text-sm font-medium">{fmt(attendance.checkOutTime)}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-700 mb-1.5">Work Hours</p>
              <p className="font-mono text-attbrand-500 text-sm font-medium">{fmtHours(attendance.workHours)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Monthly stats */}
      {stats && (
        <div className="animate-fade-in" style={{ animationDelay: '0.15s' }}>
          <p className="label mb-3">This Month</p>
          <div className="grid grid-cols-2 gap-3 stagger">
            {/* Attendance % */}
            <div className="stat-card">
              <p className="text-[10px] text-gray-600">Attendance</p>
              <p className="text-3xl font-display font-bold text-gradient">{stats.attendancePercent}%</p>
              <div className="w-full rounded-full h-1" style={{ background: 'var(--fd-border)' }}>
                <div
                  className="h-1 rounded-full transition-all duration-700"
                  style={{ width: `${stats.attendancePercent}%`, background: 'linear-gradient(90deg, var(--fd-accent), var(--fd-accent-hover))' }}
                />
              </div>
            </div>
            {/* Streak */}
            <div className="stat-card">
              <p className="text-[10px] text-gray-600">On-time Streak</p>
              <p className="text-3xl font-display font-bold text-white">
                {stats.streak} <span className="text-xl">🔥</span>
              </p>
              <p className="text-[10px] text-gray-700">consecutive days</p>
            </div>
            {/* Present */}
            <div className="stat-card">
              <p className="text-[10px] text-gray-600">Present</p>
              <p className="text-2xl font-display font-bold text-emerald-400">{stats.present}</p>
              <p className="text-[10px] text-gray-700">days</p>
            </div>
            {/* Late */}
            <div className="stat-card">
              <p className="text-[10px] text-gray-600">Late</p>
              <p className="text-2xl font-display font-bold text-amber-400">{stats.late}</p>
              <p className="text-[10px] text-gray-700">days</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
