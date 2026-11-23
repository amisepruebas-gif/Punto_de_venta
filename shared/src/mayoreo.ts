// ============================================================
// Mayoreo por escalones — helpers puros
// ============================================================
//
// Un artículo puede tener hasta 3 escalones (`Articulo.escalonesMayoreo`),
// propios o copiados de su zona de precios. Reglas del negocio:
//   - Al juntar `minPz` piezas, cada pieza se cobra a `precio`.
//   - Las piezas se suman por GRUPO: todos los artículos de la misma zona
//     cuentan juntos (10 llaveros de modelos distintos = escalón de 10);
//     un artículo sin zona cuenta solo.
//   - El escalón solo BAJA el precio: si el precio normal (o su descuento)
//     ya es menor, se queda el normal.
//   - Aplica en todas las sucursales (también al mayoreo legacy de un
//     escalón `mayoreo`/`cantMayoreo`, que el Android ya cobraba así).
//
// Sin dependencias de Firestore ni de React: lo usan nodo-web (carrito),
// admin-web y mercancia-web (editores) y functions (copia de la zona).

import type { Articulo, EscalonMayoreo } from "./schema";

export const MAX_ESCALONES = 3;

/**
 * Escalones vigentes de un artículo, válidos y ordenados por `minPz`:
 *   - Si `escalonesMayoreo` existe (aunque esté vacío), manda.
 *   - Si no, el legacy `mayoreo` (precio) + `cantMayoreo` (piezas).
 * Se descartan escalones inválidos: `minPz` no entero o < 2, precio ≤ 0 o
 * no numérico, o precio ≥ `precioVenta` (un "mayoreo" más caro que el
 * precio normal es un error de captura, nunca se cobra).
 */
export function resolverEscalones(
  art: Pick<
    Articulo,
    "escalonesMayoreo" | "mayoreo" | "cantMayoreo" | "precioVenta"
  >,
): EscalonMayoreo[] {
  const base = Number(art.precioVenta) || 0;
  const crudos: Array<{ minPz: unknown; precio: unknown }> = Array.isArray(
    art.escalonesMayoreo,
  )
    ? art.escalonesMayoreo
    : art.mayoreo && art.cantMayoreo
      ? [{ minPz: art.cantMayoreo, precio: art.mayoreo }]
      : [];
  const validos: EscalonMayoreo[] = [];
  for (const e of crudos) {
    const minPz = Number(e.minPz);
    const precio = Number(e.precio);
    if (!Number.isInteger(minPz) || minPz < 2) continue;
    if (!Number.isFinite(precio) || precio <= 0) continue;
    if (base > 0 && precio >= base) continue;
    validos.push({ minPz, precio });
  }
  return validos.sort((a, b) => a.minPz - b.minPz);
}

/**
 * Grupo con el que se suman piezas para alcanzar un escalón: la zona de
 * precios si la tiene, si no el propio artículo.
 */
export function grupoMayoreo(
  art: Pick<Articulo, "id" | "zonaPrecioId">,
): string {
  return art.zonaPrecioId ? `zona:${art.zonaPrecioId}` : `art:${art.id}`;
}

/**
 * Escalón que aplica a `piezas`: el de menor precio entre los que ya se
 * alcanzaron. Con datos válidos es el de mayor `minPz` alcanzado; tomar el
 * más barato lo hace robusto a escalones mal ordenados.
 */
export function escalonAplicable(
  escalones: readonly EscalonMayoreo[],
  piezas: number,
): EscalonMayoreo | null {
  let mejor: EscalonMayoreo | null = null;
  for (const e of escalones) {
    if (piezas < e.minPz) continue;
    if (!mejor || e.precio < mejor.precio) mejor = e;
  }
  return mejor;
}

/**
 * Valida los escalones que captura un editor. Devuelve el mensaje de error
 * (para mostrarlo tal cual) o `null` si son válidos. Reglas:
 *   - Máximo 3.
 *   - `minPz` entero ≥ 2 y estrictamente creciente.
 *   - `precio` > 0, estrictamente decreciente y menor que `precioVenta`.
 */
