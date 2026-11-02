import { useRef, useState } from "react";
import { FirebaseError } from "firebase/app";
import {
  etiquetaTarjetaClip,
  pagoClipDeCobro,
  pagoClipManual,
  puedeCrearVentaConClip,
  type CobroClip,
  type PagoClip,
} from "@shared";
import { fnCancelarCobroClip, fnCobrarConClip } from "@/firebase/callable";
import { esperarCobroClip } from "./esperarCobroClip";

/** Sin conexión con el servidor: `sinRed` habilita "Salir y revisar después". */
type Abierto = { aviso?: string; ocupado?: boolean; sinRed?: boolean };

/** Lo que muestra la pantalla del cobro en la terminal. */
export type VistaCobroClip =
  | { paso: "enviando"; monto: number }
  | ({ paso: "esperando"; monto: number; cobro: CobroClip } & Abierto)
  | ({ paso: "incierto"; monto: number; cobro: CobroClip } & Abierto)
  | { paso: "sin-pago"; monto: number; cobro: CobroClip }
  | { paso: "revisar"; monto: number; mensaje: string }
  | ({ paso: "error"; monto: number; mensaje: string } & Abierto)
  | { paso: "aprobado"; monto: number; tarjeta: string }
  | {
      paso: "descuento";
      monto: number;
      tarjeta: string;
      quitar: "cashback" | "regalo";
      descuento: number;
      mensaje: string;
      /** Error de red: no se sabe si el descuento se aplicó. */
      incierto?: boolean;
    }
  | { paso: "guardando"; monto: number; tarjeta: string };

/**
 * El cajero salió sin poder confirmar con el servidor en qué quedó el cobro
 * (sin conexión). El cobro sigue guardado en la tablet: al volver la red, la
 * caja lo revisa (RecuperarCobroClip) y nada se pierde.
 */
export class CobroSinResolver extends Error {}

type EnCurso = {
  cobroId: string;
  monto: number;
  montoPago: string;
  resolve: (p: PagoClip) => void;
  reject: (e: Error) => void;
  ac: AbortController | null;
  /** Último intento que mandó el servidor: lo de intentos previos se ignora. */
  intento: number;
  aviso?: string;
};

