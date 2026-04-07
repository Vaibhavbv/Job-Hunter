/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Core palette
        'dark-bg':     '#0a0a0f',
        'dark-card':   '#12121a',
        'dark-border': '#1e1e2e',
        'dark-hover':  '#1a1a28',
        'dark-muted':  '#8b8da3',

        // Accent colors
        'accent':      '#00ff88',
        'accent-dim':  '#00cc6a',
        'cold-blue':   '#4fc3f7',
        'cold-dim':    '#3a9fd4',

        // Premium accent palette
        'violet':      '#667eea',
        'violet-dim':  '#5a6fd6',
        'indigo':      '#764ba2',
        'cyan':        '#06b6d4',

        // Platform colors
        'linkedin':    '#0a66c2',
        'naukri':      '#16a34a',
        'indeed':      '#d97706',

        // Status colors
        'status-applied':    '#4fc3f7',
        'status-interview':  '#fbbf24',
        'status-offer':      '#00ff88',
        'status-rejected':   '#ef4444',

        // Light mode overrides
        'light-bg':    '#f8f9fb',
        'light-card':  '#ffffff',
        'light-border':'#e2e4ea',
      },
      fontFamily: {
        mono:    ['"JetBrains Mono"', 'Fira Code', 'monospace'],
        display: ['"Syne"', 'Inter', 'system-ui', 'sans-serif'],
        body:    ['"Inter"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'glow':        '0 0 20px rgba(0, 255, 136, 0.15)',
        'glow-strong': '0 0 40px rgba(0, 255, 136, 0.25)',
        'glow-blue':   '0 0 20px rgba(79, 195, 247, 0.15)',
        'glow-violet': '0 0 20px rgba(102, 126, 234, 0.15)',
        'card':        '0 4px 20px rgba(0, 0, 0, 0.3)',
        'card-hover':  '0 8px 40px rgba(0, 0, 0, 0.4)',
        'premium':     '0 20px 60px rgba(0, 0, 0, 0.4), 0 0 100px rgba(0, 255, 136, 0.03)',
      },
      borderRadius: {
        'xl': '16px',
        '2xl': '20px',
      },
      animation: {
        'pulse-dot':      'pulse-dot 2s ease-in-out infinite',
        'shimmer':        'shimmer 2s ease-in-out infinite',
        'float':          'float 6s ease-in-out infinite',
        'gradient-rotate': 'gradient-rotate 8s linear infinite',
        'pulse-glow':     'pulse-glow 3s ease-in-out infinite',
      },
      keyframes: {
        'pulse-dot': {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%':      { opacity: '0.5', transform: 'scale(1.5)' },
        },
        'shimmer': {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%':      { transform: 'translateY(-10px)' },
        },
        'gradient-rotate': {
          '0%':   { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 20px rgba(0, 255, 136, 0.1)' },
          '50%':      { boxShadow: '0 0 40px rgba(0, 255, 136, 0.2)' },
        },
      },
    },
  },
  plugins: [],
}
