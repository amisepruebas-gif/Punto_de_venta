import { useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNegocio } from "@/hooks/useNegocio";
import { useCategorias } from "@/features/categorias/useCategorias";
import { EscalonesMayoreoEditor } from "@/features/mayoreo/EscalonesMayoreoEditor";
import {
  escalonesDeTexto,
  escalonesEditables,
  type EscalonTexto,
  type ZonaPrecio,
} from "@shared";
import { crearZona, editarZona, validarZona } from "./zonaPrecioService";

/**
 * Alta / edición de una zona de precios: nombre, categoría sugerida,
 * precio normal y hasta 3 precios de mayoreo. Al crear devuelve la zona
 * nueva para que quien la abrió la seleccione.
 */
export function ZonaFormModal({
  editando,
  categoriaSugerida,
  onClose,
  onCreada,
}: {
  editando: ZonaPrecio | null;
  categoriaSugerida?: string;
  onClose: () => void;
  onCreada?: (zona: ZonaPrecio) => void;
}) {
  const { negocioId } = useNegocio();
  const { categorias } = useCategorias();
  const [nombre, setNombre] = useState(editando?.nombre ?? "");
  const [categoriaId, setCategoriaId] = useState(
    editando?.categoriaId ?? categoriaSugerida ?? "",
  );
  const [precio, setPrecio] = useState(
    editando ? String(editando.precioVenta) : "",
  );
  const [filas, setFilas] = useState<EscalonTexto[]>(
    editando ? escalonesEditables({ escalonesMayoreo: editando.escalones }) : [],
  );
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Un formulario anidado (selector dentro de otro formulario) no debe
    // enviar al de afuera.
    e.stopPropagation();
    if (!negocioId) return;
    const input = {
      nombre,
      ...(categoriaId ? { categoriaId } : {}),
      precioVenta: Number(precio),
      escalones: escalonesDeTexto(filas),
    };
    const err = validarZona(input);
    if (err) {
      setError(err);
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      if (editando) {
        await editarZona(negocioId, editando.zonaId, input);
      } else {
        const zona = await crearZona(negocioId, input);
        onCreada?.(zona);
      }
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGuardando(false);
    }
  }

  // Portal: se abre también desde dentro de otros formularios (editor de
  // artículo, alta de fabricado) y un <form> no puede anidarse en el DOM.
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal
    >
      <form
        onSubmit={onSubmit}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-md space-y-4 overflow-y-auto rounded-lg bg-card p-5 shadow-lg"
      >
        <h2 className="text-lg font-semibold">
          {editando ? "Editar zona de precios" : "Nueva zona de precios"}
        </h2>
        <div className="space-y-1.5">
          <Label htmlFor="zona-nombre">Nombre</Label>
          <Input
            id="zona-nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej. Llaveros"
            autoFocus
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="zona-categoria">Categoría (opcional)</Label>
          <select
            id="zona-categoria"
            value={categoriaId}
            onChange={(e) => setCategoriaId(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
          >
            <option value="">— Cualquiera —</option>
            {categorias.map((c) => (
              <option key={c.categoriaId} value={c.categoriaId}>
                {c.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="zona-precio">Precio normal (por pieza)</Label>
          <Input
            id="zona-precio"
            type="number"
            inputMode="decimal"
            min="0"
            value={precio}
            onChange={(e) => setPrecio(e.target.value)}
            placeholder="35"
            required
          />
        </div>
        <EscalonesMayoreoEditor
          filas={filas}
          onChange={setFilas}
          pregunta="¿Tiene precios de mayoreo?"
        />
        {editando && (
          <p className="text-xs text-muted-foreground">
            Al guardar, todos los artículos de esta zona toman el nuevo precio
            y mayoreo en unos segundos.
          </p>
        )}
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={guardando}>
            {guardando ? "Guardando…" : editando ? "Guardar" : "Crear zona"}
          </Button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
