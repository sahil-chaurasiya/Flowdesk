import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Rss, FileText, BarChart3,
  ClipboardList, Bell, LogOut,
  Menu, X, Target, Instagram, Sun, Moon, Key,
  BookOpen, IndianRupee, Calendar,
} from 'lucide-react';
import useAuthStore from '../../context/authStore';
import api from '../../lib/api';
import { useSocket } from '../../context/SocketContext';
import { useTheme } from '../../context/ThemeContext';
import NotificationPanel from '../shared/NotificationPanel';
import { getInitials } from '../../lib/utils';
// ── AI Assistant ──────────────────────────────────────────────────────────────
import AIAssistant from '../ai/AIAssistant';

const navItems = [
  { to: '/portal/dashboard',    icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/portal/calendar',     icon: Calendar,        label: 'Calendar' },
  { to: '/portal/updates',      icon: Rss,             label: 'Updates' },
  { to: '/portal/social',       icon: Instagram,       label: 'Social Media' },
  { to: '/portal/leads',        icon: Target,          label: 'My Leads' },
  { to: '/portal/reports',      icon: BarChart3,       label: 'Reports' },
  { to: '/portal/files',        icon: FileText,        label: 'Files' },
  { to: '/portal/documents',    icon: BookOpen,        label: 'Documents' },
  { to: '/portal/requests',     icon: ClipboardList,   label: 'Requests' },
  { to: '/portal/payment',      icon: IndianRupee,     label: 'Payment' },
  { to: '/portal/credentials',  icon: Key,             label: 'Credentials' },
];

export default function ClientLayout() {
  const { user, logout, updateUser } = useAuthStore();
  const { socket } = useSocket();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showNotifs, setShowNotifs] = useState(false);
  const [whatsappLink, setWhatsappLink] = useState(null);

  useEffect(() => {
    if (user?.clientId) {
      api.get(`/clients/${user.clientId}`).then(r => {
        const c = r.data.client;
        if (c?.whatsappGroup) setWhatsappLink(c.whatsappGroup);
        else if (c?.whatsappPhone) setWhatsappLink(`https://wa.me/${c.whatsappPhone.replace(/\D/g,'')}`);
      }).catch(() => {});
    }
  }, [user?.clientId]);

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
    <div className="flex flex-col h-full" style={{ background: 'var(--fd-sidebar-bg)' }}>

      {/* Logo */}
      <div
        className="flex items-center gap-2.5 px-4 h-[58px] flex-shrink-0"
        style={{ borderBottom: '1px solid var(--fd-sidebar-border)' }}
      >
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
          <div className="text-[13.5px] font-semibold leading-none tracking-[-0.01em]" style={{ color: 'var(--fd-ink-1)' }}>To Fly Media</div>
          <div className="text-[11px] mt-0.5" style={{ color: 'var(--fd-ink-4)' }}>Client Portal</div>
        </div>
        {isMobile && (
          <button onClick={() => setMobileOpen(false)} className="btn-ghost p-1.5">
            <X size={15} />
          </button>
        )}
      </div>

      {/* Status pill */}
      <div
        className="mx-3 mt-3 mb-1 px-3 py-2 rounded-lg flex items-center gap-2"
        style={{
          background: isDark ? 'rgba(42,125,79,0.15)' : '#edf7f1',
          border: isDark ? '1px solid rgba(42,125,79,0.3)' : '1px solid #b8e2c9',
        }}
      >
        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: isDark ? '#4ade80' : '#2a7d4f' }} />
        <span className="text-[11px] font-medium" style={{ color: isDark ? '#4ade80' : '#2a7d4f' }}>Workspace active</span>
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

      {/* WhatsApp button */}
      {whatsappLink && (
        <div className="px-2.5 pb-2">
          <a
            href={whatsappLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[12.5px] font-semibold transition-all hover:opacity-90"
            style={{ background: '#25d366', color: '#fff' }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            Open WhatsApp
          </a>
        </div>
      )}

      {/* User footer */}
      <div className="p-2.5 flex-shrink-0" style={{ borderTop: '1px solid var(--fd-sidebar-border)' }}>
        <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold flex-shrink-0"
            style={{
              background: isDark ? 'rgba(42,125,79,0.2)' : '#edf7f1',
              color: isDark ? '#4ade80' : '#2a7d4f',
            }}
          >
            {getInitials(user?.name)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[12.5px] font-medium truncate leading-none" style={{ color: 'var(--fd-ink-1)' }}>{user?.name}</div>
            <div className="text-[10.5px] mt-0.5" style={{ color: 'var(--fd-ink-4)' }}>Client</div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="sidebar-link mt-0.5 w-full"
          onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = isDark ? 'rgba(239,68,68,0.12)' : '#fef2f2'; }}
          onMouseLeave={e => { e.currentTarget.style.color = ''; e.currentTarget.style.background = ''; }}
        >
          <div className="icon-wrap"><LogOut size={14} strokeWidth={1.7} /></div>
          <span>Sign out</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--fd-canvas)' }}>

      {/* Desktop sidebar */}
      <aside
        className="hidden md:flex flex-col w-[216px] flex-shrink-0"
        style={{ background: 'var(--fd-sidebar-bg)', borderRight: '1px solid var(--fd-sidebar-border)' }}
      >
        <SidebarContent />
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 backdrop-blur-sm"
            style={{ background: 'rgba(0,0,0,0.35)' }}
            onClick={() => setMobileOpen(false)}
          />
          <aside
            className="absolute left-0 top-0 bottom-0 w-72 max-w-[85vw] z-50 animate-slide-in"
            style={{
              background: 'var(--fd-sidebar-bg)',
              borderRight: '1px solid var(--fd-sidebar-border)',
              boxShadow: '0 20px 60px -8px rgba(0,0,0,0.3)',
            }}
          >
            <SidebarContent isMobile />
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header
          className="h-[58px] flex items-center justify-between px-5 flex-shrink-0 gap-3"
          style={{
            background: 'var(--fd-header-bg)',
            borderBottom: '1px solid var(--fd-header-border)',
          }}
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
            <span className="text-[13px] font-semibold" style={{ color: 'var(--fd-ink-1)' }}>Client Portal</span>
          </div>

          <div className="flex-1" />

          <div className="flex items-center gap-1">
            {/* Dark mode toggle */}
            <button
              onClick={toggleTheme}
              className="btn-ghost p-2"
              aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              title={isDark ? 'Light mode' : 'Dark mode'}
            >
              {isDark
                ? <Sun size={16} strokeWidth={1.7} />
                : <Moon size={16} strokeWidth={1.7} />
              }
            </button>

            {/* Notifications */}
            <div className="relative">
              <button onClick={() => setShowNotifs(!showNotifs)} className="relative btn-ghost p-2">
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

        <main id="client-main-scroll" className="flex-1 overflow-y-auto p-5 lg:p-7">
          <Outlet />
        </main>
      </div>

      {/* ── AI Assistant (client-scoped — only sees their own data) ──────── */}
      <AIAssistant />
    </div>
  );
}