import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Building2, ChevronRight } from 'lucide-react';
import api from '../../lib/api';
import { PageHeader, EmptyState, Avatar, Card, CardHeader, CardContent, Spinner } from '../../components/shared/LoadingScreen';
import { Button, Modal, Input, Select } from '../../components/ui/index';
import { formatDate, SERVICE_LABELS, PLAN_LABELS } from '../../lib/utils';

// Status & plan styles now use CSS vars so they adapt to dark mode automatically
const STATUS_STYLE_LIGHT = {
  active:     { background: '#edf7f1', color: '#2a7d4f' },
  onboarding: { background: '#fef7ea', color: '#92600a' },
  paused:     { background: '#fef7ea', color: '#92600a' },
  inactive:   { background: 'var(--fd-surface-sunken)', color: 'var(--fd-ink-3)' },
  churned:    { background: '#fef2f2', color: '#b91c1c' },
};

const STATUS_STYLE_DARK = {
  active:     { background: 'rgba(42,125,79,0.18)', color: '#4ade80' },
  onboarding: { background: 'rgba(146,96,10,0.18)', color: '#fbbf24' },
  paused:     { background: 'rgba(146,96,10,0.18)', color: '#fbbf24' },
  inactive:   { background: 'rgba(138,134,128,0.15)', color: '#8a8680' },
  churned:    { background: 'rgba(185,28,28,0.18)', color: '#f87171' },
};

const PLAN_STYLE_LIGHT = {
  starter:    { background: 'var(--fd-surface-sunken)', color: 'var(--fd-ink-2)' },
  growth:     { background: '#eff0fe', color: '#3a56d4' },
  scale:      { background: '#fdf2ff', color: '#7e22ce' },
  enterprise: { background: '#fef7ea', color: '#92600a' },
};

const PLAN_STYLE_DARK = {
  starter:    { background: 'rgba(138,134,128,0.15)', color: '#8a8680' },
  growth:     { background: 'rgba(79,110,240,0.2)', color: '#7896f3' },
  scale:      { background: 'rgba(126,34,206,0.18)', color: '#c084fc' },
  enterprise: { background: 'rgba(146,96,10,0.18)', color: '#fbbf24' },
};

function getStatusStyle(status) {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  return (isDark ? STATUS_STYLE_DARK : STATUS_STYLE_LIGHT)[status] || (isDark ? STATUS_STYLE_DARK : STATUS_STYLE_LIGHT).inactive;
}

function getPlanStyle(plan) {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  return (isDark ? PLAN_STYLE_DARK : PLAN_STYLE_LIGHT)[plan] || (isDark ? PLAN_STYLE_DARK : PLAN_STYLE_LIGHT).starter;
}

const STATUS_TABS = [
  { label: 'All',         value: '' },
  { label: 'Active',      value: 'active' },
  { label: 'Onboarding',  value: 'onboarding' },
  { label: 'Paused',      value: 'paused' },
  { label: 'Inactive',    value: 'inactive' },
];

const SERVICES_LIST = Object.entries(SERVICE_LABELS || {
  paid_ads: 'Paid Ads', social_media: 'Social Media', video_editing: 'Video Editing',
  graphic_design: 'Graphic Design', copywriting: 'Copywriting', reporting: 'Reporting',
});

