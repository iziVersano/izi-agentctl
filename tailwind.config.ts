import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        term: {
          bg: "#080b10",
          panel: "#0c1118",
          elevated: "#11171f",
          border: "#1a2532",
          text: "#c4d0dc",
          dim: "#5b6b7b",
          green: "#3ddc97",
          "green-bright": "#5cffb0",
        },
      },
      fontFamily: {
        mono: ["var(--font-space-mono)", "ui-monospace", "monospace"],
        heading: ["var(--font-rajdhani)", "ui-sans-serif", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(61,220,151,0.35), 0 0 16px -4px rgba(61,220,151,0.45)",
        "glow-sm": "0 0 10px -2px rgba(61,220,151,0.4)",
      },
      keyframes: {
        blink: {
          "0%, 49%": { opacity: "1" },
          "50%, 100%": { opacity: "0" },
        },
      },
      animation: {
        blink: "blink 1.1s step-end infinite",
      },
    },
  },
  plugins: [],
};

export default config;
