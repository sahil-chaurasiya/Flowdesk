import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users,
  BarChart3, Upload, Bell, LogOut, ChevronLeft,
  ChevronRight, Menu, X, Rss, Building2, Target,
  ListChecks, Instagram, Sun, Moon, Search,
  Kanban, Calendar, Activity, Settings, Briefcase,
  FileSearch, Key, BookUser, CreditCard, PhoneCall,
  ClipboardList, Code2, Terminal, Palette, Check,
} from 'lucide-react';
import useAuthStore from '../../context/authStore';
import { useSocket } from '../../context/SocketContext';
import { useTheme } from '../../context/ThemeContext';
import NotificationPanel from '../shared/NotificationPanel';
import GlobalSearch from '../shared/GlobalSearch';
import { getInitials } from '../../lib/utils';
import api from '../../lib/api';
// ── AI Assistant ──────────────────────────────────────────────────────────────
import AIAssistant from '../ai/AIAssistant';

const ROLE_LABELS = {
  admin: 'Admin',
  manager: 'Project Manager',
  developer: 'Software Developer',
  performance_marketer: 'Performance Marketer',
  social_media_manager: 'Social Media Manager',
  video_editor: 'Video Editor',
  graphic_designer: 'Graphic Designer',
  copywriter: 'Copywriter',
};

