import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import FinanceShell from './FinanceShell';
import DashboardPage from './pages/DashboardPage';
import ClientsPage from './pages/ClientsPage';
import ClientDetailPage from './pages/ClientDetailPage';
import PaymentsPage from './pages/PaymentsPage';
import SalariesPage from './pages/SalariesPage';
import FreelancersPage from './pages/FreelancersPage';
import FreelancerDetailPage from './pages/FreelancerDetailPage';
import ExpensesPage from './pages/ExpensesPage';
import EMIPage from './pages/EMIPage';
import AccountingPage from './pages/AccountingPage';
import ReportsPage from './pages/ReportsPage';
import SettingsPage from './pages/SettingsPage';
import InvoicePage from './pages/InvoicePage';

/** Sub-router for /admin/finance/* — loaded lazily from App.jsx. */
export default function FinanceRoutes() {
  return (
    <Routes>
      <Route element={<FinanceShell />}>
        <Route index element={<DashboardPage />} />
        <Route path="clients" element={<ClientsPage />} />
        <Route path="clients/:id" element={<ClientDetailPage />} />
        <Route path="payments" element={<PaymentsPage />} />
        <Route path="salaries" element={<SalariesPage />} />
        <Route path="freelancers" element={<FreelancersPage />} />
        <Route path="freelancers/:id" element={<FreelancerDetailPage />} />
        <Route path="expenses" element={<ExpensesPage />} />
        <Route path="emi" element={<EMIPage />} />
        <Route path="accounting" element={<AccountingPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="invoice" element={<InvoicePage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/admin/finance" replace />} />
      </Route>
    </Routes>
  );
}
