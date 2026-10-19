import { useEffect, useMemo, useState } from "react";
import { useNodoSession } from "@/hooks/useNodoSession";
import { useNegocio } from "@/features/negocio/useNegocio";
import { resolverUbicacionStock, type UbicacionStock } from "@shared";
import { cargarSucursalesIds } from "./ubicacionStock";

/**
 * Sucursal del nodo con el default ya resuelto, para MOSTRAR stock
 * (`leerStockTienda`). Usa el doc del negocio en vivo; sólo carga los ids
 * de sucursales si `sucursalDefaultId` no está seteado (fallback
 * alfabético). Devuelve `null` mientras resuelve.
 */
export function useUbicacionStock(): UbicacionStock | null {
  const { negocioId, sucursalId } = useNodoSession();
  const { negocio, loading } = useNegocio();
  const defaultId = negocio?.sucursalDefaultId;
  const [ids, setIds] = useState<string[] | null>(null);

  useEffect(() => {
    setIds(null);
    if (!negocioId || loading || defaultId) return;
    let vigente = true;
    cargarSucursalesIds(negocioId)
      .then((r) => {
        if (vigente) setIds(r);
      })
      .catch((e) => {
        console.warn("useUbicacionStock: no se pudieron cargar sucursales:", e);
        if (vigente) setIds([]);
      });
    return () => {
      vigente = false;
    };
  }, [negocioId, loading, defaultId]);

  return useMemo(() => {
    if (!sucursalId || loading) return null;
    if (!defaultId && ids === null) return null;
    return resolverUbicacionStock(sucursalId, defaultId, ids ?? []);
  }, [sucursalId, loading, defaultId, ids]);
}
