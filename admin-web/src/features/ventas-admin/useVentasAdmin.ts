import { useEffect, useState } from "react";
import {
  collectionGroup,
  onSnapshot,
  query,
  where,
  orderBy,
  limit as fsLimit,
} from "firebase/firestore";
import { db } from "@/firebase/config";
import { trackSnapshot } from "@/lib/firestoreStats";
import { useNegocio } from "@/hooks/useNegocio";
import type { Venta } from "@shared";

export type VentasFilters = {
  desde?: Date | null;
  hasta?: Date | null;
  sucursalId?: string | null;
  vendedor?: string | null;
  limite?: number;
};

type State = {
  ventas: Venta[];
  loading: boolean;
  /** `true` cuando los datos provienen del cache local (sin confirmación
   *  del servidor todavía). Útil para mostrar un indicador de "sincronizando…"
   *  en el header. */
  fromCache: boolean;
};

/**
 * Historial de ventas del negocio en TIEMPO REAL. Listener vía
 * `collectionGroup("items")` filtrado por negocioId + filtros opcionales.
 *
 * **Sync incremental**: el cliente Firestore tiene `persistentLocalCache`
 * activado (ver `firebase/config.ts`). El SDK:
 *   - Sirve los datos del cache local primero (`fromCache=true`).
 *   - Conecta al servidor y solo descarga **deltas** (docs nuevos o
 *     modificados) — no re-baja todo el query.
 *   - Una recarga de página entrega del cache al instante y sincroniza
 *     diferencias en background.
 *
 * Equivalente web del patrón legacy `dispositivo_1.apk` que escuchaba el
 * doc `ventas_ac` y descargaba selectivamente días faltantes; el SDK lo
 * hace bajo el capó con menos código.
 *
 * Los índices necesarios están en `firestore.indexes.json`.
 */
export function useVentasAdmin(filters: VentasFilters): State {
  const { negocioId } = useNegocio();
  const [state, setState] = useState<State>({
    ventas: [],
    loading: true,
    fromCache: true,
  });

  // Pin filters as primitives for dep comparison
  const desdeISO = filters.desde?.toISOString() ?? "";
  const hastaISO = filters.hasta?.toISOString() ?? "";
  const sid = filters.sucursalId ?? "";
  const vend = filters.vendedor ?? "";
  const lim = filters.limite ?? 500;

  useEffect(() => {
    if (!negocioId) return;
    setState((s) => ({ ...s, loading: true }));

    const constraints = [where("negocioId", "==", negocioId)];
    if (sid) constraints.push(where("sucursalId", "==", sid));
    if (vend) constraints.push(where("enTurno", "==", vend));
    if (desdeISO) constraints.push(where("fechaISO", ">=", desdeISO));
    if (hastaISO) constraints.push(where("fechaISO", "<=", hastaISO));

    const q = query(
      collectionGroup(db, "items"),
      ...constraints,
      orderBy("fechaISO", "desc"),
      fsLimit(lim),
    );

    const unsub = onSnapshot(
      q,
      { includeMetadataChanges: true },
      (snap) => {
        trackSnapshot(snap);
        const arr: Venta[] = [];
        snap.forEach((d) => {
          const v = d.data() as Venta;
          if (Array.isArray(v.articulos)) arr.push(v);
        });
        setState({
          ventas: arr,
          loading: false,
          fromCache: snap.metadata.fromCache,
        });
      },
      (err) => {
        console.error("useVentasAdmin error:", err);
        setState({ ventas: [], loading: false, fromCache: false });
      },
    );
    return unsub;
  }, [negocioId, desdeISO, hastaISO, sid, vend, lim]);

  return state;
}

/** Realtime a ventas de HOY para Dashboard KPIs. */
export function useVentasHoyRT() {
  const { negocioId } = useNegocio();
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!negocioId) return;
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const q = query(
      collectionGroup(db, "items"),
      where("negocioId", "==", negocioId),
      where("fechaISO", ">=", hoy.toISOString()),
    );
    const unsub = onSnapshot(
      q,
      { includeMetadataChanges: true },
      (snap) => {
        trackSnapshot(snap);
        const arr: Venta[] = [];
        snap.forEach((d) => {
          const v = d.data() as Venta;
          if (Array.isArray(v.articulos)) arr.push(v);
        });
        setVentas(arr);
        setLoading(false);
      },
      (err) => {
        console.error("useVentasHoyRT error:", err);
        setLoading(false);
      },
    );
    return unsub;
  }, [negocioId]);

  return { ventas, loading };
}
