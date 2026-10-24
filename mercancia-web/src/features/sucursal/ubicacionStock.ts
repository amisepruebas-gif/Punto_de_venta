import { useEffect, useState } from "react";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { db } from "@/firebase/config";
import { useSession } from "@/hooks/useSession";
import {
  COL_SUCURSALES,
  paths,
  resolverUbicacionStock,
  type Negocio,
  type UbicacionStock,
} from "@shared";

/**
 * Resuelve sobre qué campo de stock opera la sucursal `sucursalId`
 * (`cantidad` si es la default del negocio, `cantidadPorSucursal[sid]` si
 * no). Lee el negocio y los ids de sucursales; llamar FUERA de las
 * transacciones (no pueden leer colecciones). Mismo contrato que
 * `nodo-web/src/features/sucursal/ubicacionStock.ts`.
 */
export async function cargarUbicacionStock(
  negocioId: string,
  sucursalId: string,
): Promise<UbicacionStock> {
  const [negocioSnap, sucursalesSnap] = await Promise.all([
    getDoc(doc(db, paths.negocio(negocioId))),
    getDocs(collection(db, `${paths.negocio(negocioId)}/${COL_SUCURSALES}`)),
  ]);
  const negocio = negocioSnap.exists() ? (negocioSnap.data() as Negocio) : null;
  const ids: string[] = [];
  sucursalesSnap.forEach((d) => ids.push(d.id));
  return resolverUbicacionStock(sucursalId, negocio?.sucursalDefaultId, ids);
}

/** Ubicación de stock de la sucursal a la que está ligado este teléfono
 *  (null mientras resuelve o si no hay sucursal ligada). */
export function useUbicacionStock(): UbicacionStock | null {
  const { binding } = useSession();
  const [ubicacion, setUbicacion] = useState<UbicacionStock | null>(null);
  useEffect(() => {
    if (!binding) {
      setUbicacion(null);
      return;
    }
    let vivo = true;
    cargarUbicacionStock(binding.negocioId, binding.sucursalId)
      .then((u) => vivo && setUbicacion(u))
      .catch((e) => console.warn("useUbicacionStock:", e));
    return () => {
      vivo = false;
    };
  }, [binding]);
  return ubicacion;
}
