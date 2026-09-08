import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/app/**/*.{js,ts,jsx,tsx,mdx}", "./src/components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        "navy-900": "var(--color-navy-900)",
        "navy-800": "var(--color-navy-800)",
        "teal-600": "var(--color-teal-600)",
        "teal-500": "var(--color-teal-500)",
        "teal-100": "var(--color-teal-100)",
        "amber-500": "var(--color-amber-500)",
        "amber-100": "var(--color-amber-100)",
        cloud: "var(--color-cloud)",
        surface: "var(--color-surface)",
        ink: "var(--color-ink)",
        slate: "var(--color-slate)",
        mist: "var(--color-mist)",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Arial", "sans-serif"],
        display: ["var(--font-sora)", "var(--font-inter)", "Arial", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
