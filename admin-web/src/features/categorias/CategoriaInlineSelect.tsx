import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNegocio } from "@/hooks/useNegocio";
import { useCategorias } from "./useCategorias";
import { asegurarCategoria, asegurarSubcategoria } from "./categoriaService";

const SELECT_CLS =
  "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm disabled:cursor-not-allowed disabled:opacity-50";

/**
 * Categoría + subcategoría (opcional) con "+ Nueva" para crearlas en el
 * momento. Escribir un nombre que ya existe la selecciona (mismo slug).
 */
export function CategoriaInlineSelect({
  categoriaId,
  subcategoriaId,
  onChange,
  categoriaRequerida = false,
}: {
  categoriaId: string;
  subcategoriaId: string;
  onChange: (v: { categoriaId: string; subcategoriaId: string }) => void;
  categoriaRequerida?: boolean;
}) {
  const { negocioId } = useNegocio();
  const { categorias, subcategorias } = useCategorias();
  const subsDeCategoria = useMemo(
    () => subcategorias.filter((sc) => sc.categoriaId === categoriaId),
    [subcategorias, categoriaId],
  );

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <CampoConNuevo
        etiqueta={categoriaRequerida ? "Categoría *" : "Categoría"}
        placeholderNuevo="Ej. Llavero"
        valor={categoriaId}
        opciones={categorias.map((c) => ({ id: c.categoriaId, nombre: c.nombre }))}
        vacio={categoriaRequerida ? "— Elige una categoría —" : "— Sin categoría —"}
        onElegir={(id) => onChange({ categoriaId: id, subcategoriaId: "" })}
        onCrear={async (nombre) => {
          if (!negocioId) throw new Error("Sin negocio");
          const c = await asegurarCategoria(negocioId, nombre);
          onChange({ categoriaId: c.categoriaId, subcategoriaId: "" });
        }}
      />
      <CampoConNuevo
        etiqueta="Subcategoría (opcional)"
        placeholderNuevo="Ej. Anime"
        valor={subcategoriaId}
        opciones={subsDeCategoria.map((sc) => ({
          id: sc.subcategoriaId,
          nombre: sc.nombre,
        }))}
        vacio="— Sin subcategoría —"
        deshabilitado={!categoriaId}
        ayudaDeshabilitado="Elige una categoría primero"
        onElegir={(id) => onChange({ categoriaId, subcategoriaId: id })}
        onCrear={async (nombre) => {
          if (!negocioId) throw new Error("Sin negocio");
          const sc = await asegurarSubcategoria(negocioId, nombre, categoriaId);
          onChange({ categoriaId, subcategoriaId: sc.subcategoriaId });
        }}
      />
    </div>
  );
}

function CampoConNuevo({
  etiqueta,
  placeholderNuevo,
  valor,
  opciones,
  vacio,
  deshabilitado = false,
  ayudaDeshabilitado,
  onElegir,
  onCrear,
}: {
  etiqueta: string;
  placeholderNuevo: string;
  valor: string;
  opciones: Array<{ id: string; nombre: string }>;
  vacio: string;
  deshabilitado?: boolean;
  ayudaDeshabilitado?: string;
  onElegir: (id: string) => void;
  onCrear: (nombre: string) => Promise<void>;
}) {
  const [creando, setCreando] = useState(false);
  const [nombre, setNombre] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function crear() {
    if (!nombre.trim()) return;
    setGuardando(true);
    setError(null);
    try {
      await onCrear(nombre);
      setCreando(false);
      setNombre("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="space-y-1.5">
      <Label>{etiqueta}</Label>
      {creando ? (
        <div className="flex gap-2">
          <Input
            autoFocus
            value={nombre}
            placeholder={placeholderNuevo}
            onChange={(e) => setNombre(e.target.value)}
            onKeyDown={(e) => {
              // Enter crea sin enviar el formulario que contiene al campo.
              if (e.key === "Enter") {
                e.preventDefault();
                void crear();
              } else if (e.key === "Escape") {
                setCreando(false);
              }
            }}
          />
          <Button type="button" size="sm" onClick={crear} disabled={guardando || !nombre.trim()}>
            {guardando ? "…" : "Crear"}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setCreando(false)}>
            Cancelar
          </Button>
        </div>
      ) : (
        <div className="flex gap-2">
          <select
            value={valor}
            onChange={(e) => onElegir(e.target.value)}
            disabled={deshabilitado}
            className={SELECT_CLS}
          >
            <option value="">{vacio}</option>
            {opciones.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nombre}
              </option>
            ))}
          </select>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setCreando(true)}
            disabled={deshabilitado}
            title="Crear nueva"
          >
            <Plus className="h-3.5 w-3.5" /> Nueva
          </Button>
        </div>
      )}
      {deshabilitado && ayudaDeshabilitado && (
        <p className="text-[11px] text-muted-foreground">{ayudaDeshabilitado}</p>
      )}
      {error && (
        <p className="text-[11px] text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
