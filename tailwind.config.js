/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        water: {
          50: '#eefbfd',
          100: '#d6f2f8',
          200: '#afe7f2',
          300: '#7ed7ea',
          400: '#44bedb',
          500: '#1ca2c4',
          600: '#1382a3',
          700: '#126984',
          800: '#14566b',
          900: '#15485a',
        },
      },
      boxShadow: {
        panel: '0 15px 35px rgba(12, 44, 64, 0.16)',
      },
      fontFamily: {
        sans: ['Manrope', 'sans-serif'],
        display: ['Barlow Condensed', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

