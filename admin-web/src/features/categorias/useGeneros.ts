import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/firebase/config";
import { trackSnapshot } from "@/lib/firestoreStats";
import { useNegocio } from "@/hooks/useNegocio";
import { paths, type Genero } from "@shared";

/** Géneros del negocio, ordenados por nombre (es-MX). `error`: no se pudo
 *  leer la lista (p. ej. sin permiso); entonces no hay que tomar los
 *  `generoId` de los artículos como borrados. */
export function useGeneros(): { generos: Genero[]; loading: boolean; error: boolean } {
  const { negocioId } = useNegocio();
  const [generos, setGeneros] = useState<Genero[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!negocioId) {
      setLoading(false);
      return;
    }
    return onSnapshot(
      collection(db, paths.generosCol(negocioId)),
      { includeMetadataChanges: true },
      (snap) => {
        trackSnapshot(snap);
        const arr: Genero[] = [];
        snap.forEach((d) => arr.push(d.data() as Genero));
        arr.sort((a, b) => (a.nombre ?? "").localeCompare(b.nombre ?? "", "es"));
        setGeneros(arr);
        setError(false);
        setLoading(false);
      },
      (err) => {
        console.error("useGeneros error:", err);
        setError(true);
        setLoading(false);
      },
    );
  }, [negocioId]);

  return { generos, loading, error };
}
