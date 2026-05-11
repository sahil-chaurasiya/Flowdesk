import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Rss, FileText, BarChart3,
  MessageCircle, ClipboardList, Bell, LogOut,
  Menu, X, Target, Instagram
} from 'lucide-react';
import useAuthStore from '../../context/authStore';
import { useSocket } from '../../context/SocketContext';
import NotificationPanel from '../shared/NotificationPanel';
import { getInitials } from '../../lib/utils';

const navItems = [
  { to: '/portal/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/portal/updates', icon: Rss, label: 'Updates' },
  { to: '/portal/social', icon: Instagram, label: 'Social Media' },
  { to: '/portal/leads', icon: Target, label: 'My Leads' },
  { to: '/portal/reports', icon: BarChart3, label: 'Reports' },
  { to: '/portal/files', icon: FileText, label: 'Files' },
  { to: '/portal/requests', icon: ClipboardList, label: 'Requests' },
  { to: '/portal/chat', icon: MessageCircle, label: 'Chat' },
];

export default function ClientLayout() {
  const { user, logout, updateUser } = useAuthStore();
  const { socket } = useSocket();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showNotifs, setShowNotifs] = useState(false);

  // Close sidebar on resize to desktop
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

  const SidebarContent = ({ isMobile = false }) => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
        <div className="w-9 h-9 bg-brand-600 rounded-lg flex items-center justify-center flex-shrink-0">
          <span className="text-white font-bold text-sm">TF</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-white font-bold text-sm leading-tight">To Fly Media</div>
          <div className="text-slate-400 text-xs">Client Portal</div>
        </div>
        {isMobile && (
          <button
            onClick={() => setMobileOpen(false)}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            onClick={() => setMobileOpen(false)}
          >
            <Icon size={18} className="flex-shrink-0" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* User section */}
      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-3 px-2 py-2 rounded-lg">
          <div className="w-8 h-8 bg-brand-600 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {getInitials(user?.name)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-white text-sm font-medium truncate">{user?.name}</div>
            <div className="text-slate-400 text-xs truncate">Client</div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="sidebar-link mt-1 text-slate-400 hover:text-red-400 hover:bg-red-500/10 w-full"
        >
          <LogOut size={16} />
          <span>Sign out</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col bg-sidebar w-56 flex-shrink-0">
        <SidebarContent />
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

          {/* Mobile brand */}
          <div className="flex items-center gap-2 md:hidden">
            <div className="w-6 h-6 bg-brand-600 rounded flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-xs">TF</span>
            </div>
            <span className="text-slate-700 font-semibold text-sm">Client Portal</span>
          </div>

          <div className="flex-1" />

          <div className="relative">
            <button
              onClick={() => setShowNotifs(!showNotifs)}
              className="relative p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
              aria-label="Notifications"
            >
              <Bell size={18} />
              {user?.notifications?.filter(n => !n.read).length > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
              )}
            </button>
            {showNotifs && <NotificationPanel onClose={() => setShowNotifs(false)} />}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-5 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}