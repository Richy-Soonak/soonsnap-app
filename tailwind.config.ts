/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        gold: '#FDCA57',
        teal: '#43C4CC',
        void: '#0F0F1A',
        card: '#1a1a2e',
        border: '#2a2a3e',
      },
    },
  },
  plugins: [],
}
