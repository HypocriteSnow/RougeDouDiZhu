/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        table: {
          950: '#041814',
          900: '#072720',
          800: '#0c3a31',
          700: '#145245',
        },
        brass: {
          300: '#f3d89f',
          400: '#d8b77e',
          500: '#b08c55',
          600: '#8a6a3d',
        },
      },
      boxShadow: {
        brass: '0 0 0 1px rgba(176,140,85,0.45), 0 10px 25px rgba(0,0,0,0.35)',
        glow: '0 0 20px rgba(255, 204, 128, 0.35)',
      },
      fontFamily: {
        display: ['"Noto Serif SC"', 'serif'],
        ui: ['"Rajdhani"', '"Noto Sans SC"', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
