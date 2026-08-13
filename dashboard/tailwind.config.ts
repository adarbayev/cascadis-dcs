import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#14211d",
        forest: {
          50: "#eef8f5",
          100: "#d8efe8",
          200: "#b4dfd3",
          300: "#82c7b7",
          400: "#4ca796",
          500: "#318979",
          600: "#276e63",
          700: "#225950",
          800: "#1e4842",
          900: "#193c37"
        },
        lime: {
          300: "#c4f365",
          400: "#a9df45",
          500: "#8bc52e"
        },
        sand: "#ebe9df",
        paper: "#f8f6ef",
        signal: "#dff04f",
        rust: "#b65335",
        tide: "#176b72"
      },
      boxShadow: {
        card: "0 1px 0 rgba(20, 33, 29, 0.08)",
        lift: "-18px 0 60px rgba(20, 33, 29, 0.16)"
      },
      fontFamily: {
        sans: ["Poppins", "Helvetica Neue", "Segoe UI", "sans-serif"],
        display: ["Poppins", "Helvetica Neue", "Segoe UI", "sans-serif"],
        mono: ["Poppins", "Helvetica Neue", "Segoe UI", "sans-serif"]
      }
    }
  },
  plugins: []
} satisfies Config;
