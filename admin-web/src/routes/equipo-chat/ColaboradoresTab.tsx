import { useState } from "react";
import { Plus, Pencil, Trash2, Power, KeyRound, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useColaboradores } from "@/features/equipo-chat/useColaboradores";
import {
  crearColaborador,
  actualizarColaborador,
  eliminarColaborador,
  generarPasswordAleatorio,
} from "@/features/equipo-chat/colaboradorService";
import { PASSWORD_MIN_LENGTH, type Colaborador } from "@shared";

export function ColaboradoresTab({ negocioId }: { negocioId: string }) {
  const { items, loading } = useColaboradores();
  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState<Colaborador | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onToggle(c: Colaborador) {
    try {
      await actualizarColaborador({
        negocioId,
        colaboradorId: c.colaboradorId,
        habilitado: !c.habilitado,
      });
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function onEliminar(c: Colaborador) {
    if (
      !confirm(
        `¿Eliminar ${c.nombre || c.username}?\n\n` +
          `Se borra el registro definitivamente, se quita de todos los ` +
          `grupos y se invalida el acceso. Esta acción no se puede deshacer.\n\n` +
          `(Si solo quieres pausarlo temporalmente, usa "Pausar" en su lugar.)`,
      )
    )
      return;
    try {
      await eliminarColaborador({
        negocioId,
        colaboradorId: c.colaboradorId,
      });
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {items.length}{" "}
          {items.length === 1 ? "colaborador" : "colaboradores"}
        </p>
        <Button
          onClick={() => {
            setEditando(null);
            setModalOpen(true);
          }}
        >
          <Plus className="mr-1 h-4 w-4" /> Nuevo colaborador
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Cargando…
        </p>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Sin colaboradores todavía.
        </div>
      ) : (
        <ul className="divide-y rounded-lg border bg-card">
          {items.map((c) => (
            <li
              key={c.colaboradorId}
              className="flex flex-wrap items-center gap-2 px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{c.nombre || c.username}</p>
                <p className="truncate text-xs text-muted-foreground">
                  <KeyRound className="mr-1 inline h-3 w-3" />
                  {c.username}
                </p>
              </div>
              {c.habilitado ? (
                <span className="rounded-full bg-emerald-600/10 px-2 py-0.5 text-xs text-emerald-700">
                  Habilitado
                </span>
              ) : (
                <span className="rounded-full bg-zinc-300/40 px-2 py-0.5 text-xs text-zinc-600">
                  Deshabilitado
                </span>
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setEditando(c);
                  setModalOpen(true);
                }}
              >
                <Pencil className="mr-1 h-3 w-3" /> Editar
              </Button>
              <Button size="sm" variant="ghost" onClick={() => onToggle(c)}>
                <Power className="mr-1 h-3 w-3" />
                {c.habilitado ? "Pausar" : "Reactivar"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => onEliminar(c)}>
                <Trash2 className="mr-1 h-3 w-3" /> Eliminar
              </Button>
            </li>
          ))}
        </ul>
      )}

      {modalOpen && (
        <ColaboradorFormModal
          negocioId={negocioId}
          editando={editando}
          onClose={() => {
            setModalOpen(false);
            setEditando(null);
          }}
        />
      )}
    </section>
  );
}

function ColaboradorFormModal({
  negocioId,
  editando,
  onClose,
}: {
  negocioId: string;
  editando: Colaborador | null;
  onClose: () => void;
}) {
  const [username, setUsername] = useState(editando?.username ?? "");
  const [nombre, setNombre] = useState(editando?.nombre ?? "");
  const [password, setPassword] = useState(() =>
    editando ? "" : generarPasswordAleatorio(),
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [credencialesCreadas, setCredencialesCreadas] = useState<{
    username: string;
    password: string;
  } | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      if (editando) {
        await actualizarColaborador({
          negocioId,
          colaboradorId: editando.colaboradorId,
          nombre: nombre.trim() || undefined,
          nuevoPassword: password.length > 0 ? password : undefined,
        });
        onClose();
      } else {
        const limpio = username.trim().toLowerCase();
        if (!limpio || /\s/.test(limpio)) {
          throw new Error("Username sin espacios y obligatorio");
        }
        if (password.length < PASSWORD_MIN_LENGTH) {
          throw new Error(`Password mínimo ${PASSWORD_MIN_LENGTH} chars`);
        }
        await crearColaborador({
          negocioId,
          username: limpio,
          password,
          nombre: nombre.trim() || undefined,
        });
        // Mostramos las credenciales finales antes de cerrar — el admin
        // las anota o las copia para entregárselas al colaborador.
        setCredencialesCreadas({ username: limpio, password });
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  function copiar(texto: string) {
    navigator.clipboard?.writeText(texto).catch(() => {});
  }

  if (credencialesCreadas) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
        onClick={onClose}
      >
        <div
          className="w-full max-w-md space-y-4 rounded-lg bg-card p-5 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 className="text-lg font-semibold">
            Colaborador creado · entrega estos datos
          </h2>
          <p className="text-xs text-muted-foreground">
            El password no se vuelve a mostrar. Copia o anota antes de cerrar.
          </p>
          <CredencialFila
            label="Usuario"
            valor={credencialesCreadas.username}
            onCopiar={() => copiar(credencialesCreadas.username)}
          />
          <CredencialFila
            label="Password"
            valor={credencialesCreadas.password}
            onCopiar={() => copiar(credencialesCreadas.password)}
          />
          <div className="flex justify-end pt-2">
            <Button onClick={onClose}>Cerrar</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <form
        onSubmit={onSubmit}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-md space-y-4 overflow-y-auto rounded-lg bg-card p-5 shadow-lg"
      >
        <h2 className="text-lg font-semibold">
          {editando ? "Editar colaborador" : "Nuevo colaborador"}
        </h2>

        {!editando && (
          <div className="space-y-1.5">
            <Label htmlFor="col-username">Usuario</Label>
            <Input
              id="col-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="ej. juan"
              autoComplete="off"
              required
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Sin espacios. Es lo que el colaborador escribirá para entrar.
            </p>
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="col-nombre">Nombre visible</Label>
          <Input
            id="col-nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Cómo aparece en el chat"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="col-password">
            {editando ? "Nuevo password (vacío = no cambiar)" : "Password"}
          </Label>
          <div className="flex gap-2">
            <Input
              id="col-password"
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="off"
              minLength={editando ? undefined : PASSWORD_MIN_LENGTH}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => setPassword(generarPasswordAleatorio())}
            >
              Aleatorio
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Mínimo {PASSWORD_MIN_LENGTH} caracteres.
          </p>
        </div>

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

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
            {submitting ? "Guardando…" : editando ? "Guardar" : "Crear"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function CredencialFila({
  label,
  valor,
  onCopiar,
}: {
  label: string;
  valor: string;
  onCopiar: () => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded-md border bg-muted/30 p-3">
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="break-all font-mono text-sm">{valor}</p>
      </div>
      <Button size="sm" variant="outline" type="button" onClick={onCopiar}>
        <Copy className="mr-1 h-3 w-3" /> Copiar
      </Button>
    </div>
  );
}
