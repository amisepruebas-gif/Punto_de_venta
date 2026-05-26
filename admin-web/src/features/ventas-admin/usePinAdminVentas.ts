/**
 * Lee el PIN que protege el acceso a `/ventas` en admin-web.
 *
 * Path Firestore: `negocios_web_new_version/{negocioId}/datos_web_new_version/pinAdminVentas`
 * Forma esperada: `{ valor: "7849" }`
 *
 * Si el doc no existe o no tiene `valor`, usa el fallback hardcodeado.
 *
 * **Sin UI para cambiarlo**: por decisión, este PIN solo se modifica
 * directamente en Firebase Console editando el doc.
 */

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/firebase/config";
import { useNegocio } from "@/hooks/useNegocio";
import { paths } from "@shared";

const DOC_KEY = "pinAdminVentas";
const DEFAULT_PIN = "7849";

export function usePinAdminVentas() {
  const { negocioId } = useNegocio();
  const [pin, setPin] = useState(DEFAULT_PIN);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!negocioId) {
      setLoading(false);
      return;
    }
    const ref = doc(db, paths.dato(negocioId, DOC_KEY));
    const unsub = onSnapshot(
      ref,
      (snap) => {
        const data = snap.data() as { valor?: string } | undefined;
        setPin(
          typeof data?.valor === "string" && data.valor
            ? data.valor
            : DEFAULT_PIN,
        );
        setLoading(false);
      },
      (err) => {
        console.error("usePinAdminVentas error:", err);
        setLoading(false);
      },
    );
    return unsub;
  }, [negocioId]);

  return { pin, loading };
}
