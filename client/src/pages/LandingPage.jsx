import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400;1,700&family=Outfit:wght@300;400;500;600&display=swap');`;

const ROLES = [
  { icon: '👑', name: 'Admin' },
  { icon: '🗂️', name: 'Project Manager' },
  { icon: '📊', name: 'Marketer' },
  { icon: '🎬', name: 'Video Editor' },
  { icon: '🎨', name: 'Designer' },
  { icon: '✍️', name: 'Copywriter' },
  { icon: '📱', name: 'Social Manager' },
  { icon: '🏢', name: 'Client' },
];

const FEATURES = [
  { icon: '🎯', label: 'Lead Management' },
  { icon: '✅', label: 'Task Assignment' },
  { icon: '📊', label: 'Reports & ROAS' },
  { icon: '📢', label: 'Client Updates' },
  { icon: '📁', label: 'File Storage' },
  { icon: '💬', label: 'Messaging' },
];

const CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg: #080709;
    --cream: #f0ebe2;
    --gold: #c9a84c;
    --gold-dim: rgba(201,168,76,0.15);
    --gold-glow: rgba(201,168,76,0.08);
    --muted: #6b6560;
    --line: rgba(201,168,76,0.18);
    --ember: #d4541a;
  }

  html, body, #root {
    height: 100%; width: 100%;
    overflow: hidden;
  }

  .lp {
    width: 100vw; height: 100vh;
    overflow: hidden;
    background: var(--bg);
    color: var(--cream);
    font-family: 'Outfit', sans-serif;
    position: relative;
    display: flex;
    flex-direction: column;
  }

  /* NOISE */
  .lp::after {
    content: '';
    position: fixed; inset: 0; z-index: 0;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
    opacity: 0.035;
    pointer-events: none;
  }

  /* AMBIENT GLOWS */
  .glow-1 {
    position: fixed;
    width: 700px; height: 700px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(201,168,76,0.06) 0%, transparent 65%);
    top: -200px; left: 50%; transform: translateX(-50%);
    pointer-events: none; z-index: 0;
  }
  .glow-2 {
    position: fixed;
    width: 400px; height: 400px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(212,84,26,0.07) 0%, transparent 65%);
    bottom: 0; right: 0;
    pointer-events: none; z-index: 0;
  }

  /* ── TOP BAR ── */
  .lp-topbar {
    position: relative; z-index: 10;
    display: flex; align-items: center; justify-content: space-between;
    padding: 22px 44px;
    border-bottom: 1px solid var(--line);
    opacity: 0; animation: fadeIn .5s .1s ease forwards;
  }

  .lp-logo {
    display: flex; align-items: center; gap: 12px;
  }
  .lp-logo-mark {
    width: 38px; height: 38px;
    border-radius: 8px;
    overflow: hidden;
    flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 0 16px rgba(201,168,76,0.2);
  }
  .lp-logo-mark img {
    width: 100%; height: 100%;
    object-fit: cover;
    border-radius: 8px;
  }
  .lp-logo-text {
    font-family: 'Outfit', sans-serif;
    font-size: 13px; font-weight: 500;
    color: var(--muted);
    letter-spacing: .5px;
  }
  .lp-logo-text strong {
    color: var(--cream);
    font-weight: 600;
  }

  .lp-topbar-right {
    display: flex; align-items: center; gap: 20px;
  }
  .lp-status {
    display: flex; align-items: center; gap: 7px;
    font-size: 11px; color: var(--muted);
    letter-spacing: .5px;
  }
  .lp-status-dot {
    width: 5px; height: 5px; border-radius: 50%;
    background: #4ade80;
    box-shadow: 0 0 6px rgba(74,222,128,0.7);
    animation: blink 2.5s ease-in-out infinite;
  }
  @keyframes blink { 0%,100%{opacity:1} 50%{opacity:.3} }

  .lp-signin-btn {
    display: inline-flex; align-items: center; gap: 8px;
    font-family: 'Outfit', sans-serif;
    font-size: 12px; font-weight: 500;
    color: var(--gold);
    border: 1px solid var(--line);
    padding: 8px 20px; border-radius: 6px;
    text-decoration: none;
    letter-spacing: .5px;
    background: var(--gold-glow);
    transition: border-color .2s, background .2s, color .2s;
  }
  .lp-signin-btn:hover {
    border-color: var(--gold);
    background: var(--gold-dim);
    color: var(--cream);
  }

  /* ── HERO ── */
  .lp-hero {
    position: relative; z-index: 5;
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 0 24px;
  }

  .lp-eyebrow {
    font-size: 10px; font-weight: 500;
    letter-spacing: 4px; text-transform: uppercase;
    color: var(--gold);
    margin-bottom: 28px;
    opacity: 0; animation: fadeUp .6s .35s ease forwards;
    display: flex; align-items: center; gap: 14px;
  }
  .lp-eyebrow::before, .lp-eyebrow::after {
    content: ''; display: block;
    width: 36px; height: 1px;
    background: linear-gradient(to right, transparent, var(--gold));
  }
  .lp-eyebrow::after { transform: scaleX(-1); }

  .lp-wordmark {
    font-family: 'Playfair Display', serif;
    font-size: clamp(72px, 12vw, 160px);
    font-weight: 900;
    line-height: .92;
    letter-spacing: -4px;
    color: var(--cream);
    margin-bottom: 6px;
    opacity: 0; animation: fadeUp .8s .5s ease forwards;
    position: relative;
  }
  .lp-wordmark-italic {
    font-style: italic;
    color: var(--gold);
  }

  /* Thin horizontal rules flanking wordmark */
  .lp-rule {
    width: 100%; max-width: 700px;
    height: 1px;
    background: linear-gradient(to right, transparent, var(--line), transparent);
    margin: 14px auto;
    opacity: 0; animation: fadeIn .7s .7s ease forwards;
  }

  .lp-subtitle-block {
    opacity: 0; animation: fadeUp .7s .75s ease forwards;
    margin-bottom: 36px;
  }
  .lp-subtitle-top {
    font-size: clamp(11px, 1.2vw, 13px);
    font-weight: 300;
    letter-spacing: 3px;
    text-transform: uppercase;
    color: var(--muted);
    margin-bottom: 4px;
  }
  .lp-subtitle-main {
    font-size: clamp(13px, 1.5vw, 16px);
    font-weight: 400;
    color: rgba(240,235,226,0.65);
    letter-spacing: .5px;
    line-height: 1.6;
  }
  .lp-subtitle-main em {
    color: var(--cream);
    font-style: normal;
    font-weight: 500;
  }

  .lp-cta-group {
    display: flex; align-items: center; gap: 20px;
    opacity: 0; animation: fadeUp .7s .9s ease forwards;
  }
  .lp-cta-primary {
    display: inline-flex; align-items: center; gap: 10px;
    background: var(--gold);
    color: #080709;
    font-family: 'Outfit', sans-serif;
    font-size: 13px; font-weight: 600;
    padding: 13px 30px; border-radius: 7px;
    text-decoration: none;
    letter-spacing: .5px;
    transition: transform .18s, box-shadow .18s, background .18s;
    box-shadow: 0 4px 28px rgba(201,168,76,0.3);
  }
  .lp-cta-primary:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 36px rgba(201,168,76,0.45);
    background: #d4b15a;
  }
  .lp-cta-arrow { transition: transform .18s; }
  .lp-cta-primary:hover .lp-cta-arrow { transform: translateX(3px); }

  .lp-cta-note {
    font-size: 11px; color: var(--muted);
    line-height: 1.7; text-align: left;
    letter-spacing: .3px;
  }

  /* ── BOTTOM STRIP ── */
  .lp-bottom {
    position: relative; z-index: 10;
    border-top: 1px solid var(--line);
    opacity: 0; animation: fadeIn .8s 1.1s ease forwards;
  }

  /* Features row */
  .lp-features-row {
    display: flex; align-items: center;
    border-bottom: 1px solid var(--line);
    overflow: hidden;
  }
  .lp-features-label {
    flex-shrink: 0;
    padding: 10px 22px;
    font-size: 9px; font-weight: 500;
    letter-spacing: 2.5px; text-transform: uppercase;
    color: var(--muted);
    border-right: 1px solid var(--line);
    white-space: nowrap;
  }
  .lp-features-pills {
    display: flex; align-items: center;
    flex-wrap: nowrap; overflow: hidden;
    gap: 0;
  }
  .lp-feature-pill {
    display: flex; align-items: center; gap: 6px;
    padding: 10px 18px;
    font-size: 11px; color: var(--muted);
    border-right: 1px solid var(--line);
    white-space: nowrap;
    transition: color .2s, background .2s;
    cursor: default;
  }
  .lp-feature-pill:hover { color: var(--cream); background: var(--gold-glow); }
  .lp-feature-pill:last-child { border-right: none; }
  .lp-pill-icon { font-size: 11px; }

  /* Roles + stats row */
  .lp-bottom-main {
    display: flex; align-items: center;
    padding: 12px 44px;
    gap: 0;
  }

  .lp-roles-block {
    display: flex; align-items: center; gap: 14px;
    flex: 1;
  }
  .lp-roles-label {
    font-size: 9px; font-weight: 500;
    letter-spacing: 2px; text-transform: uppercase;
    color: var(--muted);
    flex-shrink: 0;
  }
  .lp-role-chips {
    display: flex; align-items: center; gap: 6px;
    flex-wrap: nowrap;
  }
  .lp-role-chip {
    display: flex; align-items: center; gap: 5px;
    padding: 4px 10px;
    background: rgba(201,168,76,0.06);
    border: 1px solid var(--line);
    border-radius: 100px;
    font-size: 10.5px; color: var(--muted);
    white-space: nowrap;
    transition: border-color .18s, color .18s;
    cursor: default;
  }
  .lp-role-chip:hover { border-color: rgba(201,168,76,0.4); color: var(--cream); }
  .lp-role-chip-icon { font-size: 10px; }

  .lp-divider-v {
    width: 1px; height: 32px;
    background: var(--line);
    margin: 0 28px;
    flex-shrink: 0;
  }

  .lp-stats-block {
    display: flex; align-items: center; gap: 28px;
    flex-shrink: 0;
  }
  .lp-stat {
    text-align: center;
  }
  .lp-stat-val {
    font-family: 'Playfair Display', serif;
    font-size: 20px; font-weight: 700;
    color: var(--gold);
    line-height: 1;
  }
  .lp-stat-label {
    font-size: 9px; letter-spacing: 1.5px; text-transform: uppercase;
    color: var(--muted); margin-top: 2px;
  }

  .lp-footer-copy {
    font-size: 10px; color: var(--muted);
    letter-spacing: .3px;
    margin-left: 28px;
    flex-shrink: 0;
  }

  /* ANIMATIONS */
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(20px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes fadeIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }

  /* MOBILE */
  @media (max-width: 768px) {
    html, body, #root { overflow: auto; }
    .lp { height: auto; min-height: 100vh; overflow: auto; }

    .lp-topbar { padding: 16px 20px; }
    .lp-status { display: none; }

    .lp-wordmark { font-size: clamp(56px, 18vw, 90px); letter-spacing: -2px; }

    .lp-hero { padding: 32px 20px; }

    .lp-bottom-main {
      flex-direction: column;
      align-items: flex-start;
      padding: 14px 20px; gap: 12px;
    }
    .lp-divider-v { display: none; }
    .lp-role-chips { flex-wrap: wrap; }
    .lp-stats-block { gap: 16px; }
    .lp-footer-copy { margin-left: 0; }

    .lp-features-row { overflow-x: auto; }
  }
