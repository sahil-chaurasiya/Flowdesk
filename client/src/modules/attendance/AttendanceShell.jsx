import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Outlet, Navigate, Link } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AttendanceAuthProvider, useAuth } from './context/AuthContext';
import useModulesStore from '../../context/modulesStore';
import useAuthStore from '../../context/authStore';
import LoadingScreen from '../../components/shared/LoadingScreen';
import { HelpCircle, UserCheck, CalendarCheck, History, CalendarOff, FileEdit, UserRound, LayoutDashboard, Users, Table2, BarChart3, Laptop, Inbox, ClipboardList, User } from 'lucide-react';
import ModuleNav from '../../components/shared/ModuleNav';
import ModuleTour from '../../components/shared/ModuleTour';
import { attendanceIntroKey, readFlag } from '../../components/shared/AttendanceIntroTour';
import './attendance-theme.css';

const MY_TABS = [
  { to: '/admin/attendance', label: 'My Attendance', icon: CalendarCheck, end: true },
  { to: '/admin/attendance/history', label: 'History', icon: History },
  { to: '/admin/attendance/leave', label: 'Leave', icon: CalendarOff },
  { to: '/admin/attendance/regularization', label: 'Regularization', icon: FileEdit },
  { to: '/admin/attendance/profile', label: 'Profile', icon: UserRound },
];
const ADMIN_TABS = [
  { to: '/admin/attendance/manage', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/admin/attendance/manage/employees', label: 'Employees', icon: Users },
  { to: '/admin/attendance/manage/attendance', label: 'Records', icon: Table2 },
  { to: '/admin/attendance/manage/reports', label: 'Reports', icon: BarChart3 },
  { to: '/admin/attendance/manage/wfh-requests', label: 'WFH', icon: Laptop },
  { to: '/admin/attendance/manage/leave-requests', label: 'Leave Requests', icon: Inbox },
  { to: '/admin/attendance/manage/regularization-requests', label: 'Regularization Requests', icon: ClipboardList },
];


// ── First-visit tour ────────────────────────────────────────────────────────
// Finds the Attendance link in the Flowdesk sidebar without editing the sidebar:
// same href as the "My Attendance" tab, so skip anything inside the module nav.
const findSidebarLink = () =>
  [...document.querySelectorAll('a[href="/admin/attendance"]')].find((el) => !el.closest('.fd-modnav')) || null;
const findModeSwitch = () => document.querySelector('.fd-modnav__box--mode');
const findDock = () => document.querySelector('.fd-modnav__box--dock');
const findPage = () => document.querySelector('.fd-modnav')?.nextElementSibling || null;

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
  const flowdeskUserId = useAuthStore((s) => s.user?._id);

  // Tour: opens by itself the first time someone lands on Attendance, remembered per person
  // on this browser. The "Tour" button beside the tabs replays it.
  const tourKey = `fd:tour:attendance:v1:${flowdeskUserId || 'anon'}`;
  const [tourOpen, setTourOpen] = useState(false);
  const ready = !loading && !error;
  useEffect(() => {
    if (!ready) return undefined;
    let seen = true;
    try { seen = !!window.localStorage.getItem(tourKey); } catch { /* storage blocked: don't nag */ }
    if (seen) return undefined;
    const t = setTimeout(() => setTourOpen(true), 700);
    return () => clearTimeout(t);
  }, [ready, tourKey]);
  const closeTour = useCallback(() => {
    try { window.localStorage.setItem(tourKey, '1'); } catch { /* ignore */ }
    setTourOpen(false);
  }, [tourKey]);

  const hasProfileForTour = !!user && !user.synthetic;
  const canAdminForTour = !!access?.attendance?.canAdmin;
  // The dashboard intro already did the welcome; only repeat it if they replay the tour by hand.
  const introSeen = useMemo(() => readFlag(attendanceIntroKey(flowdeskUserId)), [flowdeskUserId]);
  const [replayed, setReplayed] = useState(false);
  const skipWelcome = introSeen && !replayed;
  const tourSteps = useMemo(() => [
    ...(skipWelcome ? [] : [{
      id: 'welcome',
      icon: UserCheck,
      title: 'Attendance is now part of Flowdesk',
      body: hasProfileForTour
        ? 'Check in, apply for leave and review your hours without leaving this workspace. Here’s a quick look around.'
        : 'Review your team’s attendance, requests and reports without leaving this workspace. Here’s a quick look around.',
    }]),
    {
      id: 'sidebar',
      target: findSidebarLink,
      placement: ['right', 'bottom'],
      pad: 4,
      title: 'Find it in the sidebar',
      body: canAdminForTour
        ? 'Attendance sits with your other tools. Attendance Admin, just below it, opens the team view.'
        : 'Attendance sits with your other tools. Come back here whenever you need it.',
    },
    ...(canAdminForTour && hasProfileForTour ? [{
      id: 'mode',
      target: findModeSwitch,
      placement: ['bottom', 'right'],
      pad: 4,
      title: 'Switch between you and your team',
      body: 'Me is your own attendance. Team has employee records, reports and the requests waiting for approval.',
    }] : []),
    {
      id: 'dock',
      target: findDock,
      placement: ['bottom', 'top'],
      pad: 4,
      title: 'Every page is one tab away',
      body: hasProfileForTour
        ? 'History, leave, regularization and your profile live here. The highlight follows you as you move.'
        : 'Employees, records, reports and every request queue live here. The highlight follows you as you move.',
    },
    {
      id: 'page',
      target: findPage,
      placement: ['right', 'left', 'bottom'],
      pad: 8,
      title: hasProfileForTour ? 'Start with today' : 'Your team at a glance',
      body: hasProfileForTour
        ? 'Check in when you start work and check out when you finish. Working outside the office? You’ll be asked to send a WFH request. Replay this tour anytime from the Tour button.'
        : 'Today’s numbers and pending requests show up here first. Replay this tour anytime from the Tour button.',
    },
  ], [hasProfileForTour, canAdminForTour, skipWelcome]);

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
      <ModuleNav
        groups={[
          { label: 'Me', icon: User, items: hasProfile ? MY_TABS : [] },
          { label: 'Team', icon: Users, items: canAdmin ? ADMIN_TABS : [] },
        ]}
        trailing={(
          <button type="button" className="fd-tour-replay" onClick={() => { setReplayed(true); setTourOpen(true); }} title="Take a quick tour of Attendance">
            <HelpCircle size={14} strokeWidth={1.9} /> Tour
          </button>
        )}
      />
      <Outlet />
      <ModuleTour steps={tourSteps} open={tourOpen} onClose={closeTour} />
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