import { useEffect, useState } from "react";
import { collection, doc, onSnapshot } from "firebase/firestore";
import { db } from "@/firebase/config";
import { useNegocio } from "@/hooks/useNegocio";
import { paths, type Resurtido } from "@shared";

export function useResurtidos() {
  const { negocioId } = useNegocio();
  const [resurtidos, setResurtidos] = useState<Resurtido[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!negocioId) {
      setLoading(false);
      return;
    }
    const ref = collection(db, paths.resurtidosCol(negocioId));
    const unsub = onSnapshot(
      ref,
      (snap) => {
        const arr: Resurtido[] = [];
        snap.forEach((d) => arr.push(d.data() as Resurtido));
        // Más reciente primero (fechaCreacion desc).
        arr.sort((a, b) => b.fechaCreacion.localeCompare(a.fechaCreacion));
        setResurtidos(arr);
        setLoading(false);
      },
      (err) => {
        console.error("useResurtidos:", err);
        setLoading(false);
      },
    );
    return unsub;
  }, [negocioId]);

  return { resurtidos, loading };
}

export function useResurtido(id: string | null) {
  const { negocioId } = useNegocio();
  const [resurtido, setResurtido] = useState<Resurtido | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!negocioId || !id) {
      setResurtido(null);
      setLoading(false);
      return;
    }
    const unsub = onSnapshot(
      doc(db, paths.resurtido(negocioId, id)),
      (snap) => {
        setResurtido(snap.exists() ? (snap.data() as Resurtido) : null);
        setLoading(false);
      },
      () => setLoading(false),
    );
    return unsub;
  }, [negocioId, id]);

  return { resurtido, loading };
}
