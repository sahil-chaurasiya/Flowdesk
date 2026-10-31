import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import toast from 'react-hot-toast';
import Spinner from '../../components/common/Spinner';

export default function EmployeeProfile() {
  const { user, logout, updateUser } = useAuth();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: user?.name || '', phone: user?.phone || '', department: user?.department || '' });
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [changingPw, setChangingPw] = useState(false);
  const [savingPw, setSavingPw] = useState(false);

  const handleLogout = () => { logout(); navigate('/login'); };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const { data } = await api.put('/auth/profile', form);
      updateUser(data.user);
      toast.success('Profile updated!');
      setEditing(false);
    } catch (err) { toast.error(err.response?.data?.message || 'Update failed'); }
    finally { setSaving(false); }
  };

  const handleChangePassword = async () => {
    if (pwForm.newPassword !== pwForm.confirmPassword) { toast.error('Passwords do not match'); return; }
    if (pwForm.newPassword.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    setSavingPw(true);
    try {
      await api.put('/auth/change-password', { currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword });
      toast.success('Password changed successfully!');
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setChangingPw(false);
    } catch (err) { toast.error(err.response?.data?.message || 'Password change failed'); }
    finally { setSavingPw(false); }
  };

  const initials = user?.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className="min-h-full bg-surface px-4 pt-6 pb-8 max-w-md mx-auto space-y-4 animate-fade-in">
      <h1 className="page-title animate-slide-up">Profile</h1>

      {/* Avatar card */}
      <div
        className="rounded-2xl p-6 text-center relative overflow-hidden animate-slide-up"
        style={{
          background: 'var(--fd-card-bg)',
          
          border: '1px solid var(--fd-border)',
          animationDelay: '0.05s',
        }}
      >
        <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-white/8 to-transparent" />

        {/* Avatar */}
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-display font-bold text-black"
          style={{
            background: 'linear-gradient(135deg, var(--fd-accent), var(--fd-accent-hover))',
            boxShadow: '0 0 0 4px rgba(var(--fd-accent-rgb),0.1), 0 0 0 8px rgba(var(--fd-accent-rgb),0.04)',
          }}
        >
          {initials}
        </div>

        <h2 className="font-display font-bold text-xl text-white">{user?.name}</h2>
        <p className="text-gray-600 text-sm mt-0.5">{user?.email}</p>

        <div className="flex items-center justify-center gap-2 mt-3 flex-wrap">
          <span
            className="px-2.5 py-1 rounded-full text-xs font-medium"
            style={{
              background: 'rgba(var(--fd-accent-rgb),0.08)',
              border: '1px solid rgba(var(--fd-accent-rgb),0.2)',
              color: 'var(--fd-accent)',
            }}
          >
            {user?.role === 'admin' ? '⚡ Admin' : '👤 Employee'}
          </span>
          {user?.department && (
            <span
              className="px-2.5 py-1 rounded-full text-xs font-medium"
              style={{ background: 'var(--fd-border)', border: '1px solid var(--fd-border)', color: 'var(--fd-ink-3)' }}
            >
              {user.department}
            </span>
          )}
        </div>
      </div>

      {/* Personal info card */}
      <div
        className="rounded-2xl p-5 space-y-4 animate-slide-up"
        style={{
          background: 'var(--fd-card-bg)',
          
          border: '1px solid var(--fd-border)',
          animationDelay: '0.08s',
        }}
      >
        <div className="flex items-center justify-between">
          <p className="section-title">Personal Info</p>
          <button
            onClick={() => setEditing(!editing)}
            className="text-xs font-medium transition-colors px-3 py-1.5 rounded-lg"
            style={{ color: editing ? 'var(--fd-ink-3)' : 'var(--fd-accent)', background: editing ? 'var(--fd-border)' : 'rgba(var(--fd-accent-rgb),0.08)' }}
          >
            {editing ? 'Cancel' : 'Edit'}
          </button>
        </div>

        {editing ? (
          <div className="space-y-3">
            <div>
              <label className="label block mb-1.5">Full Name</label>
              <input className="input" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
            </div>
            <div>
              <label className="label block mb-1.5">Phone</label>
              <input className="input" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} placeholder="+91 98765 43210" />
            </div>
            <div>
              <label className="label block mb-1.5">Department</label>
              <input className="input" value={form.department} onChange={e => setForm({...form, department: e.target.value})} placeholder="Engineering" />
            </div>
            <button onClick={handleSaveProfile} disabled={saving} className="btn-primary w-full flex items-center justify-center gap-2">
              {saving ? <><Spinner size="sm" className="text-black" /> Saving…</> : 'Save Changes'}
            </button>
          </div>
        ) : (
          <div className="space-y-0.5">
            {[['Name', user?.name], ['Email', user?.email], ['Phone', user?.phone || '—'], ['Department', user?.department || '—']].map(([k, v]) => (
              <div
                key={k}
                className="flex justify-between items-center py-2.5"
                style={{ borderBottom: '1px solid var(--fd-border)' }}
              >
                <span className="text-sm text-gray-600">{k}</span>
                <span className="text-sm text-gray-200 font-medium">{v}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Security card */}
      <div
        className="rounded-2xl p-5 space-y-4 animate-slide-up"
        style={{
          background: 'var(--fd-card-bg)',
          
          border: '1px solid var(--fd-border)',
          animationDelay: '0.11s',
        }}
      >
        <div className="flex items-center justify-between">
          <p className="section-title">Security</p>
          <button
            onClick={() => setChangingPw(!changingPw)}
            className="text-xs font-medium transition-colors px-3 py-1.5 rounded-lg"
            style={{ color: changingPw ? 'var(--fd-ink-3)' : 'var(--fd-accent)', background: changingPw ? 'var(--fd-border)' : 'rgba(var(--fd-accent-rgb),0.08)' }}
          >
            {changingPw ? 'Cancel' : 'Change Password'}
          </button>
        </div>

        {changingPw && (
          <div className="space-y-3 animate-slide-up">
            <div>
              <label className="label block mb-1.5">Current Password</label>
              <input type="password" className="input" value={pwForm.currentPassword} onChange={e => setPwForm({...pwForm, currentPassword: e.target.value})} />
            </div>
            <div>
              <label className="label block mb-1.5">New Password</label>
              <input type="password" className="input" value={pwForm.newPassword} onChange={e => setPwForm({...pwForm, newPassword: e.target.value})} />
            </div>
            <div>
              <label className="label block mb-1.5">Confirm New Password</label>
              <input type="password" className="input" value={pwForm.confirmPassword} onChange={e => setPwForm({...pwForm, confirmPassword: e.target.value})} />
            </div>
            <button onClick={handleChangePassword} disabled={savingPw} className="btn-primary w-full flex items-center justify-center gap-2">
              {savingPw ? <><Spinner size="sm" className="text-black" /> Saving…</> : 'Update Password'}
            </button>
          </div>
        )}
      </div>

      {/* Sign out */}
      <button
        onClick={handleLogout}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all duration-200 animate-fade-in"
        style={{
          background: 'rgba(248,113,113,0.06)',
          border: '1px solid rgba(248,113,113,0.15)',
          color: '#f87171',
          animationDelay: '0.14s',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(248,113,113,0.1)'; e.currentTarget.style.borderColor = 'rgba(248,113,113,0.25)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(248,113,113,0.06)'; e.currentTarget.style.borderColor = 'rgba(248,113,113,0.15)'; }}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
        </svg>
        Sign Out
      </button>

      <p className="text-center text-[10px] text-gray-700 font-mono pb-2">Office Attendance v1.0.0</p>
    </div>
  );
}
