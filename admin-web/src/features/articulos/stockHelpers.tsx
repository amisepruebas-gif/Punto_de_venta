/**
 * Helpers de stock por sucursal, compartidos por la página de lista
 * (`ArticulosPage`) y por el buscador con autocomplete
 * (`ArticulosSearchBar`).
 *
 * Reglas del schema:
 *   - El stock de "tienda" vive en `cantidad` para la sucursal default y
 *     en `cantidadPorSucursal[sid]` para las demás.
 *   - `cantidadBodega` es UNA sola bodega global del negocio (no se
 *     particiona por sucursal).
 *   - "cant suc" depende del filtro: si hay sucursal elegida, es el stock
 *     ahí; si está en "todas", es la suma sobre todas las sucursales.
 *   - "total" siempre = Σ sucursales (tienda) + bodega global — no
 *     depende del filtro.
 */

export type StockShape = {
  cantidad?: string;
  cantidadBodega?: string;
  cantidadPorSucursal?: { [sid: string]: string };
};

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

/** Resuelve los tres números a mostrar para un item dado el filtro actual. */
export function resolverTrios(
  item: StockShape,
  filtroSucursal: string,
  defaultId: string | undefined,
): { suc: number; bod: number; tot: number } {
  const bod = Number(item.cantidadBodega) || 0;
  const todas = stockEnTodasSucursales(item);
  const suc = filtroSucursal
    ? stockEnSucursal(item, filtroSucursal, defaultId)
    : todas;
  return { suc, bod, tot: todas + bod };
}

export function StockTrio({
  trio,
  compact,
}: {
  trio: { suc: number; bod: number; tot: number };
  compact?: boolean;
}) {
  const sizeNum = compact ? "text-[10px]" : "text-xs";
  const sizeLbl = compact ? "text-[9px]" : "text-[10px]";
  const sucMuted = trio.suc === 0;
  return (
    <div
      className={`flex shrink-0 items-baseline gap-1.5 tabular-nums ${sizeNum}`}
      title={`Sucursal: ${trio.suc} · Bodega: ${trio.bod} · Total: ${trio.tot}`}
    >
      <span className={sucMuted ? "text-muted-foreground/50" : "font-semibold"}>
        <span className={`${sizeLbl} font-normal text-muted-foreground`}>S </span>
        {trio.suc}
      </span>
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
