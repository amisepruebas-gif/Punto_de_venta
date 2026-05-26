import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "node:path";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico"],
      manifest: {
        name: "Amise Nodo",
        short_name: "Nodo",
        description: "Punto de venta Amise",
        lang: "es",
        theme_color: "#0a0a0a",
        background_color: "#0a0a0a",
        display: "standalone",
        orientation: "any",
        start_url: "/",
        scope: "/",
        categories: ["business", "productivity"],
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,webp,woff2}"],
        navigateFallbackDenylist: [
          /^\/__\/auth/,
          /firestore\.googleapis\.com/,
          /firebaseinstallations\.googleapis\.com/,
          /identitytoolkit\.googleapis\.com/,
          /securetoken\.googleapis\.com/,
          /firebasestorage\.googleapis\.com/,
        ],
        runtimeCaching: [
          // Imágenes locales servidas desde /img/ (fondos, cabeceras, billetes,
          // etc.). Son estáticas y nunca cambian su URL, así que CacheFirst
          // con expiración larga elimina el lag al abrir Ajustes una segunda
          // vez. La cache se llena en la primera visita.
          {
            urlPattern: ({ url, sameOrigin }) =>
              sameOrigin && url.pathname.startsWith("/img/"),
            handler: "CacheFirst",
            options: {
              cacheName: "img-static",
              expiration: {
                maxEntries: 80,
                maxAgeSeconds: 60 * 60 * 24 * 90,
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Imágenes del catálogo y chat servidas desde Firebase Storage.
          // Sin este rule las imágenes "ya cargadas" hacen conditional GET
          // (304) en cada apertura de modal — visible como lentitud aunque
          // los bytes estén en disco. Con CacheFirst se sirven directo del
          // SW cache (IndexedDB-backed, durable, no volátil como el HTTP
          // cache del navegador). Las URLs incluyen `?alt=media&token=...`
          // y el token rota cuando admin re-sube — la entrada vieja queda
          // como huérfano hasta que expira (30 días) o se llene maxEntries.
          // Esto NO reemplaza al cache nativo de la APK (ImageCache.java)
          // que es más eficiente y maneja invalidación por path canónico;
          // este rule cubre el caso de uso en navegador puro y cuando la
          // SW responde antes que el shouldInterceptRequest del WebView.
          {
            urlPattern: ({ url }) =>
              url.host === "firebasestorage.googleapis.com" &&
              (url.pathname.includes("media_web_new_version") ||
                url.pathname.includes("mensajes_media")),
            handler: "CacheFirst",
            options: {
              cacheName: "firebase-storage-img",
              expiration: {
                // 1000 entradas cubre catálogos grandes (500 padres × ~3
                // variaciones promedio = ~1500-2000 imágenes activas) sin
                // overflow constante. ~50-100 MB en disco al estar lleno —
                // aceptable en tablets POS. LRU evictea las menos usadas
                // cuando excede.
                maxEntries: 1000,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@shared": path.resolve(__dirname, "../shared/src"),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
  build: {
    target: "es2022",
    sourcemap: false,
  },
});
