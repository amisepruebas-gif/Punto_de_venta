import { useCarrito } from "./carritoStore";
import {
  parseVariacionCodigo,
  type Articulo,
  type ArticuloSubvariacion,
} from "@shared";

/**
 * Lo que pasa al elegir un artículo en la caja, igual desde el buscador que
 * desde el panel de filtros:
 * - con variaciones (V2) → el contenedor abre el selector de variación;
 * - con seña → el contenedor abre el modal de la descripción;
 * - si no → directo al carrito.
 */
export type ResultadoEleccion = "variacion" | "sena" | "agregado";

export function useElegirArticulo({
  onPedirVariacion,
  onPedirSena,
}: {
  onPedirVariacion: (padre: Articulo) => void;
  onPedirSena: (padre: Articulo) => void;
}) {
  const { agregar } = useCarrito();

  /** Elige un padre (de una sugerencia o de una tarjeta). */
  function elegir(padre: Articulo, tieneVariaciones: boolean): ResultadoEleccion {
    if (tieneVariaciones) {
      onPedirVariacion(padre);
      return "variacion";
    }
    // Artículo sin variaciones con flag `seña` → modal para capturar la
    // descripción antes de añadirlo (como el popVariacion_venta del nodo_1).
    if (padre.seña !== undefined) {
      onPedirSena(padre);
      return "sena";
    }
    const imagenUrl = padre.imagenUrl;
    agregar(padre, { ...(imagenUrl ? { imagenUrl } : {}) });
    return "agregado";
  }

  /** Variación escaneada: directo al carrito, salvo artículos con seña (su
   *  modal captura la descripción). */
  function elegirVariacion(padre: Articulo, sub: ArticuloSubvariacion): ResultadoEleccion {
    if (padre.seña !== undefined) return elegir(padre, true);
    const imagenUrl = sub.imagenUrl ?? padre.imagenUrl;
    agregar(padre, {
      subvariacionCodigo: sub.codigo,
      subvariacionNombre: sub.nombre,
      ...(imagenUrl ? { imagenUrl } : {}),
    });
    return "agregado";
  }

  return { elegir, elegirVariacion };
}

/**
 * Coincidencia exacta del texto con un código: `v-NN-XXX` (solo si el padre
 * tiene variaciones V2), id de 8 dígitos o sigla. Es lo que manda el lector
 * al escanear una etiqueta.
 */
export function resolverCodigoExacto(
  texto: string,
  byId: ReadonlyMap<string, Articulo>,
  bySigla: ReadonlyMap<string, Articulo>,
  tieneVariacionesV2: (idPadre: string) => boolean,
): { padre: Articulo; sub?: ArticuloSubvariacion } | null {
  const limpio = texto.trim();
  if (!limpio) return null;
  if (limpio.startsWith("v-")) {
    const partes = parseVariacionCodigo(limpio);
    const padre = partes ? byId.get(partes.idPadre) : undefined;
    const sub = padre?.subvariaciones?.find((s) => s.codigo === limpio);
    if (!padre || !sub || !tieneVariacionesV2(padre.id)) return null;
    return { padre, sub };
  }
  const padre = byId.get(limpio) ?? bySigla.get(limpio.toLowerCase());
  return padre ? { padre } : null;
}

/** Aviso cuando se escanea un artículo que no se vende en esta sucursal. */
export function avisoNoVisible(padre: Articulo, modoMayoreo: boolean): string {
  return modoMayoreo
    ? `"${padre.nombre}" no es de mayoreo: esta sucursal solo vende artículos de mayoreo`
    : `"${padre.nombre}" es solo mayoreo: no se vende en esta sucursal`;
}
