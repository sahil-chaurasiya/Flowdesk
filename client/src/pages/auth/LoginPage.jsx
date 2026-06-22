import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, ArrowRight, Zap } from 'lucide-react';
import useAuthStore from '../../context/authStore';

const LOGO = "data:image/png;base64,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";

const DEMO_ACCOUNTS = [
  { role: 'Project Manager',      email: 'manager@toflymedia.com',  pw: 'Manager123!',   accent: '#6e8ef5', bg: 'rgba(110,142,245,0.08)',  border: 'rgba(110,142,245,0.2)'  },
  { role: 'Performance Marketer', email: 'marketer@toflymedia.com', pw: 'Marketer123!',  accent: '#f5a623', bg: 'rgba(245,166,35,0.08)',   border: 'rgba(245,166,35,0.2)'   },
  { role: 'Video Editor',         email: 'editor@toflymedia.com',   pw: 'Editor123!',    accent: '#b06ef5', bg: 'rgba(176,110,245,0.08)',  border: 'rgba(176,110,245,0.2)'  },
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
      if (err.response) {
        // Server responded — this is a real auth/validation error from the backend
        setError(err.response.data?.message || 'Invalid email or password.');
      } else if (err.request || err.message === 'Network Error' || err.code === 'ERR_NETWORK') {
        // Request never got a response — server unreachable, CORS block, DNS issue, etc.
        // This is NOT a credentials problem, so don't say it is.
        setError('Could not reach the server. Please check your connection and try again in a moment.');
      } else if (err.code === 'ECONNABORTED') {
        setError('The request timed out. Please try again.');
      } else {
        setError('Something went wrong. Please try again.');
      }
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
        .lp-wrap  { animation: fadeUp 0.4s cubic-bezier(.22,.68,0,1.2) both; }
        .lp-card  { animation: fadeUp 0.4s cubic-bezier(.22,.68,0,1.2) 0.06s both; }
        .lp-demo  { animation: fadeUp 0.4s cubic-bezier(.22,.68,0,1.2) 0.12s both; }
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
          <img
            src={LOGO}
            alt="To Fly Media"
            style={{
              width: '40px', height: '40px', borderRadius: '10px',
              objectFit: 'cover', flexShrink: 0,
            }}
          />
          <div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--fd-ink-1)', letterSpacing: '-0.01em', lineHeight: 1.2 }}>
              To Fly Media
            </div>
            <div style={{ fontSize: '11px', color: 'var(--fd-ink-4)', letterSpacing: '0.02em' }}>
              Flowdesk
            </div>
          </div>
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
          {/* Card header with logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '22px' }}>
            <img
              src={LOGO}
              alt="To Fly Media"
              style={{
                width: '52px', height: '52px', borderRadius: '12px',
                objectFit: 'cover', flexShrink: 0,
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            />
            <div>
              <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--fd-ink-1)', letterSpacing: '-0.02em', margin: '0 0 3px' }}>
                Welcome back
              </h1>
              <p style={{ fontSize: '13px', color: 'var(--fd-ink-3)', margin: 0 }}>
                Sign in to your To Fly Media workspace
              </p>
            </div>
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

        {/* Demo accounts
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
        </div> */}

      </div>
    </>
  );
}