import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { nivelDeTexto, validarPrecioNivel } from "@shared";
import { guardarPrecioMayoreo } from "./preciosMayoreoService";

/** La categoría todavía no tiene precio de mayoreo: se captura aquí mismo
 *  (vale para todos sus artículos de mayoreo). */
export function PrecioCategoriaInline({
  negocioId,
  categoriaId,
  categoriaNombre,
}: {
  negocioId: string;
  categoriaId: string;
  categoriaNombre: string;
}) {
  const [precio, setPrecio] = useState("");
  const [menudeo, setMenudeo] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar() {
    const problema = validarPrecioNivel(precio, menudeo);
    if (problema) {
      setError(problema);
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      await guardarPrecioMayoreo(negocioId, "categorias", categoriaId, nivelDeTexto(precio, menudeo));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="space-y-3 rounded-md border border-amber-500/40 bg-amber-500/10 p-3">
      <p className="text-sm">
        <strong>{categoriaNombre}</strong> todavía no tiene precio de mayoreo. Ponlo aquí: vale
        para todos sus artículos.
      </p>
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div className="space-y-1.5">
          <Label htmlFor="cat-precio">Precio de mayoreo</Label>
          <Input
            id="cat-precio"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            value={precio}
            onChange={(e) => setPrecio(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cat-menudeo">Precio menudeo</Label>
          <Input
            id="cat-menudeo"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            value={menudeo}
            onChange={(e) => setMenudeo(e.target.value)}
          />
        </div>
        <Button type="button" onClick={guardar} disabled={guardando}>
          {guardando ? "Guardando…" : "Guardar precio"}
        </Button>
      </div>
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
