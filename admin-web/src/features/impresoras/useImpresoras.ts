import { useEffect, useState } from "react";
import { collection, doc, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/firebase/config";
import { useNegocio } from "@/hooks/useNegocio";
import { paths, type Impresora, type TrabajoImpresion } from "@shared";

export type ImpresoraConId = Impresora & { id: string };
export type TrabajoConId = TrabajoImpresion & { id: string };

/** Las impresoras de etiquetas del negocio, en vivo, por nombre. */
export function useImpresoras() {
  const { negocioId } = useNegocio();
  const [impresoras, setImpresoras] = useState<ImpresoraConId[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!negocioId) {
      setLoading(false);
      return;
    }
    return onSnapshot(
      collection(db, paths.impresorasCol(negocioId)),
      (snap) => {
        const arr: ImpresoraConId[] = [];
        snap.forEach((d) => arr.push({ ...(d.data() as Impresora), id: d.id }));
        arr.sort((a, b) => (a.nombre ?? "").localeCompare(b.nombre ?? "", "es"));
        setImpresoras(arr);
        setError(null);
        setLoading(false);
      },
      (err) => {
        console.error("useImpresoras:", err);
        setError(err.message);
        setLoading(false);
      },
    );
  }, [negocioId]);

  return { impresoras, loading, error };
}

/** Una orden de la cola, en vivo (para ver su avance). */
export function useTrabajoImpresion(trabajoId: string | null) {
  const { negocioId } = useNegocio();
  const [trabajo, setTrabajo] = useState<TrabajoConId | null>(null);
  useEffect(() => {
    setTrabajo(null);
    if (!negocioId || !trabajoId) return;
    return onSnapshot(
      doc(db, paths.impresion(negocioId, trabajoId)),
      (s) => setTrabajo(s.exists() ? { ...(s.data() as TrabajoImpresion), id: s.id } : null),
      (err) => console.error("useTrabajoImpresion:", err),
    );
  }, [negocioId, trabajoId]);
  return trabajo;
}

/** Órdenes que esperan, se están imprimiendo o fallaron (las que pueden
 *  necesitar que admin haga algo). Sin índice: un solo filtro `in`. */
export function useTrabajosAbiertos() {
  const { negocioId } = useNegocio();
  const [trabajos, setTrabajos] = useState<TrabajoConId[]>([]);
  useEffect(() => {
    if (!negocioId) return;
    return onSnapshot(
      query(collection(db, paths.impresionesCol(negocioId)), where("estado", "in", ["pendiente", "imprimiendo", "error"])),
      (snap) => {
        const arr: TrabajoConId[] = [];
        snap.forEach((d) => arr.push({ ...(d.data() as TrabajoImpresion), id: d.id }));
        const ms = (t: TrabajoConId) => {
          const c = t.creadoEn as { toMillis?: () => number } | undefined;
          return typeof c?.toMillis === "function" ? c.toMillis() : Date.now();
        };
        arr.sort((a, b) => ms(b) - ms(a));
        setTrabajos(arr);
      },
      (err) => console.error("useTrabajosAbiertos:", err),
    );
  }, [negocioId]);
  return trabajos;
}
