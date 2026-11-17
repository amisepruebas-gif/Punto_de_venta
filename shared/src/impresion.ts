// ============================================================
// Cola de impresión de etiquetas — helpers puros
// ============================================================
//
// Teléfono (acceso `armar`), admin y caja dejan una orden (`TrabajoImpresion`)
// en `impresiones_web_new_version`. El programa de Windows "AMISE Impresora"
// (acceso `imprimir`) la toma, aparta los números de las etiquetas de lote con
// el MISMO contador del PDF de admin (`_contadorEtiquetasLote`), imprime por
// USB (TSPL, ver `tspl.ts`) y la marca impresa o con error.
//
//   pendiente → imprimiendo (el programa la toma y aparta números)
//             → impreso | error
//   impreso | error → pendiente ("Reimprimir": conserva sus números)

import type { Impresora, RenglonEtiquetaPrecio, TrabajoImpresion } from "./schema";
import { codigoEtiquetaLote, etiquetaLoteLegible } from "./lotes";

/** Etiquetas de lote por orden desde un teléfono. */
export const IMPRESION_TOPE_ENLACE = 60;
/** Etiquetas de lote por orden desde admin (y lo más que sube el contador). */
export const IMPRESION_TOPE_ADMIN = 300;
/** Piezas por renglón de etiquetas de precio. */
export const IMPRESION_TOPE_PIEZAS = 100;
/** Renglones por orden de etiquetas de precio. */
export const IMPRESION_TOPE_RENGLONES = 20;
/** El programa avisa que sigue vivo cada minuto… */
export const IMPRESORA_LATIDO_MS = 60_000;
/** …y se ve "conectada" si avisó hace menos de esto. */
export const IMPRESORA_CONECTADA_MS = 150_000;
/** Largo máximo del mensaje de error que deja el programa. */
export const IMPRESION_MAX_ERROR = 300;

/** Precio de una etiqueta: hasta 7 enteros y 2 decimales, sin `$`. */
export const RE_PRECIO_ETIQUETA = /^\d{1,7}(\.\d{1,2})?$/;
/** Código de artículo en la etiqueta de precio: 8 dígitos (como "codigos"). */
export const RE_CODIGO_ARTICULO_ETIQUETA = /^\d{8}$/;

/** Milisegundos de un Timestamp de Firestore (de cualquier SDK) o `null`. */
export function msDeMarca(t: unknown): number | null {
  if (!t || typeof t !== "object") return null;
  const x = t as { toMillis?: () => number; seconds?: unknown; nanoseconds?: unknown };
  if (typeof x.toMillis === "function") return x.toMillis();
  if (typeof x.seconds === "number") {
    const nanos = typeof x.nanoseconds === "number" ? x.nanoseconds : 0;
    return x.seconds * 1000 + Math.floor(nanos / 1e6);
  }
  return null;
}

/** El programa de esa impresora avisó hace poco que sigue vivo. */
export function impresoraConectada(
  imp: Pick<Impresora, "latidoEn"> | null | undefined,
  ahoraMs: number,
): boolean {
  const ms = msDeMarca(imp?.latidoEn);
  return ms !== null && ahoraMs - ms < IMPRESORA_CONECTADA_MS;
}

function rangoValido(desde: unknown, hasta: unknown): desde is number {
  return (
    Number.isInteger(desde) &&
    Number.isInteger(hasta) &&
    (desde as number) >= 1 &&
    (hasta as number) >= (desde as number)
  );
}

/** Los códigos de una orden de etiquetas de lote ya apartada. */
export function codigosDeTrabajo(t: Pick<TrabajoImpresion, "desde" | "hasta">): string[] {
  if (!rangoValido(t.desde, t.hasta)) return [];
  const out: string[] = [];
  for (let n = t.desde!; n <= t.hasta!; n++) out.push(codigoEtiquetaLote(n));
  return out;
}

/** `8800 0000 0301 a 8800 0000 0320` (o uno solo). Vacío si no hay rango. */
export function rangoLegible(t: Pick<TrabajoImpresion, "desde" | "hasta">): string {
  if (!rangoValido(t.desde, t.hasta)) return "";
  const a = etiquetaLoteLegible(codigoEtiquetaLote(t.desde!));
  if (t.hasta === t.desde) return a;
  return `${a} a ${etiquetaLoteLegible(codigoEtiquetaLote(t.hasta!))}`;
}

