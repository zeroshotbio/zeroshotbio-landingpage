import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: 'class', // Enable dark mode with class strategy
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
      colors: {
        // Override all Tailwind gray colors with true gray/black shades (no blue tint)
        gray: {
          50: '#f9f9f9',    // Lightest gray
          100: '#f2f2f2',   // Very light gray
          200: '#e6e6e6',   // Light gray
          300: '#d1d1d1',   // Light medium gray
          400: '#acacac',   // Medium gray
          500: '#919191',   // Medium gray
          600: '#6e6e6e',   // Medium dark gray
          700: '#4b4b4b',   // Dark gray
          800: '#2c2c2c',   // Very dark gray
          900: '#0a0a0a',   // Near black
        },
        "teal-color": "#243333",
      },
    },
  },
  plugins: [],
};

export default config;