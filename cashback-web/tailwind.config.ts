import type { Config } from "tailwindcss";

// Colores del logo de AMISE: azul y morado.
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        marca: { DEFAULT: "#2CC9F9", texto: "#0A6E99", suave: "#E2F6FD", oscuro: "#075A80" },
        lealtad: { DEFAULT: "#7D3E95", texto: "#6A2F80", suave: "#F4ECF7", borde: "#E3D3EC" },
      },
      fontFamily: {
        sans: ["system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
