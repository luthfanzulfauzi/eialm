import type { Config } from "tailwindcss";

const config: Config = {
  // Ensure the scanner hits every file in the src directory
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#0f1218",
        foreground: "#f8fafc",
      },
    },
  },
  plugins: [],
};
export default config;