export function validarEscalones(
  escalones: readonly EscalonMayoreo[],
  precioVenta: number,
): string | null {
  if (escalones.length > MAX_ESCALONES) {
    return `Máximo ${MAX_ESCALONES} precios de mayoreo`;
  }
  for (let i = 0; i < escalones.length; i++) {
    const { minPz, precio } = escalones[i];
    const n = i + 1;
    if (!Number.isInteger(minPz) || minPz < 2) {
      return `Mayoreo ${n}: las piezas deben ser un número entero de 2 o más`;
    }
    if (!Number.isFinite(precio) || precio <= 0) {
      return `Mayoreo ${n}: el precio debe ser mayor que 0`;
    }
    if (precioVenta > 0 && precio >= precioVenta) {
      return `Mayoreo ${n}: el precio ($${precio}) debe ser menor que el precio normal ($${precioVenta})`;
    }
    if (i > 0) {
      const prev = escalones[i - 1];
      if (minPz <= prev.minPz) {
        return `Mayoreo ${n}: las piezas deben ser más que en el mayoreo ${i} (${prev.minPz})`;
      }
      if (precio >= prev.precio) {
        return `Mayoreo ${n}: el precio debe ser menor que en el mayoreo ${i} ($${prev.precio})`;
      }
    }
  }
  return null;
}

/** Fila de un editor de escalones (los inputs se manejan como texto). */
export type EscalonTexto = { minPz: string; precio: string };

/**
 * Filas iniciales del editor: los escalones guardados tal cual, también el
 * mayoreo legacy aunque sea inválido, para que se pueda ver y corregir.
 */
export function escalonesEditables(
  art: Pick<Articulo, "escalonesMayoreo" | "mayoreo" | "cantMayoreo">,
): EscalonTexto[] {
  if (Array.isArray(art.escalonesMayoreo)) {
    return art.escalonesMayoreo.map((e) => ({
      minPz: String(e.minPz),
      precio: String(e.precio),
    }));
  }
  if (art.mayoreo || art.cantMayoreo) {
    return [{ minPz: art.cantMayoreo ?? "", precio: art.mayoreo ?? "" }];
  }
  return [];
}

/** Filas del editor → escalones (ignora filas vacías). La validez la
 *  decide `validarEscalones`. */
export function escalonesDeTexto(
  filas: readonly EscalonTexto[],
): EscalonMayoreo[] {
  return filas
    .filter((f) => f.minPz.trim() !== "" || f.precio.trim() !== "")
    .map((f) => ({ minPz: Number(f.minPz), precio: Number(f.precio) }));
}

/**
 * Visibilidad de un artículo en los nodos de una sucursal: las sucursales
 * de mayoreo solo ven artículos `soloMayoreo`; las demás, todos menos esos.
 */
export function articuloVisibleEnSucursal(
  art: Pick<Articulo, "soloMayoreo">,
  modoMayoreo: boolean | undefined,
): boolean {
  return !!art.soloMayoreo === !!modoMayoreo;
}

// ============================================================
// Precio menudeo (artículos «Solo mayoreo»)
// ============================================================
//
// En la caja de mayoreo el precio normal es el de mayoreo. Si el ticket
// lleva menos de `PIEZAS_MAYOREO` piezas (sumando TODOS los artículos), cada
// artículo con precio menudeo se cobra a ese precio: sin escalones ni promo.

/** Piezas del ticket desde las que ya no se cobra menudeo. */
export const PIEZAS_MAYOREO = 3;

/**
 * Valida el precio menudeo que captura un editor. Devuelve el mensaje de
 * error (para mostrarlo tal cual) o `null`. Solo aplica con «Solo mayoreo»:
 * obligatorio, mayor que 0 y mayor que el precio de venta vigente (el de la
 * zona si tiene).
 */
export function validarPrecioMenudeo(
  soloMayoreo: boolean,
  precioMenudeo: string,
  precioVenta: number,
): string | null {
  if (!soloMayoreo) return null;
  const raw = (precioMenudeo ?? "").trim();
  if (!raw) {
    return `Falta el precio menudeo: se cobra cuando el ticket lleva menos de ${PIEZAS_MAYOREO} piezas`;
  }
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) {
    return "El precio menudeo debe ser mayor que 0";
  }
  if (precioVenta > 0 && n <= precioVenta) {
    return `El precio menudeo ($${n}) debe ser mayor que el precio de venta ($${precioVenta})`;
  }
  return null;
}

/**
 * Precio menudeo que cobra la caja, o `null` si no aplica: el artículo no es
 * «Solo mayoreo», no lo tiene, o no es válido (p. ej. la zona subió el
 * precio de venta y el menudeo quedó igual o menor). Sin menudeo válido la
 * línea se cobra normal.
 */
