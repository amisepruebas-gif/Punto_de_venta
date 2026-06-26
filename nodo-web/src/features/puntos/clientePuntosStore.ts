import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Cliente pre-registrado en el POS, pendiente de vincular a su próxima venta.
 * `code` es la contraseña temporal generada localmente (robustez offline).
 */
export type ClientePendiente = {
  correo: string;
  telefono: string;
  nombre?: string;
  code: string;
};

/** Operación de puntos encolada para reintento (offline-robusto). */
export type LlamadaPuntos = {
  id: string;
  tipo: "register" | "earn";
  payload: Record<string, unknown>;
  intentos: number;
};

type State = {
  /** Cliente pre-registrado esperando su venta (uno a la vez). */
  pendiente: ClientePendiente | null;
  /** Cola de llamadas a amise.mx que fallaron (offline) para reintentar. */
  cola: LlamadaPuntos[];
  setPendiente: (c: ClientePendiente | null) => void;
  limpiarPendiente: () => void;
  encolar: (tipo: LlamadaPuntos["tipo"], payload: Record<string, unknown>) => void;
  quitarDeCola: (id: string) => void;
  incrementarIntento: (id: string) => void;
};

function nuevoId(tipo: string): string {
  return `${tipo}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export const useClientePuntos = create<State>()(
  persist(
    (set) => ({
      pendiente: null,
      cola: [],
      setPendiente: (c) => set({ pendiente: c }),
      limpiarPendiente: () => set({ pendiente: null }),
      encolar: (tipo, payload) =>
        set((st) => {
          const cola = [...st.cola, { id: nuevoId(tipo), tipo, payload, intentos: 0 }];
          // Cap defensivo: si crece demasiado, descarta los más antiguos (FIFO).
          return { cola: cola.length > 100 ? cola.slice(cola.length - 100) : cola };
        }),
      quitarDeCola: (id) =>
        set((st) => ({ cola: st.cola.filter((x) => x.id !== id) })),
      incrementarIntento: (id) =>
        set((st) => ({
          cola: st.cola.map((x) =>
            x.id === id ? { ...x, intentos: x.intentos + 1 } : x,
          ),
        })),
    }),
    {
      // Persiste cliente pendiente + cola en localStorage (sobreviven recargas).
      name: "amise_nodo_puntos",
      version: 1,
    },
  ),
);
