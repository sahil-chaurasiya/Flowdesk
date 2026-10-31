import React, { useEffect, useRef } from 'react';
import { Bell, CheckCheck, Trash2, X } from 'lucide-react';
import { timeAgo } from '../../lib/utils';
import api from '../../lib/api';
import useAuthStore from '../../context/authStore';

const TYPE_ICON = {
  message: '💬',
  update:  '📋',
  task:    '✅',
  file:    '📁',
  general: '🔔',
};

const TYPE_DOT = {
  message: 'var(--fd-accent)',
  update:  '#7e22ce',
  task:    '#2a7d4f',
  file:    '#92600a',
  general: '#a8a49e',
};

export default function NotificationPanel({ onClose }) {
  const { user, updateUser } = useAuthStore();
  const ref = useRef();
  const notifications = user?.notifications || [];
  const unread = notifications.filter(n => !n.read).length;

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const markAllRead = async () => {
    await api.put('/notifications/read-all');
    updateUser({ notifications: notifications.map(n => ({ ...n, read: true })) });
  };

  const clearAll = async () => {
    await api.delete('/notifications/clear');
    updateUser({ notifications: [] });
    onClose();
  };

  return (
    <div
      ref={ref}
      className="absolute right-0 top-11 w-[340px] rounded-xl z-50 overflow-hidden animate-scale-in"
      style={{
        background: 'var(--fd-notif-bg)',
        border: '1px solid var(--fd-notif-border)',
        boxShadow: '0 8px 30px rgba(0,0,0,0.15), 0 2px 8px rgba(0,0,0,0.08)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: 'var(--fd-notif-border)', background: 'var(--fd-notif-header-bg)' }}
      >
        <div className="flex items-center gap-2">
          <Bell size={13} strokeWidth={1.7} style={{ color: 'var(--fd-ink-4)' }} />
          <span className="font-semibold text-[13px]" style={{ color: 'var(--fd-ink-1)' }}>Notifications</span>
          {unread > 0 && (
            <span
              className="text-[10px] font-bold rounded-full px-1.5 min-w-[18px] text-center py-0.5"
              style={{ background: 'var(--fd-accent)', color: '#ffffff' }}
            >
              {unread}
            </span>
          )}
        </div>
        <div className="flex items-center gap-0.5">
          {unread > 0 && (
            <button onClick={markAllRead} className="btn-ghost p-1.5" title="Mark all read">
              <CheckCheck size={13} />
            </button>
          )}
          <button onClick={clearAll} className="btn-ghost p-1.5" title="Clear all"
            onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
            onMouseLeave={e => e.currentTarget.style.color = ''}
          >
            <Trash2 size={13} />
          </button>
          <button onClick={onClose} className="btn-ghost p-1.5">
            <X size={13} />
          </button>
        </div>
      </div>

      {/* List */}
      <div className="max-h-[360px] overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="py-14 text-center">
            <Bell size={22} strokeWidth={1.3} className="mx-auto mb-3" style={{ color: 'var(--fd-ink-5)' }} />
            <p className="text-[13px] font-medium" style={{ color: 'var(--fd-ink-2)' }}>All caught up</p>
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--fd-ink-4)' }}>No new notifications</p>
          </div>
        ) : (
          notifications.slice(0, 20).map((n, i) => (
            <div
              key={i}
              className="flex gap-3 px-4 py-3.5 border-b transition-colors"
              style={{
                borderColor: 'var(--fd-notif-row-border)',
                background: !n.read ? 'var(--fd-notif-unread-bg)' : 'transparent',
              }}
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-sm"
                style={{ background: 'var(--fd-notif-icon-bg)' }}
              >
                {TYPE_ICON[n.type] || TYPE_ICON.general}
              </div>
              <div className="flex-1 min-w-0">
                <div
                  className="text-[12.5px] leading-snug"
                  style={{ color: 'var(--fd-ink-1)', fontWeight: !n.read ? 600 : 400 }}
                >
                  {n.title}
                </div>
                {n.body && (
                  <div className="text-[11.5px] mt-0.5 truncate" style={{ color: 'var(--fd-ink-3)' }}>{n.body}</div>
                )}
                <div className="text-[10.5px] mt-1 font-mono" style={{ color: 'var(--fd-ink-4)' }}>
                  {timeAgo(n.createdAt)}
                </div>
              </div>
              {!n.read && (
                <div
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5"
                  style={{ background: TYPE_DOT[n.type] || 'var(--fd-accent)' }}
                />
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}