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
