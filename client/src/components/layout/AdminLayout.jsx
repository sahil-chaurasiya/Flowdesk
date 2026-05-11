import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, CheckSquare, MessageSquare,
  FileText, BarChart3, Upload, Bell, LogOut, ChevronLeft,
  ChevronRight, Menu, X, Rss, Building2, Target, ListChecks,
  Instagram
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
  { to: '/admin/clients', icon: Building2, label: 'Clients', managerOnly: true },
  { to: '/admin/tasks', icon: CheckSquare, label: 'All Tasks', managerOnly: true },
  { to: '/admin/my-tasks', icon: ListChecks, label: 'My Tasks', teamOnly: true },
  { to: '/admin/leads', icon: Target, label: 'Leads', managerOnly: true },
  { to: '/admin/updates', icon: Rss, label: 'Updates' },
  { to: '/admin/social', icon: Instagram, label: 'Social Media' },
  { to: '/admin/reports', icon: BarChart3, label: 'Reports' },
  { to: '/admin/files', icon: Upload, label: 'Files' },
  { to: '/admin/messages', icon: MessageSquare, label: 'Messages' },
  { to: '/admin/team', icon: Users, label: 'Team', adminOnly: true },
];

const TEAM_ROLES = ['performance_marketer', 'social_media_manager', 'video_editor', 'graphic_designer', 'copywriter'];

export default function AdminLayout() {
  const { user, logout, updateUser } = useAuthStore();
  const { socket } = useSocket();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showNotifs, setShowNotifs] = useState(false);

  // Close mobile sidebar on resize to desktop
  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 768) setMobileOpen(false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Prevent body scroll when mobile sidebar is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
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

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const isAdmin = user?.role === 'admin';
  const isManager = ['admin', 'manager'].includes(user?.role);
  const isTeamMember = TEAM_ROLES.includes(user?.role);

  const filteredNav = navItems.filter(item => {
    if (item.adminOnly) return isAdmin;
    if (item.managerOnly) return isManager;
    if (item.teamOnly) return isTeamMember;
    return true;
  });

  const SidebarContent = ({ isMobile = false }) => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className={`flex items-center gap-3 px-4 py-5 border-b border-white/10 ${collapsed && !isMobile ? 'justify-center' : ''}`}>
        <div className="w-9 h-9 bg-brand-600 rounded-lg flex items-center justify-center flex-shrink-0">
          <span className="text-white font-bold text-sm">TF</span>
        </div>
        {(!collapsed || isMobile) && (
          <div className="flex-1 min-w-0">
            <div className="text-white font-bold text-sm leading-tight truncate">To Fly Media</div>
            <div className="text-slate-400 text-xs truncate">{ROLE_LABELS[user?.role] || 'Team Portal'}</div>
          </div>
        )}
        {isMobile && (
          <button
            onClick={() => setMobileOpen(false)}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors ml-auto"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {filteredNav.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `sidebar-link ${isActive ? 'active' : ''} ${collapsed && !isMobile ? 'justify-center' : ''}`
            }
            title={collapsed && !isMobile ? label : undefined}
            onClick={() => setMobileOpen(false)}
          >
            <Icon size={18} className="flex-shrink-0" />
            {(!collapsed || isMobile) && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Role badge */}
      {(!collapsed || isMobile) && (
        <div className="px-4 pb-2">
          <div className="bg-white/5 rounded-lg px-3 py-2 text-center">
            <div className="text-xs text-slate-400 leading-tight">Signed in as</div>
            <div className="text-xs font-semibold text-white mt-0.5 truncate">{ROLE_LABELS[user?.role] || user?.role}</div>
          </div>
        </div>
      )}

      {/* User section */}
      <div className="border-t border-white/10 p-3">
        <div className={`flex items-center gap-3 px-2 py-2 rounded-lg ${collapsed && !isMobile ? 'justify-center' : ''}`}>
          <div className="w-8 h-8 bg-brand-600 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {getInitials(user?.name)}
          </div>
          {(!collapsed || isMobile) && (
            <div className="flex-1 min-w-0">
              <div className="text-white text-sm font-medium truncate">{user?.name}</div>
              <div className="text-slate-400 text-xs truncate">{user?.email}</div>
            </div>
          )}
        </div>
        <button
          onClick={handleLogout}
          className={`sidebar-link mt-1 text-slate-400 hover:text-red-400 hover:bg-red-500/10 w-full ${collapsed && !isMobile ? 'justify-center' : ''}`}
        >
          <LogOut size={16} />
          {(!collapsed || isMobile) && <span>Sign out</span>}
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Desktop sidebar */}
      <aside
        className={`hidden md:flex flex-col bg-sidebar transition-all duration-300 flex-shrink-0 relative ${collapsed ? 'w-16' : 'w-56'}`}
      >
        <SidebarContent />
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute top-1/2 -translate-y-1/2 translate-x-full bg-sidebar border border-white/10 rounded-r-lg p-1.5 text-slate-400 hover:text-white transition-colors z-10 hidden md:flex"
          style={{ left: collapsed ? '3.5rem' : '13.5rem' }}
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute left-0 top-0 bottom-0 w-72 max-w-[85vw] bg-sidebar z-50 shadow-2xl">
            <SidebarContent isMobile />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4 flex-shrink-0 gap-2">
          <button
            className="md:hidden text-slate-500 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-colors flex-shrink-0"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>

          {/* Mobile brand name */}
          <div className="flex items-center gap-2 md:hidden">
            <div className="w-6 h-6 bg-brand-600 rounded flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-xs">TF</span>
            </div>
            <span className="text-slate-700 font-semibold text-sm">To Fly Media</span>
          </div>

          <div className="flex-1" />

          <div className="flex items-center gap-1">
            <div className="relative">
              <button
                onClick={() => setShowNotifs(!showNotifs)}
                className="relative p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                aria-label="Notifications"
              >
                <Bell size={18} />
                {user?.notifications?.filter(n => !n.read).length > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
                )}
              </button>
              {showNotifs && <NotificationPanel onClose={() => setShowNotifs(false)} />}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-5 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}