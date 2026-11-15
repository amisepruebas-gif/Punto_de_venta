import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/firebase/config";
import { trackSnapshot } from "@/lib/firestoreStats";
import { useNegocio } from "@/hooks/useNegocio";
import { paths, type Genero } from "@shared";

/** Géneros del negocio, ordenados por nombre (es-MX). */
export function useGeneros(): { generos: Genero[]; loading: boolean } {
  const { negocioId } = useNegocio();
  const [generos, setGeneros] = useState<Genero[]>([]);
  const [loading, setLoading] = useState(true);

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
        setLoading(false);
      },
      (err) => {
        console.error("useGeneros error:", err);
        setLoading(false);
      },
    );
  }, [negocioId]);

  return { generos, loading };
}
