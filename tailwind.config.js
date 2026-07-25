import tailgridsPlugin from 'tailgrids/plugin';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['"Space Grotesk"', 'Inter', 'system-ui', 'sans-serif']
      },
      colors: {
        // Warna brand via CSS variables → tema bisa diganti runtime per-tenant
        // (default Electric Blue di globals.css, preset lain di utils/themes.js)
        brand: {
          50: 'rgb(var(--brand-50) / <alpha-value>)',
          100: 'rgb(var(--brand-100) / <alpha-value>)',
          200: 'rgb(var(--brand-200) / <alpha-value>)',
          300: 'rgb(var(--brand-300) / <alpha-value>)',
          400: 'rgb(var(--brand-400) / <alpha-value>)',
          500: 'rgb(var(--brand-500) / <alpha-value>)',
          600: 'rgb(var(--brand-600) / <alpha-value>)',
          700: 'rgb(var(--brand-700) / <alpha-value>)',
          800: 'rgb(var(--brand-800) / <alpha-value>)',
          900: 'rgb(var(--brand-900) / <alpha-value>)',
          950: '#0b1220'
        },
        accent: {
          300: 'rgb(var(--accent-300) / <alpha-value>)',
          400: 'rgb(var(--accent-400) / <alpha-value>)',
          500: 'rgb(var(--accent-500) / <alpha-value>)',
          600: 'rgb(var(--accent-600) / <alpha-value>)'
        },
        // Navy gelap untuk sidebar & halaman auth (statis, tak ikut tema)
        navy: {
          700: '#1a2340',
          800: '#111a33',
          900: '#0b1220',
          950: '#070c18'
        }
      },
      boxShadow: {
        // Depth halus ala Linear/Vercel — nyaris flat, mengandalkan border tipis
        card: '0 1px 2px 0 rgb(15 23 42 / 0.04)',
        'card-hover': '0 2px 4px -1px rgb(15 23 42 / 0.06), 0 8px 16px -6px rgb(15 23 42 / 0.08)',
        glow: '0 0 24px 0 rgb(var(--brand-600) / 0.28)',
        'glow-cyan': '0 0 32px 0 rgb(var(--accent-500) / 0.25)'
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1.125rem'
      },
      backgroundImage: {
        'brand-gradient':
          'linear-gradient(135deg, rgb(var(--brand-600)) 0%, rgb(var(--accent-500)) 100%)',
        'auth-mesh':
          'radial-gradient(at 20% 20%, rgb(var(--brand-600) / 0.35) 0, transparent 50%), radial-gradient(at 80% 10%, rgb(var(--accent-500) / 0.25) 0, transparent 50%), radial-gradient(at 60% 80%, rgb(var(--brand-500) / 0.28) 0, transparent 55%)'
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' }
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' }
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.97)' },
          to: { opacity: '1', transform: 'scale(1)' }
        }
      },
      animation: {
        'fade-in': 'fade-in 0.25s ease-out',
        'slide-up': 'slide-up 0.3s ease-out',
        'scale-in': 'scale-in 0.2s ease-out'
      }
    }
  },
  plugins: [tailgridsPlugin]
};
