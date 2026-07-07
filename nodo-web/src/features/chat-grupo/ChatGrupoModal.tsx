import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { ChevronUp, CornerUpLeft, ImagePlus, Send, Smile, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNodoSession } from "@/hooks/useNodoSession";
import { useCarrito } from "@/features/ventas/carritoStore";
import { compressToWebP } from "@/lib/image";
import { useBackHandler } from "@/lib/back-handler";
import { ImageLightbox } from "./ImageLightbox";
import { type ChatGrupoNodoData, type MensajeRender } from "./useChatGrupoNodo";
import {
  enviarMensajeImagen,
  enviarMensajeTexto,
  marcarApertura,
} from "./chatGrupoService";

type Props = {
  open: boolean;
  onClose: () => void;
  /** Resultado de `useChatGrupoNodo()` invocado en el padre (Ventas.tsx).
   *  Se sube el hook al padre para que el sonido de notificación y el
   *  contador de no-leídos funcionen aunque el modal esté cerrado.
   *  Mantenerlo aquí dentro lo limitaría a "sólo escucho sonidos cuando
   *  tengo el chat abierto", que es lo contrario de lo deseado. */
  data: ChatGrupoNodoData;
};

/** Tope para imágenes de chat antes de subir. El cliente comprime a WebP
 *  re-escalando y bajando quality hasta caber. */
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

/**
 * Modal de chat grupal del nodo. Replica el visual del `pop_mensajes` del
 * Android nodo_1: card centrada, compacta (~400px max), sobre backdrop
 * oscuro semi-transparente. Incluye:
 *
 *   - Emoji picker (panel desplegable)
 *   - Adjuntar imagen (comprimida a WebP ≤ 700 KB antes de subir, vía
 *     `compressToWebP`)
 *   - Reply a mensaje previo (incluye preview)
 *   - Click en imagen → `ImageLightbox` con pinch-zoom y pan (optimizado
 *     para tablet vía Pointer Events)
 *
 * Las imágenes se cachean automáticamente:
 *   - En APK: cache nativo `ImageCache.java` (filtro por substring
 *     `media_web_new_version`).
 *   - En navegador: Service Worker runtimeCaching `firebase-storage-img`.
 */
