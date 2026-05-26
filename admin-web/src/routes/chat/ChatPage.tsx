import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  BellOff,
  MessageCircle,
  Plus,
  Smartphone,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useChatList, type ChatListItem } from "@/features/chat/useChatList";
import { ChatView } from "@/features/chat/ChatView";
import { NuevoChatDirectoModal } from "@/features/chat/NuevoChatDirectoModal";
import {
  leerPermisoNotificacion,
  pedirPermisoNotificacion,
  type EstadoPermisoNotificacion,
} from "@/features/chat/useChatNotifications";
import { useNodos } from "@/features/nodos/useNodos";
import { useAdminWhitelist } from "@/features/equipo-chat/useAdminWhitelist";
import { useColaboradores } from "@/features/equipo-chat/useColaboradores";
import type { ChatTipo } from "@shared";

type ChatSeleccionado = {
  chatId: string;
  tipo: ChatTipo;
};

/**
 * Página principal de chats del admin. Split-pane: sidebar con lista de
 * grupos (uno por nodo) + chats directos a la izquierda, ChatView a la
 * derecha. Sin selección, la derecha muestra placeholder.
 *
 * Mobile/narrow: se podría stackear (lista → tap → fullscreen view) pero
 * en v1 dejo el split puro porque admin-web es desktop-first.
 */
export function ChatPage() {
  const { grupos, directos, loading, uid } = useChatList();
  const { nodos } = useNodos();
  const { items: whitelist } = useAdminWhitelist();
  const { items: colaboradores } = useColaboradores();

  const [seleccionado, setSeleccionado] = useState<ChatSeleccionado | null>(
    null,
  );
  const [nuevoDirectoOpen, setNuevoDirectoOpen] = useState(false);
  const [permisoNotif, setPermisoNotif] = useState<EstadoPermisoNotificacion>(
    leerPermisoNotificacion(),
  );

  useEffect(() => {
    // Re-leer el permiso si el user lo cambia desde la barra del navegador
    // (no hay evento estándar; revalidamos al recobrar foco en la ventana).
    function actualizar() {
      setPermisoNotif(leerPermisoNotificacion());
    }
    window.addEventListener("focus", actualizar);
    return () => window.removeEventListener("focus", actualizar);
  }, []);

  async function onPedirPermiso() {
    const r = await pedirPermisoNotificacion();
    setPermisoNotif(r);
  }

  // Mapeos rápidos para resolver nombres a partir de IDs.
  const nodosById = useMemo(() => {
    const m = new Map<string, string>();
    for (const n of nodos) m.set(n.nodoId, n.nombre);
    return m;
  }, [nodos]);

  const adminsByUid = useMemo(() => {
    const m = new Map<string, string>();
    for (const w of whitelist) {
      if (w.uid) m.set(w.uid, w.email);
    }
    return m;
  }, [whitelist]);

  const colaboradoresById = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of colaboradores) m.set(c.colaboradorId, c.nombre || c.username);
    return m;
  }, [colaboradores]);

  function tituloPara(chat: ChatListItem): { titulo: string; subtitulo: string } {
    if (chat.tipo === "grupo" && chat.nodoId) {
      const nombre = nodosById.get(chat.nodoId) ?? chat.nodoId.slice(0, 12);
      const habilitados = chat.colaboradoresHabilitados?.length ?? 0;
      const sub = `Grupo del nodo${
        habilitados > 0 ? ` · ${habilitados} colaborador${habilitados === 1 ? "" : "es"}` : ""
      }`;
      return { titulo: nombre, subtitulo: sub };
    }
    // Directo: el otro miembro = el que NO soy yo.
    const otro = chat.miembros?.find((m) => m !== uid) ?? "";
    const otroNombre =
      adminsByUid.get(otro) ?? colaboradoresById.get(otro) ?? otro.slice(0, 12);
    return { titulo: otroNombre, subtitulo: "Chat directo" };
  }

  function elegir(item: ChatListItem) {
    setSeleccionado({ chatId: item.docId, tipo: item.tipo });
  }

  const datos = seleccionado
    ? [...grupos, ...directos].find(
        (c) => c.docId === seleccionado.chatId && c.tipo === seleccionado.tipo,
      )
    : null;
  const titulo = datos ? tituloPara(datos) : null;

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="flex w-full shrink-0 flex-col border-b bg-card md:w-80 md:border-b-0 md:border-r">
        <div className="flex items-start justify-between gap-2 border-b px-4 py-3">
          <div className="min-w-0">
            <h1 className="text-lg font-bold tracking-tight">Chats</h1>
            <p className="text-xs text-muted-foreground">
              Grupos por nodo + directos
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setNuevoDirectoOpen(true)}
              aria-label="Nuevo chat directo"
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              Nuevo
            </Button>
            {permisoNotif === "default" && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={onPedirPermiso}
                className="h-7 px-2 text-[11px]"
                title="Permitir notificaciones del navegador"
              >
                <Bell className="mr-1 h-3 w-3" />
                Activar notif.
              </Button>
            )}
            {permisoNotif === "denied" && (
              <span
                className="inline-flex items-center gap-1 text-[10px] text-muted-foreground"
                title="El navegador bloqueó las notificaciones. Cámbialo desde la barra de URL → permisos → Notificaciones."
              >
                <BellOff className="h-3 w-3" />
                Notif. bloqueadas
              </span>
            )}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              Cargando…
            </p>
          ) : (
            <>
              <Seccion
                titulo="Grupos por nodo"
                icon={<Smartphone className="h-3.5 w-3.5" />}
                items={grupos}
                seleccionado={seleccionado}
                onClick={elegir}
                tituloPara={tituloPara}
              />
              <Seccion
                titulo="Directos"
                icon={<User className="h-3.5 w-3.5" />}
                items={directos}
                seleccionado={seleccionado}
                onClick={elegir}
                tituloPara={tituloPara}
              />
            </>
          )}
        </div>
      </aside>

      {/* Main */}
      <main className="min-h-0 flex-1">
        {seleccionado && titulo ? (
          <ChatView
            chatId={seleccionado.chatId}
            tipo={seleccionado.tipo}
            titulo={titulo.titulo}
            subtitulo={titulo.subtitulo}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
            <MessageCircle className="h-12 w-12 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              Elige un chat de la lista para empezar.
            </p>
          </div>
        )}
      </main>

      <NuevoChatDirectoModal
        open={nuevoDirectoOpen}
        onClose={() => setNuevoDirectoOpen(false)}
        onCreado={(pairId) => {
          setSeleccionado({ chatId: pairId, tipo: "directo" });
          setNuevoDirectoOpen(false);
        }}
      />
    </div>
  );
}

