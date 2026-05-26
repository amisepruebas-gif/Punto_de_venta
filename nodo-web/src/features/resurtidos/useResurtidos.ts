import { useEffect, useState } from "react";
import { collection, doc, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/firebase/config";
import { useNodoSession } from "@/hooks/useNodoSession";
import { paths, type Resurtido } from "@shared";

/**
 * Suscribe a los resurtidos cuyo destino es la sucursal activa del nodo.
 * Filtra client-side por estado para minimizar logic en el server (las
 * reglas siguen abiertas, así que la query con where no requiere index
 * compuesto si filtramos sólo por sucursalDestinoId).
 */
export function useResurtidosSucursal() {
  const { negocioId, sucursalId } = useNodoSession();
  const [resurtidos, setResurtidos] = useState<Resurtido[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!negocioId || !sucursalId) {
      setLoading(false);
      return;
    }
    const q = query(
      collection(db, paths.resurtidosCol(negocioId)),
      where("sucursalDestinoId", "==", sucursalId),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const arr: Resurtido[] = [];
        snap.forEach((d) => arr.push(d.data() as Resurtido));
        // Más reciente primero.
        arr.sort((a, b) => b.fechaCreacion.localeCompare(a.fechaCreacion));
        setResurtidos(arr);
        setLoading(false);
      },
      (err) => {
        console.error("useResurtidosSucursal:", err);
        setLoading(false);
      },
    );
    return unsub;
  }, [negocioId, sucursalId]);

  return { resurtidos, loading };
}

export function useResurtido(id: string | null) {
  const { negocioId } = useNodoSession();
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
