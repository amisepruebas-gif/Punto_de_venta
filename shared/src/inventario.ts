// ============================================================
// Movimientos de inventario — helpers puros
// ============================================================
//
// Un solo planificador para todo lo que suma o resta stock fuera de la
// venta: lotes de producción, reducciones con motivo e ingreso de
// mercancía. Calcula los campos a escribir; el caller los aplica dentro de
// su transacción (leer → planear → `tx.update(ref, plan.patch)`).
//
// Ubicaciones (ver `Articulo`):
//   - bodega (en Fabricación se muestra como "Taller") → `cantidadBodega`.
//   - sucursal default → `cantidad`.
//   - otra sucursal → `cantidadPorSucursal[sid]`.
//   - bodega de una tienda → `cantidadBodegaSucursal[sid]`.
// Con subvariación el stock vive en la subvariación; el padre guarda la
// suma solo para bodega y sucursal default (mismo criterio que
// `cerrarResurtido` y el `stockService` del POS).

import type {
  Articulo,
  ArticuloSubvariacion,
  MotivoAjuste,
  UbicacionInventario,
} from "./schema";
import { conStockTienda, leerStockTienda } from "./stockSucursal";

/** `UbicacionInventario` con la sucursal default ya resuelta. */
export type UbicacionResuelta =
  | { tipo: "bodega" }
  | { tipo: "sucursal"; sucursalId: string; esDefault: boolean }
  | { tipo: "bodegaSucursal"; sucursalId: string };

type StockShape = Pick<
  ArticuloSubvariacion,
  "cantidad" | "cantidadBodega" | "cantidadPorSucursal" | "cantidadBodegaSucursal"
>;

/** Piezas en la bodega de la tienda `sid` (0 si no hay dato). */
export function leerBodegaSucursal(
  obj: Pick<StockShape, "cantidadBodegaSucursal">,
  sid: string,
): number {
  return Number(obj.cantidadBodegaSucursal?.[sid]) || 0;
}

/** Stock en `ubicacion` de un artículo o subvariación. */
export function leerStockUbicacion(
  obj: StockShape,
  ubicacion: UbicacionResuelta,
): number {
  if (ubicacion.tipo === "bodega") return Number(obj.cantidadBodega) || 0;
  if (ubicacion.tipo === "bodegaSucursal") {
    return leerBodegaSucursal(obj, ubicacion.sucursalId);
  }
  return leerStockTienda(obj, ubicacion.sucursalId, ubicacion.esDefault);
}

/** Copia de `obj` con el stock de `ubicacion` reemplazado por `valor`. */
export function conStockUbicacion<T extends StockShape>(
  obj: T,
  ubicacion: UbicacionResuelta,
  valor: number,
): T {
  if (ubicacion.tipo === "bodega") {
    return { ...obj, cantidadBodega: String(valor) };
  }
  if (ubicacion.tipo === "bodegaSucursal") {
    return {
      ...obj,
      cantidadBodegaSucursal: {
        ...(obj.cantidadBodegaSucursal ?? {}),
        [ubicacion.sucursalId]: String(valor),
      },
    };
  }
  return conStockTienda(obj, ubicacion.sucursalId, ubicacion.esDefault, valor);
}

/** Quita el `esDefault` para persistir la ubicación en un lote o ajuste. */
export function ubicacionPersistible(
  ubicacion: UbicacionResuelta,
): UbicacionInventario {
  if (ubicacion.tipo === "bodega") return { tipo: "bodega" };
  return { tipo: ubicacion.tipo, sucursalId: ubicacion.sucursalId };
}

/** Bodega y tienda de una sucursal para un artículo final (artículo sin
 *  variaciones o una variación). */
export type ExistenciasTienda = { bodega: number; tienda: number };

export function leerExistenciasTienda(
  obj: StockShape,
  sid: string,
  esDefault: boolean,
): ExistenciasTienda {
  return {
    bodega: leerBodegaSucursal(obj, sid),
    tienda: leerStockTienda(obj, sid, esDefault),
  };
}

/** ¿Tiene piezas en CUALQUIER ubicación (taller, tiendas o bodegas de
 *  tienda)? Para no quitar una variación, ni cambiar si un artículo lleva
 *  variaciones, mientras haya existencias que se perderían de vista. */
export function tieneExistencias(obj: StockShape): boolean {
  const alguno = (mapa?: { [sid: string]: string }) =>
    Object.values(mapa ?? {}).some((v) => (Number(v) || 0) > 0);
  return (
    (Number(obj.cantidad) || 0) > 0 ||
    (Number(obj.cantidadBodega) || 0) > 0 ||
    alguno(obj.cantidadPorSucursal) ||
    alguno(obj.cantidadBodegaSucursal)
  );
}

