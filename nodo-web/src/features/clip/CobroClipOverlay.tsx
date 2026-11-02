import { useEffect, useState, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, CreditCard, Loader2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CobroTerminal } from "./useCobroTerminal";

/** Pesos con centavos solo si los hay: 416 → "$416", 12.5 → "$12.50". */
function pesos(n: number): string {
  return `$${n.toLocaleString("es-MX", {
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

const boton =
  "flex min-h-12 w-full items-center justify-center rounded-xl px-4 text-[15px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";
const principal = cn(boton, "bg-cobro text-white hover:bg-cobro/90 active:bg-cobro/80");
const secundario = cn(boton, "border bg-card text-foreground hover:bg-muted active:bg-muted");

/**
 * Pantalla del cobro con la terminal Clip, encima de todo mientras la caja
 * espera al cliente. Cada paso dice qué hacer y qué botones tiene; ninguno
 * cierra la pantalla sin dejar el cobro resuelto (pagado, cancelado o
 * rechazado).
 */
export function CobroClipOverlay({ terminal }: { terminal: CobroTerminal }) {
  const { vista } = terminal;
  // "Ya se cobró" pide confirmación: guarda la venta sin verificar con Clip.
  const [confirmarManual, setConfirmarManual] = useState(false);
  useEffect(() => setConfirmarManual(false), [vista?.paso]);
  if (!vista) return null;

  let icono: ReactNode = <CreditCard className="size-9 text-marca-texto" aria-hidden />;
  let titulo = "";
  let cuerpo: ReactNode = null;
  let botones: ReactNode = null;

  switch (vista.paso) {
    case "enviando":
      icono = <Loader2 className="size-9 animate-spin text-marca-texto" aria-hidden />;
      titulo = "Enviando el cobro a la terminal…";
      break;
    case "esperando":
      titulo = "Cobra en la terminal";
      cuerpo = (
        <p>
          {vista.cobro.estado === "enviando"
            ? "Enviando el cobro a la terminal…"
            : "Pásale la terminal al cliente. Esperando el pago…"}
        </p>
      );
      botones = (
        <button type="button" className={secundario} disabled={vista.ocupado} onClick={terminal.cancelar}>
          {vista.ocupado ? "Cancelando…" : "Cancelar cobro"}
        </button>
      );
      break;
    case "incierto":
      icono = <AlertTriangle className="size-9 text-aviso" aria-hidden />;
      titulo = "No sabemos si la terminal recibió el cobro";
      cuerpo = (
        <ul className="list-disc space-y-1 pl-5 text-left">
          <li>Si la terminal muestra el cobro, deja que el cliente pague: aquí se verá solo.</li>
          <li>Si la terminal está en su pantalla de espera, toca Reintentar.</li>
        </ul>
      );
      botones = confirmarManual ? (
        <>
          <p className="text-sm font-medium text-aviso">
            Solo si la terminal dice “Aprobado” por {pesos(vista.monto)}. La venta se guarda sin
            verificar con Clip.
          </p>
          <button type="button" className={principal} onClick={terminal.yaSeCobro}>
            Sí, la terminal lo aprobó
          </button>
          <button type="button" className={secundario} onClick={() => setConfirmarManual(false)}>
            Volver
          </button>
        </>
      ) : (
        <>
          <button type="button" className={principal} disabled={vista.ocupado} onClick={terminal.reintentarIncierto}>
            Reintentar
          </button>
          <button type="button" className={secundario} disabled={vista.ocupado} onClick={() => setConfirmarManual(true)}>
            Ya se cobró en la terminal
          </button>
          <button type="button" className={secundario} disabled={vista.ocupado} onClick={terminal.cancelar}>
            {vista.ocupado ? "Cancelando…" : "Cancelar cobro"}
          </button>
        </>
      );
      break;
    case "sin-pago":
      icono = <XCircle className="size-9 text-destructive" aria-hidden />;
      titulo = vista.cobro.estado === "cancelado" ? "Cobro cancelado" : "El pago no se aprobó";
      cuerpo = vista.cobro.error?.mensaje ? <p>{vista.cobro.error.mensaje}</p> : null;
      botones = (
        <>
          <button type="button" className={principal} onClick={terminal.reintentar}>
            Reintentar en la terminal
          </button>
          <button type="button" className={secundario} onClick={terminal.otraForma}>
            Elegir otra forma de pago
          </button>
        </>
      );
      break;
    case "revisar":
      icono = <AlertTriangle className="size-9 text-aviso" aria-hidden />;
      titulo = "Hay que revisar este cobro en Clip";
      cuerpo = <p>{vista.mensaje}</p>;
      botones = (
        <button type="button" className={secundario} onClick={terminal.entendido}>
          Entendido
        </button>
      );
      break;
    case "error":
      icono = <AlertTriangle className="size-9 text-aviso" aria-hidden />;
      titulo = "No se pudo mandar el cobro";
      cuerpo = <p>{vista.mensaje}</p>;
      botones = (
        <>
          <button type="button" className={principal} disabled={vista.ocupado} onClick={terminal.reintentar}>
            Reintentar
          </button>
          {/* Cancela en el servidor: si algo llegó a la terminal, no queda vivo. */}
          <button type="button" className={secundario} disabled={vista.ocupado} onClick={terminal.cancelar}>
            {vista.ocupado ? "Revisando…" : "Elegir otra forma de pago"}
          </button>
        </>
      );
      break;
    case "aprobado":
    case "guardando":
      icono = <CheckCircle2 className="size-9 text-cobro" aria-hidden />;
      titulo = "Pago aprobado";
      cuerpo = (
        <p className="flex items-center justify-center gap-2">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          {vista.tarjeta ? `${vista.tarjeta} · ` : ""}Guardando la venta…
        </p>
      );
      break;
    case "descuento":
      icono = <AlertTriangle className="size-9 text-aviso" aria-hidden />;
      titulo = `La tarjeta ya se cobró (${pesos(vista.monto)})`;
      cuerpo = (
        <p>
          {vista.mensaje} Reintenta, o cobra los {pesos(vista.descuento)}{" "}
          {vista.quitar === "cashback" ? "del cashback" : "del crédito de regalo"} en efectivo.
        </p>
      );
      botones = (
        <>
          <button type="button" className={principal} onClick={() => terminal.decidirDescuento("reintentar")}>
            Reintentar
          </button>
          <button type="button" className={secundario} onClick={() => terminal.decidirDescuento("efectivo")}>
            Cobrar {pesos(vista.descuento)} en efectivo
          </button>
        </>
      );
      break;
  }

  const aviso =
    (vista.paso === "esperando" || vista.paso === "incierto" || vista.paso === "error") && vista.aviso
      ? vista.aviso
      : null;

  return (
    <div
      className="fixed inset-0 z-[85] flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cobro-clip-titulo"
    >
      <div className="flex max-h-full w-full max-w-sm flex-col items-center gap-3 overflow-y-auto rounded-2xl bg-card p-5 text-center text-foreground shadow-xl">
        {icono}
        <p className="text-[2.5rem] font-bold leading-none tabular-nums">{pesos(vista.monto)}</p>
        <h2 id="cobro-clip-titulo" className="text-lg font-semibold" aria-live="polite">
          {titulo}
        </h2>
        {cuerpo && <div className="text-[15px] text-muted-foreground">{cuerpo}</div>}
        {aviso && (
          <p className="w-full rounded-lg border border-aviso-borde bg-aviso-suave px-3 py-2 text-sm font-medium text-aviso">
            {aviso}
          </p>
        )}
        {botones && <div className="flex w-full flex-col gap-2 pt-1">{botones}</div>}
      </div>
    </div>
  );
}
