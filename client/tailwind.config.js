/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
      colors: {
        ink: { 950: '#f5f8f5', 900: '#ffffff', 800: '#f1f6f2', 700: '#e6f0e8' },
        slate: {
          50: '#f4f8f5', 100: '#244231', 200: '#365642', 300: '#4c6a55',
          400: '#647f6a', 500: '#78907d', 600: '#8da392', 700: '#b4c6b8',
          800: '#d2e0d5', 900: '#e7f0e9', 950: '#f5f8f5',
        },
      },
      boxShadow: {
        glass: '0 10px 28px 0 rgba(24,72,43,.06), inset 0 1px 0 0 rgba(255,255,255,.95)',
        glow: '0 5px 16px -6px rgba(23,106,57,.22)',
      },
      keyframes: {
        float: { '0%,100%': { transform: 'translate3d(0,0,0)' }, '50%': { transform: 'translate3d(0,-30px,0)' } },
        dot: { '0%,80%,100%': { opacity: '.25', transform: 'translateY(0)' }, '40%': { opacity: '1', transform: 'translateY(-3px)' } },
      },
      animation: { float: 'float 14s ease-in-out infinite', dot: 'dot 1.2s infinite' },
    },
  },
  plugins: [],
};
