import React, { useMemo } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import useModulesStore from '../../context/modulesStore';
import './finance-theme.css';

const TABS = [
  { to: '/admin/finance', label: 'Dashboard', end: true },
  { to: '/admin/finance/clients', label: 'Clients' },
  { to: '/admin/finance/payments', label: 'Collections' },
  { to: '/admin/finance/invoice', label: 'Invoices' },
  { to: '/admin/finance/salaries', label: 'Salaries' },
  { to: '/admin/finance/freelancers', label: 'Freelancers' },
  { to: '/admin/finance/expenses', label: 'Expenses' },
  { to: '/admin/finance/emi', label: 'EMI' },
  { to: '/admin/finance/accounting', label: 'Accounting' },
  { to: '/admin/finance/reports', label: 'Reports' },
  { to: '/admin/finance/settings', label: 'Settings' },
];

const tabClass = ({ isActive }) => `px-3 py-1.5 rounded-lg text-[12.5px] font-medium whitespace-nowrap transition-colors ${isActive ? 'font-semibold' : ''}`;
const tabStyle = ({ isActive }) => ({
  background: isActive ? 'var(--fd-sidebar-active-bg, var(--fd-accent-tint))' : 'transparent',
  color: isActive ? 'var(--fd-accent)' : 'var(--fd-ink-3)',
});

function Notice({ title, children }) {
  return (
    <div className="max-w-xl mx-auto mt-16 rounded-xl p-6 text-center" style={{ background: 'var(--fd-card-bg)', border: '1px solid var(--fd-border)' }}>
      <div className="text-[15px] font-semibold mb-2" style={{ color: 'var(--fd-ink-1)' }}>{title}</div>
      <div className="text-[13px]" style={{ color: 'var(--fd-ink-3)' }}>{children}</div>
    </div>
  );
}

export default function FinanceShell() {
  const access = useModulesStore((s) => s.access);
  const loaded = useModulesStore((s) => s.loaded);
  // Module-local cache: finance data never mixes with any other Flowdesk query state.
  const client = useMemo(() => new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } } }), []);

  if (!loaded) return null;
  const fin = access?.finance;
  if (!fin?.canView) {
    return <Notice title="No access to Revenue & Finance">Your role is not permitted to view financial data.</Notice>;
  }
  if (!fin.enabled) {
    return <Notice title="Revenue & Finance is not configured">The server is missing <code>ACCOUNTANT_MONGODB_URI</code>. Flowdesk itself is unaffected.</Notice>;
  }
  if (!fin.available) {
    return <Notice title="Finance database unavailable">The accountant database can’t be reached right now. Please try again shortly.</Notice>;
  }

  return (
    <QueryClientProvider client={client}>
      <div className="fin-module">
        <div className="flex items-center gap-1 overflow-x-auto pb-3 mb-4" style={{ borderBottom: '1px solid var(--fd-border)', scrollbarWidth: 'none' }}>
          {TABS.map((t) => (
            <NavLink key={t.to} to={t.to} end={t.end} className={tabClass} style={tabStyle}>{t.label}</NavLink>
          ))}
          {!fin.canWrite && <span className="ml-auto text-[11px] px-2 py-0.5 rounded" style={{ background: 'var(--fd-surface-sunken)', color: 'var(--fd-ink-3)' }}>Read-only</span>}
        </div>
        <Outlet />
      </div>
    </QueryClientProvider>
  );
}
