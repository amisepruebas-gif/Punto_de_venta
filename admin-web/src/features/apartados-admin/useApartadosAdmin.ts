import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/firebase/config";
import { trackSnapshot } from "@/lib/firestoreStats";
import { useNegocio } from "@/hooks/useNegocio";
import { paths, type Apartado } from "@shared";

/** Escucha apartados de UNA sucursal en vivo. */
export function useApartadosSucursal(sucursalId: string | null) {
  const { negocioId } = useNegocio();
  const [apartados, setApartados] = useState<Apartado[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!negocioId || !sucursalId) {
      setApartados([]);
      setLoading(false);
      return;
    }
    const ref = collection(
      db,
      `${paths.sucursalData(negocioId, sucursalId)}/apartados_web_new_version`,
    );
    const unsub = onSnapshot(
      ref,
      { includeMetadataChanges: true },
      (snap) => {
        trackSnapshot(snap);
        const arr: Apartado[] = [];
        snap.forEach((d) => arr.push(d.data() as Apartado));
        arr.sort((a, b) => b.fechaCreacion.localeCompare(a.fechaCreacion));
        setApartados(arr);
        setLoading(false);
      },
      (err) => {
        console.error("useApartadosSucursal error:", err);
        setLoading(false);
      },
    );
    return unsub;
  }, [negocioId, sucursalId]);

  return { apartados, loading };
}
