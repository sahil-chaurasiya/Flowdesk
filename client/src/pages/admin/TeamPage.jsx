import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Users, Mail, Phone, Shield, ChevronRight, Trash2, GripVertical } from 'lucide-react';
import api from '../../lib/api';
import { PageHeader, EmptyState, Avatar, Card, Spinner } from '../../components/shared/LoadingScreen';
import { Button, Modal, Input, Select } from '../../components/ui/index';
import { formatDate } from '../../lib/utils';
import useAuthStore from '../../context/authStore';

const TEAM_ORDER_KEY = 'flowdesk_team_order';

const ROLE_LABELS = {
  admin: 'Admin', manager: 'Project Manager', developer: 'Software Developer',
  performance_marketer: 'Performance Marketer',
  social_media_manager: 'Social Media Manager',
  video_editor: 'Video Editor', graphic_designer: 'Graphic Designer',
  copywriter: 'Copywriter',
};

const ROLE_STYLE_LIGHT = {
  admin:                { background: '#fef2f2', color: '#b91c1c' },
  manager:              { background: '#fdf2ff', color: '#7e22ce' },
  developer:            { background: '#ecfeff', color: '#0e7490' },
  performance_marketer: { background: '#eff0fe', color: '#3a56d4' },
  social_media_manager: { background: '#fff0f8', color: '#9d174d' },
  video_editor:         { background: '#fef7ea', color: '#92600a' },
  graphic_designer:     { background: '#f0f4ff', color: '#1d4ed8' },
  copywriter:           { background: '#f0fdf4', color: '#15803d' },
};

const ROLE_STYLE_DARK = {
  admin:                { background: 'rgba(185,28,28,0.18)', color: '#f87171' },
  manager:              { background: 'rgba(126,34,206,0.18)', color: '#c084fc' },
  developer:            { background: 'rgba(14,116,144,0.2)',  color: '#22d3ee' },
  performance_marketer: { background: 'rgba(79,110,240,0.2)',  color: '#7896f3' },
  social_media_manager: { background: 'rgba(157,23,77,0.18)',  color: '#f472b6' },
  video_editor:         { background: 'rgba(146,96,10,0.18)',  color: '#fbbf24' },
  graphic_designer:     { background: 'rgba(29,78,216,0.18)',  color: '#60a5fa' },
  copywriter:           { background: 'rgba(21,128,61,0.18)',  color: '#4ade80' },
};

function getRoleStyle(role) {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const map = isDark ? ROLE_STYLE_DARK : ROLE_STYLE_LIGHT;
  return map[role] || { background: 'var(--fd-surface-sunken)', color: 'var(--fd-ink-2)' };
}

// Attendance pill shown on each card
function AttPill({ status, unavailable }) {
  if (unavailable) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-gray-100 text-gray-500" title="Couldn't reach attendance data">
        <span className="w-1.5 h-1.5 rounded-full bg-gray-400 inline-block" />
        Unavailable
      </span>
    );
  }
  if (!status) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-gray-100 text-gray-500">
        <span className="w-1.5 h-1.5 rounded-full bg-gray-400 inline-block" />
        Absent
      </span>
    );
  }
  const cfg = {
    present:  { dot: 'bg-emerald-500', bg: 'bg-emerald-50',  text: 'text-emerald-700', label: 'Present'  },
    late:     { dot: 'bg-amber-500',   bg: 'bg-amber-50',    text: 'text-amber-700',   label: 'Late'     },
    on_leave: { dot: 'bg-blue-400',    bg: 'bg-blue-50',     text: 'text-blue-700',    label: 'On Leave' },
    absent:   { dot: 'bg-red-400',     bg: 'bg-red-50',      text: 'text-red-600',     label: 'Absent'   },
    holiday:  { dot: 'bg-violet-400',  bg: 'bg-violet-50',   text: 'text-violet-700',  label: 'Holiday'  },
  }[status] || { dot: 'bg-gray-400', bg: 'bg-gray-100', text: 'text-gray-500', label: status };

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-semibold ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full inline-block ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

