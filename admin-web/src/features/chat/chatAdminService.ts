import {
  arrayUnion,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";
import { db, storage } from "@/firebase/config";
import {
  paths,
  generarID,
  ymdMX,
  fechaISOStrict,
  type ChatMensaje,
  type ChatTipo,
} from "@shared";

/**
 * Servicio de chat para admin-web. Soporta grupos (chat por nodo) y
 * directos (1-a-1 entre admins/colaboradores). Mismo shape de mensajes
 * que el chat de nodo-web — sólo cambia `remitenteTipo: "admin"`.
 *
 * No mantiene estado: cada función es one-shot. Los hooks
 * (`useChatGrupoAdmin`, `useChatDirectoAdmin`) son los que escuchan.
 */

export type EnviarMensajeArgs = {
  negocioId: string;
  /** Para grupos: el `nodoId`. Para directos: el `pairId`. */
  chatId: string;
  tipo: ChatTipo;
  /** UID del admin (Firebase Auth). */
  uid: string;
  /** Snapshot del nombre del admin al momento del envío. */
  remitenteNombre: string;
  texto: string;
  reply?: {
    huella: string;
    remitenteNombre: string;
    texto?: string;
    imagenUrl?: string;
  };
};

function ymdKeyHoy(): string {
  const { y, m, d } = ymdMX();
  return `${y}${m.padStart(2, "0")}${d.padStart(2, "0")}`;
}

function ymdKeyDe(date: Date): string {
  const { y, m, d } = ymdMX(date);
  return `${y}${m.padStart(2, "0")}${d.padStart(2, "0")}`;
}

export function ymdKeyAnterior(ymd: string): string {
  const y = parseInt(ymd.slice(0, 4), 10);
  const m = parseInt(ymd.slice(4, 6), 10);
  const d = parseInt(ymd.slice(6, 8), 10);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() - 1);
  return ymdKeyDe(date);
}

function pathChatDia(args: { negocioId: string; chatId: string; tipo: ChatTipo; ymd: string }): string {
  return args.tipo === "grupo"
    ? paths.chatGrupoDia(args.negocioId, args.chatId, args.ymd)
    : paths.chatDirectoDia(args.negocioId, args.chatId, args.ymd);
}

function pathChatMeta(args: { negocioId: string; chatId: string; tipo: ChatTipo }): string {
  return args.tipo === "grupo"
    ? paths.chatGrupoMeta(args.negocioId, args.chatId)
    : paths.chatDirectoMeta(args.negocioId, args.chatId);
}

/** Construye el JSON-shape del mensaje sin escribir nada. */
function construirMensaje(args: EnviarMensajeArgs, extras: Partial<ChatMensaje> = {}): ChatMensaje {
  return {
    huella: generarID(),
    remitenteId: args.uid,
    remitenteTipo: "admin",
    remitenteNombre: args.remitenteNombre,
    fechaISO: fechaISOStrict(),
    texto: args.texto,
    ...extras,
    ...(args.reply
      ? {
          replyHuella: args.reply.huella,
          replyRemitenteNombre: args.reply.remitenteNombre,
          ...(args.reply.texto ? { replyTexto: args.reply.texto } : {}),
          ...(args.reply.imagenUrl
            ? { replyImagenUrl: args.reply.imagenUrl }
            : {}),
        }
      : {}),
  };
}

/** Agrega un mensaje al doc del día (lo crea si no existe) y actualiza
 *  el `ultimoMensaje` del meta. */
async function persistirMensaje(args: {
  negocioId: string;
  chatId: string;
  tipo: ChatTipo;
  mensaje: ChatMensaje;
}): Promise<void> {
  const ymd = ymdKeyHoy();
  const diaRef = doc(db, pathChatDia({ ...args, ymd }));
  await setDoc(
    diaRef,
    { ymd, mensajes: arrayUnion(args.mensaje) },
    { merge: true },
  );
  await actualizarUltimoMensajeMeta({
    negocioId: args.negocioId,
    chatId: args.chatId,
    tipo: args.tipo,
    mensaje: args.mensaje,
  });
}

async function actualizarUltimoMensajeMeta(args: {
  negocioId: string;
  chatId: string;
  tipo: ChatTipo;
  mensaje: ChatMensaje;
}): Promise<void> {
  const metaRef = doc(db, pathChatMeta(args));
  const preview = args.mensaje.texto
    ? args.mensaje.texto.slice(0, 120)
    : args.mensaje.mediaUrl
      ? "📷 Imagen"
      : "";
  await updateDoc(metaRef, {
    ultimoMensaje: {
      huella: args.mensaje.huella,
      textoPreview: preview,
      fechaISO: args.mensaje.fechaISO,
      remitenteId: args.mensaje.remitenteId,
      remitenteNombre: args.mensaje.remitenteNombre,
      ...(args.mensaje.mediaUrl ? { esMedia: true } : {}),
    },
    fechaActividad: serverTimestamp(),
  });
}

export async function enviarMensajeTextoAdmin(
  args: EnviarMensajeArgs,
): Promise<ChatMensaje> {
  const mensaje = construirMensaje(args);
  await persistirMensaje({
    negocioId: args.negocioId,
    chatId: args.chatId,
    tipo: args.tipo,
    mensaje,
  });
  return mensaje;
}

