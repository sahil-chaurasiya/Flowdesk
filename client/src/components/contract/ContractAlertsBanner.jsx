import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, XCircle, Clock, ChevronRight } from 'lucide-react';
import api from '../../lib/api';
import { formatDate } from '../../lib/utils';

const LEVEL_CONFIG = {
  critical: { icon: XCircle,       bg: 'rgba(239,68,68,0.08)',   border: 'rgba(239,68,68,0.25)',   text: '#ef4444', label: 'Critical' },
  high:     { icon: AlertTriangle, bg: 'rgba(245,158,11,0.08)',  border: 'rgba(245,158,11,0.25)',  text: '#f59e0b', label: 'High'     },
  medium:   { icon: AlertTriangle, bg: 'rgba(79,110,240,0.07)', border: 'rgba(79,110,240,0.2)',   text: '#4f6ef0', label: 'Medium'   },
  low:      { icon: Clock,         bg: 'rgba(148,163,184,0.08)', border: 'rgba(148,163,184,0.2)',  text: '#94a3b8', label: 'Low'      },
  expired:  { icon: XCircle,       bg: 'rgba(239,68,68,0.08)',   border: 'rgba(239,68,68,0.25)',   text: '#ef4444', label: 'Expired'  },
};

const EMOJI = { critical: '🚨', high: '⚠️', medium: '⚠️', low: '🔔', expired: '❌' };

export default function ContractAlertsBanner() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/payments/contract-alerts')
      .then(r => setAlerts(r.data.alerts || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading || alerts.length === 0) return null;

  return (
    <div
      className="rounded-xl p-4 mb-5"
      style={{ background: 'var(--fd-surface)', border: '1px solid var(--fd-border)' }}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[13.5px] font-semibold" style={{ color: 'var(--fd-ink-1)' }}>
          Contract Renewal Alerts
        </h3>
        <Link
          to="/admin/payment-verifications"
          className="text-[11.5px] font-medium flex items-center gap-1 transition-opacity hover:opacity-70"
          style={{ color: 'var(--fd-sidebar-link-active)' }}
        >
          View all <ChevronRight size={12} />
        </Link>
      </div>

      <div className="space-y-2">
        {alerts.slice(0, 5).map(alert => {
          const cfg = LEVEL_CONFIG[alert.level] || LEVEL_CONFIG.low;
          const Icon = cfg.icon;
          const daysText = alert.daysRemaining < 0
            ? `Expired ${Math.abs(alert.daysRemaining)} day${Math.abs(alert.daysRemaining) === 1 ? '' : 's'} ago`
            : alert.daysRemaining === 0
              ? 'Expires today'
              : `Expires in ${alert.daysRemaining} day${alert.daysRemaining === 1 ? '' : 's'}`;

          return (
            <Link
              key={alert._id}
              to={`/admin/clients/${alert._id}`}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-opacity hover:opacity-80"
              style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}
            >
              <span className="text-[15px]">{EMOJI[alert.level]}</span>
              <div className="flex-1 min-w-0">
                <span className="text-[13px] font-semibold block truncate" style={{ color: 'var(--fd-ink-1)' }}>
                  {alert.company || alert.name}
                </span>
                <span className="text-[11.5px]" style={{ color: cfg.text }}>
                  {daysText}
                </span>
              </div>
              <ChevronRight size={13} style={{ color: 'var(--fd-ink-4)', flexShrink: 0 }} />
            </Link>
          );
        })}
      </div>
    </div>
  );
}