import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/firebase/config";
import { trackSnapshot } from "@/lib/firestoreStats";
import { useNodoSession } from "@/hooks/useNodoSession";
import { paths, type Sucursal } from "@shared";

export function useSucursal(): { sucursal: Sucursal | null; loading: boolean } {
  const { negocioId, sucursalId } = useNodoSession();
  const [sucursal, setSucursal] = useState<Sucursal | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!negocioId || !sucursalId) {
      setLoading(false);
      return;
    }
    const ref = doc(db, paths.sucursal(negocioId, sucursalId));
    const unsub = onSnapshot(
      ref,
      { includeMetadataChanges: true },
      (snap) => {
        trackSnapshot(snap, paths.sucursal(negocioId, sucursalId));
        setSucursal(snap.exists() ? (snap.data() as Sucursal) : null);
        setLoading(false);
      },
      (err) => {
        console.error("useSucursal error:", err);
        setLoading(false);
      },
    );
    return unsub;
  }, [negocioId, sucursalId]);

  return { sucursal, loading };
}
