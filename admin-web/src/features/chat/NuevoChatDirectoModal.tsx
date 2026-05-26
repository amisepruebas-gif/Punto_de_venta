import { useEffect, useMemo, useState } from "react";
import { Loader2, MessageSquare, Search, User, UserCog, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNegocio } from "@/hooks/useNegocio";
import { useAuth } from "@/hooks/useAuth";
import { useAdminWhitelist } from "@/features/equipo-chat/useAdminWhitelist";
import { useColaboradores } from "@/features/equipo-chat/useColaboradores";
import { asegurarChatDirecto } from "./chatAdminService";

type Target = {
  /** uid (admin) o colaboradorId. */
  id: string;
  nombre: string;
  email?: string;
  tipo: "admin" | "colaborador";
};

type Props = {
  open: boolean;
  onClose: () => void;
  /** Llamado cuando se crea (o ya existía) el chat directo. El padre debe
   *  seleccionar ese chat. */
  onCreado: (pairId: string) => void;
};

/**
 * Modal para iniciar un chat directo 1-a-1. Lista:
 *   - admin-delegados de la whitelist (solo los que ya tienen `uid`
 *     resuelto — sin uid no se puede chatear).
 *   - colaboradores habilitados del negocio.
 * Excluye al propio admin. Click → `asegurarChatDirecto` → onCreado.
 *
 * Replica el spec del doc 14: chats 1-a-1 permitidos entre admin-real,
 * admin-delegado y colaborador. Nodos NO participan en directos.
 */
export function NuevoChatDirectoModal({ open, onClose, onCreado }: Props) {
  const { negocioId } = useNegocio();
  const auth = useAuth();
  const uid = auth.user?.user.uid ?? null;
  const nombreMio =
    auth.user?.user.displayName ??
    auth.user?.user.email ??
    "Admin";
  const { items: whitelist } = useAdminWhitelist();
  const { items: colaboradores } = useColaboradores();
  const [q, setQ] = useState("");
  const [creando, setCreando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setQ("");
      setError(null);
      setCreando(null);
    }
  }, [open]);

  const targets: Target[] = useMemo(() => {
    const arr: Target[] = [];
    for (const w of whitelist) {
      // Sólo admins-delegados con uid resuelto (ya hicieron primer login).
      if (!w.habilitado || !w.uid || w.uid === uid) continue;
      arr.push({ id: w.uid, nombre: w.email, email: w.email, tipo: "admin" });
    }
    for (const c of colaboradores) {
      if (!c.habilitado) continue;
      arr.push({
        id: c.colaboradorId,
        nombre: c.nombre || c.username,
        tipo: "colaborador",
      });
    }
    // Filtro por búsqueda.
    const s = q.trim().toLowerCase();
    if (!s) return arr;
    return arr.filter((t) =>
      `${t.nombre} ${t.email ?? ""}`.toLowerCase().includes(s),
    );
  }, [whitelist, colaboradores, uid, q]);

  async function onElegir(t: Target) {
    if (!negocioId || !uid || creando) return;
    setError(null);
    setCreando(t.id);
    try {
      const pairId = await asegurarChatDirecto({
        negocioId,
        uidA: uid,
        uidB: t.id,
        nombreA: nombreMio,
        nombreB: t.nombre,
      });
      onCreado(pairId);
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCreando(null);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3"
      onClick={onClose}
      role="dialog"
      aria-modal
    >
      <div
        className="flex max-h-[80vh] w-full max-w-md flex-col rounded-xl bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-2 border-b p-3">
          <h2 className="text-base font-semibold">Nuevo chat directo</h2>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar">
            <X className="h-5 w-5" />
          </Button>
        </header>

        <div className="border-b p-3">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nombre o email…"
              className="pl-8"
            />
          </div>
        </div>

        <ul className="flex-1 divide-y overflow-y-auto">
          {targets.length === 0 ? (
            <li className="px-3 py-6 text-center text-sm text-muted-foreground">
              {q.trim() ? "Sin resultados" : "No hay personas disponibles"}
            </li>
          ) : (
            targets.map((t) => {
              const enToggle = creando === t.id;
              return (
                <li key={`${t.tipo}__${t.id}`}>
                  <button
                    type="button"
                    onClick={() => onElegir(t)}
                    disabled={enToggle || !uid}
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-accent disabled:opacity-50"
                  >
                    {t.tipo === "admin" ? (
                      <UserCog className="h-5 w-5 shrink-0 text-blue-600" />
                    ) : (
                      <User className="h-5 w-5 shrink-0 text-emerald-600" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{t.nombre}</p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {t.tipo === "admin" ? "Admin delegado" : "Colaborador"}
                      </p>
                    </div>
                    {enToggle ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                </li>
              );
            })
          )}
        </ul>

        {error && (
          <p
            role="alert"
            className="border-t border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
          >
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
