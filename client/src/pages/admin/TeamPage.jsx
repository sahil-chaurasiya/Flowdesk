import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Users, Mail, Phone, Shield, ChevronRight } from 'lucide-react';
import api from '../../lib/api';
import { PageHeader, EmptyState, Avatar, Card, Spinner } from '../../components/shared/LoadingScreen';
import { Button, Modal, Input, Select } from '../../components/ui/index';
import { formatDate } from '../../lib/utils';

const ROLE_LABELS = {
  admin: 'Admin', manager: 'Project Manager',
  performance_marketer: 'Performance Marketer',
  social_media_manager: 'Social Media Manager',
  video_editor: 'Video Editor', graphic_designer: 'Graphic Designer',
  copywriter: 'Copywriter',
};

// Light mode role badge styles
const ROLE_STYLE_LIGHT = {
  admin:                { background: '#fef2f2', color: '#b91c1c' },
  manager:              { background: '#fdf2ff', color: '#7e22ce' },
  performance_marketer: { background: '#eff0fe', color: '#3a56d4' },
  social_media_manager: { background: '#fff0f8', color: '#9d174d' },
  video_editor:         { background: '#fef7ea', color: '#92600a' },
  graphic_designer:     { background: '#f0f4ff', color: '#1d4ed8' },
  copywriter:           { background: '#f0fdf4', color: '#15803d' },
};

// Dark mode role badge styles
const ROLE_STYLE_DARK = {
  admin:                { background: 'rgba(185,28,28,0.18)', color: '#f87171' },
  manager:              { background: 'rgba(126,34,206,0.18)', color: '#c084fc' },
  performance_marketer: { background: 'rgba(79,110,240,0.2)', color: '#7896f3' },
  social_media_manager: { background: 'rgba(157,23,77,0.18)', color: '#f472b6' },
  video_editor:         { background: 'rgba(146,96,10,0.18)', color: '#fbbf24' },
  graphic_designer:     { background: 'rgba(29,78,216,0.18)', color: '#60a5fa' },
  copywriter:           { background: 'rgba(21,128,61,0.18)', color: '#4ade80' },
};

function getRoleStyle(role) {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const map = isDark ? ROLE_STYLE_DARK : ROLE_STYLE_LIGHT;
  return map[role] || { background: 'var(--fd-surface-sunken)', color: 'var(--fd-ink-2)' };
}

export default function TeamPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '', email: '', password: '', role: 'copywriter',
    jobTitle: '', department: '', phone: '',
  });

  const load = () => {
    setLoading(true);
    api.get('/users').then(r => {
      setUsers(r.data.users || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    setSaving(true);
    try {
      await api.post('/users', form);
      setShowModal(false);
      load();
    } finally { setSaving(false); }
  };

  const toggleActive = async (e, id, isActive) => {
    e.preventDefault();
    e.stopPropagation();
    await api.put(`/users/${id}`, { isActive: !isActive });
    setUsers(prev => prev.map(u => u._id === id ? { ...u, isActive: !isActive } : u));
  };

  const team = users.filter(u => u.role !== 'client');

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Team"
        subtitle={`${team.length} member${team.length !== 1 ? 's' : ''}`}
        actions={
          <Button onClick={() => setShowModal(true)}>
            <Plus size={14} />Add Member
          </Button>
        }
      />

      {loading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : team.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No team members"
          description="Add your first team member to get started."
          action={<Button onClick={() => setShowModal(true)}><Plus size={14} />Add Member</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {team.map(u => (
            <Link key={u._id} to={`/admin/team/${u._id}`} className="block group">
              <div
                className="fd-card-hover p-5 cursor-pointer transition-all"
                style={{ opacity: u.isActive ? 1 : 0.55 }}
              >
                {/* Header */}
                <div className="flex items-start gap-3 mb-4">
                  <Avatar name={u.name} size="md" />
                  <div className="flex-1 min-w-0">
                    <div
                      className="font-semibold text-[13.5px] truncate group-hover:text-[var(--fd-sidebar-link-active)] transition-colors"
                      style={{ color: 'var(--fd-ink-1)' }}
                    >
                      {u.name}
                    </div>
                    <div className="text-[11.5px] mt-0.5 truncate" style={{ color: 'var(--fd-ink-4)' }}>
                      {u.jobTitle || ROLE_LABELS[u.role] || u.role}
                    </div>
                    <span
                      className="inline-flex mt-2 px-2 py-0.5 rounded-full text-[10.5px] font-semibold"
                      style={getRoleStyle(u.role)}
                    >
                      {ROLE_LABELS[u.role] || u.role}
                    </span>
                  </div>
                  <ChevronRight size={14} style={{ color: 'var(--fd-ink-5)' }} className="mt-0.5 flex-shrink-0 group-hover:text-[var(--fd-sidebar-link-active)] transition-colors" />
                </div>

                {/* Details */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-[12px]" style={{ color: 'var(--fd-ink-3)' }}>
                    <Mail size={11} style={{ color: 'var(--fd-ink-5)' }} strokeWidth={1.7} className="flex-shrink-0" />
                    <span className="truncate">{u.email}</span>
                  </div>
                  {u.phone && (
                    <div className="flex items-center gap-2 text-[12px]" style={{ color: 'var(--fd-ink-3)' }}>
                      <Phone size={11} style={{ color: 'var(--fd-ink-5)' }} strokeWidth={1.7} className="flex-shrink-0" />
                      <span>{u.phone}</span>
                    </div>
                  )}
                  {u.department && (
                    <div className="flex items-center gap-2 text-[12px]" style={{ color: 'var(--fd-ink-3)' }}>
                      <Shield size={11} style={{ color: 'var(--fd-ink-5)' }} strokeWidth={1.7} className="flex-shrink-0" />
                      <span>{u.department}</span>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div
                  className="flex items-center justify-between mt-4 pt-3 border-t"
                  style={{ borderColor: 'var(--fd-border-subtle)' }}
                >
                  <span className="text-[11px] font-mono" style={{ color: 'var(--fd-ink-5)' }}>
                    Since {formatDate(u.createdAt)}
                  </span>
                  <button
                    onClick={(e) => toggleActive(e, u._id, u.isActive)}
                    className="text-[11.5px] font-medium px-2 py-0.5 rounded-md transition-all hover:opacity-80"
                    style={u.isActive
                      ? { color: '#b91c1c' }
                      : { color: '#2a7d4f' }
                    }
                  >
                    {u.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Add Team Member"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button loading={saving} onClick={handleCreate}>Create Member</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Full Name *"
              value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
            />
            <Input
              label="Email *"
              type="email"
              value={form.email}
              onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
            />
          </div>
          <Input
            label="Password *"
            type="password"
            value={form.password}
            onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
            placeholder="Min 8 characters"
          />
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Role"
              value={form.role}
              onChange={e => setForm(p => ({ ...p, role: e.target.value }))}
            >
              {Object.entries(ROLE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </Select>
            <Input
              label="Job Title"
              value={form.jobTitle}
              onChange={e => setForm(p => ({ ...p, jobTitle: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Department"
              value={form.department}
              onChange={e => setForm(p => ({ ...p, department: e.target.value }))}
            />
            <Input
              label="Phone"
              value={form.phone}
              onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}