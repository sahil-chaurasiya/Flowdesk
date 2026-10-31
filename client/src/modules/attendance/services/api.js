/**
 * Attendance API client.
 *
 * The standalone Attendance app talked to its own backend at `/api/<x>`. In the
 * unified app every attendance route lives under `/api/attendance/*` (several
 * original paths such as /auth, /users, /notifications collide with Flowdesk's)
 * and authentication is Flowdesk's – so this simply re-uses Flowdesk's axios
 * instance (access token, silent refresh) and prefixes the path.
 *
 *   /attendance/checkin   -> /api/attendance/checkin      (already prefixed)
 *   /admin/dashboard      -> /api/attendance/admin/dashboard
 *   /leave/my-leaves      -> /api/attendance/leave/my-leaves
 */
import api from '../../../lib/api';

const map = (p) => (p.startsWith('/attendance/') ? p : `/attendance${p}`);

const attApi = {
  get: (url, config) => api.get(map(url), config),
  delete: (url, config) => api.delete(map(url), config),
  post: (url, data, config) => api.post(map(url), data, config),
  put: (url, data, config) => api.put(map(url), data, config),
  patch: (url, data, config) => api.patch(map(url), data, config),
};

export default attApi;
