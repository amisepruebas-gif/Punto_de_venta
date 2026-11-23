import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// Página pública del cashback de mayoreo (amise-cashback.web.app): pequeña,
// sin service worker y sin Firestore; solo llama a las functions.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@shared": path.resolve(__dirname, "../shared/src"),
    },
  },
  server: { port: 5186, host: true },
  build: { target: "es2022", sourcemap: false },
});
