/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Navy Blue Color Palette
        primary: {
          DEFAULT: '#1e293b', // Navy blue (from navbar)
          secondary: '#2d3a4b',
          accent: '#1e293b',
          'accent-hover': '#2d3a4b',
        },
        status: {
          active: '#059669', // Green
          inactive: '#dc2626', // Red
          warning: '#d97706', // Orange
          info: '#2563eb', // Blue
        },
        border: '#e5e7eb',
        gray: {
          50: '#f9fafb',
          100: '#f3f4f6',
          200: '#e5e7eb',
          300: '#d1d5db',
          400: '#9ca3af',
          500: '#6b7280',
          600: '#4b5563',
          700: '#374151',
          800: '#1f2937',
          900: '#111827',
        },
        navy: {
          200: '#e2e8f0',
          300: '#cbd5e1',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
        },
        content: '#f9fafb',
        background: '#ffffff',
        foreground: '#1f2937',
        muted: '#f3f4f6',
        'muted-foreground': '#6b7280',
        popover: '#ffffff',
        'popover-foreground': '#1f2937',
        card: '#ffffff',
        'card-foreground': '#1f2937',
        input: '#e5e7eb',
        destructive: '#dc2626',
        'destructive-foreground': '#ffffff',
        ring: '#2563eb',
      },
      fontFamily: {
        sans: ['"Segoe UI"', '-apple-system', 'BlinkMacSystemFont', '"Roboto"', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '6px',
        large: '8px',
      },
      spacing: {
        'sm': '8px',
        'md': '16px',
        'lg': '24px',
        'xl': '32px',
      },
      boxShadow: {
        'sm': '0 1px 3px rgba(44, 62, 80, 0.1)',
        'md': '0 2px 8px rgba(44, 62, 80, 0.15)',
        'lg': '0 4px 16px rgba(44, 62, 80, 0.1)',
      },
      transitionDuration: {
        'fast': '200ms',
        'normal': '300ms',
      },
    },
  },
  plugins: [],
}
