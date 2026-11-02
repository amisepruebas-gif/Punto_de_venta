// ============================================================
// Cobro con la terminal Clip — reglas puras de la caja
// ============================================================
// El servidor (functions/lib/clip.js) cobra y sigue el pago; aquí está lo que
// decide la caja: cuánto se cobra, cuándo se puede guardar la venta, qué va
// en el ticket y qué hacer al abrir con un cobro a medias.

import type { CobroClip, EstadoCobroClip, PagoClip, TarjetaClip } from "./schema";

/** Estados en los que el cobro ya no cambia. */
export const ESTADOS_FINALES_CLIP: readonly EstadoCobroClip[] = [
  "aprobado",
  "fallido",
  "cancelado",
  "revisar",
  "manual",
];

export function cobroClipFinal(estado: EstadoCobroClip | string | null | undefined): boolean {
  return ESTADOS_FINALES_CLIP.includes(estado as EstadoCobroClip);
}

/** "199.50" | 199.5 → 19950. Lo que no es número cuenta como 0. */
export function centavosClip(x: unknown): number {
  const n = Number(x);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

/** Lo que se cobra en la terminal: lo que paga el cliente con tarjeta
 *  (`montoPago` ya trae la comisión de la sucursal, si aplica). */
export function montoCobroClip(preview: { montoPago: string }): number {
  return centavosClip(preview.montoPago) / 100;
}

/** ¿Se puede guardar la venta con este cobro? Aprobado y por el mismo monto
 *  (el servidor no conoce el carrito: este es el único cruce). */
export function puedeCrearVentaConClip(
  cobro: Pick<CobroClip, "estado" | "montoCentavos"> | null | undefined,
  preview: { montoPago: string },
): boolean {
  return (
    !!cobro &&
    cobro.estado === "aprobado" &&
    cobro.montoCentavos === centavosClip(preview.montoPago)
  );
}

/** Datos del cobro aprobado que se guardan en la venta. */
export function pagoClipDeCobro(cobro: CobroClip): PagoClip {
  const p: PagoClip = { cobroId: cobro.cobroId, verificado: true };
  if (cobro.pinpadRequestId) p.pinpadRequestId = cobro.pinpadRequestId;
  const t: TarjetaClip = cobro.tarjeta ?? {};
  for (const k of ["marca", "tipo", "ultimos4", "banco", "transaccionId", "aprobadoEn"] as const) {
    if (t[k]) p[k] = t[k];
  }
  if (cobro.alerta) p.alerta = cobro.alerta;
  return p;
}

/** Cobro que el cajero confirmó a mano porque no se pudo verificar con Clip
 *  (se perdió la respuesta al mandarlo y la terminal sí lo cobró). */
export function pagoClipManual(cobroId: string): PagoClip {
  return { cobroId, verificado: false };
}

const MARCAS: Record<string, string> = {
  visa: "Visa",
  master: "Mastercard",
  mastercard: "Mastercard",
  amex: "Amex",
  american_express: "Amex",
  carnet: "Carnet",
};

/** "Visa ••••4242" para tickets y admin. Vacío si no hay datos. */
export function etiquetaTarjetaClip(
  p: Pick<TarjetaClip, "marca" | "ultimos4"> | null | undefined,
): string {
  if (!p || (!p.marca && !p.ultimos4)) return "";
  const clave = (p.marca ?? "").toLowerCase();
  const marca = p.marca
    ? (MARCAS[clave] ?? p.marca.charAt(0).toUpperCase() + p.marca.slice(1))
    : "Tarjeta";
  return p.ultimos4 ? `${marca} ••••${p.ultimos4}` : marca;
}

/** En qué paso va un cobro con terminal guardado en la tablet. */
export type FaseCobroClip = "terminal" | "descuentos" | "guardando";

export type AccionRecuperacionClip =
  /** El cobro sigue abierto en la terminal: volver a esperarlo. */
  | "esperar"
  /** No se sabe si la terminal lo recibió: el cajero la revisa. */
  | "incierto"
  /** Ya se cobró: terminar la venta (descuentos y guardar), una sola vez. */
  | "terminar-venta"
  /** Terminó sin pago o nunca llegó: retomar la venta o descartarla. */
  | "retomar"
  /** Hubo dinero pero no cuadra: revisarlo en Clip. */
  | "revisar";

/**
 * Qué hacer al abrir la caja con un cobro en curso guardado. `cobro` es lo
 * que dice el servidor (null si nunca le llegó).
 */
export function accionRecuperacionClip(
  fase: FaseCobroClip,
  cobro: Pick<CobroClip, "estado" | "montoCentavos"> | null,
  preview: { montoPago: string },
): AccionRecuperacionClip {
  // Tras la aprobación la fase avanza: solo falta terminar la venta.
  if (fase !== "terminal") return "terminar-venta";
  if (!cobro) return "retomar";
  switch (cobro.estado) {
    case "enviando":
    case "pendiente":
      return "esperar";
    case "incierto":
      return "incierto";
    case "aprobado":
      return puedeCrearVentaConClip(cobro, preview) ? "terminar-venta" : "revisar";
    case "manual":
      // El cajero ya lo confirmó en la terminal: solo falta guardar la venta.
      return "terminar-venta";
    case "revisar":
      return "revisar";
    default:
      return "retomar";
  }
}

/** Lo de la venta que cambia si un descuento no se pudo aplicar. */
export type VentaConDescuentos = {
  montoCobro: string;
  montoPago: string;
  cambio: string;
  movimiento: string;
  datosPagoDividido?: Record<string, unknown>;
  descuentoPuntos?: string;
  puntosCodigo?: string;
  descuentoRegalo?: string;
  regaloCodigo?: string;
  regaloPhone?: string;
  regaloEmail?: string;
};

/**
 * La tarjeta ya se cobró, pero el cashback o el crédito de regalo no se pudo
 * descontar (y no se va a poder). La venta se guarda SIN ese descuento y la
 * diferencia se cobra en efectivo: pago dividido tarjeta + efectivo, que el
 * corte ya suma. Nunca se guarda un descuento que no se descontó.
 */
export function ventaSinDescuentoConEfectivo<T extends VentaConDescuentos>(
  venta: T,
  quitar: "cashback" | "regalo",
): T {
  const diferencia =
    quitar === "cashback" ? Number(venta.descuentoPuntos) || 0 : Number(venta.descuentoRegalo) || 0;
  if (diferencia <= 0) return venta;
  const dd = venta.movimiento === "pagoDividido" ? venta.datosPagoDividido : undefined;
  const tarjeta = dd ? Number(dd.tarjeta) || 0 : Number(venta.montoCobro) || 0;
  const efectivo = dd ? Number(dd.efectivo) || 0 : 0;
  const r: T = {
    ...venta,
    montoCobro: String((Number(venta.montoCobro) || 0) + diferencia),
    montoPago: String((Number(venta.montoPago) || 0) + diferencia),
    cambio: "0",
    movimiento: "pagoDividido",
    datosPagoDividido: {
      tarjeta: String(tarjeta),
      efectivo: String(efectivo + diferencia),
      transferencia: "0",
    },
  };
  if (quitar === "cashback") {
    delete r.descuentoPuntos;
    delete r.puntosCodigo;
  } else {
    delete r.descuentoRegalo;
    delete r.regaloCodigo;
    delete r.regaloPhone;
    delete r.regaloEmail;
  }
  return r;
}
