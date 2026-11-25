/**
 * Helpers de stock por sucursal, compartidos por la página de lista
 * (`ArticulosPage`) y por el buscador con autocomplete
 * (`ArticulosSearchBar`).
 *
 * Reglas del schema:
 *   - El stock de "tienda" vive en `cantidad` para la sucursal default y
 *     en `cantidadPorSucursal[sid]` para las demás.
 *   - `cantidadBodega` es UNA sola bodega global del negocio (no se
 *     particiona por sucursal): el taller.
 *   - `cantidadBodegaSucursal[sid]` es la bodega de UNA tienda (sucursales
 *     de mayoreo). Se muestra aparte como "BT".
 *   - "cant suc" depende del filtro: si hay sucursal elegida, es el stock
 *     ahí; si está en "todas", es la suma sobre todas las sucursales.
 *   - "total" siempre = Σ sucursales (tienda) + bodega global + Σ bodegas
 *     de tienda — no depende del filtro.
 */

export type StockShape = {
  cantidad?: string;
  cantidadBodega?: string;
  cantidadPorSucursal?: { [sid: string]: string };
  cantidadBodegaSucursal?: { [sid: string]: string };
};

export type TrioStock = {
  suc: number;
  bod: number;
  tot: number;
  /** Bodega de tienda: la de la sucursal del filtro, o la suma de todas. */
  bodTienda: number;
};

export const TRIO_VACIO: TrioStock = { suc: 0, bod: 0, tot: 0, bodTienda: 0 };

export function sumarTrios(a: TrioStock, b: TrioStock): TrioStock {
  return {
    suc: a.suc + b.suc,
    bod: a.bod + b.bod,
    tot: a.tot + b.tot,
    bodTienda: a.bodTienda + b.bodTienda,
  };
}

export function stockEnSucursal(
  item: StockShape,
  sucursalId: string,
  defaultId: string | undefined,
): number {
  if (defaultId && sucursalId === defaultId) {
    return Number(item.cantidad) || 0;
  }
  return Number(item.cantidadPorSucursal?.[sucursalId]) || 0;
}

export function stockEnTodasSucursales(item: StockShape): number {
  const cant = Number(item.cantidad) || 0;
  const otros = Object.values(item.cantidadPorSucursal ?? {}).reduce(
    (acc, v) => acc + (Number(v) || 0),
    0,
  );
  return cant + otros;
}

/** Resuelve los números a mostrar para un item dado el filtro actual. */
export function resolverTrios(
  item: StockShape,
  filtroSucursal: string,
  defaultId: string | undefined,
): TrioStock {
  const bod = Number(item.cantidadBodega) || 0;
  const todas = stockEnTodasSucursales(item);
  const suc = filtroSucursal
    ? stockEnSucursal(item, filtroSucursal, defaultId)
    : todas;
  const bodegasTienda = Object.values(item.cantidadBodegaSucursal ?? {}).reduce(
    (acc, v) => acc + (Number(v) || 0),
    0,
  );
  const bodTienda = filtroSucursal
    ? Number(item.cantidadBodegaSucursal?.[filtroSucursal]) || 0
    : bodegasTienda;
  return { suc, bod, tot: todas + bod + bodegasTienda, bodTienda };
}

export function StockTrio({
  trio,
  compact,
}: {
  trio: TrioStock;
  compact?: boolean;
}) {
  const sizeNum = compact ? "text-[10px]" : "text-xs";
  const sizeLbl = compact ? "text-[9px]" : "text-[10px]";
  const sucMuted = trio.suc === 0;
  return (
    <div
      className={`flex shrink-0 items-baseline gap-1.5 tabular-nums ${sizeNum}`}
      title={`Sucursal: ${trio.suc}${
        trio.bodTienda > 0 ? ` · Bodega de tienda: ${trio.bodTienda}` : ""
      } · Bodega general: ${trio.bod} · Total: ${trio.tot}`}
    >
      <span className={sucMuted ? "text-muted-foreground/50" : "font-semibold"}>
        <span className={`${sizeLbl} font-normal text-muted-foreground`}>S </span>
        {trio.suc}
      </span>
      {trio.bodTienda > 0 && (
        <>
          <span className="text-muted-foreground">·</span>
          <span className="font-semibold">
            <span className={`${sizeLbl} font-normal text-muted-foreground`}>BT </span>
            {trio.bodTienda}
          </span>
        </>
      )}
      <span className="text-muted-foreground">·</span>
      <span className="text-muted-foreground">
        <span className={`${sizeLbl}`}>B </span>
        {trio.bod}
      </span>
      <span className="text-muted-foreground">·</span>
      <span className="text-muted-foreground">
        <span className={`${sizeLbl}`}>T </span>
        {trio.tot}
      </span>
    </div>
  );
}
