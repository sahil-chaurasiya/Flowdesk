import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, ArrowRight } from 'lucide-react';
import useAuthStore from '../../context/authStore';

const DEMO_ACCOUNTS = [
  { role: 'Project Manager',        email: 'manager@toflymedia.com',  pw: 'Manager123!',    accent: '#3a56d4' },
  { role: 'Performance Marketer',   email: 'marketer@toflymedia.com', pw: 'Marketer123!',   accent: '#92600a' },
  { role: 'Video Editor',           email: 'editor@toflymedia.com',   pw: 'Video123!',      accent: '#7e22ce' },
  { role: 'Client',                 email: 'client@toflymedia.com',   pw: 'Client123!',     accent: '#2a7d4f' },
];

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuthStore();
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email || !form.password) { setError('Please enter your email and password.'); return; }
    setLoading(true);
    setError('');
    try {
      const user = await login(form.email, form.password);
      navigate(user?.role === 'client' ? '/portal/dashboard' : '/admin/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex" style={{ background: '#f7f6f3' }}>

      {/* ── Left — Brand panel ─────────────────────────────────────────── */}
      <div
        className="hidden lg:flex lg:w-[52%] xl:w-[55%] flex-col justify-between p-14 xl:p-16 relative overflow-hidden"
        style={{ background: '#1a1916' }}
      >
        {/* Subtle grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              'linear-gradient(#ffffff 1px, transparent 1px), linear-gradient(90deg, #ffffff 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />

        {/* Top — Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ background: '#4f6ef0', boxShadow: '0 2px 8px rgba(79,110,240,0.4)' }}
          >
            <svg width="15" height="15" viewBox="0 0 14 14" fill="none">
              <path d="M2.5 11L7 3L11.5 11" stroke="white" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M4.5 8H9.5" stroke="white" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
          </div>
          <span
            className="text-[15px] font-semibold tracking-[-0.01em]"
            style={{ color: '#f7f6f3' }}
          >
            Flowdesk
          </span>
        </div>

        {/* Middle — Hero */}
        <div className="relative z-10 max-w-[480px]">
          {/* Eyebrow */}
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-8 text-[11px] font-medium"
            style={{
              background: 'rgba(79,110,240,0.15)',
              border: '1px solid rgba(79,110,240,0.25)',
              color: '#a0b8f8',
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#7896f3]" />
            Agency Operations Platform
          </div>

          <h1
            className="text-[42px] xl:text-[50px] font-bold leading-[1.08] tracking-[-0.03em] mb-5"
            style={{ color: '#f7f6f3' }}
          >
            Operate with<br />
            <span style={{ color: '#7896f3' }}>clarity.</span>
          </h1>

          <p className="text-[15px] leading-[1.7]" style={{ color: '#7a7770' }}>
            One platform for campaigns, clients, content,
            and delivery. Built for agencies that run on process.
          </p>

          {/* Feature list */}
          <div className="mt-10 space-y-3">
            {[
              'Real-time client collaboration',
              'Task and project management',
              'Lead tracking and pipeline',
              'Social media content delivery',
              'Analytics and reporting',
            ].map(f => (
              <div key={f} className="flex items-center gap-3">
                <div className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(79,110,240,0.2)' }}>
                  <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                    <path d="M1.5 4L3.5 6L6.5 2" stroke="#7896f3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <span className="text-[13px]" style={{ color: '#5a5752' }}>{f}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom */}
        <div className="relative z-10">
          <p className="text-[11px]" style={{ color: '#3a3835' }}>
            © {new Date().getFullYear()} To Fly Media. All rights reserved.
          </p>
        </div>
      </div>

      {/* ── Right — Sign in form ────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col justify-center px-6 sm:px-12 lg:px-16 xl:px-20 py-12">

        {/* Mobile logo */}
        <div className="flex items-center gap-2.5 mb-10 lg:hidden">
          <div className="w-8 h-8 rounded-lg bg-[#4f6ef0] flex items-center justify-center">
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
              <path d="M2.5 11L7 3L11.5 11" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span className="text-[14px] font-semibold" style={{ color: '#1a1916' }}>Flowdesk</span>
        </div>

        <div className="w-full max-w-[360px] mx-auto">

          {/* Heading */}
          <div className="mb-8">
            <h2
              className="text-[26px] font-bold tracking-[-0.02em]"
              style={{ color: '#1a1916' }}
            >
              Sign in
            </h2>
            <p className="text-[13px] mt-1.5" style={{ color: '#7a7770' }}>
              Access your workspace
            </p>
          </div>

          {/* Error */}
          {error && (
            <div
              className="flex items-center gap-2.5 px-4 py-3 rounded-lg mb-4 text-[12.5px]"
              style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c' }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="flex-shrink-0">
                <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M7 4v3.5M7 9.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-[12px] font-medium" style={{ color: '#44423d' }}>
                Email address
              </label>
              <input
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                placeholder="you@toflymedia.com"
                className="fd-input"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[12px] font-medium" style={{ color: '#44423d' }}>
                Password
              </label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={form.password}
                  onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                  placeholder="••••••••"
                  className="fd-input pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPw(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                  style={{ color: '#a8a49e' }}
                >
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full mt-2"
              style={{ padding: '11px 20px', fontSize: '13.5px' }}
            >
              {loading ? (
                <div
                  className="w-4 h-4 rounded-full animate-spin"
                  style={{ border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#ffffff' }}
                />
              ) : (
                <>Continue <ArrowRight size={14} /></>
              )}
            </button>
          </form>

          {/* Demo accounts */}
          <div className="mt-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px" style={{ background: '#eeece8' }} />
              <span className="text-[11px] font-medium" style={{ color: '#a8a49e' }}>Demo accounts</span>
              <div className="flex-1 h-px" style={{ background: '#eeece8' }} />
            </div>

            <div
              className="rounded-xl overflow-hidden"
              style={{ border: '1px solid #e8e5e0' }}
            >
              {DEMO_ACCOUNTS.map((d, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setForm({ email: d.email, password: d.pw })}
                  className="w-full flex items-center justify-between px-4 py-3 text-left transition-colors group"
                  style={{
                    borderBottom: i < DEMO_ACCOUNTS.length - 1 ? '1px solid #f2f0ec' : 'none',
                    background: 'transparent',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#fafaf9'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div>
                    <div
                      className="text-[11.5px] font-semibold"
                      style={{ color: d.accent }}
                    >
                      {d.role}
                    </div>
                    <div className="text-[11px] font-mono mt-0.5" style={{ color: '#a8a49e' }}>
                      {d.email}
                    </div>
                  </div>
                  <ArrowRight size={12} color="#ccc9c2" />
                </button>
              ))}
              <div
                className="px-4 py-2 flex items-center gap-1.5"
                style={{ background: '#fafaf9', borderTop: '1px solid #f2f0ec' }}
              >
                <span className="text-[10.5px]" style={{ color: '#a8a49e' }}>All passwords:</span>
                <code className="text-[10.5px] font-mono" style={{ color: '#7a7770' }}>*Role*123!</code>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
