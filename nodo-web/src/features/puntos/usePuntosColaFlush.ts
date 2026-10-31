import { useEffect } from "react";
import { arrayUnion, doc, updateDoc } from "firebase/firestore";
import { db } from "@/firebase/config";
import {
  clasificarErrorPuntos,
  codigoErrorPuntos,
  descartarTrasFallo,
  esperaRegistroPuntos,
  esperaReintentoMs,
  type ClaseErrorPuntos,
} from "@shared";
import { useClientePuntos, type LlamadaPuntos } from "./clientePuntosStore";
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

/** Aviso cuando el registro de un cliente ya existía en amise. */
const MSG_YA_EXISTIA =
  "El cliente ya existía: la contraseña impresa no sirve. Usa Recuperar contraseña.";

/**
 * Hace la llamada de un ítem de la cola. Todas son idempotentes (acumular,
 * tarjeta y regalo por ventaId o tarjeta+monedero; registro por correo), así
 * que repetirla no duplica nada.
 */
export async function ejecutarLlamadaPuntos(
  tipo: LlamadaPuntos["tipo"],
  payload: Record<string, unknown>,
): Promise<{ data: unknown }> {
  if (tipo === "register") {
    return fnRegistrarClientePuntos(payload as unknown as RegistrarClientePuntosInput);
  }
  if (tipo === "canje") {
    return fnCanjearPuntos(payload as unknown as CanjearPuntosInput);
  }
  if (tipo === "card") {
    // Vincular la tarjeta ya cobrada (NO re-cobra: la venta ya existe).
    const p = payload as {
      modo: "activar" | "reponer";
      phone: string;
      email?: string;
      codigo: string;
      codigoAnterior?: string;
      ventaId: string;
    };
    const correo = p.email ? { email: p.email } : {};
    if (p.modo === "reponer") {
      return fnReponerTarjeta({
        phone: p.phone,
        ...correo,
        codigoAnterior: p.codigoAnterior,
        codigoNuevo: p.codigo,
        ventaId: p.ventaId,
      });
    }
    return fnActivarTarjeta({ phone: p.phone, ...correo, codigo: p.codigo, ventaId: p.ventaId });
  }
  if (tipo === "cerrar") {
    return fnCerrarCanje(payload as unknown as CerrarCanjeInput);
  }
  if (tipo === "gift") {
    // El accessCode en claro se pierde en un reintento (null): el cliente lo
    // recupera aparte.
    return fnEmitirTarjetaRegalo(payload as unknown as EmitirTarjetaRegaloInput);
  }
  if (tipo === "giftRecarga") {
    return fnRecargarTarjetaRegalo(payload as unknown as RecargarTarjetaRegaloInput);
  }
  if (tipo === "cerrarRegalo") {
    return fnCerrarCreditoRegalo(payload as unknown as CerrarCreditoRegaloInput);
  }
  return fnAcreditarPuntos(payload as unknown as AcreditarPuntosInput);
}

/** Mensaje corto para el cajero. Una red caída llega como `internal` a secas. */
export function mensajeErrorPuntos(err: unknown): string {
  const code = codigoErrorPuntos(err);
  const msg = (err as { message?: unknown } | null)?.message;
  const tieneDetalle = (err as { details?: unknown } | null)?.details != null;
  if (code === "unavailable" || code === "deadline-exceeded" ||
    (code === "internal" && !tieneDetalle)) {
    return "Sin conexión";
  }
  return typeof msg === "string" && msg ? msg : "Error desconocido";
}

/**
 * Registra un fallo de un ítem según su clase: reintentar (espera creciente),
 * definitivo u "hecho" (a fallidos, con rastro en la venta) o descartar (solo
 * candados tras muchos intentos). Devuelve la clase.
 */
