import { useEffect } from "react";
import { useClientePuntos } from "./clientePuntosStore";
import {
  fnRegistrarClientePuntos,
  fnAcreditarPuntos,
  fnCanjearPuntos,
  fnActivarTarjeta,
  fnReponerTarjeta,
  fnCerrarCanje,
  fnEmitirTarjetaRegalo,
  fnRecargarTarjetaRegalo,
  fnCerrarCreditoRegalo,
  type RegistrarClientePuntosInput,
  type AcreditarPuntosInput,
  type CanjearPuntosInput,
  type CerrarCanjeInput,
  type EmitirTarjetaRegaloInput,
  type RecargarTarjetaRegaloInput,
  type CerrarCreditoRegaloInput,
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
          } else if (item.tipo === "card") {
            // Reintento de vinculación de tarjeta (idempotente por código+monedero;
            // NO re-cobra: la venta ya existe, el vínculo es una operación aparte).
            const p = item.payload as unknown as {
              modo: "activar" | "reponer";
              phone: string;
              codigo: string;
              codigoAnterior?: string;
              ventaId: string;
            };
            if (p.modo === "reponer") {
              await fnReponerTarjeta({
                phone: p.phone,
                codigoAnterior: p.codigoAnterior,
                codigoNuevo: p.codigo,
                ventaId: p.ventaId,
              });
            } else {
              await fnActivarTarjeta({
                phone: p.phone,
                codigo: p.codigo,
                ventaId: p.ventaId,
              });
            }
          } else if (item.tipo === "cerrar") {
            // Fase 5: cierra el canje pendiente en el servidor (idempotente).
            await fnCerrarCanje(item.payload as unknown as CerrarCanjeInput);
          } else if (item.tipo === "gift") {
            // Feature 5 · Fase 2: emisión de tarjeta de regalo (idempotente por
            // ventaId; NO re-cobra — la venta ya existe). El accessCode en claro
            // se pierde en un reintento (null): el cliente lo recupera aparte.
            await fnEmitirTarjetaRegalo(
              item.payload as unknown as EmitirTarjetaRegaloInput,
            );
          } else if (item.tipo === "giftRecarga") {
            // Feature 5 · Fase 2: recarga de tarjeta de regalo (idempotente por
            // ventaId; NO re-cobra — la venta ya existe).
            await fnRecargarTarjetaRegalo(
              item.payload as unknown as RecargarTarjetaRegaloInput,
            );
          } else if (item.tipo === "cerrarRegalo") {
            // Feature 5 · Fase 3: cierra el candado del crédito de regalo
            // (idempotente). NO es valor pagado → descartable tras MAX_INTENTOS
            // (el candado auto-expira por TTL de todos modos).
            await fnCerrarCreditoRegalo(
              item.payload as unknown as CerrarCreditoRegaloInput,
            );
          } else {
            await fnAcreditarPuntos(item.payload as unknown as AcreditarPuntosInput);
          }
          useClientePuntos.getState().quitarDeCola(item.id);
        } catch {
          // La emisión/recarga de gift representa VALOR que el cliente YA pagó:
          // NUNCA se descarta en silencio (a diferencia de 'card', donde solo se
          // pierde la conveniencia del plástico). Se reintenta indefinidamente —
          // es idempotente por ventaId, así que reintentar no duplica crédito.
          if (item.tipo === "gift" || item.tipo === "giftRecarga") {
            if (item.intentos + 1 === MAX_INTENTOS) {
              console.error(
                "[PUNTOS] Op de gift (",
                item.tipo,
                ") lleva",
                MAX_INTENTOS,
                "intentos sin éxito (se SIGUE reintentando; revisar conexión):",
                item.payload,
              );
            }
            useClientePuntos.getState().incrementarIntento(item.id);
          } else if (item.intentos + 1 >= MAX_INTENTOS) {
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