const codigoDe = (e: unknown) =>
  e instanceof FirebaseError ? e.code.replace(/^functions\//, "") : "";

function textoErrorEnvio(e: unknown): string {
  const code = codigoDe(e);
  const msg = e instanceof Error ? e.message : "";
  if (code === "failed-precondition" || code === "invalid-argument") return msg;
  if (code === "permission-denied") return `Esta caja no puede cobrar con la terminal: ${msg}`;
  return "No se pudo mandar el cobro (sin conexión). Reintenta: si la terminal ya lo tiene, no se cobra dos veces.";
}

function textoRevisar(c: CobroClip): string {
  const pagado = `$${(c.pagadoCentavos / 100).toFixed(2)}`;
  if (c.alerta === "pago-de-menos") {
    return `La terminal cobró ${pagado}, menos de lo que se pidió. Revisa el cobro en Clip; la venta no se guardó.`;
  }
  return "El cobro no cuadra con lo que se pidió. Revísalo en Clip; la venta no se guardó.";
}

/**
 * Cobro con la terminal Clip, paso a paso. `cobrar` manda el cobro y regresa
 * una promesa que se cumple solo con el pago aprobado por el mismo monto (o
 * confirmado a mano por el cajero si se perdió la respuesta); cualquier otro
 * final la rechaza con un mensaje para el cajero. Mientras tanto `vista`
 * dice qué mostrar y los botones mueven el cobro. Lo de Clip lo hace el
 * servidor: aquí solo se pide, se espera y se decide.
 */
export function useCobroTerminal(sesion: { negocioId?: string | null; sucursalId?: string | null }) {
  const [vista, setVista] = useState<VistaCobroClip | null>(null);
  const actual = useRef<EnCurso | null>(null);
  const decision = useRef<((d: "reintentar" | "efectivo") => void) | null>(null);

  function detener() {
    const a = actual.current;
    if (a?.ac) {
      a.ac.abort();
      a.ac = null;
    }
  }

  function soltar(): EnCurso | null {
    detener();
    const a = actual.current;
    actual.current = null;
    return a;
  }

  function fallar(msg: string) {
    const a = soltar();
    setVista(null);
    a?.reject(new Error(msg));
  }

  function aprobar(c: CobroClip) {
    const a = actual.current;
    if (!a) return;
    if (!puedeCrearVentaConClip(c, { montoPago: a.montoPago })) {
      detener();
      setVista({
        paso: "revisar",
        monto: a.monto,
        mensaje: `Clip aprobó $${(c.montoCentavos / 100).toFixed(2)}, pero la venta es de $${a.monto.toFixed(2)}. Revisa el cobro en Clip; la venta no se guardó.`,
      });
      return;
    }
    soltar();
    setVista({ paso: "aprobado", monto: a.monto, tarjeta: etiquetaTarjetaClip(c.tarjeta) });
    a.resolve(pagoClipDeCobro(c));
  }

  function mostrar(c: CobroClip) {
    const a = actual.current;
    // Un intento anterior (p. ej. la caché con el rechazo previo) no cuenta.
    if (!a || c.intento < a.intento) return;
    a.intento = c.intento;
    switch (c.estado) {
      case "aprobado":
        aprobar(c);
        return;
      case "fallido":
      case "cancelado":
        detener();
        setVista({ paso: "sin-pago", monto: a.monto, cobro: c });
        return;
      case "revisar":
        detener();
        setVista({ paso: "revisar", monto: a.monto, mensaje: textoRevisar(c) });
        return;
      case "manual": {
        // Confirmado a mano en la terminal (sin verificar con Clip).
        const x = soltar();
        setVista({ paso: "aprobado", monto: a.monto, tarjeta: "Tarjeta (confirmado en la terminal)" });
        x?.resolve(pagoClipManual(a.cobroId));
        return;
      }
      case "incierto":
        setVista({ paso: "incierto", monto: a.monto, cobro: c, aviso: a.aviso });
        esperar();
        return;
      default:
        setVista({ paso: "esperando", monto: a.monto, cobro: c, aviso: a.aviso });
        esperar();
    }
  }

  function esperar() {
    const a = actual.current;
    if (!a || a.ac || !sesion.negocioId || !sesion.sucursalId) return;
    const ac = new AbortController();
    a.ac = ac;
    esperarCobroClip({
      negocioId: sesion.negocioId,
      sucursalId: sesion.sucursalId,
      cobroId: a.cobroId,
      intento: a.intento,
      signal: ac.signal,
      onCambio: (c) => {
        if (actual.current === a) mostrar(c);
      },
    })
      .then((c) => {
        if (actual.current === a && a.ac === ac) {
          a.ac = null;
          mostrar(c);
        }
      })
      .catch(() => {
        /* se dejó de esperar */
      });
  }

  async function enviar(reintentarIncierto: boolean) {
    const a = actual.current;
    if (!a) return;
    detener();
    a.aviso = undefined;
    setVista({ paso: "enviando", monto: a.monto });
    try {
      const r = await fnCobrarConClip({
        cobroId: a.cobroId,
        monto: a.monto,
        ...(reintentarIncierto ? { reintentarIncierto: true } : {}),
      });
      if (actual.current !== a) return;
      a.aviso = r.data.aviso;
      mostrar(r.data);
    } catch (e) {
      if (actual.current !== a) return;
      setVista({ paso: "error", monto: a.monto, mensaje: textoErrorEnvio(e) });
    }
  }

  /** Manda el cobro a la terminal; se cumple con el pago aprobado. */
  function cobrar(p: { cobroId: string; monto: number; montoPago: string }): Promise<PagoClip> {
    soltar();
    return new Promise<PagoClip>((resolve, reject) => {
      actual.current = { ...p, resolve, reject, ac: null, intento: 0 };
      void enviar(false);
    });
  }

  /** Cancela en el servidor. Si mientras tanto se aprobó, sigue con el pago. */
  async function cancelar() {
    const a = actual.current;
    if (!a) return;
    setVista((v) =>
      v && (v.paso === "esperando" || v.paso === "incierto" || v.paso === "error")
        ? { ...v, ocupado: true }
        : v,
    );
    try {
      const c = (await fnCancelarCobroClip({ cobroId: a.cobroId })).data;
      if (actual.current !== a) return;
      if (c.estado === "aprobado") return aprobar(c);
      if (c.estado === "cancelado" || c.estado === "fallido") {
        return fallar(
          `${c.estado === "fallido" ? "El pago con tarjeta no se aprobó" : "Se canceló el cobro en la terminal"}. Puedes confirmar otra vez o elegir otra forma de pago.`,
        );
      }
      a.aviso = c.aviso;
      mostrar(c);
    } catch (e) {
      if (actual.current !== a) return;
      if (codigoDe(e) === "not-found") {
        return fallar(
          "No se mandó nada a la terminal. Puedes confirmar otra vez o elegir otra forma de pago.",
        );
      }
      a.aviso = "No se pudo cancelar (sin conexión). Revisa la terminal y vuelve a intentarlo.";
      setVista((v) =>
        v && (v.paso === "esperando" || v.paso === "incierto" || v.paso === "error")
          ? { ...v, ocupado: false, aviso: a.aviso, sinRed: true }
          : v,
      );
    }
  }

  /**
   * Se perdió la respuesta, pero la terminal sí cobró: el cajero lo confirma.
   * El servidor lo cierra como "manual" (libera la terminal); si mientras
   * tanto Clip ya lo ligó, manda lo de Clip.
   */
  async function yaSeCobro() {
    const a = actual.current;
    if (!a) return;
    setVista((v) => (v && v.paso === "incierto" ? { ...v, ocupado: true } : v));
    try {
      const c = (await fnCancelarCobroClip({ cobroId: a.cobroId, comoPagado: true })).data;
      if (actual.current !== a) return;
      if (c.estado === "manual" || c.estado === "aprobado") return mostrar(c);
      a.aviso = c.aviso ?? "Clip ya tiene este cobro: espera aquí el resultado.";
      mostrar(c);
    } catch {
      // Sin conexión: el cajero lo vio aprobado. El servidor lo cierra cuando
      // el aviso de Clip lo ligue (o el candado vence).
      if (actual.current !== a) return;
      mostrar({
        cobroId: a.cobroId,
        estado: "manual",
        intento: a.intento,
        monto: String(a.monto),
        montoCentavos: Math.round(a.monto * 100),
        pinpadRequestId: null,
        tarjeta: null,
        pagadoCentavos: 0,
        alerta: null,
        error: null,
        actualizadoEn: null,
      });
    }
  }

  /** Sin conexión: sale de la pantalla y deja el cobro guardado para revisarlo. */
  function salir() {
    const a = soltar();
    setVista(null);
    a?.reject(
      new CobroSinResolver(
        "Sin conexión: revisa la terminal (si muestra el cobro, cancélalo ahí). Al volver la red, la caja revisa este cobro.",
      ),
    );
  }

  /** La tarjeta ya se cobró pero un descuento falló: reintentar o efectivo. */
  function preguntarDescuento(
    info: Omit<Extract<VistaCobroClip, { paso: "descuento" }>, "paso">,
  ): Promise<"reintentar" | "efectivo"> {
    return new Promise((resolve) => {
      decision.current = resolve;
      setVista({ paso: "descuento", ...info });
    });
  }

  function decidirDescuento(d: "reintentar" | "efectivo") {
    const r = decision.current;
    decision.current = null;
    r?.(d);
  }

  return {
    vista,
    cobrar,
    cancelar,
    reintentar: () => void enviar(false),
    reintentarIncierto: () => void enviar(true),
    yaSeCobro: () => void yaSeCobro(),
    salir,
    // Siempre pasa por el servidor: si mientras tanto se aprobó, se guarda la
    // venta en vez de dejar al cliente cobrado sin venta.
    otraForma: () => void cancelar(),
    entendido: () =>
      fallar("El cobro quedó para revisar en Clip; la venta no se guardó."),
    preguntarDescuento,
    decidirDescuento,
    guardando: (monto: number, tarjeta: string) => setVista({ paso: "guardando", monto, tarjeta }),
    cerrar: () => {
      soltar();
      decision.current = null;
      setVista(null);
    },
  };
}

export type CobroTerminal = ReturnType<typeof useCobroTerminal>;
