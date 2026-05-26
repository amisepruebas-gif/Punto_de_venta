import { Eye } from "lucide-react";
import type { TicketMostrar } from "@shared";

const CAMPOS: Array<{
  key: keyof TicketMostrar;
  label: string;
  hint: string;
}> = [
  {
    key: "numeroTicket",
    label: "Número de ticket",
    hint: "Línea con el número consecutivo de la venta.",
  },
  {
    key: "fecha",
    label: "Fecha y hora",
    hint: "Fecha en que se realizó la venta.",
  },
  {
    key: "vendedor",
    label: "Nombre del vendedor",
    hint: "Quien atendió la venta (campo `enTurno`).",
  },
];

export function TicketMetaEditor({
  mostrar,
  onChange,
}: {
  mostrar: TicketMostrar | undefined;
  onChange: (mostrar: TicketMostrar | undefined) => void;
}) {
  function setCampo(key: keyof TicketMostrar, valor: boolean) {
    // Solo persistimos los flags que están en `false` (lo "extraño") para
    // no inflar el doc con `{ numeroTicket: true, fecha: true, vendedor: true }`
    // que es el default.
    const next: TicketMostrar = { ...(mostrar ?? {}) };
    if (valor) {
      delete next[key];
    } else {
      next[key] = false;
    }
    onChange(Object.keys(next).length === 0 ? undefined : next);
  }

  function activo(key: keyof TicketMostrar): boolean {
    return mostrar?.[key] !== false;
  }

  return (
    <section className="space-y-3 rounded-lg border bg-card p-4">
      <div className="flex items-center gap-2">
        <Eye className="h-4 w-4 text-muted-foreground" />
        <h3 className="font-semibold">Datos automáticos</h3>
      </div>
      <p className="text-xs text-muted-foreground">
        Activa o desactiva los datos que el ticket imprime automáticamente
        entre el encabezado y el listado de artículos.
      </p>
      <ul className="space-y-2">
        {CAMPOS.map((c) => (
          <li
            key={c.key}
            className="flex items-start gap-3 rounded-md border bg-background p-3"
          >
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4"
              checked={activo(c.key)}
              onChange={(e) => setCampo(c.key, e.target.checked)}
              id={`meta-${c.key}`}
            />
            <label
              htmlFor={`meta-${c.key}`}
              className="flex-1 cursor-pointer text-sm"
            >
              <div className="font-medium">{c.label}</div>
              <div className="text-xs text-muted-foreground">{c.hint}</div>
            </label>
          </li>
        ))}
      </ul>
    </section>
  );
}
