import { useEffect, useMemo, useState } from "react";
import { Loader2, X, Clock, UserCheck, UserMinus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNegocio } from "@/hooks/useNegocio";
import { useNodos } from "@/features/nodos/useNodos";
import { useAdminWhitelist } from "@/features/equipo-chat/useAdminWhitelist";
import { useColaboradores } from "@/features/equipo-chat/useColaboradores";
import {
  fnHabilitarColaboradorEnGrupo,
  fnQuitarColaboradorDeGrupo,
} from "@/firebase/callables";
import type { ChatMeta } from "@shared";

type Props = {
  /** nodoId del grupo. */
  nodoId: string;
  /** Snapshot del meta del chat (con miembros, colaboradoresHabilitados,
   *  estadoPorMiembro). El componente lo lee — los onSnapshot vienen del
   *  hook padre. */
  meta: ChatMeta | null;
  open: boolean;
  onClose: () => void;
};

/**
 * Panel del grupo de un nodo. Combina dos capacidades del spec
 * (doc 14):
 *   - **F6 — Telemetría**: muestra `estadoPorMiembro[uid].ultimaApertura`
 *     para cada miembro, en formato "hace X minutos".
 *   - **F4 — Habilitar colaboradores**: lista todos los colaboradores
 *     activos del negocio con checkbox; toggle invoca las CFs
 *     `habilitarColaboradorEnGrupo` / `quitarColaboradorDeGrupo`.
 *
 * Solo aplica a chats tipo `"grupo"`. Para directos no se monta.
 */
export function GrupoMiembrosPanel({ nodoId, meta, open, onClose }: Props) {
  const { negocioId } = useNegocio();
  const { nodos } = useNodos();
  const { items: whitelist } = useAdminWhitelist();
  const { items: colaboradores } = useColaboradores();
  const [toggleando, setToggleando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setError(null);
      setToggleando(null);
    }
  }, [open]);

  const nombreNodo = useMemo(
    () => nodos.find((n) => n.nodoId === nodoId)?.nombre ?? nodoId.slice(0, 12),
    [nodos, nodoId],
  );

  // Resuelve nombre legible para un memberId (uid admin, nodoId, colaboradorId).
  function resolverNombre(memberId: string): string {
    if (memberId === nodoId) return `${nombreNodo} (nodo)`;
    const admin = whitelist.find((w) => w.uid === memberId);
    if (admin) return admin.email;
    const col = colaboradores.find((c) => c.colaboradorId === memberId);
    if (col) return col.nombre || col.username;
    return memberId.slice(0, 12) + "…";
  }

  const habilitados = meta?.colaboradoresHabilitados ?? [];
  const miembrosUnique = Array.from(new Set(meta?.miembros ?? []));

  async function onToggle(colaboradorId: string, habilitar: boolean) {
    if (!negocioId || toggleando) return;
    setError(null);
    setToggleando(colaboradorId);
    try {
      if (habilitar) {
        await fnHabilitarColaboradorEnGrupo({ negocioId, nodoId, colaboradorId });
      } else {
        await fnQuitarColaboradorDeGrupo({ negocioId, nodoId, colaboradorId });
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setToggleando(null);
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
        className="flex max-h-[90vh] w-full max-w-md flex-col rounded-xl bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-2 border-b p-3">
          <h2 className="text-base font-semibold">Miembros del grupo</h2>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar">
            <X className="h-5 w-5" />
          </Button>
        </header>

        <div className="flex-1 overflow-y-auto p-3">
          {/* SECCIÓN 1 — telemetría F6 */}
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            En el grupo ({miembrosUnique.length})
          </h3>
          <ul className="space-y-1.5 pb-3">
            {miembrosUnique.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sin miembros aún.</p>
            ) : (
              miembrosUnique.map((mid) => {
                const estado = meta?.estadoPorMiembro?.[mid];
                return (
                  <li
                    key={mid}
                    className="flex items-center justify-between gap-2 rounded-md border bg-background px-3 py-2 text-sm"
                  >
                    <span className="min-w-0 truncate">
                      {resolverNombre(mid)}
                    </span>
                    <span className="flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {formatearUltimaApertura(estado?.ultimaApertura)}
                    </span>
                  </li>
                );
              })
            )}
          </ul>

          {/* SECCIÓN 2 — habilitar colaboradores F4 */}
          <h3 className="mb-2 mt-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Colaboradores del negocio
          </h3>
          {colaboradores.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No hay colaboradores creados. Ve a{" "}
              <a href="/equipo-chat" className="underline">
                Equipo chat
              </a>{" "}
              para añadir uno.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {colaboradores
                .filter((c) => c.habilitado)
                .map((c) => {
                  const enGrupo = habilitados.includes(c.colaboradorId);
                  const enToggle = toggleando === c.colaboradorId;
                  return (
                    <li
                      key={c.colaboradorId}
                      className="flex items-center justify-between gap-2 rounded-md border bg-background px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {c.nombre || c.username}
                        </p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          @{c.username}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant={enGrupo ? "destructive" : "outline"}
                        size="sm"
                        onClick={() => onToggle(c.colaboradorId, !enGrupo)}
                        disabled={enToggle || !negocioId}
                      >
                        {enToggle ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : enGrupo ? (
                          <>
                            <UserMinus className="mr-1 h-3 w-3" />
                            Quitar
                          </>
                        ) : (
                          <>
                            <UserCheck className="mr-1 h-3 w-3" />
                            Habilitar
                          </>
                        )}
                      </Button>
                    </li>
                  );
                })}
            </ul>
          )}
        </div>

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

function formatearUltimaApertura(iso: string | undefined): string {
  if (!iso) return "nunca";
  try {
    const t = new Date(iso).getTime();
    const ahora = Date.now();
    const diffMs = ahora - t;
    if (diffMs < 0) return "ahora";
    const mins = Math.round(diffMs / 60000);
    if (mins < 1) return "hace unos segundos";
    if (mins < 60) return `hace ${mins} min`;
    const horas = Math.round(mins / 60);
    if (horas < 24) return `hace ${horas} h`;
    const dias = Math.round(horas / 24);
    if (dias < 30) return `hace ${dias} d`;
    return new Intl.DateTimeFormat("es-MX", {
      day: "numeric",
      month: "short",
    }).format(new Date(iso));
  } catch {
    return "?";
  }
}