/**
 * Números que aparta el programa al tomar una orden de etiquetas de lote,
 * contra el contador leído EN LA TRANSACCIÓN (`ultimo`). Una reimpresión
 * conserva los suyos y no toca el contador (`nuevoUltimo: null`).
 */
export function planearTomaEtiquetasLote(
  t: Pick<TrabajoImpresion, "cantidad" | "desde" | "hasta">,
  ultimo: number | null | undefined,
): { desde: number; hasta: number; nuevoUltimo: number | null } {
  if (rangoValido(t.desde, t.hasta)) {
    return { desde: t.desde!, hasta: t.hasta!, nuevoUltimo: null };
  }
  const n = t.cantidad;
  if (!Number.isInteger(n) || (n as number) < 1 || (n as number) > IMPRESION_TOPE_ADMIN) {
    throw new Error("La orden no trae una cantidad válida de etiquetas");
  }
  const base = Number.isInteger(ultimo) && (ultimo as number) >= 0 ? (ultimo as number) : 0;
  return { desde: base + 1, hasta: base + (n as number), nuevoUltimo: base + (n as number) };
}

/** Problemas de unos renglones de etiquetas de precio (vacío = se puede). */
export function validarRenglonesPrecio(renglones: unknown): string[] {
  if (!Array.isArray(renglones) || renglones.length === 0) return ["No hay etiquetas que imprimir"];
  if (renglones.length > IMPRESION_TOPE_RENGLONES) {
    return [`Máximo ${IMPRESION_TOPE_RENGLONES} artículos por orden`];
  }
  const problemas: string[] = [];
  renglones.forEach((r: unknown, i) => {
    const n = i + 1;
    if (!r || typeof r !== "object") {
      problemas.push(`El renglón ${n} está vacío`);
      return;
    }
    const x = r as Partial<RenglonEtiquetaPrecio>;
    if (x.codigo !== undefined && !(typeof x.codigo === "string" && RE_CODIGO_ARTICULO_ETIQUETA.test(x.codigo))) {
      problemas.push(`El renglón ${n} tiene un código que no es de 8 dígitos`);
    }
    if (!(typeof x.precio === "string" && RE_PRECIO_ETIQUETA.test(x.precio))) {
      problemas.push(`El renglón ${n} tiene un precio inválido`);
    }
    if (!Number.isInteger(x.piezas) || (x.piezas as number) < 1 || (x.piezas as number) > IMPRESION_TOPE_PIEZAS) {
      problemas.push(`El renglón ${n}: las piezas van de 1 a ${IMPRESION_TOPE_PIEZAS}`);
    }
  });
  return problemas;
}

/** Cuántas etiquetas físicas salen de una orden. */
export function etiquetasDeTrabajo(
  t: Pick<TrabajoImpresion, "tipo" | "cantidad" | "desde" | "hasta" | "renglones">,
): number {
  if (t.tipo === "etiquetas_precio") {
    return (t.renglones ?? []).reduce((s, r) => s + (Number.isInteger(r.piezas) ? r.piezas : 0), 0);
  }
  if (rangoValido(t.desde, t.hasta)) return t.hasta! - t.desde! + 1;
  return Number.isInteger(t.cantidad) ? (t.cantidad as number) : 0;
}

/** Texto corto del estado de una orden para la pantalla de quien la mandó. */
export function textoEstadoTrabajo(
  t: Pick<TrabajoImpresion, "estado" | "error" | "tipo" | "desde" | "hasta">,
): string {
  switch (t.estado) {
    case "pendiente":
      return "En cola: espera a la impresora";
    case "imprimiendo":
      return "Imprimiendo…";
    case "impreso": {
      const rango = t.tipo === "etiquetas_lote" ? rangoLegible(t) : "";
      return rango ? `Listo: ${rango}` : "Listo";
    }
    case "error":
      return `No se imprimió: ${t.error || "error desconocido"}`;
    default:
      return String(t.estado);
  }
}
