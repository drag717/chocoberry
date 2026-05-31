/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'Manrope', 'system-ui', 'sans-serif'],
        display: ['Cormorant Garamond', 'Georgia', 'serif'],
      },
      colors: {
        berry: {
          50: '#fff1f2',
          100: '#ffe4e6',
          500: '#e11d48',
          600: '#be123c',
          700: '#9f1239',
          900: '#4c0519',
        },
        chocolate: {
          50: '#faf6f2',
          100: '#efe3d8',
          500: '#7c4a2d',
          700: '#4b2b1c',
          900: '#24130c',
        },
        cream: '#fffaf5',
      },
      boxShadow: {
        premium: '0 24px 80px rgba(76, 5, 25, 0.16)',
        soft: '0 14px 40px rgba(36, 19, 12, 0.10)',
      },
      keyframes: {
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(18px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
      },
      animation: {
        fadeUp: 'fadeUp 0.55s ease-out both',
        float: 'float 5s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
