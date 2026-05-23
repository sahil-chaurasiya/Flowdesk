import React, { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search, Building2, ChevronRight } from 'lucide-react';
import api from '../../lib/api';
import { PageHeader, EmptyState, Avatar, Card, CardHeader, CardContent, Spinner } from '../../components/shared/LoadingScreen';
import { Button, Modal, Input, Select } from '../../components/ui/index';
import { formatDate, PLAN_LABELS } from '../../lib/utils';
import { useServices } from '../../hooks/useServices';
import useAuthStore from '../../context/authStore';

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
  '3_month':  { background: 'var(--fd-surface-sunken)', color: 'var(--fd-ink-2)' },
  '6_month':  { background: '#eff0fe', color: '#3a56d4' },
  '1_year':   { background: '#fdf2ff', color: '#7e22ce' },
  // legacy
  starter:    { background: 'var(--fd-surface-sunken)', color: 'var(--fd-ink-2)' },
  growth:     { background: '#eff0fe', color: '#3a56d4' },
  scale:      { background: '#fdf2ff', color: '#7e22ce' },
  enterprise: { background: '#fef7ea', color: '#92600a' },
};

const PLAN_STYLE_DARK = {
  '3_month':  { background: 'rgba(138,134,128,0.15)', color: '#8a8680' },
  '6_month':  { background: 'rgba(79,110,240,0.2)', color: '#7896f3' },
  '1_year':   { background: 'rgba(126,34,206,0.18)', color: '#c084fc' },
  // legacy
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

function ClientForm({ initial, onSubmit, loading, managers }) {
  const { services: servicesList } = useServices();
  const { user: currentUser } = useAuthStore();
  const isAdmin = currentUser?.role === 'admin';
  const SERVICES_LIST = servicesList.filter(s => s.isActive).map(s => [s.key, s.label]);
  const [form, setForm] = useState(initial || {
    name: '', company: '', email: '', phone: '', website: '', industry: '',
    status: 'onboarding', plan: '3_month', services: [], monthlyBudget: '',
    accountManager: '', startDate: new Date().toISOString().split('T')[0], notes: '',
    createPortalUser: false, portalEmail: '', portalPassword: '',
    whatsappGroup: '', whatsappPhone: '',
  });
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const toggleService = s => set('services', form.services.includes(s)
    ? form.services.filter(x => x !== s) : [...form.services, s]);

  // Logo state — preview URL (for display) + actual File object (for upload)
  const [logoPreview, setLogoPreview] = useState(initial?.logo || null);
  const [logoFile, setLogoFile] = useState(null);
  const [logoRemoved, setLogoRemoved] = useState(false);
  const logoInputRef = React.useRef(null);

  const handleLogoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
    setLogoRemoved(false);
    e.target.value = '';
  };

  const handleLogoRemove = () => {
    setLogoFile(null);
    setLogoPreview(null);
    setLogoRemoved(true);
  };

  const companyInitials = form.company
    ? form.company.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  const PLAN_OPTIONS = [
    { value: '3_month',  label: '3 Month' },
    { value: '6_month',  label: '6 Month' },
    { value: '1_year',   label: '1 Year' },
  ];

  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit(form, logoFile, logoRemoved); }} className="space-y-4">

      {/* Company Logo — top of form */}
      <div className="flex items-center gap-4 p-3 rounded-xl" style={{ background: 'var(--fd-surface-raised)', border: '1px solid var(--fd-border)' }}>
        <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
        {/* Avatar preview */}
        <div
          className="w-14 h-14 rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0 cursor-pointer border-2 border-dashed transition-colors"
          style={{
            borderColor: logoPreview ? 'transparent' : 'var(--fd-border)',
            background: logoPreview ? 'transparent' : 'var(--fd-surface-sunken)',
          }}
          onClick={() => logoInputRef.current?.click()}
          title="Click to upload logo"
        >
          {logoPreview ? (
            <img src={logoPreview} alt="logo" className="w-full h-full object-cover" />
          ) : (
            <span className="text-[15px] font-bold" style={{ color: 'var(--fd-ink-4)' }}>{companyInitials}</span>
          )}
        </div>
        {/* Label + buttons */}
        <div className="flex-1 min-w-0">
          <div className="text-[12px] font-medium mb-1" style={{ color: 'var(--fd-ink-2)' }}>Company Logo</div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => logoInputRef.current?.click()}
              className="px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all"
              style={{ background: 'var(--fd-btn-secondary-bg)', color: 'var(--fd-btn-secondary-text)', borderColor: 'var(--fd-btn-secondary-border)' }}
            >
              {logoPreview ? 'Change' : 'Upload'}
            </button>
            {logoPreview && (
              <button
                type="button"
                onClick={handleLogoRemove}
                className="px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all"
                style={{ background: 'transparent', color: '#b91c1c', borderColor: '#fca5a5' }}
              >
                Remove
              </button>
            )}
            <span className="text-[10.5px]" style={{ color: 'var(--fd-ink-5)' }}>PNG, JPG · shown in client list</span>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input label="Company *" value={form.company} onChange={e => set('company', e.target.value)} required />
        <Input label="Contact Name *" value={form.name} onChange={e => set('name', e.target.value)} required />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input label="Email *" type="email" value={form.email} onChange={e => set('email', e.target.value)} required />
        <Input label="Phone" value={form.phone} onChange={e => set('phone', e.target.value)} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input label="Website" value={form.website} onChange={e => set('website', e.target.value)} />
        <Input label="Industry" value={form.industry} onChange={e => set('industry', e.target.value)} />
      </div>
      <div className={`grid grid-cols-1 gap-3 ${isAdmin ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
        <Select label="Status" value={form.status} onChange={e => set('status', e.target.value)}>
          {['onboarding','active','paused','inactive','churned'].map(s => (
            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </Select>
        <Select label="Plan" value={form.plan} onChange={e => set('plan', e.target.value)}>
          {PLAN_OPTIONS.map(({ value, label }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </Select>
        {isAdmin && (
          <Input label="Monthly Budget" type="number" value={form.monthlyBudget} onChange={e => set('monthlyBudget', e.target.value)} />
        )}
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

      <div className="rounded-xl p-4 space-y-3" style={{ background: 'var(--fd-surface-raised)', border: '1px solid var(--fd-border)' }}>
        <div className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--fd-ink-4)' }}>WhatsApp</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input label="Group Link" placeholder="https://chat.whatsapp.com/..." value={form.whatsappGroup} onChange={e => set('whatsappGroup', e.target.value)} />
          <Input label="Phone Number (fallback)" placeholder="+91XXXXXXXXXX" value={form.whatsappPhone} onChange={e => set('whatsappPhone', e.target.value)} />
        </div>
        <p className="text-[11px]" style={{ color: 'var(--fd-ink-5)' }}>Group link takes priority. Phone is fallback for 1-on-1 chats.</p>
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
  const navigate = useNavigate();
  const [clients, setClients] = useState([]);
  const [managers, setManagers] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const { serviceLabels } = useServices();

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

  const handleCreate = async (form, logoFile, logoRemoved) => {
    setSaving(true);
    try {
      const { data } = await api.post('/clients', form);
      // Upload logo if one was selected
      if (logoFile && data.client?._id) {
        try {
          const fd = new FormData();
          fd.append('logo', logoFile);
          await api.post(`/clients/${data.client._id}/logo`, fd, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
        } catch (_) { /* non-fatal */ }
      }
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
                    <tr
                      key={client._id}
                      onClick={() => navigate(`/admin/clients/${client._id}`)}
                      className="cursor-pointer hover:bg-[var(--fd-table-row-hover)] transition-colors"
                    >
                      <td>
                        <div className="flex items-center gap-3">
                          <Avatar name={client.company} src={client.logo} size="sm" />
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
                              {serviceLabels[s] || s}
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
                        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                          {(client.whatsappGroup || client.whatsappPhone) && (
                            <a
                              href={client.whatsappGroup || `https://wa.me/${(client.whatsappPhone||'').replace(/\D/g,'')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="w-6 h-6 rounded-md flex items-center justify-center transition-opacity hover:opacity-80"
                              style={{ background: '#25d366' }}
                              title="Open WhatsApp"
                            >
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="white">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                              </svg>
                            </a>
                          )}
                          <ChevronRight size={15} style={{ color: 'var(--fd-ink-5)' }} />
                        </div>
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
                  <Avatar name={client.company} src={client.logo} size="md" />
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