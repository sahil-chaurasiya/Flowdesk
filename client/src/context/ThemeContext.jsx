import React, { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext(null);

// ─────────────────────────────────────────────────────────────────────────────
// Developer role themes
// These are ONLY ever applied when the logged-in user's role is "developer"
// (see AdminLayout.jsx, which sets html[data-role-theme] + html[data-dev-mode]).
// The regular light/dark system below is completely unused for that role —
// developers pick one of these instead. Every other role is untouched.
// ─────────────────────────────────────────────────────────────────────────────
export const DEV_THEMES = [
  { id: 'linux-dev',      label: 'Terminal Green',  swatch: ['#0a0d12', '#3fb950', '#e6edf3'], desc: 'Classic TTY — near-black + terminal green' },
  { id: 'dracula',        label: 'Dracula',          swatch: ['#282a36', '#bd93f9', '#f8f8f2'], desc: 'Purple-pink vampire palette' },
  { id: 'nord',           label: 'Nord',             swatch: ['#2e3440', '#88c0d0', '#eceff4'], desc: 'Arctic, bluish frost tones' },
  { id: 'monokai',        label: 'Monokai',          swatch: ['#272822', '#a6e22e', '#f8f8f2'], desc: 'High-contrast editor classic' },
  { id: 'solarized-dark', label: 'Solarized Dark',   swatch: ['#002b36', '#2aa198', '#eee8d5'], desc: 'Low-contrast, easy on the eyes' },
  { id: 'one-dark',       label: 'One Dark',         swatch: ['#282c34', '#61afef', '#abb2bf'], desc: 'Atom / VS Code inspired' },
  { id: 'gruvbox',        label: 'Gruvbox',          swatch: ['#282828', '#fabd2f', '#ebdbb2'], desc: 'Warm, retro, low-contrast' },
  { id: 'cyberpunk',      label: 'Cyberpunk',        swatch: ['#0d0221', '#ff2e97', '#00f6ff'], desc: 'Neon magenta + cyan on black' },
];

const DEV_THEME_IDS = DEV_THEMES.map(t => t.id);
const DEFAULT_DEV_THEME = 'linux-dev';

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('fd-theme');
    if (saved) return saved;
    // Respect OS preference on first load
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  const [devTheme, setDevThemeState] = useState(() => {
    const saved = localStorage.getItem('fd-dev-theme');
    return DEV_THEME_IDS.includes(saved) ? saved : DEFAULT_DEV_THEME;
  });

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    localStorage.setItem('fd-theme', theme);
  }, [theme]);

  // Also apply on mount immediately to avoid flash
  useEffect(() => {
    const saved = localStorage.getItem('fd-theme') ||
      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', saved);
  }, []);

  useEffect(() => {
    localStorage.setItem('fd-dev-theme', devTheme);
  }, [devTheme]);

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark');
  const isDark = theme === 'dark';

  const setDevTheme = (id) => {
    if (DEV_THEME_IDS.includes(id)) setDevThemeState(id);
  };

  return (
    <ThemeContext.Provider value={{ theme, isDark, toggleTheme, setTheme, devTheme, setDevTheme, devThemes: DEV_THEMES }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}