function ClientForm({ initial, onSubmit, loading, managers }) {
  const [form, setForm] = useState(initial || {
    name: '', company: '', email: '', phone: '', website: '', industry: '',
    status: 'onboarding', plan: 'starter', services: [], monthlyBudget: '',
    accountManager: '', startDate: new Date().toISOString().split('T')[0], notes: '',
    createPortalUser: false, portalEmail: '', portalPassword: '',
  });
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const toggleService = s => set('services', form.services.includes(s)
    ? form.services.filter(x => x !== s) : [...form.services, s]);

  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit(form); }} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input label="Contact Name *" value={form.name} onChange={e => set('name', e.target.value)} required />
        <Input label="Company *" value={form.company} onChange={e => set('company', e.target.value)} required />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input label="Email *" type="email" value={form.email} onChange={e => set('email', e.target.value)} required />
        <Input label="Phone" value={form.phone} onChange={e => set('phone', e.target.value)} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input label="Website" value={form.website} onChange={e => set('website', e.target.value)} />
        <Input label="Industry" value={form.industry} onChange={e => set('industry', e.target.value)} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Select label="Status" value={form.status} onChange={e => set('status', e.target.value)}>
          {['onboarding','active','paused','inactive','churned'].map(s => (
            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </Select>
        <Select label="Plan" value={form.plan} onChange={e => set('plan', e.target.value)}>
          {Object.entries(PLAN_LABELS || { starter:'Starter', growth:'Growth', scale:'Scale', enterprise:'Enterprise' }).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </Select>
        <Input label="Monthly Budget ($)" type="number" value={form.monthlyBudget} onChange={e => set('monthlyBudget', e.target.value)} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Select label="Account Manager" value={form.accountManager} onChange={e => set('accountManager', e.target.value)}>
          <option value="">Select manager...</option>
          {managers.map(m => <option key={m._id} value={m._id}>{m.name}</option>)}
        </Select>
        <Input label="Start Date" type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)} />
      </div>

      {/* Services */}
      <div>
        <label className="block text-[12px] font-medium mb-2 text-[var(--fd-ink-2)]">Services</label>
        <div className="flex flex-wrap gap-2">
          {SERVICES_LIST.map(([val, label]) => (
            <button
              type="button"
              key={val}
              onClick={() => toggleService(val)}
              className="px-3 py-1.5 rounded-lg text-[12px] font-medium border transition-all"
              style={form.services.includes(val)
                ? { background: '#4f6ef0', color: '#ffffff', borderColor: '#4060e0' }
                : { background: 'var(--fd-btn-secondary-bg)', color: 'var(--fd-btn-secondary-text)', borderColor: 'var(--fd-btn-secondary-border)' }
              }
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-[12px] font-medium mb-1.5 text-[var(--fd-ink-2)]">Notes</label>
        <textarea
          className="fd-input resize-none"
          rows={3}
          value={form.notes}
          onChange={e => set('notes', e.target.value)}
        />
      </div>

      {!initial && (
        <div className="rounded-xl p-4 space-y-3 bg-[var(--fd-surface-raised)] border border-[var(--fd-border)]">
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={form.createPortalUser}
              onChange={e => set('createPortalUser', e.target.checked)}
              className="rounded"
              style={{ accentColor: '#4f6ef0' }}
            />
            <span className="text-[13px] font-medium text-[var(--fd-ink-2)]">
              Create client portal login
            </span>
          </label>
          {form.createPortalUser && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <Input label="Portal Email" type="email" value={form.portalEmail} onChange={e => set('portalEmail', e.target.value)} />
              <Input label="Portal Password" value={form.portalPassword} onChange={e => set('portalPassword', e.target.value)} placeholder="Min 8 characters" />
            </div>
          )}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit" loading={loading}>{initial ? 'Save Changes' : 'Create Client'}</Button>
      </div>
    </form>
  );
}

export default function ClientsPage() {
  const [clients, setClients] = useState([]);
  const [managers, setManagers] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadClients = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      const { data } = await api.get(`/clients?${params}`);
      setClients(data.clients);
      setTotal(data.total);
    } finally { setLoading(false); }
  }, [search, statusFilter]);

  useEffect(() => { loadClients(); }, [loadClients]);
  useEffect(() => {
    Promise.all([
      api.get('/users?role=manager'),
      api.get('/users?role=admin'),
    ]).then(([mr, ar]) => {
      setManagers([...(mr.data.users || []), ...(ar.data.users || [])]);
    });
  }, []);

  const handleCreate = async (form) => {
    setSaving(true);
    try {
      await api.post('/clients', form);
      setShowModal(false);
      loadClients();
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Clients"
        subtitle={`${total} client${total !== 1 ? 's' : ''} total`}
        actions={
          <Button onClick={() => setShowModal(true)}>
            <Plus size={14} />Add Client
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative max-w-sm flex-shrink-0">
          <Search size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--fd-ink-4)]" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search clients..."
            className="fd-input pl-9"
          />
        </div>
        <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
          {STATUS_TABS.map(t => (
            <button
              key={t.value}
              onClick={() => setStatusFilter(t.value)}
              className="px-3 py-1.5 rounded-lg text-[12px] font-medium whitespace-nowrap transition-all flex-shrink-0 border"
              style={statusFilter === t.value
                ? { background: '#4f6ef0', color: '#ffffff', borderColor: '#4060e0', boxShadow: '0 1px 3px rgba(79,110,240,0.25)' }
                : { background: 'var(--fd-btn-secondary-bg)', color: 'var(--fd-btn-secondary-text)', borderColor: 'var(--fd-btn-secondary-border)' }
              }
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table card */}
      <Card>
        {loading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : clients.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="No clients found"
            description="Add your first client or adjust the filters."
            action={<Button onClick={() => setShowModal(true)}><Plus size={14} />Add Client</Button>}
          />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="fd-table">
                <thead>
                  <tr>
                    {['Client', 'Services', 'Manager', 'Plan', 'Status', 'Since', ''].map(h => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {clients.map(client => (
                    <tr key={client._id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <Avatar name={client.company} size="sm" />
                          <div>
                            <div className="font-semibold text-[13px] text-[var(--fd-ink-1)]">
                              {client.company}
                            </div>
                            <div className="text-[11px] mt-0.5 text-[var(--fd-ink-4)]">
                              {client.name} · {client.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="flex gap-1 flex-wrap">
                          {client.services?.slice(0, 2).map(s => (
                            <span
                              key={s}
                              className="px-2 py-0.5 rounded text-[10.5px] font-medium"
                              style={{ background: 'var(--fd-surface-sunken)', color: 'var(--fd-ink-3)' }}
                            >
                              {(SERVICE_LABELS || {})[s] || s}
                            </span>
                          ))}
                          {client.services?.length > 2 && (
                            <span
                              className="px-2 py-0.5 rounded text-[10.5px]"
                              style={{ background: 'var(--fd-surface-sunken)', color: 'var(--fd-ink-4)' }}
                            >
                              +{client.services.length - 2}
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        {client.accountManager ? (
                          <div className="flex items-center gap-2">
                            <Avatar name={client.accountManager.name} size="xs" />
                            <span className="text-[12.5px] text-[var(--fd-ink-2)]">
                              {client.accountManager.name}
                            </span>
                          </div>
                        ) : <span style={{ color: 'var(--fd-ink-5)' }}>—</span>}
                      </td>
                      <td>
                        <span
                          className="text-[11px] font-medium px-2 py-0.5 rounded-full capitalize"
                          style={getPlanStyle(client.plan)}
                        >
                          {(PLAN_LABELS || {})[client.plan] || client.plan}
                        </span>
                      </td>
                      <td>
                        <span
                          className="text-[11px] font-medium px-2.5 py-0.5 rounded-full capitalize"
                          style={getStatusStyle(client.status)}
                        >
                          {client.status}
                        </span>
                      </td>
                      <td className="text-[12px] font-mono text-[var(--fd-ink-4)]">
                        {formatDate(client.startDate)}
                      </td>
                      <td>
                        <Link
                          to={`/admin/clients/${client._id}`}
                          className="btn-ghost p-1.5"
                        >
                          <ChevronRight size={15} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y" style={{ borderColor: 'var(--fd-border-subtle)' }}>
              {clients.map(client => (
                <Link
                  key={client._id}
                  to={`/admin/clients/${client._id}`}
                  className="flex items-center gap-3.5 px-4 py-4 transition-colors hover:bg-[var(--fd-table-row-hover)]"
                >
                  <Avatar name={client.company} size="md" />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-[13px] truncate text-[var(--fd-ink-1)]">
                      {client.company}
                    </div>
                    <div className="text-[11.5px] mt-0.5 truncate text-[var(--fd-ink-3)]">
                      {client.name}
                    </div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span
                        className="text-[10.5px] font-medium px-2 py-0.5 rounded-full capitalize"
                        style={getStatusStyle(client.status)}
                      >
                        {client.status}
                      </span>
                    </div>
                  </div>
                  <ChevronRight size={14} style={{ color: 'var(--fd-ink-5)' }} className="flex-shrink-0" />
                </Link>
              ))}
            </div>
          </>
        )}
      </Card>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="New Client" size="lg">
        <ClientForm onSubmit={handleCreate} loading={saving} managers={managers} />
      </Modal>
    </div>
  );
}