import { useEffect, useRef, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { useNegocio } from "@/hooks/useNegocio";
import { useTallas, type GrupoTallas } from "@/features/tallas/useTallas";
import {
  guardarGrupoTallas,
  renombrarGrupo,
  borrarGrupo,
} from "@/features/tallas/tallasService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function TallasPage() {
  const { negocioId } = useNegocio();
  const { grupos, loading } = useTallas();
  const [nombreNuevo, setNombreNuevo] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onCrearGrupo(e: React.FormEvent) {
    e.preventDefault();
    if (!negocioId || !nombreNuevo.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await guardarGrupoTallas(negocioId, nombreNuevo.trim(), []);
      setNombreNuevo("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="container max-w-3xl space-y-4 py-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Tallas</h1>
        <p className="text-sm text-muted-foreground">
          Grupos de tallas reutilizables por los artículos
        </p>
      </div>

      <form onSubmit={onCrearGrupo} className="flex gap-2">
        <Input
          value={nombreNuevo}
          onChange={(e) => setNombreNuevo(e.target.value)}
          placeholder="Nombre del grupo (ej. Camisetas, Zapatos)"
        />
        <Button type="submit" disabled={saving || !nombreNuevo.trim()}>
          <Plus className="mr-1 h-4 w-4" /> Crear grupo
        </Button>
      </form>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {loading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Cargando…
        </p>
      ) : grupos.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Sin grupos de tallas todavía
        </p>
      ) : (
        <div className="space-y-3">
          {grupos.map((g) => (
            <GrupoEditor key={g.nombre} negocioId={negocioId ?? ""} grupo={g} />
          ))}
        </div>
      )}
    </div>
  );
}

function GrupoEditor({
  negocioId,
  grupo,
}: {
  negocioId: string;
  grupo: GrupoTallas;
}) {
  const [nombre, setNombre] = useState(grupo.nombre);
  const [nuevaTalla, setNuevaTalla] = useState("");
  const [saving, setSaving] = useState(false);
  const nombreRef = useRef<HTMLInputElement>(null);

  // FIX F1: sync nombre cuando cambia remotamente y el input no tiene focus
  useEffect(() => {
    if (document.activeElement !== nombreRef.current) {
      setNombre(grupo.nombre);
    }
  }, [grupo.nombre]);

  async function onCommitNombre() {
    const clean = nombre.trim();
    if (!clean || clean === grupo.nombre) {
      setNombre(grupo.nombre);
      return;
    }
    setSaving(true);
    try {
      await renombrarGrupo(negocioId, grupo.nombre, clean, grupo.tallas);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  async function onAgregarTalla() {
    const t = nuevaTalla.trim();
    if (!t) return;
    if (grupo.tallas.includes(t)) {
      setNuevaTalla("");
      return;
    }
    setSaving(true);
    try {
      await guardarGrupoTallas(negocioId, grupo.nombre, [...grupo.tallas, t]);
      setNuevaTalla("");
    } finally {
      setSaving(false);
    }
  }

  async function onQuitarTalla(t: string) {
    setSaving(true);
    try {
      await guardarGrupoTallas(
        negocioId,
        grupo.nombre,
        grupo.tallas.filter((x) => x !== t),
      );
    } finally {
      setSaving(false);
    }
  }

  async function onBorrarGrupo() {
    if (!confirm(`¿Borrar grupo "${grupo.nombre}"?`)) return;
    await borrarGrupo(negocioId, grupo.nombre);
  }

  return (
    <div className="space-y-3 rounded-lg border bg-card p-4">
      <div className="flex items-center gap-2">
        <input
          ref={nombreRef}
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          onBlur={onCommitNombre}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              (e.target as HTMLInputElement).blur();
            }
          }}
          className="flex-1 bg-transparent text-base font-semibold focus:outline-none focus:ring-1 focus:ring-ring rounded px-2"
        />
        <Button
          variant="ghost"
          size="icon"
          className="text-destructive hover:text-destructive"
          onClick={onBorrarGrupo}
          aria-label="Borrar grupo"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex flex-wrap gap-1">
        {grupo.tallas.map((t) => (
          <span
            key={t}
            className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs"
          >
            {t}
            <button
              onClick={() => onQuitarTalla(t)}
              className="hover:text-destructive"
              aria-label={`Quitar ${t}`}
              disabled={saving}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        {grupo.tallas.length === 0 && (
          <span className="text-xs text-muted-foreground">Sin tallas</span>
        )}
      </div>
      <div className="flex gap-2">
        <Input
          value={nuevaTalla}
          onChange={(e) => setNuevaTalla(e.target.value)}
          placeholder="Nueva talla (ej. M, 28, XXL)"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void onAgregarTalla();
            }
          }}
          className="max-w-xs"
        />
        <Button
          type="button"
          variant="outline"
          onClick={onAgregarTalla}
          disabled={saving || !nuevaTalla.trim()}
        >
          Agregar
        </Button>
      </div>
    </div>
  );
}
