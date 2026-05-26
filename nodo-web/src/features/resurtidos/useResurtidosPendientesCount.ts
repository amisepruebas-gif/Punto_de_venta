import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/firebase/config";
import { useNodoSession } from "@/hooks/useNodoSession";
import { paths } from "@shared";

/**
 * Cuenta resurtidos cuyo destino es esta sucursal y cuyo estado NO es
 * `cerrado`. Sirve para el badge del botón "Resurtidos" en el header de
 * Ventas, así el operador ve sin entrar al detalle si tiene cajas que
 * recibir.
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
          const estado = d.data().estado;
          if (estado !== "cerrado") n += 1;
        });
        setCount(n);
      },
      () => setCount(0),
    );
    return unsub;
  }, [negocioId, sucursalId]);

  return count;
}
