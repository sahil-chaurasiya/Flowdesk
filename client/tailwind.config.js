/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: { center: true, padding: "2rem", screens: { "2xl": "1400px" } },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
        secondary: { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
        destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },

        // ── Core palette ──────────────────────────────────────────────────
        // Page / surface layers
        canvas:   '#f7f6f3',   // warm off-white page bg
        surface:  '#ffffff',   // card / panel surface
        raised:   '#fafaf9',   // slightly elevated surface
        sunken:   '#f0eeea',   // depressed / input bg

        // Brand accent — muted slate-blue, not electric
        accent: {
          50:  '#f0f4ff',
          100: '#e3eafd',
          200: '#c5d4fb',
          300: '#a0b8f8',
          400: '#7896f3',
          500: '#4f6ef0',   // primary action
          600: '#3a56d4',
          700: '#2d43a8',
          800: '#253480',
          900: '#1e2a63',
        },

        // Neutral text hierarchy
        ink: {
          DEFAULT: '#1a1916',  // near-black heading
          2: '#44423d',        // body text
          3: '#7a7770',        // secondary / label
          4: '#a8a49e',        // muted / placeholder
          5: '#ccc9c2',        // disabled / border
        },

        // Semantic tokens
        success: { DEFAULT: '#2a7d4f', bg: '#edf7f1', border: '#b8e2c9' },
        warning: { DEFAULT: '#92600a', bg: '#fef7ea', border: '#f5d78e' },
        danger:  { DEFAULT: '#b91c1c', bg: '#fef2f2', border: '#fecaca' },
        info:    { DEFAULT: '#1e56a0', bg: '#eff5ff', border: '#bfdbfe' },

        // Sidebar — warm near-white with subtle warmth
        sidebar: '#ffffff',
        'sidebar-hover': '#f5f4f1',
        'sidebar-active': '#eff0fe',
      },

      borderRadius: {
        sm:  '6px',
        DEFAULT: '8px',
        md:  '10px',
        lg:  '12px',
        xl:  '16px',
        '2xl': '20px',
        '3xl': '24px',
      },

      fontFamily: {
        sans:  ['"Geist"', 'system-ui', 'sans-serif'],
        mono:  ['"Geist Mono"', 'monospace'],
      },

      fontSize: {
        '2xs': ['0.65rem', { lineHeight: '1rem' }],
        xs:    ['0.72rem', { lineHeight: '1.1rem' }],
        sm:    ['0.8125rem', { lineHeight: '1.25rem' }],
        base:  ['0.875rem', { lineHeight: '1.4rem' }],
        md:    ['0.9375rem', { lineHeight: '1.5rem' }],
        lg:    ['1.0625rem', { lineHeight: '1.6rem' }],
        xl:    ['1.1875rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.375rem',  { lineHeight: '1.875rem' }],
        '3xl': ['1.75rem',   { lineHeight: '2.2rem' }],
      },

      boxShadow: {
        // Layered soft shadows — the secret to premium light UI
        'card':    '0 1px 2px 0 rgba(28,25,20,0.04), 0 1px 6px 0 rgba(28,25,20,0.03)',
        'card-md': '0 2px 8px 0 rgba(28,25,20,0.06), 0 1px 3px 0 rgba(28,25,20,0.04)',
        'card-lg': '0 8px 30px 0 rgba(28,25,20,0.08), 0 2px 8px 0 rgba(28,25,20,0.05)',
        'float':   '0 20px 60px -8px rgba(28,25,20,0.14), 0 4px 16px -2px rgba(28,25,20,0.08)',
        'btn':     '0 1px 3px 0 rgba(28,25,20,0.12), inset 0 1px 0 rgba(255,255,255,0.15)',
        'btn-hover': '0 2px 6px 0 rgba(28,25,20,0.16), inset 0 1px 0 rgba(255,255,255,0.12)',
        'inset':   'inset 0 1px 3px 0 rgba(28,25,20,0.06)',
        'focus':   '0 0 0 3px rgba(79,110,240,0.14)',
        'none':    'none',
      },

      keyframes: {
        "accordion-down": { from: { height: 0 }, to: { height: "var(--radix-accordion-content-height)" } },
        "accordion-up":   { from: { height: "var(--radix-accordion-content-height)" }, to: { height: 0 } },
        "fade-in":        { from: { opacity: 0, transform: 'translateY(4px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        "fade-up":        { from: { opacity: 0, transform: 'translateY(10px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        "slide-in":       { from: { transform: 'translateX(-100%)' }, to: { transform: 'translateX(0)' } },
        "slide-in-right": { from: { transform: 'translateX(100%)' }, to: { transform: 'translateX(0)' } },
        "scale-in":       { from: { opacity: 0, transform: 'scale(0.97)' }, to: { opacity: 1, transform: 'scale(1)' } },
        "shimmer":        { from: { backgroundPosition: '-400% 0' }, to: { backgroundPosition: '400% 0' } },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up":   "accordion-up 0.2s ease-out",
        "fade-in":        "fade-in 0.2s ease-out both",
        "fade-up":        "fade-up 0.3s ease-out both",
        "slide-in":       "slide-in 0.28s cubic-bezier(0.32,0.72,0,1)",
        "slide-in-right": "slide-in-right 0.28s cubic-bezier(0.32,0.72,0,1)",
        "scale-in":       "scale-in 0.18s ease-out both",
        "shimmer":        "shimmer 2.2s linear infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
