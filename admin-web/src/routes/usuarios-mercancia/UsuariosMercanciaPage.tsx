import { useEffect, useState, type FormEvent } from "react";
import {
  KeyRound,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  UserPlus,
  X as XIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSucursales } from "@/features/sucursales/useSucursales";
import { useNegocio } from "@/hooks/useNegocio";
import { useAuth } from "@/hooks/useAuth";
import {
  actualizarUsuarioMercancia,
  crearUsuarioMercancia,
  eliminarUsuarioMercancia,
  useUsuariosMercancia,
} from "@/features/usuarios-mercancia/usuariosMercanciaService";
import { isValidPin, type UsuarioMercancia } from "@shared";

export function UsuariosMercanciaPage() {
  const { negocioId } = useNegocio();
  const { user } = useAuth();
  const { sucursales, loading: loadingSuc } = useSucursales();
  const [sucursalId, setSucursalId] = useState<string>("");

  // Auto-elegir primera sucursal cuando cargan.
  useEffect(() => {
    if (!sucursalId && sucursales.length > 0) {
      setSucursalId(sucursales[0]!.sucursalId);
    }
  }, [sucursales, sucursalId]);

  const { usuarios, loading } = useUsuariosMercancia(
    negocioId ?? null,
    sucursalId || null,
  );

  const [editandoUid, setEditandoUid] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function abrirNuevo() {
    setEditandoUid(null);
    setFormOpen(true);
    setError(null);
  }

  function abrirEditar(u: UsuarioMercancia) {
    setEditandoUid(u.id);
    setFormOpen(true);
    setError(null);
  }

  function cerrarForm() {
    setFormOpen(false);
    setEditandoUid(null);
    setError(null);
  }

  async function toggle(u: UsuarioMercancia) {
    if (!negocioId || !sucursalId) return;
    try {
      await actualizarUsuarioMercancia(negocioId, sucursalId, {
        uid: u.id,
        habilitado: !u.habilitado,
      });
    } catch (e) {
      alert((e as Error).message);
    }
  }

  async function eliminar(u: UsuarioMercancia) {
    if (!negocioId || !sucursalId) return;
    if (
      !confirm(
        `¿Eliminar a "${u.nombre}"? Esta acción es definitiva — pierde acceso a mercancia-web.`,
      )
    )
      return;
    try {
      await eliminarUsuarioMercancia(negocioId, sucursalId, u.id);
    } catch (e) {
      alert((e as Error).message);
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-3 py-4 sm:px-6 sm:py-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold">Usuarios mercancía</h1>
          <p className="text-xs text-muted-foreground">
            Acceso por PIN de 5 dígitos a la app{" "}
            <code className="font-mono">mercancia-web</code> (CRUD móvil de
            artículos). PIN único por sucursal.
          </p>
        </div>
        <Button onClick={abrirNuevo} disabled={!sucursalId} className="shrink-0">
          <UserPlus className="mr-2 h-4 w-4" /> Nuevo
        </Button>
      </div>

      <section className="space-y-2 rounded-lg border bg-card p-4 sm:p-5">
        <Label htmlFor="sucursal-select">Sucursal</Label>
        <select
          id="sucursal-select"
          value={sucursalId}
          onChange={(e) => setSucursalId(e.target.value)}
          disabled={loadingSuc || sucursales.length === 0}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loadingSuc ? (
            <option>Cargando…</option>
          ) : sucursales.length === 0 ? (
            <option>No hay sucursales</option>
          ) : (
            sucursales.map((s) => (
              <option
                key={s.sucursalId}
                value={s.sucursalId}
              >
                {s.nombre}
              </option>
            ))
          )}
        </select>
      </section>

      <section className="space-y-3">
        {loading && (
          <p className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando usuarios…
          </p>
        )}
        {!loading && sucursalId && usuarios.length === 0 && (
          <p className="rounded-md border bg-muted p-4 text-center text-sm text-muted-foreground">
            Sin usuarios. Crea el primero.
          </p>
        )}
        {!loading && usuarios.length > 0 && (
          <ul className="space-y-2">
            {usuarios.map((u) => (
              <li
                key={u.id}
                className="flex items-center gap-3 rounded-md border bg-card p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{u.nombre}</p>
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <KeyRound className="h-3 w-3" /> PIN configurado
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => toggle(u)}
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${
                    u.habilitado
                      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {u.habilitado ? "habilitado" : "deshabilitado"}
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => abrirEditar(u)}
                  aria-label="Editar"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => eliminar(u)}
                  aria-label="Eliminar"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {formOpen && negocioId && sucursalId && (
        <UsuarioFormModal
          negocioId={negocioId}
          sucursalId={sucursalId}
          existente={
            editandoUid ? usuarios.find((u) => u.id === editandoUid) : undefined
          }
          creadoPor={user?.user.email ?? user?.user.uid}
          onClose={cerrarForm}
          error={error}
          setError={setError}
        />
      )}
    </div>
  );
}

function UsuarioFormModal({
  negocioId,
  sucursalId,
  existente,
  creadoPor,
  onClose,
  error,
  setError,
}: {
  negocioId: string;
  sucursalId: string;
  existente?: UsuarioMercancia;
  creadoPor?: string;
  onClose: () => void;
  error: string | null;
  setError: (e: string | null) => void;
}) {
  const editing = !!existente;
  const [nombre, setNombre] = useState(existente?.nombre ?? "");
  const [pin, setPin] = useState("");
  const [habilitado, setHabilitado] = useState(existente?.habilitado ?? true);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!nombre.trim()) {
      setError("El nombre es obligatorio");
      return;
    }
    if (!editing && !isValidPin(pin)) {
      setError("El PIN debe tener exactamente 5 dígitos");
      return;
    }
    if (editing && pin && !isValidPin(pin)) {
      setError("El PIN nuevo debe tener exactamente 5 dígitos");
      return;
    }
    setSubmitting(true);
    try {
      if (editing) {
        await actualizarUsuarioMercancia(negocioId, sucursalId, {
          uid: existente!.id,
          nombre,
          habilitado,
          ...(pin ? { pinNuevo: pin } : {}),
        });
      } else {
        await crearUsuarioMercancia(negocioId, sucursalId, {
          nombre,
          pin,
          habilitado,
          creadoPor,
        });
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
        className="w-full max-w-md space-y-4 rounded-t-xl bg-card p-5 shadow-lg sm:rounded-xl"
      >
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-lg font-semibold">
            {editing ? "Editar usuario" : "Nuevo usuario"}
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
          <Label htmlFor="um-nombre">Nombre *</Label>
          <Input
            id="um-nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej. Maria López"
            autoFocus
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="um-pin">
            PIN {editing ? "(dejar vacío para no cambiar)" : "*"}
          </Label>
          <Input
            id="um-pin"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            inputMode="numeric"
            maxLength={5}
            placeholder="5 dígitos"
            autoComplete="off"
          />
          <p className="text-[11px] text-muted-foreground">
            Único dentro de esta sucursal. No se guarda en plano (hash SHA-256).
          </p>
        </div>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={habilitado}
            onChange={(e) => setHabilitado(e.target.checked)}
          />
          <span className="text-sm">Habilitado (puede iniciar sesión)</span>
        </label>

        {error && (
          <p
            role="alert"
            className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-sm text-destructive"
          >
            {error}
          </p>
        )}

        <div className="flex gap-2 pt-2">
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
            {editing ? "Guardar" : "Crear"}
          </Button>
        </div>
      </form>
    </div>
  );
}
