import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { MAX_ESCALONES, type EscalonTexto } from "@shared";

/**
 * "¿Tiene precio de mayoreo?" + hasta 3 escalones (desde N piezas → precio
 * por pieza). Las filas son texto; quien lo usa las convierte con
 * `escalonesDeTexto` y las valida con `validarEscalones` al guardar.
 * `disabled` muestra los escalones de solo lectura (artículo con zona).
 */
export function EscalonesMayoreoEditor({
  filas,
  onChange,
  disabled = false,
}: {
  filas: EscalonTexto[];
  onChange: (filas: EscalonTexto[]) => void;
  disabled?: boolean;
}) {
  const activo = filas.length > 0;

  function setFila(i: number, campo: keyof EscalonTexto, valor: string) {
    onChange(filas.map((f, j) => (j === i ? { ...f, [campo]: valor } : f)));
  }

  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2">
        <Checkbox
          checked={activo}
          disabled={disabled}
          onChange={(e) =>
            onChange(e.target.checked ? [{ minPz: "", precio: "" }] : [])
          }
        />
        <span className="text-sm">¿Tiene precio de mayoreo?</span>
      </label>
      {activo && (
        <div className="space-y-2 rounded-md border bg-muted/20 p-3">
          {filas.map((f, i) => (
            <div key={i} className="flex items-end gap-2">
              <label className="flex-1 space-y-1">
                <span className="text-[11px] text-muted-foreground">
                  Desde (piezas)
                </span>
                <Input
                  type="number"
                  inputMode="numeric"
                  min="2"
                  value={f.minPz}
                  disabled={disabled}
                  onChange={(e) => setFila(i, "minPz", e.target.value)}
                  placeholder={["10", "25", "40"][i]}
                />
              </label>
              <label className="flex-1 space-y-1">
                <span className="text-[11px] text-muted-foreground">
                  Precio c/u
                </span>
                <Input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  value={f.precio}
                  disabled={disabled}
                  onChange={(e) => setFila(i, "precio", e.target.value)}
                  placeholder={["30", "27", "24"][i]}
                />
              </label>
              {!disabled && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => onChange(filas.filter((_, j) => j !== i))}
                  aria-label={`Quitar mayoreo ${i + 1}`}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
          {!disabled && filas.length < MAX_ESCALONES && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onChange([...filas, { minPz: "", precio: "" }])}
            >
              <Plus className="mr-1 h-3.5 w-3.5" /> Agregar precio
            </Button>
          )}
          <p className="text-[11px] text-muted-foreground">
            Ej.: desde 10 pz a $30, desde 25 pz a $27, desde 40 pz a $24.
          </p>
        </div>
      )}
    </div>
  );
}
