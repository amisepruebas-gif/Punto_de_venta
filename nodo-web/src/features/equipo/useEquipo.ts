import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/firebase/config";
import { trackSnapshot } from "@/lib/firestoreStats";
import { useNodoSession } from "@/hooks/useNodoSession";
import {
  COL_NEGOCIOS,
  COL_DATOS,
  DOC_EQUIPO,
  type EquipoDeTrabajoItem,
} from "@shared";

type State = {
  equipo: EquipoDeTrabajoItem[];
  loading: boolean;
};

export function useEquipo(): State {
  const { negocioId } = useNodoSession();
  const [state, setState] = useState<State>({ equipo: [], loading: true });

  useEffect(() => {
    if (!negocioId) return;
    const ref = doc(
      db,
      `${COL_NEGOCIOS}/${negocioId}/${COL_DATOS}/${DOC_EQUIPO}`,
    );
    const unsub = onSnapshot(
      ref,
      { includeMetadataChanges: true },
      (snap) => {
        trackSnapshot(
          snap,
          `${COL_NEGOCIOS}/${negocioId}/${COL_DATOS}/${DOC_EQUIPO}`,
        );
        if (!snap.exists()) {
          setState({ equipo: [], loading: false });
          return;
        }
        const data = snap.data() as Record<string, EquipoDeTrabajoItem>;
        const equipo = Object.values(data).filter(
          (e) => e && typeof e === "object" && "nombre" in e,
        );
        setState({ equipo, loading: false });
      },
      (err) => {
        console.error("useEquipo error:", err);
        setState((s) => ({ ...s, loading: false }));
      },
    );
    return unsub;
  }, [negocioId]);

  return state;
}
