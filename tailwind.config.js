/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Sora', 'sans-serif'],
        display: ['Fraunces', 'serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        soft: '0 24px 60px -40px rgba(15, 23, 42, 0.45)',
        card: '0 18px 35px -25px rgba(15, 23, 42, 0.4)',
      },
    },
  },
  plugins: [],
}
