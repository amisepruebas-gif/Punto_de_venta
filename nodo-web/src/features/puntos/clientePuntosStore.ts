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
  tipo:
    | "register"
    | "earn"
    | "canje"
    | "card"
    | "cerrar"
    | "gift"
    | "giftRecarga"
    | "cerrarRegalo";
  payload: Record<string, unknown>;
  intentos: number;
};

/**
 * Tarjeta de REGALO pendiente de EMITIR (venta nueva) o RECARGAR (tarjeta
 * existente) al cobrar (Feature 5, Fase 2). "Pagó → se emite/recarga": la
 * operación corre DESPUÉS de crear la venta, idempotente por ventaId. El MONTO
 * real lo da la línea gift de la venta (money-safety), no este pendiente. Unión
 * discriminada por `modo` → estructuralmente NO puede haber emitir+recargar en la
 * misma venta (setGiftPendiente reemplaza).
 */
export type GiftPendiente =
  | {
      modo: "emitir";
      /** Email del DESTINATARIO (llave del monedero). */
      email: string;
      phone?: string;
      nombre?: string;
      /** Barcode EAN-13 de la tarjeta física (D2: siempre física). */
      barcode: string;
    }
  | {
      modo: "recargar";
      /** Identificador de la tarjeta EXISTENTE (al menos uno). */
      email?: string;
      phone?: string;
      /** Barcode EAN-13 de la tarjeta escaneada. */
      codigo?: string;
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

type State = {
  /** Cliente pre-registrado esperando su venta (uno a la vez). */
  pendiente: ClientePendiente | null;
  /** Tarjeta a vincular al cobrar la venta actual (uno a la vez). */
  tarjetaPendiente: TarjetaPendiente | null;
  /** Tarjeta de regalo a EMITIR al cobrar la venta actual (una a la vez). */
  giftPendiente: GiftPendiente | null;
  /** Cola de llamadas a amise.mx que fallaron (offline) para reintentar. */
  cola: LlamadaPuntos[];
  setPendiente: (c: ClientePendiente | null) => void;
  limpiarPendiente: () => void;
  setTarjetaPendiente: (t: TarjetaPendiente | null) => void;
  limpiarTarjetaPendiente: () => void;
  setGiftPendiente: (g: GiftPendiente | null) => void;
  limpiarGiftPendiente: () => void;
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
      giftPendiente: null,
      cola: [],
      setPendiente: (c) => set({ pendiente: c }),
      limpiarPendiente: () => set({ pendiente: null }),
      setTarjetaPendiente: (t) => set({ tarjetaPendiente: t }),
      limpiarTarjetaPendiente: () => set({ tarjetaPendiente: null }),
      setGiftPendiente: (g) => set({ giftPendiente: g }),
      limpiarGiftPendiente: () => set({ giftPendiente: null }),
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
