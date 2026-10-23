import type { Config } from 'tailwindcss';
import { COLORS } from './lib/colors';

// Tailwind 3.4.x
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        aqua: COLORS.aqua,
        mint: COLORS.mint,
        lime: COLORS.lime,
        lavender: COLORS.lavender,
        pink: COLORS.pink,
        ash: COLORS.ash,
        ink: { DEFAULT: COLORS.ink, soft: COLORS.inkSoft },
        paper: COLORS.paper,
      },
      fontFamily: {
        // Las tres familias del moodboard: Poppins (interfaz), Bebas Neue (marca), Lora (voz cercana)
        sans: ['var(--font-poppins)', 'system-ui', 'sans-serif'],
        display: ['var(--font-bebas)', 'Impact', 'sans-serif'],
        serif: ['var(--font-lora)', 'Georgia', 'serif'],
      },
      keyframes: {
        // El "sellado": el sello cae, rebota apenas y queda apoyado. Una sola vez, al cargar.
        stamp: {
          '0%': { opacity: '0', transform: 'scale(1.7) rotate(-16deg)' },
          '55%': { opacity: '1', transform: 'scale(0.93) rotate(-7deg)' },
          '75%': { opacity: '1', transform: 'scale(1.03) rotate(-6deg)' },
          '100%': { opacity: '1', transform: 'scale(1) rotate(-6deg)' },
        },
        // Onda de tinta que se expande desde el sello
        ink: {
          '0%': { opacity: '0.55', transform: 'scale(0.92)' },
          '100%': { opacity: '0', transform: 'scale(1.4)' },
        },
        draw: {
          from: { strokeDashoffset: '1' },
          to: { strokeDashoffset: '0' },
        },
      },
      animation: {
        stamp: 'stamp 700ms cubic-bezier(.2,.8,.2,1) 450ms both',
        ink: 'ink 1000ms ease-out 1050ms both',
        draw: 'draw 450ms ease-out 1150ms both',
      },
    },
  },
  plugins: [],
};

export default config;
