import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        border: "#E5E7EB",
        ink: "#0F172A",
        muted: "#64748B",
        panel: "#FFFFFF",
        surface: "#F8FAFC",
        accent: "#0F766E",
        accentSoft: "#CCFBF1",
        danger: "#B91C1C",
        warm: "#B45309"
      },
      boxShadow: {
        card: "0 12px 40px rgba(15, 23, 42, 0.06)"
      },
      fontFamily: {
        sans: ["var(--font-sans)"]
      }
    }
  },
  plugins: []
};

export default config;
