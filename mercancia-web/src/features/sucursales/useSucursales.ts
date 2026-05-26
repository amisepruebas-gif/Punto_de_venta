import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/firebase/config";
import { useNegocio } from "@/hooks/useNegocio";
import { COL_SUCURSALES, paths, type Sucursal } from "@shared";

/**
 * Suscribe a la lista de sucursales del negocio. Útil para el picker de
 * "destino" del resurtido. Sólo lectura.
 */
export function useSucursales() {
  const { negocioId } = useNegocio();
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!negocioId) {
      setLoading(false);
      return;
    }
    const ref = collection(db, `${paths.negocio(negocioId)}/${COL_SUCURSALES}`);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        const arr: Sucursal[] = [];
        snap.forEach((d) => arr.push(d.data() as Sucursal));
        arr.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
        setSucursales(arr);
        setLoading(false);
      },
      () => setLoading(false),
    );
    return unsub;
  }, [negocioId]);

  return { sucursales, loading };
}