export function ChatGrupoModal({ open, onClose, data }: Props) {
  const { nodoId } = useNodoSession();
  const { enTurno } = useCarrito();
  const {
    negocioId,
    nodoId: chatNodoId,
    mensajes,
    loading,
    bootstrapError,
    cargandoMas,
    hayMasDias,
    cargarDiaAnterior,
  } = data;

  const [texto, setTexto] = useState("");
  const [sending, setSending] = useState(false);
  const [comprimiendo, setComprimiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [replyTo, setReplyTo] = useState<ReplyTo | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listaRef = useRef<HTMLDivElement>(null);

  // Auto-scroll al final cuando llegan mensajes nuevos.
  useEffect(() => {
    if (!open || !listaRef.current) return;
    listaRef.current.scrollTop = listaRef.current.scrollHeight;
  }, [mensajes.length, open]);

  // Marcar apertura cuando se abre el modal (snapshot en meta).
  useEffect(() => {
    if (!open || !negocioId || !chatNodoId) return;
    const ultimaHuella =
      mensajes.length > 0 ? mensajes[mensajes.length - 1].huella : undefined;
    marcarApertura({
      negocioId,
      nodoId: chatNodoId,
      memberId: chatNodoId,
      huellaUltimoMensaje: ultimaHuella,
    }).catch(() => {});
  }, [open, negocioId, chatNodoId, mensajes.length]);

  useEffect(() => {
    if (!open) {
      setEmojiOpen(false);
      setReplyTo(null);
      setLightboxUrl(null);
      setError(null);
      setComprimiendo(false);
      // Resetear sending también — si el user cierra el modal mientras un
      // upload está in-flight y reabre antes de que el await termine, sin
      // este reset hereda `sending=true` y todos los inputs quedan disabled
      // (mismo patrón del bug en ConfirmarVentaModal). El upload en background
      // sigue su curso aunque visualmente lo ignoremos.
      setSending(false);
    }
  }, [open]);

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
    if (!negocioId || !chatNodoId) return;
    // Guard contra entrada concurrente: si ya hay un upload o compresión
    // en curso, ignoramos el segundo file. El botón ya está disabled, pero
    // el file-picker nativo puede ser disparado por gestos raros.
    if (sending || comprimiendo) return;
    if (!file.type.startsWith("image/")) {
      setError("El archivo no es una imagen.");
      return;
    }
    const remitenteNombre = enTurno?.trim() || "Nodo";
    setError(null);
    setComprimiendo(true);
    let comprimida: File;
    try {
      // Compresión cliente: garantiza ≤ 700KB antes de subir. Si la imagen
      // ya es pequeña, `compressToWebP` retorna rápido sin re-encode.
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
      await enviarMensajeImagen({
        negocioId,
        nodoId: chatNodoId,
        remitenteId: chatNodoId,
        remitenteTipo: "nodo",
        remitenteNombre,
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
      console.error("enviarMensajeImagen:", err);
      setError("No se pudo enviar la imagen.");
    } finally {
      setSending(false);
      // Re-foco al input para seguir escribiendo (típico flujo: imagen
      // con caption, o múltiples imágenes seguidas).
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const limpio = texto.trim();
    if (!limpio || sending) return;
    if (!negocioId || !chatNodoId) return;
    const remitenteNombre = enTurno?.trim() || "Nodo";
    setSending(true);
    setError(null);
    try {
      await enviarMensajeTexto({
        negocioId,
        nodoId: chatNodoId,
        remitenteId: chatNodoId,
        remitenteTipo: "nodo",
        remitenteNombre,
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
      console.error("enviarMensajeTexto:", err);
      setError("No se pudo enviar el mensaje.");
    } finally {
      setSending(false);
      // Re-foco al input tras enviar — para que el user siga escribiendo
      // sin tener que volver a clicar el campo. rAF respeta el siguiente
      // paint (estado committed, re-render con value="" ya aplicado).
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }

  // Back físico Android: si el lightbox está abierto encima del modal, el
  // back debe cerrar SOLO el lightbox. Sin este handler interno, el
  // back-handler de Ventas.tsx detecta chatOpen=true y cierra todo el
  // modal (incluyendo el lightbox encima). Stack-based: este registro
  // queda arriba del de Ventas y consume primero cuando aplica.
  useBackHandler(
    () => {
      if (open && lightboxUrl) {
        setLightboxUrl(null);
        return true;
      }
      return false;
    },
    [open, lightboxUrl],
  );

  function responderA(m: MensajeRender) {
    setReplyTo({
      huella: m.huella,
      remitenteNombre: m.remitenteNombre,
      texto: m.texto || (m.mediaUrl ? "📷 Imagen" : ""),
      imagenUrl: m.mediaUrl,
    });
    inputRef.current?.focus();
  }

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4"
        onClick={onClose}
        role="dialog"
        aria-modal
        aria-label="Chat del nodo"
      >
        {/* Card centrada estilo pop_mensajes del nodo_1: ~400px ancho,
            hasta 85vh de alto. En tablets queda flotando al centro. */}
        <div
          className="flex h-[85vh] max-h-[680px] w-full max-w-[420px] flex-col overflow-hidden rounded-2xl bg-card shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <header className="flex items-center justify-between gap-2 border-b p-3">
            <div className="min-w-0">
              <h2 className="text-base font-semibold">Chat del nodo</h2>
              <p className="truncate text-xs text-muted-foreground">
                Grupo con admins{enTurno ? ` · ${enTurno}` : ""}
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar">
              <X className="h-5 w-5" />
            </Button>
          </header>

          {bootstrapError && (
            <div className="border-b border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {bootstrapError}
            </div>
          )}

          {/* Lista de mensajes */}
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
                miMemberId={nodoId ?? ""}
                onResponder={responderA}
                onAbrirImagen={(url) => setLightboxUrl(url)}
              />
            )}
          </div>

          {/* Reply preview */}
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

          {/* Emoji picker */}
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

          {/* Input */}
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
      </div>

      {/* Lightbox: pinch-zoom + doble-tap + pan. Optimizado tablet vía
          Pointer Events. */}
      <ImageLightbox src={lightboxUrl} onClose={() => setLightboxUrl(null)} />
    </>
  );
}

// ============================================================
// Lista de mensajes con burbujas
// ============================================================

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
              crossOrigin="anonymous"
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
