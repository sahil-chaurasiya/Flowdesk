import React, { useState } from 'react';
import {
  User, Lock, Bell, Palette, Camera, Save, Eye, EyeOff,
  Sun, Moon, CheckCircle, Layers, Plus, Pencil, Trash2, X, Check,
} from 'lucide-react';
import useAuthStore from '../../context/authStore';
import { useTheme } from '../../context/ThemeContext';
import { useToast } from '../../components/ui/index';
import { Button, Input } from '../../components/ui/index';
import api from '../../lib/api';
import PaymentSettingsSection from '../../components/contract/PaymentSettingsSection';
import { useServices, bustServicesCache } from '../../hooks/useServices';

const ROLE_LABELS = {
  admin: 'Admin', manager: 'Project Manager',
  developer: 'Software Developer',
  performance_marketer: 'Performance Marketer',
  social_media_manager: 'Social Media Manager',
  video_editor: 'Video Editor', graphic_designer: 'Graphic Designer',
  copywriter: 'Copywriter', client: 'Client',
};

function Avatar({ name, src, size = 80 }) {
  const initials = name
    ? name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : '?';
  if (src) {
    return (
      <img
        src={src} alt={name}
        className="rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="rounded-full flex items-center justify-center font-bold flex-shrink-0"
      style={{
        width: size, height: size,
        fontSize: size * 0.3,
        background: 'var(--fd-sidebar-active)',
        color: 'var(--fd-sidebar-link-active)',
      }}
    >
      {initials}
    </div>
  );
}

function Section({ title, description, children }) {
  return (
    <div
      className="rounded-xl p-5"
      style={{
        background: 'var(--fd-surface)',
        border: '1px solid var(--fd-border)',
      }}
    >
      <div className="mb-4">
        <h3 className="text-[14px] font-semibold" style={{ color: 'var(--fd-ink-1)' }}>{title}</h3>
        {description && (
          <p className="text-[12px] mt-0.5" style={{ color: 'var(--fd-ink-4)' }}>{description}</p>
        )}
      </div>
      {children}
    </div>
  );
}

// ── Profile Tab ───────────────────────────────────────────────────────────────
function ProfileTab({ user, onUpdate }) {
  const toast = useToast();
  const [form, setForm] = useState({
    name:       user?.name        || '',
    phone:      user?.phone       || '',
    jobTitle:   user?.jobTitle    || '',
    department: user?.department  || '',
  });
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = React.useRef(null);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data } = await api.put('/auth/profile', form);
      onUpdate(data.user);
      toast({ type: 'success', title: 'Profile updated', message: 'Your details have been saved.' });
    } catch (err) {
      toast({ type: 'error', title: 'Save failed', message: err?.response?.data?.message || 'Something went wrong.' });
    } finally { setSaving(false); }
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const fd = new FormData();
      fd.append('avatar', file);
      const { data } = await api.post('/auth/avatar', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onUpdate({ avatar: data.avatar });
      toast({ type: 'success', title: 'Photo updated', message: 'Your profile photo has been saved.' });
    } catch (err) {
      toast({ type: 'error', title: 'Upload failed', message: err?.response?.data?.message || 'Could not upload photo.' });
    } finally {
      setUploadingAvatar(false);
      e.target.value = '';
    }
  };

  return (
    <div className="space-y-4">
      <Section title="Personal Information" description="Update your name, phone and role details.">
        {/* Avatar upload */}
        <div className="flex items-center gap-4 mb-5">
          <div className="relative group cursor-pointer" onClick={() => avatarInputRef.current?.click()}>
            <Avatar name={user?.name} src={user?.avatar} size={64} />
            <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              {uploadingAvatar
                ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <Camera size={16} color="white" />}
            </div>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={handleAvatarChange}
            />
          </div>
          <div>
            <div className="text-[13px] font-medium" style={{ color: 'var(--fd-ink-1)' }}>{user?.name}</div>
            <div className="text-[12px]" style={{ color: 'var(--fd-ink-4)' }}>
              {ROLE_LABELS[user?.role] || user?.role} · {user?.email}
            </div>
            <p className="text-[11px] mt-1" style={{ color: 'var(--fd-ink-5)' }}>
              Click your photo to upload a new one.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Full name"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          />
          <Input
            label="Phone"
            value={form.phone}
            onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
            placeholder="+1 555 000 0000"
          />
          <Input
            label="Job title"
            value={form.jobTitle}
            onChange={e => setForm(f => ({ ...f, jobTitle: e.target.value }))}
            placeholder="e.g. Performance Marketer"
          />
          <Input
            label="Department"
            value={form.department}
            onChange={e => setForm(f => ({ ...f, department: e.target.value }))}
            placeholder="e.g. Growth"
          />
        </div>

        <div className="mt-5 flex justify-end">
          <Button onClick={handleSave} loading={saving} size="sm">
            <Save size={13} />
            Save changes
          </Button>
        </div>
      </Section>

      <Section title="Account" description="Read-only account metadata.">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[13px]">
          {[
            { label: 'Email',       value: user?.email },
            { label: 'Role',        value: ROLE_LABELS[user?.role] },
            { label: 'Member since', value: user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '—' },
            { label: 'Last login',  value: user?.lastLogin  ? new Date(user.lastLogin).toLocaleString()  : 'Never' },
          ].map(item => (
            <div key={item.label}>
              <div className="text-[11px] font-medium mb-0.5" style={{ color: 'var(--fd-ink-4)' }}>{item.label}</div>
              <div style={{ color: 'var(--fd-ink-2)' }}>{item.value}</div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

// ── Security Tab ──────────────────────────────────────────────────────────────
function SecurityTab() {
  const toast = useToast();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [show, setShow] = useState({ current: false, new: false, confirm: false });
  const [saving, setSaving] = useState(false);

  const requirements = [
    { label: 'At least 8 characters', met: form.newPassword.length >= 8 },
    { label: 'Passwords match',        met: form.newPassword && form.newPassword === form.confirmPassword },
  ];

  const handleSave = async () => {
    if (!requirements.every(r => r.met)) return;
    setSaving(true);
    try {
      await api.put('/auth/change-password', {
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      toast({ type: 'success', title: 'Password changed', message: 'Your new password is active.' });
    } catch (err) {
      toast({ type: 'error', title: 'Failed', message: err?.response?.data?.message || 'Something went wrong.' });
    } finally { setSaving(false); }
  };

  const EyeBtn = ({ field }) => (
    <button
      type="button"
      onClick={() => setShow(s => ({ ...s, [field]: !s[field] }))}
      className="absolute right-3 top-1/2 -translate-y-1/2"
      style={{ color: 'var(--fd-ink-4)' }}
    >
      {show[field] ? <EyeOff size={14} /> : <Eye size={14} />}
    </button>
  );

  return (
    <div className="space-y-4">
      <Section title="Change password" description="Use a strong password you don't use elsewhere.">
        <div className="space-y-4 max-w-sm">
          {[
            { key: 'currentPassword', label: 'Current password', field: 'current' },
            { key: 'newPassword',     label: 'New password',     field: 'new' },
            { key: 'confirmPassword', label: 'Confirm new password', field: 'confirm' },
          ].map(({ key, label, field }) => (
            <div key={key} className="relative">
              <Input
                label={label}
                type={show[field] ? 'text' : 'password'}
                value={form[key]}
                onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                autoComplete={key === 'currentPassword' ? 'current-password' : 'new-password'}
              />
              <EyeBtn field={field} />
            </div>
          ))}

          {form.newPassword && (
            <div className="space-y-1.5">
              {requirements.map(r => (
                <div key={r.label} className="flex items-center gap-2 text-[12px]">
                  <CheckCircle
                    size={13}
                    style={{ color: r.met ? '#22c55e' : 'var(--fd-ink-5)' }}
                  />
                  <span style={{ color: r.met ? '#22c55e' : 'var(--fd-ink-4)' }}>{r.label}</span>
                </div>
              ))}
            </div>
          )}

          <Button
            onClick={handleSave}
            loading={saving}
            disabled={!requirements.every(r => r.met) || !form.currentPassword}
            size="sm"
          >
            <Lock size={13} />
            Update password
          </Button>
        </div>
      </Section>
    </div>
  );
}

// ── Appearance Tab ────────────────────────────────────────────────────────────
function AppearanceTab() {
  const { isDark, toggleTheme } = useTheme();

  const themes = [
    { id: 'light', label: 'Light', icon: Sun,  desc: 'Clean light interface' },
    { id: 'dark',  label: 'Dark',  icon: Moon, desc: 'Easy on the eyes at night' },
  ];

  return (
    <div className="space-y-4">
      <Section title="Theme" description="Choose your preferred colour scheme.">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-sm">
          {themes.map(({ id, label, icon: Icon, desc }) => {
            const active = (id === 'dark') === isDark;
            return (
              <button
                key={id}
                onClick={() => { if ((id === 'dark') !== isDark) toggleTheme(); }}
                className="relative rounded-xl p-4 text-left transition-all"
                style={{
                  background: active ? 'var(--fd-sidebar-active)' : 'var(--fd-surface-sunken)',
                  border: active ? '2px solid var(--fd-sidebar-link-active)' : '2px solid transparent',
                }}
              >
                <Icon size={18} style={{ color: active ? 'var(--fd-sidebar-link-active)' : 'var(--fd-ink-3)' }} />
                <div className="mt-2 text-[13px] font-medium" style={{ color: 'var(--fd-ink-1)' }}>{label}</div>
                <div className="text-[11px]" style={{ color: 'var(--fd-ink-4)' }}>{desc}</div>
                {active && (
                  <div
                    className="absolute top-2 right-2 w-2 h-2 rounded-full"
                    style={{ background: 'var(--fd-sidebar-link-active)' }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </Section>
    </div>
  );
}

// ── Services Tab ──────────────────────────────────────────────────────────────
const EMPTY_FORM = { key: '', label: '', description: '', isActive: true };

function keyFromLabel(label) {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '_');
}

function ServiceRow({ service, onEdit, onDelete }) {
  const [confirming, setConfirming] = useState(false);

  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-lg"
      style={{ background: 'var(--fd-surface-sunken)', border: '1px solid var(--fd-border)' }}
    >
      {/* Active indicator */}
      <span
        className="w-2 h-2 rounded-full flex-shrink-0"
        style={{ background: service.isActive ? '#22c55e' : 'var(--fd-ink-5)' }}
      />

      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium truncate" style={{ color: 'var(--fd-ink-1)' }}>
          {service.label}
        </div>
        <div className="text-[11px] font-mono" style={{ color: 'var(--fd-ink-4)' }}>
          {service.key}
        </div>
        {service.description && (
          <div className="text-[11px] mt-0.5 truncate" style={{ color: 'var(--fd-ink-4)' }}>
            {service.description}
          </div>
        )}
      </div>

      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={() => onEdit(service)}
          className="p-1.5 rounded-md transition-colors hover:bg-[var(--fd-sidebar-active)]"
          style={{ color: 'var(--fd-ink-3)' }}
          title="Edit"
        >
          <Pencil size={13} />
        </button>

        {confirming ? (
          <div className="flex items-center gap-1">
            <button
              onClick={() => { onDelete(service._id); setConfirming(false); }}
              className="p-1.5 rounded-md transition-colors"
              style={{ color: '#ef4444', background: '#fef2f2' }}
              title="Confirm delete"
            >
              <Check size={13} />
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="p-1.5 rounded-md transition-colors hover:bg-[var(--fd-sidebar-active)]"
              style={{ color: 'var(--fd-ink-3)' }}
              title="Cancel"
            >
              <X size={13} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            className="p-1.5 rounded-md transition-colors hover:bg-red-50"
            style={{ color: 'var(--fd-ink-3)' }}
            title="Delete"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>
    </div>
  );
}

function ServicesTab() {
  const toast = useToast();
  const { services, loading, reload } = useServices();

  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState(null); // service object when editing
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [keyTouched, setKeyTouched] = useState(false);

  const openAdd = () => {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setKeyTouched(false);
    setShowForm(true);
  };

  const openEdit = (service) => {
    setEditTarget(service);
    setForm({
      key: service.key,
      label: service.label,
      description: service.description || '',
      isActive: service.isActive,
    });
    setKeyTouched(true); // don't auto-derive key when editing
    setShowForm(true);
  };

  const handleLabelChange = (val) => {
    setForm(f => ({
      ...f,
      label: val,
      key: keyTouched ? f.key : keyFromLabel(val),
    }));
  };

  const handleSubmit = async () => {
    if (!form.label.trim() || !form.key.trim()) {
      toast({ type: 'error', title: 'Validation', message: 'Label and key are required.' });
      return;
    }
    setSaving(true);
    try {
      if (editTarget) {
        await api.put(`/services/${editTarget._id}`, {
          label: form.label.trim(),
          description: form.description.trim(),
          isActive: form.isActive,
        });
        toast({ type: 'success', title: 'Service updated' });
      } else {
        await api.post('/services', {
          key: form.key.trim(),
          label: form.label.trim(),
          description: form.description.trim(),
          isActive: form.isActive,
        });
        toast({ type: 'success', title: 'Service created' });
      }
      bustServicesCache();
      reload();
      setShowForm(false);
    } catch (err) {
      toast({
        type: 'error',
        title: 'Save failed',
        message: err?.response?.data?.message || 'Something went wrong.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/services/${id}`);
      toast({ type: 'success', title: 'Service deleted' });
      bustServicesCache();
      reload();
    } catch (err) {
      toast({
        type: 'error',
        title: 'Delete failed',
        message: err?.response?.data?.message || 'Something went wrong.',
      });
    }
  };

  return (
    <div className="space-y-4">
      <Section
        title="Services"
        description="Manage the services your agency offers. These appear in client forms and filters."
      >
        {/* Toolbar */}
        <div className="flex justify-between items-center mb-3">
          <span className="text-[12px]" style={{ color: 'var(--fd-ink-4)' }}>
            {services.length} service{services.length !== 1 ? 's' : ''}
          </span>
          <Button size="sm" onClick={openAdd}>
            <Plus size={13} />
            Add service
          </Button>
        </div>

        {/* Inline form */}
        {showForm && (
          <div
            className="rounded-xl p-4 mb-3 space-y-3"
            style={{
              background: 'var(--fd-surface-sunken)',
              border: '1px solid var(--fd-sidebar-link-active)',
            }}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[13px] font-semibold" style={{ color: 'var(--fd-ink-1)' }}>
                {editTarget ? 'Edit service' : 'New service'}
              </span>
              <button
                onClick={() => setShowForm(false)}
                className="p-1 rounded-md"
                style={{ color: 'var(--fd-ink-4)' }}
              >
                <X size={14} />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Label *"
                value={form.label}
                onChange={e => handleLabelChange(e.target.value)}
                placeholder="e.g. Email Marketing"
              />
              <div>
                <Input
                  label="Key *"
                  value={form.key}
                  onChange={e => { setKeyTouched(true); setForm(f => ({ ...f, key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })); }}
                  placeholder="e.g. email_marketing"
                  disabled={!!editTarget} // key is immutable after creation
                />
                {!editTarget && (
                  <p className="text-[10px] mt-0.5" style={{ color: 'var(--fd-ink-5)' }}>
                    Auto-generated · lowercase, underscores only · cannot be changed later
                  </p>
                )}
              </div>
            </div>

            <Input
              label="Description"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Short description (optional)"
            />

            {/* Active toggle */}
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, isActive: !f.isActive }))}
                className="relative w-8 h-4 rounded-full transition-colors flex-shrink-0"
                style={{
                  background: form.isActive ? 'var(--fd-sidebar-link-active)' : 'var(--fd-border)',
                }}
              >
                <span
                  className="absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform"
                  style={{ left: form.isActive ? '17px' : '2px' }}
                />
              </button>
              <span className="text-[12px]" style={{ color: 'var(--fd-ink-3)' }}>
                {form.isActive ? 'Active' : 'Inactive'}
              </span>
            </label>

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button size="sm" loading={saving} onClick={handleSubmit}>
                <Save size={13} />
                {editTarget ? 'Save changes' : 'Create service'}
              </Button>
            </div>
          </div>
        )}

        {/* List */}
        {loading ? (
          <div className="text-[13px] py-6 text-center" style={{ color: 'var(--fd-ink-4)' }}>
            Loading services…
          </div>
        ) : services.length === 0 ? (
          <div className="text-[13px] py-8 text-center" style={{ color: 'var(--fd-ink-4)' }}>
            No services yet. Click <strong>Add service</strong> to get started.
          </div>
        ) : (
          <div className="space-y-2">
            {services.map(s => (
              <ServiceRow
                key={s._id}
                service={s}
                onEdit={openEdit}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const { user, updateUser } = useAuthStore();

  const canManageServices = ['admin', 'manager'].includes(user?.role);

  const TABS = [
    { value: 'profile',    label: 'Profile',    icon: User },
    { value: 'security',   label: 'Security',   icon: Lock },
    { value: 'appearance', label: 'Appearance', icon: Palette },
    ...(canManageServices
      ? [{ value: 'services', label: 'Services', icon: Layers }]
      : []),
    ...(user?.role === 'admin'
      ? [{ value: 'payment', label: 'Payment Settings', icon: Save }]
      : []),
  ];

  const [tab, setTab] = useState('profile');

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-[22px] font-bold tracking-[-0.02em]" style={{ color: 'var(--fd-ink-1)' }}>
          Settings
        </h1>
        <p className="text-[13px] mt-1" style={{ color: 'var(--fd-ink-4)' }}>
          Manage your account preferences and security settings.
        </p>
      </div>

      {/* Tab pills */}
      <div className="flex items-center gap-1 flex-wrap">
        {TABS.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            onClick={() => setTab(value)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[12.5px] font-medium transition-all"
            style={
              tab === value
                ? { background: 'var(--fd-sidebar-active)', color: 'var(--fd-sidebar-link-active)' }
                : { color: 'var(--fd-ink-3)' }
            }
          >
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === 'profile'    && <ProfileTab    user={user} onUpdate={updateUser} />}
      {tab === 'security'   && <SecurityTab   />}
      {tab === 'appearance' && <AppearanceTab />}
      {tab === 'services'   && canManageServices && <ServicesTab />}
      {tab === 'payment'    && user?.role === 'admin' && <PaymentSettingsSection />}
    </div>
  );
}