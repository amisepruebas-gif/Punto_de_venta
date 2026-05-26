import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { signOut } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "./firebase/config";
import App from "./App";
import "./styles/globals.css";

// Bumpear este string en cada deploy en el que quieras forzar relogin global.
const AUTH_EPOCH = "v2-2026-04-27";
const AUTH_EPOCH_KEY = "amise_admin_auth_epoch";

async function enforceAuthEpoch() {
  try {
    if (localStorage.getItem(AUTH_EPOCH_KEY) !== AUTH_EPOCH) {
      await signOut(auth);
      localStorage.setItem(AUTH_EPOCH_KEY, AUTH_EPOCH);
    }
  } catch {
    // Si signOut falla (sin sesión, storage bloqueado, etc.) seguimos.
  }
}

// Kick switch en tiempo real. Doc en Firestore: system/auth_kick_switch.value (string).
// Cambia el valor desde la consola y todas las pestañas activas hacen signOut() solas.
const KICK_LOCAL_KEY = "amise_admin_kick_switch";
function subscribeKickSwitch() {
  try {
    onSnapshot(
      doc(db, "system", "auth_kick_switch"),
      async (snap) => {
        const value = snap.data()?.value;
        if (typeof value !== "string" || value.length === 0) return;
        const stored = localStorage.getItem(KICK_LOCAL_KEY);
        if (stored === null) {
          localStorage.setItem(KICK_LOCAL_KEY, value);
          return;
        }
        if (stored !== value) {
          localStorage.setItem(KICK_LOCAL_KEY, value);
          if (auth.currentUser) {
            await signOut(auth);
          }
        }
      },
      () => {
        // Errores de red / permisos: ignorar, se reintenta solo.
      },
    );
  } catch {
    // No bloquear arranque si Firestore no está disponible.
  }
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
});

enforceAuthEpoch().finally(() => {
  subscribeKickSwitch();
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </React.StrictMode>,
  );
});
