/**
 * Adapter that keeps the original Attendance pages' `useAuth()` contract
 * ({ user, loading, logout, updateUser, isAdmin }) but sources it from the
 * unified app: Flowdesk does the sign-in; this context only loads the linked
 * attendance profile for the current Flowdesk user.
 */
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import attApi from '../services/api';
import { enablePushNotifications } from '../services/notifications';
import useAuthStore from '../../../context/authStore';
import useModulesStore from '../../../context/modulesStore';

const AuthContext = createContext(null);

export const AttendanceAuthProvider = ({ children }) => {
  const flowdeskUser = useAuthStore((s) => s.user);
  const flowdeskLogout = useAuthStore((s) => s.logout);
  const canAdmin = useModulesStore((s) => !!s.access?.attendance?.canAdmin);

  const [state, setState] = useState({ loading: true, user: null, error: null });

  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true }));
    attApi.get('/auth/me')
      .then(({ data }) => {
        if (!alive) return;
        setState({ loading: false, user: data.user, error: null });
        // Re-register push silently if permission was already granted (original behaviour)
        if (!data.user?.synthetic && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          enablePushNotifications().catch(() => {});
        }
      })
      .catch((err) => {
        if (!alive) return;
        setState({ loading: false, user: null, error: { status: err.response?.status, ...(err.response?.data || { message: err.message }) } });
      });
    return () => { alive = false; };
  }, [flowdeskUser?._id]);

  const logout = useCallback(async () => { await flowdeskLogout(); }, [flowdeskLogout]);
  const updateUser = useCallback((u) => setState((s) => ({ ...s, user: u })), []);

  return (
    <AuthContext.Provider value={{ user: state.user, loading: state.loading, error: state.error, logout, updateUser, isAdmin: canAdmin }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AttendanceAuthProvider');
  return ctx;
};
