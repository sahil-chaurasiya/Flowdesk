import React, { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext(null);

// ─────────────────────────────────────────────────────────────────────────────
// App-wide themes — every role EXCEPT Software Developer.
// These map to the plain [data-theme="…"] CSS blocks in index.css. "light"
// and "dark" are the original two and are never removed; the rest are new
// full re-skins (background, borders, accent colour, badges, buttons, chat
// bubbles, etc. all shift together). Deliberately a different palette set
// than DEV_THEMES below — the developer role's own themes are untouched and
// these are never applied to it.
// ─────────────────────────────────────────────────────────────────────────────
export const APP_THEMES = [
  { id: 'light',    label: 'Light',    swatch: ['#f7f6f3', '#4f6ef0', '#1a1916'], desc: 'Clean & bright — the default' },
  { id: 'dark',     label: 'Dark',     swatch: ['#141518', '#4f6ef0', '#edeae4'], desc: 'Easy on the eyes at night' },
  { id: 'ocean',    label: 'Ocean',    swatch: ['#f4f8f8', '#0ea5b7', '#1a1916'], desc: 'Airy blue-teal — calm coastal palette' },
  { id: 'forest',   label: 'Forest',   swatch: ['#f4f8f5', '#1d9a5c', '#1a1916'], desc: 'Fresh green — natural, grounded palette' },
  { id: 'sunset',   label: 'Sunset',   swatch: ['#fbf5ef', '#e8622c', '#1a1916'], desc: 'Warm coral-orange — energetic palette' },
  { id: 'rose',     label: 'Rose',     swatch: ['#fbf3f6', '#d94a86', '#1a1916'], desc: 'Soft pink-rose — warm, friendly palette' },
  { id: 'midnight', label: 'Midnight', swatch: ['#0f1015', '#7c6cf0', '#edeae4'], desc: 'Deep indigo-violet — moody night palette' },
  { id: 'slate',    label: 'Slate',    swatch: ['#0f1414', '#22b8bd', '#edeae4'], desc: 'Cool graphite-teal — sharp, modern palette' },
];

const APP_THEME_IDS = APP_THEMES.map(t => t.id);
const DEFAULT_APP_THEME = 'light';

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
  { id: 'midnight',       label: 'Midnight',         swatch: ['#111019', '#7c6cf0', '#edeae4'], desc: 'Deep indigo-violet — moody night palette' },
  { id: 'slate',          label: 'Slate',            swatch: ['#101919', '#22b8bd', '#edeae4'], desc: 'Cool graphite-teal — sharp, modern palette' },
];

const DEV_THEME_IDS = DEV_THEMES.map(t => t.id);
const DEFAULT_DEV_THEME = 'linux-dev';

// Themes whose surfaces are dark — used to decide things like the sun/moon
// icon and native form-control colour-scheme without hardcoding "dark".
const DARK_FAMILY_THEME_IDS = ['dark', 'midnight', 'slate'];

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    const saved = localStorage.getItem('fd-theme');
    if (saved && APP_THEME_IDS.includes(saved)) return saved;
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
    const saved = localStorage.getItem('fd-theme');
    const initial = (saved && APP_THEME_IDS.includes(saved))
      ? saved
      : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', initial);
  }, []);

  useEffect(() => {
    localStorage.setItem('fd-dev-theme', devTheme);
  }, [devTheme]);

  // setTheme accepts any id from APP_THEMES (light, dark, ocean, forest,
  // sunset, rose, midnight, slate) — not just light/dark.
  const setTheme = (id) => {
    if (APP_THEME_IDS.includes(id)) setThemeState(id);
  };

  // Kept for existing call sites (e.g. a quick sun/moon button): flips
  // between light and dark specifically, regardless of which of the other
  // themes is currently active.
  const toggleTheme = () => setThemeState(t => (DARK_FAMILY_THEME_IDS.includes(t) ? 'light' : 'dark'));

  const isDark = DARK_FAMILY_THEME_IDS.includes(theme);

  const setDevTheme = (id) => {
    if (DEV_THEME_IDS.includes(id)) setDevThemeState(id);
  };

  return (
    <ThemeContext.Provider value={{
      theme, isDark, toggleTheme, setTheme, appThemes: APP_THEMES,
      devTheme, setDevTheme, devThemes: DEV_THEMES,
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}