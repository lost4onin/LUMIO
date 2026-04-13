import type { Config } from 'tailwindcss'

const config: Config = {
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
      fontSize: {
        xs: '11px',
        sm: '13px',
        base: ['15px', { lineHeight: '1.9' }],
        md: ['clamp(22px, 3vw, 28px)', { lineHeight: '1.5' }],
        lg: ['clamp(42px, 7vw, 96px)', { lineHeight: '1.2', letterSpacing: '-0.03em' }],
        xl: ['clamp(56px, 10vw, 140px)', { lineHeight: '1.1', letterSpacing: '-0.04em' }],
      },
      letterSpacing: {
        'tight': '-0.02em',
        'normal': '0',
        'wide': '0.04em',
        'wider': '0.15em',
        'widest': '0.2em',
      },
      spacing: {
        safe: 'max(1rem, env(safe-area-inset-bottom))',
      },
    },
  },
  plugins: [],
}

export default config