function Seccion({
  titulo,
  icon,
  items,
  seleccionado,
  onClick,
  tituloPara,
}: {
  titulo: string;
  icon: React.ReactNode;
  items: ChatListItem[];
  seleccionado: ChatSeleccionado | null;
  onClick: (item: ChatListItem) => void;
  tituloPara: (c: ChatListItem) => { titulo: string; subtitulo: string };
}) {
  return (
    <div className="border-b last:border-b-0">
      <div className="flex items-center gap-2 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {icon}
        {titulo}
        <span className="ml-auto rounded-full bg-muted px-1.5 text-[10px]">
          {items.length}
        </span>
      </div>
      {items.length === 0 ? (
        <p className="px-4 pb-2 text-xs text-muted-foreground/70">Vacío</p>
      ) : (
        <ul>
          {items.map((it) => {
            const { titulo, subtitulo } = tituloPara(it);
            const seleccionadoActivo =
              seleccionado?.chatId === it.docId &&
              seleccionado.tipo === it.tipo;
            const preview = it.ultimoMensaje?.esMedia
              ? "📷 Imagen"
              : (it.ultimoMensaje?.textoPreview ?? "Sin mensajes");
            return (
              <li key={`${it.tipo}__${it.docId}`}>
                <button
                  type="button"
                  onClick={() => onClick(it)}
                  className={`flex w-full flex-col items-stretch gap-0.5 border-l-2 px-4 py-2 text-left transition hover:bg-accent ${
                    seleccionadoActivo
                      ? "border-l-primary bg-accent"
                      : "border-l-transparent"
                  }`}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="min-w-0 truncate text-sm font-medium">
                      {titulo}
                    </span>
                    {it.ultimoMensaje?.fechaISO && (
                      <span className="shrink-0 text-[10px] text-muted-foreground">
                        {formatearHoraCorta(it.ultimoMensaje.fechaISO)}
                      </span>
                    )}
                  </div>
                  <span className="truncate text-xs text-muted-foreground">
                    {it.ultimoMensaje?.remitenteNombre
                      ? `${it.ultimoMensaje.remitenteNombre}: `
                      : ""}
                    {preview}
                  </span>
                  <span className="text-[10px] text-muted-foreground/70">
                    {subtitulo}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function formatearHoraCorta(iso: string): string {
  try {
    const d = new Date(iso);
    const hoy = new Date();
    const esHoy = d.toDateString() === hoy.toDateString();
    if (esHoy) {
      return new Intl.DateTimeFormat("es-MX", {
        hour: "numeric",
        minute: "2-digit",
      }).format(d);
    }
    return new Intl.DateTimeFormat("es-MX", {
      day: "numeric",
      month: "short",
    }).format(d);
  } catch {
    return "";
  }
}