export function resolverPrecioMenudeo(
  art: Pick<Articulo, "soloMayoreo" | "precioMenudeo" | "precioVenta">,
): number | null {
  if (!art.soloMayoreo) return null;
  const n = Number(art.precioMenudeo);
  if (!art.precioMenudeo || !Number.isFinite(n) || n <= 0) return null;
  const base = Number(art.precioVenta) || 0;
  if (base > 0 && n <= base) return null;
  return n;
}

/** Para avisos en admin: estado del precio menudeo de un artículo. `null`
 *  si no es «Solo mayoreo». */
export function estadoPrecioMenudeo(
  art: Pick<Articulo, "soloMayoreo" | "precioMenudeo" | "precioVenta">,
): "ok" | "falta" | "invalido" | null {
  if (!art.soloMayoreo) return null;
  if (!art.precioMenudeo || !art.precioMenudeo.trim()) return "falta";
  return resolverPrecioMenudeo(art) === null ? "invalido" : "ok";
}

/** Campos de una línea de carrito que intervienen en el mayoreo. */
export type LineaMayoreo = {
  cantidad: string;
  precio: string;
  /** Precio cobrado por pieza cuando difiere de `precio`. */
  descuento?: string;
  /** Mientras el mayoreo está aplicado, guarda el `descuento` que la línea
   *  tenía antes (promo del catálogo); se restaura al bajar del escalón.
   *  Lo administra `aplicarEscalones`. */
  descuentoBase?: string;
  /** `grupoMayoreo` del artículo al agregarlo. */
  mayoreoGrupo?: string;
  /** `resolverEscalones` del artículo al agregarlo. */
  mayoreoEscalones?: EscalonMayoreo[];
  mayoreoAply?: string;
  escalonMinPz?: number;
  /** `resolverPrecioMenudeo` del artículo al agregarlo (solo si aplica). */
  precioMenudeo?: number;
  /** "1" mientras la línea se cobra a menudeo. Lo administra
   *  `aplicarPreciosCarrito`. */
  menudeoAply?: string;
  /** Mientras el menudeo está aplicado: el precio y la promo que la línea
   *  tenía antes; se restauran al juntar `PIEZAS_MAYOREO` piezas. */
  menudeoBase?: { precio: string; descuento?: string };
  aply_3x2?: string;
  desmarcado?: boolean;
  giftCard?: boolean;
  no_registrado?: boolean;
};

function participa(l: LineaMayoreo): boolean {
  return (
    !!l.mayoreoGrupo &&
    (l.mayoreoEscalones?.length ?? 0) > 0 &&
    !l.giftCard &&
    !l.no_registrado &&
    !l.desmarcado &&
    l.menudeoAply === undefined &&
    !(Number(l.aply_3x2) > 0)
  );
}

function tieneMayoreo(l: LineaMayoreo): boolean {
  return l.mayoreoAply !== undefined || l.escalonMinPz !== undefined;
}

/** Quita el mayoreo de una línea y le devuelve su descuento previo. Solo
 *  toca líneas que el mayoreo modificó; las demás vuelven intactas (misma
 *  instancia), incluido cualquier descuento propio. */
function sinMayoreo<T extends LineaMayoreo>(l: T): T {
  if (!tieneMayoreo(l)) return l;
  const {
    mayoreoAply: _a,
    escalonMinPz: _e,
    descuento: _d,
    descuentoBase,
    ...resto
  } = l;
  return (
    descuentoBase !== undefined ? { ...resto, descuento: descuentoBase } : resto
  ) as T;
}

/**
 * Recalcula el precio de mayoreo de todas las líneas del carrito. Se llama
 * después de CADA cambio de líneas (agregar, quitar, cantidades, 3x2,
 * desmarcar), porque agregar una pieza de un modelo puede subir de escalón
 * a otra línea de la misma zona.
 *
 * Fuera del mayoreo: regalo, no registrado, desmarcadas y con 3x2 activo
 * (no suman piezas ni reciben escalón). Las líneas que no cambian se
 * devuelven con la misma instancia.
 */
