import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "var(--paper)",
        surface: "var(--surface)",
        sunken: "var(--sunken)",
        ink: {
          DEFAULT: "var(--ink)",
          soft: "var(--ink-soft)",
        },
        muted: "var(--muted)",
        line: {
          DEFAULT: "var(--line)",
          strong: "var(--line-strong)",
        },
        brand: {
          DEFAULT: "var(--brand)",
          strong: "var(--brand-strong)",
          tint: "var(--brand-tint)",
          on: "var(--on-brand)",
        },
        caution: {
          DEFAULT: "var(--caution)",
          tint: "var(--caution-tint)",
        },
        critical: {
          DEFAULT: "var(--critical)",
          tint: "var(--critical-tint)",
        },
        violet: {
          DEFAULT: "var(--violet)",
          tint: "var(--violet-tint)",
          strong: "var(--violet-strong)",
        },
        info: {
          DEFAULT: "var(--info)",
          tint: "var(--info-tint)",
        },
      },
      fontFamily: {
        serif: ["var(--font-serif)", "Palatino", "Georgia", "serif"],
        // geist package sets --font-geist-sans / --font-geist-mono on <body>
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
      },
      borderRadius: {
        sm: "6px",
        md: "10px",
        lg: "14px",
      },
    },
  },
  plugins: [],
};

export default config;
