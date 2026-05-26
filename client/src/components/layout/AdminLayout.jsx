import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users,
  BarChart3, Upload, Bell, LogOut, ChevronLeft,
  ChevronRight, Menu, X, Rss, Building2, Target,
  ListChecks, Instagram, Sun, Moon, Search,
  Kanban, Calendar, Activity, Settings, Briefcase,
  FileSearch, Key, BookUser, CreditCard, PhoneCall,
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
  performance_marketer: 'Performance Marketer',
  social_media_manager: 'Social Media Manager',
  video_editor: 'Video Editor',
  graphic_designer: 'Graphic Designer',
  copywriter: 'Copywriter',
};

const navItems = [
  { to: '/admin/dashboard',        icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/admin/clients',          icon: Building2,       label: 'Clients',           managerOnly: true },
  { to: '/admin/kanban',           icon: Kanban,          label: 'Kanban',             managerOnly: true },
  { to: '/admin/my-tasks',         icon: ListChecks,      label: 'My Tasks',           teamOnly: true },
  { to: '/admin/leads',            icon: Target,          label: 'Client Leads',       managerOnly: true },
  { to: '/admin/internal-leads',   icon: Briefcase,       label: 'Internal Leads',     internalLeadsOnly: true },
  { to: '/admin/call-tracker',     icon: PhoneCall,       label: 'Call Tracker',       callTrackerOnly: true },
  { to: '/admin/calendar',         icon: Calendar,        label: 'Calendar' },
  { to: '/admin/updates',    icon: Rss,             label: 'Updates',          hideForPM: true },
  { to: '/admin/social',     icon: Instagram,       label: 'Social Media', managerOnly: true },
  { to: '/admin/reports',    icon: BarChart3,       label: 'Reports',          hideForPM: true },
  { to: '/admin/files',      icon: Upload,          label: 'Files',            hideForPM: true },
  { to: '/admin/team',       icon: Users,           label: 'Team',         adminOnly: true },
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
    keys: ['/admin/dashboard', '/admin/clients', '/admin/tasks', '/admin/kanban', '/admin/my-tasks', '/admin/leads', '/admin/internal-leads', '/admin/call-tracker'],
  },
  {
    label: 'Delivery',
    keys: ['/admin/calendar', '/admin/updates', '/admin/social', '/admin/reports', '/admin/files'],
  },
  {
    label: 'Connect',
    keys: ['/admin/team', '/admin/credentials', '/admin/contacts'],
  },
  {
    label: 'System',
    keys: ['/admin/activity', '/admin/logs', '/admin/payment-verifications', '/admin/settings'],
  },
];

const TEAM_ROLES = ['performance_marketer', 'social_media_manager', 'video_editor', 'graphic_designer', 'copywriter'];

export default function AdminLayout() {
  const { user, logout, updateUser } = useAuthStore();
  const { socket } = useSocket();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [collapsed, setCollapsed]   = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showNotifs, setShowNotifs] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoInputRef = React.useRef(null);

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    try {
      const fd = new FormData();
      fd.append('avatar', file);
      const { data } = await api.post('/auth/avatar', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      updateUser({ avatar: data.avatar });
    } catch (err) {
      console.error('Logo upload failed', err);
    } finally {
      setUploadingLogo(false);
      e.target.value = '';
    }
  };

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

  const handleLogout = async () => { await logout(); navigate('/login'); };
  const unread = user?.notifications?.filter(n => !n.read).length || 0;

  const isManager  = ['admin', 'manager'].includes(user?.role);
  const isAdmin    = user?.role === 'admin';
  const isPM       = user?.role === 'performance_marketer';
  const isTeamOnly = TEAM_ROLES.includes(user?.role);
  const isInternalLeads = ['admin', 'performance_marketer'].includes(user?.role);
  const isCallTracker   = ['admin', 'performance_marketer'].includes(user?.role);

  const filteredNavItems = navItems.filter(item => {
    if (item.adminOnly         && !isAdmin)         return false;
    if (item.managerOnly       && !isManager)       return false;
    if (item.teamOnly          && !isTeamOnly)      return false;
    if (item.internalLeadsOnly && !isInternalLeads) return false;
    if (item.callTrackerOnly   && !isCallTracker)   return false;
    if (item.hideForPM         && isPM)             return false;
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
        {/* Company logo: click to upload (admin only) */}
        <div className="relative flex-shrink-0 group">
          <input
            ref={logoInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleLogoUpload}
          />
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center overflow-hidden cursor-pointer"
            style={{ background: 'transparent' }}
            onClick={() => isAdmin && logoInputRef.current?.click()}
            title={isAdmin ? 'Click to upload company logo' : undefined}
          >
            {uploadingLogo ? (
              <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="3" strokeDasharray="30 70" />
              </svg>
            ) : (
              <img src="/icon-512.png" alt="FlowDesk" className="w-full h-full object-cover rounded-lg" />
            )}
          </div>
          {isAdmin && !uploadingLogo && (!collapsed || isMobile) && (
            <div
              className="absolute inset-0 rounded-lg bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer"
              onClick={() => logoInputRef.current?.click()}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
            </div>
          )}
        </div>
        {(!collapsed || isMobile) && (
          <span className="text-[14px] font-bold tracking-tight" style={{ color: 'var(--fd-ink-1)' }}>
            FlowDesk
          </span>
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
                    `flex items-center gap-3 px-3 py-2 rounded-lg mb-0.5 text-[13px] font-medium transition-all duration-150 ${
                      isActive
                        ? 'text-[#4f6ef0]'
                        : 'hover:text-[var(--fd-ink-1)]'
                    }`
                  }
                  style={({ isActive }) => ({
                    background: isActive ? 'var(--fd-sidebar-active-bg)' : 'transparent',
                    color: isActive ? '#4f6ef0' : 'var(--fd-ink-3)',
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
            style={{ background: '#4f6ef0' }}
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
            <div className="w-6 h-6 rounded bg-[#4f6ef0] flex items-center justify-center">
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

            {/* Dark mode toggle */}
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
                    className="absolute top-1.5 right-1.5 w-[7px] h-[7px] bg-[#4f6ef0] rounded-full"
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