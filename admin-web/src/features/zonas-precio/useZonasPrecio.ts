import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/firebase/config";
import { trackSnapshot } from "@/lib/firestoreStats";
import { useNegocio } from "@/hooks/useNegocio";
import { paths, type ZonaPrecio } from "@shared";

/** Zonas de precios del negocio, ordenadas por nombre (activas e
 *  inactivas; quien las ofrece para asignar filtra `activa`). */
export function useZonasPrecio(): { zonas: ZonaPrecio[]; loading: boolean } {
  const { negocioId } = useNegocio();
  const [zonas, setZonas] = useState<ZonaPrecio[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!negocioId) {
      setLoading(false);
      return;
    }
    const unsub = onSnapshot(
      collection(db, paths.zonasPrecioCol(negocioId)),
      (snap) => {
        trackSnapshot(snap);
        const arr: ZonaPrecio[] = [];
        snap.forEach((d) => arr.push(d.data() as ZonaPrecio));
        arr.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
        setZonas(arr);
        setLoading(false);
      },
      (err) => {
        console.error("useZonasPrecio error:", err);
        setLoading(false);
      },
    );
    return unsub;
  }, [negocioId]);

  return { zonas, loading };
}
