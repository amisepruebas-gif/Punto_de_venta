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
