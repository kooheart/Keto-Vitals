import type { Config } from "tailwindcss";

// Brand tokens live here so the whole theme can be re-skinned in one place.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: { 50: "#effaf3", 100: "#d8f3e3", 200: "#b4e6cb", 300: "#82d3ab", 400: "#4fba88", 500: "#2d9f6e", 600: "#1f8059", 700: "#1a6648", 800: "#17513b", 900: "#134332", 950: "#0a261c" },
        gold: { 50: "#fdf8e8", 100: "#faeec2", 300: "#f0d070", 400: "#e8bd3f", 500: "#d6a21f", 600: "#b7801a" },
        ink: { 50: "#f6f7f6", 100: "#e9ece9", 200: "#d3d8d4", 300: "#aab3ad", 400: "#7d8981", 500: "#5c6862", 600: "#47514c", 700: "#38403c", 800: "#262c29", 900: "#171b19" },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        display: ["var(--font-display)", "Georgia", "Cambria", "serif"],
      },
      boxShadow: { card: "0 1px 2px rgba(23,27,25,.06), 0 4px 14px rgba(23,27,25,.06)" },
    },
  },
  plugins: [],
};
export default config;
