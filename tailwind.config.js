import tailgridsPlugin from 'tailgrids/plugin';

/** @type {import('tailwindcss').Config} */
export default {
  // Varian `dark:` menempel pada atribut data-theme, bukan prefers-color-scheme:
  // mode dikendalikan pengguna dari Pengaturan, bukan setelan sistem operasi.
  darkMode: ['class', '[data-theme="dark"]'],
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
        // Navy — permukaan yang SELALU gelap (scrim modal, splash, halaman auth).
        // Sengaja tidak ikut mode: scrim harus tetap gelap walau mode terang,
        // dan halaman auth memang dirancang teks terang di atas latar gelap.
        navy: {
          700: '#1a2340',
          800: '#111a33',
          900: '#0b1220',
          950: '#070c18'
        },
        // Scrim — lapisan gelap di belakang modal/drawer/lightbox. Nilainya tetap
        // gelap di kedua mode: scrim putih di mode gelap membuat dialog terbaca
        // seolah tanpa pemisah dari latar.
        scrim: 'rgb(7 12 24 / <alpha-value>)',
        // Emas institusional (Sovereign Gold) — penanda status Retensi
        gold: {
          DEFAULT: 'rgb(var(--gold) / <alpha-value>)',
          deep: 'rgb(var(--gold-deep) / <alpha-value>)',
          soft: 'rgb(var(--gold-soft) / <alpha-value>)'
        },
        // Slate di-remap ke variabel: satu definisi menyesuaikan mode untuk
        // seluruh halaman, sehingga komponen tidak perlu tahu mode aktif.
        slate: {
          50: 'rgb(var(--slate-50) / <alpha-value>)',
          100: 'rgb(var(--slate-100) / <alpha-value>)',
          200: 'rgb(var(--slate-200) / <alpha-value>)',
          300: 'rgb(var(--slate-300) / <alpha-value>)',
          400: 'rgb(var(--slate-400) / <alpha-value>)',
          500: 'rgb(var(--slate-500) / <alpha-value>)',
          600: 'rgb(var(--slate-600) / <alpha-value>)',
          700: 'rgb(var(--slate-700) / <alpha-value>)',
          800: 'rgb(var(--slate-800) / <alpha-value>)',
          900: 'rgb(var(--slate-900) / <alpha-value>)',
          950: 'rgb(var(--slate-950) / <alpha-value>)'
        }
      },
      boxShadow: {
        // Bayangan kaca bertingkat (nilainya di globals.css per mode)
        card: 'var(--shadow-glass)',
        'card-hover': 'var(--shadow-glass-lg)',
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
        },
        // Kilau melintas untuk skeleton loader
        shimmer: {
          '100%': { transform: 'translateX(100%)' }
        }
      },
      animation: {
        'fade-in': 'fade-in 0.25s ease-out',
        'slide-up': 'slide-up 0.3s ease-out',
        'scale-in': 'scale-in 0.2s ease-out',
        shimmer: 'shimmer 1.6s infinite'
      }
    }
  },
  plugins: [tailgridsPlugin]
};
