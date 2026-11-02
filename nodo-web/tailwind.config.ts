import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
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
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // Un color, un significado (guía visual de la caja).
        marca: {
          DEFAULT: "#2CC9F9",
          texto: "#0A6E99",
          suave: "#E2F6FD",
          oscuro: "#075A80",
        },
        lealtad: {
          DEFAULT: "#7D3E95",
          texto: "#6A2F80",
          suave: "#F4ECF7",
          borde: "#E3D3EC",
        },
        cobro: {
          DEFAULT: "#0F7A45",
          texto: "#0D6B3E",
          suave: "#E6F6EC",
          claro: "#E3F7EC",
        },
        aviso: {
          DEFAULT: "#7A4A00",
          suave: "#FFF3D1",
          borde: "#F2D08A",
          badge: "#FFE3A3",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [animate],
} satisfies Config;
