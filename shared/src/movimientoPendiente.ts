// ============================================================
// Mover piezas (bodega ↔ tienda): ¿se aplicó un envío sin respuesta?
// ============================================================
// Puro. mercancia-web manda cada movimiento a la function `moverExistencias`
// con un id propio. Si se corta la conexión no sabe si se aplicó, y mientras
// no lo sepa no deja cambiar la lista (se movería dos veces). Lo averigua
// leyendo el registro del movimiento, que la function guarda con ESE id.
// Tests en admin-web/src/lib/__tests__/movimientoPendiente.test.ts.
// ============================================================

/**
 * Cuánto puede tardar en aplicarse un intento desde que salió: la app espera
 * la respuesta 40 s y la function corta a los 30 s (70 s), más margen por si
 * la llamada tardó en llegar con mala señal. Pasado este tiempo sin que
 * exista el registro, ese intento ya no se va a aplicar.
 */
export const ESPERA_ENVIO_SIN_RASTRO_MS = 120_000;

export type VeredictoEnvio =
  /** El movimiento quedó registrado a nombre de esta persona: sí se movió. */
  | "aplicado"
  /** Ese id es del movimiento de otra persona: este envío nunca se aplicará. */
  | "ajeno"
  /** No hay registro y ya no puede llegar: no se movió nada. */
  | "no-aplicado"
  /** No hay registro, pero el último intento todavía podría aplicarse. */
  | "sin-saber";

/**
 * Qué se sabe de un envío que quedó sin respuesta, leyendo su registro.
 * Solo dice "no-aplicado" con prueba: el registro no existe Y ya pasó el
 * tiempo en que el último intento podía aplicarse.
 */
export function veredictoEnvioPendiente(o: {
  /** ¿Existe el registro del movimiento con el id del envío? */
  existe: boolean;
  /** `usuarioId` de ese registro, si existe. */
  usuarioIdRegistro?: string;
  /** Quien mandó el envío. */
  usuarioId: string;
  /** Cuándo salió el último intento (reloj de este equipo). */
  enviadoMs: number;
  ahoraMs: number;
}): VeredictoEnvio {
  if (o.existe) return o.usuarioIdRegistro === o.usuarioId ? "aplicado" : "ajeno";
  // Si el reloj del equipo se movió hacia atrás la resta sale negativa: se
  // sigue sin saber (nunca se da por no aplicado antes de tiempo).
  return o.ahoraMs - o.enviadoMs >= ESPERA_ENVIO_SIN_RASTRO_MS ? "no-aplicado" : "sin-saber";
}
