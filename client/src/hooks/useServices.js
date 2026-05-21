import { useState, useEffect, useCallback } from 'react';
import api from '../lib/api';

// Module-level cache so all hook instances share the same data in one session
let _cache = null;
let _promise = null;

export function useServices() {
  const [services, setServices] = useState(_cache || []);
  const [loading, setLoading] = useState(!_cache);

  const load = useCallback(async (force = false) => {
    if (_cache && !force) {
      setServices(_cache);
      setLoading(false);
      return;
    }

    if (!_promise || force) {
      _promise = api.get('/services').then(r => r.data.services);
    }

    try {
      setLoading(true);
      const result = await _promise;
      _cache = result;
      setServices(result);
    } catch {
      // silently fail; callers will just see an empty list
    } finally {
      setLoading(false);
      _promise = null;
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Returns a plain key→label map compatible with the old SERVICE_LABELS shape
  const serviceLabels = Object.fromEntries(
    services.filter(s => s.isActive).map(s => [s.key, s.label])
  );

  return { services, serviceLabels, loading, reload: () => load(true) };
}

// Bust the module-level cache (call after create/update/delete)
export function bustServicesCache() {
  _cache = null;
  _promise = null;
}
