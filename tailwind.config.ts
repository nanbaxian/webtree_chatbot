import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#1a1410',
          soft: '#4a3f35',
          mute: '#9a8a7a',
        },
        paper: {
          DEFAULT: '#f5f0e8',
          warm: '#ede6d6',
          deep: '#e0d5c0',
        },
        gold: '#b8860b',
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar-background))',
          foreground: 'hsl(var(--sidebar-foreground))',
          primary: 'hsl(var(--sidebar-primary))',
          'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
          accent: 'hsl(var(--sidebar-accent))',
          'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
          border: 'hsl(var(--sidebar-border))',
          ring: 'hsl(var(--sidebar-ring))',
        },
        glass: 'hsl(var(--glass))',
        'bubble-ai': 'hsl(var(--bubble-ai))',
        'bubble-user': 'hsl(var(--bubble-user))',
        'bubble-user-foreground': 'hsl(var(--bubble-user-foreground))',
        'typing-dot': 'hsl(var(--typing-dot))',
      },
      fontFamily: {
        sans: ['Inter', 'Noto Sans SC', 'sans-serif'],
        serif: ['Noto Serif SC', 'serif'],
        display: ['Noto Serif SC', 'serif'],
      },
      boxShadow: {
        glow: '0 2px 12px hsl(var(--glow-primary)/0.18)',
        card: '0 2px 12px hsl(var(--background)/0.25)',
        modal: '0 20px 60px hsl(var(--background)/0.45)',
      },
      animation: {
        'fade-in': 'fadeIn 0.25s ease both',
        'slide-up': 'slideUp 0.25s ease both',
        typing: 'typing 1.2s infinite',
        blink: 'blink 1s step-end infinite',
        'record-pulse': 'recordPulse 1s infinite',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(20px) scale(0.97)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        typing: {
          '0%, 100%': { transform: 'translateY(0)', opacity: '0.5' },
          '50%': { transform: 'translateY(-5px)', opacity: '1' },
        },
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
        recordPulse: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(196, 67, 42, 0.3)' },
          '50%': { boxShadow: '0 0 0 6px rgba(196, 67, 42, 0)' },
        },
      },
    },
  },
  plugins: [],
}

export default config
