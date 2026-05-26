import { useEffect, useState } from "react";
import {
  collectionGroup,
  getDocs,
  query,
  where,
  orderBy,
} from "firebase/firestore";
import { db } from "@/firebase/config";
import type { Venta } from "@shared";

export type ResumenDia = {
  /** Día del mes ("1".."31"). */
  d: string;
  /** Suma de `montoCobro` del día. */
  total: number;
  /** Cantidad de ventas registradas ese día. */
  count: number;
};

/**
 * Carga las ventas de un mes completo (`y` + `m`) y las agrupa por día.
 * Usa `collectionGroup("items")` con filtro por `negocioId + sucursalId +
 * fechaISO` (índice ya existente en `firestore.indexes.json`).
 *
 * No usa onSnapshot — el calendario se abre on-demand y refrescar siempre
 * vuelve a hacer el getDocs. Ventajas: ahorra cuotas y no mantiene
 * listeners abiertos para meses pasados.
 */
export function useVentasMes(
  negocioId: string | null,
  sucursalId: string | null,
  y: string,
  m: string,
) {
  const [resumen, setResumen] = useState<Map<string, ResumenDia>>(new Map());
  const [totalMes, setTotalMes] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!negocioId || !sucursalId) {
      setResumen(new Map());
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const mm = String(parseInt(m, 10)).padStart(2, "0");
        const yyyy = y;
        const inicio = `${yyyy}-${mm}-01T00:00:00.000Z`;
        // Mes siguiente — sumamos 1 al mes y arroglamos el rollover de año.
        const mNext = parseInt(m, 10) === 12 ? 1 : parseInt(m, 10) + 1;
        const yNext = parseInt(m, 10) === 12 ? parseInt(y, 10) + 1 : parseInt(y, 10);
        const fin = `${yNext}-${String(mNext).padStart(2, "0")}-01T00:00:00.000Z`;

        const q = query(
          collectionGroup(db, "items"),
          where("negocioId", "==", negocioId),
          where("sucursalId", "==", sucursalId),
          where("fechaISO", ">=", inicio),
          where("fechaISO", "<", fin),
          orderBy("fechaISO", "asc"),
        );
        const snap = await getDocs(q);
        const map = new Map<string, ResumenDia>();
        let total = 0;
        snap.forEach((doc) => {
          const v = doc.data() as Venta;
          const partes = v.id_registro?.split(" ") ?? [];
          const d = partes[2];
          if (!d) return;
          const monto = Number(v.montoCobro) || 0;
          total += monto;
          const prev = map.get(d);
          if (prev) {
            prev.total += monto;
            prev.count += 1;
          } else {
            map.set(d, { d, total: monto, count: 1 });
          }
        });
        if (cancelled) return;
        setResumen(map);
        setTotalMes(total);
      } catch (err) {
        if (cancelled) return;
        console.error("useVentasMes error:", err);
        setError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [negocioId, sucursalId, y, m, refreshKey]);

  function refresh() {
    setRefreshKey((k) => k + 1);
  }

  return { resumen, totalMes, loading, error, refresh };
}
