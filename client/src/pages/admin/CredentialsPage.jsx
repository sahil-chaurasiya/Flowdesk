import React, { useEffect, useState, useCallback } from 'react';
import {
  Plus, Eye, EyeOff, Copy, Check, Key, Edit3, Trash2,
  Save, Instagram, Globe, Facebook, Linkedin, Youtube, Search,
} from 'lucide-react';
import api from '../../lib/api';
import useAuthStore from '../../context/authStore';
import { PageHeader, EmptyState, Card, CardContent, Avatar, Spinner } from '../../components/shared/LoadingScreen';
import { Button, Modal, Input, Select, useToast } from '../../components/ui/index';

const PLATFORMS = [
  { value: 'instagram',    label: 'Instagram',       icon: Instagram, color: '#e1306c', bg: '#fdf2ff' },
  { value: 'facebook',     label: 'Facebook',        icon: Facebook,  color: '#1877f2', bg: '#eff6ff' },
  { value: 'gmb',          label: 'Google Business', icon: Globe,     color: '#34a853', bg: '#edf7f1' },
  { value: 'google_ads',   label: 'Google Ads',      icon: Globe,     color: '#fbbc04', bg: '#fffbeb' },
  { value: 'linkedin',     label: 'LinkedIn',        icon: Linkedin,  color: '#0a66c2', bg: '#eff6ff' },
  { value: 'tiktok',       label: 'TikTok',          icon: Globe,     color: '#010101', bg: '#f5f5f5' },
  { value: 'youtube',      label: 'YouTube',         icon: Youtube,   color: '#ff0000', bg: '#fff0f0' },
  { value: 'twitter',      label: 'Twitter / X',     icon: Globe,     color: '#14171a', bg: '#f5f5f5' },
  { value: 'whatsapp',     label: 'WhatsApp',        icon: Globe,     color: '#25d366', bg: '#edf7f1' },
  { value: 'other',        label: 'Other',           icon: Key,       color: '#6b7280', bg: '#f5f5f5' },
];

function getPlatform(value) {
  return PLATFORMS.find(p => p.value === value) || PLATFORMS[PLATFORMS.length - 1];
}

function CopyBtn({ text }) {
  const [copied, setCopied] = useState(false);
  if (!text) return null;
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="btn-ghost p-1"
      title="Copy"
    >
      {copied ? <Check size={11} style={{ color: '#2a7d4f' }} /> : <Copy size={11} />}
    </button>
  );
}

function PasswordField({ value }) {
  const [show, setShow] = useState(false);
  if (!value) return <span style={{ color: 'var(--fd-ink-5)' }}>—</span>;
  return (
    <div className="flex items-center gap-1">
      <span className="text-[12px] font-mono" style={{ color: 'var(--fd-ink-2)' }}>
        {show ? value : '••••••••'}
      </span>
      <button onClick={() => setShow(v => !v)} className="btn-ghost p-1" title={show ? 'Hide' : 'Show'}>
        {show ? <EyeOff size={12} /> : <Eye size={12} />}
      </button>
      {show && <CopyBtn text={value} />}
    </div>
  );
}

const EMPTY_FORM = { clientId: '', platform: 'instagram', label: '', username: '', password: '', notes: '', visibleTo: [] };

