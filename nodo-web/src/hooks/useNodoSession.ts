import { useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { create } from "zustand";
import { auth } from "../firebase/config";

const LS_KEY = "amise_nodo_session";

export type NodoSession = {
  nodoId: string;
  sucursalId: string;
  negocioId: string;
  nombreNodo: string;
};

export function loadSession(): NodoSession | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as NodoSession;
  } catch {
    return null;
  }
}

export function saveSession(s: NodoSession): void {
  localStorage.setItem(LS_KEY, JSON.stringify(s));
}

export function clearSession(): void {
  localStorage.removeItem(LS_KEY);
}

// FIX: Zustand store global compartido entre todos los componentes.
// Antes era useState local → cada hook tenía su propia copia y los cambios
// no se propagaban (ej. FormRegistro actualizaba pero App no lo veía).
type SessionStoreState = {
  session: NodoSession | null;
  loading: boolean;
  setSession: (s: NodoSession | null) => void;
  setLoading: (b: boolean) => void;
};

const useSessionStore = create<SessionStoreState>((set) => ({
  session: loadSession(),
  loading: true,
  setSession: (s) => {
    if (s) saveSession(s);
    else clearSession();
    set({ session: s });
  },
  setLoading: (b) => set({ loading: b }),
}));

let authListenerInstalled = false;

export function useNodoSession() {
  const session = useSessionStore((s) => s.session);
  const loading = useSessionStore((s) => s.loading);
  const setSession = useSessionStore((s) => s.setSession);
  const setLoading = useSessionStore((s) => s.setLoading);

  useEffect(() => {
    // Instalar el listener de Firebase Auth solo una vez globalmente.
    if (authListenerInstalled) return;
    authListenerInstalled = true;
    onAuthStateChanged(auth, () => setLoading(false));
  }, [setLoading]);

  return {
    nodoId: session?.nodoId ?? null,
    sucursalId: session?.sucursalId ?? null,
    negocioId: session?.negocioId ?? null,
    session,
    setSession,
    loading,
  };
}
