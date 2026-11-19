// Piezas de pantalla del teléfono (`/enlace`). Pensadas para usarse con una
// mano en el taller: botones altos, texto grande, una cosa por pantalla.

import { useState, type ReactNode } from "react";
import { AlertTriangle, ChevronLeft, Loader2, RefreshCw, WifiOff } from "lucide-react";
import { LoteConProblemas } from "@shared";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  MENSAJE_APAGADO,
  MENSAJE_SIN_INTERNET,
  entrarConEnlace,
  esPermisoDenegado,
  mensajeDeError,
  salirDelEnlace,
} from "@/firebase/enlaceApp";
import { useEnlace } from "./EnlaceContext";

/** Marco de una pantalla: encabezado fijo arriba y contenido. */
export function Pantalla({
  titulo,
  subtitulo,
  onVolver,
  derecha,
  children,
  pie,
}: {
  titulo: ReactNode;
  subtitulo?: ReactNode;
  onVolver?: () => void;
  derecha?: ReactNode;
  children: ReactNode;
  /** Botones fijos abajo (al alcance del pulgar). */
  pie?: ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-background">
      <header className="sticky top-0 z-20 flex items-center gap-2 border-b bg-card/95 px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur">
        {onVolver && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onVolver}
            aria-label="Atrás"
            className="-ml-1 h-12 w-12 shrink-0"
          >
            <ChevronLeft className="h-7 w-7" />
          </Button>
        )}
        <div className="min-w-0 flex-1 py-1">
          <h1 className="truncate text-lg font-semibold leading-tight">{titulo}</h1>
          {subtitulo && (
            <p className="truncate text-sm text-muted-foreground">{subtitulo}</p>
          )}
        </div>
        {derecha}
      </header>
      <main className="flex-1 space-y-4 px-3 pb-6 pt-3">{children}</main>
      {pie && (
        <footer className="sticky bottom-0 z-20 space-y-2 border-t bg-card/95 p-3 pb-[max(0.75rem,calc(env(safe-area-inset-bottom)+0.5rem))] backdrop-blur">
          {pie}
        </footer>
      )}
    </div>
  );
}

/** Botón alto, a todo lo ancho. */
export function BotonGrande({ className, ...props }: ButtonProps) {
  return <Button className={cn("h-14 w-full text-lg", className)} {...props} />;
}

export function Cargando({ texto = "Cargando…" }: { texto?: string }) {
  return (
    <p className="flex items-center justify-center gap-2 py-10 text-base text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin" /> {texto}
    </p>
  );
}

export function PantallaCargando({ texto }: { texto?: string }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md items-center justify-center">
      <Cargando texto={texto} />
    </div>
  );
}

export function Aviso({
  tono = "info",
  children,
}: {
  tono?: "info" | "ojo" | "bien" | "mal";
  children: ReactNode;
}) {
  const color = {
    info: "border-border bg-muted text-foreground",
    ojo: "border-amber-500/40 bg-amber-500/10 text-amber-900",
    bien: "border-emerald-500/40 bg-emerald-500/10 text-emerald-900",
    mal: "border-destructive/40 bg-destructive/10 text-destructive",
  }[tono];
  return (
    <div role={tono === "mal" ? "alert" : "status"} className={cn("rounded-md border p-3 text-base", color)}>
      {children}
    </div>
  );
}

/**
 * Un error en palabras sencillas. Si es "sin permiso" (acceso apagado,
 * renovado o vencido) dice qué hacer y deja reintentar; si además la URL
 * traía un secreto (un enlace nuevo), deja entrar con él.
 */
