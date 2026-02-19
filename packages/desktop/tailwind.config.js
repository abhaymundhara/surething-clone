/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: { DEFAULT: '#0f0f10', card: '#1a1a1d', hover: '#222225' },
        fg: { DEFAULT: '#e4e4e7', muted: '#71717a' },
        accent: { DEFAULT: '#6366f1', hover: '#818cf8' },
        border: '#27272a',
      },
    },
  },
  plugins: [],
};
