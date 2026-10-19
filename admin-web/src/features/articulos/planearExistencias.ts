import {
  conStockTienda,
  leerStockTienda,
  type Articulo,
  type UbicacionStock,
} from "@shared";

/**
 * Existencia de tienda que el admin fija en una sucursal: la del padre
 * (sin `subvariacionCodigo`, sólo artículos sin variaciones) o la de una
 * subvariación.
 */
export type CambioExistencia = {
  articuloId: string;
  subvariacionCodigo?: string;
  /** Stock que el admin tenía a la vista al empezar a editar. Si en
   *  Firestore ya es otro (venta, apartado, resurtido), el cambio NO se
   *  aplica y se reporta como conflicto para no pisar ese movimiento. */
  base: number;
  /** Valor nuevo: entero >= 0. */
  valor: number;
};

export type PatchExistencias = Partial<
  Pick<Articulo, "cantidad" | "cantidadPorSucursal" | "subvariaciones">
>;

export type PlanExistencias = {
  /** `null` si no hay nada que escribir. */
  patch: PatchExistencias | null;
  aplicados: CambioExistencia[];
  conflictos: Array<{ cambio: CambioExistencia; actual: number }>;
  errores: Array<{ cambio: CambioExistencia; mensaje: string }>;
};

/**
 * Calcula el patch de un artículo para fijar sus existencias de tienda en
 * `ubicacion`. Puro: el caller lo corre dentro de una transacción con el
 * doc recién leído.
 *
 * Misma regla que `stockService` de nodo-web y `cerrarResurtido`:
 *   - Default: escribe `cantidad`. Si el artículo tiene variaciones, el
 *     padre queda como la suma de `subvariaciones[].cantidad`.
 *   - Otra sucursal: escribe `cantidadPorSucursal[sid]` del padre (sin
 *     variaciones) o de cada subvariación. `cantidad` no se toca.
 */
export function planearExistencias(
  art: Articulo,
  cambios: CambioExistencia[],
  ubicacion: UbicacionStock,
): PlanExistencias {
  const { sucursalId, esDefault } = ubicacion;
  const subs = [...(art.subvariaciones ?? [])];
  let padre = art;
  let subsTocadas = false;
  let padreTocado = false;
  const aplicados: CambioExistencia[] = [];
  const conflictos: PlanExistencias["conflictos"] = [];
  const errores: PlanExistencias["errores"] = [];

  for (const cambio of cambios) {
    if (!Number.isInteger(cambio.valor) || cambio.valor < 0) {
      errores.push({ cambio, mensaje: "La cantidad debe ser un entero ≥ 0" });
      continue;
    }
    if (cambio.subvariacionCodigo) {
      const idx = subs.findIndex((s) => s.codigo === cambio.subvariacionCodigo);
      if (idx === -1) {
        errores.push({ cambio, mensaje: "La variación ya no existe" });
        continue;
      }
      const actual = leerStockTienda(subs[idx]!, sucursalId, esDefault);
      if (actual !== cambio.base) {
        conflictos.push({ cambio, actual });
        continue;
      }
      subs[idx] = conStockTienda(subs[idx]!, sucursalId, esDefault, cambio.valor);
      subsTocadas = true;
    } else {
      if (subs.length > 0) {
        errores.push({
          cambio,
          mensaje: "El artículo ahora tiene variaciones: edita cada variación",
        });
        continue;
      }
      const actual = leerStockTienda(padre, sucursalId, esDefault);
      if (actual !== cambio.base) {
        conflictos.push({ cambio, actual });
        continue;
      }
      padre = conStockTienda(padre, sucursalId, esDefault, cambio.valor);
      padreTocado = true;
    }
    aplicados.push(cambio);
  }

  const patch: PatchExistencias = {};
  if (subsTocadas) {
    patch.subvariaciones = subs;
    if (esDefault) {
      const suma = subs.reduce((acc, s) => acc + (Number(s.cantidad) || 0), 0);
      patch.cantidad = String(suma);
    }
  }
  if (padreTocado) {
    if (esDefault) patch.cantidad = padre.cantidad;
    else patch.cantidadPorSucursal = padre.cantidadPorSucursal;
  }

  return {
    patch: Object.keys(patch).length > 0 ? patch : null,
    aplicados,
    conflictos,
    errores,
  };
}
