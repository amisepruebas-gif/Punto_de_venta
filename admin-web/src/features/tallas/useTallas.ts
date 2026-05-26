import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/firebase/config";
import { trackSnapshot } from "@/lib/firestoreStats";
import { useNegocio } from "@/hooks/useNegocio";
import { paths, DOC_TALLAS } from "@shared";

export type GrupoTallas = {
  nombre: string;
  tallas: string[];
};

export function useTallas() {
  const { negocioId } = useNegocio();
  const [grupos, setGrupos] = useState<GrupoTallas[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!negocioId) {
      setLoading(false);
      return;
    }
    const ref = doc(db, paths.dato(negocioId, DOC_TALLAS));
    const unsub = onSnapshot(
      ref,
      { includeMetadataChanges: true },
      (snap) => {
        trackSnapshot(snap);
        if (!snap.exists()) {
          setGrupos([]);
          setLoading(false);
          return;
        }
        const data = snap.data() as Record<string, string[]>;
        const arr: GrupoTallas[] = Object.entries(data)
          .filter(
            ([, v]) => Array.isArray(v) && v.every((x) => typeof x === "string"),
          )
          .map(([nombre, tallas]) => ({ nombre, tallas }));
        arr.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
        setGrupos(arr);
        setLoading(false);
      },
      (err) => {
        console.error("useTallas error:", err);
        setLoading(false);
      },
    );
    return unsub;
  }, [negocioId]);

  return { grupos, loading };
}