export function aplicarEscalones<T extends LineaMayoreo>(items: T[]): T[] {
  const piezasPorGrupo = new Map<string, number>();
  for (const l of items) {
    if (!participa(l)) continue;
    const g = l.mayoreoGrupo!;
    piezasPorGrupo.set(g, (piezasPorGrupo.get(g) ?? 0) + (Number(l.cantidad) || 0));
  }
  return items.map((l) => {
    if (!participa(l)) return sinMayoreo(l);
    const escalon = escalonAplicable(
      l.mayoreoEscalones!,
      piezasPorGrupo.get(l.mayoreoGrupo!) ?? 0,
    );
    // Descuento "normal" de la línea: el guardado si el mayoreo ya estaba
    // aplicado, si no el que trae ahora (promo del catálogo o ninguno).
    const normal = tieneMayoreo(l) ? l.descuentoBase : l.descuento;
    const base = Number(normal) || Number(l.precio) || 0;
    if (!escalon || escalon.precio >= base) return sinMayoreo(l);
    const descuento = String(escalon.precio);
    if (
      l.mayoreoAply === "1" &&
      l.escalonMinPz === escalon.minPz &&
      l.descuento === descuento
    ) {
      return l;
    }
    const { descuentoBase: _prev, ...resto } = l;
    return {
      ...resto,
      descuento,
      mayoreoAply: "1",
      escalonMinPz: escalon.minPz,
      ...(normal !== undefined ? { descuentoBase: normal } : {}),
    } as T;
  });
}

/** Piezas del ticket que cuentan para el menudeo: todas las líneas activas
 *  (también las no registradas y la tarjeta de cashback), menos las
 *  desmarcadas y las tarjetas de regalo. */
export function piezasDelTicket(items: readonly LineaMayoreo[]): number {
  let n = 0;
  for (const l of items) {
    if (l.desmarcado || l.giftCard) continue;
    n += Number(l.cantidad) || 0;
  }
  return n;
}

function aplicaMenudeo(l: LineaMayoreo): boolean {
  return (
    (Number(l.precioMenudeo) || 0) > 0 &&
    !l.desmarcado &&
    !l.giftCard &&
    !l.no_registrado
  );
}

/** Quita el menudeo y devuelve el precio y la promo que tenía la línea. Las
 *  líneas sin menudeo vuelven intactas (misma instancia). */
function sinMenudeo<T extends LineaMayoreo>(l: T): T {
  if (l.menudeoAply === undefined && l.menudeoBase === undefined) return l;
  const { menudeoAply: _m, menudeoBase, descuento: _d, ...resto } = l;
  const base = menudeoBase ?? { precio: l.precio };
  return {
    ...resto,
    precio: base.precio,
    ...(base.descuento !== undefined ? { descuento: base.descuento } : {}),
  } as T;
}

/** Cobra la línea a su precio menudeo: sin escalón ni promo, que se guardan
 *  en `menudeoBase` para regresarlos. */
function conMenudeo<T extends LineaMayoreo>(l: T): T {
  const precio = String(l.precioMenudeo);
  if (l.menudeoAply === "1" && l.precio === precio && l.descuento === undefined) {
    return l;
  }
  const normal = sinMayoreo(sinMenudeo(l));
  const { descuento, ...resto } = normal;
  return {
    ...resto,
    precio,
    menudeoAply: "1",
    menudeoBase: {
      precio: normal.precio,
      ...(descuento !== undefined ? { descuento } : {}),
    },
  } as T;
}

/**
 * Precios del carrito completo: menudeo y escalones. Se llama después de
 * CADA cambio de líneas, en lugar de `aplicarEscalones`.
 *   - Menos de `PIEZAS_MAYOREO` piezas en el ticket: las líneas con precio
 *     menudeo se cobran a ese precio (sin escalón ni promo).
 *   - Desde `PIEZAS_MAYOREO`: precio normal, promo y escalones como siempre.
 * Las líneas sin precio menudeo (artículos que no son «Solo mayoreo», no
 * registradas, regalo) se cobran como siempre. Las líneas que no cambian se
 * devuelven con la misma instancia.
 */
export function aplicarPreciosCarrito<T extends LineaMayoreo>(items: T[]): T[] {
  const piezas = piezasDelTicket(items);
  const menudeo = piezas > 0 && piezas < PIEZAS_MAYOREO;
  return aplicarEscalones(
    items.map((l) => (menudeo && aplicaMenudeo(l) ? conMenudeo(l) : sinMenudeo(l))),
  );
}