// Apply saved order to the team array
function applySavedOrder(team, savedOrder) {
  if (!savedOrder || savedOrder.length === 0) return team;
  const orderMap = new Map(savedOrder.map((id, i) => [id, i]));
  const sorted = [...team].sort((a, b) => {
    const ai = orderMap.has(a._id) ? orderMap.get(a._id) : Infinity;
    const bi = orderMap.has(b._id) ? orderMap.get(b._id) : Infinity;
    return ai - bi;
  });
  return sorted;
}

export default function TeamPage() {
  const { user: currentUser } = useAuthStore();
  const isAdminOrManager = ['admin', 'manager'].includes(currentUser?.role);
  const isAdmin = currentUser?.role === 'admin';

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [todayAtt, setTodayAtt] = useState({});
  const [attLoading, setAttLoading] = useState(false);
  const [attFailed, setAttFailed] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState({
    name: '', email: '', password: '', role: 'copywriter',
    jobTitle: '', department: '', phone: '',
  });

  // Drag state
  const dragItem = useRef(null);
  const dragOverItem = useRef(null);
  const [dragActiveId, setDragActiveId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);

  const load = () => {
    setLoading(true);
    api.get('/users?limit=200').then(r => {
      const rawUsers = r.data.users || [];
      const rawTeam = rawUsers.filter(u => u.role !== 'client');
      // Apply saved order from localStorage
      try {
        const saved = JSON.parse(localStorage.getItem(TEAM_ORDER_KEY) || '[]');
        const ordered = applySavedOrder(rawTeam, saved);
        setUsers(rawUsers.filter(u => u.role === 'client').concat(ordered));
      } catch {
        setUsers(rawUsers);
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  const loadTodayAttendance = () => {
    if (!isAdminOrManager) return;
    setAttLoading(true);
    api.get('/users/attendance-today')
      .then(r => { setTodayAtt(r.data.byEmail || {}); setAttFailed(false); })
      .catch((err) => { console.error('Failed to load today\'s attendance:', err); setAttFailed(true); })
      .finally(() => setAttLoading(false));
  };

  useEffect(() => {
    load();
    loadTodayAttendance();
  }, []);

  const [createError, setCreateError] = useState('');

  const handleCreate = async () => {
    setCreateError('');
    if (!form.name.trim() || !form.email.trim()) {
      setCreateError('Name and email are required.');
      return;
    }
    if (form.password && form.password.length < 8) {
      setCreateError('Password must be at least 8 characters (or leave it blank to use the default).');
      return;
    }
    setSaving(true);
    try {
      await api.post('/users', form);
      setShowModal(false);
      setForm({ name: '', email: '', password: '', role: 'copywriter', jobTitle: '', department: '', phone: '' });
      load();
    } catch (err) {
      setCreateError(err?.response?.data?.message || 'Failed to create team member. Please check the fields and try again.');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (e, id, isActive) => {
    e.preventDefault();
    e.stopPropagation();
    await api.put(`/users/${id}`, { isActive: !isActive });
    setUsers(prev => prev.map(u => u._id === id ? { ...u, isActive: !isActive } : u));
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/users/${deleteTarget._id}`);
      setDeleteTarget(null);
      load();
    } catch (err) {
      alert(err?.response?.data?.message || 'Failed to delete team member');
    } finally {
      setDeleting(false);
    }
  };

  // Drag handlers — only for admin
  const handleDragStart = (e, id) => {
    dragItem.current = id;
    setDragActiveId(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnter = (e, id) => {
    dragOverItem.current = id;
    setDragOverId(id);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, id) => {
    e.preventDefault();
    if (!dragItem.current || dragItem.current === id) return;

    setUsers(prev => {
      const team = prev.filter(u => u.role !== 'client');
      const clients = prev.filter(u => u.role === 'client');
      const fromIdx = team.findIndex(u => u._id === dragItem.current);
      const toIdx = team.findIndex(u => u._id === id);
      if (fromIdx === -1 || toIdx === -1) return prev;
      const reordered = [...team];
      const [moved] = reordered.splice(fromIdx, 1);
      reordered.splice(toIdx, 0, moved);
      // Persist the new order
      try {
        localStorage.setItem(TEAM_ORDER_KEY, JSON.stringify(reordered.map(u => u._id)));
      } catch {}
      return [...clients, ...reordered];
    });

    dragItem.current = null;
    dragOverItem.current = null;
    setDragActiveId(null);
    setDragOverId(null);
  };

  const handleDragEnd = () => {
    setDragActiveId(null);
    setDragOverId(null);
    dragItem.current = null;
    dragOverItem.current = null;
  };

  const team = users.filter(u => u.role !== 'client');

  const presentCount = isAdminOrManager
    ? team.filter(u => {
        const att = todayAtt[u.email?.toLowerCase()];
        return att && (att.status === 'present' || att.status === 'late');
      }).length
    : null;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Team"
        subtitle={
          isAdminOrManager && !attLoading && presentCount !== null
            ? `${team.length} member${team.length !== 1 ? 's' : ''} · ${presentCount} in today`
            : `${team.length} member${team.length !== 1 ? 's' : ''}`
        }
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
        <>
          {isAdmin && (
            <p className="text-[11.5px]" style={{ color: 'var(--fd-ink-5)' }}>
              Drag cards to reorder · order is saved automatically
            </p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {team.map(u => {
              const att = todayAtt[u.email?.toLowerCase()];
              const isDragging = dragActiveId === u._id;
              const isDragOver = dragOverId === u._id && dragActiveId !== u._id;

              return (
                <div
                  key={u._id}
                  draggable={isAdmin}
                  onDragStart={isAdmin ? (e) => handleDragStart(e, u._id) : undefined}
                  onDragEnter={isAdmin ? (e) => handleDragEnter(e, u._id) : undefined}
                  onDragOver={isAdmin ? handleDragOver : undefined}
                  onDrop={isAdmin ? (e) => handleDrop(e, u._id) : undefined}
                  onDragEnd={isAdmin ? handleDragEnd : undefined}
                  style={{
                    opacity: isDragging ? 0.4 : 1,
                    transition: 'opacity 0.15s, transform 0.15s',
                    transform: isDragOver ? 'scale(1.02)' : 'scale(1)',
                    outline: isDragOver ? '2px dashed var(--fd-sidebar-link-active)' : 'none',
                    outlineOffset: '2px',
                    borderRadius: '12px',
                    cursor: isAdmin ? 'grab' : 'default',
                  }}
                >
                  <Link to={`/admin/team/${u._id}`} className="block group"
                    onClick={e => { if (dragItem.current) e.preventDefault(); }}
                    draggable={false}
                  >
                    <div
                      className="fd-card-hover p-5 cursor-pointer transition-all"
                      style={{ opacity: u.isActive ? 1 : 0.55 }}
                    >
                      {/* Header */}
                      <div className="flex items-start gap-3 mb-4">
                        {isAdmin && (
                          <div
                            className="flex-shrink-0 flex items-center self-center"
                            style={{ color: 'var(--fd-ink-5)', marginLeft: '-4px' }}
                            title="Drag to reorder"
                          >
                            <GripVertical size={14} strokeWidth={1.8} />
                          </div>
                        )}
                        {/* Avatar with online-style ring for present */}
                        <div className="relative shrink-0">
                          <Avatar name={u.name} src={u.avatar} size="md" />
                          {isAdminOrManager && att && (att.status === 'present' || att.status === 'late') && (
                            <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[var(--fd-surface)] ${att.status === 'late' ? 'bg-amber-400' : 'bg-emerald-500'}`} />
                          )}
                        </div>
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
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            <span
                              className="inline-flex px-2 py-0.5 rounded-full text-[10.5px] font-semibold"
                              style={getRoleStyle(u.role)}
                            >
                              {ROLE_LABELS[u.role] || u.role}
                            </span>
                            {isAdminOrManager && !attLoading && (
                              <AttPill status={att?.status} unavailable={attFailed} />
                            )}
                          </div>
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
                        {isAdminOrManager && att?.checkInTime && (
                          <div className="text-[11px] font-mono pt-0.5" style={{ color: 'var(--fd-ink-5)' }}>
                            In: {new Date(att.checkInTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                            {att.workHours > 0 && ` · ${att.workHours}h worked`}
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
                        <div className="flex items-center gap-2">
                          {isAdmin && u.role !== 'admin' && (
                            <button
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDeleteTarget(u); }}
                              className="text-[11px] font-medium px-2 py-0.5 rounded-md transition-all hover:opacity-80"
                              style={{ color: '#b91c1c', background: '#fef2f2' }}
                              title="Delete member"
                            >
                              <Trash2 size={11} />
                            </button>
                          )}
                          <button
                            onClick={(e) => toggleActive(e, u._id, u.isActive)}
                            className="text-[11.5px] font-medium px-2 py-0.5 rounded-md transition-all hover:opacity-80"
                            style={u.isActive ? { color: '#b91c1c' } : { color: '#2a7d4f' }}
                          >
                            {u.isActive ? 'Deactivate' : 'Activate'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </Link>
                </div>
              );
            })}
          </div>
        </>
      )}

      <Modal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setCreateError(''); }}
        title="Add Team Member"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => { setShowModal(false); setCreateError(''); }}>Cancel</Button>
            <Button loading={saving} onClick={handleCreate}>Create Member</Button>
          </div>
        }
      >
        <div className="space-y-4">
          {createError && (
            <div className="text-[12.5px] px-3 py-2 rounded-lg" style={{ background: '#fef2f2', color: '#b91c1c' }}>
              {createError}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Input label="Full Name *" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
            <Input label="Email *" type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
          </div>
          <Input label="Password *" type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} placeholder="Min 8 characters" />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Role" value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}>
              {Object.entries(ROLE_LABELS).map(([v, l]) => (<option key={v} value={v}>{l}</option>))}
            </Select>
            <Input label="Job Title" value={form.jobTitle} onChange={e => setForm(p => ({ ...p, jobTitle: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Department" value={form.department} onChange={e => setForm(p => ({ ...p, department: e.target.value }))} />
            <Input label="Phone" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
          </div>
        </div>
      </Modal>

      {/* Delete confirmation modal — admin only */}
      {isAdmin && (
        <Modal
          isOpen={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          title="Delete Team Member"
          footer={
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
              <Button
                loading={deleting}
                onClick={handleDelete}
                style={{ background: '#b91c1c', borderColor: '#b91c1c', color: '#fff' }}
              >
                Delete Member
              </Button>
            </div>
          }
        >
          <div className="space-y-3">
            <p className="text-[13.5px]" style={{ color: 'var(--fd-ink-2)' }}>
              Are you sure you want to permanently delete{' '}
              <span className="font-semibold" style={{ color: 'var(--fd-ink-1)' }}>
                {deleteTarget?.name}
              </span>
              {deleteTarget?.role && (
                <span style={{ color: 'var(--fd-ink-4)' }}> ({ROLE_LABELS[deleteTarget.role] || deleteTarget.role})</span>
              )}
              ? This action cannot be undone.
            </p>
            <p className="text-[12px] px-3 py-2 rounded-lg" style={{ background: '#fef2f2', color: '#b91c1c' }}>
              The account will be permanently removed. Consider deactivating instead to preserve history.
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}