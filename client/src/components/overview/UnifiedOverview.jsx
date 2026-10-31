import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { UserCheck, Wallet, ArrowUpRight, ArrowDownRight, AlertCircle } from 'lucide-react';
import api from '../../lib/api';

/**
 * Cross-module summary shown on the Flowdesk dashboard.
 * Attendance and Revenue & Finance live in separate databases, so each widget
 * is fetched, permissioned and failed independently by GET /api/overview/summary.
 * An unavailable database is shown as "unavailable" — never as a misleading 0.
 */
const inr = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

const MESSAGES = {
  not_configured: 'Not configured on this server.',
  unavailable: 'Database temporarily unavailable.',
  not_linked: 'Your account isn’t linked to an attendance profile yet.',
  error: 'Couldn’t load this summary.',
};

function Panel({ title, icon: Icon, to, linkLabel, children }) {
  return (
    <div className="rounded-xl p-4" style={{ background: 'var(--fd-card-bg)', border: '1px solid var(--fd-border)' }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-[13px] font-semibold" style={{ color: 'var(--fd-ink-1)' }}>
          <Icon size={15} style={{ color: 'var(--fd-accent)' }} /> {title}
        </div>
        {to && <Link to={to} className="text-[12px] flex items-center gap-0.5" style={{ color: 'var(--fd-accent)' }}>{linkLabel}<ArrowUpRight size={12} /></Link>}
      </div>
      {children}
    </div>
  );
}

const Stat = ({ label, value, tone }) => (
  <div className="rounded-lg px-3 py-2" style={{ background: 'var(--fd-surface-sunken)' }}>
    <div className="text-[10.5px] uppercase tracking-wide" style={{ color: 'var(--fd-ink-4)' }}>{label}</div>
    <div className="text-[18px] font-bold leading-tight" style={{ color: tone || 'var(--fd-ink-1)' }}>{value}</div>
  </div>
);

const Unavailable = ({ status, message }) => (
  <div className="flex items-start gap-2 text-[12.5px]" style={{ color: 'var(--fd-ink-3)' }}>
    <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
    <span>{message || MESSAGES[status] || MESSAGES.error}</span>
  </div>
);

function AttendanceWidget({ w }) {
  if (w.status !== 'ok') return <Unavailable status={w.status} message={w.status === 'not_linked' ? null : undefined} />;
  const d = w.data;
  if (d.scope === 'team') {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Stat label="Present" value={d.present} tone="var(--fd-success, #2a7d4f)" />
        <Stat label="Late" value={d.late} tone="var(--fd-warning, #92600a)" />
        <Stat label="Absent" value={d.absent} tone="var(--fd-danger, #b91c1c)" />
        <Stat label="On leave" value={d.onLeave} />
        <div className="col-span-2 sm:col-span-4 text-[11.5px]" style={{ color: 'var(--fd-ink-4)' }}>
          {d.totalEmployees} active employees{d.todayIsHoliday ? ` · Holiday: ${d.todayHolidayName}` : ''}
        </div>
      </div>
    );
  }
  const a = d.attendance;
  return (
    <div className="text-[13px]" style={{ color: 'var(--fd-ink-2)' }}>
      {a?.checkInTime
        ? <>Checked in at <b>{new Date(a.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</b>{a.checkOutTime ? <> · out {new Date(a.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</> : null} <span className="ml-1 capitalize">({a.status})</span></>
        : 'You haven’t checked in today.'}
    </div>
  );
}

function FinanceWidget({ w }) {
  if (w.status !== 'ok') return <Unavailable status={w.status} />;
  const d = w.data;
  return (
    <>
      <div className="grid grid-cols-3 gap-2 mb-3">
        <Stat label="Revenue" value={inr(d.revenue)} />
        <Stat label="Expenses" value={inr(d.expenses)} />
        <Stat label="Net" value={inr(d.netProfit)} tone={d.netProfit < 0 ? 'var(--fd-danger, #b91c1c)' : 'var(--fd-success, #2a7d4f)'} />
      </div>
      {d.recentTransactions?.length > 0 && (
        <ul className="space-y-1">
          {d.recentTransactions.slice(0, 4).map((t, i) => (
            <li key={i} className="flex items-center justify-between text-[12px]" style={{ color: 'var(--fd-ink-2)' }}>
              <span className="flex items-center gap-1.5 truncate">
                {t.type === 'income' ? <ArrowUpRight size={12} style={{ color: 'var(--fd-success, #2a7d4f)' }} /> : <ArrowDownRight size={12} style={{ color: 'var(--fd-danger, #b91c1c)' }} />}
                <span className="truncate">{t.label}</span>
              </span>
              <span className="font-medium">{inr(t.amount)}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export default function UnifiedOverview() {
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    api.get('/overview/summary')
      .then((r) => alive && setData(r.data))
      .catch(() => alive && setFailed(true));
    return () => { alive = false; };
  }, []);

  if (failed || !data) return null; // never get in the way of the existing dashboard

  const hide = (w) => ['forbidden'].includes(w.status);
  const showAtt = !hide(data.attendance) && data.attendance.status !== 'not_configured';
  const showFin = !hide(data.finance) && data.finance.status !== 'not_configured';
  if (!showAtt && !showFin) return null;

  return (
    <div className={`grid gap-4 ${showAtt && showFin ? 'lg:grid-cols-2' : 'grid-cols-1'}`}>
      {showAtt && (
        <Panel title="Today’s attendance" icon={UserCheck} to="/admin/attendance" linkLabel="Open">
          <AttendanceWidget w={data.attendance} />
        </Panel>
      )}
      {showFin && (
        <Panel title="This month · Revenue & Finance" icon={Wallet} to="/admin/finance" linkLabel="Open">
          <FinanceWidget w={data.finance} />
        </Panel>
      )}
    </div>
  );
}
