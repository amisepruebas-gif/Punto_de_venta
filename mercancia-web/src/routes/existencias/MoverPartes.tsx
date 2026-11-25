import { CheckCircle2, Minus, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RenglonMovimiento } from "@/features/existencias/RenglonMovimiento";
import type { RespuestaMover } from "@/features/existencias/existenciasService";
import {
  articulosTexto,
  claveFinal,
  ETIQUETA_DIRECCION,
  nombreOrigen,
  piezasEnOrigen,
  piezasTexto,
  problemaDeLinea,
  totalPiezas,
  type FilaExistencias,
  type LineaMover,
} from "@/features/existencias/filasExistencias";
import type { DireccionMovimientoExistencias } from "@shared";

const DIRECCIONES = Object.keys(ETIQUETA_DIRECCION) as DireccionMovimientoExistencias[];

/** Los dos botones grandes: de dónde a dónde se mueve. */
export function ElegirDireccion({
  direccion,
  onElegir,
  disabled,
}: {
  direccion: DireccionMovimientoExistencias | null;
  onElegir: (d: DireccionMovimientoExistencias) => void;
  disabled: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Hacia dónde se mueve">
      {DIRECCIONES.map((d) => (
        <button
          key={d}
          type="button"
          role="radio"
          aria-checked={direccion === d}
          onClick={() => onElegir(d)}
          disabled={disabled}
          className={`flex h-16 items-center justify-center rounded-xl border-2 px-2 text-base font-semibold shadow-sm transition active:scale-95 disabled:opacity-50 ${
            direccion === d
              ? "border-primary bg-primary text-primary-foreground"
              : "bg-card"
          }`}
        >
          {ETIQUETA_DIRECCION[d]}
        </button>
      ))}
    </div>
  );
}

/** Lista que se está armando: cada línea con −/+, su cantidad y cuántas
 *  hay en el origen (en rojo si se pasa). */
export function LineasEditables({
  lineas,
  porClave,
  direccion,
  onPiezas,
  onQuitar,
}: {
  lineas: LineaMover[];
  porClave: ReadonlyMap<string, FilaExistencias>;
  direccion: DireccionMovimientoExistencias;
  onPiezas: (clave: string, piezas: number) => void;
  onQuitar: (clave: string) => void;
}) {
  return (
    <ul className="space-y-1.5">
      {lineas.map((l) => {
        const fila = porClave.get(l.clave);
        const problema = problemaDeLinea(l, fila, direccion);
        return (
          <li
            key={l.clave}
            className={`flex items-center gap-2 rounded-md border p-2 ${
              problema ? "border-destructive bg-destructive/5" : "bg-background"
            }`}
          >
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-sm font-medium">{l.nombre}</p>
              <p className="truncate font-mono text-[11px] text-muted-foreground">
                {l.codigo}
              </p>
              <p
                className={`text-xs ${
                  problema ? "font-medium text-destructive" : "text-muted-foreground"
                }`}
              >
                {problema ??
                  `En ${nombreOrigen(direccion)} hay ${fila ? piezasEnOrigen(direccion, fila) : 0}`}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onPiezas(l.clave, l.piezas - 1)}
                disabled={l.piezas <= 1}
                aria-label="Restar una pieza"
              >
                <Minus className="h-4 w-4" />
              </Button>
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                value={l.piezas > 0 ? l.piezas : ""}
                onChange={(e) => onPiezas(l.clave, Math.max(0, Math.trunc(Number(e.target.value)) || 0))}
                className="h-9 w-14 px-1 text-center text-sm tabular-nums"
                aria-label={`Piezas de ${l.nombre}`}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onPiezas(l.clave, l.piezas + 1)}
                aria-label="Sumar una pieza"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
              onClick={() => onQuitar(l.clave)}
              aria-label={`Quitar ${l.nombre}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </li>
        );
      })}
    </ul>
  );
}

/** Lo que se va a mover (o se mandó), sin poder cambiarlo. */
export function ResumenEnvio({
  direccion,
  lineas,
}: {
  direccion: DireccionMovimientoExistencias;
  lineas: LineaMover[];
}) {
  return (
    <section className="space-y-2 rounded-lg border bg-card p-3">
      <div>
        <p className="text-base font-semibold">{ETIQUETA_DIRECCION[direccion]}</p>
        <p className="text-sm text-muted-foreground">
          {articulosTexto(lineas.length)} · {piezasTexto(totalPiezas(lineas))}
        </p>
      </div>
      <ul className="divide-y text-sm">
        {lineas.map((l) => (
          <li key={l.clave} className="flex items-start justify-between gap-2 py-1.5">
            <span className="min-w-0">
              <span className="line-clamp-2">{l.nombre}</span>
              <span className="block truncate font-mono text-[11px] text-muted-foreground">
                {l.codigo}
              </span>
            </span>
            <span className="shrink-0 font-semibold tabular-nums">{l.piezas}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Cómo quedó cada artículo después de mover. */
export function ResultadoMovimiento({ respuesta }: { respuesta: RespuestaMover }) {
  return (
    <section className="space-y-3 rounded-lg border-2 border-primary/30 bg-card p-3">
      <div className="flex items-start gap-2">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
        <div>
          <p className="font-semibold">
            Listo: {piezasTexto(respuesta.piezas)} de{" "}
            {ETIQUETA_DIRECCION[respuesta.direccion].toLowerCase()}
          </p>
          {respuesta.ya && (
            <p className="text-xs text-muted-foreground">
              Este movimiento ya se había guardado: no se movió otra vez.
            </p>
          )}
        </div>
      </div>
      <ul className="space-y-1.5">
        {respuesta.renglones.map((r) => (
          <RenglonMovimiento
            key={claveFinal(r.articuloId, r.subvariacionCodigo)}
            renglon={r}
          />
        ))}
      </ul>
    </section>
  );
}
