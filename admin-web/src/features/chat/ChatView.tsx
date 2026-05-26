import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import {
  ChevronUp,
  CornerUpLeft,
  ImagePlus,
  Send,
  Smile,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { compressToWebP } from "@/lib/image";
import { useAuth } from "@/hooks/useAuth";
import type { ChatTipo } from "@shared";
import {
  enviarMensajeImagenAdmin,
  enviarMensajeTextoAdmin,
  marcarAperturaAdmin,
  marcarUltimoMensajeLeidoAdmin,
} from "./chatAdminService";
import { useChatActivo, type MensajeRender } from "./useChatActivo";
import { ImageLightbox } from "./ImageLightbox";
import { GrupoMiembrosPanel } from "./GrupoMiembrosPanel";

const CHAT_IMG_MAX_BYTES = 700 * 1024;

const EMOJIS = [
  "😀", "😁", "😂", "🤣", "😊", "😍", "😘", "😎",
  "🤩", "🤔", "🙃", "😅", "😇", "🥳", "😉", "😏",
  "😢", "😭", "😡", "🤬", "🤯", "🥺", "😱", "😴",
  "👍", "👎", "👌", "👏", "🙏", "💪", "🤝", "✌️",
  "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "💔",
  "🔥", "✨", "⭐", "💯", "🎉", "🎁", "🎈", "💰",
  "✅", "❌", "⚠️", "❓", "❗", "💬", "📌", "📷",
];

type ReplyTo = {
  huella: string;
  remitenteNombre: string;
  texto?: string;
  imagenUrl?: string;
};

type Props = {
  chatId: string;
  tipo: ChatTipo;
  /** Etiqueta principal a mostrar en el header (nombre del nodo, otro
   *  admin, etc.). El componente no lo calcula porque depende de joins
   *  con otros catálogos (nodos, colaboradores, whitelist). */
  titulo: string;
  /** Subtítulo opcional (ej. "Grupo del nodo · 3 miembros"). */
  subtitulo?: string;
};

/**
 * Vista de un chat (grupo o directo) desde el lado admin. Equivalente
 * funcional a `ChatGrupoModal` del nodo-web pero embebida en un layout
 * split-pane sin backdrop. Las features:
 *
 *   - Burbujas con replies + lightbox
 *   - Composer: texto + emoji + imagen (compresión WebP ≤ 700 KB)
 *   - Auto-scroll al final
 *   - Marcar apertura al abrir / al recibir mensaje nuevo
 *   - Auto-add al `miembros` si el admin no está (superadmin abriendo
 *     un grupo donde no entró por whitelist)
 *   - Carga progresiva día por día (heurístico 7 días vacíos)
 */
export function ChatView({ chatId, tipo, titulo, subtitulo }: Props) {
  const auth = useAuth();
  const uid = auth.user?.user.uid ?? null;
  const role = auth.user?.claims.role ?? null;
  const nombreAdmin =
    auth.user?.user.displayName ??
    auth.user?.user.email ??
    "Admin";

  const {
    negocioId,
    meta,
    mensajes,
    loading,
    cargandoMas,
    hayMasDias,
    cargarDiaAnterior,
  } = useChatActivo({ chatId, tipo });

  const [texto, setTexto] = useState("");
  const [sending, setSending] = useState(false);
  const [comprimiendo, setComprimiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [replyTo, setReplyTo] = useState<ReplyTo | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [panelMiembrosOpen, setPanelMiembrosOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listaRef = useRef<HTMLDivElement>(null);

  // Refs para evitar writes redundantes a `meta.estadoPorMiembro` (fix #1
  // y #2 del audit Fase F):
  //   - aperturaInicialDoneRef: clave del chat para el que ya se mandó el
  //     write de apertura (`ultimaApertura` + posible autoAdd). Evita
  //     loop infinito porque `meta` está en deps y nuestro propio write
  //     hace que el snapshot vuelva con un meta nuevo → ref → deps cambian.
  //   - ultimaHuellaMarcadaRef: huella del último mensaje cuyo
  //     `ultimoMensajeLeido` ya escribimos. Evita reescribir el mismo
  //     valor mil veces ante re-snapshots.
  const aperturaInicialDoneRef = useRef<string | null>(null);
  const ultimaHuellaMarcadaRef = useRef<string | null>(null);

  // Auto-scroll al recibir mensajes.
  useEffect(() => {
    if (!listaRef.current) return;
    listaRef.current.scrollTop = listaRef.current.scrollHeight;
  }, [mensajes.length]);

  // Reset de refs al cambiar de chat — para que la apertura inicial se
  // vuelva a marcar al entrar a otro chat.
  useEffect(() => {
    aperturaInicialDoneRef.current = null;
    ultimaHuellaMarcadaRef.current = null;
  }, [chatId, tipo]);

  // Marcar apertura / ultimoMensajeLeido. Lógica dual:
  //   - Primera vez en este chat: write completo (timestamp + huella +
  //     autoAdd si aplica).
  //   - Mensaje nuevo mientras estaba abierto: write solo de
  //     `ultimoMensajeLeido`, NO toca `ultimaApertura` (evita write
  //     amplification por cada mensaje recibido).
  useEffect(() => {
    if (!negocioId || !uid || !chatId || !meta) return;

    const claveChat = `${chatId}__${tipo}`;
    const ultimaHuella =
      mensajes.length > 0 ? mensajes[mensajes.length - 1].huella : null;
    const esAperturaInicial = aperturaInicialDoneRef.current !== claveChat;

    if (esAperturaInicial) {
      aperturaInicialDoneRef.current = claveChat;
      ultimaHuellaMarcadaRef.current = ultimaHuella;
      // Auto-add a `meta.miembros` con arrayUnion para admins que aún no
      // están en el grupo. Aplica tanto a admin-real (no está en
      // whitelist por diseño) como a admin-delegado (que pudo haberse
      // agregado DESPUÉS del registro del nodo y por eso no quedó en el
      // miembros inicial del grupo). Spec doc 14: ambos roles
      // "entran automáticamente a todos los grupos".
      const autoAddMember =
        (role === "superadmin" || role === "admin") &&
        tipo === "grupo" &&
        !meta.miembros?.includes(uid);
      marcarAperturaAdmin({
        negocioId,
        chatId,
        tipo,
        uid,
        ...(ultimaHuella ? { huellaUltimoMensaje: ultimaHuella } : {}),
        autoAddMember,
      }).catch((e) => {
        console.warn("marcarAperturaAdmin:", e);
      });
      return;
    }

    // No es apertura inicial. Solo actualizar huella si cambió.
    if (ultimaHuella && ultimaHuella !== ultimaHuellaMarcadaRef.current) {
      ultimaHuellaMarcadaRef.current = ultimaHuella;
      marcarUltimoMensajeLeidoAdmin({
        negocioId,
        chatId,
        tipo,
        uid,
        huella: ultimaHuella,
      }).catch((e) => {
        console.warn("marcarUltimoMensajeLeidoAdmin:", e);
      });
    }
  }, [negocioId, uid, chatId, tipo, meta, mensajes.length, role]);

  // Reset al cambiar de chat. Cubre todo el state interno del componente
  // para evitar leaks visuales — incluyendo `panelMiembrosOpen` que sin
  // este reset quedaría abierto pero mostrando datos del NUEVO chat
  // (confuso porque el user lo abrió para el anterior).
  useEffect(() => {
    setTexto("");
    setReplyTo(null);
    setEmojiOpen(false);
    setLightboxUrl(null);
    setError(null);
    setSending(false);
    setComprimiendo(false);
    setPanelMiembrosOpen(false);
  }, [chatId, tipo]);

  function insertarEmoji(emoji: string) {
    const el = inputRef.current;
    if (!el) {
      setTexto((t) => t + emoji);
      return;
    }
    const start = el.selectionStart ?? texto.length;
    const end = el.selectionEnd ?? texto.length;
    const nuevo = texto.slice(0, start) + emoji + texto.slice(end);
    setTexto(nuevo);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + emoji.length;
      el.setSelectionRange(pos, pos);
    });
  }

  async function onElegirImagen(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!negocioId || !uid) return;
    if (sending || comprimiendo) return;
    if (!file.type.startsWith("image/")) {
      setError("El archivo no es una imagen.");
      return;
    }
    setError(null);
    setComprimiendo(true);
    let comprimida: File;
    try {
      const blob = await compressToWebP(file, { maxBytes: CHAT_IMG_MAX_BYTES });
      const baseName = file.name.replace(/\.[^.]+$/, "") || "imagen";
      comprimida = new File([blob], `${baseName}.webp`, { type: "image/webp" });
    } catch (err) {
      console.error("compressToWebP:", err);
      setError("No se pudo procesar la imagen.");
      setComprimiendo(false);
      return;
    }
    setComprimiendo(false);
    setSending(true);
    try {
      await enviarMensajeImagenAdmin({
        negocioId,
        chatId,
        tipo,
        uid,
        remitenteNombre: nombreAdmin,
        texto: texto.trim(),
        archivo: comprimida,
        ...(replyTo
          ? {
              reply: {
                huella: replyTo.huella,
                remitenteNombre: replyTo.remitenteNombre,
                texto: replyTo.texto,
                imagenUrl: replyTo.imagenUrl,
              },
            }
          : {}),
      });
      setTexto("");
      setEmojiOpen(false);
      setReplyTo(null);
    } catch (err) {
      console.error("enviarMensajeImagenAdmin:", err);
      setError("No se pudo enviar la imagen.");
    } finally {
      setSending(false);
      // Mismo motivo que en onSubmit: re-foco al input para seguir
      // escribiendo (típico flujo: imagen + texto, o múltiples imágenes).
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const limpio = texto.trim();
    if (!limpio || sending) return;
    if (!negocioId || !uid) return;
    setSending(true);
    setError(null);
    try {
      await enviarMensajeTextoAdmin({
        negocioId,
        chatId,
        tipo,
        uid,
        remitenteNombre: nombreAdmin,
        texto: limpio,
        ...(replyTo
          ? {
              reply: {
                huella: replyTo.huella,
                remitenteNombre: replyTo.remitenteNombre,
                texto: replyTo.texto,
                imagenUrl: replyTo.imagenUrl,
              },
            }
          : {}),
      });
      setTexto("");
      setEmojiOpen(false);
      setReplyTo(null);
    } catch (err) {
      console.error("enviarMensajeTextoAdmin:", err);
      setError("No se pudo enviar el mensaje.");
    } finally {
      setSending(false);
      // Re-foco al input tras enviar — para que el user siga escribiendo
      // sin tener que volver a clicar el campo. rAF respeta el siguiente
      // paint (estado committed, re-render con value="" ya aplicado).
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }

  function responderA(m: MensajeRender) {
    setReplyTo({
      huella: m.huella,
      remitenteNombre: m.remitenteNombre,
      texto: m.texto || (m.mediaUrl ? "📷 Imagen" : ""),
      imagenUrl: m.mediaUrl,
    });
    inputRef.current?.focus();
  }

  return (
    <>
      <div className="flex h-full flex-col bg-card">
        <header className="flex items-center justify-between gap-2 border-b p-3">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold">{titulo}</h2>
            {subtitulo && (
              <p className="truncate text-xs text-muted-foreground">
                {subtitulo}
              </p>
            )}
          </div>
          {tipo === "grupo" && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setPanelMiembrosOpen(true)}
              aria-label="Ver miembros y habilitar colaboradores"
            >
              <Users className="mr-1 h-4 w-4" />
              Miembros
            </Button>
          )}
        </header>

        <div
          ref={listaRef}
          className="flex-1 space-y-2 overflow-y-auto px-3 py-3"
        >
          {hayMasDias && (
            <div className="flex justify-center">
              <Button
                size="sm"
                variant="outline"
                type="button"
                onClick={cargarDiaAnterior}
                disabled={cargandoMas || loading}
              >
                <ChevronUp className="mr-1 h-3 w-3" />
                {cargandoMas ? "Cargando…" : "Ver anteriores"}
              </Button>
            </div>
          )}
          {loading && mensajes.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Cargando…
            </p>
          ) : mensajes.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Sin mensajes todavía.
            </p>
          ) : (
            <MensajesLista
              mensajes={mensajes}
              miMemberId={uid ?? ""}
              onResponder={responderA}
              onAbrirImagen={(url) => setLightboxUrl(url)}
            />
          )}
        </div>

        {replyTo && (
          <div className="flex items-start gap-2 border-t bg-muted/40 px-3 py-2">
            <CornerUpLeft className="mt-0.5 h-4 w-4 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold">
                Respondiendo a {replyTo.remitenteNombre}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {replyTo.texto || "📷 Imagen"}
              </p>
            </div>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setReplyTo(null)}
              aria-label="Cancelar respuesta"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        {emojiOpen && (
          <div className="grid max-h-40 grid-cols-8 gap-1 overflow-y-auto border-t bg-muted/30 p-2">
            {EMOJIS.map((e) => (
              <button
                type="button"
                key={e}
                onClick={() => insertarEmoji(e)}
                className="rounded p-1 text-2xl hover:bg-muted"
              >
                {e}
              </button>
            ))}
          </div>
        )}

        <form
          onSubmit={onSubmit}
          className="flex items-center gap-2 border-t p-2"
        >
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setEmojiOpen((v) => !v)}
            aria-label="Emojis"
          >
            <Smile className="h-5 w-5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            aria-label="Imagen"
            disabled={sending || comprimiendo}
          >
            <ImagePlus className="h-5 w-5" />
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onElegirImagen}
          />
          <input
            ref={inputRef}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder={
              comprimiendo
                ? "Comprimiendo imagen…"
                : sending
                  ? "Enviando…"
                  : "Escribe un mensaje…"
            }
            className="flex-1 rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            disabled={sending || comprimiendo}
            autoComplete="off"
          />
          <Button
            type="submit"
            size="icon"
            disabled={sending || comprimiendo || !texto.trim()}
            aria-label="Enviar"
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>

        {error && (
          <p
            role="alert"
            className="border-t border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
          >
            {error}
          </p>
        )}
      </div>

      <ImageLightbox src={lightboxUrl} onClose={() => setLightboxUrl(null)} />

      {tipo === "grupo" && (
        <GrupoMiembrosPanel
          nodoId={chatId}
          meta={meta}
          open={panelMiembrosOpen}
          onClose={() => setPanelMiembrosOpen(false)}
        />
      )}
    </>
  );
}

