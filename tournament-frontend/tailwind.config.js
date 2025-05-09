/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx}",
    "./src/components/**/*.{js,ts,jsx,tsx}",
    "./src/app/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'neon-blue': '#00A3FF',
        'neon-green': '#00FF85',
        'dark-bg': '#121212',
      },
      boxShadow: {
        'neon': '0 0 5px rgba(0, 163, 255, 0.5), 0 0 20px rgba(0, 163, 255, 0.3)',
      },
    },
  },
  plugins: [],
} 