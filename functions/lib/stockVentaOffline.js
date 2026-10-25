"use strict";
// ============================================================
// Stock de ventas OFFLINE — lógica pura (sin Firestore)
// ============================================================
// Sin red, nodo-web guarda la venta con `numeroDeVenta` "OFFLINE-…" y SIN
// correr su transacción de stock (`crearVenta` en ventaService.ts). El
// trigger `reconciliarVentasOffline` (index.js) descuenta aquí ese stock
// cuando la venta llega al servidor.
//
// Espejo de nodo-web/src/features/articulos/stockService.ts y de
// shared/src/stockSucursal.ts (functions es CommonJS y no importa shared):
//   - La sucursal default usa `cantidad`; las demás
//     `cantidadPorSucursal[sid]`.
//   - Con subvariación se descuenta la subvariación; el padre (suma de sus
//     subs) solo baja en la default.
//   - Sobreventa permitida, igual que al cobrar: recorta a 0 y se marca.
//   - Los no registrados (`id "00000000"`) y las líneas de regalo no mueven
//     stock. Una venta que cierra un apartado tampoco: el stock se reservó
//     al crear el apartado.
// Diferencia con el POS: un artículo o una variación que ya no existe no
// aborta (la venta ya ocurrió); esa línea se omite y se reporta.

const PREFIJO_OFFLINE = "OFFLINE-";
const ID_NO_REGISTRADO = "00000000";

/**
 * Sucursal sobre la que opera el stock, con la default resuelta:
 * `sucursalDefaultId` si está seteado; si no, el primer id alfabético de
 * `sucursalesIds` (la propia `sucursalId` cuenta aunque no venga).
 */
function resolverUbicacionStock(sucursalId, sucursalDefaultId, sucursalesIds) {
  const defaultId = sucursalDefaultId ||
    [...(sucursalesIds || []), sucursalId].sort()[0];
  return {sucursalId, esDefault: sucursalId === defaultId};
}

/** Stock de tienda de `obj` (artículo o subvariación) en la sucursal:
 *  `cantidad` en la default, `cantidadPorSucursal[sid]` en las demás. */
function leerStockTienda(obj, sid, esDefault) {
  const raw = esDefault ? obj.cantidad : obj.cantidadPorSucursal?.[sid];
  return Number(raw) || 0;
}

/** Copia de `obj` con su stock de tienda en la sucursal igual a `valor`
 *  (el resto de `cantidadPorSucursal` se conserva). */
function conStockTienda(obj, sid, esDefault, valor) {
  if (esDefault) return {...obj, cantidad: String(valor)};
  return {
    ...obj,
    cantidadPorSucursal: {...(obj.cantidadPorSucursal || {}), [sid]: String(valor)},
  };
}

/** ¿La venta nació OFFLINE? Solo esas no descontaron stock en el POS. Al
 *  renumerarla, su número OFFLINE queda en `numeroDeVentaOffline`. */
function nacioOffline(venta) {
  return [venta.numeroDeVenta, venta.numeroDeVentaOffline].some((n) =>
    typeof n === "string" && n.startsWith(PREFIJO_OFFLINE));
}

/** ¿Cierra un apartado? Su stock se descontó al crear el apartado. */
function cierraApartado(venta) {
  return venta.apartado === "1" && !!venta.idApartado;
}

/** ¿Puede ser el id de un doc? Uno inválido haría fallar toda la tx. */
function esIdDeDoc(id) {
  return id !== "." && id !== ".." && !id.includes("/") && !/^__.*__$/.test(id);
}

/**
 * Líneas que mueven stock, sumadas por (artículo, subvariación): el carrito
 * puede traer la misma combinación en filas separadas. Se saltan los no
 * registrados, las líneas de regalo y los ids que no pueden ser un doc.
 */
function agruparLineas(articulos) {
  const grupos = new Map();
  for (const it of Array.isArray(articulos) ? articulos : []) {
    if (!it || !it.id || it.giftCard) continue;
    const id = String(it.id);
    if (id === ID_NO_REGISTRADO || !esIdDeDoc(id)) continue;
    const sub = it.subvariacionCodigo ? String(it.subvariacionCodigo) : null;
    const clave = `${id}|${sub || ""}`;
    const g = grupos.get(clave) ||
      {articuloId: id, subvariacionCodigo: sub, cantidad: 0};
    g.cantidad += Number(it.cantidad) || 0;
    grupos.set(clave, g);
  }
  return [...grupos.values()];
}

