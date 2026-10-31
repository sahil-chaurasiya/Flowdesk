import React from 'react';
import { NavLink, Outlet, Navigate, Link } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AttendanceAuthProvider, useAuth } from './context/AuthContext';
import useModulesStore from '../../context/modulesStore';
import LoadingScreen from '../../components/shared/LoadingScreen';
import './attendance-theme.css';

const MY_TABS = [
  { to: '/admin/attendance', label: 'My Attendance', end: true },
  { to: '/admin/attendance/history', label: 'History' },
  { to: '/admin/attendance/leave', label: 'Leave' },
  { to: '/admin/attendance/regularization', label: 'Regularization' },
  { to: '/admin/attendance/profile', label: 'Profile' },
];
const ADMIN_TABS = [
  { to: '/admin/attendance/manage', label: 'Overview', end: true },
  { to: '/admin/attendance/manage/employees', label: 'Employees' },
  { to: '/admin/attendance/manage/attendance', label: 'Records' },
  { to: '/admin/attendance/manage/reports', label: 'Reports' },
  { to: '/admin/attendance/manage/wfh-requests', label: 'WFH' },
  { to: '/admin/attendance/manage/leave-requests', label: 'Leave Requests' },
  { to: '/admin/attendance/manage/regularization-requests', label: 'Regularization Requests' },
];

const tabClass = ({ isActive }) =>
  `px-3 py-1.5 rounded-lg text-[12.5px] font-medium whitespace-nowrap transition-colors ${isActive ? 'font-semibold' : ''}`;
const tabStyle = ({ isActive }) => ({
  background: isActive ? 'var(--fd-sidebar-active-bg, var(--fd-accent-tint))' : 'transparent',
  color: isActive ? 'var(--fd-accent)' : 'var(--fd-ink-3)',
});

function Notice({ title, children }) {
  return (
    <div className="max-w-xl mx-auto mt-16 rounded-xl p-6 text-center" style={{ background: 'var(--fd-card-bg)', border: '1px solid var(--fd-border)' }}>
      <div className="text-[15px] font-semibold mb-2" style={{ color: 'var(--fd-ink-1)' }}>{title}</div>
      <div className="text-[13px]" style={{ color: 'var(--fd-ink-3)' }}>{children}</div>
    </div>
  );
}

function Gate() {
  const { user, loading, error } = useAuth();
  const access = useModulesStore((s) => s.access);

  if (loading) return <LoadingScreen />;

  if (error) {
    if (error.code === 'ATTENDANCE_PROFILE_NOT_LINKED') {
      return (
        <Notice title="Your account isn’t linked to an attendance profile">
          {error.reason ? <p className="mb-2">{error.reason}</p> : null}
          <p>Ask an administrator to link your Flowdesk account to your attendance profile.</p>
          {access?.identity?.canManage && (
            <p className="mt-3"><Link to="/admin/identity" className="underline" style={{ color: 'var(--fd-accent)' }}>Open identity reconciliation</Link></p>
          )}
        </Notice>
      );
    }
    if (error.code === 'MODULE_DATABASE_NOT_CONFIGURED') {
      return <Notice title="Attendance is not configured">The server is missing <code>{(error.missing || []).join(', ')}</code>. Flowdesk itself is unaffected.</Notice>;
    }
    if (error.code === 'MODULE_DATABASE_UNAVAILABLE') {
      return <Notice title="Attendance database unavailable">The attendance database can’t be reached right now. Please try again shortly.</Notice>;
    }
    if (error.code === 'ATTENDANCE_ROLE_FORBIDDEN' || error.status === 403) {
      return <Notice title="No access">{error.message || 'Your role does not have access to Attendance.'}</Notice>;
    }
    return <Notice title="Couldn’t load Attendance">{error.message || 'Unexpected error.'}</Notice>;
  }

  const hasProfile = user && !user.synthetic;
  const canAdmin = !!access?.attendance?.canAdmin;

  return (
    <div className="att-module">
      <div className="flex items-center gap-1 overflow-x-auto pb-3 mb-4" style={{ borderBottom: '1px solid var(--fd-border)', scrollbarWidth: 'none' }}>
        {hasProfile && MY_TABS.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.end} className={tabClass} style={tabStyle}>{t.label}</NavLink>
        ))}
        {hasProfile && canAdmin && <span className="mx-2 h-4 w-px" style={{ background: 'var(--fd-border-strong)' }} />}
        {canAdmin && ADMIN_TABS.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.end} className={tabClass} style={tabStyle}>{t.label}</NavLink>
        ))}
      </div>
      <Outlet />
    </div>
  );
}

/** Route guards for the nested pages */
export function RequireProfile({ children }) {
  const { user } = useAuth();
  if (!user || user.synthetic) return <Navigate to="/admin/attendance/manage" replace />;
  return children;
}
export function RequireAttendanceAdmin({ children }) {
  const canAdmin = useModulesStore((s) => !!s.access?.attendance?.canAdmin);
  if (!canAdmin) return <Navigate to="/admin/attendance" replace />;
  return children;
}

export default function AttendanceShell() {
  return (
    <AttendanceAuthProvider>
      <Gate />
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 3500,
          style: { background: 'var(--fd-toast-bg, #fff)', color: 'var(--fd-ink-1)', border: '1px solid var(--fd-border)', borderRadius: '10px', fontSize: '13px' },
        }}
      />
    </AttendanceAuthProvider>
  );
}
