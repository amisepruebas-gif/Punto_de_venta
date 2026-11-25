import { useMemo } from "react";
import { useArticulos } from "@/features/articulos/useArticulos";
import { useCategorias } from "@/features/categorias/useCategorias";
import { useSucursalActual } from "@/features/sucursal/useSucursalActual";
import { useUbicacionStock } from "@/features/sucursal/ubicacionStock";
import { armarFilas, type FilaExistencias } from "./filasExistencias";

/**
 * Artículos finales de esta sucursal con sus piezas en bodega y tienda, en
 * vivo. Solo lee lo que también puede leer el encargado de tienda
 * (artículos, categorías, subcategorías, negocio y sucursales).
 */
export function useExistencias() {
  const { articulos, loading: cargandoArt } = useArticulos();
  const { categorias, subcategorias, loading: cargandoCat } = useCategorias();
  const { sucursal, cargando: cargandoSuc } = useSucursalActual();
  const ubicacion = useUbicacionStock();
  const modoMayoreo = sucursal?.modoMayoreo;

  const filas = useMemo<FilaExistencias[]>(
    () =>
      ubicacion
        ? armarFilas(articulos, {
            sucursalId: ubicacion.sucursalId,
            esDefault: ubicacion.esDefault,
            modoMayoreo,
            categorias,
            subcategorias,
          })
        : [],
    [articulos, categorias, subcategorias, ubicacion, modoMayoreo],
  );
  const porClave = useMemo(
    () => new Map(filas.map((f) => [f.clave, f])),
    [filas],
  );

  return {
    filas,
    porClave,
    sucursal,
    cargando: cargandoArt || cargandoCat || cargandoSuc || !ubicacion,
  };
}
