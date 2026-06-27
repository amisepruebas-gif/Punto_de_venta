import { useEffect } from "react";
import { useClientePuntos } from "./clientePuntosStore";
import {
  fnRegistrarClientePuntos,
  fnAcreditarPuntos,
  fnCanjearPuntos,
  type RegistrarClientePuntosInput,
  type AcreditarPuntosInput,
  type CanjearPuntosInput,
} from "@/firebase/callable";

const MAX_INTENTOS = 60; // ~60 min de reintentos (antes 8 = solo 8 min). La cola
// persiste en localStorage (sobrevive recargas), así que esto da margen amplio.

/**
 * Reintenta las llamadas de puntos encoladas (offline-robusto): al montar, al
 * recuperar conexión y cada minuto. Éxito → quita de la cola; tras MAX_INTENTOS
 * fallidos se descarta para no acumular basura.
 */
export function usePuntosColaFlush() {
  useEffect(() => {
    let activo = true;

    async function flush() {
      const { cola } = useClientePuntos.getState();
      for (const item of cola) {
        if (!activo) return;
        try {
          if (item.tipo === "register") {
            await fnRegistrarClientePuntos(
              item.payload as unknown as RegistrarClientePuntosInput,
            );
          } else if (item.tipo === "canje") {
            await fnCanjearPuntos(item.payload as unknown as CanjearPuntosInput);
          } else {
            await fnAcreditarPuntos(item.payload as unknown as AcreditarPuntosInput);
          }
          useClientePuntos.getState().quitarDeCola(item.id);
        } catch {
          if (item.intentos + 1 >= MAX_INTENTOS) {
            // Descarte tras agotar reintentos: dejar rastro para auditoría (no
            // se pierde en silencio). Lo idóneo a futuro: bandera en admin-web.
            console.error(
              "[PUNTOS] Movimiento DESCARTADO tras",
              MAX_INTENTOS,
              "intentos:",
              item.tipo,
              item.payload,
            );
            useClientePuntos.getState().quitarDeCola(item.id);
          } else {
            useClientePuntos.getState().incrementarIntento(item.id);
          }
        }
      }
    }

    void flush();
    const onOnline = () => void flush();
    window.addEventListener("online", onOnline);
    const iv = window.setInterval(() => void flush(), 60000);
    return () => {
      activo = false;
      window.removeEventListener("online", onOnline);
      window.clearInterval(iv);
    };
  }, []);
}
