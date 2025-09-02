/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}'
  ],
  theme: {
    extend: {
      colors: {
        coffee: {
          50: '#F8F5F2',
          100: '#F1E8E1',
          200: '#E2D1C2',
          300: '#C9AE97',
          400: '#A9826A',
          500: '#8A644C',
          600: '#6E4E3B',
          700: '#533A2C',
          800: '#3A281F',
          900: '#241810'
        }
      }
    }
  },
  plugins: []
}
