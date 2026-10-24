import type { Articulo, ArticuloSubvariacion } from "./schema";

/**
 * Resuelve el precio efectivo de cobro para un artículo o variación.
 *
 * Cadena de fallback (primer valor > 0 que pase los guards gana):
 *   1. `sub.precioDescuento`         — variación con descuento propio
 *   2. `padre.precioDescuento`       — descuento global del padre
 *   3. `padre.precioVenta`           — precio base del padre
 *
 * NOTA: el campo legacy `Articulo.descuento` (subtractivo en Android,
 * etiquetado "Descuento %" en mercancia-web vieja) NO se incluye en la
 * cadena. Su semántica histórica es ambigua y reinterpretarlo como
 * precio final causaba undercharge severo (`$30` legacy de "30 pesos
 * menos" se cobraba como `$30` final). Datos con `descuento` quedan
 * inertes hasta que un admin los re-capture explícitamente en
 * `precioDescuento` desde la UI.
 *
 * GUARDS aplicados a cada candidato:
 *   - vacío / no numérico / NaN     → se descarta
 *   - `<= 0`                        → se descarta
 *   - `>= precioVenta`              → se descarta (typo / mispriced —
 *                                     un "descuento" nunca puede
 *                                     cobrar más que el precio base)
 *
 * El POS (nodo-web) llama a esta función al agregar al carrito y guarda
 * un snapshot del resultado en el item; el resto del flujo de venta sigue
 * leyendo del snapshot (no re-resuelve contra el catálogo).
 *
 * Devuelve:
 *   - `precio`: el número final a cobrar.
 *   - `descuento`: el precio con descuento como string (mismo formato que
 *     se guarda hoy en `VentaArticulo.descuento`) cuando ganó el paso 1
 *     o 2. `undefined` cuando el precio sale del paso 3 (base sin
 *     descuento) — así el caller puede distinguir "hay descuento" de
 *     "es el precio base".
 */
export function resolverPrecioEfectivo(
  padre: Pick<Articulo, "precioVenta" | "precioDescuento">,
  sub?: Pick<ArticuloSubvariacion, "precioDescuento"> | null,
): { precio: number; descuento?: string } {
  const baseNum = Number(padre.precioVenta) || 0;
  const candidatos: Array<string | undefined> = [
    sub?.precioDescuento,
    padre.precioDescuento,
  ];
  for (const raw of candidatos) {
    if (!raw) continue;
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) continue;
    if (baseNum > 0 && n >= baseNum) continue;
    return { precio: n, descuento: raw };
  }
  return { precio: baseNum };
}

/** Campos de una línea de venta (o de carrito) que definen lo cobrado.
 *  `aply_3x2` no está en `VentaArticulo` pero viaja en las ventas del POS. */
export type LineaCobro = {
  cantidad?: string;
  precio?: string;
  descuento?: string;
  aply_3x2?: string;
};

/** Precio cobrado por pieza: `descuento` (promo o mayoreo) si hay, si no
 *  `precio`. */
export function precioCobradoLinea(l: LineaCobro): number {
  return Number(l.descuento) || Number(l.precio) || 0;
}

/** Subtotal cobrado de una línea: (piezas − piezas gratis del 3x2) ×
 *  precio cobrado. Fórmula única para carrito, tickets y reportes. */
export function subtotalLinea(l: LineaCobro): number {
  const cant = Number(l.cantidad) || 0;
  const gratis = Number(l.aply_3x2) || 0;
  return (cant - gratis) * precioCobradoLinea(l);
}