const navItems = [
  { to: '/admin/dashboard',        icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/admin/clients',          icon: Building2,       label: 'Clients',           roles: ['admin', 'manager'] },
  { to: '/admin/kanban',           icon: Kanban,          label: 'Kanban',             managerOnly: true },
  { to: '/admin/website-work',     icon: Code2,           label: 'Website Work',      websiteWorkOnly: true },
  { to: '/admin/my-tasks',         icon: ListChecks,      label: 'My Tasks',           teamOnly: true },
  { to: '/admin/my-day',           icon: ClipboardList,   label: 'My Day',             myDayOnly: true },
  { to: '/admin/leads',            icon: Target,          label: 'Client Leads',       roles: ['admin', 'manager'] },
  { to: '/admin/internal-leads',   icon: Briefcase,       label: 'Internal Leads',     internalLeadsOnly: true },
  { to: '/admin/call-tracker',     icon: PhoneCall,       label: 'Call Tracker',       callTrackerOnly: true },
  { to: '/admin/calendar',         icon: Calendar,        label: 'Calendar' },
  { to: '/admin/updates',    icon: Rss,             label: 'Updates',          hideForPM: true },
  { to: '/admin/social',     icon: Instagram,       label: 'Social Media', roles: ['admin', 'manager'] },
  { to: '/admin/reports',    icon: BarChart3,       label: 'Reports',          roles: ['admin', 'manager', 'social_media_manager', 'video_editor', 'graphic_designer', 'copywriter'] },
  { to: '/admin/files',      icon: Upload,          label: 'Files',            hideForPM: true },
  { to: '/admin/team',       icon: Users,           label: 'Team',         adminOnly: true },
  { to: '/admin/team-log',   icon: ClipboardList,   label: 'Team Log',     adminManagerOnly: true },
  { to: '/admin/credentials', icon: Key,            label: 'Credentials',  managerOnly: true },
  { to: '/admin/contacts',   icon: BookUser,        label: 'Contacts',     adminOnly: true },
  { to: '/admin/activity',   icon: Activity,        label: 'Activity',     adminOnly: true },
  { to: '/admin/logs',       icon: FileSearch,      label: 'API Logs',     adminOnly: true },
  { to: '/admin/payment-verifications', icon: CreditCard, label: 'Payments', adminOnly: true },
  { to: '/admin/settings',   icon: Settings,        label: 'Settings' },
];

const NAV_SECTIONS = [
  {
    label: 'Workspace',
    keys: ['/admin/dashboard', '/admin/clients', '/admin/tasks', '/admin/kanban', '/admin/website-work', '/admin/my-tasks', '/admin/my-day', '/admin/leads', '/admin/internal-leads', '/admin/call-tracker'],
  },
  {
    label: 'Delivery',
    keys: ['/admin/calendar', '/admin/updates', '/admin/social', '/admin/reports', '/admin/files'],
  },
  {
    label: 'Connect',
    keys: ['/admin/team', '/admin/team-log', '/admin/credentials', '/admin/contacts'],
  },
  {
    label: 'System',
    keys: ['/admin/activity', '/admin/logs', '/admin/payment-verifications', '/admin/settings'],
  },
];

const TEAM_ROLES = ['performance_marketer', 'social_media_manager', 'video_editor', 'graphic_designer', 'copywriter'];
// Roles that should see the personal "My Tasks" page. This used to be just
// TEAM_ROLES, which meant project managers (and developers) never saw the
// nav link even though they can be assigned tasks directly — every internal
// role should have a "My Tasks" view.
const MY_TASKS_ROLES = ['manager', 'developer', ...TEAM_ROLES];

export default function AdminLayout() {
  const { user, logout, updateUser } = useAuthStore();
  const { socket } = useSocket();
  const { isDark, toggleTheme, devTheme, setDevTheme, devThemes } = useTheme();
  const navigate = useNavigate();
  const [collapsed, setCollapsed]   = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showNotifs, setShowNotifs] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [showThemePicker, setShowThemePicker] = useState(false);

  // Resize listener
  useEffect(() => {
    const onResize = () => { if (window.innerWidth >= 768) setMobileOpen(false); };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Prevent body scroll when mobile drawer is open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  // Real-time notifications
  useEffect(() => {
    if (!socket) return;
    const handler = (notif) => {
      updateUser({ notifications: [notif, ...(user?.notifications || [])].slice(0, 50) });
    };
    socket.on('notification', handler);
    return () => socket.off('notification', handler);
  }, [socket, user?.notifications, updateUser]);

  // Keyboard shortcut for search
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const isLinuxDevTheme = user?.role === 'developer';

  // The Software Developer role does not use the app-wide light/dark system
  // at all — it gets its own set of dedicated visual themes (see the
  // `html[data-role-theme="…"]` and `html[data-dev-mode="true"]` rules in
  // index.css) that the person can pick between. This is a pure CSS re-skin
  // — it doesn't touch any data fetching or component logic — and it is
  // only ever applied for this one role.
  useEffect(() => {
    if (isLinuxDevTheme) {
      document.documentElement.setAttribute('data-role-theme', devTheme);
      document.documentElement.setAttribute('data-dev-mode', 'true');
    } else {
      document.documentElement.removeAttribute('data-role-theme');
      document.documentElement.removeAttribute('data-dev-mode');
    }
    return () => {
      document.documentElement.removeAttribute('data-role-theme');
      document.documentElement.removeAttribute('data-dev-mode');
    };
  }, [isLinuxDevTheme, devTheme]);

  const handleLogout = async () => { await logout(); navigate('/login'); };
  const unread = user?.notifications?.filter(n => !n.read).length || 0;

  const isManager  = ['admin', 'manager', 'developer'].includes(user?.role);
  const isAdmin    = user?.role === 'admin';
  const isPM       = user?.role === 'performance_marketer';
  const isTeamOnly = MY_TASKS_ROLES.includes(user?.role);
  const isInternalLeads = ['admin', 'performance_marketer'].includes(user?.role);
  const isCallTracker   = ['admin', 'performance_marketer'].includes(user?.role);
  const isMyDay         = ['performance_marketer', 'social_media_manager', 'video_editor', 'graphic_designer', 'copywriter', 'manager'].includes(user?.role);
  const isAdminManager  = ['admin', 'manager'].includes(user?.role);
  const isWebsiteWork   = ['admin', 'developer'].includes(user?.role);

  const filteredNavItems = navItems.filter(item => {
    if (item.roles             && !item.roles.includes(user?.role)) return false;
    if (item.adminOnly         && !isAdmin)         return false;
    if (item.managerOnly       && !isManager)       return false;
    if (item.teamOnly          && !isTeamOnly)      return false;
    if (item.websiteWorkOnly   && !isWebsiteWork)   return false;
    if (item.internalLeadsOnly && !isInternalLeads) return false;
    if (item.callTrackerOnly   && !isCallTracker)   return false;
    if (item.hideForPM         && isPM)             return false;
    if (item.myDayOnly         && !isMyDay)         return false;
    if (item.adminManagerOnly  && !isAdminManager)  return false;
    return true;
  });

  const SidebarContent = ({ isMobile = false }) => (
    <div className="flex flex-col h-full" style={{ background: 'var(--fd-sidebar-bg)' }}>

      {/* Logo / Brand */}
      <div
        className="flex items-center gap-3 px-4"
        style={{
          height: '56px',
          borderBottom: '1px solid var(--fd-sidebar-border)',
          flexShrink: 0,
        }}
      >
        {/* Company logo */}
        <div className="flex-shrink-0">
          {isLinuxDevTheme ? (
            <div
              className="w-7 h-7 flex items-center justify-center"
              style={{ background: 'var(--fd-surface-sunken)', border: '1px solid var(--fd-border)', borderRadius: 4 }}
            >
              <Terminal size={14} style={{ color: 'var(--fd-accent)' }} />
            </div>
          ) : (
            <div className="w-7 h-7 rounded-lg overflow-hidden">
              <img src="/icon-512.png" alt="FlowDesk" className="w-full h-full object-cover" />
            </div>
          )}
        </div>
        {(!collapsed || isMobile) && (
          isLinuxDevTheme ? (
            <span className="text-[13px] font-semibold tracking-tight truncate" style={{ color: 'var(--fd-ink-1)', fontFamily: 'var(--fd-mono)' }}>
              <span style={{ color: 'var(--fd-accent)' }}>flowdesk</span>
              <span style={{ color: 'var(--fd-ink-4)' }}>@dev:~$</span>
            </span>
          ) : (
            <span className="text-[14px] font-bold tracking-tight" style={{ color: 'var(--fd-ink-1)' }}>
               To Fly Media FlowDesk
            </span>
          )
        )}
        {isMobile && (
          <button className="ml-auto btn-ghost p-1" onClick={() => setMobileOpen(false)}>
            <X size={16} />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2" style={{ scrollbarWidth: 'none' }}>
        {NAV_SECTIONS.map((section) => {
          const sectionItems = filteredNavItems.filter(item => section.keys.includes(item.to));
          if (sectionItems.length === 0) return null;
          return (
            <div key={section.label} className="mb-4">
              {(!collapsed || isMobile) && (
                <div
                  className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest"
                  style={{ color: 'var(--fd-ink-5)' }}
                >
                  {section.label}
                </div>
              )}
              {sectionItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => isMobile && setMobileOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 mb-0.5 text-[13px] font-medium transition-all duration-150 ${
                      isLinuxDevTheme ? '' : 'rounded-lg'
                    } ${isActive ? '' : 'hover:text-[var(--fd-ink-1)]'}`
                  }
                  style={({ isActive }) => ({
                    background: isActive ? (isLinuxDevTheme ? 'var(--fd-sidebar-active)' : 'var(--fd-sidebar-active-bg)') : 'transparent',
                    color: isActive ? 'var(--fd-accent)' : 'var(--fd-ink-3)',
                    borderRadius: isLinuxDevTheme ? 4 : undefined,
                    borderLeft: isLinuxDevTheme ? `2px solid ${isActive ? 'var(--fd-accent)' : 'transparent'}` : undefined,
                  })}
                  title={collapsed && !isMobile ? item.label : undefined}
                >
                  <item.icon size={16} strokeWidth={1.8} className="flex-shrink-0" />
                  {(!collapsed || isMobile) && <span>{item.label}</span>}
                </NavLink>
              ))}
            </div>
          );
        })}
      </nav>

      {/* User profile */}
      <div
        className="px-3 py-3"
        style={{ borderTop: '1px solid var(--fd-sidebar-border)', flexShrink: 0 }}
      >
        <div className={`flex items-center gap-3 ${collapsed && !isMobile ? 'justify-center' : ''}`}>
          <div
            className="relative w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0 group cursor-pointer overflow-hidden"
            style={{ background: 'var(--fd-accent)' }}
            onClick={() => navigate('/admin/settings')}
            title="Go to profile settings"
          >
            {user?.avatar
              ? <img src={user.avatar} alt={user.name} className="w-full h-full rounded-full object-cover" />
              : getInitials(user?.name || 'U')
            }
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-full">
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </div>
          </div>
          {(!collapsed || isMobile) && (
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-semibold truncate" style={{ color: 'var(--fd-ink-1)' }}>
                {user?.name}
              </div>
              <div className="text-[10.5px] truncate" style={{ color: 'var(--fd-ink-4)' }}>
                {ROLE_LABELS[user?.role] || user?.role}
              </div>
            </div>
          )}
          {(!collapsed || isMobile) && (
            <button
              onClick={handleLogout}
              className="btn-ghost p-1.5 flex-shrink-0"
              title="Sign out"
            >
              <LogOut size={14} style={{ color: 'var(--fd-ink-4)' }} />
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--fd-canvas)' }}>

      {/* ── Desktop Sidebar ─────────────────────────────────────────────── */}
      <aside
        className="hidden md:flex flex-col flex-shrink-0 transition-all duration-200"
        style={{
          width: collapsed ? '60px' : '220px',
          borderRight: '1px solid var(--fd-sidebar-border)',
          position: 'relative',
        }}
      >
        <SidebarContent />

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(v => !v)}
          className="absolute -right-3 top-16 z-10 w-6 h-6 rounded-full flex items-center justify-center shadow-md"
          style={{
            background: 'var(--fd-surface)',
            border: '1px solid var(--fd-border)',
            color: 'var(--fd-ink-3)',
          }}
        >
          {collapsed ? <ChevronRight size={11} /> : <ChevronLeft size={11} />}
        </button>
      </aside>

      {/* ── Mobile Drawer Overlay ────────────────────────────────────────── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside
            className="relative z-10 flex flex-col"
            style={{ width: '240px', background: 'var(--fd-sidebar-bg)' }}
          >
            <SidebarContent isMobile />
          </aside>
        </div>
      )}

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">

        {/* Header */}
        <header
          className="flex items-center gap-2 px-4 flex-shrink-0"
          style={{
            height: '56px',
            borderBottom: '1px solid var(--fd-border)',
            background: 'var(--fd-header-bg)',
          }}
        >
          {/* Mobile menu */}
          <button
            className="md:hidden btn-ghost p-2"
            aria-label="Open menu"
            onClick={() => setMobileOpen(true)}
          >
            <Menu size={17} />
          </button>

          {/* Mobile brand */}
          <div className="flex items-center gap-2 md:hidden">
            <div className="w-6 h-6 rounded bg-[var(--fd-accent)] flex items-center justify-center">
              <svg width="10" height="10" viewBox="0 0 14 14" fill="none">
                <path d="M2.5 11L7 3L11.5 11" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span className="text-[13px] font-semibold" style={{ color: 'var(--fd-ink-1)' }}>Flowdesk</span>
          </div>

          <div className="flex-1" />

          {/* Right controls */}
          <div className="flex items-center gap-1">

            {/* Search trigger (desktop) */}
            <button
              onClick={() => setSearchOpen(true)}
              className="hidden md:flex items-center gap-2 btn-ghost px-3 py-1.5 text-[12px]"
              aria-label="Search"
              title="Search (⌘K)"
            >
              <Search size={14} />
              <span style={{ color: 'var(--fd-ink-4)' }}>Search</span>
              <kbd
                className="text-[10px] px-1 rounded font-mono"
                style={{ background: 'var(--fd-surface-sunken)', color: 'var(--fd-ink-5)', border: '1px solid var(--fd-border)' }}
              >
                ⌘K
              </kbd>
            </button>

            {/* Developer role: theme picker (replaces light/dark entirely —
                this role doesn't use the app-wide theme system at all). */}
            {isLinuxDevTheme && (
              <div className="relative">
                <button
                  onClick={() => setShowThemePicker(v => !v)}
                  className="btn-ghost p-2"
                  aria-label="Choose developer theme"
                  title="Theme"
                >
                  <Palette size={16} strokeWidth={1.7} />
                </button>
                {showThemePicker && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowThemePicker(false)} />
                    <div
                      className="absolute right-0 top-full mt-2 z-20 p-1.5"
                      style={{
                        width: 220,
                        background: 'var(--fd-surface)',
                        border: '1px solid var(--fd-border)',
                        borderRadius: 8,
                        boxShadow: '0 8px 24px rgba(0,0,0,0.28)',
                      }}
                    >
                      {devThemes.map(t => {
                        const active = t.id === devTheme;
                        return (
                          <button
                            key={t.id}
                            onClick={() => { setDevTheme(t.id); setShowThemePicker(false); }}
                            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-left"
                            style={{ background: active ? 'var(--fd-sidebar-active)' : 'transparent' }}
                          >
                            <span
                              className="flex-shrink-0 rounded-full overflow-hidden flex"
                              style={{ width: 16, height: 16, border: '1px solid var(--fd-border-strong)' }}
                            >
                              {t.swatch.map((c, i) => (
                                <span key={i} style={{ background: c, width: '33.34%', height: '100%' }} />
                              ))}
                            </span>
                            <span className="flex-1 min-w-0">
                              <span className="block text-[12px] font-medium truncate" style={{ color: 'var(--fd-ink-1)' }}>
                                {t.label}
                              </span>
                            </span>
                            {active && <Check size={13} style={{ color: 'var(--fd-accent)' }} />}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Dark mode toggle — not shown for the developer role, which
                uses the theme picker above instead */}
            {!isLinuxDevTheme && (
              <button
                onClick={toggleTheme}
                className="btn-ghost p-2"
                aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {isDark
                  ? <Sun size={16} strokeWidth={1.7} />
                  : <Moon size={16} strokeWidth={1.7} />
                }
              </button>
            )}

            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => setShowNotifs(!showNotifs)}
                className="relative btn-ghost p-2"
                aria-label="Notifications"
              >
                <Bell size={16} strokeWidth={1.7} />
                {unread > 0 && (
                  <span
                    className="absolute top-1.5 right-1.5 w-[7px] h-[7px] bg-[var(--fd-accent)] rounded-full"
                    style={{ boxShadow: '0 0 0 2px var(--fd-header-bg)' }}
                  />
                )}
              </button>
              {showNotifs && <NotificationPanel onClose={() => setShowNotifs(false)} />}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-5 lg:p-7">
          <Outlet />
        </main>
      </div>

      {/* ── Global Search ────────────────────────────────────────────────── */}
      <GlobalSearch isOpen={searchOpen} onClose={() => setSearchOpen(false)} />

      {/* ── AI Assistant (floating, role-scoped) ─────────────────────────── */}
      <AIAssistant />
    </div>
  );
}