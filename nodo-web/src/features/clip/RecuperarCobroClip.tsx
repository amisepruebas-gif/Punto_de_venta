import { useEffect, useState } from "react";
import { FirebaseError } from "firebase/app";
import { AlertTriangle, Loader2 } from "lucide-react";
import {
  accionRecuperacionClip,
  type AccionRecuperacionClip,
  type CobroClip,
} from "@shared";
import { cn } from "@/lib/utils";
import { fnConsultarCobroClip } from "@/firebase/callable";
import type { CobroClipEnCurso } from "./clipStore";

export type AccionRecuperar = AccionRecuperacionClip | "descartar" | "mas-tarde";

/** Lo que pagó (o va a pagar) el cliente con tarjeta en esa venta. */
export function montoTarjetaDe(v: { montoPago: string; movimiento: string; datosPagoDividido?: Record<string, unknown> }): number {
  const efectivo =
    v.movimiento === "pagoDividido" ? Number(v.datosPagoDividido?.efectivo) || 0 : 0;
  return Math.round(((Number(v.montoPago) || 0) - efectivo) * 100) / 100;
}

const boton =
  "flex min-h-12 w-full items-center justify-center rounded-xl px-4 text-[15px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";
const principal = cn(boton, "bg-cobro text-white hover:bg-cobro/90 active:bg-cobro/80");
const secundario = cn(boton, "border bg-card text-foreground hover:bg-muted active:bg-muted");

type Estado =
  | { tipo: "cargando" }
  /** No se pudo preguntar al servidor (sin red, o la caja no tiene permiso). */
  | { tipo: "sin-respuesta"; mensaje: string }
  | { tipo: "listo"; accion: AccionRecuperacionClip; cobro: CobroClip | null };

/**
 * Al abrir la caja con un cobro con tarjeta a medias (la app se recargó o se
 * cerró mientras cobraba): pregunta al servidor en qué quedó y ofrece lo que
 * toca. Nada se cobra dos veces: seguir el cobro reusa el mismo, y terminar
 * la venta usa el pago ya aprobado.
 */
export function RecuperarCobroClip({
  registro,
  onAccion,
}: {
  registro: CobroClipEnCurso;
  onAccion: (accion: AccionRecuperar, cobro: CobroClip | null) => void;
}) {
  const [estado, setEstado] = useState<Estado>({ tipo: "cargando" });
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let vivo = true;
    if (registro.fase !== "terminal") {
      setEstado({ tipo: "listo", accion: "terminar-venta", cobro: null });
      return;
    }
    setEstado({ tipo: "cargando" });
    fnConsultarCobroClip({ cobroId: registro.cobroId })
      .then((r) => {
        if (!vivo) return;
        setEstado({
          tipo: "listo",
          accion: accionRecuperacionClip("terminal", r.data, registro.venta),
          cobro: r.data,
        });
      })
      .catch((e) => {
        if (!vivo) return;
        const code = e instanceof FirebaseError ? e.code.replace(/^functions\//, "") : "";
        setEstado(
          code === "not-found"
            ? { tipo: "listo", accion: "retomar", cobro: null }
            : code === "permission-denied" || code === "unauthenticated"
              ? { tipo: "sin-respuesta", mensaje: `La caja no pudo revisar el cobro: ${(e as Error).message}` }
              : { tipo: "sin-respuesta", mensaje: "Sin conexión: no se puede revisar el cobro todavía." },
        );
      });
    return () => {
      vivo = false;
    };
  }, [registro.cobroId, registro.fase, registro.venta, intento]);

  const monto = montoTarjetaDe(registro.venta);
  let texto = "";
  let botones = null;
  if (estado.tipo === "cargando") {
    texto = "Revisando el cobro con Clip…";
  } else if (estado.tipo === "sin-respuesta") {
    texto = estado.mensaje;
    // "Más tarde" no deja atrapada la caja: el cobro sigue guardado y se
    // pregunta otra vez al abrir; mientras, se vende en efectivo o "sin terminal".
    botones = (
      <>
        <button type="button" className={principal} onClick={() => setIntento((n) => n + 1)}>
          Reintentar
        </button>
        <button type="button" className={secundario} onClick={() => onAccion("mas-tarde", null)}>
          Más tarde
        </button>
      </>
    );
  } else {
    const { accion, cobro } = estado;
    const ir = (a: AccionRecuperar) => () => onAccion(a, cobro);
    switch (accion) {
      case "esperar":
        texto = "La terminal todavía tiene el cobro abierto.";
        botones = (
          <button type="button" className={principal} onClick={ir("esperar")}>
            Seguir el cobro
          </button>
        );
        break;
      case "incierto":
        texto = "No se sabe si la terminal recibió el cobro.";
        botones = (
          <button type="button" className={principal} onClick={ir("incierto")}>
            Seguir el cobro
          </button>
        );
        break;
      case "terminar-venta":
        texto = "La tarjeta ya se cobró. Falta guardar la venta.";
        botones = (
          <button type="button" className={principal} onClick={ir("terminar-venta")}>
            Terminar la venta
          </button>
        );
        break;
      case "revisar":
        texto = "El cobro no cuadra con la venta: revísalo en Clip. La venta no se guardó.";
        botones = (
          <button type="button" className={secundario} onClick={ir("revisar")}>
            Entendido
          </button>
        );
        break;
      default:
        texto =
          cobro && (cobro.estado === "fallido" || cobro.estado === "cancelado")
            ? "El cobro no se completó: no se cobró nada."
            : "El cobro no llegó a la terminal: no se cobró nada.";
        botones = (
          <>
            <button type="button" className={principal} onClick={ir("retomar")}>
              Retomar la venta
            </button>
            <button type="button" className={secundario} onClick={ir("descartar")}>
              Descartar
            </button>
          </>
        );
    }
  }

  return (
    <div
      className="fixed inset-0 z-[85] flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="recuperar-clip-titulo"
    >
      <div className="flex max-h-full w-full max-w-sm flex-col items-center gap-3 overflow-y-auto rounded-2xl bg-card p-5 text-center text-foreground shadow-xl">
        {estado.tipo === "cargando" ? (
          <Loader2 className="size-9 animate-spin text-marca-texto" aria-hidden />
        ) : (
          <AlertTriangle className="size-9 text-aviso" aria-hidden />
        )}
        <h2 id="recuperar-clip-titulo" className="text-lg font-semibold">
          Hay un cobro con tarjeta sin terminar
        </h2>
        <p className="text-[2.5rem] font-bold leading-none tabular-nums">
          ${monto.toLocaleString("es-MX", { maximumFractionDigits: 2 })}
        </p>
        <p className="text-[15px] text-muted-foreground" aria-live="polite">
          {texto}
        </p>
        {botones && <div className="flex w-full flex-col gap-2 pt-1">{botones}</div>}
      </div>
    </div>
  );
}
