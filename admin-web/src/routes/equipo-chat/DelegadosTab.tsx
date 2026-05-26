import { useState } from "react";
import { Plus, Trash2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAdminWhitelist } from "@/features/equipo-chat/useAdminWhitelist";
import {
  agregarAdminWhitelist,
  quitarAdminWhitelist,
} from "@/features/equipo-chat/adminWhitelistService";

export function DelegadosTab({ negocioId }: { negocioId: string }) {
  const { items, loading } = useAdminWhitelist();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onAgregar(e: React.FormEvent) {
    e.preventDefault();
    const limpio = email.trim().toLowerCase();
    if (!limpio.includes("@")) {
      setError("Email inválido");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await agregarAdminWhitelist(negocioId, limpio);
      setEmail("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function onQuitar(emailAddr: string) {
    if (!confirm(`¿Deshabilitar ${emailAddr}?\n\nSus claims se revocan.`))
      return;
    try {
      await quitarAdminWhitelist(negocioId, emailAddr);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function onReactivar(emailAddr: string) {
    try {
      await agregarAdminWhitelist(negocioId, emailAddr);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <section className="space-y-4">
      <form
        onSubmit={onAgregar}
        className="flex flex-col gap-2 rounded-lg border bg-card p-4 sm:flex-row"
      >
        <div className="flex-1 space-y-1.5">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@dominio.com"
            inputMode="email"
            autoComplete="off"
            required
          />
          <p className="text-xs text-muted-foreground">
            El email debe corresponder a una cuenta Google. La persona entra
            con Google sign-in y queda elevada a admin del negocio.
          </p>
        </div>
        <Button type="submit" disabled={submitting} className="sm:self-start">
          <Plus className="mr-1 h-4 w-4" />
          {submitting ? "Agregando…" : "Agregar"}
        </Button>
      </form>

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
          Sin delegados todavía.
        </div>
      ) : (
        <ul className="divide-y rounded-lg border bg-card">
          {items.map((it) => (
            <li
              key={it.id}
              className="flex flex-wrap items-center gap-2 px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{it.email}</p>
                <p className="text-xs text-muted-foreground">
                  {it.uid
                    ? "Ya inició sesión · uid registrado"
                    : "Pendiente de primer login"}
                </p>
              </div>
              {it.habilitado ? (
                <>
                  <span className="rounded-full bg-emerald-600/10 px-2 py-0.5 text-xs text-emerald-700">
                    Habilitado
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onQuitar(it.email)}
                  >
                    <Trash2 className="mr-1 h-3 w-3" /> Deshabilitar
                  </Button>
                </>
              ) : (
                <>
                  <span className="rounded-full bg-zinc-300/40 px-2 py-0.5 text-xs text-zinc-600">
                    Deshabilitado
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onReactivar(it.email)}
                  >
                    <RotateCcw className="mr-1 h-3 w-3" /> Reactivar
                  </Button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
