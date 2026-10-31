import React, { useMemo } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import useModulesStore from '../../context/modulesStore';
import { LayoutDashboard, Users, Banknote, Receipt, Wallet, Briefcase, CreditCard, Landmark, BookOpen, BarChart3, Settings } from 'lucide-react';
import ModuleNav from '../../components/shared/ModuleNav';
import './finance-theme.css';

const TABS = [
  { to: '/admin/finance', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/finance/clients', label: 'Clients', icon: Users },
  { to: '/admin/finance/payments', label: 'Collections', icon: Banknote },
  { to: '/admin/finance/invoice', label: 'Invoices', icon: Receipt },
  { to: '/admin/finance/salaries', label: 'Salaries', icon: Wallet },
  { to: '/admin/finance/freelancers', label: 'Freelancers', icon: Briefcase },
  { to: '/admin/finance/expenses', label: 'Expenses', icon: CreditCard },
  { to: '/admin/finance/emi', label: 'EMI', icon: Landmark },
  { to: '/admin/finance/accounting', label: 'Accounting', icon: BookOpen },
  { to: '/admin/finance/reports', label: 'Reports', icon: BarChart3 },
  { to: '/admin/finance/settings', label: 'Settings', icon: Settings },
];

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
        <ModuleNav
          groups={[{ items: TABS }]}
          trailing={!fin.canWrite && <span className="text-[11px] px-2 py-0.5 rounded" style={{ background: 'var(--fd-surface-sunken)', color: 'var(--fd-ink-3)' }}>Read-only</span>}
        />
        <Outlet />
      </div>
    </QueryClientProvider>
  );
}