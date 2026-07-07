import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      backgroundImage: {
        'gradient-primary': 'var(--gradient-primary)',
        'gradient-secondary': 'var(--gradient-secondary)',
        'gradient-accent': 'var(--gradient-accent)',
        'gradient-card': 'var(--gradient-card)',
      },
      boxShadow: {
        'glow': 'var(--shadow-glow)',
        'card': 'var(--shadow-card)',
        'elegant': 'var(--shadow-elegant)',
      },
      transitionProperty: {
        'smooth': 'var(--transition-smooth)',
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
        "fade-in": {
          "0%": {
            opacity: "0",
            transform: "translateY(10px)"
          },
          "100%": {
            opacity: "1",
            transform: "translateY(0)"
          }
        },
        "scale-in": {
          "0%": {
            transform: "scale(0.95)",
            opacity: "0"
          },
          "100%": {
            transform: "scale(1)",
            opacity: "1"
          }
        },
        "price-pulse": {
          "0%, 100%": {
            opacity: "1",
            transform: "scale(1)"
          },
          "50%": {
            opacity: "0.8",
            transform: "scale(1.05)"
          }
        },
        "warning-pulse": {
          "0%, 100%": {
            opacity: "1",
            transform: "scale(1)"
          },
          "50%": {
            opacity: "0.6",
            transform: "scale(1.1)"
          }
        },
        "bounce-hover": {
          "0%, 100%": {
            transform: "translateY(0)"
          },
          "25%": {
            transform: "translateY(-6px)"
          },
          "50%": {
            transform: "translateY(0)"
          },
          "75%": {
            transform: "translateY(-3px)"
          }
        },
        "float-up": {
          "0%": {
            transform: "translateY(0) translateX(0) rotate(0deg) scale(0.8)",
            opacity: "0"
          },
          "10%": {
            transform: "translateY(-5vh) translateX(5px) rotate(3deg) scale(1.1)",
            opacity: "1"
          },
          "50%": {
            transform: "translateY(-45vh) translateX(40px) rotate(12deg) scale(1)",
            opacity: "1"
          },
          "100%": {
            transform: "translateY(-105vh) translateX(100px) rotate(20deg) scale(0.9)",
            opacity: "0"
          }
        },
        "particle-burst": {
          "0%": {
            transform: "scale(0) translate(0, 0)",
            opacity: "1"
          },
          "50%": {
            transform: "scale(1.5) translate(var(--tx, 10px), var(--ty, -10px))",
            opacity: "0.8"
          },
          "100%": {
            transform: "scale(0) translate(var(--tx2, 20px), var(--ty2, -30px))",
            opacity: "0"
          }
        },
        "pulse-glow": {
          "0%, 100%": {
            opacity: "0.4",
            transform: "scale(1)"
          },
          "50%": {
            opacity: "0.8",
            transform: "scale(1.15)"
          }
        },
        "logo-spin": {
          "0%": {
            transform: "rotate(0deg) scale(1)"
          },
          "25%": {
            transform: "rotate(-8deg) scale(1.05)"
          },
          "50%": {
            transform: "rotate(8deg) scale(1)"
          },
          "75%": {
            transform: "rotate(-5deg) scale(1.02)"
          },
          "100%": {
            transform: "rotate(0deg) scale(1)"
          }
        },
        "text-flash": {
          "0%, 100%": {
            opacity: "1",
            transform: "scale(1)"
          },
          "25%": {
            opacity: "0.9",
            transform: "scale(1.08)"
          },
          "50%": {
            opacity: "1",
            transform: "scale(1.12)"
          },
          "75%": {
            opacity: "0.95",
            transform: "scale(1.05)"
          }
        },
        "sparkle": {
          "0%, 100%": {
            opacity: "0",
            transform: "scale(0) rotate(0deg)"
          },
          "50%": {
            opacity: "1",
            transform: "scale(1.2) rotate(180deg)"
          }
        },
        "flame-flicker": {
          "0%, 100%": {
            transform: "translateX(-50%) scaleY(1) scaleX(1)",
            opacity: "0.9"
          },
          "25%": {
            transform: "translateX(-50%) scaleY(1.15) scaleX(0.9)",
            opacity: "1"
          },
          "50%": {
            transform: "translateX(-50%) scaleY(0.9) scaleX(1.1)",
            opacity: "0.85"
          },
          "75%": {
            transform: "translateX(-50%) scaleY(1.1) scaleX(0.95)",
            opacity: "1"
          }
        },
        "smoke": {
          "0%": {
            transform: "translateY(0) scale(1)",
            opacity: "0.5"
          },
          "50%": {
            transform: "translateY(8px) scale(1.5)",
            opacity: "0.3"
          },
          "100%": {
            transform: "translateY(16px) scale(2)",
            opacity: "0"
          }
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.3s ease-out",
        "scale-in": "scale-in 0.2s ease-out",
        "price-pulse": "price-pulse 2s ease-in-out infinite",
        "warning-pulse": "warning-pulse 1.5s ease-in-out infinite",
        "bounce-hover": "bounce-hover 0.5s ease-in-out",
        "float-up": "float-up 2.8s ease-out forwards",
        "particle-burst": "particle-burst 1s ease-out forwards",
        "pulse-glow": "pulse-glow 0.8s ease-in-out infinite",
        "logo-spin": "logo-spin 0.6s ease-in-out",
        "text-flash": "text-flash 0.5s ease-in-out infinite",
        "sparkle": "sparkle 0.8s ease-in-out infinite",
        "flame-flicker": "flame-flicker 0.15s ease-in-out infinite",
        "smoke": "smoke 0.8s ease-out infinite",
      },
    },
  },
  plugins: [tailwindcssAnimate],
} satisfies Config;
