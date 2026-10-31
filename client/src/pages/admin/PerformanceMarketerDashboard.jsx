import React, { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Phone, MessageSquare, Mail, Calendar, CheckCircle2,
  FileText, Eye, RotateCcw, Plus, Target, TrendingUp,
  AlertTriangle, Flame, ArrowUpRight, ChevronRight,
  Activity, Zap, BarChart2, Clock, DollarSign,
  Users, Star, ArrowRight, PlayCircle, X, Check,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import api from '../../lib/api';
import useAuthStore from '../../context/authStore';
import { Spinner } from '../../components/shared/LoadingScreen';
import { timeAgo, formatDate } from '../../lib/utils';

// ── Design tokens ──────────────────────────────────────────────────────────────
const STAGE_META = {
  new:               { label: 'New',         color: '#6366f1', bg: 'rgba(99,102,241,0.1)' },
  contacted:         { label: 'Contacted',   color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  meeting_scheduled: { label: 'Meeting',     color: '#a855f7', bg: 'rgba(168,85,247,0.1)' },
  proposal_sent:     { label: 'Proposal',    color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
  negotiation:       { label: 'Negotiating', color: '#f97316', bg: 'rgba(249,115,22,0.1)' },
  won:               { label: 'Won',         color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
  lost:              { label: 'Lost',        color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
};

const QUALITY_META = {
  hot:  { label: 'Hot',  color: '#ef4444', bg: 'rgba(239,68,68,0.1)',  icon: '🔥' },
  warm: { label: 'Warm', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', icon: '☀️' },
  cold: { label: 'Cold', color: '#60a5fa', bg: 'rgba(96,165,250,0.1)', icon: '❄️' },
};

const ACTIVITY_META = {
  call_made:         { label: 'Call Made',         icon: Phone,        color: '#22c55e', shortLabel: 'Call' },
  whatsapp_sent:     { label: 'WhatsApp Sent',     icon: MessageSquare,color: '#25d366', shortLabel: 'WhatsApp' },
  email_sent:        { label: 'Email Sent',        icon: Mail,         color: '#3b82f6', shortLabel: 'Email' },
  meeting_scheduled: { label: 'Meeting Scheduled', icon: Calendar,     color: '#a855f7', shortLabel: 'Meeting' },
  meeting_completed: { label: 'Meeting Done',      icon: CheckCircle2, color: '#22c55e', shortLabel: 'Met' },
  proposal_sent:     { label: 'Proposal Sent',     icon: FileText,     color: '#f59e0b', shortLabel: 'Proposal' },
  proposal_viewed:   { label: 'Proposal Viewed',   icon: Eye,          color: '#6366f1', shortLabel: 'Viewed' },
  follow_up_done:    { label: 'Follow-Up Done',    icon: RotateCcw,    color: '#f97316', shortLabel: 'Follow-Up' },
  moved:             { label: 'Stage Changed',     icon: ArrowRight,   color: '#94a3b8', shortLabel: 'Moved' },
  note_added:        { label: 'Note Added',        icon: FileText,     color: '#94a3b8', shortLabel: 'Note' },
  created:           { label: 'Lead Created',      icon: Plus,         color: '#6366f1', shortLabel: 'Created' },
};

function fmt(n) {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000)   return `₹${(n / 1000).toFixed(0)}K`;
  return `₹${n.toLocaleString('en-IN')}`;
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KPICard({ title, value, subtitle, icon: Icon, color, pulse, linkTo, badge }) {
  const colorMap = {
    blue:   { bg: 'rgba(99,102,241,0.1)',   icon: '#6366f1',  border: 'rgba(99,102,241,0.2)' },
    green:  { bg: 'rgba(34,197,94,0.1)',    icon: '#22c55e',  border: 'rgba(34,197,94,0.2)' },
    orange: { bg: 'rgba(245,158,11,0.1)',   icon: '#f59e0b',  border: 'rgba(245,158,11,0.2)' },
    red:    { bg: 'rgba(239,68,68,0.1)',    icon: '#ef4444',  border: 'rgba(239,68,68,0.2)' },
    purple: { bg: 'rgba(168,85,247,0.1)',   icon: '#a855f7',  border: 'rgba(168,85,247,0.2)' },
    teal:   { bg: 'rgba(20,184,166,0.1)',   icon: '#14b8a6',  border: 'rgba(20,184,166,0.2)' },
  };
  const c = colorMap[color] || colorMap.blue;

  const inner = (
    <div
      className="relative rounded-2xl p-4 flex flex-col gap-3 overflow-hidden transition-all duration-200 hover:translate-y-[-1px] cursor-pointer group"
      style={{
        background: 'var(--fd-card-bg)',
        border: `1px solid var(--fd-border)`,
        boxShadow: '0 1px 8px rgba(0,0,0,0.04)',
      }}
    >
      {/* Subtle background glow */}
      <div
        className="absolute top-0 right-0 w-24 h-24 rounded-full opacity-30 blur-2xl pointer-events-none"
        style={{ background: c.bg, transform: 'translate(30%, -30%)' }}
      />

      <div className="flex items-start justify-between relative z-10">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: c.bg, border: `1px solid ${c.border}` }}
        >
          {pulse ? (
            <div className="relative">
              <Icon size={16} style={{ color: c.icon }} />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-red-500 border-2 border-white animate-pulse" />
            </div>
          ) : (
            <Icon size={16} style={{ color: c.icon }} />
          )}
        </div>
        {badge && (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md" style={{ background: c.bg, color: c.icon }}>
            {badge}
          </span>
        )}
      </div>

      <div className="relative z-10">
        <div className="text-[24px] font-black tracking-tight leading-none" style={{ color: 'var(--fd-ink-1)' }}>
          {value}
        </div>
        <div className="text-[12px] font-semibold mt-1" style={{ color: 'var(--fd-ink-2)' }}>{title}</div>
        {subtitle && <div className="text-[11px] mt-0.5" style={{ color: 'var(--fd-ink-4)' }}>{subtitle}</div>}
      </div>
    </div>
  );

  if (linkTo) return <Link to={linkTo}>{inner}</Link>;
  return inner;
}

// ── Quick Action Button ────────────────────────────────────────────────────────
function QuickAction({ icon: Icon, label, color, onClick, hint }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-2 p-3 rounded-xl transition-all duration-150 hover:scale-105 active:scale-95"
      style={{
        background: 'var(--fd-surface-sunken)',
        border: '1px solid var(--fd-border)',
        minWidth: 72,
      }}
      title={hint}
    >
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center"
        style={{ background: color + '18', border: `1px solid ${color}30` }}
      >
        <Icon size={16} style={{ color }} />
      </div>
      <span className="text-[10.5px] font-semibold text-center leading-tight" style={{ color: 'var(--fd-ink-2)' }}>
        {label}
      </span>
    </button>
  );
}

// ── Log Activity Modal ─────────────────────────────────────────────────────────
function LogActivityModal({ leads, onClose, onSuccess }) {
  const [selectedLead, setSelectedLead] = useState('');
  const [action, setAction] = useState('call_made');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const ACTIONS = [
    'call_made', 'whatsapp_sent', 'email_sent',
    'meeting_scheduled', 'meeting_completed',
    'proposal_sent', 'proposal_viewed', 'follow_up_done',
  ];

  const handleSubmit = async () => {
    if (!selectedLead) return;
    setSaving(true);
    try {
      await api.post(`/internal-leads/${selectedLead}/activity`, { action, note });
      onSuccess();
      onClose();
    } catch {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full max-w-md rounded-2xl p-6 z-10"
        style={{ background: 'var(--fd-surface)', border: '1px solid var(--fd-border)', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}
      >
        <button onClick={onClose} className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-[var(--fd-surface-sunken)]">
          <X size={16} style={{ color: 'var(--fd-ink-3)' }} />
        </button>

        <h3 className="text-[16px] font-bold mb-4" style={{ color: 'var(--fd-ink-1)' }}>Log Sales Activity</h3>

        <div className="space-y-4">
          <div>
            <label className="text-[12px] font-semibold mb-1.5 block" style={{ color: 'var(--fd-ink-2)' }}>Select Lead</label>
            <select
              className="w-full px-3 py-2 rounded-xl text-[13px] outline-none"
              style={{ background: 'var(--fd-surface-sunken)', border: '1px solid var(--fd-border)', color: 'var(--fd-ink-1)' }}
              value={selectedLead}
              onChange={e => setSelectedLead(e.target.value)}
            >
              <option value="">Choose a lead...</option>
              {leads.map(l => (
                <option key={l._id} value={l._id}>{l.name || l.company || l.email}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[12px] font-semibold mb-1.5 block" style={{ color: 'var(--fd-ink-2)' }}>Activity Type</label>
            <div className="grid grid-cols-4 gap-2">
              {ACTIONS.map(a => {
                const meta = ACTIVITY_META[a];
                const Ic   = meta.icon;
                return (
                  <button
                    key={a}
                    onClick={() => setAction(a)}
                    className="flex flex-col items-center gap-1.5 p-2 rounded-xl text-[10px] font-semibold transition-all"
                    style={{
                      background: action === a ? meta.color + '18' : 'var(--fd-surface-sunken)',
                      border: `1.5px solid ${action === a ? meta.color : 'var(--fd-border)'}`,
                      color: action === a ? meta.color : 'var(--fd-ink-3)',
                    }}
                  >
                    <Ic size={14} />
                    {meta.shortLabel}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="text-[12px] font-semibold mb-1.5 block" style={{ color: 'var(--fd-ink-2)' }}>Notes (optional)</label>
            <textarea
              rows={2}
              placeholder="What happened? Any key points..."
              className="w-full px-3 py-2 rounded-xl text-[13px] outline-none resize-none"
              style={{ background: 'var(--fd-surface-sunken)', border: '1px solid var(--fd-border)', color: 'var(--fd-ink-1)' }}
              value={note}
              onChange={e => setNote(e.target.value)}
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={!selectedLead || saving}
            className="w-full py-2.5 rounded-xl text-[13px] font-semibold transition-all disabled:opacity-50"
            style={{ background: '#6366f1', color: '#fff' }}
          >
            {saving ? 'Logging...' : 'Log Activity'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Custom tooltip ─────────────────────────────────────────────────────────────
function ChartTip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl px-3 py-2 text-[12px]" style={{ background: 'var(--fd-surface)', border: '1px solid var(--fd-border)', boxShadow: '0 4px 16px rgba(0,0,0,0.1)', color: 'var(--fd-ink-2)' }}>
      <div className="font-medium mb-1" style={{ color: 'var(--fd-ink-1)' }}>{label}</div>
      {payload.map(p => (
        <div key={p.name} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span>{p.name}: <strong>{p.value}</strong></span>
        </div>
      ))}
    </div>
  );
}

// ── Main Dashboard ─────────────────────────────────────────────────────────────
export default function PerformanceMarketerDashboard() {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const [kpiData,      setKpiData]      = useState(null);
  const [actStats,     setActStats]     = useState(null);
  const [allLeads,     setAllLeads]     = useState([]);
  const [loadingKpi,   setLoadingKpi]   = useState(true);
  const [loadingAct,   setLoadingAct]   = useState(true);
  const [showLogModal, setShowLogModal] = useState(false);
  const [refresh,      setRefresh]      = useState(0);

  const fetchData = useCallback(() => {
    setLoadingKpi(true);
    setLoadingAct(true);

    Promise.all([
      api.get('/dashboard/pm/kpis'),
      api.get('/dashboard/pm/activity-stats?days=30'),
      api.get('/internal-leads?limit=50'),
    ])
      .then(([kpi, act, leads]) => {
        setKpiData(kpi.data);
        setActStats(act.data);
        setAllLeads(leads.data.leads || []);
      })
      .catch(() => {})
      .finally(() => {
        setLoadingKpi(false);
        setLoadingAct(false);
      });
  }, []);

  useEffect(() => { fetchData(); }, [fetchData, refresh]);

  const kpis = kpiData?.kpis || {};
  const pipeline = kpiData?.pipeline || [];
  const actTimeline = kpiData?.activityTimeline || [];
  const hotLeads    = kpiData?.hotLeads || [];
  const overdueLeads = kpiData?.overdueLeads || [];
  const actionNeeded = kpiData?.actionNeeded || [];
  const actS = actStats?.stats || {};
  const dailyAct = actStats?.daily || [];

  const ACTIVITY_ACTIONS = [
    { key: 'call_made',         icon: Phone,        color: '#22c55e' },
    { key: 'whatsapp_sent',     icon: MessageSquare,color: '#25d366' },
    { key: 'email_sent',        icon: Mail,         color: '#3b82f6' },
    { key: 'meeting_scheduled', icon: Calendar,     color: '#a855f7' },
    { key: 'meeting_completed', icon: CheckCircle2, color: '#22c55e' },
    { key: 'proposal_sent',     icon: FileText,     color: '#f59e0b' },
    { key: 'proposal_viewed',   icon: Eye,          color: '#6366f1' },
    { key: 'follow_up_done',    icon: RotateCcw,    color: '#f97316' },
  ];

  if (loadingKpi) {
    return (
      <div className="flex items-center justify-center h-60">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* ── Hero Header ──────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[18px]">📊</span>
            <h1 className="text-[22px] font-black tracking-tight" style={{ color: 'var(--fd-ink-1)' }}>
              Lead Command Centre
            </h1>
          </div>
          <p className="text-[13px]" style={{ color: 'var(--fd-ink-4)' }}>
            {user?.name} · Performance Marketer
            {kpis.overdueFollowUps > 0 && (
              <span className="ml-2 px-2 py-0.5 rounded-full text-[11px] font-bold" style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}>
                ⚠ {kpis.overdueFollowUps} overdue follow-ups
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Link
            to="/admin/internal-leads"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12.5px] font-semibold transition-all hover:opacity-80"
            style={{ background: 'var(--fd-surface-sunken)', border: '1px solid var(--fd-border)', color: 'var(--fd-ink-2)' }}
          >
            <Target size={13} /> All Leads
          </Link>
          <Link
            to="/admin/internal-leads"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12.5px] font-semibold transition-all hover:opacity-80"
            style={{ background: '#6366f1', color: '#fff' }}
          >
            <Plus size={13} /> New Lead
          </Link>
        </div>
      </div>

      {/* ── KPI Grid ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KPICard
          title="Total Leads"
          value={kpis.totalLeads ?? 0}
          icon={Users}
          color="blue"
          subtitle={`${kpis.newToday ?? 0} new today`}
          linkTo="/admin/internal-leads"
        />
        <KPICard
          title="Open Pipeline"
          value={kpis.openLeads ?? 0}
          icon={Target}
          color="purple"
          subtitle="Active, not closed"
          linkTo="/admin/internal-leads"
        />
        <KPICard
          title="Won"
          value={kpis.wonLeads ?? 0}
          icon={CheckCircle2}
          color="green"
          badge={`${kpis.conversionRate}%`}
          subtitle={`${kpis.wonThisMonth ?? 0} this month`}
          linkTo="/admin/internal-leads?stage=won"
        />
        <KPICard
          title="Lost"
          value={kpis.lostLeads ?? 0}
          icon={X}
          color="red"
          subtitle="Closed lost"
          linkTo="/admin/internal-leads?stage=lost"
        />
        <KPICard
          title="Pipeline Value"
          value={fmt(kpis.pipelineValue ?? 0)}
          icon={DollarSign}
          color="teal"
          subtitle={`${fmt(kpis.wonValue ?? 0)} won`}
        />
        <KPICard
          title="Follow-Ups Due"
          value={kpis.overdueFollowUps ?? 0}
          icon={Clock}
          color={kpis.overdueFollowUps > 0 ? 'red' : 'orange'}
          pulse={kpis.overdueFollowUps > 0}
          subtitle="Overdue reminders"
          linkTo="/admin/internal-leads?followUpToday=true"
        />
      </div>

      {/* ── Quick Actions ─────────────────────────────────────────────────── */}
      <div
        className="rounded-2xl p-4"
        style={{ background: 'var(--fd-card-bg)', border: '1px solid var(--fd-border)' }}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[13px] font-bold flex items-center gap-2" style={{ color: 'var(--fd-ink-1)' }}>
            <Zap size={14} style={{ color: '#f59e0b' }} /> Quick Actions
          </h3>
        </div>
        <div className="flex gap-2 flex-wrap">
          <QuickAction
            icon={Plus}
            label="Add Lead"
            color="#6366f1"
            hint="Add a new internal lead"
            onClick={() => navigate('/admin/internal-leads')}
          />
          <QuickAction
            icon={RotateCcw}
            label="Log Follow-Up"
            color="#f97316"
            hint="Log a follow-up activity"
            onClick={() => setShowLogModal(true)}
          />
          <QuickAction
            icon={Calendar}
            label="Schedule Meeting"
            color="#a855f7"
            hint="Schedule a meeting"
            onClick={() => { setShowLogModal(true); }}
          />
          <QuickAction
            icon={FileText}
            label="Log Proposal"
            color="#f59e0b"
            hint="Log proposal sent"
            onClick={() => setShowLogModal(true)}
          />
          <QuickAction
            icon={Phone}
            label="Log Call"
            color="#22c55e"
            hint="Log a call made"
            onClick={() => setShowLogModal(true)}
          />
          <QuickAction
            icon={AlertTriangle}
            label="Overdue"
            color="#ef4444"
            hint="View overdue follow-ups"
            onClick={() => navigate('/admin/internal-leads?followUpToday=true')}
          />
          <QuickAction
            icon={TrendingUp}
            label="Pipeline"
            color="#14b8a6"
            hint="View full pipeline"
            onClick={() => navigate('/admin/internal-leads')}
          />
          <QuickAction
            icon={Star}
            label="Hot Leads"
            color="#ef4444"
            hint="Filter hot leads"
            onClick={() => navigate('/admin/internal-leads?quality=hot')}
          />
        </div>
      </div>

      {/* ── Sales Activity Tracker ────────────────────────────────────────── */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: 'var(--fd-card-bg)', border: '1px solid var(--fd-border)' }}
      >
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--fd-border)' }}>
          <h3 className="text-[13.5px] font-bold flex items-center gap-2" style={{ color: 'var(--fd-ink-1)' }}>
            <Activity size={14} style={{ color: '#6366f1' }} /> Sales Activity (Last 30 Days)
          </h3>
          <button
            onClick={() => setShowLogModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11.5px] font-semibold transition-all hover:opacity-80"
            style={{ background: 'rgba(99,102,241,0.1)', color: '#6366f1', border: '1px solid rgba(99,102,241,0.2)' }}
          >
            <Plus size={12} /> Log Activity
          </button>
        </div>

        {/* Activity count grid */}
        <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {ACTIVITY_ACTIONS.map(({ key, icon: Icon, color }) => {
            const meta  = ACTIVITY_META[key];
            const count = actS[key] || 0;
            return (
              <div
                key={key}
                className="flex items-center gap-3 p-3 rounded-xl"
                style={{ background: 'var(--fd-surface-sunken)', border: '1px solid var(--fd-border)' }}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: color + '18' }}
                >
                  <Icon size={14} style={{ color }} />
                </div>
                <div>
                  <div className="text-[18px] font-black leading-none" style={{ color: 'var(--fd-ink-1)' }}>{count}</div>
                  <div className="text-[10.5px] mt-0.5" style={{ color: 'var(--fd-ink-4)' }}>{meta.shortLabel}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Daily activity trend */}
        {dailyAct.length > 0 && (
          <div className="px-4 pb-4">
            <ResponsiveContainer width="100%" height={80}>
              <AreaChart data={dailyAct.map(d => ({ date: d._id.slice(5), count: d.count }))} margin={{ top: 4, right: 4, left: -30, bottom: 0 }}>
                <defs>
                  <linearGradient id="pmGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'var(--fd-ink-5)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: 'var(--fd-ink-5)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<ChartTip />} />
                <Area type="monotone" dataKey="count" name="Activities" stroke="#6366f1" strokeWidth={1.5} fill="url(#pmGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* ── Pipeline Visual + Stage Breakdown ────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Pipeline funnel bars */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: 'var(--fd-card-bg)', border: '1px solid var(--fd-border)' }}
        >
          <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--fd-border)' }}>
            <h3 className="text-[13.5px] font-bold" style={{ color: 'var(--fd-ink-1)' }}>Lead Pipeline</h3>
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--fd-ink-4)' }}>
              {kpis.conversionRate}% conversion rate · {fmt(kpis.pipelineValue ?? 0)} total value
            </p>
          </div>
          <div className="p-4 space-y-2.5">
            {pipeline.filter(s => s.count > 0 || ['new','contacted','won','lost'].includes(s.stage)).map(p => {
              const meta = STAGE_META[p.stage] || {};
              const maxCount = Math.max(...pipeline.map(x => x.count), 1);
              const pct = (p.count / maxCount) * 100;
              return (
                <div key={p.stage}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ background: meta.color }} />
                      <span className="text-[12px] font-semibold capitalize" style={{ color: 'var(--fd-ink-2)' }}>{meta.label}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px]" style={{ color: 'var(--fd-ink-4)' }}>
                      <span className="font-semibold" style={{ color: 'var(--fd-ink-2)' }}>{p.count}</span>
                      {p.dealValue > 0 && <span>· {fmt(p.dealValue)}</span>}
                    </div>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--fd-surface-sunken)' }}>
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${pct}%`, background: meta.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Hot leads & action needed */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: 'var(--fd-card-bg)', border: '1px solid var(--fd-border)' }}
        >
          <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--fd-border)' }}>
            <h3 className="text-[13.5px] font-bold flex items-center gap-2" style={{ color: 'var(--fd-ink-1)' }}>
              <Flame size={13} style={{ color: '#ef4444' }} /> Hot Leads
            </h3>
            <Link to="/admin/internal-leads?quality=hot" className="flex items-center gap-1 text-[11px] font-semibold" style={{ color: 'var(--fd-sidebar-link-active)' }}>
              View all <ArrowUpRight size={11} />
            </Link>
          </div>
          <div className="divide-y" style={{ borderColor: 'var(--fd-border)' }}>
            {hotLeads.length === 0 ? (
              <div className="py-8 text-center text-[13px]" style={{ color: 'var(--fd-ink-4)' }}>No hot leads right now</div>
            ) : (
              hotLeads.map(lead => {
                const stage = STAGE_META[lead.stage] || {};
                return (
                  <Link
                    key={lead._id}
                    to={`/admin/internal-leads?lead=${lead._id}`}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-[var(--fd-table-row-hover)] transition-colors group"
                  >
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center text-[11px] font-black text-white flex-shrink-0" style={{ background: '#ef4444' }}>
                      {(lead.name || lead.company || '?').slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[12.5px] font-semibold truncate" style={{ color: 'var(--fd-ink-1)' }}>{lead.name || lead.company}</div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10.5px] px-1.5 py-0.5 rounded-md font-semibold" style={{ background: stage.bg, color: stage.color }}>{stage.label}</span>
                        {lead.dealValue > 0 && <span className="text-[10.5px]" style={{ color: 'var(--fd-ink-4)' }}>{fmt(lead.dealValue)}</span>}
                      </div>
                    </div>
                    {lead.followUpDate && (
                      <span className="text-[10.5px] font-semibold flex-shrink-0" style={{ color: new Date(lead.followUpDate) < new Date() ? '#ef4444' : '#f59e0b' }}>
                        {new Date(lead.followUpDate) < new Date() ? '⚠ Overdue' : formatDate(lead.followUpDate)}
                      </span>
                    )}
                    <ChevronRight size={12} className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" style={{ color: 'var(--fd-ink-4)' }} />
                  </Link>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* ── Overdue Follow-Ups + Action Needed ───────────────────────────── */}
      {(overdueLeads.length > 0 || actionNeeded.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {overdueLeads.length > 0 && (
            <div
              className="rounded-2xl overflow-hidden"
              style={{ background: 'var(--fd-card-bg)', border: '1px solid rgba(239,68,68,0.25)' }}
            >
              <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--fd-border)' }}>
                <h3 className="text-[13.5px] font-bold flex items-center gap-2" style={{ color: 'var(--fd-ink-1)' }}>
                  <AlertTriangle size={13} style={{ color: '#ef4444' }} />
                  Overdue Follow-Ups
                  <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
                    {overdueLeads.length}
                  </span>
                </h3>
                <Link to="/admin/internal-leads?followUpToday=true" className="text-[11px] font-semibold flex items-center gap-1" style={{ color: '#ef4444' }}>
                  View all <ArrowUpRight size={11} />
                </Link>
              </div>
              <div className="divide-y" style={{ borderColor: 'var(--fd-border)' }}>
                {overdueLeads.slice(0, 5).map(lead => (
                  <Link
                    key={lead._id}
                    to={`/admin/internal-leads?lead=${lead._id}`}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-[var(--fd-table-row-hover)] transition-colors group"
                  >
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black text-white flex-shrink-0" style={{ background: QUALITY_META[lead.quality]?.color || '#6366f1' }}>
                      {(lead.name || lead.company || '?').slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] font-semibold truncate" style={{ color: 'var(--fd-ink-1)' }}>{lead.name || lead.company}</div>
                      {lead.followUpNote && <div className="text-[10.5px] truncate mt-0.5" style={{ color: 'var(--fd-ink-4)' }}>{lead.followUpNote}</div>}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-[10px] font-bold" style={{ color: '#ef4444' }}>Overdue</div>
                      <div className="text-[10px]" style={{ color: 'var(--fd-ink-5)' }}>{formatDate(lead.followUpDate)}</div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {actionNeeded.length > 0 && (
            <div
              className="rounded-2xl overflow-hidden"
              style={{ background: 'var(--fd-card-bg)', border: '1px solid var(--fd-border)' }}
            >
              <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--fd-border)' }}>
                <h3 className="text-[13.5px] font-bold flex items-center gap-2" style={{ color: 'var(--fd-ink-1)' }}>
                  <PlayCircle size={13} style={{ color: '#f59e0b' }} />
                  No Follow-Up Scheduled
                  <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b' }}>
                    {actionNeeded.length}
                  </span>
                </h3>
              </div>
              <div className="divide-y" style={{ borderColor: 'var(--fd-border)' }}>
                {actionNeeded.slice(0, 5).map(lead => {
                  const stage = STAGE_META[lead.stage] || {};
                  return (
                    <Link
                      key={lead._id}
                      to={`/admin/internal-leads?lead=${lead._id}`}
                      className="flex items-center gap-3 px-5 py-3 hover:bg-[var(--fd-table-row-hover)] transition-colors group"
                    >
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black text-white flex-shrink-0" style={{ background: stage.color || '#6366f1' }}>
                        {(lead.name || lead.company || '?').slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] font-semibold truncate" style={{ color: 'var(--fd-ink-1)' }}>{lead.name || lead.company}</div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] px-1.5 py-0.5 rounded-md" style={{ background: stage.bg, color: stage.color }}>{stage.label}</span>
                          <span className="text-[10px]" style={{ color: 'var(--fd-ink-5)' }}>Added {timeAgo(lead.createdAt)}</span>
                        </div>
                      </div>
                      <ChevronRight size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--fd-ink-4)' }} />
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Recent Activity Timeline ──────────────────────────────────────── */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: 'var(--fd-card-bg)', border: '1px solid var(--fd-border)' }}
      >
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--fd-border)' }}>
          <h3 className="text-[13.5px] font-bold flex items-center gap-2" style={{ color: 'var(--fd-ink-1)' }}>
            <Activity size={14} style={{ color: '#6366f1' }} /> Recent Activity
          </h3>
          <Link to="/admin/internal-leads" className="flex items-center gap-1 text-[11.5px] font-semibold" style={{ color: 'var(--fd-sidebar-link-active)' }}>
            View leads <ArrowUpRight size={11} />
          </Link>
        </div>
        <div className="divide-y" style={{ borderColor: 'var(--fd-border)' }}>
          {actTimeline.length === 0 ? (
            <div className="py-8 text-center text-[13px]" style={{ color: 'var(--fd-ink-4)' }}>
              No recent activity. Start logging your sales actions!
            </div>
          ) : (
            actTimeline.slice(0, 10).map((item, i) => {
              const meta  = ACTIVITY_META[item.action] || ACTIVITY_META.created;
              const Icon  = meta.icon;
              const stage = STAGE_META[item.stage] || {};
              return (
                <div key={i} className="flex items-center gap-3 px-5 py-3">
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: meta.color + '18', border: `1px solid ${meta.color}30` }}
                  >
                    <Icon size={12} style={{ color: meta.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[12px] font-semibold truncate" style={{ color: 'var(--fd-ink-1)' }}>
                        {item.leadName}
                      </span>
                      <span className="text-[10.5px] px-1.5 py-0.5 rounded-md font-medium" style={{ background: stage.bg || 'var(--fd-surface-sunken)', color: stage.color || 'var(--fd-ink-3)' }}>
                        {stage.label}
                      </span>
                    </div>
                    <div className="text-[10.5px] mt-0.5" style={{ color: 'var(--fd-ink-4)' }}>
                      <span style={{ color: meta.color, fontWeight: 600 }}>{meta.label}</span>
                      {item.note && ` · ${item.note}`}
                    </div>
                  </div>
                  <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--fd-ink-5)' }}>
                    {timeAgo(item.at)}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── Log Activity Modal ────────────────────────────────────────────── */}
      {showLogModal && (
        <LogActivityModal
          leads={allLeads}
          onClose={() => setShowLogModal(false)}
          onSuccess={() => { setRefresh(r => r + 1); }}
        />
      )}
    </div>
  );
}
