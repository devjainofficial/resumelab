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
        // display: alias for interDisplay-style headings (GeistSans is visually equivalent)
        display: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
        serif: ["var(--font-serif)", "Palatino", "Georgia", "serif"],
      },
      borderRadius: {
        sm: "6px",
        md: "10px",
        lg: "14px",
      },
      letterSpacing: {
        // Attio-matched tracking scale
        "heading-xl": "-1.28px", // H1 at 64px
        "heading-lg": "-0.4px",  // H2 at 40px
        "heading-md": "-0.3px",  // H3 at ~30px
        "heading-sm": "-0.16px", // H4 + nav text
        ui: "-0.07px",           // Buttons, labels
      },
    },
  },
  plugins: [],
};

export default config;
