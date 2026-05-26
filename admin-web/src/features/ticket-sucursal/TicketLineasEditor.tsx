import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import type {
  TicketLinea,
  TicketLineaAlineacion,
  TicketLineaEstilo,
} from "@shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { nuevaLinea } from "./ticketDefaults";

const ESTILOS: Array<{ value: TicketLineaEstilo; label: string }> = [
  { value: "normal", label: "Normal" },
  { value: "bold", label: "Negrita" },
  { value: "big", label: "Grande" },
  { value: "small", label: "Pequeño" },
];

const ALINEACIONES: Array<{ value: TicketLineaAlineacion; label: string }> = [
  { value: "left", label: "Izquierda" },
  { value: "center", label: "Centro" },
  { value: "right", label: "Derecha" },
];

export function TicketLineasEditor({
  titulo,
  hint,
  lineas,
  onChange,
}: {
  titulo: string;
  hint?: string;
  lineas: TicketLinea[];
  onChange: (lineas: TicketLinea[]) => void;
}) {
  function actualizar(idx: number, parcial: Partial<TicketLinea>) {
    const next = lineas.slice();
    next[idx] = { ...next[idx], ...parcial };
    onChange(next);
  }

  function eliminar(idx: number) {
    onChange(lineas.filter((_, i) => i !== idx));
  }

  function mover(idx: number, delta: -1 | 1) {
    const dest = idx + delta;
    if (dest < 0 || dest >= lineas.length) return;
    const next = lineas.slice();
    [next[idx], next[dest]] = [next[dest], next[idx]];
    onChange(next);
  }

  function agregar() {
    onChange([...lineas, nuevaLinea()]);
  }

  return (
    <section className="space-y-3 rounded-lg border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold">{titulo}</h3>
          {hint && (
            <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
          )}
        </div>
        <Button size="sm" variant="outline" onClick={agregar} type="button">
          <Plus className="mr-1 h-3 w-3" /> Línea
        </Button>
      </div>

      {lineas.length === 0 ? (
        <p className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
          Sin líneas. Pulsa "Línea" para agregar.
        </p>
      ) : (
        <ul className="space-y-2">
          {lineas.map((l, idx) => (
            <li
              key={l.id}
              className="space-y-2 rounded-md border bg-background p-2"
            >
              <Input
                value={l.texto}
                onChange={(e) => actualizar(idx, { texto: e.target.value })}
                placeholder="Texto de la línea"
                maxLength={120}
              />
              <div className="flex flex-wrap items-center gap-2">
                <select
                  className="h-8 rounded-md border bg-background px-2 text-xs"
                  value={l.estilo ?? "normal"}
                  onChange={(e) =>
                    actualizar(idx, {
                      estilo: e.target.value as TicketLineaEstilo,
                    })
                  }
                >
                  {ESTILOS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <select
                  className="h-8 rounded-md border bg-background px-2 text-xs"
                  value={l.alineacion ?? "center"}
                  onChange={(e) =>
                    actualizar(idx, {
                      alineacion: e.target.value as TicketLineaAlineacion,
                    })
                  }
                >
                  {ALINEACIONES.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <div className="ml-auto flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    type="button"
                    onClick={() => mover(idx, -1)}
                    disabled={idx === 0}
                    aria-label="Subir línea"
                  >
                    <ArrowUp className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    type="button"
                    onClick={() => mover(idx, 1)}
                    disabled={idx === lineas.length - 1}
                    aria-label="Bajar línea"
                  >
                    <ArrowDown className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    type="button"
                    onClick={() => eliminar(idx)}
                    aria-label="Eliminar línea"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
