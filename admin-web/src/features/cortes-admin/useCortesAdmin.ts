import { useEffect, useState } from "react";
import {
  collection,
  collectionGroup,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/firebase/config";
import { useNegocio } from "@/hooks/useNegocio";
import { paths, ymdMX, type Corte } from "@shared";

type State = {
  cortes: Corte[];
  loading: boolean;
};

/**
 * Lee cortes del día seleccionado para una sucursal. Para MVP admin, enfoque
 * por día + sucursal (el historial largo requeriría collectionGroup con
 * índice adicional; se añade cuando haga falta).
 */
export function useCortesDia(
  sucursalId: string | null,
  date: Date,
): State {
  const { negocioId } = useNegocio();
  const [state, setState] = useState<State>({ cortes: [], loading: true });

  const { y, m, d } = ymdMX(date);

  useEffect(() => {
    if (!negocioId || !sucursalId) {
      setState({ cortes: [], loading: false });
      return;
    }
    let cancelled = false;
    setState((s) => ({ ...s, loading: true }));

    (async () => {
      try {
        const ref = collection(
          db,
          `${paths.corteDia(negocioId, sucursalId, y, m, d)}/items`,
        );
        const snap = await getDocs(ref);
        const arr: Corte[] = [];
        snap.forEach((doc) => arr.push(doc.data() as Corte));
        arr.sort((a, b) =>
          (b.fecha_inicio ?? "").localeCompare(a.fecha_inicio ?? ""),
        );
        if (!cancelled) setState({ cortes: arr, loading: false });
      } catch (err) {
        console.error("useCortesDia error:", err);
        if (!cancelled) setState({ cortes: [], loading: false });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [negocioId, sucursalId, y, m, d]);

  return state;
}

/** Cortes "en curso" en vivo para el dashboard. */
export function useCortesActivos(): { cortes: Corte[]; loading: boolean } {
  const { negocioId } = useNegocio();
  const [cortes, setCortes] = useState<Corte[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!negocioId) return;
    // Uso un getDocs una vez — los cortes activos no cambian segundo-a-segundo
    // y el admin refresca viendo la página.
    let cancelled = false;
    (async () => {
      try {
        // Requiere que los cortes también tengan negocioId — lo agregamos en
        // Fase 5. Para cortes creados antes del cambio, no aparecerán aquí.
        const q = query(
          collectionGroup(db, "items"),
          where("estado", "==", "corte_enCurso"),
          where("negocioId", "==", negocioId),
        );
        const snap = await getDocs(q);
        const arr: Corte[] = [];
        snap.forEach((d) => {
          const v = d.data() as Corte;
          // Filtrar: sólo docs de cortes (no ventas). Corte tiene `estado` y no
          // tiene `articulos`.
          if (v.estado && !("articulos" in v)) arr.push(v);
        });
        if (!cancelled) {
          setCortes(arr);
          setLoading(false);
        }
      } catch (err) {
        console.error("useCortesActivos error:", err);
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [negocioId]);

  return { cortes, loading };
}
