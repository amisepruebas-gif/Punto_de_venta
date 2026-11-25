import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  PIEZAS_MAYOREO,
  nivelDeTexto,
  validarPrecioNivel,
  type PrecioMayoreoNivel,
} from "@shared";
import {
  guardarPrecioMayoreo,
  type NivelPrecioMayoreo,
} from "./preciosMayoreoService";

/** «Mayoreo $22 · Menudeo $30». */
export function textoPrecioMayoreo(n: PrecioMayoreoNivel): string {
  return `Mayoreo $${n.precio} · Menudeo $${n.menudeo}`;
}

/**
 * Captura el precio de mayoreo de una categoría o de una subcategoría. El de
 * la categoría vale para todos sus artículos de mayoreo; una subcategoría
 * puede tener el suyo o usar el de su categoría.
 */
export function PrecioMayoreoModal({
  negocioId,
  nivel,
  id,
  nombre,
  actual,
  deLaCategoria,
  onClose,
}: {
  negocioId: string;
  nivel: NivelPrecioMayoreo;
  id: string;
  nombre: string;
  /** El precio que tiene hoy, si tiene. */
  actual?: PrecioMayoreoNivel;
  /** Solo subcategorías: el precio de su categoría, si tiene. */
  deLaCategoria?: PrecioMayoreoNivel;
  onClose: () => void;
}) {
  const esSub = nivel === "subcategorias";
  const [precio, setPrecio] = useState(actual ? String(actual.precio) : "");
  const [menudeo, setMenudeo] = useState(actual ? String(actual.menudeo) : "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar(valor: PrecioMayoreoNivel | null) {
    setSubmitting(true);
    setError(null);
    try {
      await guardarPrecioMayoreo(negocioId, nivel, id, valor);
      onClose();
    } catch (e) {
      setError((e as Error).message);
      setSubmitting(false);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const problema = validarPrecioNivel(precio, menudeo);
    if (problema) {
      setError(problema);
      return;
    }
    void guardar(nivelDeTexto(precio, menudeo));
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal
    >
      <form
        onSubmit={onSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md space-y-4 rounded-lg bg-card p-5 shadow-lg"
      >
        <div>
          <h2 className="text-lg font-semibold">Precio de mayoreo · {nombre}</h2>
          <p className="text-sm text-muted-foreground">
            {esSub
              ? "Solo para los artículos de mayoreo de esta subcategoría."
              : "Para todos los artículos de mayoreo de esta categoría."}{" "}
            Los que tienen precio propio no cambian.
          </p>
        </div>

        {esSub && !actual && (
          <p className="rounded-md bg-muted px-3 py-2 text-sm">
            {deLaCategoria
              ? `Hoy usa el de su categoría: ${textoPrecioMayoreo(deLaCategoria)}.`
              : "Su categoría todavía no tiene precio."}
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="pm-precio">Precio de mayoreo</Label>
            <Input
              id="pm-precio"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={precio}
              onChange={(e) => setPrecio(e.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pm-menudeo">Precio menudeo</Label>
            <Input
              id="pm-menudeo"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={menudeo}
              onChange={(e) => setMenudeo(e.target.value)}
            />
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">
          El menudeo se cobra cuando el ticket lleva menos de {PIEZAS_MAYOREO} piezas.
        </p>

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        <div className="flex flex-wrap justify-end gap-2 pt-2">
          {actual && (
            <Button
              type="button"
              variant="ghost"
              className="mr-auto text-destructive hover:text-destructive"
              onClick={() => guardar(null)}
              disabled={submitting}
            >
              {esSub ? "Usar el de la categoría" : "Quitar precio"}
            </Button>
          )}
          <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Guardando…" : "Guardar"}
          </Button>
        </div>
      </form>
    </div>
  );
}
