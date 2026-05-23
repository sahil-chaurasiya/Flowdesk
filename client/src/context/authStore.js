import { create } from 'zustand';
import api from '../lib/api';

// Normalize user: ensure clientId is always a plain string, never a populated object
function normalizeUser(user) {
  if (!user) return user;
  if (user.clientId && typeof user.clientId === 'object') {
    return { ...user, clientId: user.clientId._id?.toString() || user.clientId.toString() };
  }
  return user;
}

const useAuthStore = create((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  initialize: async () => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      set({ isLoading: false });
      return;
    }
    try {
      const { data } = await api.get('/auth/me');
      set({ user: normalizeUser(data.user), isAuthenticated: true, isLoading: false });
    } catch {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },

  login: async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    set({ user: normalizeUser(data.user), isAuthenticated: true });
    return data.user;
  },

  logout: async () => {
    try { await api.post('/auth/logout'); } catch {}
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    set({ user: null, isAuthenticated: false });
  },

  updateUser: (updates) => {
    set(state => ({ user: normalizeUser({ ...state.user, ...updates }) }));
  },
}));

export default useAuthStore;