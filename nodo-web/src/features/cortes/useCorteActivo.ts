import { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/firebase/config";
import { trackSnapshot } from "@/lib/firestoreStats";
import { useNodoSession } from "@/hooks/useNodoSession";
import { paths, ymdMX, type Corte } from "@shared";

type State = {
  corte: Corte | null;
  ymd: { y: string; m: string; d: string } | null;
  loading: boolean;
};

/** Escucha en tiempo real si el nodo tiene un corte_enCurso hoy. */
export function useCorteActivo(): State {
  const { negocioId, sucursalId, nodoId } = useNodoSession();
  const [state, setState] = useState<State>({
    corte: null,
    ymd: null,
    loading: true,
  });

  useEffect(() => {
    if (!negocioId || !sucursalId || !nodoId) return;
    const { y, m, d } = ymdMX();
    const itemsRef = collection(
      db,
      `${paths.corteDia(negocioId, sucursalId, y, m, d)}/items`,
    );
    const q = query(
      itemsRef,
      where("nodoId", "==", nodoId),
      where("estado", "==", "corte_enCurso"),
    );
    const unsub = onSnapshot(
      q,
      { includeMetadataChanges: true },
      (snap) => {
        trackSnapshot(
          snap,
          `${paths.corteDia(negocioId, sucursalId, y, m, d)}/items`,
        );
        if (snap.empty) {
          setState({ corte: null, ymd: { y, m, d }, loading: false });
          return;
        }
        setState({
          corte: snap.docs[0].data() as Corte,
          ymd: { y, m, d },
          loading: false,
        });
      },
      (err) => {
        console.error("useCorteActivo error:", err);
        setState((s) => ({ ...s, loading: false }));
      },
    );
    return unsub;
  }, [negocioId, sucursalId, nodoId]);

  return state;
}
