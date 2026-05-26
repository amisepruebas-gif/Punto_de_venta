import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/firebase/config";
import { trackSnapshot } from "@/lib/firestoreStats";
import { useNegocio } from "@/hooks/useNegocio";
import { paths, type Nodo } from "@shared";

export function useNodos() {
  const { negocioId } = useNegocio();
  const [nodos, setNodos] = useState<Nodo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!negocioId) {
      setLoading(false);
      return;
    }
    const ref = collection(
      db,
      `${paths.negocio(negocioId)}/nodos_web_new_version`,
    );
    const unsub = onSnapshot(
      ref,
      { includeMetadataChanges: true },
      (snap) => {
        trackSnapshot(snap);
        const arr: Nodo[] = [];
        snap.forEach((d) => arr.push(d.data() as Nodo));
        arr.sort((a, b) => (a.nombre ?? "").localeCompare(b.nombre ?? "", "es"));
        setNodos(arr);
        setLoading(false);
      },
      (err) => {
        console.error("useNodos error:", err);
        setLoading(false);
      },
    );
    return unsub;
  }, [negocioId]);

  return { nodos, loading };
}
