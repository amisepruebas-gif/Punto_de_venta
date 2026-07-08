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
  tipo: "register" | "earn" | "canje" | "card" | "cerrar";
  payload: Record<string, unknown>;
  intentos: number;
};

/**
 * Tarjeta física pendiente de VINCULAR al cobrar (se compró/repuso en la venta
 * actual). "Pagó → se vincula": el barcode se liga al monedero DESPUÉS de crear la
 * venta, idempotente por ventaId.
 */
export type TarjetaPendiente = {
  /** Barcode NUEVO (EAN-13) a vincular. */
  codigo: string;
  /** Teléfono del monedero (identificador para vincular). */
  telefono: string;
  /** Reposición: barcode ANTERIOR a deshabilitar (si aplica). */
  codigoAnterior?: string;
};

/**
 * Fase 5 — write-ahead del canje de cashback EN CURSO (candado anti doble-cobro).
 * Se persiste el `cobroId` ANTES de debitar; si un reload/reintento reusa el MISMO
 * cobroId, el servidor lo reconoce (idempotente) y no vuelve a debitar.
 */
export type CanjeEnCurso = {
  /** idempotencyKey del cobro (= id de la venta) usado para debitar. */
  cobroId: string;
  /** Teléfono del monedero debitado. */
  telefono: string;
  /** Monto $ debitado (para exigir que un reintento use el mismo monto). */
  monto: number;
  /** Epoch ms de creación; solo se reusa si es reciente (< TTL del servidor). */
  creadoEn: number;
};

type State = {
  /** Cliente pre-registrado esperando su venta (uno a la vez). */
  pendiente: ClientePendiente | null;
  /** Tarjeta a vincular al cobrar la venta actual (uno a la vez). */
  tarjetaPendiente: TarjetaPendiente | null;
  /** Fase 5: canjes de cashback en curso (write-ahead) indexados por teléfono. */
  canjesEnCurso: Record<string, CanjeEnCurso>;
  /** Cola de llamadas a amise.mx que fallaron (offline) para reintentar. */
  cola: LlamadaPuntos[];
  setPendiente: (c: ClientePendiente | null) => void;
  limpiarPendiente: () => void;
  setTarjetaPendiente: (t: TarjetaPendiente | null) => void;
  limpiarTarjetaPendiente: () => void;
  setCanjeEnCurso: (telefono: string, c: CanjeEnCurso | null) => void;
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
      tarjetaPendiente: null,
      canjesEnCurso: {},
      cola: [],
      setPendiente: (c) => set({ pendiente: c }),
      limpiarPendiente: () => set({ pendiente: null }),
      setTarjetaPendiente: (t) => set({ tarjetaPendiente: t }),
      limpiarTarjetaPendiente: () => set({ tarjetaPendiente: null }),
      setCanjeEnCurso: (telefono, c) =>
        set((st) => {
          const next = { ...st.canjesEnCurso };
          if (c) next[telefono] = c;
          else delete next[telefono];
          return { canjesEnCurso: next };
        }),
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
