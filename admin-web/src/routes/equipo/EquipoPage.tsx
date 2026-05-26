import { useEffect, useRef, useState } from "react";
import { Plus, Trash2, Shield, ShieldOff } from "lucide-react";
import { useNegocio } from "@/hooks/useNegocio";
import { useEquipo } from "@/features/equipo/useEquipo";
import {
  agregarAEquipo,
  actualizarEnEquipo,
  setAdminFlag,
  quitarDeEquipo,
} from "@/features/equipo/equipoService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function EquipoPage() {
  const { negocioId } = useNegocio();
  const { equipo, loading } = useEquipo();
  const [nuevo, setNuevo] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onAgregar(e: React.FormEvent) {
    e.preventDefault();
    if (!negocioId || !nuevo.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await agregarAEquipo(negocioId, { nombre: nuevo.trim(), estado: "activo" });
      setNuevo("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function onEditarNombre(idUsuario: string, nombre: string) {
    if (!negocioId || !nombre.trim()) return;
    try {
      await actualizarEnEquipo(negocioId, idUsuario, { nombre: nombre.trim() });
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function onToggleAdmin(idUsuario: string, esAdmin: boolean) {
    if (!negocioId) return;
    try {
      // FIX E1: usar setAdminFlag que maneja deleteField correctamente
      await setAdminFlag(negocioId, idUsuario, esAdmin);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function onQuitar(idUsuario: string, nombre: string) {
    if (!negocioId) return;
    if (!confirm(`¿Quitar a "${nombre}" del equipo?`)) return;
    try {
      await quitarDeEquipo(negocioId, idUsuario);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="container max-w-3xl space-y-4 py-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Equipo de trabajo</h1>
        <p className="text-sm text-muted-foreground">
          Vendedores que aparecen como opción "enTurno" al cobrar en los nodos
        </p>
      </div>

      <form onSubmit={onAgregar} className="flex gap-2">
        <Input
          value={nuevo}
          onChange={(e) => setNuevo(e.target.value)}
          placeholder="Nombre del vendedor"
        />
        <Button type="submit" disabled={saving || !nuevo.trim()}>
          <Plus className="mr-1 h-4 w-4" /> Agregar
        </Button>
      </form>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {loading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Cargando…
        </p>
      ) : equipo.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Sin miembros en el equipo
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card">
          <ul className="divide-y">
            {equipo.map((e) => {
              const esAdmin = e.admin !== undefined;
              return (
                <li key={e.idUsuario} className="flex items-center gap-2 p-3">
                  <EditableNombre
                    inicial={e.nombre}
                    onCommit={(nombre) => onEditarNombre(e.idUsuario, nombre)}
                  />
                  <Button
                    size="sm"
                    variant={esAdmin ? "default" : "outline"}
                    onClick={() => onToggleAdmin(e.idUsuario, !esAdmin)}
                  >
                    {esAdmin ? (
                      <Shield className="mr-1 h-3 w-3" />
                    ) : (
                      <ShieldOff className="mr-1 h-3 w-3" />
                    )}
                    {esAdmin ? "Admin" : "Vendedor"}
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => onQuitar(e.idUsuario, e.nombre)}
                    aria-label="Quitar"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function EditableNombre({
  inicial,
  onCommit,
}: {
  inicial: string;
  onCommit: (nombre: string) => void;
}) {
  const [val, setVal] = useState(inicial);
  const ref = useRef<HTMLInputElement>(null);

  // FIX F1: si inicial cambia externamente (otro admin editó) y este input
  // no tiene focus, sync el valor. Si tiene focus, respetamos lo que el
  // usuario está escribiendo.
  useEffect(() => {
    if (document.activeElement !== ref.current) {
      setVal(inicial);
    }
  }, [inicial]);

  function commit() {
    const clean = val.trim();
    if (clean && clean !== inicial) onCommit(clean);
  }

  return (
    <input
      ref={ref}
      value={val}
      onChange={(e) => setVal(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          (e.target as HTMLInputElement).blur();
        }
      }}
      className="flex-1 bg-transparent px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring rounded"
    />
  );
}
