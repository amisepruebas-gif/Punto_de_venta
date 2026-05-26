import { useEffect, useState } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "@/firebase/config";
import { useNegocio } from "@/hooks/useNegocio";
import { paths, DOC_PIN_VENTAS } from "@shared";

const DEFAULT = "2121";

/**
 * Lee y permite actualizar el PIN que protege el sheet "Registros de venta"
 * en nodo-web. El doc vive en `negocios.../datos.../pinVentas` y guarda
 * `{ valor: "2121" }`. Si no existe, devolvemos el default.
 */
export function usePinVentas() {
  const { negocioId } = useNegocio();
  const [pin, setPin] = useState(DEFAULT);
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
        setPin(typeof data?.valor === "string" && data.valor ? data.valor : DEFAULT);
        setLoading(false);
      },
      (err) => {
        console.error("usePinVentas error:", err);
        setLoading(false);
      },
    );
    return unsub;
  }, [negocioId]);

  async function actualizar(nuevo: string) {
    if (!negocioId) throw new Error("Sin negocioId");
    if (!/^\d+$/.test(nuevo)) {
      throw new Error("El PIN debe contener solo dígitos.");
    }
    if (nuevo.length < 4 || nuevo.length > 8) {
      throw new Error("El PIN debe tener entre 4 y 8 dígitos.");
    }
    const ref = doc(db, paths.dato(negocioId, DOC_PIN_VENTAS));
    await setDoc(ref, { valor: nuevo }, { merge: true });
  }

  return { pin, loading, actualizar };
}