export function procesarFalloPuntos(item: LlamadaPuntos, err: unknown): ClaseErrorPuntos {
  const st = useClientePuntos.getState();
  const clase = clasificarErrorPuntos(item.tipo, err);
  const mensaje = mensajeErrorPuntos(err);
  if (clase !== "reintentar") {
    const motivo = clase === "hecho" ? MSG_YA_EXISTIA : mensaje;
    st.moverAFallidos(item.id, motivo);
    if (item.ventaPath) {
      // Rastro en la venta para admin (best-effort; sin red se sube después).
      void updateDoc(doc(db, item.ventaPath), {
        lealtadErrores: arrayUnion({
          tipo: item.tipo,
          error: motivo,
          fecha: new Date().toISOString(),
        }),
      }).catch(() => {});
    }
    return clase;
  }
  const intentos = item.intentos + 1;
  if (descartarTrasFallo(item.tipo, intentos)) {
    // Candado (cerrar canje/regalo): el servidor lo vence solo.
    console.error("[PUNTOS] Candado descartado tras", intentos, "intentos:", item.tipo, item.payload);
    st.quitarDeCola(item.id);
    return clase;
  }
  st.anotarFallo(item.id, mensaje, Date.now() + esperaReintentoMs(intentos));
  return clase;
}

export type ResultadoEnvioPuntos =
  | { ok: true; data: unknown }
  | { ok: false; clase: ClaseErrorPuntos; mensaje: string };

/**
 * Envía YA un ítem recién anotado (la venta espera la respuesta para el
 * ticket). Si falla, se queda en la cola o pasa a fallidos; nunca se pierde.
 * Si espera a un registro del mismo teléfono, lo deja para la cola.
 */
export async function enviarPuntosAhora(id: string): Promise<ResultadoEnvioPuntos> {
  const st = useClientePuntos.getState();
  const item = st.cola.find((x) => x.id === id);
  if (!item) return { ok: false, clase: "reintentar", mensaje: "No está en la cola" };
  if (esperaRegistroPuntos(item, st.cola)) {
    st.anotarFallo(id, "Espera el registro del cliente", Date.now());
    return { ok: false, clase: "reintentar", mensaje: "Espera el registro del cliente" };
  }
  try {
    const res = await ejecutarLlamadaPuntos(item.tipo, item.payload);
    useClientePuntos.getState().quitarDeCola(id);
    return { ok: true, data: res.data };
  } catch (e) {
    const clase = procesarFalloPuntos(item, e);
    return { ok: false, clase, mensaje: mensajeErrorPuntos(e) };
  }
}

async function enviarCola() {
  for (const { id } of useClientePuntos.getState().cola) {
    // Releer: la venta pudo enviarlo o agregar ítems mientras tanto.
    const cola = useClientePuntos.getState().cola;
    const item = cola.find((x) => x.id === id);
    if (!item) continue;
    const ahora = Date.now();
    if (item.enCursoHasta && item.enCursoHasta > ahora) continue;
    if (item.proximoIntento && item.proximoIntento > ahora) continue;
    if (esperaRegistroPuntos(item, cola)) continue;
    try {
      await ejecutarLlamadaPuntos(item.tipo, item.payload);
      useClientePuntos.getState().quitarDeCola(item.id);
    } catch (e) {
      procesarFalloPuntos(item, e);
    }
  }
}

let envioEnCurso: Promise<void> | null = null;

/** Envía la cola en orden de llegada. Un solo envío a la vez. */
export function flushPuntos(): Promise<void> {
  if (!envioEnCurso) {
    envioEnCurso = enviarCola().finally(() => {
      envioEnCurso = null;
    });
  }
  return envioEnCurso;
}

/** "Reintentar ahora": quita las esperas y envía. */
export function reintentarAhoraPuntos(): Promise<void> {
  useClientePuntos.getState().adelantarCola();
  return flushPuntos();
}

/**
 * Envía la cola al montar, al recuperar conexión y cada minuto. Lo que vale
 * dinero nunca se descarta solo (antes se borraba tras ~1 h sin red).
 */
export function usePuntosColaFlush() {
  useEffect(() => {
    void flushPuntos();
    const onOnline = () => void flushPuntos();
    window.addEventListener("online", onOnline);
    const iv = window.setInterval(() => void flushPuntos(), 60000);
    return () => {
      window.removeEventListener("online", onOnline);
      window.clearInterval(iv);
    };
  }, []);
}
