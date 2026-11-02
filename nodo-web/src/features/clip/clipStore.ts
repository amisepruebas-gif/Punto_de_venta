import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { FaseCobroClip, PagoClip } from "@shared";
import type { CobrarPayload } from "@/features/ventas/PagoFooter";
import type {
  GiftPendiente,
  TarjetaPendiente,
} from "@/features/puntos/clientePuntosStore";

/** La venta tal como se confirmó (mismo idempotencyKey que el cobro). */
export type VentaEnCobro = CobrarPayload & { idempotencyKey: string };

/**
 * Cobro con la terminal Clip en curso. Se guarda en la tablet ANTES de
 * llamar a Clip: si la app se recarga o se cierra a media venta, al abrir se
 * retoma (ver RecuperarCobroClip). Lleva los pendientes de lealtad de la
 * venta, porque el carrito no se guarda y la caja los limpia al abrir vacía.
 */
export type CobroClipEnCurso = {
  cobroId: string;
  venta: VentaEnCobro;
  tarjPend: TarjetaPendiente | null;
  giftPend: GiftPendiente | null;
  fase: FaseCobroClip;
  /** Cobro aprobado (o confirmado a mano) que va en la venta. */
  pagoClip?: PagoClip;
  creadoEn: number;
};

type Estado = {
  cobro: CobroClipEnCurso | null;
  iniciar: (c: Omit<CobroClipEnCurso, "fase" | "creadoEn">) => void;
  /** Pasa al siguiente paso; la venta puede cambiar (diferencia en efectivo). */
  avanzar: (
    fase: FaseCobroClip,
    extra?: Partial<Pick<CobroClipEnCurso, "pagoClip" | "venta">>,
  ) => void;
  terminar: () => void;
};

export const useCobroClip = create<Estado>()(
  persist(
    (set) => ({
      cobro: null,
      iniciar: (c) => set({ cobro: { ...c, fase: "terminal", creadoEn: Date.now() } }),
      avanzar: (fase, extra) =>
        set((s) => (s.cobro ? { cobro: { ...s.cobro, ...extra, fase } } : s)),
      terminar: () => set({ cobro: null }),
    }),
    { name: "amise_nodo_clip", version: 1 },
  ),
);
