/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: '#f5f4f0',
        ink: '#1a1a1a',
        accent: '#ff5c00',
        muted: '#999999',
        surface: '#eeecea',
        border: 'rgba(26, 26, 26, 0.10)',
      },
      fontFamily: {
        display: ['Syne', 'sans-serif'],
        mono: ['Syne Mono', 'monospace'],
      },
      spacing: {
        safe: 'max(1rem, env(safe-area-inset-bottom))',
      },
    },
  },
  plugins: [],
}