`;

export default function LandingPage() {
  return (
    <div className="lp">
      <style>{FONTS + CSS}</style>

      {/* Ambience */}
      <div className="glow-1" />
      <div className="glow-2" />

      {/* ── TOP BAR ── */}
      <header className="lp-topbar">
        <div className="lp-logo">
          <div className="lp-logo-mark">
            <img src="/icon-512.png" alt="To Fly Media" />
          </div>
          <div className="lp-logo-text">
            <strong>Flowdesk</strong>
          </div>
        </div>
        <div className="lp-topbar-right">
          <div className="lp-status">
            <span className="lp-status-dot" />
            All systems operational
          </div>
          <Link to="/login" className="lp-signin-btn">
            Sign in →
          </Link>
        </div>
      </header>

      {/* ── HERO ── */}
      <main className="lp-hero">
        <div className="lp-eyebrow">Client Management Portal</div>

        <h1 className="lp-wordmark">
          Flow<span className="lp-wordmark-italic">desk</span>
        </h1>

        <div className="lp-rule" />

        <div className="lp-subtitle-block">
          <div className="lp-subtitle-top">To Fly Media · Internal Platform</div>
          <div className="lp-subtitle-main">
            One portal. Every role. <em>Total clarity.</em>
          </div>
        </div>

        <div className="lp-cta-group">
          <Link to="/login" className="lp-cta-primary">
            Enter Portal <span className="lp-cta-arrow">→</span>
          </Link>
          <div className="lp-cta-note">
            Access by invite only.<br />
            Contact your Project Manager.
          </div>
        </div>
      </main>

      {/* ── BOTTOM STRIP ── */}
      <footer className="lp-bottom">
        {/* Features ticker row */}
        <div className="lp-features-row">
          <div className="lp-features-label">Inside</div>
          <div className="lp-features-pills">
            {FEATURES.map(f => (
              <div className="lp-feature-pill" key={f.label}>
                <span className="lp-pill-icon">{f.icon}</span>
                {f.label}
              </div>
            ))}
          </div>
        </div>

        {/* Roles + stats */}
        <div className="lp-bottom-main">
          <div className="lp-roles-block">
            <div className="lp-roles-label">Roles</div>
            <div className="lp-role-chips">
              {ROLES.map(r => (
                <div className="lp-role-chip" key={r.name}>
                  <span className="lp-role-chip-icon">{r.icon}</span>
                  {r.name}
                </div>
              ))}
            </div>
          </div>

          <div className="lp-divider-v" />

          <div className="lp-stats-block">
            <div className="lp-stat">
              <div className="lp-stat-val">8+</div>
              <div className="lp-stat-label">Roles</div>
            </div>
            <div className="lp-stat">
              <div className="lp-stat-val">4×</div>
              <div className="lp-stat-label">Avg ROAS</div>
            </div>
            <div className="lp-stat">
              <div className="lp-stat-val">∞</div>
              <div className="lp-stat-label">Clients</div>
            </div>
          </div>

          <div className="lp-footer-copy">© 2025 To Fly Media</div>
        </div>
      </footer>
    </div>
  );
}