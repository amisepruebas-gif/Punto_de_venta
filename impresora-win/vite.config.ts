import path from "node:path";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// La ventana del programa (lo que corre dentro de Electron). Se carga con
// file://, por eso las rutas son relativas (`base: "./"`).
export default defineConfig({
  root: path.resolve(__dirname, "src/renderer"),
  base: "./",
  plugins: [react()],
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "../shared/src"),
    },
  },
  build: {
    outDir: path.resolve(__dirname, "dist/renderer"),
    emptyOutDir: true,
    target: "chrome130",
  },
  test: {
    root: path.resolve(__dirname),
    include: ["src/**/*.test.ts"],
  },
});
