import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#0a0a0f",
        surface: "#12121a",
        "surface-light": "#1a1a25",
        border: "#2a2a3a",
        accent: "#00d4aa",
        "accent-red": "#ff6b6b",
        "accent-yellow": "#ffd93d",
      },
      fontFamily: {
        mono: ["ui-monospace", "SFMono-Regular", "SF Mono", "Menlo", "Monaco", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
