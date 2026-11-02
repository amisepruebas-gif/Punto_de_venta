import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { paths } from "@shared";
import { db } from "@/firebase/config";
import { useNodoSession } from "@/hooks/useNodoSession";

/**
 * Terminal Clip de esta caja (la asigna admin en Nodos) y si hay internet.
 * Sin serie o sin conexión, la caja cobra con tarjeta a mano, como antes.
 * El doc de la caja sale de la caché si no hay red.
 */
export function useTerminalClip(): { serial: string | null; enLinea: boolean } {
  const { negocioId, nodoId } = useNodoSession();
  const [serial, setSerial] = useState<string | null>(null);
  const [enLinea, setEnLinea] = useState(() => navigator.onLine);

  useEffect(() => {
    if (!negocioId || !nodoId) {
      setSerial(null);
      return;
    }
    return onSnapshot(
      doc(db, paths.nodo(negocioId, nodoId)),
      (snap) => {
        const s = snap.get("clipSerial");
        setSerial(typeof s === "string" && s ? s : null);
      },
      // Sin permiso (reglas aún sin desplegar) o sin red: cobro a mano.
      () => setSerial(null),
    );
  }, [negocioId, nodoId]);

  useEffect(() => {
    const on = () => setEnLinea(true);
    const off = () => setEnLinea(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  return { serial, enLinea };
}