function CredentialForm({ initial, clients, managers, userRole, onSubmit, loading, onClose }) {
  const [form, setForm] = useState(initial ? {
    clientId:  initial.client?._id || initial.client || '',
    platform:  initial.platform  || 'instagram',
    label:     initial.label     || '',
    username:  initial.username  || '',
    password:  initial.password  || '',
    notes:     initial.notes     || '',
    visibleTo: (initial.visibleTo || []).map(v => v._id || v),
  } : EMPTY_FORM);
  const [showPass, setShowPass] = useState(false);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div className="space-y-4">
      {(userRole === 'admin' || userRole === 'manager') && (
        <Select label="Client *" value={form.clientId} onChange={e => set('clientId', e.target.value)} required>
          <option value="">Select client...</option>
          {clients.map(c => <option key={c._id} value={c._id}>{c.company} ({c.name})</option>)}
        </Select>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Select label="Platform *" value={form.platform} onChange={e => set('platform', e.target.value)}>
          {PLATFORMS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
        </Select>
        <Input label="Label (optional)" value={form.label} onChange={e => set('label', e.target.value)} placeholder="e.g. Main Account" />
      </div>
      <Input label="Username / Email / ID" value={form.username} onChange={e => set('username', e.target.value)} placeholder="@handle or email" />
      <div className="relative">
        <Input
          label="Password"
          type={showPass ? 'text' : 'password'}
          value={form.password}
          onChange={e => set('password', e.target.value)}
          placeholder="Enter password"
        />
        <button type="button" onClick={() => setShowPass(v => !v)}
          className="absolute right-3 top-8" style={{ color: 'var(--fd-ink-4)' }}>
          {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>

      {/* Visible to managers — admin only */}
      {userRole === 'admin' && managers.length > 0 && (
        <div>
          <label className="block text-[12px] font-medium mb-2" style={{ color: 'var(--fd-ink-2)' }}>
            Also visible to (managers)
          </label>
          <div className="flex flex-wrap gap-2">
            {managers.map(m => {
              const selected = form.visibleTo.includes(m._id);
              return (
                <button key={m._id} type="button"
                  onClick={() => set('visibleTo', selected
                    ? form.visibleTo.filter(id => id !== m._id)
                    : [...form.visibleTo, m._id]
                  )}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium border transition-all"
                  style={selected
                    ? { background: '#4f6ef0', color: '#fff', borderColor: '#4060e0' }
                    : { background: 'var(--fd-btn-secondary-bg)', color: 'var(--fd-btn-secondary-text)', borderColor: 'var(--fd-btn-secondary-border)' }
                  }
                >
                  <Avatar name={m.name} size="xs" />{m.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <label className="block text-[12px] font-medium mb-1.5" style={{ color: 'var(--fd-ink-2)' }}>Notes</label>
        <textarea className="fd-input resize-none" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
        <Button size="sm" loading={loading} onClick={() => onSubmit(form)}>
          <Save size={13} /> Save
        </Button>
      </div>
    </div>
  );
}

function CredTable({ creds, onEdit, onDelete }) {
  return (
    <>
      {/* Desktop */}
      <div className="hidden md:block overflow-x-auto">
        <table className="fd-table">
          <thead>
            <tr>
              {['Platform', 'Label', 'Username', 'Password', 'Notes', 'Added by', ''].map(h => <th key={h}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {creds.map(c => {
              const plat = getPlatform(c.platform);
              const PlatIcon = plat.icon;
              return (
                <tr key={c._id}>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={{ background: plat.bg }}>
                        <PlatIcon size={12} color={plat.color} />
                      </div>
                      <span className="text-[12.5px] font-medium" style={{ color: 'var(--fd-ink-2)' }}>{plat.label}</span>
                    </div>
                  </td>
                  <td className="text-[12.5px]" style={{ color: 'var(--fd-ink-2)' }}>{c.label || '—'}</td>
                  <td>
                    <div className="flex items-center gap-1">
                      <span className="text-[12px] font-mono" style={{ color: 'var(--fd-ink-2)' }}>{c.username || '—'}</span>
                      <CopyBtn text={c.username} />
                    </div>
                  </td>
                  <td><PasswordField value={c.password} /></td>
                  <td className="text-[12px] max-w-[160px] truncate" style={{ color: 'var(--fd-ink-4)' }} title={c.notes}>
                    {c.notes || '—'}
                  </td>
                  <td className="text-[11.5px]" style={{ color: 'var(--fd-ink-4)' }}>{c.addedBy?.name || '—'}</td>
                  <td>
                    <div className="flex gap-1">
                      <button onClick={() => onEdit(c)} className="btn-ghost p-1.5" title="Edit"><Edit3 size={13} /></button>
                      {onDelete && (
                        <button onClick={() => onDelete(c._id)} className="btn-ghost p-1.5" title="Delete" style={{ color: '#b91c1c' }}>
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile */}
      <div className="md:hidden divide-y" style={{ borderColor: 'var(--fd-border-subtle)' }}>
        {creds.map(c => {
          const plat = getPlatform(c.platform);
          const PlatIcon = plat.icon;
          return (
            <div key={c._id} className="px-4 py-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: plat.bg }}>
                    <PlatIcon size={13} color={plat.color} />
                  </div>
                  <div>
                    <div className="font-semibold text-[13px]" style={{ color: 'var(--fd-ink-1)' }}>{plat.label}</div>
                    {c.label && <div className="text-[11px]" style={{ color: 'var(--fd-ink-4)' }}>{c.label}</div>}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => onEdit(c)} className="btn-ghost p-1.5"><Edit3 size={13} /></button>
                  {onDelete && (
                    <button onClick={() => onDelete(c._id)} className="btn-ghost p-1.5" style={{ color: '#b91c1c' }}><Trash2 size={13} /></button>
                  )}
                </div>
              </div>
              {c.username && (
                <div className="flex items-center gap-1 text-[12px] font-mono" style={{ color: 'var(--fd-ink-3)' }}>
                  {c.username} <CopyBtn text={c.username} />
                </div>
              )}
              <PasswordField value={c.password} />
              {c.notes && <p className="text-[11.5px] italic" style={{ color: 'var(--fd-ink-4)' }}>{c.notes}</p>}
            </div>
          );
        })}
      </div>
    </>
  );
}

export default function CredentialsPage() {
  const { user } = useAuthStore();
  const toast = useToast();
  const isAdmin   = user?.role === 'admin';
  const isManager = user?.role === 'manager';
  const isClient  = user?.role === 'client';
  const canManage = isAdmin || isManager;

  const [creds,        setCreds]        = useState([]);
  const [clients,      setClients]      = useState([]);
  const [managers,     setManagers]     = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState('');
  const [filterClient, setFilterClient] = useState('');
  const [showModal,    setShowModal]    = useState(false);
  const [editCred,     setEditCred]     = useState(null);
  const [saving,       setSaving]       = useState(false);
  const [deleteId,     setDeleteId]     = useState(null);
  const [deleting,     setDeleting]     = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (isClient && user.clientId) params.set('clientId', user.clientId);
      const [credsRes, clientsRes, managersRes] = await Promise.all([
        api.get(`/credentials?${params}`),
        canManage ? api.get('/clients?limit=100') : Promise.resolve({ data: { clients: [] } }),
        isAdmin ? api.get('/users?role=manager&limit=50') : Promise.resolve({ data: { users: [] } }),
      ]);
      setCreds(credsRes.data.credentials || []);
      setClients(clientsRes.data.clients || []);
      setManagers(managersRes.data.users || []);
    } finally { setLoading(false); }
  }, [isAdmin, isManager, isClient, canManage, user]);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async (form) => {
    if (canManage && !form.clientId) {
      toast({ type: 'error', title: 'Please select a client' });
      return;
    }
    setSaving(true);
    try {
      const payload = isClient ? { ...form, clientId: user.clientId } : form;
      if (editCred) {
        await api.put(`/credentials/${editCred._id}`, payload);
        toast({ type: 'success', title: 'Credential updated' });
      } else {
        await api.post('/credentials', payload);
        toast({ type: 'success', title: 'Credential saved' });
      }
      setShowModal(false);
      setEditCred(null);
      load();
    } catch (err) {
      toast({ type: 'error', title: 'Save failed', message: err?.response?.data?.message });
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/credentials/${deleteId}`);
      toast({ type: 'success', title: 'Deleted' });
      setDeleteId(null);
      load();
    } catch {
      toast({ type: 'error', title: 'Delete failed' });
    } finally { setDeleting(false); }
  };

  const filtered = creds.filter(c => {
    if (filterClient && c.client?._id !== filterClient) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      c.platform?.includes(q) ||
      c.label?.toLowerCase().includes(q) ||
      c.username?.toLowerCase().includes(q) ||
      c.client?.company?.toLowerCase().includes(q) ||
      c.client?.name?.toLowerCase().includes(q)
    );
  });

  // Group by client for admin/manager
  const grouped = canManage
    ? filtered.reduce((acc, c) => {
        const key = c.client?._id || 'unknown';
        if (!acc[key]) acc[key] = { client: c.client, items: [] };
        acc[key].items.push(c);
        return acc;
      }, {})
    : null;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Credentials"
        subtitle="Store social media and platform login credentials"
        actions={
          <Button onClick={() => { setEditCred(null); setShowModal(true); }}>
            <Plus size={14} /> Add Credential
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--fd-ink-4)' }} />
          <input
            className="fd-input pl-9 w-full min-w-[200px]"
            placeholder="Search credentials..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        {canManage && clients.length > 0 && (
          <select
            className="fd-input min-w-[180px]"
            value={filterClient}
            onChange={e => setFilterClient(e.target.value)}
          >
            <option value="">All Clients</option>
            {clients.map(c => (
              <option key={c._id} value={c._id}>{c.company} ({c.name})</option>
            ))}
          </select>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Spinner size="lg" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Key}
          title="No credentials stored"
          description="Add Instagram, Facebook, Google Business, or any other platform credentials."
          action={<Button onClick={() => setShowModal(true)}><Plus size={14} />Add Credential</Button>}
        />
      ) : canManage && grouped ? (
        <div className="space-y-4">
          {Object.values(grouped).map(({ client, items }) => (
            <Card key={client?._id || 'unknown'}>
              <div className="px-5 py-3.5 border-b flex items-center gap-2.5" style={{ borderColor: 'var(--fd-border-subtle)' }}>
                <Avatar name={client?.company || 'Unknown'} size="sm" />
                <div>
                  <div className="font-semibold text-[13px]" style={{ color: 'var(--fd-ink-1)' }}>{client?.company || 'Unknown Client'}</div>
                  <div className="text-[11px]" style={{ color: 'var(--fd-ink-4)' }}>{items.length} credential{items.length !== 1 ? 's' : ''}</div>
                </div>
              </div>
              <CredTable creds={items} onEdit={c => { setEditCred(c); setShowModal(true); }} onDelete={setDeleteId} />
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CredTable creds={filtered} onEdit={c => { setEditCred(c); setShowModal(true); }} onDelete={isAdmin ? setDeleteId : null} />
        </Card>
      )}

      <Modal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditCred(null); }}
        title={editCred ? 'Edit Credential' : 'Add Credential'}
        size="md"
      >
        <CredentialForm
          initial={editCred}
          clients={clients}
          managers={managers}
          userRole={user?.role}
          onSubmit={handleSubmit}
          loading={saving}
          onClose={() => { setShowModal(false); setEditCred(null); }}
        />
      </Modal>

      <Modal isOpen={!!deleteId} onClose={() => setDeleteId(null)} title="Delete Credential" size="sm">
        <p className="text-[13px] mb-5" style={{ color: 'var(--fd-ink-2)' }}>
          Remove this credential? This cannot be undone.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => setDeleteId(null)}>Cancel</Button>
          <Button size="sm" loading={deleting} onClick={handleDelete}
            style={{ background: '#b91c1c', color: '#fff', borderColor: '#b91c1c' }}>
            <Trash2 size={13} /> Delete
          </Button>
        </div>
      </Modal>
    </div>
  );
}