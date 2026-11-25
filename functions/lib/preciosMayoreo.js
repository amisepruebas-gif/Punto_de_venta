"use strict";
// ============================================================
// Precios de mayoreo en escalera — lógica pura (sin Firestore)
// ============================================================
// Categoría → subcategoría → artículo: gana el más específico. Los precios
// de categoría y subcategoría viven en `datos/_preciosMayoreo` (solo admin).
// Un artículo «Solo mayoreo» con `heredaPrecio` y sin zona guarda una COPIA
// del nivel que le toca en `precioVenta` y `precioMenudeo`, para que la caja,
// los tickets y las etiquetas sigan leyendo solo el artículo. Sin esa marca
// el precio es del artículo y aquí no se toca: así un artículo de antes de la
// escalera nunca pierde su precio.
//
// La usan los triggers `sincronizarPreciosMayoreo` (precios → artículos) y
// `asegurarPrecioZona` (red de seguridad sobre cada artículo) en index.js.
// Espejo de shared/src/articuloMayoreo.ts (functions es CommonJS y no
// importa shared).

/** Un nivel sirve con precio > 0 y menudeo mayor que el precio. */
function nivelValido(n) {
  return !!n && typeof n === "object" &&
    typeof n.precio === "number" && typeof n.menudeo === "number" &&
    Number.isFinite(n.precio) && Number.isFinite(n.menudeo) &&
    n.precio > 0 && n.menudeo > n.precio;
}

/** Precio que hereda el artículo: el de su subcategoría si es válido; si
 *  no, el de su categoría; `null` si ninguna lo tiene. */
function resolverPrecioHeredado(articulo, precios) {
  const subs = (precios && precios.subcategorias) || {};
  const cats = (precios && precios.categorias) || {};
  const sub = articulo.subcategoriaId ? subs[articulo.subcategoriaId] : null;
  if (nivelValido(sub)) {
    return {precio: sub.precio, menudeo: sub.menudeo, origen: "subcategoria"};
  }
  const cat = articulo.categoriaId ? cats[articulo.categoriaId] : null;
  if (nivelValido(cat)) {
    return {precio: cat.precio, menudeo: cat.menudeo, origen: "categoria"};
  }
  return null;
}

/** ¿El artículo toma su precio de la escalera? Solo los «Solo mayoreo»
 *  marcados con `heredaPrecio` y sin zona (con zona manda la zona). */
function heredaPrecio(articulo) {
  return !!articulo && articulo.soloMayoreo === true &&
    articulo.heredaPrecio === true && !articulo.zonaPrecioId;
}

/**
 * Campos que hay que escribir en `articulo` para que refleje su nivel de la
 * escalera, o `null` si ya coincide, si no hereda, o si ningún nivel tiene
 * precio (entonces se queda como está). La utilidad se recalcula igual que
 * con las zonas: `utilidad = precioVenta − preciCompra`.
 */
function calcularPatchPrecio(articulo, precios) {
  if (!heredaPrecio(articulo)) return null;
  const r = resolverPrecioHeredado(articulo, precios);
  if (!r) return null;
  if (Number(articulo.precioVenta) === r.precio &&
      Number(articulo.precioMenudeo) === r.menudeo) {
    return null;
  }
  const utilidad = r.precio - (Number(articulo.preciCompra) || 0);
  return {
    precioVenta: String(r.precio),
    precioMenudeo: String(r.menudeo),
    utilidad: String(utilidad),
    utilidadTotal: String(utilidad * (Number(articulo.cantidad) || 0)),
  };
}

/**
 * ¿Hay que comparar el artículo contra la escalera? Solo si hereda y es
 * nuevo, o cambió su categoría, su subcategoría, sus precios, o acaba de
 * empezar a heredar. Las ventas (que solo tocan existencias) salen aquí sin
 * leer nada.
 */
function requiereVerificarPrecio(antes, despues) {
  if (!heredaPrecio(despues)) return false;
  if (!antes || !heredaPrecio(antes)) return true;
  return antes.categoriaId !== despues.categoriaId ||
    antes.subcategoriaId !== despues.subcategoriaId ||
    String(antes.precioVenta) !== String(despues.precioVenta) ||
    String(antes.precioMenudeo) !== String(despues.precioMenudeo);
}

module.exports = {
  nivelValido,
  resolverPrecioHeredado,
  heredaPrecio,
  calcularPatchPrecio,
  requiereVerificarPrecio,
};
