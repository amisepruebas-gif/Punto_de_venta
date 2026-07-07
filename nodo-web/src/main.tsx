import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import { inicializarTraficoFirestore } from "./lib/traficoFirestore";
import "./styles/globals.css";

// Warm-start del tracker de tráfico Firestore: lee el día actual desde el
// filesystem APK (o localStorage), borra archivos > 90 días y registra
// listeners de visibilidad para flush diferido.
void inicializarTraficoFirestore();

// Migración one-time del caché de imágenes a CORS. Las entradas guardadas
// antes de activar `crossorigin` son respuestas OPACAS (cross-origin sin
// CORS): inflan la cuota de disco (padding) y ya no satisfacen una petición
// con crossorigin, así que romperían las imágenes ya cacheadas. Borramos ese
// caché viejo una sola vez; el Service Worker repuebla el caché nuevo (v2)
// con respuestas CORS limpias y durables.
if (typeof caches !== "undefined") {
  const MIGRADO_KEY = "amise_nodo_img_cors_migrado";
  try {
    if (!localStorage.getItem(MIGRADO_KEY)) {
      void caches.delete("firebase-storage-img").finally(() => {
        try {
          localStorage.setItem(MIGRADO_KEY, "1");
        } catch {
          /* noop */
        }
      });
    }
  } catch {
    /* noop */
  }
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
