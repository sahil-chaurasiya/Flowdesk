import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { UserCheck } from 'lucide-react';
import useAuthStore from '../../context/authStore';
import useModulesStore from '../../context/modulesStore';
import ModuleTour from './ModuleTour';

/**
 * Login-time heads-up that Attendance now lives inside Flowdesk.
 *
 * Mounted once in AdminLayout, so it starts on whatever page the person lands on after
 * signing in (normally the dashboard) instead of waiting for them to open Attendance.
 * Two short steps — a welcome card, then a spotlight on the Attendance link in the sidebar —
 * and the last button takes them straight into Attendance, where the in-module tour continues.
 *
 * Shown once per person per browser. Only for people who actually have Attendance access.
 */

export const attendanceIntroKey = (userId) => `fd:tour:attendance-intro:v1:${userId || 'anon'}`;

export const readFlag = (key) => {
  try { return !!window.localStorage.getItem(key); } catch { return true; }   // storage blocked: don't nag
};
const writeFlag = (key) => { try { window.localStorage.setItem(key, '1'); } catch { /* ignore */ } };

// The sidebar's Attendance entry (never the module's own "My Attendance" tab).
const findSidebarLink = () =>
  [...document.querySelectorAll('a[href="/admin/attendance"]')].find((el) => !el.closest('.fd-modnav')) || null;

export default function AttendanceIntroTour() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const userId = useAuthStore((s) => s.user?._id);
  const loaded = useModulesStore((s) => s.loaded);
  const att = useModulesStore((s) => s.access?.attendance);
  const [open, setOpen] = useState(false);

  const key = attendanceIntroKey(userId);
  const eligible = !!userId && loaded && !!att?.enabled && !!att?.canUse;
  const onAttendance = pathname.startsWith('/admin/attendance');

  useEffect(() => {
    if (!eligible || onAttendance || readFlag(key)) return undefined;
    const t = setTimeout(() => setOpen(true), 900);   // let the dashboard paint first
    return () => clearTimeout(t);
  }, [eligible, onAttendance, key]);

  const canAdmin = !!att?.canAdmin;
  const steps = useMemo(() => [
    {
      id: 'welcome',
      icon: UserCheck,
      title: 'Attendance is now part of Flowdesk',
      body: 'Attendance used to be a separate app. Check in, apply for leave and review your hours right here, with the same login.',
    },
    {
      id: 'sidebar',
      target: findSidebarLink,
      placement: ['right', 'bottom'],
      pad: 4,
      title: 'Find it in the sidebar',
      body: canAdmin
        ? 'Attendance is here with your other tools. Attendance Admin, just below it, opens the team view.'
        : 'Attendance is here with your other tools. Open it any time to check in or send a request.',
    },
  ], [canAdmin]);

  const onClose = useCallback((reason) => {
    writeFlag(key);
    setOpen(false);
    if (reason === 'finish') navigate('/admin/attendance');
  }, [key, navigate]);

  return <ModuleTour steps={steps} open={open} onClose={onClose} finishLabel="Open Attendance" lastSkipLabel="Maybe later" />;
}