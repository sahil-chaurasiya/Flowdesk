import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Rss, FileText, BarChart3,
  MessageCircle, ClipboardList, Bell, LogOut,
  Menu, X, Target, Instagram,
} from 'lucide-react';
import useAuthStore from '../../context/authStore';
import { useSocket } from '../../context/SocketContext';
import NotificationPanel from '../shared/NotificationPanel';
import { getInitials } from '../../lib/utils';

const navItems = [
  { to: '/portal/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/portal/updates',   icon: Rss,             label: 'Updates' },
  { to: '/portal/social',    icon: Instagram,       label: 'Social Media' },
  { to: '/portal/leads',     icon: Target,          label: 'My Leads' },
  { to: '/portal/reports',   icon: BarChart3,       label: 'Reports' },
  { to: '/portal/files',     icon: FileText,        label: 'Files' },
  { to: '/portal/requests',  icon: ClipboardList,   label: 'Requests' },
  { to: '/portal/chat',      icon: MessageCircle,   label: 'Chat' },
];

export default function ClientLayout() {
  const { user, logout, updateUser } = useAuthStore();
  const { socket } = useSocket();
  const navigate = useNavigate();
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
  const unread = user?.notifications?.filter(n => !n.read).length || 0;

  const SidebarContent = ({ isMobile = false }) => (
    <div className="flex flex-col h-full">

      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 h-[58px] border-b border-[#eeece8] flex-shrink-0">
        <div
          className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center bg-[#4f6ef0]"
          style={{ boxShadow: '0 1px 3px rgba(79,110,240,0.35)' }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2.5 11L7 3L11.5 11" stroke="white" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M4.5 8H9.5" stroke="white" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13.5px] font-semibold text-[#1a1916] leading-none tracking-[-0.01em]">To Fly Media</div>
          <div className="text-[11px] text-[#a8a49e] mt-0.5">Client Portal</div>
        </div>
        {isMobile && (
          <button onClick={() => setMobileOpen(false)} className="btn-ghost p-1.5">
            <X size={15} />
          </button>
        )}
      </div>

      {/* Status pill */}
      <div className="mx-3 mt-3 mb-1 px-3 py-2 rounded-lg flex items-center gap-2"
        style={{ background: '#edf7f1', border: '1px solid #b8e2c9' }}>
        <span className="w-1.5 h-1.5 rounded-full bg-[#2a7d4f] flex-shrink-0" />
        <span className="text-[11px] text-[#2a7d4f] font-medium">Workspace active</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2.5 py-3 overflow-y-auto">
        <div className="space-y-0.5">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
              onClick={() => setMobileOpen(false)}
            >
              <div className="icon-wrap">
                <Icon size={15} strokeWidth={1.7} />
              </div>
              <span>{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>

      {/* User footer */}
      <div className="border-t border-[#eeece8] p-2.5 flex-shrink-0">
        <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold flex-shrink-0"
            style={{ background: '#edf7f1', color: '#2a7d4f' }}
          >
            {getInitials(user?.name)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[12.5px] font-medium text-[#1a1916] truncate leading-none">{user?.name}</div>
            <div className="text-[10.5px] text-[#a8a49e] mt-0.5">Client</div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="sidebar-link mt-0.5 hover:text-red-600 hover:bg-red-50 w-full"
        >
          <div className="icon-wrap"><LogOut size={14} strokeWidth={1.7} /></div>
          <span>Sign out</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#f7f6f3' }}>

      {/* Desktop sidebar */}
      <aside
        className="hidden md:flex flex-col w-[216px] flex-shrink-0 border-r border-[#eeece8]"
        style={{ background: '#ffffff' }}
      >
        <SidebarContent />
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
        <header
          className="h-[58px] flex items-center justify-between px-5 flex-shrink-0 gap-3 border-b border-[#eeece8]"
          style={{ background: '#ffffff' }}
        >
          <button className="md:hidden btn-ghost p-1.5 flex-shrink-0" onClick={() => setMobileOpen(true)}>
            <Menu size={17} />
          </button>
          <div className="flex items-center gap-2 md:hidden">
            <div className="w-6 h-6 rounded bg-[#4f6ef0] flex items-center justify-center">
              <svg width="10" height="10" viewBox="0 0 14 14" fill="none">
                <path d="M2.5 11L7 3L11.5 11" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span className="text-[13px] font-semibold text-[#1a1916]">Client Portal</span>
          </div>
          <div className="flex-1" />
          <div className="relative">
            <button onClick={() => setShowNotifs(!showNotifs)} className="relative btn-ghost p-2">
              <Bell size={16} strokeWidth={1.7} />
              {unread > 0 && (
                <span className="absolute top-1.5 right-1.5 w-[7px] h-[7px] bg-[#4f6ef0] rounded-full ring-2 ring-white" />
              )}
            </button>
            {showNotifs && <NotificationPanel onClose={() => setShowNotifs(false)} />}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-5 lg:p-7">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