/**
 * Descuenta `lineas` sobre los artículos leídos (`articulos`: id → datos, o
 * null si el doc no existe) con la sobreventa del cobro: recorta a 0 y lo
 * reporta. `patches` trae, por artículo tocado, lo que hay que escribir:
 * `cantidad` (default) o el mapa `cantidadPorSucursal` (otra sucursal) del
 * padre, y el arreglo `subvariaciones` completo si se tocó alguna.
 */
function planearDescuento(articulos, lineas, ubicacion) {
  const {sucursalId, esDefault} = ubicacion;
  const estados = new Map();
  const omitidas = [];
  let sobreventa = false;
  for (const l of lineas) {
    const data = articulos.get(l.articuloId);
    if (!data) {
      omitidas.push({...l, motivo: "articulo-inexistente"});
      continue;
    }
    if (!estados.has(l.articuloId)) {
      estados.set(l.articuloId, {
        data,
        cantidad: leerStockTienda(data, sucursalId, esDefault),
        subvariaciones: Array.isArray(data.subvariaciones) ?
          data.subvariaciones.map((s) => ({...s})) : [],
        padreTocado: false,
        subsTocadas: false,
      });
    }
    const e = estados.get(l.articuloId);
    if (l.subvariacionCodigo) {
      const idx = e.subvariaciones.findIndex(
          (s) => s && s.codigo === l.subvariacionCodigo);
      if (idx === -1) {
        omitidas.push({...l, motivo: "variacion-inexistente"});
        continue;
      }
      const sv = e.subvariaciones[idx];
      const stockSv = leerStockTienda(sv, sucursalId, esDefault);
      if (stockSv < l.cantidad) sobreventa = true;
      e.subvariaciones[idx] = conStockTienda(
          sv, sucursalId, esDefault, Math.max(0, stockSv - l.cantidad));
      e.subsTocadas = true;
      if (esDefault) {
        e.cantidad = Math.max(0, e.cantidad - l.cantidad);
        e.padreTocado = true;
      }
    } else {
      if (e.cantidad < l.cantidad) sobreventa = true;
      e.cantidad = Math.max(0, e.cantidad - l.cantidad);
      e.padreTocado = true;
    }
  }

  const patches = new Map();
  for (const [id, e] of estados) {
    const patch = {};
    if (e.padreTocado) {
      const padre = conStockTienda(e.data, sucursalId, esDefault, e.cantidad);
      if (esDefault) patch.cantidad = padre.cantidad;
      else patch.cantidadPorSucursal = padre.cantidadPorSucursal;
    }
    if (e.subsTocadas) patch.subvariaciones = e.subvariaciones;
    if (Object.keys(patch).length > 0) patches.set(id, patch);
  }
  return {patches, sobreventa, omitidas};
}

/**
 * Descuenta dentro de `tx` el stock de la venta en `ventaRef` y la marca con
 * `stockAplicado: true` en la MISMA tx, así que un trigger repetido ve la
 * marca y no hace nada. Solo actúa si la venta nació OFFLINE: una online ya
 * descontó en el POS. La marca también queda cuando no hay nada que
 * descontar (cierra un apartado, solo regalos o no registrados).
 *
 * `articuloRef(id)` da la ref de un artículo; `ubicacion` sale de
 * `resolverUbicacionStock`, resuelta antes de la tx como en el POS.
 * Devuelve el plan (`lineas`, `patches`, `sobreventa`, `omitidas`) o null si
 * no escribió nada.
 */
async function aplicarStockVentaEnTx(tx, {ventaRef, articuloRef, ubicacion}) {
  const ventaSnap = await tx.get(ventaRef);
  if (!ventaSnap.exists) return null;
  const venta = ventaSnap.data();
  if (venta.stockAplicado === true || !nacioOffline(venta)) return null;

  const lineas = cierraApartado(venta) ? [] : agruparLineas(venta.articulos);
  const refs = new Map();
  for (const l of lineas) refs.set(l.articuloId, articuloRef(l.articuloId));
  const snaps = refs.size > 0 ? await tx.getAll(...refs.values()) : [];
  const articulos = new Map(
      snaps.map((s) => [s.id, s.exists ? s.data() : null]));
  const plan = planearDescuento(articulos, lineas, ubicacion);

  plan.patches.forEach((patch, id) => tx.update(refs.get(id), patch));
  tx.update(ventaRef, {
    stockAplicado: true,
    ...(plan.sobreventa ? {sobreventa: true} : {}),
  });
  return {lineas, ...plan};
}

module.exports = {
  resolverUbicacionStock,
  leerStockTienda,
  conStockTienda,
  nacioOffline,
  cierraApartado,
  agruparLineas,
  planearDescuento,
  aplicarStockVentaEnTx,
};
