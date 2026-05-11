import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Building2, ArrowRight, Filter } from 'lucide-react';
import api from '../../lib/api';
import { PageHeader, EmptyState, Avatar, Card } from '../../components/shared/LoadingScreen';
import { Button, SearchInput, Modal, Input, Select, Tabs } from '../../components/ui/index';
import { formatDate, getStatusColor, PLAN_COLORS, PLAN_LABELS, SERVICE_LABELS } from '../../lib/utils';
import { Spinner } from '../../components/shared/LoadingScreen';

const SERVICES = Object.entries(SERVICE_LABELS);

function ClientForm({ initial, onSubmit, loading, managers }) {
  const [form, setForm] = useState(initial || {
    name: '', company: '', email: '', phone: '', website: '', industry: '',
    status: 'onboarding', plan: 'starter', services: [], monthlyBudget: '',
    accountManager: '', startDate: new Date().toISOString().split('T')[0], notes: '',
    createPortalUser: false, portalEmail: '', portalPassword: '',
  });

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const toggleService = (s) => set('services', form.services.includes(s) ? form.services.filter(x => x !== s) : [...form.services, s]);

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
          {['onboarding','active','paused','inactive','churned'].map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
        </Select>
        <Select label="Plan" value={form.plan} onChange={e => set('plan', e.target.value)}>
          {Object.entries(PLAN_LABELS).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
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

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">Services</label>
        <div className="flex flex-wrap gap-2">
          {SERVICES.map(([val, label]) => (
            <button type="button" key={val} onClick={() => toggleService(val)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${form.services.includes(val) ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-slate-600 border-slate-300 hover:border-brand-400'}`}
            >{label}</button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
        <textarea className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-brand-500" rows={3} value={form.notes} onChange={e => set('notes', e.target.value)} />
      </div>

      {!initial && (
        <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.createPortalUser} onChange={e => set('createPortalUser', e.target.checked)} className="rounded" />
            <span className="text-sm font-medium text-slate-700">Create portal login for this client</span>
          </label>
          {form.createPortalUser && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
    api.get('/users?role=manager').then(r => setManagers(r.data.users));
    api.get('/users?role=admin').then(r => setManagers(p => [...p, ...r.data.users]));
  }, []);

  const handleCreate = async (form) => {
    setSaving(true);
    try {
      await api.post('/clients', form);
      setShowModal(false);
      loadClients();
    } finally { setSaving(false); }
  };

  const tabs = [
    { label: 'All', value: '' },
    { label: 'Active', value: 'active' },
    { label: 'Onboarding', value: 'onboarding' },
    { label: 'Paused', value: 'paused' },
    { label: 'Inactive', value: 'inactive' },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        title="Clients"
        subtitle={`${total} total clients`}
        actions={<Button onClick={() => setShowModal(true)}><Plus size={16} />New Client</Button>}
      />

      {/* Filters */}
      <div className="flex flex-col gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Search clients..." />
        <div className="flex gap-2 overflow-x-auto pb-1 -mb-1">
          {tabs.map(t => (
            <button key={t.value} onClick={() => setStatusFilter(t.value)}
              className={`px-3 sm:px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors flex-shrink-0 ${statusFilter === t.value ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-50'}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table on md+, cards on mobile */}
      <Card>
        {loading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : clients.length === 0 ? (
          <EmptyState icon={Building2} title="No clients found" description="Create your first client or adjust your filters." action={<Button onClick={() => setShowModal(true)}><Plus size={16} />Add Client</Button>} />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    {['Client', 'Services', 'Manager', 'Plan', 'Status', 'Start Date', ''].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {clients.map(client => (
                    <tr key={client._id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <Avatar name={client.company} size="sm" />
                          <div>
                            <div className="font-medium text-slate-800">{client.company}</div>
                            <div className="text-xs text-slate-400">{client.name} · {client.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex gap-1 flex-wrap max-w-xs">
                          {client.services?.slice(0, 2).map(s => (
                            <span key={s} className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs">{SERVICE_LABELS[s] || s}</span>
                          ))}
                          {client.services?.length > 2 && <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-xs">+{client.services.length - 2}</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        {client.accountManager ? (
                          <div className="flex items-center gap-2">
                            <Avatar name={client.accountManager.name} size="xs" />
                            <span className="text-slate-700">{client.accountManager.name}</span>
                          </div>
                        ) : <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${PLAN_COLORS[client.plan] || 'bg-slate-100 text-slate-600'}`}>
                          {PLAN_LABELS[client.plan] || client.plan}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${getStatusColor(client.status)}`}>
                          {client.status}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-slate-500 text-xs">{formatDate(client.startDate)}</td>
                      <td className="px-4 py-3.5">
                        <Link to={`/admin/clients/${client._id}`} className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors inline-flex">
                          <ArrowRight size={16} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-slate-100">
              {clients.map(client => (
                <Link key={client._id} to={`/admin/clients/${client._id}`} className="flex items-center gap-3 px-4 py-4 hover:bg-slate-50 transition-colors">
                  <Avatar name={client.company} size="md" />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-slate-800 truncate">{client.company}</div>
                    <div className="text-xs text-slate-500 truncate mt-0.5">{client.name}</div>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${getStatusColor(client.status)}`}>
                        {client.status}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PLAN_COLORS[client.plan] || 'bg-slate-100 text-slate-600'}`}>
                        {PLAN_LABELS[client.plan] || client.plan}
                      </span>
                    </div>
                  </div>
                  <ArrowRight size={16} className="text-slate-300 flex-shrink-0" />
                </Link>
              ))}
            </div>
          </>
        )}
      </Card>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Add New Client" size="lg">
        <ClientForm onSubmit={handleCreate} loading={saving} managers={managers} />
      </Modal>
    </div>
  );
}