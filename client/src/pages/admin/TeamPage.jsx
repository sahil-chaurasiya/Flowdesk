// TeamPage.jsx
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Users, Mail, Phone, Shield, ArrowRight } from 'lucide-react';
import api from '../../lib/api';
import { PageHeader, EmptyState, Avatar, Card, Spinner } from '../../components/shared/LoadingScreen';
import { Button, Modal, Input, Select } from '../../components/ui/index';
import { formatDate } from '../../lib/utils';

const ROLE_LABELS = {
  admin: 'Admin',
  manager: 'Project Manager',
  performance_marketer: 'Performance Marketer',
  social_media_manager: 'Social Media Manager',
  video_editor: 'Video Editor',
  graphic_designer: 'Graphic Designer',
  copywriter: 'Copywriter',
};

const ROLE_COLORS = {
  admin: 'bg-red-100 text-red-700',
  manager: 'bg-purple-100 text-purple-700',
  performance_marketer: 'bg-blue-100 text-blue-700',
  social_media_manager: 'bg-pink-100 text-pink-700',
  video_editor: 'bg-orange-100 text-orange-700',
  graphic_designer: 'bg-indigo-100 text-indigo-700',
  copywriter: 'bg-teal-100 text-teal-700',
};

export function TeamPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '', email: '', password: '', role: 'copywriter',
    jobTitle: '', department: '', phone: ''
  });

  const load = () => {
    setLoading(true);
    api.get('/users').then(r => {
      setUsers(r.data.users);
      setLoading(false);
    }).catch(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    setSaving(true);
    try { await api.post('/users', form); setShowModal(false); load(); } finally { setSaving(false); }
  };

  const toggleActive = async (e, id, isActive) => {
    e.preventDefault();
    e.stopPropagation();
    await api.put(`/users/${id}`, { isActive: !isActive });
    setUsers(prev => prev.map(u => u._id === id ? { ...u, isActive: !isActive } : u));
  };

  const teamMembers = users.filter(u => u.role !== 'client');

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        title="Team"
        subtitle={`${teamMembers.length} members`}
        actions={<Button onClick={() => setShowModal(true)}><Plus size={16} />Add Member</Button>}
      />

      {loading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : teamMembers.length === 0 ? (
        <EmptyState icon={Users} title="No team members" description="Add your first team member to get started."
          action={<Button onClick={() => setShowModal(true)}><Plus size={16} />Add Member</Button>} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {teamMembers.map(u => (
            <Link key={u._id} to={`/admin/team/${u._id}`} className="block">
              <Card className={`hover:shadow-md hover:border-brand-200 transition-all cursor-pointer group ${!u.isActive ? 'opacity-60' : ''}`}>
                <div className="p-5">
                  <div className="flex items-start gap-3 mb-4">
                    <Avatar name={u.name} size="md" />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-slate-800 truncate group-hover:text-brand-600 transition-colors">{u.name}</div>
                      <div className="text-xs text-slate-500 truncate">{u.jobTitle || '—'}</div>
                      <span className={`inline-flex mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[u.role] || 'bg-slate-100 text-slate-600'}`}>
                        {ROLE_LABELS[u.role] || u.role?.replace('_', ' ')}
                      </span>
                    </div>
                    <ArrowRight size={16} className="text-slate-300 group-hover:text-brand-500 transition-colors mt-1 flex-shrink-0" />
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-500">
                    <div className="flex items-center gap-2"><Mail size={12} className="flex-shrink-0" /><span className="truncate">{u.email}</span></div>
                    {u.phone && <div className="flex items-center gap-2"><Phone size={12} className="flex-shrink-0" />{u.phone}</div>}
                    {u.department && <div className="flex items-center gap-2"><Shield size={12} className="flex-shrink-0" />{u.department}</div>}
                  </div>

                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100">
                    <span className="text-xs text-slate-400">Joined {formatDate(u.createdAt)}</span>
                    <button
                      onClick={(e) => toggleActive(e, u._id, u.isActive)}
                      className={`text-xs font-medium transition-colors ${u.isActive ? 'text-red-400 hover:text-red-600' : 'text-emerald-500 hover:text-emerald-700'}`}>
                      {u.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Add Team Member"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button loading={saving} onClick={handleCreate}>Create</Button>
          </div>
        }>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Full Name *" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
            <Input label="Email *" type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
          </div>
          <Input label="Password *" type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} placeholder="Min 8 characters" />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Role" value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}>
              {Object.entries(ROLE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
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