import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/firebase/config";
import { useNegocio } from "@/hooks/useNegocio";
import { esLote, paths, type Resurtido } from "@shared";

/**
 * Cuántos lotes terminaron de armarse y esperan a que admin confirme el
 * envío (para el contador del menú). Solo escucha esos documentos, no toda
 * la colección de resurtidos.
 */
export function useLotesListos(): number {
  const { negocioId } = useNegocio();
  const [cuantos, setCuantos] = useState(0);

  useEffect(() => {
    if (!negocioId) {
      setCuantos(0);
      return;
    }
    const q = query(
      collection(db, paths.resurtidosCol(negocioId)),
      where("estado", "==", "creando"),
      where("listo", "==", true),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        let n = 0;
        snap.forEach((d) => {
          if (esLote(d.data() as Resurtido)) n++;
        });
        setCuantos(n);
      },
      (err) => console.error("useLotesListos:", err),
    );
    return unsub;
  }, [negocioId]);

  return cuantos;
}
