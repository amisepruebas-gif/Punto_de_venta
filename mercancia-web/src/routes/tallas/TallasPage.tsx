import { useState, type FormEvent } from "react";
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
import { useTallas, type GrupoTallas } from "@/features/tallas/useTallas";
import {
  borrarGrupo,
  guardarGrupoTallas,
  renombrarGrupo,
} from "@/features/tallas/tallasService";
import { useNegocio } from "@/hooks/useNegocio";

type Modal =
  | { kind: "nuevo" }
  | { kind: "editar"; grupo: GrupoTallas }
  | null;

export function TallasPage() {
  const navigate = useNavigate();
  const { negocioId } = useNegocio();
  const { grupos, loading } = useTallas();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [modal, setModal] = useState<Modal>(null);

  function toggle(name: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  async function eliminar(g: GrupoTallas) {
    if (!negocioId) return;
    if (!confirm(`¿Eliminar el grupo "${g.nombre}"?`)) return;
    try {
      await borrarGrupo(negocioId, g.nombre);
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
        <h1 className="flex-1 text-base font-semibold">Tallas</h1>
        <Button size="sm" onClick={() => setModal({ kind: "nuevo" })}>
          <Plus className="mr-1 h-4 w-4" /> Nuevo
        </Button>
      </header>

      <main className="flex-1 px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
        {loading && grupos.length === 0 && (
          <p className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
          </p>
        )}
        {!loading && grupos.length === 0 && (
          <p className="rounded-md border bg-muted py-6 text-center text-sm text-muted-foreground">
            Sin grupos de tallas. Crea el primero.
          </p>
        )}
        {grupos.length > 0 && (
          <ul className="space-y-2">
            {grupos.map((g) => {
              const isOpen = expanded.has(g.nombre);
              return (
                <li key={g.nombre} className="rounded-md border bg-card">
                  <div className="flex items-center gap-1 px-2 py-2">
                    <button
                      type="button"
                      onClick={() => toggle(g.nombre)}
                      className="flex min-w-0 flex-1 items-center gap-2 px-1 text-left"
                      aria-expanded={isOpen}
                    >
                      <ChevronDown
                        className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
                          isOpen ? "" : "-rotate-90"
                        }`}
                      />
                      <span className="truncate text-sm font-medium">
                        {g.nombre}
                      </span>
                      <span className="shrink-0 text-[10px] text-muted-foreground">
                        {g.tallas.length}
                      </span>
                    </button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setModal({ kind: "editar", grupo: g })}
                      aria-label="Editar"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => eliminar(g)}
                      aria-label="Eliminar"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  {isOpen && (
                    <div className="border-t px-3 py-2">
                      {g.tallas.length === 0 ? (
                        <p className="text-xs italic text-muted-foreground">
                          Sin tallas
                        </p>
                      ) : (
                        <ul className="flex flex-wrap gap-1.5">
                          {g.tallas.map((t) => (
                            <li
                              key={t}
                              className="rounded-full bg-muted px-2 py-0.5 text-xs"
                            >
                              {t}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </main>

      {modal && negocioId && (
        <GrupoModal
          modal={modal}
          negocioId={negocioId}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

function GrupoModal({
  modal,
  negocioId,
  onClose,
}: {
  modal: Exclude<Modal, null>;
  negocioId: string;
  onClose: () => void;
}) {
  const editing = modal.kind === "editar";
  const [nombre, setNombre] = useState(editing ? modal.grupo.nombre : "");
  const [tallasTxt, setTallasTxt] = useState(
    editing ? modal.grupo.tallas.join(", ") : "",
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!nombre.trim()) {
      setError("El nombre es obligatorio");
      return;
    }
    const tallas = tallasTxt
      .split(/[,\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (tallas.length === 0) {
      setError("Agrega al menos una talla");
      return;
    }
    setSubmitting(true);
    try {
      if (editing && modal.grupo.nombre !== nombre.trim()) {
        await renombrarGrupo(
          negocioId,
          modal.grupo.nombre,
          nombre.trim(),
          tallas,
        );
      } else {
        await guardarGrupoTallas(negocioId, nombre.trim(), tallas);
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
          <h2 className="text-lg font-semibold">
            {editing ? "Editar grupo" : "Nuevo grupo"}
          </h2>
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
          <Label htmlFor="grp-nombre">Nombre del grupo *</Label>
          <Input
            id="grp-nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej. Camisetas, Zapatos"
            autoFocus
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="grp-tallas">Tallas (separadas por coma)</Label>
          <textarea
            id="grp-tallas"
            value={tallasTxt}
            onChange={(e) => setTallasTxt(e.target.value)}
            rows={3}
            placeholder="S, M, L, XL"
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <p className="text-[11px] text-muted-foreground">
            Coma o salto de línea separan tallas.
          </p>
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
