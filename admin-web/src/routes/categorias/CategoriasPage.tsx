import { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  FolderTree,
  Palette,
  Pencil,
  Plus,
  Tags,
  Trash2,
} from "lucide-react";
import { useNegocio } from "@/hooks/useNegocio";
import { useCategorias } from "@/features/categorias/useCategorias";
import { useGeneros } from "@/features/categorias/useGeneros";
import {
  borrarCategoria,
  borrarSubcategoria,
  crearCategoria,
  crearSubcategoria,
  moverSubcategoria,
  renombrarCategoria,
  renombrarSubcategoria,
} from "@/features/categorias/categoriaService";
import {
  borrarGenero,
  crearGenero,
  renombrarGenero,
} from "@/features/categorias/generoService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  PrecioMayoreoModal,
  textoPrecioMayoreo,
} from "@/features/mayoreo/PrecioMayoreoModal";
import {
  guardarPrecioMayoreo,
  usePreciosMayoreo,
  type NivelPrecioMayoreo,
} from "@/features/mayoreo/preciosMayoreoService";
import {
  nivelPrecioValido,
  type Categoria,
  type Genero,
  type PrecioMayoreoNivel,
  type Subcategoria,
} from "@shared";

const HUERFANO_KEY = "__huerfano__";

export function CategoriasPage() {
  const { negocioId } = useNegocio();
  const { categorias, subcategorias, loading } = useCategorias();
  const { generos, loading: cargandoGeneros } = useGeneros();
  const [expandidas, setExpandidas] = useState<Set<string>>(new Set());
  const [modal, setModal] = useState<ModalState | null>(null);
  // Precios de mayoreo en escalera: el de la categoría vale para todos sus
  // artículos de mayoreo; una subcategoría puede tener el suyo.
  const { precios } = usePreciosMayoreo();
  const [precioDe, setPrecioDe] = useState<{
    nivel: NivelPrecioMayoreo;
    id: string;
    nombre: string;
    categoriaId?: string;
  } | null>(null);
  const precioValido = (n: unknown): PrecioMayoreoNivel | undefined =>
    nivelPrecioValido(n) ? n : undefined;

  // Agrupar subcategorías por categoría padre. Las que apuntan a categorías
  // inexistentes (huérfanas tras borrado) van a la cubeta especial.
  const grupos = useMemo(() => {
    const map = new Map<string, Subcategoria[]>();
    const ids = new Set(categorias.map((c) => c.categoriaId));
    for (const c of categorias) map.set(c.categoriaId, []);
    map.set(HUERFANO_KEY, []);
    for (const sc of subcategorias) {
      const bucket = ids.has(sc.categoriaId) ? sc.categoriaId : HUERFANO_KEY;
      map.get(bucket)!.push(sc);
    }
    return map;
  }, [categorias, subcategorias]);

  const huerfanas = grupos.get(HUERFANO_KEY) ?? [];

  function toggleExpand(catId: string) {
    setExpandidas((prev) => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId);
      else next.add(catId);
      return next;
    });
  }

  async function onBorrarCategoria(c: Categoria) {
    if (
      !confirm(
        `¿Borrar la categoría "${c.nombre}"? Las subcategorías y artículos asociados quedarán como "(sin categoría)".`,
      )
    ) {
      return;
    }
    if (!negocioId) return;
    await borrarCategoria(negocioId, c.categoriaId);
    // Su precio de mayoreo se va con ella: una categoría nueva con el mismo
    // nombre no debe revivirlo.
    if (precios?.categorias?.[c.categoriaId]) {
      await guardarPrecioMayoreo(negocioId, "categorias", c.categoriaId, null);
    }
  }

  async function onBorrarSubcategoria(sc: Subcategoria) {
    if (
      !confirm(
        `¿Borrar la subcategoría "${sc.nombre}"? Los artículos asociados quedarán sin subcategoría.`,
      )
    ) {
      return;
    }
    if (!negocioId) return;
    await borrarSubcategoria(negocioId, sc.subcategoriaId);
    if (precios?.subcategorias?.[sc.subcategoriaId]) {
      await guardarPrecioMayoreo(negocioId, "subcategorias", sc.subcategoriaId, null);
    }
  }

  async function onBorrarGenero(g: Genero) {
    if (
      !confirm(
        `¿Borrar el género "${g.nombre}"? Los artículos que lo tienen quedarán "(sin género)".`,
      )
    ) {
      return;
    }
    if (negocioId) await borrarGenero(negocioId, g.generoId);
  }

  return (
    <div className="container max-w-4xl space-y-4 py-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Categorías y géneros
          </h1>
          <p className="text-sm text-muted-foreground">
            Catálogo universal del negocio. {categorias.length}{" "}
            {categorias.length === 1 ? "categoría" : "categorías"} ·{" "}
            {subcategorias.length}{" "}
            {subcategorias.length === 1 ? "subcategoría" : "subcategorías"}
            {huerfanas.length > 0
              ? ` · ${huerfanas.length} huérfana${huerfanas.length === 1 ? "" : "s"}`
              : ""}
          </p>
        </div>
        <Button onClick={() => setModal({ tipo: "nueva-categoria" })}>
          <Plus className="mr-2 h-4 w-4" /> Nueva categoría
        </Button>
      </div>

      {loading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Cargando…
        </p>
      ) : categorias.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <FolderTree className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">
            Sin categorías todavía
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {categorias.map((c) => {
            const subs = grupos.get(c.categoriaId) ?? [];
            const open = expandidas.has(c.categoriaId);
            return (
              <li
                key={c.categoriaId}
                className="rounded-lg border bg-card"
              >
                <header className="flex items-center gap-2 p-3">
                  <button
                    type="button"
                    onClick={() => toggleExpand(c.categoriaId)}
                    aria-label={open ? "Contraer" : "Expandir"}
                    className="rounded p-1 hover:bg-muted"
                  >
                    {open ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </button>
                  <FolderTree className="h-4 w-4 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{c.nombre}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      #{c.categoriaId} ·{" "}
                      {subs.length === 1
                        ? "1 subcategoría"
                        : `${subs.length} subcategorías`}
                    </p>
                  </div>
                  <BotonPrecio
                    precio={precioValido(precios?.categorias?.[c.categoriaId])}
                    sinPrecio="Precio de mayoreo"
                    onClick={() =>
                      setPrecioDe({ nivel: "categorias", id: c.categoriaId, nombre: c.nombre })
                    }
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setModal({
                        tipo: "nueva-subcategoria",
                        categoriaId: c.categoriaId,
                      })
                    }
                  >
                    <Plus className="mr-1 h-3 w-3" /> Subcategoría
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      setModal({
                        tipo: "editar-categoria",
                        categoria: c,
                      })
                    }
                    aria-label="Editar"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onBorrarCategoria(c)}
                    aria-label="Borrar"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </header>
                {open && (
                  <div className="border-t p-2">
                    {subs.length === 0 ? (
                      <p className="px-2 py-1 text-xs text-muted-foreground">
                        Sin subcategorías
                      </p>
                    ) : (
                      <ul className="space-y-1">
                        {subs.map((sc) => (
                          <SubcategoriaRow
                            key={sc.subcategoriaId}
                            sc={sc}
                            precio={precioValido(precios?.subcategorias?.[sc.subcategoriaId])}
                            onPrecio={() =>
                              setPrecioDe({
                                nivel: "subcategorias",
                                id: sc.subcategoriaId,
                                nombre: sc.nombre,
                                categoriaId: sc.categoriaId,
                              })
                            }
                            onEditar={() =>
                              setModal({
                                tipo: "editar-subcategoria",
                                subcategoria: sc,
                              })
                            }
                            onBorrar={() => onBorrarSubcategoria(sc)}
                          />
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </li>
            );
          })}

          {huerfanas.length > 0 && (
            <li className="rounded-lg border border-dashed bg-muted/30 p-3">
              <header className="flex items-center gap-2">
                <Tags className="h-4 w-4 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-muted-foreground">
                    Subcategorías huérfanas
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Su categoría padre fue borrada. Reasígnalas o bórralas.
                  </p>
                </div>
              </header>
              <ul className="mt-2 space-y-1">
                {huerfanas.map((sc) => (
                  <SubcategoriaRow
                    key={sc.subcategoriaId}
                    sc={sc}
                    onEditar={() =>
                      setModal({
                        tipo: "editar-subcategoria",
                        subcategoria: sc,
                      })
                    }
                    onBorrar={() => onBorrarSubcategoria(sc)}
                    huerfana
                  />
                ))}
              </ul>
            </li>
          )}
        </ul>
      )}

      {/* Géneros: temáticas (Anime, K-pop…) aparte de la categoría. */}
      <section className="space-y-2 pt-4">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold">Géneros</h2>
            <p className="text-sm text-muted-foreground">
              La temática del artículo, aparte de la categoría: un llavero y un
              peluche pueden ser los dos "Anime". {generos.length}{" "}
              {generos.length === 1 ? "género" : "géneros"}.
            </p>
          </div>
          <Button variant="outline" onClick={() => setModal({ tipo: "nuevo-genero" })}>
            <Plus className="mr-2 h-4 w-4" /> Nuevo género
          </Button>
        </div>
        {cargandoGeneros ? (
          <p className="py-4 text-center text-sm text-muted-foreground">Cargando…</p>
        ) : generos.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <Palette className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">Sin géneros todavía</p>
          </div>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {generos.map((g) => (
              <li
                key={g.generoId}
                className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm"
              >
                <Palette className="h-4 w-4 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{g.nombre}</p>
                  <p className="truncate text-[10px] text-muted-foreground">#{g.generoId}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setModal({ tipo: "editar-genero", genero: g })}
                  aria-label={`Editar ${g.nombre}`}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onBorrarGenero(g)}
                  aria-label={`Borrar ${g.nombre}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {precioDe && negocioId && (
        <PrecioMayoreoModal
          negocioId={negocioId}
          nivel={precioDe.nivel}
          id={precioDe.id}
          nombre={precioDe.nombre}
          actual={precioValido(precios?.[precioDe.nivel]?.[precioDe.id])}
          deLaCategoria={
            precioDe.categoriaId
              ? precioValido(precios?.categorias?.[precioDe.categoriaId])
              : undefined
          }
          onClose={() => setPrecioDe(null)}
        />
      )}

      {modal && negocioId && (
        <CategoriaModal
          state={modal}
          negocioId={negocioId}
          categorias={categorias}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

/** Botón con el precio de mayoreo de una categoría o subcategoría. */
function BotonPrecio({
  precio,
  sinPrecio,
  onClick,
}: {
  precio?: PrecioMayoreoNivel;
  sinPrecio: string;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant={precio ? "outline" : "ghost"}
      size="sm"
      onClick={onClick}
      className={precio ? "" : "text-muted-foreground"}
      title="Precio de mayoreo y de menudeo de sus artículos de mayoreo"
    >
      {precio ? textoPrecioMayoreo(precio) : sinPrecio}
    </Button>
  );
}

function SubcategoriaRow({
  sc,
  precio,
  onPrecio,
  onEditar,
  onBorrar,
  huerfana = false,
}: {
  sc: Subcategoria;
  precio?: PrecioMayoreoNivel;
  /** Sin esto no se ofrece el precio (subcategoría huérfana). */
  onPrecio?: () => void;
  onEditar: () => void;
  onBorrar: () => void;
  huerfana?: boolean;
}) {
  return (
    <li className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-muted/50">
      <Tags className="h-3.5 w-3.5 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="truncate">{sc.nombre}</p>
        <p className="truncate text-[10px] text-muted-foreground">
          #{sc.subcategoriaId}
          {huerfana ? " · huérfana" : ""}
        </p>
      </div>
      {onPrecio && (
        <BotonPrecio precio={precio} sinPrecio="Usa el de la categoría" onClick={onPrecio} />
      )}
      <Button variant="ghost" size="icon" onClick={onEditar} aria-label="Editar">
        <Pencil className="h-3 w-3" />
      </Button>
      <Button variant="ghost" size="icon" onClick={onBorrar} aria-label="Borrar">
        <Trash2 className="h-3 w-3" />
      </Button>
    </li>
  );
}

// ============================================================
// Modal (CRUD)
// ============================================================

type ModalState =
  | { tipo: "nueva-categoria" }
  | { tipo: "editar-categoria"; categoria: Categoria }
  | { tipo: "nueva-subcategoria"; categoriaId: string }
  | { tipo: "editar-subcategoria"; subcategoria: Subcategoria }
  | { tipo: "nuevo-genero" }
  | { tipo: "editar-genero"; genero: Genero };

function CategoriaModal({
  state,
  negocioId,
  categorias,
  onClose,
}: {
  state: ModalState;
  negocioId: string;
  categorias: Categoria[];
  onClose: () => void;
}) {
  const initialNombre =
    state.tipo === "editar-categoria"
      ? state.categoria.nombre
      : state.tipo === "editar-subcategoria"
        ? state.subcategoria.nombre
        : state.tipo === "editar-genero"
          ? state.genero.nombre
          : "";
  const initialCatId =
    state.tipo === "nueva-subcategoria"
      ? state.categoriaId
      : state.tipo === "editar-subcategoria"
        ? state.subcategoria.categoriaId
        : "";

  const [nombre, setNombre] = useState(initialNombre);
  const [categoriaId, setCategoriaId] = useState(initialCatId);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const titulo = {
    "nueva-categoria": "Nueva categoría",
    "editar-categoria": "Editar categoría",
    "nueva-subcategoria": "Nueva subcategoría",
    "editar-subcategoria": "Editar subcategoría",
    "nuevo-genero": "Nuevo género",
    "editar-genero": "Editar género",
  }[state.tipo];
  const esGenero = state.tipo === "nuevo-genero" || state.tipo === "editar-genero";
  const esNuevo = state.tipo.startsWith("nuev");

  const requiereCategoriaPadre =
    state.tipo === "nueva-subcategoria" || state.tipo === "editar-subcategoria";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) return;
    if (requiereCategoriaPadre && !categoriaId) {
      setError("Selecciona la categoría padre");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      switch (state.tipo) {
        case "nueva-categoria":
          await crearCategoria(negocioId, nombre.trim());
          break;
        case "editar-categoria":
          await renombrarCategoria(
            negocioId,
            state.categoria.categoriaId,
            nombre.trim(),
          );
          break;
        case "nueva-subcategoria":
          await crearSubcategoria(negocioId, nombre.trim(), categoriaId);
          break;
        case "editar-subcategoria":
          // Renombrar y, si cambió el padre, mover.
          if (nombre.trim() !== state.subcategoria.nombre) {
            await renombrarSubcategoria(
              negocioId,
              state.subcategoria.subcategoriaId,
              nombre.trim(),
            );
          }
          if (categoriaId !== state.subcategoria.categoriaId) {
            await moverSubcategoria(
              negocioId,
              state.subcategoria.subcategoriaId,
              categoriaId,
            );
          }
          break;
        case "nuevo-genero":
          await crearGenero(negocioId, nombre.trim());
          break;
        case "editar-genero":
          await renombrarGenero(negocioId, state.genero.generoId, nombre.trim());
          break;
      }
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
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
        <h2 className="text-lg font-semibold">{titulo}</h2>

        <div className="space-y-1.5">
          <Label htmlFor="nombre">Nombre</Label>
          <Input
            id="nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
            autoFocus
            placeholder={
              esGenero ? "Ej. Anime, K-pop, Películas" : "Ej. Camisas, Pantalones, Accesorios"
            }
          />
        </div>

        {requiereCategoriaPadre && (
          <div className="space-y-1.5">
            <Label htmlFor="cat-padre">Categoría padre</Label>
            <select
              id="cat-padre"
              value={categoriaId}
              onChange={(e) => setCategoriaId(e.target.value)}
              required
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
            >
              <option value="">— Selecciona —</option>
              {categorias.map((c) => (
                <option key={c.categoriaId} value={c.categoriaId}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={submitting}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Guardando…" : esNuevo ? "Crear" : "Guardar"}
          </Button>
        </div>
      </form>
    </div>
  );
}
