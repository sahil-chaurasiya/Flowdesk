import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, ArrowRight, Zap } from 'lucide-react';
import useAuthStore from '../../context/authStore';

const DEMO_ACCOUNTS = [
  { role: 'Project Manager',      email: 'manager@toflymedia.com',  pw: 'Manager123!',   accent: '#6e8ef5', bg: 'rgba(110,142,245,0.08)',  border: 'rgba(110,142,245,0.2)'  },
  { role: 'Performance Marketer', email: 'marketer@toflymedia.com', pw: 'Marketer123!',  accent: '#f5a623', bg: 'rgba(245,166,35,0.08)',   border: 'rgba(245,166,35,0.2)'   },
  { role: 'Video Editor',         email: 'editor@toflymedia.com',   pw: 'Editor123!',     accent: '#b06ef5', bg: 'rgba(176,110,245,0.08)',  border: 'rgba(176,110,245,0.2)'  },
  { role: 'Client',               email: 'client@toflymedia.com',   pw: 'Client123!',    accent: '#3ec99a', bg: 'rgba(62,201,154,0.08)',   border: 'rgba(62,201,154,0.2)'   },
];

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuthStore();
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeDemo, setActiveDemo] = useState(null);

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

  const handleDemo = (d, i) => {
    setActiveDemo(i);
    setForm({ email: d.email, password: d.pw });
    setError('');
  };

  return (
    <>
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse-ring {
          0%   { box-shadow: 0 0 0 0 rgba(110,142,245,0.5); }
          70%  { box-shadow: 0 0 0 8px rgba(110,142,245,0); }
          100% { box-shadow: 0 0 0 0 rgba(110,142,245,0);  }
        }
        .lp-wrap       { animation: fadeUp 0.4s cubic-bezier(.22,.68,0,1.2) both; }
        .lp-card       { animation: fadeUp 0.4s cubic-bezier(.22,.68,0,1.2) 0.06s both; }
        .lp-demo       { animation: fadeUp 0.4s cubic-bezier(.22,.68,0,1.2) 0.12s both; }
        .logo-pulse    { animation: pulse-ring 2.4s ease-in-out infinite; }
        .demo-btn .arr { transition: transform 0.15s ease; }
        .demo-btn:hover .arr { transform: translateX(3px); }
        .fd-input-lg {
          width: 100%;
          background: var(--fd-input-bg);
          border: 1px solid var(--fd-input-border);
          border-radius: 10px;
          padding: 11px 14px;
          font-size: 0.875rem;
          font-family: 'Geist', system-ui, sans-serif;
          color: var(--fd-input-text);
          transition: border-color 0.15s, box-shadow 0.15s;
          outline: none;
          box-sizing: border-box;
        }
        .fd-input-lg::placeholder { color: var(--fd-input-placeholder); }
        .fd-input-lg:focus {
          border-color: #7896f3;
          box-shadow: 0 0 0 3px rgba(79,110,240,0.15);
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { animation: spin 0.7s linear infinite; }
      `}</style>

      <div className="lp-wrap" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '10px' }}>

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '2px' }}>
          <div
            className="logo-pulse"
            style={{
              width: '34px', height: '34px', borderRadius: '9px',
              background: 'linear-gradient(135deg, #4f6ef0 0%, #7896f3 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2.5 11L7 3L11.5 11" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M4.5 8H9.5" stroke="white" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
          </div>
          <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--fd-ink-1)', letterSpacing: '-0.01em' }}>
            Flowdesk
          </span>
        </div>

        {/* Sign in card */}
        <div
          className="lp-card"
          style={{
            background: 'var(--fd-surface)',
            border: '1px solid var(--fd-border)',
            borderRadius: '16px',
            padding: '26px',
            boxShadow: '0 4px 24px rgba(0,0,0,0.07), 0 1px 3px rgba(0,0,0,0.04)',
          }}
        >
          <div style={{ marginBottom: '20px' }}>
            <h1 style={{ fontSize: '21px', fontWeight: 700, color: 'var(--fd-ink-1)', letterSpacing: '-0.02em', margin: '0 0 4px' }}>
              Welcome back
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--fd-ink-3)', margin: 0 }}>
              Sign in to your workspace
            </p>
          </div>

          {error && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '10px 13px', borderRadius: '8px', marginBottom: '14px',
              background: 'rgba(185,28,28,0.08)', border: '1px solid rgba(185,28,28,0.2)',
              color: '#f87171', fontSize: '12.5px',
            }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
                <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M7 4v3.5M7 9.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '13px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--fd-ink-2)', marginBottom: '6px', letterSpacing: '0.01em' }}>
                Email address
              </label>
              <input
                type="email" autoComplete="email" value={form.email} required
                onChange={e => { setForm(p => ({ ...p, email: e.target.value })); setActiveDemo(null); }}
                placeholder="you@toflymedia.com"
                className="fd-input-lg"
              />
            </div>

            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--fd-ink-2)', marginBottom: '6px', letterSpacing: '0.01em' }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPw ? 'text' : 'password'} autoComplete="current-password"
                  value={form.password} required
                  onChange={e => { setForm(p => ({ ...p, password: e.target.value })); setActiveDemo(null); }}
                  placeholder="••••••••"
                  className="fd-input-lg"
                  style={{ paddingRight: '40px' }}
                />
                <button
                  type="button" onClick={() => setShowPw(p => !p)}
                  style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fd-ink-4)', display: 'flex', padding: '2px' }}
                >
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <button
              type="submit" disabled={loading}
              className="btn-primary"
              style={{ width: '100%', padding: '11px 20px', fontSize: '14px', fontWeight: 600, borderRadius: '10px', justifyContent: 'center' }}
            >
              {loading
                ? <div className="spin" style={{ width: '16px', height: '16px', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff' }} />
                : <>Sign in <ArrowRight size={14} /></>
              }
            </button>
          </form>
        </div>

        {/* Demo accounts */}
        <div
          className="lp-demo"
          style={{
            background: 'var(--fd-surface)',
            border: '1px solid var(--fd-border)',
            borderRadius: '16px',
            padding: '18px 22px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
            <Zap size={11} style={{ color: 'var(--fd-ink-4)' }} />
            <span style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--fd-ink-4)', letterSpacing: '0.07em', textTransform: 'uppercase' }}>
              Quick login
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '7px' }}>
            {DEMO_ACCOUNTS.map((d, i) => (
              <button
                key={i} type="button"
                className="demo-btn"
                onClick={() => handleDemo(d, i)}
                style={{
                  background: activeDemo === i ? d.bg : 'var(--fd-surface-raised)',
                  border: `1px solid ${activeDemo === i ? d.border : 'var(--fd-border)'}`,
                  borderRadius: '10px', padding: '10px 11px',
                  textAlign: 'left', cursor: 'pointer',
                  transition: 'all 0.14s ease',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '11.5px', fontWeight: 600, color: d.accent, marginBottom: '1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {d.role}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--fd-ink-4)', fontFamily: 'monospace', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {d.email.split('@')[0]}
                  </div>
                </div>
                <ArrowRight size={11} className="arr" style={{ color: 'var(--fd-ink-5)', flexShrink: 0 }} />
              </button>
            ))}
          </div>

          {activeDemo !== null && (
            <p style={{ marginTop: '10px', fontSize: '11.5px', color: 'var(--fd-ink-4)', textAlign: 'center', margin: '10px 0 0' }}>
              Credentials filled — hit <strong style={{ color: 'var(--fd-ink-2)' }}>Sign in</strong> ↑
            </p>
          )}
        </div>

      </div>
    </>
  );
}