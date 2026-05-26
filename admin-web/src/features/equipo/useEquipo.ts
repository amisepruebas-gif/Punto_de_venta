import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/firebase/config";
import { trackSnapshot } from "@/lib/firestoreStats";
import { useNegocio } from "@/hooks/useNegocio";
import { paths, DOC_EQUIPO, type EquipoDeTrabajoItem } from "@shared";

export function useEquipo() {
  const { negocioId } = useNegocio();
  const [equipo, setEquipo] = useState<EquipoDeTrabajoItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!negocioId) {
      setLoading(false);
      return;
    }
    const ref = doc(db, paths.dato(negocioId, DOC_EQUIPO));
    const unsub = onSnapshot(
      ref,
      { includeMetadataChanges: true },
      (snap) => {
        trackSnapshot(snap);
        if (!snap.exists()) {
          setEquipo([]);
          setLoading(false);
          return;
        }
        const data = snap.data() as Record<string, EquipoDeTrabajoItem>;
        const arr = Object.values(data).filter(
          (e): e is EquipoDeTrabajoItem =>
            !!e && typeof e === "object" && "nombre" in e && "idUsuario" in e,
        );
        arr.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
        setEquipo(arr);
        setLoading(false);
      },
      (err) => {
        console.error("useEquipo error:", err);
        setLoading(false);
      },
    );
    return unsub;
  }, [negocioId]);

  return { equipo, loading };
}