export async function enviarMensajeImagenAdmin(
  args: EnviarMensajeArgs & { archivo: File },
): Promise<ChatMensaje> {
  const huella = generarID();
  const ext = inferirExtension(args.archivo.name, args.archivo.type);
  // Mismo path-template que nodo-web, manteniendo paridad con cache nativo
  // y SW (substring `media_web_new_version` matchea).
  const path = `chat_media_web_new_version/${args.negocioId}/${args.chatId}/${huella}.${ext}`;
  const r = storageRef(storage, path);
  await uploadBytes(r, args.archivo, { contentType: args.archivo.type });
  const url = await getDownloadURL(r);

  const mensaje: ChatMensaje = {
    ...construirMensaje(args),
    huella,
    mediaUrl: url,
    mediaFileName: args.archivo.name,
    mediaSize: args.archivo.size,
  };
  await persistirMensaje({
    negocioId: args.negocioId,
    chatId: args.chatId,
    tipo: args.tipo,
    mensaje,
  });
  return mensaje;
}

function inferirExtension(filename: string, mime: string): string {
  const m = filename.match(/\.([a-zA-Z0-9]+)$/);
  if (m) return m[1].toLowerCase();
  if (mime === "image/png") return "png";
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/webp") return "webp";
  if (mime === "image/gif") return "gif";
  return "bin";
}

/**
 * Marca **apertura inicial** del chat por parte del admin. Escribe:
 *   - `ultimaApertura` (timestamp now) — telemetría que otros admins ven
 *   - `ultimoMensajeLeido` (huella del último mensaje visible)
 *   - opcionalmente, `arrayUnion(uid)` a `meta.miembros` para el caso del
 *     superadmin que no está en la whitelist y abre un grupo (doc 15
 *     línea 128-132).
 *
 * Para actualizar el `ultimoMensajeLeido` cuando llegan mensajes nuevos
 * SIN tocar el timestamp de apertura, usa
 * {@link marcarUltimoMensajeLeidoAdmin}.
 */
export async function marcarAperturaAdmin(args: {
  negocioId: string;
  chatId: string;
  tipo: ChatTipo;
  uid: string;
  huellaUltimoMensaje?: string;
  autoAddMember?: boolean;
}): Promise<void> {
  const metaRef = doc(db, pathChatMeta(args));
  const updates: Record<string, unknown> = {
    [`estadoPorMiembro.${args.uid}.ultimaApertura`]: fechaISOStrict(),
  };
  if (args.huellaUltimoMensaje) {
    updates[`estadoPorMiembro.${args.uid}.ultimoMensajeLeido`] = args.huellaUltimoMensaje;
  }
  if (args.autoAddMember) {
    updates.miembros = arrayUnion(args.uid);
  }
  await updateDoc(metaRef, updates);
}

/**
 * Actualiza SOLO `ultimoMensajeLeido` cuando llegan mensajes nuevos
 * mientras el chat ya está abierto. Llamar a `marcarAperturaAdmin` en
 * este caso sobreescribiría innecesariamente `ultimaApertura` (write
 * amplification — 1 write por mensaje recibido por cada admin viendo el
 * chat).
 */
export async function marcarUltimoMensajeLeidoAdmin(args: {
  negocioId: string;
  chatId: string;
  tipo: ChatTipo;
  uid: string;
  huella: string;
}): Promise<void> {
  const metaRef = doc(db, pathChatMeta(args));
  await updateDoc(metaRef, {
    [`estadoPorMiembro.${args.uid}.ultimoMensajeLeido`]: args.huella,
  });
}

/** Lee un día (one-shot). */
export async function leerMensajesDia(args: {
  negocioId: string;
  chatId: string;
  tipo: ChatTipo;
  ymd: string;
}): Promise<ChatMensaje[]> {
  const ref = doc(db, pathChatDia(args));
  const snap = await getDoc(ref);
  if (!snap.exists()) return [];
  const data = snap.data() as { mensajes?: ChatMensaje[] };
  return Array.isArray(data.mensajes) ? data.mensajes : [];
}

/**
 * Crea/asegura un chat directo entre dos identidades. Retorna el `pairId`.
 * Si el doc ya existe, no lo toca.
 */
export async function asegurarChatDirecto(args: {
  negocioId: string;
  uidA: string;
  uidB: string;
  nombreA: string;
  nombreB: string;
}): Promise<string> {
  // pairId determinista: sort lex de los dos ids unidos por "__".
  const pair = [args.uidA, args.uidB].sort();
  const pairId = `${pair[0]}__${pair[1]}`;
  const metaRef = doc(db, paths.chatDirectoMeta(args.negocioId, pairId));
  const snap = await getDoc(metaRef);
  if (snap.exists()) return pairId;
  const now = fechaISOStrict();
  await setDoc(metaRef, {
    chatId: pairId,
    tipo: "directo",
    miembros: pair,
    pairIds: pair as [string, string],
    estadoPorMiembro: {},
    fechaCreacion: now,
    fechaActividad: now,
  });
  return pairId;
}
