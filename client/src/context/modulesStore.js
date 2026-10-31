import { create } from 'zustand';
import api from '../lib/api';

/**
 * What the signed-in user may do in the integrated Attendance / Revenue &
 * Finance modules. The BACKEND decides (GET /api/modules/access); this store
 * only mirrors it to drive navigation and friendly screens. Hiding a menu item
 * is never the security boundary – every endpoint is enforced server-side.
 */
const useModulesStore = create((set, get) => ({
  access: null,
  loaded: false,
  error: null,

  load: async (force = false) => {
    if (get().loaded && !force) return get().access;
    try {
      const { data } = await api.get('/modules/access');
      set({ access: data.access, loaded: true, error: null });
      return data.access;
    } catch (err) {
      // Never block the rest of Flowdesk: treat as "no module access".
      set({ access: null, loaded: true, error: err.response?.data?.message || err.message });
      return null;
    }
  },

  reset: () => set({ access: null, loaded: false, error: null }),
}));

export default useModulesStore;
