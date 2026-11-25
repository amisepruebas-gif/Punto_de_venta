"use strict";
// ============================================================
// Mover piezas entre la bodega y la tienda de una sucursal — lógica pura
// ============================================================
// La usa la callable `moverExistencias` (index.js). El encargado de tienda
// NO puede aumentar existencias: aquí lo que sale de un lado entra al otro,
// pieza por pieza, y nunca se mueve más de lo que hay en el origen.
//
// Campos (ver shared/src/schema.ts y shared/src/inventario.ts):
//   - bodega de la tienda → `cantidadBodegaSucursal[sid]`.
//   - tienda → `cantidad` (sucursal default) o `cantidadPorSucursal[sid]`.
// Con variación el stock vive en la variación. El padre guarda la suma de la
// tienda solo en la sucursal default (como el resto del sistema): ahí se
// recalcula; de la bodega de tienda el padre no guarda suma.

const {leerStockTienda, conStockTienda} = require("./stockVentaOffline");

const DIRECCIONES = ["bodega_a_tienda", "tienda_a_bodega"];
const MAX_RENGLONES = 100;
const MAX_PIEZAS = 100000;

/** Piezas en la bodega de la tienda `sid`. */
function leerBodega(obj, sid) {
  const mapa = obj && obj.cantidadBodegaSucursal;
  return Number(mapa && mapa[sid]) || 0;
}

/** Copia de `obj` con la bodega de la tienda `sid` igual a `valor` (el
 *  resto del mapa se conserva). */
function conBodega(obj, sid, valor) {
  return {
    ...obj,
    cantidadBodegaSucursal: {
      ...(obj.cantidadBodegaSucursal || {}),
      [sid]: String(valor),
    },
  };
}

/** ¿Puede ser el id de un doc? */
function esIdDeDoc(id) {
  return typeof id === "string" && id.length > 0 && id.length <= 64 &&
    id !== "." && id !== ".." && !id.includes("/") && !/^__.*__$/.test(id);
}

/**
 * Valida la petición de la app y la deja lista: renglones sumados por
 * (artículo, variación), así cada artículo final aparece una sola vez.
 * Lanza `Error` con un mensaje para el usuario si algo no sirve.
 */
function normalizarPeticion(data) {
  const d = data || {};
  if (typeof d.movimientoId !== "string" ||
      !/^[A-Za-z0-9_-]{8,48}$/.test(d.movimientoId)) {
    throw new Error("Falta el identificador del movimiento");
  }
  if (!DIRECCIONES.includes(d.direccion)) {
    throw new Error("Indica de dónde a dónde se mueve");
  }
  if (!Array.isArray(d.renglones) || d.renglones.length === 0) {
    throw new Error("No hay nada que mover");
  }
  if (d.renglones.length > MAX_RENGLONES * 2) {
    throw new Error(`Máximo ${MAX_RENGLONES} artículos por movimiento`);
  }
  const grupos = new Map();
  for (const r of d.renglones) {
    if (!r || !esIdDeDoc(r.articuloId)) {
      throw new Error("Hay un artículo sin código");
    }
    const sub = r.subvariacionCodigo;
    if (sub !== undefined && sub !== null &&
        (typeof sub !== "string" || sub.length === 0 || sub.length > 40)) {
      throw new Error("Hay una variación mal indicada");
    }
    if (!Number.isInteger(r.piezas) || r.piezas <= 0 || r.piezas > MAX_PIEZAS) {
      throw new Error("Las piezas deben ser un número entero mayor que 0");
    }
    const clave = `${r.articuloId}|${sub || ""}`;
    const g = grupos.get(clave) ||
      {articuloId: r.articuloId, subvariacionCodigo: sub || null, piezas: 0};
    g.piezas += r.piezas;
    grupos.set(clave, g);
  }
  if (grupos.size > MAX_RENGLONES) {
    throw new Error(`Máximo ${MAX_RENGLONES} artículos por movimiento`);
  }
  for (const g of grupos.values()) {
    if (g.piezas > MAX_PIEZAS) {
      throw new Error("Las piezas deben ser un número entero mayor que 0");
    }
  }
  return {
    movimientoId: d.movimientoId,
    direccion: d.direccion,
    renglones: [...grupos.values()],
  };
}

/**
 * Planea el movimiento sobre los artículos leídos (`articulos`: id → datos,
 * o null si el doc no existe). `renglones` viene de `normalizarPeticion`
 * (un renglón por artículo final). Devuelve:
 *   - `faltantes`: lo que impide mover (no hay piezas, el artículo o la
 *     variación ya no existe, falta elegir variación). Si trae algo, NO se
 *     escribe nada: el movimiento es todo o nada.
 *   - `patches`: por artículo, los campos a escribir.
 *   - `renglones`: cada artículo final con su nombre, su código y sus
 *     cantidades antes y después, para el registro.
 */
