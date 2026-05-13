import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, CheckSquare, MessageSquare,
  BarChart3, Upload, Bell, LogOut, ChevronLeft,
  ChevronRight, Menu, X, Rss, Building2, Target,
  ListChecks, Instagram,
} from 'lucide-react';
import useAuthStore from '../../context/authStore';
import { useSocket } from '../../context/SocketContext';
import NotificationPanel from '../shared/NotificationPanel';
import { getInitials } from '../../lib/utils';

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
  { to: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/admin/clients',   icon: Building2,      label: 'Clients',    managerOnly: true },
  { to: '/admin/tasks',     icon: CheckSquare,    label: 'All Tasks',  managerOnly: true },
  { to: '/admin/my-tasks',  icon: ListChecks,     label: 'My Tasks',   teamOnly: true },
  { to: '/admin/leads',     icon: Target,         label: 'Leads',      managerOnly: true },
  { to: '/admin/updates',   icon: Rss,            label: 'Updates' },
  { to: '/admin/social',    icon: Instagram,      label: 'Social Media' },
  { to: '/admin/reports',   icon: BarChart3,      label: 'Reports' },
  { to: '/admin/files',     icon: Upload,         label: 'Files' },
  { to: '/admin/messages',  icon: MessageSquare,  label: 'Messages' },
  { to: '/admin/team',      icon: Users,          label: 'Team',       adminOnly: true },
];

const NAV_SECTIONS = [
  { label: 'Workspace', keys: ['/admin/dashboard', '/admin/clients', '/admin/tasks', '/admin/my-tasks', '/admin/leads'] },
  { label: 'Delivery',  keys: ['/admin/updates', '/admin/social', '/admin/reports', '/admin/files'] },
  { label: 'Connect',   keys: ['/admin/messages', '/admin/team'] },
];

const TEAM_ROLES = ['performance_marketer', 'social_media_manager', 'video_editor', 'graphic_designer', 'copywriter'];

