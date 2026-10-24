import { useEffect, useMemo, useState } from "react";
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/firebase/config";
import { trackSnapshot } from "@/lib/firestoreStats";
import { useNegocio } from "@/hooks/useNegocio";
import { useSucursales } from "@/features/sucursales/useSucursales";
import {
  paths,
  resolverSucursalDefaultId,
  resolverUbicacionStock,
  type AjusteInventario,
  type LoteProduccion,
  type UbicacionResuelta,
} from "@shared";

/** Id de la ubicación "Taller" (la bodega global) en los selectores. */
export const TALLER_ID = "bodega";

/** Lotes de producción, más recientes primero (fecha de producción y,
 *  dentro del día, hora de registro). */
export function useLotesProduccion(): { lotes: LoteProduccion[]; loading: boolean } {
  const { negocioId } = useNegocio();
  const [lotes, setLotes] = useState<LoteProduccion[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!negocioId) {
      setLoading(false);
      return;
    }
    const q = query(
      collection(db, paths.produccionCol(negocioId)),
      orderBy("fechaRegistro", "desc"),
      limit(2000),
    );
    return onSnapshot(
      q,
      (snap) => {
        trackSnapshot(snap);
        const arr: LoteProduccion[] = [];
        snap.forEach((d) => arr.push(d.data() as LoteProduccion));
        arr.sort(
          (a, b) =>
            b.fechaProduccion.localeCompare(a.fechaProduccion) ||
            b.fechaRegistro.localeCompare(a.fechaRegistro),
        );
        setLotes(arr);
        setLoading(false);
      },
      (err) => {
        console.error("useLotesProduccion error:", err);
        setLoading(false);
      },
    );
  }, [negocioId]);
  return { lotes, loading };
}

/** Reducciones con motivo de un artículo, más recientes primero. */
export function useAjustesArticulo(articuloId: string | null): {
  ajustes: AjusteInventario[];
  loading: boolean;
} {
  const { negocioId } = useNegocio();
  const [ajustes, setAjustes] = useState<AjusteInventario[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!negocioId || !articuloId) {
      setLoading(false);
      return;
    }
    // Solo igualdad: no requiere índice compuesto; se ordena aquí.
    const q = query(
      collection(db, paths.ajustesCol(negocioId)),
      where("articuloId", "==", articuloId),
    );
    return onSnapshot(
      q,
      (snap) => {
        trackSnapshot(snap);
        const arr: AjusteInventario[] = [];
        snap.forEach((d) => arr.push(d.data() as AjusteInventario));
        arr.sort((a, b) => b.fecha.localeCompare(a.fecha));
        setAjustes(arr);
        setLoading(false);
      },
      (err) => {
        console.error("useAjustesArticulo error:", err);
        setLoading(false);
      },
    );
  }, [negocioId, articuloId]);
  return { ajustes, loading };
}

/**
 * Ubicaciones de stock para los selectores de Fabricación: el Taller (la
 * bodega global) y la tienda de cada sucursal, con la default resuelta.
 */
export function useUbicaciones() {
  const { negocio, loading: cargandoNegocio } = useNegocio();
  const { sucursales, loading: cargandoSucursales } = useSucursales();
  const ids = useMemo(() => sucursales.map((s) => s.sucursalId), [sucursales]);
  const defaultSucursalId = resolverSucursalDefaultId(
    negocio?.sucursalDefaultId,
    ids,
  );
  const listo = !cargandoNegocio && !cargandoSucursales;

  function resolver(id: string): UbicacionResuelta | null {
    if (id === TALLER_ID) return { tipo: "bodega" };
    if (!listo || !ids.includes(id)) return null;
    return {
      tipo: "sucursal",
      ...resolverUbicacionStock(id, negocio?.sucursalDefaultId, ids),
    };
  }
  function nombre(id: string): string {
    if (id === TALLER_ID) return "Taller";
    return sucursales.find((s) => s.sucursalId === id)?.nombre ?? id;
  }
  return { sucursales, defaultSucursalId, listo, resolver, nombre };
}
