/**
 * Pricing oficial de Gemini 2.5 Flash Image (Nano Banana) al momento de
 * la integración. Si Google cambia precios, se actualiza aquí — los
 * registros viejos preservan el costo histórico (no se recalculan).
 *
 * Fuente: https://ai.google.dev/gemini-api/docs/pricing
 */

import type { RegistroImagenProcesada } from "@shared";

/** USD por imagen generada con Gemini 2.5 Flash Image. */
export const COSTO_USD_NANOBANANA = 0.039;

/**
 * Tipo de cambio USD→MXN de fallback. En una próxima iteración se podrá
 * leer dinámico desde una API de FX o desde un campo configurable en
 * Ajustes. Por ahora hardcoded a un valor estable.
 */
export const TIPO_CAMBIO_FALLBACK = 19;

export function costoMxnAprox(usd: number, tipoCambio = TIPO_CAMBIO_FALLBACK) {
  return Math.round(usd * tipoCambio * 100) / 100; // 2 decimales
}

export type DatosUsuario = {
  uid?: string;
  email?: string;
};

/**
 * Construye un `RegistroImagenProcesada` con los costos del momento.
 * El `imagenUrl` se rellena cuando ya se subió a Storage.
 */
export function nuevoRegistroNanobanana(
  imagenUrl: string | undefined,
  usuario: DatosUsuario | null,
): RegistroImagenProcesada {
  return {
    fecha: new Date().toISOString(),
    proceso: "nanobanana",
    costoUsd: COSTO_USD_NANOBANANA,
    costoMxn: costoMxnAprox(COSTO_USD_NANOBANANA),
    tipoCambio: TIPO_CAMBIO_FALLBACK,
    ...(imagenUrl ? { imagenUrl } : {}),
    ...(usuario?.uid ? { uidUsuario: usuario.uid } : {}),
    ...(usuario?.email ? { emailUsuario: usuario.email } : {}),
  };
}
