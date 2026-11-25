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
 *  (null mientras resuelve o si no hay sucursal ligada). Si no se pudo leer
 *  (la página se abrió sin internet) se vuelve a intentar sola, y de
 *  inmediato cuando regresa la conexión. */
export function useUbicacionStock(): UbicacionStock | null {
  const { binding } = useSession();
  const negocioId = binding?.negocioId;
  const sucursalId = binding?.sucursalId;
  const [ubicacion, setUbicacion] = useState<UbicacionStock | null>(null);
  useEffect(() => {
    // Otra sucursal: la ubicación anterior ya no vale.
    setUbicacion(null);
    if (!negocioId || !sucursalId) return;
    let vivo = true;
    let listo = false;
    let espera = 2000;
    let reintento: number | undefined;
    const cargar = () => {
      if (!vivo || listo) return;
      window.clearTimeout(reintento);
      cargarUbicacionStock(negocioId, sucursalId)
        .then((u) => {
          if (!vivo) return;
          listo = true;
          setUbicacion(u);
        })
        .catch((e) => {
          console.warn("useUbicacionStock:", e);
          if (!vivo) return;
          reintento = window.setTimeout(cargar, espera);
          espera = Math.min(espera * 2, 15_000);
        });
    };
    cargar();
    window.addEventListener("online", cargar);
    return () => {
      vivo = false;
      window.clearTimeout(reintento);
      window.removeEventListener("online", cargar);
    };
  }, [negocioId, sucursalId]);
  return ubicacion;
}
