"use strict";
// ============================================================
// Pasos de un trigger con `retry: true` — lógica pura (sin Firestore)
// ============================================================
// Con `retry: true`, si el handler lanza, la plataforma vuelve a entregar el
// evento con espera creciente. Solo es seguro si cada paso es idempotente:
// en el reintento, el paso que ya se hizo sale por su guarda y solo se rehace
// el que falló. `reconciliarVentasOffline` (index.js) tiene dos pasos así
// (renumerar y descontar stock).
//
// Además de la ventana de la plataforma, el handler deja de pedir reintentos
// cuando el evento ya es viejo (patrón recomendado por Google para evitar
// reintentos sin fin): ese último intento termina sin lanzar y deja en el log
// qué quedó pendiente, en vez de que el evento se descarte en silencio.

/**
 * Corre `pasos` ([nombre, fn async]) en orden; si uno falla, los siguientes
 * corren igual. Devuelve `{fallas, reintentar, edadMs}`: `fallas` trae
 * `{nombre, err}` por paso fallido, y `reintentar` dice si el handler debe
 * lanzar (algo falló y el evento tiene menos de `maxMs`). Un `eventTime`
 * ilegible cuenta como reciente: la plataforma igual acota los reintentos.
 */
async function correrPasos(pasos, {eventTime, maxMs, ahoraMs = Date.now()}) {
  const fallas = [];
  for (const [nombre, paso] of pasos) {
    try {
      await paso();
    } catch (err) {
      fallas.push({nombre, err});
    }
  }
  const t = Date.parse(eventTime);
  const edadMs = Number.isFinite(t) ? ahoraMs - t : 0;
  return {fallas, reintentar: fallas.length > 0 && edadMs < maxMs, edadMs};
}

module.exports = {correrPasos};
