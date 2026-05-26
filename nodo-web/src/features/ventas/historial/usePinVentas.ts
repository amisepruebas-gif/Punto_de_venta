import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/firebase/config";
import { paths, DOC_PIN_VENTAS } from "@shared";

export const PIN_VENTAS_DEFAULT = "2121";

/**
 * Suscripción al doc `negocios.../datos.../pinVentas` que contiene el PIN
 * para abrir "Registros de venta". Si el doc no existe, devuelve el PIN
 * default ("2121"). Cualquier cambio desde admin-web se refleja en vivo.
 */
export function usePinVentas(negocioId: string | null) {
  const [pin, setPin] = useState(PIN_VENTAS_DEFAULT);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!negocioId) {
      setLoading(false);
      return;
    }
    const ref = doc(db, paths.dato(negocioId, DOC_PIN_VENTAS));
    const unsub = onSnapshot(
      ref,
      (snap) => {
        const data = snap.data() as { valor?: string } | undefined;
        if (data?.valor && typeof data.valor === "string") {
          setPin(data.valor);
        } else {
          setPin(PIN_VENTAS_DEFAULT);
        }
        setLoading(false);
      },
      (err) => {
        console.error("usePinVentas error:", err);
        setPin(PIN_VENTAS_DEFAULT);
        setLoading(false);
      },
    );
    return unsub;
  }, [negocioId]);

  return { pin, loading };
}
