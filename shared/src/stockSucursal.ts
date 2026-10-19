// ============================================================
// Stock de tienda por sucursal — helpers puros
// ============================================================
//
// Reglas del schema (ver `Negocio.sucursalDefaultId`, `Articulo` y
// `ArticuloSubvariacion`):
//   - La sucursal default guarda su stock de tienda en `cantidad`.
//   - Las demás lo guardan en `cantidadPorSucursal[sid]`.
//   - Si `Negocio.sucursalDefaultId` no está seteado, la default es el
//     primer sucursalId en orden alfabético (fallback legacy).
//
// Sin dependencias de Firestore: cada app resuelve los ids de sucursales
// con su propio SDK y le pasa el resultado a estos helpers.

/** Forma mínima de un objeto con stock de tienda (Articulo o
 *  ArticuloSubvariacion). */
export type StockTiendaShape = {
  cantidad?: string;
  cantidadPorSucursal?: { [sucursalId: string]: string };
};

/** Sucursal sobre la que opera una lectura/escritura de stock, con el
 *  default ya resuelto. */
export type UbicacionStock = {
  sucursalId: string;
  esDefault: boolean;
};

/**
 * Resuelve el id de la sucursal default: `sucursalDefaultId` si está
 * seteado; si no, el primer id alfabético de `sucursalesIds`. `undefined`
 * si no hay ninguno de los dos.
 */
export function resolverSucursalDefaultId(
  sucursalDefaultId: string | undefined,
  sucursalesIds: readonly string[],
): string | undefined {
  if (sucursalDefaultId) return sucursalDefaultId;
  return [...sucursalesIds].sort()[0];
}

/**
 * Arma la `UbicacionStock` de `sucursalId`. La propia `sucursalId` cuenta
 * como sucursal existente aunque no venga en `sucursalesIds` (p. ej. una
 * lectura desde caché offline vacía): con una sola sucursal siempre
 * resuelve como default.
 */
export function resolverUbicacionStock(
  sucursalId: string,
  sucursalDefaultId: string | undefined,
  sucursalesIds: readonly string[],
): UbicacionStock {
  const defaultId = resolverSucursalDefaultId(sucursalDefaultId, [
    ...sucursalesIds,
    sucursalId,
  ]);
  return { sucursalId, esDefault: sucursalId === defaultId };
}

/**
 * Resuelve si la sucursal `sid` es la default del negocio. Si el negocio
 * tiene `sucursalDefaultId` seteado, esa es la respuesta. Si no, se usa
 * `fallbackPrimerId` (primer sucursalId alfabético).
 */
export function esSucursalDefault(
  sid: string,
  defaultId: string | undefined,
  fallbackPrimerId?: string,
): boolean {
  if (defaultId) return sid === defaultId;
  if (fallbackPrimerId) return sid === fallbackPrimerId;
  // Sin info: tratamos como NO default — entra al mapa, evita pisar `cantidad`.
  return false;
}

/**
 * Lee el stock actual de tienda (no bodega) para una sucursal específica
 * sobre un Articulo o ArticuloSubvariacion:
 *   - Si `sid` es default → `obj.cantidad`.
 *   - Si no → `obj.cantidadPorSucursal?.[sid]`.
 *
 * Devuelve número (parseado), 0 si no hay valor.
 */
export function leerStockTienda(
  obj: StockTiendaShape,
  sid: string,
  esDefault: boolean,
): number {
  const raw = esDefault ? obj.cantidad : obj.cantidadPorSucursal?.[sid];
  return Number(raw) || 0;
}

/**
 * Devuelve una copia de `obj` con el stock de tienda de la sucursal
 * reemplazado por `valor`: en `cantidad` si es default, en
 * `cantidadPorSucursal[sid]` si no (el resto del mapa se conserva).
 */
export function conStockTienda<T extends StockTiendaShape>(
  obj: T,
  sid: string,
  esDefault: boolean,
  valor: number,
): T {
  if (esDefault) return { ...obj, cantidad: String(valor) };
  return {
    ...obj,
    cantidadPorSucursal: { ...(obj.cantidadPorSucursal ?? {}), [sid]: String(valor) },
  };
}
