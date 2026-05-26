import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/firebase/config";
import { trackSnapshot } from "@/lib/firestoreStats";
import { useNegocio } from "@/hooks/useNegocio";
import { paths, type Colaborador } from "@shared";

export function useColaboradores() {
  const { negocioId } = useNegocio();
  const [items, setItems] = useState<Colaborador[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!negocioId) {
      setLoading(false);
      return;
    }
    const ref = collection(db, paths.colaboradoresCol(negocioId));
    const unsub = onSnapshot(
      ref,
      { includeMetadataChanges: true },
      (snap) => {
        trackSnapshot(snap);
        const rows: Colaborador[] = [];
        snap.forEach((d) => rows.push(d.data() as Colaborador));
        rows.sort((a, b) =>
          (a.nombre ?? a.username ?? "").localeCompare(
            b.nombre ?? b.username ?? "",
            "es",
          ),
        );
        setItems(rows);
        setLoading(false);
      },
      (err) => {
        console.error("useColaboradores error:", err);
        setLoading(false);
      },
    );
    return unsub;
  }, [negocioId]);

  return { items, loading };
}
