/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0f172a',
        panel: '#111827',
        accent: '#22c55e',
      },
    },
  },
  plugins: [],
}
