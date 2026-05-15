import React, { useState, useRef } from 'react';
import {
  User, Lock, Bell, Palette, Camera, Save, Eye, EyeOff,
  Sun, Moon, CheckCircle,
} from 'lucide-react';
import useAuthStore from '../../context/authStore';
import { useTheme } from '../../context/ThemeContext';
import { useToast } from '../../components/ui/index';
import { Button, Input, Tabs } from '../../components/ui/index';
import api from '../../lib/api';

const ROLE_LABELS = {
  admin: 'Admin', manager: 'Project Manager',
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

  return (
    <div className="space-y-4">
      <Section title="Personal Information" description="Update your name, phone and role details.">
        {/* Avatar display */}
        <div className="flex items-center gap-4 mb-5">
          <Avatar name={user?.name} src={user?.avatar} size={64} />
          <div>
            <div className="text-[13px] font-medium" style={{ color: 'var(--fd-ink-1)' }}>{user?.name}</div>
            <div className="text-[12px]" style={{ color: 'var(--fd-ink-4)' }}>
              {ROLE_LABELS[user?.role] || user?.role} · {user?.email}
            </div>
            <p className="text-[11px] mt-1" style={{ color: 'var(--fd-ink-5)' }}>
              To change your avatar, contact your administrator.
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

// ── Root ──────────────────────────────────────────────────────────────────────
const TABS = [
  { value: 'profile',    label: 'Profile',    icon: User },
  { value: 'security',   label: 'Security',   icon: Lock },
  { value: 'appearance', label: 'Appearance', icon: Palette },
];

export default function SettingsPage() {
  const { user, updateUser } = useAuthStore();
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
      <div className="flex items-center gap-1">
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
    </div>
  );
}
