import { useEffect, useState } from "react";
import { collection, doc, onSnapshot } from "firebase/firestore";
import { db } from "@/firebase/config";
import { trackSnapshot } from "@/lib/firestoreStats";
import { useNegocio } from "@/hooks/useNegocio";
import { paths, type Articulo } from "@shared";

export function useArticulos() {
  const { negocioId } = useNegocio();
  const [articulos, setArticulos] = useState<Articulo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!negocioId) {
      setLoading(false);
      return;
    }
    const ref = collection(
      db,
      `${paths.negocio(negocioId)}/articulos_n_web_new_version`,
    );
    const unsub = onSnapshot(
      ref,
      { includeMetadataChanges: true },
      (snap) => {
        trackSnapshot(snap);
        const arr: Articulo[] = [];
        snap.forEach((d) => arr.push(d.data() as Articulo));
        arr.sort((a, b) =>
          (a.nombre ?? "").localeCompare(b.nombre ?? "", "es"),
        );
        setArticulos(arr);
        setLoading(false);
      },
      (err) => {
        console.error("useArticulos error:", err);
        setLoading(false);
      },
    );
    return unsub;
  }, [negocioId]);

  return { articulos, loading };
}

export function useArticulo(id: string | null) {
  const { negocioId } = useNegocio();
  const [articulo, setArticulo] = useState<Articulo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!negocioId || !id) {
      setArticulo(null);
      setLoading(false);
      return;
    }
    const unsub = onSnapshot(
      doc(db, paths.articulo(negocioId, id)),
      { includeMetadataChanges: true },
      (snap) => {
        trackSnapshot(snap);
        setArticulo(snap.exists() ? (snap.data() as Articulo) : null);
        setLoading(false);
      },
      (err) => {
        console.error("useArticulo error:", err);
        setLoading(false);
      },
    );
    return unsub;
  }, [negocioId, id]);

  return { articulo, loading };
}
