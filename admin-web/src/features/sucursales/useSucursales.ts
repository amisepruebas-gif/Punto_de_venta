import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/firebase/config";
import { trackSnapshot } from "@/lib/firestoreStats";
import { useNegocio } from "@/hooks/useNegocio";
import { paths, type Sucursal } from "@shared";

export function useSucursales() {
  const { negocioId } = useNegocio();
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!negocioId) {
      setLoading(false);
      return;
    }
    const ref = collection(
      db,
      `${paths.negocio(negocioId)}/sucursales_web_new_version`,
    );
    const unsub = onSnapshot(
      ref,
      { includeMetadataChanges: true },
      (snap) => {
        trackSnapshot(snap);
        const arr: Sucursal[] = [];
        snap.forEach((d) => arr.push(d.data() as Sucursal));
        arr.sort((a, b) =>
          (a.nombre ?? "").localeCompare(b.nombre ?? "", "es"),
        );
        setSucursales(arr);
        setLoading(false);
      },
      (err) => {
        console.error("useSucursales error:", err);
        setLoading(false);
      },
    );
    return unsub;
  }, [negocioId]);

  return { sucursales, loading };
}
