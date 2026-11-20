/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['selector', '[data-theme="dark"]'],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        ink: 'var(--ink)',
        muted: 'var(--muted)',
        line: 'var(--line)',
        soft: 'var(--soft)',
        accent: 'var(--accent)',
        'accent-ink': 'var(--accent-ink)',
        ok: 'var(--ok)',
        warn: 'var(--warn)',
        bad: 'var(--bad)'
      },
      fontFamily: {
        display: ['"Bricolage Grotesque"', '-apple-system', 'BlinkMacSystemFont', '"SF Pro Display"', '"Segoe UI"', 'system-ui', 'sans-serif'],
        body: ['"Figtree"', '-apple-system', 'BlinkMacSystemFont', '"SF Pro Text"', '"Segoe UI"', 'system-ui', 'sans-serif']
      },
      borderRadius: {
        app: 'var(--r)'
      },
      boxShadow: {
        app: 'var(--shadow)'
      }
    }
  },
  plugins: []
};