export function AvisoError({
  error,
  onReintentar,
}: {
  error: unknown;
  onReintentar?: () => void;
}) {
  const { negocioId, enlaceId, secreto, setSesion } = useEnlace();
  const [entrando, setEntrando] = useState(false);
  const [errorEntrar, setErrorEntrar] = useState<unknown>(null);
  if (!error) return null;

  if (error instanceof LoteConProblemas) {
    return (
      <Aviso tono="mal">
        <p className="font-semibold">Falta arreglar esto:</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-5">
          {error.problemas.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </Aviso>
    );
  }

  const texto = mensajeDeError(error);
  const apagado = esPermisoDenegado(error) || texto === MENSAJE_APAGADO;
  const sinRed = texto === MENSAJE_SIN_INTERNET;

  async function entrarDeNuevo() {
    if (!secreto) return;
    setEntrando(true);
    setErrorEntrar(null);
    try {
      await salirDelEnlace(negocioId, enlaceId);
      setSesion(await entrarConEnlace(negocioId, enlaceId, secreto));
    } catch (e) {
      setErrorEntrar(e);
    } finally {
      setEntrando(false);
    }
  }

  return (
    <Aviso tono="mal">
      <p className="flex items-start gap-2">
        {sinRed ? (
          <WifiOff className="mt-0.5 h-5 w-5 shrink-0" />
        ) : (
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
        )}
        <span>{texto}</span>
      </p>
      {(onReintentar || (apagado && secreto)) && (
        <div className="mt-3 space-y-2">
          {onReintentar && (
            <Button variant="outline" className="h-12 w-full bg-background text-base" onClick={onReintentar}>
              <RefreshCw className="mr-2 h-5 w-5" /> Reintentar
            </Button>
          )}
          {apagado && secreto && (
            <Button
              variant="outline"
              className="h-12 w-full bg-background text-base"
              onClick={entrarDeNuevo}
              disabled={entrando}
            >
              {entrando && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
              Entrar con el enlace que abriste
            </Button>
          )}
          {!!errorEntrar && <p className="text-sm">{mensajeDeError(errorEntrar)}</p>}
        </div>
      )}
    </Aviso>
  );
}

/** Confirmación en la misma pantalla (sin `confirm()` del navegador). */
export function ConfirmarEnLinea({
  pregunta,
  textoSi,
  onSi,
  onNo,
  ocupado,
}: {
  pregunta: ReactNode;
  textoSi: string;
  onSi: () => void;
  onNo: () => void;
  ocupado?: boolean;
}) {
  return (
    <div className="space-y-2 rounded-md border border-destructive/40 bg-destructive/5 p-3">
      <p className="text-base">{pregunta}</p>
      <div className="flex gap-2">
        <Button variant="outline" className="h-12 flex-1 text-base" onClick={onNo} disabled={ocupado}>
          No
        </Button>
        <Button variant="destructive" className="h-12 flex-1 text-base" onClick={onSi} disabled={ocupado}>
          {ocupado && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
          {textoSi}
        </Button>
      </div>
    </div>
  );
}

/** Campo de piezas con teclado numérico y botones − / +. */
export function CampoPiezas({
  valor,
  onCambio,
  etiqueta = "Piezas",
  autoFocus,
  disabled,
}: {
  valor: string;
  onCambio: (v: string) => void;
  etiqueta?: string;
  autoFocus?: boolean;
  /** Mientras se manda: no se puede cambiar. */
  disabled?: boolean;
}) {
  const n = Number(valor) || 0;
  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        className="h-14 w-14 shrink-0 text-2xl"
        onClick={() => onCambio(String(Math.max(1, n - 1)))}
        aria-label={`Una menos (${etiqueta})`}
        disabled={disabled}
      >
        −
      </Button>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={valor}
        onChange={(e) => onCambio(e.target.value.replace(/\D/g, "").slice(0, 6))}
        aria-label={etiqueta}
        placeholder="0"
        autoFocus={autoFocus}
        readOnly={disabled}
        className="h-14 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-center text-2xl font-semibold tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <Button
        type="button"
        variant="outline"
        className="h-14 w-14 shrink-0 text-2xl"
        onClick={() => onCambio(String(n + 1))}
        aria-label={`Una más (${etiqueta})`}
        disabled={disabled}
      >
        +
      </Button>
    </div>
  );
}

/** "1 paquete" / "3 paquetes". */
export function plural(n: number, uno: string, varios: string): string {
  return `${n} ${n === 1 ? uno : varios}`;
}