function MensajesLista({
  mensajes,
  miMemberId,
  onResponder,
  onAbrirImagen,
}: {
  mensajes: MensajeRender[];
  miMemberId: string;
  onResponder: (m: MensajeRender) => void;
  onAbrirImagen: (url: string) => void;
}) {
  const grupos: Array<{ ymd: string; mensajes: MensajeRender[] }> = [];
  for (const m of mensajes) {
    const last = grupos[grupos.length - 1];
    if (last && last.ymd === m.ymd) {
      last.mensajes.push(m);
    } else {
      grupos.push({ ymd: m.ymd, mensajes: [m] });
    }
  }

  return (
    <div className="space-y-3">
      {grupos.map((g) => (
        <div key={g.ymd} className="space-y-1.5">
          <div className="sticky top-0 z-10 mx-auto w-fit rounded-full bg-muted px-3 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
            {formatearYmd(g.ymd)}
          </div>
          {g.mensajes.map((m) => (
            <Burbuja
              key={m.huella}
              mensaje={m}
              propio={m.remitenteId === miMemberId}
              onResponder={() => onResponder(m)}
              onAbrirImagen={onAbrirImagen}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function Burbuja({
  mensaje,
  propio,
  onResponder,
  onAbrirImagen,
}: {
  mensaje: MensajeRender;
  propio: boolean;
  onResponder: () => void;
  onAbrirImagen: (url: string) => void;
}) {
  return (
    <div className={`flex ${propio ? "justify-end" : "justify-start"}`}>
      <div
        className={
          propio
            ? "max-w-[78%] rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-primary-foreground"
            : "max-w-[78%] rounded-2xl rounded-bl-sm bg-muted px-3 py-2"
        }
      >
        {!propio && (
          <p className="text-[11px] font-semibold">{mensaje.remitenteNombre}</p>
        )}
        {mensaje.replyHuella && (
          <button
            type="button"
            onClick={() => {
              if (mensaje.replyImagenUrl) onAbrirImagen(mensaje.replyImagenUrl);
            }}
            className="mb-1 block w-full rounded-md border-l-4 border-current/50 bg-black/10 px-2 py-1 text-left text-[11px] opacity-90"
          >
            <span className="block font-semibold">
              {mensaje.replyRemitenteNombre}
            </span>
            <span className="line-clamp-2">
              {mensaje.replyTexto ||
                (mensaje.replyImagenUrl ? "📷 Imagen" : "")}
            </span>
          </button>
        )}
        {mensaje.mediaUrl && (
          <button
            type="button"
            className="mb-1 block w-full overflow-hidden rounded-md"
            onClick={() => onAbrirImagen(mensaje.mediaUrl!)}
            aria-label="Ampliar imagen"
          >
            <img
              src={mensaje.mediaUrl}
              alt={mensaje.mediaFileName ?? "imagen"}
              className="max-h-64 w-full object-cover"
              decoding="async"
              loading="lazy"
            />
          </button>
        )}
        {mensaje.texto && (
          <p className="whitespace-pre-wrap break-words text-sm">
            {mensaje.texto}
          </p>
        )}
        <div className="mt-0.5 flex items-center justify-end gap-1.5 text-[10px] opacity-70">
          <span>{formatearHora(mensaje.fechaISO)}</span>
          <button
            type="button"
            onClick={onResponder}
            className="hover:opacity-100"
            aria-label="Responder"
          >
            <CornerUpLeft className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

function formatearYmd(ymd: string): string {
  const y = ymd.slice(0, 4);
  const m = ymd.slice(4, 6);
  const d = ymd.slice(6, 8);
  const date = new Date(`${y}-${m}-${d}T12:00:00`);
  return new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatearHora(iso: string): string {
  try {
    return new Intl.DateTimeFormat("es-MX", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(new Date(iso));
  } catch {
    return "";
  }
}
