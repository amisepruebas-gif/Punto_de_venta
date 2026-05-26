import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/firebase/config";
import { trackSnapshot } from "@/lib/firestoreStats";
import { useNodoSession } from "@/hooks/useNodoSession";
import { paths, type Negocio } from "@shared";

/**
 * Suscribe al doc del negocio. Permite a nodo-web leer banderas de
 * configuración como `usaSubvariacionesV2` (Fase 5 del plan de Ingreso de
 * Mercancía) sin forzar al usuario a recargar la app cuando se activan
 * desde admin-web.
 */
export function useNegocio(): { negocio: Negocio | null; loading: boolean } {
  const { negocioId } = useNodoSession();
  const [negocio, setNegocio] = useState<Negocio | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!negocioId) {
      setLoading(false);
      return;
    }
    const ref = doc(db, paths.negocio(negocioId));
    const unsub = onSnapshot(
      ref,
      { includeMetadataChanges: true },
      (snap) => {
        trackSnapshot(snap, paths.negocio(negocioId));
        setNegocio(snap.exists() ? (snap.data() as Negocio) : null);
        setLoading(false);
      },
      (err) => {
        console.error("useNegocio error:", err);
        setLoading(false);
      },
    );
    return unsub;
  }, [negocioId]);

  return { negocio, loading };
}
