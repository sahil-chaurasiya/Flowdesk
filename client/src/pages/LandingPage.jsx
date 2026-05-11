import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Geist:wght@300;400;500;600&display=swap');`;

const CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg: #f7f5f2;
    --surface: #ffffff;
    --border: #e8e4de;
    --text: #1a1916;
    --muted: #7a7570;
    --accent: #d4500a;
    --accent-light: #fff1eb;
    --dark: #1a1916;
  }

  .lp {
    background: var(--bg);
    color: var(--text);
    font-family: 'Geist', sans-serif;
    min-height: 100vh;
  }

  /* NAV */
  .lp-nav {
    position: fixed; top: 0; left: 0; right: 0; z-index: 100;
    height: 56px;
    display: flex; align-items: center; justify-content: space-between;
    padding: 0 40px;
    transition: background .25s, border-color .25s;
    border-bottom: 1px solid transparent;
  }
  .lp-nav.scrolled {
    background: rgba(247,245,242,0.96);
    backdrop-filter: blur(12px);
    border-bottom-color: var(--border);
  }
  .lp-logo { display: flex; align-items: center; gap: 9px; text-decoration: none; }
  .lp-mark {
    width: 28px; height: 28px; background: var(--accent); border-radius: 6px;
    display: flex; align-items: center; justify-content: center;
    font-size: 10px; font-weight: 700; color: white;
    font-family: 'Geist', sans-serif;
    flex-shrink: 0;
  }
  .lp-wordmark { font-size: 13.5px; font-weight: 600; color: var(--text); letter-spacing: -.2px; }
  .lp-nav-login {
    font-size: 13px; font-weight: 500; color: var(--text);
    text-decoration: none; padding: 8px 18px;
    border: 1px solid var(--border); border-radius: 8px;
    background: var(--surface);
    transition: border-color .18s;
  }
  .lp-nav-login:hover { border-color: #c5bfb8; }

  /* HERO */
  .lp-hero {
    padding: 130px 40px 80px;
    max-width: 780px; margin: 0 auto;
  }
  .lp-label {
    font-size: 11px; font-weight: 500; letter-spacing: 1.5px;
    text-transform: uppercase; color: var(--muted);
    margin-bottom: 24px;
  }
  .lp-h1 {
    font-family: 'Instrument Serif', serif;
    font-size: clamp(36px, 6vw, 72px);
    font-weight: 400; line-height: 1.08;
    letter-spacing: -1.5px; color: var(--text);
    margin-bottom: 24px;
  }
  .lp-h1 i { font-style: italic; color: var(--accent); }
  .lp-hero-body {
    font-size: 16px; font-weight: 300; color: var(--muted);
    line-height: 1.75; max-width: 520px;
    margin-bottom: 36px;
  }
  .lp-hero-body b { color: var(--text); font-weight: 500; }
  .lp-login-link {
    display: inline-flex; align-items: center; gap: 8px;
    background: var(--accent); color: white;
    font-size: 14px; font-weight: 500;
    padding: 13px 28px; border-radius: 10px;
    text-decoration: none;
    transition: opacity .18s;
  }
  .lp-login-link:hover { opacity: .88; }

  /* DIVIDER */
  .lp-div { border: none; border-top: 1px solid var(--border); max-width: 1040px; margin: 0 auto; }

  /* WHAT IT IS */
  .lp-what { max-width: 1040px; margin: 0 auto; padding: 72px 40px; }
  .lp-what-h {
    font-family: 'Instrument Serif', serif;
    font-size: clamp(26px, 3.5vw, 38px); font-weight: 400;
    letter-spacing: -.5px; color: var(--text);
    margin-bottom: 14px; line-height: 1.25;
  }
  .lp-what-body {
    font-size: 15px; font-weight: 300; color: var(--muted);
    line-height: 1.75; max-width: 600px; margin-bottom: 48px;
  }

  .lp-cards { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
  @media(max-width: 680px) { .lp-cards { grid-template-columns: 1fr; } }

  .lp-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 14px; padding: 28px 26px;
    transition: border-color .2s;
  }
  .lp-card:hover { border-color: #d0c9c0; }
  .lp-card-icon { font-size: 22px; margin-bottom: 14px; }
  .lp-card-title { font-size: 15px; font-weight: 600; color: var(--text); margin-bottom: 8px; }
  .lp-card-desc { font-size: 13.5px; color: var(--muted); line-height: 1.65; font-weight: 300; }

  /* mini UI */
  .lp-mini {
    margin-top: 18px;
    border: 1px solid var(--border); border-radius: 8px; overflow: hidden;
    background: var(--bg);
  }
  .lp-mini-row {
    display: flex; align-items: center; gap: 10px;
    padding: 9px 13px; border-bottom: 1px solid var(--border);
    font-size: 11.5px;
  }
  .lp-mini-row:last-child { border-bottom: none; }
  .lp-mini-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
  .lp-mini-name { flex: 1; color: var(--text); font-weight: 500; }
  .lp-mini-tag {
    font-size: 10px; font-weight: 600; padding: 2px 8px;
    border-radius: 100px; color: white;
  }
  .lp-mini-src { font-size: 10.5px; color: var(--muted); }

  .lp-mini-task { display: flex; align-items: center; gap: 9px; padding: 9px 13px; border-bottom: 1px solid var(--border); font-size: 11.5px; }
  .lp-mini-task:last-child { border-bottom: none; }
  .lp-mini-chk {
    width: 13px; height: 13px; border-radius: 3px;
    border: 1.5px solid var(--border); flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
  }
  .lp-mini-chk.done { background: #22c55e; border-color: #22c55e; }
  .lp-mini-label { flex: 1; color: var(--text); }
  .lp-mini-label.done { text-decoration: line-through; color: var(--muted); }
  .lp-mini-role {
    font-size: 10px; font-weight: 500; color: var(--muted);
    background: var(--accent-light); color: var(--accent);
    padding: 2px 7px; border-radius: 6px;
  }

  .lp-mini-stat { display: flex; align-items: center; gap: 10px; padding: 9px 13px; border-bottom: 1px solid var(--border); font-size: 11.5px; }
  .lp-mini-stat:last-child { border-bottom: none; }
  .lp-mini-metric { flex: 1; color: var(--muted); }
  .lp-mini-val { font-weight: 600; color: var(--text); }
  .lp-mini-delta { font-size: 10.5px; color: #16a34a; font-weight: 500; }

  /* WHO SECTION */
  .lp-who { max-width: 1040px; margin: 0 auto; padding: 72px 40px; }
  .lp-who-h {
    font-family: 'Instrument Serif', serif;
    font-size: clamp(26px, 3.5vw, 38px); font-weight: 400;
    letter-spacing: -.5px; color: var(--text);
    margin-bottom: 14px;
  }
  .lp-who-body { font-size: 15px; font-weight: 300; color: var(--muted); line-height: 1.75; max-width: 560px; margin-bottom: 40px; }

  .lp-roles { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 10px; }
  .lp-role {
    border: 1px solid var(--border); border-radius: 12px;
    padding: 20px 18px; background: var(--surface);
    transition: border-color .18s;
  }
  .lp-role:hover { border-color: #d0c9c0; }
  .lp-role-icon { font-size: 20px; margin-bottom: 10px; }
  .lp-role-name { font-size: 13px; font-weight: 600; color: var(--text); margin-bottom: 5px; }
  .lp-role-desc { font-size: 12px; color: var(--muted); line-height: 1.6; }
  .lp-role-sees {
    margin-top: 10px; font-size: 11px; color: var(--accent);
    font-weight: 500; border-top: 1px solid var(--border); padding-top: 10px;
  }

  /* HOW TO LOG IN */
  .lp-login-section { max-width: 1040px; margin: 0 auto; padding: 72px 40px; }
  .lp-login-section-h {
    font-family: 'Instrument Serif', serif;
    font-size: clamp(26px, 3.5vw, 38px); font-weight: 400;
    letter-spacing: -.5px; color: var(--text); margin-bottom: 14px;
  }
  .lp-login-section-body { font-size: 15px; font-weight: 300; color: var(--muted); line-height: 1.75; max-width: 520px; margin-bottom: 32px; }
  .lp-login-cta {
    display: inline-flex; align-items: center; gap: 8px;
    background: var(--dark); color: #f7f5f2;
    font-size: 14px; font-weight: 500;
    padding: 14px 30px; border-radius: 10px;
    text-decoration: none; transition: opacity .18s;
  }
  .lp-login-cta:hover { opacity: .85; }

  /* FOOTER */
  .lp-footer {
    border-top: 1px solid var(--border);
    padding: 24px 40px;
    display: flex; align-items: center; justify-content: space-between;
    flex-wrap: wrap; gap: 12px;
  }
  .lp-footer-text { font-size: 12px; color: var(--muted); }

  /* FADE */
  .fu { opacity: 0; transform: translateY(20px); transition: opacity .55s ease, transform .55s ease; }
  .fu.in { opacity: 1; transform: translateY(0); }
  .fu.d1 { transition-delay: .08s; }
  .fu.d2 { transition-delay: .16s; }

  /* MOBILE NAV DRAWER */
  .lp-nav-drawer {
    position: fixed; top: 56px; left: 0; right: 0; z-index: 99;
    background: rgba(247,245,242,0.98);
    backdrop-filter: blur(12px);
    border-bottom: 1px solid var(--border);
    padding: 20px;
    display: flex; flex-direction: column; gap: 12px;
    transform: translateY(-110%);
    transition: transform .25s ease;
  }
  .lp-nav-drawer.open { transform: translateY(0); }
  .lp-nav-drawer a {
    font-size: 15px; font-weight: 500; color: var(--text);
    text-decoration: none; padding: 12px 0;
    border-bottom: 1px solid var(--border);
  }
  .lp-nav-drawer a:last-child { border-bottom: none; }

  /* HAMBURGER */
  .lp-hamburger {
    display: none;
    flex-direction: column; gap: 5px;
    cursor: pointer; padding: 4px;
    background: none; border: none;
  }
  .lp-hamburger span {
    display: block; width: 20px; height: 2px;
    background: var(--text); border-radius: 2px;
    transition: transform .2s, opacity .2s;
  }
  .lp-hamburger.open span:nth-child(1) { transform: translateY(7px) rotate(45deg); }
  .lp-hamburger.open span:nth-child(2) { opacity: 0; }
  .lp-hamburger.open span:nth-child(3) { transform: translateY(-7px) rotate(-45deg); }

  @media(max-width: 600px) {
    .lp-nav { padding: 0 20px; }
    .lp-nav-login { display: none; }
    .lp-hamburger { display: flex; }
    .lp-hero { padding: 100px 20px 60px; }
    .lp-what, .lp-who, .lp-login-section { padding-left: 20px; padding-right: 20px; padding-top: 48px; padding-bottom: 48px; }
    .lp-footer { padding: 20px; }
    .lp-h1 { letter-spacing: -1px; }
    .lp-roles { grid-template-columns: 1fr 1fr; }
  }

  @media(max-width: 400px) {
    .lp-roles { grid-template-columns: 1fr; }
  }
`;

const ROLES = [
  {
    icon: '👑', name: 'Admin',
    desc: 'Manages the entire workspace — team access, clients, and settings.',
    sees: 'Everything',
  },
  {
    icon: '🗂️', name: 'Project Manager',
    desc: 'Assigns tasks to team members, uploads leads, posts updates for clients.',
    sees: 'All clients, all tasks, leads',
  },
  {
    icon: '📊', name: 'Performance Marketer',
    desc: 'Gets tasks related to paid campaigns. Sees only what\'s assigned to them.',
    sees: 'My tasks + files',
  },
  {
    icon: '🎬', name: 'Video Editor',
    desc: 'Receives editing tasks with briefs and deadlines. Nothing else in the way.',
    sees: 'My tasks + files',
  },
  {
    icon: '🎨', name: 'Graphic Designer',
    desc: 'Design tasks with attached briefs and client asset references.',
    sees: 'My tasks + files',
  },
  {
    icon: '✍️', name: 'Copywriter',
    desc: 'Copy and content tasks, organised by client with relevant brand files.',
    sees: 'My tasks + files',
  },
  {
    icon: '📱', name: 'Social Media Manager',
    desc: 'Content calendar tasks, scheduling, and posting instructions per client.',
    sees: 'My tasks + files',
  },
  {
    icon: '🏢', name: 'Client',
    desc: 'Logs in to see their leads, reports, campaign updates, and files. Nothing internal.',
    sees: 'Their own data only',
  },
];

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const refs = useRef([]);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 30);
    window.addEventListener('scroll', fn);
    return () => window.removeEventListener('scroll', fn);
  }, []);

  useEffect(() => {
    const obs = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('in'); }),
      { threshold: 0.08 }
    );
    refs.current.forEach(el => el && obs.observe(el));
    return () => obs.disconnect();
  }, []);

  // Close menu on scroll
  useEffect(() => {
    if (menuOpen && scrolled) setMenuOpen(false);
  }, [scrolled]);

  const fade = (delay = '') => ({
    ref: el => { if (el && !refs.current.includes(el)) refs.current.push(el); },
    className: `fu${delay ? ` ${delay}` : ''}`,
  });

  return (
    <div className="lp">
      <style>{FONTS + CSS}</style>

      {/* Nav */}
      <nav className={`lp-nav${scrolled ? ' scrolled' : ''}`}>
        <Link to="/" className="lp-logo">
          <div className="lp-mark">TF</div>
          <span className="lp-wordmark">To Fly Media</span>
        </Link>
        <Link to="/login" className="lp-nav-login">Sign in</Link>
        <button
          className={`lp-hamburger${menuOpen ? ' open' : ''}`}
          onClick={() => setMenuOpen(p => !p)}
          aria-label="Toggle menu"
        >
          <span /><span /><span />
        </button>
      </nav>

      {/* Mobile Nav Drawer */}
      <div className={`lp-nav-drawer${menuOpen ? ' open' : ''}`}>
        <Link to="/login" onClick={() => setMenuOpen(false)}>Sign in →</Link>
      </div>

      {/* Hero */}
      <section className="lp-hero">
        <div className="lp-label">To Fly Media · Internal Portal</div>
        <h1 className="lp-h1">
          One place for the<br />team and the <i>clients.</i>
        </h1>
        <p className="lp-hero-body">
          This portal is where <b>the team manages work</b> and where <b>clients check in on their campaigns.</b> Tasks, leads, reports, files, and updates — all in one login, separated cleanly by role.
        </p>
        <Link to="/login" className="lp-login-link">Sign in →</Link>
      </section>

      <hr className="lp-div" />

      {/* What it does */}
      <section className="lp-what">
        <div {...fade()}>
          <p className="lp-label">What the portal does</p>
          <h2 className="lp-what-h">Four things it handles.</h2>
          <p className="lp-what-body">
            The portal is split into two sides — an internal side for the team, and a client-facing side. Here's what each part actually does.
          </p>
        </div>

        <div className="lp-cards" {...fade('d1')}>

          {/* Leads */}
          <div className="lp-card">
            <div className="lp-card-icon">🎯</div>
            <div className="lp-card-title">Lead Management</div>
            <div className="lp-card-desc">
              The PM uploads a leads file (Excel or CSV) from any ad platform. The portal parses it automatically and puts it on the client's dashboard — organised by source, campaign, and status. Clients can see all their leads the moment they log in.
            </div>
            <div className="lp-mini">
              {[
                { name: "James O'Brien", src: 'Meta Ads', tag: 'Hot', tagColor: '#dc2626', dot: '#dc2626' },
                { name: 'Sunita Rao', src: 'Google Ads', tag: 'Qualified', tagColor: '#d97706', dot: '#d97706' },
                { name: 'Marcus Li', src: 'TikTok', tag: 'New', tagColor: '#2563eb', dot: '#2563eb' },
              ].map(l => (
                <div className="lp-mini-row" key={l.name}>
                  <div className="lp-mini-dot" style={{ background: l.dot }} />
                  <div className="lp-mini-name">{l.name}</div>
                  <div className="lp-mini-src">{l.src}</div>
                  <div className="lp-mini-tag" style={{ background: l.tagColor }}>{l.tag}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Tasks */}
          <div className="lp-card">
            <div className="lp-card-icon">✅</div>
            <div className="lp-card-title">Task Assignment</div>
            <div className="lp-card-desc">
              The Project Manager creates tasks and assigns them to specific team members. Each person only sees tasks assigned to them — the editor sees editing tasks, the copywriter sees copy tasks. The PM sees everything and tracks status across the team.
            </div>
            <div className="lp-mini">
              {[
                { label: 'Edit Summer Reels ×3', done: false, role: 'Video Editor' },
                { label: 'Write Meta ad copy — Q3', done: false, role: 'Copywriter' },
                { label: 'Design carousel pack', done: true, role: 'Designer' },
              ].map(t => (
                <div className="lp-mini-task" key={t.label}>
                  <div className={`lp-mini-chk${t.done ? ' done' : ''}`}>
                    {t.done && <span style={{ color: 'white', fontSize: 8, fontWeight: 700 }}>✓</span>}
                  </div>
                  <div className={`lp-mini-label${t.done ? ' done' : ''}`}>{t.label}</div>
                  <div className="lp-mini-role">{t.role}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Reports */}
          <div className="lp-card">
            <div className="lp-card-icon">📊</div>
            <div className="lp-card-title">Reports & Performance</div>
            <div className="lp-card-desc">
              Monthly reports are published directly inside the client's portal — ad spend, ROAS, leads, and conversions. Clients log in and find their numbers there, without needing to ask for a PDF or wait for an email.
            </div>
            <div className="lp-mini">
              {[
                { metric: 'Ad Spend', val: '₹1,24,500', delta: '↑ 12%' },
                { metric: 'ROAS', val: '4.8×', delta: '↑ 0.6×' },
                { metric: 'Total Leads', val: '284', delta: '+47 this week' },
              ].map(m => (
                <div className="lp-mini-stat" key={m.metric}>
                  <div className="lp-mini-metric">{m.metric}</div>
                  <div className="lp-mini-val">{m.val}</div>
                  <div className="lp-mini-delta">{m.delta}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Updates */}
          <div className="lp-card">
            <div className="lp-card-icon">📢</div>
            <div className="lp-card-title">Client Updates</div>
            <div className="lp-card-desc">
              The team posts campaign updates, launch announcements, and notes directly inside the client's portal. Clients get notified and can read everything in one place — timestamped and organised, not scattered across chat messages.
            </div>
            <div className="lp-mini">
              {[
                { text: 'Q3 Meta campaigns launched', time: '10m ago' },
                { text: 'July content calendar is ready', time: '2h ago' },
                { text: 'Week 2 leads report published', time: '1d ago' },
              ].map(u => (
                <div className="lp-mini-row" key={u.text}>
                  <div className="lp-mini-name">{u.text}</div>
                  <div className="lp-mini-src">{u.time}</div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </section>

      <hr className="lp-div" />

      {/* Who uses it */}
      <section className="lp-who">
        <div {...fade()}>
          <p className="lp-label">Who uses it</p>
          <h2 className="lp-who-h">Every role has its own view.</h2>
          <p className="lp-who-body">
            When you log in, you see exactly what's relevant to your role — nothing more. Team members see their own task queue. Clients see only their own data.
          </p>
        </div>
        <div className="lp-roles" {...fade('d1')}>
          {ROLES.map(role => (
            <div className="lp-role" key={role.name}>
              <div className="lp-role-icon">{role.icon}</div>
              <div className="lp-role-name">{role.name}</div>
              <div className="lp-role-desc">{role.desc}</div>
              <div className="lp-role-sees">Sees: {role.sees}</div>
            </div>
          ))}
        </div>
      </section>

      <hr className="lp-div" />

      {/* How to get in */}
      <section className="lp-login-section">
        <div {...fade()}>
          <p className="lp-label">Getting started</p>
          <h2 className="lp-login-section-h">How to log in.</h2>
          <p className="lp-login-section-body">
            Your account is created by the admin. You'll receive your email and password separately. If you don't have credentials yet, ask the project manager. Clients are set up when onboarding is complete.
          </p>
          <Link to="/login" className="lp-login-cta">Go to login →</Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="lp-footer">
        <div className="lp-logo" style={{ textDecoration: 'none' }}>
          <div className="lp-mark">TF</div>
          <span className="lp-wordmark" style={{ color: 'var(--muted)', fontWeight: 400 }}>To Fly Media</span>
        </div>
        <div className="lp-footer-text">Internal use only.</div>
        <Link to="/login" style={{ fontSize: 13, color: 'var(--muted)', textDecoration: 'none' }}>Sign in →</Link>
      </footer>
    </div>
  );
}