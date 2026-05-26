import { useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronDown,
  ChevronLeft,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  X as XIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCategorias } from "@/features/categorias/useCategorias";
import { useNegocio } from "@/hooks/useNegocio";
import {
  borrarCategoria,
  borrarSubcategoria,
  crearCategoria,
  crearSubcategoria,
  renombrarCategoria,
  renombrarSubcategoria,
} from "@/features/categorias/categoriaService";
import type { Categoria, Subcategoria } from "@shared";

type Modal =
  | { kind: "nuevaCat" }
  | { kind: "editCat"; cat: Categoria }
  | { kind: "nuevaSub"; categoriaId: string }
  | { kind: "editSub"; sub: Subcategoria }
  | null;

export function CategoriasPage() {
  const navigate = useNavigate();
  const { negocioId } = useNegocio();
  const { categorias, subcategorias, loading } = useCategorias();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [modal, setModal] = useState<Modal>(null);

  const subsPorCat = useMemo(() => {
    const m = new Map<string, Subcategoria[]>();
    for (const s of subcategorias) {
      const arr = m.get(s.categoriaId) ?? [];
      arr.push(s);
      m.set(s.categoriaId, arr);
    }
    return m;
  }, [subcategorias]);

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function eliminarCat(c: Categoria) {
    if (!negocioId) return;
    const subs = subsPorCat.get(c.categoriaId) ?? [];
    const msg = subs.length
      ? `¿Eliminar "${c.nombre}"? Sus ${subs.length} subcategoría(s) quedan huérfanas.`
      : `¿Eliminar "${c.nombre}"?`;
    if (!confirm(msg)) return;
    try {
      await borrarCategoria(negocioId, c.categoriaId);
    } catch (e) {
      alert((e as Error).message);
    }
  }

  async function eliminarSub(s: Subcategoria) {
    if (!negocioId) return;
    if (!confirm(`¿Eliminar la subcategoría "${s.nombre}"?`)) return;
    try {
      await borrarSubcategoria(negocioId, s.subcategoriaId);
    } catch (e) {
      alert((e as Error).message);
    }
  }

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
        <h1 className="flex-1 text-base font-semibold">Categorías</h1>
        <Button size="sm" onClick={() => setModal({ kind: "nuevaCat" })}>
          <Plus className="mr-1 h-4 w-4" /> Nueva
        </Button>
      </header>

      <main className="flex-1 px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
        {loading && categorias.length === 0 && (
          <p className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
          </p>
        )}
        {!loading && categorias.length === 0 && (
          <p className="rounded-md border bg-muted py-6 text-center text-sm text-muted-foreground">
            Sin categorías. Crea la primera.
          </p>
        )}
        {categorias.length > 0 && (
          <ul className="space-y-2">
            {categorias.map((c) => {
              const subs = subsPorCat.get(c.categoriaId) ?? [];
              const isOpen = expanded.has(c.categoriaId);
              return (
                <li
                  key={c.categoriaId}
                  className="rounded-md border bg-card"
                >
                  <div className="flex items-center gap-1 px-2 py-2">
                    <button
                      type="button"
                      onClick={() => toggle(c.categoriaId)}
                      className="flex min-w-0 flex-1 items-center gap-2 px-1 text-left"
                      aria-expanded={isOpen}
                    >
                      <ChevronDown
                        className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
                          isOpen ? "" : "-rotate-90"
                        }`}
                      />
                      <span className="truncate text-sm font-medium">
                        {c.nombre}
                      </span>
                      <span className="shrink-0 text-[10px] text-muted-foreground">
                        {subs.length}
                      </span>
                    </button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setModal({ kind: "editCat", cat: c })}
                      aria-label="Renombrar"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => eliminarCat(c)}
                      aria-label="Eliminar"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  {isOpen && (
                    <div className="space-y-1.5 border-t px-3 py-2">
                      {subs.length === 0 ? (
                        <p className="text-xs italic text-muted-foreground">
                          Sin subcategorías
                        </p>
                      ) : (
                        <ul className="space-y-1">
                          {subs.map((s) => (
                            <li
                              key={s.subcategoriaId}
                              className="flex items-center gap-1 rounded-md bg-muted/50 px-2 py-1.5"
                            >
                              <span className="min-w-0 flex-1 truncate text-sm">
                                {s.nombre}
                              </span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() =>
                                  setModal({ kind: "editSub", sub: s })
                                }
                                aria-label="Renombrar"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive hover:text-destructive"
                                onClick={() => eliminarSub(s)}
                                aria-label="Eliminar"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </li>
                          ))}
                        </ul>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() =>
                          setModal({
                            kind: "nuevaSub",
                            categoriaId: c.categoriaId,
                          })
                        }
                      >
                        <Plus className="mr-1 h-3.5 w-3.5" /> Subcategoría
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </main>

      {modal && negocioId && (
        <CategoriaModal
          modal={modal}
          negocioId={negocioId}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

function CategoriaModal({
  modal,
  negocioId,
  onClose,
}: {
  modal: Exclude<Modal, null>;
  negocioId: string;
  onClose: () => void;
}) {
  const initialNombre =
    modal.kind === "editCat"
      ? modal.cat.nombre
      : modal.kind === "editSub"
        ? modal.sub.nombre
        : "";
  const [nombre, setNombre] = useState(initialNombre);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const titulo =
    modal.kind === "nuevaCat"
      ? "Nueva categoría"
      : modal.kind === "editCat"
        ? "Renombrar categoría"
        : modal.kind === "nuevaSub"
          ? "Nueva subcategoría"
          : "Renombrar subcategoría";

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!nombre.trim()) {
      setError("El nombre es obligatorio");
      return;
    }
    setSubmitting(true);
    try {
      if (modal.kind === "nuevaCat") {
        await crearCategoria(negocioId, nombre);
      } else if (modal.kind === "editCat") {
        await renombrarCategoria(negocioId, modal.cat.categoriaId, nombre);
      } else if (modal.kind === "nuevaSub") {
        await crearSubcategoria(negocioId, nombre, modal.categoriaId);
      } else if (modal.kind === "editSub") {
        await renombrarSubcategoria(
          negocioId,
          modal.sub.subcategoriaId,
          nombre,
        );
      }
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal
    >
      <form
        onSubmit={onSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md space-y-4 rounded-t-xl bg-card p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-lg sm:rounded-xl sm:pb-5"
      >
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-lg font-semibold">{titulo}</h2>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onClose}
            aria-label="Cerrar"
          >
            <XIcon className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-2">
          <Label htmlFor="cat-nombre">Nombre *</Label>
          <Input
            id="cat-nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej. Camisetas, Pantalones"
            autoFocus
            required
          />
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-sm text-destructive"
          >
            {error}
          </p>
        )}

        <div className="flex gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={onClose}
            disabled={submitting}
          >
            Cancelar
          </Button>
          <Button type="submit" className="flex-1" disabled={submitting}>
            {submitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="mr-2 h-4 w-4" />
            )}
            Guardar
          </Button>
        </div>
      </form>
    </div>
  );
}
