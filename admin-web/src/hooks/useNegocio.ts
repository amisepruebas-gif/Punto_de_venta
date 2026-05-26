import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/firebase/config";
import { trackSnapshot } from "@/lib/firestoreStats";
import { useAuth } from "./useAuth";
import { paths, type Negocio } from "@shared";

// Fallback cuando el superadmin no tiene claim negocioId asignado.
// Multi-negocio UI añadirá un selector en Fase 4.
const NEGOCIO_DEFAULT = import.meta.env.VITE_NEGOCIO_ID || "amise";

/** Lee el doc del negocio del usuario autenticado. */
export function useNegocio() {
  const { user } = useAuth();
  const claimNegocioId = user?.claims.negocioId ?? null;
  const esSuperadmin = user?.claims.role === "superadmin";
  const negocioId = claimNegocioId ?? (esSuperadmin ? NEGOCIO_DEFAULT : null);
  const [negocio, setNegocio] = useState<Negocio | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!negocioId) {
      setLoading(false);
      return;
    }
    const unsub = onSnapshot(
      doc(db, paths.negocio(negocioId)),
      { includeMetadataChanges: true },
      (snap) => {
        trackSnapshot(snap);
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

  return { negocio, negocioId, loading };
}
