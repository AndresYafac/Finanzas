/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  important: true,
  theme: {
    extend: {
      colors: {
        fintrack: {
          navy: '#0f1b2d',
          green: '#1d9e75',
          greenDark: '#087456',
          red: '#ef4444',
          muted: '#64748b',
          line: '#d9e4ef',
          surface: '#ffffff',
          soft: '#f7fbfd',
        },
      },
      boxShadow: {
        soft: '0 18px 45px rgba(15, 23, 42, 0.08)',
        glow: '0 12px 30px rgba(29, 158, 117, 0.18)',
      },
    },
  },
  plugins: [],
};