export default function AdminLayout() {
  const { user, logout, updateUser } = useAuthStore();
  const { socket } = useSocket();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showNotifs, setShowNotifs] = useState(false);

  useEffect(() => {
    const onResize = () => { if (window.innerWidth >= 768) setMobileOpen(false); };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  useEffect(() => {
    if (!socket) return;
    const handler = (notif) => {
      updateUser({ notifications: [notif, ...(user?.notifications || [])].slice(0, 50) });
    };
    socket.on('notification', handler);
    return () => socket.off('notification', handler);
  }, [socket, user?.notifications, updateUser]);

  const handleLogout = async () => { await logout(); navigate('/login'); };

  const isAdmin    = user?.role === 'admin';
  const isManager  = ['admin', 'manager'].includes(user?.role);
  const isTeam     = TEAM_ROLES.includes(user?.role);

  const filteredNav = navItems.filter(item => {
    if (item.adminOnly)   return isAdmin;
    if (item.managerOnly) return isManager;
    if (item.teamOnly)    return isTeam;
    return true;
  });

  const unread = user?.notifications?.filter(n => !n.read).length || 0;

  const SidebarContent = ({ isMobile = false }) => (
    <div className="flex flex-col h-full">

      {/* Logo */}
      <div className={`flex items-center gap-2.5 px-4 h-[58px] border-b border-[#eeece8] flex-shrink-0 ${collapsed && !isMobile ? 'justify-center' : ''}`}>
        {/* Logomark */}
        <div className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center bg-[#4f6ef0]"
          style={{ boxShadow: '0 1px 3px rgba(79,110,240,0.35)' }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2.5 11L7 3L11.5 11" stroke="white" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M4.5 8H9.5" stroke="white" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
        </div>
        {(!collapsed || isMobile) && (
          <div className="flex-1 min-w-0">
            <div className="text-[13.5px] font-semibold text-[#1a1916] leading-none tracking-[-0.01em]">Flowdesk</div>
            <div className="text-[11px] text-[#a8a49e] mt-0.5 truncate">{ROLE_LABELS[user?.role] || 'Team Portal'}</div>
          </div>
        )}
        {isMobile && (
          <button onClick={() => setMobileOpen(false)} className="btn-ghost p-1.5 ml-auto">
            <X size={15} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2.5 py-3 overflow-y-auto">
        {NAV_SECTIONS.map(section => {
          const items = filteredNav.filter(item => section.keys.includes(item.to));
          if (!items.length) return null;
          return (
            <div key={section.label} className="mb-3 last:mb-0">
              {(!collapsed || isMobile) && (
                <div className="px-2 mb-1 pt-1">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-[#ccc9c2]">
                    {section.label}
                  </span>
                </div>
              )}
              <div className="space-y-0.5">
                {items.map(({ to, icon: Icon, label }) => (
                  <NavLink
                    key={to}
                    to={to}
                    className={({ isActive }) =>
                      `sidebar-link ${isActive ? 'active' : ''} ${collapsed && !isMobile ? 'justify-center' : ''}`
                    }
                    title={collapsed && !isMobile ? label : undefined}
                    onClick={() => setMobileOpen(false)}
                  >
                    <div className="icon-wrap">
                      <Icon size={15} strokeWidth={1.7} />
                    </div>
                    {(!collapsed || isMobile) && <span>{label}</span>}
                  </NavLink>
                ))}
              </div>
            </div>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="border-t border-[#eeece8] p-2.5 flex-shrink-0">
        <div className={`flex items-center gap-2.5 px-2 py-2 rounded-lg ${collapsed && !isMobile ? 'justify-center' : ''}`}>
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold flex-shrink-0"
            style={{ background: '#eff0fe', color: '#3a56d4' }}
          >
            {getInitials(user?.name)}
          </div>
          {(!collapsed || isMobile) && (
            <div className="flex-1 min-w-0">
              <div className="text-[12.5px] font-medium text-[#1a1916] truncate leading-none">{user?.name}</div>
              <div className="text-[10.5px] text-[#a8a49e] mt-0.5 truncate">{user?.email}</div>
            </div>
          )}
        </div>
        <button
          onClick={handleLogout}
          className={`sidebar-link mt-0.5 hover:text-red-600 hover:bg-red-50 w-full ${collapsed && !isMobile ? 'justify-center' : ''}`}
        >
          <div className="icon-wrap"><LogOut size={14} strokeWidth={1.7} /></div>
          {(!collapsed || isMobile) && <span>Sign out</span>}
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#f7f6f3' }}>

      {/* Desktop sidebar */}
      <aside
        className={`hidden md:flex flex-col transition-all duration-250 ease-in-out flex-shrink-0 relative border-r border-[#eeece8] ${collapsed ? 'w-[52px]' : 'w-[216px]'}`}
        style={{ background: '#ffffff' }}
      >
        <SidebarContent />
        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-[70px] w-5.5 h-5.5 bg-white border border-[#e0ddd7] rounded-full flex items-center justify-center text-[#a8a49e] hover:text-[#44423d] transition-all z-10"
          style={{ width: '22px', height: '22px', boxShadow: '0 1px 4px rgba(28,25,20,0.1)' }}
        >
          {collapsed ? <ChevronRight size={11} strokeWidth={2.5} /> : <ChevronLeft size={11} strokeWidth={2.5} />}
        </button>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-[#1a1916]/30 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside
            className="absolute left-0 top-0 bottom-0 w-72 max-w-[85vw] z-50 border-r border-[#eeece8] shadow-float animate-slide-in"
            style={{ background: '#ffffff' }}
          >
            <SidebarContent isMobile />
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Topbar */}
        <header
          className="h-[58px] flex items-center justify-between px-5 flex-shrink-0 gap-3 border-b border-[#eeece8]"
          style={{ background: '#ffffff' }}
        >
          <button className="md:hidden btn-ghost p-1.5 flex-shrink-0" onClick={() => setMobileOpen(true)}>
            <Menu size={17} />
          </button>

          {/* Mobile brand */}
          <div className="flex items-center gap-2 md:hidden">
            <div className="w-6 h-6 rounded bg-[#4f6ef0] flex items-center justify-center">
              <svg width="10" height="10" viewBox="0 0 14 14" fill="none">
                <path d="M2.5 11L7 3L11.5 11" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span className="text-[13px] font-semibold text-[#1a1916]">Flowdesk</span>
          </div>

          <div className="flex-1" />

          {/* Right */}
          <div className="flex items-center gap-1">
            <div className="relative">
              <button
                onClick={() => setShowNotifs(!showNotifs)}
                className="relative btn-ghost p-2"
                aria-label="Notifications"
              >
                <Bell size={16} strokeWidth={1.7} />
                {unread > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-[7px] h-[7px] bg-[#4f6ef0] rounded-full ring-2 ring-white" />
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
    </div>
  );
}
