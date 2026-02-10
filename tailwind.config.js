/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'galaxy-dark': '#0a0015',
        'purple-nebula': '#2a0055',
        'pink-neon': '#ff1493',
        'cyan-neon': '#00ffff',
        'lime-neon': '#39ff14',
      },
      fontFamily: {
        'orbitron': ['Orbitron', 'sans-serif'],
        'vcr': ['monospace'],
      },
      backgroundImage: {
        'galaxy-bg': 'radial-gradient(ellipse at bottom, #1b113f 0%, #0a0015 40%, #000 70%), radial-gradient(ellipse at top, #ff1493 0%, transparent 50%), radial-gradient(ellipse at right, #00ffff20 0%, transparent 50%)',
      },
      boxShadow: {
        'neon-glow': '0 0 20px #ff1493, 0 0 40px #ff1493',
        'cyan-glow': '0 0 20px #00ffff, 0 0 40px #00ffff',
      }
    },
  },
  plugins: [],
}