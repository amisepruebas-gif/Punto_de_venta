"use strict";
// ============================================================
// Zona de precios viva — lógica pura (sin Firestore)
// ============================================================
// La usan los triggers `sincronizarZonaPrecio` (zona → sus artículos) y
// `asegurarPrecioZona` (red de seguridad sobre cada artículo) en index.js.
// Un artículo con `zonaPrecioId` guarda una COPIA de `precioVenta` y de los
// escalones de su zona para que el POS, los tickets y los reportes sigan
// leyendo el artículo sin conocer las zonas.
//
// Espejo de las reglas de `shared/src/mayoreo.ts` (functions es CommonJS y
// no importa shared): un escalón es válido con `minPz` entero ≥ 2 y
// 0 < precio < precioVenta.

/** Escalones válidos de una zona, como números y ordenados por piezas. */
function normalizarEscalones(escalones, precioVenta) {
  if (!Array.isArray(escalones)) return [];
  const base = Number(precioVenta) || 0;
  return escalones
      .map((e) => ({minPz: Number(e && e.minPz), precio: Number(e && e.precio)}))
      .filter((e) =>
        Number.isInteger(e.minPz) && e.minPz >= 2 &&
        Number.isFinite(e.precio) && e.precio > 0 &&
        (base <= 0 || e.precio < base))
      .sort((a, b) => a.minPz - b.minPz);
}

/** Forma comparable de los escalones guardados en un artículo (o null si
 *  el artículo no tiene el campo). */
function escalonesComparables(escalones) {
  if (!Array.isArray(escalones)) return null;
  return JSON.stringify(escalones.map((e) => ({
    minPz: Number(e && e.minPz),
    precio: Number(e && e.precio),
  })));
}

/**
 * Campos que hay que escribir en `articulo` para que refleje `zona`, o
 * `null` si ya coincide. Recalcula la utilidad igual que el editor de
 * admin-web: `utilidad = precioVenta − preciCompra` y
 * `utilidadTotal = utilidad × cantidad`. Una zona con precio inválido no
 * toca nada.
 */
function calcularPatchZona(articulo, zona) {
  const precio = Number(zona && zona.precioVenta);
  if (!Number.isFinite(precio) || precio <= 0) return null;
  const escalones = normalizarEscalones(zona.escalones, precio);
  const precioIgual = Number(articulo.precioVenta) === precio;
  const escalonesIguales =
    escalonesComparables(articulo.escalonesMayoreo) === JSON.stringify(escalones);
  if (precioIgual && escalonesIguales) return null;
  const utilidad = precio - (Number(articulo.preciCompra) || 0);
  return {
    precioVenta: String(precio),
    escalonesMayoreo: escalones,
    utilidad: String(utilidad),
    utilidadTotal: String(utilidad * (Number(articulo.cantidad) || 0)),
  };
}

/** ¿Cambió algo de la zona que afecte a sus artículos? (precio o
 *  escalones; renombrar o desactivar no los toca). */
function zonaCambioPrecios(antes, despues) {
  if (!despues) return false;
  if (!antes) return true;
  return Number(antes.precioVenta) !== Number(despues.precioVenta) ||
    JSON.stringify(normalizarEscalones(antes.escalones, antes.precioVenta)) !==
    JSON.stringify(normalizarEscalones(despues.escalones, despues.precioVenta));
}

/**
 * ¿Hay que comparar el artículo contra su zona? Solo si tiene zona y
 * cambió la zona, el precio o los escalones. Las ventas (que solo tocan
 * stock) salen aquí sin leer nada.
 */
function requiereVerificarZona(antes, despues) {
  if (!despues || !despues.zonaPrecioId) return false;
  if (!antes) return true;
  return antes.zonaPrecioId !== despues.zonaPrecioId ||
    String(antes.precioVenta) !== String(despues.precioVenta) ||
    escalonesComparables(antes.escalonesMayoreo) !==
      escalonesComparables(despues.escalonesMayoreo);
}

module.exports = {
  normalizarEscalones,
  calcularPatchZona,
  zonaCambioPrecios,
  requiereVerificarZona,
};