export type PlanMovimientoStock = {
  /** Campos a escribir en el doc del artículo (`tx.update(ref, patch)`). */
  patch: Partial<Articulo>;
  cantidadAnterior: number;
  cantidadNueva: number;
};

/**
 * Planea sumar `delta` piezas (negativo = restar) en `ubicacion`. Lanza si
 * el delta no es un entero distinto de cero, si la variación no existe, si
 * el artículo tiene variaciones y no se indicó cuál, o si el stock quedaría
 * negativo.
 */
export function planearMovimientoStock(
  art: Articulo,
  ubicacion: UbicacionResuelta,
  delta: number,
  opts: { subvariacionCodigo?: string } = {},
): PlanMovimientoStock {
  if (!Number.isInteger(delta) || delta === 0) {
    throw new Error("La cantidad debe ser un número entero distinto de cero");
  }
  const subs = art.subvariaciones ?? [];

  if (opts.subvariacionCodigo) {
    const idx = subs.findIndex((s) => s.codigo === opts.subvariacionCodigo);
    if (idx === -1) {
      throw new Error(
        `La variación ${opts.subvariacionCodigo} no existe en "${art.nombre}"`,
      );
    }
    const cantidadAnterior = leerStockUbicacion(subs[idx], ubicacion);
    const cantidadNueva = cantidadAnterior + delta;
    validarNoNegativo(cantidadAnterior, cantidadNueva, art.nombre);
    const nuevas = subs.map((s, i) =>
      i === idx ? conStockUbicacion(s, ubicacion, cantidadNueva) : s,
    );
    const patch: Partial<Articulo> = { subvariaciones: nuevas };
    // El padre guarda la suma solo donde lo hace el resto del sistema.
    if (ubicacion.tipo === "bodega") {
      patch.cantidadBodega = String(sumar(nuevas, (s) => s.cantidadBodega));
    } else if (ubicacion.tipo === "sucursal" && ubicacion.esDefault) {
      patch.cantidad = String(sumar(nuevas, (s) => s.cantidad));
    }
    return { patch, cantidadAnterior, cantidadNueva };
  }

  if (subs.length > 0) {
    throw new Error(`"${art.nombre}" tiene variaciones: elige cuál`);
  }
  const cantidadAnterior = leerStockUbicacion(art, ubicacion);
  const cantidadNueva = cantidadAnterior + delta;
  validarNoNegativo(cantidadAnterior, cantidadNueva, art.nombre);
  const actualizado = conStockUbicacion(art, ubicacion, cantidadNueva);
  const patch: Partial<Articulo> =
    ubicacion.tipo === "bodega"
      ? { cantidadBodega: actualizado.cantidadBodega }
      : ubicacion.tipo === "bodegaSucursal"
        ? { cantidadBodegaSucursal: actualizado.cantidadBodegaSucursal }
        : ubicacion.esDefault
          ? { cantidad: actualizado.cantidad }
          : { cantidadPorSucursal: actualizado.cantidadPorSucursal };
  return { patch, cantidadAnterior, cantidadNueva };
}

function validarNoNegativo(anterior: number, nueva: number, nombre: string) {
  if (nueva < 0) {
    throw new Error(
      `Stock insuficiente de "${nombre}": hay ${anterior}, se piden ${anterior - nueva}`,
    );
  }
}

function sumar<T>(arr: T[], campo: (x: T) => string | undefined): number {
  return arr.reduce((acc, x) => acc + (Number(campo(x)) || 0), 0);
}

// ---------- Reducciones con motivo ----------

export const MOTIVOS_AJUSTE: Record<MotivoAjuste, string> = {
  extravio: "Extravío",
  danado: "Dañado",
  otro: "Otro",
  sin_motivo: "Sin motivo",
};

/**
 * Valida una reducción manual. Devuelve el mensaje de error o `null`.
 * `piezas` es positivo (lo que se quita); "otro" exige especificar.
 */
export function validarAjuste(input: {
  piezas: number;
  motivo: MotivoAjuste;
  motivoDetalle?: string;
}): string | null {
  if (!Number.isInteger(input.piezas) || input.piezas <= 0) {
    return "Indica cuántas piezas se reducen (entero mayor que 0)";
  }
  if (!(input.motivo in MOTIVOS_AJUSTE)) return "Elige un motivo";
  if (input.motivo === "otro" && !input.motivoDetalle?.trim()) {
    return 'Especifica el motivo cuando eliges "Otro"';
  }
  return null;
}

// ---------- Folios de fabricación ----------

/** Folio legible del lote número `n`: `FAB-000123`. */
export function folioFabricacion(n: number): string {
  return `FAB-${String(n).padStart(6, "0")}`;
}
