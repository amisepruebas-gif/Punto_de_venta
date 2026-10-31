import { create } from "zustand";
import { persist } from "zustand/middleware";
import { recortarColaPuntos, type TipoLlamadaPuntos } from "@shared";

/**
 * Cliente pre-registrado en el POS, pendiente de vincular a su próxima venta.
 * `code` es la contraseña temporal generada localmente (robustez offline).
 */
export type ClientePendiente = {
  correo: string;
  telefono: string;
  nombre?: string;
  code: string;
  /** Cuándo se pre-registró (ms): vence a la hora (`pendienteVigente`).
   *  Opcional: uno guardado por la versión anterior se fecha al abrir la app. */
  creadoEn?: number;
};

/**
 * Operación de lealtad en la cola (offline-robusta). Los campos opcionales son
 * nuevos: los ítems guardados por la versión anterior no los traen, y esa
 * versión los ignora si se regresa a ella (el store sigue en `version: 1`).
 */
export type LlamadaPuntos = {
  id: string;
  tipo: TipoLlamadaPuntos;
  payload: Record<string, unknown>;
  intentos: number;
  /** Cuándo se anotó (ms). */
  creadoEn?: number;
  /** No reintentar antes de esto (espera creciente entre intentos). */
  proximoIntento?: number;
  /** Mensaje del último error, para el aviso de la caja. */
  ultimoError?: string;
  /** La venta la está enviando ahora mismo: la cola no la toca hasta aquí. */
  enCursoHasta?: number;
  /** Doc de la venta, para dejar rastro si falla sin remedio. */
  ventaPath?: string;
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
  /** Correo que dio el cliente (ya verificado contra el teléfono); el servidor
   *  lo vuelve a comprobar al vincular. Opcional: pendientes de antes no lo
   *  traen. */
  correo?: string;
  /** Reposición: marca que la hay. El servidor busca la tarjeta anterior real
   *  (este valor puede traer solo sus últimos 4). */
  codigoAnterior?: string;
};

type State = {
  /** Cliente pre-registrado esperando su venta (uno a la vez). */
  pendiente: ClientePendiente | null;
  /** Tarjeta a vincular al cobrar la venta actual (uno a la vez). */
  tarjetaPendiente: TarjetaPendiente | null;
  /** Tarjeta de regalo a EMITIR al cobrar la venta actual (una a la vez). */
  giftPendiente: GiftPendiente | null;
  /** Llamadas a amise.mx por enviar (se anotan antes de llamar). */
  cola: LlamadaPuntos[];
  /** Las que el servidor rechazó: a la vista del cajero, nunca se borran solas. */
  fallidos: LlamadaPuntos[];
  setPendiente: (c: ClientePendiente | null) => void;
  limpiarPendiente: () => void;
  setTarjetaPendiente: (t: TarjetaPendiente | null) => void;
  limpiarTarjetaPendiente: () => void;
  setGiftPendiente: (g: GiftPendiente | null) => void;
  limpiarGiftPendiente: () => void;
  /** Anota una llamada y devuelve su id. */
  encolar: (
    tipo: LlamadaPuntos["tipo"],
    payload: Record<string, unknown>,
    extra?: Pick<LlamadaPuntos, "ventaPath" | "enCursoHasta">,
  ) => string;
  quitarDeCola: (id: string) => void;
  /** Cuenta un intento fallido: libera el ítem y fija cuándo reintentar. */
  anotarFallo: (id: string, ultimoError: string, proximoIntento: number) => void;
  /** Pasa un ítem de la cola a fallidos. */
  moverAFallidos: (id: string, ultimoError: string) => void;
  /** Regresa un fallido a la cola (el cajero pidió reintentar). */
  reintentarFallido: (id: string) => void;
  quitarFallido: (id: string) => void;
  /** Quita las esperas de todos los ítems (Reintentar ahora). */
  adelantarCola: () => void;
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
      fallidos: [],
      setPendiente: (c) =>
        set({ pendiente: c ? { ...c, creadoEn: c.creadoEn ?? Date.now() } : null }),
      limpiarPendiente: () => set({ pendiente: null }),
      setTarjetaPendiente: (t) => set({ tarjetaPendiente: t }),
      limpiarTarjetaPendiente: () => set({ tarjetaPendiente: null }),
      setGiftPendiente: (g) => set({ giftPendiente: g }),
      limpiarGiftPendiente: () => set({ giftPendiente: null }),
      encolar: (tipo, payload, extra) => {
        const item: LlamadaPuntos = {
          id: nuevoId(tipo),
          tipo,
          payload,
          intentos: 0,
          creadoEn: Date.now(),
          ...extra,
        };
        // Tope defensivo: solo recorta candados; lo que vale dinero no.
        set((st) => ({ cola: recortarColaPuntos([...st.cola, item]) }));
        return item.id;
      },
      quitarDeCola: (id) =>
        set((st) => ({ cola: st.cola.filter((x) => x.id !== id) })),
      anotarFallo: (id, ultimoError, proximoIntento) =>
        set((st) => ({
          cola: st.cola.map((x) =>
            x.id === id
              ? {
                  ...x,
                  intentos: x.intentos + 1,
                  ultimoError,
                  proximoIntento,
                  enCursoHasta: undefined,
                }
              : x,
          ),
        })),
      moverAFallidos: (id, ultimoError) =>
        set((st) => {
          const item = st.cola.find((x) => x.id === id);
          if (!item) return {};
          return {
            cola: st.cola.filter((x) => x.id !== id),
            fallidos: [
              ...st.fallidos,
              { ...item, intentos: item.intentos + 1, ultimoError, enCursoHasta: undefined },
            ],
          };
        }),
      reintentarFallido: (id) =>
        set((st) => {
          const item = st.fallidos.find((x) => x.id === id);
          if (!item) return {};
          return {
            fallidos: st.fallidos.filter((x) => x.id !== id),
            cola: [...st.cola, { ...item, proximoIntento: undefined }],
          };
        }),
      quitarFallido: (id) =>
        set((st) => ({ fallidos: st.fallidos.filter((x) => x.id !== id) })),
      adelantarCola: () =>
        set((st) => ({
          cola: st.cola.map((x) => ({ ...x, proximoIntento: undefined })),
        })),
    }),
    {
      // Persiste cliente pendiente + cola en localStorage (sobreviven recargas).
      // NO subir `version`: zustand borra el estado guardado si cambia sin
      // `migrate`, y al regresar a la versión anterior pasaría lo mismo (se
      // perdería la cola). Solo se agregan campos opcionales.
      name: "amise_nodo_puntos",
      version: 1,
      // Un cliente en espera guardado sin fecha (versión anterior) se toma
      // como creado ahora: vence en una hora, no se pierde uno de recién.
      onRehydrateStorage: () => (st) => {
        if (st?.pendiente && st.pendiente.creadoEn == null) {
          st.setPendiente({ ...st.pendiente, creadoEn: Date.now() });
        }
      },
    },
  ),
);
