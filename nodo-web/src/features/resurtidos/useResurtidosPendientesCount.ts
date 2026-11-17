import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/firebase/config";
import { useNodoSession } from "@/hooks/useNodoSession";
import { esLote, loteAbierto, paths, type Resurtido } from "@shared";

/**
 * Cuenta resurtidos cuyo destino es esta sucursal y cuyo estado NO es
 * `cerrado` (los lotes de envío, solo si están `enviado` o `parcial`).
 * Sirve para el badge del botón "Resurtidos" en el header de Ventas, así el
 * operador ve sin entrar al detalle si tiene cajas que recibir.
 */
export function useResurtidosPendientesCount(): number {
  const { negocioId, sucursalId } = useNodoSession();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!negocioId || !sucursalId) {
      setCount(0);
      return;
    }
    const q = query(
      collection(db, paths.resurtidosCol(negocioId)),
      where("sucursalDestinoId", "==", sucursalId),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        let n = 0;
        snap.forEach((d) => {
          const r = d.data() as Resurtido;
          // Un lote solo pide atención ya enviado y con algo por llegar
          // (mientras se arma no le toca a la caja).
          if (esLote(r) ? loteAbierto(r) : r.estado !== "cerrado") n += 1;
        });
        setCount(n);
      },
      () => setCount(0),
    );
    return unsub;
  }, [negocioId, sucursalId]);

  return count;
}
