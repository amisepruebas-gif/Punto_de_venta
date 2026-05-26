import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "@/firebase/config";
import { paths, type Venta } from "@shared";

/**
 * Escucha en vivo todas las ventas de un día concreto en una sucursal.
 *
 * Path Firestore: `negocios_..wnv../{nid}/sucursales_data_..wnv../{sid}/ventas_n_..wnv../{y}/{m}/{d}/items/*`
 *
 * Devuelve las ventas ordenadas por `fechaISO` ascendente — la primera del
 * día arriba, igual que el RecyclerView Android. Si la sesión está
 * incompleta o aún cargando, devuelve lista vacía y `loading=true`.
 */
export function useVentasDia(
  negocioId: string | null,
  sucursalId: string | null,
  y: string,
  m: string,
  d: string,
) {
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!negocioId || !sucursalId || !y || !m || !d) {
      setVentas([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const col = collection(
      db,
      `${paths.ventaDia(negocioId, sucursalId, y, m, d)}/items`,
    );
    const q = query(col, orderBy("fechaISO", "asc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const out: Venta[] = [];
        snap.forEach((doc) => out.push(doc.data() as Venta));
        setVentas(out);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error("useVentasDia onSnapshot error:", err);
        setError(err.message);
        setLoading(false);
      },
    );
    return unsub;
  }, [negocioId, sucursalId, y, m, d]);

  const totalDia = useMemo(
    () =>
      ventas.reduce((acc, v) => acc + (Number(v.montoCobro) || 0), 0),
    [ventas],
  );

  return { ventas, totalDia, loading, error };
}
