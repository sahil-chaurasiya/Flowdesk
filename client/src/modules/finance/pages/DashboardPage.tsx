import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '../services/api';
import { formatCurrency } from '../lib/utils';
import { DashboardData } from '../types';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TrendingDown, CreditCard, Wallet, Activity, ArrowRight, Calendar, Briefcase } from 'lucide-react';
import { Link } from 'react-router-dom';
import { MONTHS, getCurrentMonthYear } from '../lib/utils';

const StatCard = ({ title, value, icon: Icon, color, sub, to }: any) => (
  <Link
    to={to}
    className="bg-white rounded-xl border p-5 flex items-start gap-4 group hover:shadow-md hover:border-gray-300 transition-all duration-150 cursor-pointer"
  >
    <div className={`w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0 ${color} group-hover:scale-105 transition-transform duration-150`}>
      <Icon className="w-5 h-5 text-white" />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{title}</p>
      <p className="text-xl font-bold text-gray-900 truncate">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
    <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 group-hover:translate-x-0.5 transition-all duration-150 mt-1 flex-shrink-0" />
  </Link>
);

export default function DashboardPage() {
  const now = getCurrentMonthYear();
  const [selMonth, setSelMonth] = useState(now.month);
  const [selYear, setSelYear] = useState(now.year);
  const years = Array.from({ length: 4 }, (_, i) => now.year - i);

  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ['dashboard', selMonth, selYear],
    queryFn: () => dashboardApi.get({ month: selMonth, year: selYear }).then((r) => r.data),
  });

  if (isLoading) return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 bg-gray-200 rounded w-48" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(8)].map((_, i) => <div key={i} className="h-24 bg-gray-200 rounded-xl" />)}
      </div>
    </div>
  );

  const c = data?.cards;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">Financial overview at a glance</p>
        </div>
        <div className="flex items-center gap-2 bg-white border rounded-lg px-3 py-1.5">
          <Calendar className="w-3.5 h-3.5 text-gray-400" />
          <select className="text-sm border-0 outline-none bg-transparent" value={selMonth} onChange={e => setSelMonth(Number(e.target.value))}>
            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
          <select className="text-sm border-0 outline-none bg-transparent" value={selYear} onChange={e => setSelYear(Number(e.target.value))}>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* Monthly Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <StatCard
          title={MONTHS[selMonth - 1]}
          value={formatCurrency(c?.currentMonthRevenue || 0)}
          icon={Activity}
          color="bg-blue-500"
          sub="Revenue"
          to="/admin/finance/payments"
        />
        <StatCard
          title="Month Expenses"
          value={formatCurrency(c?.currentMonthExpenses || 0)}
          icon={TrendingDown}
          color="bg-red-500"
          sub="Total outflows"
          to="/admin/finance/expenses"
        />
        <StatCard
          title="Salary Expense"
          value={formatCurrency(c?.salaryExpense || 0)}
          icon={Wallet}
          color="bg-purple-500"
          sub={`${MONTHS[selMonth - 1]} ${selYear}`}
          to="/admin/finance/salaries"
        />
        <StatCard
          title="EMI Expense"
          value={formatCurrency(c?.emiExpense || 0)}
          icon={CreditCard}
          color="bg-orange-500"
          sub={`${MONTHS[selMonth - 1]} ${selYear}`}
          to="/admin/finance/emi"
        />
        <StatCard
          title="Freelancer Expense"
          value={formatCurrency(c?.freelancerExpense || 0)}
          icon={Briefcase}
          color="bg-teal-500"
          sub={`${MONTHS[selMonth - 1]} ${selYear}`}
          to="/admin/finance/freelancers"
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Revenue & Expense Trend */}
        <div className="lg:col-span-2 bg-white rounded-xl border p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Revenue vs Expense Trend</h3>
            <Link to="/admin/finance/reports" className="text-xs text-primary font-medium flex items-center gap-1 hover:underline">
              Full report <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={data?.revenueTrend}>
              <defs>
                <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: any) => formatCurrency(v)} />
              <Legend />
              <Area type="monotone" dataKey="income" name="Income" stroke="#6366f1" fill="url(#colorIncome)" strokeWidth={2} />
              <Area type="monotone" dataKey="expense" name="Expense" stroke="#ef4444" fill="url(#colorExpense)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Top Pending Clients */}
        <div className="bg-white rounded-xl border p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Top Pending Clients</h3>
            <Link to="/admin/finance/clients" className="text-xs text-primary font-medium flex items-center gap-1 hover:underline">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {data?.topPendingClients?.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">No pending clients 🎉</p>
          ) : (
            <div className="space-y-2">
              {data?.topPendingClients?.map((client, i) => (
                <Link
                  key={client._id}
                  to={`/admin/finance/clients/${client._id}`}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 group transition-colors"
                >
                  <span className="w-6 h-6 rounded-full bg-gray-100 text-gray-600 text-xs flex items-center justify-center font-medium flex-shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">{client.name}</p>
                    <p className="text-xs text-red-500 font-medium">{formatCurrency(client.pendingAmount)}</p>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-primary transition-colors flex-shrink-0" />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Profit Trend */}
      <div className="bg-white rounded-xl border p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Profit Trend (Last 6 Months)</h3>
          <Link to="/admin/finance/accounting" className="text-xs text-primary font-medium flex items-center gap-1 hover:underline">
            View accounting <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data?.revenueTrend}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${(v/1000).toFixed(0)}k`} />
            <Tooltip formatter={(v: any) => formatCurrency(v)} />
            <Bar dataKey="profit" name="Net Profit" fill="#6366f1" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}