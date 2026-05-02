// TeamPage.jsx
import React, { useEffect, useState } from 'react';
import { Plus, Users, Mail, Phone, Shield } from 'lucide-react';
import api from '../../lib/api';
import { PageHeader, EmptyState, Avatar, Card, Spinner } from '../../components/shared/LoadingScreen';
import { Button, Modal, Input, Select } from '../../components/ui/index';
import { formatDate } from '../../lib/utils';

export function TeamPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'team_member', jobTitle: '', department: '', phone: '' });

  const load = () => { setLoading(true); api.get('/users').then(r => { setUsers(r.data.users); setLoading(false); }); };
  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    setSaving(true);
    try { await api.post('/users', form); setShowModal(false); load(); } finally { setSaving(false); }
  };

  const toggleActive = async (id, isActive) => {
    await api.put(`/users/${id}`, { isActive: !isActive });
    setUsers(prev => prev.map(u => u._id === id ? { ...u, isActive: !isActive } : u));
  };

  const roleColor = { admin: 'bg-red-100 text-red-700', manager: 'bg-purple-100 text-purple-700', team_member: 'bg-blue-100 text-blue-700', client: 'bg-emerald-100 text-emerald-700' };

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader title="Team" subtitle={`${users.length} members`} actions={<Button onClick={() => setShowModal(true)}><Plus size={16} />Add Member</Button>} />
      {loading ? <div className="flex justify-center py-16"><Spinner /></div> : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {users.filter(u => u.role !== 'client').map(u => (
            <Card key={u._id} className={!u.isActive ? 'opacity-60' : ''}>
              <div className="p-5">
                <div className="flex items-start gap-3 mb-4">
                  <Avatar name={u.name} size="md" />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-slate-800 truncate">{u.name}</div>
                    <div className="text-xs text-slate-500 truncate">{u.jobTitle || '—'}</div>
                    <span className={`inline-flex mt-1 px-2 py-0.5 rounded-full text-xs font-medium capitalize ${roleColor[u.role] || 'bg-slate-100 text-slate-600'}`}>{u.role?.replace('_', ' ')}</span>
                  </div>
                </div>
                <div className="space-y-1.5 text-xs text-slate-500">
                  <div className="flex items-center gap-2"><Mail size={12} />{u.email}</div>
                  {u.phone && <div className="flex items-center gap-2"><Phone size={12} />{u.phone}</div>}
                  {u.department && <div className="flex items-center gap-2"><Shield size={12} />{u.department}</div>}
                </div>
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100">
                  <span className="text-xs text-slate-400">Joined {formatDate(u.createdAt)}</span>
                  <button onClick={() => toggleActive(u._id, u.isActive)} className={`text-xs font-medium ${u.isActive ? 'text-red-500 hover:text-red-700' : 'text-emerald-500 hover:text-emerald-700'}`}>
                    {u.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Add Team Member"
        footer={<div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button><Button loading={saving} onClick={handleCreate}>Create</Button></div>}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Full Name *" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
            <Input label="Email *" type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
          </div>
          <Input label="Password *" type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} placeholder="Min 8 characters" />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Role" value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}>
              <option value="team_member">Team Member</option>
              <option value="manager">Manager</option>
              <option value="admin">Admin</option>
            </Select>
            <Input label="Job Title" value={form.jobTitle} onChange={e => setForm(p => ({ ...p, jobTitle: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Department" value={form.department} onChange={e => setForm(p => ({ ...p, department: e.target.value }))} />
            <Input label="Phone" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default TeamPage;
