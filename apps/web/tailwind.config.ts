import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: { extend: {
    colors: { obsidian: '#050505', carbon: '#121212', graphite: '#1A1A1A', volt: '#CCFF00', steel: '#94A3B8', charcoal: '#2A2A2A' },
    fontFamily: { mono: ['Roboto Mono', 'monospace'], sans: ['Inter', 'system-ui', 'sans-serif'] },
    borderRadius: { DEFAULT: '8px' }
  } },
  plugins: []
} satisfies Config;
