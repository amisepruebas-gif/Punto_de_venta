import { useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useChatList } from "./useChatList";

/**
 * Notificaciones de chat para admin-web. Detecta mensajes nuevos en
 * cualquier chat (grupo o directo) donde el admin participa, y dispara:
 *
 *   - **Sonido** (`/sound/notificacion_1.mp3`) — mismo archivo que la APK
 *     nodo_1.
 *   - **Web Notification** (`new Notification(...)`) cuando la pestaña
 *     NO está visible (`document.hidden`) o cuando no estás en `/chat`.
 *     Solo si el usuario ya concedió permiso. La solicitud de permiso
 *     se hace desde el botón en el header de `/chat`.
 *
 * **Limitación**: estas notificaciones solo funcionan mientras hay UNA
 * pestaña abierta con admin-web. Si el usuario cierra el navegador o
 * todas las pestañas, no llegan. Para eso se requiere Web Push + FCM
 * (Service Worker registrado para push events + Cloud Function que
 * dispare el push al crear mensaje) — pendiente como Fase F+ en doc 15.
 *
 * **Detección de "nuevo"**: cada chat tiene `meta.ultimoMensaje.huella`.
 * El hook recuerda en un Map qué huella vio por última vez por cada
 * chatId. Cuando llega un snapshot con huella distinta Y `remitenteId`
 * no soy yo Y `fechaISO > mountedAt` (evita sonar por mensajes
 * históricos al montar el hook), dispara la notificación.
 */
export function useChatNotifications(): void {
  const auth = useAuth();
  const uid = auth.user?.user.uid ?? null;
  const { grupos, directos } = useChatList();

  const audioRef = useRef<HTMLAudioElement | null>(null);
  // ISO del momento en que el hook montó — los mensajes con `fechaISO`
  // anterior se consideran "ya vistos" y no disparan notificación.
  const mountedAtRef = useRef<string>(new Date().toISOString());
  // Map chatId → ultima huella vista. Evita re-disparar la notificación
  // ante re-snapshots con el mismo ultimoMensaje.
  const huellasVistasRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!audioRef.current) {
      audioRef.current = new Audio("/sound/notificacion_1.mp3");
      audioRef.current.preload = "auto";
    }
  }, []);

  useEffect(() => {
    if (!uid) return;
    const todosLosChats = [...grupos, ...directos];

    for (const chat of todosLosChats) {
      const um = chat.ultimoMensaje;
      if (!um) continue;

      const chatId = chat.docId;
      const huellaPrevia = huellasVistasRef.current.get(chatId);

      // Primer fire para este chat — solo registrar, NO notificar.
      // Cubre el caso del admin que entra y ya hay mensajes históricos.
      if (huellaPrevia === undefined) {
        huellasVistasRef.current.set(chatId, um.huella);
        continue;
      }

      if (um.huella === huellaPrevia) continue;
      huellasVistasRef.current.set(chatId, um.huella);

      // No notificar si el mensaje es mío.
      if (um.remitenteId === uid) continue;

      // No notificar mensajes anteriores al mount del hook (paranoia
      // extra contra snapshots desordenados).
      if (um.fechaISO <= mountedAtRef.current) continue;

      dispararNotificacion({
        titulo: chat.tipo === "grupo" ? "Mensaje del nodo" : "Mensaje directo",
        cuerpo: `${um.remitenteNombre}: ${um.esMedia ? "📷 Imagen" : um.textoPreview}`,
        audio: audioRef.current,
      });
    }
  }, [grupos, directos, uid]);
}

function dispararNotificacion(args: {
  titulo: string;
  cuerpo: string;
  audio: HTMLAudioElement | null;
}): void {
  // Sonido siempre que sea posible (browsers que requieren gesto previo
  // bloquearán esto silenciosamente — aceptable).
  if (args.audio) {
    args.audio.currentTime = 0;
    args.audio.play().catch(() => {
      // autoplay bloqueado — silencioso
    });
  }

  // Web Notification solo si:
  //   - el browser soporta la API
  //   - el user concedió permiso
  //   - la pestaña no está visible (`document.hidden`)
  //     (si está visible, el visual in-page basta — agregar notification
  //     OS encima sería ruidoso)
  if (typeof window === "undefined") return;
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  if (!document.hidden) return;

  try {
    const n = new Notification(args.titulo, {
      body: args.cuerpo,
      icon: "/icons/icon-192.png",
      tag: "amise-admin-chat",
      // `renotify` requiere `tag` y permite que aparezca de nuevo aunque
      // el `tag` ya tenga otra activa. Útil si llegan 2 mensajes seguidos.
      renotify: true,
    } as NotificationOptions);
    // Auto-cerrar tras unos segundos (en algunos navegadores las
    // notificaciones persisten hasta que el user las descarta).
    setTimeout(() => n.close(), 6000);
    // Click en la notificación lleva al chat.
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch {
    // Algunos navegadores en modo private o en iframes restringen
    // new Notification() — silencioso.
  }
}

/** Estado del permiso de notificaciones. */
export type EstadoPermisoNotificacion = "default" | "granted" | "denied";

/** Lee el permiso actual. `"default"` significa "aún no se ha preguntado". */
export function leerPermisoNotificacion(): EstadoPermisoNotificacion {
  if (typeof window === "undefined" || !("Notification" in window))
    return "denied";
  return Notification.permission;
}

/** Solicita el permiso. Retorna el resultado. Si el usuario lo denegó
 *  previamente, el browser no abre el prompt — devuelve `"denied"`. */
export async function pedirPermisoNotificacion(): Promise<EstadoPermisoNotificacion> {
  if (typeof window === "undefined" || !("Notification" in window))
    return "denied";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  try {
    return await Notification.requestPermission();
  } catch {
    return "denied";
  }
}
