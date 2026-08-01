/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // StatusNeo-inspired bright signature yellow
        brand: {
          50: '#fffdf2',
          100: '#fff9d6',
          200: '#fff0a3',
          300: '#ffe566',
          400: '#ffd60a',
          500: '#f5c518',
          600: '#d9a400',
          700: '#a87d00',
          800: '#875f00',
          900: '#6e4e0a',
        },
        // Near-black surfaces for the hero + dark accents
        ink: {
          950: '#0a0a0b',
          900: '#111114',
          850: '#17171b',
          800: '#1f1f24',
          700: '#2a2a30',
          600: '#3a3a42',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 60px -12px rgba(255, 214, 10, 0.55)',
        card: '0 1px 3px rgba(0,0,0,0.06), 0 10px 30px -18px rgba(0,0,0,0.25)',
      },
    },
  },
  plugins: [],
};
