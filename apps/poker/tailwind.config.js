/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        felt: '#0d5c2e',
        'felt-dark': '#094a24',
        'felt-light': '#1a7a3f',
        'table-top': '#2a8ac0',
        'table-mid': '#1a6090',
        'table-deep': '#0f3d5c',
        'table-rim': '#082d42',
        'room': '#060c18',
      },
    },
  },
  plugins: [],
};
