import React, { useEffect, useRef } from 'react';
import { Bell, Check, Trash2 } from 'lucide-react';
import { timeAgo } from '../../lib/utils';
import api from '../../lib/api';
import useAuthStore from '../../context/authStore';

const typeIcon = { message: '💬', update: '📋', task: '✅', file: '📁', general: '🔔' };

export default function NotificationPanel({ onClose }) {
  const { user, updateUser } = useAuthStore();
  const ref = useRef();
  const notifications = user?.notifications || [];
  const unread = notifications.filter(n => !n.read).length;

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
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
    <div ref={ref} className="absolute right-0 top-10 w-80 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Bell size={16} className="text-slate-600" />
          <span className="font-semibold text-slate-800 text-sm">Notifications</span>
          {unread > 0 && (
            <span className="bg-brand-600 text-white text-xs rounded-full px-1.5 py-0.5">{unread}</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {unread > 0 && (
            <button onClick={markAllRead} className="p-1 text-slate-400 hover:text-brand-600 rounded" title="Mark all read">
              <Check size={14} />
            </button>
          )}
          <button onClick={clearAll} className="p-1 text-slate-400 hover:text-red-500 rounded" title="Clear all">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <div className="max-h-80 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-sm">No notifications</div>
        ) : (
          notifications.slice(0, 20).map((n, i) => (
            <div key={i} className={`flex gap-3 px-4 py-3 border-b border-slate-50 hover:bg-slate-50 transition-colors ${!n.read ? 'bg-blue-50/50' : ''}`}>
              <span className="text-lg flex-shrink-0">{typeIcon[n.type] || '🔔'}</span>
              <div className="flex-1 min-w-0">
                <div className={`text-sm ${!n.read ? 'font-semibold text-slate-800' : 'text-slate-700'}`}>{n.title}</div>
                <div className="text-xs text-slate-500 mt-0.5 truncate">{n.body}</div>
                <div className="text-xs text-slate-400 mt-1">{timeAgo(n.createdAt)}</div>
              </div>
              {!n.read && <div className="w-2 h-2 bg-brand-500 rounded-full flex-shrink-0 mt-1.5" />}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
