module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#050807",
        surface: "#0B1210",
        accent: "#39FF88",
        text: "#E9FFF2",
      },
      boxShadow: {
        glow: "0 0 14px rgba(57, 255, 136, 0.35)",
        "glow-lg": "0 0 24px rgba(57, 255, 136, 0.4)",
        "glow-xl": "0 0 40px rgba(57, 255, 136, 0.3)",
        "glow-hero": "0 0 60px rgba(57, 255, 136, 0.2)",
        // Subtle neon-tinted shadows for depth
        "neon-sm": "0 2px 8px rgba(57, 255, 136, 0.15), 0 0 2px rgba(57, 255, 136, 0.1)",
        "neon-md": "0 4px 16px rgba(57, 255, 136, 0.2), 0 0 4px rgba(57, 255, 136, 0.15)",
        "neon-lg": "0 8px 24px rgba(57, 255, 136, 0.25), 0 0 8px rgba(57, 255, 136, 0.2)",
        "neon-card": "0 4px 20px rgba(57, 255, 136, 0.12), 0 0 1px rgba(57, 255, 136, 0.08)",
        "neon-card-hover": "0 6px 28px rgba(57, 255, 136, 0.2), 0 0 2px rgba(57, 255, 136, 0.15)",
      },
      animation: {
        "fade-in": "fadeIn 0.5s ease-out",
        "fade-in-delay": "fadeIn 0.5s ease-out 0.15s both",
        "fade-in-delay-2": "fadeIn 0.5s ease-out 0.3s both",
        "glow-pulse": "glowPulse 3s ease-in-out infinite",
        "float": "float 6s ease-in-out infinite",
        "lift": "lift 0.3s ease-out",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        glowPulse: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.85" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-8px)" },
        },
        lift: {
          "0%": { transform: "translateY(0)" },
          "100%": { transform: "translateY(-2px)" },
        },
      },
    },
  },
  plugins: [],
};
