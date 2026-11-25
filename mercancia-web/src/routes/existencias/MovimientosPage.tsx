import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, ChevronLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMovimientos } from "@/features/existencias/useMovimientos";
import { RenglonMovimiento } from "@/features/existencias/RenglonMovimiento";
import {
  claveFinal,
  ETIQUETA_DIRECCION,
  piezasTexto,
} from "@/features/existencias/filasExistencias";
import type { MovimientoExistencias } from "@shared";

const FECHA_HORA = new Intl.DateTimeFormat("es-MX", {
  timeZone: "America/Mexico_City",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

/** `fecha` (ISO en UTC) en hora de la Ciudad de México. */
function fechaHora(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : FECHA_HORA.format(d);
}

/** Los últimos movimientos entre bodega y tienda de esta sucursal: quién,
 *  cuándo, hacia dónde y cómo quedó cada artículo. */
export function MovimientosPage() {
  const navigate = useNavigate();
  const { movimientos, cargando, error } = useMovimientos();
  const [abierto, setAbierto] = useState<string | null>(null);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
      <header className="sticky top-0 z-20 flex items-center gap-2 border-b bg-card/95 px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur supports-[backdrop-filter]:bg-card/85">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/")}
          aria-label="Volver"
          className="-ml-1"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h1 className="flex-1 text-base font-semibold">Movimientos</h1>
      </header>

      <main className="flex-1 space-y-3 px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
        <p className="text-xs text-muted-foreground">
          Los últimos 50 de esta sucursal, el más nuevo arriba.
        </p>
        {error && (
          <p
            role="alert"
            className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
          >
            {error}
          </p>
        )}
        {cargando && movimientos.length === 0 && (
          <p className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
          </p>
        )}
        {!cargando && !error && movimientos.length === 0 && (
          <p className="rounded-md border bg-muted py-8 text-center text-sm text-muted-foreground">
            Todavía no hay movimientos.
          </p>
        )}
        <ul className="space-y-2">
          {movimientos.map((m) => (
            <Movimiento
              key={m.movimientoId}
              movimiento={m}
              abierto={abierto === m.movimientoId}
              onAlternar={() =>
                setAbierto((a) => (a === m.movimientoId ? null : m.movimientoId))
              }
            />
          ))}
        </ul>
      </main>
    </div>
  );
}

function Movimiento({
  movimiento: m,
  abierto,
  onAlternar,
}: {
  movimiento: MovimientoExistencias;
  abierto: boolean;
  onAlternar: () => void;
}) {
  return (
    <li className="overflow-hidden rounded-md border bg-card">
      <button
        type="button"
        onClick={onAlternar}
        aria-expanded={abierto}
        className="flex w-full items-center gap-3 p-2.5 text-left transition active:bg-accent"
      >
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{ETIQUETA_DIRECCION[m.direccion]}</p>
          <p className="truncate text-xs text-muted-foreground">
            {fechaHora(m.fecha)} · {m.usuarioNombre || m.usuarioId}
          </p>
        </div>
        <span className="shrink-0 text-sm font-semibold tabular-nums">
          {piezasTexto(m.piezas)}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
            abierto ? "rotate-180" : ""
          }`}
        />
      </button>
      {abierto && (
        <ul className="space-y-1.5 border-t p-2">
          {m.renglones.map((r) => (
            <RenglonMovimiento
              key={claveFinal(r.articuloId, r.subvariacionCodigo)}
              renglon={r}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
