/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: '#09090b',     // zinc-950
          card: '#18181b',        // zinc-900
          hover: '#27272a',       // zinc-800
          input: '#1c1c1f',
        },
        fg: {
          DEFAULT: '#fafafa',     // zinc-50
          muted: '#a1a1aa',       // zinc-400
          dim: '#71717a',         // zinc-500
        },
        border: {
          DEFAULT: '#27272a',     // zinc-800
          hover: '#3f3f46',       // zinc-700
        },
        accent: {
          DEFAULT: '#6366f1',     // indigo-500
          hover: '#4f46e5',       // indigo-600
          muted: '#312e81',       // indigo-900
        },
        success: '#22c55e',
        warning: '#f59e0b',
        danger: '#ef4444',
      },
      keyframes: {
        'slide-in': {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'pulse-dot': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.3' },
        },
      },
      animation: {
        'slide-in': 'slide-in 0.3s ease-out',
        'fade-in': 'fade-in 0.2s ease-out',
        'pulse-dot': 'pulse-dot 1.5s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
