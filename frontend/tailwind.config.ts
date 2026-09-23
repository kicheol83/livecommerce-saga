import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        pine: { DEFAULT: "#16302B", 600: "#1F403A", 400: "#3C5E57" },
        cranberry: { DEFAULT: "#C8203F", 700: "#A11833" },
        frost: { DEFAULT: "#EEF3F3", 300: "#D6E1E1" },
        mustard: "#E0A526",
        ash: "#5B6B70"
      },
      fontFamily: {
        sans: [
          "Pretendard Variable",
          "Pretendard",
          "-apple-system",
          "BlinkMacSystemFont",
          "Apple SD Gothic Neo",
          "Malgun Gothic",
          "sans-serif"
        ]
      },
      keyframes: {
        drift: {
          from: { backgroundPosition: "0 0" },
          to: { backgroundPosition: "0 -96px" }
        },
        pulse_once: {
          "0%": { transform: "scale(1)" },
          "30%": { transform: "scale(1.12)" },
          "100%": { transform: "scale(1)" }
        },
        sheet_in: {
          from: { transform: "translateY(100%)" },
          to: { transform: "translateY(0)" }
        },
        fade_in: {
          from: { opacity: "0" },
          to: { opacity: "1" }
        }
      },
      animation: {
        drift: "drift 18s linear infinite",
        pulse_once: "pulse_once 420ms ease-out",
        sheet_in: "sheet_in 280ms cubic-bezier(0.2, 0.8, 0.2, 1)",
        fade_in: "fade_in 200ms ease-out"
      }
    }
  },
  plugins: []
};

export default config;