function planearMovimiento(articulos, renglones, direccion, ubicacion) {
  const {sucursalId, esDefault} = ubicacion;
  const aTienda = direccion === "bodega_a_tienda";
  const estados = new Map();
  const faltantes = [];
  const hechos = [];

  for (const r of renglones) {
    const data = articulos.get(r.articuloId);
    if (!data) {
      faltantes.push({...r, motivo: "articulo-inexistente", nombre: r.articuloId});
      continue;
    }
    if (!estados.has(r.articuloId)) {
      estados.set(r.articuloId, {
        data,
        padre: {...data},
        subvariaciones: Array.isArray(data.subvariaciones) ?
          data.subvariaciones.map((s) => ({...s})) : [],
        padreTocado: false,
        subsTocadas: false,
      });
    }
    const e = estados.get(r.articuloId);
    const tieneSubs = e.subvariaciones.length > 0;
    let objeto;
    let idx = -1;
    let nombre = String(data.nombre || r.articuloId);
    let codigo = r.articuloId;
    if (r.subvariacionCodigo) {
      idx = e.subvariaciones.findIndex(
          (s) => s && s.codigo === r.subvariacionCodigo);
      if (idx === -1) {
        faltantes.push({...r, motivo: "variacion-inexistente", nombre});
        continue;
      }
      objeto = e.subvariaciones[idx];
      nombre = `${nombre} — ${objeto.nombre || r.subvariacionCodigo}`;
      codigo = objeto.codigoBarras || r.subvariacionCodigo;
    } else {
      if (tieneSubs) {
        faltantes.push({...r, motivo: "elige-variacion", nombre});
        continue;
      }
      objeto = e.padre;
    }

    const bodegaAntes = leerBodega(objeto, sucursalId);
    const tiendaAntes = leerStockTienda(objeto, sucursalId, esDefault);
    const hay = aTienda ? bodegaAntes : tiendaAntes;
    if (hay < r.piezas) {
      faltantes.push({...r, motivo: "sin-piezas", nombre, codigo, hay});
      continue;
    }
    const bodegaDespues = bodegaAntes + (aTienda ? -r.piezas : r.piezas);
    const tiendaDespues = tiendaAntes + (aTienda ? r.piezas : -r.piezas);
    const movido = conStockTienda(
        conBodega(objeto, sucursalId, bodegaDespues),
        sucursalId, esDefault, tiendaDespues);
    if (idx === -1) {
      e.padre = movido;
      e.padreTocado = true;
    } else {
      e.subvariaciones[idx] = movido;
      e.subsTocadas = true;
    }
    hechos.push({
      articuloId: r.articuloId,
      ...(r.subvariacionCodigo ? {subvariacionCodigo: r.subvariacionCodigo} : {}),
      codigo,
      nombre,
      piezas: r.piezas,
      bodegaAntes,
      bodegaDespues,
      tiendaAntes,
      tiendaDespues,
    });
  }

  const patches = new Map();
  if (faltantes.length === 0) {
    for (const [id, e] of estados) {
      const patch = {};
      if (e.padreTocado) {
        patch.cantidadBodegaSucursal = e.padre.cantidadBodegaSucursal;
        if (esDefault) patch.cantidad = e.padre.cantidad;
        else patch.cantidadPorSucursal = e.padre.cantidadPorSucursal;
      }
      if (e.subsTocadas) {
        patch.subvariaciones = e.subvariaciones;
        // En la sucursal default el padre guarda la suma de la tienda.
        if (esDefault) {
          patch.cantidad = String(e.subvariaciones.reduce(
              (acc, s) => acc + (Number(s && s.cantidad) || 0), 0));
        }
      }
      if (Object.keys(patch).length > 0) patches.set(id, patch);
    }
  }
  return {faltantes, patches, renglones: faltantes.length === 0 ? hechos : []};
}

/** Mensaje para el usuario con lo que impidió mover. */
function mensajeFaltantes(faltantes, direccion) {
  const origen = direccion === "bodega_a_tienda" ? "la bodega" : "la tienda";
  const lineas = faltantes.slice(0, 5).map((f) => {
    if (f.motivo === "sin-piezas") {
      return `${f.nombre}: en ${origen} hay ${f.hay} y quieres mover ${f.piezas}`;
    }
    if (f.motivo === "elige-variacion") {
      return `${f.nombre}: tiene variaciones, escanea la que mueves`;
    }
    return `${f.nombre}: ya no existe`;
  });
  const mas = faltantes.length > 5 ? ` (y ${faltantes.length - 5} más)` : "";
  return `No se movió nada. ${lineas.join(". ")}${mas}.`;
}

module.exports = {
  DIRECCIONES,
  MAX_RENGLONES,
  leerBodega,
  conBodega,
  normalizarPeticion,
  planearMovimiento,
  mensajeFaltantes,
};
